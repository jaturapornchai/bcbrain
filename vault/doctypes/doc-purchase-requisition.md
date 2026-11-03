---
title: "ใบเสนอซื้อ/ใบขอซื้อสินค้า (Purchase Requisition)"
tags: [doctypes, purchase]
aliases: ["trans_flag 2", "ใบเสนอซื้อสินค้า", "ใบขอซื้อ", "PR"]
sources: ["frontend/account/tabs/transMenuMap.ts:56", "frontend/account/transaction/transLayouts.ts:67", "frontend/account/transaction/transLayouts.ts:35", "frontend/account/transaction/transLayouts.ts:156", "backend/internal/application/process/transcalc.go:16", "backend/internal/application/process/doc_cancel.go:50", "backend/internal/application/process/doc_cancel.go:38", "backend/internal/application/process/doc_cancel.go:66", "backend/internal/application/process/doc_cancel.go:517", "backend/internal/application/process/doc_flow.go:92", "backend/internal/application/process/trans_ref_import.go:26", "backend/internal/application/process/service.go:1742", "backend/internal/application/process/stock_rebuild.go:19"]
---

# ใบเสนอซื้อ/ใบขอซื้อสินค้า (trans_flag 2)

## ใช้เมื่อไร
ใช้ขออนุมัติซื้อก่อนออกใบสั่งซื้อ อยู่ที่เมนู "ใบเสนอซื้อสินค้า (PR)" (screen code PR, transMenuMap.ts:56) เอกสารนี้ใช้ติดตามสถานะอย่างเดียว ไม่มีผลกับสต็อก ภาษี และบัญชี

## trans_flag/ตาราง
- trans_flag 2, ฝั่งเจ้าหนี้ (ap) เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]
- calc_flag ที่ backend เขียนลง `ic_trans_detail` = 1 (`calcFlagByTransFlag` transcalc.go:16) ส่วนค่า `calcFlag: 0` ในเมนูฝั่งหน้าจอ backend ไม่ได้ใช้ — ไม่มีผลสต็อกเพราะ flag 2 ไม่ถูกนับ (ดูหัวข้อสต็อก)
- ความหมายของ flag ทั้งหมดดูที่ [[acc-trans-flag-map]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, onHold, inquiry, vat, approval, expire, send (`FLAG_SPEC` transLayouts.ts:67) ไม่มีแท็บชำระ/ภาษี/GL
- ประเภทรายการใช้ตัวเลือก `PO_INQUIRY` (transLayouts.ts:35)
- มีช่องเครดิต/วันครบกำหนด (`CREDIT_FLAGS` transLayouts.ts:156)

## ผลต่อสต็อก
ไม่มี เพราะ flag 2 ไม่อยู่ในชุด flag ของ `stockRowsSQL` (stock_rebuild.go:19)

## ผลต่อภาษี (VAT/WHT)
ไม่มี เพราะ flag 2 ไม่อยู่ใน `transVatTabs` และ `transWhtParty` (trans_tax.go:37, :48)

## การลงบัญชี
ไม่ลง GL เพราะ flag 2 ไม่อยู่ใน `glRebuildTransFlags` (service.go:1742)

## เอกสารต้นทาง-ปลายทาง
- ปลายทาง: ใบสั่งซื้อ 6 ดึงรายการจากใบนี้ได้ (`refImportSpecs` คู่ {6,2} trans_ref_import.go:26)
- อนุมัติด้วยเอกสาร flag 4 (`approveOrigFlags` doc_cancel.go:66) ผู้อนุมัติแก้จำนวน/ราคา/ส่วนลดรายบรรทัดได้ (`ApproveLines` doc_cancel.go:43) ดู [[proc-doc-cancel-approve]]
- `flowRules` ของ flag 2 คำนวณ used_status/doc_success จากเอกสาร 4, 6 และการยกเลิกรายสินค้า 3 (doc_flow.go:92) โหมด `successPR` ขึ้นกับตัวเลือก `purchase_request_approve_until_end` (doc_flow.go:25) ดู [[proc-doc-flow-numbering]]

## ยกเลิก/แก้ไข
- ยกเลิกด้วยเอกสาร flag 3 (`cancelOrigFlags` doc_cancel.go:50) รองรับยกเลิกทั้งใบ (cancel_type 1) และยกเลิกรายสินค้า (cancel_type 2, doc_cancel.go:38)
- การแก้/ลบเอกสารดู [[acc-transaction-delete-edit]]

## ข้อควรระวัง
- ชื่อเมนูใช้คำว่า "ใบเสนอซื้อ" ส่วน comment ฝั่ง backend เรียกเอกสารนี้ว่า PR (doc_cancel.go:43, :65)
- ถ้าไม่ได้เปิด `purchase_request_approve_until_end` แล้วยกเลิกรายสินค้าไปก่อน จะยกเลิกทั้งใบไม่ได้อีก เพราะใบยกเลิกรายสินค้านับเป็นการอ้างอิง (doc_cancel.go:517-519) ดู [[proc-doc-cancel-approve]]

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:56` เมนู flag 2
- `frontend/account/transaction/transLayouts.ts:67` FLAG_SPEC 2
- `frontend/account/transaction/transLayouts.ts:35` PO_INQUIRY
- `backend/internal/application/process/transcalc.go:16` calc_flag
- `backend/internal/application/process/doc_cancel.go:50` ยกเลิก 3
- `backend/internal/application/process/doc_cancel.go:66` อนุมัติ 4
- `backend/internal/application/process/doc_flow.go:92` flowRules flag 2
- `backend/internal/application/process/trans_ref_import.go:26` refImportSpecs {6,2}

## ดูเพิ่ม
- [[doc-purchase-order]] · [[doctypes-overview]] · [[acc-transaction-save-flow]]
