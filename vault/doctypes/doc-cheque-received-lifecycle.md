---
title: "เช็ครับ: นำฝาก/ผ่าน/คืน/ขาดสิทธิ์/เปลี่ยน/คืนเช็คตั้งหนี้ใหม่ (Received Cheque Lifecycle)"
tags: [doctypes, cash-bank]
aliases: ["trans_flag 410", "trans_flag 411", "trans_flag 412", "trans_flag 413", "trans_flag 414", "trans_flag 416", "trans_flag 418", "นำฝากเช็ค", "เช็คผ่าน", "เช็คคืน", "เช็คขาดสิทธิ์", "เปลี่ยนเช็ค", "คืนเช็ค/ตั้งหนี้ใหม่", "CHD", "CHP", "CRT", "CRC", "CDE", "CND"]
sources: ["frontend/account/tabs/transMenuMap.ts:2019", "frontend/account/tabs/transMenuMap.ts:2094", "frontend/account/tabs/transMenuMap.ts:2109", "frontend/account/transaction/transLayouts.ts:137", "frontend/account/transaction/transLayouts.ts:142", "backend/internal/application/process/service.go:2243", "backend/internal/application/process/gl_template.go:1096", "backend/internal/application/process/cheque.go:16", "backend/internal/application/process/cheque.go:220", "backend/internal/application/process/docs.go:600", "backend/internal/application/process/doc_cancel.go:57"]
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
| 414 | ไม่มีเมนูและไม่มี FLAG_SPEC มีเฉพาะใน backend | service.go:2243 |

## trans_flag/ตาราง
- เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]] โดยเลขเช็คอยู่ที่ chq_number (418 ใช้ item_code และ 416 เก็บเช็คเก่าใน chq_number)
- สถานะเช็คใน [[tbl-cb-chq-list]] ถูกคำนวณใหม่โดย `RebuildChequeStatus` (cheque.go:68) จากแถวล่าสุดที่ยังไม่ยกเลิก

## ฟิลด์/แท็บบนหน้าจอ
- 410/411/412: passBook แท็บ gl (transLayouts.ts:137-139)
- 413: ไม่มีช่องพิเศษ แท็บ gl (transLayouts.ts:140)
- 416: party, sale แท็บ pay, gl เพื่อรับเงินหรือเช็คใหม่ (transLayouts.ts:141)
- 418: party แท็บ gl (transLayouts.ts:142)
- รายการเช็คที่เลือกได้ (`chequeCandidateWhere` cheque.go:220): 410/413 เลือกได้สถานะ 0,3; 411 เลือกได้สถานะ 1; 412 เลือกได้สถานะ 1,2; 416/418 เลือกได้สถานะ 0,3 ของลูกค้ารายเดียวกัน

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ใช้ standard GL (service.go:2243) โดยบัญชีเช็ครับคือ 1122-00/1122/1121 และบัญชีเช็คระหว่างเรียกเก็บคือ 1122-01/1122
| flag | Dr | Cr |
|---|---|---|
| 410 | ธนาคาร หรือเช็คระหว่างเรียกเก็บ (ถ้ามี 411 ที่ยังไม่ยกเลิกของเช็คเดียวกัน) | เช็ครับ |
| 411 | ธนาคาร | เช็ครับ หรือเช็คระหว่างเรียกเก็บ (ถ้ามี 410) และ UPDATE GL ของ 410 ให้ Dr เป็นเช็คระหว่างเรียกเก็บ |
| 412 | เช็ครับ | ธนาคาร |
| 413 / 414 / 418 | ลูกหนี้ | เช็ครับ |
| 416 (default) | ธนาคาร | เช็ครับ |

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: เช็คจากแท็บชำระของใบรับเงิน เช่น 239 หรือ 44 และเช็ครับยกมา 405
- สถานะตาม `chequeStatusSQL` (cheque.go:16): 405→0, 410→1, 411→2, 412→3, 413→4, 414→6, 416→7, 418→8
- 418 นับเป็นหนี้ลูกหนี้ (`arDebtWhere` docs.go:600) แล้วไปต่อที่ใบวางบิล 235 และรับชำระ 239

## ยกเลิก/แก้ไข
- คู่ยกเลิก: 430←410, 431←411, 432←412, 433←413, 434←414, 436←416 (doc_cancel.go:57) และเมนูยกเลิกนำฝาก 430 อยู่ที่ transMenuMap.ts:2109
- 418 ไม่มีคู่ยกเลิก

## ข้อควรระวัง
- ตอน rebuild GL ระบบจะ INSERT ผังบัญชี 1122-01 "เช็ครับระหว่างเรียกเก็บ" ถ้ายังไม่มี (service.go:2244)
- 418 อยู่ทั้งใน `glTemplateOnlyFlags` ซึ่ง comment บอกว่า "no standard Go posting" (gl_template.go:1094) และอยู่ใน standard case 413/414/418 พร้อม `glRebuildTransFlags` ทำให้ความหมายของสองที่นี้ขัดกัน
- 414 มีใน GL, สถานะ และคู่ยกเลิก 434 แต่ไม่มีเมนู

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:2019`–`:2094` เมนู
- `frontend/account/transaction/transLayouts.ts:137`–`:142` FLAG_SPEC
- `backend/internal/application/process/service.go:2243` GL
- `backend/internal/application/process/cheque.go:16` สถานะ / `:220` candidates
- `backend/internal/application/process/doc_cancel.go:57` ยกเลิก

## ดูเพิ่ม
- [[doc-cheque-received-balance]] · [[doc-cheque-register]] · [[doc-ar-receipt]] · [[acc-cheque-transfer]] · [[acc-gl-template-engine]] · [[doctypes-overview]]
