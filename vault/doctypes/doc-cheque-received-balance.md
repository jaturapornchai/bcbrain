---
title: "เช็ครับยกมา (Received Cheque Beginning Balance)"
tags: [doctypes, cash-bank]
aliases: ["trans_flag 405", "เช็ครับยกมา", "CHB", "menu_cb_chq_in_receive_balance", "chequeForwardStmts"]
sources: ["frontend/account/tabs/transMenuMap.ts:2004", "frontend/account/transaction/transLayouts.ts:135", "frontend/account/transaction/ChequePickerModal.tsx:35", "backend/internal/application/process/cheque_forward.go:5", "backend/internal/application/process/cheque_forward.go:10", "backend/internal/application/process/cheque_forward.go:42", "backend/internal/application/process/trans.go:1192", "backend/internal/application/process/trans.go:1543", "backend/internal/application/process/cheque.go:16", "backend/internal/application/process/cheque.go:220", "backend/internal/application/process/service.go:1742", "backend/internal/application/process/gl_template.go:1096", "backend/internal/application/process/trans_validate.go:45"]
---

# เช็ครับยกมา (trans_flag 405)

## ใช้เมื่อไร
ใช้บันทึกเช็ครับที่ยังอยู่ในมือตอนเริ่มใช้ระบบ ผ่านเมนู "เช็ครับยกมา" (CHB, transMenuMap.ts:2004)

## trans_flag/ตาราง
- หัวเอกสารเก็บใน [[tbl-ic-trans]] และบรรทัดเก็บใน [[tbl-ic-trans-detail]] โดยเลขเช็คอยู่ที่ item_code (cheque_forward.go:8)
- ตอนบันทึก `chequeForwardStmts` (cheque_forward.go:10 เรียกที่ trans.go:1192) ลบแถวเดิมของเอกสารแล้วลงทะเบียนเช็คทีละบรรทัดใน [[tbl-cb-trans-detail]] (trans_number_type 1 = เช็ครับ) จากนั้นสร้างแถว [[tbl-cb-chq-list]] แบบเดียวกับแท็บชำระ (`chqListFromPaySQL` trans.go:1543)
- บรรทัดที่ไม่มีเลขเช็คไม่ถูกลงทะเบียน (cheque_forward.go:30)

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, sale แท็บ gl (transLayouts.ts:135)
- grid: เลขเช็ค วันที่เช็คถึงกำหนด ธนาคาร สาขา (`chequeColumns` 405 ChequePickerModal.tsx:35)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ไม่ลง GL: 405 ไม่อยู่ใน `glRebuildTransFlags` (service.go:1742) และไม่อยู่ใน `glTemplateOnlyFlags` (gl_template.go:1096) แม้หน้าจอจะมีแท็บ gl

## เอกสารต้นทาง-ปลายทาง
- สถานะเช็คจาก 405 = 0 คือเช็คในมือ (`chequeStatusSQL` cheque.go:16)
- ปลายทาง: เช็คสถานะ 0 เลือกได้ในนำฝาก 410, ขาดสิทธิ์ 413, เปลี่ยนเช็ค 416, คืนเช็ค/ตั้งหนี้ใหม่ 418 (`chequeCandidateWhere` cheque.go:220) ดู [[doc-cheque-received-lifecycle]]

## ยกเลิก/แก้ไข
- ไม่มีคู่ยกเลิกใน `cancelOrigFlags` (doc_cancel.go:49)
- บันทึกต้องอยู่ในงวดบัญชีที่เปิด (`checkOpenPeriod` trans_validate.go:45)

## ข้อควรระวัง
- ธนาคาร/สาขาของเช็คมาจากคอลัมน์ในบรรทัด ถ้าว่างจะเป็นค่าว่าง เพราะ 405 ไม่มีสมุดบัญชีให้ดึงค่าแทน (cheque_forward.go:42-43)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:2004` เมนู
- `frontend/account/transaction/transLayouts.ts:135` FLAG_SPEC 405
- `backend/internal/application/process/cheque_forward.go:10` chequeForwardStmts
- `backend/internal/application/process/trans.go:1543` chqListFromPaySQL

## ดูเพิ่ม
- [[doc-cheque-received-lifecycle]] · [[doc-cheque-register]] · [[doc-cheque-paid-balance]] · [[acc-cheque-transfer]] · [[doctypes-overview]]
