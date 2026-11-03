---
title: "ยกเลิก แก้ไข ลบเอกสาร ต่างกันอย่างไร ผลต่อสต็อกและ GL"
tags: [faq, cancel, edit, delete, stock, gl]
aliases: ["ยกเลิกเอกสาร", "ลบเอกสาร", "แก้ไขเอกสาร", "cancel vs delete", "void document", "last_status = 1", "ยกเลิกใบขาย 45", "undo cancel คืนสถานะ"]
sources: ["backend/internal/application/process/trans.go:382", "backend/internal/application/process/trans.go:538", "backend/internal/application/process/doc_cancel.go:49", "backend/internal/application/process/doc_cancel.go:135", "backend/internal/application/process/doc_cancel.go:585", "frontend/account/transaction/UniversalTransScreen.tsx:2894"]
---
# ยกเลิก แก้ไข ลบเอกสาร ต่างกันอย่างไร ผลต่อสต็อกและ GL

**ตอบสั้น:** แก้ไข = ลบแถวเดิมแล้วเขียนใหม่ด้วยเลขที่เดิม, ลบ = ลบแถวทิ้งจริงแล้วคำนวณสต็อก/GL ใหม่ (ไม่เหลือร่องรอย), ยกเลิก = สร้างเอกสารยกเลิกอีกใบอ้างใบเดิม และตั้งใบเดิม `last_status = 1` (เก็บไว้ดูได้) ทั้งสามทางตรวจงวดบัญชีและการถูกอ้างอิงก่อนเสมอ

## รายละเอียด

| | แก้ไข | ลบ | ยกเลิก |
|---|---|---|---|
| แถวเดิม | ลบหัว/รายการเดิม แล้ว INSERT ใหม่ เลขที่เดิม | ลบทิ้งจริง (`ic_trans`, `ic_trans_detail`, `cb_trans*` ฯลฯ) | ไม่ลบ ตั้ง `last_status = 1` |
| เอกสารใหม่ | ไม่มี | ไม่มี | มี เช่น 45 ยกเลิก 44 โดย `doc_ref` ชี้ใบเดิม |
| สต็อก | คำนวณจากรายการใหม่ | คำนวณหลังลบ เหมือนไม่เคยมีใบนี้ | ใบเดิมหลุดจากชุดที่นับ (`last_status = 0`) สต็อกคืนเอง |
| GL | สร้างทับของเดิม | สร้างใหม่โดยไม่มีใบนี้ | ใบเดิมคง GL ไว้ ใบยกเลิกลง GL กลับด้าน (Dr/Cr สลับ ชื่อบัญชีนำหน้า `*`) ตามวันที่ยกเลิก |

- แก้ไขและลบทำในธุรกรรมเดียวแล้วเรียก `rebuildTransDerived` (สต็อก GL สถานะเช็ค) แก้ไขคือ DELETE แล้ว INSERT ใหม่ (`trans.go:538-541`)
- ลบบนหน้าจอคือปุ่ม "ลบ" บนแถบเครื่องมือ ยืนยันแล้วเรียก `/process/trans/delete` หรือ `/process/doc/delete` (`UniversalTransScreen.tsx:2894-2926`)
- ยกเลิกเป็นเมนูแยกของแต่ละประเภท เช่น `menu_so_invoice_cancel` (flag 45 ยกเลิก 44) ตามตาราง `cancelOrigFlags` (`doc_cancel.go:49`) ยกเลิกซ้ำจะตอบ "ถูกยกเลิกแล้ว" (`doc_cancel.go:160`)
- ยกเลิกรายบรรทัด (`CancelType = 2`) ได้แค่ยอดคงเหลือของรายการ (`checkItemCancel`) ส่วนยกเลิกทั้งใบต้องไม่มีใบถัดไปอ้างอิง (`refuseIfReferenced`)
- มี `Undo` คืนสถานะ: ลบเอกสารยกเลิกแล้วคำนวณสถานะใบเดิมใหม่ แต่ใบที่ถูกยกเลิกแบบเดิม (ตั้งสถานะตรง) คืนจากหน้านี้ไม่ได้ (`doc_cancel.go:185`)

เลือกอย่างไร: ใบที่ยังไม่มีใครอ้างอิงและอยู่ในงวดเปิด จะลบหรือแก้ก็ได้ ใบที่ออกให้ลูกค้าแล้ว (ใบกำกับภาษี) ควรยกเลิกเพื่อให้ตรวจย้อนหลังได้

## ข้อควรระวัง
- ใบที่ยกเลิกแล้วแก้/ลบไม่ได้อีก ขึ้น "ห้ามแก้ไข หรือลบข้อมูล" (`trans_validate.go:132-156`)
- การยกเลิกตรวจงวดสองจุด คืองวดของใบเดิมและงวดของวันที่ยกเลิก ต้องเปิดทั้งคู่ (`period.go:95-105`)
- หน้าจอรวมยังลบ `cb_trans` ไม่ได้ ขึ้น "ยังไม่รองรับการลบเอกสาร cb_trans" (`UniversalTransScreen.tsx:2897`)

## ดูเพิ่ม
- [[faq-cannot-delete-document]]
- [[flow-cancel-edit-reversal]]
- [[acc-transaction-delete-edit]]
- [[proc-doc-cancel-approve]]
- [[term-last-status-cancel-approve]]

## ที่มาในโค้ด
- `backend/internal/application/process/trans.go:382` `DeleteTrans` และ `:395` `deleteTransTx`
- `backend/internal/application/process/trans.go:538` แก้ไข = ลบรายการ/หัวเดิมแล้ว INSERT ใหม่
- `backend/internal/application/process/doc_cancel.go:49` `cancelOrigFlags`
- `backend/internal/application/process/doc_cancel.go:135` `cancelDocTx` สร้างเอกสารยกเลิกและ rebuild
- `backend/internal/application/process/doc_cancel.go:585` `reverseCancelledGL` GL กลับด้าน
- `backend/internal/application/process/stock_rebuild.go:18` `stockRowsSQL` นับเฉพาะ `last_status = 0`
- `frontend/account/transaction/UniversalTransScreen.tsx:2894` ปุ่มลบและเส้นทาง API
