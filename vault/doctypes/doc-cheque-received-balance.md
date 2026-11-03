---
title: "เช็ครับยกมา (Received Cheque Beginning Balance)"
tags: [doctypes, cash-bank]
aliases: ["trans_flag 405", "เช็ครับยกมา", "CHB", "menu_cb_chq_in_receive_balance", "chequeForwardStmts"]
sources: ["frontend/account/tabs/transMenuMap.ts:2004", "frontend/account/transaction/transLayouts.ts:135", "backend/internal/application/process/cheque_forward.go:5", "backend/internal/application/process/cheque_forward.go:10", "backend/internal/application/process/trans.go:1543", "backend/internal/application/process/cheque.go:16", "backend/internal/application/process/service.go:1731"]
---

# เช็ครับยกมา (trans_flag 405)

## ใช้เมื่อไร
ใช้บันทึกเช็ครับที่ยังอยู่ในมือตอนเริ่มใช้ระบบ ผ่านเมนู "เช็ครับยกมา" (CHB, transMenuMap.ts:2004)

## trans_flag/ตาราง
- หัวเอกสารเก็บใน [[tbl-ic-trans]] และบรรทัดเก็บใน [[tbl-ic-trans-detail]] โดยเลขเช็คอยู่ที่ item_code
- `chequeForwardStmts` (cheque_forward.go:10) ลงทะเบียนเช็คใน [[tbl-cb-trans-detail]] แล้วสร้างแถว [[tbl-cb-chq-list]] แบบเดียวกับแท็บชำระ (`chqListFromPaySQL` trans.go:1543)

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, sale แท็บ gl (transLayouts.ts:135)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
(ไม่พบในโค้ด) 405 ไม่อยู่ใน `glRebuildTransFlags` (service.go:1731) และไม่อยู่ใน `glTemplateOnlyFlags` (gl_template.go:1096) แม้หน้าจอจะมีแท็บ gl

## เอกสารต้นทาง-ปลายทาง
- สถานะเช็คจาก 405 = 0 คือเช็คในมือ (`chequeStatusSQL` comment cheque.go:16)
- ปลายทาง: นำฝาก 410, ขาดสิทธิ์ 413, เปลี่ยนเช็ค 416, คืนเช็ค/ตั้งหนี้ใหม่ 418 ดู [[doc-cheque-received-lifecycle]]

## ยกเลิก/แก้ไข
- ไม่มีคู่ยกเลิกใน `cancelOrigFlags` (doc_cancel.go:49)

## ข้อควรระวัง
- ธนาคารและสาขาของเช็คยังว่าง เพราะ grid บนเว็บยังไม่มีคอลัมน์นี้ (comment `ponytail:` cheque_forward.go:9)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:2004` เมนู
- `frontend/account/transaction/transLayouts.ts:135` FLAG_SPEC 405
- `backend/internal/application/process/cheque_forward.go:5` คำอธิบาย
- `backend/internal/application/process/trans.go:1543` chqListFromPaySQL

## ดูเพิ่ม
- [[doc-cheque-received-lifecycle]] · [[doc-cheque-register]] · [[doc-cheque-paid-balance]] · [[acc-cheque-transfer]] · [[doctypes-overview]]
