---
title: "รับเงินมัดจำ / ยกมา / คืนเงินมัดจำ (Sales Deposit Receipt)"
tags: [doctypes, sale]
aliases: ["trans_flag 110", "trans_flag 9110", "trans_flag 112", "รับเงินมัดจำ", "รับเงินมัดจำยกมา", "คืนเงินมัดจำ", "SRV", "SRVB", "SRT", "depositSale", "214220"]
sources: ["frontend/account/tabs/transMenuMap.ts:707", "frontend/account/tabs/transMenuMap.ts:721", "frontend/account/tabs/transMenuMap.ts:781", "frontend/account/transaction/transLayouts.ts:79", "backend/internal/application/process/trans.go:219", "backend/internal/application/process/trans.go:223", "backend/internal/application/process/trans_deposit.go:38", "backend/internal/application/process/trans_deposit.go:48", "backend/internal/application/process/trans_tax.go:37", "backend/internal/application/process/trans_tax.go:48", "backend/internal/application/process/service.go:2185", "backend/internal/application/process/doc_cancel.go:52"]
---

# รับเงินมัดจำ (110) / ยกมา (9110) / คืนเงินมัดจำ (112)

## ใช้เมื่อไร
- 110 "รับเงินมัดจำ" (SRV, transMenuMap.ts:721)
- 9110 "รับเงินมัดจำยกมา" (SRVB, transMenuMap.ts:707)
- 112 "คืนเงินมัดจำ" (SRT, transMenuMap.ts:781) อ้างใบ 110

## trans_flag/ตาราง
- หัวเอกสารอยู่ใน [[tbl-ic-trans]] บรรทัดอยู่ใน [[tbl-ap-ar-trans-detail]] (`depositFlags` trans.go:219)
- กลุ่ม `depositSale` ใช้ flag 110/9110, เอกสารคืน 112, doc_type 6 และบัญชี 214220 (trans_deposit.go:38)

## ฟิลด์/แท็บบนหน้าจอ
- 9110: party, depositTerm, vat, taxDoc ไม่มีแท็บ (transLayouts.ts:79)
- 110: party, vat, taxDoc, depositTerm, refDoc แท็บ pay, wht, vat, gl (transLayouts.ts:80)
- 112: party, vat, taxDoc, refDoc, depositRef, depositTerm แท็บ pay, wht, vat, gl (transLayouts.ts:81)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
- ภาษีขาย: 110 เป็นบวก ส่วน 112 มี vat_calc −1 (trans_tax.go:37) และคำนวณ VAT ตาม vat_type (`depositVatFlags` trans.go:223)
- WHT ฝั่ง ar "ลูกค้าหักเรา" ใช้กับ 110 และ 112 (trans_tax.go:48)
- 9110 ไม่อยู่ใน `transVatTabs` จึงไม่สร้างแถวทะเบียนภาษี (ไม่พบในโค้ด)

## การลงบัญชี
ใช้ standard GL (service.go:2185)
| flag | Dr | Cr |
|---|---|---|
| 110 | เงินที่รับ (payTenders) | 214220 (ฐาน) + ภาษีขาย |
| 112 | 214220 + ภาษีขาย | เงินที่จ่ายคืน |
| 9110 | ไม่ลง GL | |

## เอกสารต้นทาง-ปลายทาง
- ปลายทาง: ขาย 44, ตั้งหนี้อื่น 99, รายได้อื่น 250 ตัดมัดจำกลุ่มนี้ได้ (`depositKinds` trans_deposit.go:48) ส่วน 144 ไม่อยู่ในรายการ แถวที่ตัดเก็บใน [[tbl-cb-trans-detail]] doc_type 6 และใบขายจะ Dr 214220 ด้วยยอดไม่รวม VAT (advEx)
- ดู [[acc-deposit-advance]]

## ยกเลิก/แก้ไข
- ยกเลิก 110 ด้วย 111 และยกเลิก 112 ด้วย 113 (doc_cancel.go:52) ส่วน 9110 ไม่มีคู่ยกเลิก (ไม่พบในโค้ด)
- ลบใบที่ถูกใช้แล้วไม่ได้ (`refuseUsedDepositDelete` trans_deposit.go:246)

## ข้อควรระวัง
- 214220 เป็นรหัส hardcode ถ้าผังบัญชีไม่มีรหัสนี้จะตกไปบัญชีพัก (service.go:1755)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:707` / `:721` / `:781` เมนู
- `frontend/account/transaction/transLayouts.ts:79` FLAG_SPEC 9110/110/112
- `backend/internal/application/process/trans_deposit.go:38` / `:48` กลุ่มมัดจำ
- `backend/internal/application/process/trans_tax.go:37` / `:48` VAT/WHT
- `backend/internal/application/process/service.go:2185` GL
- `backend/internal/application/process/doc_cancel.go:52` ยกเลิก 111/113

## ดูเพิ่ม
- [[doc-sale-advance-receipt]] · [[doc-sale-invoice]] · [[acc-vat-register-wht]] · [[doctypes-overview]]
