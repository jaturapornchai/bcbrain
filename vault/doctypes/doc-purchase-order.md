---
title: "ใบสั่งซื้อสินค้า (Purchase Order)"
tags: [doctypes, purchase]
aliases: ["trans_flag 6", "ใบสั่งซื้อ", "PO"]
sources: ["frontend/account/tabs/transMenuMap.ts:99", "frontend/account/transaction/transLayouts.ts:68", "frontend/account/transaction/transLayouts.ts:357", "frontend/account/transaction/transLayouts.ts:370", "backend/internal/application/process/doc_cancel.go:50", "backend/internal/application/process/doc_cancel.go:66", "backend/internal/application/process/doc_flow.go:91", "backend/internal/application/process/trans_ref_import.go:23", "backend/internal/application/process/doc_cancel_item.go:31"]
---

# ใบสั่งซื้อสินค้า (trans_flag 6)

## ใช้เมื่อไร
ใช้สั่งซื้อสินค้าจากผู้ขาย อยู่ที่เมนู "ใบสั่งซื้อสินค้า" (screen code PO, transMenuMap.ts:99) ใบนี้เป็นต้นทางของการรับสินค้า การตั้งหนี้ และการจ่ายมัดจำ/ล่วงหน้า

## trans_flag/ตาราง
- trans_flag 6 (ในเมนูใส่ transFlags 6/7) อ้างอิงใบขอซื้อได้ทั้งแบบ 4 และ 2 (transMenuMap.ts:99)
- เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]] ดู [[acc-trans-flag-map]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, contactor, refDoc, inquiry, vat, approval, expire, send (FLAG_SPEC transLayouts.ts:68) ไม่มีแท็บชำระ/ภาษี/GL
- ช่องขนส่ง (`showTransport`) และคอลัมน์ mfn แสดงเฉพาะ flag 6 (transLayouts.ts:357, :370)
- ประเภทรายการใช้ `PO_INQUIRY` (transLayouts.ts:35)

## ผลต่อสต็อก
ไม่มี เพราะไม่อยู่ใน `stockRowsSQL` (stock_rebuild.go:18)

## ผลต่อภาษี (VAT/WHT)
ไม่มี เพราะไม่อยู่ใน `transVatTabs` และ `transWhtParty` (trans_tax.go:37, :48)

## การลงบัญชี
ไม่ลง GL เพราะไม่อยู่ใน `glRebuildTransFlags` (service.go:1731)

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ใบขอซื้อ 2 (`refImportSpecs` คู่ {6,2} trans_ref_import.go:23)
- ปลายทางที่ดึงรายการ: ซื้อ 12 และรับสินค้าทยอยรับ 310 (คู่ {12,6} และ {310,6})
- ปลายทางที่อ้างเลข PO: จ่ายเงินล่วงหน้า 10 (transMenuMap.ts:159), จ่ายมัดจำ 11 (transMenuMap.ts:189), ตั้งหนี้อื่น 87 (transMenuMap.ts:1251)
- `flowRules` ของ flag 6 คำนวณสถานะจากเอกสารอนุมัติ 8, มัดจำ 11, ยกเลิก 7, บรรทัดของ 12/310, log อนุมัติวงเงิน และการวางบิล 87/260 (doc_flow.go:91) ดู [[proc-doc-flow-numbering]]

## ยกเลิก/แก้ไข
- อนุมัติด้วย flag 8 (doc_cancel.go:66) และยกเลิกด้วย flag 7 (doc_cancel.go:50) รองรับยกเลิกรายสินค้า (`orderSpecs` doc_cancel_item.go:31)
- ยกเลิกทั้งใบไม่ได้ถ้าบรรทัดถูกนำไปใช้ครบแล้ว (doc_success) แต่ถ้าใช้ไปบางส่วนยังยกเลิกได้ ดู [[proc-doc-cancel-approve]]

## ข้อควรระวัง
- PO ไม่ลงบัญชีเลย ยอดผูกพันอยู่ในสถานะ used_status/doc_success เท่านั้น

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:99` เมนู flag 6
- `frontend/account/transaction/transLayouts.ts:68` FLAG_SPEC 6
- `frontend/account/transaction/transLayouts.ts:357` showTransport
- `backend/internal/application/process/trans_ref_import.go:23` refImportSpecs
- `backend/internal/application/process/doc_flow.go:91` flowRules
- `backend/internal/application/process/doc_cancel.go:50` ยกเลิก 7 / `:66` อนุมัติ 8
- `backend/internal/application/process/doc_cancel_item.go:31` ยกเลิกรายสินค้า

## ดูเพิ่ม
- [[doc-purchase-requisition]] · [[doc-purchase-invoice]] · [[doc-purchase-partial-receive]] · [[doc-purchase-deposit-payment]] · [[doctypes-overview]]
