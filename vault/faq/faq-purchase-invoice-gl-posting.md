---
title: "ซื้อสินค้า (ใบซื้อ 12) ลงบัญชี GL ยังไง ภาษีซื้อเข้าบัญชีไหน"
tags: [faq, gl, purchase, ap, vat]
aliases: ["ซื้อเชื่อลงบัญชียังไง", "ซื้อสดลง GL", "purchase invoice journal", "trans_flag 12", "trans_flag 315", "menu_po_purchase_billing", "Dr ซื้อ Cr เจ้าหนี้", "ภาษีซื้อ 1154"]
sources: ["backend/internal/application/process/service.go:1965", "backend/internal/application/process/service.go:1976", "backend/internal/application/process/service.go:1785", "backend/internal/application/process/service.go:1829", "backend/internal/application/process/trans_deposit.go:48", "backend/internal/application/process/service.go:1860"]
---
# ซื้อสินค้า (ใบซื้อ 12) ลงบัญชี GL ยังไง ภาษีซื้อเข้าบัญชีไหน

**ตอบสั้น:** ซื้อเชื่อ = Dr ซื้อ / Dr ภาษีซื้อ / Cr เจ้าหนี้ ยอดสุทธิ ซื้อสด (inquiry 1/3) = Cr เงินสด-ธนาคาร-เช็คตามแท็บชำระเงินแทนเจ้าหนี้ ภาษีซื้อลงบัญชีแรกที่มีในผังจาก 1154/1151/1155/1190

## รายละเอียด
การลงบัญชีมาตรฐานของกลุ่ม 12, 14, 18, 316, 260, 264, 87, 89 ([[acc-gl-posting-standard]]) ทำงานเมื่อรหัสเอกสารไม่มีรูปแบบ GL (PU ใช้ glRule43, ดู [[faq-gl-template-doc-format]])
- **Dr ซื้อ** = base (total − vat) + มัดจำที่ตัดใช้ (ยอดก่อน VAT) บัญชีตั้งต้น 5111/5110/1151
- **Dr ภาษีซื้อ** = vat บัญชี 1154/1151/1155/1190
- **ฝั่งเครดิต**
  - inquiry 1 หรือ 3 (ยกเว้น 14/316 ที่ถือเป็นเงินเชื่อเสมอ) → Cr ตามแท็บชำระเงินจาก `cb_trans`: เงินสด / ธนาคาร (โอน+wallet) / เช็คจ่าย 2112 / บัตร / ภาษีหัก ณ ที่จ่าย 2122/2123/2120 ถ้ายอดแยกรวมไม่ตรงยอดเงิน ใช้เงินสดบรรทัดเดียว ([[acc-payment-tab]])
  - นอกนั้น → Cr เจ้าหนี้ 2111/2110/2100 เต็ม total
- **มัดจำจ่ายที่ตัดใช้** → Cr บัญชีมัดจำซื้อ 153010 ([[acc-deposit-advance]]) ยอดมัดจำคำนวณก่อน VAT: ถ้าเอกสาร vat_type 1 ใช้ `advance_amount × 100 / (100 + vat_rate)`

ตัวอย่างซื้อเชื่อ 1,070 (VAT 70): Dr ซื้อ 1,000 / Dr ภาษีซื้อ 70 / Cr เจ้าหนี้ 1,070

## ข้อควรระวัง
- ใบซื้อเงินเชื่อไม่มีบรรทัดภาษีหัก ณ ที่จ่ายใน GL ถึงจะกรอกแท็บภาษีหัก ณ ที่จ่ายไว้ (ภาษีหักลงบัญชีผ่านชุดรายการชำระเงินเท่านั้น เช่นตอนจ่ายชำระ 19) ดู [[faq-wht-certificate-pnd]]
- ลิสต์บัญชีตั้งต้นของซื้อมี 1151 ซึ่งอยู่ในลิสต์ภาษีซื้อด้วย ถ้าผังไม่มี 5111/5110 ยอดซื้อจะเข้า 1151 ได้
- 260/264 (ค่าใช้จ่ายอื่น) นับเป็นจ่ายสดเมื่อมี `cb_trans.total_amount_pay > 0` ด้วย ดู [[faq-other-income-expense-gl]]

## ดูเพิ่ม
- [[doc-purchase-invoice]]
- [[faq-sale-return-credit-note-gl]]
- [[faq-ar-receipt-ap-payment-gl]]
- [[faq-vat-purchase-sale-report]]
- [[flow-procure-to-pay]]

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:1965` case ซื้อ 12/14/18/316/260/264/87/89
- `backend/internal/application/process/service.go:1976` เงื่อนไขซื้อสด inquiry 1/3 และ hasCbPay ของ 260/264
- `backend/internal/application/process/service.go:1785` รหัสบัญชีตั้งต้น ซื้อ/ภาษีซื้อ/เจ้าหนี้
- `backend/internal/application/process/service.go:1829` คำนวณมัดจำที่ตัดใช้แบบก่อน VAT
- `backend/internal/application/process/trans_deposit.go:48` ผังบัญชีมัดจำต่อ trans_flag
- `backend/internal/application/process/service.go:1860` `payTenders` แยกเงินสด ธนาคาร เช็ค บัตร ภาษีหัก
