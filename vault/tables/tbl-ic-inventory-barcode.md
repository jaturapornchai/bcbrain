---
title: "บาร์โค้ดและราคาขายหน้าร้าน (ic_inventory_barcode)"
tags: [tables, ic]
aliases: ["ic_inventory_barcode", "บาร์โค้ดสินค้า", "ราคาบาร์โค้ด"]
sources: ["backend/internal/application/process/item_master.go:738", "backend/internal/application/process/barcode.go:33", "backend/internal/application/process/barcode.go:249", "backend/internal/application/process/check_price.go:14", "backend/internal/application/process/modify_price.go:44", "backend/internal/adapter/inbound/http/pos/handler.go:120"]
---
# บาร์โค้ดและราคาขายหน้าร้าน (`ic_inventory_barcode`)

**หน้าที่:** 1 แถว = 1 บาร์โค้ดของสินค้า ผูกกับหน่วยนับ และเก็บราคาขาย 4 ระดับ (ปกติ/สมาชิก x 4) ที่หน้าร้าน POS ใช้อ่านราคา ส่วนลดตามบาร์โค้ดอยู่ในตารางแยก [[tbl-ic-inventory-barcode-price]]

## คอลัมน์ (จาก INSERT ที่ `item_master.go:739` และ `BarcodeRow` ที่ `barcode.go:33-51`)

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `ic_code` | รหัสสินค้า ([[tbl-ic-inventory]]) | key ของกริดในหน้าสินค้า |
| `barcode` | รหัสบาร์โค้ด (เทียบแบบ `upper`; 13 หลักถูกตรวจ EAN13 ได้) | `barcode.go:143`, `:435-442` |
| `unit_code` | หน่วยนับของบาร์โค้ดนี้ ([[tbl-ic-unit]]) | `barcode.go:167` |
| `description` | ชื่อสินค้าสำเนาจาก `ic_inventory.name_1` (ถูกซิงก์ซ้ำหลังบันทึกสินค้า) | `item_master.go:739-746`, `stock_tools.go:508` |
| `price`, `price_2`, `price_3`, `price_4` | ราคาขายระดับ 1-4 | `barcode.go:37-44`, `modify_price.go:34` |
| `price_member`, `price_member_2`, `price_member_3`, `price_member_4` | ราคาสมาชิกระดับ 1-4 | เหมือนกัน |
| `hidden_text` | ซ่อนข้อความ/ราคา (0/1; ความหมายละเอียดไม่ชัดจากโค้ดที่อ่าน) | `item_master.go:745` |
| `no_point` | 1 = ไม่ให้แต้ม | `item_master.go:745` |
| `is_clearance` | 1 = สินค้าเคลียร์แรนซ์ | `item_master.go:745` |
| `from_date`, `to_date` | ช่วงวันที่ใช้บาร์โค้ด/ราคา | `item_master.go:745` |
| `status`, `line_number` | สถานะ / ลำดับบรรทัด | `item_master.go:739-746` |
| `roworder` | เลขแถวอัตโนมัติ ใช้เรียง "บาร์โค้ดแรก" ของสินค้า | `pos/handler.go:121-124`, `check_price.go:60` |

## ความสัมพันธ์

- n:1 กับ [[tbl-ic-inventory]] (`ic_code`); n:1 กับ [[tbl-ic-unit]] (`unit_code`)
- 1:n กับ [[tbl-ic-inventory-barcode-price]] ผ่านค่า `barcode` (ไม่ใช่ foreign key จริง; เชื่อมด้วย `upper(barcode)`)
- ราคาสูตร (`price_0..price_9`) อยู่ใน `ic_inventory_price_formula` เชื่อม `ic_code + unit_code` (`barcode.go:607`) — ดู [[tbl-group-ic]]

## ใครเขียน / อ่าน

- **เขียน:** บันทึกสินค้า (DELETE+INSERT ทั้งชุดของสินค้า, ข้ามถ้าโหมด sync) (`item_master.go:737-746`); `SaveBarcodes` แยกต่างหาก (`barcode.go:249-313`) ตรวจบาร์โค้ดซ้ำข้ามสินค้า (`barcode.go:295`); เปลี่ยนรหัสบาร์โค้ด (`barcode.go:559-566`); แก้ราคาทั้งชุด (`modify_price.go:44,267`); ปรับราคาจากหน้าตรวจราคา เฉพาะเมื่อมีบาร์โค้ดและราคาใหม่ > 1 (`check_price.go:14,60-66`)
- **อ่าน:** หน้าค้นหาสินค้า POS ใช้บาร์โค้ดแรก (`ORDER BY roworder LIMIT 1`) ของแต่ละสินค้า (`pos/handler.go:116-124`); ค้นสินค้าจากบาร์โค้ดในหน้ารายละเอียด (`item_detail.go:197`); รูปสินค้า (`item_picture.go:135,196`)

## ข้อควรระวัง

- ราคาเป็นค่าทศนิยม ใช้เป็น decimal string เท่านั้น (ห้าม float) ตามกฎบัญชี
- `description` ต้องตรงกับ `ic_inventory.name_1`; ถ้าไม่ตรงระบบจะแก้ให้หลังบันทึก (`stock_tools.go:508-510`)
- ต้องไม่มีบาร์โค้ดซ้ำข้ามสินค้า: `SaveBarcodes` เช็คก่อนเขียน (`barcode.go:295`)
- เปลี่ยนรหัสสินค้าแก้ `ic_inventory_barcode.ic_code` ด้วย (`workflow.go:136`)

## ที่มาในโค้ด

- `backend/internal/application/process/item_master.go:737-746`
- `backend/internal/application/process/barcode.go:33-51`, `:143`, `:167`, `:249-313`, `:435-442`, `:559-566`, `:607`
- `backend/internal/application/process/check_price.go:14-66`
- `backend/internal/application/process/modify_price.go:34`, `:44`, `:267`
- `backend/internal/application/process/stock_tools.go:508-510`
- `backend/internal/adapter/inbound/http/pos/handler.go:116-124`
- `backend/internal/application/process/item_detail.go:197`
