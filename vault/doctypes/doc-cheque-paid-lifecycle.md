---
title: "เช็คจ่าย: ผ่าน/ขาดสิทธิ์/คืน/เปลี่ยน (Paid Cheque Lifecycle)"
tags: [doctypes, cash-bank]
aliases: ["trans_flag 451", "trans_flag 452", "trans_flag 453", "trans_flag 456", "เช็คจ่ายผ่าน", "เช็คจ่ายขาดสิทธิ์", "เช็คจ่ายคืน", "เปลี่ยนเช็คจ่าย", "CPP", "CHC", "CPR", "CPE"]
sources: ["frontend/account/tabs/transMenuMap.ts:2208", "frontend/account/tabs/transMenuMap.ts:2223", "frontend/account/tabs/transMenuMap.ts:2238", "frontend/account/tabs/transMenuMap.ts:2253", "frontend/account/transaction/transLayouts.ts:144", "frontend/account/transaction/transLayouts.ts:147", "backend/internal/application/process/service.go:2311", "backend/internal/application/process/cheque.go:16", "backend/internal/application/process/cheque.go:220", "backend/internal/application/process/doc_cancel.go:58"]
---

# วงจรเช็คจ่าย (451–456)

## ใช้เมื่อไร
| flag | เมนู | ที่มา |
|---|---|---|
| 451 | บันทึกเช็คผ่าน (เช็คจ่าย) CPP | transMenuMap.ts:2208 |
| 453 | บันทึกเช็คคืน (เช็คจ่าย) CPR | transMenuMap.ts:2223 |
| 452 | บันทึกเช็คขาดสิทธิ์ (เช็คจ่าย) CHC | transMenuMap.ts:2238 |
| 456 | บันทึกการเปลี่ยนเช็ค (เช็คจ่าย) CPE | transMenuMap.ts:2253 |

## trans_flag/ตาราง
- เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]] โดยเลขเช็คอยู่ที่ chq_number
- สถานะใน [[tbl-cb-chq-list]] ถูกคำนวณใหม่โดย `RebuildChequeStatus` (cheque.go:68)

## ฟิลด์/แท็บบนหน้าจอ
- 451/452/453: passBook แท็บ gl (transLayouts.ts:144-146)
- 456: party แท็บ pay, gl (transLayouts.ts:147)
- รายการเช็คที่เลือกได้ (`chequeCandidateWhere` cheque.go:220): 451/452 เลือกได้สถานะ 0,3; 453 เลือกได้สถานะ 2 (กรองตามสมุดบัญชีถ้าระบุ); 456 เลือกได้สถานะ 0,3 ของคู่ค้ารายเดียวกัน

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ใช้ standard GL (service.go:2311) โดยบัญชีเช็คจ่ายคือ 2112/2111
| flag | Dr | Cr |
|---|---|---|
| 451 | เช็คจ่าย | ธนาคาร |
| 452 / 453 | ธนาคาร | เจ้าหนี้ |
| 456 | เช็คจ่าย | เจ้าหนี้ |

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: เช็คจากแท็บชำระของใบจ่ายเงิน เช่น 19 และเช็คจ่ายยกมา 406
- สถานะตาม `chequeStatusSQL` (cheque.go:16): 406→0, 451→2, 452→4, 453→3, 456→7

## ยกเลิก/แก้ไข
- คู่ยกเลิก: 471←451, 472←452, 473←453, 476←456 (doc_cancel.go:58)

## ข้อควรระวัง
- ใน else-branch มีเงื่อนไข `transFlag == 453` ที่ไม่มีวันเข้า เพราะ 453 ถูกจับในเงื่อนไขแรก (452/453) ไปแล้ว (service.go:2320)
- 452/453 ลง Dr ธนาคาร / Cr เจ้าหนี้ ไม่มีบรรทัดบัญชีเช็คจ่าย (2112/2111)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:2208`–`:2253` เมนู
- `frontend/account/transaction/transLayouts.ts:144`–`:147` FLAG_SPEC
- `backend/internal/application/process/service.go:2311` GL
- `backend/internal/application/process/cheque.go:16` สถานะ / `:220` candidates
- `backend/internal/application/process/doc_cancel.go:58` ยกเลิก

## ดูเพิ่ม
- [[doc-cheque-paid-balance]] · [[doc-cheque-register]] · [[doc-ap-payment]] · [[acc-cheque-transfer]] · [[doctypes-overview]]
