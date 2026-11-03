---
title: "เครื่องมือสต็อก กลุ่ม route stocktools (Stock Tools)"
tags: [process, stock, stocktools, barcode, serial, handler]
aliases: ["stocktools", "StockTools", "stocktools/{action}", "formats", "barcodecheck", "serialanalyze", "serialscan", "serialcountsave", "itemnextcode", "ตรวจบาร์โค้ด", "ตรวจนับ serial", "เครื่องมือสต็อก"]
sources: ["backend/internal/adapter/inbound/http/process/stocktools_handler.go:89", "backend/internal/adapter/inbound/http/router.go:162", "backend/internal/adapter/inbound/http/router.go:203", "backend/internal/adapter/inbound/http/process/permission.go:33", "backend/internal/application/process/stock_tools.go:49", "backend/internal/application/process/stock_tools.go:104", "backend/internal/application/process/stock_tools.go:187", "backend/internal/application/process/stock_tools.go:219", "backend/internal/application/process/stock_tools.go:280", "backend/internal/application/process/stock_tools.go:354", "backend/internal/application/process/stock_tools.go:530", "backend/internal/application/process/stock_tools.go:652"]
---

# เครื่องมือสต็อก กลุ่ม route stocktools (Stock Tools)

`POST /process/stocktools/{action}` (และ `/api/v1/process/stocktools/{action}`) เป็นกลุ่ม route เดียวที่รวมเครื่องมือฝั่งสินค้า/สต็อกหลายจอ: ตัวตรวจบาร์โค้ด, วิเคราะห์และตรวจนับ Serial Number, ปรับปรุงสต็อก lot, ต้นทุนแฝง, ยอดยกมาสินค้า, เอกสารแต้ม ฯลฯ handler เดียวคือ `Handler.StockTools` ใช้ helper `serve` ตัวกลางเดียวกับกลุ่มอื่น ดู [[proc-dispatcher]]

## ทำงานอย่างไร

### ตาราง action ทั้งหมด
ทุก action ผ่าน `serve` เมธอด POST; `small` = 4 MiB (`stocktools_handler.go:90`) ยกเว้นที่ระบุ

| action | สิทธิ์ | ฟังก์ชันใน service | หมายเหตุ |
|---|---|---|---|
| `formats` | read | `StockDocFormats` `stock_tools.go:49` | อ่าน `erp_doc_format` ตาม `screenCodes` (1-8 รายการ, สูงสุด 200 แถว) ใช้กับตัวเลือกรูปแบบเอกสาร IA/IS/CO |
| `docnonext` | read | `NextDocNo` `doc_no_next.go:59` | เลขเอกสารถัดไป ดู [[proc-doc-flow-numbering]] |
| `barcodecheck` | read | `BarcodeCheck` `:104` | ตรวจบาร์โค้ดที่วาง/นำเข้า (ด้านล่าง) |
| `serialanalyze` | read | `SerialAnalyze` `:219` | วิเคราะห์ประวัติเคลื่อนไหว Serial |
| `serialscan` | read | `SerialScan` `:280` | สแกน Serial หนึ่งตัวหาสินค้า |
| `serialcountsave` | write | `SerialCountSave` `:354` | บันทึกตรวจนับ Serial (body สูงสุด 8 MiB) |
| `itemnextcode` | read | `ItemNextCode` `:652` | รหัสสินค้าถัดไปของช่องรหัส |
| `itemsaved` | write | `ItemSaved` `:530` | งานหลังบันทึกสินค้า ดู [[proc-item-master-detail]] |
| `checkpricesave` | write | `CheckPriceSave` `check_price.go:48` | ดู [[proc-price-engine]] |
| `hiddencostcalc` / `hiddencostsave` / `hiddencostdelete` | read / write / del | `hidden_cost.go:277/323/458` | ดู [[proc-hidden-cost]] |
| `lotamountload` / `lotamountsave` | read / write | `stock_lot.go:347/387` | ปรับปรุงสต็อก lot ตามยอด (กลุ่ม stock -- นอกขอบเขตโน้ตนี้) |
| `lotautolist` / `lotautocheck` / `lotautorun` | read / read / write | `stock_lot.go:481/552/617` | ปรับสต็อก lot อัตโนมัติ (กลุ่ม stock) |
| `notcountedlist` / `notcountedrun` | read / write | `stock_lot.go:883/901` | สินค้าที่ไม่ได้ตรวจนับ (กลุ่ม stock) |
| `stockbeginningsave` / `stockbeginningdelete` | write / del | `stock_beginning.go:307/356` | ยอดยกมาสินค้า flag 54 (body สูงสุด 24 MiB; กลุ่ม stock) |
| `pointdocsave` / `pointdocdelete` | write / del | `point_doc.go:92/160` | เอกสารแต้ม flag 801, 802 (กลุ่ม stock/point) |

สิทธิ์อ้างจาก `permission.go:33-47` ดู [[proc-permission-rights]]; `stockbeginningsave` และ `pointdocsave` ถูก `RequiredRight` เปิดอ่าน body: `isNew = true` ต้องสิทธิ์เพิ่ม (`RightAdd`) นอกนั้นสิทธิ์แก้ไข (`RightEdit`) (`permission.go:79-85`)

### ตรวจบาร์โค้ด (`barcodecheck`)
- `BarcodeCheckInput.barcodes[]` ตัดช่องว่างต้น-ท้าย ข้ามค่าว่าง แต่ละตัวยาวเกิน 50 ตัวอักษรไม่ผ่าน; ต้องมี 1 ถึง 2000 รายการ (`barcodeCheckMax`, `stock_tools.go:77`)
- ค้นใน `ic_inventory_barcode` อ่านอย่างเดียว คืน `rows[]` (`barcode`, `found`, `itemCode`, `name`, `unitCode`, `price`..`price4`) ตามลำดับ input และ `notFound[]` (`notFound[]` ส่งกลับเสมอ แม้ไม่พบเลยสักตัว; คอมเมนต์ :101-103)
- ตัวจัดการบาร์โค้ดเต็ม (บันทึก, ลดราคา, EAN13) แยกอยู่ที่ route `barcode/{action}` ดู [[proc-barcode]]

### วิเคราะห์ Serial (`serialanalyze`)
`analyzeSerialMoves` (:187) เดินประวัติ `ic_trans_serial_number` ต่อ (สินค้า, serial) ตามวัน-เวลา: จ่ายออก (-1) โดยไม่มีรับเข้ามาก่อน หรือจ่ายจากคลัง/ที่เก็บต่างจากการรับล่าสุด (+1) ถือเป็นผิดปกติ (คอมเมนต์ :184-186) คืน `rows[]` {`itemCode`, `serialNumber`, `reason`, `docNo`} และ `scanned` อ่านอย่างเดียว; `itemCode` เป็นตัวกรองไม่บังคับ

### ตรวจนับ Serial (`serialscan`, `serialcountsave`)
- `SerialScan` แปลง serial หนึ่งตัวเป็นสินค้า (join `ic_serial` กับสินค้าและหน่วย) คืน `found`, `itemCode`, `itemName`, `unitCode`, `price`
- `SerialCountSave` บันทึกใบตรวจนับ `ic_trans` flag 76 พร้อม `ic_trans_detail` และ `ic_trans_serial_number` ต่อ serial (คอมเมนต์ :351-353); ต้องมี `whCode`+`shelfCode`, `docDate` รูปแบบ `YYYY-MM-DD`, serial 1-5000 ตัว (`serialCountMax` :323) ไม่ว่าง ไม่ซ้ำ (ตัวพิมพ์ใหญ่); เซิร์ฟเวอร์อ่าน serial ซ้ำจาก `ic_serial` เอง; บันทึก `docNo` เดิมซ้ำจะแทนที่เอกสาร; รวมเป็นบรรทัดต่อสินค้า (qty = จำนวน serial, ราคาของ serial ตัวแรก) ใน `groupSerialLines` (:332)

### รหัสสินค้าถัดไป (`itemnextcode`)
(คอมเมนต์ :635-638) ถ้าพิมพ์รหัสรูปแบบ `erp_doc_format` ใช้ `autoRunPattern`/`autoRunNext`; มิฉะนั้นหารหัสสูงสุดที่ขึ้นต้นด้วยข้อความที่พิมพ์แล้วบวกเลขท้าย 1 (`typedPrefixNext`: "A" กับ "A0099" ให้ "A0100") ไม่จองเลข ตัว primary key ของ `ic_inventory` กันบันทึกรหัสซ้ำ input `code`, `date` (ค่าตั้งต้นวันนี้) คืน `code`, `format`

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/process/stocktools_handler.go:89-185` - `StockTools` switch ตาม `{action}`
- `backend/internal/adapter/inbound/http/router.go:162,203` - ผูก `/stocktools/{action}` ทั้ง 2 กลุ่ม (`/process` และ `/api/v1/process`)
- `backend/internal/adapter/inbound/http/process/permission.go:33-47` - สิทธิ์ต่อ action
- `backend/internal/application/process/stock_tools.go:35-73` - `StockDocFormats`
- `backend/internal/application/process/stock_tools.go:75-155` - `BarcodeCheck`
- `backend/internal/application/process/stock_tools.go:157-251` - `SerialAnalyze`
- `backend/internal/application/process/stock_tools.go:253-479` - `SerialScan`, `SerialCountSave`
- `backend/internal/application/process/stock_tools.go:634-697` - `ItemNextCode`, `autoRunPattern` (:701), `autoRunNext` (:725), `typedPrefixNext` (:739)

## ดูเพิ่ม
- [[proc-hidden-cost]]
- [[proc-barcode]]
- [[proc-price-engine]]
- [[proc-item-master-detail]]
- [[proc-doc-flow-numbering]]
- [[proc-dispatcher]]
- [[proc-permission-rights]]
- [[process-overview]]
