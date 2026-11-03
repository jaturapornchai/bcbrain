---
title: "จ่ายเงินมัดจำ / ยกมา / รับคืน (Purchase Deposit Payment)"
tags: [doctypes, purchase]
aliases: ["trans_flag 11", "trans_flag 9011", "trans_flag 25", "จ่ายเงินมัดจำ", "จ่ายเงินมัดจำยกมา", "รับคืนจ่ายเงินมัดจำ", "PC", "PCB", "PCR", "depositPurchase", "153010"]
sources: ["frontend/account/tabs/transMenuMap.ts:175", "frontend/account/tabs/transMenuMap.ts:189", "frontend/account/tabs/transMenuMap.ts:249", "frontend/account/transaction/transLayouts.ts:73", "backend/internal/application/process/trans.go:220", "backend/internal/application/process/trans.go:225", "backend/internal/application/process/trans_deposit.go:40", "backend/internal/application/process/trans_deposit.go:53", "backend/internal/application/process/trans_tax.go:42", "backend/internal/application/process/trans_tax.go:48", "backend/internal/application/process/trans_tax.go:134", "backend/internal/application/process/service.go:2196", "backend/internal/application/process/service.go:2200", "backend/internal/application/process/service.go:1750", "backend/internal/application/process/service.go:1993", "backend/internal/application/process/doc_flow.go:107", "backend/internal/application/process/pay_check.go:41", "backend/internal/application/process/doc_cancel.go:51"]
---

# จ่ายเงินมัดจำ (11) / ยกมา (9011) / รับคืน (25)

## ใช้เมื่อไร
- 11 "จ่ายเงินมัดจำ" (PC, transMenuMap.ts:189) จ่ายมัดจำให้ผู้ขาย อ้างใบสั่งซื้อ 6 ได้
- 9011 "จ่ายเงินมัดจำยกมา" (PCB, transMenuMap.ts:175)
- 25 "รับคืนจ่ายเงินมัดจำ" (PCR, transMenuMap.ts:249) อ้างใบ 11

## trans_flag/ตาราง
- หัวเอกสารอยู่ใน [[tbl-ic-trans]] บรรทัดอยู่ใน [[tbl-ap-ar-trans-detail]] (`depositFlags` trans.go:220)
- กลุ่ม `depositPurchase` ใช้ flag 11/9011, เอกสารคืน 25, doc_type 6 และบัญชี 153010 (trans_deposit.go:40)

## ฟิลด์/แท็บบนหน้าจอ
- 9011: party, depositTerm, vat, taxDoc ไม่มีแท็บ (transLayouts.ts:73)
- 11: party, depositTerm, vat, taxDoc แท็บ pay, wht, vat, gl (transLayouts.ts:74)
- 25: party, vat, taxDoc, refDoc, depositRef, depositTerm แท็บ pay, wht, vat, gl (transLayouts.ts:75)
- แท็บชำระของ 11 เปิดเมื่อ inquiry = 0 (`payTabEnabled` pay_check.go:41-42)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
- มีภาษีซื้อ: 11 เป็นบวก ส่วน 25 มี vat_calc −1 (`transVatTabs` trans_tax.go:42) และคำนวณ VAT ตาม vat_type ของหัวเอกสาร (`depositVatFlags` trans.go:225)
- WHT ฝั่ง ap ("เราหักผู้ขาย") ใช้กับ 11 และ 25 (`transWhtParty` trans_tax.go:48)
- 9011 มีช่อง vat บนหน้าจอ แต่ไม่อยู่ใน `transVatTabs` (trans_tax.go:37-43) จึงไม่สร้างแถวทะเบียนภาษี
- ดู [[acc-vat-register-wht]]

## การลงบัญชี
ใช้ standard GL (service.go:2196) มัดจำ 11/25 ลงบัญชีมัดจำด้วยฐานก่อน VAT และแยกบรรทัดภาษีซื้อ (service.go:2200-2201)
| flag | Dr | Cr |
|---|---|---|
| 11 | 153010 (ฐานก่อน VAT) + ภาษีซื้อ | เงินที่จ่าย (payTenders) |
| 25 | เงินที่รับ | 153010 + ภาษีซื้อ |
| 9011 | ไม่ลง GL (ไม่อยู่ใน `glRebuildTransFlags` service.go:1750) | |

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ใบสั่งซื้อ 6
- ปลายทาง: ใบซื้อ 12, 315, 87, 260 ตัดมัดจำกลุ่มนี้ได้ (`depositKinds` trans_deposit.go:53) โดยเก็บแถวใน [[tbl-cb-trans-detail]] doc_type 6 ที่มี trans_number = เลขใบมัดจำ และใบซื้อจะ Cr 153010 ด้วยยอดที่ตัดแบบไม่รวม VAT (advEx, service.go:1844-1851 และ :1993) ดู [[acc-deposit-advance]]
- `flowRules` ของมัดจำใช้ `depositRule` (doc_flow.go:107)

## ยกเลิก/แก้ไข
- ยกเลิก 11 ด้วย 151 และยกเลิก 25 ด้วย 152 (doc_cancel.go:51) ส่วน 9011 ไม่มีคู่ยกเลิกใน `cancelOrigFlags` (doc_cancel.go:49-51)
- ลบใบที่ถูกใช้แล้วไม่ได้ (`refuseUsedDepositDelete` trans_deposit.go:246)

## ข้อควรระวัง
- ถ้ามัดจำไม่ได้จ่ายเงินสด (แท็บชำระปิด) ระบบลบ WHT อย่างเดียวและไม่เขียนแถวใหม่ (trans_tax.go:134-135) ดู [[acc-vat-register-wht]]

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:175` / `:189` / `:249` เมนู
- `frontend/account/transaction/transLayouts.ts:73` FLAG_SPEC 9011/11/25
- `backend/internal/application/process/trans_deposit.go:40` / `:53` กลุ่มและใบที่ตัดมัดจำ
- `backend/internal/application/process/trans_tax.go:42` / `:48` VAT/WHT
- `backend/internal/application/process/service.go:2196-2216` GL
- `backend/internal/application/process/pay_check.go:41` payTabEnabled case 11
- `backend/internal/application/process/doc_cancel.go:51` ยกเลิก 151/152

## ดูเพิ่ม
- [[doc-purchase-advance-payment]] · [[doc-purchase-invoice]] · [[acc-payment-tab]] · [[doctypes-overview]]
