---
title: "การปัดเศษ ทศนิยม และตัวเลขเงิน (Rounding & Decimal Policy)"
tags: [accounting, rounding, decimal, risk, go]
aliases: ["ปัดเศษ", "ทศนิยม", "HALF_UP", "HALF_EVEN", "round_type", "big.Rat", "float เงิน", "scale", "bcRound"]
sources: ["backend/internal/application/process/service.go:107", "backend/internal/application/process/service.go:149", "backend/internal/application/process/service.go:177", "backend/internal/application/process/grid_calc.go:132", "backend/internal/application/process/stock_rebuild.go:113", "backend/internal/application/process/fa_sale.go:93", "backend/internal/application/process/trans.go:1058", "backend/internal/application/process/service.go:1063", "backend/internal/application/process/stock_rebuild.go:179", "backend/internal/application/process/service.go:1625", "backend/internal/application/process/service.go:982", "backend/internal/application/process/asset_depreciation.go:88", "backend/internal/application/process/fa_depreciation.go:783"]
---

# การปัดเศษ ทศนิยม และตัวเลขเงิน

ตัวเลขเงินทั้งหมดใน process ใช้ `math/big.Rat` (ทศนิยมแบบตรงทุกหลัก) และส่งต่อเป็น decimal string ไม่พบการใช้ `float64` กับเงินในไฟล์กลุ่มบัญชี แต่มีวิธีปัดเศษหลายแบบปนกัน และมีหลายจุดที่ hardcode scale 2 หรือ VAT 7%

## ทำงานอย่างไร

### ฟังก์ชันพื้นฐาน (service.go)
- `ParseDecimalRat` (:107) แปลง string เป็น Rat; `numericToRat` (:134) แปลงจาก PG numeric
- `RoundHalfUp` (:149) ปัดครึ่งขึ้นแบบ away from zero (ค่าติดลบปัดสมมาตร)
- `FormatRat` (:177) = RoundHalfUp แล้วพิมพ์ทศนิยมตาม scale
- `decimalParser.arg` (trans.go:1214) รับ input จาก client: ตัด comma, ค่าว่างหรือ "-" = 0, ตรวจรูปแบบ ถ้าทศนิยมไม่เกิน scale เก็บตามที่พิมพ์ ถ้าเกินปัด HALF_UP ตาม scale

### การปัดตาม `round_type` ใน `erp_option`
- `bcRound` (grid_calc.go:132) และ `csRound` (stock_rebuild.go:113) ทำหน้าที่เดียวกัน (มีสองชุดซ้ำกัน)
  - round_type 1 = HALF_UP ของ (v + 0.000001)
  - round_type 0 (ค่าเริ่มต้น; ค่าอื่นที่ไม่ใช่ 1 ถูกแปลงเป็น 0 ที่ grid_calc.go:99-101) = ปัดไล่ทีละหลักจากหลักท้ายสุด เช่น 3.7449 -> 3.745 -> 3.75 (ต่างจาก HALF_UP ปกติที่ได้ 3.74)
  - `roundHalfUpType` = -1 (grid_calc.go:128) ไม่ใช่ค่าใน `erp_option` แต่ใช้กับจุดที่ไม่ส่ง round_type ของบริษัท = HALF_UP ธรรมดา เช่น `proportionalVat` (transcalc.go:68)
- `roundHalfEven` (fa_sale.go:93) ปัดแบบ HALF_EVEN (banker's rounding) ใช้กับ
  - `sum_amount_exclude_vat` ของบรรทัดเอกสารราคารวม VAT (vat_type 1 และ tax_type 0) ที่ `item_amount_decimal` (trans.go:1056 และ doc_approve_item.go:122)
  - การแยก VAT รายบรรทัดของการขายสินทรัพย์ (fa_sale.go:168, 171)
  - ทุกตัวเลขใน GL template (scale = `erp_option.gl_no_decimal`) ดู [[acc-gl-template-engine]]

### scale ที่ใช้
| ค่า | scale |
|---|---|
| qty, price, ต้นทุนต่อหน่วยในบรรทัด | 4 (trans.go:1001-1004) |
| ยอดบรรทัด | `item_amount_decimal` (0-6, ค่าเริ่มต้น 2) |
| ยอดหัวเอกสาร | ปัดที่ `item_amount_decimal` ตาม round_type แล้วแสดงที่ max(`item_amount_decimal`, 2) (transcalc.go:213) |
| vat_rate | 2 (trans.go:822) |
| exchange_rate | 6 (trans.go:888) |
| rebuild สต็อก: ราคาเฉลี่ย / มูลค่า | `stockScales` (service.go:982) อ่าน `item_price_decimal` / `item_amount_decimal` ช่วง 1-6 (ค่า 0 หรือนอกช่วงใช้ 2) |
| GL standard | 2 (ตายตัว) |
| GL template | `gl_no_decimal` 0-6 ค่าเริ่มต้น 2 (gl_template.go:734) |
| ค่าเสื่อม | `faAmountScale` = `item_amount_decimal` 0-6 เก็บ 0 ได้ (NULL หรือไม่มีแถวใช้ 2) ปัด HALF_UP (fa_depreciation.go:111, 783) |

## จุดเสี่ยง
1. **sum_of_cost ตอนบันทึก hardcode 2 ตำแหน่ง**: `FormatRat(qty x cost, 2)` (trans.go:1058) ไม่ตาม amount scale ของบริษัท (rebuild สต็อกจะคำนวณใหม่ตาม `stockScales` ภายหลัง)
2. **backfill ต้นทุนของ 58 ใช้ `ROUND(qty x average_cost, 2)`** (service.go:1063) และยอด GL ของเอกสารสต็อกที่ไม่มี total ใช้ `ROUND(..., 2)` (service.go:1477-1478)
3. **VAT 7% hardcode** ใน `recalcDetailLine` (stock_rebuild.go:193) ซึ่ง `updateTransDetailRecalcTx` (stock_rebuild.go:226) เรียกจากปุ่ม "Update ic_trans_detail" (frontend/account/process/SystemProcessWorkbenchScreen.tsx:1536): `rat107` = 107 และ `vat7Rate` = 7/100 (stock_rebuild.go:179-180)
   - ถอด VAT ด้วย x100/107 เฉพาะบรรทัด vat_type 1 (บรรทัด 198, 204) และคิด VAT = (ราคาไม่รวม VAT x qty − ส่วนลด) x 7/100 (บรรทัด 207) โดยไม่อ่าน `vat_rate` ของเอกสาร และเก็บ VAT แบบไม่ปัด
   - ราคาไม่รวม VAT คำนวณใหม่เฉพาะเมื่อ price ≠ price_exclude_vat และปัด 3 ตำแหน่ง ส่วนลดปัด 2 ตำแหน่ง (ปัดด้วย `csRound` ตาม round_type)
4. **GL standard ปัด 2 ตำแหน่งตายตัว** (`ValidateAndBalanceJournal(lines, 2)` service.go:1625) ขณะที่ GL template ใช้ `gl_no_decimal` + HALF_EVEN: บริษัทที่ตั้งทศนิยมไม่ใช่ 2 จะได้ GL สองแบบที่ปัดต่างกัน
5. ฟังก์ชันปัดตาม round_type มีสองชุด (`bcRound`, `csRound`) ซึ่งตัดหลักเกินต่างกันเล็กน้อยก่อนเริ่มปัดไล่หลัก: `bcRound` ตัดให้เหลือรวม 28 หลัก ส่วน `csRound` ตัดให้ mantissa ไม่เกิน 96 bit และทศนิยมไม่เกิน 28 หลัก (ทั้งคู่ตัดแบบ HALF_UP)
6. การคำนวณอัตราค่าเสื่อมแบบลดน้อยถอยลง: pow = (ราคาซาก / มูลค่าที่คิดค่าเสื่อม)^(1/อายุ) ด้วย `big.Float` ความแม่นยำ 256 bit (asset_depreciation.go:78-82, 94, 99) แล้วปัด pow เป็น 15 หลักนัยสำคัญ (`Text('e', 14)` = 1 หลักหน้าจุด + 14 หลักหลังจุด, asset_depreciation.go:88) ก่อนคำนวณอัตรา = (1 − pow) x 100 ที่ `rateScale` ใช้กับอัตรา ไม่ใช่กับยอดเงินโดยตรง
7. `LineNumber float64` ใน `glDefaultRow` (gl_template_defaults.go:22) ใช้เรียงลำดับเท่านั้น ไม่ใช่เงิน

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:107` ParseDecimalRat
- `backend/internal/application/process/service.go:149` RoundHalfUp
- `backend/internal/application/process/service.go:177` FormatRat
- `backend/internal/application/process/grid_calc.go:132` bcRound
- `backend/internal/application/process/stock_rebuild.go:113` csRound
- `backend/internal/application/process/fa_sale.go:93` roundHalfEven
- `backend/internal/application/process/trans.go:1058` sumOfCost scale 2
- `backend/internal/application/process/service.go:1063` backfill 58
- `backend/internal/application/process/stock_rebuild.go:179` rat107 / vat7Rate
- `backend/internal/application/process/service.go:1625` GL standard scale 2
- `backend/internal/application/process/service.go:982` stockScales
- `backend/internal/application/process/asset_depreciation.go:88` ปัด pow 15 หลักนัยสำคัญ
- `backend/internal/application/process/fa_depreciation.go:783` faAmountScale

## ดูเพิ่ม
- [[acc-transcalc-totals]]
- [[acc-inventory-cost-moving-average]]
- [[acc-gl-template-engine]]
- [[standards-overview]]
