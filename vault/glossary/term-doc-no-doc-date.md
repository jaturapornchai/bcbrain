---
title: "เลขที่เอกสาร วันที่เอกสาร และรหัสรูปแบบ (doc_no / doc_date / doc_format_code)"
tags: [glossary, document, numbering]
aliases: ["doc_no", "docNo", "เลขที่เอกสาร", "เลขที่", "doc_date", "docDate", "วันที่เอกสาร", "doc_time", "เวลา", "doc_format_code", "รหัสเอกสาร", "รหัสรูปแบบ", "รูปแบบเลขที่เอกสาร", "erp_doc_format", "เลขรัน", "running number", "@YYMM-####", "nextDocNo"]
sources: ["frontend/account/transaction/TransTopForm.tsx:164", "frontend/account/transaction/TransTopForm.tsx:174", "frontend/account/transaction/TransTopForm.tsx:188", "frontend/account/transaction/TransTopForm.tsx:215", "backend/internal/application/process/trans.go:107", "backend/internal/application/process/trans.go:657", "backend/internal/application/process/doc_cancel.go:388", "backend/internal/application/process/doc_no_next.go:1", "frontend/account/master/DocFormatScreen.tsx:960", "frontend/src/config/bcMenu.json:180"]
---

# เลขที่เอกสาร / วันที่เอกสาร / รหัสเอกสาร

## ในระบบนี้คืออะไร
หัวเอกสารทุกใบมีสามช่องบนสุดตามป้ายใน `TransTopForm.tsx` ได้แก่ "วันที่เอกสาร" (`:164`), "เวลา" (`:174`) และ "เลขที่เอกสาร" (`:188`) ช่อง "รหัสเอกสาร" (`:215`) คือรหัสรูปแบบเลขที่ (`doc_format_code`) ที่ใช้รันเลขที่เอกสาร

## identifier / ตาราง / คอลัมน์
| ป้ายบนจอ | JSON | คอลัมน์ |
|---|---|---|
| วันที่เอกสาร | `docDate` | `ic_trans.doc_date` (และ `doc_date` ในตารางอื่น) |
| เวลา | `docTime` (ว่าง = 08:00, `trans.go:107`) | `doc_time` |
| เลขที่เอกสาร | `docNo` | `doc_no` |
| รหัสเอกสาร | `docFormatCode` | `doc_format_code` → `erp_doc_format.code` |
| รูปแบบ | — | `erp_doc_format.format` เช่น `@YYMM-####` |

- `nextDocNo` อ่าน `erp_doc_format.format` ค่าเริ่มต้นคือ `@YYMM-####` (`@` = รหัสรูปแบบ) แล้วรันเลขแยกตาม `trans_flag` (`doc_cancel.go:388-400`, `doc_no_next.go:1-10`)
- จอ "กำหนดรูปแบบเลขที่เอกสาร" (`menu_setup_doc_format`, bcMenu.json:180) มีคอลัมน์ รหัสรูปแบบ (`code`), รหัสจอ (`screen_code`), ชื่อ (`name_1`), รูปแบบ (`format`) (`DocFormatScreen.tsx:960-963`)
- ในบรรทัดรายการมี `doc_date_calc` และ `doc_time_calc` ซึ่งใช้เรียงลำดับเวลาตอนคำนวณสต็อก (`trans.go:692-728`)

## ข้อควรระวัง
- ปีในฐานข้อมูลเก็บเป็น ค.ศ. เสมอ การแสดง พ.ศ. เป็นเรื่องของ UI ดู [[term-buddhist-year]]
- เลขที่เอกสารของเอกสารยกเลิกเป็นเลขใหม่ ไม่ได้ใช้เลขเดิม ดู [[term-last-status-cancel-approve]]
- `doc_no` ไม่ใช่ `tax_doc_no` เลขที่ใบกำกับภาษีเป็นอีกช่องหนึ่ง ดู [[term-vat-type]]

## ลิงก์
[[tbl-erp-doc-format]] · [[proc-doc-flow-numbering]] · [[tbl-ic-trans]] · [[term-doc-ref]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/account/transaction/TransTopForm.tsx:164`, `:174`, `:188`, `:215`
- `backend/internal/application/process/trans.go:107`, `:657-688`, `:692-728`
- `backend/internal/application/process/doc_cancel.go:388-400`
- `backend/internal/application/process/doc_no_next.go:1-10`
- `frontend/account/master/DocFormatScreen.tsx:960-963`
- `frontend/src/config/bcMenu.json:180`
