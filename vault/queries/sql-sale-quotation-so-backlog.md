---
title: "SQL ติดตามใบเสนอราคา (30) และใบสั่งขายค้างส่ง (36) ระดับหน่วยฐาน (Quotation & SO Backlog)"
audience: "dev"
tags: [queries, sql, sale, quotation, sales_order, backlog, doc_success]
aliases:
  - "sql ใบสั่งขายค้างส่ง SO backlog"
  - "sql ใบเสนอราคาค้างอนุมัติ รอเปิดบิล"
  - "query trans_flag 30 34 36 ค้างส่ง"
  - "คำนวณยอดค้างส่ง SO หักยกเลิกรายบรรทัด 37"
sources:
  - "backend/internal/application/process/service.go:721-742"
  - "backend/internal/application/process/doc_flow.go:88-210"
  - "backend/internal/application/process/report_menu_so_po.go:272-460"
---

# SQL ติดตามใบเสนอราคา (`30`) และใบสั่งขายค้างส่ง (`36`) ระดับหน่วยฐาน

การคำนวณยอดค้างส่งของใบสั่งขาย (`trans_flag = 36`) ต้องแปลงปริมาณเป็น **หน่วยนับมาตรฐาน (Base Unit)** เสมอ เพราะลูกค้าอาจสั่งเป็น "ลัง" แต่ทยอยเปิดบิลขายจริง (`44`) หรือตัดยกเลิกค้างส่งรายบรรทัด (`37`) เป็น "ชิ้น" (ดูหลักการใน [[doc-flow-and-status]] และ [[doc-cancel-and-approve]])

---

## 1. รายการใบสั่งขายค้างส่งรายสินค้า (`trans_flag = 36` หักขายจริง `44` และยกเลิกรายบรรทัด `37`)

สกัดตรงจากสูตร `checkSODocSuccessTx` ใน `service.go:721-736`:

### พารามิเตอร์
- `$1` (`DATE`): วันที่ใบสั่งขายเริ่มต้น
- `$2` (`DATE`): วันที่ใบสั่งขายสิ้นสุด
- `$3` (`TEXT`): รหัสลูกค้า (`cust_code`) — ส่ง `''` เพื่อดูทุกราย

```sql
WITH so_lines AS (
    SELECT
        h.doc_no,
        h.doc_date,
        h.send_date,
        COALESCE(h.cust_code, '') AS cust_code,
        COALESCE(h.approve_status, 0) AS approve_status,
        d.line_number,
        d.item_code,
        COALESCE(d.item_name, '') AS item_name,
        COALESCE(d.unit_code, '') AS order_unit,
        COALESCE(d.qty, 0) AS order_qty,
        (COALESCE(d.qty, 0) * COALESCE(NULLIF(d.stand_value, 0), 1) / COALESCE(NULLIF(d.divide_value, 0), 1))::numeric(18, 4) AS order_base_qty,
        COALESCE(d.price, 0)::numeric(18, 4) AS unit_price
    FROM ic_trans h
    JOIN ic_trans_detail d
      ON d.doc_no = h.doc_no AND d.trans_flag = h.trans_flag
    WHERE h.trans_flag = 36
      AND COALESCE(h.last_status, 0) = 0
      AND COALESCE(d.last_status, 0) = 0
      AND COALESCE(h.doc_success, 0) = 0
      AND h.doc_date BETWEEN $1::date AND $2::date
      AND ($3::text = '' OR h.cust_code = $3::text)
),
fulfilled AS (
    SELECT
        r.ref_doc_no AS so_doc_no,
        r.item_code,
        SUM(CASE WHEN r.trans_flag = 44
            THEN COALESCE(r.qty, 0) * COALESCE(NULLIF(r.stand_value, 0), 1) / COALESCE(NULLIF(r.divide_value, 0), 1)
            ELSE 0 END)::numeric(18, 4) AS shipped_base_qty,
        SUM(CASE WHEN r.trans_flag = 37
            THEN COALESCE(r.qty, 0) * COALESCE(NULLIF(r.stand_value, 0), 1) / COALESCE(NULLIF(r.divide_value, 0), 1)
            ELSE 0 END)::numeric(18, 4) AS cancelled_base_qty
    FROM ic_trans_detail r
    WHERE r.trans_flag IN (37, 44)
      AND COALESCE(r.last_status, 0) = 0
      AND COALESCE(r.ref_doc_no, '') <> ''
    GROUP BY r.ref_doc_no, r.item_code
),
so_item_grouped AS (
    SELECT
        doc_no,
        MIN(doc_date) AS doc_date,
        MIN(send_date) AS send_date,
        MAX(cust_code) AS cust_code,
        MAX(approve_status) AS approve_status,
        item_code,
        MAX(item_name) AS item_name,
        SUM(order_base_qty) AS total_order_base_qty,
        AVG(unit_price) AS avg_unit_price
    FROM so_lines
    GROUP BY doc_no, item_code
)
SELECT
    g.doc_date,
    g.send_date,
    g.doc_no AS so_doc_no,
    g.cust_code,
    COALESCE(c.name_1, '') AS cust_name,
    g.approve_status,
    g.item_code,
    g.item_name,
    COALESCE(i.unit_standard, '') AS base_unit,
    ROUND(g.total_order_base_qty, 2) AS ordered_base_qty,
    ROUND(COALESCE(f.shipped_base_qty, 0), 2) AS shipped_base_qty,
    ROUND(COALESCE(f.cancelled_base_qty, 0), 2) AS cancelled_base_qty,
    ROUND(g.total_order_base_qty - COALESCE(f.shipped_base_qty, 0) - COALESCE(f.cancelled_base_qty, 0), 2) AS remaining_base_qty
FROM so_item_grouped g
LEFT JOIN fulfilled f
  ON f.so_doc_no = g.doc_no AND f.item_code = g.item_code
LEFT JOIN ar_customer c
  ON c.code = g.cust_code
LEFT JOIN ic_inventory i
  ON i.code = g.item_code
WHERE (g.total_order_base_qty - COALESCE(f.shipped_base_qty, 0) - COALESCE(f.cancelled_base_qty, 0)) > 0
ORDER BY COALESCE(g.send_date, g.doc_date) ASC, g.doc_no ASC, g.item_code ASC;
```

---

## 2. สรุปใบเสนอราคาขาย (`trans_flag = 30`) และอัตราการแปลงเป็นคำสั่งขาย/บิลขาย

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้น
- `$2` (`DATE`): วันที่สิ้นสุด

```sql
SELECT
    q.doc_date,
    q.doc_no AS quotation_no,
    q.expire_date,
    COALESCE(q.cust_code, '') AS cust_code,
    COALESCE(c.name_1, '') AS cust_name,
    COALESCE(q.sale_code, '') AS sale_code,
    CASE COALESCE(q.approve_status, 0)
        WHEN 1 THEN 'อนุมัติแล้ว'
        WHEN 2 THEN 'ไม่อนุมัติ'
        ELSE 'รออนุมัติ/ปกติ'
    END AS approve_label,
    CASE
        WHEN COALESCE(q.doc_success, 0) = 1 THEN 'ปิดงานครบแล้ว'
        WHEN COALESCE(q.used_status, 0) = 1 THEN 'นำไปอ้างอิงบางส่วน'
        WHEN q.expire_date IS NOT NULL AND q.expire_date < CURRENT_DATE THEN 'หมดอายุ'
        ELSE 'เปิดรอใช้งาน'
    END AS flow_status,
    ROUND(COALESCE(q.total_amount, 0), 2) AS total_amount
FROM ic_trans q
LEFT JOIN ar_customer c ON c.code = q.cust_code
WHERE q.trans_flag = 30
  AND COALESCE(q.last_status, 0) = 0
  AND q.doc_date BETWEEN $1::date AND $2::date
ORDER BY q.doc_date DESC, q.doc_no DESC;
```

---

## 3. ข้อควรระวัง (Gotchas)
1. **ใบยกเลิกสั่งขายมี 2 แบบ**: หากยกเลิกทั้งใบ `ic_trans.last_status` ของใบสั่งขาย (`36`) จะกลายเป็น `1` (ถูกตัดออกตั้งแต่ `WHERE COALESCE(h.last_status, 0) = 0`) แต่ถ้ายกเลิกเฉพาะยอดค้างส่งบางรายการ (`cancel_type = 2`) ใบสั่งขายเดิมยังมี `last_status = 0` และต้องนำแถวใน `ic_trans_detail` ของใบยกเลิก `trans_flag = 37` มาหักออกด้วยเสมอ
2. **ใบสั่งจอง (`trans_flag = 34`)**: ใช้โครงสร้างเดียวกับใบสั่งขายทุกประการ เพียงเปลี่ยน `36` เป็น `34` และเปลี่ยนใบยกเลิกรายบรรทัดจาก `37` เป็น `39` (`SRC`)
