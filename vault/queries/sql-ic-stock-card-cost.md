---
title: "SQL บัตรคุมสินค้า (Stock Card), ต้นทุนแฝง (Hidden Cost) และแตกหน่วยทอน (Packing Word)"
audience: dev
tags: [sql, queries, ic, stock-card, hidden-cost, units]
aliases: ["SQL Stock Card", "บัตรคุมสินค้า SQL", "SQL ต้นทุนแฝง Hidden Cost", "SQL ทอนหน่วยสินค้า", "ic_hidden_cost_process", "sql สต็อกการ์ด ต้นทุนย้อนหลัง lot", "บัตรคุมสินค้า สต็อกการ์ด"]
sources: ["backend/internal/application/process/report_menu_ic.go:290-320", "backend/internal/application/process/report_menu_ic.go:526-590", "backend/internal/application/process/report_menu_ic.go:745-830", "backend/internal/application/process/hidden_cost.go:450-890", "backend/internal/application/process/service.go:190-508"]
---

คำสั่ง SQL สำหรับดึงความเคลื่อนไหวรายวันแบบบัตรคุมสินค้า (พร้อมยอดยกมาและ Running Balance via Window Function), ตรวจสอบเอกสารเฉลี่ยต้นทุนแฝงนำเข้า (`ic_hidden_cost_process`), วิเคราะห์กำไรขั้นต้น และแตกหน่วยนับหลายระดับ (`ic_unit_use`)

---

## 1. บัตรคุมสินค้า Stock Card แบบมี "ยอดยกมา" + Running Balance

อ้างอิงจาก `icMovementSpec` (`report_menu_ic.go:526-590`) เปลี่ยน `d.sum_of_cost` เป็น `d.sum_of_cost_1` หากต้องการดูต้นทุนรวมต้นทุนแฝง:

**พารามิเตอร์**: `$1::text` (รหัสสินค้า), `$2::date` (วันเริ่มต้น), `$3::date` (วันสิ้นสุด)

```sql
WITH itm AS (
    SELECT i.code,
           COALESCE(i.name_1, '') AS item_name,
           COALESCE((
               SELECT NULLIF(x.stand_value, 0) / NULLIF(x.divide_value, 0)
               FROM ic_unit_use x
               WHERE x.ic_code = i.code AND x.code = i.unit_standard
               LIMIT 1
           ), 1)::numeric AS ur
    FROM ic_inventory i
    WHERE i.code = $1 AND COALESCE(i.item_type, 0) <> 5
),
raw AS (
    SELECT d.item_code AS ic,
           COALESCE(d.doc_date_calc, d.doc_date) AS dt,
           COALESCE(d.doc_time, '') AS tm,
           d.doc_no,
           COALESCE(d.wh_code, '') AS wh,
           COALESCE(d.shelf_code, '') AS sh,
           COALESCE(d.line_number, 0) AS ln_no,
           d.trans_flag::int AS tf,
           COALESCE(d.qty, 0)::numeric AS qty,
           ROUND(COALESCE(d.qty, 0)::numeric * COALESCE(NULLIF(d.stand_value, 0), 1)::numeric
                 / COALESCE(NULLIF(d.divide_value, 0), 1)::numeric, 2) AS bq,
           COALESCE(d.inquiry_type, 0)::int AS iq,
           COALESCE(d.sum_of_cost, 0)::numeric AS soc,
           COALESCE(d.profit_lost_cost_amount, 0)::numeric AS plc,
           COALESCE(d.calc_flag, 0) AS cf0,
           NOT (COALESCE(d.doc_ref, '') <> '' AND COALESCE(d.is_pos, 0) = 1) AS notpos
    FROM ic_trans_detail d
    JOIN itm ON itm.code = d.item_code
    WHERE COALESCE(d.last_status, 0) = 0
      AND COALESCE(d.is_doc_copy, 0) = 0
      AND COALESCE(d.doc_date_calc, d.doc_date) <= $3::date
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
),
run AS (
    SELECT ic, dt, tm, doc_no, wh, sh, ln_no, tf,
           (f_in OR f_out OR f_ina OR f_outa) AS shown,
           CASE WHEN f_in THEN cf * bq ELSE 0 END AS qty_in,
           CASE WHEN f_out THEN -cf * bq ELSE 0 END AS qty_out,
           CASE WHEN f_ina THEN cf * soc + plc ELSE 0 END AS amt_in,
           CASE WHEN f_outa THEN -((CASE WHEN tf = 66 AND qty < 0 THEN -1 ELSE cf END) * (soc + plc)) ELSE 0 END AS amt_out,
           SUM(CASE WHEN f_in OR f_out THEN cf * bq ELSE 0 END) OVER w AS bal_q,
           SUM(CASE WHEN f_ina OR f_outa THEN cf * (CASE WHEN tf = 66 AND qty < 0 THEN -soc + plc ELSE soc + plc END) ELSE 0 END) OVER w AS bal_a
    FROM ln
    WINDOW w AS (PARTITION BY ic ORDER BY dt, tm, doc_no, ln_no ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
)
-- แถวยอดยกมา
SELECT 0 AS row_kind, $2::date AS doc_date, '' AS doc_time, '' AS doc_no, 0 AS trans_flag,
       '' AS wh_code, '' AS shelf_code,
       0::numeric(18,2) AS qty_in, 0::numeric(18,2) AS amt_in,
       0::numeric(18,2) AS qty_out, 0::numeric(18,2) AS amt_out,
       ROUND(bal_q / itm.ur, 2) AS balance_qty, ROUND(bal_a, 2) AS balance_amount
FROM (SELECT DISTINCT ON (ic) ic, bal_q, bal_a FROM run WHERE dt < $2::date ORDER BY ic, dt DESC, tm DESC, doc_no DESC, ln_no DESC) b
JOIN itm ON itm.code = b.ic
UNION ALL
-- แถวเคลื่อนไหวในงวด
SELECT 1 AS row_kind, r.dt AS doc_date, r.tm AS doc_time, r.doc_no, r.tf AS trans_flag,
       r.wh AS wh_code, r.sh AS shelf_code,
       ROUND(r.qty_in / itm.ur, 2) AS qty_in, ROUND(r.amt_in, 2) AS amt_in,
       ROUND(r.qty_out / itm.ur, 2) AS qty_out, ROUND(r.amt_out, 2) AS amt_out,
       ROUND(r.bal_q / itm.ur, 2) AS balance_qty, ROUND(r.bal_a, 2) AS balance_amount
FROM run r
JOIN itm ON itm.code = r.ic
WHERE r.dt >= $2::date AND r.shown
ORDER BY row_kind, doc_date, doc_time, doc_no;
```

> [!NOTE]
> ตัวเครื่องยนต์ Go มีทั้งฟังก์ชัน `CalculateMovingAverage` และ `CalculateFIFOCost` (`service.go:190-508`) ที่ใช้ `*big.Rat` คำนวณ `sum_of_cost`, `average_cost` และ `profit_lost_cost_amount` เขียนลง `ic_trans_detail` เมื่อรัน Rebuild Stock

---

## 2. สรุปเอกสารปันส่วนต้นทุนแฝง & นำเข้าศุลกากร (`ic_hidden_cost_process`)

อ้างอิงจาก `hidden_cost.go:820-890`:

**พารามิเตอร์**: `$1::date` (วันเริ่มต้น), `$2::date` (วันสิ้นสุด)

```sql
SELECT h.doc_no,
       h.doc_date,
       h.doc_no_adjust,
       h.customs_entry_no,
       h.incoterms,
       h.currency_code,
       h.exchange_rate::numeric(18, 6) AS exchange_rate,
       h.total_amount::numeric(18, 2) AS total_amount,
       h.hidden_cost_amount::numeric(18, 2) AS hidden_cost_amount,
       h.transport_value::numeric(18, 2) AS transport_value,
       h.insurance_amount::numeric(18, 2) AS insurance_amount,
       h.import_duty_amount::numeric(18, 2) AS import_duty_amount,
       h.clearance_port_amount::numeric(18, 2) AS clearance_port_amount,
       h.customs_vat_amount::numeric(18, 2) AS customs_vat_amount,
       COUNT(i.item_code) AS item_lines,
       COALESCE(SUM(i.adjust_amount), 0)::numeric(18, 2) AS allocated_sum
FROM ic_hidden_cost_process h
LEFT JOIN ic_hidden_cost_process_item i ON i.doc_no = h.doc_no
WHERE h.doc_date BETWEEN $1::date AND $2::date
GROUP BY h.doc_no, h.doc_date, h.doc_no_adjust, h.customs_entry_no, h.incoterms,
         h.currency_code, h.exchange_rate, h.total_amount, h.hidden_cost_amount,
         h.transport_value, h.insurance_amount, h.import_duty_amount,
         h.clearance_port_amount, h.customs_vat_amount
ORDER BY h.doc_date DESC, h.doc_no DESC;
```

---

## 3. แตกจำนวนหน่วยฐานเป็นข้อความหลายหน่วยนับ (Multi-Unit Packing Word)

อ้างอิง `icPackWordSQL` (`report_menu_ic.go:292-315`) เช่น `521` ชิ้น -> `"5 ชิ้นx3 โหลx8 กล่อง"`:

**พารามิเตอร์**: `$1::text` (รหัสสินค้า), `$2::numeric` (จำนวนหน่วยฐาน)

```sql
WITH RECURSIVE inp AS (
    SELECT $1::text AS ic, COALESCE($2::numeric, 0) AS bq
),
u_raw AS (
    SELECT COALESCE(NULLIF(TRIM(un.name_1), ''), uu.code) AS lbl,
           (COALESCE(NULLIF(uu.stand_value, 0), 1)::numeric / COALESCE(NULLIF(uu.divide_value, 0), 1)::numeric) AS r,
           COALESCE(uu.row_order, 0) AS ro
    FROM inp
    JOIN ic_unit_use uu ON UPPER(uu.ic_code) = UPPER(inp.ic)
    LEFT JOIN ic_unit un ON UPPER(un.code) = UPPER(uu.code)
    WHERE COALESCE(uu.status, 1) = 1
      AND COALESCE(uu.stand_value, 0) > 0
      AND COALESCE(uu.divide_value, 0) > 0
),
u_pool AS (
    SELECT lbl, r, ROW_NUMBER() OVER (ORDER BY r DESC, ro ASC, lbl ASC) AS seq, COUNT(*) OVER () AS cnt
    FROM u_raw
),
rec AS (
    SELECT 1 AS step,
           (SELECT bq FROM inp) AS rem,
           (SELECT FLOOR((SELECT bq FROM inp) / r) FROM u_pool WHERE seq = 1) AS taken,
           (SELECT lbl FROM u_pool WHERE seq = 1) AS lbl,
           (SELECT cnt FROM u_pool WHERE seq = 1) AS cnt
    UNION ALL
    SELECT r.step + 1,
           r.rem - r.taken * p_prev.r,
           FLOOR((r.rem - r.taken * p_prev.r) / p_next.r),
           p_next.lbl,
           r.cnt
    FROM rec r
    JOIN u_pool p_prev ON p_prev.seq = r.step
    JOIN u_pool p_next ON p_next.seq = r.step + 1
    WHERE r.step < r.cnt
)
SELECT STRING_AGG(TRIM(TO_CHAR(taken, 'FM999,999,990.##')) || ' ' || lbl, ' x ' ORDER BY step DESC) AS packing_word
FROM rec
WHERE taken > 0;
```
