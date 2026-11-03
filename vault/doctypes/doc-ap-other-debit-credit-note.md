---
title: "เพิ่มหนี้/ลดหนี้อื่นๆ เจ้าหนี้ (AP Other Debit/Credit Note)"
tags: [doctypes, ap]
aliases: ["trans_flag 89", "trans_flag 91", "เพิ่มหนี้อื่นๆ (เจ้าหนี้)", "ลดหนี้อื่นๆ (เจ้าหนี้)", "CDO", "CCO"]
sources: ["frontend/account/tabs/transMenuMap.ts:1268", "frontend/account/tabs/transMenuMap.ts:1285", "frontend/account/transaction/transLayouts.ts:105", "backend/internal/application/process/trans_tax.go:37", "backend/internal/application/process/service.go:1965", "backend/internal/application/process/service.go:1984", "backend/internal/application/process/docs.go:597", "backend/internal/application/process/doc_cancel.go:54"]
---

# เพิ่มหนี้อื่นๆ (89) / ลดหนี้อื่นๆ (91) ฝั่งเจ้าหนี้

## ใช้เมื่อไร
ใช้เพิ่มหรือลดหนี้ของใบตั้งหนี้อื่น 87
- 89 เพิ่มหนี้อื่นๆ (CDO, transMenuMap.ts:1285)
- 91 ลดหนี้อื่นๆ (CCO, transMenuMap.ts:1268)

## trans_flag/ตาราง
- เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, taxDoc, vat, docReason แท็บ vat, gl (transLayouts.ts:105 สำหรับ 89, :105 สำหรับ 91)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
- ภาษีซื้อ: 89 เป็นบวก ส่วน 91 มี vat_calc −1 (trans_tax.go:37)
- ไม่มี WHT

## การลงบัญชี
| flag | Dr | Cr | ที่มา |
|---|---|---|---|
| 89 | ค่าใช้จ่าย (บัญชีจาก item_code ถ้ามี) + ภาษีซื้อ | เจ้าหนี้ หรือเงินที่จ่าย ถ้า inquiry เป็น 1/3 | service.go:1965 |
| 91 | เจ้าหนี้ ยอดรวม | ค่าใช้จ่าย + ภาษีซื้อ | service.go:1984 |

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ตั้งหนี้อื่น 87 (`flowRules` ของ 87 นับจาก 89/91 doc_flow.go:91)
- 89 นับเป็นหนี้เจ้าหนี้ ส่วน 91 นับเป็นเครดิต (docs.go:597)

## ยกเลิก/แก้ไข
- ยกเลิก 89 ด้วย 90 และยกเลิก 91 ด้วย 92 (doc_cancel.go:54)

## ข้อควรระวัง
- 89/91 ไม่มีช่อง inquiry บนจอ (FLAG_SPEC) ค่า inquiry จึงเป็นค่าเริ่มต้นของเอกสาร

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1268` / `:1285` เมนู
- `frontend/account/transaction/transLayouts.ts:105` FLAG_SPEC 89/91
- `backend/internal/application/process/service.go:1965` / `:1984` GL
- `backend/internal/application/process/docs.go:597` เงื่อนไขหนี้
- `backend/internal/application/process/doc_cancel.go:54` ยกเลิก 90/92

## ดูเพิ่ม
- [[doc-ap-other-debt]] · [[doctypes-overview]]
