---
title: "ตัวเลข เงิน ภาษี และปี พ.ศ. ฝั่ง frontend (numeric.ts)"
tags: [frontend, money, decimal, vat, rounding, thai-year]
aliases: ["numeric.ts", "roundBc", "vatCalc", "calcAfterDiscount", "formatMoneyDisplay", "decimalSql", "NumberBox", "ทศนิยมเงิน", "ปัดเศษ", "yearType", "ปี พ.ศ.", "bigint money"]
sources: ["frontend/src/lib/numeric.ts:1", "frontend/src/lib/numeric.ts:110", "frontend/src/lib/numeric.ts:155", "frontend/src/lib/numeric.ts:231", "frontend/src/lib/numeric.ts:281", "frontend/src/lib/numeric.ts:451", "frontend/src/lib/numeric.ts:664", "frontend/src/lib/numeric.ts:739", "frontend/shared/ui/NumberBox.tsx:102"]
---

# ตัวเลข เงิน ภาษี และปี พ.ศ. ฝั่ง frontend (`numeric.ts`)

ทุกการคำนวณ/แสดงผล/ส่ง SQL ที่เป็นตัวเลขเงิน ผ่านไฟล์เดียว `src/lib/numeric.ts` ซึ่งใช้ string + `bigint` ไม่ใช้ `float`/`parseFloat`/`Number()` (ระบุไว้ในหัวไฟล์ บรรทัด 1-5)
ทศนิยมและรูปแบบปีอ่านจากตั้งค่าระบบ (`erp_option`) แล้ว cache ไว้ใน module

## ทำงานอย่างไร

**ตัวเลขเป็น string + bigint**
- `parseScaled(val): bigint` (162) แปลงข้อความเป็นเลขจำนวนเต็มคูณ `SCALE_FACTOR = 10^12` (บรรทัด 155) แล้ว `formatScaled` (188) แปลงกลับเป็นข้อความตามจำนวนทศนิยม.
- ฟังก์ชันเลขคณิต: `addDec/subDec/mulDec/divDec/cmpDec/sumDec` (281-327) รับ `unknown` คืน string.
- `roundBc(val, digits=2, cascade=true)` (231) ลอก `MyLib._global._round` ของ BCERP เดิม: `cascade=true` ปัดทีละหลักจากท้ายขึ้นมา (เช่น `1.2345 -> 1.235 -> 1.24`), `cascade=false` ปัด half-up ที่หลักเป้าหมาย; `digits` ถูกจำกัด 0-8.
- `isZeroDecimal` (553), `normalizeNumericOnBlur`/`formatNumericInput`/`formatLiveComma` (564-660) ใช้กับช่องกรอก.

**ส่งเข้า SQL**: `decimalSql(val, scaleOrFallback=6)` (110) ตรวจรูปแบบ (ไม่เกิน 15 หลักจำนวนเต็ม, ทศนิยมไม่เกิน scale), ตัดจุลภาค, แปลง `.5`/`5.` ให้ถูก; ค่าว่าง -> `"0"`; ผิดรูป -> throw `Error("ข้อมูลตัวเลขไม่ถูกต้อง")` (ถ้าไม่มี fallback). ใช้ร่วมกับ `sqlDecimal` ใน [[fe-query-client-sql-builder]].

**ทศนิยมตามตั้งค่าระบบ**
- ชนิด `BcDecimalKind = "qty"|"price"|"amount"|"fx"|"gl"|"int"` (335); ค่าเริ่ม 2 หลักทุกชนิด (ตัวแปร `DEFAULT_DECIMAL_SETTINGS`, ~บรรทัด 345).
- `refreshBcDecimalSettings()` (451) ยิง `POST /api/query/list` อ่าน `item_qty_decimal, item_price_decimal, item_amount_decimal, currency_exchange_decimal, gl_no_decimal, year_type` จากตาราง `erp_option` (บรรทัด 473) พร้อมหัว `X-BC-DB` จาก `localStorage["bc_selected_db"]`; ข้ามหน้า `/login`, `/select-database`, `/admin`.
- `getBcDecimals(kind)` (522) ให้จำนวนหลักตามชนิด; `invalidateBcSettings()` (516) ถูกเรียกเมื่อสลับฐาน/ผู้ใช้ ([[fe-query-client-sql-builder]]); `subscribeBcSettings` (386) ให้ React อัปเดตเมื่อตั้งค่าเปลี่ยน.
- ผู้บันทึกหน้า "กำหนดข้อเลือกพิเศษ" เรียก `setBcYearType` และ `refreshBcDecimalSettings` หลังบันทึก ([[fe-form-engine]]).

**ปี พ.ศ./ค.ศ.**: `year_type` 0 = ค.ศ. (23/10/2026), 1 = พ.ศ. (23/10/2569); `getBcYearType/setBcYearType` (394/399, เก็บ `localStorage["bc_year_type"]`) และ `formatBcDate(val, yearType)` (422) แปลงรูปแบบแสดงผล; `todayLocal()` (137) คืนวันที่ตามเครื่องรูป `YYYY-MM-DD`.

**สูตรเอกสาร (ต้องตรงกับ backend `grid_calc.go`)**
- `calcAfterDiscount(discountWord, baseAmount, amountDecimal=2, qty="1", alwaysRound=true)` (664): แยกคำส่วนลดด้วย `,` เท่านั้น; `x%` = ลดเป็น % จากยอดคงเหลือ, `+x%` = บวกเพิ่ม, `@x` = ลด x คูณจำนวน, `x` = ลดเป็นจำนวนเงิน.
- `vatCalc({valueVat, valueNoVat, discountWord, vatRate, vatType, advance, amountDecimal})` (739) คืน `total_value, total_discount, total_before_vat, total_vat_value, total_after_vat, total_except_vat, total_amount`. `vatType` 0 = แยกนอก, 1 = รวมใน, 2 = ยกเว้นภาษี, 3 = ไม่กระทบภาษี (`transLayouts.ts:10-15`).
- `evalArithmeticSafe` (842) คำนวณนิพจน์เลขคณิตในช่องกรอก (ยังไม่ได้อ่านเนื้อใน).

**ช่องกรอกตัวเลข**: `shared/ui/NumberBox.tsx` - `NumberBox` (102) และ `CommaNumberInput` (242) ใช้ `useFocusDraft` (27) เก็บค่าที่พิมพ์เป็น string ระหว่างโฟกัส; ส่วน `handleNumericKeyDown` (`numeric.ts:42`) ใช้บล็อกอักขระที่ไม่ใช่ตัวเลข.

**ข้อควรระวัง**
- ห้ามคำนวณเงินด้วย `Number()`/`parseFloat` ในจอ - ใช้ `addDec/mulDec/...`; ค่าจาก DB เป็น string.
- จอเอกสารใช้ทั้ง `vatCalc` (ฝั่งเว็บ) และ `transTotals` (เรียก backend `/api/process/transgrid/totals`) - หัวฟังก์ชัน `calcAfterDiscount` ระบุว่าสูตรต้องตรงกับ `grid_calc.go` ของ backend (`numeric.ts:655-662`); ห้ามแก้สูตรฝั่งเดียว ([[fe-transaction-screens]]).
- ถ้าเพิ่มชนิดทศนิยมใหม่ต้องแก้ทั้ง `BcDecimalSettings`, ค่าเริ่มต้น และ SQL ใน `refreshBcDecimalSettings`.

## ที่มาในโค้ด
- `frontend/src/lib/numeric.ts:1-5,110-136,155-231,281-327` - หลักการ, decimalSql, bigint, round, เลขคณิต
- `frontend/src/lib/numeric.ts:335-400,451-530` - ทศนิยม/ปีจาก `erp_option`
- `frontend/src/lib/numeric.ts:664-841` - ส่วนลดและ VAT
- `frontend/shared/ui/NumberBox.tsx:27,102,242` - ช่องกรอกตัวเลข

## ดูเพิ่ม
[[frontend-overview]] · [[fe-transaction-screens]] · [[fe-query-client-sql-builder]] · [[accounting-overview]] · [[standards-overview]]
