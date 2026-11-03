---
title: "รับเงินล่วงหน้า / ยกมา / คืนเงิน (Sales Advance Receipt)"
tags: [doctypes, sale]
aliases: ["trans_flag 40", "trans_flag 9040", "trans_flag 42", "รับเงินล่วงหน้า", "รับเงินล่วงหน้ายกมา", "คืนเงินรับล่วงหน้า", "SD", "SDB", "SDR", "advanceSale", "214100"]
sources: ["frontend/account/tabs/transMenuMap.ts:677", "frontend/account/tabs/transMenuMap.ts:691", "frontend/account/tabs/transMenuMap.ts:765", "frontend/account/transaction/transLayouts.ts:76", "backend/internal/application/process/trans.go:220", "backend/internal/application/process/trans.go:225", "backend/internal/application/process/trans_deposit.go:41", "backend/internal/application/process/trans_deposit.go:65", "backend/internal/application/process/service.go:2196", "backend/internal/application/process/service.go:1750", "backend/internal/application/process/doc_cancel.go:52", "backend/internal/application/process/doc_flow_graph.go:153"]
---

# รับเงินล่วงหน้า (40) / ยกมา (9040) / คืนเงิน (42)

## ใช้เมื่อไร
- 40 "รับเงินล่วงหน้า" (SD, transMenuMap.ts:691) รับเงินจากลูกค้าก่อนขาย อ้าง 30/32/34/36 ได้ และ inquiry เริ่มต้น = 1
- 9040 "รับเงินล่วงหน้ายกมา" (SDB, transMenuMap.ts:677)
- 42 "คืนเงินรับล่วงหน้า" (SDR, transMenuMap.ts:765) อ้างใบ 40

## trans_flag/ตาราง
- หัวเอกสารอยู่ใน [[tbl-ic-trans]] บรรทัดเป็นแถวรายละเอียด + จำนวนเงินใน [[tbl-ap-ar-trans-detail]] ไม่ใช่รายการสินค้า (`depositFlags` trans.go:220)
- กลุ่ม `advanceSale` ใช้ flag 40/9040, เอกสารคืน 42, doc_type 5 และบัญชี 214100 (trans_deposit.go:41)

## ฟิลด์/แท็บบนหน้าจอ
- 9040: party, depositTerm ไม่มีแท็บ (transLayouts.ts:76)
- 40: party, depositTerm, refDoc แท็บ pay, gl (transLayouts.ts:77)
- 42: party, refDoc, depositRef, depositTerm แท็บ pay, gl (transLayouts.ts:78)

## ผลต่อสต็อก
ไม่มี (ไม่อยู่ในชุด flag ของ `stockRowsSQL` stock_rebuild.go:19)

## ผลต่อภาษี (VAT/WHT)
ไม่มี VAT และไม่มี WHT เพราะไม่อยู่ใน `depositVatFlags` (trans.go:225), `transVatTabs` และ `transWhtParty` (trans_tax.go:37, :48)

## การลงบัญชี
standard GL `case 10, 11, 20, 25, 40, 42, 110, 112` (service.go:2196-2216) กลุ่มล่วงหน้าใช้ยอดรวมทั้งจำนวน (ไม่แยก VAT)
| flag | Dr | Cr | จำนวน |
|---|---|---|---|
| 40 | เงินที่รับตามแท็บชำระ (`payTenders(true)`: เงินสด 1111, ธนาคารตามสมุดเงินฝาก, เช็ครับ 1122, บัตร→บัญชีลูกหนี้, ภาษีถูกหัก 1153) | 214100 | ยอดรวม |
| 42 | 214100 | เงินที่จ่ายคืนตามแท็บชำระ (`payTenders(false)`: เงินสด, ธนาคาร, เช็คจ่าย 2112, ภาษีหัก 2122) | ยอดรวม |
| 9040 | ไม่ลง GL (ไม่อยู่ใน `glRebuildTransFlags` service.go:1750) | | |
- ถ้าไม่มีแถว cb_trans หรือยอดแยกไม่ตรง ลงเงินสดทั้งยอด (service.go:1871-1929) บัญชีสำรองดู service.go:1796-1803

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ใบเสนอราคา 30, อนุมัติ 32, ใบจอง 34, ใบสั่งขาย 36 (`refTransFlags` transMenuMap.ts:691)
- ยอดคงเหลือคำนวณสดด้วย `depositBalanceSQL` = ยอดรวม − ใบคืน 42 − แถวใช้เงิน doc_type 5 ใน cb_trans_detail (trans_deposit.go:65)
- ใบขาย 44/99/250 ผูกแท็บใช้เงินกับกลุ่มมัดจำ (doc_type 6) เท่านั้น (`depositKinds` trans_deposit.go:54) ไม่มีใบขายใดตัดยอดล่วงหน้า doc_type 5 ดู [[acc-deposit-advance]]

## ยกเลิก/แก้ไข
- ยกเลิก 40 ด้วย 41 และยกเลิก 42 ด้วย 43 (doc_cancel.go:52) ส่วน 9040 ไม่มีคู่ยกเลิกใน `cancelOrigFlags`

## ข้อควรระวัง
- doc_flow_graph.go ใช้ flag ยกเลิกชุด 160/162 เป็น label (doc_flow_graph.go:153, :155) ซึ่งไม่ตรงกับ 41/43 ใน `cancelOrigFlags` ดู [[doctypes-overview]]

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:677` / `:691` / `:765` เมนู
- `frontend/account/transaction/transLayouts.ts:76` FLAG_SPEC 9040/40/42
- `backend/internal/application/process/trans_deposit.go:41` advanceSale
- `backend/internal/application/process/service.go:2196` GL
- `backend/internal/application/process/doc_cancel.go:52` ยกเลิก 41/43

## ดูเพิ่ม
- [[doc-sale-deposit-receipt]] · [[acc-payment-tab]] · [[doctypes-overview]]
