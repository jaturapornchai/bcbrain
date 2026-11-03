---
title: "ดึงเอกสารอ้างอิง (ปุ่มดึงเอกสาร) ทำไมเอกสารต้นทางไม่ขึ้น"
tags: [faq, doc-ref, import, po, so, lookup]
aliases: ["ดึงเอกสารไม่ขึ้น", "ดึงใบสั่งซื้อไม่ได้", "ดึงใบสั่งขายไม่ขึ้น", "ref import", "doc_ref_type", "refImportSources", "ref_doc_no", "ดึงเอกสารอ้างอิงไม่เจอ", "doc_success ปิดรายการ"]
sources: ["backend/internal/application/process/lookup_trans.go:92", "backend/internal/application/process/lookup_trans.go:140", "backend/internal/application/process/trans_ref_import_lines.go:52", "backend/internal/application/process/trans_ref_import_lines.go:279", "backend/internal/application/process/trans_ref_import.go:21", "frontend/account/transaction/UniversalTransScreen.tsx:2242", "frontend/account/transaction/TransTopForm.tsx:411"]
---
# ดึงเอกสารอ้างอิง (ปุ่มดึงเอกสาร) ทำไมเอกสารต้นทางไม่ขึ้น

**ตอบสั้น:** รายการที่ขึ้นในหน้าต่างดึงเอกสารถูกกรองหลายชั้น เอกสารต้องเป็นชนิดที่หน้าจอนี้ดึงได้, ยังไม่ยกเลิก (`last_status = 0`), ยังไม่ปิดรายการ (`doc_success = 0` สำหรับหลายหน้าจอ), ลูกค้า/เจ้าหนี้และประเภทภาษีตรงกับหัวเอกสาร, ผ่านการอนุมัติตามออปชัน และอยู่สาขาเดียวกัน (ถ้าเปิดออปชันสาขา)

## รายละเอียด
ปุ่ม "ดึงเอกสาร" มีเฉพาะหน้าจอที่ตั้ง `hasRefDoc` (`TransTopForm.tsx:411-421`, `UniversalTransScreen.tsx:3237-3239`) คำสั่งค้นอยู่ที่ `loadRefDocs` ค้น `ic_trans` ตาม `refTransFlags` ของเมนู, `last_status = 0` และเงื่อนไขจากหลังบ้าน (`RefDocLookupFilter`) แสดงสูงสุด 100 ใบ เรียงวันที่ใหม่สุดก่อน (`UniversalTransScreen.tsx:2242-2276`)

เหตุผลที่เอกสารไม่ขึ้น (`refDocWhere`, `lookup_trans.go:140-175`):
1. **ยังไม่เลือกลูกค้า/เจ้าหนี้:** กลุ่ม 12, 14, 16, 34, 36, 44, 46, 48, 144, 310, 311, 315-317 ฯลฯ กรอง `cust_code` ตามหัวเอกสาร ถ้ายังไม่เลือกคู่ค้าจะไม่ขึ้นเลย (`lookup_trans.go:51-55`)
2. **ประเภทภาษีไม่ตรง:** บางหน้าจอกรอง `vat_type` = ของหัวเอกสาร (`lookup_trans.go:58-60`)
3. **ปิดรายการแล้ว:** 6, 12, 44, 56, 72, 144, 310, 315 ต้อง `doc_success = 0` คือใบต้นทางยังเหลือให้ดึง
4. **ยังไม่อนุมัติ:** ดึงเข้า 44/144 จะเห็นใบสั่งจอง (34) หรือใบสั่งขาย (36) เฉพาะที่ `approve_status = 1` เมื่อเปิด `doc_ref_reservation_approve` / `doc_ref_salesorder_approve`; ดึงเข้า 12/310 เห็นใบสั่งซื้อ (6) ที่อนุมัติแล้วเมื่อเปิด `ref_po_approve`; ดึงเข้า 6 ไม่เห็นใบขอซื้อ (4) ที่ `not_approve_1` ไม่เป็น 0
5. **คนละสาขา:** เมื่อบริษัทใช้สาขา + เปิด `show_branch_doc_only` + ผู้ใช้เปลี่ยนสาขาไม่ได้ จะเห็นเฉพาะใบของสาขาตัวเอง (`docBranch`, `lookup_trans.go:176`)
6. **ชนิดเอกสารไม่อยู่ในโซ่:** ดึงได้เฉพาะตาม `refImportSources` เช่น 6<-{4,2}, 12<-6, 310<-6, 315<-310, 16<-12, 44<-{30,34,36}, 48<-44 (`trans_ref_import_lines.go:52-55`) ชนิดอื่นขึ้น "เอกสารประเภท X อ้างอิงเอกสารประเภท Y ไม่ได้" (`:301`)
7. **ยกเลิกแล้ว:** ใบ `last_status = 1` ไม่ขึ้นเสมอ

หลังเลือกเอกสาร ระบบเลือกได้ครั้งละ 1-50 ใบ (`refImportMaxDocs`, `:46` และ `:288`) และเติมรายการด้วยยอดคงเหลือ ไม่ใช่ยอดเต็ม เช่น ใบสั่งซื้อ -> ซื้อ หักที่รับ/ซื้อไปแล้ว (`refImportSpecs` {12,6}, `trans_ref_import.go:34`) รายการที่คงเหลือ 0 จะไม่ถูกดึง

## ข้อควรระวัง
- ออปชัน `check_qty_over_doc_ref` ตรวจจำนวนเกินใบอ้างอิงตอนบันทึก (`trans_qty_over_ref.go:13`); `receive_more_po` ยอมให้รับ/ซื้อเกินใบสั่งซื้อ และ `allow_sale_over_reserve` ยอมให้ขายเกินใบสั่งจอง (`trans_validate.go:79-82`)
- ระบบคำนวณ `used_status` / `doc_success` ของใบต้นทางใหม่จากใบที่อ้างถึงมันเสมอ (`doc_flow.go:15-17`) ต้นทางที่ถูกใช้แล้วจึงแก้/ลบไม่ได้จนกว่าจะลบหรือยกเลิกใบปลายทาง ดู [[faq-cannot-delete-document]]
- มัดจำ/เงินล่วงหน้า (10, 11, 40, 110) ไม่ดึงรายการสินค้า ใช้ `doc_ref` ของหัวเอกสารเท่านั้น (คอมเมนต์ `trans_ref_import_lines.go:48-51`)

## ดูเพิ่ม
- [[term-doc-ref]]
- [[hist-lessons-doc-ref-docflow]]
- [[flow-procure-to-pay]]
- [[flow-order-to-cash]]
- [[faq-cannot-delete-document]]
- [[term-erp-option]]

## ที่มาในโค้ด
- `backend/internal/application/process/lookup_trans.go:92` `RefDocLookupFilter` และ `:140` `refDocWhere`
- `backend/internal/application/process/lookup_trans.go:106` `refSourceWhere` (จำกัดตามโซ่ที่ดึงได้)
- `backend/internal/application/process/trans_ref_import_lines.go:52` `refImportSources` และ `:279` `checkRefImport`
- `backend/internal/application/process/trans_ref_import.go:21` `refImportSpecs` (ยอดคงเหลือ)
- `backend/internal/application/process/trans_validate.go:79` ออปชันข้ามการตรวจรายการอ้างอิง
- `backend/internal/application/process/doc_flow.go:15` คำนวณสถานะ used/success ของต้นทางใหม่
- `frontend/account/transaction/UniversalTransScreen.tsx:2242` `loadRefDocs`
- `frontend/account/transaction/TransTopForm.tsx:411-421` ปุ่ม "ดึงเอกสาร"
