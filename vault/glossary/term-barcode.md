---
title: "บาร์โค้ดสินค้า (barcode / ic_inventory_barcode)"
tags: [glossary, ic, barcode, pos]
aliases: ["บาร์โค้ด", "barcode", "ic_inventory_barcode", "BarcodeRow", "SaveBarcodes", "กำหนดบาร์โค้ดสินค้า", "เพิ่มบาร์โค้ดด่วน", "EAN13", "พิมพ์บาร์โค้ด", "ราคาสมาชิก", "price_member", "ราคาตามบาร์โค้ด", "สินค้าลดล้าง", "is_clearance", "ไม่คิดแต้ม", "no_point"]
sources: ["backend/internal/application/process/barcode.go:34", "backend/internal/application/process/barcode.go:143", "backend/internal/application/process/barcode.go:252", "backend/internal/application/process/barcode.go:305", "frontend/src/config/bcMenu.json:2044", "frontend/src/config/bcMenu.json:2056", "frontend/src/config/bcMenu.json:2173", "frontend/src/config/bcMenu.json:2186", "frontend/src/config/schemas/icMasterSchemas.ts:1148", "frontend/account/master/BarcodeScreens.tsx:767"]
---

# บาร์โค้ดสินค้า

## ในระบบนี้คืออะไร
สินค้าหนึ่งตัวมีได้หลายบาร์โค้ด แต่ละบาร์โค้ดผูกกับหน่วยนับและราคาของตัวเอง เก็บในตาราง `ic_inventory_barcode` จอหลักคือ "กำหนดบาร์โค้ดสินค้า" (bcMenu.json:2044, `icMasterSchemas.ts:1148`)
เมนูที่เกี่ยวกับบาร์โค้ด ได้แก่ `menu_ic_item_barcode` (:2043), `menu_ic_item_add_barcode_fast` (:2056), `menu_ic_item_barcode_checker_ean13` (:2173), `menu_ic_item_barcode_laser_print` (:2186) ใน `bcMenu.json`

## คอลัมน์ / JSON (`BarcodeRow`, `barcode.go:34-52`)
| JSON | ความหมายจากชื่อฟิลด์ |
|---|---|
| `barcode` | รหัสบาร์โค้ด |
| `unitCode` / `unitName` | หน่วยนับของบาร์โค้ด (join `ic_unit`) |
| `description` | รายละเอียด |
| `price`, `priceMember` … `price4`, `priceMember4` | ราคาขาย 4 ระดับ และราคาสมาชิก 4 ระดับ เก็บเป็น decimal string |
| `hiddenText`, `noPoint`, `isClearance` | ธงตัวเลข |
| `fromDate` / `toDate` | ช่วงวันที่ |
- ในจอบาร์โค้ด กริดเลือกหน่วยมีหัวคอลัมน์ "หน่วยนับ, ชื่อ, ตัวตั้ง, ตัวหาร" (`BarcodeScreens.tsx:767`) ดู [[term-unit-ratio]]

## พฤติกรรม
- ค้นสินค้าจากบาร์โค้ดด้วย `upper(barcode)` ไม่สนตัวพิมพ์เล็กหรือใหญ่ (`barcode.go:143`)
- `SaveBarcodes` ลบบาร์โค้ดทั้งหมดของสินค้าแล้วใส่กริดใหม่ใน transaction เดียว (ลบที่ `barcode.go:305`) และเลือกได้ว่าจะเพิ่มที่เก็บลง `ic_wh_shelf.shelf_list` ด้วยหรือไม่ (`appendShelf`, `barcode.go:338-359`) ถ้าไม่เลือกสินค้าจะแจ้ง "กรุณาเลือกสินค้า" (`barcode.go:255`)

## ข้อควรระวัง
- ความหมายของ `hiddenText`, `noPoint` และ `isClearance` ในตารางด้านบนอ่านจากชื่อฟิลด์เท่านั้น ยังไม่ได้ตรวจตรรกะที่ใช้
- ราคาในบาร์โค้ดเป็นคนละแหล่งกับตารางราคาขายมาตรฐาน ดู [[term-price-discount]] และ [[proc-price-engine]]

## ลิงก์
[[proc-barcode]] · [[term-unit-ratio]] · [[term-price-discount]] · [[glossary-overview]]

## ที่มาในโค้ด
- `backend/internal/application/process/barcode.go:34-52`, `:143`, `:252-255`, `:305`, `:338-359`
- `frontend/src/config/bcMenu.json:2043-2044`, `:2056`, `:2173`, `:2186`
- `frontend/src/config/schemas/icMasterSchemas.ts:1148`
- `frontend/account/master/BarcodeScreens.tsx:767`
