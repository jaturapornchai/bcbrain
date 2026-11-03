---
title: "การลบ แก้ไข และล็อกเอกสาร (Transaction Delete / Edit Guards)"
tags: [accounting, transaction, delete, edit, audit]
aliases: ["ลบเอกสาร", "แก้ไขเอกสาร", "ห้ามแก้ไข", "Lock เด็ดขาด", "เอกสารถูกอ้างอิง", "DeleteTrans", "ยกเลิกเอกสาร"]
sources: ["backend/internal/application/process/trans.go:382", "backend/internal/application/process/trans.go:395", "backend/internal/application/process/trans_validate.go:95", "backend/internal/application/process/trans_validate.go:112", "backend/internal/application/process/trans_validate.go:132", "backend/internal/application/process/trans_validate.go:142", "backend/internal/application/process/trans_deposit.go:246", "backend/internal/application/process/trans_tax.go:22", "backend/internal/application/process/period.go:68"]
---

# การลบ แก้ไข และล็อกเอกสาร

การแก้ไขเอกสาร = บันทึกทับด้วยเลขเดิม (`IsNew` = false) ซึ่งใน `saveTransTx` จะลบแถวเดิมแล้ว insert ใหม่ การลบใช้ `DeleteTrans` ที่ลบแถวดิบทั้งหมดแล้ว rebuild สต็อก/GL/serial ใหม่ ทั้งสองทางผ่านด่านตรวจชุดเดียวกัน คือ lock, สถานะเอกสาร และงวดบัญชีของวันที่ที่บันทึกไว้เดิม

## ทำงานอย่างไร

### ด่านตรวจก่อนแก้ไข/ลบ
1. `refuseLockedRecord` (trans_validate.go:112): `ic_trans.is_lock_record` = 1 แก้ไขหรือลบไม่ได้
   - ข้อความทั่วไป "Lock เด็ดขาด : ห้ามแก้ไข หรือลบข้อมูล"
   - เอกสาร 66 ที่สร้างจากเมนูเฉลี่ยต้นทุนแฝง (2.22) มีข้อความเฉพาะ
   - `HiddenCostSave`/`HiddenCostDelete` เรียก `saveTransTx`/`deleteTransTx` ตรง จึงข้ามด่านนี้ (comment ที่บรรทัด 111)
2. `checkStoredEditable` + `editLocked` (trans_validate.go:132-158): ห้ามแก้/ลบเมื่อ
   - `used_status` = 1 หรือ `used_status_2` = 1 (ถูกดึงไปใช้แล้ว)
   - `doc_success` = 1 (ปิดเอกสารแล้ว)
   - `last_status` = 1 (ยกเลิกแล้ว)
   - `approve_status` >= 1 เฉพาะ flag 34 (สั่งจอง)
   - `is_doc_copy` = 1
   - ยกเว้น: flag 30 (เสนอราคา) แก้ได้เมื่อเปิด `erp_option.doc_sale_order_edit`
3. แก้ไขเอกสารที่ไม่มีอยู่จริง = "ไม่พบเอกสารที่จะแก้ไข" (กันผู้ใช้สิทธิ์แก้ไขอย่างเดียวสร้างเอกสารใหม่)
4. งวดบัญชี: การลบตรวจงวดของ `doc_date` ที่เก็บอยู่ (`checkStoredDocPeriod` period.go:68) ดู [[acc-period-close]]

### ลำดับการลบ (`deleteTransTx` trans.go:395)
1. `lockTransDoc` และ `lockStockItems`
2. `refuseUsedDepositDelete` (trans_deposit.go:246): เอกสารมัดจำที่ถูกใช้แล้วหรือมีเอกสารคืนอ้างอิง ลบไม่ได้
3. `referencingDoc`: ถ้ามีเอกสารอื่นอ้างอิงอยู่ จะปฏิเสธด้วยข้อความ "มีการอ้างอิงไปแล้วโดยเอกสาร...ไม่สามารถลบได้"
4. DELETE จาก `ic_trans_serial_number`, `ic_trans_shipment`, `ic_trans_detail`, `ic_trans`, `cb_trans_detail`, `cb_trans`, `cb_chq_list` (ตาม doc_ref), `ap_ar_trans_detail` และแถว VAT/WHT (`transTaxDeleteSQL`)
5. `docFlowTx`, `rebuildSerialTx`, `rebuildTransDerived` (สต็อก, GL, เช็ค)

### การยกเลิก (cancel) ต่างจากการลบ
- เอกสารที่ยกเลิกยังเก็บแถวไว้ โดยตั้ง `last_status` = 1
- แถว VAT ยังอยู่ แต่รายงานภาษีจะทำให้เป็นศูนย์จาก `ic_trans.last_status` (comment trans_tax.go:22-23)
- สต็อกไม่นับบรรทัดที่ `last_status` <> 0 (stock_rebuild.go:18)
- GL ของเอกสารยกเลิกกลับรายการด้วย `reverseCancelledGL` (doc_cancel.go:585) ซึ่งอยู่นอกขอบเขตโน้ตนี้ (รายละเอียดยังไม่ยืนยัน)
- งวดของการยกเลิกตรวจทั้งวันที่เอกสารยกเลิกและวันที่ต้นฉบับ (`checkCancelPeriod` period.go:95)

### Edge case
- `deleteTransTx` ไม่ตรวจงวดเอง ด่านงวดอยู่ใน `checkTransScreenDelete` (trans_validate.go:95) ซึ่ง caller ต้องเรียกก่อน (ยังไม่ได้ตรวจว่าทุก caller เรียก)
- การลบเรียง lock เดียวกับการบันทึก จึงไม่ deadlock กับเอกสารที่บันทึกพร้อมกัน

## ที่มาในโค้ด
- `backend/internal/application/process/trans.go:382` DeleteTrans
- `backend/internal/application/process/trans.go:395` deleteTransTx
- `backend/internal/application/process/trans_validate.go:95` checkTransScreenDelete
- `backend/internal/application/process/trans_validate.go:112` refuseLockedRecord
- `backend/internal/application/process/trans_validate.go:132` editLocked
- `backend/internal/application/process/trans_validate.go:142` checkStoredEditable
- `backend/internal/application/process/trans_deposit.go:246` refuseUsedDepositDelete
- `backend/internal/application/process/trans_tax.go:22` VAT ของเอกสารยกเลิก
- `backend/internal/application/process/period.go:68` checkStoredDocPeriod

## ดูเพิ่ม
- [[acc-transaction-save-flow]]
- [[acc-period-close]]
- [[acc-deposit-advance]]
- [[accounting-overview]]
