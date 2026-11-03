---
title: "ตั้งหนี้อื่นๆ ลูกหนี้ (AR Other Receivable)"
tags: [doctypes, ar]
aliases: ["trans_flag 99", "ตั้งหนี้อื่นๆ (ลูกหนี้)", "AOB"]
sources: ["frontend/account/tabs/transMenuMap.ts:1449", "frontend/account/transaction/transLayouts.ts:110", "frontend/account/transaction/transLayouts.ts:54", "backend/internal/application/process/trans_tax.go:37", "backend/internal/application/process/service.go:2124", "backend/internal/application/process/trans_save_rules.go:488", "backend/internal/application/process/docs.go:597", "backend/internal/application/process/doc_cancel.go:54"]
---

# ตั้งหนี้อื่นๆ ฝั่งลูกหนี้ (trans_flag 99)

## ใช้เมื่อไร
ใช้ตั้งหนี้ลูกหนี้ที่ไม่ใช่การขายสินค้า อ้างใบเสนอราคา 30 ได้ อยู่ที่เมนู "ตั้งหนี้อื่นๆ (ลูกหนี้)" (AOB, transMenuMap.ts:1449)

## trans_flag/ตาราง
- trans_flag 99 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, taxDoc, vat แท็บ vat, gl (transLayouts.ts:110)
- มีแท็บใช้เงินมัดจำ (transLayouts.ts:54)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
- ภาษีขาย (trans_tax.go:37)
- ไม่มี WHT

## การลงบัญชี
ใช้ standard GL (service.go:2124)
| Dr | Cr |
|---|---|
| ลูกหนี้ ยอดรวม (ถ้า inquiry = 1 ใช้เงินสด) | รายได้อื่น 4210/4200/4111/4110 (ฐาน + advEx) |
| มัดจำ 214220 (advEx) | ภาษีขาย |

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ใบเสนอราคา 30
- ปลายทาง: เพิ่มหนี้ 101 และลดหนี้ 103 อ้างใบนี้ รวมถึงใบวางบิล 235 และรับชำระ 239
- นับเป็นหนี้ลูกหนี้ทุกใบ (`arDebtWhere` docs.go:597)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 100 (doc_cancel.go:54)

## ข้อควรระวัง
- ตรวจวงเงินลูกค้าเสมอเมื่อมีรหัสลูกค้า (`creditChecked` trans_save_rules.go:488)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1449` เมนู
- `frontend/account/transaction/transLayouts.ts:110` FLAG_SPEC 99
- `backend/internal/application/process/service.go:2124` GL
- `backend/internal/application/process/trans_save_rules.go:488` creditChecked
- `backend/internal/application/process/doc_cancel.go:54` ยกเลิก 100

## ดูเพิ่ม
- [[doc-ar-other-debit-credit-note]] · [[doc-other-income]] · [[doc-ar-receipt]] · [[doctypes-overview]]
