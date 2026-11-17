---
title: โครงสร้างตารางธนาคาร สาขาธนาคาร และสมุดบัญชีเงินฝาก (cb_bank, cb_bank_branch, cb_book_bank)
tags: [schema, cash-bank, bank, book-bank, postgresql]
aliases: [cb_bank, cb_bank_branch, cb_book_bank, ตารางสมุดเงินฝากธนาคาร, ตารางทำเนียบธนาคาร]
sources:
  - scripts/sql/02_data_schema.sql:2059-2096
  - frontend/account/master/ThaiBankDirectoryModal.tsx:1-481
---

# โครงสร้างตารางธนาคาร สาขาธนาคาร และสมุดบัญชีเงินฝาก (`cb_bank`, `cb_bank_branch`, `cb_book_bank`)

กลุ่มตารางข้อมูลหลักของระบบการเงินและธนาคาร ใช้เก็บทำเนียบธนาคารพาณิชย์ สาขาธนาคาร และสมุดบัญชีเงินฝากของกิจการสำหรับผูกกับผังบัญชีแยกประเภท (`gl_chart_of_account`), ทะเบียนเช็ค (`cb_chq_list`), ใบฝาก–ถอน/โอนเงิน (`cb_trans`), การกระทบยอด Bank Statement และ PromptPay QR

---

## 1. ตารางทำเนียบธนาคาร (`cb_bank`)

| คอลัมน์ | ชนิดข้อมูล | ความหมาย |
|---|---|---|
| `roworder` | `SERIAL PRIMARY KEY` | ลำดับแถวอัตโนมัติ |
| `code` | `VARCHAR(100)` | รหัสธนาคาร (เช่น `KBANK`, `SCB`, `BBL`, `KTB`, `BAY`, `TTB`) |
| `name_1` / `name_2` | `VARCHAR(255)` | ชื่อธนาคารภาษาไทย (`name_1`) และภาษาอังกฤษ (`name_2`) |
| `status` | `SMALLINT` | สถานะใช้งาน (`0` = ปกติ) |
| `chq_income_account_code` | `VARCHAR(100)` | รหัสผังบัญชีเช็ครับล่วงหน้าเริ่มต้นประจำธนาคาร |
| `logo_url` | `VARCHAR(255)` | พาธรูปโลโก้ธนาคารสำหรับแสดงบน UI |

---

## 2. ตารางสาขาธนาคาร (`cb_bank_branch`)

| คอลัมน์ | ชนิดข้อมูล | ความหมาย |
|---|---|---|
| `roworder` | `SERIAL PRIMARY KEY` | ลำดับแถวอัตโนมัติ |
| `code` | `VARCHAR(100)` | รหัสสาขาธนาคาร |
| `bank_code` | `VARCHAR(100)` | รหัสธนาคารต้นสังกัด (เชื่อม `cb_bank.code`) |
| `name_1` / `name_2` | `VARCHAR(255)` | ชื่อสาขาธนาคารภาษาไทย / อังกฤษ |
| `status` | `SMALLINT` | สถานะใช้งาน |

---

## 3. ตารางสมุดบัญชีเงินฝากของกิจการ (`cb_book_bank`)

| คอลัมน์ | ชนิดข้อมูล | ความหมายและการเชื่อมโยง |
|---|---|---|
| `roworder` | `SERIAL PRIMARY KEY` | ลำดับแถวอัตโนมัติ |
| `code` | `VARCHAR(100)` | รหัสสมุดเงินฝากภายในระบบ (ใช้เป็นคีย์อ้างอิงใน `cb_trans_detail`, `cb_chq_list`, `erp_option.wallet_book_code`) |
| `bank_code` / `bank_branch` | `VARCHAR(100)` | รหัสธนาคาร (`cb_bank.code`) และรหัสสาขา (`cb_bank_branch.code`) |
| `book_type` | `VARCHAR(100)` | ประเภทบัญชีเงินฝาก (ออมทรัพย์ / กระแสรายวัน / ประจำ) |
| `book_number` | `VARCHAR(100)` | เลขที่บัญชีธนาคาร |
| `name_1` / `name_2` | `VARCHAR(255)` | ชื่อบัญชีเงินฝาก (ไทย / อังกฤษ) |
| `account_code_1` / `account_code_2` | `VARCHAR(100)` | รหัสผังบัญชีแยกประเภทหลัก (`gl_chart_of_account.code`) ที่ลงรายการเมื่อฝาก–ถอน–ผ่านเช็ค |
| `currency_code` | `VARCHAR(50)` | รหัสสกุลเงินของบัญชีเงินฝาก |
| `tax_number` / `remark` | `VARCHAR(100)` / `TEXT` | เลขประจำตัวผู้เสียภาษีและหมายเหตุ |

---

## ความสัมพันธ์ในระบบ
- [[uses_table::tbl-cb-trans]] — รายการฝาก–ถอน–โอนเงินอ้างอิงสมุดบัญชี `cb_book_bank.code`
- [[uses_table::tbl-cb-cheque-card]] — ทะเบียนเช็ครับ–เช็คจ่ายผูกสมุดบัญชีเงินฝากผ่านเช็ค
- [[uses_table::tbl-cb-bank-reconcile]] — การนำเข้า Bank Statement กระทบยอดตามสมุดเงินฝาก
- [[has_query::sql-cb-cash-bank-balance]] — ตัวอย่างคิวรีตรวจสอบยอดคงเหลือเงินฝากธนาคาร
