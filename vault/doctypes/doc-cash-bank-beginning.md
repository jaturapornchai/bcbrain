---
title: "ยกมาเงินสด / เงินฝากธนาคารยกมา (Cash & Bank Beginning Balance)"
tags: [doctypes, cash-bank]
aliases: ["trans_flag 602", "trans_flag 604", "ยกมาเงินสด", "เงินฝากธนาคารยกมา", "CAB", "BBL", "menu_cb_cash_balance", "menu_cb_bank_balance"]
sources: ["frontend/account/tabs/transMenuMap.ts:1856", "frontend/account/tabs/transMenuMap.ts:1872", "frontend/account/transaction/transLayouts.ts:151", "frontend/account/transaction/transLayouts.ts:152", "frontend/account/transaction/transLayouts.ts:159", "backend/internal/application/process/trans.go:216", "backend/internal/application/process/service.go:1731"]
---

# ยกมาเงินสด (602) / เงินฝากธนาคารยกมา (604)

## ใช้เมื่อไร
ใช้บันทึกยอดเงินสดและเงินฝากธนาคารตอนเริ่มใช้ระบบ
- 602 "ยกมาเงินสด" `menu_cb_cash_balance` (transMenuMap.ts:1856)
- 604 "เงินฝากธนาคารยกมา" `menu_cb_bank_balance` (transMenuMap.ts:1872)

## trans_flag/ตาราง
- เก็บเฉพาะหัวเอกสารใน [[tbl-ic-trans]] ใช้ total_amount ไม่มีบรรทัด (`headerAmountFlags` trans.go:216 และ `HEADER_AMOUNT_FLAGS` transLayouts.ts:159)

## ฟิลด์/แท็บบนหน้าจอ
- 602: amount ไม่มีแท็บ (transLayouts.ts:151)
- 604: passBook, amount ไม่มีแท็บ (transLayouts.ts:152)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ไม่ลง GL เพราะไม่อยู่ใน `glRebuildTransFlags` (service.go:1731)

## เอกสารต้นทาง-ปลายทาง
(ไม่พบในโค้ด)

## ยกเลิก/แก้ไข
- ไม่มีคู่ยกเลิกใน `cancelOrigFlags` (doc_cancel.go:49)

## ข้อควรระวัง
- ยอดยกมาฝั่งบัญชีต้องลง JV เอง ดู [[doc-gl-journal]]

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1856` / `:1872` เมนู
- `frontend/account/transaction/transLayouts.ts:151` / `:152` FLAG_SPEC
- `backend/internal/application/process/trans.go:216` headerAmountFlags
- `backend/internal/application/process/service.go:1731` glRebuildTransFlags

## ดูเพิ่ม
- [[doc-ar-beginning-balance]] · [[doc-ap-beginning-balance]] · [[doc-cheque-received-balance]] · [[doctypes-overview]]
