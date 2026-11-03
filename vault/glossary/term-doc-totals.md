---
title: "ยอดรวมท้ายเอกสาร (document totals / total_value / total_amount)"
tags: [glossary, document, money, totals]
aliases: ["รวมมูลค่าสินค้า", "total_value", "ส่วนลดก่อนภาษี", "ส่วนลดท้ายบิล", "discount_word", "มูลค่าส่วนลด", "total_discount", "หักเงินมัดจำ", "advance_amount", "ยอดเงินก่อนภาษี", "total_before_vat", "ยอดภาษีมูลค่าเพิ่ม", "total_vat_value", "มูลค่าหลังคิดภาษี", "total_after_vat", "มูลค่ายกเว้นภาษี", "total_except_vat", "รวมมูลค่าทั้งสิ้น", "total_amount", "มูลค่าสุทธิ", "ยอดสุทธิ", "transcalc", "TransCalc"]
sources: ["frontend/account/transaction/TransBottomPanel.tsx:330", "frontend/account/transaction/TransBottomPanel.tsx:336", "frontend/account/transaction/TransBottomPanel.tsx:347", "frontend/account/transaction/TransBottomPanel.tsx:353", "frontend/account/transaction/TransBottomPanel.tsx:364", "frontend/account/transaction/TransBottomPanel.tsx:370", "frontend/account/transaction/TransBottomPanel.tsx:376", "frontend/account/transaction/TransBottomPanel.tsx:382", "frontend/account/transaction/TransBottomPanel.tsx:387", "frontend/account/transaction/TransTopForm.tsx:275", "backend/internal/application/process/trans.go:657", "backend/internal/application/process/transcalc.go:9", "backend/internal/application/process/trans_tax.go:66"]
---

# ยอดรวมท้ายเอกสาร

## ในระบบนี้คืออะไร
แผงล่างของจอเอกสาร (`TransBottomPanel.tsx`) แสดงยอดรวมที่ **backend คำนวณเอง** ไม่ใช้ค่าที่ client ส่งมา (`transcalc.go:9-10`) แล้วเก็บไว้ที่หัว `ic_trans` (`trans.go:657-688`)

## ป้ายบนจอ → คอลัมน์
| ป้ายบนจอ | ตัวแปร UI | คอลัมน์ `ic_trans` |
|---|---|---|
| รวมมูลค่าสินค้า (`:330`) | `totalValue` | `total_value` |
| ส่วนลดก่อนภาษี (`:336`) | `discountWord` | `discount_word` (ข้อความ เช่น "5%" หรือ "10") |
| มูลค่าส่วนลด (`:347`) | `totalDiscount` | `total_discount` |
| หักเงินมัดจำ (`:353`) | `advanceAmount` | `advance_amount` |
| ยอดเงินก่อนภาษี (`:364`) | `totalBeforeVat` | `total_before_vat` |
| ยอดภาษีมูลค่าเพิ่ม (`:370`) | `totalVatValue` | `total_vat_value` |
| มูลค่าหลังคิดภาษี (`:376`) | `afterVat` | `total_after_vat` |
| มูลค่ายกเว้นภาษี (`:382`) | `totalExceptVat` | `total_except_vat` |
| รวมมูลค่าทั้งสิ้น (`:387`) | `totalAmount` | `total_amount` |
- ส่วนหัวมีช่อง "มูลค่าสุทธิ" (`TransTopForm.tsx:275`) สำหรับเอกสารบางชนิดที่กรอกยอดที่หัว
- ถ้าใช้หลายสกุลเงิน จะมีแถว "มูลค่าสินค้า (สกุลเงิน)", "มูลค่าส่วนลด (สกุลเงิน)", "มูลค่าสุทธิ (สกุลเงิน)" เพิ่ม (`TransBottomPanel.tsx:104-123`) ดู [[term-currency-fx]]
- ในบรรทัดรายการ: `price`, `price_exclude_vat`, `discount`, `discount_amount`, `sum_amount`, `sum_amount_exclude_vat`, `total_vat_value` (`trans.go:692-728`)

## ข้อควรระวัง
- ยอดรวมแต่ละแถว VAT ใช้ before + VAT ปัดครึ่งขึ้นที่ 2 ตำแหน่ง (`RoundHalfUp`) (`trans_tax.go:73-74`) ดู [[acc-rounding-decimal]]
- ค่าเงินทั้งหมดเป็น decimal string ห้ามใช้ float ดู [[fe-numeric-money]]
- "ส่วนลดก่อนภาษี" เป็นข้อความสูตรส่วนลด ไม่ใช่ตัวเลข ดู [[term-price-discount]]

## ลิงก์
[[acc-transcalc-totals]] · [[term-vat-type]] · [[term-deposit-advance]] · [[tbl-ic-trans]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/account/transaction/TransBottomPanel.tsx:104-123`, `:330-387`
- `frontend/account/transaction/TransTopForm.tsx:275`
- `backend/internal/application/process/trans.go:657-688`, `:692-728`
- `backend/internal/application/process/transcalc.go:9-10`
- `backend/internal/application/process/trans_tax.go:66-74`
