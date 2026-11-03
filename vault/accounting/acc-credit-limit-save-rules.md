---
title: "ด่านตรวจก่อนบันทึกเอกสารและวงเงินเครดิต (Save Rules & Credit Limit)"
tags: [accounting, validation, credit-limit, ar, stock-control]
aliases: ["วงเงินเครดิต", "เกินวงเงินเครดิต", "ถูกปิดสถานะเครดิต", "อนุมัติเครดิต", "ขายต่ำกว่าทุน", "สต็อกติดลบ", "ห้ามแก้ไข หรือลบข้อมูล", "Lock เด็ดขาด", "CONFIRM", "CREDIT_PASSWORD", "is_hold", "erp_credit_request"]
sources: ["backend/internal/application/process/trans_validate.go:43", "backend/internal/application/process/trans_validate.go:95", "backend/internal/application/process/trans_validate.go:112", "backend/internal/application/process/trans_validate.go:132", "backend/internal/application/process/trans_validate.go:216", "backend/internal/application/process/trans_validate.go:258", "backend/internal/application/process/trans_validate.go:339", "backend/internal/application/process/trans_save_rules.go:30", "backend/internal/application/process/trans_save_rules.go:50", "backend/internal/application/process/trans_save_rules.go:134", "backend/internal/application/process/trans_save_rules.go:389", "backend/internal/application/process/trans_save_rules.go:488", "backend/internal/application/process/trans_save_rules.go:503", "backend/internal/application/process/trans_save_rules.go:522", "backend/internal/application/process/trans_save_rules.go:599", "backend/internal/application/process/trans_save_rules.go:610", "backend/internal/application/process/trans_save_rules.go:616", "backend/internal/application/process/trans_credit.go:26", "backend/internal/application/process/trans_credit.go:33", "backend/internal/application/process/trans_credit.go:50", "backend/internal/application/process/trans_credit.go:77", "backend/internal/application/process/trans_credit.go:100", "backend/internal/application/process/trans_credit.go:147"]
---

# ด่านตรวจก่อนบันทึกเอกสารและวงเงินเครดิต

`checkTransScreenSave` (trans_validate.go:43) รันใน transaction ของ SaveTrans ก่อนเขียนเอกสาร ตรวจงวด สิทธิ์แก้ไข ข้อมูลหน้าจอ เอกสารอ้างอิง แล้วจบด้วยกฎสต็อก/ต้นทุน/วงเงินเครดิต ผลมี 3 แบบ: ห้ามบันทึก (validation), ถามยืนยัน (`CONFIRM:` :50) และขอรหัสผู้อนุมัติ (`CREDIT_PASSWORD:` trans_credit.go:26)

## ทำงานอย่างไร

### ลำดับใน `checkTransScreenSave`
1. งวดเปิด (ยกเว้น 521/522/523) ดู [[acc-period-close]]
2. แก้ไขเอกสารเดิม: `refuseLockedRecord` (:112) `is_lock_record` = 1 → "Lock เด็ดขาด : ห้ามแก้ไข หรือลบข้อมูล" (ถ้าเป็นเอกสารจากเมนูต้นทุนแฝงมีข้อความเฉพาะ); `editLocked` (:132) ห้ามแก้เมื่อถูกใช้ / สำเร็จ / ยกเลิก / คัดลอก หรือ 34 ที่อนุมัติแล้ว (30 แก้ได้เมื่อเปิด `sale_order_edit`); แก้เอกสารที่ไม่มีอยู่ = not-found
3. flag มัดจำและเอกสารยอดหัว **จบตรงนี้** ไม่ผ่านขั้นที่เหลือ (comment: เป็นหน้าจอคนละชนิดใน C#)
4. ช่องบังคับของหน้าจอ, `checkParty` (:216) คู่ค้าต้องมีและไม่ปิดการใช้งาน
5. `checkReferencedLines` (:339) ห้ามดึง/คืนเกินเอกสารอ้างอิง "ส่งคืนเกินมูลค่า"; ข้ามเมื่อ 44 + `sale_over_reserve` หรือ 12/310 + `receive_more_po`
6. `checkTransSaveRules` (trans_save_rules.go:134)

- มัดจำที่ตัดต้องไม่เกินมูลค่าสุทธิ (`checkAdvance` :258) ดู [[acc-deposit-advance]]
- การลบ (`checkTransScreenDelete` :95) ใช้ด่าน lock + editable + งวดของวันที่ที่เก็บ

### กฎใน `checkTransSaveRules` (สวิตช์จาก `erp_option` อ่านที่ :30; ไม่มีแถว = ปิดทุกตัว)
1. `check_input_vat`: flag ภาษีซื้อที่ vat_type 0/1 ต้องมีเลขและวันที่ใบกำกับภาษี
2. lot ของสินค้า (`lotMessage` :180) ยกเว้น 46 inquiry 1/2
3. ขายต่ำกว่าทุน: ที่นี่ตรวจเฉพาะ 144 เมื่อเปิดทั้ง `warning_low_cost` และ `lock_low_cost` (flag อื่นตรวจรายบรรทัดในกริด); ข้ามของแถม (`lowCostMessage` :192)
4. สต็อกไม่พอ (`checkStockBalance` :389): เฉพาะ**เอกสารใหม่** + `issue_stock_control` ตรวจได้ระดับคลัง / ที่เก็บ / lot และรวมยอดค้างส่ง/จองตามสวิตช์ (`accruedSQL` :447) ดู [[acc-inventory-stock-rebuild]]
5. วงเงินเครดิต (`checkTransCredit` trans_credit.go:33)

### วงเงินเครดิตใบขาย (`checkCreditLimit` :522)
- ตรวจเฉพาะ (`creditChecked` :488): 44 inquiry 0, 99 ทุกกรณี, 250 / 254 inquiry 0 หรือ 2
- `ar_customer_detail.credit_status` ≠ 0 → "ลูกค้า ... ถูกปิดสถานะเครดิต" (ไม่ขึ้นกับสวิตช์); status 2 + `sr_ss_credit_check` ซื้อได้เมื่อใบสั่งที่ดึงมาได้รับอนุมัติใน `erp_credit_request` (`refOrdersApproved` :579)
- ตรวจวงเงินเมื่อเปิด `warning_credit_money` หรือ `lock_credit_money` และ `credit_money` ≠ 0
- ยอดค้าง = ลูกหนี้คงค้าง (`arBalanceSQL` :599 ตั้งหนี้ + เพิ่มหนี้ - ลดหนี้ - รับชำระ ไม่นับเอกสารนี้) + เช็คในมือ (`creditChqSQL` :610 เมื่อเปิด `ar_credit_chq_outstanding`, สถานะไม่ใช่ 2/7/8, **ตัดเศษเป็นบาท**) - มัดจำ/ล่วงหน้าคงเหลือ (`creditDepositSQL` :616 เมื่อเปิด `credit_sale_include_deposit`)
- เกินเมื่อ ยอดเอกสาร > วงเงิน - ยอดค้าง (`creditOutcome` :503)
  - `request_ar_credit` หรือ `lock_credit_money` = ห้ามบันทึก "ยอดวงเงินเครดิตของลูกค้า เกินที่กำหนดไว้"
  - lock + `password_ar_credit` (ไม่เปิด request) = ขอรหัสผู้อนุมัติ (`creditApprover` :50) ผู้ใช้ต้องมี `approve_ar_credit` = 1; ผ่านแล้วบันทึกชื่อผู้อนุมัติที่ `ic_trans.user_approve`
  - warning อย่างเดียว = ถามยืนยัน

### วงเงินของใบสั่งขาย/สั่งจอง 34 / 36 (`planOrderCredit` :147)
- ทำงานเมื่อเปิด `sr_ss_credit_check`; เงินเชื่อ inquiry 0/2: ไม่เกิน = `auto_approved` = 1; เกินและเปิด `check_credit_sale_reserve_sale_order` = ห้ามบันทึก; มิฉะนั้นถามยืนยันแล้วบันทึกเป็น `is_hold` = 1 พร้อมแถว `erp_credit_request` (ยอดเกินและ % ปัด HALF_UP 2)
- 34 เงินสด (inquiry 1/3) ถูก hold เพื่อตรวจ % มัดจำ; 36 เงินสดอนุมัติอัตโนมัติ
- ยอดที่ต้องพอ = ยอดเอกสาร + ลูกหนี้คงค้าง + ยอดค้างของใบสั่งจอง 34 และใบสั่งขาย 36 ที่ยังไม่ถูกดึงไปทำเอกสารต่อ (`orderRemainSQL` :216) + เช็คในมือ (`orderCreditCheck` :100); ลูกค้าที่ตั้ง `close_over_credit_warning` เกินแล้วห้ามบันทึก "เกินวงเงินเครดิต ไม่สามารถบันทึกเอกสารได้"

## จุดเสี่ยง
- ไม่ได้ port: ขออนุมัติเครดิตด้วย OTP (`request_ar_credit` จึงบล็อกเสมอ) และวงเงินร่วมข้ามฐาน (dblink `join_money_credit`) (comment :515-521)
- กฎสต็อกตรวจเฉพาะเอกสารใหม่ แก้ไขเอกสารเดิมให้สต็อกติดลบได้
- เช็คในมือถูกตัดเศษเป็นบาทตาม C# ยอดค้างจึงต่ำกว่าจริงได้ไม่เกิน 1 บาท
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
