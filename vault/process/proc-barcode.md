---
title: "บาร์โค้ดสินค้า ส่วนลดบาร์โค้ด EAN13 และพิมพ์ป้าย (Barcode menus 2.1.7-2.1.17)"
tags: [process, barcode, ean13, discount, ic_inventory_barcode, label-print, master]
aliases: ["barcode/item", "barcode/save", "barcode/discount-load", "barcode/discount-save", "ean13-check", "ean13-generate", "ean13-apply", "barcode/print-items", "barcode/format", "ic_inventory_barcode_price", "bc_barcode_print_format", "SaveBarcodes", "BarcodeDiscountSave", "ส่วนลดบาร์โค้ด", "ป้ายบาร์โค้ด", "ตรวจ EAN13"]
sources: ["backend/internal/application/process/barcode.go:123", "backend/internal/application/process/barcode.go:217", "backend/internal/application/process/barcode.go:252", "backend/internal/application/process/barcode.go:340", "backend/internal/application/process/barcode.go:383", "backend/internal/application/process/barcode.go:436", "backend/internal/application/process/barcode.go:472", "backend/internal/application/process/barcode.go:531", "backend/internal/application/process/barcode.go:588", "backend/internal/application/process/barcode.go:661", "backend/internal/application/process/barcode_discount.go:23", "backend/internal/application/process/barcode_discount.go:83", "backend/internal/application/process/barcode_discount.go:253", "backend/internal/application/process/barcode_discount.go:306", "backend/internal/adapter/inbound/http/process/barcode_handler.go:14", "backend/internal/adapter/inbound/http/process/permission.go:102"]
---

# บาร์โค้ดสินค้า ส่วนลดบาร์โค้ด EAN13 และพิมพ์ป้าย (Barcode menus 2.1.7-2.1.17)

กลุ่ม route `POST /process/barcode/{action}` รองรับเมนูสินค้า 6 เมนู (ตามคอมเมนต์ในโค้ด): 2.1.7 แก้บาร์โค้ดของสินค้า, 2.1.8 ส่วนลดบาร์โค้ดรายตัว, 2.1.9 ส่วนลดหลายบาร์โค้ด, 2.1.14 เพิ่มบาร์โค้ดด่วน, 2.1.16 ตรวจ/สร้าง EAN13 ใหม่, 2.1.17 พิมพ์ป้ายบาร์โค้ด ทั้งหมดพอร์ตจากโปรแกรม C# (`BCERPIC/_icBarcode.cs`, `_icBarcodeDiscount.cs`, `BCBarcodeManage/*`) ตารางหลักคือ `ic_inventory_barcode` และ `ic_inventory_barcode_price`

## ทำงานอย่างไร

### Action และสิทธิ์
| Action | เมธอด | ใช้ทำอะไร | สิทธิ์ |
|---|---|---|---|
| `item` | `BarcodeItem` | โหลดสินค้าพร้อมบาร์โค้ด หน่วย ที่เก็บ | read |
| `save` | `SaveBarcodes` | แทนที่บาร์โค้ดทั้งชุดของสินค้า | write |
| `discount-load` | `BarcodeDiscountLoad` | โหลดส่วนลด 5 ตารางของบาร์โค้ด | read |
| `discount-save` | `BarcodeDiscountSave` | บันทึกส่วนลด (แทนที่ หรือเพิ่มอย่างเดียว) | write |
| `ean13-check` | `Ean13Check` | หาบาร์โค้ด 13 หลักที่ EAN13 ผิด | read |
| `ean13-generate` | `Ean13Generate` | สร้างบาร์โค้ดใหม่ (ไม่เขียนฐานข้อมูล) | read |
| `ean13-apply` | `Ean13Apply` | เปลี่ยนบาร์โค้ดเก่าเป็นใหม่ | write |
| `print-items` | `BarcodePrintItems` | แถวข้อมูลสำหรับพิมพ์ป้าย | read |
| `format` | `BarcodeFormat` | รายการ/บันทึก/ลบ รูปแบบป้าย | ตาม `action` ในตัว body |
ที่มา: `barcode_handler.go:22-78`, สิทธิ์ `permission.go:26-28,40-41`; `barcode/format` ใช้ `peekJSON` อ่าน `action` ใน body: `save` = สิทธิ์ `RightAdd`, `delete` = `del`, อื่น ๆ = `read` (`permission.go:102-111`) ดู [[proc-permission-rights]]

### 1. โหลดสินค้าและบาร์โค้ด (`BarcodeItem`, `barcode.go:123`)
- รับ `code` เป็นรหัสสินค้า **หรือ** บาร์โค้ด (แปลงเป็นตัวพิมพ์ใหญ่, ไม่เกิน 100 ตัวอักษร): ค้น `ic_inventory.code` ก่อน ไม่พบก็ค้น `ic_inventory_barcode.barcode` แล้วย้อนไปสินค้า ไม่พบเลย = `found: false` (ไม่ error)
- คืน `item` (รหัส ชื่อ หน่วยมาตรฐาน `unitType` `itemType`), `barcodes[]` (เรียงตาม `line_number`, `roworder` มีราคา 8 ช่อง `price`, `priceMember`, `price2..4`, `priceMember2..4`, `hiddenText`, `noPoint`, `isClearance`, `fromDate`, `toDate`), `units[]` จาก `ic_unit_use`, `shelves[]` จาก `ic_wh_shelf` ราคาเป็นข้อความทศนิยม ไม่ใช่ float

### 2. บันทึกบาร์โค้ด (`SaveBarcodes`, `barcode.go:252`)
1. `cleanBarcodeRows`: ข้ามแถวบาร์โค้ดว่าง, ยาวเกิน 50 ตัวอักษรปฏิเสธ, ซ้ำในตารางเดียวกัน (ไม่สนตัวพิมพ์) ปฏิเสธ "บาร์โค้ดซ้ำ", หน่วยแปลงเป็นตัวพิมพ์ใหญ่, ราคา 8 ช่องผ่าน `normDecimal` (ตัด `,` ว่าง = `0`, รูปแบบผิด = "ตัวเลขไม่ถูกต้อง (...)")
2. ถ้าส่ง `shelf` มา ต้องมี `whCode` และ `locationCode` ด้วย มิฉะนั้นปฏิเสธ (ตาม C# "ข้อมูลไม่สมบูรณ์")
3. transaction เดียว (timeout 30 วินาที): ตรวจสินค้ามีจริง; ตรวจว่าบาร์โค้ดใหม่ไม่ถูกใช้กับสินค้าอื่น ("บาร์โค้ด X ถูกใช้แล้วกับสินค้า Y"); `DELETE` บาร์โค้ดทั้งหมดของสินค้านี้แล้ว `INSERT` ตามตาราง (`status = 1`, `line_number` ตามลำดับ, `description` ว่างใช้ชื่อสินค้า)
4. ถ้ามี `shelf`: `appendShelf` เติมรหัสที่เก็บต่อท้าย `ic_wh_shelf.shelf_list` (คั่นด้วย `,` ไม่เติมซ้ำ) ถ้าไม่มีแถว `(สินค้า, คลัง, ที่เก็บ)` จะ `INSERT` ใหม่
- ผล: `{itemCode, saved}`; สิ่งสำคัญ: เป็นการ **แทนที่ทั้งชุด** ส่งตารางที่ขาดแถวมา = แถวเหล่านั้นถูกลบ

### 3. ส่วนลดบาร์โค้ด (2.1.8 / 2.1.9, `barcode_discount.go`)
- ตาราง `ic_inventory_barcode_price` เก็บส่วนลด 5 ประเภท (`discount_type` 1-5 = ลดพิเศษทั่วไป / ลดพิเศษสมาชิก / ลดโปรโมชั่น / ลดสมาชิก / ลดพนักงาน ตามคอมเมนต์หัวไฟล์) โครงสร้างข้อมูลต้องคงรูปแบบ C# เพราะ `_findPriceClass.cs` อ่านตาราง (ตามคอมเมนต์)
- ต่อแถว: `priority`, `discountWord` (คำส่วนลดแบบขั้น เช่น `10%,5` ดู [[proc-grid-calc]]), `qtyBegin/qtyEnd`, `dateBegin/dateEnd`, `lockDay`, `lockDiscount`, `lockCodeList`, `status`
- `discount-load`: รับ `barcode` (ไม่เกิน 25 ตัวอักษร) คืน `header` (บาร์โค้ด รหัสสินค้า คำอธิบาย หน่วย ราคา) และ `grids` 5 ชุดเสมอ เรียงตาม `priority`
- `discount-save` (`BarcodeDiscountSave`): `replace = true` = 2.1.8 ลบแถวเดิมของบาร์โค้ดก่อนแล้วใส่ใหม่, `false` = 2.1.9 เพิ่มอย่างเดียว กับหลายบาร์โค้ด
- ข้อจำกัด (`discountMaxBarcodes` 500, `discountMaxGridRows` 100, `discountMaxInsertRows` 10000 = จำนวนบาร์โค้ด x แถวส่วนลด; `barcode_discount.go:23-28`)
- กติกา `cleanDiscountGrids`/`cleanDiscountRow`: `discountType` ต้อง 1-5 และไม่ซ้ำในคำขอ; แถวที่คำส่วนลดว่างถูกข้าม; คำส่วนลด <= 25 ตัวอักษร (ตามความกว้างคอลัมน์); `priority` 0-32767; `qty*` เป็นจำนวนเต็ม >= 0; `lockDiscount` 0 (ทุกเครื่อง) หรือ 1 (เฉพาะรหัสเครื่อง POS); `status` 0/1; `lockCodeList` <= 1000 ตัวอักษร; วันที่เป็น `YYYY-MM-DD` หรือว่าง (= NULL); `lockDay` เป็นเลข 0-6 (0 = อาทิตย์) เรียงและไม่ซ้ำ -- ติ๊กครบ 7 วันถือเป็น "ทุกวัน" เก็บเป็นค่าว่าง
- ทุกบาร์โค้ดต้องมีอยู่ใน `ic_inventory_barcode` (ไม่พบ = "ไม่พบบาร์โค้ด X") และค่าที่เก็บใช้ตัวพิมพ์ตามตารางนั้น; `canonicalBarcodes` ล็อกแถวด้วย `FOR UPDATE` ก่อน เพื่อให้สองคนบันทึกบาร์โค้ดเดียวกันต่อคิวกัน และ insert ผ่าน `pgx.Batch` ใน transaction เดียว (timeout 30 วินาที)

### 4. EAN13 (2.1.16)
- `invalidEAN13` ตรวจเฉพาะบาร์โค้ดยาว 13 ตัว: ไม่ใช่ตัวเลขล้วน/เป็น 0 ทั้งหมด/เลขตรวจ (หลักที่ 13) ไม่ตรง ถือว่าผิด (เลขตรวจ: หลัก index คี่ x 3 รวมกัน แล้ว `(10 - sum mod 10) mod 10`)
- `ean13-check`: ดึงทุกแถว `ic_inventory_barcode` ที่ `length(barcode) = 13` แล้วกรองที่ผิดคืนเป็น `Ean13Row`
- `ean13-generate` (`prefix` ตัวเลข 0-11 หลัก, `barcodes` 1-100000 รายการ): สร้างตัวใหม่ต่อบาร์โค้ดเดิม = prefix + เลขสุ่มจนครบ 12 หลัก + เลขตรวจ ไม่ซ้ำกันเองและไม่ซ้ำกับทุกบาร์โค้ดในฐานข้อมูล (ลองได้ 1000 ครั้งต่อรายการ เกินแจ้ง "ตัวเลขนำหน้ายาวเกินไป") **ไม่เขียนฐานข้อมูล**
- `ean13-apply`: ตรวจ `barcodeNew` ต้อง 13 หลักตัวเลขและผ่านเลขตรวจ ไม่ซ้ำกันเอง แล้วใน transaction เดียว (timeout 60 วินาที) ตรวจว่าใหม่ยังไม่มีในฐานข้อมูล แล้ว `UPDATE ic_inventory_barcode SET barcode = ใหม่ WHERE barcode = เก่า`; คืน `{updated: จำนวนแถวที่แก้}`

### 5. พิมพ์ป้ายบาร์โค้ด (2.1.17)
- `print-items` (`BarcodePrintItems`): รับ `barcodes[]` (1-5000) **หรือ** `docNo` (ดึงบาร์โค้ดทุกตัวที่อยู่ใน `ic_trans_detail` ของเอกสารนั้น) คืนแถวพร้อมชื่อหน่วย ราคา 8 ช่อง และ `priceFormula` = `price_0` ของ `ic_inventory_price_formula` ของสินค้า/หน่วยนั้น (ไม่มี = `0`)
- `format` (`BarcodeFormat`): จัดการตาราง `bc_barcode_print_format` (`code`, `name`, `formatdata`): `list`, `save` (ลบแถวรหัสเดิมแล้วใส่ใหม่ใน transaction; ต้องมีรหัส <= 25 ตัวอักษรและชื่อ), `delete`; ข้อมูลรูปแบบ (หน่วย cm/inch, ขอบ, ขนาดป้าย, แถว/คอลัมน์, ชื่อบริษัท, ราคาที่แสดง ฯลฯ) เก็บเป็น JSON; อ่านแถวที่โปรแกรม C# เขียนไว้ (zip + XML) ได้ด้วย `decodeBarcodeFormat` อ่านไม่ได้จะใช้ค่าตั้งต้นของ C# (ฟิลด์ขนาดป้ายเป็น `float64` เพราะเป็นขนาดเรขาคณิต ไม่ใช่เงิน ตามคอมเมนต์)

## จุดที่ต้องระวัง
- `barcode/save` ลบแล้วใส่ใหม่ทั้งชุด: ส่งมาไม่ครบ = ข้อมูลหาย (ตามต้นฉบับ C#); ตรวจซ้ำกับสินค้าอื่นด้วยตัวพิมพ์ใหญ่
- บาร์โค้ดเดียวกันในส่วนลด/การพิมพ์ ค้นแบบไม่สนตัวพิมพ์ แต่ `ean13-apply` เทียบ `barcode = $` ตรง ๆ (ตัวพิมพ์เล็กใหญ่ต้องตรง)
- ตัวตรวจบาร์โค้ดซ้ำใน `stocktools/barcodecheck` (เมนู `menu_ic_item_barcode_checker`) เป็นคนละเครื่องมือ ดู [[proc-stock-tools]]
- แก้ราคาบาร์โค้ดเป็นก้อนหรือทีละตัว ดู [[proc-price-engine]] (`modifyprice` ชนิด `barcode`, `checkpricesave`)

## ที่มาในโค้ด
- `backend/internal/application/process/barcode.go:123` - `BarcodeItem`; `:135` `loadBarcodeItem`; `:217` `cleanBarcodeRows`; `:252` `SaveBarcodes`; `:340` `appendShelf`; `:383` `ean13CheckDigit`; `:406` `invalidEAN13`; `:417` `genEAN13`; `:436` `Ean13Check`; `:472` `Ean13Generate`; `:531` `Ean13Apply`; `:588` `BarcodePrintItems`; `:661` `BarcodeFormat`; `:715` `decodeBarcodeFormat`
- `backend/internal/application/process/barcode_discount.go:23` - ค่าคงที่; `:83` `BarcodeDiscountLoad`; `:147` `cleanDiscountGrids`; `:175` `cleanDiscountRow`; `:225` `normLockDay`; `:253` `BarcodeDiscountSave`; `:306` `saveBarcodeDiscountTx`; `:336` `canonicalBarcodes`
- `backend/internal/application/process/check_price.go:48` และ `modify_price.go:32` - ราคาบาร์โค้ด
- `backend/internal/adapter/inbound/http/process/barcode_handler.go:14` - handler; `permission.go:26-28,40-41,102-111` - สิทธิ์
- `backend/internal/adapter/inbound/http/router.go:152,193` - ลงทะเบียน `/barcode/{action}` ทั้ง `/process` และ `/api/v1/process`

## ดูเพิ่ม
- [[proc-price-engine]]
- [[proc-grid-calc]]
- [[proc-item-master-detail]]
- [[proc-master-data]]
- [[proc-stock-tools]]
- [[proc-dispatcher]]
- [[process-overview]]
