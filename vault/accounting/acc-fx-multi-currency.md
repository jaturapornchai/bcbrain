---
title: "หลายสกุลเงินและกำไรขาดทุนจากอัตราแลกเปลี่ยน (Multi-Currency & FX Gain/Loss)"
tags: [accounting, fx, multi-currency, exchange-rate, gl]
aliases: ["หลายสกุลเงิน", "อัตราแลกเปลี่ยน", "exchange_rate", "สกุลเงินต่างประเทศ", "กำไรจากอัตราแลกเปลี่ยน", "ขาดทุนจากอัตราแลกเปลี่ยน", "lost_profit_exchange_amount", "multi_currency", "home_currency"]
sources: ["backend/internal/application/process/fx.go:18", "backend/internal/application/process/fx.go:37", "backend/internal/application/process/fx.go:43", "backend/internal/application/process/fx.go:63", "backend/internal/application/process/fx.go:129", "backend/internal/application/process/fx.go:145", "backend/internal/application/process/fx.go:150", "backend/internal/application/process/fx.go:179", "backend/internal/application/process/fx.go:223", "backend/internal/application/process/fx.go:252", "backend/internal/application/process/fx.go:267", "backend/internal/application/process/fx.go:311", "backend/internal/application/process/service.go:2159"]
---

# หลายสกุลเงินและกำไรขาดทุนจากอัตราแลกเปลี่ยน

เมื่อ `erp_option.multi_currency` เปิด เอกสารซื้อขายเก็บยอดสกุลเงินของเอกสารไว้ในคอลัมน์ `*_2` และยอดสกุลท้องถิ่นในคอลัมน์ปกติ การชำระหนี้ 19 / 239 คิดผลต่างระหว่างอัตราวันตั้งหนี้กับวันชำระเป็นกำไร/ขาดทุนจากอัตราแลกเปลี่ยน

## ทำงานอย่างไร

### เอกสารที่รองรับ (`fxTopFlags` fx.go:18)
- 2, 3, 4, 6, 7, 8, 12, 14, 16, 30-39, 44, 46, 48, 52, 87, 89, 91, 99, 101, 103, 144, 250-264, 310, 311, 315-317
- `transFx` (:43): ไม่ใช่ flag ในรายการหรือปิด multi-currency = ไม่มี fx; สกุลท้องถิ่นอ่านจาก `erp_option.home_currency` (:37)
- `checkFxMode` (:63): หน้าจอที่เปิดไว้กับค่าตั้งบริษัทไม่ตรงกัน = error "การตั้งค่าหลายสกุลเงินเปลี่ยนไป กรุณาเปิดเอกสารใหม่..."

### อัตราแลกเปลี่ยน (`newFxSetup` :129)
- รับที่ 6 ตำแหน่ง; ติดลบ หรือเป็น 0 ทั้งที่เป็นสกุลต่างประเทศ = error "กรุณาระบุอัตราแลกเปลี่ยนของสกุลเงิน %s มากกว่า 0"
- 0 กับสกุลท้องถิ่นหรือไม่ระบุสกุล = 1
- การปัด (`round` :145) = `bcRound` ที่ `item_amount_decimal` ตาม `round_type` ดู [[acc-rounding-decimal]]

### ยอดหัวเอกสาร (`headerTotals` :150)
1. คิด vatCalc รอบแรกด้วยยอดสกุลเอกสาร
2. แปลงผลรวมยอดมีภาษี / ยกเว้นภาษี และส่วนลด เป็นสกุลท้องถิ่นด้วย x rate แล้วปัด
3. คิด vatCalc รอบสองด้วยยอดสกุลท้องถิ่น ผลลัพธ์รอบสองเป็นยอดหลัก; ยอดสกุลเอกสารเก็บใน `total_value_2`, `total_discount_2`, `total_amount_2`
- `discount_word` = ส่วนลดสกุลท้องถิ่น ว่างเมื่อเป็น 0
- บรรทัด (`local` :179): price = price_2 x rate, sum_amount = sum_amount_2 x rate ไม่ปัดและไม่คิดใหม่ (ตาม C#)
- สูตร vatCalc ดู [[acc-transcalc-totals]]

### ชำระหนี้หลายสกุล 19 / 239 (`billFxFlags` :223)
- `refreshFxBills` (:311): server แทนที่คอลัมน์หนี้ทุกช่อง (อัตราเดิม ยอดคงเหลือ) ด้วยค่าจากเอกสารหนี้ ไม่เชื่อค่าจาก client
- `fxBill` (:267): ผู้ใช้คีย์แค่ `sum_pay_money_2` และ `exchange_rate`; อัตราต้อง > 0
- `fxBillPay` (:252): ยอดท้องถิ่น pay = round(pay2 x rate), ตามอัตราเดิม old = round(pay2 x rate_old), ผลต่าง lost = old - pay; ถ้าจ่ายครบยอดสกุลต่างประเทศ บวกเศษ (ยอดคงเหลือท้องถิ่น - old) เข้า lost เพื่อปิดหนี้พอดี
- ผลต่างรวมเก็บที่ `ap_ar_trans.lost_profit_exchange_amount`

### GL (service.go:2159)
- ลูกหนี้/เจ้าหนี้ลงด้วย ยอดชำระ + lost (ปัด 2)
- 239 ที่ lost > 0 (รับได้น้อยกว่า) หรือ 19 ที่ lost < 0 (จ่ายมากกว่า): Dr ขาดทุน 511030
- กรณีอื่นที่ lost ไม่เป็น 0: Cr กำไร 420040
- รหัสบัญชีผ่าน `resolveChartAccount` ไม่มีในผังบัญชีไปบัญชีพัก

## จุดเสี่ยง
- บรรทัดสินค้าเก็บ price / sum_amount ท้องถิ่นแบบไม่ปัด (อาจมีทศนิยมมากกว่า scale ของบริษัท) ขณะที่ยอดหัวปัดแล้ว ผลรวมบรรทัดจึงอาจไม่เท่ายอดหัว
- รหัสบัญชีกำไร/ขาดทุนจากอัตราแลกเปลี่ยน hardcode 420040 / 511030 ใน standard GL
- ไม่พบการปรับมูลค่าลูกหนี้/เจ้าหนี้คงค้างสิ้นงวด (revaluation) ในไฟล์กลุ่มนี้

## ที่มาในโค้ด
- `backend/internal/application/process/fx.go:18` fxTopFlags
- `backend/internal/application/process/fx.go:43` transFx
- `backend/internal/application/process/fx.go:129` newFxSetup
- `backend/internal/application/process/fx.go:150` headerTotals
- `backend/internal/application/process/fx.go:179` local
- `backend/internal/application/process/fx.go:252` fxBillPay
- `backend/internal/application/process/fx.go:311` refreshFxBills
- `backend/internal/application/process/service.go:2159` GL 19/239 และผลต่างอัตราแลกเปลี่ยน

## ดูเพิ่ม
- [[acc-payment-tab]]
- [[acc-transcalc-totals]]
- [[acc-gl-posting-standard]]
