---
title: "บทเรียนยกเลิก ลบ และยกเลิกรายบรรทัด (Cancel, Delete & Partial Cancel)"
tags: [history, cancel, delete]
aliases: ["ยกเลิกเอกสาร", "partial cancel", "per-item cancel", "refuseIfReferenced", "set item delete", "cancel undo"]
sources: ["git:e7168c84", "git:6983d7ea", "git:bd834b16", "git:86519142", "git:bc8d27d4", "git:678fc5fc", "backend/internal/application/process/doc_cancel.go:497", "docs/HANDOFF_BCCM_PARITY_2026-10-22.md:68"]
---

## ภาพรวม
การยกเลิก/ลบเอกสารต้องรักษาความสัมพันธ์ระหว่างเอกสารเดิม เอกสารยกเลิก GL กลับรายการ และสถานะ flow ไว้ครบ ช่วง 2026-10-19..24 พบบั๊กลบ/ยกเลิกแล้วมีเศษค้าง (GL กลับรายการ, แถวลูกสินค้าชุด, เอกสารยกเลิก) หรือยอดหัวบิลไม่ตรง C#

## อาการ
- **A (e7168c84):** ลบเอกสารยกเลิกแล้ว GL กลับรายการค้าง; ลบเอกสารที่ถูกใบอื่นอ้างอิงหรือมัดจำที่ใช้/คืนแล้วได้ (แถวอ้างอิงชี้ที่ไม่มี); เลขเอกสารยกเลิกไม่แยก flag
- **B (6983d7ea, bc8d27d4):** ยกเลิกรายบรรทัด (flag 7/39/37) ไม่ตรวจเพดานจำนวน และสถานะ PO (`doc_success`/`used_status`) ไม่ตามการยกเลิก; PR อนุมัติ (flag 4) ทับค่าที่ขอเดิม; หน้ายกเลิก/อนุมัติมี grid เตี้ยจน help bar ทับแถวเครดิต
- **C (bd834b16):** commit ไม่มีเนื้อความ แต่คอมเมนต์ใน `docs.go` ระบุอาการปัจจุบัน: ลบ ap_ar_trans 239/19 ต้นฉบับที่ถูกยกเลิกแล้ว จะทิ้งเอกสารยกเลิกและ GL กลับรายการไว้
- **D (86519142):** ยกเลิกรายชิ้น (37) เขียนเพียง `total_amount` ไม่ใช่ชุดยอดหัวบิลเต็มแบบ C#
- **E (678fc5fc, T3):** ลบแถวสินค้าชุดแล้วแถวลูกค้าง ยอดแถวลูกยังถูกรวม

## สาเหตุ (root cause)
- A: C# `_transProcess.cs:1009-1200` จัดเลข `DOC<flag>` และลบ GL กำพร้า แต่ Go ยังไม่พอร์ต และ delete ไม่เช็กการอ้างอิง 
- B: ยอดคงเหลือต่อบรรทัดและสถานะ PO ใน C# คำนวณใน `_docFlowThread` ซึ่ง Go ยังไม่มีตอนนั้น
- C: `SaveDoc`/`DeleteDoc` ของ ap_ar_trans ไม่มีด่านเช็กสถานะเอกสารที่เก็บไว้ (ตรงกับ `_myManageData1__checkEditData`)
- D: ไม่ได้ใช้ฟังก์ชันรวมยอดเดียวกับหน้าจอ/บันทึกปกติ
- E: แถวชุดกับแถวลูกผูกกันด้วย `ref_guid` / `set_ref_line` แต่ handler ลบแถวเดียว

## วิธีแก้
- A: `DOC%d` ต่อ flag, ลบ GL กำพร้าตอนลบเอกสารยกเลิก, `refuseIfReferenced` ใช้ `referencingDoc` ร่วม cancel/delete, `refuseUsedDepositDelete` สำหรับมัดจำ
- B: `parseCancelLines` / `checkCancelQty` ตรวจเพดานจาก `lineBalances`; `orderDerivedStatus` คำนวณ `used_status`/`doc_success`; PR flag 4 เก็บค่าที่ขอใน `temp_float_1/2` + `temp_string_1` แล้วรวมยอดหัวบิลใหม่
- C: `checkStoredApArEditable` ปฏิเสธเอกสารที่ used/finished/cancelled; undo-cancel ผ่าน `CancelDoc` ไม่โดนด่านนี้ + เทสต์ `TestApArCancelUndoIntegration`
- D: ให้ `companyHeaderTotals` คำนวณยอดตาม `_calc` ล่างของ C# (ข้ามแถวชุด) ทั้งหน้าจอและตอนบันทึก **ตัดสินใจ:** เอกสารเก่าคงยอดเดิม ไม่ย้อนแก้ (handoff:68)
- E: ลบแถวชุดพร้อมแถวที่ `set_ref_line` ตรงกับ `ref_guid`

## commit ที่เกี่ยวข้อง
- `e7168c84` — เลข DOC<flag>, ลบ GL กำพร้า, ลบต้องเช็กการอ้างอิง, ตรวจมัดจำ
- `6983d7ea` — ยกเลิกรายบรรทัด 7/39/37, อนุมัติ PR flag 4, สถานะ PO
- `bd834b16` — ด่าน ap_ar_trans + undo-cancel (ไม่มีเนื้อความ)
- `86519142` — ยอดยกเลิกรายชิ้น 37 ตาม `_calc`
- `bc8d27d4` — จอยกเลิก/AR issue #36-#48 (ไม่มีเนื้อความ; ยังไม่ได้ตรวจ diff ละเอียด)
- `678fc5fc` — ลบสินค้าชุดพร้อมแถวลูก

## โค้ดปัจจุบันที่ป้องกัน
- `process/doc_cancel.go:399` เลข `DOC%d`, `:497` refuseIfReferenced, `:547` referencingDoc, `:637` ลบ GL กำพร้า
- `process/trans_deposit.go:246` refuseUsedDepositDelete
- `process/docs.go:457` apArEditLocked, `:463` checkStoredApArEditable; เทสต์ `docs_test.go:47`
- `process/doc_cancel_item.go:74` checkCancelQty, `:135` checkItemCancel, `:205` companyHeaderTotals, `:223` orderDerivedStatus; `doc_approve_item.go:96`
- `frontend/account/transaction/UniversalTransScreen.tsx:3606-3608` ลบแถวชุดพร้อมลูก

## บทเรียน / กฎที่ได้
1. ลบ/ยกเลิกทุกชนิดต้องเช็ก "ใครอ้างถึงฉัน" ก่อน และลบตารางลูก/GL ที่เป็นของเอกสารนั้นให้หมดใน tx เดียว
2. ยอดหัวบิลต้องผ่าน `companyHeaderTotals` ตัวเดียวทุกเส้นทาง ห้ามเขียนยอดย่อยเอง
3. ด่าน "แก้ไม่ได้ถ้าใช้แล้ว/ปิดแล้ว/ยกเลิกแล้ว" ต้องอยู่ที่ save และ delete ด้วย ไม่ใช่เฉพาะปุ่มบนจอ
4. ลบแถวพ่วง (สินค้าชุด) ต้องลบทั้งกลุ่ม ไม่งั้นยอดรวมผิดเงียบๆ
5. รายการเปิด: จอยกเลิก 3/7/31/37/39 ยังไม่เทียบ C# ref flow (handoff บรรทัด 77)

## ดูเพิ่ม
[[proc-doc-cancel-approve]] · [[acc-transaction-delete-edit]] · [[std-menu-workflow-cancel-lookup]] · [[hist-lessons-doc-ref-docflow]] · [[hist-lessons-trans-save-rules]]

## ที่มาในโค้ด
- `backend/internal/application/process/doc_cancel.go:399,497,547,637`
- `docs/HANDOFF_BCCM_PARITY_2026-10-22.md:68,77`
- git:e7168c84, git:6983d7ea, git:86519142, git:678fc5fc
