---
title: "รับเงินล่วงหน้า / ยกมา / คืนเงิน (Sales Advance Receipt)"
tags: [doctypes, sale]
aliases: ["trans_flag 40", "trans_flag 9040", "trans_flag 42", "รับเงินล่วงหน้า", "รับเงินล่วงหน้ายกมา", "คืนเงินรับล่วงหน้า", "SD", "SDB", "SDR", "advanceSale", "214100"]
sources: ["frontend/account/tabs/transMenuMap.ts:677", "frontend/account/tabs/transMenuMap.ts:691", "frontend/account/tabs/transMenuMap.ts:765", "frontend/account/transaction/transLayouts.ts:76", "backend/internal/application/process/trans.go:219", "backend/internal/application/process/trans.go:223", "backend/internal/application/process/trans_deposit.go:38", "backend/internal/application/process/service.go:2185", "backend/internal/application/process/doc_cancel.go:52"]
---

# รับเงินล่วงหน้า (40) / ยกมา (9040) / คืนเงิน (42)

## ใช้เมื่อไร
- 40 "รับเงินล่วงหน้า" (SD, transMenuMap.ts:691) รับเงินจากลูกค้าก่อนขาย อ้าง 30/32/34/36 ได้ และ inquiry เริ่มต้น = 1
- 9040 "รับเงินล่วงหน้ายกมา" (SDB, transMenuMap.ts:677)
- 42 "คืนเงินรับล่วงหน้า" (SDR, transMenuMap.ts:765) อ้างใบ 40

## trans_flag/ตาราง
- หัวเอกสารอยู่ใน [[tbl-ic-trans]] บรรทัดอยู่ใน [[tbl-ap-ar-trans-detail]] (`depositFlags` trans.go:219)
- กลุ่ม `advanceSale` ใช้ flag 40/9040, เอกสารคืน 42, doc_type 5 และบัญชี 214100 (trans_deposit.go:38)

## ฟิลด์/แท็บบนหน้าจอ
- 9040: party, depositTerm ไม่มีแท็บ (transLayouts.ts:76)
- 40: party, depositTerm, refDoc แท็บ pay, gl (transLayouts.ts:77)
- 42: party, refDoc, depositRef, depositTerm แท็บ pay, gl (transLayouts.ts:78)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี VAT และไม่มี WHT เพราะไม่อยู่ใน `depositVatFlags` (trans.go:223), `transVatTabs` และ `transWhtParty` (trans_tax.go:37, :48)

## การลงบัญชี
ใช้ standard GL (service.go:2185)
| flag | Dr | Cr |
|---|---|---|
| 40 | เงินที่รับ (payTenders) | 214100 |
| 42 | 214100 | เงินที่จ่ายคืน |
| 9040 | ไม่ลง GL | |

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ใบเสนอราคา 30, อนุมัติ 32, ใบจอง 34, ใบสั่งขาย 36 (transMenuMap.ts:691)
- ยอดคงเหลือคำนวณสดด้วย `depositBalanceSQL` (trans_deposit.go:65)
- ใบขายที่ตัดยอดล่วงหน้า doc_type 5: (ไม่พบในโค้ดที่อ่าน) เพราะ `depositKinds` ผูกใบขาย 44/99/250 ไว้กับกลุ่มมัดจำ (trans_deposit.go:48) ดู [[acc-deposit-advance]]

## ยกเลิก/แก้ไข
- ยกเลิก 40 ด้วย 41 และยกเลิก 42 ด้วย 43 (doc_cancel.go:52) ส่วน 9040 ไม่มีคู่ยกเลิก (ไม่พบในโค้ด)

## ข้อควรระวัง
- doc_flow_graph.go ใช้ flag ยกเลิกชุด 160–163 เป็น label ซึ่งไม่ตรงกับ 41/43 ใน `cancelOrigFlags` ดู [[doctypes-overview]]

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:677` / `:691` / `:765` เมนู
- `frontend/account/transaction/transLayouts.ts:76` FLAG_SPEC 9040/40/42
- `backend/internal/application/process/trans_deposit.go:38` advanceSale
- `backend/internal/application/process/service.go:2185` GL
- `backend/internal/application/process/doc_cancel.go:52` ยกเลิก 41/43

## ดูเพิ่ม
- [[doc-sale-deposit-receipt]] · [[acc-payment-tab]] · [[doctypes-overview]]
