---
title: "ด่านตรวจก่อนบันทึกเอกสารและวงเงินเครดิต (Save Rules & Credit Limit)"
tags: [accounting, validation, credit-limit, ar, stock-control]
aliases: ["วงเงินเครดิต", "เกินวงเงินเครดิต", "ถูกปิดสถานะเครดิต", "อนุมัติเครดิต", "ขายต่ำกว่าทุน", "สต็อกติดลบ", "ห้ามแก้ไข หรือลบข้อมูล", "Lock เด็ดขาด", "CONFIRM", "CREDIT_PASSWORD", "is_hold", "erp_credit_request"]
sources: ["backend/internal/application/process/trans_validate.go:43", "backend/internal/application/process/trans_validate.go:95", "backend/internal/application/process/trans_validate.go:112", "backend/internal/application/process/trans_validate.go:132", "backend/internal/application/process/trans_validate.go:216", "backend/internal/application/process/trans_validate.go:258", "backend/internal/application/process/trans_validate.go:339", "backend/internal/application/process/period.go:128", "backend/internal/application/process/trans.go:216", "backend/internal/application/process/trans.go:220", "backend/internal/application/process/trans_save_rules.go:30", "backend/internal/application/process/trans_save_rules.go:50", "backend/internal/application/process/trans_save_rules.go:53", "backend/internal/application/process/trans_save_rules.go:134", "backend/internal/application/process/trans_save_rules.go:389", "backend/internal/application/process/trans_save_rules.go:488", "backend/internal/application/process/trans_save_rules.go:503", "backend/internal/application/process/trans_save_rules.go:522", "backend/internal/application/process/trans_save_rules.go:579", "backend/internal/application/process/trans_save_rules.go:599", "backend/internal/application/process/trans_save_rules.go:610", "backend/internal/application/process/trans_save_rules.go:616", "backend/internal/application/process/trans_credit.go:26", "backend/internal/application/process/trans_credit.go:33", "backend/internal/application/process/trans_credit.go:50", "backend/internal/application/process/trans_credit.go:77", "backend/internal/application/process/trans_credit.go:100", "backend/internal/application/process/trans_credit.go:147", "backend/internal/application/process/trans_credit.go:216"]
---

# ด่านตรวจก่อนบันทึกเอกสารและวงเงินเครดิต

`checkTransScreenSave` (trans_validate.go:43) รันใน transaction ของ SaveTrans หลังสร้างข้อมูลเอกสาร (`buildTransArgs`) ก่อนเขียนลงฐาน ตรวจงวด สิทธิ์แก้ไข ข้อมูลหน้าจอ เอกสารอ้างอิง แล้วจบด้วยกฎสต็อก/ต้นทุน/วงเงินเครดิต ผลมี 3 แบบ: ห้ามบันทึก (validation), ถามยืนยัน (`CONFIRM:` trans_save_rules.go:50) และขอรหัสผู้อนุมัติ (`CREDIT_PASSWORD:` trans_credit.go:26)

## ทำงานอย่างไร

### ลำดับใน `checkTransScreenSave`
1. งวดเปิด ยกเว้น flag 521/522/523 (`periodExemptFlags` period.go:128) ดู [[acc-period-close]]
2. แก้ไขเอกสารเดิม: `refuseLockedRecord` (trans_validate.go:112) `is_lock_record` = 1 → "Lock เด็ดขาด : ห้ามแก้ไข หรือลบข้อมูล" (เอกสาร flag 66 จากเมนูต้นทุนแฝงมีข้อความเฉพาะ); `editLocked` (:132) ห้ามแก้เมื่อ `used_status` / `used_status_2` / `doc_success` / `last_status` = 1, `is_doc_copy` = 1 หรือ 34 ที่ `approve_status` ≥ 1 (30 แก้ได้เมื่อเปิด `doc_sale_order_edit`); แก้เอกสารที่ไม่มีอยู่ = not-found "ไม่พบเอกสารที่จะแก้ไข"
3. flag มัดจำ (`depositFlags` trans.go:220) และเอกสารยอดหัว (`headerAmountFlags` trans.go:216) **จบตรงนี้** ไม่ผ่านขั้นที่เหลือ
4. ช่องบังคับของหน้าจอ (`checkScreenFields`), `checkParty` (:216) คู่ค้าต้องป้อนและต้องมีในทะเบียน; เอกสารขายใหม่ (30/34/36/44/46/48) ห้ามใช้ลูกค้าสถานะปิด (status 1) ยกเว้นลูกค้าเงินสดของ POS (`posconfig.cust_code_default`)
5. `checkReferencedLines` (:339) ห้ามดึง/คืนเกินเอกสารอ้างอิง "ส่งคืนเกินมูลค่า"; ข้ามเมื่อ 44 + `allow_sale_over_reserve` หรือ 12/310 + `receive_more_po`
6. `checkTransSaveRules` (trans_save_rules.go:134)

- มัดจำที่ตัดต้องไม่เกินมูลค่าสุทธิ (`checkAdvance` trans_validate.go:258 เรียกจาก trans.go:859; vat_type 0 รวม VAT) "ยอดมัดจำมากกว่ามูลค่าสุทธิ" ดู [[acc-deposit-advance]]
- การลบ (`checkTransScreenDelete` :95) ใช้ด่าน lock + editable + งวดของวันที่ที่เก็บ

### กฎใน `checkTransSaveRules` (สวิตช์จาก `erp_option` อ่านที่ :30; ไม่มีแถว = ปิดทุกตัว)
1. `check_input_vat`: flag ใน `inputVatFlags` (:53 — ทั้งขาย 44/46/48, รายได้อื่น 250/252/254, ซื้อ 12/14/16/315/316/317, ค่าใช้จ่ายอื่น 260/262/264) ที่ vat_type 0/1 ต้องมีเลขและวันที่ใบกำกับภาษี
2. lot ของสินค้า (`lotMessage` :180) สินค้า cost_type 2 ต้องมีหมายเลข LOT; ยกเว้น 46 inquiry 1/2
3. ขายต่ำกว่าทุน: ที่นี่ตรวจเฉพาะ 144 เมื่อเปิดทั้ง `warning_low_cost` และ `lock_low_cost` (flag อื่นตรวจรายบรรทัดในกริด); ข้ามของแถม (`lowCostMessage` :192)
4. สต็อกไม่พอ (`checkStockBalance` :389): เฉพาะ**เอกสารใหม่** + `issue_stock_control` + flag 72/36/46/44/56 (ยกเว้น 46 inquiry 1/2) ตรวจได้ระดับคลัง / ที่เก็บ / lot และรวมยอดค้างส่ง/จองตามสวิตช์ (`accruedSQL` :447) ดู [[acc-inventory-stock-rebuild]]
5. วงเงินเครดิต (`checkTransCredit` trans_credit.go:33)

### วงเงินเครดิตใบขาย (`checkCreditLimit` trans_save_rules.go:522)
- ตรวจเฉพาะ (`creditChecked` :488): 44 inquiry 0, 99 ทุกกรณี, 250 / 254 inquiry 0 หรือ 2 และเอกสารต้องมีรหัสลูกค้า
- `ar_customer_detail.credit_status` ≠ 0 → "ลูกค้า ... ถูกปิดสถานะเครดิต" (ไม่ขึ้นกับสวิตช์); status 2 + `sr_ss_credit_check` (และไม่เปิด `request_ar_credit`) ขายได้เมื่อใบสั่งที่ดึงมามีแถวใน `erp_credit_request` และอนุมัติแล้วทุกแถว (`refOrdersApproved` :579) กรณีนี้ไม่ตรวจวงเงิน
- ตรวจวงเงินเมื่อเปิด `warning_credit_money` หรือ `lock_credit_money` และ `credit_money` ≠ 0
- ยอดค้าง = ลูกหนี้คงค้าง (`arBalanceSQL` :599 ตั้งหนี้ + เพิ่มหนี้ - ลดหนี้ - รับชำระ ไม่นับเอกสารนี้) + เช็คในมือ (`creditChqSQL` :610 เมื่อเปิด `ar_credit_chq_outstanding`, `chq_type` = 1, สถานะไม่ใช่ 2/7/8, **ตัดเศษเป็นบาทด้วย `trunc`**) - มัดจำ/ล่วงหน้าคงเหลือ (`creditDepositSQL` :616 เมื่อเปิด `credit_sale_include_deposit`)
- เกินเมื่อ ยอดเอกสาร (`total_amount`) > วงเงิน - ยอดค้าง (`creditOutcome` :503)
  - `request_ar_credit` หรือ `lock_credit_money` = ห้ามบันทึก "ยอดวงเงินเครดิตของลูกค้า เกินที่กำหนดไว้"
  - lock + `password_ar_credit` (ไม่เปิด request) = ขอรหัสผู้อนุมัติ (`creditApprover` trans_credit.go:50) รหัสผ่านต้องตรง `erp_user.password` และผู้ใช้ต้องมี `approve_ar_credit` = 1 (`approveCredit` :77); ผ่านแล้วบันทึกชื่อผู้อนุมัติที่ `ic_trans.user_approve`
  - warning อย่างเดียว = ถามยืนยัน

### วงเงินของใบสั่งจอง/สั่งขาย 34 / 36 (`planOrderCredit` trans_credit.go:147)
- ทำงานเมื่อเปิด `sr_ss_credit_check`; เงินเชื่อ inquiry 0/2: ไม่เกิน = `auto_approved` = 1; เกินและเปิด `check_credit_sale_reserve_sale_order` = ห้ามบันทึก "เกินวงเงินเครดิตลูกค้า"; มิฉะนั้นถามยืนยันแล้วบันทึกเป็น `is_hold` = 1 พร้อมแถว `erp_credit_request` (เก็บยอดเกิน และ % เกินที่ปัด HALF_UP 2 ตำแหน่ง)
- ลูกค้าที่วงเงิน ≤ 1 บาท: ถ้า status 1 ห้ามบันทึก มิฉะนั้นส่งขออนุมัติเสมอ
- 34 เงินสด (inquiry 1/3) ถูก hold เพื่อตรวจ % มัดจำ; 36 เงินสดอนุมัติอัตโนมัติ
- วงเงินที่ใช้ = `credit_money` (+ เงินล่วงหน้าคงเหลือเมื่อเปิด `credit_sale_include_deposit`) ต้อง ≥ ยอดเอกสาร + ลูกหนี้คงค้าง + ยอดค้างของใบสั่งจอง 34 และใบสั่งขาย 36 ที่ยังไม่ถูกดึงไปทำเอกสารต่อ (`orderRemainSQL` :216 ตัดเศษเป็นบาท) + เช็คในมือ (`orderCreditCheck` :100); ลูกค้า status 2 ส่งขออนุมัติเสมอ; ลูกค้าที่ตั้ง `close_over_credit_warning` เกินแล้วห้ามบันทึก "เกินวงเงินเครดิต ไม่สามารถบันทึกเอกสารได้"

## จุดเสี่ยง
- ในโค้ดยังไม่มีการขออนุมัติเครดิตด้วย OTP (`request_ar_credit` จึงบล็อกเสมอ) และวงเงินร่วมข้ามฐาน (`join_money_credit`) (comment trans_save_rules.go:519-521)
- กฎสต็อกตรวจเฉพาะเอกสารใหม่ แก้ไขเอกสารเดิมให้สต็อกติดลบได้
- เช็คในมือถูกตัดเศษเป็นบาท (`trunc`) ยอดค้างจึงต่ำกว่าจริงได้ไม่เกิน 1 บาท
- flag มัดจำและเอกสารยอดหัวข้ามช่องบังคับ คู่ค้า และเอกสารอ้างอิงทั้งหมด

## ที่มาในโค้ด
- `backend/internal/application/process/trans_validate.go:43` checkTransScreenSave
- `backend/internal/application/process/trans_validate.go:132` editLocked
- `backend/internal/application/process/trans_validate.go:339` checkReferencedLines
- `backend/internal/application/process/trans_save_rules.go:134` checkTransSaveRules
- `backend/internal/application/process/trans_save_rules.go:389` checkStockBalance
- `backend/internal/application/process/trans_save_rules.go:522` checkCreditLimit
- `backend/internal/application/process/trans_save_rules.go:599` arBalanceSQL
- `backend/internal/application/process/trans_credit.go:77` approveCredit
- `backend/internal/application/process/trans_credit.go:147` planOrderCredit

## ดูเพิ่ม
- [[acc-transaction-save-flow]]
- [[acc-period-close]]
- [[acc-deposit-advance]]
- [[acc-inventory-stock-rebuild]]
- [[accounting-overview]]
