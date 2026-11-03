---
title: "สกุลเงิน และอัตราแลกเปลี่ยน (currency / exchange_rate / multi_currency)"
tags: [glossary, fx, currency]
aliases: ["สกุลเงิน", "สกุลเงินหลัก", "หลายสกุลเงิน", "ระบบหลายสกุลเงิน", "เงินตราต่างประเทศ", "อัตราแลกเปลี่ยน", "อัตราแลกเปลี่ยนปัจจุบัน", "กำหนดสกุลเงิน", "กำไรขาดทุนจากอัตราแลกเปลี่ยน", "Multi-Currency", "FX", "currency_code", "currencyCode", "exchange_rate", "exchangeRate", "exchange_rate_present", "home_currency", "multi_currency", "erp_currency", "price_2", "sum_amount_2", "total_value_2", "total_discount_2", "total_amount_2", "discount_word_2", "lost_profit_exchange_amount", "fxTopFlags", "menu_setup_currency"]
sources: ["backend/internal/application/process/trans.go:142", "backend/internal/application/process/trans.go:143", "backend/internal/application/process/fx.go:18", "backend/internal/application/process/fx.go:23", "backend/internal/application/process/fx.go:25", "backend/internal/application/process/fx.go:37", "backend/internal/application/process/fx.go:43", "backend/internal/application/process/fx.go:63", "backend/internal/application/process/fx.go:81", "backend/internal/application/process/fx.go:115", "backend/internal/application/process/fx.go:129", "backend/internal/application/process/fx.go:150", "backend/internal/application/process/fx.go:179", "backend/internal/application/process/fx.go:188", "backend/internal/application/process/fx.go:223", "backend/internal/application/process/fx.go:252", "backend/internal/application/process/fx.go:267", "backend/internal/application/process/docs.go:573", "frontend/account/transaction/TransBottomPanel.tsx:106", "frontend/account/transaction/TransBottomPanel.tsx:138", "frontend/account/transaction/TransBottomPanel.tsx:164", "frontend/src/config/schemas/erpOption/tab1System.ts:71", "frontend/src/config/schemas/erpOption/tab1System.ts:76", "frontend/src/config/bcMenu.json:56"]
---

# สกุลเงิน / อัตราแลกเปลี่ยน

## ในระบบนี้คืออะไร
- เปิดใช้ด้วย `erp_option.multi_currency` "ใช้ระบบหลายสกุลเงิน (Multi-Currency)" และกำหนด `home_currency` "สกุลเงินหลัก" (`tab1System.ts:71-77`) ถ้าบริษัทไม่ได้เปิด ระบบจะบันทึกแบบสกุลเงินเดียว ไม่คำนวณคอลัมน์ `*_2` (`transFx`, `fx.go:43-60`)
- master สกุลเงินคือ `erp_currency` บนจอ "กำหนดสกุลเงิน" (`menu_setup_currency`, bcMenu.json:56-57) เมื่อออกจากช่องสกุลเงินที่เปลี่ยนค่า ระบบจะดึงอัตราปัจจุบันจาก `exchange_rate_present` (`TransBottomPanel.tsx:144-148`, `TransFxInfo`, `fx.go:81-89`, `:115`)
- หัวเอกสารเก็บ `currency_code` และ `exchange_rate` (`CurrencyCode`/`ExchangeRate`, `trans.go:142-143`) ถ้าไม่ระบุสกุลเงินหรือเป็นสกุลหลัก และอัตราว่างหรือเป็น 0 ระบบถือว่าเท่ากับ 1 แต่สกุลต่างประเทศต้องระบุอัตราเกิน 0 ไม่เช่นนั้นบันทึกไม่ได้ (`newFxSetup`, `fx.go:129-143`; ค่าอัตราเก็บใน `fxSetup.rate`, `:25`)

## เอกสารที่มีช่องสกุลเงิน (`fxTopFlags`, `fx.go:18-19`)
2, 3, 4, 6, 7, 8, 12, 14, 16, 310, 311, 315, 316, 317, 30, 31, 32, 34, 38, 39, 36, 37, 52, 44, 144, 46, 48, 87, 89, 91, 99, 101, 103, 250, 252, 254, 260, 262, 264 ดูชื่อเอกสารได้ที่ [[term-trans-flag]]

## คอลัมน์คู่ (สกุลเอกสาร ↔ เงินบาท)
| สกุลเงินของเอกสาร (`*_2`) | เงินสกุลหลัก | ป้ายบนจอ (`TransBottomPanel.tsx`) |
|---|---|---|
| `ic_trans_detail.price_2`, `sum_amount_2` | `price`, `sum_amount` | ตารางสินค้า |
| `ic_trans.total_value_2` | `total_value` | มูลค่าสินค้า (สกุลเงิน) (`:117`) |
| `ic_trans.total_discount_2`, `discount_word_2` | `total_discount`, `discount_word` | ส่วนลด (สกุลเงิน) / มูลค่าส่วนลด (สกุลเงิน) (`:106`, `:121`) |
| `ic_trans.total_amount_2` | `total_amount` | มูลค่าสุทธิ (สกุลเงิน) (`:125`) |
- ช่อง "สกุลเงิน:" (`:138`) และ "อัตราแลกเปลี่ยน:" (`:164`)
- ผู้ใช้คีย์ตารางเป็นสกุลเงินของเอกสาร แล้วระบบคำนวณ `price = price_2 × rate` และ `sum_amount = sum_amount_2 × rate` **โดยไม่ปัดเศษและไม่คำนวณใหม่** (`local`, `fx.go:179-183`) จากนั้นเขียนยอด `*_2` ลงหัวเอกสาร (`:188`)
- ยอดรวมหัวเอกสารคิดตามสกุลเงินของเอกสารก่อน แล้วแปลงยอดรวมด้วยอัตราแลกเปลี่ยนและปัดตามตัวเลือกบริษัทเป็นยอดสกุลหลัก (`headerTotals`, `fx.go:150-174`)
- ในเอกสารรับชำระ/จ่ายชำระหนี้ที่เปิดหลายสกุลเงิน (`trans_flag` 19 และ 239, `billFxFlags`, `fx.go:223`) ระบบคำนวณ `sum_pay_money` = ยอดชำระตามสกุลเงิน × อัตราวันนี้ และ `lost_profit_exchange_amount` (กำไรขาดทุนจากอัตราแลกเปลี่ยน) เทียบกับอัตราเดิมของหนี้ ของแต่ละบิลตอนบันทึก (`fxBillPay`, `fx.go:252-260`; `fxBill`, `:267-295`; เขียนลง `ap_ar_trans_detail` ที่ `docs.go:567-574`)

## ข้อควรระวัง
- จอที่ส่งโหมดสกุลเงินไม่ตรงกับ `erp_option` จะถูกปฏิเสธ เพื่อกันการบันทึกราคาบาทเป็นราคาต่างประเทศหรือกลับกัน (`checkFxMode`, `fx.go:63-68`)
- ค่าทุกตัวเป็นสตริงทศนิยมและคำนวณด้วย `big.Rat` ดู [[acc-rounding-decimal]]

## ลิงก์
[[acc-fx-multi-currency]] · [[term-doc-totals]] · [[term-ap-ar-balance]] · [[glossary-overview]]

## ที่มาในโค้ด
- `backend/internal/application/process/trans.go:142-143`
- `backend/internal/application/process/fx.go:18-19`, `:23-26`, `:37`, `:43-60`, `:63-68`, `:81-89`, `:115`, `:129-143`, `:150-174`, `:179-183`, `:187-208`, `:223`, `:252-260`, `:267-295`
- `backend/internal/application/process/docs.go:567-574`
- `frontend/account/transaction/TransBottomPanel.tsx:106-125`, `:138`, `:144-148`, `:164`
- `frontend/src/config/schemas/erpOption/tab1System.ts:71-77`
- `frontend/src/config/bcMenu.json:56-57`
