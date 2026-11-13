---
title: "SQL ยอดสินค้าคงเหลือรวม แยกคลัง พื้นที่เก็บ จุดสั่งซื้อ และสินค้าไม่เคลื่อนไหว"
audience: dev
tags: [sql, queries, ic, stock-balance, reorder]
aliases: ["SQL สต็อกคงเหลือ", "SQL ยอดคงเหลือคลัง", "ic_trans_detail balance", "SQL สินค้าถึงจุดสั่งซื้อ", "SQL สินค้าไม่เคลื่อนไหว", "query ยอดคงเหลือสินค้า แยกตามคลังสินค้า"]
sources: ["backend/internal/application/process/report_menu_ic.go:244-410", "backend/internal/application/process/report_menu_ic.go:600-705", "backend/internal/application/process/morning_briefing.go:697-755"]
---

คำสั่ง SQL สำหรับคำนวณยอดสต็อกคงเหลือ มูลค่าสต็อก ณ วันที่ต้องการ จุดสั่งซื้อ (Min/Max/Reorder Point) และสินค้าที่ไม่มีการเคลื่อนไหว ตามสูตรมาตรฐานของ Report Engine (`report_menu_ic.go`)

> [!IMPORTANT]
> อ่าน [[dev-rules-accounting-sql]] เสมอ: ต้องแปลงจำนวนเป็นหน่วยฐานผ่าน `stand_value / divide_value`, กรอง `COALESCE(d.last_status, 0) = 0`, `COALESCE(d.is_doc_copy, 0) = 0`, `COALESCE(i.item_type, 0) <> 5`, และตัดแถวซ้ำ POS (`notpos`)

---

## 1. ยอดสินค้าคงเหลือและมูลค่า ณ วันที่สิ้นสุด (แยกตามสินค้า / คลัง / พื้นที่เก็บ)

**พารามิเตอร์**: `$1::date` (ณ วันที่ เช่น `'2026-12-31'`), `$2::text` (รหัสคลัง หรือ `''` = ทุกคลัง)

```sql
WITH itm AS (
    SELECT i.code,
           COALESCE(i.name_1, '') AS item_name,
           COALESCE(i.item_type, 0) AS item_type,
           COALESCE(NULLIF(un.name_1, ''), i.unit_standard, '') AS unit_name,
           COALESCE((
               SELECT NULLIF(x.stand_value, 0) / NULLIF(x.divide_value, 0)
               FROM ic_unit_use x
               WHERE x.ic_code = i.code AND x.code = i.unit_standard
               LIMIT 1
           ), 1)::numeric AS ur
    FROM ic_inventory i
    LEFT JOIN ic_unit un ON un.code = i.unit_standard
    WHERE COALESCE(i.item_type, 0) <> 5
),
raw AS (
    SELECT d.item_code AS ic,
           COALESCE(d.wh_code, '') AS wh,
           COALESCE(d.shelf_code, '') AS sh,
           d.trans_flag::int AS tf,
           COALESCE(d.qty, 0)::numeric AS qty,
           ROUND(COALESCE(d.qty, 0)::numeric * COALESCE(NULLIF(d.stand_value, 0), 1)::numeric
                 / COALESCE(NULLIF(d.divide_value, 0), 1)::numeric, 2) AS bq,
           COALESCE(d.qty_2, 0)::numeric(18, 2) AS bq2,
           COALESCE(d.inquiry_type, 0)::int AS iq,
           COALESCE(d.sum_of_cost, 0)::numeric AS soc,
           COALESCE(d.profit_lost_cost_amount, 0)::numeric AS plc,
           COALESCE(d.calc_flag, 0) AS cf0,
           NOT (COALESCE(d.doc_ref, '') <> '' AND COALESCE(d.is_pos, 0) = 1) AS notpos
    FROM ic_trans_detail d
    JOIN itm ON itm.code = d.item_code
    WHERE COALESCE(d.last_status, 0) = 0
      AND COALESCE(d.is_doc_copy, 0) = 0
      AND COALESCE(d.doc_date_calc, d.doc_date) <= $1::date
      AND ($2 = '' OR COALESCE(d.wh_code, '') = $2)
),
fl AS (
    SELECT r.*,
           (tf IN (70, 54, 60, 58, 310, 12) OR (tf = 66 AND qty > 0) OR (tf = 14 AND iq = 0) OR (tf = 48 AND iq < 2)) AS f_in,
           ((tf IN (56, 68, 72, 44) OR (tf = 66 AND qty < 0) OR (tf IN (46, 16) AND iq IN (0, 2)) OR (tf = 311 AND iq = 0)) AND notpos) AS f_out,
           (tf IN (70, 54, 60, 58, 310, 12) OR (tf = 66 AND (qty > 0 OR soc > 0)) OR tf = 14 OR (tf = 48 AND iq < 2)) AS f_ina,
           ((tf IN (56, 68, 72, 44) OR (tf = 66 AND (qty < 0 OR soc < 0)) OR tf IN (46, 16, 311)) AND notpos) AS f_outa
    FROM raw r
),
ln AS (
    SELECT f.*,
           CASE WHEN cf0 <> 0 THEN cf0 WHEN tf = 66 THEN 1 WHEN f_ina THEN 1 WHEN f_outa THEN -1 ELSE 0 END AS cf
    FROM fl f
)
SELECT itm.code AS item_code,
       itm.item_name,
       itm.unit_name,
       ln.wh AS wh_code,
       ln.sh AS shelf_code,
       ROUND(SUM(CASE WHEN ln.f_in OR ln.f_out THEN ln.cf * ln.bq ELSE 0 END) / itm.ur, 2) AS balance_qty,
       ROUND(SUM(CASE WHEN ln.f_in OR ln.f_out THEN ln.cf * ln.bq2 ELSE 0 END), 2) AS balance_qty_2,
       ROUND(SUM(CASE WHEN ln.f_ina OR ln.f_outa THEN ln.cf * (CASE WHEN ln.tf = 66 AND ln.qty < 0 THEN -ln.soc + ln.plc ELSE ln.soc + ln.plc END) ELSE 0 END), 2) AS balance_amount
FROM ln
JOIN itm ON itm.code = ln.ic
GROUP BY itm.code, itm.item_name, itm.unit_name, itm.ur, ln.wh, ln.sh
HAVING SUM(CASE WHEN ln.f_in OR ln.f_out THEN ln.cf * ln.bq ELSE 0 END) <> 0
ORDER BY itm.code, ln.wh, ln.sh;
```

- **คอลัมน์ผลลัพธ์**: `item_code`, `item_name`, `unit_name`, `wh_code`, `shelf_code`, `balance_qty` (หน่วยมาตรฐาน), `balance_qty_2` (หน่วยคู่ขนาน/น้ำหนัก), `balance_amount` (มูลค่าต้นทุนคงเหลือ; หากต้องการรวมต้นทุนแฝงเปลี่ยน `d.sum_of_cost` เป็น `d.sum_of_cost_1`)
- **ข้อควรระวัง**: หากต้องการเฉพาะระดับบริษัทให้เอา `ln.wh, ln.sh` ออกจาก `SELECT` และ `GROUP BY`

---

## 2. สินค้าถึงจุดสั่งซื้อต่ำกว่าจุดต่ำสุด (`LOW_STOCK` Reorder Point)

อ้างอิงจาก `morning_briefing.go:697-755` ดึงจุดสั่งซื้อจาก `ic_inventory_detail` (`purchase_point` / `minimum_qty`) เทียบกับยอด `balance_qty` ปัจจุบัน:

```sql
WITH base AS (
    SELECT i.code AS item_code,
           COALESCE(i.name_1, i.code) AS item_name,
           COALESCE(i.unit_standard, '') AS unit_code,
           COALESCE(i.balance_qty, 0)::numeric(18, 4) AS balance_qty,
           COALESCE(NULLIF(d.purchase_point, 0), d.minimum_qty, 0)::numeric(18, 4) AS reorder_qty,
           COALESCE(i.average_cost, 0)::numeric(18, 4) AS avg_cost
    FROM ic_inventory i
    LEFT JOIN LATERAL (
        SELECT x.purchase_point, x.minimum_qty
        FROM ic_inventory_detail x
        WHERE x.ic_code = i.code
        LIMIT 1
    ) d ON true
    WHERE COALESCE(i.item_status, 0) = 0
      AND COALESCE(i.item_type, 0) NOT IN (3, 5)
)
SELECT item_code,
       item_name,
       unit_code,
       balance_qty,
       reorder_qty,
       (reorder_qty - balance_qty)::numeric(18, 4) AS shortage_qty,
       CASE WHEN avg_cost > 0
            THEN ((reorder_qty - balance_qty) * avg_cost)::numeric(18, 2)
            ELSE 0::numeric(18, 2)
       END AS estimated_restock_cost
FROM base
WHERE reorder_qty > 0
  AND balance_qty < reorder_qty
ORDER BY (balance_qty - reorder_qty) ASC, item_code ASC;
```

---

## 3. สินค้าที่ไม่มีการเคลื่อนไหวในช่วงวันที่ (Dead / Slow-Moving Stock)

**พารามิเตอร์**: `$1::date` (วันอ้างอิง), `$2::int` (ไม่เคลื่อนไหวตั้งแต่กี่วัน เช่น `30`), `$3::int` (ถึงกี่วัน เช่น `5000`)

```sql
WITH raw AS (
    SELECT d.item_code AS ic,
           COALESCE(d.doc_date_calc, d.doc_date) AS dt,
           COALESCE(d.doc_time, '') AS tm,
           COALESCE(d.line_number, 0) AS ln_no,
           d.trans_flag::int AS tf,
           COALESCE(d.qty, 0)::numeric AS qty,
           ROUND(COALESCE(d.qty, 0)::numeric * COALESCE(NULLIF(d.stand_value, 0), 1)::numeric
                 / COALESCE(NULLIF(d.divide_value, 0), 1)::numeric, 2) AS bq,
           COALESCE(d.inquiry_type, 0)::int AS iq,
           COALESCE(d.sum_of_cost, 0)::numeric AS soc,
           COALESCE(d.calc_flag, 0) AS cf0,
           NOT (COALESCE(d.doc_ref, '') <> '' AND COALESCE(d.is_pos, 0) = 1) AS notpos
    FROM ic_trans_detail d
    WHERE COALESCE(d.last_status, 0) = 0
      AND COALESCE(d.is_doc_copy, 0) = 0
      AND COALESCE(d.doc_date_calc, d.doc_date) <= $1::date
),
fl AS (
    SELECT r.*,
           (tf IN (70, 54, 60, 58, 310, 12) OR (tf = 66 AND qty > 0) OR (tf = 14 AND iq = 0) OR (tf = 48 AND iq < 2)) AS f_in,
           ((tf IN (56, 68, 72, 44) OR (tf = 66 AND qty < 0) OR (tf IN (46, 16) AND iq IN (0, 2)) OR (tf = 311 AND iq = 0)) AND notpos) AS f_out,
           ((tf = 44 AND notpos) OR (tf = 46 AND iq IN (0, 1)) OR (tf = 48 AND iq > 1)) AS f_sale
    FROM raw r
),
ln AS (
    SELECT f.*,
           CASE WHEN cf0 <> 0 THEN cf0 WHEN tf = 66 THEN 1 WHEN f_in THEN 1 WHEN f_out THEN -1 ELSE 0 END AS cf
    FROM fl f
),
agg AS (
    SELECT ic,
           SUM(CASE WHEN f_in OR f_out THEN cf * bq ELSE 0 END) AS q_bal,
           SUM(CASE WHEN f_in OR f_out THEN cf * soc ELSE 0 END) AS a_bal,
           MAX(dt) FILTER (WHERE f_in) AS last_in_date,
           MAX(dt) FILTER (WHERE f_out) AS last_out_date,
           MAX(dt) FILTER (WHERE f_sale) AS last_sale_date,
           MAX(dt) FILTER (WHERE f_in OR f_out) AS last_move_date
    FROM ln
    GROUP BY ic
)
SELECT i.code AS item_code,
       COALESCE(i.name_1, '') AS item_name,
       ROUND(COALESCE(a.q_bal, 0), 2) AS balance_base_qty,
       ROUND(COALESCE(a.a_bal, 0), 2) AS balance_amount,
       a.last_in_date,
       a.last_out_date,
       a.last_sale_date,
       COALESCE($1::date - a.last_move_date, 0) AS idle_days
FROM ic_inventory i
LEFT JOIN agg a ON a.ic = i.code
WHERE COALESCE(i.item_type, 0) NOT IN (1, 5)
  AND COALESCE($1::date - a.last_move_date, 0) BETWEEN $2 AND $3
ORDER BY idle_days DESC, i.code;
```
