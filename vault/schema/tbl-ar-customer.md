---
title: AR Customer Master — ทะเบียนลูกค้า/ลูกหนี้ (ar_customer, ar_customer_detail)
tags: [dev, schema, ar, customer, master, postgres]
aliases: [ar_customer, ar_customer_detail, ar_contactor, ทะเบียนลูกค้า, ข้อมูลลูกหนี้]
sources:
  - scripts/sql/02_data_schema.sql:929-952
  - scripts/sql/02_data_schema.sql:1015-1216
  - scripts/sql/02_data_schema.sql:1316-1327
  - backend/internal/application/process/trans_party.go:75-192
  - backend/internal/application/process/trans_save_rules.go:525-565
  - backend/internal/application/process/sme_thai_pack.go:91-92
  - backend/internal/application/process/service.go:865-868
---

# AR Customer Master — ทะเบียนลูกค้าและข้อมูลลูกหนี้

กลุ่มตารางมาสเตอร์ลูกหนี้ในระบบ BC AI Account เก็บข้อมูลหลักฝั่งลูกค้า (`ar_customer`) แยกคู่กับข้อมูลเครดิต ภาษี บัญชีลูกหนี้ และมิติวิเคราะห์ (`ar_customer_detail`) พร้อมผู้ติดต่อ สาขาเชื่อมต่อ และรายการสินค้าเฉพาะลูกค้า ดูภาพรวมโครงสร้างทั้งหมดได้ที่ [[schema-overview]]

---

## 1. ตาราง `ar_customer` (หัวทะเบียนลูกค้า)

- **หน้าที่**: เก็บข้อมูลพื้นฐาน ชื่อ-ที่อยู่ เบอร์โทร ประเภทลูกหนี้ สมาชิก/แต้มสะสม และระดับราคาขายของลูกค้าแต่ละราย
- **Primary Key / Unique Key**: ไม่มี SQL `PRIMARY KEY` ในสคีมาดั้งเดิม (มี `roworder SERIAL NOT NULL` และ `idx_ar_customer_code` แบบ Non-unique); Go Backend บังคับความไม่ซ้ำของ Natural Key `code` และลบพ่วงแบบ Transaction ผ่านกลุ่มตาราง AR ทั้งชุด
- **Indexes**:
  - `idx_ar_customer_code` ON `ar_customer` (`code`) (`scripts/sql/02_data_schema.sql:1083`)

| คอลัมน์ | ชนิดข้อมูล | ความหมาย / ค่า Flag |
|---|---|---|
| `code` | `varchar(25)` | รหัสลูกค้า (Natural Key เชื่อมกับ `ic_trans.cust_code` และ `ap_ar_trans.cust_code`) |
| `code_old` | `varchar(25)` | รหัสลูกค้าเดิม (ใช้อ้างอิงตอนย้ายฐานข้อมูล) |
| `name_1`, `name_2` | `varchar(255)` / `varchar(200)` | ชื่อลูกค้าภาษาหลัก (`name_1`) และภาษาที่สอง (`name_2`) |
| `name_eng_1`, `name_eng_2` | `varchar(255)` | ชื่อลูกค้าภาษาอังกฤษ |
| `ar_status` | `smallint DEFAULT 0` | สถานะบุคคลทางกฎหมาย: `0 = นิติบุคคล`, `1 = บุคคลธรรมดา` |
| `status` | `smallint DEFAULT 0` | สถานะการใช้งาน: `0 = ใช้งาน (Active)`, `1 = ปิดใช้งาน (Inactive)` |
| `ar_type` | `varchar(25)` | รหัสประเภทลูกหนี้ เชื่อม `ar_type.code` |
| `ar_tier_code` | `varchar(25)` | รหัสระดับลูกค้า (Tier) เชื่อม `ar_tier.code` |
| `price_level` | `smallint DEFAULT 0` | ระดับราคาขายมาตรฐาน `0..9` (ส่งให้ตาราง [[tbl-ic-inventory-price]]) |
| `point_balance` | `numeric DEFAULT 0.0` | ยอดแต้มสะสมสมาชิกคงเหลือ |
| `tax_id` | `varchar(30) DEFAULT ''` | เลขประจำตัวผู้เสียภาษี 13 หลัก (**เพิ่มที่ Runtime** โดย `sme_thai_pack.go:91` เพื่อให้สืบค้นบนหัวลูกค้าได้โดยตรง) |
| `address`, `home_address`, `moo`, `soi`, `road`, `room_no`, `floor`, `building` | `varchar` | ที่อยู่หลักและรายละเอียดที่อยู่ย่อยภาษาไทย |
| `tambon`, `amper`, `province`, `zip_code`, `country` | `varchar` | รหัสตำบล/อำเภอ/จังหวัด เชื่อมกับ `erp_tambon`, `erp_amper`, `erp_province` ([[tbl-erp-geo-reason-master]]) |
| `telephone`, `fax`, `email`, `website`, `sms_phonenumber` | `varchar` | ช่องทางการติดต่อและเบอร์รับ SMS |
| `doc_format_code` | `varchar(25)` | รหัสแบบฟอร์มรันเลขที่อัตโนมัติ ([[tbl-erp-doc-format]]) |
| `prefixname`, `first_name`, `last_name`, `birth_day`, `sex` | `varchar` / `date` / `smallint` | ข้อมูลบุคคลธรรมดา/สมาชิก (`birth_day`, `sex`) |
| `arm_code`, `ar_code_main`, `ar_branch_code`, `arm_approve`, `arm_approve_date`, `arm_register`, `arm_register_date`, `arm_tier`, `nfc_id` | `varchar` / `smallint` / `date` | ข้อมูลสมาชิก AR Member / บัตร NFC และการอนุมัติสิทธิ์สมาชิก |
| `interco` | `varchar(255)` | รหัสคู่ค้าระหว่างบริษัทในเครือ |
| `create_datetime`, `last_update_date_time`, `create_code`, `last_update_code` | `timestamp` / `varchar(50)` | ประวัติผู้สร้างและแก้ไขล่าสุด |

---

## 2. ตาราง `ar_customer_detail` (รายละเอียดเครดิต ภาษี และบัญชีลูกหนี้)

- **หน้าที่**: เก็บรายละเอียดทางการค้า วงเงินเครดิต เงื่อนไขวางบิล/รับเช็ค ผังบัญชีลูกหนี้ และ 10 มิติวิเคราะห์ (ความสัมพันธ์ `1:1` โดย Natural Key `ar_code = ar_customer.code`)
- **Primary Key / Unique Key**: ไม่มี SQL `PRIMARY KEY` ในสคีมาดั้งเดิม (ใช้ `roworder SERIAL NOT NULL`); อ่านผ่าน `ar_code` ด้วย `LIMIT 1` (`trans_party.go:118`, `trans_save_rules.go:530`)
- **Indexes**:
  - `idx_ar_customer_detail_ar_code` ON `ar_customer_detail` (`ar_code`) (`scripts/sql/02_data_schema.sql:1215`)
  - `idx_ar_customer_detail_account_code` ON `ar_customer_detail` (`account_code`) (`scripts/sql/02_data_schema.sql:1216`)

| คอลัมน์สำคัญ | ชนิดข้อมูล | ความหมาย / ค่า Flag |
|---|---|---|
| `ar_code` | `varchar(25)` | รหัสลูกค้าเชื่อม `ar_customer.code` |
| `account_code` | `varchar(25)` | รหัสผังบัญชีลูกหนี้การค้า เชื่อม `gl_chart_of_account.code` |
| `tax_id`, `vat_license`, `trade_license`, `card_id` | `varchar(50)`/`varchar(100)` | เลขผู้เสียภาษี ทะเบียน ภ.พ.20 ใบอนุญาต และเลขบัตรประชาชน |
| `branch_type`, `branch_code` | `smallint` / `varchar(25)` | ประเภทสาขาตามสรรพากร: `0 = สำนักงานใหญ่` (`00000`), `1 = สาขา` + รหัสสาขา 5 หลัก |
| `set_tax_type`, `tax_type`, `tax_rate` | `smallint` / `numeric` | ค่า Default VAT ประจำตัวลูกค้า (`set_tax_type=1` ใช้ค่าเฉพาะลูกค้า, `tax_type`: `0=แยกนอก`, `1=รวมใน`, `2=ยกเว้น`) |
| `sale_type`, `sale_price_level` | `smallint DEFAULT 0` | ประเภทการขาย Default: `1 = เงินสด`, `2 = เงินเชื่อ`; `sale_price_level` ระดับราคาขาย |
| `shipping_type` | `smallint DEFAULT 0` | การส่งสินค้า Default (`trans_party.go:147`): `0 = รับเอง`, `1 = ส่งให้` |
| `credit_day`, `credit_money`, `credit_money_max`, `past_due_day` | `integer` / `numeric` | จำนวนวันเครดิต วงเงินเครดิตมาตรฐาน เพดานวงเงินสูงสุด และวันเกินกำหนดที่อนุญาต |
| `credit_status`, `credit_reason`, `credit_status_reason`, `reason_disable_credit`, `close_credit_date`, `disable_auto_close_credit`, `close_over_credit_warning` | `smallint` / `varchar` / `date` | สถานะวงเงินเครดิตที่ใช้ตรวจก่อนบันทึกขายเชื่อ (`trans_save_rules.go:539-548`): `0 = เปิด (อนุญาต)`, `1 = ปิด (ห้ามขายเชื่อ)`, `2 = ปิดชั่วคราว/รอตรวจสอบ` |
| `credit_group`, `credit_group_code` | `smallint` / `varchar(25-30)` | กลุ่มวงเงินเครดิตร่วม เชื่อม `ar_credit_group.code` (`credit_group_penalty.go:105` ขยายเป็น `VARCHAR(30)`) |
| `pay_bill_code`, `pay_bill_date`, `pay_bill_condition`, `area_paybill`, `keep_chq_code`, `keep_chq_date`, `keep_money_condition` | `varchar` / `smallint` | รอบวัน/เงื่อนไขวางบิลและเก็บเงิน-เก็บเช็ค เชื่อมตาราง `ar_*_condition` และ `ar_paybill_area` ([[tbl-ar-master-groups]]) |
| `sale_code`, `area_code`, `logistic_area`, `payment_person`, `credit_person`, `keep_money_person` | `varchar(25)` | พนักงานขาย พื้นที่ขาย เขตขนส่ง และผู้รับผิดชอบเก็บเงิน/สินเชื่อ |
| `discount_item`, `discount_bill`, `currency_code`, `passbook_code` | `varchar` | ส่วนลดท้ายบิล/รายตัวประจำลูกค้า สกุลเงิน และสมุดบัญชีรับโอน |
| `group_main`, `group_sub_1`–`4`, `customer_type_code`, `ar_channel_code`, `ar_location_type_code`, `ar_sub_type_1_code`, `ar_project_code`, `ar_vehicle_code`, `ar_equipment_code`, `ar_sub_equipment` | `varchar(25)` | รหัสจัดกลุ่มลูกค้า ช่องทาง สถานที่ โครงการ รถ/อุปกรณ์ เชื่อมตารางใน [[tbl-ar-master-groups]] |
| `ar_shoptype1_code`–`ar_shoptype7_code`, `sub_ar_shoptype5_code` | `varchar(25)` | ประเภทร้านค้า 7 ระดับและระดับย่อยของ type 5 |
| `dimension_1`–`dimension_10` | `varchar(100)`/`(255)` | มิติวิเคราะห์ลูกหนี้ 10 ช่อง เชื่อม `ar_dimension` |
| `latitude`, `longitude`, `line_id`, `facebook`, `ap_code_ref`, `br_cust_code`, `mobile_sales` | `numeric` / `varchar` / `smallint` | พิกัดแผนที่ ช่องทางโซเชียล รหัสเชื่อมฝั่งเจ้าหนี้ (`ap_code_ref`) และสถานะ Mobile Sales |
| `close_reason`, `close_date`, `close_reason_1`–`4` | `varchar` / `date` / `smallint` | เหตุผลและวันที่ปิดสถานะลูกค้า |

---

## 3. ตารางลูกหนี้ประกอบอื่นๆ (`ar_contactor`, `ar_customer_connected`, `ar_customer_cashier_list`, `ar_item_by_customer`)

| ตาราง (ที่มา `02_data_schema.sql`) | คีย์เชื่อม / Index | คอลัมน์สำคัญและการใช้งาน |
|---|---|---|
| `ar_contactor` (`:929-952`) | `ar_code` (`idx_ar_contactor_ar_code`) | รายชื่อผู้ติดต่อของลูกค้า: `name`, `address`, `telephone`, `mobile`, `email`, `work_title`, `work_department`, `officer_group`, `group_contactor`, `line_number`, `remark_1`–`6` |
| `ar_customer_connected` (`:1096-1107`) | `ar_code` (`idx_ar_customer_connected_ar_code`) | เชื่อมลูกค้า B2B/Inter-company ข้ามฐานข้อมูล: `ar_webservice_name`, `ar_provider_code`, `ar_database_name`, `guid_code` และคอลัมน์ Runtime จาก `service.go:865-867`: `ar_connected_code`, `provider_code`, `database_code` |
| `ar_customer_cashier_list` (`:1085-1094`) | `ar_code` (`idx_ar_customer_cashier_list_ar_code`) | จับคู่ลูกค้ากับพนักงานขาย/แคชเชียร์หลายราย (`sale_code varchar(255)`, `line_number smallint`) |
| `ar_item_by_customer` (`:1316-1327`) | `ar_code` (`idx_ar_item_by_customer_ar_code`) | ผูกรหัสสินค้า (`ic_code`) ที่ลูกค้าประจำสั่งซื้อหรือจำกัดรายการให้เลือก (`remark`, `status`, `line_number`) |

---

## 4. รูปแบบการ JOIN และตัวอย่าง SQL Query จริง

### 4.1 ดึงค่าตั้งต้นลูกค้าเมื่อสร้างเอกสารขาย (Pattern เดียวกับ `PartyDefaults` ใน `trans_party.go:75-154`)

```sql
SELECT c.code,
       c.name_1,
       COALESCE(NULLIF(c.tax_id, ''), d.tax_id, '') AS tax_id,
       c.price_level,
       COALESCE(d.sale_type, 0) AS sale_type,
       COALESCE(d.credit_day, 0) AS credit_day,
       COALESCE(d.credit_money, 0) AS credit_money,
       COALESCE(d.credit_status, 0) AS credit_status,
       COALESCE(d.set_tax_type, 0) AS set_tax_type,
       COALESCE(d.tax_type, 0) AS tax_type,
       COALESCE(d.tax_rate, 0) AS tax_rate,
       COALESCE(d.shipping_type, 0) AS shipping_type,
       COALESCE(d.account_code, '') AS ar_account_code,
       COALESCE(d.sale_code, '') AS sale_code
FROM ar_customer c
LEFT JOIN LATERAL (
  SELECT *
  FROM ar_customer_detail
  WHERE ar_code = c.code
  ORDER BY roworder
  LIMIT 1
) d ON true
WHERE c.code = $1
  AND COALESCE(c.status, 0) = 0;
```

> [!TIP]
> เพราะ `ar_customer_detail` ไม่มี SQL `PRIMARY KEY` การใช้ `LEFT JOIN LATERAL (... LIMIT 1)` แทนการ JOIN ตรงๆ ช่วยป้องกันปัญหาแถวเบิ้ลหากมีข้อมูลรายละเอียดซ้ำในฐานข้อมูลเดิม (`trans_save_rules.go:530-531`)
