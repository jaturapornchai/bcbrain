---
title: "สูตรคำนวณส่วนลด ภาษีมูลค่าเพิ่ม 4 รูปแบบ (vat_type) และความหมาย inquiry_type"
audience: "dev"
tags: [doctypes, vat_type, inquiry_type, discount_word, calculation]
aliases:
  - "vat_type 0 1 2 3"
  - "inquiry_type ความหมาย"
  - "สูตรคำนวณ VAT แยกนอก รวมใน"
  - "discount_word ส่วนลดหลายชั้น"
  - "transcalc"
  - "ขายสด ขายเชื่อ ซื้อสด ซื้อเชื่อ inquiry_type"
sources:
  - "backend/internal/application/process/transcalc.go:15-220"
  - "backend/internal/application/process/runtime_options.go:50-70"
  - "backend/internal/application/process/trans_grid.go:227-280"
  - "backend/internal/application/process/trans.go:250-560"
  - "backend/internal/application/process/docs.go:600-635"
  - "backend/internal/application/process/pay_check.go:30-50"
  - "frontend/src/lib/numeric.ts:705-960"
  - "frontend/account/config/useRuntimeOptions.ts:40-125"
  - "frontend/account/transaction/transLayouts.ts:45-210"
  - "frontend/account/transaction/transLayouts.ts:470-499"
  - "frontend/account/transaction/UniversalTransScreen.tsx:3245-3260"
  - "frontend/account/transaction/TransExtraTabs.tsx:1010-1036"
  - "frontend/account/transaction/TransItemGrid.tsx:205-225"
  - "frontend/account/transaction/TransItemGrid.tsx:1212-1244"
---

# สูตรคำนวณส่วนลด ภาษีมูลค่าเพิ่ม 4 รูปแบบ (`vat_type`) และความหมาย `inquiry_type`

เอกสารซื้อ-ขายและหนี้อื่นๆ ใน `ic_trans` และ `as_trans` ใช้คอลัมน์ `inquiry_type` เพื่อระบุลักษณะธุรกรรม (เงินเชื่อ vs เงินสด, สินค้า vs บริการ, คืนของ vs ลดราคา) และใช้ `vat_type` เพื่อกำหนดสูตรคำนวณภาษีมูลค่าเพิ่มด้วย `*big.Rat` (ห้ามใช้ binary float เด็ดขาด ตามกฎใน [[dev-rules-accounting-sql]])

---

## 1. ตารางความหมาย `inquiry_type` แยกตาม `trans_flag`

**ระวังมาก**: รหัสตัวเลข `inquiry_type` เดียวกัน **ไม่ได้แปลเหมือนกันทุกหน้าจอ** นักพัฒนาต้องดูคู่กับ `trans_flag` เสมอ!

| กลุ่มเอกสาร (`trans_flag`) | `0` | `1` | `2` | `3` | `4` | `5` |
|---|---|---|---|---|---|---|
| **ซื้อสินค้า/บริการ (`12`)** และ **ทะยอยตั้งหนี้ (`315`)** | ซื้อเงินเชื่อ (ตั้งหนี้ AP) | ซื้อเงินสด | ซื้อบริการเงินเชื่อ (ตั้งหนี้ AP + ภาษีซื้อยังไม่ถึงกำหนด ม.78/1 ได้) | ซื้อบริการเงินสด | — | — |
| **ขายสินค้า/บริการ (`44`)** และ **ขายสินทรัพย์ (`1802`)** | ขายเงินเชื่อ (ตั้งหนี้ AR) | ขายเงินสด | ขายบริการเงินเชื่อ (ตั้งหนี้ AR + ภาษีขายยังไม่ถึงกำหนด ม.78/1 ได้) | ขายบริการเงินสด | — | — |
| **ส่งคืน/ลดหนี้ซื้อ (`16`, `317`)** | ส่งคืนสินค้า-หักหนี้เจ้าหนี้ (ลดหนี้เชื่อ + ตัดสต็อก) | ลดหนี้ราคาผิด-หักหนี้เจ้าหนี้ (ลดหนี้เชื่อ + **ไม่ตัดสต็อก**) | ส่งคืนสินค้า-รับเงินสดคืน (เงินสด + ตัดสต็อก) | ลดหนี้ราคาผิด-รับเงินสดคืน (เงินสด + **ไม่ตัดสต็อก**) | — | — |
| **รับคืน/ลดหนี้ขาย (`48`)** | รับคืนสินค้า-หักหนี้ลูกหนี้ (ลดหนี้เชื่อ + รับสต็อกเข้า) | รับคืนสินค้า-คืนเงินสด (เงินสด + รับสต็อกเข้า) | ลดหนี้ราคาผิด-หักหนี้ลูกหนี้ (ลดหนี้เชื่อ + **ไม่กระทบสต็อก**) | ลดหนี้ราคาผิด-คืนเงินสด (เงินสด + **ไม่กระทบสต็อก**) | ลดหนี้บริการ-หักหนี้ลูกหนี้ (ลดหนี้เชื่อ) | ลดหนี้บริการ-คืนเงินสด (เงินสด) |
| **เพิ่มหนี้ซื้อ (`14`, `316`)** / **เพิ่มหนี้ขาย (`46`)** | เพิ่มหนี้เงินเชื่อ (ตั้งหนี้ AP/AR) | เพิ่มหนี้เงินสด | เพิ่มหนี้บริการเงินเชื่อ | เพิ่มหนี้บริการเงินสด | — | — |
| **รายได้อื่น (`250`, `252`, `254`)** / **ค่าใช้จ่ายอื่น (`260`, `262`, `264`)** | เงินเชื่อ (ตั้งหนี้ AR/AP) | เงินสด | บริการเงินเชื่อ (ตั้งหนี้ AR/AP) | บริการเงินสด | — | — |

> **จุดที่ผิดบ่อยที่สุดในการเขียน SQL ลูกหนี้/เจ้าหนี้**:
> - บนใบลดหนี้ซื้อ (`16`, `317`): เงินเชื่อคือ **`inquiry_type IN (0, 1)`** (ส่วน `2, 3` เป็นรับเงินสดคืน)
> - บนใบลดหนี้ขาย (`48`): เงินเชื่อคือ **`inquiry_type IN (0, 2, 4)`** (ส่วน `1, 3, 5` เป็นจ่ายเงินสดคืน!)
> ดูเงื่อนไข SQL มาตรฐานครบทุก `trans_flag` ได้ที่ [[doc-impact-ar-ap-deposit]] และ [[sql-ar-outstanding-invoices]]

### กฎเปิด/ปิดแท็บการรับ-จ่ายชำระเงินตาม `inquiry_type` (`isPayTabEnabled` / `payTabEnabled`)
ทั้ง Backend (`pay_check.go:payTabEnabled`) และ Frontend (`transLayouts.ts:isPayTabEnabled`, `UniversalTransScreen.tsx:payTabAllowed`, `TransExtraTabs.tsx:payDisabled`) ใช้เงื่อนไขตรงกันสำหรับเอกสารกลุ่ม `PAY_INQUIRY_FLAGS` (`11, 12, 16, 44, 48, 250, 252, 254, 260, 262, 264, 315, 317`):
- `trans_flag = 11` (จ่ายเงินมัดจำซื้อ): เปิดแท็บชำระเงินเฉพาะ `inquiry_type = 0` (เงินสด)
- `trans_flag IN (16, 317)` (ส่งคืน/ลดหนี้ซื้อ): เปิดเฉพาะ `inquiry_type IN (2, 3)` (รับเงินสดคืน)
- `trans_flag = 48` (รับคืน/ลดหนี้ขาย): เปิดเฉพาะ `inquiry_type IN (1, 3, 5)` (จ่ายเงินสดคืน)
- เอกสารอื่นในกลุ่ม (`12, 44, 250, 252, 254, 260, 262, 264, 315`): เปิดเฉพาะ `inquiry_type IN (1, 3)` (เงินสด)
- หากเลือกประเภทรายการเป็นเงินเชื่อ/เครดิต UI จะปิดแท็บรับ/จ่ายชำระเงิน (`disabled`) สลับออกจากแท็บอัตโนมัติ และแสดงข้อความ `"รายการนี้เลือกประเภทเป็นเงินเชื่อ / เครดิต ระบบปิดการรับ/จ่ายชำระเงิน"`

---

## 2. รหัสประเภทภาษีมูลค่าเพิ่ม (`vat_type`) ทั้ง 4 รูปแบบ

กำหนดที่หัวเอกสาร (`ic_trans.vat_type`) และคัดลอกลงระดับบรรทัด (`ic_trans_detail.vat_type`), ยกเว้นสินค้าที่ตั้งค่าเป็นสินค้ายกเว้นภาษี (`ic_inventory.tax_type = 1` → บรรทัดนั้นจะได้ `tax_type = 1` ไม่คิด VAT):

| `vat_type` | ชื่อไทยบนหน้าจอ | อัตราภาษี (`vat_rate`) | สูตรคำนวณจากยอดหลังหักส่วนลดท้ายบิล (`A` = ยอดสินค้ามีภาษี) |
|---:|---|---|---|
| **`0`** | แยกนอก (Exclude VAT) | เช่น `7.00` | `total_before_vat = A`<br>`total_vat_value = ROUND(A * vat_rate / 100, scale)`<br>`total_after_vat = total_before_vat + total_vat_value` |
| **`1`** | รวมใน (Include VAT) | เช่น `7.00` | `total_after_vat = A`<br>`total_vat_value = ROUND(A * vat_rate / (100 + vat_rate), scale)`<br>`total_before_vat = A - total_vat_value` |
| **`2`** | อัตราศูนย์ (Zero-rated 0%) | `0.00` | `total_before_vat = A`, `total_vat_value = 0`, `total_after_vat = A` (ยังต้องออกรายงานภาษีมูลค่าเพิ่ม!) |
| **`3`** | ยกเว้นภาษี / ไม่กระทบภาษี (Exempt / No VAT) | `0.00` | `total_except_vat = A`, `total_before_vat = 0`, `total_vat_value = 0` (ไม่เข้าตารางภาษีซื้อ/ภาษีขาย เว้นแต่ระบุคีย์มือ) |

เมื่อมีทั้งบรรทัดที่มีภาษี (`tax_type = 0`) และบรรทัดยกเว้นภาษี (`tax_type = 1` ยอดรวม = `E`) ในบิลเดียวกัน:
$$\text{total\_amount} = \text{total\_after\_vat} + \text{total\_except\_vat} \quad (\text{และลบ/บวก } \text{advance\_amount} \text{ ตามการตั้งค่าส่วนลด/มัดจำ})$$

---

## 3. สูตรคำนวณส่วนลดหลายชั้น (`discount_word`)

ทั้งช่องส่วนลดรายบรรทัด (`ic_trans_detail.discount`) และส่วนลดท้ายบิล (`ic_trans.discount_word`) รองรับนิพจน์ส่วนลดต่อเนื่องคั่นด้วย `,` หรือ `+` (`transcalc.go`):
- ตัวเลขตามด้วย `%` = ลดเป็นเปอร์เซ็นต์จากยอดคงเหลือ ณ ชั้นนั้น
- ตัวเลขไม่มี `%` = ลดเป็นจำนวนเงินบาทตรงๆ
- **ตัวอย่าง**: ยอดตั้งต้น `1,000.00`, `discount_word = "10%,50"`
  1. ชั้นที่ 1 (`10%`): เหลือ `1,000 - 100 = 900.00`
  2. ชั้นที่ 2 (`50`): เหลือ `900 - 50 = 850.00` → ส่วนลดรวม = `150.00`

### ตัวเลือกใน `erp_option` ที่มีผลต่อส่วนลด ปัดเศษ และมัดจำ (`transcalc.go` + `numeric.ts`)
- `item_price_decimal` / `item_amount_decimal`: จำนวนทศนิยมราคาต่อหน่วยและจำนวนเงิน (ค่าเริ่มต้น `2` ตำแหน่ง)
- `discout_type` *(Default `1`)*: `0 = คิด VAT ก่อนหักส่วนลดท้ายบิล`, `1 = คิด VAT หลังหักส่วนลดท้ายบิล`
- `discount_vat_type` *(Default `0`)*: การกระจายส่วนลดท้ายบิลเมื่อบิลมีทั้งสินค้ามีภาษี (`valVat`) และยกเว้นภาษี (`valNoVat`):
  - `0` = หักจากสินค้ามีภาษีก่อน หาก `valVat < totalDiscount` จึงนำส่วนลดส่วนที่ล้น (`totalDiscount - valVat`) ไปหักจากสินค้ายกเว้นภาษี (`discNoVat`) โดย **ไม่รวมยอดมัดจำ (`advance`) มาหักข้ามฝั่ง** และในโหมดแยกนอก (`vat_type = 0`, `discount_vat_type IN (0, 1)`) ยอดสุทธิคือ `total_amount = total_value - total_discount - advance + vat_value` (`transcalc.go:159-215`)
  - `1` = เฉลี่ยส่วนลดตามสัดส่วนระหว่างสินค้ามีภาษีและยกเว้นภาษี
- `round_type` (`0 = C# cascade roundBc`, `1 = RoundHalfUp(v + 0.000001)`) และ `discount_step_round_off` (ปิดการปัดเศษระหว่างขั้นส่วนลดหลายชั้น)
- **Frontend–Backend Parity (`frontend/src/lib/numeric.ts`)**: หน้าจอเอกสาร (`UniversalTransScreen`, `UniversalCancelConfirmScreen`) ส่งค่า `itemAmountDecimal`, `discountType`, `discountVatType`, `roundType`, `discountStepRoundOff` จาก `useRuntimeOptions` เข้า `vatCalc` / `calcAfterDiscount` ซึ่งใช้ `BigInt` (`roundScaledByType` + `scaleMulRatio` ความแม่นยำ 28 หลักเทียบเท่า C# `decimal` / Go `*big.Rat`) เพื่อให้ยอดคำนวณบนเบราว์เซอร์ตรงกับ Backend 100% ทุกกรณี

### การแก้ไขช่อง `sum_amount` โดยตรง (`SumAmountManual`)
- ในตารางสินค้า (`TransItemGrid.tsx`) ผู้ใช้สามารถกรอกช่อง `sum_amount` (คอลัมน์ "จำนวนเงิน") โดยตรงเมื่อ `qty * price` มีเศษปัดทศนิยมไม่ตรงหน้าบิล (`Changed: "sumAmount"`, `SumAmountManual: true`)
- `trans_grid.go` (`onSumAmount`) จะปัด `sum_amount` ตามทศนิยม `amount` และคำนวณ `price` ย้อนกลับด้วย `*big.Rat` (ถ้าไม่มีส่วนลดหรือราคาเป็น 0; หาก `qty = 0` และ `sum_amount != 0` จะตั้ง `qty = 1` และ `price = sum_amount`) พร้อมคง `sum_amount` ตามที่กรอกไว้ไม่ให้ `qty * price` ทับ และยังคงตรวจสิทธิ์ขายต่ำกว่าทุน/ราคามาตรฐานตามปกติ
- หากผู้ใช้แก้ `itemCode`, `qty`, `unitCode`, `price`, `discount` หรือ `vatType` ภายหลัง ระบบจะรีเซ็ต `SumAmountManual = false` เพื่อคำนวณยอดตามสูตรปกติอีกครั้ง
- ยกเว้น **ใบเบิกสินค้า/วัตถุดิบ (`trans_flag = 56`)**: `getTransLayout` กำหนด `showPrice = false` และ `showSumAmount = false` (`TransItemGrid.tsx:hideSumAmount`) เพื่อซ่อนคอลัมน์ราคาและจำนวนเงินรวมในตารางสินค้า (แสดงคอลัมน์ต้นทุนเฉลี่ยเฉพาะเมื่อ `rt.stockIssueShowCost && !rt.disableItemCost`)

---

## 4. กฎพิเศษสำหรับสินค้าชุด (Set / BOM Items) ใน `ic_trans_detail`

เมื่อขายหรือซื้อสินค้าชุด (`item_type = 3`):
- บรรทัดแม่ชุดเก็บราคาขายและยอดเงิน (`sum_amount`) เพื่อคิดรายได้และ VAT
- บรรทัดลูกชุด (Component lines) ที่แตกออกมาเพื่อตัดสต็อกจะมี `is_set` / ความสัมพันธ์ชุดกำกับ โดย `transcalc.go` จะไม่นำยอดบรรทัดลูกมารวมซ้ำใน `total_value` ของหัวบิล แต่จะใช้บรรทัดลูกในการตัดสต็อกและคำนวณต้นทุนขายจริง (ดู [[doc-impact-stock-lot-serial]])
