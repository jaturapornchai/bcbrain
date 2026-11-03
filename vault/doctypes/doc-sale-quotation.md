---
title: "ใบเสนอราคาขาย (Sales Quotation)"
tags: [doctypes, sale]
aliases: ["trans_flag 30", "ใบเสนอราคา", "ใบเสนอราคาขาย", "SO", "menu_so_quotation"]
sources: ["frontend/account/tabs/transMenuMap.ts:543", "frontend/account/tabs/transMenuMap.ts:2381", "frontend/account/transaction/transLayouts.ts:86", "backend/internal/application/process/trans_validate.go:168", "backend/internal/application/process/trans_validate.go:209", "backend/internal/application/process/doc_cancel.go:52", "backend/internal/application/process/doc_cancel.go:66", "backend/internal/application/process/trans_ref_import.go:23", "backend/internal/application/process/doc_flow.go:91"]
---

# ใบเสนอราคาขาย (trans_flag 30)

## ใช้เมื่อไร
ใช้เสนอราคาให้ลูกค้าก่อนรับจองหรือขาย อยู่ที่เมนู "ใบเสนอราคาขาย" (SO, transMenuMap.ts:543) และมีเมนู `menu_so_quotation` อีกจุดที่ transMenuMap.ts:2381

## trans_flag/ตาราง
- trans_flag 30 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, contactor, refDoc, sale, inquiry, vat, approval, expire, send ไม่มีแท็บชำระ/ภาษี/GL (transLayouts.ts:86)
- ถ้าเปิดตัวเลือกบริษัทไว้ ต้องกรอกจำนวนวันหมดอายุ (`checkScreenFields` trans_validate.go:168)
- ห้ามใช้ลูกค้าที่ถูกปิด (`closedCustomerFlags` trans_validate.go:209)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ไม่ลง GL เพราะไม่อยู่ใน `glRebuildTransFlags` (service.go:1731)

## เอกสารต้นทาง-ปลายทาง
- ปลายทางที่ดึงรายการ: ใบจอง 34, ใบสั่งขาย 36, ขาย 44 (`refImportSpecs` คู่ {34,30}, {36,30}, {44,30} trans_ref_import.go:23)
- ปลายทางที่อ้างเลข: รับเงินล่วงหน้า 40 (transMenuMap.ts:691 อ้าง 30/32/34/36) และตั้งหนี้อื่น 99 (transMenuMap.ts:1449)
- `flowRules` ของ 30 ใช้เอกสารอนุมัติ 32 และการอ้างจาก 34/36/44 (doc_flow.go:91)

## ยกเลิก/แก้ไข
- อนุมัติด้วย flag 32 (doc_cancel.go:66) และยกเลิกด้วย flag 31 (doc_cancel.go:52) รองรับยกเลิกรายสินค้า ดู [[proc-doc-cancel-approve]]

## ข้อควรระวัง
- ไม่มีผลทางบัญชีทุกด้าน สถานะอยู่ใน used_status/doc_success เท่านั้น

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:543` / `:2381` เมนู
- `frontend/account/transaction/transLayouts.ts:86` FLAG_SPEC 30
- `backend/internal/application/process/trans_validate.go:168` checkScreenFields
- `backend/internal/application/process/trans_ref_import.go:23` refImportSpecs
- `backend/internal/application/process/doc_cancel.go:52` ยกเลิก 31 / `:66` อนุมัติ 32

## ดูเพิ่ม
- [[doc-sale-reservation]] · [[doc-sale-order]] · [[doc-sale-invoice]] · [[proc-doc-flow-numbering]] · [[doctypes-overview]]
