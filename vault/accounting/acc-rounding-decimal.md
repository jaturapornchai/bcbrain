---
title: "การปัดเศษ ทศนิยม และตัวเลขเงิน (Rounding & Decimal Policy)"
tags: [accounting, rounding, decimal, risk, go]
aliases: ["ปัดเศษ", "ทศนิยม", "HALF_UP", "HALF_EVEN", "round_type", "big.Rat", "float เงิน", "scale", "bcRound"]
sources: ["backend/internal/application/process/service.go:107", "backend/internal/application/process/service.go:149", "backend/internal/application/process/service.go:177", "backend/internal/application/process/grid_calc.go:132", "backend/internal/application/process/stock_rebuild.go:113", "backend/internal/application/process/fa_sale.go:93", "backend/internal/application/process/trans.go:1058", "backend/internal/application/process/service.go:1052", "backend/internal/application/process/stock_rebuild.go:179", "backend/internal/application/process/service.go:1614", "backend/internal/application/process/service.go:971"]
---

# การปัดเศษ ทศนิยม และตัวเลขเงิน

ตัวเลขเงินทั้งหมดใน process ใช้ `math/big.Rat` (ทศนิยมแบบตรงทุกหลัก) และส่งต่อเป็น decimal string ไม่พบการใช้ `float64` กับเงินในไฟล์กลุ่มบัญชี แต่มีวิธีปัดเศษหลายแบบปนกัน และมีหลายจุดที่ hardcode scale 2 หรือ VAT 7%

## ทำงานอย่างไร

### ฟังก์ชันพื้นฐาน (service.go)
- `ParseDecimalRat` (:107) แปลง string เป็น Rat; `numericToRat` (:134) แปลงจาก PG numeric
- `RoundHalfUp` (:149) ปัดครึ่งขึ้นแบบ away from zero (ค่าติดลบปัดสมมาตร)
- `FormatRat` (:177) = RoundHalfUp แล้วพิมพ์ทศนิยมตาม scale
- `decimalParser.arg` (trans.go:1214) รับ input จาก client: ตรวจรูปแบบ แล้วปัด HALF_UP ตาม scale

### การปัดแบบ C# (`round_type` ใน erp_option)
- `bcRound` (grid_calc.go:132) และ `csRound` (stock_rebuild.go:113) port ฟังก์ชัน C# `_round` เดียวกัน (มีสองชุดซ้ำกัน)
  - round_type 1 = HALF_UP ของ (v + 0.000001)
  - round_type 0 (ค่าเริ่มต้น) = ปัดไล่ทีละหลักจากหลักท้ายสุด เช่น 3.7449 -> 3.745 -> 3.75 (ต่างจาก HALF_UP ปกติที่ได้ 3.74)
  - `roundHalfUpType` = -1 คือ HALF_UP ธรรมดา สำหรับ caller รุ่นเก่า
- `roundHalfEven` (fa_sale.go:93) = C# `Math.Round` (banker's rounding) ใช้กับ
  - `sum_amount_exclude_vat` ของเอกสารรวมใน (trans.go:1056)
  - การแยก VAT บรรทัดของการขายสินทรัพย์
  - ทุกตัวเลขใน GL template (scale = `erp_option.gl_no_decimal`) ดู [[acc-gl-template-engine]]

### scale ที่ใช้
| ค่า | scale |
|---|---|
| qty, price, ต้นทุนต่อหน่วยในบรรทัด | 4 |
| ยอดบรรทัด | `item_amount_decimal` (0-6, ค่าเริ่มต้น 2) |
| ยอดหัวเอกสาร | max(`item_amount_decimal`, 2) |
| vat_rate | 2 |
| exchange_rate | 6 |
| rebuild สต็อก: ราคาเฉลี่ย / มูลค่า | `stockScales` (service.go:971) ค่าเริ่มต้น 2 ช่วง 1-6 |
| GL standard | 2 (ตายตัว) |
| GL template | `gl_no_decimal` |
| ค่าเสื่อม | `item_amount_decimal` แบบเก็บ 0 ได้ |

## จุดเสี่ยง
1. **sum_of_cost ตอนบันทึก hardcode 2 ตำแหน่ง**: `FormatRat(qty x cost, 2)` (trans.go:1058) ไม่ตาม amount scale ของบริษัท (rebuild สต็อกจะคำนวณใหม่ตาม `stockScales` ภายหลัง)
2. **backfill ต้นทุนของ 58 ใช้ `ROUND(qty x average_cost, 2)`** (service.go:1052) และยอด GL ของเอกสารสต็อกที่ไม่มี total ใช้ `ROUND(..., 2)` (service.go:1466-1467)
3. **VAT 7% hardcode** ใน `recalcDetailLine` ของปุ่ม "Update ic_trans_detail": `rat107` = 107 และ `vat7Rate` = 7/100 (stock_rebuild.go:179-180) ใช้ถอด VAT ด้วย x100/107 (บรรทัด 198, 204) และคิด VAT (บรรทัด 207) โดยไม่อ่าน `vat_rate` ของเอกสาร; ราคาไม่รวม VAT ปัด 3 ตำแหน่ง ส่วนลด 2 ตำแหน่ง
4. **GL standard ปัด 2 ตำแหน่งตายตัว** (`ValidateAndBalanceJournal(lines, 2)` service.go:1614) ขณะที่ GL template ใช้ `gl_no_decimal` + HALF_EVEN: บริษัทที่ตั้งทศนิยมไม่ใช่ 2 จะได้ GL สองแบบที่ปัดต่างกัน
5. ฟังก์ชันปัดแบบ C# มีสองชุด (`bcRound`, `csRound`) ซึ่งเขียนต่างกันเล็กน้อย (comment ระบุว่าตัดหลักเกินแบบ half-up ต่างจาก .NET ที่ half-even เฉพาะกรณีเสมอกันพอดี)
6. การคำนวณอัตราค่าเสื่อมแบบลดน้อยถอยลงใช้ `big.Float` ความแม่นยำ 256 bit แล้วปัดค่ายกกำลัง (ratio^อายุ) เป็น 15 หลักนัยสำคัญ (`Text('e', 14)` = 1 หลักหน้าจุด + 14 หลักหลังจุด, เลียน C# `(decimal)Math.Pow` — asset_depreciation.go:86-88) ก่อนคำนวณ 1 − pow ใช้กับอัตรา ไม่ใช่กับยอดเงินโดยตรง
7. `LineNumber float64` ใน `glDefaultRow` (gl_template_defaults.go:22) ใช้เรียงลำดับเท่านั้น ไม่ใช่เงิน

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:107` ParseDecimalRat
- `backend/internal/application/process/service.go:149` RoundHalfUp
- `backend/internal/application/process/service.go:177` FormatRat
- `backend/internal/application/process/grid_calc.go:132` bcRound
- `backend/internal/application/process/stock_rebuild.go:113` csRound
- `backend/internal/application/process/fa_sale.go:93` roundHalfEven
- `backend/internal/application/process/trans.go:1058` sumOfCost scale 2
- `backend/internal/application/process/service.go:1052` backfill 58
- `backend/internal/application/process/stock_rebuild.go:179` rat107 / vat7Rate
- `backend/internal/application/process/service.go:1614` GL standard scale 2
- `backend/internal/application/process/service.go:971` stockScales

## ดูเพิ่ม
- [[acc-transcalc-totals]]
- [[acc-inventory-cost-moving-average]]
- [[acc-gl-template-engine]]
- [[standards-overview]]
