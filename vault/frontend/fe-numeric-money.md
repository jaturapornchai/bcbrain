---
title: "ตัวเลข เงิน ภาษี และปี พ.ศ. ฝั่ง frontend (numeric.ts)"
tags: [frontend, money, decimal, vat, rounding, thai-year]
aliases: ["numeric.ts", "roundBc", "vatCalc", "calcAfterDiscount", "formatMoneyDisplay", "decimalSql", "NumberBox", "ทศนิยมเงิน", "ปัดเศษ", "yearType", "ปี พ.ศ.", "bigint money", "evalArithmeticSafe", "formatPackingBreakdown"]
sources: ["frontend/src/lib/numeric.ts:4", "frontend/src/lib/numeric.ts:110", "frontend/src/lib/numeric.ts:155", "frontend/src/lib/numeric.ts:231", "frontend/src/lib/numeric.ts:281", "frontend/src/lib/numeric.ts:451", "frontend/src/lib/numeric.ts:587", "frontend/src/lib/numeric.ts:664", "frontend/src/lib/numeric.ts:739", "frontend/src/lib/numeric.ts:842", "frontend/src/lib/numeric.ts:950", "frontend/shared/ui/NumberBox.tsx:102", "frontend/account/config/OptionsForm.tsx:297", "frontend/src/lib/api-client.ts:146"]
---

# ตัวเลข เงิน ภาษี และปี พ.ศ. ฝั่ง frontend (`numeric.ts`)

การคำนวณ/แสดงผล/ส่ง SQL ที่เป็นตัวเลขเงินของหน้าจอ ผ่านไฟล์เดียว `src/lib/numeric.ts` (1,022 บรรทัด) ซึ่งเก็บค่าเป็น string และคำนวณด้วย `bigint` หัวไฟล์ (บรรทัด 4) ห้ามใช้ `float`/`parseFloat`/`Number()` คำนวณเงินหรือภาษี
จำนวนทศนิยมและรูปแบบปีอ่านจากตั้งค่าระบบ (`erp_option`) แล้ว cache ไว้ใน module

## ทำงานอย่างไร

**ตัวเลขเป็น string + bigint**
- `INTERNAL_SCALE = 12` (บรรทัด 148) และ `SCALE_FACTOR = 10^12` (155). `parseScaled(val): bigint` (162) ตัด `,` ยอมรับ `.5` / `5.` / นำหน้า `+` แล้วคูณด้วย `SCALE_FACTOR`; ข้อความที่อ่านเป็นตัวเลขไม่ได้ให้ 0; ถ้าทศนิยมยาวเกิน 12 หลักจะปัดหลักที่ 13 ขึ้นเมื่อ >= 5. `formatScaled(scaled, decimals=2, trimTrailingZeros=false)` (188) แปลงกลับเป็นข้อความโดยปัด half-up (`roundScaledHalfUp`, 212).
- เลขคณิต `addDec/subDec/mulDec/divDec` (281-317) รับ `unknown` คืน string: ถ้าไม่ส่ง `decimals` จะคืน 6 ตำแหน่งและตัดศูนย์ท้าย; `mulDec`/`divDec` ปัด half-up; `divDec` หารศูนย์ได้ 0. `cmpDec` (319) คืน -1/0/1; `sumDec(items, decimals=2)` (327).
- `roundBc(val, digits=2, cascade=true)` (231): `digits` ถูกจำกัด 0-8. `cascade=true` ตัดศูนย์ท้ายแล้วปัดทีละหลักจากท้ายขึ้นมา (เช่น `1.2345 -> 1.235 -> 1.24`); `cascade=false` ปัด half-up ที่หลักเป้าหมายครั้งเดียว (ผ่าน `formatScaled`).

**ส่งเข้า SQL**: `decimalSql(val, scaleOrFallback=6)` (110)
- ตัดจุลภาค แปลง `.5` / `5.` ให้ถูก; `null`/ว่าง/`-` -> `"0"` (หรือค่า fallback ถ้าส่ง string มาเป็นอาร์กิวเมนต์ที่สอง).
- รูปแบบที่ผ่านคือจำนวนเต็มไม่เกิน 15 หลัก และทศนิยมไม่เกิน `scale` หลัก; ถ้าเป็นตัวเลขล้วนแต่ทศนิยมยาวกว่า `scale` จะปัดด้วย `roundBc(raw, scale, false)`; ถ้าไม่ใช่ตัวเลขเลยจะ `throw new Error("ข้อมูลตัวเลขไม่ถูกต้อง: ...")` เว้นแต่มี fallback แล้วคืน fallback.
- ใช้ร่วมกับ `sqlDecimal` ใน [[fe-query-client-sql-builder]]. ผู้เรียกในจอ: `CustomerDetailScreen`, `SupplierDetailScreen`, `IcExtraScreens`, `StockBeginningBalanceScreen`.

**ทศนิยมตามตั้งค่าระบบ**
- `BcDecimalKind = "qty"|"price"|"amount"|"fx"|"gl"|"int"` (335). `BcDecimalSettings` (337) เก็บ 5 ชนิดแรก ค่าเริ่ม 2 หลักทุกชนิด (`DEFAULT_DECIMAL_SETTINGS`, 345); ชนิด `int` ไม่มีในตั้งค่า - `getBcDecimals("int")` คืน 0 เสมอ (522-526). `clampDec` (358) จำกัดค่าที่อ่านมาไว้ 0-6.
- ตอนโหลด module ฝั่ง browser จะอ่านค่าที่เคยเก็บไว้จาก `localStorage["bc_decimal_settings"]` และ `["bc_year_type"]` (364-383) ใช้ก่อนที่จะอ่านจาก DB.
- `refreshBcDecimalSettings()` (451) ยิง `POST /api/query/list` พร้อมหัว `X-BC-DB` จาก `localStorage["bc_selected_db"]` อ่าน `item_qty_decimal, item_price_decimal, item_amount_decimal, currency_exchange_decimal, gl_no_decimal, year_type` จาก `erp_option LIMIT 1` (บรรทัด 473) แล้วเก็บกลับ `localStorage` และแจ้งผู้ติดตาม; ข้ามเมื่อ path ขึ้นต้น `/login`, `/select-database`, `/admin`.
- `getBcDecimals(kind)` (522), `getBcYearType` (394) และ `subscribeBcSettings` (386) เรียก `ensureDecimalSettingsLoaded` (506) โหลดค่าครั้งแรกให้เอง; `invalidateBcSettings()` (516) ล้างสถานะ "โหลดแล้ว" ให้โหลดใหม่ - `api-client.ts:146-148` เรียกหลัง `POST` ของ login / demo / google / databases / เลือกฐาน (`SESSION_SWITCH_PATHS`, :11) ดู [[fe-auth-session]].
- `inferBcDecimalKind(fieldName, fallback="amount")` (528) เดาชนิดจากชื่อคอลัมน์: มี `qty`, `ratio`, `weight`, `stand_value` ฯลฯ -> `qty`; `price`/`cost` -> `price`; `exchange`/`fx` -> `fx`; `debit`/`credit` -> `gl`. ใช้ใน `MasterDetailScreen`, `BcDataListCustomizeModal`, `GlobalReportPrintModal`, `UniversalReportScreen`.

**ปี พ.ศ./ค.ศ.**
- `year_type` 0 = ค.ศ. (23/10/2026), 1 = พ.ศ. (23/10/2569); `getBcYearType/setBcYearType` (394/399) เก็บใน `localStorage["bc_year_type"]`.
- `formatBcDate(val, yearType)` (422) รับ `YYYY-MM-DD` (ตามด้วยเวลาได้) หรือ `DD/MM/YYYY` ปีที่มากกว่า 2400 ถือว่าเป็น พ.ศ. แล้วลบ 543 ก่อน จากนั้นแสดงเป็น `DD/MM/YYYY`; ถ้าไม่ใช่รูปแบบวันที่คืนข้อความเดิม. `todayLocal()` (137) คืนวันที่ตามเครื่องรูป `YYYY-MM-DD`.
- ผู้ตั้งค่าปี: จอ "กำหนดข้อเลือกพิเศษต่างๆ" (`OptionsForm`, เมนู `menu_option` รหัส `1002`) เรียก `setBcYearType` และ `refreshBcDecimalSettings` หลังบันทึก (`OptionsForm.tsx:297-298`, [[scr-options]]); `UniversalReportScreen.tsx:412` ตั้งตาม `yearType` ที่ backend ส่งมากับผลรายงาน ([[fe-report-screens]]).

**แสดงผลและช่องกรอก**
- `formatMoneyDisplay(val, decimals?, kind?)` (587): ใส่ `,` คั่นหลักพัน ปัดตามทศนิยม; **ค่า 0 / 0.00 / ว่าง แสดงเป็นข้อความว่าง** (`""`). `formatNumericInput` (616) ตอนไม่แก้ไขใช้ `formatMoneyDisplay`, ตอนกำลังพิมพ์ใช้ `formatLiveComma` (564) และค่าศูนย์ให้ว่างเช่นกัน; `normalizeNumericOnBlur` (638) ปัดด้วย `roundBc(cleaned, dec, false)` ตอนออกจากช่อง; `isZeroDecimal` (553).
- `shared/ui/NumberBox.tsx`: `NumberBox` (102) มี props `decimals`/`decimalKind`, `allowNegative`, `allowDecimal`, `hideCalculator`/`showCalculator`, `onNext`, `onBlurValue`; `CommaNumberInput` (242) เป็นแบบกระชับสำหรับในตาราง. ทั้งสองใช้ `useFocusDraft` (27) เก็บข้อความที่พิมพ์ระหว่างโฟกัส และ `handleNumericKeyDown` (`numeric.ts:42`) บล็อกอักขระที่ไม่ใช่ตัวเลข. ปุ่มเครื่องคิดเลขเปิด `BcCalculatorDialog` ซึ่งเรียก `evalArithmeticSafe(display, 6)` (`BcCalculatorDialog.tsx:108,134`).

**สูตรเอกสาร (หัวฟังก์ชันระบุว่าต้องตรงกับ backend `grid_calc.go`)**
- `calcAfterDiscount(discountWord, baseAmount, amountDecimal=2, qty="1", alwaysRound=true)` (664): ตัดช่องว่าง แยกคำส่วนลดด้วย `,` เท่านั้น แล้วลดต่อเนื่องทีละคำ: `x%` = ลดเป็น % จากยอดคงเหลือ, `+x%` = บวกเพิ่ม, `@x` = ลด x คูณจำนวน (`qty`), `x` = ลดเป็นจำนวนเงิน; `alwaysRound` ปัดทุกขั้น.
- `vatCalc({valueVat, valueNoVat, discountWord, vatRate, vatType, advance, amountDecimal})` (739) คืน `total_value, total_discount, total_before_vat, total_vat_value, total_after_vat, total_except_vat, total_amount`. `vatRate` ว่างใช้ 7. ส่วนลดท้ายบิลถูกเฉลี่ยตามสัดส่วนเมื่อมีสินค้าไม่มีภาษี; `advance` หักจากฐานภาษี. `vatType` (ตัวเลือก `transLayouts.ts:10-15`):
  - 0 แยกนอก: `before_vat` = ฐานภาษี, `vat` = ฐาน x อัตรา / 100, `after_vat` = ฐาน + vat, `total_amount` = `after_vat` + ยอดยกเว้น.
  - 1 รวมใน: `after_vat` = ฐานภาษี, `before_vat` = `after_vat` x 100 / (100 + อัตรา), `vat` = ผลต่าง.
  - 2 ยกเว้น และ 3 ไม่กระทบภาษี: `before_vat`/`vat`/`after_vat` เป็น 0, ยอดทั้งหมดไปอยู่ที่ `total_except_vat` = `total_amount`.
  - เรียกใช้ที่ `UniversalTransScreen.tsx:920` และ `UniversalCancelConfirmScreen.tsx:730`.
- `evalArithmeticSafe(expr, decimals=4)` (842) แทน `eval`: รับเฉพาะตัวเลข `. + - * / ( ) %` ผ่านตัวแยกวิเคราะห์ที่เขียนเอง ใช้เลข `bigint`; `100+7%` ได้ 107 (บวก % ของค่าซ้าย); หารศูนย์หรือนิพจน์ผิดคืน `null`; ผลตัดศูนย์ท้าย.
- `formatPackingBreakdown(baseQty, units, direction="asc")` (950): แปลงจำนวนหน่วยฐานเป็นข้อความตามหน่วยบรรจุ (`stand_value`/`divide_value` ของแต่ละหน่วย) ต่อกันด้วย `x` - **ฟังก์ชันนี้ใช้ `Number()` และเลข float** เพราะใช้แสดงผลอย่างเดียว ไม่ส่งเข้า SQL. ผู้เรียก: `ItemScreen`, `MultiUnitPackSummaryBar` ([[scr-multi-unit-pack-summary]]), `StockBalanceModal`.

**ข้อควรระวัง**
- ห้ามคำนวณเงินด้วย `Number()`/`parseFloat` ในจอ - ใช้ `addDec/mulDec/...`; ค่าจาก DB เป็น string.
- `UniversalTransScreen` ขอยอดรวมจาก backend (`transTotals`, `POST /api/process/transgrid/totals`) และใช้ `vatCalc` ฝั่งเว็บเป็นยอดที่แสดงเมื่อยังไม่มีผลจาก backend ส่วน `UniversalCancelConfirmScreen` คำนวณยอดตารางด้วย `vatCalc` โดยตรง ([[fe-transaction-screens]]); สูตรส่วนลดต้องตรงกับ `grid_calc.go` (หัวฟังก์ชัน `calcAfterDiscount` ที่ `numeric.ts:655-663`) จึงห้ามแก้สูตรฝั่งเดียว.
- ค่า 0 แสดงเป็นช่องว่างทั้งใน `formatMoneyDisplay` และ `NumberBox` - ถ้าจอใดต้องแสดง `0.00` ต้องไม่ใช้สองตัวนี้.
- ถ้าเพิ่มชนิดทศนิยมใหม่ต้องแก้ทั้ง `BcDecimalSettings`, ค่าเริ่มต้น, `clampDec` ตอนอ่านค่า และ SQL ใน `refreshBcDecimalSettings`.
- ไฟล์ทดสอบ `src/lib/numeric.test.ts` (`node:test`) ครอบคลุม `0.1 + 0.2`, `roundBc` แบบ cascade, `decimalSql`, `calcAfterDiscount`, `vatCalc` ทั้ง 4 `vatType`, `evalArithmeticSafe`, การแสดงค่าศูนย์เป็นว่าง และกล่องจำนวนเต็ม (บรรทัด 21, 29, 38, 50, 69, 110, 120, 142).

## ที่มาในโค้ด
- `frontend/src/lib/numeric.ts:1-5,110-136,148-231,281-333` - หลักการ, `decimalSql`, bigint, round, เลขคณิต
- `frontend/src/lib/numeric.ts:335-450,451-530` - ทศนิยม/ปีจาก `erp_option`, `localStorage`
- `frontend/src/lib/numeric.ts:553-663` - ศูนย์/แสดงผล/ช่องกรอก
- `frontend/src/lib/numeric.ts:664-841` - ส่วนลดและ VAT
- `frontend/src/lib/numeric.ts:842-1022` - `evalArithmeticSafe`, `formatPackingBreakdown`
- `frontend/shared/ui/NumberBox.tsx:27,102,242` - ช่องกรอกตัวเลข
- `frontend/account/config/OptionsForm.tsx:297-298`, `frontend/account/report/UniversalReportScreen.tsx:412`, `frontend/src/lib/api-client.ts:11,146-148` - ผู้ตั้ง/ล้างค่าปีและทศนิยม
- `frontend/src/lib/numeric.test.ts:21-148` - ทดสอบ
- ดูเพิ่ม: [[frontend-overview]] · [[fe-transaction-screens]] · [[fe-query-client-sql-builder]] · [[fe-auth-session]] · [[fe-report-screens]] · [[scr-options]] · [[accounting-overview]] · [[standards-overview]]
