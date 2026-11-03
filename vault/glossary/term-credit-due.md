---
title: "เครดิต วันครบกำหนด และวงเงินสินเชื่อ (credit_day / due_date / credit_money)"
tags: [glossary, ar, ap, credit]
aliases: ["เครดิต", "เครดิต (วัน)", "จำนวนวันเครดิต", "credit_day", "creditDay", "ครบกำหนด", "วันครบกำหนด", "วันครบกำหนดชำระ", "due_date", "dueDate", "credit_date", "วงเงิน", "วงเงินสินเชื่อ", "credit_money", "วงเงินสินเชื่อสูงสุด", "credit_money_max", "สถานะสินเชื่อ", "credit_status", "เกินวงเงิน", "อนุมัติวงเงิน", "user_approve", "is_hold", "ระงับ", "erp_credit_request", "วันที่วางบิล", "pay_bill_date", "ระยะเวลาส่งของ", "lead_time"]
sources: ["frontend/account/transaction/TransTopForm.tsx:488", "frontend/account/transaction/TransTopForm.tsx:503", "frontend/account/transaction/TransBottomPanel.tsx:191", "frontend/account/transaction/transLayouts.ts:327", "backend/internal/application/process/trans.go:121", "backend/internal/application/process/trans.go:673", "backend/internal/application/process/trans_credit.go:33", "backend/internal/application/process/trans_save_rules.go:522", "backend/internal/application/process/trans_party.go:224", "frontend/src/config/schemas/arCustomerDetail.ts:309", "frontend/src/config/schemas/arCustomerDetail.ts:314", "frontend/src/config/schemas/arCustomerDetail.ts:319", "frontend/src/config/schemas/arCustomerDetail.ts:329", "frontend/src/config/schemas/arCustomerDetail.ts:368", "frontend/src/config/schemas/apSupplierDetail.ts:242", "frontend/src/config/schemas/apSupplierDetail.ts:279", "frontend/src/config/bcMenu.json:710", "frontend/src/config/bcMenu.json:942"]
---

# เครดิต / ครบกำหนด / วงเงินสินเชื่อ

## ในระบบนี้คืออะไร
- **ในเอกสาร**: ช่อง "เครดิต (วัน)" (`TransTopForm.tsx:488`, `TransBottomPanel.tsx:191`) → `creditDay` → `ic_trans.credit_day` และช่อง "ครบกำหนด" (`TransTopForm.tsx:503`) → `dueDate` → `ic_trans.due_date` (`trans.go:121-122`) หัวเอกสารยังมี `credit_date` ซึ่งเก็บค่าเท่ากับ `due_date` ยกเว้นบันทึกแบบ `headerOnly` จะเป็นค่าว่าง (`trans.go:689`, `:909`)
- แก้จำนวนวันเครดิตแล้วหน้าจอตั้งวันครบกำหนด = วันที่เอกสาร + จำนวนวัน (`TransTopForm.tsx:492-497`, `TransBottomPanel.tsx:197-205`) แก้วันครบกำหนดแล้วจำนวนวันเครดิตคำนวณจากส่วนต่างของวัน (`TransTopForm.tsx:507-510`, `TransBottomPanel.tsx:215-218`)
- ช่องเครดิตและครบกำหนดแสดงตามชุด flag `CREDIT_FLAGS` (`transLayouts.ts:156-157`, ใช้ที่ `:446`) สำหรับ flag ที่มีในตาราง `FLAG_SPEC` ส่วน flag อื่นใช้กติกาพื้นฐาน `showCreditAndDue` คือมีคู่ค้า ยกเว้น flag 10, 20, 38, 40 และจอเงินสด/ธนาคาร (`transLayouts.ts:327-328`) จอทะเบียนเช็ค `cb_chq_list` แสดงเสมอ (`:389`)
- ถ้าเปิด `erp_option.use_credit_pay_bill_calc` ช่องเครดิต/ครบกำหนดบนจอขายถูกล็อก (`creditLocked`, `trans_new_defaults.go:39-44`, `TransBottomPanel.tsx:206`) และวันครบกำหนดคำนวณจากตาราง `ar_credit_pay_bill` = วันที่ 1 ของเดือนเอกสาร + `month_to_due` เดือน + (`day_to_due` − 1) วัน (`payBillDue`, `trans_party.go:224-249`; `payBillDueDate`, `:253-255`)
- **ใน master ลูกหนี้** (`arCustomerDetail.ts`): วงเงินสินเชื่อ `credit_money` (:309), วงเงินสินเชื่อสูงสุด `credit_money_max` (:314), จำนวนวันเครดิต `credit_day` (:319), สถานะสินเชื่อ `credit_status` (:329), เหตุผลในการระงับ `close_reason` (:349), วันที่วางบิล `pay_bill_date` (:368), วันที่รับเช็ค `keep_chq_date` (:373)
- **ใน master เจ้าหนี้** (`apSupplierDetail.ts`): จำนวนวันเครดิต `credit_day` (:242), ระยะเวลาส่งของ (วัน) `lead_time` (:279)

## การตรวจวงเงิน (`trans_credit.go:33-47`, `trans_save_rules.go:522-575`)
- ตรวจกับขายเชื่อ 44 (inquiry 0), ตั้งหนี้อื่น 99 และรายได้อื่น 250/254 ที่มีรหัสลูกค้า (`creditChecked`, `trans_save_rules.go:488-498`)
- `credit_status` ไม่ใช่ 0 → บันทึกไม่ได้ ข้อความ "ถูกปิดสถานะเครดิต" (`trans_save_rules.go:547`) ยกเว้นสถานะ 2 ที่เปิด `sr_ss_credit_check` และไม่เปิด `request_ar_credit` จะขายอ้างอิงใบสั่งที่อนุมัติแล้วได้ (`:539-546`)
- ยอดเอกสารเกิน (`credit_money` − หนี้ค้าง) เมื่อ `credit_money` ไม่เป็น 0 (`creditOutcome`, `trans_save_rules.go:503-510`): เปิด `erp_option.lock_credit_money` หรือ `request_ar_credit` → บล็อก (`creditOverMsg`, `:513`, `:567-568`) เปิดแค่ `warning_credit_money` → ถามยืนยัน (`:570-572`)
- ขายที่เกินวงเงินต้องมีผู้อนุมัติ (`ic_trans.user_approve`) ผ่านสิทธิ์ `password_ar_credit` (`trans_save_rules.go:564-565`, `creditApprover`, `trans_credit.go:50-72`, เขียน `user_approve` ที่ `:44`) ผู้อนุมัติต้องมี `erp_user.approve_ar_credit = 1` (`approveCredit`, `trans_credit.go:77-82`)
- สั่งจอง 34 และสั่งขาย 36 ที่เปิด `sr_ss_credit_check` (`trans_credit.go:34-39`, `checkOrderCredit`, `:178-212`) จะถูกพักไว้ (`is_hold = 1`, `:201`) และสร้างคำขอใน `erp_credit_request` (`:204`) หรืออนุมัติอัตโนมัติ (`auto_approved = 1`, `:196`)
- หนี้ค้างที่ใช้เทียบวงเงินคำนวณจากเอกสาร ดู [[term-ap-ar-balance]]

## หน้าจอตั้งค่า
"กำหนดกลุ่มอนุมัติวงเงิน" (`menu_approve_credit_level`, bcMenu.json:710-711), "กำหนดวันครบกำหนดชำระเงิน" (`menu_ar_credit_pay_bill`, :942-943)

## ข้อควรระวัง
- เมื่อเปิด `erp_option.request_ar_credit` ขายเกินวงเงินจะถูกบล็อกด้วยข้อความ "ยอดวงเงินเครดิตของลูกค้า เกินที่กำหนดไว้" (`trans_save_rules.go:507-509`, `:513`, `:567-568`) ใน backend ไม่มีขั้นตอนขอวงเงินผ่าน OTP/SMS/e-mail (ไม่พบ `ic_trans_draft` นอกคอมเมนต์)
- ช่อง "ระงับชั่วคราว" (`extra.onHold`, `TransTopForm.tsx:346-351`) บันทึกลง `ic_trans.on_hold` (`trans.go:671`) เป็นคนละคอลัมน์กับ `is_hold` ของการตรวจวงเงิน ซึ่งมีที่ตั้งค่าเพียงจุดเดียวที่ `trans_credit.go:201`

## ลิงก์
[[acc-credit-limit-save-rules]] · [[term-ap-ar-balance]] · [[term-party-ap-ar]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/account/transaction/TransTopForm.tsx:346-351`, `:488`, `:492-497`, `:503`, `:507-510`
- `frontend/account/transaction/TransBottomPanel.tsx:191`, `:197-205`, `:206`, `:215-218`
- `frontend/account/transaction/transLayouts.ts:156-157`, `:327-328`, `:389`, `:446`
- `backend/internal/application/process/trans.go:121-122`, `:671-673`, `:689`, `:909`
- `backend/internal/application/process/trans_credit.go:33-47`, `:50-72`, `:77-82`, `:178-212`
- `backend/internal/application/process/trans_save_rules.go:488-498`, `:503-513`, `:522-575`
- `backend/internal/application/process/trans_party.go:224-255`
- `backend/internal/application/process/trans_new_defaults.go:39-44`
- `frontend/src/config/schemas/arCustomerDetail.ts:309-373`
- `frontend/src/config/schemas/apSupplierDetail.ts:242`, `:279`
- `frontend/src/config/bcMenu.json:710-711`, `:942-943`
