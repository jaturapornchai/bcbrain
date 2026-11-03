---
title: "บาร์โค้ดและราคาขายหน้าร้าน (ic_inventory_barcode)"
tags: [tables, ic]
aliases: ["ic_inventory_barcode", "บาร์โค้ดสินค้า", "ราคาบาร์โค้ด"]
sources: ["scripts/sql/02_data_schema.sql:5336", "backend/internal/application/process/item_master.go:377", "backend/internal/application/process/item_master.go:653", "backend/internal/application/process/item_master.go:738", "backend/internal/application/process/item_master.go:812", "backend/internal/application/process/barcode.go:33", "backend/internal/application/process/barcode.go:217", "backend/internal/application/process/barcode.go:252", "backend/internal/application/process/barcode.go:436", "backend/internal/application/process/barcode.go:531", "backend/internal/application/process/barcode.go:588", "backend/internal/application/process/check_price.go:30", "backend/internal/application/process/modify_price.go:44", "backend/internal/application/process/stock_tools.go:509", "backend/internal/application/process/workflow.go:136", "backend/internal/adapter/inbound/http/pos/handler.go:108", "frontend/account/master/ItemScreen.tsx:3598", "frontend/account/master/BarcodeScreens.tsx:271"]
---
# บาร์โค้ดและราคาขายหน้าร้าน (`ic_inventory_barcode`)

**หน้าที่:** 1 แถว = 1 บาร์โค้ดของสินค้า ผูกกับหน่วยนับ และเก็บราคาขาย 4 ระดับ (ปกติ/สมาชิก x 4) ที่หน้าร้าน POS ใช้อ่านราคา ส่วนลดตามบาร์โค้ดอยู่ในตารางแยก [[tbl-ic-inventory-barcode-price]]

## คอลัมน์ (DDL `scripts/sql/02_data_schema.sql:5336-5359`, INSERT `item_master.go:739-746`, `BarcodeRow` `barcode.go:33-51`)

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `ic_code` | รหัสสินค้า ([[tbl-ic-inventory]]) | key ของกริดในหน้าสินค้า |
| `barcode` | รหัสบาร์โค้ด (varchar 25 ตาม DDL; เทียบแบบ `upper`; 13 หลักถูกตรวจ EAN13 ได้) | `barcode.go:143`, `:436-442` |
| `unit_code` | หน่วยนับของบาร์โค้ดนี้ ([[tbl-ic-unit]]) | `barcode.go:167` |
| `description` | ชื่อสินค้าสำเนาจาก `ic_inventory.name_1` (ถูกซิงก์ซ้ำหลังบันทึกสินค้า) | `item_master.go:741`, `stock_tools.go:509-510` |
| `price`, `price_2`, `price_3`, `price_4` | ราคาขายระดับ 1-4 (numeric) | `barcode.go:37-44`, `modify_price.go:34` |
| `price_member`, `price_member_2`, `price_member_3`, `price_member_4` | ราคาสมาชิกระดับ 1-4 | เหมือนกัน |
| `hidden_text` | ช่อง "ไม่แสดง" (0/1) | `ItemScreen.tsx:3598-3603`, `BarcodeScreens.tsx:271` |
| `no_point` | ช่อง "ไม่สะสมแต้ม" (1 = ไม่ให้แต้ม) | `ItemScreen.tsx:3608-3613` |
| `is_clearance` | ช่อง "ลดล้างสต๊อก" (1 = สินค้าเคลียร์แรนซ์) | `ItemScreen.tsx:3618-3623` |
| `from_date`, `to_date` | ช่วงวันที่ "จากวันที่ / ถึงวันที่" ของบาร์โค้ด (ว่าง = NULL) | `ItemScreen.tsx:3630-3640`, `barcode.go:315-316` |
| `status`, `line_number` | สถานะ (บันทึกสินค้าเริ่มที่ 1) / ลำดับบรรทัดเริ่ม 1 | `item_master.go:408-414` |
| `roworder` | เลขแถวอัตโนมัติ (serial) ใช้เรียง "บาร์โค้ดแรก" ของสินค้า | `pos/handler.go:118-123`, `item_detail.go:197` |

- `is_clearance`, `from_date`, `to_date` ถูกใช้ในโค้ด (`barcode.go:166,315`, `item_master.go:739-746`) แต่ไม่อยู่ใน DDL ของ repo (`02_data_schema.sql:5336-5359`) และไม่พบ ALTER ที่เพิ่มคอลัมน์เหล่านี้ใน repo — ฐานข้อมูลที่สร้างจากไฟล์ DDL นี้อย่างเดียวจะบันทึกบาร์โค้ดไม่ได้จนกว่าจะมีคอลัมน์ครบ
- `wh_code`, `shelf_code`, `guid_code` มีใน DDL แต่ทางบันทึกที่ระบุในหัวข้อ "ใครเขียน" ไม่ได้เขียนค่าเหล่านี้

## ความสัมพันธ์

- n:1 กับ [[tbl-ic-inventory]] (`ic_code`); n:1 กับ [[tbl-ic-unit]] (`unit_code`)
- 1:n กับ [[tbl-ic-inventory-barcode-price]] ผ่านค่า `barcode` (ไม่ใช่ foreign key จริง; เชื่อมด้วย `upper(barcode)`)
- ราคาสูตร (`price_0..price_9`) อยู่ใน `ic_inventory_price_formula` เชื่อม `ic_code + unit_code` ใช้ในงานพิมพ์บาร์โค้ด (`barcode.go:607`) — ดู [[tbl-group-ic]]
- สินค้าพ่วง (`ic_inventory_bundle`) อ้างบาร์โค้ดจากตารางนี้ ต้องมีบาร์โค้ดอยู่แล้วจึงบันทึกได้ และดึง `ic_code`/`unit_code` จากบาร์โค้ดนั้น (`item_detail.go:478-481,552-556`)

## ใครเขียน / อ่าน

- **เขียน:**
  - บันทึกสินค้า = DELETE+INSERT ทั้งชุดของสินค้า ข้ามถ้าโหมด sync (`item_master.go:737-746`) ตรวจก่อนว่าบาร์โค้ดไม่ซ้ำในตาราง และไม่ถูกใช้โดยสินค้าอื่น (`parseItemBarcodes` `item_master.go:377-420`, `checkBarcodeOwners` `:653-671`)
  - `SaveBarcodes` (หน้าบาร์โค้ดและเพิ่มบาร์โค้ดเร็ว) = DELETE+INSERT ของสินค้าในทรานแซกชันเดียว ตรวจบาร์โค้ดซ้ำในกริดและซ้ำข้ามสินค้า และถ้ากรอก Update Shelf ต้องเลือกคลัง/ที่เก็บเริ่มต้นก่อน (`barcode.go:252-336`, `cleanBarcodeRows` `:217-247`)
  - เปลี่ยนรหัสบาร์โค้ด EAN13 (`Ean13Apply` `barcode.go:531-576`)
  - แก้ราคาทั้งชุดแบบ "barcode" แก้เฉพาะแถวที่พบบาร์โค้ด (`modify_price.go:44,267,318`)
  - ปรับราคาจากหน้าตรวจราคา เฉพาะเมื่อมีบาร์โค้ดและราคาใหม่มากกว่า 1 ไม่พบบาร์โค้ดจะแจ้ง "ไม่พบบาร์โค้ด" และเก็บราคาเดิมไว้ใน process log (`check_price.go:30-72`)
  - เปลี่ยนรหัสสินค้าแก้ `ic_code` ด้วย (`workflow.go:136,243`)
  - ลบสินค้า (เฉพาะที่ยังไม่ถูกใช้ในเอกสาร) ลบแถวบาร์โค้ดของสินค้าพร้อมกัน (`itemChildTables` `item_master.go:812-814`, ลูป `:847-849`)
- **อ่าน:**
  - POS โหลดรายการสินค้าเริ่มต้น 60 รายการ ใช้บาร์โค้ดแรก (`ORDER BY roworder LIMIT 1`) ของแต่ละสินค้าเป็นราคาปลีก (`price`), ส่ง (`price_2`), สมาชิก (`price_member`) (`pos/handler.go:108-125`)
  - ค้นสินค้าจากบาร์โค้ดในหน้ารายละเอียด (`item_detail.go:197`)
  - รูปสินค้า (`item_picture.go:135,196`)
  - ตรวจบาร์โค้ดที่วางเข้ามา (`BarcodeCheck` `stock_tools.go:101-135`), ตรวจ EAN13 (`barcode.go:436-442`), พิมพ์บาร์โค้ด (`BarcodePrintItems` `barcode.go:588,603-609`)

## ข้อควรระวัง

- ราคาเป็นค่าทศนิยม ใช้เป็น decimal string เท่านั้น (ห้าม float) ตามกฎบัญชี (`normDecimal` `barcode.go:235-242`, `itemMasterDec` `item_master.go:395`)
- `description` ต้องตรงกับ `ic_inventory.name_1`; ถ้าไม่ตรงระบบจะแก้ให้หลังบันทึกสินค้า (`stock_tools.go:509-510`)
- ต้องไม่มีบาร์โค้ดซ้ำข้ามสินค้า: บันทึกสินค้าเช็คที่ `item_master.go:599,653-671` และ `SaveBarcodes` เช็คที่ `barcode.go:289-303`
- ความยาวบาร์โค้ดไม่เท่ากัน: หน้าบันทึกสินค้าจำกัด 25 ตัวอักษร (`item_master.go:385`) ตรงกับ DDL แต่ `SaveBarcodes` ยอมรับถึง 50 (`barcode.go:225`) บาร์โค้ด 26-50 ตัวอักษรจึงน่าจะบันทึกไม่ผ่านที่ชั้นฐานข้อมูล (อนุมานจาก DDL, ยังไม่ได้ทดสอบ)

## ที่มาในโค้ด

- `scripts/sql/02_data_schema.sql:5336-5361`
- `backend/internal/application/process/item_master.go:377-420`, `:599`, `:653-671`, `:737-746`, `:812-814`, `:847-849`
- `backend/internal/application/process/barcode.go:33-51`, `:143`, `:166-167`, `:217-247`, `:252-336`, `:436-442`, `:531-576`, `:588`, `:603-609`
- `backend/internal/application/process/check_price.go:30-72`
- `backend/internal/application/process/modify_price.go:34`, `:44`, `:267`, `:318`
- `backend/internal/application/process/stock_tools.go:101-135`, `:509-510`
- `backend/internal/application/process/workflow.go:136`, `:243`
- `backend/internal/application/process/item_detail.go:197`, `:478-481`, `:552-556`
- `backend/internal/application/process/item_picture.go:135`, `:196`
- `backend/internal/adapter/inbound/http/pos/handler.go:108-125`
- `frontend/account/master/ItemScreen.tsx:735-750`, `:3598-3640`
- `frontend/account/master/BarcodeScreens.tsx:271-289`
