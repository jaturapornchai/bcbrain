---
title: "บทเรียนยกเลิก ลบ และยกเลิกรายบรรทัด (Cancel, Delete & Partial Cancel)"
tags: [history, lesson, cancel, delete]
aliases: ["ยกเลิกเอกสาร", "partial cancel", "per-item cancel", "refuseIfReferenced", "set item delete", "undo cancel", "checkStoredApArEditable"]
sources: ["backend/internal/application/process/doc_cancel.go:164", "backend/internal/application/process/doc_cancel.go:399", "backend/internal/application/process/doc_cancel.go:497", "backend/internal/application/process/doc_cancel.go:585", "backend/internal/application/process/trans_deposit.go:246", "backend/internal/application/process/trans.go:403", "backend/internal/application/process/docs.go:457", "backend/internal/application/process/docs.go:463", "backend/internal/application/process/docs_test.go:47", "backend/internal/application/process/doc_cancel_item.go:74", "backend/internal/application/process/doc_cancel_item.go:135", "backend/internal/application/process/doc_cancel_item.go:205", "backend/internal/application/process/doc_cancel_item.go:223", "backend/internal/application/process/doc_approve_item.go:96", "frontend/account/transaction/UniversalTransScreen.tsx:3647"]
---
# บทเรียนยกเลิก ลบ และยกเลิกรายบรรทัด

การยกเลิกหรือลบเอกสารต้องรักษาความสัมพันธ์ระหว่างเอกสารเดิม เอกสารยกเลิก รายการ GL กลับรายการ และสถานะ flow ไว้ครบ ถ้าด่านไม่ครบจะเหลือเศษค้างหรือยอดเพี้ยนโดยไม่มีข้อความเตือน

## อะไรพังได้
- **ลบ/ยกเลิกเอกสารที่ถูกอ้างอิงอยู่:** เอกสารที่ใบอื่นอ้างถึง หรือมัดจำที่ถูกใช้แล้ว ถ้าลบได้ แถวที่อ้างจะชี้ไปหาเอกสารที่ไม่มีอยู่
- **GL กลับรายการค้าง:** ลบเอกสารยกเลิกแล้ว รายการ GL ที่กลับรายการไว้ยังอยู่ ถ้าไม่มีขั้นเก็บกวาด
- **เลขเอกสารยกเลิกชนกัน:** ถ้าทุกเมนูยกเลิกใช้ prefix เดียวกัน เลขรันจะถูกแจกซ้ำข้าม `trans_flag`
- **ยกเลิกรายบรรทัดเกินยอดคงเหลือ:** ถ้าไม่ตรวจเพดานจำนวน ผู้ใช้ยกเลิกได้มากกว่าที่เหลือ และสถานะ `used_status`/`doc_success` ของใบสั่งไม่ตามการยกเลิก
- **ยอดหัวบิลคนละสูตร:** ถ้าเอกสารยกเลิกรายชิ้นเขียนยอดย่อยเอง แทนที่จะใช้ชุดคำนวณเดียวกับหน้าจอ ยอดจะไม่ตรงกัน
- **แก้/ลบเอกสารลูกหนี้-เจ้าหนี้ที่ใช้แล้ว/ปิดแล้ว/ยกเลิกแล้ว:** ถ้าด่านอยู่แค่ปุ่มบนจอ เรียก API ตรงก็ลบได้ และทิ้งเอกสารยกเลิกกับ GL กลับรายการไว้
- **ลบแถวสินค้าชุดแล้วแถวลูกค้าง:** ยอดแถวลูกยังถูกรวมเข้าเอกสาร

## โค้ดป้องกันไว้อย่างไร
| ด่าน | ที่อยู่ | ทำอะไร |
|---|---|---|
| เลขเอกสารยกเลิกแยกตาม flag | `doc_cancel.go:399` | ใช้ prefix `DOC<flag>` แทน `DOC` กลาง |
| ห้ามยกเลิกเอกสารที่ถูกอ้างอิง | `doc_cancel.go:497` `refuseIfReferenced`, `:547` `referencingDoc`; เรียกที่ `:167` | ตรวจรวมทุกทางที่เอกสารอื่นอ้างถึง (บรรทัดอ้างอิง เช็ค ใบวางบิล มัดจำ) ก่อนสร้างเอกสารยกเลิก |
| ห้ามลบมัดจำที่ถูกใช้ | `trans_deposit.go:246` `refuseUsedDepositDelete`; เรียกที่ `trans.go:403` | ตรวจ `cb_trans_detail` และใบคืนที่อ้างมัดจำ |
| เก็บกวาด GL กลับรายการกำพร้า | `doc_cancel.go:585` `reverseCancelledGL` (ลบ `:625-637`) | เมื่อเอกสารยกเลิกหายไปแล้ว ลบรายการกลับรายการของมันออกจาก `gl_journal_detail`/`gl_journal` |
| ยกเลิกรายบรรทัดตรวจเพดาน | `doc_cancel_item.go:74` `checkCancelQty`, `:135` `checkItemCancel`; เรียกที่ `doc_cancel.go:164` | ปฏิเสธบรรทัดที่ไม่มีอยู่หรือจำนวนเกินที่เหลือ (คิดจากยอดคงเหลือปัจจุบัน) |
| สถานะใบสั่งตามการยกเลิก | `doc_cancel_item.go:223` `orderDerivedStatus` | คำนวณ `used_status`/`doc_success` จากจำนวนที่ใช้/ลด |
| ยอดหัวบิลสูตรเดียว | `doc_cancel_item.go:205`, `doc_approve_item.go:96`, `trans.go:792` เรียก `companyHeaderTotals` (`transcalc.go:79`) | ทุกเส้นทางคำนวณยอดหัวบิลจากฟังก์ชันเดียว |
| ด่านแก้/ลบเอกสารลูกหนี้-เจ้าหนี้ | `backend/internal/application/process/docs.go:457` `apArEditLocked`, `:463` `checkStoredApArEditable`; เรียกที่ `:195` | ปฏิเสธเมื่อ `used_status`, `doc_success` หรือ `last_status` เป็น 1 หรือชนิดเอกสารไม่ตรงกับที่บันทึกไว้ (undo-cancel ผ่าน `CancelDoc` ไม่โดนด่านนี้) |
| เทสต์ | `docs_test.go:47` `TestApArCancelUndoIntegration` (ต้องตั้ง `DOCFLOW_IT_DB`, rollback) | ตรวจว่าเอกสารที่ยกเลิกแล้วแก้/ลบไม่ได้ (รวมกรณีส่ง flag ผิด) และหลัง undo จึงลบได้ |
| ลบแถวสินค้าชุดทั้งกลุ่ม | `UniversalTransScreen.tsx:3647-3649` | ลบแถวชุดพร้อมแถวที่ `set_ref_line` ตรงกับ `ref_guid` ของแถวชุด |

## กฎที่ต้องจำ
1. ลบหรือยกเลิกทุกชนิดต้องเช็ก "ใครอ้างถึงฉัน" ก่อน และลบตารางลูก/GL ที่เป็นของเอกสารนั้นให้หมดใน tx เดียว
2. ยอดหัวบิลต้องผ่าน `companyHeaderTotals` ตัวเดียวทุกเส้นทาง ห้ามเขียนยอดย่อยเอง
3. ด่าน "แก้ไม่ได้ถ้าใช้แล้ว/ปิดแล้ว/ยกเลิกแล้ว" ต้องอยู่ที่ save และ delete ฝั่ง backend ไม่ใช่เฉพาะปุ่มบนจอ
4. ลบแถวพ่วง (สินค้าชุด) ต้องลบทั้งกลุ่ม

## ที่มาในโค้ด
- `backend/internal/application/process/doc_cancel.go:164-167,399,497,547,585-637` ด่านยกเลิกและเก็บกวาด GL
- `backend/internal/application/process/doc_cancel_item.go:74,135,205,223` ยกเลิกรายบรรทัด
- `backend/internal/application/process/docs.go:457-480` ด่านเอกสารลูกหนี้-เจ้าหนี้
- `frontend/account/transaction/UniversalTransScreen.tsx:3647-3649` ลบแถวสินค้าชุด
- ดูเพิ่ม: [[proc-doc-cancel-approve]] · [[acc-transaction-delete-edit]] · [[std-menu-workflow-cancel-lookup]] · [[hist-lessons-doc-ref-docflow]] · [[hist-lessons-trans-save-rules]]
