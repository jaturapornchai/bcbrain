---
title: "ขายเกินวงเงินเครดิตลูกค้าได้ไหม ต้องให้ใครอนุมัติ"
tags: [faq, ar, credit, sale, erp-option]
aliases: ["เกินวงเงินเครดิต", "วงเงินเครดิตลูกค้า", "credit limit", "ยอดวงเงินเครดิตของลูกค้า เกินที่กำหนดไว้", "lock_credit_money", "password_ar_credit", "approve_ar_credit", "ถูกปิดสถานะเครดิต", "erp_credit_request"]
sources: ["backend/internal/application/process/trans_save_rules.go:488", "backend/internal/application/process/trans_save_rules.go:503", "backend/internal/application/process/trans_save_rules.go:522", "backend/internal/application/process/trans_save_rules.go:597", "backend/internal/application/process/trans_save_rules.go:610", "backend/internal/application/process/trans_credit.go:33", "backend/internal/application/process/trans_credit.go:50", "backend/internal/application/process/trans_credit.go:147", "backend/internal/application/process/trans_credit.go:19", "backend/internal/application/process/trans_save_rules.go:519"]
---
# ขายเกินวงเงินเครดิตลูกค้าได้ไหม ต้องให้ใครอนุมัติ

**ตอบสั้น:** ขึ้นกับสวิตช์ใน `erp_option` ถ้าเปิดแค่ "เตือน" (`warning_credit_money`) ระบบถามยืนยันแล้วบันทึกต่อได้ ถ้าเปิด "ห้าม" (`lock_credit_money`) ระบบไม่ยอมบันทึก ยกเว้นเปิด `password_ar_credit` ไว้ด้วย กรณีนั้นผู้ที่มีสิทธิ์ `erp_user.approve_ar_credit` = 1 กรอกรหัสผู้ใช้และรหัสผ่านเพื่ออนุมัติได้ ชื่อผู้อนุมัติถูกเก็บไว้ที่ `ic_trans.user_approve`

## รายละเอียด
**เอกสารที่ตรวจวงเงิน:** ขายเชื่อ 44 (`inquiry_type` 0), ตั้งหนี้อื่นๆ 99, รายได้อื่นๆ 250 และเพิ่มหนี้รายได้อื่นๆ 254 (`inquiry_type` 0/2) และต้องมีรหัสลูกค้า การตรวจทำทุกครั้งที่บันทึก ทั้งเอกสารใหม่และเอกสารที่แก้

**ลำดับการตรวจ**
1. อ่าน `ar_customer_detail.credit_money` (วงเงิน) และ `credit_status`
2. `credit_status` ไม่เท่ากับ 0 → ไม่ให้บันทึก "ลูกค้า ... ถูกปิดสถานะเครดิต" (ยกเว้นสถานะ 2 ตามข้อถัดไป)
3. สถานะ 2 (ปิดชั่วคราว) + เปิด `sr_ss_credit_check`: ขายได้เฉพาะเมื่อดึงรายการจากใบสั่งที่อนุมัติแล้วใน `erp_credit_request` ถ้าไม่ใช่จะขึ้น "ยังไม่อนุมัติเปิดสถานะเครดิต"
4. ถ้าไม่ได้เปิดทั้งเตือนและห้าม หรือวงเงินเป็น 0 → ไม่ตรวจวงเงิน
5. หนี้คงค้าง = ยอดลูกหนี้ตามสูตรรายงานสถานะ (ไม่รวมเอกสารที่กำลังบันทึก) + เช็ครับในมือ (ถ้าเปิด `ar_credit_chq_outstanding` ระบบตัดทศนิยมเหลือเต็มบาท) − เงินมัดจำที่ยังไม่ใช้ (ถ้าเปิด `credit_sale_include_deposit`)
6. เกินวงเงินเมื่อ ยอดเอกสารนี้ > วงเงิน − หนี้คงค้าง

**ผลเมื่อเกินวงเงิน**
- เปิด `request_ar_credit` หรือ `lock_credit_money` → ไม่ให้บันทึก "ยอดวงเงินเครดิตของลูกค้า เกินที่กำหนดไว้"
- เปิด `lock_credit_money` + `password_ar_credit` (และไม่ได้เปิด `request_ar_credit`) → หน้าจอขอรหัสผู้อนุมัติ ถ้าผู้ใช้ไม่มีอยู่ รหัสผ่านผิด หรือไม่มีสิทธิ์ จะได้ข้อความเดียวกันคือ "รหัสผู้อนุมัติหรือรหัสผ่านไม่ถูกต้อง"
- เปิดแค่ `warning_credit_money` → ถาม "ต้องการดำเนินการต่อหรือไม่" แล้วบันทึกได้

**ใบสั่งจอง 34 / ใบสั่งขาย 36:** ตรวจเมื่อเปิด `sr_ss_credit_check` ยอดที่ใช้เทียบคือ ยอดเอกสาร + ยอดลูกหนี้ + ยอดจอง/สั่งขายค้าง + เช็คในมือ ถ้าเกินวงเงิน (หรือลูกค้าเป็นสถานะ 2) ระบบถามว่าจะบันทึกเพื่อขออนุมัติหรือไม่ ถ้าตอบตกลง เอกสารจะถูกพักไว้ (`is_hold`) พร้อมสร้างคำขอใน `erp_credit_request` ถ้าเปิด `check_credit_sale_reserve_sale_order` จะไม่ให้บันทึก "เกินวงเงินเครดิตลูกค้า" ส่วนจองเงินสด 34 จะถูกพักไว้เพื่อตรวจสัดส่วนเงินมัดจำ

## ข้อควรระวัง
- โค้ดไม่มีขั้นขออนุมัติแบบ OTP ของ `request_ar_credit` ถ้าเปิดสวิตช์นี้ไว้ การขายเกินวงเงินจะถูกห้ามเสมอ และลูกค้าสถานะ 2 ก็ขายไม่ได้ (`trans_credit.go:19-22`, `trans_save_rules.go:519-522`)
- เช็ครับในมือถูกตัดเศษเหลือเต็มบาท (`trunc`) หนี้คงค้างจึงอาจต่ำกว่ายอดจริงไม่เกิน 1 บาท
- ยอดลูกหนี้ที่ใช้ตรวจวงเงินไม่นับ 254 (ตามสูตรรายงานสถานะ) ดู [[faq-ap-ar-balance-where]]
- ใบสั่งแบบเชื่อของลูกค้าที่วงเงิน ≤1 บาท (ไม่ได้ตั้งวงเงิน) จะถูกส่งขออนุมัติทุกใบ หรือถูกห้ามถ้าเปิด `check_credit_sale_reserve_sale_order` ซึ่งต่างจากใบขาย 44 ที่วงเงิน 0 แปลว่าไม่ตรวจ

## ดูเพิ่ม
- [[acc-credit-limit-save-rules]]
- [[term-credit-due]]
- [[scr-modal-price-credit]]
- [[tbl-erp-credit-approved-logs]]
- [[faq-deposit-vs-advance]]

## ที่มาในโค้ด
- `backend/internal/application/process/trans_save_rules.go:488` `creditChecked` เอกสารที่ตรวจวงเงิน
- `backend/internal/application/process/trans_save_rules.go:503` `creditOutcome` เงื่อนไขเกินวงเงิน ห้าม หรือเตือน
- `backend/internal/application/process/trans_save_rules.go:522` `checkCreditLimit` ลำดับการตรวจ
- `backend/internal/application/process/trans_save_rules.go:597` `arBalanceSQL` ยอดลูกหนี้ของลูกค้า
- `backend/internal/application/process/trans_save_rules.go:610` `creditChqSQL` เช็คในมือตัดเศษเต็มบาท
- `backend/internal/application/process/trans_credit.go:33` `checkTransCredit` บันทึก `user_approve`
- `backend/internal/application/process/trans_credit.go:50` `creditApprover` ตรวจ `approve_ar_credit` = 1
- `backend/internal/application/process/trans_credit.go:147` `planOrderCredit` พักใบสั่ง 34/36
