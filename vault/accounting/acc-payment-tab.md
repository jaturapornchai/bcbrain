---
title: "แท็บรับ/จ่ายเงิน และการชำระหนี้ตามบิล (Payment Tab & Bill Settlement)"
tags: [accounting, payment, cash, bank, ap-ar]
aliases: ["แท็บจ่ายเงิน", "รับชำระหนี้", "จ่ายชำระหนี้", "เงินทอน", "รายได้อื่น", "ค่าใช้จ่ายอื่น", "ยอดการจ่ายเงินไม่สมบูรณ์", "ป้อนยอดชำระเกิน", "วางบิลซ้ำ", "cb_trans"]
sources: ["backend/internal/application/process/pay_check.go:21", "backend/internal/application/process/pay_check.go:31", "backend/internal/application/process/pay_check.go:36", "backend/internal/application/process/pay_check.go:57", "backend/internal/application/process/pay_check.go:110", "backend/internal/application/process/pay_check.go:142", "backend/internal/application/process/pay_check.go:168", "backend/internal/application/process/pay_check.go:221", "backend/internal/application/process/pay_check.go:263", "backend/internal/application/process/pay_other.go:25", "backend/internal/application/process/pay_other.go:34", "backend/internal/application/process/pay_other.go:43", "backend/internal/application/process/pay_other.go:60", "backend/internal/application/process/pay_other.go:106", "backend/internal/application/process/pay_other.go:133", "backend/internal/application/process/pay_check.go:270", "backend/internal/application/process/trans.go:1533", "backend/internal/application/process/cheque.go:32", "backend/internal/application/process/trans.go:1338", "backend/internal/application/process/docs.go:526"]
---

# แท็บรับ/จ่ายเงิน และการชำระหนี้ตามบิล

แท็บจ่ายเงินของเอกสารเก็บใน `cb_trans` (หัว) + `cb_trans_detail` (รายการโอน/เช็ค/บัตร/PromptPay และรายได้-ค่าใช้จ่ายอื่น) + `cb_chq_list` (เช็ค) ทุกครั้งที่บันทึกจะลบของเดิมแล้วเขียนใหม่ (trans.go:1338) จากนั้นตรวจใน transaction เดียวกันว่ายอดรับ/จ่ายครบพอดี ถ้าไม่ครบ rollback ทั้งเอกสาร

## ทำงานอย่างไร

### เอกสารไหนมีแท็บจ่าย (`payTabEnabled` pay_check.go:36)
- flag ที่ไม่มีช่อง inquiry_type (ไม่อยู่ใน `payInquiryFlags` :31) จ่ายเสมอ
- 11 จ่ายมัดจำ: inquiry 0 (เงินสด); 16 / 317: inquiry 2/3; 48: 1/3/5; flag อื่นในรายการ (12, 44, 250, 252, 254, 260, 262, 264, 315): 1/3

### ประเภทเงิน (`payTenders` :110, trans.go:1338)
- เงินสด (หัว), เงินโอน `doc_type` 1, เช็ค 2 (chq_type 1 รับ / 2 จ่าย), บัตรเครดิต 3, PromptPay/wallet 21, ค่าใช้จ่ายอื่น 11, รายได้อื่น 12
- ทุกยอดอ่านที่ `item_amount_decimal` ปัด HALF_UP; ยอดติดลบ = error "ยอดรับ/จ่ายชำระต้องไม่ติดลบ"; แถวยอด <= 0 ถูกข้าม
- เช็ครับใช้ธนาคารของลูกค้า เช็คจ่ายใช้สมุดบัญชีของบริษัท; หลังบันทึกเขียน `cb_chq_list` ใหม่ แล้วคำนวณ `cb_chq_list.status` ของเลขเช็คเหล่านั้นใหม่ด้วย `chequeStatusSQL` (trans.go:1533-1537, cheque.go:32) ดู [[acc-cheque-transfer]]

### รายได้/ค่าใช้จ่ายอื่น (`parsePayOther` pay_other.go:60)
- ฝั่งจ่าย (`payOtherPayFlags` :34: 19, 401, 300, 260, 264, 252, 48, 42, 112, 12, 315, 10, 11, 456): ค่าใช้จ่ายอื่น = `total_expense_other` (บวกเพิ่มจากยอดสุทธิ), รายได้อื่น = `total_income_other` (นับเป็นยอดที่ชำระ)
- ฝั่งรับ (239, 402, 301, 262, 250, 254, 16, 317, 44, 40, 110, 20, 25, 416, 1802): สลับสองช่อง
- flag อื่นเก็บแถวไว้แต่ยอดรวมเป็น 0; แถวไม่มีรหัสถูกตัดทิ้ง; รหัสยาวไม่เกิน 100 ตัว, หมายเหตุไม่เกิน 255, ห้ามติดลบ
- ตอนตรวจยอด รหัสที่ไม่มีใน `erp_expenses_list` / `erp_income_list` = error "ไม่พบรหัสค่าใช้จ่าย" / "ไม่พบรหัสรายได้" (`checkPayOtherCodes` :133)
- 44 / 144 (`payCashFlags` :43) มีช่องรับเงิน (ห้ามติดลบ) แต่เงินทอน (`money_change`) = รับเงิน - เงินสด คำนวณเฉพาะ 44 และเฉพาะเมื่อรับเงิน > 0 ส่วน 144 เงินทอนเป็น 0 เสมอ (:99-108)
- GL ของแถวเหล่านี้ ดู [[acc-gl-posting-standard]] (`payOtherGL`)

### ตรวจยอดครบ (`payCompleteCheck` :57, `checkPayTotal` :142)
- ยอดสุทธิถูกปัด HALF_UP ที่ `item_amount_decimal` ก่อนบวกค่าใช้จ่ายอื่น (pay_check.go:61)
- เงื่อนไข: เงินสด + โอน + เช็ค + บัตร + PromptPay + รายได้อื่น + WHT = ยอดสุทธิ + ค่าใช้จ่ายอื่น
- WHT = SUM(`gl_wht_list.tax_value`) ตาม doc_no + trans_flag ของเอกสาร (:70) ดู [[acc-vat-register-wht]]
- ทุกส่วนปัด HALF_UP ที่ `item_amount_decimal` ก่อนรวม ไม่เท่า = "ยอดการจ่ายเงินไม่สมบูรณ์ (ยอดสุทธิ ... ยอดชำระ ...)"
- ผ่านแล้ว UPDATE `cb_trans.total_tax_at_pay` (ปัด 2) และ `total_amount_pay`

### ชำระหนี้ตามบิล 19 / 239 และวางบิล 213 / 235 (`billSaveCheck` :168)
- ฝั่งลูกหนี้ 239 / 235, เจ้าหนี้ 19 / 213 (docs.go:526-527)
- lock บิลตามลำดับ แล้วคำนวณยอดคงเหลือใหม่จากเอกสารหนี้และการชำระที่บันทึกแล้ว ไม่เชื่อยอดคงเหลือจาก client
- `ap_bill_inform` / `ar_bill_inform` = 1: ห้ามวางบิลซ้ำ "ห้ามรับวางบิลซ้ำ" / "ห้ามวางบิลซ้ำ"
- `pay_bill_over` ไม่เปิด: ห้ามจ่ายเกิน "ป้อนยอดชำระเกิน : ... (ยอดคงเหลือ ...)" (`payExceedsBalance` :263: หนี้รับได้ 0 ถึงยอดคงเหลือ, ลดหนี้รับได้ยอดคงเหลือถึง 0, ยอดคงเหลือ 0 ป้อนยอดใดที่ไม่ใช่ 0 ถือว่าเกิน (:270))
- `ap_pay_from_bill_note` / `ar_pay_from_bill_note` = 1: แถวชำระต้องอ้างอิงใบวางบิล
- multi-currency ตรวจที่คอลัมน์สกุลต่างประเทศ ดู [[acc-fx-multi-currency]]

## จุดเสี่ยง
- ยอดเงินในแท็บใช้ `item_amount_decimal` แต่ `total_tax_at_pay` ปัด 2 ตายตัว
- ไม่มี erp_option = ทุกสวิตช์ปิด จึงจ่ายเกินและวางบิลซ้ำได้

## ที่มาในโค้ด
- `backend/internal/application/process/pay_check.go:36` payTabEnabled
- `backend/internal/application/process/pay_check.go:57` payCompleteCheck
- `backend/internal/application/process/pay_check.go:142` checkPayTotal
- `backend/internal/application/process/pay_check.go:168` billSaveCheck
- `backend/internal/application/process/pay_check.go:263` payExceedsBalance
- `backend/internal/application/process/pay_other.go:34` payOtherPayFlags / payOtherReceiveFlags
- `backend/internal/application/process/pay_other.go:60` parsePayOther
- `backend/internal/application/process/trans.go:1338` payStmts

## ดูเพิ่ม
- [[acc-cheque-transfer]]
- [[acc-deposit-advance]]
- [[acc-fx-multi-currency]]
- [[acc-transaction-save-flow]]
