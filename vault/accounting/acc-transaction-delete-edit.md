---
title: "การลบ แก้ไข และล็อกเอกสาร (Transaction Delete / Edit Guards)"
tags: [accounting, transaction, delete, edit, audit]
aliases: ["ลบเอกสาร", "แก้ไขเอกสาร", "ห้ามแก้ไข", "Lock เด็ดขาด", "เอกสารถูกอ้างอิง", "DeleteTrans", "ยกเลิกเอกสาร"]
sources: ["backend/internal/application/process/trans.go:382", "backend/internal/application/process/trans.go:395", "backend/internal/application/process/trans_validate.go:95", "backend/internal/application/process/trans_validate.go:112", "backend/internal/application/process/trans_validate.go:132", "backend/internal/application/process/trans_validate.go:142", "backend/internal/application/process/trans_deposit.go:246", "backend/internal/application/process/trans_tax.go:22", "backend/internal/application/process/period.go:68", "backend/internal/application/process/trans_validate.go:44", "backend/internal/application/process/trans_validate.go:68", "backend/internal/application/process/trans_validate.go:106", "backend/internal/application/process/hidden_cost.go:404", "backend/internal/application/process/doc_cancel.go:585", "backend/internal/application/process/doc_flow.go:234", "backend/internal/application/process/period.go:95"]
---

# การลบ แก้ไข และล็อกเอกสาร

การแก้ไขเอกสาร = บันทึกทับด้วยเลขเดิม (`IsNew` = false) ซึ่งใน `saveTransTx` จะลบแถวเดิมแล้ว insert ใหม่ การลบใช้ `DeleteTrans` ที่ลบแถวดิบทั้งหมดแล้ว rebuild สต็อก/GL/serial ใหม่ ทั้งสองทางผ่านด่าน lock และสถานะเอกสารชุดเดียวกัน แต่ตรวจงวดบัญชีต่างกัน: แก้ไขตรวจงวดของ `doc_date` ใหม่ที่กำลังบันทึก ส่วนลบตรวจงวดของ `doc_date` ที่เก็บไว้เดิม

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
3. แก้ไขเอกสารที่ไม่มีอยู่จริง = "ไม่พบเอกสารที่จะแก้ไข" (trans_validate.go:68) (กันผู้ใช้สิทธิ์แก้ไขอย่างเดียวสร้างเอกสารใหม่)
4. งวดบัญชี: การแก้ไขตรวจงวดของ `doc_date` ใหม่ (`checkOpenPeriod` trans_validate.go:44-48 ยกเว้น flag 521-523) ส่วนการลบตรวจงวดของ `doc_date` ที่เก็บอยู่ (`checkStoredDocPeriod` trans_validate.go:106 → period.go:68) ดู [[acc-period-close]]

### ลำดับการลบ (`deleteTransTx` trans.go:395)
1. `lockTransDoc` และ `lockStockItems`
2. `refuseUsedDepositDelete` (trans_deposit.go:246): เอกสารมัดจำที่ถูกใช้แล้วหรือมีเอกสารคืนอ้างอิง ลบไม่ได้
3. `referencingDoc`: ถ้ามีเอกสารอื่นอ้างอิงอยู่ จะปฏิเสธด้วยข้อความ "มีการอ้างอิงไปแล้วโดยเอกสาร...ไม่สามารถลบได้"
4. DELETE จาก `ic_trans_serial_number`, `ic_trans_shipment`, `ic_trans_detail`, `ic_trans`, `cb_trans_detail`, `cb_trans`, `cb_chq_list` (ตาม doc_ref), `ap_ar_trans_detail` และแถว VAT/WHT (`transTaxDeleteSQL`)
5. `docFlowTx`, `rebuildSerialTx`, `rebuildTransDerived` (สต็อก, GL, เช็ค)

### การยกเลิก (cancel) ต่างจากการลบ
- การยกเลิกสร้างเอกสารยกเลิกแยก แล้ว `deriveLastStatus` ตั้ง `last_status` = 1 ให้ต้นฉบับ (เก็บแถวเดิมไว้) ยกเว้นเอกสารยกเลิก flag 3/7/31/37/39 ที่เป็นการยกเลิกรายบรรทัด (cancel_type 2) จะไม่ตั้ง `last_status` ของหัวต้นฉบับ (`cancelTypeFilter` doc_flow.go:234, `deriveLastStatus` :239-252)
- แถว VAT ยังอยู่ แต่รายงานภาษีจะทำให้เป็นศูนย์จาก `ic_trans.last_status` (comment trans_tax.go:22-23)
- สต็อกไม่นับบรรทัดที่ `last_status` <> 0 (stock_rebuild.go:18)
- GL ของต้นฉบับยังอยู่ `reverseCancelledGL` (doc_cancel.go:585-672) ลงรายการกลับในชื่อเอกสารยกเลิก: สลับเดบิต/เครดิตทุกบรรทัด ชื่อบัญชีขึ้นต้นด้วย "*" ลงวันที่และงวดของเอกสารยกเลิก
- งวดของการยกเลิกตรวจทั้งวันที่เอกสารยกเลิกและวันที่ต้นฉบับ (`checkCancelPeriod` period.go:95)

### Edge case
- `deleteTransTx` ไม่ตรวจงวดเอง มีผู้เรียก 2 ทาง: `DeleteTrans` เรียก `checkTransScreenDelete` (trans_validate.go:95) ก่อนเสมอ (trans.go:388-391) ส่วนการลบเอกสารปรับต้นทุนแฝง 66 ใน `dropHiddenCostTx` (hidden_cost.go:404) เรียกตรง จึงไม่ผ่านด่าน lock/สถานะ/งวด
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
