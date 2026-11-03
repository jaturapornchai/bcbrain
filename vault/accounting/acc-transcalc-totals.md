---
title: "การคำนวณยอดท้ายบิล VAT และส่วนลด (Document Totals / vatCalc)"
tags: [accounting, vat, discount, totals, go]
aliases: ["ยอดท้ายบิล", "คำนวณ VAT", "ภาษีแยกนอก", "ภาษีรวมใน", "ส่วนลดท้ายบิล", "discount word", "vatCalc", "ส่วนลด %", "VAT รายบรรทัด"]
sources: ["backend/internal/application/process/transcalc.go:32", "backend/internal/application/process/transcalc.go:68", "backend/internal/application/process/transcalc.go:79", "backend/internal/application/process/transcalc.go:112", "backend/internal/application/process/transcalc.go:137", "backend/internal/application/process/grid_calc.go:59", "backend/internal/application/process/grid_calc.go:171", "backend/internal/application/process/trans_line_vat.go:12", "backend/internal/application/process/trans.go:1051", "backend/internal/application/process/trans.go:1056", "backend/internal/application/process/trans_validate.go:258"]
---

# การคำนวณยอดท้ายบิล VAT และส่วนลด

ยอดหัวเอกสาร (`total_value`, `total_discount`, `total_before_vat`, `total_vat_value`, `total_after_vat`, `total_except_vat`, `total_amount`) คำนวณใน backend ด้วย `vatCalc` (transcalc.go:137) ผลลัพธ์ขึ้นกับประเภท VAT ของเอกสาร และค่าตั้งใน `erp_option`

## ทำงานอย่างไร

### ประเภท VAT ของเอกสาร (`vat_type`)
- 0 = ภาษีแยกนอก, 1 = ภาษีรวมใน, ค่าอื่น (2/3) = ยกเว้น/ไม่กระทบภาษี
- เอกสารที่ไม่มีแผง VAT (`showsVatType` transcalc.go:32): เอกสารสต็อก 54-61, 64, 66-70, 72, 73, 76, 124 และเอกสารเงินสด/ธนาคาร 300-303, 401-476 ส่วนเอกสารกลุ่ม `ap_ar_trans` มีแผง VAT เสมอ
- เอกสารที่ไม่มีแผง VAT ถูกบังคับเป็น vat_type 3 อัตรา 0 ไม่มีส่วนลดท้ายบิลและมัดจำ (transcalc.go:93-95) และอัตรา VAT รายบรรทัดเป็น 0 (trans.go:961-965)

### ค่าตั้งจาก `erp_option` (`loadGridOptions` grid_calc.go:59)
- `item_price_decimal` / `item_amount_decimal` ช่วง 0-6 ค่าเริ่มต้น 2 (นอกช่วงใช้ 2)
- `round_type` (1 หรือ 0; ค่าอื่นอ่านเป็น 0) ดู [[acc-rounding-decimal]]
- `discout_type`: 0 = คิด VAT ก่อนหักส่วนลด, 1 = หลังหักส่วนลด
- `discount_vat_type`: 0 = หักส่วนลดจากสินค้ามีภาษีก่อน, 1 = เฉลี่ยตามสัดส่วน (ค่าอื่นรวมถึง 2 "สรรพากร" ถูกอ่านเป็น 0, grid_calc.go:96-98)
- `discount_step_round_off` = 1 คือไม่ปัดเศษทีละขั้นของ discount word; `calc_item_price_discount` ใช้กับส่วนลดรายบรรทัด
- caller ที่ไม่โหลดค่าตั้ง (ap_ar, POS, เครื่องมือสต็อก) ใช้ `proportionalVat` (transcalc.go:68) = หลังหักส่วนลด + เฉลี่ย + HALF_UP ที่ 2 ตำแหน่ง

### แยกยอดมี VAT / ไม่มี VAT (`companyHeaderTotals` transcalc.go:79)
- มีค่าตั้งบริษัท (หน้าจอเอกสาร): บรรทัดที่ `tax_type` = 0 นับเป็นยอดมี VAT ไม่ว่า vat_type หัวเอกสารเป็นอะไร; อื่นๆ เป็นยอดยกเว้น
- ไม่มีค่าตั้ง (`proportionalVat`): บรรทัดเป็นยอดมี VAT เมื่อ `tax_type` ≠ 1 และ vat_type ไม่ใช่ 2/3; เอกสารยกเว้นภาษีเก็บ `total_except_vat` = `total_amount` (transcalc.go:102-104)
- บรรทัดชุดสินค้า (item_type 3/5) ไม่นับ นับเฉพาะรายการย่อยของชุด (`setTotalLines` transcalc.go:112) ถ้าไม่มีค่าตั้ง ตัดเฉพาะชุดที่มีรายการย่อยอยู่ในเอกสาร

### สูตร (`vatCalc` transcalc.go:137)
ให้ `vat` = ยอดมี VAT, `except` = ยอดยกเว้น, `total` = vat + except, `disc` = total − ผลของ discount word กับ total, `adv` = มัดจำที่ตัด, `r()` = ปัดที่ `item_amount_decimal` ตาม round_type, `d` = ส่วนลดเฉลี่ยที่ตกกับสินค้ามีภาษี = r(disc x vat / total) (0 ถ้า total ≤ 0), `discNoVat` = ส่วนลดที่ไปหักยอดยกเว้น
- **แยกนอก + VAT ก่อนหักส่วนลด** (`discout_type` ≠ 1): before = vat − adv; VAT = r(before x rate/100); after = before + VAT; amount = before + except + VAT − disc (ยอดยกเว้นไม่ถูกหัก)
- **แยกนอก + หลังหักส่วนลด + หักสินค้ามีภาษีก่อน** (discount_vat_type 0): ถ้า vat ≥ disc + adv: before = vat − disc − adv, VAT = r(before x rate/100); ถ้า vat < disc + adv: before = 0, VAT = 0, discNoVat = disc − vat
- **แยกนอก + หลังหักส่วนลด + เฉลี่ย** (discount_vat_type 1): before = vat − d − adv; VAT = r(before x rate/100); discNoVat = disc − d
  - ทั้งสองแบบหลังหักส่วนลด: after = before + VAT; except = except − discNoVat; amount = except + after
- **รวมใน**: amount = total − disc − adv; ยอดสุทธิที่ถอด VAT `net`:
  - `discout_type` ≠ 1: net = vat − adv
  - หลังหักส่วนลด + discount_vat_type 0: net = vat − disc − adv ถ้า vat ≥ disc + adv มิฉะนั้น 0; ถ้า vat < disc: discNoVat = disc − vat
  - หลังหักส่วนลด + discount_vat_type 1: net = vat − d − adv; discNoVat = disc − d
  - หลังหักส่วนลด: except = except − discNoVat
  - before = r(net x 100/(100+rate)); VAT = r(net − before); after = before + VAT
- **ยกเว้น/ไม่กระทบภาษี**: amount = total − disc − adv, ไม่มี VAT; discNoVat = disc − vat (เมื่อ discount_vat_type 0 และ vat < disc + adv) หรือ disc − d (discount_vat_type 1) แล้ว except = except − discNoVat
- ผลลัพธ์ทุกช่อง = r(ค่า) แล้วจัดรูปที่ scale = max(item_amount_decimal, 2) (transcalc.go:213-216)

### Discount word (`bcCalcAfterDiscount` grid_calc.go:171)
คั่นหลายขั้นด้วย "," (ตัดช่องว่างทิ้ง) และคิดต่อเนื่องจากยอดที่เหลือ (cascade)
- `10%` = ลด 10% ของยอดคงเหลือ, `+5%` = บวกเพิ่ม 5%
- `@3` = ลด 3 x qty (ส่วนลดท้ายบิลส่ง qty = 1 จึงเท่ากับลด 3)
- ตัวเลขล้วน = ลดเป็นจำนวนเงิน; ค่าที่อ่านไม่ได้ = 0
- แต่ละขั้นปัดเศษทันที เว้นแต่เปิด `discount_step_round_off`; ผลสุดท้ายปัดเสมอ

### VAT ระดับบรรทัด (`lineVat` trans_line_vat.go:12)
- vat_type 2 ใช้อัตรา 0
- ถอด VAT จากราคาและส่วนลดด้วย x100/(100+rate) เฉพาะบรรทัดรวมใน (vat_type 1 และ tax_type 0)
- ส่วนลดบรรทัด: เปิด `calc_item_price_discount` = ส่วนลดต่อหน่วย x qty; มี "@" = คิดตาม qty; อื่นๆ คิดจากยอด qty x price ที่ปัดแล้ว
- VAT บรรทัด = (ราคาไม่รวม VAT x qty − ส่วนลด) x rate/100 เฉพาะ `tax_type` = 0 โดยเก็บค่าที่ยังไม่ปัด (`exactDecimal` ตรงทุกหลักถึง 12 ตำแหน่ง, trans.go:1051-1052)
- `sum_amount_exclude_vat` ของบรรทัดรวมใน (tax_type 0) ปัดแบบ HALF_EVEN (banker's rounding) ที่ `item_amount_decimal` (trans.go:1055-1056)

### Edge case
- ยอดมัดจำที่ตัดต้องไม่เกินมูลค่าสุทธิ = `total_value` (บวก `total_vat_value` เมื่อแยกนอก) มิฉะนั้น "ยอดมัดจำมากกว่ามูลค่าสุทธิ" (`checkAdvance` trans_validate.go:258-268)
- อัตรา VAT มาจากเอกสาร (`vat_rate` scale 2) ไม่ได้ hardcode ในเส้นทางนี้ (ยกเว้นจุดใน [[acc-rounding-decimal]])

## ที่มาในโค้ด
- `backend/internal/application/process/transcalc.go:32` showsVatType
- `backend/internal/application/process/transcalc.go:68` proportionalVat
- `backend/internal/application/process/transcalc.go:79` companyHeaderTotals
- `backend/internal/application/process/transcalc.go:112` setTotalLines
- `backend/internal/application/process/transcalc.go:137` vatCalc
- `backend/internal/application/process/grid_calc.go:59` loadGridOptions
- `backend/internal/application/process/grid_calc.go:171` bcCalcAfterDiscount
- `backend/internal/application/process/trans_line_vat.go:12` lineVat
- `backend/internal/application/process/trans.go:1056` sumExVat HALF_EVEN
- `backend/internal/application/process/trans_validate.go:258` checkAdvance

## ดูเพิ่ม
- [[acc-rounding-decimal]]
- [[acc-vat-register-wht]]
- [[acc-fx-multi-currency]]
- [[acc-deposit-advance]]
