---
title: "เลขที่เอกสาร วันที่เอกสาร และรหัสรูปแบบ (doc_no / doc_date / doc_format_code)"
tags: [glossary, document, numbering]
aliases: ["doc_no", "docNo", "เลขที่เอกสาร", "เลขที่", "doc_date", "docDate", "วันที่เอกสาร", "doc_time", "เวลา", "doc_format_code", "รหัสเอกสาร", "รหัสรูปแบบ", "รูปแบบเลขที่เอกสาร", "erp_doc_format", "เลขรัน", "running number", "@YYMM-####", "nextDocNo"]
sources: ["frontend/account/transaction/TransTopForm.tsx:166", "frontend/account/transaction/TransTopForm.tsx:177", "frontend/account/transaction/TransTopForm.tsx:190", "frontend/account/transaction/TransTopForm.tsx:217", "backend/internal/application/process/trans.go:107", "backend/internal/application/process/trans.go:658", "backend/internal/application/process/doc_cancel.go:391", "backend/internal/application/process/doc_no_next.go:59", "frontend/account/master/DocFormatScreen.tsx:960", "frontend/src/config/bcMenu.json:179"]
---

# เลขที่เอกสาร / วันที่เอกสาร / รหัสเอกสาร

## ในระบบนี้คืออะไร
หัวเอกสารทุกใบมีสามช่องบนสุดตามป้ายใน `TransTopForm.tsx` ได้แก่ "วันที่เอกสาร" (`:166`), "เวลา" (`:177`) และ "เลขที่เอกสาร" (`:190`) ช่อง "รหัสเอกสาร" (`:217`) คือรหัสรูปแบบเลขที่ (`doc_format_code`) ที่ใช้รันเลขที่เอกสาร แสดงเป็นช่องอ่านอย่างเดียวเมื่อมีค่า

## identifier / ตาราง / คอลัมน์
| ป้ายบนจอ | JSON | คอลัมน์ |
|---|---|---|
| วันที่เอกสาร | `docDate` | `ic_trans.doc_date` (และ `doc_date` ในตารางอื่น) |
| เวลา | `docTime` (ว่าง = 08:00, `trans.go:107`) | `doc_time` |
| เลขที่เอกสาร | `docNo` | `doc_no` |
| รหัสเอกสาร | `docFormatCode` | `doc_format_code` → `erp_doc_format.code` |
| รูปแบบ | — | `erp_doc_format.format` เช่น `@YYMM-####` |

- ปุ่ม "Auto" ข้างช่องเลขที่เอกสาร (`TransTopForm.tsx:205-214`) แสดงเฉพาะตอนแก้ไขเอกสารใหม่ และช่องเลขที่แก้ได้เฉพาะเอกสารใหม่ (`:202`) ปุ่มเรียก `handleAutoDocNo` (`UniversalTransScreen.tsx:1860-1886`) ซึ่งขอเลขถัดไปจาก backend (`NextDocNo`, `doc_no_next.go:59-71`; ตารางที่รับ `ic_trans`, `ap_ar_trans`, `cb_trans`, `gl_journal`, `as_trans`, `ic_hidden_cost_process`, `:12`)
- `nextDocNo` อ่าน `erp_doc_format.format` ถ้าไม่พบใช้ค่าเริ่มต้น `@YYMM-####` (`@` = รหัสรูปแบบ, `doc_cancel.go:410-412`) แล้วหาเลขสูงสุดที่ขึ้นต้นด้วยคำนำหน้าเดียวกัน บวก 1 โดยกรองตาม `trans_flag` (`gl_journal` และตารางที่ไม่มี `trans_flag` ไม่กรอง) ล็อกต่อคำนำหน้าไม่ให้สองคนได้เลขซ้ำ (`doc_cancel.go:391-457`, ล็อกที่ `:433`, กรอง flag ที่ `:438-440`) และเลขที่ยาวเกิน 25 ตัวอักษรจะบันทึกไม่ได้ (`:453-455`)
- จอ "กำหนดรูปแบบเลขที่เอกสาร" (`menu_setup_doc_format`, bcMenu.json:179-180) มีคอลัมน์ รหัสรูปแบบ (`code`), รหัสจอ (`screen_code`), ชื่อ (`name_1`), รูปแบบ (`format`) (`DocFormatScreen.tsx:960-963`)
- ในบรรทัดรายการมี `doc_date_calc` และ `doc_time_calc` ซึ่งใช้เรียงลำดับเวลาตอนคำนวณสต็อก (`insertTransDetailSQL`, `trans.go:692-695`)

## ข้อควรระวัง
- ปีในฐานข้อมูลเก็บเป็น ค.ศ. เสมอ การแสดง พ.ศ. เป็นเรื่องของ UI ดู [[term-buddhist-year]]
- เลขที่เอกสารของเอกสารยกเลิกเป็นเลขใหม่ ไม่ได้ใช้เลขเดิม ดู [[term-last-status-cancel-approve]]
- `doc_no` ไม่ใช่ `tax_doc_no` เลขที่ใบกำกับภาษีเป็นอีกช่องหนึ่ง ดู [[term-vat-type]]

## ลิงก์
[[tbl-erp-doc-format]] · [[proc-doc-flow-numbering]] · [[tbl-ic-trans]] · [[term-doc-ref]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/account/transaction/TransTopForm.tsx:166`, `:177`, `:190`, `:202`, `:205-214`, `:217`
- `frontend/account/transaction/UniversalTransScreen.tsx:1860-1886`
- `backend/internal/application/process/trans.go:107`, `:657-659`, `:692-695`
- `backend/internal/application/process/doc_cancel.go:391-457`
- `backend/internal/application/process/doc_no_next.go:12`, `:59-71`
- `frontend/account/master/DocFormatScreen.tsx:960-963`
- `frontend/src/config/bcMenu.json:179-180`
