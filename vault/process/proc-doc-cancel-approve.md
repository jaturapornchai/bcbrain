---
title: "ยกเลิกและอนุมัติเอกสาร (Document cancel / approve)"
tags: [process, document, cancel, approve, idempotent, ic_trans]
aliases: ["doc/cancel", "doc/approve", "CancelDoc", "ApproveDoc", "DocStatusInput", "cancel_type", "ยกเลิกรายสินค้า", "คืนสถานะ", "อนุมัติ PR"]
sources: ["backend/internal/application/process/doc_cancel.go:23", "backend/internal/application/process/doc_cancel.go:49", "backend/internal/application/process/doc_cancel.go:73", "backend/internal/application/process/doc_cancel.go:120", "backend/internal/application/process/doc_cancel.go:135", "backend/internal/application/process/doc_cancel.go:205", "backend/internal/application/process/doc_cancel.go:215", "backend/internal/application/process/doc_cancel.go:497", "backend/internal/application/process/doc_cancel_item.go:15", "backend/internal/application/process/doc_approve_item.go:20", "backend/internal/adapter/inbound/http/process/doc_cancel_handler.go:12"]
---

# ยกเลิกและอนุมัติเอกสาร (Document cancel / approve)

การยกเลิกหรืออนุมัติเอกสารไม่ได้แก้เอกสารเดิมตรง ๆ แต่ **สร้างเอกสารใหม่แยกต่างหาก** (`trans_flag` = flag ของเอกสารยกเลิก/อนุมัติ, `doc_ref` = เลขที่เอกสารเดิม) แล้ว "คำนวณสถานะ" ของเอกสารเดิม (`last_status`, `approve_status`) กลับจากเอกสารใหม่นั้น การคืนสถานะ (undo) คือลบเอกสารใหม่แล้วคำนวณซ้ำ จึงทำซ้ำได้ผลเดิม (idempotent)

## ทำงานอย่างไร

### เส้นทางและสิทธิ์
- `POST /process/doc/cancel` -> `Service.CancelDoc`, `POST /process/doc/approve` -> `Service.ApproveDoc` (handler `serveDocStatus` ประทับ `ProviderCode`, `DatabaseName`, `UserCode` จาก claims)
- สิทธิ์ route: `write` ทั้งคู่ (ตาราง `routeRights`) ดู [[proc-permission-rights]]

### Input (`DocStatusInput`, ฟิลด์ที่มาจาก JSON)
`menuName`, `flag` (flag เอกสารยกเลิก/อนุมัติ), `origFlag` (flag เอกสารเดิม), `docRef` (เลขที่เอกสารเดิม), `docFormat`, `screenCode`, `docDate` (YYYY-MM-DD ว่าง = วันนี้), `remark` (เหตุผล ตัดที่ 255), `undo`, `notApprove`, `cancelType`, `lines` (รายสินค้าที่ยกเลิก), `cancelDocNo` (เฉพาะ undo), `approveLines` (เฉพาะอนุมัติ PR)

### การตรวจก่อนทำ (`docStatusTarget`)
- คู่ flag ที่รองรับกำหนดในตาราง: `cancelOrigFlags` (เช่น 3 ยกเลิก 2, 7 ยกเลิก 6, 31 ยกเลิก 30, 45 ยกเลิก 44, 73 ยกเลิก 70/72 ฯลฯ) และ `approveOrigFlags` (`4`->2, `8`->6, `32`->30, `38`->34, `52`->36); flag ที่ไม่อยู่ในตาราง หรือจับคู่กับ `origFlag` ผิด -> error "ประเภทเอกสาร ... ไม่รองรับ/ใช้กับ ... ไม่ได้"
- เอกสารกลุ่ม `ap_ar_trans` (flag 214, 23, 236, 240) ใช้ตาราง `ap_ar_trans`; นอกนั้นใช้ `ic_trans`
- `cancelType`: 1 = ยกเลิกทั้งใบ (ค่าเริ่มต้น), 2 = ยกเลิกรายสินค้า (ใช้ได้เฉพาะ flag ที่อยู่ใน `cancelTypeFilter` ของ `doc_flow.go:234` คือ 7, 39, 37, 3, 31 และไม่ใช่การอนุมัติ)
- `approveLines` ใช้ได้เฉพาะอนุมัติใบขอซื้อ flag 4 ที่ไม่ใช่ undo/ไม่อนุมัติ
- `docRef` ต้องไม่ว่างและไม่เกิน 25 ตัวอักษร

### ขั้นตอนยกเลิก (`cancelDocTx`, ใน transaction เดียวผ่าน `inTransTx`)
1. ล็อกเอกสารและสินค้า (`lockTransDoc`, `lockStockItems`) และตรวจงวดบัญชี (`checkCancelPeriod`); `ic_trans` ตรวจ `refuseLockedRecord` ก่อน
2. อ่าน `last_status` ของเอกสารเดิม; ถ้า `status == 1` และไม่ใช่ undo -> "เอกสาร ... ถูกยกเลิกแล้ว"
3. ไม่ใช่ undo: ถ้า `cancelType = 2` ตรวจยอดคงเหลือรายบรรทัด (`checkItemCancel`) มิฉะนั้นตรวจว่าไม่ถูกเอกสารอื่นอ้างอิง (`refuseIfReferenced`); แล้ว `insertStatusDoc` (เขียนเฉพาะ header; คอมเมนต์ `ponytail` อธิบายว่าไม่คัดลอกบรรทัดเพราะ flag 55-73 เป็น flag ที่ขยับสต็อก จะกลับสต็อกซ้ำสอง) และ `insertCancelLines` ถ้ายกเลิกรายสินค้า
4. undo: `deleteStatusDocs` ลบเอกสารยกเลิก (ระบุ `cancelDocNo` = ลบใบนั้นใบเดียว, ว่าง = ลบทุกใบของ `docRef`); ถ้าไม่ระบุ `cancelDocNo` แล้วสถานะหลังคำนวณยังเป็นยกเลิก (ถูกยกเลิกด้วยวิธีเดิมของ C#) ตอบ "คืนสถานะจากหน้านี้ไม่ได้" (`doc_cancel.go:185`)
5. `deriveLastStatus` คำนวณ `last_status` ใหม่ -> `docFlowTx` ([[proc-doc-flow-numbering]]) -> `rebuildTransDerived` คำนวณสต็อก/GL/สถานะเช็คของเอกสารเดิมใหม่ -> `writeProcessLog` (action `cancel` หรือ `restore`)

### ขั้นตอนอนุมัติ (`approveDocTx`)
- ไม่ขยับสต็อกหรือ GL; ปฏิเสธเมื่อเอกสารถูกยกเลิกแล้ว ("อนุมัติไม่ได้"), บันทึกไม่อนุมัติแล้ว (`approve_status = 2`), หรืออนุมัติแล้ว (`approve_status <> 0`)
- `insertStatusDoc` สร้างเอกสารอนุมัติ; flag 4 เพิ่ม `insertApproveLines` (ผู้อนุมัติแก้จำนวน/ราคา/ส่วนลดต่อบรรทัดได้ ค่าที่ขอเดิมเก็บไว้ใน `temp_float_1`, `temp_float_2`, `temp_string_1`; qty 0 = ไม่อนุมัติบรรทัดนั้น)
- `approve_status` (และ `used_status`/`doc_success` ของ PR/PO) ถูกคำนวณโดย `docFlowTx`; `notApprove` คือเอกสารอนุมัติที่ปฏิเสธ (`approve_status = 2`)
- flag ใน `userApproveFlags` (3, 4, 7, 8, 31, 32, 37, 38, 39, 52) บันทึกผู้ใช้เป็น `user_approve`

### การห้ามยกเลิกเมื่อถูกอ้างอิง (`refuseIfReferenced`)
- ใบสั่งซื้อ/ใบจอง/ใบสั่งขาย (ตาม `orderSpecs`): ปฏิเสธเมื่อบรรทัดถูกนำไปใช้ครบ (`doc_success`) แต่ยังยกเลิกได้ถ้าใช้บางส่วน
- ใบขอซื้อ (flag 2): ถ้าเปิดตัวเลือก `purchase_request_approve_until_end` ใช้ `doc_success` แทน `used_status`
- นอกนั้นหา "เอกสารที่ยังไม่ถูกยกเลิกและอ้างอิงอยู่" (`referencingDoc`) จาก `ref_doc_no` ในบรรทัด, เช็คฝาก/ผ่าน (410/411), เอกสารอนุมัติ/คืน, ใบวางบิล/ชำระ ฯลฯ แล้วตอบ "เอกสาร X มีการอ้างอิงไปแล้วโดยเอกสาร Y"

### ยกเลิกรายสินค้า (`doc_cancel_item.go`)
- รองรับใบสั่งซื้อ (6, ยกเลิก 7), ใบจอง (34, ยกเลิก 39), ใบสั่งขาย (36, ยกเลิก 37) และผ่าน `quoteSpecs` ใบขอซื้อ (2, ยกเลิก 3) กับใบเสนอราคา (30, ยกเลิก 31)
- ยอดคงเหลือต่อบรรทัด = จำนวนเดิมลบจำนวนในเอกสารกลุ่ม `balance` ที่อ้าง `ref_doc_no` (ใบจอง/ใบสั่งขายจับคู่ด้วย `ref_row` ด้วย) ปรับหน่วยด้วย `stand_value/divide_value`; จำนวนที่ยกเลิกเป็นสตริงทศนิยม คำนวณด้วย `big.Rat`

## จุดที่ต้องระวัง
- ใช้ flag ผิดคู่ = error ทันที ไม่มีการเดา
- ถ้ายกเลิกรายสินค้ามาก่อน การยกเลิกทั้งใบของ PR/ใบเสนอราคาอาจถูกปฏิเสธ (นับเอกสารยกเลิกรายสินค้าเป็นการอ้างอิง) หากไม่เปิดตัวเลือก `purchase_request_approve_until_end` (ตามคอมเมนต์ใน `refuseIfReferenced`)
- เลขที่เอกสารยกเลิก/อนุมัติสร้างด้วย `nextDocNo` ดู [[proc-doc-flow-numbering]]

## ที่มาในโค้ด
- `backend/internal/application/process/doc_cancel.go:23-47` - `DocStatusInput`
- `backend/internal/application/process/doc_cancel.go:49-70` - `cancelOrigFlags`, `apArCancelFlags`, `approveOrigFlags`, `userApproveFlags`
- `backend/internal/application/process/doc_cancel.go:73` - `docStatusTarget`
- `backend/internal/application/process/doc_cancel.go:120-203` - `CancelDoc`, `cancelDocTx`
- `backend/internal/application/process/doc_cancel.go:205-266` - `ApproveDoc`, `approveDocTx`
- `backend/internal/application/process/doc_cancel.go:298` - `insertStatusDoc`; `:339` `deleteStatusDocs`
- `backend/internal/application/process/doc_cancel.go:497` - `refuseIfReferenced`; `:547` `referencingDoc`
- `backend/internal/application/process/doc_cancel_item.go:15-39` - `CancelLine`, `orderSpecs`, `quoteSpecs`
- `backend/internal/application/process/doc_cancel_item.go:135` - `checkItemCancel`; `:162` `insertCancelLines`
- `backend/internal/application/process/doc_approve_item.go:20` - `ApproveLine`; `:59` `insertApproveLines`
- `backend/internal/adapter/inbound/http/process/doc_cancel_handler.go:12-33` - handler

## ดูเพิ่ม
- [[proc-doc-flow-numbering]]
- [[proc-dispatcher]]
- [[proc-permission-rights]]
- [[accounting-overview]]
- [[process-overview]]
