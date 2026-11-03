---
title: "ยกมาเงินสด / เงินฝากธนาคารยกมา (Cash & Bank Beginning Balance)"
tags: [doctypes, cash-bank]
aliases: ["trans_flag 602", "trans_flag 604", "ยกมาเงินสด", "เงินฝากธนาคารยกมา", "CAB", "BBL", "menu_cb_cash_balance", "menu_cb_bank_balance"]
sources: ["frontend/account/tabs/transMenuMap.ts:1856", "frontend/account/tabs/transMenuMap.ts:1872", "frontend/account/transaction/transLayouts.ts:151", "frontend/account/transaction/transLayouts.ts:152", "frontend/account/transaction/transLayouts.ts:159", "backend/internal/application/process/trans.go:216", "backend/internal/application/process/service.go:1742", "backend/internal/application/process/trans_validate.go:45", "backend/internal/application/process/report_menu_cb.go:639", "backend/internal/application/process/report_menu_cb.go:780"]
---

# ยกมาเงินสด (602) / เงินฝากธนาคารยกมา (604)

## ใช้เมื่อไร
ใช้บันทึกยอดเงินสดและเงินฝากธนาคารตอนเริ่มใช้ระบบ
- 602 "ยกมาเงินสด" `menu_cb_cash_balance` (CAB, transMenuMap.ts:1856)
- 604 "เงินฝากธนาคารยกมา" `menu_cb_bank_balance` (BBL, transMenuMap.ts:1872) ค้นสมุดบัญชีจาก `erp_pass_book`

## trans_flag/ตาราง
- เก็บเฉพาะหัวเอกสารใน [[tbl-ic-trans]] ใช้ยอดที่หัวเอกสาร ไม่มีบรรทัด (`headerAmountFlags` trans.go:216 และ `HEADER_AMOUNT_FLAGS` transLayouts.ts:159)

## ฟิลด์/แท็บบนหน้าจอ
- 602: amount ไม่มีแท็บ (transLayouts.ts:151)
- 604: passBook, amount ไม่มีแท็บ (transLayouts.ts:152)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ไม่ลง GL เพราะไม่อยู่ใน `glRebuildTransFlags` (service.go:1742)

## เอกสารต้นทาง-ปลายทาง
- รายงานเคลื่อนไหวเงินสดนับ total_amount ของ 602 ที่ last_status = 0 เป็นเงินสดรับ (`cbmRunCashMovement` report_menu_cb.go:639)
- รายงานสมุดบัญชีธนาคารนับ total_amount ของ 604 เป็นยอดฝากเข้าสมุด pass_book_code ของหัวเอกสาร (`cbmPassbookCTE` report_menu_cb.go:780)

## ยกเลิก/แก้ไข
- ไม่มีคู่ยกเลิกใน `cancelOrigFlags` (doc_cancel.go:49)
- บันทึกต้องอยู่ในงวดบัญชีที่เปิด (`checkOpenPeriod` trans_validate.go:45)

## ข้อควรระวัง
- ยอดยกมานี้ไม่สร้าง GL ยอดในงบการเงินจึงไม่ได้มาจากเอกสารนี้

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1856` / `:1872` เมนู
- `frontend/account/transaction/transLayouts.ts:151` / `:152` FLAG_SPEC
- `backend/internal/application/process/trans.go:216` headerAmountFlags
- `backend/internal/application/process/service.go:1742` glRebuildTransFlags

## ดูเพิ่ม
- [[doc-ar-beginning-balance]] · [[doc-ap-beginning-balance]] · [[doc-cheque-received-balance]] · [[doctypes-overview]]
