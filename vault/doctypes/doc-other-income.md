---
title: "รายได้อื่นๆ (Other Income)"
tags: [doctypes, cash-bank]
aliases: ["trans_flag 250", "รายได้อื่นๆ", "OI", "menu_cash_income_other", "menu_cb_receive_money"]
sources: ["frontend/account/tabs/transMenuMap.ts:1610", "frontend/account/tabs/transMenuMap.ts:2421", "frontend/account/transaction/transLayouts.ts:120", "frontend/account/transaction/transLayouts.ts:54", "backend/internal/application/process/service.go:1818", "backend/internal/application/process/service.go:1998", "backend/internal/application/process/trans_tax.go:37", "backend/internal/application/process/trans_tax.go:48", "backend/internal/application/process/docs.go:600", "backend/internal/application/process/doc_flow.go:118", "backend/internal/application/process/doc_cancel.go:55"]
---

# รายได้อื่นๆ (trans_flag 250)

## ใช้เมื่อไร
ใช้บันทึกรายได้ที่ไม่ใช่การขายสินค้า มีให้เลือก 2 เมนู
- "รายได้อื่นๆ" ฝั่งลูกหนี้ `menu_cash_income_other` (transMenuMap.ts:1610)
- "รายได้อื่นๆ" ฝั่งเงินสด/ธนาคาร `menu_cb_receive_money` ตั้งค่าเริ่มต้น inquiry = 1 (transMenuMap.ts:2421)

## trans_flag/ตาราง
- trans_flag 250 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]] โดยบรรทัดเป็นรหัสรายได้
- แท็บชำระเขียนลง [[tbl-cb-trans]] / [[tbl-cb-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, contactor, taxDoc, sale, inquiry, vat
- แท็บ: pay, wht, vat, gl (transLayouts.ts:120)
- มีแท็บใช้เงินมัดจำ (`DEPOSIT_TAB_FLAGS` transLayouts.ts:54)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
- ภาษีขาย vat_calc +1 (trans_tax.go:37)
- WHT ฝั่ง "ar" คือภาษีที่ถูกหัก ณ ที่จ่าย (trans_tax.go:48)

## การลงบัญชี
ใช้ standard GL (service.go:1998) บัญชีรายได้มาจากรหัสรายได้ของบรรทัดแรกผ่าน `glSQLIncome` (service.go:1818) ถ้าไม่พบใช้ 4111/4110/4100
| Dr | Cr |
|---|---|
| เงินตามแท็บชำระ (`payTenders`) เมื่อ inquiry = 1 หรือ cb_trans มี total_amount_pay > 0 มิฉะนั้นเป็นลูกหนี้ ยอดรวม | รายได้ = ฐานภาษี + มัดจำที่ใช้ (advEx) |
| เงินมัดจำที่ใช้ (advEx) | ภาษีขาย |

## เอกสารต้นทาง-ปลายทาง
- ปลายทาง: ลดหนี้ 252 และเพิ่มหนี้ 254 (`billedRule("252, 254")` doc_flow.go:118)
- นับเป็นหนี้ลูกหนี้เฉพาะ inquiry 0/2 (`arDebtWhere` docs.go:600) แล้วไปต่อที่ใบวางบิล 235 และรับชำระ 239

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 251 (doc_cancel.go:55) ดู [[proc-doc-cancel-approve]]

## ข้อควรระวัง
- ตรวจวงเงินเครดิตลูกค้าที่ inquiry 0/2 (`creditChecked` trans_save_rules.go:488)
- เงื่อนไขที่ GL จะลงฝั่งเงินคือ inquiry = 1 หรือมีการชำระใน cb_trans ส่วน inquiry 3 ที่ไม่มีการชำระจะลง Dr ลูกหนี้ แต่ไม่ถูกนับเป็นหนี้ใน `arDebtWhere`

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1610` / `:2421` เมนู
- `frontend/account/transaction/transLayouts.ts:120` FLAG_SPEC 250
- `backend/internal/application/process/service.go:1998` GL
- `backend/internal/application/process/trans_tax.go:37` / `:48` VAT/WHT
- `backend/internal/application/process/doc_cancel.go:55` ยกเลิก 251

## ดูเพิ่ม
- [[doc-other-income-adjust]] · [[doc-other-expense]] · [[acc-payment-tab]] · [[acc-deposit-advance]] · [[acc-gl-posting-standard]] · [[doctypes-overview]]
