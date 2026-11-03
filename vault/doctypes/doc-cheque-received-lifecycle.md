---
title: "เช็ครับ: นำฝาก/ผ่าน/คืน/ขาดสิทธิ์/เปลี่ยน/คืนเช็คตั้งหนี้ใหม่ (Received Cheque Lifecycle)"
tags: [doctypes, cash-bank]
aliases: ["trans_flag 410", "trans_flag 411", "trans_flag 412", "trans_flag 413", "trans_flag 414", "trans_flag 416", "trans_flag 418", "นำฝากเช็ค", "เช็คผ่าน", "เช็คคืน", "เช็คขาดสิทธิ์", "เปลี่ยนเช็ค", "คืนเช็ค/ตั้งหนี้ใหม่", "CHD", "CHP", "CRT", "CRC", "CDE", "CND"]
sources: ["frontend/account/tabs/transMenuMap.ts:2019", "frontend/account/tabs/transMenuMap.ts:2094", "frontend/account/tabs/transMenuMap.ts:2109", "frontend/account/transaction/transLayouts.ts:137", "frontend/account/transaction/transLayouts.ts:142", "frontend/account/transaction/ChequePickerModal.tsx:32", "backend/internal/application/process/service.go:1752", "backend/internal/application/process/service.go:1663", "backend/internal/application/process/service.go:2254", "backend/internal/application/process/service.go:2260", "backend/internal/application/process/gl_template.go:1096", "backend/internal/application/process/cheque.go:16", "backend/internal/application/process/cheque.go:68", "backend/internal/application/process/cheque.go:220", "backend/internal/application/process/trans.go:622", "backend/internal/application/process/docs.go:600", "backend/internal/application/process/doc_cancel.go:57", "backend/internal/application/process/doc_cancel.go:120", "backend/internal/application/process/doc_cancel.go:585"]
---

# วงจรเช็ครับ (410–418)

## ใช้เมื่อไร
| flag | เมนู | ที่มา |
|---|---|---|
| 410 | บันทึกนำฝาก (เช็ครับ) CHD | transMenuMap.ts:2019 |
| 411 | บันทึกเช็คผ่าน (เช็ครับ) CHP | transMenuMap.ts:2034 |
| 412 | บันทึกเช็คคืน (เช็ครับ) CRT | transMenuMap.ts:2049 |
| 413 | บันทึกเช็คขาดสิทธิ์ (เช็ครับ) CRC | transMenuMap.ts:2064 |
| 416 | บันทึกการเปลี่ยนเช็ค (เช็ครับ) CDE | transMenuMap.ts:2079 |
| 418 | บันทึกคืนเช็ค/ตั้งหนี้ใหม่ CND | transMenuMap.ts:2094 |
| 414 | ไม่มีเมนูและไม่มี FLAG_SPEC มีเฉพาะใน backend | service.go:2254 |

## trans_flag/ตาราง
- เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]] โดยเลขเช็คอยู่ที่ chq_number และ item_code คือสมุดบัญชีธนาคาร (410–413) ส่วน 416/418 เลขเช็คอยู่ที่ item_code (`chequeColumns` ChequePickerModal.tsx:32)
- หลังบันทึก ระบบคำนวณสถานะเช็คใน [[tbl-cb-chq-list]] ใหม่ด้วย `RebuildChequeStatus` (cheque.go:68 เรียกที่ trans.go:622) จากแถวล่าสุดที่ last_status = 0

## ฟิลด์/แท็บบนหน้าจอ
- 410/411/412: passBook แท็บ gl (transLayouts.ts:137-139)
- 413: ไม่มีช่องพิเศษ แท็บ gl (transLayouts.ts:140)
- 416: party, sale แท็บ pay, gl (transLayouts.ts:141)
- 418: party แท็บ gl (transLayouts.ts:142)
- เช็คที่เลือกได้ (`chequeCandidateWhere` cheque.go:220): 410/413 สถานะ 0,3; 411 สถานะ 1 (ถ้าระบุสมุด ต้องตรงกับสมุดของ 410 ล่าสุด); 412 สถานะ 1,2 (ถ้าระบุสมุด ต้องตรงกับสมุดของ 411 ล่าสุด); 416/418 สถานะ 0,3 ของลูกค้ารายเดียวกัน

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ใช้ standard GL เมื่อรูปแบบเอกสารไม่มี template GL (`tpl.post` service.go:1585, case service.go:2254) บัญชีเช็ครับ = 1122-00/1122/1121 และเช็ครับระหว่างเรียกเก็บ = 1122-01/1122 (service.go:2260-2261)

| flag | Dr | Cr |
|---|---|---|
| 410 | ธนาคาร หรือเช็ครับระหว่างเรียกเก็บ (ถ้ามี 411 ที่ยังไม่ยกเลิกของเช็คเดียวกัน) | เช็ครับ |
| 411 | ธนาคาร | เช็ครับ หรือเช็ครับระหว่างเรียกเก็บ (ถ้ามี 410 ที่ยังไม่ยกเลิก) และ UPDATE บรรทัดเดบิตของ GL 410 ใบล่าสุดเป็นเช็ครับระหว่างเรียกเก็บ (service.go:2296) |
| 412 | เช็ครับ | ธนาคาร |
| 413 / 414 / 418 | ลูกหนี้ 1121/1131/1130/1120 | เช็ครับ |
| 416 | ธนาคาร | เช็ครับ |

- ธนาคาร = account_code_1 ของสมุดบัญชีตัวแรกในบรรทัด (หรือ pass_book_code ใน cb_trans_detail / ic_trans) ถ้าไม่มีใช้ 1112/1113/1111 (service.go:1797, :1806-1820)
- 418 อยู่ใน `glRebuildTransFlags` (service.go:1752) จึงลงตาม case ข้างบนเมื่อไม่มี template และอยู่ใน `glTemplateOnlyFlags` (gl_template.go:1096) ซึ่งตอน rebuild GL จะลงใหม่ตาม template เฉพาะเมื่อรูปแบบเอกสารมี template (`postTemplateOnly` service.go:1663)

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: เช็คจากแท็บชำระของเอกสารรับเงิน และเช็ครับยกมา 405 ดู [[doc-cheque-received-balance]]
- สถานะตาม `chequeStatusSQL` (cheque.go:16): 405→0, 410→1, 411→2, 412→3, 413→4, 414→6, 416→7, 418→8 ไม่มีแถว = 0 (เช็คในมือ)
- 418 นับเป็นหนี้ลูกหนี้ (`arDebtWhere` docs.go:600) แล้วไปต่อที่ใบวางบิล 235 และรับชำระ 239

## ยกเลิก/แก้ไข
- คู่ยกเลิก: 430←410, 431←411, 432←412, 433←413, 434←414, 436←416 (doc_cancel.go:57) เมนูยกเลิกอยู่ที่ transMenuMap.ts:2109-2165
- เอกสารยกเลิกได้ GL กลับด้านของต้นฉบับ ณ วันที่เอกสารยกเลิก ส่วนต้นฉบับยังเก็บ GL เดิม (`reverseCancelledGL` doc_cancel.go:585) แล้วสถานะเช็คถูกคำนวณใหม่ (`CancelDoc` doc_cancel.go:120)
- 418 ไม่มีคู่ยกเลิก
- บันทึกต้องอยู่ในงวดบัญชีที่เปิด (`checkOpenPeriod` trans_validate.go:45)

## ข้อควรระวัง
- ตอนลง GL ของ 410–418 ระบบ INSERT ผังบัญชี 1122-01 "เช็ครับระหว่างเรียกเก็บ" ถ้ายังไม่มี (service.go:2255)
- 414 มีใน GL, สถานะ และคู่ยกเลิก 434 แต่ไม่มีเมนู

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:2019`–`:2094` เมนู
- `frontend/account/transaction/transLayouts.ts:137`–`:142` FLAG_SPEC
- `backend/internal/application/process/service.go:2254` GL
- `backend/internal/application/process/cheque.go:16` สถานะ / `:220` เช็คที่เลือกได้
- `backend/internal/application/process/doc_cancel.go:57` ยกเลิก

## ดูเพิ่ม
- [[doc-cheque-received-balance]] · [[doc-cheque-register]] · [[doc-ar-receipt]] · [[acc-cheque-transfer]] · [[acc-gl-template-engine]] · [[doctypes-overview]]
