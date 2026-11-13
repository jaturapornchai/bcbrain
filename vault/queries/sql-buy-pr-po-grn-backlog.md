---
title: "SQL ติดตามใบขอซื้อ (2) ใบสั่งซื้อค้างรับ (6) และทะยอยรับสินค้า (310) รอตั้งหนี้ (2113-00)"
audience: "dev"
tags: [queries, sql, buy, pr, po, grn, unbilled_ap, backlog]
aliases:
  - "sql ใบสั่งซื้อค้างรับ PO backlog"
  - "sql ใบขอซื้อรออนุมัติ PR"
  - "sql ทะยอยรับสินค้ารอตั้งหนี้ 310 315"
  - "เจ้าหนี้ยังไม่ถึงกำหนดตั้งหนี้ 2113-00 sql"
  - "GR/IR clearing sql"
sources:
  - "backend/internal/application/process/doc_flow.go:88-260"
  - "backend/internal/application/process/report_menu_so_po.go:524-620"
  - "backend/internal/application/process/service.go:2115-2145"
---

# SQL ติดตามใบขอซื้อ (`2`) ใบสั่งซื้อค้างรับ (`6`) และทะยอยรับสินค้า (`310`) รอตั้งหนี้ (`2113-00`)

วงจรจัดซื้อเต็มรูปแบบเริ่มจาก `PR (2)` → `PO (6)` → รับของเข้าคลัง (`PU 12` หรือ ทะยอยรับ `PI 310`) → ตั้งหนี้ตามใบรับของ (`PIU 315`) เอกสารนี้รวบรวม SQL ติดตามงานค้างทุกช่วงของวงจรจัดซื้อ (ดูสายโซ่อ้างอิงที่ [[doc-flow-and-status]])

---

## 1. รายการใบสั่งซื้อค้างรับสินค้า (`trans_flag = 6` หักรับจริง `12, 310` และยกเลิกรายบรรทัด `7`)

คำนวณระดับหน่วยฐาน (`stand_value / divide_value`) เพื่อให้ถูกต้องแม้สั่งเป็นลังแต่ทยอยรับเป็นกล่อง/ชิ้น:

### พารามิเตอร์
- `$1` (`DATE`): วันที่ใบสั่งซื้อเริ่มต้น
- `$2` (`DATE`): วันที่ใบสั่งซื้อสิ้นสุด
- `$3` (`TEXT`): รหัสผู้ขาย (`cust_code`) — ส่ง `''` เพื่อดึงทุกราย

```sql
WITH po_grouped AS (
    SELECT
        h.doc_no,
        MIN(h.doc_date) AS doc_date,
        MIN(h.send_date) AS due_receive_date,
        MAX(COALESCE(h.cust_code, '')) AS supplier_code,
        MAX(COALESCE(h.approve_status, 0)) AS approve_status,
        d.item_code,
        MAX(COALESCE(d.item_name, '')) AS item_name,
        SUM(COALESCE(d.qty, 0) * COALESCE(NULLIF(d.stand_value, 0), 1) / COALESCE(NULLIF(d.divide_value, 0), 1))::numeric(18, 4) AS ordered_base_qty
    FROM ic_trans h
    JOIN ic_trans_detail d
      ON d.doc_no = h.doc_no AND d.trans_flag = h.trans_flag
    WHERE h.trans_flag = 6
      AND COALESCE(h.last_status, 0) = 0
      AND COALESCE(d.last_status, 0) = 0
      AND COALESCE(h.doc_success, 0) = 0
      AND h.doc_date BETWEEN $1::date AND $2::date
      AND ($3::text = '' OR h.cust_code = $3::text)
    GROUP BY h.doc_no, d.item_code
),
po_received AS (
    SELECT
        r.ref_doc_no AS po_doc_no,
        r.item_code,
        SUM(CASE WHEN r.trans_flag IN (12, 310)
            THEN COALESCE(r.qty, 0) * COALESCE(NULLIF(r.stand_value, 0), 1) / COALESCE(NULLIF(r.divide_value, 0), 1)
            ELSE 0 END)::numeric(18, 4) AS received_base_qty,
        SUM(CASE WHEN r.trans_flag = 7
            THEN COALESCE(r.qty, 0) * COALESCE(NULLIF(r.stand_value, 0), 1) / COALESCE(NULLIF(r.divide_value, 0), 1)
            ELSE 0 END)::numeric(18, 4) AS cancelled_base_qty
    FROM ic_trans_detail r
    WHERE r.trans_flag IN (7, 12, 310)
      AND COALESCE(r.last_status, 0) = 0
      AND COALESCE(r.ref_doc_no, '') <> ''
    GROUP BY r.ref_doc_no, r.item_code
)
SELECT
    p.doc_date,
    p.due_receive_date,
    p.doc_no AS po_doc_no,
    p.supplier_code,
    COALESCE(s.name_1, '') AS supplier_name,
    p.approve_status,
    p.item_code,
    p.item_name,
    COALESCE(i.unit_standard, '') AS base_unit,
    ROUND(p.ordered_base_qty, 2) AS ordered_base_qty,
    ROUND(COALESCE(r.received_base_qty, 0), 2) AS received_base_qty,
    ROUND(COALESCE(r.cancelled_base_qty, 0), 2) AS cancelled_base_qty,
    ROUND(p.ordered_base_qty - COALESCE(r.received_base_qty, 0) - COALESCE(r.cancelled_base_qty, 0), 2) AS remaining_base_qty
FROM po_grouped p
LEFT JOIN po_received r
  ON r.po_doc_no = p.doc_no AND r.item_code = p.item_code
LEFT JOIN ap_supplier s
  ON s.code = p.supplier_code
LEFT JOIN ic_inventory i
  ON i.code = p.item_code
WHERE (p.ordered_base_qty - COALESCE(r.received_base_qty, 0) - COALESCE(r.cancelled_base_qty, 0)) > 0
ORDER BY COALESCE(p.due_receive_date, p.doc_date) ASC, p.doc_no ASC, p.item_code ASC;
```

---

## 2. รายการใบทะยอยรับสินค้า (`PI` — `trans_flag = 310`) ที่ยังค้างตั้งหนี้เจ้าหนี้ (`2113-00`)

เมื่อรับสินค้าเข้าคลังด้วยเมนูทะยอยรับ (`310`) ระบบจะเครดิตพักไว้ในบัญชี **`2113-00 เจ้าหนี้ยังไม่ถึงกำหนดตั้งหนี้`** จนกว่าผู้ขายจะส่งใบกำกับภาษีมาเปิดใบตั้งหนี้ (`315 PIU`) หรือส่งคืนของ (`311 PIA`):

### พารามิเตอร์
- `$1` (`DATE`): วันที่สิ้นสุดการตรวจสอบ (As-Of Date)

```sql
WITH grn_settled AS (
    SELECT
        COALESCE(NULLIF(d.doc_ref, ''), d.ref_doc_no) AS grn_doc_no,
        SUM(CASE WHEN d.trans_flag = 315 THEN COALESCE(d.sum_amount, 0) ELSE 0 END)::numeric(18, 2) AS billed_line_amt,
        SUM(CASE WHEN d.trans_flag = 311 THEN COALESCE(d.sum_amount, 0) ELSE 0 END)::numeric(18, 2) AS returned_line_amt
    FROM ic_trans_detail d
    JOIN ic_trans h ON h.doc_no = d.doc_no AND h.trans_flag = d.trans_flag
    WHERE d.trans_flag IN (311, 315)
      AND COALESCE(d.last_status, 0) = 0
      AND COALESCE(h.last_status, 0) = 0
      AND h.doc_date <= $1::date
      AND COALESCE(NULLIF(d.doc_ref, ''), d.ref_doc_no, '') <> ''
    GROUP BY COALESCE(NULLIF(d.doc_ref, ''), d.ref_doc_no)
)
SELECT
    g.doc_date,
    g.doc_no AS grn_doc_no,
    COALESCE(g.doc_ref, '') AS ref_po_no,
    COALESCE(g.cust_code, '') AS supplier_code,
    COALESCE(s.name_1, '') AS supplier_name,
    ROUND(COALESCE(g.total_before_vat, 0) + COALESCE(g.total_except_vat, 0), 2) AS grn_ex_vat,
    ROUND(COALESCE(g.total_vat_value, 0), 2) AS undue_input_vat_1152,
    ROUND(COALESCE(g.total_amount, 0), 2) AS grn_total_2113,
    COALESCE(g.used_status, 0) AS used_status,
    COALESCE(g.doc_success, 0) AS doc_success,
    ROUND(COALESCE(st.billed_line_amt, 0), 2) AS billed_line_sum,
    ROUND(COALESCE(st.returned_line_amt, 0), 2) AS returned_line_sum
FROM ic_trans g
LEFT JOIN ap_supplier s ON s.code = g.cust_code
LEFT JOIN grn_settled st ON st.grn_doc_no = g.doc_no
WHERE g.trans_flag = 310
  AND COALESCE(g.last_status, 0) = 0
  AND COALESCE(g.doc_success, 0) = 0
  AND g.doc_date <= $1::date
ORDER BY g.doc_date ASC, g.doc_no ASC;
```

---

## 3. ติดตามใบเสนอซื้อ (`PR` — `trans_flag = 2`) ที่รออนุมัติหรือรอเปิด `PO`

```sql
SELECT
    pr.doc_date,
    pr.doc_no AS pr_doc_no,
    COALESCE(pr.department_code, '') AS department_code,
    CASE COALESCE(pr.approve_status, 0)
        WHEN 1 THEN 'อนุมัติแล้ว'
        WHEN 2 THEN 'ไม่อนุมัติ'
        ELSE 'รออนุมัติ'
    END AS approve_label,
    COALESCE(pr.used_status, 0) AS used_status,
    COALESCE(pr.doc_success, 0) AS doc_success,
    ROUND(COALESCE(pr.total_amount, 0), 2) AS estimated_amount,
    COALESCE(pr.remark, '') AS remark
FROM ic_trans pr
WHERE pr.trans_flag = 2
  AND COALESCE(pr.last_status, 0) = 0
  AND COALESCE(pr.doc_success, 0) = 0
ORDER BY pr.doc_date ASC, pr.doc_no ASC;
```

---

## 4. ข้อควรระวัง (Gotchas)
1. **การกระทบยอดบัญชี `2113-00`**: ยอดคงเหลือเครดิตของบัญชี `2113-00 เจ้าหนี้ยังไม่ถึงกำหนดตั้งหนี้` ในงบทดลอง ต้องสอดคล้องกับผลรวมของใบ `310` ที่ยังไม่ได้ดึงไปตั้งหนี้ `315` (หรือส่งคืน `311`)
2. **คอลัมน์อ้างอิงระหว่าง `315` → `310`**: ใน `service.go:2118` บรรทัดของ `315` อ้างเลขใบ `310` ผ่าน `d.doc_ref` (และบางหน้าจอสำรองไว้ใน `d.ref_doc_no`) การใช้ `COALESCE(NULLIF(d.doc_ref, ''), d.ref_doc_no)` จึงครอบคลุมครบทุกกรณี
