---
title: "SQL ติดตาม Serial Number / IMEI, วันหมดประกัน และงานซ่อม RMA"
audience: dev
tags: [sql, queries, ic, serial, warranty, rma]
aliases: ["SQL Serial Number", "SQL ประกันสินค้า IMEI", "ic_serial", "ic_trans_serial_number", "ic_warranty_rma_ticket"]
sources: ["backend/internal/application/process/report_menu_ic.go:1055-1155", "backend/internal/application/process/serial_warranty_rma.go:43-165"]
---

คำสั่ง SQL สำหรับตรวจสอบ Serial Number / IMEI ที่คงเหลือในสต็อก ประวัติเข้า-ออกต่อเครื่อง อายุรับประกัน และงานรับเคลมซ่อม (`ic_warranty_rma_ticket`)

---

## 1. รายการ Serial Number / IMEI คงเหลือในคลัง (`ic_serial`)

อ้างอิงจาก `icSerialByItemSpecs` และ `icSerialMoveSpecs` (`report_menu_ic.go:1055-1105`) โดย `status = 0` คืออยู่ในสต็อก (`IN`) และ `status = 1` คือขาย/จ่ายออกแล้ว (`OUT`):

**พารามิเตอร์**: `$1::text` (คำค้นรหัสสินค้า/Serial หรือ `''`)

```sql
SELECT s.serial_number,
       s.ic_code AS item_code,
       COALESCE(i.name_1, '') AS item_name,
       COALESCE(s.wh_code, '') AS wh_code,
       COALESCE(s.shelf_code, '') AS shelf_code,
       CASE WHEN COALESCE(s.status, 0) = 0 THEN 'IN_STOCK' ELSE 'OUT' END AS stock_status,
       s.void_date AS warranty_end_date,
       (
           SELECT r.doc_date
           FROM ic_trans_serial_number r
           WHERE r.serial_number = s.serial_number
             AND r.trans_flag IN (12, 54, 58, 60, 310, 48)
           ORDER BY r.doc_date DESC
           LIMIT 1
       ) AS last_in_date,
       (
           SELECT ROUND(COALESCE(r.price, 0), 2)::numeric(18, 2)
           FROM ic_trans_serial_number r
           WHERE r.serial_number = s.serial_number
             AND r.trans_flag IN (12, 54, 58, 60, 310, 48)
           ORDER BY r.doc_date DESC
           LIMIT 1
       ) AS last_in_cost
FROM ic_serial s
JOIN ic_inventory i ON i.code = s.ic_code
WHERE COALESCE(i.ic_serial_no, 0) = 1
  AND ($1 = '' OR s.serial_number ILIKE '%' || $1 || '%' OR s.ic_code ILIKE '%' || $1 || '%' OR COALESCE(i.name_1, '') ILIKE '%' || $1 || '%')
ORDER BY s.ic_code, s.serial_number;
```

---

## 2. ประวัติการเคลื่อนไหว Serial Number รายเอกสาร (`ic_trans_serial_number`)

**พารามิเตอร์**: `$1::text` (Serial Number ที่ต้องการตรวจสอบ)

```sql
SELECT sn.serial_number,
       sn.ic_code AS item_code,
       sn.doc_date,
       sn.doc_no,
       sn.trans_flag,
       sn.wh_code,
       sn.shelf_code,
       COALESCE(sn.price, 0)::numeric(18, 2) AS unit_price_or_cost,
       COALESCE(t.cust_code, '') AS party_code,
       COALESCE(ar.name_1, ap.name_1, '') AS party_name
FROM ic_trans_serial_number sn
LEFT JOIN ic_trans t ON t.doc_no = sn.doc_no AND t.trans_flag = sn.trans_flag
LEFT JOIN ar_customer ar ON ar.code = t.cust_code
LEFT JOIN ap_supplier ap ON ap.code = t.cust_code
WHERE sn.serial_number = $1
  AND COALESCE(sn.last_status, 0) = 0
  AND COALESCE(t.last_status, 0) = 0
ORDER BY sn.doc_date ASC, sn.doc_no ASC;
```

---

## 3. รายการใบรับเคลมซ่อม / เปลี่ยนเครื่อง RMA & สถานะประกัน (`ic_warranty_rma_ticket`)

อ้างอิงจาก `serial_warranty_rma.go:97-155`:

**พารามิเตอร์**: `$1::text` (สถานะ หรือ `''` = ทั้งหมด เช่น `'OPEN'`, `'REPAIRING'`, `'COMPLETED'`)

```sql
SELECT rma_doc_no,
       doc_date,
       serial_no,
       item_code,
       item_name,
       sale_invoice_no,
       sale_date,
       warranty_months,
       warranty_expire_date,
       is_in_warranty,
       cust_code,
       cust_name,
       cust_phone,
       symptom,
       resolution_type,
       replacement_sn,
       service_fee::numeric(18, 2) AS service_fee,
       parts_cost::numeric(18, 2) AS parts_cost,
       status,
       remark
FROM ic_warranty_rma_ticket
WHERE ($1 = '' OR status = $1)
ORDER BY doc_date DESC, rma_doc_no DESC
LIMIT 200;
```
