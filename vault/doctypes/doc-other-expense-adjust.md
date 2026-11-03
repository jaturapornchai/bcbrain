---
title: "ลดหนี้/เพิ่มหนี้ค่าใช้จ่ายอื่นๆ (Other Expense Credit/Debit Note)"
tags: [doctypes, cash-bank]
aliases: ["trans_flag 262", "trans_flag 264", "ลดหนี้ค่าใช้จ่ายอื่นๆ", "เพิ่มหนี้ค่าใช้จ่ายอื่นๆ", "EPC", "EPD", "menu_cash_expense_other_credit", "menu_cash_expense_other_debit"]
sources: ["frontend/account/tabs/transMenuMap.ts:1719", "frontend/account/tabs/transMenuMap.ts:1737", "frontend/account/transaction/transLayouts.ts:124", "frontend/account/transaction/transLayouts.ts:125", "backend/internal/application/process/service.go:1965", "backend/internal/application/process/service.go:1984", "backend/internal/application/process/trans_tax.go:37", "backend/internal/application/process/trans_tax.go:48", "backend/internal/application/process/docs.go:604", "backend/internal/application/process/doc_cancel.go:55"]
---

# ลดหนี้ค่าใช้จ่ายอื่นๆ (262) / เพิ่มหนี้ค่าใช้จ่ายอื่นๆ (264)

## ใช้เมื่อไร
ใช้ลดหรือเพิ่มยอดของใบค่าใช้จ่ายอื่น 260
- 262 "ลดหนี้ค่าใช้จ่ายอื่นๆ" (transMenuMap.ts:1719)
- 264 "เพิ่มหนี้ค่าใช้จ่ายอื่นๆ" (transMenuMap.ts:1737)

## trans_flag/ตาราง
- เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]] และแท็บชำระเขียนลง [[tbl-cb-trans]]

## ฟิลด์/แท็บบนหน้าจอ
- 262 และ 264: party, taxDoc, inquiry, vat, docReason แท็บ pay, wht, vat, gl (transLayouts.ts:124, :125)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
- ภาษีซื้อ: 262 มี vat_calc −1 และ 264 มี +1 (trans_tax.go:37)
- WHT ฝั่ง "ap" ทั้งสองใบ (trans_tax.go:48)

## การลงบัญชี
| flag | Dr | Cr |
|---|---|---|
| 262 (service.go:1984) | เงินตามแท็บชำระ `payTenders(true)` **ทุกกรณี** | ค่าใช้จ่าย (ฐาน) + ภาษีซื้อ |
| 264 (service.go:1965) | ค่าใช้จ่าย + ภาษีซื้อ | เงินตามแท็บชำระเมื่อ inquiry 1/3 หรือมีการชำระใน cb_trans มิฉะนั้นเป็นเจ้าหนี้ |

บัญชีค่าใช้จ่ายใช้ `glSQLExpense` แบบเดียวกับ 260 (service.go:1811)

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ค่าใช้จ่ายอื่น 260 (doc_flow.go:119)
- 264 นับเป็นหนี้เจ้าหนี้ที่ inquiry 0/2 และ 262 นับเป็นเครดิตเจ้าหนี้ที่ inquiry 0/2 (docs.go:604-607)

## ยกเลิก/แก้ไข
- ยกเลิก 262 ด้วย 263 และยกเลิก 264 ด้วย 265 (doc_cancel.go:55)

## ข้อควรระวัง
- 262 ลง Dr ฝั่งเงินเสมอ ถึงจะเป็น inquiry 0/2 ซึ่ง `apCreditWhere` นับเป็นเครดิตเจ้าหนี้ ถ้าแท็บชำระว่างจะลงเป็นเงินสดบรรทัดเดียว (comment service.go:1858)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1719` / `:1737` เมนู
- `frontend/account/transaction/transLayouts.ts:124` / `:125` FLAG_SPEC
- `backend/internal/application/process/service.go:1984` GL 262 / `:1965` GL 264
- `backend/internal/application/process/docs.go:604` เงื่อนไขหนี้
- `backend/internal/application/process/doc_cancel.go:55` ยกเลิก

## ดูเพิ่ม
- [[doc-other-expense]] · [[doc-other-income-adjust]] · [[doctypes-overview]]
