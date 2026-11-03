---
title: "เอกสารอ้างอิง และการดึงเอกสาร (doc_ref / ref_doc_no / doc_ref_type)"
tags: [glossary, document, doc-flow]
aliases: ["เอกสารอ้างอิง", "เลขที่เอกสารอ้างอิง", "เอกสารอ้างอิงวันที่", "อ้างอิง", "ดึงเอกสาร", "ดึงรายการ", "ดึงใบสั่งซื้อ", "ดึงใบสั่งขาย", "อ้างอิงใบเสนอราคา", "doc_ref", "doc_ref_date", "docRef", "docRefDate", "ref_doc_no", "refDocNo", "doc_ref_type", "docRefType", "bill_type", "refKind", "refImportSpecs", "check_qty_over_doc_ref", "ห้ามเกินเอกสารอ้างอิง", "used_status", "doc_success", "เลขที่ใบจ่ายล่วงหน้า", "เลขที่ใบรับล่วงหน้า", "เลขที่ใบรับเงินมัดจำ"]
sources: ["backend/internal/application/process/trans.go:65", "backend/internal/application/process/trans.go:67", "backend/internal/application/process/trans.go:119", "backend/internal/application/process/trans.go:120", "backend/internal/application/process/trans_validate.go:309", "backend/internal/application/process/trans_ref_import.go:24", "backend/internal/application/process/trans_ref_import_lines.go:64", "backend/internal/application/process/trans_ref_import_lines.go:528", "backend/internal/application/process/trans_ref_import_remain.go:18", "backend/internal/application/process/trans_qty_over_ref.go:16", "backend/internal/application/process/doc_flow.go:146", "backend/internal/application/process/doc_flow.go:213", "frontend/account/transaction/TransTopForm.tsx:401", "frontend/account/transaction/TransTopForm.tsx:419", "frontend/account/transaction/TransTopForm.tsx:424", "frontend/account/transaction/TransItemGrid.tsx:295", "frontend/account/transaction/TransItemGrid.tsx:432", "frontend/account/transaction/TransItemGrid.tsx:1121", "frontend/account/transaction/transLayouts.ts:56", "frontend/account/transaction/transLayouts.ts:177", "frontend/account/transaction/transLayouts.ts:182"]
---

# เอกสารอ้างอิง / ดึงเอกสาร

## ในระบบนี้คืออะไร
ระบบใช้คำว่า "เอกสารอ้างอิง" ใน **2 ระดับ**
1. **หัวเอกสาร**: `ic_trans.doc_ref` และ `doc_ref_date` (`DocRef`/`DocRefDate`, `trans.go:119-120`) บนจอคือช่อง "เอกสารอ้างอิง:" (`refDocLabel`, `transLayouts.ts:354`; `TransTopForm.tsx:401`) ปุ่ม "ดึงเอกสาร" (`:419`) และช่อง "เอกสารอ้างอิงวันที่:" (`:424`) แสดงเมื่อ `showRefDoc` เปิด (`TransTopForm.tsx:397`)
2. **บรรทัดสินค้า**: `ic_trans_detail.ref_doc_no` คือเลขเอกสารที่บรรทัดนั้นถูกดึงมา และ `doc_ref_type` คือชนิดของเอกสารต้นทาง โดย 0 = ไม่มี (`trans.go:65`, `:67`) บนตารางคือคอลัมน์เลขที่อ้างอิงที่กดแสดงหรือซ่อนได้ หัวคอลัมน์มาจาก `refColumnLabel` ของจอนั้น (`REF_COLUMN_LABEL`, `transLayouts.ts:177-179`, ใช้ที่ `:366`; `TransItemGrid.tsx:295-297`, ค่า `ref_doc_no` ที่ `:432`) ปุ่ม "เอกสารอ้างอิง" สลับแสดง/ซ่อน (`TransItemGrid.tsx:1121-1134`) และกดไม่ได้เมื่อดึงรายการมาแล้ว เพราะ backend ตอบ `refLocked` เมื่อมีรายการที่ดึงมา (`trans_ref_import_lines.go:240`, `UniversalTransScreen.tsx:2382-2385`) จอสั่งขาย 36 และขาย 44 มีคอลัมน์ "ประเภทเอกสาร" เพิ่ม แสดงข้อความตามค่า `doc_ref_type` (`REF_TYPE_OPTIONS`, `transLayouts.ts:182-187`; `TransItemGrid.tsx:292-294`, `:427-431`) ส่วนจอเช็คมีคอลัมน์เอกสารอ้างอิงของตัวเองอยู่แล้ว (`TransItemGrid.tsx:228-229`, `:356`)

## ค่าของ `doc_ref_type` (`refKind`, `trans_validate.go:309-319`)
- ค่า 1 = ใบเสนอราคา (flag 30), 2 = ใบสั่งจอง (34), 3 = ใบสั่งขาย (36)
- ค่าอื่นที่ไม่ใช่ 1-3 ถูกอ่านเป็น `trans_flag` ของเอกสารต้นทางตรงๆ (`refKind`, `trans_validate.go:309-319`) ตอนดึงรายการ backend เขียน `doc_ref_type` ให้เฉพาะจอ 6, 36, 44, 46, 48 (`refLineDocRefType`, `trans_ref_import_lines.go:528-534`): 6 ดึงจาก 4 = 0 และจาก 2 = 1, 36 ดึงจาก 30 = 1 และ 34 = 2, 44 ดึงจาก 30 = 1, 34 = 2 และ 36 = 3, 46 ดึงจาก 44 = 1 (`refDocTypes`, `:64`) จอ 48 รับค่า 1-3 จากผู้ใช้ ถ้าไม่ระบุใช้ 1 (`refDocType`, `:78-86`)

## การดึงรายการ
- ตารางคู่ {flag ที่กำลังคีย์, flag ต้นทาง} กำหนดวิธีคิดยอดคงเหลือที่ดึงได้ (`refImportSpecs`, `trans_ref_import.go:24-39`) เช่น {6,4} ใบสั่งซื้อ (PO) ดึงจาก "อนุมัติใบเสนอซื้อสินค้า" (`:25`), {6,2} PO ดึงจากใบเสนอซื้อ (PR) (`:26`), {315,310} "ตั้งหนี้ซื้อจากการรับสินค้า" ดึงจาก "รับสินค้าตามใบสั่งซื้อ (ทะยอยรับ)" (`:27`) (ชื่อจาก `transMenuMap.ts:57`, `:71`, `:100`, `:327`, `:358`)
- ใบรับคืนหรือลดหนี้ 311/16/48 ดึงยอดจำนวนและราคาที่เหลือ โดยกรองเอกสารต้นทางตาม `inquiry_type` (`refRemainSpecs`, `trans_ref_import_remain.go:18-22`)
- ถ้าเปิด `erp_option.check_qty_over_doc_ref` จำนวนต้องไม่เกินเอกสารต้นทาง: สั่งขาย 36 ตรวจกับ 30/34 ตาม `doc_ref_type` และสั่งจอง 34 ตรวจกับใบเสนอราคา 30 เสมอ (`qtyOverRefSource`, `trans_qty_over_ref.go:16-24`) ตรวจตอนบันทึกทุกบรรทัดที่มี `ref_doc_no` และเกินแล้วบันทึกไม่ได้ (`checkQtyOverDocRef`, `:41-76`)
- เอกสารรับหรือคืนเงินล่วงหน้า/มัดจำเปลี่ยนป้ายช่องอ้างอิงเป็น "เลขที่ใบจ่ายล่วงหน้า" (20, 25), "เลขที่ใบรับล่วงหน้า" (42), "เลขที่ใบรับเงินมัดจำ" (112) (`DEPOSIT_REF_LABEL`, `transLayouts.ts:56-59`) ดู [[term-deposit-advance]]

## สถานะที่ derived จากการอ้างอิง
หลังบันทึก ลบ ยกเลิก หรืออนุมัติ ระบบคำนวณ `last_status`, `used_status`, `used_status_2`, `doc_success` และ `approve_status` ของเอกสารที่ถูกอ้างอิงใหม่จากแถวดิบที่ชี้มา (`docFlowTx`, `doc_flow.go:146-177`; เอกสารที่ถูกชี้มาหาจาก `ic_trans.doc_ref`, `ic_trans_detail.ref_doc_no`/`doc_ref`, `ap_ar_trans_detail.billing_no` และ `cb_trans_detail.trans_number` ใน `docFlowSources`, `:213-230`) ห้ามแก้ค่าเหล่านี้ตรงๆ ดู [[term-last-status-cancel-approve]]

## ข้อควรระวัง
- เอกสารยกเลิกและเอกสารอนุมัติก็ใช้ `doc_ref` ชี้กลับไปที่เอกสารต้นทาง (`doc_cancel.go:326`, `:345`) ดู [[term-last-status-cancel-approve]]
- `ap_ar_trans_detail` ใช้ทั้ง `ref_doc_no` และ `doc_ref` ในความหมายของบิลที่ชำระ (`docs.go:565-571`) ดู [[term-ap-ar-balance]]

## ลิงก์
[[proc-doc-flow-numbering]] · [[term-trans-flag]] · [[term-doc-no-doc-date]] · [[glossary-overview]]

## ที่มาในโค้ด
- `backend/internal/application/process/trans.go:65`, `:67`, `:119-120`
- `backend/internal/application/process/trans_validate.go:309-319`
- `backend/internal/application/process/trans_ref_import.go:24-39`
- `backend/internal/application/process/trans_ref_import_lines.go:64`, `:78-86`, `:240`, `:528-534`
- `backend/internal/application/process/trans_ref_import_remain.go:18-22`
- `backend/internal/application/process/trans_qty_over_ref.go:16-24`, `:41-76`
- `backend/internal/application/process/doc_flow.go:146-177`, `:213-230`
- `backend/internal/application/process/doc_cancel.go:326`, `:345`
- `backend/internal/application/process/docs.go:565-571`
- `frontend/account/transaction/TransTopForm.tsx:397`, `:401`, `:419`, `:424`
- `frontend/account/transaction/TransItemGrid.tsx:228-229`, `:292-297`, `:356`, `:427-432`, `:1121-1134`
- `frontend/account/transaction/UniversalTransScreen.tsx:2382-2385`
- `frontend/account/transaction/transLayouts.ts:56-59`, `:177-187`, `:354`, `:366`
