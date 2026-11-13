---
title: AR Master Groups & Lookup Tables — ตารางกลุ่มลูกหนี้ พื้นที่ขาย ดีลเลอร์ และเงื่อนไขวางบิล
tags: [dev, schema, ar, master, lookup, postgres]
aliases: [ar_type, ar_group, ar_sale_area, ar_dealer, ar_shoptype, กลุ่มลูกหนี้, เขตการขาย]
sources:
  - scripts/sql/02_data_schema.sql:880-927
  - scripts/sql/02_data_schema.sql:1218-1314
  - scripts/sql/02_data_schema.sql:1329-1681
  - scripts/sql/02_data_schema.sql:8965-8980
  - backend/internal/application/process/service.go:882-883
  - backend/internal/application/process/sysproc_ic_checks_data.go:65-66
---

# AR Master Groups & Lookup Tables — ตารางกลุ่มและตัวเลือกฝั่งลูกหนี้

รวมตารางจัดหมวดหมู่ พื้นที่ขาย เขตส่งสินค้า ดีลเลอร์ รถ/อุปกรณ์ เงื่อนไขวางบิล-เก็บเงิน และเหตุผลเปิด/ปิดลูกหนี้ ที่ถูกอ้างอิงจาก `ar_customer` และ `ar_customer_detail` ([[tbl-ar-customer]]) ดูแผนผังทั้งหมดใน [[schema-overview]]

---

## 1. ลักษณะโครงสร้างร่วม

- **Primary Key / Unique Key**: ตารางทั้งหมดในกลุ่มนี้ไม่มี SQL `PRIMARY KEY` ใน `02_data_schema.sql` มีเพียง `roworder SERIAL NOT NULL` และ `CREATE INDEX IF NOT EXISTS idx_<table_name>_code ON <table_name> (code)`
- **คอลัมน์มาตรฐาน**: `code varchar(25)`, `name_1 varchar(100/255)`, `name_2 varchar(200)`, `status smallint DEFAULT 0` (`0 = ใช้งาน`, `1 = ปิดใช้งาน`), `guid_code varchar(35/50)` พร้อม 4 คอลัมน์ระบบ (`ignore_sync`, `is_lock_record`, `roworder`, `create_date_time_now`)

---

## 2. รายการตารางจัดกลุ่มและจำแนกลูกค้า (Classification & Hierarchy)

| ชื่อตาราง (`02_data_schema.sql`) | คีย์ / Index | คอลัมน์เฉพาะและหน้าที่ | ฟิลด์อ้างอิงใน `ar_customer` / `ar_customer_detail` |
|---|---|---|---|
| `ar_type` (`:1637-1650`) | `code` (`idx_ar_type_code`) | ประเภทลูกหนี้หลัก | `ar_customer.ar_type` |
| `ar_sub_type_1` (`:1607-1620`) | `code` (`idx_ar_sub_type_1_code`) | ประเภทลูกหนี้ย่อยระดับ 1 | `ar_customer_detail.ar_sub_type_1_code` |
| `ar_group` (`:1284-1297`) | `code` (`idx_ar_group_code`) | กลุ่มลูกหนี้หลัก | `ar_customer_detail.group_main` |
| `ar_group_sub` (`:1299-1314`) | `code` (`idx_ar_group_sub_code`) | กลุ่มลูกหนี้ย่อย (`sub_no smallint`, `main_group varchar(25)`) | `ar_customer_detail.group_sub_1`–`4` |
| `ar_tier` (`:1622-1635`) | `code` (`idx_ar_tier_code`) | ระดับลูกค้า (Tier) | `ar_customer.ar_tier_code` |
| `ar_channel` (`:880-893`) | `code` (`idx_ar_channel_code`) | ช่องทางการขาย/การติดต่อ (B2B, Retail, Online ฯลฯ) | `ar_customer_detail.ar_channel_code` |
| `ar_dimension` (`:1252-1267`) | `code` (`idx_ar_dimension_code`) | มิติวิเคราะห์ลูกหนี้ (`dimension_no integer`, `remark`) | `ar_customer_detail.dimension_1`–`10` |
| `ar_project` (`:1434-1448`) | `code` (`idx_ar_project_code`) | โครงการประจำตัวลูกหนี้ (`remark`) | `ar_customer_detail.ar_project_code` |
| `ar_location_type` (`:1359-1372`) | `code` (`idx_ar_location_type_code`) | ประเภททำเลที่ตั้งร้านค้า | `ar_customer_detail.ar_location_type_code` |
| `ar_shoptype1`–`ar_shoptype7` (`:1480-1590`) | `code` (`idx_ar_shoptype*_code`) | ประเภทร้านค้า 7 ระดับ (มี `remark varchar(255)`) | `ar_customer_detail.ar_shoptype1_code`–`7_code` |
| `sub_ar_shoptype5` (`:8965-8980`) | `code` (`idx_sub_ar_shoptype5_code`) | ประเภทร้านค้าระดับย่อยของ Type 5 (`ar_shoptype5_code varchar(25)`, `remark`) | `ar_customer_detail.sub_ar_shoptype5_code` |

---

## 3. ตารางพื้นที่ขาย เขตขนส่ง การวางบิล/เก็บเงิน และเหตุผล

| ชื่อตาราง (`02_data_schema.sql`) | คีย์ / Index | คอลัมน์เฉพาะและหน้าที่ | ฟิลด์อ้างอิง |
|---|---|---|---|
| `ar_sale_area` (`:1450-1463`) | `code` (`idx_ar_sale_area_code`) | เขตการขาย (Territory / Area) | `ar_customer_detail.area_code`, `ap_ar_trans.sale_area_code`, `ic_trans.sale_area_code` |
| `ar_sale_group` (`:1465-1478`) | `code` (`idx_ar_sale_group_code`) | กลุ่มทีมขาย / พนักงานขาย | จัดกลุ่มในรายงานการขายและคอมมิชชั่น |
| `ar_logistic_area` (`:1374-1387`) | `code` (`idx_ar_logistic_area_code`) | เขตสายส่งสินค้า / โลจิสติกส์ | `ar_customer_detail.logistic_area`, `ap_ar_transport_label.logistic_area` |
| `ar_paybill_area` (`:1419-1432`) | `code` (`idx_ar_paybill_area_code`) | เขตพื้นที่วางบิลและรับเช็ค | `ar_customer_detail.area_paybill` |
| `ar_pay_bill_condition` (`:1404-1417`) | `code` (`idx_ar_pay_bill_condition_code`) | เงื่อนไขวัน/วิธีวางบิล | `ar_customer_detail.pay_bill_condition` |
| `ar_keep_chq_condition` (`:1329-1342`) | `code` (`idx_ar_keep_chq_condition_code`) | เงื่อนไขวัน/วิธีรับเช็ค | `ar_customer_detail.keep_chq_code` |
| `ar_keep_money_condition` (`:1344-1357`) | `code` (`idx_ar_keep_money_condition_code`) | เงื่อนไขการเก็บเงิน | `ar_customer_detail.keep_money_condition` |
| `ar_contact_group` (`:914-927`) | `code` (`idx_ar_contact_group_code`) | กลุ่มผู้ติดต่อของลูกหนี้ | `ar_contactor.group_contactor` |
| `ar_work_title` (`:1667-1681`) | `code` (`idx_ar_work_title_code`) | ตำแหน่งงานผู้ติดต่อ (หมายเหตุ: สคีมาเดิมมีทั้ง `staus` และ `status`) | `ar_contactor.work_title` |
| `ar_open_reason` (`:1389-1402`) | `code` (`idx_ar_open_reason_code`) | เหตุผลในการเปิดลูกหนี้ / เปิดเครดิต | — |
| `ar_close_reason` (`:895-912`) | `code` (`idx_ar_close_reason_code`) | เหตุผลปิดลูกหนี้/ปิดเครดิต (`save_code`, `save_date`, `edit_code`, `edit_date`) | `ar_customer_detail.close_reason` |
| `ar_vehicle` (`:1652-1665`) | `code` (`idx_ar_vehicle_code`) | ข้อมูลรถประจำตัวลูกค้า (ธุรกิจซ่อม/อะไหล่/ขนส่ง) | `ar_customer_detail.ar_vehicle_code` |
| `ar_equipment` (`:1269-1282`) | `code` (`idx_ar_equipment_code`) | เครื่องจักร/อุปกรณ์ประจำตัวลูกค้า | `ar_customer_detail.ar_equipment_code` |
| `ar_sub_equipment` (`:1592-1605`) | `code` (`idx_ar_sub_equipment_code`) | อุปกรณ์ย่อยประจำตัวลูกค้า | `ar_customer_detail.ar_sub_equipment` |

---

## 4. ตาราง `ar_dealer` (ทะเบียนตัวแทนจำหน่าย / ดีลเลอร์)

- **หน้าที่**: เก็บข้อมูลตัวแทนจำหน่ายที่ผูกกับรหัสลูกค้า (`ar_code`), เลขที่ใบอนุญาตสมาคม, ที่อยู่เฉพาะและพิกัดแผนที่ (`02_data_schema.sql:1218-1250`)
- **Indexes**: `idx_ar_dealer_code` ON `ar_dealer` (`code`), `idx_ar_dealer_ar_code` ON `ar_dealer` (`ar_code`)
- **คอลัมน์สำคัญ**:
  - `code`, `ar_code`, `branch_code`, `is_staff` (`0/1` เป็นพนักงานด้วยหรือไม่)
  - `regist_date`, `expire_date`, `asso_code`, `asso_regist_date`, `asso_expire_date`
  - ข้อมูลบุคคล/ที่อยู่: `sex`, `nationality`, `mstatus`, `blood_group`, `address`, `moo`, `building`, `floor`, `room_no`, `soi`, `road`, `home_phone_extend`, `off_phone`, `off_phone_extend`, `mobile_phone`, `guid_code`
  - **Runtime Columns (`service.go:882-883`)**: `latitude NUMERIC(18,6) DEFAULT 0`, `longitude NUMERIC(18,6) DEFAULT 0`
- **ความสมบูรณ์ของข้อมูล**: เครื่องมือซ่อมบำรุงใน `sysproc_ic_checks_data.go:65-66` ตรวจสอบแถว `ar_dealer` ที่ไม่มีแม่ใน `ar_customer.code` และลบออก

```sql
-- ตัวอย่าง: ดึงตัวแทนจำหน่ายที่ยังไม่หมดอายุพร้อมพิกัดและชื่อลูกค้า
SELECT d.code AS dealer_code,
       d.ar_code,
       c.name_1 AS customer_name,
       d.regist_date,
       d.expire_date,
       d.latitude,
       d.longitude
FROM ar_dealer d
JOIN ar_customer c ON c.code = d.ar_code
WHERE COALESCE(c.status, 0) = 0
  AND (d.expire_date IS NULL OR d.expire_date >= CURRENT_DATE)
ORDER BY d.code;
```
