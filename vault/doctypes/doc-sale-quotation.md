---
title: "ใบเสนอราคาขาย (Sales Quotation)"
tags: [doctypes, sale]
aliases: ["trans_flag 30", "ใบเสนอราคา", "ใบเสนอราคาขาย", "SO", "menu_so_quotation"]
sources: ["frontend/account/tabs/transMenuMap.ts:543", "frontend/account/tabs/transMenuMap.ts:2381", "frontend/account/tabs/transMenuMap.ts:691", "frontend/account/tabs/transMenuMap.ts:1449", "frontend/account/transaction/transLayouts.ts:86", "backend/internal/application/process/trans_validate.go:168", "backend/internal/application/process/trans_validate.go:181", "backend/internal/application/process/trans_validate.go:210", "backend/internal/application/process/doc_cancel.go:38", "backend/internal/application/process/doc_cancel.go:52", "backend/internal/application/process/doc_cancel.go:66", "backend/internal/application/process/trans_ref_import.go:31", "backend/internal/application/process/doc_flow.go:99", "backend/internal/application/process/service.go:1742", "backend/internal/application/process/stock_rebuild.go:19"]
---

# ใบเสนอราคาขาย (trans_flag 30)

## ใช้เมื่อไร
ใช้เสนอราคาให้ลูกค้าก่อนรับจองหรือขาย อยู่ที่เมนู "ใบเสนอราคาขาย" (SO, `menu_so_quotation_order` transMenuMap.ts:543) และมีเมนู `menu_so_quotation` อีกจุดที่ transMenuMap.ts:2381

## trans_flag/ตาราง
- trans_flag 30 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, contactor, refDoc, sale, inquiry, vat, approval, expire, send ไม่มีแท็บชำระ/ภาษี/GL (transLayouts.ts:86)
- ถ้าเปิดตัวเลือกบริษัทไว้ ต้องกรอกจำนวนวันหมดอายุ (`checkScreenFields` trans_validate.go:168, เงื่อนไข flag 30 ที่ :181)
- เอกสารใหม่ห้ามใช้ลูกค้าที่ status = 1 (`closedCustomerFlags` trans_validate.go:210)

## ผลต่อสต็อก
ไม่มี (ไม่อยู่ในชุด flag ของ `stockRowsSQL` stock_rebuild.go:19)

## ผลต่อภาษี (VAT/WHT)
ไม่มี (ไม่อยู่ใน `transVatTabs` / `transWhtParty` trans_tax.go:37, :48)

## การลงบัญชี
ไม่ลง GL เพราะไม่อยู่ใน `glRebuildTransFlags` (service.go:1742)

## เอกสารต้นทาง-ปลายทาง
- ปลายทางที่ดึงรายการ: ใบจอง 34, ใบสั่งขาย 36, ขาย 44 (`refImportSpecs` คู่ {34,30}, {36,30}, {44,30} trans_ref_import.go:31, :32, :36)
- ปลายทางที่อ้างเลข: รับเงินล่วงหน้า 40 (เมนูที่ transMenuMap.ts:691 อ้าง 30/32/34/36) และตั้งหนี้อื่น 99 (เมนูที่ transMenuMap.ts:1449 อ้าง 30)
- `flowRules` ของ 30 ถือว่าถูกใช้เมื่อมีเอกสารอนุมัติ 32 หรือบรรทัดของ 34/36/44 อ้างถึง หรือมียกเลิกบางส่วน 31 (doc_flow.go:99)

## ยกเลิก/แก้ไข
- อนุมัติด้วย flag 32 (doc_cancel.go:66) และยกเลิกด้วย flag 31 (doc_cancel.go:52) ยกเลิกรายสินค้าได้ (cancel_type 2, doc_cancel.go:38) ดู [[proc-doc-cancel-approve]]

## ข้อควรระวัง
- ไม่มีผลทางบัญชีทุกด้าน สถานะอยู่ใน used_status/doc_success เท่านั้น

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:543` / `:2381` เมนู
- `frontend/account/transaction/transLayouts.ts:86` FLAG_SPEC 30
- `backend/internal/application/process/trans_validate.go:181` วันหมดอายุ / `:210` closedCustomerFlags
- `backend/internal/application/process/trans_ref_import.go:31` refImportSpecs
- `backend/internal/application/process/doc_flow.go:99` flowRules 30
- `backend/internal/application/process/doc_cancel.go:52` ยกเลิก 31 / `:66` อนุมัติ 32

## ดูเพิ่ม
- [[doc-sale-reservation]] · [[doc-sale-order]] · [[doc-sale-invoice]] · [[proc-doc-flow-numbering]] · [[doctypes-overview]]
