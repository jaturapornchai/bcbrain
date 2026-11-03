---
title: "เช็คจ่ายยกมา (Paid Cheque Beginning Balance)"
tags: [doctypes, cash-bank]
aliases: ["trans_flag 406", "เช็คจ่ายยกมา", "CPB", "menu_cb_chq_out_payment_balance"]
sources: ["frontend/account/tabs/transMenuMap.ts:2193", "frontend/account/transaction/transLayouts.ts:136", "backend/internal/application/process/cheque_forward.go:5", "backend/internal/application/process/cheque_forward.go:10", "backend/internal/application/process/trans.go:1543", "backend/internal/application/process/service.go:1731", "backend/internal/application/process/doc_cancel.go:57"]
---

# เช็คจ่ายยกมา (trans_flag 406)

## ใช้เมื่อไร
ใช้บันทึกเช็คจ่ายที่ยังไม่ผ่านธนาคารตอนเริ่มใช้ระบบ ผ่านเมนู "เช็คจ่ายยกมา" (CPB, transMenuMap.ts:2193)

## trans_flag/ตาราง
- หัวเอกสารเก็บใน [[tbl-ic-trans]] และบรรทัดเก็บใน [[tbl-ic-trans-detail]] โดยเลขเช็คอยู่ที่ chq_number และ item_code คือสมุดบัญชีธนาคาร (cheque_forward.go:8)
- `chequeForwardStmts` (cheque_forward.go:10) ลงทะเบียนเช็คใน [[tbl-cb-trans-detail]] แล้วสร้างแถว [[tbl-cb-chq-list]] (`chqListFromPaySQL` trans.go:1543)

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party แท็บ gl (transLayouts.ts:136)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
(ไม่พบในโค้ด) 406 ไม่อยู่ใน `glRebuildTransFlags` (service.go:1731) และไม่อยู่ใน `glTemplateOnlyFlags` แม้หน้าจอจะมีแท็บ gl

## เอกสารต้นทาง-ปลายทาง
- สถานะเช็คจาก 406 = 0 (cheque.go:16)
- ปลายทาง: เช็คผ่าน 451, ขาดสิทธิ์ 452, เปลี่ยนเช็ค 456 ดู [[doc-cheque-paid-lifecycle]]

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 407 (doc_cancel.go:57)

## ข้อควรระวัง
- ธนาคารและสาขาของเช็คยังว่างเหมือนกับ 405 (cheque_forward.go:9)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:2193` เมนู
- `frontend/account/transaction/transLayouts.ts:136` FLAG_SPEC 406
- `backend/internal/application/process/cheque_forward.go:10` chequeForwardStmts
- `backend/internal/application/process/doc_cancel.go:57` ยกเลิก 407

## ดูเพิ่ม
- [[doc-cheque-paid-lifecycle]] · [[doc-cheque-received-balance]] · [[doc-cheque-register]] · [[doctypes-overview]]
