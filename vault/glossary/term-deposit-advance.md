---
title: "เงินล่วงหน้า และเงินมัดจำ (advance / deposit / advance_amount)"
tags: [glossary, deposit, ap, ar, cb]
aliases: ["เงินล่วงหน้า", "จ่ายเงินล่วงหน้า", "รับเงินล่วงหน้า", "เงินมัดจำ", "มัดจำ", "จ่ายเงินมัดจำ", "รับเงินมัดจำ", "หักเงินมัดจำ", "advance_amount", "advanceAmount", "ยกมา", "คืนเงินมัดจำ", "รับคืนจ่ายเงินล่วงหน้า", "DEPOSIT_FLAGS", "DEPOSIT_TAB_FLAGS", "doc_type 5", "doc_type 6", "PD", "PC", "SD", "SRV", "9010", "9040"]
sources: ["frontend/account/transaction/transLayouts.ts:52", "frontend/account/transaction/transLayouts.ts:54", "frontend/account/transaction/transLayouts.ts:56", "frontend/account/tabs/transMenuMap.ts:145", "frontend/account/tabs/transMenuMap.ts:189", "frontend/account/tabs/transMenuMap.ts:691", "frontend/account/tabs/transMenuMap.ts:721", "frontend/account/transaction/TransBottomPanel.tsx:355", "frontend/account/transaction/UniversalTransScreen.tsx:657", "backend/internal/application/process/trans_deposit.go:38", "backend/internal/application/process/trans_deposit.go:73", "backend/internal/application/process/trans_deposit.go:203", "backend/internal/application/process/trans_save_rules.go:616", "backend/internal/application/process/doc_flow.go:76", "frontend/src/config/bcMenu.json:3902", "frontend/src/config/bcMenu.json:5038"]
---

# เงินล่วงหน้า / เงินมัดจำ

## ในระบบนี้คืออะไร
ระบบแยกเงินที่รับหรือจ่ายก่อนส่งของเป็นสองชนิด คือ **เงินล่วงหน้า** และ **เงินมัดจำ** แต่ละชนิดมีเอกสารรับ/จ่าย เอกสารยกมา และเอกสารคืนเงิน เมื่อออกใบซื้อหรือใบขายจริง ผู้ใช้เลือกใบมัดจำมาหักได้ที่แท็บใช้เงินมัดจำ และยอดรวมที่หักไปแสดงที่ช่อง "หักเงินมัดจำ" (`advance_amount`, `TransBottomPanel.tsx:355-361`)

## flag (จาก `transMenuMap.ts`)
| | ฝั่งซื้อ (จ่าย) | ฝั่งขาย (รับ) |
|---|---|---|
| ล่วงหน้ายกมา | 9010 PDB (`:145`) | 9040 SDB (`:677`) |
| ล่วงหน้า | 10 PD จ่ายเงินล่วงหน้า (`:159`) | 40 SD รับเงินล่วงหน้า (`:691`) |
| มัดจำยกมา | 9011 PCB (`:175`) | 9110 SRVB (`:707`) |
| มัดจำ | 11 PC จ่ายเงินมัดจำ (`:189`) | 110 SRV รับเงินมัดจำ (`:721`) |
| คืนล่วงหน้า | 20 PDR รับคืนจ่ายเงินล่วงหน้า (`:233`) | 42 SDR คืนเงินรับล่วงหน้า (`:765`) |
| คืนมัดจำ | 25 PCR รับคืนจ่ายเงินมัดจำ (`:249`) | 112 SRT คืนเงินมัดจำ (`:781`) |
- ชุด flag ที่ใช้จอเงินล่วงหน้า/มัดจำคือ `DEPOSIT_FLAGS` (`transLayouts.ts:52`)
- ใบซื้อ/ใบขายที่มีแท็บใช้เงินมัดจำคือ `DEPOSIT_TAB_FLAGS` = 12, 315, 87, 260, 44, 99, 250 (`transLayouts.ts:54`)
- เอกสารคืนเงินมีป้ายช่องอ้างอิงเฉพาะ เช่น "เลขที่ใบจ่ายล่วงหน้า" และ "เลขที่ใบรับเงินมัดจำ" (`DEPOSIT_REF_LABEL`, `:56-59`)

## การเก็บข้อมูล
- การใช้เงินล่วงหน้า/มัดจำเก็บเป็นแถว `cb_trans_detail` ที่ `doc_type` 5 (ล่วงหน้า) หรือ 6 (มัดจำ) และ `trans_number` = เลขที่ใบเงินล่วงหน้า/มัดจำ (`depositRule`, `doc_flow.go:76-85`; `depositStmts` เขียนแถวใช้เงินมัดจำ, `trans_deposit.go:98`)
- ชนิดการใช้ (`useDocType`) แยกตามกลุ่ม: ล่วงหน้า (10/9010 ฝั่งซื้อ, 40/9040 ฝั่งขาย) = 5, มัดจำ (11/9011 ฝั่งซื้อ, 110/9110 ฝั่งขาย) = 6 (`advancePurchase`, `depositPurchase`, `advanceSale`, `depositSale`, `trans_deposit.go:38-42`) ใบซื้อ 12, 315, 87, 260 จับกลุ่มมัดจำฝั่งซื้อ ส่วนใบขาย 44, 99, 250 จับกลุ่มมัดจำฝั่งขาย (`depositKinds`, `trans_deposit.go:48-55`)
- `ic_trans.advance_amount` = ผลรวมยอดตัดของแถวในแท็บใช้เงินมัดจำ ถ้าภาษีแยกนอก (`vat_type = 0`) จะตัดภาษีออกให้เป็นยอดก่อนภาษี ปัด 2 ตำแหน่ง (`depositAdvance`, `trans_deposit.go:73-87`; ตัวอย่างบนจอ `UniversalTransScreen.tsx:657-661`) จอกลุ่ม `ap_ar_trans` พิมพ์ช่องนี้เองได้ (`UniversalTransScreen.tsx:4106`) ส่วนจอ `ic_trans` เป็นแบบอ่านอย่างเดียว (`TransBottomPanel.tsx:360-361`)
- การตรวจวงเงินสินเชื่อหักยอดรับเงินมัดจำ (110/9110) และรับเงินล่วงหน้า (40/9040) ที่ยังไม่ใช้ออกจากหนี้ค้าง เมื่อเปิด `erp_option.credit_sale_include_deposit` (`creditDepositSQL`, `trans_save_rules.go:613-620`; ใช้ที่ `:557-558`)
- ใบเงินล่วงหน้า/มัดจำถือว่าใช้ครบเมื่อหักจนหมดยอด (`depositRule`, `doc_flow.go:76-85`; ใช้กับ flag 10, 11, 40, 110 ที่ `:106-109`)

## ข้อควรระวัง
- แท็บใช้เงินมัดจำของใบซื้อ/ใบขายให้เลือกเฉพาะใบมัดจำ (11/9011 ฝั่งซื้อ, 110/9110 ฝั่งขาย) ไม่รวมใบเงินล่วงหน้า (10/40) เพราะรายการดึงตาม `kind.flags` ของกลุ่มมัดจำ (`OpenDeposits`, `trans_deposit.go:203`, `:228`)
- เมนูหลัก: จ่ายเงินล่วงหน้า (bcMenu.json:3902), จ่ายเงินมัดจำ (:3941), รับเงินล่วงหน้า (:5038), รับเงินมัดจำ (:5077)

## ลิงก์
[[acc-deposit-advance]] · [[term-pay-tenders]] · [[term-doc-totals]] · [[term-trans-flag]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/account/transaction/transLayouts.ts:52-59`
- `frontend/account/tabs/transMenuMap.ts:145`, `:159`, `:175`, `:189`, `:233`, `:249`, `:677`, `:691`, `:707`, `:721`, `:765`, `:781`
- `frontend/account/transaction/TransBottomPanel.tsx:24-26`, `:355-361`
- `frontend/account/transaction/UniversalTransScreen.tsx:657-661`, `:4106`
- `backend/internal/application/process/trans_deposit.go:38-55`, `:73-87`, `:98`, `:203`, `:228`
- `backend/internal/application/process/trans_save_rules.go:557-558`, `:613-620`
- `backend/internal/application/process/doc_flow.go:76-85`, `:106-109`
- `frontend/src/config/bcMenu.json:3902`, `:3941`, `:5038`, `:5077`
