---
title: "SQL Operations: ระบบคลังสินค้า WMS (Bin/Lot/FEFO, Pick-Pack-Ship, Cycle Count และกระทบยอดสต็อกบัญชี ERP)"
audience: dev
tags:
  - sql
  - wms
  - inventory
  - bins
  - fulfillment
  - cycle-count
  - reconciliation
  - dev
aliases:
  - sql-wms
  - query-wms-bins
  - query-wms-fulfillment
sources:
  - backend/internal/adapter/inbound/http/wms/handler.go:839-890
  - backend/internal/adapter/inbound/http/wms/handler.go:1209-1276
  - backend/internal/application/process/report_menu_ic.go:244-280
---

# SQL Operations: ระบบคลังสินค้า WMS

> กติกาหลัก: ใช้ `[[dev-rules-accounting-sql]]` เสมอ — การคำนวณสต็อกฝั่ง ERP สำหรับกระทบยอด Dual-Ledger ต้องอ้างอิงสูตรมาตรฐานจาก [[sql-ic-stock-balance]] (`report_menu_ic.go:255-275`) เสมอ ห้ามใช้ `float` — ดูรายละเอียด REST API ของ WMS ที่ [[api-rest-ops-ext]]

---

## 1. สต็อกคงเหลือรายช่องเก็บ Bin และแจ้งเตือน Safety Stock (`wms_stock_bin`)

`available_qty` ที่พร้อมหยิบจัดคือ `physical_qty - reserved_pick_qty`:

```sql
SELECT b.wh_code,
       b.zone_code,
       b.bin_code,
       b.velocity_class,
       b.ic_code,
       b.ic_name,
       b.unit_code,
       b.lot_no,
       b.exp_date,
       b.physical_qty::numeric(18, 2) AS physical_qty,
       b.reserved_pick_qty::numeric(18, 2) AS reserved_pick_qty,
       b.inbound_putaway_qty::numeric(18, 2) AS inbound_putaway_qty,
       (b.physical_qty - b.reserved_pick_qty)::numeric(18, 2) AS available_to_pick_qty,
       b.min_safety_qty::numeric(18, 2) AS min_safety_qty,
       b.max_bin_capacity::numeric(18, 2) AS max_bin_capacity,
       CASE
           WHEN (b.physical_qty - b.reserved_pick_qty) <= b.min_safety_qty THEN 'REORDER_ALERT'
           WHEN b.max_bin_capacity > 0 AND b.physical_qty >= b.max_bin_capacity THEN 'BIN_FULL'
           ELSE 'NORMAL'
       END AS bin_health_status,
       b.last_counted_at
FROM wms_stock_bin b
WHERE ($1 = '' OR b.wh_code = $1)
  AND ($2 = '' OR b.zone_code = $2)
ORDER BY b.zone_code, b.bin_code, b.ic_code;
```

---

## 2. กระทบยอด Dual-Ledger: WMS (`wms_stock_bin`) vs สต็อกบัญชี ERP (`ic_trans_detail`)

> ข้อควรระวังสำหรับนักพัฒนา (`wms/handler.go:857-865` vs `report_menu_ic.go:267-271`): ใน `wms/handler.go:857-865` มี Query แบบย่อที่ใส่ `trans_flag = 56` เป็นบวก (`+qty`), `58` เป็นลบ (`-qty`) และใช้ `::float8` ซึ่ง**สวนทางกับความหมายจริงของระบบบัญชี ERP** (`56` = เบิกสินค้าออก `-qty`, `58` = รับคืนจากการเบิก `+qty` และต้องคูณ `stand_value / divide_value` กับกรอง `notpos` ด้วย) — **ในการกระทบยอดจริงให้ใช้สูตรจาก `report_menu_ic.go:255-275` ด้านล่างนี้เท่านั้น**

```sql
WITH wms_totals AS (
    SELECT b.ic_code,
           SUM(COALESCE(b.physical_qty, 0))::numeric(18, 2) AS wms_physical_qty,
           SUM(COALESCE(b.reserved_pick_qty, 0))::numeric(18, 2) AS wms_reserved_qty,
           SUM(COALESCE(b.inbound_putaway_qty, 0))::numeric(18, 2) AS wms_inbound_qty
    FROM wms_stock_bin b
    GROUP BY b.ic_code
),
erp_raw AS (
    SELECT d.item_code,
           d.trans_flag::int AS tf,
           COALESCE(d.inquiry_type, 0)::int AS iq,
           COALESCE(d.qty, 0) AS qty,
           ROUND(COALESCE(d.qty, 0) * COALESCE(NULLIF(d.stand_value, 0), 1) / COALESCE(NULLIF(d.divide_value, 0), 1), 2) AS base_qty,
           COALESCE(d.calc_flag, 0) AS cf0,
           COALESCE(d.sum_of_cost, 0) AS soc,
           NOT (COALESCE(d.doc_ref, '') <> '' AND COALESCE(d.is_pos, 0) = 1) AS notpos
    FROM ic_trans_detail d
    JOIN ic_inventory i ON i.code = d.item_code
    WHERE COALESCE(d.last_status, 0) = 0
      AND COALESCE(d.is_doc_copy, 0) = 0
      AND COALESCE(i.item_type, 0) <> 5
      AND COALESCE(d.doc_date_calc, d.doc_date) <= $1::date
),
erp_flagged AS (
    SELECT r.*,
           (tf IN (70, 54, 60, 58, 310, 12) OR (tf = 66 AND qty > 0) OR (tf = 14 AND iq = 0) OR (tf = 48 AND iq < 2)) AS f_in,
           ((tf IN (56, 68, 72, 44) OR (tf = 66 AND qty < 0) OR (tf IN (46, 16) AND iq IN (0, 2)) OR (tf = 311 AND iq = 0)) AND notpos) AS f_out,
           (tf IN (70, 54, 60, 58, 310, 12) OR (tf = 66 AND (qty > 0 OR soc > 0)) OR tf = 14 OR (tf = 48 AND iq < 2)) AS f_ina,
           ((tf IN (56, 68, 72, 44) OR (tf = 66 AND (qty < 0 OR soc < 0)) OR tf IN (46, 16, 311)) AND notpos) AS f_outa
    FROM erp_raw r
),
erp_totals AS (
    SELECT f.item_code,
           SUM(
               CASE
                   WHEN f_in OR f_out THEN
                       (CASE WHEN cf0 <> 0 THEN cf0 WHEN tf = 66 THEN 1 WHEN f_ina THEN 1 WHEN f_outa THEN -1 ELSE 0 END) * base_qty
                   ELSE 0
               END
           )::numeric(18, 2) AS erp_accounting_qty
    FROM erp_flagged f
    GROUP BY f.item_code
)
SELECT COALESCE(w.ic_code, e.item_code) AS item_code,
       COALESCE(i.name_1, '') AS item_name,
       COALESCE(w.wms_physical_qty, 0)::numeric(18, 2) AS wms_physical_qty,
       COALESCE(w.wms_reserved_qty, 0)::numeric(18, 2) AS wms_reserved_qty,
       COALESCE(e.erp_accounting_qty, 0)::numeric(18, 2) AS erp_accounting_qty,
       (COALESCE(w.wms_physical_qty, 0) - COALESCE(e.erp_accounting_qty, 0))::numeric(18, 2) AS variance_qty
FROM wms_totals w
FULL OUTER JOIN erp_totals e ON e.item_code = w.ic_code
LEFT JOIN ic_inventory i ON i.code = COALESCE(w.ic_code, e.item_code)
WHERE COALESCE(w.wms_physical_qty, 0) <> COALESCE(e.erp_accounting_qty, 0)
ORDER BY ABS(COALESCE(w.wms_physical_qty, 0) - COALESCE(e.erp_accounting_qty, 0)) DESC, item_code;
```

---

## 3. คิวจัดสินค้า Pick / Pack / Ship (`wms_fulfillment_order` + `ic_trans`)

สถานะ `stage` เรียงตามลำดับคลัง: `WAITING_PICK` -> `PICKING` -> `PACKED` -> `SHIPPED`:

```sql
SELECT o.wms_doc_no,
       o.erp_inv_doc_no,
       o.erp_doc_date,
       o.cust_code,
       o.cust_name,
       o.ic_code,
       o.ic_name,
       o.bin_code,
       o.qty::numeric(18, 2) AS qty,
       o.unit_code,
       o.stage,
       o.priority,
       o.picker_name,
       o.carrier_name,
       o.tracking_no,
       o.box_count,
       o.weight_kg::numeric(12, 2) AS weight_kg,
       COALESCE(t.total_amount, 0)::numeric(18, 2) AS erp_inv_total_amount,
       o.updated_at
FROM wms_fulfillment_order o
LEFT JOIN ic_trans t
       ON t.doc_no = o.erp_inv_doc_no
      AND t.trans_flag = 44
      AND COALESCE(t.last_status, 0) = 0
WHERE ($1 = '' OR o.stage = $1)
ORDER BY CASE o.stage
             WHEN 'WAITING_PICK' THEN 1
             WHEN 'PICKING' THEN 2
             WHEN 'PACKED' THEN 3
             ELSE 4
         END,
         o.roworder DESC;
```

---

## 4. ประวัติเคลื่อนย้าย Bin, Putaway และนับสต็อก Cycle Count (`wms_movement_log`)

`move_type` มาตรฐาน: `INBOUND_PUTAWAY`, `BIN_TRANSFER`, `CYCLE_COUNT`, `ADJUST`, `OUTBOUND_SHIP`:

```sql
SELECT move_doc_no,
       move_type,
       ref_erp_doc,
       ic_code,
       ic_name,
       unit_code,
       from_bin,
       to_bin,
       qty::numeric(18, 2) AS qty,
       before_physical_qty::numeric(18, 2) AS before_physical_qty,
       after_physical_qty::numeric(18, 2) AS after_physical_qty,
       (after_physical_qty - before_physical_qty)::numeric(18, 2) AS delta_qty,
       erp_accounting_qty::numeric(18, 2) AS erp_accounting_qty,
       staff_name,
       note_text,
       created_at
FROM wms_movement_log
WHERE ($1 = '' OR move_type = $1)
  AND created_at >= $2::timestamptz
  AND created_at < $3::timestamptz
ORDER BY roworder DESC
LIMIT 500;
```

หมายเหตุ: พารามิเตอร์ `$1` ใน §1 คือรหัสคลัง (`wh_code`), `$1::date` ใน §2 คือวันปิดยอดสต็อก (`cutoff_date`), `$1` ใน §3 คือ `stage` และ `$1`, `$2::timestamptz`, `$3::timestamptz` ใน §4 คือ `move_type` กับช่วงเวลา — ดูการเชื่อมต่อไปยัง TMS ที่ [[sql-tms-fleet-delivery-pod]]
