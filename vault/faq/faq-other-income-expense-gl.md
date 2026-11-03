---
title: "รายได้อื่นๆ (250) / ค่าใช้จ่ายอื่นๆ (260) ลงบัญชีเข้าบัญชีไหน ตั้งรหัสบัญชีที่ไหน"
tags: [faq, gl, other-income, other-expense, cash-bank]
aliases: ["รายได้อื่นลงบัญชียังไง", "ค่าใช้จ่ายอื่นลงบัญชียังไง", "other income expense journal", "trans_flag 250", "trans_flag 260", "OI", "EPO", "erp_income_list", "erp_expenses_list", "menu_cash_income_other"]
sources: ["backend/internal/application/process/service.go:1822", "backend/internal/application/process/service.go:1829", "backend/internal/application/process/gl_template.go:199", "backend/internal/application/process/service.go:1987", "backend/internal/application/process/service.go:2047", "backend/internal/application/process/service.go:2069", "backend/internal/application/process/service.go:1997", "backend/internal/application/process/gl_template_rules.go:43"]
---
# รายได้อื่นๆ (250) / ค่าใช้จ่ายอื่นๆ (260) ลงบัญชีเข้าบัญชีไหน ตั้งรหัสบัญชีที่ไหน

**ตอบสั้น:** บัญชีรายได้/ค่าใช้จ่ายมาจาก `gl_account_code` ของรายการใน `erp_income_list` / `erp_expenses_list` ตามรหัสในบรรทัดแรกของเอกสาร ถ้าไม่ได้ตั้ง ใช้บัญชีขาย (4111…) หรือบัญชีซื้อ (5111…) แทน ฝั่งเงินเป็นเงินสด/ธนาคารเมื่อเป็นเงินสดหรือมียอดจ่ายในแท็บชำระเงิน ไม่งั้นลงลูกหนี้/เจ้าหนี้

## รายละเอียด
ถ้ามีรูปแบบ GL ใช้รูปแบบก่อน (OI 250, OCN 252, ODN 254, EPO 260, EPC 262, EPD 264, ดู [[faq-gl-template-doc-format]]) ไม่มีจึงใช้เส้นมาตรฐาน ([[acc-gl-posting-standard]])

**รายได้อื่น** ([[doc-other-income]], [[doc-other-income-adjust]])
- 250 รายได้อื่น / 254 เพิ่มหนี้: Dr เงินตามแท็บชำระเงิน เมื่อ inquiry_type = 1 หรือมี `cb_trans.total_amount_pay > 0` ไม่งั้น Dr ลูกหนี้ / Cr รายได้ = base (+ มัดจำที่ตัดใช้) / Cr ภาษีขาย
- 252 ลดหนี้: Dr รายได้ / Dr ภาษีขาย / Cr เงินตามแท็บชำระเงินเสมอ

**ค่าใช้จ่ายอื่น** ([[doc-other-expense]], [[doc-other-expense-adjust]])
- 260 ค่าใช้จ่ายอื่น / 264 เพิ่มหนี้: Dr ค่าใช้จ่าย / Dr ภาษีซื้อ / Cr เงินตามแท็บชำระเงิน เมื่อ inquiry_type 1/3 หรือมียอดจ่าย ไม่งั้น Cr เจ้าหนี้
- 262 ลดหนี้: Dr เงินตามแท็บชำระเงินเสมอ / Cr ค่าใช้จ่าย / Cr ภาษีซื้อ

**รายได้/ค่าใช้จ่ายในแท็บชำระเงิน** ของเอกสารอื่น (`cb_trans_detail` doc_type 11/12) ใช้ `gl_account_code` ของรายการเช่นกัน ([[faq-ar-receipt-ap-payment-gl]])

## ข้อควรระวัง
- เส้นมาตรฐานอ่านรหัสบัญชีจาก **บรรทัดแรกที่มีรหัส** เท่านั้น เอกสารหลายบรรทัดต่างบัญชีจะลงบัญชีเดียวด้วยยอดรวม ถ้าต้องการแยก ใช้รูปแบบ GL
- 250/254 นับเป็นรับเงินเมื่อ inquiry_type = 1 (ไม่รวม 3) หรือมีแท็บชำระเงินที่ `cb_trans.total_amount_pay > 0` ส่วน 260/264 นับเป็นจ่ายเงินเมื่อ inquiry_type = 1 หรือ 3 (เว้นใบ 14/316 ที่ถือเป็นเงินเชื่อเสมอ) หรือมียอดจ่ายในแท็บชำระเงิน
- 252 และ 262 ลงเป็นเงินสดเสมอ ไม่ขึ้นกับ inquiry_type
- ไม่ได้ตั้งบัญชีในรายการ → รายได้อื่นเข้าบัญชีขาย ค่าใช้จ่ายอื่นเข้าบัญชีซื้อ

## ดูเพิ่ม
- [[faq-purchase-invoice-gl-posting]]
- [[faq-sale-invoice-gl-posting]]
- [[faq-bank-transfer-petty-cash]]
- [[acc-payment-tab]]

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:1822` 260/262/264 อ่านบัญชีจาก erp_expenses_list
- `backend/internal/application/process/service.go:1829` 250/252/254 อ่านบัญชีจาก erp_income_list
- `backend/internal/application/process/gl_template.go:199` SQL `gl_account_code` ของรายการ
- `backend/internal/application/process/service.go:1987-1988` 260/264 จ่ายสดเมื่อ inquiry 1/3 หรือมียอดจ่าย
- `backend/internal/application/process/service.go:2047` 250/254 รับเงินเมื่อ inquiry 1 หรือมียอดรับ
- `backend/internal/application/process/service.go:2069` 252 Cr เงินเสมอ
- `backend/internal/application/process/service.go:1997` 262 Dr เงินเสมอ
- `backend/internal/application/process/gl_template_rules.go:43` รหัสจอ EPC/EPD/EPO/OCN/ODN/OI
