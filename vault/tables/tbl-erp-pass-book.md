---
title: "erp_pass_book — สมุดเงินฝาก/บัญชีธนาคารของบริษัท"
tags: [tables, erp, bank, cb, gl, company-db]
aliases: ["erp_pass_book", "สมุดเงินฝาก", "สมุดบัญชีธนาคาร", "pass_book_code", "บัญชีธนาคาร"]
sources: ["backend/internal/application/process/gl_template.go:195", "backend/internal/application/process/service.go:1794", "backend/internal/application/process/cheque_forward.go:42", "backend/internal/application/process/trans.go:1513", "backend/internal/application/process/report_menu_cb.go:162", "backend/internal/application/process/report_menu_singha.go:1030"]
---

# erp_pass_book — สมุดเงินฝาก

ทะเบียนบัญชีธนาคาร/สมุดเงินฝากของบริษัท (Company DB) ผูกกับบัญชี GL สองบัญชีและธนาคาร ใช้เป็นปลายทาง/ต้นทางของเอกสารเงินฝาก-ถอน-โอน-เช็ค ตารางเดิม (legacy)

## คอลัมน์ที่โค้ดใช้
| คอลัมน์ | ความหมายตามโค้ด | ที่มา |
|---|---|---|
| `code` | รหัสสมุดเงินฝาก | ทุกที่ |
| `name_1` | ชื่อ | report_menu_cb.go |
| `bank_code` | → `erp_bank.code` | trans.go:1513-1525 (ตั้ง bank_code ตั้งต้นให้รายการ `cb_trans_detail`) |
| `bank_branch` | สาขาธนาคาร (ไม่ชัดจากโค้ดว่าเป็น FK ไป `erp_bank_branch`) | trans.go:1513 |
| `book_number` | เลขที่บัญชี | report_menu_cb.go |
| `account_code_1`, `account_code_2` | บัญชี GL ของสมุดนี้ (สองบัญชี — ใช้ตัวแทนบัญชีธนาคารในเทมเพลต GL; รายละเอียดว่าตัวไหนใช้เมื่อไรดู `glSQLPassBook`) | gl_template.go:195, service.go:1794-1811 |

## ความสัมพันธ์ / การใช้
- เอกสารอ้างผ่าน `ic_trans.pass_book_code`, `cb_trans_detail.pass_book_code`; เอกสารโอนเงินเก็บรหัสสมุดไว้ใน `ic_trans_detail.item_code`
- เทมเพลต GL ดึงบัญชีธนาคารจากตารางนี้ผ่านตัวแทน `&ACCBANK…&` ([[acc-gl-template-engine]], [[tbl-erp-doc-format-gl]])
- เช็คล่วงหน้า/ฝากเช็ค: cheque_forward.go:42-43 ([[acc-cheque-transfer]])
- รายงานเงินฝาก/ธนาคาร: report_menu_cb.go:162-166/785 (`cbmPassbookCTE`), report_menu_singha.go:1030
- หน้าจอ master เขียนตารางนี้ผ่าน `/query/exec` ตาม legacy write allow-list (ADR-0011)

## ลิงก์
[[tbl-erp-bank]] · [[acc-cheque-transfer]] · [[acc-payment-tab]] · [[tbl-group-erp]]

## ที่มาในโค้ด

- `backend/internal/application/process/gl_template.go:195`
- `backend/internal/application/process/service.go:1794`
- `backend/internal/application/process/cheque_forward.go:42`
- `backend/internal/application/process/trans.go:1513`
- `backend/internal/application/process/report_menu_cb.go:162`
- `backend/internal/application/process/report_menu_singha.go:1030`
