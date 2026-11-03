---
title: "เงินล่วงหน้า และเงินมัดจำ (advance / deposit / advance_amount)"
tags: [glossary, deposit, ap, ar, cb]
aliases: ["เงินล่วงหน้า", "จ่ายเงินล่วงหน้า", "รับเงินล่วงหน้า", "เงินมัดจำ", "มัดจำ", "จ่ายเงินมัดจำ", "รับเงินมัดจำ", "หักเงินมัดจำ", "advance_amount", "advanceAmount", "ยกมา", "คืนเงินมัดจำ", "รับคืนจ่ายเงินล่วงหน้า", "DEPOSIT_FLAGS", "DEPOSIT_TAB_FLAGS", "doc_type 5", "doc_type 6", "PD", "PC", "SD", "SRV", "9010", "9040"]
sources: ["frontend/account/transaction/transLayouts.ts:52", "frontend/account/transaction/transLayouts.ts:54", "frontend/account/transaction/transLayouts.ts:56", "frontend/account/tabs/transMenuMap.ts:145", "frontend/account/tabs/transMenuMap.ts:189", "frontend/account/tabs/transMenuMap.ts:691", "frontend/account/tabs/transMenuMap.ts:721", "frontend/account/transaction/TransBottomPanel.tsx:353", "backend/internal/application/process/trans_deposit.go:17", "backend/internal/application/process/trans_save_rules.go:614", "backend/internal/application/process/doc_flow.go:75", "frontend/src/config/bcMenu.json:3902", "frontend/src/config/bcMenu.json:5038"]
---

# เงินล่วงหน้า / เงินมัดจำ

## ในระบบนี้คืออะไร
ระบบแยกเงินที่รับหรือจ่ายก่อนส่งของเป็นสองชนิด คือ **เงินล่วงหน้า** และ **เงินมัดจำ** แต่ละชนิดมีเอกสารรับ/จ่าย เอกสารยกมา และเอกสารคืนเงิน เมื่อออกใบซื้อหรือใบขายจริง ผู้ใช้ดึงยอดเหล่านี้มาหักได้ที่ช่อง "หักเงินมัดจำ" (`advance_amount`, `TransBottomPanel.tsx:353`)

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
- เอกสารคืนเงินมีป้ายช่องอ้างอิงเฉพาะ เช่น "เลขที่ใบจ่ายล่วงหน้า" และ "เลขที่ใบรับเงินมัดจำ" (`DEPOSIT_REF_LABEL`, `:56-60`)

## การเก็บข้อมูล
- การใช้เงินล่วงหน้า/มัดจำเก็บเป็นแถว `cb_trans_detail` ที่ `doc_type` 5 (ล่วงหน้า) หรือ 6 (มัดจำ) และ `trans_number` = เลขที่ใบเงินล่วงหน้า/มัดจำ (`doc_flow.go:75`, `trans_deposit.go:17`)
- กติกาการบันทึกเลือก doc_type ตามชนิดเอกสารต้นทาง: 110/9110 ใช้ 6 นอกนั้นใช้ 5 (`trans_save_rules.go:614-619`)
- ใบเงินล่วงหน้า/มัดจำถือว่าใช้ครบเมื่อหักจนหมดยอด (`doc_flow.go:75`)

## ข้อควรระวัง
- ป้ายบนจอเขียน "หักเงินมัดจำ" แต่คอลัมน์ `advance_amount` ใช้กับทั้งเงินล่วงหน้าและเงินมัดจำ
- เมนูหลัก: จ่ายเงินล่วงหน้า (bcMenu.json:3902), จ่ายเงินมัดจำ (:3941), รับเงินล่วงหน้า (:5038), รับเงินมัดจำ (:5077)

## ลิงก์
[[acc-deposit-advance]] · [[term-pay-tenders]] · [[term-doc-totals]] · [[term-trans-flag]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/account/transaction/transLayouts.ts:52-60`
- `frontend/account/tabs/transMenuMap.ts:145`, `:159`, `:175`, `:189`, `:233`, `:249`, `:677`, `:691`, `:707`, `:721`, `:765`, `:781`
- `frontend/account/transaction/TransBottomPanel.tsx:353`
- `backend/internal/application/process/trans_deposit.go:17`; `trans_save_rules.go:614-619`; `doc_flow.go:75`
- `frontend/src/config/bcMenu.json:3902`, `:3941`, `:5038`, `:5077`
