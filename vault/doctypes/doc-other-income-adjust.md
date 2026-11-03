---
title: "ลดหนี้/เพิ่มหนี้รายได้อื่นๆ (Other Income Credit/Debit Note)"
tags: [doctypes, cash-bank]
aliases: ["trans_flag 252", "trans_flag 254", "ลดหนี้รายได้อื่นๆ", "เพิ่มหนี้รายได้อื่นๆ", "OCN", "ODN", "menu_cash_income_other_credit", "menu_cash_income_other_debit"]
sources: ["frontend/account/tabs/transMenuMap.ts:1625", "frontend/account/tabs/transMenuMap.ts:1643", "frontend/account/transaction/transLayouts.ts:121", "frontend/account/transaction/transLayouts.ts:122", "backend/internal/application/process/service.go:2009", "backend/internal/application/process/service.go:2047", "backend/internal/application/process/service.go:2061", "backend/internal/application/process/service.go:2069", "backend/internal/application/process/service.go:1829", "backend/internal/application/process/service.go:1869", "backend/internal/application/process/trans_tax.go:41", "backend/internal/application/process/docs.go:602", "backend/internal/application/process/doc_flow.go:118", "backend/internal/application/process/trans_tax.go:48", "backend/internal/application/process/docs.go:600", "backend/internal/application/process/doc_cancel.go:55"]
---

# ลดหนี้รายได้อื่นๆ (252) / เพิ่มหนี้รายได้อื่นๆ (254)

## ใช้เมื่อไร
ใช้ลดหรือเพิ่มยอดของใบรายได้อื่น 250
- 252 "ลดหนี้รายได้อื่นๆ" (transMenuMap.ts:1625)
- 254 "เพิ่มหนี้รายได้อื่นๆ" (transMenuMap.ts:1643)

## trans_flag/ตาราง
- เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]] และแท็บชำระเขียนลง [[tbl-cb-trans]]

## ฟิลด์/แท็บบนหน้าจอ
- 252: party, taxDoc, sale, inquiry, vat, docReason แท็บ pay, wht, vat, gl (transLayouts.ts:121)
- 254: party, taxDoc, sale, inquiry, vat, docReason แท็บ pay, vat, gl ไม่มี wht (transLayouts.ts:122)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
- ภาษีขาย: 252 มี vat_calc −1 และ 254 มี +1 (`transVatTabs` trans_tax.go:41)
- WHT "ar" มีเฉพาะ 252 (trans_tax.go:48)

## การลงบัญชี
| flag | Dr | Cr |
|---|---|---|
| 252 (service.go:2061, เงื่อนไข :2069) | รายได้ (ฐาน) + ภาษีขาย | เงินตามแท็บชำระ `payTenders(false)` **ทุกกรณี** |
| 254 (service.go:2009, เงื่อนไข :2047) | เงินตามแท็บชำระเมื่อ inquiry = 1 หรือมีการชำระใน cb_trans มิฉะนั้นเป็นลูกหนี้ | รายได้ + ภาษีขาย |

บัญชีรายได้ใช้ `glSQLIncome` แบบเดียวกับ 250 (service.go:1829-1834)

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: รายได้อื่น 250 (doc_flow.go:118)
- 254 นับเป็นหนี้ลูกหนี้ที่ inquiry 0/2 และ 252 นับเป็นเครดิตลูกหนี้ที่ inquiry 0/2 (`arDebtWhere` docs.go:600-601, `arCreditWhere` docs.go:602-603)

## ยกเลิก/แก้ไข
- ยกเลิก 252 ด้วย 253 และยกเลิก 254 ด้วย 255 (doc_cancel.go:55)

## ข้อควรระวัง
- 252 ลง Cr ฝั่งเงิน (`payTenders`) เสมอ ถึงจะเป็น inquiry 0/2 ซึ่ง `arCreditWhere` นับเป็นเครดิตลูกหนี้ ถ้าแท็บชำระว่าง `payTenders` จะลงเป็นเงินสดบรรทัดเดียว (comment service.go:1869) จึงอาจไม่ตรงกับยอดลูกหนี้

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1625` / `:1643` เมนู
- `frontend/account/transaction/transLayouts.ts:121` / `:122` FLAG_SPEC
- `backend/internal/application/process/service.go:2061` GL 252 / `:2009` GL 254
- `backend/internal/application/process/docs.go:600` / `:602` เงื่อนไขหนี้
- `backend/internal/application/process/doc_cancel.go:55` ยกเลิก

## ดูเพิ่ม
- [[doc-other-income]] · [[doc-other-expense-adjust]] · [[acc-gl-posting-standard]] · [[doctypes-overview]]
