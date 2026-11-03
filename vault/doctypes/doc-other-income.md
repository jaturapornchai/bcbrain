---
title: "รายได้อื่นๆ (Other Income)"
tags: [doctypes, cash-bank]
aliases: ["trans_flag 250", "รายได้อื่นๆ", "OI", "menu_cash_income_other", "menu_cb_receive_money"]
sources: ["frontend/account/tabs/transMenuMap.ts:1610", "frontend/account/tabs/transMenuMap.ts:2421", "frontend/account/transaction/transLayouts.ts:120", "frontend/account/transaction/transLayouts.ts:54", "backend/internal/application/process/service.go:1829", "backend/internal/application/process/gl_template.go:200", "backend/internal/application/process/service.go:2009", "backend/internal/application/process/service.go:2047", "backend/internal/application/process/service.go:2053", "backend/internal/application/process/trans_deposit.go:42", "backend/internal/application/process/trans_tax.go:41", "backend/internal/application/process/trans_save_rules.go:488", "backend/internal/application/process/trans_tax.go:48", "backend/internal/application/process/docs.go:600", "backend/internal/application/process/doc_flow.go:118", "backend/internal/application/process/doc_cancel.go:55"]
---

# รายได้อื่นๆ (trans_flag 250)

## ใช้เมื่อไร
ใช้บันทึกรายได้ที่ไม่ใช่การขายสินค้า มี 2 เมนูที่ใช้ flag 250 เหมือนกัน และทั้งสองตั้งค่าเริ่มต้น inquiry = 1 (`inquiryTypeDefault: 1`)
- "รายได้อื่นๆ" `menu_cash_income_other` (transMenuMap.ts:1610)
- "รายได้อื่นๆ" `menu_cb_receive_money` (transMenuMap.ts:2421)

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
- ภาษีขาย vat_calc +1 (`transVatTabs` trans_tax.go:41)
- WHT ฝั่ง "ar" คือภาษีที่ถูกหัก ณ ที่จ่าย (trans_tax.go:48)

## การลงบัญชี
ใช้ standard GL (service.go:2009) บัญชีรายได้มาจาก `erp_income_list.gl_account_code` ของรหัสรายได้บรรทัดแรก (`glSQLIncome` gl_template.go:200, service.go:1829-1834) ถ้าไม่มีค่าใช้ผังบัญชีตัวแรกที่มีใน 4111/4110/4100 (service.go:1801) ฝั่ง Dr เลือกเงินตามแท็บชำระที่ service.go:2047 และบัญชีมัดจำที่ใช้คือ 214220 ของกลุ่ม `depositSale` (trans_deposit.go:42, service.go:2053)
| Dr | Cr |
|---|---|
| เงินตามแท็บชำระ (`payTenders`) เมื่อ inquiry = 1 หรือ cb_trans มี total_amount_pay > 0 มิฉะนั้นเป็นลูกหนี้ ยอดรวม | รายได้ = ฐานภาษี + มัดจำที่ใช้ (advEx) |
| เงินมัดจำที่ใช้ (advEx) | ภาษีขาย |

## เอกสารต้นทาง-ปลายทาง
- ปลายทาง: ลดหนี้ 252 และเพิ่มหนี้ 254 (`billedRule("252, 254")` doc_flow.go:118)
- นับเป็นหนี้ลูกหนี้เฉพาะ inquiry 0/2 (`arDebtWhere` docs.go:600-601) แล้วไปต่อที่ใบวางบิล 235 และรับชำระ 239

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 251 (doc_cancel.go:55) ดู [[proc-doc-cancel-approve]]

## ข้อควรระวัง
- ตรวจวงเงินเครดิตลูกค้าที่ inquiry 0/2 (`creditChecked` trans_save_rules.go:488)
- เงื่อนไขที่ GL จะลงฝั่งเงินคือ inquiry = 1 หรือมีการชำระใน cb_trans (service.go:2043-2047) ส่วน inquiry 3 ที่ไม่มีการชำระจะลง Dr ลูกหนี้ แต่ไม่ถูกนับเป็นหนี้ใน `arDebtWhere`

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1610` / `:2421` เมนู
- `frontend/account/transaction/transLayouts.ts:120` FLAG_SPEC 250
- `backend/internal/application/process/service.go:2009-2060` GL
- `backend/internal/application/process/trans_tax.go:41` / `:48` VAT/WHT
- `backend/internal/application/process/doc_cancel.go:55` ยกเลิก 251

## ดูเพิ่ม
- [[doc-other-income-adjust]] · [[doc-other-expense]] · [[acc-payment-tab]] · [[acc-deposit-advance]] · [[acc-gl-posting-standard]] · [[doctypes-overview]]
