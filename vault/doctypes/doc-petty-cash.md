---
title: "วงเงินสดย่อย (Petty Cash)"
tags: [doctypes, cash-bank]
aliases: ["trans_flag 300", "trans_flag 301", "คืน/ลด วงเงินสดย่อย", "รับ/เพิ่ม วงเงินสดย่อย", "PCD", "PRM", "menu_cb_petty_cash_receive", "menu_cb_petty_return"]
sources: ["frontend/account/tabs/transMenuMap.ts:1798", "frontend/account/tabs/transMenuMap.ts:1813", "frontend/account/transaction/transLayouts.ts:126", "frontend/account/transaction/transLayouts.ts:127", "backend/internal/application/process/service.go:2218", "backend/internal/application/process/service.go:2219", "backend/internal/application/process/service.go:2226", "backend/internal/application/process/transcalc.go:22", "backend/internal/application/process/transcalc.go:17", "backend/internal/application/process/pay_check.go:31", "backend/internal/application/process/gl_template.go:202", "backend/internal/application/process/pay_check.go:36", "backend/internal/application/process/doc_cancel.go:55"]
---

# วงเงินสดย่อย (300 / 301)

## ใช้เมื่อไร
- 300 "คืน/ลด วงเงินสดย่อย" `menu_cb_petty_cash_receive` (transMenuMap.ts:1798)
- 301 "รับ/เพิ่ม วงเงินสดย่อย" `menu_cb_petty_return` (transMenuMap.ts:1813)

## trans_flag/ตาราง
- เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]] โดยบรรทัดแรกเป็นรหัสเงินสดย่อย
- แท็บชำระเขียนลง [[tbl-cb-trans]]
- calc_flag ของ 300 = −1 (transcalc.go:22) และ 301 = +1 (transcalc.go:17) ระบบตั้งให้ตาม `calcFlagByTransFlag` ไม่ใช่ค่า `calcFlag: 0` ในเมนู

## ฟิลด์/แท็บบนหน้าจอ
- ไม่มีช่องหัวเอกสารพิเศษ มีแท็บ pay, gl (transLayouts.ts:126, :127)
- มีแท็บชำระเสมอ เพราะไม่อยู่ใน `payInquiryFlags` (pay_check.go:31) และ `payTabEnabled` คืน true ให้ flag ที่ไม่อยู่ในชุดนี้ (pay_check.go:36)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี (ไม่อยู่ใน transVatTabs / transWhtParty)

## การลงบัญชี
ใช้ standard GL `case 300, 301` (service.go:2218) บัญชีเงินสดย่อยเริ่มจากผังบัญชีตัวแรกที่มีใน 1111-01/1112/1111 (service.go:2219) แล้วแทนด้วย `cb_petty_cash.chart_of_account` ของรหัสบรรทัดแรก ถ้ามีค่า (`glSQLPetty` gl_template.go:202, service.go:2220-2225) ทิศทาง Dr/Cr อยู่ที่ service.go:2226-2229
| flag | Dr | Cr |
|---|---|---|
| 300 | เงินสดย่อย ยอดรวม | เงินตามแท็บชำระ `payTenders(false)` |
| 301 | เงินตามแท็บชำระ `payTenders(true)` | เงินสดย่อย ยอดรวม |

## เอกสารต้นทาง-ปลายทาง
ไม่มี `refTransFlags` ในเมนูทั้งสอง (transMenuMap.ts:1798, :1813)

## ยกเลิก/แก้ไข
- ยกเลิก 300 ด้วย 302 และยกเลิก 301 ด้วย 303 (doc_cancel.go:55)

## ข้อควรระวัง
- ในโค้ด GL comment เรียก 300 ว่า "withdraw" (เบิก) และ 301 ว่า "return" (คืน) (service.go:2218) และลงบัญชีตามนั้น: 300 Dr เงินสดย่อย / Cr เงินตามแท็บชำระ (service.go:2226-2227), 301 Dr เงินตามแท็บชำระ / Cr เงินสดย่อย (service.go:2228-2229)
- ชื่อเมนูกลับด้านกับ GL: 300 ชื่อ "คืน/ลด วงเงินสดย่อย" แต่ GL เพิ่มยอดเงินสดย่อย ส่วน 301 ชื่อ "รับ/เพิ่ม วงเงินสดย่อย" แต่ GL ลดยอดเงินสดย่อย (transMenuMap.ts:1799, :1814)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1798` / `:1813` เมนู
- `frontend/account/transaction/transLayouts.ts:126` / `:127` FLAG_SPEC
- `backend/internal/application/process/service.go:2218-2229` GL `case 300, 301`
- `backend/internal/application/process/transcalc.go:17` / `:22` calc_flag
- `backend/internal/application/process/gl_template.go:202` glSQLPetty
- `backend/internal/application/process/doc_cancel.go:55` ยกเลิก 302/303

## ดูเพิ่ม
- [[acc-payment-tab]] · [[acc-gl-posting-standard]] · [[doctypes-overview]]
