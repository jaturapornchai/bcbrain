---
title: "เพิ่มหนี้/ลดหนี้อื่นๆ ลูกหนี้ (AR Other Debit/Credit Note)"
tags: [doctypes, ar]
aliases: ["trans_flag 101", "trans_flag 103", "เพิ่มหนี้อื่นๆ (ลูกหนี้)", "ลดหนี้อื่นๆ (ลูกหนี้)", "ADO", "ACO"]
sources: ["frontend/account/tabs/transMenuMap.ts:1466", "frontend/account/tabs/transMenuMap.ts:1483", "frontend/account/transaction/transLayouts.ts:111", "backend/internal/application/process/trans_tax.go:37", "backend/internal/application/process/service.go:2124", "backend/internal/application/process/docs.go:597", "backend/internal/application/process/doc_cancel.go:54"]
---

# เพิ่มหนี้อื่นๆ (101) / ลดหนี้อื่นๆ (103) ฝั่งลูกหนี้

## ใช้เมื่อไร
ใช้เพิ่มหรือลดหนี้ของใบตั้งหนี้อื่น 99
- 101 "เพิ่มหนี้อื่นๆ (ลูกหนี้)" (ADO, transMenuMap.ts:1466)
- 103 "ลดหนี้อื่นๆ (ลูกหนี้)" (ACO, transMenuMap.ts:1483)

## trans_flag/ตาราง
- เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- 101: party, taxDoc, vat, docReason แท็บ vat, gl (transLayouts.ts:111)
- 103: party, vat, taxDoc, docReason แท็บ vat, gl (transLayouts.ts:112)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
- ภาษีขาย: 101 เป็นบวก ส่วน 103 มี vat_calc −1 (trans_tax.go:37)

## การลงบัญชี
ใช้ standard GL ชุดเดียวกับ 99 (service.go:2124)
| flag | Dr | Cr |
|---|---|---|
| 101 | ลูกหนี้ (inquiry 1 ใช้เงินสด) | รายได้อื่น + ภาษีขาย |
| 103 | รายได้อื่น + ภาษีขาย | ลูกหนี้ (กลับข้างทั้งหมด) |

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ตั้งหนี้อื่น 99 (`flowRules` ของ 99 นับจาก 101/103 doc_flow.go:117)
- 101 นับเป็นหนี้ ส่วน 103 นับเป็นเครดิตลูกหนี้ (docs.go:597)

## ยกเลิก/แก้ไข
- ยกเลิก 101 ด้วย 102 และยกเลิก 103 ด้วย 104 (doc_cancel.go:54)

## ข้อควรระวัง
- ไม่มีช่อง inquiry บนจอของ 101/103 (FLAG_SPEC)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1466` / `:1483` เมนู
- `frontend/account/transaction/transLayouts.ts:111` FLAG_SPEC 101/103
- `backend/internal/application/process/service.go:2124` GL
- `backend/internal/application/process/doc_cancel.go:54` ยกเลิก 102/104

## ดูเพิ่ม
- [[doc-ar-other-debt]] · [[doctypes-overview]]
