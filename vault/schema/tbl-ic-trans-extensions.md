---
title: "ส่วนขยายธุรกรรมสินค้า — Additional, Shipment, Temp/Draft, มิติปันส่วน, WMS และ Package"
tags: [schema, inventory, transaction, wms, shipment, dimensions, bcaiaccount]
aliases: [ic_trans_extensions, ic_trans_shipment, ic_trans_additional, ic_wms_trans, ic_trans_detail_department]
sources:
  - scripts/sql/02_data_schema.sql:4949-4981
  - scripts/sql/02_data_schema.sql:5061-5085
  - scripts/sql/02_data_schema.sql:5947-5988
  - scripts/sql/02_data_schema.sql:6722-6752
  - scripts/sql/02_data_schema.sql:6888-7113
  - scripts/sql/02_data_schema.sql:7151-7203
  - scripts/sql/02_data_schema.sql:7371-7602
  - backend/internal/application/process/service.go:660-665
  - backend/internal/application/process/trans.go:421-424
---

# ส่วนขยายธุรกรรมสินค้า — Additional, Shipment, Temp/Draft, มิติปันส่วน, WMS และ Package

กลุ่มตารางส่วนขยายของ [[tbl-ic-trans]] และ [[tbl-ic-trans-detail]] ใช้เก็บข้อมูลเพิ่มเติมที่ไม่รวมอยู่ในตารางหลัก ได้แก่ ที่อยู่จัดส่งและพิกัด, ออเดอร์อีคอมเมิร์ซ/ข้อมูลเสริม, ตารางปันส่วนมิติองค์กรรายบรรทัด, ส่วนลดกลุ่ม/โปรโมชั่น/คอมมิชชั่น, เอกสารพักชั่วคราว (Temp/Draft), ปรับวันครบกำหนด, บรรจุภัณฑ์, และระบบจัดการคลังสินค้า (WMS)

> [!NOTE] ข้อสังเกตเรื่องสคีมา
> ตารางทั้งหมดในกลุ่มนี้ตาม `02_data_schema.sql` ไม่มี SQL `PRIMARY KEY` (ใช้ `roworder SERIAL NOT NULL` และ Index เชื่อม `(doc_no, trans_flag)`) ยกเว้นตารางโครงสร้างเปล่าที่รองรับฟีเจอร์ C# ดั้งเดิม (`ic_trans_draft`, `ic_trans_detail_draft`, `ic_trans_resource`) ซึ่งมีเฉพาะคอลัมน์ระบบพื้นฐาน

## 1. ตารางส่วนขยายหัวเอกสารและการจัดส่ง

| ตาราง (`02_data_schema.sql`) | บทบาทและคอลัมน์สำคัญ | Indexes |
|---|---|---|
| `ic_trans_shipment` (`7151-7179`) | ข้อมูลจัดส่งสินค้าของเอกสาร: `doc_no`, `doc_date`, `trans_flag`, `cust_code`, `transport_name`, `transport_address`, `transport_telephone`, `transport_tambon`, `transport_amper`, `transport_province`, `transport_country`, `transport_code`, `destination`, `ship_code`, `logistic_area`, `latitude`, `longitude` *(ถูกลบอัตโนมัติใน `deleteTransTx` `trans.go:422`)* | `(doc_no, trans_flag)`, `(doc_date, trans_flag)`, `(cust_code)` |
| `ic_trans_additional` (`6722-6752`) | ข้อมูลเสริมออเดอร์/เว็บ: `doc_no`, `trans_flag`, `web_order_id`, `cust_id`, `custcode`, `custrefcode`, `district1_name`, `district2_name`, `province_name`, `custlat`, `custlng`, `custbusinesstel`, `custmobile`, `orderdetail`, `ordertype`, `firstorder`, `orderpaymenttype`, `deliveryaddressid`, `orderdeliverydate`, `paymentdate`, `orderdate`, `deliveryday`, `ssfquantity` | `(doc_no, trans_flag)` |
| `ic_extra_detail` (`5061-5085`) | รายละเอียดเสริมมิติและคุณลักษณะรายบรรทัด: `trans_type`, `trans_flag`, `doc_no`, `doc_date`, `ic_code`, `ic_name`, `department_code`, `project_code`, `allocate_code`, `ic_color`, `ic_size`, `ic_character`, `ic_pattern`, `status`, `line_number`, `doc_group` | `(doc_no, trans_flag)`, `(doc_date, trans_flag)` |
| `ic_trans_discount_group` (`7084-7099`) | ส่วนลดระดับกลุ่มสินค้าในเอกสาร: `doc_no`, `doc_date`, `trans_flag`, `discount_group_code`, `discount_group_name`, `discount_word`, `group_amount`, `discount_amount` | `(doc_no, trans_flag)`, `(doc_date, trans_flag)` |

## 2. ตารางปันส่วนมิติองค์กร คอมมิชชั่น และโปรโมชั่นรายบรรทัด

กลุ่มตารางปันส่วน (ใช้โครงสร้างมาตรฐานร่วมกันคือ `doc_date`, `doc_no`, `trans_flag`, `ratio NUMERIC`, `amount NUMERIC`, `line_number`, `doc_line_number`, `ic_code`):

- `ic_trans_detail_allocate` (`6888-6904`) — คอลัมน์รหัสมิติ `allocate_code` (แหล่งปันส่วน)
- `ic_trans_detail_department` (`6926-6942`) — คอลัมน์รหัสมิติ `department_code` (แผนก — JOIN [[tbl-erp-branch-department]])
- `ic_trans_detail_jobs` (`6951-6967`) — คอลัมน์รหัสมิติ `job_code` (งาน)
- `ic_trans_detail_project` (`6998-7014`) — คอลัมน์รหัสมิติ `project_code` (โครงการ)
- `ic_trans_detail_site` (`7036-7052`) — คอลัมน์รหัสมิติ `site_code` (`text`) (หน่วยงาน/ไซต์งาน)
- `ic_trans_detail_commission` (`6906-6924`) — ค่าคอมมิชชั่นรายรายการสินค้า: `doc_no`, `trans_flag`, `item_code`, `commission`, `commission_amount`, `line_number`, `remark` + audit columns
- `ic_trans_detail_promotion` (`7016-7034`) — รายการโปรโมชั่นที่ใช้งานในเอกสาร: `doc_no`, `doc_date`, `doc_ref`, `doc_ref_date`, `trans_flag`, `promotion_code`, `promotion_name`, `qty`, `price`, `sum_amount`, `line_number`

## 3. ตาราง Temp, Draft, Adjust Date, Package และ WMS

- **เอกสารชั่วคราว / ร่าง (Staging)**:
  - `ic_trans_temp` (`7181-7203`) และ `ic_trans_detail_temp` (`7054-7082`): พักเอกสารสแกน/ตรวจรับ/เบิกชั่วคราว มี `wh_code`, `shelf_code`, `wh_code_2`, `shelf_code_2`, `location_code`, `user_code`, `barcode`, `time_add`, `success_status`
  - `ic_trans_draft` (`7101-7106`), `ic_trans_detail_draft` (`6944-6949`), `ic_trans_resource` (`7108-7113`): โครงสร้างตารางฐาน (`roworder`, `ignore_sync`, `is_lock_record`, `create_date_time_now`)
- **เอกสารปรับวันครบกำหนด / วันส่ง (`ic_date_adjust` / `ic_date_adjust_detail`, `4949-4981`)**:
  - หัวเอกสาร `ic_date_adjust`: `doc_date`, `doc_no`, `doc_group`, `ap_ar_code`, `transection_flag`, `status`, `guid_code`
  - รายการ `ic_date_adjust_detail`: `bill_date`, `bill_no`, `credit_day_old`, `due_date_old`, `sending_date_old`, `credit_day_new`, `due_date_new`, `sending_date_new`, `line_number`
- **ธุรกรรมบรรจุภัณฑ์ / ลัง (`ic_package_trans` / `ic_package_trans_detail`, `5947-5988`)**:
  - หัว `ic_package_trans`: `trans_flag`, `trans_type`, `doc_no`, `doc_date`, `cust_code`, `doc_ref_no`, `doc_ref_date`, `doc_time`
  - รายการ `ic_package_trans_detail`: `item_code`, `item_name`, `qty`, `stand_value`, `divide_value`
- **WMS คลังสินค้า (`ic_wms_trans` `7371-7488` และ `ic_wms_trans_detail` `7490-7602`)**:
  - โครงสร้างคู่ขนานกับ `ic_trans` / `ic_trans_detail` สำหรับระบบ Pick & Pack / WMS แยกต่างหาก โดยใน `service.go:662-663` ระบบ Go จะซิงก์ `stand_value` และ `divide_value` จาก `ic_unit_use` ให้ `ic_wms_trans_detail` สำหรับสินค้าหลายหน่วย (`unit_type IN (1, 3)`) เหมือน `ic_trans_detail` เช่นกัน

## ตัวอย่าง SQL จริง: ตรวจสอบที่อยู่จัดส่งและมิติแผนกของเอกสารขาย

```sql
SELECT t.doc_no, t.doc_date, t.cust_code,
       sh.transport_name, sh.transport_address, sh.transport_province,
       d.item_code, d.sum_amount,
       dd.department_code, dd.ratio, dd.amount AS dept_amount
FROM ic_trans t
LEFT JOIN ic_trans_shipment sh
  ON sh.doc_no = t.doc_no AND sh.trans_flag = t.trans_flag
LEFT JOIN ic_trans_detail d
  ON d.doc_no = t.doc_no AND d.trans_flag = t.trans_flag
LEFT JOIN ic_trans_detail_department dd
  ON dd.doc_no = d.doc_no AND dd.trans_flag = d.trans_flag AND dd.doc_line_number = d.line_number
WHERE t.doc_no = $1 AND t.trans_flag = $2
  AND COALESCE(t.last_status, 0) = 0
ORDER BY d.line_number;
```
