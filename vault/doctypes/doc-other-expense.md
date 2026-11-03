---
title: "ค่าใช้จ่ายอื่นๆ (Other Expense)"
tags: [doctypes, cash-bank]
aliases: ["trans_flag 260", "ค่าใช้จ่ายอื่นๆ", "EPO", "menu_cash_expense_other", "menu_cb_pay_money"]
sources: ["frontend/account/tabs/transMenuMap.ts:1704", "frontend/account/tabs/transMenuMap.ts:2436", "frontend/account/transaction/transLayouts.ts:123", "frontend/account/transaction/transLayouts.ts:54", "backend/internal/application/process/service.go:1822", "backend/internal/application/process/gl_template.go:199", "backend/internal/application/process/service.go:1976", "backend/internal/application/process/service.go:1988", "backend/internal/application/process/service.go:1993", "backend/internal/application/process/trans_deposit.go:40", "backend/internal/application/process/trans_tax.go:39", "backend/internal/application/process/trans_tax.go:48", "backend/internal/application/process/docs.go:604", "backend/internal/application/process/doc_flow.go:119", "backend/internal/application/process/doc_cancel.go:55"]
---

# ค่าใช้จ่ายอื่นๆ (trans_flag 260)

## ใช้เมื่อไร
ใช้บันทึกค่าใช้จ่ายที่ไม่ใช่การซื้อสินค้า มี 2 เมนูที่ใช้ flag 260 เหมือนกัน และทั้งสองตั้งค่าเริ่มต้น inquiry = 1 (`inquiryTypeDefault: 1`)
- "ค่าใช้จ่ายอื่นๆ" `menu_cash_expense_other` (transMenuMap.ts:1704)
- "ค่าใช้จ่ายอื่นๆ" `menu_cb_pay_money` (transMenuMap.ts:2436)

## trans_flag/ตาราง
- trans_flag 260 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]] โดยบรรทัดเป็นรหัสค่าใช้จ่าย
- แท็บชำระเขียนลง [[tbl-cb-trans]] / [[tbl-cb-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, refDoc, taxDoc, inquiry, vat
- แท็บ: pay, wht, vat, gl (transLayouts.ts:123)
- มีแท็บใช้เงินมัดจำ (`DEPOSIT_TAB_FLAGS` transLayouts.ts:54)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
- ภาษีซื้อ vat_calc +1 (`transVatTabs` trans_tax.go:39)
- WHT ฝั่ง "ap" คือภาษีหัก ณ ที่จ่าย (trans_tax.go:48)

## การลงบัญชี
ใช้ standard GL (service.go:1976) บัญชีค่าใช้จ่ายมาจาก `erp_expenses_list.gl_account_code` ของรหัสค่าใช้จ่ายบรรทัดแรก (`glSQLExpense` gl_template.go:199, service.go:1822-1827) ถ้าไม่มีค่าใช้ผังบัญชีตัวแรกที่มีใน 5111/5110/1151 (service.go:1800) ฝั่ง Cr เลือกเงินตามแท็บชำระที่ service.go:1988 และบัญชีมัดจำที่ตัดคือ 153010 ของกลุ่ม `depositPurchase` (trans_deposit.go:40, service.go:1993)
| Dr | Cr |
|---|---|
| ค่าใช้จ่าย = ฐานภาษี + มัดจำที่ใช้ (advEx) | เงินตามแท็บชำระ (`payTenders`) เมื่อ inquiry 1/3 หรือ cb_trans มี total_amount_pay > 0 มิฉะนั้นเป็นเจ้าหนี้ ยอดรวม |
| ภาษีซื้อ | เงินมัดจำที่ใช้ (advEx) |

## เอกสารต้นทาง-ปลายทาง
- ปลายทาง: ลดหนี้ 262 และเพิ่มหนี้ 264 (`billedRule("262, 264")` doc_flow.go:119)
- นับเป็นหนี้เจ้าหนี้เฉพาะ inquiry 0/2 (`apDebtWhere` docs.go:604-606) แล้วไปต่อที่ใบรับวางบิล 213 และจ่ายชำระ 19

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 261 (doc_cancel.go:55)

## ข้อควรระวัง
- ทั้งสองเมนูตั้ง inquiry = 1 ตั้งแต่ต้น (transMenuMap.ts:1704, :2436) ถ้าไม่เปลี่ยนเป็น 0/2 จะลง GL ฝั่งเงิน และไม่นับเป็นหนี้เจ้าหนี้ใน `apDebtWhere` (docs.go:604-606)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1704` / `:2436` เมนู
- `frontend/account/transaction/transLayouts.ts:123` FLAG_SPEC 260
- `backend/internal/application/process/service.go:1976-1994` GL
- `backend/internal/application/process/docs.go:604` apDebtWhere
- `backend/internal/application/process/doc_cancel.go:55` ยกเลิก 261

## ดูเพิ่ม
- [[doc-other-expense-adjust]] · [[doc-other-income]] · [[doc-ap-payment]] · [[acc-payment-tab]] · [[acc-vat-register-wht]] · [[doctypes-overview]]
