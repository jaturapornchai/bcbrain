---
title: "บันทึกขึ้นเงิน wallet (Wallet Pass)"
tags: [doctypes, cash-bank]
aliases: ["trans_flag 463", "บันทึกขึ้นเงินwallet", "WLD", "menu_cb_wallet_pass"]
sources: ["frontend/account/tabs/transMenuMap.ts:1960", "frontend/account/transaction/transLayouts.ts:150", "backend/internal/application/process/service.go:1755", "backend/internal/application/process/service.go:2340", "backend/internal/application/process/service.go:1805", "backend/internal/application/process/cheque.go:27", "backend/internal/application/process/cheque.go:259", "backend/internal/application/process/trans.go:1278", "backend/internal/application/process/trans.go:1437", "backend/internal/application/process/trans.go:1543", "backend/internal/application/process/doc_cancel.go:49"]
---

# บันทึกขึ้นเงิน wallet (trans_flag 463)

## ใช้เมื่อไร
ใช้นำยอดรับผ่าน wallet เข้าธนาคาร ผ่านเมนู "บันทึกขึ้นเงินwallet" (WLD, transMenuMap.ts:1960)

## trans_flag/ตาราง
- เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]
- แถว PromptPay / QR / e-Wallet ของแท็บชำระเก็บเป็น cb_trans_detail doc_type 21 (trans.go:1278, :1437)

## ฟิลด์/แท็บบนหน้าจอ
- passBook แท็บ gl (transLayouts.ts:150)
- เลือกได้เฉพาะแถว [[tbl-cb-chq-list]] chq_type 21 ที่สถานะ 0 (`chequeCandidateWhere` cheque.go:259-260)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี (ไม่อยู่ใน `transVatTabs` / `transWhtParty` trans_tax.go:37, :48)

## การลงบัญชี
standard GL `case 461, 462, 463` (service.go:2340, อยู่ใน `glRebuildTransFlags` service.go:1755) โดย 463 เข้า else-branch เดียวกับ 462
| Dr | Cr | จำนวน |
|---|---|---|
| ลูกหนี้ 1121 (สำรอง 1131, 1130, 1120) | ธนาคาร 1112 (สำรอง 1113, 1111) หรือบัญชีของสมุดเงินฝาก | ยอดรวม |
- บัญชีธนาคารใช้บัญชีของสมุดเงินฝากที่พบในเอกสารก่อน (service.go:1805-1819)

## เอกสารต้นทาง-ปลายทาง
- สถานะ chq_type 21: 463→1 (cheque.go:27)

## ยกเลิก/แก้ไข
- ไม่มีคู่ยกเลิกใน `cancelOrigFlags` (doc_cancel.go:49)

## ข้อควรระวัง
- 463 คือการขึ้นเงิน แต่ GL ลง Dr ลูกหนี้ / Cr ธนาคาร เหมือนการยกเลิกบัตร 462 ซึ่งกลับข้างกับ 461
- `chqListFromPaySQL` (trans.go:1543) เป็นจุดเดียวที่ insert cb_chq_list และสร้างเฉพาะ doc_type 2/3 เป็น chq_type 1/2/3 ไม่มีโค้ดที่สร้างแถว chq_type 21 ทำให้รายการที่เลือกได้ของ 463 อาจว่าง

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1960` เมนู
- `frontend/account/transaction/transLayouts.ts:150` FLAG_SPEC 463
- `backend/internal/application/process/service.go:2340` GL
- `backend/internal/application/process/cheque.go:259` candidates

## ดูเพิ่ม
- [[doc-credit-card]] · [[doc-cheque-register]] · [[doctypes-overview]]
