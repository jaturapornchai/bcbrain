---
title: "การคำนวณยอดท้ายบิล VAT และส่วนลด (Document Totals / vatCalc)"
tags: [accounting, vat, discount, totals, go]
aliases: ["ยอดท้ายบิล", "คำนวณ VAT", "ภาษีแยกนอก", "ภาษีรวมใน", "ส่วนลดท้ายบิล", "discount word", "vatCalc", "ส่วนลด %", "VAT รายบรรทัด"]
sources: ["backend/internal/application/process/transcalc.go:32", "backend/internal/application/process/transcalc.go:79", "backend/internal/application/process/transcalc.go:137", "backend/internal/application/process/grid_calc.go:59", "backend/internal/application/process/grid_calc.go:171", "backend/internal/application/process/trans_line_vat.go:12", "backend/internal/application/process/trans.go:1056"]
---

# การคำนวณยอดท้ายบิล VAT และส่วนลด

ยอดหัวเอกสาร (`total_value`, `total_discount`, `total_before_vat`, `total_vat_value`, `total_after_vat`, `total_except_vat`, `total_amount`) คำนวณใน backend ด้วย `vatCalc` ซึ่ง port มาจาก C# `_icTransProcess._vatCalc` ผลลัพธ์ขึ้นกับประเภท VAT ของเอกสาร และค่าตั้งใน `erp_option`

## ทำงานอย่างไร

### ประเภท VAT ของเอกสาร (`vat_type`)
- 0 = ภาษีแยกนอก, 1 = ภาษีรวมใน, 2/3 = ยกเว้น/ไม่กระทบภาษี
- เอกสารที่ไม่มีแผง VAT (`showsVatType` transcalc.go:32): เอกสารสต็อก 54-61, 64, 66-70, 72, 73, 76, 124 และเงินสด/ธนาคาร 300-303, 401-476 (ยกเว้น 250-265) จะถูกบังคับเป็น vat_type 3 ไม่มีส่วนลดและมัดจำ

### ค่าตั้งจาก `erp_option` (`loadGridOptions` grid_calc.go:59)
- `item_price_decimal` / `item_amount_decimal` ช่วง 0-6 ค่าเริ่มต้น 2
- `round_type` (1 หรือ 0; ค่าอื่นอ่านเป็น 0) ดู [[acc-rounding-decimal]]
- `discout_type`: 0 = คิด VAT ก่อนหักส่วนลด, 1 = หลังหักส่วนลด
- `discount_vat_type`: 0 = หักส่วนลดจากสินค้ามีภาษีก่อน, 1 = เฉลี่ยตามสัดส่วน (ค่า 2 "สรรพากร" ถูกอ่านเป็น 0)
- caller ที่ไม่โหลดค่าตั้ง (ap_ar, POS, เครื่องมือสต็อก) ใช้ `proportionalVat` = หลังหักส่วนลด + เฉลี่ย + HALF_UP ที่ 2 ตำแหน่ง

### แยกยอดมี VAT / ไม่มี VAT (`companyHeaderTotals` transcalc.go:79)
- บรรทัด `tax_type` = 0 นับเป็นยอดมี VAT; อื่นๆ เป็นยอดยกเว้น
- บรรทัดชุดสินค้า (item_type 3/5) ไม่นับ นับเฉพาะรายการย่อยของชุด (`setTotalLines`)

### สูตร (`vatCalc` transcalc.go:137)
ให้ `total` = vat + except, `disc` = ส่วนลดท้ายบิลจาก discount word, `adv` = มัดจำที่ตัด
- ส่วนลดเฉลี่ยส่วนที่ตกกับสินค้ามีภาษี = round(disc x vat / total)
- **แยกนอก + VAT ก่อนหักส่วนลด**: before = vat - adv; VAT = round(before x rate/100); amount = before + except + VAT - disc
- **แยกนอก + หลังหักส่วนลด**: หักส่วนลดจากฐานภาษีก่อน (ตาม discount_vat_type) แล้ว VAT = round(before x rate/100); ส่วนลดที่เกินยอดมีภาษีไปหักยอดยกเว้น
- **รวมใน**: amount = total - disc - adv; ถอด VAT จากยอดสุทธิ before = round(net x 100/(100+rate)); VAT = net - before
- **ยกเว้น**: amount = total - disc - adv, ไม่มี VAT
- ผลลัพธ์ทุกช่องจัดรูปที่ scale = max(item_amount_decimal, 2)

### Discount word (`bcCalcAfterDiscount` grid_calc.go:171)
คั่นหลายขั้นด้วย "," และคิดต่อเนื่องจากยอดที่เหลือ (cascade)
- `10%` = ลด 10% ของยอดคงเหลือ, `+5%` = บวกเพิ่ม 5%
- `@3` = ลด 3 ต่อหน่วย (x qty)
- ตัวเลขล้วน = ลดเป็นจำนวนเงิน
- แต่ละขั้นปัดเศษทันที เว้นแต่เปิด step round off

### VAT ระดับบรรทัด (`lineVat` trans_line_vat.go:12)
- vat_type 2 ใช้อัตรา 0
- รวมใน: ถอด VAT จากราคาและส่วนลดด้วย x100/(100+rate)
- VAT บรรทัด = (ราคาไม่รวม VAT x qty - ส่วนลด) x rate/100 เฉพาะ `tax_type` = 0 โดยเก็บค่าที่ยังไม่ปัด
- `sum_amount_exclude_vat` ของเอกสารรวมใน (tax_type 0) ปัดแบบ HALF_EVEN ที่ `item_amount_decimal` เลียนแบบ C# `Math.Round` (trans.go:1056)

### Edge case
- ยอดมัดจำที่ตัดต้องไม่เกินมูลค่าสุทธิ (แยกนอกรวม VAT) มิฉะนั้น "ยอดมัดจำมากกว่ามูลค่าสุทธิ" (trans_validate.go:258)
- อัตรา VAT มาจากเอกสาร (`vat_rate` scale 2) ไม่ได้ hardcode ในเส้นทางนี้ (ยกเว้นจุดใน [[acc-rounding-decimal]])

## ที่มาในโค้ด
- `backend/internal/application/process/transcalc.go:32` showsVatType
- `backend/internal/application/process/transcalc.go:79` companyHeaderTotals
- `backend/internal/application/process/transcalc.go:137` vatCalc
- `backend/internal/application/process/grid_calc.go:59` loadGridOptions
- `backend/internal/application/process/grid_calc.go:171` bcCalcAfterDiscount
- `backend/internal/application/process/trans_line_vat.go:12` lineVat
- `backend/internal/application/process/trans.go:1056` sumExVat HALF_EVEN

## ดูเพิ่ม
- [[acc-rounding-decimal]]
- [[acc-vat-register-wht]]
- [[acc-fx-multi-currency]]
- [[acc-deposit-advance]]
