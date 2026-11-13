---
title: สกุลเงิน อัตราแลกเปลี่ยน ธนาคาร สมุดบัญชี และ Thai QR — erp_currency / erp_exchange_rate / erp_pass_book
tags: [dev, schema, erp, currency, fx, bank, passbook, qr]
aliases: [erp_currency, erp_exchange_rate, erp_bank, erp_bank_branch, erp_pass_book, erp_pass_book_type, erp_book_bank_trans_type, erp_wallet_list, erp_thai_qr_config, สกุลเงิน, สมุดเงินฝาก]
sources:
  - scripts/sql/02_data_schema.sql:2518-2564
  - scripts/sql/02_data_schema.sql:2761-2777
  - scripts/sql/02_data_schema.sql:2885-2904
  - scripts/sql/02_data_schema.sql:3532-3579
  - scripts/sql/02_data_schema.sql:3746-3771
  - scripts/sql/02_data_schema.sql:3991-4008
  - backend/internal/application/process/fx.go:344-365
---

# สกุลเงิน อัตราแลกเปลี่ยน ธนาคาร สมุดเงินฝาก และ Thai QR (`erp_currency`, `erp_pass_book`)

กลุ่มตารางมาสเตอร์การเงินระดับ ERP สำหรับระบบหลายสกุลเงิน (`multi_currency = 1`), รายชื่อธนาคารและสาขา, ทะเบียนสมุดบัญชีเงินฝากธนาคาร (เชื่อม `account_code_1` เข้าผังบัญชี GL), กระเป๋าเงินอิเล็กทรอนิกส์ และ PromptPay Thai QR ดูภาพรวมโครงสร้างทั้งหมดได้ที่ [[schema-overview]]

---

## 1. สกุลเงินและอัตราแลกเปลี่ยน (`erp_currency`, `erp_exchange_rate`)

| ตาราง | Index | คอลัมน์สำคัญและบทบาท |
|---|---|---|
| `erp_currency` | `idx_erp_currency_code` | `code` (`varchar(25)`: รหัสสกุลเงิน เช่น `THB`, `USD`), `name_1` / `name_2`, `symbol` (`varchar(25)`), `exchange_rate_present` (`numeric`: อัตราแลกเปลี่ยนปัจจุบันที่ใช้เป็นค่าเริ่มต้นตอนเปิดเอกสารใน `fx.go:360`), `status` (`smallint`: `0 = ใช้งาน`) |
| `erp_exchange_rate` | `idx_erp_exchange_rate_code` | `code`, `name_1` / `name_2`, `country`, `sign`, `import` (`numeric`: อัตราซื้อ/นำเข้า), `export` (`numeric`: อัตราขาย/ส่งออก), `bank` (`varchar(10)`), `status` |

---

## 2. ธนาคารและสมุดบัญชีเงินฝาก (`erp_bank`, `erp_bank_branch`, `erp_pass_book*`, `erp_book_bank_trans_type`)

### `erp_pass_book` — ทะเบียนสมุดเงินฝากธนาคาร
- **Index**: `idx_erp_pass_book_code` ON `("code")` (ไม่มี SQL PK; ใช้ `roworder serial`)

| คอลัมน์ | ชนิดข้อมูล | ความหมาย |
|---|---|---|
| `code` | `varchar(25)` | รหัสสมุดเงินฝาก (อ้างอิงจากเอกสารเงินโอน/รับ-จ่ายธนาคาร เช่น `item_code` / `item_code_2`) |
| `bank_code` | `varchar(25)` | รหัสธนาคาร เชื่อม `erp_bank.code` |
| `bank_branch` | `varchar(100)` | ชื่อหรือรหัสสาขาธนาคาร |
| `book_type` | `varchar(25)` | ประเภทสมุดบัญชี (ออมทรัพย์ กระแสรายวัน ประจำ) เชื่อม `erp_pass_book_type.code` |
| `book_number` | `varchar(25)` | เลขที่บัญชีธนาคาร |
| `name_1`, `name_2` | `varchar(100)` / `varchar(200)` | ชื่อบัญชีเงินฝาก |
| `account_code_1`, `account_code_2` | `varchar(25)` | **รหัสผังบัญชี GL หลัก** (`account_code_1`) และสำรอง/เช็คสำหรับลงบัญชีอัตโนมัติ |
| `currency_code` | `varchar(25)` | สกุลเงินของบัญชี เชื่อม `erp_currency.code` |
| `chq_fee_rate`, `chq_fee_rate_amount`, `min_chq_fee_*`, `max_chq_fee_*` | `numeric` | อัตราและขั้นต่ำ-ขั้นสูงของค่าธรรมเนียมเรียกเก็บเช็ค |
| `mobile_use`, `singhaonline_use`, `status` | `integer` / `smallint` | สถานะใช้งานบน Mobile และสถานะเปิด/ปิด (`0 = ใช้งาน`) |

### ตารางธนาคารและประเภทรายการประกอบ

| ตาราง | Index | คอลัมน์สำคัญ |
|---|---|---|
| `erp_bank` | `idx_erp_bank_code` | `code`, `name_1`, `name_2`, `chq_income_account_code` (ผังบัญชีสำหรับเช็ค/รายได้), `status` |
| `erp_bank_branch` | `idx_erp_bank_branch_code` | `code`, `name_1`, `name_2`, `bank_code` (อ้าง `erp_bank.code`), `status` |
| `erp_pass_book_type` | `idx_erp_pass_book_type_code` | `code`, `name_1`, `name_2`, `remark`, `status` |
| `erp_book_bank_trans_type` | `idx_erp_book_bank_trans_type_code` | `code`, `name_1`, `name_2`, `status` — รหัสประเภทรายการเคลื่อนไหว Statement ธนาคาร |

---

## 3. กระเป๋าเงินอิเล็กทรอนิกส์และ Thai QR (`erp_wallet_list`, `erp_thai_qr_config`)

| ตาราง | Index / Key | คอลัมน์สำคัญและบทบาท |
|---|---|---|
| `erp_wallet_list` | `idx_erp_wallet_list_code`, `idx_erp_wallet_list_account_code` | `code`, `name_1`, `name_2`, `account_code` (รหัสผังบัญชี GL), `credit_period` (`smallint`), `status` |
| `erp_thai_qr_config` | ไม่มี SQL PK (`roworder serial`) | `promp_pay_telephone_number` *(สะกดตาม DDL)*, `promp_pay_wallet_id`, `merchant_name`, `service_code`, `company_biller_id`, `company_terminal_id`, `company_store_id`, `config_type` (`smallint`), `pos_id`, `ref_1_format`, `ref_2_format`, `prompt_pay_book_code` (เชื่อม `erp_pass_book.code`) |

---

## ตัวอย่าง SQL ใช้งานจริง

```sql
-- 1) รายชื่อสมุดเงินฝากธนาคารที่เปิดใช้งาน พร้อมชื่อธนาคารและผังบัญชี GL
SELECT pb.code AS book_code,
       pb.book_number,
       pb.name_1 AS book_name,
       b.name_1 AS bank_name,
       bt.name_1 AS book_type_name,
       pb.account_code_1 AS gl_account_code,
       COALESCE(NULLIF(pb.currency_code, ''), 'THB') AS currency_code
FROM erp_pass_book pb
LEFT JOIN erp_bank b ON b.code = pb.bank_code
LEFT JOIN erp_pass_book_type bt ON bt.code = pb.book_type
WHERE COALESCE(pb.status, 0) = 0
ORDER BY pb.code;

-- 2) อ่านอัตราแลกเปลี่ยนปัจจุบันของสกุลเงินที่เปิดใช้งาน
SELECT code, name_1, symbol, exchange_rate_present
FROM erp_currency
WHERE COALESCE(status, 0) = 0
ORDER BY code;
```
