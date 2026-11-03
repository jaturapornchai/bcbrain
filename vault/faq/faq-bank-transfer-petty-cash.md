---
title: "ฝากเงิน/ถอนเงิน/โอนเงินระหว่างธนาคาร และเงินสดย่อย ลงบัญชีอย่างไร"
tags: [faq, cash-bank, petty-cash, transfer, gl]
aliases: ["ฝากเงินธนาคาร", "ถอนเงิน", "โอนเงินระหว่างบัญชี", "เงินสดย่อย", "bank transfer", "petty cash", "trans_flag 401", "trans_flag 402", "trans_flag 422", "trans_flag 300"]
sources: ["backend/internal/application/process/service.go:2064", "backend/internal/application/process/service.go:2207", "backend/internal/application/process/service.go:2221", "backend/internal/application/process/gl_template.go:195", "backend/internal/application/process/trans.go:1018", "backend/internal/application/process/cheque.go:101", "frontend/account/tabs/transMenuMap.ts:1798"]
---
# ฝากเงิน/ถอนเงิน/โอนเงินระหว่างธนาคาร และเงินสดย่อย ลงบัญชีอย่างไร

**ตอบสั้น:** 401 ฝากเงิน = Dr ธนาคาร / Cr เงินสด, 402 ถอนเงิน = Dr เงินสด / Cr ธนาคาร, 422 โอนเงิน = Dr สมุดบัญชีปลายทาง / Cr สมุดบัญชีต้นทาง ส่วนเงินสดย่อย 300 = Dr เงินสดย่อย / Cr ช่องทางเงิน และ 301 = Dr ช่องทางเงิน / Cr เงินสดย่อย บัญชีธนาคารมาจาก `erp_pass_book.account_code_1` ของสมุดบัญชี

## รายละเอียด
ดู [[flow-cash-bank-cheque]], [[doc-bank-deposit-withdraw]], [[doc-bank-transfer]], [[doc-petty-cash]]

**บัญชีตั้งต้น** (ใช้รหัสแรกที่มีในผัง): เงินสด 1111/1110/1100, ธนาคาร 1112/1113/1111 ถ้าเอกสารระบุสมุดบัญชี ใช้ `erp_pass_book.account_code_1` ([[tbl-erp-pass-book]])

**401 บันทึกฝากเงิน / 402 บันทึกถอนเงิน** (`menu_cb_cash_payin` / `menu_cb_cash_withdraw`)
- อ่านแถว `ic_trans_detail` ที่ยอด > 0 แต่ละแถวใช้สมุดบัญชีจาก `item_code`
- แยกบรรทัดธนาคารตามแถว ต่อเมื่อผลรวมแถวเท่ายอดเอกสาร ไม่เท่าใช้ธนาคารตั้งต้นบรรทัดเดียว
- 401: Dr ธนาคาร (ต่อแถว) / Cr เงินสด = ยอด − รายได้/ค่าใช้จ่ายอื่นสุทธิ
- 402: Dr เงินสด = ยอด + รายได้/ค่าใช้จ่ายอื่นสุทธิ / Cr ธนาคาร (ต่อแถว)

**422 โอนเงินระหว่างธนาคาร**
- ตอนบันทึกต้องมีสมุดโอนเข้า ("กรุณาระบุสมุดบัญชีโอนเข้า") และต้องไม่ใช่สมุดเดียวกับโอนออก ค่าธรรมเนียมต้องไม่ติดลบ ถ้าไม่ระบุยอดโอน ระบบใช้ ยอด − ค่าธรรมเนียม
- ระบบสร้างแถวคู่ 420 (โอนเงินเข้า) เลขเดียวกัน เวลา +1 นาที สลับต้นทาง/ปลายทาง (`SyncTransferPair`) ก่อนลง GL
- GL: Dr บัญชีของ `item_code_2` (ปลายทาง) / Cr บัญชีของ `item_code` (ต้นทาง) ด้วยยอดเอกสาร อ่านจากแถวแรก

**เงินสดย่อย 300 / 301** ([[tbl-cb-petty-cash]])
- บัญชีเงินสดย่อย = `cb_petty_cash.chart_of_account` ของรหัสในแถวแรก ไม่มีใช้ 1111-01/1112/1111
- 300 (เมนู "คืน/ลด วงเงินสดย่อย"): Dr เงินสดย่อย / Cr ช่องทางเงินในแท็บชำระ
- 301 (เมนู "รับ/เพิ่ม วงเงินสดย่อย"): Dr ช่องทางเงินในแท็บชำระ / Cr เงินสดย่อย
- ช่องทางเงินแยกตาม `cb_trans` ([[faq-payment-tab-tenders]])

## ข้อควรระวัง
- ทิศทางของ 300/301 ไม่ตรงกันในโค้ด: ชื่อเมนู 300 คือ "คืน/ลด" แต่ GL ลง Dr เงินสดย่อย, `payReceiveFlags` นับ 300 เป็นฝั่งรับเงิน (`trans.go:1332`) ขณะที่ `payOtherPayFlags` นับ 300 เป็นฝั่งจ่าย และ 301 เป็นฝั่งรับ (`pay_other.go:35-38`) ควรให้ผู้ดูแลยืนยันกับ C#
- GL เส้นมาตรฐานของ 422 ไม่มีบรรทัดค่าธรรมเนียม ลง Dr/Cr ด้วยยอดเดียวกัน การลงค่าธรรมเนียม ไม่ชัดจากโค้ดเส้นมาตรฐาน
- 422 อ่านสมุดจากแถวแรกเท่านั้น
- ถ้ารหัสเอกสารมีรูปแบบ GL ระบบใช้รูปแบบแทน (คอมเมนต์ระบุว่ารูปแบบ TM ลงแถว 420 ด้วย) ([[faq-gl-template-doc-format]])

## ดูเพิ่ม
- [[flow-cash-bank-cheque]]
- [[doc-bank-transfer]]
- [[doc-petty-cash]]
- [[faq-payment-tab-tenders]]
- [[faq-other-income-expense-gl]]

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:2064` GL 401/402
- `backend/internal/application/process/service.go:2207` GL 300/301 (`:2215-2218` Dr/Cr)
- `backend/internal/application/process/service.go:2221` GL 422
- `backend/internal/application/process/gl_template.go:195` `glSQLPassBook`; `:202` `glSQLPetty`
- `backend/internal/application/process/trans.go:1018` ตรวจ 422 (สมุดโอนเข้า, ค่าธรรมเนียม); `:604` เรียก `SyncTransferPair`
- `backend/internal/application/process/cheque.go:101` `SyncTransferPair` แถวคู่ 420
- `backend/internal/application/process/trans.go:1331` `payReceiveFlags`; `pay_other.go:35` `payOtherPayFlags`
- `frontend/account/tabs/transMenuMap.ts:1798` เมนูเงินสดย่อย 300/301
