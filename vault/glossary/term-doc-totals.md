---
title: "ยอดรวมท้ายเอกสาร (document totals / total_value / total_amount)"
tags: [glossary, document, money, totals]
aliases: ["รวมมูลค่าสินค้า", "total_value", "ส่วนลดก่อนภาษี", "ส่วนลดท้ายบิล", "discount_word", "มูลค่าส่วนลด", "total_discount", "หักเงินมัดจำ", "advance_amount", "ยอดเงินก่อนภาษี", "total_before_vat", "ยอดภาษีมูลค่าเพิ่ม", "total_vat_value", "มูลค่าหลังคิดภาษี", "total_after_vat", "มูลค่ายกเว้นภาษี", "total_except_vat", "รวมมูลค่าทั้งสิ้น", "total_amount", "มูลค่าสุทธิ", "ยอดสุทธิ", "transcalc", "TransCalc"]
sources: ["frontend/account/transaction/TransBottomPanel.tsx:332", "frontend/account/transaction/TransBottomPanel.tsx:338", "frontend/account/transaction/TransBottomPanel.tsx:349", "frontend/account/transaction/TransBottomPanel.tsx:355", "frontend/account/transaction/TransBottomPanel.tsx:366", "frontend/account/transaction/TransBottomPanel.tsx:372", "frontend/account/transaction/TransBottomPanel.tsx:378", "frontend/account/transaction/TransBottomPanel.tsx:384", "frontend/account/transaction/TransBottomPanel.tsx:389", "frontend/account/transaction/TransTopForm.tsx:277", "backend/internal/application/process/trans.go:664", "backend/internal/application/process/trans.go:775", "backend/internal/application/process/transcalc.go:73", "backend/internal/application/process/transcalc.go:137", "backend/internal/application/process/trans_tax.go:74"]
---

# ยอดรวมท้ายเอกสาร

## ในระบบนี้คืออะไร
แผงล่างของจอเอกสาร (`TransBottomPanel.tsx`) แสดงยอดรวมที่ **backend คำนวณเอง** ไม่ใช้ค่าที่ client ส่งมา จอเรียก `/api/process/transgrid/totals` (`query-client.ts:441-445`, `UniversalTransScreen.tsx:828`) ซึ่งเข้า `TransTotals` (`trans.go:756-773`) ตอนบันทึกใช้ `transTotals` ชุดเดียวกัน (`trans.go:775-796`, เรียกที่ `:841`) คำนวณด้วย `headerTotals`/`companyHeaderTotals` และ `vatCalc` (`transcalc.go:73-106`, `:137`) ผลเก็บที่หัว `ic_trans` (`insertTransSQL`, `trans.go:664-665`, `:673`; ค่าที่ผูก `:899-900`, `:908`)

## ป้ายบนจอ → คอลัมน์
| ป้ายบนจอ | ตัวแปร UI | คอลัมน์ `ic_trans` |
|---|---|---|
| รวมมูลค่าสินค้า (`:332`) | `totalValue` | `total_value` |
| ส่วนลดก่อนภาษี (`:338`) | `discountWord` | `discount_word` (ข้อความ เช่น "5%" หรือ "10") |
| มูลค่าส่วนลด (`:349`) | `totalDiscount` | `total_discount` |
| หักเงินมัดจำ (`:355`) | `advanceAmount` | `advance_amount` |
| ยอดเงินก่อนภาษี (`:366`) | `totalBeforeVat` | `total_before_vat` |
| ยอดภาษีมูลค่าเพิ่ม (`:372`) | `totalVatValue` | `total_vat_value` |
| มูลค่าหลังคิดภาษี (`:378`) | `afterVat` | `total_after_vat` |
| มูลค่ายกเว้นภาษี (`:384`) | `totalExceptVat` | `total_except_vat` |
| รวมมูลค่าทั้งสิ้น (`:389`) | `totalAmount` | `total_amount` |
- ตารางข้างบนแสดงเมื่อจอมีแผง VAT/ส่วนลด (`showVatAndDiscount`, `TransBottomPanel.tsx:316`; ส่งค่า `layout.showVatType` ที่ `UniversalTransScreen.tsx:4098`) จอที่ไม่มีแผงนี้ เช่น จอย้ายคลังและจอเงินสด/ธนาคารส่วนใหญ่ แสดงเฉพาะ "รวมมูลค่าทั้งสิ้น" (`TransBottomPanel.tsx:396-409`) และฝั่ง backend ไม่คิดส่วนลด ภาษี และมัดจำให้จอเหล่านี้ (`showsVatType`, `transcalc.go:32-42`)
- ส่วนหัวมีช่อง "มูลค่าสุทธิ" (`TransTopForm.tsx:274-287`, ป้าย `:277`) สำหรับเอกสารยกมาที่กรอกยอดที่หัวโดยไม่มีรายการ: ตั้งหนี้ เพิ่มหนี้ ลดหนี้ยกมา flag 81, 83, 85, 93, 95, 97, 602, 604 (`headerAmountFlags`, `trans.go:216`) backend เก็บ `total_amount` ตามที่กรอก (ต้องมากกว่า 0) และตั้งยอดอื่นเป็น 0 (`trans.go:849-856`)
- ถ้าใช้หลายสกุลเงิน จะมีแถว "มูลค่าสินค้า (สกุลเงิน)", "มูลค่าส่วนลด (สกุลเงิน)", "มูลค่าสุทธิ (สกุลเงิน)" เพิ่ม (`TransBottomPanel.tsx:103-129`) ดู [[term-currency-fx]]
- ในบรรทัดรายการ: `price`, `price_exclude_vat`, `discount`, `discount_amount`, `sum_amount`, `sum_amount_exclude_vat`, `total_vat_value` (`insertTransDetailSQL`, `trans.go:697-699`, `:706`)

## ข้อควรระวัง
- ยอดรวมของหัวเอกสารปัดตามตัวเลือกบริษัท: จำนวนทศนิยมจาก `erp_option.item_amount_decimal` (ถ้าอยู่นอก 0-6 ใช้ 2) และชนิดการปัดจาก `round_type` (`loadGridOptions`, `grid_calc.go:63-70`, `:82-84`, `:99-101`) ปัดที่ `vatCalc` (`transcalc.go:138`) และแสดงอย่างน้อย 2 ตำแหน่ง (`:213`) วิธีคิด VAT เมื่อมีส่วนลดท้ายบิลขึ้นกับ `erp_option.discout_type` และ `discount_vat_type` (`grid_calc.go:92-93`, `transcalc.go:59-64`)
- แถว VAT ที่ระบบสร้างจากหัวเอกสารใช้ยอดรวม = ยอดก่อนภาษี + ภาษี โดยปัดแต่ละตัวครึ่งขึ้นที่ 2 ตำแหน่ง (`RoundHalfUp`, `defaultTransVat`, `trans_tax.go:74-80`) ดู [[acc-rounding-decimal]]
- ค่าเงินทั้งหมดเป็น decimal string ห้ามใช้ float ดู [[fe-numeric-money]]
- "ส่วนลดก่อนภาษี" เป็นข้อความสูตรส่วนลด ไม่ใช่ตัวเลข ดู [[term-price-discount]]

## ลิงก์
[[acc-transcalc-totals]] · [[term-vat-type]] · [[term-deposit-advance]] · [[tbl-ic-trans]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/account/transaction/TransBottomPanel.tsx:103-129`, `:316`, `:332-389`, `:396-409`
- `frontend/account/transaction/UniversalTransScreen.tsx:828`, `:4098`
- `frontend/src/lib/query-client.ts:441-445`
- `frontend/account/transaction/TransTopForm.tsx:274-287`
- `backend/internal/application/process/trans.go:216`, `:664-665`, `:673`, `:697-706`, `:756-796`, `:841`, `:849-856`, `:899-900`, `:908`
- `backend/internal/application/process/transcalc.go:32-42`, `:59-64`, `:73-106`, `:137-138`, `:213`
- `backend/internal/application/process/grid_calc.go:63-71`, `:92-93`, `:99-106`
- `backend/internal/application/process/trans_tax.go:74-80`
