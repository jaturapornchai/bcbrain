---
title: "รายละเอียดสินค้าเพิ่มเติม (ic_inventory_detail)"
tags: [tables, ic]
aliases: ["ic_inventory_detail", "รายละเอียดสินค้า", "dimension สินค้า"]
sources: ["scripts/sql/02_data_schema.sql:5415", "backend/internal/application/process/item_detail.go:62", "backend/internal/application/process/item_detail.go:91", "backend/internal/application/process/item_detail.go:328", "backend/internal/application/process/item_detail.go:416", "backend/internal/application/process/item_master.go:708", "backend/internal/application/process/item_master.go:812", "backend/internal/application/process/stock_tools.go:511", "backend/internal/application/process/stock_tools.go:555", "backend/internal/application/process/lookup_hold.go:19", "backend/internal/application/process/trans_grid.go:99", "backend/internal/application/process/trans_save_rules.go:108", "backend/internal/application/process/sysproc_tools.go:122", "backend/internal/application/process/report_menu_ic.go:649", "frontend/account/master/ItemDetail2Screen.tsx:58", "frontend/account/master/IcExtraScreens.tsx:1085"]
---
# รายละเอียดสินค้าเพิ่มเติม (`ic_inventory_detail`)

**หน้าที่:** ตารางลูก 1:1 ของ [[tbl-ic-inventory]] (key `ic_code`) เก็บมิติสินค้า, คลัง/ที่เก็บ/หน่วยเริ่มต้นของการซื้อ-ขาย-เบิก, จุดสั่งซื้อ และสวิตช์ควบคุมการขาย/ซื้อ ใช้กับหน้าจอ 2.1.3 / 2.1.4 "ข้อมูลสินค้าเพิ่มเติม" (`screenRegistry.tsx:605-638`)

## คอลัมน์ (DDL `scripts/sql/02_data_schema.sql:5415-5525`, spec ที่หน้ารายละเอียดบันทึกได้ `buildDetailSpecs` `item_detail.go:62-86`)

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `ic_code` | รหัสสินค้า (key ไป [[tbl-ic-inventory]]) | ทุกที่ |
| `dimension_1` ถึง `dimension_45` | มิติสินค้า 1-20 (varchar 25) อ้าง lookup `ic_dimension`; 21-45 (varchar 255) ข้อความอิสระ ชื่อมิติมาจาก `ic_dimension_name` | `item_detail.go:64-69,174`; `ItemDetail2Screen.tsx:501-502` |
| `start_purchase_wh/shelf/unit` | คลัง/ที่เก็บ/หน่วยเริ่มต้นตอนซื้อ (อ้าง [[tbl-ic-warehouse]], [[tbl-ic-shelf]], [[tbl-ic-unit]]) | `item_detail.go:71` |
| `start_sale_wh/shelf/unit`, `before_sale_unit` | คลัง/ที่เก็บ/หน่วยเริ่มต้นตอนขาย และหน่วยก่อนขาย | `item_detail.go:72-73` |
| `ic_out_wh`, `ic_out_shelf`, `start_unit_code` | คลัง/ที่เก็บ/หน่วยตอนเบิก | `item_detail.go:74` |
| `user_group_for_purchase/sale/manage/warehouse` | กลุ่มผู้ใช้ฝ่ายจัดซื้อ/ขาย/บริหาร/คลัง (อ้าง `erp_user_group`) | `item_detail.go:75-76` |
| `discount` | ส่วนลดมาตรฐานของสินค้า (ข้อความ ไม่เกิน 50) | `item_detail.go:80` |
| `purchase_point`, `minimum_qty`, `maximum_qty` | จุดสั่งซื้อ / จำนวนต่ำสุด / จำนวนสูงสุด (numeric) | `item_detail.go:81`; `report_menu_ic.go:649,665` ใช้ `purchase_point` |
| `have_point` | "สะสมแต้ม" 1 = สินค้านี้สะสมแต้ม | `item_master.go:708-715`, `sysproc_tools.go:122-128` |
| `balance_control` | "ควบคุมยอดคงเหลือ" สินค้าที่ = 1 ไม่ถูกตรวจ "ห้ามติดลบ" ตอนบันทึกเอกสาร | `trans_save_rules.go:108,319,411` |
| `accrued_control` | "ควบคุมสินค้าค้างรับ/ค้างส่ง" (ไม่พบตัวอ่านใน backend นอกหน้ารายละเอียด) | `ItemDetail2Screen.tsx:58` |
| `lock_cost`, `lock_price`, `lock_discount` | "ล็อคต้นทุน / ล็อคราคา / ล็อคส่วนลด" | `ItemDetail2Screen.tsx:59` |
| `is_end` | "เลิกผลิต/หมดอายุการขาย" | `ItemDetail2Screen.tsx:59` |
| `is_hold_sale`, `is_hold_purchase` | "ระงับการขาย / ระงับการซื้อ" 1 = เอกสารขาย/เสนอราคา/สั่งขาย/สั่งจอง หรือเอกสารฝั่งซื้อที่เลือกสินค้านี้จะถูกปฏิเสธ | `lookup_hold.go:19-27`, `trans_grid.go:99-100,355-362` |
| `is_premium` | "สินค้าของแถม" | `ItemDetail2Screen.tsx:60` |

- ทุกคอลัมน์ในตารางข้างบนมีใน DDL (ชนิดและความกว้างตรงกับ spec) DDL ยังมีคอลัมน์อื่นที่ spec ของหน้ารายละเอียดไม่จัดการ เช่น `formular`, `po_over`, `so_over`, `tax_rate`, `close_date` (`02_data_schema.sql:5415-5525`)
- `minimum_qty`, `maximum_qty`, `ic_out_wh`, `ic_out_shelf`, `user_group_for_*`, `lock_cost`, `is_end`, `is_premium` ค้นใน backend แล้วพบเฉพาะ spec ของหน้ารายละเอียด (`item_detail.go`) คือเก็บและแสดงเท่านั้น ไม่พบตัวอ่านที่ใช้ตัดสินในระบบอื่น

## ความสัมพันธ์และกระบวนการ

- 1:1 กับ [[tbl-ic-inventory]] ผ่าน `ic_code`
- ถูกสร้างอัตโนมัติถ้ายังไม่มีแถว: ตอนบันทึกสินค้า (`item_master.go:708-711`), ตอนบันทึกหน้ารายละเอียด (`item_detail.go:416` ข้ามถ้า `item_type = 5`), และหลังบันทึกสินค้า (`stock_tools.go:511-512`)
- บันทึกหน้ารายละเอียด: ตรวจทุกฟิลด์ตาม spec (ฟิลด์ที่ไม่รู้จักถูกปฏิเสธ, รหัสคลัง/ที่เก็บ/หน่วย/กลุ่มผู้ใช้/มิติต้องมีในตารางอ้างอิง) แล้ว UPDATE เฉพาะคอลัมน์ที่ส่งมาในทรานแซกชันเดียวกับ `ic_inventory` (`setClause` `item_detail.go:328-363`, `:416-430`)
- แถวกำพร้า (ไม่มีสินค้า) ถูกลบหลังบันทึกสินค้า (`stock_tools.go:553-556`)
- ลบสินค้า (เฉพาะที่ยังไม่ถูกใช้ในเอกสาร) ลบแถวในตารางนี้พร้อมกัน (`itemChildTables` `item_master.go:812-814`); เปลี่ยนรหัสสินค้าแก้ `ic_code` ด้วย (`workflow.go:136`)
- อ่านตอนกริดเอกสารเลือกสินค้า: หน่วย/คลัง/ที่เก็บเริ่มต้นซื้อ-ขาย, ส่วนลดมาตรฐาน, หน่วยก่อนขาย และธง hold (`trans_grid.go:272-290`), ตอนดึงรายการอ้างอิง (`trans_ref_import_lines.go:365-366`), ตอนตรวจกฎบันทึกเอกสาร (`trans_save_rules.go:108`)
- ตรวจสินค้าระงับการขาย/ซื้อซ้ำตอนบันทึกเอกสาร: ข้ามสินค้าที่อยู่ในเอกสารเดิมที่บันทึกไว้แล้ว และสินค้าที่อยู่ในเอกสารอ้างอิง (`checkHeldItems` `lookup_hold.go:33-73`)
- เขียนแบบกลุ่มจากหน้าจอ 2.1.6 "แก้ไขรายละเอียดสินค้า (เร็ว)" ด้วย INSERT แถวที่ขาด + UPDATE ผ่าน `/query/exec` (`IcExtraScreens.tsx:1085-1107`, `screenRegistry.tsx:651-662`)

## ข้อควรระวัง

- ตัวเลขใช้ `kNum` (decimal string ไม่ติดลบ สูงสุด 15 หลักก่อนจุด และ 6 ตำแหน่งหลังจุด ตาม `itemDetailNum`) และสวิตช์ใช้ `kFlag` (0/1 เท่านั้น) ตรวจใน `normField` (`item_detail.go:88-124`)
- หน้าจอ 2.1.6 (เร็ว) กำหนดฟิลด์ 14 ตัวเป็นของตารางนี้ (`IcExtraScreens.tsx:847-1014`) แต่ใน DDL ของตารางนี้มีเพียง `lock_price`, `lock_discount`, `accrued_control`; ฟิลด์อีก 11 ตัว (`serial_number_type`, `order_point_type`, `purchase_point_type`, `sale_type`, `is_end_user_price`, `supplier_code`, `production_period`, `Using_expire`, `pos_fast_key`, `user_price`, `print_order_per_unit`) ไม่พบใน DDL ของตารางนี้ (`02_data_schema.sql:5415-5525`) โดย `supplier_code`, `production_period`, `print_order_per_unit` อยู่ใน DDL ของ `ic_inventory` (`02_data_schema.sql:5199-5308`) และหน้ารายละเอียดอ่าน `supplier_code` จาก `ic_inventory` (`item_detail.go:168`) ยังไม่ได้ทดสอบว่าบันทึกจากหน้าจอนี้สำเร็จหรือไม่
- ดูเพิ่ม [[proc-item-master-detail]]

## ที่มาในโค้ด

- `scripts/sql/02_data_schema.sql:5415-5525`
- `backend/internal/application/process/item_detail.go:62-86`, `:88-124`, `:168-174`, `:328-363`, `:416-430`
- `backend/internal/application/process/item_master.go:708-715`, `:812-814`
- `backend/internal/application/process/stock_tools.go:511-512`, `:553-556`
- `backend/internal/application/process/lookup_hold.go:19-27`, `:33-73`
- `backend/internal/application/process/trans_grid.go:99-100`, `:272-290`, `:355-362`
- `backend/internal/application/process/trans_ref_import_lines.go:365-366`
- `backend/internal/application/process/trans_save_rules.go:108`, `:319`, `:411`
- `backend/internal/application/process/sysproc_tools.go:122-128`
- `backend/internal/application/process/report_menu_ic.go:649`, `:665`
- `backend/internal/application/process/workflow.go:136`
- `frontend/account/master/ItemDetail2Screen.tsx:54-61`, `:501-502`
- `frontend/account/master/IcExtraScreens.tsx:847-1014`, `:1085-1107`
- `frontend/account/tabs/screenRegistry.tsx:605-638`, `:651-662`
