---
title: "บันทึกฝากเงิน / บันทึกถอนเงิน (Bank Deposit / Withdrawal)"
tags: [doctypes, cash-bank]
aliases: ["trans_flag 401", "trans_flag 402", "บันทึกฝากเงิน", "บันทึกถอนเงิน", "DM", "WM", "menu_cb_cash_payin", "menu_cb_cash_withdraw"]
sources: ["frontend/account/tabs/transMenuMap.ts:1887", "frontend/account/tabs/transMenuMap.ts:1902", "frontend/account/transaction/transLayouts.ts:133", "frontend/account/transaction/transLayouts.ts:134", "backend/internal/application/process/service.go:2064", "backend/internal/application/process/service.go:1850", "backend/internal/application/process/doc_cancel.go:56"]
---

# บันทึกฝากเงิน (401) / บันทึกถอนเงิน (402)

## ใช้เมื่อไร
- 401 "บันทึกฝากเงิน" ใช้นำเงินสดเข้าบัญชีธนาคาร (transMenuMap.ts:1887)
- 402 "บันทึกถอนเงิน" ใช้ถอนเงินจากธนาคารเป็นเงินสด (transMenuMap.ts:1902)

## trans_flag/ตาราง
- เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]] โดย item_code ของบรรทัดคือรหัสสมุดบัญชีธนาคาร และ sum_amount คือยอด
- calc_flag ของ 401 = −1 และ 402 = +1 (transcalc.go:14)

## ฟิลด์/แท็บบนหน้าจอ
- ไม่มีช่องหัวเอกสารพิเศษ มีแท็บ pay, gl (transLayouts.ts:133, :134)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ใช้ standard GL (service.go:2064)
- ฝั่งธนาคารแตกตามบรรทัดสมุดบัญชี โดยใช้บัญชีจาก `glSQLPassBook` ถ้ายอดรวมบรรทัดเท่ากับยอดเอกสาร มิฉะนั้นใช้บรรทัดเดียวด้วยบัญชี 1112/1113/1111
- ฝั่งเงินสดใช้บัญชี 1111/1110/1100 ด้วยยอด `money()` คือยอดรวมบวกหรือลบยอดรายได้/ค่าใช้จ่ายอื่นในแท็บชำระ (service.go:1850)

| flag | Dr | Cr |
|---|---|---|
| 401 | ธนาคาร (ตามสมุดบัญชี) | เงินสด |
| 402 | เงินสด | ธนาคาร (ตามสมุดบัญชี) |

## เอกสารต้นทาง-ปลายทาง
(ไม่พบในโค้ด)

## ยกเลิก/แก้ไข
- ยกเลิก 401 ด้วย 403 และยกเลิก 402 ด้วย 404 (doc_cancel.go:56)

## ข้อควรระวัง
- ถ้ายอดบรรทัดสมุดบัญชีรวมไม่เท่ากับยอดเอกสาร GL จะไม่ใช้บัญชีของสมุดบัญชีเลย แต่ใช้บัญชีธนาคารตั้งต้นแทน

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1887` / `:1902` เมนู
- `frontend/account/transaction/transLayouts.ts:133` / `:134` FLAG_SPEC
- `backend/internal/application/process/service.go:2064` GL
- `backend/internal/application/process/doc_cancel.go:56` ยกเลิก 403/404

## ดูเพิ่ม
- [[doc-bank-transfer]] · [[acc-gl-posting-standard]] · [[doctypes-overview]]
