---
title: "จ่ายเงินล่วงหน้า / ยกมา / รับคืน (Purchase Advance Payment)"
tags: [doctypes, purchase]
aliases: ["trans_flag 10", "trans_flag 9010", "trans_flag 20", "จ่ายเงินล่วงหน้า", "จ่ายเงินล่วงหน้ายกมา", "รับคืนจ่ายเงินล่วงหน้า", "PD", "PDB", "PDR", "advancePurchase"]
sources: ["frontend/account/tabs/transMenuMap.ts:145", "frontend/account/tabs/transMenuMap.ts:159", "frontend/account/tabs/transMenuMap.ts:233", "frontend/account/transaction/transLayouts.ts:70", "backend/internal/application/process/trans.go:220", "backend/internal/application/process/trans.go:225", "backend/internal/application/process/trans_deposit.go:39", "backend/internal/application/process/trans_deposit.go:53", "backend/internal/application/process/service.go:2196", "backend/internal/application/process/service.go:1842", "backend/internal/application/process/service.go:1750", "backend/internal/application/process/service.go:1780", "backend/internal/application/process/trans_deposit.go:65", "backend/internal/application/process/trans_deposit.go:246", "backend/internal/application/process/pay_check.go:36", "backend/internal/application/process/doc_cancel.go:51"]
---

# จ่ายเงินล่วงหน้า (10) / ยกมา (9010) / รับคืน (20)

## ใช้เมื่อไร
- 10 "จ่ายเงินล่วงหน้า" (PD, transMenuMap.ts:159) จ่ายเงินให้ผู้ขายก่อนรับสินค้า อ้างใบสั่งซื้อ 6 ได้
- 9010 "จ่ายเงินล่วงหน้ายกมา" (PDB, transMenuMap.ts:145) ใช้บันทึกยอดยกมา
- 20 "รับคืนจ่ายเงินล่วงหน้า" (PDR, transMenuMap.ts:233) ใช้รับเงินคืน อ้างใบ 10

## trans_flag/ตาราง
- หัวเอกสารอยู่ใน [[tbl-ic-trans]] ส่วนบรรทัดเป็นแถว "รายละเอียด + จำนวนเงิน" ใน [[tbl-ap-ar-trans-detail]] ไม่ใช่รายการสินค้า (`depositFlags` trans.go:220)
- กลุ่ม `advancePurchase` ใช้ flag 10/9010, เอกสารคืน 20, doc_type 5 และบัญชี 115710 (trans_deposit.go:39)

## ฟิลด์/แท็บบนหน้าจอ
- 9010: party, depositTerm ไม่มีแท็บ (FLAG_SPEC transLayouts.ts:70)
- 10: party, depositTerm แท็บ pay, gl (transLayouts.ts:71)
- 20: party, refDoc, depositRef, depositTerm แท็บ pay, gl (transLayouts.ts:72) ช่องอ้างอิงชื่อ "เลขที่ใบจ่ายล่วงหน้า" (`DEPOSIT_REF_LABEL` transLayouts.ts:56)
- ทั้งสาม flag ไม่มีช่อง inquiry จึงเปิดแท็บชำระเสมอ (`payTabEnabled` pay_check.go:36)

## ผลต่อสต็อก
ไม่มี เพราะไม่อยู่ใน `stockRowsSQL` (stock_rebuild.go:18)

## ผลต่อภาษี (VAT/WHT)
- ไม่มี VAT: กลุ่มล่วงหน้าไม่มีช่องอัตราภาษี จึงไม่อยู่ใน `depositVatFlags` (trans.go:225) และไม่อยู่ใน `transVatTabs` (trans_tax.go:37)
- ไม่มี WHT: ไม่อยู่ใน `transWhtParty` (trans_tax.go:48)

## การลงบัญชี
ใช้ standard GL (service.go:2196) บัญชีล่วงหน้าได้จาก `resolveChartAccount` ของรหัส 115710 ในกลุ่ม (service.go:1842) ทั้ง 10 และ 20 ใช้ยอดรวม (service.go:2198)
| flag | Dr | Cr |
|---|---|---|
| 10 | 115710 (ยอดรวม) | เงินที่จ่ายตามแท็บชำระ (payTenders) |
| 20 | เงินที่รับตามแท็บชำระ | 115710 |
| 9010 | ไม่ลง GL (ไม่อยู่ใน `glRebuildTransFlags` service.go:1750) | |

ดูรายละเอียดเพิ่มที่ [[acc-deposit-advance]] และ [[acc-payment-tab]]

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ใบสั่งซื้อ 6 (transMenuMap.ts:159)
- ยอดคงเหลือ = ยอดของใบ 10 − ใบคืน 20 ที่ doc_ref ชี้มา − แถวที่นำไปใช้ใน cb_trans_detail (`depositBalanceSQL` trans_deposit.go:65)
- ใบซื้อ 12/315/87/260 ที่มีแท็บใช้เงินมัดจำ ผูกกับกลุ่มมัดจำ `depositPurchase` เท่านั้น ไม่มีใบซื้อใดตัดยอดกลุ่มล่วงหน้า doc_type 5 (`depositKinds` trans_deposit.go:53)

## ยกเลิก/แก้ไข
- ยกเลิก 10 ด้วย 150 และยกเลิก 20 ด้วย 161 (`cancelOrigFlags` doc_cancel.go:51)
- 9010 ไม่มีคู่ยกเลิกใน `cancelOrigFlags` (doc_cancel.go:49-51)
- ลบใบที่ถูกใช้แล้วหรือมีใบคืนอ้างอยู่ไม่ได้ (`refuseUsedDepositDelete` trans_deposit.go:246)

## ข้อควรระวัง
- บัญชี 115710 เป็นรหัสที่กำหนดในโค้ด (trans_deposit.go:39) ระบบหาผังบัญชีที่รหัสตรงหรือขึ้นต้นด้วย `115710-` ถ้าไม่พบจะลง GL ด้วยรหัส 115710 และชื่อ "115710" ตรงๆ ไม่ใช่บัญชีพัก (`resolveChartAccount` service.go:1780-1782)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:145` / `:159` / `:233` เมนู
- `frontend/account/transaction/transLayouts.ts:70` FLAG_SPEC 9010/10/20
- `backend/internal/application/process/trans.go:220` depositFlags / `:225` depositVatFlags
- `backend/internal/application/process/trans_deposit.go:39` advancePurchase / `:53` ใบซื้อที่ตัดมัดจำ
- `backend/internal/application/process/service.go:2196-2216` GL มัดจำ/ล่วงหน้า
- `backend/internal/application/process/doc_cancel.go:51` ยกเลิก 150/161

## ดูเพิ่ม
- [[doc-purchase-deposit-payment]] · [[doc-purchase-order]] · [[acc-gl-posting-standard]] · [[doctypes-overview]]
