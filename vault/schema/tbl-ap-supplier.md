---
title: AP Supplier Master — ทะเบียนเจ้าหนี้/ผู้ขาย (ap_supplier, ap_supplier_detail)
tags: [dev, schema, ap, supplier, master, postgres]
aliases: [ap_supplier, ap_supplier_detail, ap_contactor, ทะเบียนเจ้าหนี้, ผู้ขาย]
sources:
  - scripts/sql/02_data_schema.sql:662-678
  - scripts/sql/02_data_schema.sql:729-863
  - backend/internal/application/process/trans_party.go:75-192
  - backend/internal/application/process/service.go:859-878
  - backend/internal/platform/db/pool.go:50-68
---

# AP Supplier Master — ทะเบียนเจ้าหนี้และผู้ขาย

กลุ่มตารางมาสเตอร์เจ้าหนี้ในระบบ BC AI Account เก็บข้อมูลคู่ค้าฝั่งซื้อ (`ap_supplier`) คู่กับเงื่อนไขการจ่ายเงิน ภาษี ผังบัญชีเจ้าหนี้ และมิติวิเคราะห์ (`ap_supplier_detail`) พร้อมผู้ติดต่อและการเชื่อมต่อระหว่างบริษัท ดูแผนผังรวมที่ [[schema-overview]]

---

## 1. ตาราง `ap_supplier` (หัวทะเบียนเจ้าหนี้)

- **หน้าที่**: เก็บข้อมูลพื้นฐาน ชื่อ-ที่อยู่ เบอร์ติดต่อ สถานะผู้ขาย และยอดควบคุมสรุปของเจ้าหนี้แต่ละราย
- **Primary Key / Unique Key**: ไม่มี SQL `PRIMARY KEY` ในสคีมาดั้งเดิม (มี `roworder SERIAL NOT NULL`); Go Backend คุมความไม่ซ้ำของ `code` ระดับ Application และเชื่อมลบพ่วงผ่าน `workflow.go:159-160`
- **Indexes**:
  - `idx_ap_supplier_code` ON `ap_supplier` (`code`) (`scripts/sql/02_data_schema.sql:789`)

| คอลัมน์ | ชนิดข้อมูล | ความหมาย / ค่า Flag |
|---|---|---|
| `code` | `varchar(25)` | รหัสเจ้าหนี้ (Natural Key เชื่อม `ic_trans.cust_code` ในเอกสารซื้อ/จ่าย และ `ap_ar_trans.cust_code`) |
| `code_old` | `varchar(25)` | รหัสเจ้าหนี้เดิม (ตอนย้ายฐานข้อมูล) |
| `name_1`, `name_2` | `varchar(100)` / `varchar(200)` | ชื่อเจ้าหนี้ภาษาหลักและภาษาที่สอง |
| `name_eng_1`, `name_eng_2` | `varchar(100)` | ชื่อเจ้าหนี้ภาษาอังกฤษ |
| `prefixname`, `firstname`, `lastname` | `varchar(15)`/`(50)`/`(70)` | คำนำหน้า ชื่อ-สกุล (กรณีบุคคลธรรมดา เช่น ภ.ง.ด.3) |
| `ap_status` | `smallint DEFAULT 0` | สถานะบุคคลทางกฎหมาย: `0 = นิติบุคคล`, `1 = บุคคลธรรมดา` |
| `status` | `smallint DEFAULT 0` | สถานะการใช้งาน: `0 = ใช้งาน (Active)`, `1 = ปิดใช้งาน (Inactive)` |
| `ap_type` | `varchar(25)` | รหัสประเภทเจ้าหนี้ เชื่อม `ap_type.code` ([[tbl-ap-master-contract]]) |
| `address`, `address_eng`, `tambon`, `amper`, `province`, `zip_code`, `country` | `varchar` | ที่อยู่หลักและรหัสภูมิศาสตร์ เชื่อม `erp_tambon`, `erp_amper`, `erp_province` |
| `telephone`, `fax`, `email`, `website`, `description`, `remark` | `varchar` | เบอร์โทรศัพท์ อีเมล เว็บไซต์ และหมายเหตุ |
| `debt_balance`, `chq_balance`, `bill_balance` | `numeric DEFAULT 0.0` | ยอดเจ้าหนี้คงค้าง เช็คจ่ายค้าง และวางบิลค้างสะสม |
| `doc_format_code` | `varchar(25)` | รหัสเลขที่เอกสาร Default ประจำตัวเจ้าหนี้ |
| `interco` | `varchar(255)` | รหัสคู่ค้าระหว่างบริษัทในเครือ |
| `use_partners`, `ap_web_service`, `ap_database_name`, `use_ar_code` | `smallint` / `varchar(255)` | ตั้งค่าเชื่อมระบบคู่ค้า (B2B) |
| `create_datetime`, `last_update_date_time`, `create_code`, `last_update_code` | `timestamp` / `varchar(50)` | ผู้บันทึก/แก้ไขล่าสุดและวันเวลา |

---

## 2. ตาราง `ap_supplier_detail` (รายละเอียดภาษี เครดิตซื้อ และผังบัญชีเจ้าหนี้)

- **หน้าที่**: เก็บเลขผู้เสียภาษี ประเภทสาขา (`สำนักงานใหญ่`/`สาขา`) รหัสผังบัญชีเจ้าหนี้ วันเครดิต และ 10 มิติวิเคราะห์ (สัมพันธ์ `1:1` กับ `ap_supplier` ด้วย `ap_code = ap_supplier.code`)
- **Indexes**:
  - `idx_ap_supplier_detail_ap_code` ON `ap_supplier_detail` (`ap_code`) (`scripts/sql/02_data_schema.sql:862`)
  - `idx_ap_supplier_detail_account_code` ON `ap_supplier_detail` (`account_code`) (`scripts/sql/02_data_schema.sql:863`)

| คอลัมน์สำคัญ | ชนิดข้อมูล | ความหมาย / ค่า Flag |
|---|---|---|
| `ap_code` | `varchar(25)` | รหัสเจ้าหนี้เชื่อม `ap_supplier.code` |
| `account_code` | `varchar(25)` | รหัสผังบัญชีเจ้าหนี้การค้า เชื่อม `gl_chart_of_account.code` |
| `tax_id`, `trade_license`, `card_id` | `varchar(50)` | เลขผู้เสียภาษี 13 หลัก ใบอนุญาต และบัตรประชาชน |
| `branch_type`, `branch_code` | `smallint` / `varchar(25)` | ประเภทสาขาตามสรรพากร: `0 = สำนักงานใหญ่`, `1 = สาขา` + รหัสสาขา 5 หลัก |
| `set_tax_type`, `tax_type`, `tax_rate` | `smallint` / `varchar(25)` / `numeric` | ค่า Default VAT ประจำเจ้าหนี้ (`set_tax_type=1` ใช้ค่าเฉพาะเจ้าหนี้; หมายเหตุ `tax_type` ใน `ap_supplier_detail` เป็น `varchar(25)` แปลงเป็น int ตอนคำนวณใน `trans_party.go:124-142`) |
| `credit_purchase`, `credit_code`, `credit_day`, `lead_time` | `smallint` / `varchar` / `integer` | สถานะซื้อเชื่อ วันเครดิตเริ่มต้น และระยะเวลานำส่งสินค้า (`lead_time`, คืนค่า Default `PartyDefaults`) |
| `staff_pay_code`, `payment_way`, `pay_bill_way`, `pay_condition` | `varchar` | พนักงานทำจ่าย วิธีจ่ายเงิน วิธีรับวางบิล และเงื่อนไขการจ่าย |
| `shipping_type`, `passbook_code`, `currency_code`, `form_name` | `varchar` | การส่งของ สมุดบัญชีรับโอน สกุลเงิน และชื่อฟอร์มพิมพ์ |
| `discount_item`, `discount_bill` | `varchar(50)` | ส่วนลดรายตัวและส่วนลดท้ายบิลประจำเจ้าหนี้ |
| `group_main`, `group_sub_1`–`4` | `varchar(25)` | กลุ่มเจ้าหนี้หลักและย่อย เชื่อม `ap_group`, `ap_group_sub` ([[tbl-ap-master-contract]]) |
| `dimension_1`–`dimension_10` | `varchar(100)`/`(255)` | มิติวิเคราะห์เจ้าหนี้ 10 ช่อง เชื่อม `ap_dimension` |
| `picture_1`–`4`, `ref_doc_1`–`3`, `close_reason`, `close_date` | `varchar` / `date` | รูป/เอกสารอ้างอิง และเหตุผลปิดการใช้งาน |
| `latitude`, `longitude` | `NUMERIC(18,6) DEFAULT 0` | พิกัดตำแหน่งร้าน/โรงงานผู้ขาย (**เพิ่มที่ Runtime** โดย `service.go:876-877` และ `pool.go:67-68`) |

---

## 3. ตารางประกอบฝั่งเจ้าหนี้ (`ap_contactor`, `ap_supplier_connected`, `ap_item_by_supplier`)

| ตาราง (`02_data_schema.sql`) | คีย์ / Index | คอลัมน์สำคัญและการใช้งาน |
|---|---|---|
| `ap_contactor` (`:662-678`) | `ap_code` (`idx_ap_contactor_ap_code`) | รายชื่อผู้ติดต่อของผู้ขาย: `name`, `address`, `telephone`, `mobile`, `email`, `work_title`, `work_department`, `officer_group`, `line_number` |
| `ap_supplier_connected` (`:791-806`) | `code`, `ap_code` (`idx_ap_supplier_connected_code`, `_ap_code`) | เชื่อมเจ้าหนี้ B2B ข้ามระบบ: `ap_web_service`, `ap_database_name`, `use_ar_code`, `guid_code`, `ap_provider`, `start_date` และคอลัมน์ Runtime จาก `service.go:859-863` (`ap_connected_code`, `server_address`, `provider_code`, `database_code`, `start_date`) |
| `ap_item_by_supplier` (`:729-740`) | `ap_code` (`idx_ap_item_by_supplier_ap_code`) | ผูกรหัสสินค้า (`ic_code`) ที่สั่งซื้อจากผู้ขายรายนั้นๆ (`remark`, `status`, `line_number`) |

```sql
-- ตัวอย่าง: ดึงข้อมูลเจ้าหนี้ที่ยังใช้งาน พร้อมเลขผู้เสียภาษี วันเครดิต และ Lead Time
SELECT s.code,
       s.name_1,
       COALESCE(d.tax_id, '') AS tax_id,
       COALESCE(d.branch_type, 0) AS branch_type,
       COALESCE(NULLIF(d.branch_code, ''), '00000') AS branch_code,
       COALESCE(d.credit_day, 0) AS credit_day,
       COALESCE(d.lead_time, 0) AS lead_time,
       COALESCE(d.account_code, '') AS ap_account_code
FROM ap_supplier s
LEFT JOIN LATERAL (
  SELECT *
  FROM ap_supplier_detail
  WHERE ap_code = s.code
  ORDER BY roworder
  LIMIT 1
) d ON true
WHERE COALESCE(s.status, 0) = 0
ORDER BY s.code;
```
