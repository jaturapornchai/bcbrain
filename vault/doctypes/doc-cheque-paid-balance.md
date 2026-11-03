---
title: "เช็คจ่ายยกมา (Paid Cheque Beginning Balance)"
tags: [doctypes, cash-bank]
aliases: ["trans_flag 406", "เช็คจ่ายยกมา", "CPB", "menu_cb_chq_out_payment_balance"]
sources: ["frontend/account/tabs/transMenuMap.ts:2193", "frontend/account/transaction/transLayouts.ts:136", "frontend/account/transaction/ChequePickerModal.tsx:37", "backend/internal/application/process/cheque_forward.go:5", "backend/internal/application/process/cheque_forward.go:10", "backend/internal/application/process/cheque_forward.go:42", "backend/internal/application/process/trans.go:1192", "backend/internal/application/process/trans.go:1543", "backend/internal/application/process/cheque.go:16", "backend/internal/application/process/cheque.go:220", "backend/internal/application/process/service.go:1742", "backend/internal/application/process/doc_cancel.go:57", "backend/internal/application/process/trans_validate.go:45"]
---

# เช็คจ่ายยกมา (trans_flag 406)

## ใช้เมื่อไร
ใช้บันทึกเช็คจ่ายที่ยังไม่ผ่านธนาคารตอนเริ่มใช้ระบบ ผ่านเมนู "เช็คจ่ายยกมา" (CPB, transMenuMap.ts:2193) ค้นสมุดบัญชีจาก `erp_pass_book`

## trans_flag/ตาราง
- หัวเอกสารเก็บใน [[tbl-ic-trans]] และบรรทัดเก็บใน [[tbl-ic-trans-detail]] โดยเลขเช็คอยู่ที่ chq_number และ item_code คือสมุดบัญชีธนาคาร (cheque_forward.go:8)
- ตอนบันทึก `chequeForwardStmts` (cheque_forward.go:10 เรียกที่ trans.go:1192) ลบแถวเดิมของเอกสารแล้วลงทะเบียนเช็คทีละบรรทัดใน [[tbl-cb-trans-detail]] (trans_number_type 2 = เช็คจ่าย) จากนั้นสร้างแถว [[tbl-cb-chq-list]] (`chqListFromPaySQL` trans.go:1543)
- บรรทัดที่ไม่มีเลขเช็คไม่ถูกลงทะเบียน แต่บรรทัดที่ไม่มีสมุดบัญชียังลงทะเบียนได้ (cheque_forward.go:30)

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party แท็บ gl (transLayouts.ts:136)
- grid: สมุดบัญชี เลขเช็ค วันที่เช็คถึงกำหนด ธนาคาร สาขา (`chequeColumns` 406 ChequePickerModal.tsx:37)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ไม่ลง GL: 406 ไม่อยู่ใน `glRebuildTransFlags` (service.go:1742) และไม่อยู่ใน `glTemplateOnlyFlags` (gl_template.go:1096) แม้หน้าจอจะมีแท็บ gl

## เอกสารต้นทาง-ปลายทาง
- สถานะเช็คจาก 406 = 0 (`chequeStatusSQL` cheque.go:16)
- ปลายทาง: เช็คสถานะ 0 เลือกได้ในเช็คผ่าน 451, ขาดสิทธิ์ 452, เปลี่ยนเช็ค 456 (`chequeCandidateWhere` cheque.go:220) ดู [[doc-cheque-paid-lifecycle]]

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 407 (doc_cancel.go:57)
- บันทึกต้องอยู่ในงวดบัญชีที่เปิด (`checkOpenPeriod` trans_validate.go:45)

## ข้อควรระวัง
- ธนาคาร/สาขาของเช็คมาจากคอลัมน์ในบรรทัด ถ้าว่างใช้ bank_code / bank_branch ของสมุดบัญชีในบรรทัด (cheque_forward.go:42-43)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:2193` เมนู
- `frontend/account/transaction/transLayouts.ts:136` FLAG_SPEC 406
- `backend/internal/application/process/cheque_forward.go:10` chequeForwardStmts
- `backend/internal/application/process/doc_cancel.go:57` ยกเลิก 407

## ดูเพิ่ม
- [[doc-cheque-paid-lifecycle]] · [[doc-cheque-received-balance]] · [[doc-cheque-register]] · [[doctypes-overview]]
