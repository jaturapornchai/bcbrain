---
title: "เครดิต วันครบกำหนด และวงเงินสินเชื่อ (credit_day / due_date / credit_money)"
tags: [glossary, ar, ap, credit]
aliases: ["เครดิต", "เครดิต (วัน)", "จำนวนวันเครดิต", "credit_day", "creditDay", "ครบกำหนด", "วันครบกำหนด", "วันครบกำหนดชำระ", "due_date", "dueDate", "credit_date", "วงเงิน", "วงเงินสินเชื่อ", "credit_money", "วงเงินสินเชื่อสูงสุด", "credit_money_max", "สถานะสินเชื่อ", "credit_status", "เกินวงเงิน", "อนุมัติวงเงิน", "user_approve", "is_hold", "ระงับ", "erp_credit_request", "วันที่วางบิล", "pay_bill_date", "ระยะเวลาส่งของ", "lead_time"]
sources: ["frontend/account/transaction/TransTopForm.tsx:486", "frontend/account/transaction/TransTopForm.tsx:501", "frontend/account/transaction/transLayouts.ts:327", "backend/internal/application/process/trans.go:121", "backend/internal/application/process/trans.go:657", "backend/internal/application/process/trans_credit.go:1", "frontend/src/config/schemas/arCustomerDetail.ts:309", "frontend/src/config/schemas/arCustomerDetail.ts:314", "frontend/src/config/schemas/arCustomerDetail.ts:319", "frontend/src/config/schemas/arCustomerDetail.ts:329", "frontend/src/config/schemas/arCustomerDetail.ts:368", "frontend/src/config/schemas/apSupplierDetail.ts:242", "frontend/src/config/schemas/apSupplierDetail.ts:279", "frontend/src/config/bcMenu.json:711", "frontend/src/config/bcMenu.json:943"]
---

# เครดิต / ครบกำหนด / วงเงินสินเชื่อ

## ในระบบนี้คืออะไร
- **ในเอกสาร**: ช่อง "เครดิต (วัน)" (`TransTopForm.tsx:486`) → `creditDay` → `ic_trans.credit_day` และช่อง "ครบกำหนด" (`:501`) → `dueDate` → `ic_trans.due_date` (`trans.go:121-122`) หัวเอกสารยังมี `credit_date` (`trans.go:657-688`)
- ช่องเครดิตและครบกำหนดแสดงเมื่อเอกสารมีคู่ค้า ยกเว้น flag 10, 20, 38, 40 และจอเงินสด/ธนาคาร (`transLayouts.ts:327-328`)
- **ใน master ลูกหนี้** (`arCustomerDetail.ts`): วงเงินสินเชื่อ `credit_money` (:309), วงเงินสินเชื่อสูงสุด `credit_money_max` (:314), จำนวนวันเครดิต `credit_day` (:319), สถานะสินเชื่อ `credit_status` (:329), เหตุผลในการระงับ `close_reason` (:349), วันที่วางบิล `pay_bill_date` (:368), วันที่รับเช็ค `keep_chq_date` (:373)
- **ใน master เจ้าหนี้** (`apSupplierDetail.ts`): จำนวนวันเครดิต `credit_day` (:242), ระยะเวลาส่งของ (วัน) `lead_time` (:279)

## การตรวจวงเงิน (`trans_credit.go:1-11`)
- ขายที่เกินวงเงินต้องมีผู้อนุมัติ (`ic_trans.user_approve`) ผ่านสิทธิ์ `password_ar_credit`
- สั่งจอง 34 และสั่งขาย 36 ที่เปิด `sr_ss_credit_check` จะถูกพักไว้ (`is_hold`) และสร้างคำขอใน `erp_credit_request` หรืออนุมัติอัตโนมัติ
- หนี้ค้างที่ใช้เทียบวงเงินคำนวณจากเอกสาร ดู [[term-ap-ar-balance]]

## หน้าจอตั้งค่า
"กำหนดกลุ่มอนุมัติวงเงิน" (`menu_approve_credit_level`, bcMenu.json:711), "กำหนดวันครบกำหนดชำระเงิน" (`ar_credit_pay_bill`, :943)

## ข้อควรระวัง
- ขั้นตอนขอวงเงินผ่าน OTP (`request_ar_credit`, ic_trans_draft, SMS/e-mail) ยังไม่ได้ port ตอนนี้ขายเกินวงเงินจะถูกบล็อกไว้ (`trans_credit.go:5-7`)
- ช่อง "ระงับชั่วคราว" (`on_hold`, `TransTopForm.tsx:349`) ของหัวเอกสารเป็นคนละช่องกับ `is_hold` ของการตรวจวงเงิน ยังไม่ได้ตรวจว่าเกี่ยวข้องกันหรือไม่

## ลิงก์
[[acc-credit-limit-save-rules]] · [[term-ap-ar-balance]] · [[term-party-ap-ar]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/account/transaction/TransTopForm.tsx:349`, `:486`, `:501`
- `frontend/account/transaction/transLayouts.ts:327-328`
- `backend/internal/application/process/trans.go:121-122`, `:657-688`
- `backend/internal/application/process/trans_credit.go:1-11`
- `frontend/src/config/schemas/arCustomerDetail.ts:309-373`
- `frontend/src/config/schemas/apSupplierDetail.ts:242`, `:279`
- `frontend/src/config/bcMenu.json:711`, `:943`
