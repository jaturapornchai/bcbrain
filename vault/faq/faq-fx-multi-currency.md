---
title: "เอกสารสกุลเงินต่างประเทศคำนวณและลงบัญชีกำไร/ขาดทุนอัตราแลกเปลี่ยนอย่างไร"
tags: [faq, fx, currency, ap, ar, gl]
aliases: ["หลายสกุลเงิน", "อัตราแลกเปลี่ยน", "กำไรขาดทุนจากอัตราแลกเปลี่ยน", "multi currency", "exchange rate", "lost_profit_exchange_amount", "trans_flag 19", "trans_flag 239", "420040", "511030"]
sources: ["backend/internal/application/process/fx.go:18", "backend/internal/application/process/fx.go:43", "backend/internal/application/process/fx.go:129", "backend/internal/application/process/fx.go:179", "backend/internal/application/process/fx.go:252", "backend/internal/application/process/docs.go:338", "backend/internal/application/process/service.go:2170"]
---
# เอกสารสกุลเงินต่างประเทศคำนวณและลงบัญชีกำไร/ขาดทุนอัตราแลกเปลี่ยนอย่างไร

**ตอบสั้น:** เมื่อเปิด multi-currency เอกสารเก็บยอดสกุลต่างประเทศในคอลัมน์ `*_2` แล้วคูณอัตราแลกเปลี่ยนเป็นเงินบาท ผลต่างอัตราเกิดตอนจ่ายชำระ (19) / รับชำระ (239) เท่านั้น ลงกำไร 420040 หรือขาดทุน 511030 ไม่พบโค้ดปรับมูลค่าสิ้นงวด (revaluation)

## รายละเอียด
ดู [[acc-fx-multi-currency]] และ [[term-currency-fx]]

**เปิดใช้งาน**
- `transFx` คืน nil ถ้าบริษัทไม่ได้เปิด `MultiCurrency` สกุลเงินหลักอ่านจาก `erp_option.home_currency` (`fxHomeSQL`)
- เอกสารที่มีสกุลเงินที่หัวเอกสาร = `fxTopFlags` (เช่น 2, 3, 4, 6, 12, 16, 44, 46, 48, 99, 144, 250, 260, 310, 315 ฯลฯ)
- `checkFxMode` ปฏิเสธ "การตั้งค่าหลายสกุลเงินเปลี่ยนไป กรุณาเปิดเอกสารใหม่" ถ้าจอเปิดไว้คนละโหมดกับค่าบริษัท

**อัตราแลกเปลี่ยน (`newFxSetup`)**
- อ่านอัตราที่ 6 ตำแหน่ง
- อัตราติดลบ หรือเป็น 0 กับสกุลต่างประเทศ → "กรุณาระบุอัตราแลกเปลี่ยนของสกุลเงิน %s มากกว่า 0"
- อัตรา 0 กับสกุลหลัก/ไม่ระบุสกุล → ใช้ 1

**แปลงเป็นเงินบาท**
- `local`: `price` = `price_2` × rate และ `sum_amount` = `sum_amount_2` × rate (บรรทัดนี้ไม่ปัด)
- `headerTotals`: คำนวณ VAT ฝั่งสกุลต่างประเทศรอบหนึ่ง แล้วคำนวณฝั่งบาทจากยอดที่แปลงและปัดด้วย `bcRound` ที่ `item_amount_decimal` ([[faq-rounding-decimal]]) ยอด `*_2` เก็บไว้ด้วย

**ผลต่างตอนชำระ (`billFxFlags` = 19, 239)**
- `fxBillPay`: pay = bcRound(ยอดจ่าย_2 × อัตราวันจ่าย), old = bcRound(ยอดจ่าย_2 × อัตราของหนี้), lost = old − pay
- ถ้าจ่ายปิดยอดค้างสกุลต่างประเทศครบ บวกเศษ (ยอดค้างบาท − old) เข้า lost ด้วย
- `fxBill` ตรวจ "เอกสาร %s: อัตราแลกเปลี่ยนต้องมากกว่า 0"; `refreshFxBills` อ่านคอลัมน์หนี้ใหม่จากเอกสารหนี้จริง
- รวม lost ลง `ap_ar_trans.lost_profit_exchange_amount` ([[tbl-ap-ar-trans]])

**GL เส้นมาตรฐานของ 19/239** (lost ปัด HALF_UP 2, debt = total + lost)
- 239 รับชำระ: Dr ช่องทางรับเงิน ([[faq-payment-tab-tenders]]) / Cr ลูกหนี้ เท่ากับ debt
- 19 จ่ายชำระ: Dr เจ้าหนี้ เท่ากับ debt / Cr ช่องทางจ่ายเงิน
- รับได้น้อยกว่าหนี้ หรือจ่ายมากกว่าหนี้ → Dr ขาดทุน 511030; กรณีกลับกัน → Cr กำไร 420040

## ข้อควรระวัง
- ไม่พบโค้ดปรับมูลค่าหนี้สกุลต่างประเทศคงค้างสิ้นงวด (ค้นคำ "revaluat" ไม่เจอ) ผลต่างรับรู้เฉพาะตอนชำระ
- รหัส 420040 / 511030 ส่งเข้า `resolveChartAccount` ถ้าไม่มีในผัง ระบบคืนรหัสนั้นตรงๆ ไม่ได้ตกบัญชีพัก 9999 ([[faq-gl-not-balanced]])
- ถ้าเอกสารมีรูปแบบ GL ระบบใช้รูปแบบแทนเส้นมาตรฐาน ([[faq-gl-template-doc-format]])

## ดูเพิ่ม
- [[acc-fx-multi-currency]]
- [[faq-ar-receipt-ap-payment-gl]]
- [[faq-payment-tab-tenders]]
- [[faq-rounding-decimal]]
- [[term-currency-fx]]

## ที่มาในโค้ด
- `backend/internal/application/process/fx.go:18` `fxTopFlags`; `:37` `fxHomeSQL`
- `backend/internal/application/process/fx.go:43` `transFx`; `:63` `checkFxMode`
- `backend/internal/application/process/fx.go:129` `newFxSetup` (อัตรา 6 ตำแหน่ง)
- `backend/internal/application/process/fx.go:150` `headerTotals`; `:179` `local`
- `backend/internal/application/process/fx.go:223` `billFxFlags`; `:252` `fxBillPay`; `:267` `fxBill`; `:311` `refreshFxBills`
- `backend/internal/application/process/docs.go:338` UPDATE `lost_profit_exchange_amount`
- `backend/internal/application/process/service.go:2170` GL 19/239; `:2188` ขาดทุน 511030; `:2191` กำไร 420040
