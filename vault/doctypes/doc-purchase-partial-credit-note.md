---
title: "ลดหนี้ซื้อจากใบตั้งหนี้ (Credit Note on Receipt Invoice)"
tags: [doctypes, purchase]
aliases: ["trans_flag 317", "ลดหนี้ซื้อจากใบตั้งหนี้", "PIC"]
sources: ["frontend/account/tabs/transMenuMap.ts:420", "frontend/account/transaction/transLayouts.ts:132", "frontend/account/transaction/transLayouts.ts:37", "backend/internal/application/process/stock_rebuild.go:19", "backend/internal/application/process/transcalc.go:22", "backend/internal/application/process/trans_tax.go:39", "backend/internal/application/process/trans_tax.go:48", "backend/internal/application/process/service.go:1995", "backend/internal/application/process/service.go:1997", "backend/internal/application/process/service.go:1958", "backend/internal/application/process/pay_check.go:43", "backend/internal/application/process/docs.go:607", "backend/internal/application/process/doc_cancel.go:50"]
---

# ลดหนี้ซื้อจากใบตั้งหนี้ (trans_flag 317)

## ใช้เมื่อไร
ใช้ลดหนี้ของใบตั้งหนี้ 315 อยู่ที่เมนู "ลดหนี้ซื้อจากใบตั้งหนี้" (PIC, transMenuMap.ts:420)

## trans_flag/ตาราง
- trans_flag 317, calc_flag −1 (transcalc.go:22) เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, taxDoc, refDoc, inquiry, vat, docReason, refAmounts แท็บ pay, vat, gl ไม่มีแท็บ WHT (transLayouts.ts:132)
- ประเภทการส่งคืนใช้ `RETURN_TYPE` เหมือนใบ 16 (transLayouts.ts:37)
- แท็บชำระเปิดเมื่อ inquiry เป็น 2 หรือ 3 (`payTabEnabled` pay_check.go:43-44)

## ผลต่อสต็อก
ไม่มี เพราะไม่อยู่ในรายการ flag ของ `stockRowsSQL` (stock_rebuild.go:19)

## ผลต่อภาษี (VAT/WHT)
- ภาษีซื้อ vat_calc −1 (`transVatTabs` trans_tax.go:39)
- ไม่มี WHT เพราะไม่อยู่ใน `transWhtParty` (trans_tax.go:48)

## การลงบัญชี
ใช้ standard GL ชุดเดียวกับใบ 16 (service.go:1995) เงื่อนไขฝั่ง Dr อยู่ที่ service.go:1997
| Dr | Cr |
|---|---|
| ถ้า inquiry ≥ 2 ใช้เงินที่รับคืน, นอกนั้นใช้เจ้าหนี้ | ซื้อ (ฐาน) + ภาษีซื้อ |

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ตั้งหนี้ 315 (transMenuMap.ts:420)
- นับเป็นเครดิตเจ้าหนี้เมื่อ inquiry เป็น 0 หรือ 1 (`apCreditWhere` docs.go:607)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 337 (doc_cancel.go:50)

## ข้อควรระวัง
- ใบ 315 Dr 212015 แต่ใบ 317 Cr "ซื้อ" ตาม standard GL ทั้งสองใบจึงไม่ได้ใช้บัญชีเดียวกัน (service.go:1958 เทียบ :1995)
- RETURN_TYPE 0 เขียนว่า "ลดสินค้า" แต่ 317 ไม่อยู่ใน `stockRowsSQL` สต็อกจึงไม่ขยับ

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:420` เมนู
- `frontend/account/transaction/transLayouts.ts:132` FLAG_SPEC 317
- `backend/internal/application/process/service.go:1995` GL
- `backend/internal/application/process/docs.go:607` apCreditWhere
- `backend/internal/application/process/doc_cancel.go:50` ยกเลิก 337

## ดูเพิ่ม
- [[doc-purchase-partial-invoice]] · [[doc-purchase-return]] · [[doctypes-overview]]
