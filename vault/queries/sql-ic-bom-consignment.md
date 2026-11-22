---
title: "SQL สูตรการผลิต (BOM), ใบสั่งประกอบสินค้า และสินค้าฝากขาย (Consignment)"
audience: dev
tags: [sql, queries, ic, bom, assembly, consignment]
aliases: ["SQL BOM สูตรผลิต", "SQL ใบสั่งประกอบสินค้า", "SQL สินค้าฝากขาย Consignment", "ic_bom_header", "ar_consignment_account"]
sources: ["backend/internal/application/process/bom_assembly.go:185-650", "backend/internal/application/process/consignment.go:130-210", "backend/internal/application/process/report_menu_ic.go:244-275"]
---

ชุดคำสั่ง SQL สำหรับระบบผลิต/ประกอบสินค้า (`ic_bom_header`, `ic_bom_detail`, `ic_assembly_order`) และระบบบัญชีฝากขาย (`ar_consignment_account`, `ar_consignment_log`)

---

## 1. สูตรการผลิต (BOM) พร้อมต้นทุนประมาณการต่อ Batch (`ic_bom_header` + `ic_bom_detail`)

อ้างอิงโครงสร้างตารางจาก `bom_assembly.go:186-252` (หมายเหตุ: หลังบ้าน `produceBomAssembly` อนุญาตสั่งประกอบเฉพาะสูตรที่ `active_status = 1` เท่านั้น โดยล็อกตรวจด้วย `FOR SHARE` ก่อนสร้างเอกสาร):

**พารามิเตอร์**: `$1::text` (รหัสสูตร BOM หรือ `''` = สูตรที่ใช้งานอยู่ทั้งหมด)

```sql
SELECT h.bom_code,
       h.bom_name,
       h.fg_item_code,
       COALESCE(fg.name_1, '') AS fg_item_name,
       h.fg_unit_code,
       h.fg_yield_qty::numeric(18, 4) AS fg_yield_qty,
       h.labor_cost::numeric(18, 2) AS labor_cost,
       h.overhead_cost::numeric(18, 2) AS overhead_cost,
       d.line_number,
       d.rm_item_code,
       COALESCE(rm.name_1, '') AS rm_item_name,
       d.rm_unit_code,
       d.rm_qty::numeric(18, 4) AS rm_qty_per_batch,
       d.scrap_pct::numeric(9, 4) AS scrap_pct,
       ROUND(d.rm_qty * (1 + COALESCE(d.scrap_pct, 0) / 100.0), 4)::numeric(18, 4) AS effective_rm_qty
FROM ic_bom_header h
JOIN ic_bom_detail d ON d.bom_code = h.bom_code
LEFT JOIN ic_inventory fg ON fg.code = h.fg_item_code
LEFT JOIN ic_inventory rm ON rm.code = d.rm_item_code
WHERE h.active_status = 1
  AND ($1 = '' OR h.bom_code = $1)
ORDER BY h.bom_code, d.line_number;
```

---

## 2. ประวัติใบสั่งประกอบสินค้า & ความเชื่อมโยงใบเบิกวัตถุดิบ-รับสำเร็จรูป (`ic_assembly_order`)

ใบสั่งประกอบจะจับคู่เอกสารสต็อกจริง 2 ใบ คือ `issue_doc_no` (เบิกวัตถุดิบ `trans_flag = 56`) และ `receipt_doc_no` (รับสินค้าสำเร็จรูป `trans_flag = 54`):

**พารามิเตอร์**: `$1::date` (วันเริ่มต้น), `$2::date` (วันสิ้นสุด)

```sql
SELECT o.order_doc_no,
       o.doc_date,
       o.bom_code,
       h.bom_name,
       o.fg_item_code,
       o.batch_count::numeric(18, 4) AS batch_count,
       o.produced_fg_qty::numeric(18, 4) AS produced_fg_qty,
       o.issue_doc_no,
       o.receipt_doc_no,
       o.rm_total_cost::numeric(18, 2) AS rm_total_cost,
       o.labor_cost::numeric(18, 2) AS labor_cost,
       o.overhead_cost::numeric(18, 2) AS overhead_cost,
       o.fg_total_cost::numeric(18, 2) AS fg_total_cost,
       o.fg_unit_cost::numeric(18, 4) AS fg_unit_cost,
       o.wh_code,
       o.shelf_code
FROM ic_assembly_order o
LEFT JOIN ic_bom_header h ON h.bom_code = o.bom_code
WHERE o.doc_date BETWEEN $1::date AND $2::date
ORDER BY o.doc_date DESC, o.order_doc_no DESC;
```

---

## 3. ยอดสต็อกคงเหลือตามคลังฝากขายของคู่ค้า (`ar_consignment_account` + `ic_trans_detail`)

อ้างอิง `consignment.go:130-175` และสูตรคำนวณสต็อกมาตรฐาน (`report_menu_ic.go:255-275`):

```sql
WITH consign_bal AS (
    SELECT ca.cust_code,
           COALESCE(ar.name_1, '') AS cust_name,
           ca.consign_wh_code,
           ca.consign_shelf_code,
           ca.gp_percent::numeric(9, 4) AS gp_percent,
           d.item_code,
           COALESCE(i.name_1, '') AS item_name,
           ROUND(SUM(
               CASE
                   WHEN d.trans_flag IN (70, 54, 60, 58, 310, 12)
                     OR (d.trans_flag = 66 AND d.qty > 0)
                     OR (d.trans_flag = 14 AND COALESCE(d.inquiry_type, 0) = 0)
                     OR (d.trans_flag = 48 AND COALESCE(d.inquiry_type, 0) < 2)
                       THEN ROUND(d.qty * COALESCE(NULLIF(d.stand_value, 0), 1) / COALESCE(NULLIF(d.divide_value, 0), 1), 2)
                   WHEN (d.trans_flag IN (56, 68, 72, 44)
                     OR (d.trans_flag = 66 AND d.qty < 0)
                     OR (d.trans_flag IN (46, 16) AND COALESCE(d.inquiry_type, 0) IN (0, 2))
                     OR (d.trans_flag = 311 AND COALESCE(d.inquiry_type, 0) = 0))
                     AND NOT (COALESCE(d.doc_ref, '') <> '' AND COALESCE(d.is_pos, 0) = 1)
                       THEN -ROUND(d.qty * COALESCE(NULLIF(d.stand_value, 0), 1) / COALESCE(NULLIF(d.divide_value, 0), 1), 2)
                   ELSE 0
               END
           ), 2)::numeric(18, 2) AS consign_balance_base_qty
    FROM ar_consignment_account ca
    LEFT JOIN ar_customer ar ON ar.code = ca.cust_code
    JOIN ic_trans_detail d ON d.wh_code = ca.consign_wh_code
    LEFT JOIN ic_inventory i ON i.code = d.item_code
    WHERE ca.active_status = 1
      AND COALESCE(d.last_status, 0) = 0
      AND COALESCE(d.is_doc_copy, 0) = 0
      AND COALESCE(i.item_type, 0) <> 5
    GROUP BY ca.cust_code, COALESCE(ar.name_1, ''), ca.consign_wh_code, ca.consign_shelf_code,
             ca.gp_percent, d.item_code, COALESCE(i.name_1, '')
)
SELECT cust_code,
       cust_name,
       consign_wh_code,
       consign_shelf_code,
       gp_percent,
       item_code,
       item_name,
       consign_balance_base_qty
FROM consign_bal
WHERE consign_balance_base_qty <> 0
ORDER BY cust_code, item_code;
```

## 4. ประวัติส่งของฝากขายและการตัดขายวางบิล (`ar_consignment_log`)

```sql
SELECT log_id,
       doc_date,
       action_type,
       cust_code,
       doc_no,
       trans_flag,
       billing_doc_no,
       total_qty::numeric(18, 4) AS total_qty,
       total_amount::numeric(18, 2) AS total_amount,
       created_by
FROM ar_consignment_log
ORDER BY doc_date DESC, log_id DESC
LIMIT 100;
```
