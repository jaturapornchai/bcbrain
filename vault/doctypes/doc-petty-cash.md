---
title: "วงเงินสดย่อย (Petty Cash)"
tags: [doctypes, cash-bank]
aliases: ["trans_flag 300", "trans_flag 301", "คืน/ลด วงเงินสดย่อย", "รับ/เพิ่ม วงเงินสดย่อย", "PCD", "PRM", "menu_cb_petty_cash_receive", "menu_cb_petty_return"]
sources: ["frontend/account/tabs/transMenuMap.ts:1798", "frontend/account/tabs/transMenuMap.ts:1813", "frontend/account/transaction/transLayouts.ts:126", "frontend/account/transaction/transLayouts.ts:127", "backend/internal/application/process/service.go:2207", "backend/internal/application/process/gl_template.go:202", "backend/internal/application/process/pay_check.go:36", "backend/internal/application/process/doc_cancel.go:55"]
---

# วงเงินสดย่อย (300 / 301)

## ใช้เมื่อไร
- 300 "คืน/ลด วงเงินสดย่อย" `menu_cb_petty_cash_receive` (transMenuMap.ts:1798)
- 301 "รับ/เพิ่ม วงเงินสดย่อย" `menu_cb_petty_return` (transMenuMap.ts:1813)

## trans_flag/ตาราง
- เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]] โดยบรรทัดแรกเป็นรหัสเงินสดย่อย
- แท็บชำระเขียนลง [[tbl-cb-trans]]
- calc_flag ของ 300 = −1 และ 301 = +1 (transcalc.go:14)

## ฟิลด์/แท็บบนหน้าจอ
- ไม่มีช่องหัวเอกสารพิเศษ มีแท็บ pay, gl (transLayouts.ts:126, :127)
- มีแท็บชำระเสมอ เพราะไม่อยู่ใน `payInquiryFlags` (pay_check.go:36)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี (ไม่อยู่ใน transVatTabs / transWhtParty)

## การลงบัญชี
ใช้ standard GL (service.go:2207) บัญชีเงินสดย่อยมาจาก `cb_petty_cash.chart_of_account` ของรหัสบรรทัดแรก (`glSQLPetty` gl_template.go:202) ถ้าไม่พบใช้ 1111-01/1112/1111
| flag | Dr | Cr |
|---|---|---|
| 300 | เงินสดย่อย ยอดรวม | เงินตามแท็บชำระ `payTenders(false)` |
| 301 | เงินตามแท็บชำระ `payTenders(true)` | เงินสดย่อย ยอดรวม |

## เอกสารต้นทาง-ปลายทาง
(ไม่พบในโค้ด)

## ยกเลิก/แก้ไข
- ยกเลิก 300 ด้วย 302 และยกเลิก 301 ด้วย 303 (doc_cancel.go:55)

## ข้อควรระวัง
- comment ใน GL เรียก 300 ว่า "withdraw" และ 301 ว่า "return" (service.go:2207) แต่ชื่อเมนูของ 300 คือ "คืน/ลด" และ 301 คือ "รับ/เพิ่ม" ซึ่งทิศทาง Dr/Cr กับชื่อเมนูดูสวนกัน ควรตรวจกับ C# ก่อนใช้งาน

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1798` / `:1813` เมนู
- `frontend/account/transaction/transLayouts.ts:126` / `:127` FLAG_SPEC
- `backend/internal/application/process/service.go:2207` GL
- `backend/internal/application/process/gl_template.go:202` glSQLPetty
- `backend/internal/application/process/doc_cancel.go:55` ยกเลิก 302/303

## ดูเพิ่ม
- [[acc-payment-tab]] · [[acc-gl-posting-standard]] · [[doctypes-overview]]
