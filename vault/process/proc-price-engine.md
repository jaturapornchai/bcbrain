---
title: "เครื่องมือหาราคาและแก้ราคา (Price engine / price center / modify price)"
tags: [process, price, ic_inventory_price, price-center, pricing, master]
aliases: ["findSalePrice", "findPurchasePrice", "priceFormulaRow", "price center", "ศูนย์ราคา", "transgrid/priceinfo", "TransGridPriceInfo", "checkpricesave", "CheckPriceSave", "modifyprice", "ModifyPrice", "ปรับปรุงราคา", "ตรวจสอบราคา", "ic_inventory_price"]
sources: ["backend/internal/application/process/price_engine.go:18", "backend/internal/application/process/price_engine.go:67", "backend/internal/application/process/price_engine.go:103", "backend/internal/application/process/price_engine.go:205", "backend/internal/application/process/price_engine.go:237", "backend/internal/application/process/price_center.go:39", "backend/internal/application/process/price_center.go:47", "backend/internal/application/process/price_center.go:81", "backend/internal/application/process/price_center.go:129", "backend/internal/application/process/price_center.go:210", "backend/internal/application/process/price_info.go:66", "backend/internal/application/process/check_price.go:48", "backend/internal/application/process/modify_price.go:22", "backend/internal/application/process/modify_price.go:84", "backend/internal/application/process/modify_price.go:396", "backend/internal/application/process/trans_grid.go:488"]
---

# เครื่องมือหาราคาและแก้ราคา (Price engine / price center / modify price)

เมื่อผู้ใช้กรอกสินค้า/จำนวนในตารางสินค้าของเอกสาร backend ต้องหาราคาให้เองตามลำดับเดียวกับโปรแกรม C# เดิม (`_findPriceClass.cs`, `_findPurchasePriceClass.cs`) ถ้าบริษัทเปิด `erp_option.use_price_center` ราคาขายทั้งหมดจะไปถามบริการศูนย์ราคาภายนอกแทน นอกจากนี้มีหน้าจอดูรายการราคา (price info), หน้าแก้ราคาบาร์โค้ดทีละรายการ (check price) และหน้าปรับปรุงราคาทีละหลายแถว (modify price)

## ทำงานอย่างไร

### 1. จุดเรียก (จากตารางสินค้า)
- ตอนแก้จำนวน (`onQty` ใน `trans_grid.go`) ถ้า flag เอกสารอยู่ใน `salePriceFlags` (30, 34, 36, 44, 46, 48, 76, 144) จำนวน `<> 0` และไม่ได้ดึงมาจากเอกสารอ้างอิง/ไม่ใช่ของแถม -> `g.salePrice` -> `applySalePrice` (`trans_grid.go:490-495`, `:564`)
- flag ซื้อ `purchasePriceFlags` (2, 6, 12, 310) เรียก `findPurchasePrice` เฉพาะเมื่อ option `GetPurchasePrice` เปิด (`trans_grid.go:96-97`, `:497`, `:529`) -- รายละเอียดการคำนวณแถวอยู่ที่ [[proc-grid-calc]]
- ข้อมูลที่ใช้ค้นคือ `priceQuery`: `ItemCode`, `UnitCode`, `Barcode`, `PartyCode` (= `custCode` ของหัวเอกสาร), `DocDate`, `CurrencyCode`, `Qty`, `VatRate`, `VatType`, `SaleType` (= `inquiryType` ของเอกสาร) (`trans_grid.go:461`)

### 2. ลำดับหาราคาขาย (`findSalePrice`, `price_engine.go:103`)
ทดลองทีละขั้น เจอแล้วหยุด ผลเก็บใน `priceResult` (`Found`, `Price`, `Price1`, `Price2`, `Type`, `Mode`, `Roworder`, `PriceGuid`, `DiscountWordFormula`, `DefaultDiscount`, `StandPrice`)

| ลำดับ | แหล่ง | `Type` | เงื่อนไขสำคัญ |
|---|---|---|---|
| 1 | `ic_inventory_price` ราคาเฉพาะลูกค้า | 1 | `price_type = 3` และ `cust_code = custCode` |
| 2 | ราคากลุ่มลูกค้า | 2 | `price_type = 2` จับกลุ่มจาก `ar_customer_detail` (`group_main` เทียบ `cust_group_1`; `group_sub_1..4` เทียบ `cust_group_2` หรือ `cust_group_2` ว่าง) |
| 3 | ราคาทั่วไป (`price_mode = 1`) | 3 | `price_type = 1` |
| 4 | ราคามาตรฐาน (`price_mode = 0`) | 3 | `price_type = 1` |
| 5 | สูตรราคา `ic_inventory_price_formula` | 6 (mode 6) | ใช้เมื่อสี่ขั้นแรกไม่พบ และมีแถวสูตร |
| 6 | ราคาบาร์โค้ด `ic_inventory_barcode.price` | 5 (mode 5) | เมื่อส่ง `barcode` มา |
| 7 | ราคาขายล่าสุด | 7 (mode 5) | เมื่อ option `GetLastPriceType` = 1 (ใบล่าสุด) หรือ 2 (เฉลี่ย) |

- ทุกขั้นของ `ic_inventory_price` กรองด้วย `priceCond`: รหัสสินค้า + หน่วย, วันที่เอกสารอยู่ในช่วง `from_date..to_date`, จำนวนอยู่ในช่วง `from_qty..to_qty`, `sale_type IN (0, ชนิดขาย)` โดย `saleFilterType` ให้ 2 เมื่อ `SaleType` เป็น 0 หรือ 2 ไม่ใช่ก็ให้ 1 (`price_engine.go:49`, `:88`) และกรองสกุลเงินด้วย `priceCurrencyCond` เมื่อ option `MultiCurrency` เปิด (ไม่เปิด = ส่งสกุลว่าง)
- เรียงเลือกแถว: `price_mode DESC, sale_type DESC, transport_type DESC` (ขั้นกลุ่มลูกค้าเพิ่ม `cust_group_2`, ขั้นมาตรฐานเพิ่ม `line_number DESC`) แล้ว `LIMIT 1`
- ราคาที่ใช้ (`res.Price`): `sale_price2` (ราคารวมใน) เป็นค่าตั้งต้น แต่ถ้า `VatType = 0` (แยกนอก) ใช้ `sale_price1` (`price_engine.go:118-122`); `Price1`/`Price2` เก็บทั้งสองไว้ให้หน้าจอเตือนข้ามชนิด
- สูตรราคา: เลือกแถว `ic_inventory_price_formula` ตามหน่วย `sale_type` (0 กับชนิดขาย) และ `tax_type` (0 กับ VatType 0->1, 1->2, 2->3) แล้วเลือกคอลัมน์ `price_0..price_9` ตาม `ar_customer.price_level` (1-9; นอกนั้นใช้ `price_0`) ส่งให้ `calcFormulaPrice` ซึ่งตีความ `=ราคา,ส่วนลด` / `-ส่วนลด` / `+ส่วนลด` / ตัวเลขล้วน ([[proc-grid-calc]]) (`price_engine.go:133-145`, `:205`)
- ราคาล่าสุด: อ่านจาก `ic_trans_detail` ของ `trans_flag = 44` (`last_status = 0`, `price_exclude_vat > 0`) ของลูกค้าเดียวกัน (ใช้ `cust_code` ของหัวเอกสารถ้าแถวไม่มี); ถ้า VatType เป็นรวมใน (1) บวก VAT เพิ่มจากอัตราของเอกสาร (`:157-179`)
- ถ้าเจอราคาและ option `PriceFormulaControl` เปิดและมีสูตร: ใส่ `StandPrice = price_0` ให้ตารางแสดงราคามาตรฐานข้างราคาจริง (`:180-182`)
- **ส่วนลดตั้งต้น** หาทุกครั้งแม้ไม่พบราคา: `ic_inventory_discount` ตามลำดับ ลูกค้า (`discount_type = 2`) -> กลุ่ม (`discount_type = 1`) -> ทั่วไป (`discount_type = 0`) ได้ค่าแรกที่เจอเก็บใน `DefaultDiscount` (`saleDiscountSteps`, `:79`) และ `applySalePrice` เขียนทับช่องส่วนลดของแถว

### 3. ผลที่ตกถึงแถวสินค้า (`applySalePrice`, `trans_grid.go:564`)
- เขียน `PriceType`, `PriceMode`, `PriceRoworder` (แถว `ic_inventory_price` ที่ใช้ — 0 สำหรับสูตร/บาร์โค้ด/ราคาล่าสุด), `PriceGuid` (ศูนย์ราคาเท่านั้น), `Price`, `SetRefPrice`, `Price0` (เมื่อมี `StandPrice`)
- เขียนราคาลงแถวแม้ไม่พบ (ได้ 0) ตามคอมเมนต์ C#
- คำเตือน (`salePriceWarnings`, `trans_grid.go:540`): option `WarningPrice1` เปิดและไม่พบราคา (สินค้า `ItemType` ไม่ใช่ 3/5) -> "ไม่พบราคาสินค้า"; option `WarningPrice2` เปิดและพบราคาแต่เป็น 0 -> ถามยืนยันใช้ราคาอีกชนิด (VatType 0 แต่มีแต่ราคารวมใน, หรือกลับกัน) พร้อม `YesPrice` ที่แปลงด้วย VAT ของเอกสาร

### 4. ลำดับหาราคาซื้อ (`findPurchasePrice`, `price_engine.go:237`)
1. `ic_inventory_purchase_price` เฉพาะผู้ขาย: `supplier_code = custCode` และ `price_type = 3`
2. ราคาซื้อทั่วไป: `price_type = 1`
3. ราคาซื้อล่าสุดจาก `ic_trans_detail` ของ `trans_flag IN (12, 315)` (`last_status = 0`, `qty <> 0`, `price_exclude_vat > 0`) -- คอลัมน์ราคาเป็น `d.price` หรือ `d.price_2` เมื่อ `MultiCurrency` เปิด
- ใช้วันที่ **วันนี้** (ไม่ใช่วันที่เอกสาร) ตามคอมเมนต์ C# cs:10534 (`purchasePrice` ส่ง `g.today`)
- เลือกคอลัมน์ราคา: `sale_price2` เมื่อ `VatType <> 0`; ถ้า option `PurchaseZeroVatUsePrice1` เปิด ใช้ `sale_price2` เฉพาะ `VatType = 1` (รวมใน) ส่วนที่เหลือใช้ `sale_price1`
- ส่วนลดของแถวราคา (`discount`) ถูกคืนใน `DefaultDiscount` และ `purchasePrice` ตั้งเป็นส่วนลดแถวเมื่อเจอ (`trans_grid.go:533-535`)
- แถวของแถม (`IsPermium = 1`) ได้ราคา 0 โดยไม่ค้น

### 5. ศูนย์ราคา (`price_center.go`)
- `loadPriceCenter` อ่าน `erp_option.use_price_center`, `price_list_server`, `home_currency` ครั้งเดียวต่อคำขอตาราง (`trans_grid.go:156`)
- ถ้าเปิด: `gridCtx.salePrice` ไม่ค้น `ic_inventory_price` เลย ส่ง GET ไปยัง `price_list_server` พารามิเตอร์ `item_code`, `unit_code`, `qty`, `cust_code` (ถ้ามี), `doc_date`, `sale_type`, `vat_type`, `branch` (+ `use_currency`, `currency`, `home_currency` เมื่อหลายสกุลเงิน) และต่อส่วน `?...` ที่ตั้งไว้ใน `price_list_server` ท้ายคำขอ
- ตรวจครั้งเดียวต่อคำขอว่าบริการใหม่ (`/BCPriceCenter/pricelistservice`) ตอบ 200 หรือไม่ ถ้าไม่ใช้พาธเก่า (`/BCJavaRESTService/service/pricelist/price`)
- `sale_type` ที่ส่ง: 0 ถ้าจอไม่ใช่ flag 30/34/36/44; เป็น 2 เมื่อ `inquiryType` 0 หรือ 2 และเครดิตเกิน 7 วัน; นอกนั้น 1 (`centerSaleType`, `:95`). `vat_type` แปลงเป็น 1/2/3 และ "ไม่กระทบภาษี" ส่งว่าง (`centerVatType`)
- ตอบกลับต้องเป็น JSON `{price, price_guid}`: ราคา 0 หรือไม่มี = ไม่พบ; พบแล้ว `Type = Mode = 99`, `price_guid` เก็บลงแถว (ยาวเกิน 55 ตัวอักษรถูกปฏิเสธเพราะคอลัมน์ `ic_trans_detail.price_guid` ยาว 55) (`parseCenterPrice`, `:210`)
- ความปลอดภัย: `priceCenterClient` ไม่ใช้ proxy และตรวจ IP ปลายทางทุกการต่อ (รวมทุก redirect) ปฏิเสธ loopback / link-local / unspecified (`priceCenterDialGuard`, `:47`); ตอบกลับอ่านได้ไม่เกิน 1 MB; งบเวลาต่อหนึ่งคำขอตาราง 30 วินาที (`priceCenterBudget`); ค่าที่ต่อ URL ผ่าน `url.QueryEscape`
- สาขา POS ของศูนย์ราคา (`_findPricePOS`) **ยังไม่พอร์ต** (ระบุไว้ในคอมเมนต์หัวไฟล์ รอลุงจืดตัดสิน)
- ศูนย์ราคาล้มเหลว = error "ดึงราคาจากศูนย์ราคา ไม่สำเร็จ" (ไม่ถอยกลับไปราคาในฐานข้อมูล)

### 6. หน้าต่างดูราคา (`POST /process/transgrid/priceinfo`)
- `TransGridPriceInfo` (`price_info.go:66`) รับ `itemCode`, `custCode` ผลลัพธ์ 3 ชุด: `normal` (`price_type 1`, `price_mode 1`), `group` (`price_type 2`, `price_mode 1` กรองด้วย `ar_customer_detail.group_main` ของลูกค้าถ้ามี), `standard` (`price_type 1`, `price_mode 0`) พร้อม `custGroup`
- แต่ละแถวมี `unitCode/unitName`, `salePrice1/2`, `fromQty/toQty`, `fromDate/toDate`, `saleType`, `status`, ชื่อกลุ่ม และ `roworder` (หน้าจอใช้ไฮไลต์แถวที่แถวสินค้าใช้อยู่ ตามคอมเมนต์ cs:78-90)
- ตารางเรียงตาม `unit_code, roworder`; ตัวเลขผ่าน `trimDecimal` (ไม่ใช้ float)
- สิทธิ์ `read`

### 7. แก้ราคาบาร์โค้ดทีละรายการ (`POST /process/stocktools/checkpricesave`)
- `CheckPriceSave` (`check_price.go:48`) รับ `barcode`, `newPrice` (+ `StockScope` ของ provider/database/user) — พอร์ตจาก `_checkPriceUserControl.cs:72-111`
- เงื่อนไข: ต้องมีบาร์โค้ด (แปลงตัวพิมพ์ใหญ่) และราคาใหม่ต้อง **มากกว่า 1** (`priceFloor`) ทศนิยมตาม `stockScales`
- ใน transaction เดียว: ล็อกแถว `ic_inventory_barcode` (`FOR UPDATE`) อ่านราคาเดิม -> `UPDATE ... SET price` ทุกแถวที่ `upper(barcode)` ตรงกัน -> เขียนตาราง `logs` ผ่าน `writeProcessLog` (เมนู "ตรวจสอบราคา", รายละเอียด `oldPrice`/`newPrice`); ไม่พบบาร์โค้ด -> "ไม่พบบาร์โค้ด ..."
- คืน `{barcode, oldPrice, newPrice}`; สิทธิ์ `write`

### 8. ปรับปรุงราคาหลายแถว (`POST /process/modifyprice/{preview|apply}`)
เมนู 2.1.25 ตามคอมเมนต์ handler (`docpicture_handler.go:111`) พอร์ตจาก `BCERPIC/_icModifyPrice.cs` หน้าเว็บอ่านไฟล์เข้าตาราง ส่งแถวมาเป็น `rows` (แต่ละแถวเป็น map ชื่อคอลัมน์ -> ข้อความ)

**ชนิดราคา (`kind`)** กำหนดที่ `modifyPriceKinds` (`modify_price.go:32`)
| `kind` | ตาราง | `price_type` / `price_mode` | คอลัมน์ราคา |
|---|---|---|---|
| `standard_1/2/3`, `general_1/2/3` | `ic_inventory_price` | ประเภท 1 สินค้า / 2 กลุ่มลูกค้า / 3 ลูกค้า; `standard` = mode 0, `general` = mode 1 | `sale_price1`, `sale_price2` |
| `barcode` | `ic_inventory_barcode` | - | `price`, `price_member`, `price_2..4`, `price_member_2..4` |
| `formula` | `ic_inventory_price_formula` | - | `price_0..price_9` |
- คอลัมน์คีย์เพิ่มของชนิด 2 = `cust_group_1`, `cust_group_2`; ชนิด 3 = `cust_code`

**ขั้นตอน** (`modifyPrice`, `:84`)
1. ตรวจ `kind`, ต้องมีแถว, ไม่เกิน `modifyPriceMaxRows` = 5000 แถว
2. `preview` เปิด transaction แบบ read-only (ไม่เขียน); `apply` เปิด transaction เขียน พร้อมล็อก `pg_advisory_xact_lock(hashtext('modifyprice'))` ให้รันทีละงาน (เหตุผลในคอมเมนต์: ตาราง `ic_inventory_price` ไม่มีคีย์ unique ให้พึ่ง)
3. `planModifyPrice` (`:145`): ตรวจรหัสสินค้ามีจริงในครั้งเดียว (`existingItems`, ยกเว้นชนิด `barcode`) แล้วทีละแถว `parseModifyPriceRow` -> `run`
4. ผลต่อแถว `ModifyPricePlan{row, action, oldPrice, reason}` โดย `action` = `update` | `insert` | `skip`; สรุปรวม `updated/inserted/skipped`
5. `apply` เขียน `master_logs` 1 แถว (`function_code 1`, menu `ModifyPrice`, `data1` = JSON ของ kind/zeroOption/rows/plans) (`writeModifyPriceLog`, `:396`)

**กติกาต่อแถว** (`parseModifyPriceRow`, `:193`)
- ฟิลด์ข้อความยาวเกิน 50 ตัวอักษร -> skip; ชนิดสินค้าต้องมี `ic_code` และ `unit_code`; ชนิด `barcode` ต้องมี `barcode`
- `sale_type`/`tax_type` ต้องเป็นจำนวนเต็ม 0-32767; `from_date`/`to_date` (`ปปปป-ดด-วว`) มีผลเมื่อใส่ครบคู่; `from_qty`/`to_qty` มีผลเมื่อทั้งคู่ไม่ใช่ 0 (ใช้กับ `ic_inventory_price` เท่านั้น)
- ช่องราคาว่าง = ไม่แก้; ใส่ 0 จะข้ามเว้นแต่ผู้ใช้ติ๊ก `zeroOption`; ถ้าไม่มีช่องราคาที่ต้องแก้ -> skip
- `match` ค้นแถวเดิมด้วยคีย์ที่กรอก (สินค้า+หน่วย+ประเภท/โหมด และ `sale_type`/คีย์ลูกค้า/`tax_type`/ช่วงวันที่/ช่วงจำนวนเฉพาะที่กรอก): เจอ -> `update` แถวแรกตาม `roworder`; ไม่เจอ -> `insert` (ชนิด `barcode` ไม่เจอ = skip "ไม่พบบาร์โค้ด")
- ค่าตั้งต้นตอน `insert` ของ `ic_inventory_price`: จำนวน 1..999999 และวันที่ 1 ม.ค.-31 ธ.ค. ของปีปัจจุบัน ถ้าไม่ได้ระบุ (`insertValues`, `:359`) -- โค้ดเก่า C# ทิ้ง `sale_type`/`tax_type` ตอน insert แล้วเกิดแถวซ้ำทุกรอบ ฝั่ง Go เขียนค่านี้ลงด้วย

**สิทธิ์:** `modifyprice/preview` = `read`, `modifyprice/apply` = `write` (`permission.go:32,42`) ดู [[proc-permission-rights]]

## จุดที่ต้องระวัง
- ราคาขายเลือกราคาที่ "เฉพาะเจาะจงที่สุดก่อน" (ลูกค้า > กลุ่ม > ทั่วไป > มาตรฐาน) ไม่ใช่ราคาต่ำสุด; ขั้น 3 กับ 4 ได้ `Type` เท่ากัน (3) แยกกันที่ `Mode` (1 หรือ 0)
- `ic_inventory_price` ใน `modify price` ไม่มี unique key: ถ้าไม่กรอกคีย์เสริม (วันที่/จำนวน/ประเภทขาย) การจับคู่จะ update แถวแรกที่ตรงเงื่อนไขเท่านั้น
- ศูนย์ราคาเปิดอยู่ = ราคา local ในตาราง `ic_inventory_price` ไม่ถูกใช้ตอนกรอกเอกสาร (มีผลเฉพาะ flag ขาย/ที่เรียก `salePrice`)
- `price_list_server` ที่ชี้ localhost จะถูกปฏิเสธ

## ที่มาในโค้ด
- `backend/internal/application/process/price_engine.go:18` - `priceResult`; `:49-65` `priceCond`, `custGroupCond`; `:67` `salePriceSteps`; `:79` `saleDiscountSteps`; `:103` `findSalePrice`; `:205` `priceFormulaRow`; `:237` `findPurchasePrice`
- `backend/internal/application/process/price_center.go:39-57` - `priceCenterClient` และ `priceCenterDialGuard`; `:71` `loadPriceCenter`; `:81` `gridCtx.salePrice`; `:95` `centerSaleType`; `:129` `priceCenterURL`; `:163` `find`; `:210` `parseCenterPrice`
- `backend/internal/application/process/price_info.go:50` - `priceInfoSQL`; `:66` `TransGridPriceInfo`
- `backend/internal/application/process/check_price.go:31` - `checkPriceArgs`; `:48` `CheckPriceSave`
- `backend/internal/application/process/modify_price.go:22` - `modifyPriceMaxRows`; `:32` `modifyPriceKinds`; `:84` `modifyPrice`; `:145` `planModifyPrice`; `:193` `parseModifyPriceRow`; `:260` `match`; `:303` `run`; `:359` `insertValues`; `:396` `writeModifyPriceLog`
- `backend/internal/application/process/trans_grid.go:96-97` - `salePriceFlags`, `purchasePriceFlags`; `:156` โหลดศูนย์ราคา; `:461` `priceQuery`; `:490-497` จุดเรียก; `:529` `purchasePrice`; `:540` `salePriceWarnings`; `:564` `applySalePrice`
- `backend/internal/application/process/grid_calc.go:232` - `calcFormulaPrice`
- `backend/internal/application/process/workflow.go:65` - `writeProcessLog`
- `backend/internal/adapter/inbound/http/process/transgrid_handler.go:54` - action `priceinfo`; `stocktools_handler.go:168` - `checkpricesave`; `docpicture_handler.go:111-135` - `modifyprice`; `permission.go:29,32,42,44` - สิทธิ์

## ดูเพิ่ม
- [[proc-grid-calc]]
- [[proc-barcode]]
- [[proc-master-data]]
- [[proc-item-master-detail]]
- [[proc-stock-tools]]
- [[proc-dispatcher]]
- [[proc-permission-rights]]
- [[process-overview]]
