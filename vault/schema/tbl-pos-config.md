---
title: ตารางตั้งค่าจุดขาย กะแคชเชียร์ และการส่งเงิน POS (posconfig, pos_id, pos_period, poscashiersettle, pos_shift_log)
tags:
  - schema
  - pos
  - cashier
  - shift
  - retail
aliases:
  - posconfig
  - pos_id
  - pos_period
  - poscashiersettle
  - poscashiersettle_detail
  - pos_shift_log
  - pos_log
  - pos_settle_bill_cancel
  - pos_settle_bill_discount
  - pos_settle_group_discount
  - pos_view_column
  - pos_view_table
  - pos_resource
  - bc_posdesign
  - bc_resource
sources:
  - backend/internal/application/process/pos_config.go:17
  - backend/internal/application/process/pos_config.go:63
  - backend/internal/application/process/pos_config.go:208
  - backend/internal/application/process/pos_config.go:223
  - backend/internal/application/process/pos_config.go:369
  - backend/migrations/0001_audit_schema.sql:23
  - backend/migrations/0001_audit_schema.sql:51
  - scripts/sql/02_data_schema.sql:4
  - scripts/sql/02_data_schema.sql:61
  - scripts/sql/02_data_schema.sql:74
  - scripts/sql/02_data_schema.sql:139
  - scripts/sql/02_data_schema.sql:8300
  - scripts/sql/02_data_schema.sql:8314
  - scripts/sql/02_data_schema.sql:8373
  - scripts/sql/02_data_schema.sql:8380
  - scripts/sql/02_data_schema.sql:8397
  - scripts/sql/02_data_schema.sql:8415
  - scripts/sql/02_data_schema.sql:8450
  - scripts/sql/02_data_schema.sql:8468
  - scripts/sql/02_data_schema.sql:8889
---

# ตารางตั้งค่าจุดขาย กะแคชเชียร์ และการส่งเงิน POS (`posconfig`, `pos_id`, `pos_period`, `poscashiersettle`, `pos_shift_log`)

กลุ่มตารางหลักสำหรับจุดขายหน้าร้าน (POS) ทั้งแบบ Legacy (`02_data_schema.sql`) และส่วนขยายบนเว็บ/Flutter POS (`pos_config.go`, `0001_audit_schema.sql`) ครอบคลุมการตั้งค่าชุดโปรไฟล์ร้าน เครื่องแคชเชียร์ รอบกะการทำงาน เอกสารรับเงินทอน/นำส่งเงินปิดกะ และบันทึกการยกเลิก/ส่วนลดประจำกะ ส่วนรายการบิลขายจริงถูกบันทึกใน `ic_trans` และ `ic_trans_detail` (`trans_flag = 44`, `is_pos = 1`) ในระบบหลัก ([[schema-overview]])

> สำหรับตารางตั้งค่า Thai QR PromptPay ประจำจุดขาย (`erp_thai_qr_config` ใน `pos_config.go:107`) ดูโครงสร้างตารางตระกูล `erp_*` ผ่าน [[schema-overview]]

---

## 1. ภาพรวมตารางในกลุ่มตั้งค่าและกะแคชเชียร์ POS

| ตาราง | Primary Key / Unique Key | วัตถุประสงค์หลัก | ที่มา DDL |
| :--- | :--- | :--- | :--- |
| `posconfig` | `roworder`, `pos_config_number` (`UNIQUE`) | ชุดโปรไฟล์การตั้งค่าระบบ POS (ภาษี, ปัดเศษ, ส่วนลดสมาชิก, หัว/ท้ายสลิป) | `pos_config.go:17`, `02_data_schema.sql:74` |
| `pos_id` | `roworder`, `machinecode` (`UNIQUE`) | ทะเบียนเครื่อง POS, รูปแบบเลขที่เอกสาร ใบกำกับอย่างย่อ/เต็ม, คลังตัดสต็อก, พอร์ตอุปกรณ์ | `pos_config.go:63`, `02_data_schema.sql:139` |
| `pos_period` | `roworder`, `period_guid` (`UNIQUE`) | รอบเปิด-ปิดกะการทำงานของแต่ละเครื่อง POS และยอดเงินทอนเปิดกะ | `pos_config.go:208`, `02_data_schema.sql:8314` |
| `poscashiersettle` | `roworder`, `docno` (`UNIQUE`) | เอกสารรับเงินเปิดกะ (`trans_type = 1`) และนำส่งเงินปิดกะ (`trans_type = 2`) | `pos_config.go:223`, `02_data_schema.sql:4` |
| `poscashiersettle_detail` | `roworder` (`SERIAL NOT NULL`) | รายละเอียดธนบัตร/สกุลเงินย่อยในเอกสารส่งเงิน (`banknotes_value`, `number`) | `02_data_schema.sql:61` |
| `pos_shift_log` | `roworder`, `shift_code` (`UNIQUE`) | บันทึกสรุปกะ POS แบบ Audit (`opened_at`, `closed_at`, ยอดขายแยกช่องทาง, ผลต่างลิ้นชัก) | `0001_audit_schema.sql:51` |
| `pos_settle_bill_cancel` | `roworder` (`SERIAL NOT NULL`) | รายการบิลยกเลิกที่สรุปเข้าเอกสารปิดกะ POS | `02_data_schema.sql:8380` |
| `pos_settle_bill_discount` | `roworder` (`SERIAL NOT NULL`) | รายการส่วนลดท้ายบิลที่สรุปเข้าเอกสารปิดกะ POS | `02_data_schema.sql:8397` |
| `pos_settle_group_discount` | `roworder` (`SERIAL NOT NULL`) | สรุปส่วนลดแยกกลุ่มโปรโมชั่นท้ายกะ POS | `02_data_schema.sql:8415` |
| `pos_log` | `roworder` (`SERIAL NOT NULL`) | Log การสั่งงานแคชเชียร์/ผู้จัดการอนุมัติ (`approve_code`, `command_type`) | `02_data_schema.sql:8300` |
| `pos_view_table`, `pos_view_column` | `roworder` (`SERIAL NOT NULL`) | กำหนดตารางและคอลัมน์แสดงผลบนหน้าจอ POS | `02_data_schema.sql:8468`, `8450` |
| `pos_resource` | `roworder` (`SERIAL NOT NULL`) | ตารางเก็บ Resource พื้นฐานของระบบ POS | `02_data_schema.sql:8373` |
| `bc_resource` | `roworder` (`SERIAL PRIMARY KEY`) | คำแปลข้อความ UI หลายภาษา (`code`, `name_1`–`name_6`) สำหรับระบบ POS/ERP | `pos_config.go:369` |
| `bc_posdesign` | `roworder` (`SERIAL NOT NULL`) | แบบผังหน้าจอ POS (`screen_code`, `screen_name`, `screen_data bytea`, `guid_code`) | `02_data_schema.sql:8889` |

---

## 2. โครงสร้างตารางสำคัญและการผสานสคีมา Legacy + Modern Go

### `posconfig` — โปรไฟล์ตั้งค่าจุดขาย
ตารางนี้ถูกปรับให้ทันสมัยใน `pos_config.go:17-62` (สอดคล้องกับ `0001_audit_schema.sql:23-49`) และสร้าง Unique Index `idx_posconfig_number_uq` บน `(pos_config_number)`:

| คอลัมน์ | ชนิดข้อมูล (`pos_config.go` vs Legacy `02_data_schema.sql`) | ค่าเริ่มต้น / ความหมาย |
| :--- | :--- | :--- |
| `roworder` | `SERIAL PRIMARY KEY` | ลำดับแถว |
| `pos_config_number` | `VARCHAR(50) UNIQUE NOT NULL` (เดิม `smallint`) | รหัสชุดตั้งค่า POS ที่ `pos_id.pos_config_number` อ้างถึง |
| `shop_name`, `branch_name`, `tax_id`, `pos_terminal_no` | `VARCHAR(255)` / `VARCHAR(30)` / `VARCHAR(50)` *(เพิ่มใหม่ใน Go/Audit)* | ชื่อร้าน ชื่อสาขา เลขประจำตัวผู้เสียภาษี และเลขเครื่อง POS กรมสรรพากร |
| `cust_code_default`, `cust_code_default_pos` | `VARCHAR(50)` (`'AR0001'`), `smallint` | รหัสลูกค้าเริ่มต้นสำหรับลูกค้าหน้าร้าน (Walk-in) |
| `is_member`, `member_discount` | `INT DEFAULT 1`, `NUMERIC(18,2) DEFAULT 5.00` (เดิม `varchar(10)`) | เปิดใช้ระบบสมาชิกและอัตราส่วนลดสมาชิก (%) |
| `max_pos_money` / `maxposmoney` | `NUMERIC(18,2) DEFAULT 50000.00` (`pos_config.go`) / `maxposmoney` (`02_data_schema.sql:82`) | วงเงินสดสูงสุดในลิ้นชัก (ข้อควรระวัง: ชื่อคอลัมน์ต่างกันมี `_` และไม่มี `_`) |
| `round_change_decimal` / `roundchangedecimal`, `format_round` / `formatround` | `INT DEFAULT 0` (`pos_config.go`) / `roundchangedecimal`, `formatround` (`02_data_schema.sql:83-84`) | การปัดเศษเงินทอน |
| `vat_type`, `vat_rate`, `service_charge_rate` | `INT DEFAULT 1`, `NUMERIC(18,2) DEFAULT 7.00`, `NUMERIC(18,2) DEFAULT 0.00` | ประเภทภาษีขาย, อัตรา VAT (%), อัตราค่าบริการร้านอาหาร (%) |
| `pos_header`, `pos_footer` | `TEXT` (เดิม `varchar(1000)`) | ข้อความหัวใบเสร็จและท้ายใบเสร็จ |
| `pos_bill_type` | `INT DEFAULT 0` (เดิม `varchar(1000)`) | รูปแบบใบเสร็จ POS |
| `pos_change_price_config`, `pos_change_discount_config`, `pos_cancel_bill` | `INT DEFAULT 1` (`smallint` ใน Legacy) | สิทธิ์/ข้อกำหนดการแก้ราคา แก้ส่วนลด และการยกเลิกบิล |
| `show_tax_detail`, `barcode_picture`, `check_float_money` | `INT DEFAULT 1` (`smallint` ใน Legacy) | แสดงรายละเอียดภาษี พิมพ์รูปบาร์โค้ด และตรวจสอบเงินทอน |
| คอลัมน์ Legacy เฉพาะ `02_data_schema.sql:95-135` | `smallint`, `varchar`, `numeric` | `pos_cancel_bill_other_date`, `warning_not_open_period`, `pos_close_discount_bill`, `drawer_codes`, `balance_control`, `print_item_set_detail`, `pos_multilanguage_slip`, `pos_show_total_balance`, `printer_manual_feed`, `warning_select_cust`, `pos_check_send_money`, `pos_send_deposit_money`, `disable_cancel_order_outshift`, กลุ่มตั้งค่าเครื่องชั่งบาร์โค้ด (`weight_scale_prefix`, `weight_prefix_start/stop`, `weight_ic_code_start/stop`, `weight_price_start/stop`, `weight_qty_start/stop`, `weight_scale_price_digit_power`), `pos_bill_credit_type`, `use_item_set`, `no_print_slip`, `check_status_drawer`, `check_remove_item`, `lock_edit_order`, `point_member_only`, `check_member_expire`, `print_sale_daily_item`, `show_item_location_on_only`, `change_money_currency`, `disable_sale_no_price`, `max_change_money`, `select_credit_type_only` |

---

### `pos_id` — ทะเบียนเครื่อง POS และรูปแบบเลขที่เอกสาร
* **Unique Index**: `idx_pos_id_machinecode_uq` บน `(machinecode)` (`pos_config.go:106`)
* **คอลัมน์สำคัญ**:
  * `machinecode` (`VARCHAR(50) UNIQUE NOT NULL`), `pos_id` (`VARCHAR(50)`), `machine_name` (`VARCHAR(150)`), `status` (`INT DEFAULT 1`), `pos_config_number` (`VARCHAR(50) DEFAULT 'POS-CFG-01'`), `price_number` (`INT DEFAULT 1`)
  * `doc_format` (`'ABB-@YY@MM-#####'`), `doc_format_vat_full` (`'TAX-@YY@MM-#####'`), `doc_format_cancel` (`'CNM-@YY@MM-#####'`), `doc_format_fillmoney` (`'RCV-@YY@MM-#####'`), `doc_format_cashiersettle` (`'SND-@YY@MM-#####'`) — และใน `02_data_schema.sql:165-184` มีรูปแบบมัดจำ/ขายเชื่อเพิ่มเติม (`doc_format_deposit`, `doc_format_deposit_return`, `doc_format_credit`, `doc_running_*`, `doc_format_code_*`)
  * `pos_ic_wht` (`VARCHAR(50) DEFAULT 'MMA01'`), `pos_ic_shelf` (`VARCHAR(50) DEFAULT 'SH-01'`), `branch_code`, `department_code` — **ข้อสังเกต**: แม้ชื่อคอลัมน์ Legacy จะชื่อ `pos_ic_wht` แต่ค่าจริงเก็บ **รหัสคลังสินค้า (Warehouse Code)** สำหรับตัดสต็อกของเครื่อง POS นั้น
  * `pos_type_invoice` (`INT DEFAULT 0`), `pos_save_e_journal` (`INT DEFAULT 1`), `slip_number` (`VARCHAR(50) DEFAULT 'SLIP-80MM'`), `use_credit_sale` (`INT DEFAULT 1`)
  * อุปกรณ์ต่อพ่วง (`pos_config.go:86-93`): `printer_name`, `customer_display`, `cash_drawer_enabled`, `weight_scale_prefix` (`'20,21'`), `weight_scale_mode` (`'WEIGHT_KG'`), `edc_serial_port`, `usb_qr_serial_port`, `payment_webhook_mode` (`'PROMPTPAY_QR'`)
  * คอลัมน์ BCEL (`02_data_schema.sql:186-187`): `bcel_mcid`, `bcel_mcc`

---

### `pos_period`, `poscashiersettle`, `poscashiersettle_detail` และ `pos_shift_log`

1. **`pos_period` — รอบเปิด-ปิดกะแคชเชียร์** (`pos_config.go:208`, `02_data_schema.sql:8314`, Unique Index `idx_pos_period_guid_uq`):
   * `period_guid` (`VARCHAR(64) UNIQUE NOT NULL`), `machine_code` (`VARCHAR(50)`), `begin_date`, `begin_time`, `end_date`, `end_time`, `begin_user_code`, `end_user_code`, `float_amount` (`NUMERIC(18,2) DEFAULT 0` — เงินทอนตั้งต้นเปิดกะ)
   * `period_status` (`INT DEFAULT 0`): **`0` = เปิดกะอยู่ (OPEN)**, **`1` = ปิดกะแล้ว (CLOSED)** (ยืนยันจาก `pos_config.go:1057, 1121`)

2. **`poscashiersettle` — เอกสารรับเงินเปิดกะ / ส่งเงินปิดกะ** (`pos_config.go:223`, `02_data_schema.sql:4`, Unique Index `idx_poscashiersettle_docno_uq`):
   * `docno` (`VARCHAR(64) UNIQUE NOT NULL`), `docdate` (`TIMESTAMP`), `doc_time`, `cashiercode`, `machinecode`, `pos_id`, `branch_code`
   * ยอดตามช่องทางรับเงิน: `cashamount`, `creditcardamount`, `coupongamount` *(สะกด `coupongamount` ตามตารางจริง)*, `chqamount`, `transferamount` (`NUMERIC(18,2)`)
   * `trans_type` (`INT DEFAULT 1`): **`1` = รับเงิน/เงินทอนเปิดกะ** (บันทึกทั้ง `total_in` และ `total_amount` ใน `pos_config.go:1066-1071`), **`2` = นำส่งเงินขาย/ปิดกะ** (บันทึก `total_out` ใน `pos_config.go:1131-1135`)
   * ยอดรวมใน `02_data_schema.sql:19-57`: `manager_code`, `total_amount`, `total_cancel`, `total_balance`, `total_diff`, `total_credit_card`, `total_coupon`, `total_cash`, `total_sum`, `sum_amount`, `total_in`, `total_out`, `begin_date/time/user_code`, `end_date/time/user_code`, `total_out_credit`, `total_out_coupon`, `guid_code`, `total_point`, `total_advance`, `total_after_advance`, `deposit_cash_amount`, `deposit_credit_amount`, `deposit_return_cash_amount`, `sale_credit_amount`, `order_amount`, `total_credit_charge`, `total_service_amount`, `total_vat_amount`, `transfer_amount`, `wallet_amount`, `total_currency_amount`, `total_currency_charge_amount`

3. **`poscashiersettle_detail`** (`02_data_schema.sql:61`): `bill_number`, `banknotes_value`, `number`, `currency`, `rate`, `total_amount` *(ทุกคอลัมน์ใน Legacy เป็น `character varying(255)` หากคำนวณให้กรองเฉพาะค่าที่เป็นตัวเลขด้วย regex ก่อน Cast เป็น `NUMERIC`)*

4. **`pos_shift_log`** (`0001_audit_schema.sql:51`): `shift_code` (`VARCHAR(60) UNIQUE NOT NULL`), `pos_config_number`, `cashier_code`, `cashier_name`, `opened_at`, `closed_at`, `open_float_amount`, `cash_sales_amount`, `qr_sales_amount`, `card_sales_amount`, `credit_sales_amount`, `cash_in_amount`, `cash_out_amount`, `expected_drawer_cash`, `counted_drawer_cash`, `diff_amount`, `bill_count`, `shift_status` (`'OPEN'`), `remark`

5. **ตารางสรุปบิลยกเลิก/ส่วนลดท้ายกะ** (`02_data_schema.sql:8380-8428`):
   * `pos_settle_bill_cancel`: `doc_no`, `doc_date`, `doc_time`, `pos_id`, `ref_doc_no`, `ref_doc_date`, `ref_amount`, `period_guid`, `invoice_doc_no`, `invoice_doc_date`
   * `pos_settle_bill_discount`: `doc_no`, `doc_date`, `doc_time`, `pos_id`, `ref_doc_no`, `ref_doc_date`, `sum_amount`, `discount_amount`, `total_amount`, `period_guid`, `discount_item`
   * `pos_settle_group_discount`: `doc_no`, `doc_date`, `doc_time`, `pos_id`, `discount_group_code`, `discount_group_amount`, `discount_group_discount`, `line_number`

---

## 3. รูปแบบการ JOIN และคำสั่ง SELECT พร้อมใช้งาน

* `pos_id.pos_config_number = posconfig.pos_config_number`
* `pos_period.machine_code = pos_id.machinecode`
* `poscashiersettle.machinecode = pos_id.machinecode`
* บิลขาย POS เชื่อมผ่าน `ic_trans` โดยกรอง `trans_flag = 44 AND COALESCE(is_pos, 0) = 1 AND COALESCE(last_status, 0) = 0` ([[schema-overview]])

```sql
-- ตรวจสอบเครื่อง POS ที่กำลังเปิดกะอยู่ พร้อมตั้งค่าคลังตัดสต็อกและโปรไฟล์ POS
SELECT
    pid.machinecode,
    pid.pos_id,
    pid.machine_name,
    pid.branch_code,
    pid.pos_ic_wht AS default_wh_code,
    pid.pos_ic_shelf AS default_shelf_code,
    cfg.shop_name,
    cfg.vat_type,
    cfg.vat_rate::NUMERIC(18,2) AS vat_rate,
    pr.period_guid,
    pr.begin_date,
    pr.begin_time,
    pr.begin_user_code,
    COALESCE(pr.float_amount, 0)::NUMERIC(18,2) AS open_float_amount
FROM pos_id pid
LEFT JOIN posconfig cfg
    ON cfg.pos_config_number::text = pid.pos_config_number::text
LEFT JOIN pos_period pr
    ON pr.machine_code = pid.machinecode
   AND pr.period_status = 0
WHERE pid.status = 1
ORDER BY pid.machinecode ASC;
```

```sql
-- สรุปยอดรับเงินเปิดกะ (trans_type = 1) และนำส่งเงินปิดกะ (trans_type = 2) รายวันแยกตามเครื่อง
SELECT
    docdate::date AS settle_date,
    machinecode,
    cashiercode,
    trans_type,
    CASE trans_type
        WHEN 1 THEN 'รับเงินเปิดกะ'
        WHEN 2 THEN 'นำส่งเงินปิดกะ'
        ELSE 'อื่นๆ'
    END AS trans_type_label,
    COALESCE(cashamount, 0)::NUMERIC(18,2) AS cash_amount,
    COALESCE(creditcardamount, 0)::NUMERIC(18,2) AS card_amount,
    COALESCE(coupongamount, 0)::NUMERIC(18,2) AS coupon_amount,
    COALESCE(transferamount, 0)::NUMERIC(18,2) AS transfer_amount,
    COALESCE(total_amount, 0)::NUMERIC(18,2) AS total_amount
FROM poscashiersettle
ORDER BY docdate DESC, roworder DESC
LIMIT 100;
```
