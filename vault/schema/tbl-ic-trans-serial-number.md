---
title: "ic_trans_serial_number — ความเคลื่อนไหว Serial Number รายชิ้น"
tags: [schema, inventory, serial, transaction, bcaiaccount]
aliases: [ic_trans_serial_number, ประวัติซีเรียล, คุม Serial]
sources:
  - scripts/sql/02_data_schema.sql:7115-7149
  - backend/internal/application/process/service.go:972-973
  - backend/internal/application/process/trans.go:421-425
  - backend/internal/application/process/trans.go:726-735
  - backend/internal/application/process/trans.go:1165-1180
  - backend/internal/application/process/stock_tools.go:176-251
---

# `ic_trans_serial_number` — ความเคลื่อนไหว Serial Number รายชิ้น

`ic_trans_serial_number` บันทึกประวัติการเข้า-ออกและการโอนย้ายคลังของ **Serial Number รายชิ้น** สำหรับสินค้าที่เปิดใช้ Serial (`ic_inventory.ic_serial_no = 1` / `ic_trans_detail.is_serial_number = 1`) ใช้ตรวจสอบความต่อเนื่องของคลัง/ที่เก็บ (Serial Analyze), ตรวจนับสต็อก Serial (`trans_flag = 76`), และการเชื่อมต่อไปยังทะเบียน Serial (`ic_serial`) กับงานซ่อม/ประกัน (`ic_warranty_rma_ticket`) ใน [[tbl-ic-serial-cost-lot]]

## Primary Key / Unique Key และ Indexes

- **ไม่มี SQL `PRIMARY KEY`** ใน `02_data_schema.sql` — ใช้ `roworder SERIAL NOT NULL`
- **Logical Key**: `(doc_no, trans_flag, ic_code, serial_number, line_number)` (ยกเว้นเอกสารโอน `72`/`70` ที่บันทึก 2 แถวต่อ SN คือฝั่งออก `72` `calc_flag = -1` และฝั่งเข้า `70` `calc_flag = 1`)
- **Indexes จาก `02_data_schema.sql:7147-7149`**:
  - `idx_ic_trans_serial_number_doc_no_trans_flag` ON `ic_trans_serial_number (doc_no, trans_flag)`
  - `idx_ic_trans_serial_number_doc_date_trans_flag` ON `ic_trans_serial_number (doc_date, trans_flag)`
  - `idx_ic_trans_serial_number_cust_code` ON `ic_trans_serial_number (cust_code)`
- **Performance Index ที่ Go Backend สร้าง (`service.go:972-973`)**:
  - `idx_ic_trans_serial_number_ic_serial_date` ON `ic_trans_serial_number (ic_code, serial_number, doc_date, doc_time, roworder)`

## คอลัมน์สำคัญ

| คอลัมน์ | ชนิดข้อมูล SQL | ความหมาย |
|---|---|---|
| `serial_number` | `varchar(50)` | หมายเลข Serial Number รายชิ้น |
| `ic_code` | `varchar(25)` | รหัสสินค้า (JOIN `ic_inventory.code`; สังเกตชื่อคอลัมน์คือ `ic_code` ไม่ใช่ `item_code`) |
| `doc_no`, `trans_flag`, `doc_date`, `doc_time` | `varchar(25)`, `integer`, `date`, `varchar(5)` | อ้างอิงเอกสารแม่ใน [[tbl-ic-trans]] |
| `doc_line_number`, `line_number` | `smallint`, `integer` | `doc_line_number` อ้างบรรทัดแม่ใน `ic_trans_detail`; `line_number` คือลำดับ SN ภายในบรรทัด |
| `calc_flag` | `smallint` | `1` = รับ SN เข้าคลัง/ที่เก็บ, `-1` = จ่าย SN ออกจากคลัง/ที่เก็บ |
| `wh_code`, `shelf_code`, `wh_code_2`, `shelf_code_2` | `varchar(25)` | คลัง/ที่เก็บของรายการ และคลัง/ที่เก็บคู่โอนในเอกสาร `72`/`70` |
| `unit_code`, `price`, `description` | `varchar(25)`, `numeric`, `varchar(255)` | หน่วยนับ, ราคา, และรายละเอียด/ชื่อสินค้า |
| `cust_code`, `inquiry_type`, `last_status` | `varchar(25)`, `smallint` | รหัสคู่ค้า, ประเภทการสอบถาม/จ่าย, และสถานะ (แต่เวลาคิวรียังคง JOIN เช็ก `ic_trans.last_status = 0` เป็นหลัก) |
| `void_date` | `timestamp` | วันที่ยกเลิก/ทำลาย Serial (หากมีการ Void) |
| `product_year`, `product_week` | `varchar(4)`, `varchar(2)` | ปีและสัปดาห์ที่ผลิต |
| `car_inventory`, `car_stockno`, `car_engineno`, `car_chassisno` | `varchar(50)` / `varchar(100)` | ฟิลด์เฉพาะธุรกิจยานยนต์ (รหัสคลังรถ, Stock No, เลขเครื่องยนต์, เลขตัวถัง) |

## กฎสำคัญและการตรวจสอบ (`stock_tools.go:184-230`)

- **การวิเคราะห์ความผิดปกติ (`SerialAnalyze`)**: Replay ประวัติของ `(ic_code, serial_number)` ตามลำดับ `doc_date, doc_time, roworder` โดยข้ามเอกสาร `trans_flag NOT IN (144, 76)` และกรองเฉพาะเอกสารที่ `ic_trans.last_status = 0`
  - ถ้าพบรายการออก (`calc_flag = -1`) โดยยังไม่เคยมีรับเข้า (`calc_flag = 1`) มาก่อน -> ผิดปกติ `"ออกก่อนรับเข้า"`
  - ถ้าคลัง/ที่เก็บตอนออกไม่ตรงกับคลัง/ที่เก็บที่รับเข้าล่าสุด -> แจ้งเตือนตำแหน่งไม่ตรงกัน
- **การลบเอกสาร (`deleteTransTx`, `trans.go:421`)**: ลบ `ic_trans_serial_number WHERE doc_no = $1 AND trans_flag = ANY($2)` ก่อนลบ `ic_trans_detail` และ `ic_trans`

## ตัวอย่าง SQL จริงจากระบบ

### ตรวจสอบ Timeline การรับ-จ่าย Serial Number (`stock_tools.go:225-230`)

```sql
SELECT sn.ic_code,
       sn.serial_number,
       COALESCE(sn.wh_code, '') AS wh_code,
       COALESCE(sn.shelf_code, '') AS shelf_code,
       sn.doc_no,
       COALESCE(sn.calc_flag, 0) AS calc_flag
FROM ic_trans_serial_number sn
JOIN ic_trans t
  ON t.doc_no = sn.doc_no
 AND t.trans_flag = sn.trans_flag
 AND COALESCE(t.last_status, 0) = 0
WHERE sn.trans_flag NOT IN (144, 76)
  AND ($1 = '' OR sn.ic_code = $1)
ORDER BY sn.ic_code, sn.serial_number, sn.doc_date, sn.doc_time, sn.roworder;
```
