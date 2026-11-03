---
title: "ใบเสนอซื้อ/ใบขอซื้อสินค้า (Purchase Requisition)"
tags: [doctypes, purchase]
aliases: ["trans_flag 2", "ใบเสนอซื้อสินค้า", "ใบขอซื้อ", "PR"]
sources: ["frontend/account/tabs/transMenuMap.ts:56", "frontend/account/transaction/transLayouts.ts:67", "frontend/account/transaction/transLayouts.ts:35", "backend/internal/application/process/doc_cancel.go:50", "backend/internal/application/process/doc_cancel.go:66", "backend/internal/application/process/doc_flow.go:91", "backend/internal/application/process/trans_ref_import.go:23", "backend/internal/application/process/service.go:1731", "backend/internal/application/process/stock_rebuild.go:18"]
---

# ใบเสนอซื้อ/ใบขอซื้อสินค้า (trans_flag 2)

## ใช้เมื่อไร
ใช้ขออนุมัติซื้อก่อนออกใบสั่งซื้อ อยู่ที่เมนู "ใบเสนอซื้อสินค้า" (screen code PR, transMenuMap.ts:56) เอกสารนี้ใช้ติดตามสถานะอย่างเดียว ไม่มีผลกับสต็อก ภาษี และบัญชี

## trans_flag/ตาราง
- trans_flag 2, calc_flag 0, ฝั่งเจ้าหนี้ (ap) เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]
- ความหมายของ flag ทั้งหมดดูที่ [[acc-trans-flag-map]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, onHold, inquiry, vat, approval, expire, send (`FLAG_SPEC` transLayouts.ts:67) ไม่มีแท็บชำระ/ภาษี/GL
- ประเภทรายการใช้ตัวเลือก `PO_INQUIRY` (transLayouts.ts:35)
- มีช่องเครดิต/วันครบกำหนด (`CREDIT_FLAGS` transLayouts.ts:156)

## ผลต่อสต็อก
ไม่มี เพราะ flag 2 ไม่อยู่ใน `stockRowsSQL` (stock_rebuild.go:18)

## ผลต่อภาษี (VAT/WHT)
ไม่มี เพราะ flag 2 ไม่อยู่ใน `transVatTabs` และ `transWhtParty` (trans_tax.go:37, :48)

## การลงบัญชี
ไม่ลง GL เพราะ flag 2 ไม่อยู่ใน `glRebuildTransFlags` (service.go:1731)

## เอกสารต้นทาง-ปลายทาง
- ปลายทาง: ใบสั่งซื้อ 6 ดึงรายการจากใบนี้ได้ (`refImportSpecs` คู่ {6,2} trans_ref_import.go:23)
- อนุมัติด้วยเอกสาร flag 4 (`approveOrigFlags` doc_cancel.go:66) ผู้อนุมัติแก้จำนวน/ราคา/ส่วนลดรายบรรทัดได้ ดู [[proc-doc-cancel-approve]]
- `flowRules` ของ flag 2 คำนวณ used_status/doc_success จากเอกสาร 4, 6 และการยกเลิกรายสินค้า 3 (doc_flow.go:91) โหมด `successPR` ขึ้นกับตัวเลือก `purchase_request_approve_until_end` ดู [[proc-doc-flow-numbering]]

## ยกเลิก/แก้ไข
- ยกเลิกด้วยเอกสาร flag 3 (`cancelOrigFlags` doc_cancel.go:50) รองรับยกเลิกทั้งใบ (cancel_type 1) และยกเลิกรายสินค้า (cancel_type 2)
- การแก้/ลบเอกสารดู [[acc-transaction-delete-edit]]

## ข้อควรระวัง
- ชื่อเมนูใช้คำว่า "ใบเสนอซื้อ" แต่ comment ฝั่ง backend เรียกเอกสารนี้ว่า PR/ใบขอซื้อ (doc_cancel.go:66)
- ถ้ายกเลิกรายสินค้าไปก่อน การยกเลิกทั้งใบอาจถูกปฏิเสธ ดู [[proc-doc-cancel-approve]]

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:56` เมนู flag 2
- `frontend/account/transaction/transLayouts.ts:67` FLAG_SPEC 2
- `frontend/account/transaction/transLayouts.ts:35` PO_INQUIRY
- `backend/internal/application/process/doc_cancel.go:50` ยกเลิก 3
- `backend/internal/application/process/doc_cancel.go:66` อนุมัติ 4
- `backend/internal/application/process/doc_flow.go:91` flowRules
- `backend/internal/application/process/trans_ref_import.go:23` refImportSpecs

## ดูเพิ่ม
- [[doc-purchase-order]] · [[doctypes-overview]] · [[acc-transaction-save-flow]]
