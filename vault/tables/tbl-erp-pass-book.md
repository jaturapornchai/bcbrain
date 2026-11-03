---
title: "erp_pass_book — สมุดเงินฝาก/บัญชีธนาคารของบริษัท"
tags: [tables, erp, bank, cb, gl, company-db]
aliases: ["erp_pass_book", "สมุดเงินฝาก", "สมุดบัญชีธนาคาร", "pass_book_code", "บัญชีธนาคาร"]
sources: ["backend/internal/application/process/gl_template.go:195", "backend/internal/application/process/gl_template.go:479", "backend/internal/application/process/service.go:1806", "backend/internal/application/process/cheque_forward.go:42", "backend/internal/application/process/trans.go:1513", "backend/internal/application/process/report_menu_cb.go:161", "backend/internal/application/process/report_menu_cb.go:749", "backend/internal/application/process/report_menu_singha.go:1030", "backend/internal/domain/query/write_policy_legacy.go:20", "scripts/sql/02_data_schema.sql:3532"]
---

# erp_pass_book — สมุดเงินฝาก

ทะเบียนบัญชีธนาคาร/สมุดเงินฝากของบริษัท (Company DB) ผูกกับบัญชี GL สองบัญชีและธนาคาร ใช้เป็นปลายทาง/ต้นทางของเอกสารเงินฝาก-ถอน-โอน-เช็ค นิยามตาราง (DDL) อยู่ใน `scripts/sql/02_data_schema.sql:3532-3559` โค้ด Go ไม่ได้สร้างตารางนี้

## คอลัมน์ที่โค้ดใช้
| คอลัมน์ | ความหมายตามโค้ด | ที่มา |
|---|---|---|
| `code` | รหัสสมุดเงินฝาก varchar(25) — คีย์ที่เอกสารอ้างถึง | gl_template.go:195; 02_data_schema.sql:3536 |
| `name_1` | ชื่อบัญชี/สมุด varchar(100) | report_menu_cb.go:161-163; report_menu_singha.go:1030-1035 |
| `bank_code` | → `erp_bank.code` — ใส่เป็นรหัสธนาคารตั้งต้นให้รายการ `cb_trans_detail` เมื่อไม่ได้ส่งมา | trans.go:1513, 1524; cheque_forward.go:42; report_menu_cb.go:165-167 (JOIN `erp_bank`) |
| `bank_branch` | สาขาธนาคาร varchar(100) (เป็นข้อความ ไม่ชัดจากโค้ดว่าอ้างไป `erp_bank_branch`) ใส่เป็นค่าตั้งต้นของรายการ `cb_trans_detail` เมื่อไม่ได้ส่งมา | trans.go:1514, 1525; cheque_forward.go:43 |
| `book_number` | เลขที่บัญชี varchar(25) | report_menu_cb.go:792; report_menu_singha.go:1034 |
| `account_code_1`, `account_code_2` | บัญชี GL ของสมุดนี้ (สองบัญชี) — เทมเพลต GL: `&ACCBANK1&` ใช้ `account_code_1`, `&ACCBANK2&` ใช้ `account_code_2` (คิวรี `glSQLPassBook`) ส่วนการลงบัญชีมาตรฐานของ GL ใช้เฉพาะ `account_code_1` เป็นบัญชีธนาคาร | gl_template.go:195, 479-490; service.go:1806-1820 |

คอลัมน์อื่นใน DDL (`book_type`, `tax_number`, `name_2`, `remark`, `status`, `chq_fee_rate*`, `min_chq_fee_*`, `max_chq_fee_*`, `mobile_use`, `currency_code`, `singhaonline_use`) ไม่พบโค้ด Go ที่อ่านหรือเขียน (02_data_schema.sql:3532-3559)

## ความสัมพันธ์ / การใช้
- เอกสารอ้างผ่าน `ic_trans.pass_book_code`, `cb_trans_detail.pass_book_code`; เอกสารโอนเงินเก็บรหัสสมุดไว้ใน `ic_trans_detail.item_code` (service.go:1806-1815 หาสมุดจากสามที่นี้ตามลำดับ)
- เทมเพลต GL ดึงบัญชีธนาคารจากตารางนี้ผ่านตัวแทน `&ACCBANK…&` (gl_template.go:479-501) ถ้าเป็นเช็ค `&ACCBANK1&` อ่านจากสมุดที่อยู่ใน `trans_number` และ `&ACCBANK2&` อ่านจาก `pass_book_code` (gl_template.go:595-610) ([[acc-gl-template-engine]], [[tbl-erp-doc-format-gl]])
- เช็คล่วงหน้า/ฝากเช็ค: cheque_forward.go:42-43 ([[acc-cheque-transfer]])
- รายงานเงินฝาก/ธนาคาร: ชื่อสมุดและชื่อธนาคาร (report_menu_cb.go:161-167), ยอดเคลื่อนไหวและยอดคงเหลือของแต่ละสมุด `cbmPassbookCTE` (report_menu_cb.go:749-790), ทะเบียนสมุดเงินฝาก (report_menu_singha.go:1030-1037)
- หน้าจอ master เขียนตารางนี้ผ่าน `/query/exec` เพราะอยู่ใน legacy write allow-list (domain/query/write_policy_legacy.go:20; ADR-0011)

## ลิงก์
[[tbl-erp-bank]] · [[acc-cheque-transfer]] · [[acc-payment-tab]] · [[tbl-group-erp]]

## ที่มาในโค้ด

- `backend/internal/application/process/gl_template.go:195` คิวรีบัญชี GL ของสมุด
- `backend/internal/application/process/gl_template.go:479` ตัวแทน `&ACCBANK1&` / `&ACCBANK2&`
- `backend/internal/application/process/service.go:1806` หาสมุดและบัญชีธนาคารตอนสร้าง GL มาตรฐาน
- `backend/internal/application/process/cheque_forward.go:42` ค่าตั้งต้นธนาคาร/สาขาของรายการเช็ค
- `backend/internal/application/process/trans.go:1513` ค่าตั้งต้นธนาคาร/สาขาของ `cb_trans_detail`
- `backend/internal/application/process/report_menu_cb.go:161` ชื่อสมุด/ธนาคารในรายงาน
- `backend/internal/application/process/report_menu_cb.go:749` `cbmPassbookCTE` ยอดเคลื่อนไหวต่อสมุด
- `backend/internal/application/process/report_menu_singha.go:1030` ทะเบียนสมุดเงินฝาก
- `backend/internal/domain/query/write_policy_legacy.go:20` allow-list การเขียน
- `scripts/sql/02_data_schema.sql:3532` นิยามตาราง `erp_pass_book`
