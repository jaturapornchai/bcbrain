---
title: พารามิเตอร์ระบบกลางและ Switchboard — erp_option / erp_feature_option
tags: [dev, schema, erp, config, options]
aliases: [erp_option, erp_feature_option, erp_option_etax_inet, erp_option_mobillyst, ตั้งค่าระบบ]
sources:
  - scripts/sql/02_data_schema.sql:2993-3515
  - scripts/sql/02_data_schema.sql:9878-9908
  - backend/internal/application/process/feature_options.go:412-460
  - backend/internal/application/process/transcalc.go:56-68
  - backend/internal/application/process/trans_validate.go:21-40
  - backend/internal/application/process/trans_save_rules.go:21-48
  - backend/internal/application/process/gl_template.go:265-295
  - backend/internal/application/process/gl_template.go:730-770
  - backend/internal/application/process/gl_template_defaults.go:148-210
  - backend/internal/application/process/runtime_options.go:50-130
  - backend/internal/application/process/runtime_options.go:315-340
  - backend/internal/application/process/db_migrate.go:430-440
  - backend/internal/application/process/stock_rebuild.go:110-115
  - frontend/account/config/useRuntimeOptions.ts:40-200
---

# พารามิเตอร์ระบบกลางและ Feature Switchboard (`erp_option`, `erp_feature_option`)

กลุ่มตารางกำหนดพฤติกรรมการคำนวณภาษี สต็อก ต้นทุน วงเงินเครดิต การลงบัญชี และ Feature Switchboard ของระบบทั้งบริษัท ดูภาพรวมโครงสร้างทั้งหมดได้ที่ [[schema-overview]]

---

## 1. `erp_option` — สวิตช์พารามิเตอร์กลาง (Singleton)

| รายการ | รายละเอียด |
|---|---|
| **บทบาท** | เก็บการตั้งค่าหลักของกิจการ (Singleton 1 แถว; ถ้าฐานข้อมูลว่างไม่มีแถวใน `erp_option` ฝั่ง Go จะถือว่า Switch ส่วนใหญ่ปิดเป็น `0` ยกเว้น `year_type` และ `item_amount_decimal` ตามค่า Default ของจอ BC 5.5) |
| **Primary Key** | ไม่มี SQL `PRIMARY KEY` (ใช้ `roworder serial NOT NULL`, อ่านด้วย `LIMIT 1`) |
| **หมายเหตุความปลอดภัย** | คอลัมน์ข้อมูลรับรอง/พารามิเตอร์เชื่อมต่อบริการภายนอกถูกสงวนไว้ไม่แสดงในเอกสารนี้ |

### ก. ตั้งค่าทั่วไป ปี ทศนิยม การปัดเศษ และเอกสาร

| คอลัมน์ | ชนิดข้อมูล | ความหมาย / ค่า Flag ที่ยืนยันจากโค้ด Go |
|---|---|---|
| `year_type` | `integer` / `varchar` | ประเภทปีที่แสดงผลบน UI/รายงาน (`0 = ค.ศ.`, `1 = พ.ศ. +543`; ฐานข้อมูลเก็บ ค.ศ. เสมอ) |
| `item_qty_decimal`, `item_price_decimal`, `item_amount_decimal`, `gl_no_decimal`, `currency_exchange_decimal`, `exchange_rate_decimal` | `integer` / `numeric` | จำนวนหลักทศนิยมของจำนวนสินค้า, ราคาต่อหน่วย, จำนวนเงิน (ค่า Default `2`), บัญชี GL และอัตราแลกเปลี่ยน |
| `round_type` | `smallint` / `varchar` | รูปแบบการปัดเศษ (`0 = ปัดแบบ C# cascading _round`, `1 = Math.Round(v + 0.000001, digits, AwayFromZero)`) |
| `use_doc_group`, `use_department`, `use_job`, `use_allocate`, `use_project`, `use_unit`, `use_work_in_process` | `integer` | เปิดใช้มิติ: กลุ่มเอกสาร, แผนก, งาน, ปันส่วน, โครงการ, หลายหน่วยนับ, งานระหว่างทำ (`1 = เปิดใช้`) |
| `warning_branch_input`, `warning_department`, `select_branch_first`, `show_branch_doc_only` | `smallint` | บังคับ/เตือนกรอกสาขา (ต้องคู่กับ `erp_company_profile.branch_status = 1`), บังคับแผนก, แสดงเฉพาะเอกสารของสาขา |
| `disable_edit_doc_no_doc_date`, `running_doc_no_only`, `gen_doc_no_auto`, `auto_insert_time` | `smallint` | ล็อกแก้ไขเลขที่/วันที่เอกสาร, บังคับรันตามฟอร์แมต, สร้างเลขที่อัตโนมัติ, ใส่วันเวลาปัจจุบันอัตโนมัติ |
| `no_coppy`, `lock_edit_product_name_in_detail`, `check_qty`, `show_item_remark` | `smallint` | ห้ามคัดลอกเอกสาร, ห้ามแก้ชื่อสินค้าในตาราง, บังคับกรอกจำนวน > 0, เปิดช่องหมายเหตุบรรทัด |

### ข. ภาษีมูลค่าเพิ่ม (VAT), ส่วนลด และบัญชี (GL)

| คอลัมน์ | ชนิดข้อมูล | ความหมาย / ค่า Flag ที่ยืนยันจากโค้ด Go |
|---|---|---|
| `vat_type`, `vat_type_1` | `integer` / `varchar` | ประเภท VAT เริ่มต้นฝั่งขาย / ซื้อ (`0 = แยกนอก`, `1 = รวมใน`, `2/3 = ยกเว้น/ไม่กระทบภาษี`) |
| `vat_rate`, `wht_rate` | `numeric` | อัตรา VAT (เช่น `7`) และ WHT มาตรฐาน |
| `discout_type` *(สะกดตาม DDL จริง, DEFAULT `1`)* | `smallint` / `varchar` | ลำดับคำนวณ VAT กับส่วนลดท้ายบิล: `0 = VAT ก่อนหักส่วนลด`, `1 = VAT หลังหักส่วนลด` (Default `1` และ `db_migrate.go:436` backfill `IS NULL` เป็น `1` ให้ครบ) |
| `discount_vat_type` | `smallint` / `varchar` | การหักส่วนลดท้ายบิลระหว่างสินค้ามีภาษีกับยกเว้น: `0 = หักสินค้ามีภาษีก่อน`, `1 = เฉลี่ยตามสัดส่วน` (`2` อ่านเป็น `0`) — ส่งออกผ่าน `CompanyRuntimeOptions` (`discountVatType`, `roundType`, `discountStepRoundOff`, `itemAmountDecimal`) ใน `runtime_options.go` และ `useRuntimeOptions.ts` เพื่อให้ Frontend คำนวณตรงกับ Go Backend |
| `discount_step_round_off`, `calc_item_price_discount`, `manual_total` | `smallint` | ปิดการปัดเศษส่วนลดหลายขั้น, ปัดเศษส่วนลดรายบรรทัดตอนคำนวณ Line VAT, อนุญาตกรอกยอดรวมเอง |
| `check_input_vat` | `smallint` | บังคับกรอก `tax_doc_no` และ `tax_doc_date` สำหรับเอกสารซื้อ/ขายที่มี VAT (`VatType IN (0,1)`) |
| `gl_trans_type` | `integer` / `varchar` | การบันทึกบัญชี GL: `0 = แยกรายบรรทัด`, `1 = รวมบัญชีที่ซ้ำกันในสาขาเดียวกัน (Compound)` |
| `inventory_gl_post` | `smallint` / `varchar` | ระบบบันทึกบัญชีสต็อก: `0 = Periodic (สิ้นงวด — ตัดเงื่อนไขต้นทุน/สต็อก 101, 103)`, `1 = Perpetual (ต่อเนื่อง)` |
| `gl_process_realtime`, `lock_direct_journal`, `lock_date_back` | `smallint` | ประมวลผล GL แบบ Real-time, ห้ามลงรายวันตรง, ล็อกลงวันที่ย้อนหลัง |
| `multi_currency`, `home_currency` | `smallint` / `varchar` | เปิดระบบหลายสกุลเงิน (`1 = เปิดใช้`) และรหัสสกุลเงินหลัก (เช่น `THB`) |

### ค. ควบคุมสต็อก ต้นทุน Lot และราคา

| คอลัมน์ | ชนิดข้อมูล | ความหมาย / ค่า Flag ที่ยืนยันจากโค้ด Go |
|---|---|---|
| `stock_balance_control`, `ic_stock_control`, `issue_stock_control`, `transfer_stock_control` | `smallint` | ห้ามสต็อกติดลบภาพรวม / เอกสารขาย (`34/36/44/46/144`) / เบิกใช้ (`56`) / โอน (`70/72`) |
| `balance_control_type` | `smallint` / `varchar` | ระดับการเช็กสต็อกติดลบ: `0 = รวมทั้งบริษัท`, `1 = รายคลัง (wh_code)`, `2 = รายคลัง+ที่เก็บ (wh_code + shelf_code)` |
| `stock_reserved_control`, `stock_reserved_control_location`, `allow_sale_over_reserve` | `smallint` | ห้ามขายเกิน (คงเหลือ - ค้างจอง), เช็กแยกคลัง/ที่เก็บ, ยอมให้ขายอ้างใบสั่งจองเกินยอดจอง |
| `stock_accrued_control`, `stock_accured_level` *(สะกด `accured`)* | `smallint` / `varchar` | ห้ามขายเกิน (คงเหลือ - ค้างส่ง SO), ระดับเช็ก: `0 = สินค้า`, `1 = คลัง`, `2 = คลัง+ที่เก็บ` |
| `warning_low_cost`, `lock_low_cost` | `smallint` | เตือน / ล็อกห้ามขายต่ำกว่าต้นทุน (`average_cost` บนหน่วยต้นทุน) |
| `find_lot_auto`, `check_lot_auto`, `use_expire`, `warning_product_expire`, `check_expiration_date` | `smallint` | ดึง Lot อัตโนมัติ, ตรวจ Lot, เปิดระบบวันหมดอายุ, เตือน/ตรวจวันหมดอายุสินค้า |
| `disable_ic_cost_process`, `disable_auto_stock_process`, `disable_item_cost`, `cn_actual_cost`, `issue_return_real_cost` | `smallint` | ปิดคำนวณต้นทุน/สต็อกอัตโนมัติ, ปิดแสดงต้นทุน, คืนสินค้า/รับคืนใช้ต้นทุนจริง |
| `use_barcode`, `use_serial_no_duplicate`, `use_compare_unit`, `use_quality_control_system` | `smallint` | ใช้บาร์โค้ด, ยอมรับ Serial ซ้ำ, เปิดช่องเปรียบเทียบหน่วย, เปิดระบบ QC บนตารางรายการ |

### ง. ควบคุมลูกหนี้-เจ้าหนี้ เครดิต และลำดับเอกสาร

| คอลัมน์ | ชนิดข้อมูล | ความหมาย / ค่า Flag ที่ยืนยันจากโค้ด Go |
|---|---|---|
| `warning_credit_money`, `lock_credit_money`, `request_ar_credit`, `request_credit_type`, `sr_ss_credit_check`, `check_credit_sale_reserve_sale_order`, `check_ar_status_credit` | `smallint` | เตือน/ล็อกเกินวงเงินเครดิต, บังคับขออนุมัติวงเงิน (+ ประเภท `request_credit_type`), ตรวจเครดิตสั่งจอง/สั่งขาย, และเช็กวันปิดเครดิตลูกค้า `ar_customer_detail.close_credit_date` |
| `credit_sale_include_deposit`, `ar_credit_chq_outstanding` | `smallint` | นับหักยอดมัดจำ/ล่วงหน้าคงเหลือ และรวมเช็คค้างรับในยอดใช้วงเงินเครดิต |
| `purchase_request_approve_until_end`, `ref_pr_approve`, `ref_po_approve`, `doc_ref_salesorder_approve`, `doc_ref_reservation_approve` | `smallint` | บังคับอ้างอิงเฉพาะใบเสนอซื้อ/สั่งซื้อ/สั่งขาย/สั่งจองที่อนุมัติแล้ว และปิด PR เมื่อตรวจครบจบจริง (`successPR`) |
| `check_qty_over_doc_ref`, `receive_more_po`, `pu_from_po_only`, `ss_ref_po_only`, `doc_sale_order_edit` | `smallint` | ห้ามป้อนจำนวนเกินเอกสารอ้างอิง, ยอมรับของเกิน PO, บังคับรับ/ซื้อจาก PO เท่านั้น, ยอมแก้ไขใบเสนอราคา |
| `filter_pay_bill`, `ar_pay_from_bill_note`, `ap_pay_from_bill_note`, `pay_bill_over` | `smallint` | กรองบิลที่วางบิลแล้วในหน้ารับ-จ่ายชำระ, บังคับรับ-จ่ายจากใบวางบิล, ยอมชำระเกินยอดบิล |
| `default_sale_type`, `use_credit_pay_bill_calc`, `quotation_expire`, `check_delivery_date` | `smallint` / `varchar` | ประเภทขายเริ่มต้น (`1 = เงินสด`, `2 = เงินเชื่อ`), คำนวณวันครบกำหนดจาก `ar_credit_pay_bill`, บังคับวันหมดอายุใบเสนอราคา / วันส่งของ |

---

## 2. `erp_feature_option` — Feature Switchboard UI & Presets

| รายการ | รายละเอียด |
|---|---|
| **บทบาท** | เก็บสถานะเปิด/ปิดฟีเจอร์และ Preset รูปแบบธุรกิจ (เช่น `accounting_firm`, ร้านค้าปลีก, อู่ซ่อมรถ) เพื่อให้หน้าจอ Desktop/Web/Mobile/POS ใช้เมนูชุดเดียวกัน |
| **Primary Key** | `id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1)` (Singleton แท้ 1 แถว) |

| คอลัมน์ | ชนิดข้อมูล | ความหมาย |
|---|---|---|
| `id` | `smallint PRIMARY KEY` | ล็อกค่าเป็น `1` เสมอ (`CHECK (id = 1)`) |
| `preset_code` | `varchar(50)` | รหัส Preset ธุรกิจ (Default `'accounting_firm'`) |
| `flags_json` | `jsonb` | Map `<feature_key>: boolean` ควบคุมการแสดงเมนู/โมดูล |
| `updated_by`, `updated_at` | `varchar(50)` / `timestamptz` | ผู้ปรับปรุงและเวลาล่าสุด |

---

## 3. ตารางตั้งค่าระบบภายนอก (`erp_option_etax_inet`, `erp_option_mobillyst`)

| ตาราง | บทบาท | คอลัมน์สถานะ/ค่าคอนฟิกทั่วไป *(ยกเว้นฟิลด์ลับ)* |
|---|---|---|
| `erp_option_etax_inet` | ตั้งค่าส่งเอกสาร e-Tax ผ่าน iNet | `pdf_attach` (`smallint`), `uat_mode` (`smallint`: โหมดทดสอบ `1`) |
| `erp_option_mobillyst` | ตั้งค่าเชื่อมระบบขนส่ง Mobillyst | `enable_service` (`smallint`), `latitude` / `longitude` (`numeric`), `take_photo_receive` / `take_photo_delivery` (`smallint`), `cod_type_list` (`varchar(500)`), `is_poc` (`smallint`) |

---

## ตัวอย่าง SQL อ่านค่าพารามิเตอร์อย่างปลอดภัย

```sql
-- 1) อ่านค่าสวิตช์สำคัญสำหรับคำนวณ VAT/สต็อก/ปีบัญชี (รองรับกรณีตารางว่าง)
SELECT COALESCE((SELECT year_type::int FROM erp_option LIMIT 1), 0) AS year_type,
       COALESCE((SELECT vat_rate FROM erp_option LIMIT 1), 7) AS vat_rate,
       COALESCE((SELECT discout_type::int FROM erp_option LIMIT 1), 1) AS vat_discount_order,
       COALESCE((SELECT discount_vat_type::int FROM erp_option LIMIT 1), 0) AS discount_vat_mode,
       COALESCE((SELECT round_type::int FROM erp_option LIMIT 1), 0) AS round_type,
       COALESCE((SELECT inventory_gl_post::int FROM erp_option LIMIT 1), 0) AS inventory_gl_post,
       COALESCE((SELECT balance_control_type::int FROM erp_option LIMIT 1), 0) AS stock_check_level,
       COALESCE((SELECT multi_currency FROM erp_option LIMIT 1), 0) AS multi_currency;

-- 2) ตรวจรายการฟีเจอร์ที่เปิดใช้อยู่ใน Feature Switchboard
SELECT preset_code,
       kv.key AS feature_key,
       kv.value::boolean AS enabled
FROM erp_feature_option,
     LATERAL jsonb_each_text(flags_json) AS kv(key, value)
WHERE id = 1 AND kv.value = 'true'
ORDER BY kv.key;
```
