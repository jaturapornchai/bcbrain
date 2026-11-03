---
title: "เอกสารอ้างอิง และการดึงเอกสาร (doc_ref / ref_doc_no / doc_ref_type)"
tags: [glossary, document, doc-flow]
aliases: ["เอกสารอ้างอิง", "เลขที่เอกสารอ้างอิง", "เอกสารอ้างอิงวันที่", "อ้างอิง", "ดึงเอกสาร", "ดึงรายการ", "ดึงใบสั่งซื้อ", "ดึงใบสั่งขาย", "อ้างอิงใบเสนอราคา", "doc_ref", "doc_ref_date", "docRef", "docRefDate", "ref_doc_no", "refDocNo", "doc_ref_type", "docRefType", "bill_type", "refKind", "refImportSpecs", "check_qty_over_doc_ref", "ห้ามเกินเอกสารอ้างอิง", "used_status", "doc_success", "เลขที่ใบจ่ายล่วงหน้า", "เลขที่ใบรับล่วงหน้า", "เลขที่ใบรับเงินมัดจำ"]
sources: ["backend/internal/application/process/trans.go:65", "backend/internal/application/process/trans.go:67", "backend/internal/application/process/trans.go:119", "backend/internal/application/process/trans.go:120", "backend/internal/application/process/trans_validate.go:305", "backend/internal/application/process/trans_ref_import.go:21", "backend/internal/application/process/trans_qty_over_ref.go:13", "backend/internal/application/process/doc_flow.go:14", "frontend/account/transaction/TransTopForm.tsx:399", "frontend/account/transaction/TransTopForm.tsx:417", "frontend/account/transaction/TransTopForm.tsx:422", "frontend/account/transaction/TransItemGrid.tsx:356", "frontend/account/transaction/TransItemGrid.tsx:1132", "frontend/account/transaction/transLayouts.ts:56", "frontend/account/transaction/transLayouts.ts:354"]
---

# เอกสารอ้างอิง / ดึงเอกสาร

## ในระบบนี้คืออะไร
ระบบใช้คำว่า "เอกสารอ้างอิง" ใน **2 ระดับ**
1. **หัวเอกสาร**: `ic_trans.doc_ref` และ `doc_ref_date` (`DocRef`/`DocRefDate`, `trans.go:119-120`) บนจอคือช่อง "เอกสารอ้างอิง:" (`refDocLabel`, `transLayouts.ts:354`; `TransTopForm.tsx:399`) ปุ่ม "ดึงเอกสาร" (`:417`) และช่อง "เอกสารอ้างอิงวันที่:" (`:422`)
2. **บรรทัดสินค้า**: `ic_trans_detail.ref_doc_no` คือเลขเอกสารที่บรรทัดนั้นถูกดึงมา และ `doc_ref_type` คือชนิดของเอกสารต้นทาง โดย 0 = ไม่มี (`trans.go:65`, `:67`) บนตารางคือคอลัมน์ "เอกสารอ้างอิง" ที่กดแสดงหรือซ่อนได้ (`TransItemGrid.tsx:356`, ปุ่ม `:1132`) ถ้าดึงรายการมาแล้ว คอลัมน์นี้จะถูกล็อกให้แสดง (`:1122-1130`)

## ค่าของ `doc_ref_type` (`refKind`, `trans_validate.go:305-319`)
- C# เก็บค่า bill_type: 1 เสนอราคา → flag 30, 2 สั่งจอง → 34, 3 สั่งขาย → 36
- เว็บ API ส่ง `trans_flag` ของเอกสารต้นทางมาตรงๆ ค่าอื่นจึงหมายถึง trans_flag นั้นเลย

## การดึงรายการ
- ตารางคู่ {flag ที่กำลังคีย์, flag ต้นทาง} กำหนดวิธีคิดยอดคงเหลือที่ดึงได้ (`refImportSpecs`, `trans_ref_import.go:21-28`) เช่น {6,4} ใบสั่งซื้อ (PO) ดึงจาก "อนุมัติใบเสนอซื้อสินค้า", {6,2} PO ดึงจากใบเสนอซื้อ (PR), {315,310} "ตั้งหนี้ซื้อจากการรับสินค้า" ดึงจาก "รับสินค้าตามใบสั่งซื้อ (ทะยอยรับ)" (ชื่อจาก `transMenuMap.ts:57`, `:71`, `:100`, `:327`, `:358`)
- ใบรับคืนหรือลดหนี้ 311/16/48 ดึงยอดจำนวนและราคาที่เหลือ (`trans_ref_import.go:22-23`)
- ถ้าเปิด `erp_option.check_qty_over_doc_ref` จำนวนต้องไม่เกินเอกสารต้นทาง: สั่งขาย 36 เทียบกับ 30/34 ตาม `doc_ref_type` และสั่งจอง 34 เทียบกับใบเสนอราคา 30 เสมอ (`trans_qty_over_ref.go:13-24`)
- เอกสารรับหรือคืนเงินล่วงหน้า/มัดจำเปลี่ยนป้ายช่องอ้างอิงเป็น "เลขที่ใบจ่ายล่วงหน้า" (20, 25), "เลขที่ใบรับล่วงหน้า" (42), "เลขที่ใบรับเงินมัดจำ" (112) (`DEPOSIT_REF_LABEL`, `transLayouts.ts:56-59`) ดู [[term-deposit-advance]]

## สถานะที่ derived จากการอ้างอิง
หลังบันทึก ลบ ยกเลิก หรืออนุมัติ ระบบคำนวณ `last_status`, `used_status`, `used_status_2`, `doc_success` และ `approve_status` ของเอกสารที่ถูกอ้างอิงใหม่จากแถวดิบที่ชี้มา (`doc_flow.go:14-17`) ห้ามแก้ค่าเหล่านี้ตรงๆ ดู [[term-last-status-cancel-approve]]

## ข้อควรระวัง
- เอกสารยกเลิกและเอกสารอนุมัติก็ใช้ `doc_ref` ชี้กลับไปที่เอกสารต้นทาง ดู [[term-last-status-cancel-approve]]
- `ap_ar_trans_detail` ใช้ทั้ง `ref_doc_no` และ `doc_ref` ในความหมายของบิลที่ชำระ ดู [[term-ap-ar-balance]]

## ลิงก์
[[proc-doc-flow-numbering]] · [[term-trans-flag]] · [[term-doc-no-doc-date]] · [[glossary-overview]]

## ที่มาในโค้ด
- `backend/internal/application/process/trans.go:65`, `:67`, `:119-120`
- `backend/internal/application/process/trans_validate.go:305-319`
- `backend/internal/application/process/trans_ref_import.go:21-28`
- `backend/internal/application/process/trans_qty_over_ref.go:13-24`
- `backend/internal/application/process/doc_flow.go:14-17`
- `frontend/account/transaction/TransTopForm.tsx:399`, `:417`, `:422`
- `frontend/account/transaction/TransItemGrid.tsx:356`, `:1122-1132`
- `frontend/account/transaction/transLayouts.ts:56-59`, `:354`
