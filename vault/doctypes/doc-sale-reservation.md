---
title: "ใบสั่งจองสินค้า (Sales Reservation)"
tags: [doctypes, sale]
aliases: ["trans_flag 34", "ใบสั่งจอง", "ใบจอง", "SR"]
sources: ["frontend/account/tabs/transMenuMap.ts:586", "frontend/account/transaction/transLayouts.ts:87", "frontend/account/transaction/transLayouts.ts:175", "backend/internal/application/process/trans_credit.go:34", "backend/internal/application/process/trans_validate.go:210", "backend/internal/application/process/doc_cancel.go:38", "backend/internal/application/process/doc_cancel.go:52", "backend/internal/application/process/doc_cancel.go:66", "backend/internal/application/process/trans_ref_import.go:31", "backend/internal/application/process/trans_ref_import.go:33", "backend/internal/application/process/trans_ref_import.go:37", "backend/internal/application/process/doc_flow.go:101", "backend/internal/application/process/service.go:1742", "backend/internal/application/process/stock_rebuild.go:19"]
---

# ใบสั่งจองสินค้า (trans_flag 34)

## ใช้เมื่อไร
ใช้รับจองสินค้าจากลูกค้า อ้างใบเสนอราคา 30 ได้ อยู่ที่เมนู "ใบสั่งจองสินค้า" (SR, `menu_so_inquiry_order` transMenuMap.ts:586 เมนูใส่ transFlags 34/36)

## trans_flag/ตาราง
- trans_flag 34 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, contactor, refDoc, inquiry, vat, sale, approval, expire, send ไม่มีแท็บ (transLayouts.ts:87)
- มีช่องประเภทการส่ง (`SEND_TYPE_FLAGS` transLayouts.ts:175)

## ผลต่อสต็อก
ไม่มี เพราะไม่อยู่ในชุด flag ของ `stockRowsSQL` (stock_rebuild.go:19)

## ผลต่อภาษี (VAT/WHT)
ไม่มี (ไม่อยู่ใน `transVatTabs` / `transWhtParty` trans_tax.go:37, :48)

## การลงบัญชี
ไม่ลง GL (ไม่อยู่ใน `glRebuildTransFlags` service.go:1742)

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ใบเสนอราคา 30 (คู่ {34,30} trans_ref_import.go:31)
- ปลายทาง: ใบสั่งขาย 36 และขาย 44 (คู่ {36,34} trans_ref_import.go:33, {44,34} :37)
- `flowRules` ของ 34 ถือว่าถูกใช้เมื่อมีเอกสารอนุมัติ 38, บรรทัดของ 36/44 หรือใบสั่งซื้อ 6 อ้างถึง, ยกเลิกบางส่วน 39 หรือมีบันทึกอนุมัติวงเงิน และถ้าไม่มีเอกสารอนุมัติ approve_status ใช้ค่า 1 (`approveElse: 1` doc_flow.go:101) ดู [[proc-doc-flow-numbering]]

## ยกเลิก/แก้ไข
- อนุมัติด้วย flag 38 (doc_cancel.go:66) และยกเลิกด้วย flag 39 (doc_cancel.go:52) ยกเลิกรายสินค้าได้ (cancel_type 2, doc_cancel.go:38)

## ข้อควรระวัง
- ตรวจวงเงินแบบใบสั่ง (`checkOrderCredit`) เฉพาะเมื่อเปิดตัวเลือก `orderCredit` (trans_credit.go:34-38)
- เอกสารใหม่ห้ามใช้ลูกค้าที่ status = 1 (`closedCustomerFlags` trans_validate.go:210)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:586` เมนู
- `frontend/account/transaction/transLayouts.ts:87` FLAG_SPEC 34
- `backend/internal/application/process/trans_credit.go:34` ตรวจวงเงินใบสั่ง
- `backend/internal/application/process/doc_flow.go:101` flowRules 34
- `backend/internal/application/process/doc_cancel.go:52` ยกเลิก 39 / `:66` อนุมัติ 38
- `backend/internal/application/process/trans_ref_import.go:31` refImportSpecs

## ดูเพิ่ม
- [[doc-sale-quotation]] · [[doc-sale-order]] · [[doc-sale-invoice]] · [[proc-doc-cancel-approve]] · [[doctypes-overview]]
