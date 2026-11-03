---
title: "สกุลเงิน และอัตราแลกเปลี่ยน (currency / exchange_rate / multi_currency)"
tags: [glossary, fx, currency]
aliases: ["สกุลเงิน", "สกุลเงินหลัก", "หลายสกุลเงิน", "ระบบหลายสกุลเงิน", "เงินตราต่างประเทศ", "อัตราแลกเปลี่ยน", "อัตราแลกเปลี่ยนปัจจุบัน", "กำหนดสกุลเงิน", "กำไรขาดทุนจากอัตราแลกเปลี่ยน", "Multi-Currency", "FX", "currency_code", "currencyCode", "exchange_rate", "exchangeRate", "exchange_rate_present", "home_currency", "multi_currency", "erp_currency", "price_2", "sum_amount_2", "total_value_2", "total_discount_2", "total_amount_2", "discount_word_2", "lost_profit_exchange_amount", "fxTopFlags", "menu_setup_currency"]
sources: ["backend/internal/application/process/trans.go:142", "backend/internal/application/process/trans.go:143", "backend/internal/application/process/fx.go:16", "backend/internal/application/process/fx.go:21", "backend/internal/application/process/fx.go:25", "backend/internal/application/process/fx.go:36", "backend/internal/application/process/fx.go:39", "backend/internal/application/process/fx.go:80", "backend/internal/application/process/fx.go:115", "backend/internal/application/process/fx.go:176", "backend/internal/application/process/fx.go:188", "backend/internal/application/process/docs.go:512", "frontend/account/transaction/TransBottomPanel.tsx:104", "frontend/account/transaction/TransBottomPanel.tsx:136", "frontend/account/transaction/TransBottomPanel.tsx:162", "frontend/src/config/schemas/erpOption/tab1System.ts:71", "frontend/src/config/schemas/erpOption/tab1System.ts:76", "frontend/src/config/bcMenu.json:55"]
---

# สกุลเงิน / อัตราแลกเปลี่ยน

## ในระบบนี้คืออะไร
- เปิดใช้ด้วย `erp_option.multi_currency` "ใช้ระบบหลายสกุลเงิน (Multi-Currency)" และกำหนด `home_currency` "สกุลเงินหลัก" (`tab1System.ts:71-77`) ถ้าบริษัทไม่ได้เปิด ระบบจะบันทึกแบบสกุลเงินเดียวเหมือนเดิม (`fx.go:39-42`)
- master สกุลเงินคือ `erp_currency` บนจอ "กำหนดสกุลเงิน" (`menu_setup_currency`, bcMenu.json:55) เมื่อออกจากช่องสกุลเงิน ระบบจะดึงอัตราปัจจุบันจาก `exchange_rate_present` (`fx.go:80`, `:115`)
- หัวเอกสารเก็บ `currency_code` และ `exchange_rate` (`CurrencyCode`/`ExchangeRate`, `trans.go:142-143`) ถ้าอัตราว่างหรือเป็นสกุลหลัก ระบบถือว่าเท่ากับ 1 (`fx.go:25`)

## เอกสารที่มีช่องสกุลเงิน (`fxTopFlags`, `fx.go:16-19`)
2, 3, 4, 6, 7, 8, 12, 14, 16, 310, 311, 315, 316, 317, 30, 31, 32, 34, 38, 39, 36, 37, 52, 44, 144, 46, 48, 87, 89, 91, 99, 101, 103, 250, 252, 254, 260, 262, 264 ดูชื่อเอกสารได้ที่ [[term-trans-flag]]

## คอลัมน์คู่ (สกุลเอกสาร ↔ เงินบาท)
| สกุลเงินของเอกสาร (`*_2`) | เงินสกุลหลัก | ป้ายบนจอ (`TransBottomPanel.tsx`) |
|---|---|---|
| `ic_trans_detail.price_2`, `sum_amount_2` | `price`, `sum_amount` | ตารางสินค้า |
| `ic_trans.total_value_2` | `total_value` | มูลค่าสินค้า (สกุลเงิน) (`:115`) |
| `ic_trans.total_discount_2`, `discount_word_2` | `total_discount`, `discount_word` | ส่วนลด (สกุลเงิน) / มูลค่าส่วนลด (สกุลเงิน) (`:104`, `:119`) |
| `ic_trans.total_amount_2` | `total_amount` | มูลค่าสุทธิ (สกุลเงิน) (`:123`) |
- ช่อง "สกุลเงิน:" (`:136`) และ "อัตราแลกเปลี่ยน:" (`:162`)
- ผู้ใช้คีย์ตารางเป็นสกุลเงินของเอกสาร แล้วระบบคำนวณ `price = price_2 × rate` และ `sum_amount = sum_amount_2 × rate` **โดยไม่ปัดเศษและไม่คำนวณใหม่** (`fx.go:176-178`) จากนั้นเขียนยอด `*_2` ลงหัวเอกสาร (`:188`)
- ในเอกสารชำระหนี้ ระบบคำนวณ `sum_pay_money` และ `lost_profit_exchange_amount` (กำไรขาดทุนจากอัตราแลกเปลี่ยน) ของแต่ละบิลตอนบันทึก (`docs.go:512`, `:531`)

## ข้อควรระวัง
- จอที่ส่งโหมดสกุลเงินไม่ตรงกับ `erp_option` จะถูกปฏิเสธ เพื่อกันการบันทึกราคาบาทเป็นราคาต่างประเทศหรือกลับกัน (`fx.go:40-42`)
- ค่าทุกตัวเป็นสตริงทศนิยมและคำนวณด้วย `big.Rat` ดู [[acc-rounding-decimal]]

## ลิงก์
[[acc-fx-multi-currency]] · [[term-doc-totals]] · [[term-ap-ar-balance]] · [[glossary-overview]]

## ที่มาในโค้ด
- `backend/internal/application/process/trans.go:142-143`
- `backend/internal/application/process/fx.go:16-42`, `:80-84`, `:115`, `:176-188`
- `backend/internal/application/process/docs.go:512`, `:531`
- `frontend/account/transaction/TransBottomPanel.tsx:104-123`, `:136`, `:162`
- `frontend/src/config/schemas/erpOption/tab1System.ts:71-77`
- `frontend/src/config/bcMenu.json:55`
