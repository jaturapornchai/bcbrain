---
title: "ใบสั่งจองสินค้า (Sales Reservation)"
tags: [doctypes, sale]
aliases: ["trans_flag 34", "ใบสั่งจอง", "ใบจอง", "SR"]
sources: ["frontend/account/tabs/transMenuMap.ts:586", "frontend/account/transaction/transLayouts.ts:87", "frontend/account/transaction/transLayouts.ts:175", "backend/internal/application/process/trans_credit.go:33", "backend/internal/application/process/trans_validate.go:209", "backend/internal/application/process/doc_cancel.go:52", "backend/internal/application/process/doc_cancel.go:66", "backend/internal/application/process/trans_ref_import.go:23", "backend/internal/application/process/doc_flow.go:91"]
---

# ใบสั่งจองสินค้า (trans_flag 34)

## ใช้เมื่อไร
ใช้รับจองสินค้าจากลูกค้า อ้างใบเสนอราคา 30 ได้ อยู่ที่เมนู "ใบสั่งจองสินค้า" (SR, transMenuMap.ts:586 เมนูใส่ transFlags 34/36)

## trans_flag/ตาราง
- trans_flag 34 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, contactor, refDoc, inquiry, vat, sale, approval, expire, send ไม่มีแท็บ (transLayouts.ts:87)
- มีช่องประเภทการส่ง (`SEND_TYPE_FLAGS` {34,36,44} transLayouts.ts:175)

## ผลต่อสต็อก
ไม่มี เพราะไม่อยู่ใน `stockRowsSQL` (stock_rebuild.go:18)

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ไม่ลง GL

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ใบเสนอราคา 30 (คู่ {34,30} trans_ref_import.go:23)
- ปลายทาง: ใบสั่งขาย 36 และขาย 44 (คู่ {36,34}, {44,34}) และ `flowRules` ระบุว่าใบสั่งซื้อ 6 อ้างใบจองได้ (doc_flow.go:91)
- ถ้าไม่มีเอกสารอนุมัติ approve_status ของใบจอง/ใบสั่งขายใช้ค่า ELSE = 1 ดู [[proc-doc-flow-numbering]]

## ยกเลิก/แก้ไข
- อนุมัติด้วย flag 38 และยกเลิกด้วย flag 39 รองรับยกเลิกรายสินค้า (doc_cancel.go:52, :66)

## ข้อควรระวัง
- ตรวจวงเงินแบบใบสั่ง (`orderCredit`) เฉพาะเมื่อเปิดตัวเลือกนั้น (trans_credit.go:33)
- ห้ามใช้ลูกค้าที่ถูกปิด (trans_validate.go:209)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:586` เมนู
- `frontend/account/transaction/transLayouts.ts:87` FLAG_SPEC 34
- `backend/internal/application/process/trans_credit.go:33` ตรวจวงเงินใบสั่ง
- `backend/internal/application/process/doc_cancel.go:52` ยกเลิก 39 / `:66` อนุมัติ 38
- `backend/internal/application/process/trans_ref_import.go:23` refImportSpecs

## ดูเพิ่ม
- [[doc-sale-quotation]] · [[doc-sale-order]] · [[doc-sale-invoice]] · [[proc-doc-cancel-approve]] · [[doctypes-overview]]
