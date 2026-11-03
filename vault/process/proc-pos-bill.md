---
title: "POS รับบิลขายจากเครื่องแคชเชียร์ กล่องรับบิล/ประมวลผล/ยกเลิก/ตัดสต็อกเป็นชุด (POS Bill Inbox)"
tags: [process, pos, bill, inbox, trans_flag-44, idempotency, cancel, stock-queue]
aliases: ["ReceivePosBill", "ReprocessPosBills", "processPosBill", "savePosBillTx", "savePosPaymentTx", "CancelPosBill", "cancelPosBillTx", "pos_bill_inbox", "pos_stock_queue", "DrainPosStock", "bill_guid", "api/v1/pos/bills", "api/v1/pos/bills/reprocess", "trans_flag 44", "trans_flag 45", "บิลขาย POS", "ยกเลิกบิล POS"]
sources: ["backend/internal/application/process/pos_bill.go:20", "backend/internal/application/process/pos_bill.go:26", "backend/internal/application/process/pos_bill.go:105", "backend/internal/application/process/pos_bill.go:123", "backend/internal/application/process/pos_bill.go:175", "backend/internal/application/process/pos_bill.go:202", "backend/internal/application/process/pos_bill.go:314", "backend/internal/application/process/pos_bill.go:424", "backend/internal/application/process/pos_bill.go:575", "backend/internal/application/process/pos_bill.go:601", "backend/internal/application/process/pos_bill.go:636", "backend/internal/application/process/pos_bill.go:668", "backend/internal/application/process/pos_bill.go:686", "backend/internal/application/process/pos_bill.go:703", "backend/internal/application/process/trans.go:573", "backend/internal/adapter/inbound/http/pos/sync.go:111"]
---

# POS รับบิลขายจากเครื่องแคชเชียร์ (POS Bill Inbox)

เครื่อง POS ส่งบิลที่ขายเสร็จแล้วมาที่ `POST /api/v1/pos/bills` ระบบเก็บ JSON ดิบลง `pos_bill_inbox` ก่อน (คีย์ `bill_guid` ส่งซ้ำไม่ซ้ำบิล) แล้วค่อยแปลงเป็นเอกสารขาย `trans_flag = 44` ผ่าน `saveTransTx` (ยอดรวม/VAT/GL คำนวณฝั่งเซิร์ฟเวอร์) บิลที่ประมวลผลพลาดยังถูกเก็บไว้และสั่งประมวลผลซ้ำได้ (คอมเมนต์ `pos_bill.go:20-24`) ส่วนการดึงข้อมูลลงเครื่องอยู่ที่ [[proc-pos-sync]]

## ทำงานอย่างไร

### Input บิล (`PosBillInput` :59, handler `pos/sync.go:111`)
- Handler อ่าน body ได้ไม่เกิน 1 MiB (`1<<20`) แล้วส่ง JSON ดิบให้ `ReceivePosBill`
- ฟิลด์: `bill_guid`, `doc_no`, `doc_date` (YYYY-MM-DD ตอนขายบนเครื่อง), `doc_time` (HH:MM), `cashier_code`, `cust_code`, `bill_discount`, `coupon_code`, `coupon_amount`, `points_redeemed`, `remark`, `lines[]` (`item_code`, `barcode`, `name`, `unit_code`, `qty`, `price`, `discount`), `payments[]` (`method`, `amount`)
- ราคาในบิลคือราคา ณ ตอนขาย เซิร์ฟเวอร์ไม่ตั้งราคาใหม่ (คอมเมนต์ :75-76)
- ตัวเลขทุกตัวเป็น `Dec` = สตริงทศนิยมหรือตัวเลขเปล่าใน JSON ที่เก็บเป็นข้อความตรง ไม่ผ่าน `float64`; รูปแบบต้องตรง `^-?\d+(\.\d+)?$` ไม่งั้นแกะ JSON ไม่ผ่าน (`Dec.UnmarshalJSON` :37-54)
- `parsePosBill` (:105): `bill_guid` ต้องเป็น UUID, `doc_no` (ผ่าน `normalizeDocNo`) ยาว 1-25 ตัวอักษร, ต้องมีรายการสินค้าอย่างน้อย 1 รายการ ผิด = error ตรวจสอบ (400)

### รับบิล `ReceivePosBill` (:123)
1. INSERT ลง `pos_bill_inbox (bill_guid, machine_code, doc_no, payload)` แบบ `ON CONFLICT (bill_guid) DO NOTHING` -- ถ้า `doc_no` ซ้ำกับบิลอื่น (unique index `idx_pos_bill_inbox_doc_no`) ตอบ 409 ให้ตรวจรูปแบบเลขที่บิลของเครื่อง
2. ส่งซ้ำ (ไม่มีแถวใหม่) = `Duplicate = true`: ถ้า `bill_guid` เป็นของเครื่องอื่น = 409; ถ้าบิลประมวลผลแล้ว (สถานะ 1 หรือ 2) ตอบตามที่เก็บไว้ (`done` หรือ `error` + ข้อความ) ไม่ประมวลผลใหม่; ถ้ายังค้าง (สถานะ 0) ประมวลผลต่อ
3. อัปเดต `pos_sync_machine.last_bill_at`
4. เรียก `processPosBill` แล้วตั้งเวลาตัดสต็อกเป็นชุด (`schedulePosStockDrain`)
- ผลลัพธ์ `PosBillResult`: `bill_guid`, `doc_no`, `status` (`done` | `cancelled` | `error`), `error`, `duplicate`, `total_amount`, `earned_points` -- `status = "error"` ยังหมายถึง "เก็บบิลแล้ว" back office แก้แล้วประมวลผลซ้ำได้ (คอมเมนต์ :93-94)
- `pos_bill_inbox.status`: 0 รอ, 1 เสร็จ, 2 ผิดพลาด (คอมเมนต์ schema `pos_sync.go:53`)

### แปลงเป็นเอกสารขาย `processPosBill` (:202) -- ใน transaction เดียว หมดเวลา 60 วินาที
1. ล็อกอ่านแถวใน inbox (`FOR UPDATE`) แล้ว `savePosBillTx` (:314):
   - อ่านค่าเครื่องจาก `pos_id` (คลัง `pos_ic_wht`, ที่เก็บ `pos_ic_shelf`, สาขา, แผนก) + `posconfig` (ลูกค้าเริ่มต้น `cust_code_default`, `vat_type`, `vat_rate`) + `pos_point_condition.baht_per_point` ไม่พบเครื่อง = "ไม่พบเครื่อง POS"
   - ตรวจแต่ละบรรทัด: ต้องมีรหัสสินค้าใน `ic_inventory` (`loadPosItems` :539), จำนวน > 0; ตัวตั้ง/ตัวหารหน่วยนับจาก `ic_unit_use` (ไม่พบหน่วย = 1/1); ยอดบรรทัด = `qty * price - discount` ปัด 2 ตำแหน่ง
   - สร้างเอกสารด้วย `buildTransArgs` + `saveTransTx` เป็น `TransType 2`, `TransFlag 44`, `InquiryType 1` (ขายสด) ส่วนลดท้ายบิล = `bill_discount` ตั้ง `deferStock = true` (สต็อก/ต้นทุนไม่คำนวณในรอบนี้ แต่ลงคิว `pos_stock_queue` ที่ `trans.go:573`)
   - ป้องกันชนเอกสารอื่น: ถ้ามี `ic_trans` flag 44 เลขเดียวกันที่ไม่ใช่บิล POS ของเครื่องนี้ = error "เลขที่บิล ... ซ้ำกับเอกสารขายที่มีอยู่แล้ว" (บิล POS แทนที่ได้เฉพาะสำเนาก่อนหน้าของตัวเอง)
   - รวมยอดรับชำระ ต้องไม่น้อยกว่ายอดบิลที่เซิร์ฟเวอร์คำนวณ ไม่งั้น error "ยอดรับชำระ ... น้อยกว่ายอดบิล ..."
   - แต้ม: ถ้า `baht_per_point > 0` และมีสมาชิกที่ไม่ใช่ลูกค้าเริ่มต้น แต้ม = floor(ยอดบิล / บาทต่อแต้ม) (ปัดลงเป็นจำนวนเต็ม)
   - ตั้ง `ic_trans.is_pos = 1`, `pos_id`, `cashier_code`, `payment_method` (`posPaymentMethod` :527 = วิธีเดียวหรือ `MIXED`; ไม่ระบุ = `CASH`), `sum_point`; ตั้ง `ic_trans_detail.is_pos = 1`; ลบหัวเอกสารยกเลิก (flag 45) เดิมของบิลนี้
   - `savePosPaymentTx` (:424) เขียน `cb_trans` + `cb_trans_detail` ใหม่ทั้งชุด; แล้ว `rebuildGLTx` สร้างบัญชีแยกประเภทใหม่ (นอกขอบเขตโน้ตนี้ ดู [[accounting-overview]])
2. ถ้ามีรอยยกเลิกบน inbox (`cancelled_at`) เรียก `cancelPosBillTx` ต่อ แล้วแต้ม = 0 และ `status = "cancelled"`
3. ตั้ง inbox `status = 1`, `processed_at`, `earned_points`; คำนวณแต้มคงเหลือสมาชิกใหม่ (`rebuildPosCustomerPoints`) และยอดคงเหลือคูปอง (`rebuildPosCoupon`) ถ้ามี
4. ถ้าสำเร็จ พยายามเขียน `etax_document_log` และ `crm_customer_activity` แบบ best-effort (ผิดพลาดแล้วเงียบ ไม่กระทบบิล, `:247-284`) ใช้เฉพาะแถวที่ยังไม่มีในตารางนั้น ๆ -- ค่าบางฟิลด์ในคำสั่ง INSERT เป็นค่าคงที่ที่โค้ดเขียนเอง (เช่นสถานะ e-Tax) ไม่ได้มาจากบริการภายนอก (อ่านจาก SQL; ยังไม่ได้ตรวจว่าตารางทั้งสองมีผู้ใช้ปลายทางอื่นหรือไม่)
5. ถ้าพลาด: ความผิดของข้อมูล (error ตรวจสอบ หรือ PG class 22/23) บันทึก `status = 2` + ข้อความลง inbox แล้วตอบ `status = "error"`; ความผิดอื่น (โครงสร้างพื้นฐาน) คืน error ให้เครื่องลองส่งใหม่ภายหลัง (:286-303)

### วิธีรับชำระ (`savePosPaymentTx` :424)
แยกยอดตาม `method` (ไม่สนตัวพิมพ์): `TRANSFER`/`BANK` -> โอน, `PROMPTPAY`/`QR`/`WALLET` -> วอลเล็ต/QR, `CARD`/`CREDIT_CARD`/`CREDIT` -> บัตร, อื่น ๆ ทั้งหมด -> เงินสด จัดสรรยอดบิลตามลำดับ โอน -> วอลเล็ต -> บัตร (ส่วนที่เหลือเป็นเงินสดสุทธิ) เงินทอน = ยอดรับรวม - ยอดบิล (ต่ำสุด 0) เขียน `cb_trans` (flag 44) และ `cb_trans_detail` เฉพาะที่ไม่ใช่เงินสด โดย `doc_type`: 1 = โอน, 3 = บัตร, 21 = QR/วอลเล็ต (:490-497) ใส่ `coupon_amount` และ `point_qty` = แต้มที่ใช้แลก

### ประมวลผลซ้ำ `ReprocessPosBills` (:175)
`POST /api/v1/pos/bills/reprocess {"all": false}`: เลือกบิลจาก inbox ที่ `status <> 1` (หรือทั้งหมดถ้า `all = true`) เรียงตาม `received_at` สูงสุด 5000 บิล แล้ว `processPosBill` ทีละใบ ผลเป็นรายการ `PosBillResult` และคืน error ทันทีถ้าพลาดแบบโครงสร้างพื้นฐาน ใช้หลังแก้ข้อมูลหลัก (เช่นเพิ่มสินค้าที่ขาด) เพราะ `payload` ดิบยังอยู่ครบ

### ยกเลิกบิล `CancelPosBill` (:575)
- เรียกจาก `PosShiftAction` เมื่อ `action = "cancel_bill"` (`pos_config.go:997`): ตั้ง `cancelled_at`, `cancel_reason`, `cancelled_by` บนแถว inbox (เครื่องยกเลิกได้เฉพาะบิลของตัวเอง) แล้วประมวลผลบิลซ้ำ -- เก็บเป็นเหตุการณ์ดิบเพื่อให้การสร้างใหม่จาก inbox ยังคงยกเลิก
- `cancelPosBillTx` (:601) ตามคอมเมนต์อ้างอิง C# `_cancelBillForm.cs:126-142`: ตั้ง `last_status = 1` (และ `is_cancel = 1` ที่หัว) ใน `ic_trans`, `ic_trans_detail`, `cb_trans_detail` ของ flag 44; ลบแล้วเพิ่มหัวเอกสาร `trans_flag = 45` เลข `left('CNM-' || doc_no, 25)` ที่ `doc_ref` ชี้บิลเดิม; แล้ว `rebuildGLTx` ให้บิลที่ยกเลิกไม่มีรายการบัญชี ข้อความเหตุผลเริ่มต้น "ยกเลิกบิลขาย POS"

### แต้มสมาชิกและคูปอง (สร้างใหม่ ไม่ลดทีละรายการ)
- `rebuildPosCustomerPoints` (:636): `point_balance` = max(0, ผลรวม `sum_point` ของ `ic_trans` ที่ `last_status = 0` และไม่ยกเลิก (flag 412 ติดลบ; นับเอกสาร POS หรือ flag 44, 410, 412) ลบด้วยผลรวม `cb_trans.point_qty` ของเอกสารที่ยังไม่ถูกยกเลิก) ดูเทียบ [[proc-sysproc-tools]] (`point-recal` ที่คำนวณ `sum_point` ใหม่ย้อนหลัง)
- `rebuildPosCoupon` (:668): `balance_amount` = max(0, `amount` - ผลรวม `coupon_amount` จากบิล inbox ที่ `status = 1` และไม่ถูกยกเลิก) และถ้าคูปองใช้ครั้งเดียว (`single_use = 1`) ที่ถูกใช้แล้วจะตั้ง `last_status = 1`

### ตัดสต็อก/ต้นทุนเป็นชุด (`pos_stock_queue`)
- `saveTransTx` ลงรหัสสินค้า (ของเดิมและใหม่ เพื่อให้บิลที่ประมวลผลซ้ำแก้บรรทัดที่หายด้วย) ลง `pos_stock_queue` เมื่อ `deferStock` (`trans.go:573`, `queuePosStock` :517)
- `schedulePosStockDrain` (:686) รวมการรีบิลด์ของบิลหลายใบในช่วงเดียวกันให้เหลือหนึ่งรอบต่อฐานบริษัท หน่วงเวลา 2 วินาที (`posStockDrainDelay`) -- ขายสินค้าเดียวกัน 100 บิลรีบิลด์รหัสนั้นครั้งเดียว
- `DrainPosStock` (:703) ลบจากคิวครั้งละ 200 รหัส (`FOR UPDATE SKIP LOCKED` ให้หลายอินสแตนซ์ทำงานร่วมกันได้) แล้ว `rebuildStockTx` ถ้ารอบใดพลาด รายการยังค้างคิวรอรอบของบิลถัดไป ปริมาณค้างคิวเห็นได้ใน `stock_queue` ของ `ListPosDevices` ดู [[proc-pos-sync]]

## ที่มาในโค้ด
- `backend/internal/application/process/pos_bill.go:20-56` - คอมเมนต์หลัก, `posBillFlag` (44), `Dec`
- `backend/internal/application/process/pos_bill.go:58-120` - ชนิดข้อมูลบิล, `parsePosBill`
- `backend/internal/application/process/pos_bill.go:122-198` - `ReceivePosBill`, `ReprocessPosBills`
- `backend/internal/application/process/pos_bill.go:200-304` - `processPosBill`
- `backend/internal/application/process/pos_bill.go:312-419` - `savePosBillTx`
- `backend/internal/application/process/pos_bill.go:421-513` - `savePosPaymentTx`
- `backend/internal/application/process/pos_bill.go:515-570` - `queuePosStock`, `posPaymentMethod`, `loadPosItems`
- `backend/internal/application/process/pos_bill.go:572-680` - ยกเลิกบิล, แต้ม, คูปอง
- `backend/internal/application/process/pos_bill.go:682-736` - คิวตัดสต็อกเป็นชุด
- `backend/internal/application/process/trans.go:573-578` - ลงคิวสต็อกเมื่อ `deferStock`
- `backend/internal/adapter/inbound/http/pos/sync.go:110-125` - `PostBill`
- `backend/internal/application/process/pos_sync.go:54-70` - schema `pos_bill_inbox`

## ดูเพิ่ม
- [[proc-pos-sync]]
- [[proc-pos-config-shift]]
- [[proc-doc-flow-numbering]]
- [[proc-doc-cancel-approve]]
- [[proc-sysproc-tools]]
- [[accounting-overview]]
- [[process-overview]]
