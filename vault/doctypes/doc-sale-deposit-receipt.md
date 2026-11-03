---
title: "รับเงินมัดจำ / ยกมา / คืนเงินมัดจำ (Sales Deposit Receipt)"
tags: [doctypes, sale]
aliases: ["trans_flag 110", "trans_flag 9110", "trans_flag 112", "รับเงินมัดจำ", "รับเงินมัดจำยกมา", "คืนเงินมัดจำ", "SRV", "SRVB", "SRT", "depositSale", "214220"]
sources: ["frontend/account/tabs/transMenuMap.ts:707", "frontend/account/tabs/transMenuMap.ts:721", "frontend/account/tabs/transMenuMap.ts:781", "frontend/account/transaction/transLayouts.ts:79", "backend/internal/application/process/trans.go:220", "backend/internal/application/process/trans.go:225", "backend/internal/application/process/trans_deposit.go:42", "backend/internal/application/process/trans_deposit.go:54", "backend/internal/application/process/trans_deposit.go:246", "backend/internal/application/process/trans_tax.go:42", "backend/internal/application/process/trans_tax.go:49", "backend/internal/application/process/trans_tax.go:111", "backend/internal/application/process/service.go:2196", "backend/internal/application/process/service.go:1780", "backend/internal/application/process/doc_cancel.go:52"]
---

# รับเงินมัดจำ (110) / ยกมา (9110) / คืนเงินมัดจำ (112)

## ใช้เมื่อไร
- 110 "รับเงินมัดจำ" (SRV, transMenuMap.ts:721) อ้าง 30/32/34/36 ได้
- 9110 "รับเงินมัดจำยกมา" (SRVB, transMenuMap.ts:707)
- 112 "คืนเงินมัดจำ" (SRT, transMenuMap.ts:781) อ้างใบ 110

## trans_flag/ตาราง
- หัวเอกสารอยู่ใน [[tbl-ic-trans]] บรรทัดเป็นแถวรายละเอียด + จำนวนเงินใน [[tbl-ap-ar-trans-detail]] (`depositFlags` trans.go:220)
- กลุ่ม `depositSale` ใช้ flag 110/9110, เอกสารคืน 112, doc_type 6 และบัญชี 214220 (trans_deposit.go:42)

## ฟิลด์/แท็บบนหน้าจอ
- 9110: party, depositTerm, vat, taxDoc ไม่มีแท็บ (transLayouts.ts:79)
- 110: party, vat, taxDoc, depositTerm, refDoc แท็บ pay, wht, vat, gl (transLayouts.ts:80)
- 112: party, vat, taxDoc, refDoc, depositRef, depositTerm แท็บ pay, wht, vat, gl (transLayouts.ts:81)

## ผลต่อสต็อก
ไม่มี (ไม่อยู่ในชุด flag ของ `stockRowsSQL` stock_rebuild.go:19)

## ผลต่อภาษี (VAT/WHT)
- ภาษีขาย: 110 vat_calc 1 ส่วน 112 vat_calc −1 (`transVatTabs` trans_tax.go:42) และคำนวณ VAT ตาม vat_type (`depositVatFlags` trans.go:225)
- WHT ฝั่ง ar "ภาษีถูกหัก ณ ที่จ่าย" ใช้กับ 110 และ 112 (`transWhtParty` trans_tax.go:49)
- 9110 ไม่อยู่ใน `transVatTabs` จึงไม่เขียนแถวทะเบียนภาษีขาย (แถว VAT เขียนเฉพาะ flag ใน `transVatTabs` trans_tax.go:111)

## การลงบัญชี
standard GL `case 10, 11, 20, 25, 40, 42, 110, 112` (service.go:2196-2216) กลุ่มมัดจำลงบัญชีมัดจำด้วยยอดก่อน VAT (`base` = ยอดรวม − VAT) และแยกบรรทัดภาษีขาย
| flag | Dr | Cr | จำนวน |
|---|---|---|---|
| 110 | เงินที่รับตามแท็บชำระ (`payTenders(true)`: เงินสด 1111, ธนาคารตามสมุดเงินฝาก, เช็ครับ 1122, บัตร→บัญชีลูกหนี้, ภาษีถูกหัก 1153) | | ยอดรวม |
| 110 | | 214220 | `base` |
| 110 | | ภาษีขาย 2134 (สำรอง 2121, 2135, 2190) | VAT |
| 112 | 214220 | | `base` |
| 112 | ภาษีขาย 2134 | | VAT |
| 112 | | เงินที่จ่ายคืนตามแท็บชำระ (`payTenders(false)`: เงินสด, ธนาคาร, เช็คจ่าย 2112, ภาษีหัก 2122) | ยอดรวม |
| 9110 | ไม่ลง GL (ไม่อยู่ใน `glRebuildTransFlags` service.go:1750) | | |
- ถ้าไม่มีแถว cb_trans หรือยอดแยกไม่ตรง ลงเงินสดทั้งยอด (service.go:1871-1929) บัญชีสำรองดู service.go:1796-1803

## เอกสารต้นทาง-ปลายทาง
- ปลายทาง: ขาย 44, ตั้งหนี้อื่น 99, รายได้อื่น 250 ตัดมัดจำกลุ่มนี้ได้ (`depositKinds` trans_deposit.go:54) ส่วน 144 ไม่อยู่ในรายการ แถวที่ตัดเก็บใน [[tbl-cb-trans-detail]] doc_type 6 และใบขายจะ Dr 214220 ด้วยยอดไม่รวม VAT (`advEx` service.go:1847-1850)
- ดู [[acc-deposit-advance]]

## ยกเลิก/แก้ไข
- ยกเลิก 110 ด้วย 111 และยกเลิก 112 ด้วย 113 (doc_cancel.go:52) ส่วน 9110 ไม่มีคู่ยกเลิกใน `cancelOrigFlags`
- ลบใบ 110/9110 ที่ถูกใช้แล้ว (มีแถวตัดมัดจำหรือใบคืน 112 อ้างถึง) ไม่ได้ (`refuseUsedDepositDelete` trans_deposit.go:246)

## ข้อควรระวัง
- 214220 เป็นรหัส hardcode ถ้าผังบัญชีไม่มีรหัสนี้ (หรือ 214220-xx) จะลงรหัส 214220 ตรงๆ และใช้รหัสเป็นชื่อบัญชี (`resolveChartAccount` service.go:1780-1782)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:707` / `:721` / `:781` เมนู
- `frontend/account/transaction/transLayouts.ts:79` FLAG_SPEC 9110/110/112
- `backend/internal/application/process/trans_deposit.go:42` / `:54` กลุ่มมัดจำ
- `backend/internal/application/process/trans_tax.go:42` / `:49` VAT/WHT
- `backend/internal/application/process/service.go:2196` GL
- `backend/internal/application/process/doc_cancel.go:52` ยกเลิก 111/113

## ดูเพิ่ม
- [[doc-sale-advance-receipt]] · [[doc-sale-invoice]] · [[acc-vat-register-wht]] · [[doctypes-overview]]
