---
title: "สถานะยกเลิก/อนุมัติเอกสาร (last_status / approve_status / cancel flag)"
tags: [glossary, document-status, cancel, approve]
aliases: ["last_status", "approve_status", "สถานะเอกสาร", "ยกเลิกเอกสาร", "เอกสารยกเลิก", "อนุมัติเอกสาร", "ไม่อนุมัติ", "not_approve_1", "is_cancel", "cancel_type", "ยกเลิกทั้งหมด", "ยกเลิกรายสินค้า", "คืนสถานะ", "ยกเลิกการอนุมัติ", "origFlag", "doc/cancel", "doc/approve", "CancelDoc", "ApproveDoc"]
sources: ["backend/internal/application/process/doc_cancel.go:17", "backend/internal/application/process/doc_cancel.go:36", "backend/internal/application/process/doc_cancel.go:38", "backend/internal/application/process/doc_cancel.go:117", "backend/internal/application/process/doc_cancel.go:159", "backend/internal/application/process/doc_cancel.go:203", "backend/internal/application/process/doc_cancel.go:281", "backend/internal/application/process/pos_bill.go:602", "backend/internal/application/process/trans_tax.go:22", "frontend/account/tabs/transMenuMap.ts:70", "frontend/account/tabs/transMenuMap.ts:844"]
---

# สถานะยกเลิก / อนุมัติเอกสาร

## ในระบบนี้คืออะไร
การยกเลิกและการอนุมัติไม่ได้แก้เอกสารเดิมโดยตรง ระบบจะสร้าง **เอกสารใหม่แยกออกมา** ที่มี `trans_flag` ของเอกสารยกเลิก/อนุมัติ และ `doc_ref` ชี้ไปยังเลขที่เอกสารเดิม จากนั้นจึงคำนวณ `last_status` และ `approve_status` ของเอกสารเดิมจากเอกสารใหม่นั้น (`doc_cancel.go:17-22`)
เมื่อคืนสถานะ (Undo) ระบบจะลบเอกสารยกเลิก/อนุมัติแล้วคำนวณใหม่ (`:36`)

## identifier / ตาราง / คอลัมน์
| คำไทย | identifier | ความหมายในโค้ด |
|---|---|---|
| สถานะยกเลิก | `last_status` | 0 = ปกติ (ค่าตอนบันทึก, `trans.go:657-688`), 1 = ถูกยกเลิก (`doc_cancel.go:159` ตอบ "ถูกยกเลิกแล้ว") |
| สถานะอนุมัติ | `approve_status` | 0 = ยังไม่อนุมัติ, 1 = อนุมัติ, 2 = ไม่อนุมัติ (ใช้ `not_approve_1 = 1`) (`doc_cancel.go:287-289`, `:37`) |
| ยกเลิกทั้งหมด / รายสินค้า | `cancel_type` | 1 = ยกเลิกทั้งหมด (ค่าเริ่มต้น), 2 = ยกเลิกรายสินค้า ใช้ได้เฉพาะ flag 7/39/37/3/31 (`:38-41`) |
| บิล POS ยกเลิก | `last_status = 1`, `is_cancel = 1` | `pos_bill.go:602` |
| flag เอกสารเดิม | `origFlag` | ฟิลด์ใน `TransMenuConfig` ของเมนูยกเลิก/อนุมัติ |

## คู่ flag (เอกสารยกเลิก/อนุมัติ ← เอกสารเดิม) จาก `transMenuMap.ts`
- อนุมัติ: 4←2 ใบเสนอซื้อ (`:70`), 8←6 ใบสั่งซื้อ (`:115`), 32←30 ใบเสนอราคา (`:557`), 38←34 ใบสั่งจอง (`:602`), 52←36 ใบสั่งขาย (`:647`)
- ยกเลิกฝั่งซื้อ: 3←2, 7←6, 150←10, 151←11, 161←20, 152←25, 13←12, 330←310, 335←315, 17←16, 331←311, 337←317, 15←14, 336←316
- ยกเลิกฝั่งขาย: 31←30, 39←34, 37←36, 41←40, 111←110, 43←42, 113←112, 45←44 (`:844`), 49←48, 47←46
- ยกเลิกฝั่งสต็อก: 61←60, 123←122, 57←56, 59←58, 73←72, 67←66, 69←68
- ยกเลิกฝั่งหนี้: 88←87, 92←91, 90←89, 214←213, 23←19, 100←99, 104←103, 102←101, 236←235, 240←239
- ยกเลิกรายได้/ค่าใช้จ่ายอื่น: 251/253/255 และ 261/263/265
- ยกเลิกเงินและเช็ค: 302←300, 303←301, 403←401, 404←402, 423←422, 430←410, 431←411, 432←412, 433←413, 436←416, 471←451, 472←452, 473←453, 476←456

## ข้อควรระวัง
- การยกเลิกจะสร้างสต็อก GL และสถานะเช็คของเอกสารเดิมใหม่ภายใน transaction เดียว (`doc_cancel.go:117-119`) ส่วนการอนุมัติไม่กระทบสต็อกหรือ GL (`:203-204`)
- รายงานภาษีจะแสดงแถวของเอกสารยกเลิกเป็นศูนย์ โดยดูจาก `last_status` (`trans_tax.go:22`)
- ใบเสนอราคา (30) ระบบไม่ได้เก็บ approve_status แต่หาจากเอกสาร 32 (`doc_cancel.go:281-283`)
- ก่อนยกเลิกต้องผ่านการตรวจงวดบัญชี (`checkCancelPeriod`) ดู [[term-account-period]]

## ลิงก์
[[proc-doc-cancel-approve]] · [[acc-transaction-delete-edit]] · [[term-trans-flag]] · [[tbl-ic-trans]] · [[glossary-overview]]

## ที่มาในโค้ด
- `backend/internal/application/process/doc_cancel.go:17-22`, `:36-41`, `:117-119`, `:144-160`, `:203-204`, `:281-292`
- `backend/internal/application/process/pos_bill.go:602`
- `backend/internal/application/process/trans_tax.go:22`
- `frontend/account/tabs/transMenuMap.ts:70`, `:115`, `:557`, `:602`, `:647`, `:844`
