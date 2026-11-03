---
title: "ตารางสินค้า: คำนวณแถว สูตรลัด และ action ของ transgrid (Item grid calc)"
tags: [process, grid, calc, discount, rounding, shortcut, big-rat, trans]
aliases: ["transgrid", "TransGridLines", "TransGridShortcut", "TransGridFormula", "grid_calc", "grid_shortcut", "bcRound", "bcCalcAfterDiscount", "itemLineAmount", "calcFormulaPrice", "gridOptions", "loadGridOptions", "สูตรลัด", "ส่วนลดเป็นขั้น", "ปัดเศษ", "round_type"]
sources: ["backend/internal/application/process/grid_calc.go:18", "backend/internal/application/process/grid_calc.go:59", "backend/internal/application/process/grid_calc.go:116", "backend/internal/application/process/grid_calc.go:132", "backend/internal/application/process/grid_calc.go:171", "backend/internal/application/process/grid_calc.go:201", "backend/internal/application/process/grid_calc.go:232", "backend/internal/application/process/grid_calc.go:268", "backend/internal/application/process/grid_calc.go:279", "backend/internal/application/process/grid_shortcut.go:46", "backend/internal/application/process/grid_shortcut.go:62", "backend/internal/application/process/grid_shortcut.go:165", "backend/internal/application/process/trans_grid.go:129", "backend/internal/application/process/trans_grid.go:191", "backend/internal/adapter/inbound/http/process/transgrid_handler.go:19"]
---

# ตารางสินค้า: คำนวณแถว สูตรลัด และ action ของ transgrid (Item grid calc)

ตารางรายการสินค้าในเอกสาร (ขาย ซื้อ โอน ฯลฯ) ไม่คำนวณเองในหน้าเว็บ: หน้าเว็บส่งแถวที่ผู้ใช้แก้มาที่ `POST /process/transgrid/{action}` แล้ว backend คืนแถวที่เติมราคา ส่วนลด ยอดรวมให้ครบ โดยคำนวณด้วย `big.Rat` ให้ได้ตัวเลขเท่าโปรแกรม C# เดิม (`MyLib/_global.cs`, `BCERPGlobal/_global.cs`, `_icTransItemGridControl.cs`)

## ทำงานอย่างไร

### Action ของ `transgrid` (สิทธิ์ทั้งหมด `read`)
| Action | เมธอด service | หน้าที่ |
|---|---|---|
| `line` | `TransGridLines` | แก้ 1 ช่องของแถว (หรือหลายแถวพร้อมกัน) แล้วคืนแถวที่คำนวณใหม่ |
| `formula` | `TransGridFormula` | หน้าต่างสูตรราคา (Ctrl+3) ของสินค้า |
| `totals` | `TransTotals` | ยอดรวมบิลตามที่การบันทึกจะเก็บ (รับ `SaveTransInput`; อยู่ใน `trans.go:756` -- ส่วนของกลุ่มเอกสาร) |
| `shortcut` | `TransGridShortcut` | สูตรลัดที่พิมพ์ในช่องจำนวน/ราคา/ส่วนลด |
| `priceinfo` | `TransGridPriceInfo` | รายการราคา ดู [[proc-price-engine]] |
| `fx` | `TransFxInfo` | สวิตช์หลายสกุลเงินและอัตราแลกเปลี่ยนปัจจุบัน (`fx.go:91`) |
| `refimport` | `TransRefImport` | ดึงรายการจากเอกสารอ้างอิง (`trans_ref_import_lines.go:107`) |
ที่มา: `transgrid_handler.go:19-72`, สิทธิ์ `permission.go:29`

### 1. ตัวเลือกบริษัทที่ใช้ (`gridOptions`, `loadGridOptions`)
อ่านจาก `erp_option` แถวเดียว (`grid_calc.go:18-104`): `item_price_decimal` / `item_amount_decimal` (ค่าตั้งต้น 2, อยู่นอก 0-6 ใช้ 2), `round_type`, `calc_item_price_discount`, `discount_step_round_off`, `check_qty`, `warning_low_cost`, `lock_low_cost`, `warning_input_customer`, `warning_price_1/2`, `get_purchase_price`, `get_last_price_type`, `ic_price_formula_control`, `sale_real_price`, `multi_currency`, `purchase_zero_vat_use_price1`, `count_stock_display_saleprice`, `enable_all_ic_wh_shelf`, `hide_pr_amount`, `pr_disable_price`, `sale_auto_input_qty`, `discout_type`, `discount_vat_type`
- แยกอ่านเป็นหลาย query แต่ละอันผ่าน `scanOption` เพื่อให้ฐานข้อมูลที่ยังไม่มีคอลัมน์ใหม่ใช้ค่าตั้งต้นต่อได้ (ภายใน transaction ใช้ savepoint กัน error 25P02)
- `round_type` ที่ไม่ใช่ 1 ถือเป็น 0; `discount_vat_type` ที่ไม่ใช่ 1 ถือเป็น 0 (ค่า 2 = สรรพากร ยังไม่ทำตาม ระบุเป็น `ponytail` ในโค้ดรอลุงจืด)

### 2. ตัวเลขและการปัดเศษ
- `bcDecimal` (`:116`): แปลงข้อความเป็นเลข แบบ `Decimal.TryParse` ของ C# -- ข้อความที่ไม่ใช่ตัวเลขล้วน (เช่น `5@`, `10+5`) ได้ 0
- `bcRound` (`:132`): `round_type = 1` ปัดแบบ AwayFromZero ที่ (ค่า + 0.000001); ค่าอื่นปัดไล่ทีละหลักจากท้ายขึ้นมา (3.7449 -> 3.745 -> 3.75) หลังตัดให้เหลือ 28 หลักนัยสำคัญแบบ `decimal` ของ C#; `roundHalfUpType = -1` ใช้ HALF_UP ธรรมดาสำหรับผู้เรียกรุ่นเก่า
- `trimDecimal` (`:302`): แสดงผลเลขตัด 0 ท้ายทศนิยม (`-0` กลายเป็น `0`)

### 3. ส่วนลดเป็นขั้น (`bcCalcAfterDiscount`, `:171`)
คำส่วนลดคั่นด้วย `,` (ลบช่องว่างก่อน) แต่ละขั้นหักจากยอดคงเหลือต่อเนื่อง
- `@x` = x ต่อหน่วย (หักจำนวนเงิน x * qty)
- `x%` = ร้อยละของยอดคงเหลือ ณ ขั้นนั้น; `+x%` = บวกเพิ่ม
- อย่างอื่น = จำนวนเงินตรง ๆ
- ถ้า `alwaysRound` (= ไม่ได้เปิด `discount_step_round_off`) ปัดทุกขั้น มิฉะนั้นปัดครั้งเดียวตอนท้าย
- `bcCalcDiscountOnly` (`:201`) คืนส่วนต่าง (ส่วนลด) ที่สูตรหักออกจากราคา สำหรับสูตรราคา

### 4. ยอดต่อแถว (`itemLineAmount`, `:268`; `gridCtx.amount`, `trans_grid.go:225`)
- ปกติ: `ปัด(จำนวน x ราคา, AmountDec)` แล้วหักส่วนลดเป็นขั้น
- ถ้าเปิด `calc_item_price_discount`: หักส่วนลดจากราคาต่อหน่วยก่อน (ทศนิยมราคา) แล้วคูณจำนวน
- `sum_amount` = ยอดสุทธิ; `discount_amount` = ยอดก่อนส่วนลด - ยอดสุทธิ (ความหมายของเว็บ ตามคอมเมนต์)

### 5. สูตรราคา (`calcFormulaPrice`, `:232`)
ตีความข้อความสูตรในช่อง `price_0..9` ของ `ic_inventory_price_formula`: `=P,ส่วนลด` ตั้งราคา P แล้วหักส่วนลด; `-d` / `+d` คงราคาแล้วคืน d เป็นส่วนลด (ราคาจริง = ราคา -/+ d); ตัวเลขล้วนคือราคา; ข้อความว่างคืนราคาเดิม ถ้า `sale_real_price` เปิด จะตั้งราคาเป็นราคาจริงหลังหักและล้างคำส่วนลด; จำนวนไม่ใช่ 1 คูณส่วนลดด้วยจำนวน `TransGridFormula` ใช้ฟังก์ชันนี้แสดงราคาของทุกระดับ 0-9 ต่อหน่วย/ชนิดขาย/ชนิดภาษี พร้อม `priceLevel` ของลูกค้า (`trans_grid.go:730-779`)

### 6. การแก้แถว (`TransGridLines`, `trans_grid.go:129`)
- ข้อจำกัด: 1-1000 แถวต่อคำขอ, `transFlag` ต้องอยู่ใน `gridItemFlags` (ชุด flag ที่มีตารางสินค้า), วันที่เอกสารว่าง = วันนี้, ตัวเลขจำนวน/ราคา/ขนาด 4 ทศนิยม
- ช่องที่แก้ (`changed`): `itemCode`, `qty`, `unitSize`/`qty2`, `unitCode`, `price`/`discount`, `vatType`, `calc` (คำนวณยอดอย่างเดียว); ค่าอื่น error "ไม่รู้จักช่องที่แก้ไข"
- `itemCode`: รองรับรหัสบาร์โค้ด (ตัด `*` และช่องว่าง ค้น `ic_inventory_barcode`) -> โหลดสินค้า -> ตรวจ `is_hold_sale`/`is_hold_purchase` -> ตั้งหน่วย/คลัง/ที่เก็บตั้งต้น ([[proc-wh-shelf-permission]]) -> ส่วนลดตั้งต้น -> จำนวน 1 ถ้า `sale_auto_input_qty` -> เรียกขั้น `qty`; เปิด `warning_input_customer` แล้วไม่มีลูกค้าในจอที่ต้องมี -> "ไม่พบรหัสลูกค้า"; สินค้าชุด (set item) ขยายแถวลูกใน `children`
- `qty`: ตรวจจำนวน (ติดลบไม่ได้ ยกเว้นเอกสารปรับสต็อก: "จำนวน ... ผิดพลาด") แล้วหาราคาขาย/ซื้อ ([[proc-price-engine]])
- `unitCode`: ตรวจหน่วยกับ `ic_unit_use` สินค้าที่มีหน่วยเดียว (`unit_type` 0/2) ที่เลือกหน่วยอื่นจะถูกบังคับกลับเป็นหน่วยมาตรฐานพร้อมข้อความ "สินค้านี้มีหน่วยนับเดียว" (`onUnit`, `trans_grid.go:580`)
- `price`/`discount`: ตรวจราคาต่ำกว่าต้นทุน (`warning_low_cost`: เตือนให้ยืนยัน, `lock_low_cost`: ปฏิเสธและล้างราคา) และถ้าเปิด `ic_price_formula_control` ตรวจ "ห้ามขายต่ำกว่าราคากลาง" เทียบ `price_0` -- เฉพาะ flag ใน `lowCostFlags`
- `vatType`: เปลี่ยนชนิดภาษีที่หัวเอกสาร หาราคาใหม่ทุกแถวที่มีสินค้า/จำนวน (ไม่แตะส่วนลด)
- ผลลัพธ์ต่อแถว `GridLineResult`: `line`, `error`, `warnings[]`, `confirm {message, yesPrice, noPrice}` (หน้าจอถามแล้วส่งแถวกลับพร้อม `changed = "calc"`), `children[]`, `clearSetOrphans`
- ถ้าเปิดศูนย์ราคา คำขอทั้งก้อนมีเส้นตาย 30 วินาที เกินแล้วแจ้ง "ศูนย์ราคาตอบช้าเกินกำหนด"

### 7. สูตรลัด (`TransGridShortcut`, `grid_shortcut.go:46`)
รับ `transFlag`, `field` (`qty` | `price` | `discount`), `text` (ไม่เกิน 100 ตัวอักษร) คืนเฉพาะช่องที่สูตรตั้งค่า (`qty`, `price`, `discount` ตัวใดตัวหนึ่งหรือหลายตัว เป็นข้อความ) หน้าเว็บนำไปใส่ แล้วส่งแถวกลับมาเป็น `line` เพื่อตรวจ/คำนวณตามปกติ
- ช่องจำนวนหรือราคา ถ้าไม่มี `/` (หรือขึ้นต้น `=`) = นิพจน์คำนวณ ใส่ค่าเข้าช่องนั้น (จำนวนติดลบถูกปฏิเสธ ยกเว้นเอกสารปรับสต็อก)
- `ยอดรวม/ตัวหาร` ในช่องจำนวน: ตัวหารคือจำนวน ราคา = ยอด/จำนวน; ในช่องราคา: ตัวหารคือราคา จำนวน = ยอด/ราคา (ปัดด้วยทศนิยมราคา); ส่วนต่างจากการปัดเศษ (จำนวน x ราคา - ยอด) ใส่เป็นส่วนลดบรรทัด เพื่อให้ยอดสุทธิเท่ายอดที่พิมพ์ (`amountOverShortcut`, `:129`); เอกสารที่ไม่มีช่องราคา (`gridNoPriceFlags`) ใช้ `/` ในช่องจำนวนไม่ได้
- ช่องส่วนลด: นิพจน์ เช่น `=100*2+50` -> ค่าตัวเลขเป็นส่วนลด
- ตัวประเมินนิพจน์ (`evalDiscountExpr`, `:165`): ยอมเฉพาะ `0-9 . + - * / ( )` และ `x`/`X` เป็นคูณ; เลขหน้า `(` คูณวงเล็บ; วงเล็บซ้อนไม่เกิน 20 ชั้น (`exprMaxDepth`); หารศูนย์ปฏิเสธ; ผลหารตัดที่ 28 หลักนัยสำคัญ; ผลลัพธ์เกิน 1e15 ปฏิเสธ ("ตัวเลขในสูตรมากเกินขอบเขตที่บันทึกได้")

### 8. `fx` และ `refimport` (ส่งต่อให้โมดูลอื่น)
- `fx` (`TransFxInfo`): คืน `multiCurrency`, `active` (flag นี้เก็บคอลัมน์สกุลเงินหรือไม่ ตาม `fxTopFlags`), `homeCurrency`, และสำหรับ `currencyCode` ที่ส่งมา `found/name/exchangeRate` จาก `erp_currency.exchange_rate_present`; รหัสสกุลเงินยาวเกิน 25 ตัวอักษรถูกปฏิเสธ
- `refimport` (`TransRefImport`): คืน `lines`, `header`, `messages`, `refLocked` ตามคู่ (flag ที่กำลังคีย์, flag ของเอกสารอ้างอิง) ใน `refImportSpecs` สูงสุด 50 เอกสารอ้างอิง (`refImportMaxDocs`); `lines = null` หมายถึงฝั่ง C# ไม่สร้างแถว (ตารางไม่เปลี่ยน) ส่วน `[]` หมายถึงล้างตาราง; ตัวกรองเอกสารที่เลือกได้อยู่ที่ [[proc-lookup-filters]]

## จุดที่ต้องระวัง
- ห้ามคำนวณยอดแถวในหน้าเว็บหรือด้วย float: ตัวเลขต้องมาจาก `transgrid/line`/`shortcut` เพื่อให้ตรงโปรแกรมเดิม (คอมเมนต์ในโค้ดอ้าง AGENTS.md rule 10)
- แถวที่ไม่มีสินค้า จำนวนเป็น 0 หรือสินค้า `ItemType` 3/5 (ยังไม่ยืนยันความหมายของค่านี้) จะไม่ถูกหาราคาใหม่ตอนเปลี่ยน `vatType` (`trans_grid.go:675-679`)
- `changed = "calc"` ไม่หาราคา แค่คำนวณยอด ใช้หลัง `confirm`

## ที่มาในโค้ด
- `backend/internal/application/process/grid_calc.go:18` - `gridOptions`; `:42` `scanOption`; `:59` `loadGridOptions`; `:106` `vat()`; `:116` `bcDecimal`; `:132` `bcRound`; `:171` `bcCalcAfterDiscount`; `:201` `bcCalcDiscountOnly`; `:232` `calcFormulaPrice`; `:268` `itemLineAmount`; `:279` `priceBelowCost`; `:296` `priceBelowStandPrice`; `:302` `trimDecimal`
- `backend/internal/application/process/grid_shortcut.go:46` - `TransGridShortcut`; `:62` `gridShortcut`; `:114` `splitAmountOver`; `:129` `amountOverShortcut`; `:165` `evalDiscountExpr`; `:184` `exprParser`
- `backend/internal/application/process/trans_grid.go:18-75` - `GridLine`, `TransGridInput`, `GridConfirm`, `GridLineResult`; `:87-103` ชุด flag; `:129` `TransGridLines`; `:191` `line`; `:322` `onItemCode`; `:470` `onQty`; `:580` `onUnit`; `:614` `onPriceOrDiscount`; `:675` `onVatType`; `:730` `TransGridFormula`
- `backend/internal/application/process/fx.go:91` - `TransFxInfo`; `trans_ref_import_lines.go:30-107` - `RefImportInput`, `RefImportResult`, `TransRefImport`; `trans_ref_import.go:24` - `refImportSpecs`
- `backend/internal/adapter/inbound/http/process/transgrid_handler.go:19-84` - ตัวเลือก action; `permission.go:29` - สิทธิ์

## ดูเพิ่ม
- [[proc-price-engine]]
- [[proc-barcode]]
- [[proc-lookup-filters]]
- [[proc-wh-shelf-permission]]
- [[proc-dispatcher]]
- [[proc-permission-rights]]
- [[process-overview]]
