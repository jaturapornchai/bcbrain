---
title: "ใบสั่งขายสินค้า (Sales Order)"
tags: [doctypes, sale]
aliases: ["trans_flag 36", "ใบสั่งขาย", "SS"]
sources: ["frontend/account/tabs/transMenuMap.ts:631", "frontend/account/transaction/transLayouts.ts:88", "frontend/account/transaction/transLayouts.ts:175", "backend/internal/application/process/trans_save_rules.go:55", "backend/internal/application/process/trans_save_rules.go:151", "backend/internal/application/process/trans_credit.go:34", "backend/internal/application/process/doc_cancel.go:52", "backend/internal/application/process/doc_cancel.go:66", "backend/internal/application/process/doc_cancel.go:501", "backend/internal/application/process/doc_cancel_item.go:34", "backend/internal/application/process/trans_ref_import.go:32", "backend/internal/application/process/doc_flow.go:104", "backend/internal/application/process/service.go:1742", "backend/internal/application/process/stock_rebuild.go:19"]
---

# ใบสั่งขายสินค้า (trans_flag 36)

## ใช้เมื่อไร
ใช้ยืนยันคำสั่งขายก่อนส่งของหรือออกใบขาย อ้างใบเสนอราคา 30 หรือใบจอง 34 ได้ อยู่ที่เมนู "ใบสั่งขายสินค้า" (SS, transMenuMap.ts:631)

## trans_flag/ตาราง
- trans_flag 36 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, contactor, refDoc, inquiry, vat, sale, approval, expire, send ไม่มีแท็บ (transLayouts.ts:88)
- มีช่องประเภทการส่ง (`SEND_TYPE_FLAGS` transLayouts.ts:175)

## ผลต่อสต็อก
- ไม่ขยับสต็อก เพราะไม่อยู่ในชุด flag ของ `stockRowsSQL` (stock_rebuild.go:19)
- แต่อยู่ใน `stockCheckFlags` (trans_save_rules.go:55) ซึ่งตรวจยอดคงเหลือตอนบันทึกเอกสารใหม่เมื่อเปิดตัวเลือกควบคุมสต็อก (trans_save_rules.go:151)

## ผลต่อภาษี (VAT/WHT)
ไม่มี (ไม่อยู่ใน `transVatTabs` / `transWhtParty` trans_tax.go:37, :48)

## การลงบัญชี
ไม่ลง GL (ไม่อยู่ใน `glRebuildTransFlags` service.go:1742)

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ใบเสนอราคา 30 และใบจอง 34 (คู่ {36,30}, {36,34} trans_ref_import.go:32-33)
- ปลายทาง: ขาย 44 (คู่ {44,36}) `flowRules` ของ 36 ใช้เอกสารอนุมัติ 52 ยกเลิก 37 และการอ้างจาก 44 (doc_flow.go:104-106)

## ยกเลิก/แก้ไข
- อนุมัติด้วย flag 52 และยกเลิกด้วย flag 37 รองรับยกเลิกรายสินค้า (doc_cancel.go:52, :66, :38)
- ยกเลิกไม่ได้ถ้าบรรทัดถูกนำไปใช้ครบแล้ว (ยอดสั่ง − ยอดของ 37/44 ≤ 0, `orderSpecs` doc_cancel_item.go:34, doc_cancel.go:501-513) ดู [[proc-doc-cancel-approve]]

## ข้อควรระวัง
- ตรวจวงเงินแบบใบสั่ง (`orderCredit`) เฉพาะเมื่อเปิดตัวเลือกนั้น (trans_credit.go:34-38)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:631` เมนู
- `frontend/account/transaction/transLayouts.ts:88` FLAG_SPEC 36
- `backend/internal/application/process/trans_save_rules.go:55` stockCheckFlags
- `backend/internal/application/process/trans_credit.go:34` orderCredit
- `backend/internal/application/process/doc_cancel.go:52` ยกเลิก 37 / `:66` อนุมัติ 52

## ดูเพิ่ม
- [[doc-sale-reservation]] · [[doc-sale-invoice]] · [[doctypes-overview]]
