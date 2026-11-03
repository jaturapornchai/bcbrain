---
title: "เช็คจ่าย: ผ่าน/ขาดสิทธิ์/คืน/เปลี่ยน (Paid Cheque Lifecycle)"
tags: [doctypes, cash-bank]
aliases: ["trans_flag 451", "trans_flag 452", "trans_flag 453", "trans_flag 456", "เช็คจ่ายผ่าน", "เช็คจ่ายขาดสิทธิ์", "เช็คจ่ายคืน", "เปลี่ยนเช็คจ่าย", "CPP", "CHC", "CPR", "CPE"]
sources: ["frontend/account/tabs/transMenuMap.ts:2208", "frontend/account/tabs/transMenuMap.ts:2223", "frontend/account/tabs/transMenuMap.ts:2238", "frontend/account/tabs/transMenuMap.ts:2253", "frontend/account/tabs/transMenuMap.ts:2268", "frontend/account/transaction/transLayouts.ts:144", "frontend/account/transaction/transLayouts.ts:147", "frontend/account/transaction/ChequePickerModal.tsx:32", "backend/internal/application/process/service.go:2322", "backend/internal/application/process/cheque.go:16", "backend/internal/application/process/cheque.go:68", "backend/internal/application/process/cheque.go:220", "backend/internal/application/process/trans.go:622", "backend/internal/application/process/doc_cancel.go:58", "backend/internal/application/process/doc_cancel.go:585"]
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
- เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]] โดย 451/452/453 เลขเช็คอยู่ที่ chq_number และ item_code คือสมุดบัญชีธนาคาร ส่วน 456 เลือกเช็คลงที่ item_code (`chequeColumns` ChequePickerModal.tsx:32)
- หลังบันทึก ระบบคำนวณสถานะใน [[tbl-cb-chq-list]] ใหม่ด้วย `RebuildChequeStatus` (cheque.go:68 เรียกที่ trans.go:622)

## ฟิลด์/แท็บบนหน้าจอ
- 451/452/453: passBook แท็บ gl (transLayouts.ts:144-146)
- 456: party แท็บ pay, gl (transLayouts.ts:147)
- เช็คที่เลือกได้ (`chequeCandidateWhere` cheque.go:220): 451/452 สถานะ 0,3; 453 สถานะ 2 (ทั้งสามกรองตามสมุดบัญชีถ้าระบุ); 456 สถานะ 0,3 ของคู่ค้ารายเดียวกัน

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ใช้ standard GL เมื่อรูปแบบเอกสารไม่มี template GL (`tpl.post` service.go:1585, case service.go:2322) บัญชีเช็คจ่าย = 2112/2111 (service.go:2323)

| flag | Dr | Cr |
|---|---|---|
| 451 | เช็คจ่าย | ธนาคาร |
| 452 / 453 | ธนาคาร | เจ้าหนี้ 2111/2110/2100 |
| 456 | เช็คจ่าย | เจ้าหนี้ 2111/2110/2100 |

- ธนาคาร = account_code_1 ของสมุดบัญชีตัวแรกในบรรทัด (หรือ pass_book_code ใน cb_trans_detail / ic_trans) ถ้าไม่มีใช้ 1112/1113/1111 (service.go:1797, :1806-1820)

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: เช็คจากแท็บชำระของเอกสารจ่ายเงิน และเช็คจ่ายยกมา 406 ดู [[doc-cheque-paid-balance]]
- สถานะตาม `chequeStatusSQL` (cheque.go:16): 406→0, 451→2, 452→4, 453→3, 456→7 ไม่มีแถว = 0

## ยกเลิก/แก้ไข
- คู่ยกเลิก: 471←451, 472←452, 473←453, 476←456 (doc_cancel.go:58) เมนูยกเลิกอยู่ที่ transMenuMap.ts:2268-2310
- เอกสารยกเลิกได้ GL กลับด้านของต้นฉบับ ณ วันที่เอกสารยกเลิก ส่วนต้นฉบับยังเก็บ GL เดิม (`reverseCancelledGL` doc_cancel.go:585) แล้วสถานะเช็คถูกคำนวณใหม่ (`CancelDoc` doc_cancel.go:120)
- บันทึกต้องอยู่ในงวดบัญชีที่เปิด (`checkOpenPeriod` trans_validate.go:45)

## ข้อควรระวัง
- ใน else-branch มีเงื่อนไข `transFlag == 453` ที่ไม่มีวันเข้า เพราะ 453 ถูกจับในเงื่อนไขแรก (452/453) ไปแล้ว (service.go:2331)
- 452/453 ลง Dr ธนาคาร / Cr เจ้าหนี้ ไม่มีบรรทัดบัญชีเช็คจ่าย (2112/2111)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:2208`–`:2253` เมนู
- `frontend/account/transaction/transLayouts.ts:144`–`:147` FLAG_SPEC
- `backend/internal/application/process/service.go:2322` GL
- `backend/internal/application/process/cheque.go:16` สถานะ / `:220` เช็คที่เลือกได้
- `backend/internal/application/process/doc_cancel.go:58` ยกเลิก

## ดูเพิ่ม
- [[doc-cheque-paid-balance]] · [[doc-cheque-register]] · [[doc-ap-payment]] · [[acc-cheque-transfer]] · [[doctypes-overview]]
