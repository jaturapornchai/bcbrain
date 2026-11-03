---
title: "แท็บรับ/จ่ายชำระ (เงินสด โอน เช็ค บัตร PromptPay ภาษีหัก) เก็บและลงบัญชีอย่างไร ทำไมขึ้น \"ยอดการจ่ายเงินไม่สมบูรณ์\""
tags: [faq, payment, cash-bank, cheque, gl, wht]
aliases: ["แท็บชำระเงิน", "ช่องทางชำระ", "ยอดการจ่ายเงินไม่สมบูรณ์", "pay tab tenders", "cb_trans", "cb_trans_detail doc_type", "payTenders", "PromptPay", "total_tax_at_pay", "เงินทอน"]
sources: ["backend/internal/application/process/pay_check.go:36", "backend/internal/application/process/pay_check.go:57", "backend/internal/application/process/pay_check.go:142", "backend/internal/application/process/pay_check.go:263", "backend/internal/application/process/trans.go:1331", "backend/internal/application/process/trans.go:1338", "backend/internal/application/process/service.go:1860", "backend/internal/application/process/pay_other.go:60"]
---
# แท็บรับ/จ่ายชำระ (เงินสด โอน เช็ค บัตร PromptPay ภาษีหัก) เก็บและลงบัญชีอย่างไร ทำไมขึ้น "ยอดการจ่ายเงินไม่สมบูรณ์"

**ตอบสั้น:** ยอดรวมแต่ละช่องทางเก็บใน `cb_trans` และแถวย่อยใน `cb_trans_detail` (โอน 1, เช็ค 2, บัตร 3, PromptPay 21, ค่าใช้จ่ายอื่น 11, รายได้อื่น 12) ตอนบันทึก ผลรวมช่องทาง + ภาษีถูกหัก + รายได้อื่น ต้องเท่ายอดสุทธิ + ค่าใช้จ่ายอื่น ถ้าไม่เท่าจะขึ้น "ยอดการจ่ายเงินไม่สมบูรณ์" GL แยกบรรทัดตามช่องทาง

## รายละเอียด
ดู [[acc-payment-tab]], [[term-pay-tenders]], [[tbl-cb-trans]], [[tbl-cb-trans-detail]]

**แท็บเปิดเมื่อ (`payTabEnabled`)** เอกสารที่ไม่มีช่องเงินสด/เงินเชื่อ เปิดเสมอ ที่มีช่องนี้:
- 11 จ่ายมัดจำ: `inquiry_type` 0
- 16, 317: inquiry 2 หรือ 3
- 48 รับคืน/ลดหนี้ขาย: inquiry 1, 3 หรือ 5
- อื่นๆ (12, 44, 250, 260, 315 ฯลฯ): inquiry 1 หรือ 3 ([[term-inquiry-type]])

**การเก็บ (`payStmts`)**
- ลบ `cb_trans_detail`, `cb_trans`, `cb_chq_list` (ตาม `doc_ref`) ของเอกสารเดิม แล้วเขียนใหม่ทั้งชุด
- ฝั่งรับเงิน (`payReceiveFlags`: 16, 20, 25, 40, 44, 46, 99, 110, 239, 250, 254, 262, 300, 317, 402, 416) `pay_type` = 1 อื่นๆ = 2
- เช็ค/บัตรสร้างแถว `cb_chq_list` ด้วย เช็ครับใช้ธนาคารของลูกค้า เช็คจ่ายใช้สมุดบัญชีบริษัท ([[faq-cheque-received-lifecycle]], [[faq-cheque-paid-lifecycle]])
- ช่องรับเงิน/เงินทอน (`pay_cash_amount`, `money_change`) มีเฉพาะ 44 และ 144
- ยอดติดลบ → "ยอดรับ/จ่ายชำระต้องไม่ติดลบ"

**ตรวจยอด (`payCompleteCheck`, `checkPayTotal`)**
- ปัดแต่ละช่องแบบ HALF_UP ที่ `item_amount_decimal` ก่อนรวม ([[faq-rounding-decimal]])
- ภาษีถูกหัก = `cb_trans.total_tax_at_pay` หรือผลรวม `gl_wht_list.tax_value` ([[faq-wht-certificate-pnd]])
- ไม่เท่า → "ยอดการจ่ายเงินไม่สมบูรณ์ (ยอดสุทธิ X ยอดชำระ Y)" ตัวเลขมีจุลภาค
- รหัสรายได้/ค่าใช้จ่ายอื่นตรวจที่ `parsePayOther` ([[faq-other-income-expense-gl]])

**GL (`payTenders` ใน `buildStandardGLLines`)**

| ช่องทาง | ฝั่งรับเงิน (Dr) | ฝั่งจ่ายเงิน (Cr) |
|---|---|---|
| เงินสด | 1111/1110/1100 | เดียวกัน |
| โอน + wallet | ธนาคาร | ธนาคาร |
| เช็ค | 1122 | 2112 |
| บัตร | ลูกหนี้ (รอขึ้นเงิน 461) | ธนาคาร |
| ภาษีถูกหัก | 1153/1154/1152/2122 | 2122/2123/2120 |

- แยกบรรทัดเฉพาะเมื่อผลรวมช่องทาง (ปัด 2) เท่ายอดเงิน ไม่เท่าลงเงินสดบรรทัดเดียว
- มีแค่ภาษีถูกหักโดยไม่มีช่องทางอื่น เงินสด = ยอด − ภาษีหัก
- ธนาคารใช้สมุดบัญชีจาก `ic_trans_detail.item_code` / `cb_trans_detail.pass_book_code` / `ic_trans.pass_book_code` ถ้ามี

**จ่ายเกินยอดค้าง (`payExceedsBalance`)** ใบรับ/จ่ายชำระคำนวณยอดค้างใหม่จากหนี้ที่เก็บจริง ยอดค้าง 0 แต่จ่าย ≠ 0 ถูกปฏิเสธ ([[faq-ar-receipt-ap-payment-gl]])

## ข้อควรระวัง
- คอมเมนต์ของ `payExceedsBalance` เขียนว่ายอดค้างศูนย์ "is not checked" แต่โค้ดคืน `pay != 0` คือปฏิเสธ (`pay_check.go:261-270`)
- `total_tax_at_pay` เก็บ 2 ตำแหน่งตายตัว (`pay_check.go:78`)
- ชื่อคอลัมน์ `cb_trans.tranfer_amount` สะกดแบบนี้ในฐานข้อมูล
- แท็บรับชำระลงเช็คที่ 1122 แต่เอกสารนำฝากเช็คใช้ 1122-00 ก่อน
- บัตรฝั่งรับเงินลง Dr บัญชีลูกหนี้ (ไม่ใช่บัญชีบัตรแยก)

## ดูเพิ่ม
- [[acc-payment-tab]]
- [[hist-lessons-payment-cheque-tenders]]
- [[faq-ar-receipt-ap-payment-gl]]
- [[faq-other-income-expense-gl]]
- [[doc-credit-card]]

## ที่มาในโค้ด
- `backend/internal/application/process/pay_check.go:36` `payTabEnabled`; `:57` `payCompleteCheck` (`:78` ภาษีหัก 2 ตำแหน่ง)
- `backend/internal/application/process/pay_check.go:86` `sumPayTenderRows`; `:110` `payTenders`; `:131` `payAllTenders`
- `backend/internal/application/process/pay_check.go:142` `checkPayTotal` (ข้อความ `:151`); `:263` `payExceedsBalance`
- `backend/internal/application/process/pay_other.go:43` `payCashFlags`; `:60` `parsePayOther`
- `backend/internal/application/process/trans.go:1331` `payReceiveFlags`; `:1338` `payStmts`
- `backend/internal/application/process/service.go:1860` `payTenders` GL; `:1861` เช็คจ่าย 2112; `:1865` เช็ครับ 1122
- `backend/internal/application/process/service.go:2329` บัตร 461/462/463
