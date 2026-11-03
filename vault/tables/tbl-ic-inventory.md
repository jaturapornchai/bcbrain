---
title: "ทะเบียนสินค้า (ic_inventory)"
tags: [tables, ic]
aliases: ["ic_inventory", "ข้อมูลสินค้า", "item master", "สินค้า"]
sources: ["scripts/sql/02_data_schema.sql:5199", "backend/internal/application/process/item_master.go:35", "backend/internal/application/process/item_master.go:70", "backend/internal/application/process/item_master.go:627", "backend/internal/application/process/item_master.go:676", "backend/internal/application/process/item_master.go:719", "backend/internal/application/process/item_master.go:812", "backend/internal/application/process/item_master.go:817", "backend/internal/application/process/item_detail.go:43", "backend/internal/application/process/service.go:557", "backend/internal/application/process/service.go:821", "backend/internal/application/process/service.go:1078", "backend/internal/application/process/service.go:1275", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/stock_tools.go:494", "backend/internal/application/process/report_menu_ic.go:913", "backend/internal/application/process/trans_grid.go:272", "backend/internal/application/process/trans_set_item.go:37", "backend/internal/application/process/workflow.go:133", "frontend/account/master/ItemScreen.tsx:2241"]
---
# ทะเบียนสินค้า (`ic_inventory`)

**หน้าที่:** ตารางหลักของสินค้า 1 แถว = 1 รหัสสินค้า (`code`) ทุกบรรทัดเอกสารใน [[tbl-ic-trans-detail]] อ้างถึงด้วย `item_code = ic_inventory.code` ส่วนที่เป็นรายละเอียดเพิ่มอยู่ใน [[tbl-ic-inventory-detail]], หน่วยนับใน [[tbl-ic-unit-use]], บาร์โค้ดใน [[tbl-ic-inventory-barcode]], คลัง/ที่เก็บใน [[tbl-ic-wh-shelf]]

โครงสร้างตาราง: `scripts/sql/02_data_schema.sql:5199-5301` (CREATE ประมาณ 100 คอลัมน์) ตามด้วย ALTER เพิ่ม `name_2`, `status`, `width_length_height`, `weight`, `have_point`, `barcode_1`, `price_0` (`:5302-5308`) และดัชนี `idx_ic_inventory_code` บน `code` (`:5309`) DDL ไม่ได้กำหนด primary key หรือ unique บน `code` (`varchar(25)`) ความไม่ซ้ำตรวจในโค้ดตอนสร้างสินค้าใหม่ (`itemMasterState` `item_master.go:634-636`) คอลัมน์ `balance_qty_2` ไม่อยู่ใน CREATE แต่ถูกเพิ่มตอนเตรียมฐานข้อมูล (`service.go:821`)

## คอลัมน์สำคัญ

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `code` | รหัสสินค้า (โค้ดเทียบด้วย `upper(code)`) | `item_master.go:629,634-636` |
| `name_1`, `name_2`, `name_eng_1`, `name_eng_2` | ชื่อสินค้า ไทย/อังกฤษ | `item_master.go:43-44` |
| `item_type` | ประเภทสินค้า 0 ทั่วไป, 1 บริการ, 2 ให้เช่า, 3 ชุด, 4 ฝากขาย, 5 สูตรสี (รายงานเรียก "สูตรการผลิต"), 6 ผสมสี | ตัวเลือกในจอ `ItemScreen.tsx:2241-2247`, ป้ายในรายงาน `report_menu_ic.go:913` |
| `cost_type` | วิธีคิดต้นทุน 0 เฉลี่ย, 1 LOT FIFO, 2 LOT กำหนดเอง, 3 FEFO (วันหมดอายุ), 4 มาตรฐาน, 5 พิเศษ 1 | `ItemScreen.tsx:2458-2463`, `report_menu_ic.go:914` |
| `unit_type` | 0 หน่วยนับเดี่ยว, 1 หลายหน่วยนับ, 2 หน่วยนับขนาน, 3 หลายหน่วยนับ+หน่วยนับขนาน | `ItemScreen.tsx:2380-2383`, `item_master.go:36` |
| `unit_cost`, `unit_standard` | หน่วยต้นทุน / หน่วยมาตรฐาน (รหัสอ้าง [[tbl-ic-unit]]) | `item_master.go:37-38,645` |
| `unit_standard_name`, `unit_standard_stand_value`, `unit_standard_divide_value` | ค่าที่ derive จากหน่วยมาตรฐานหลังบันทึกสินค้า: ชื่อหน่วยจาก `ic_unit`, อัตราแปลงจาก [[tbl-ic-unit-use]] เมื่อ `unit_type` เป็น 1 หรือ 3 (หน่วยเดี่ยว/ขนานใช้ 1) | `stock_tools.go:495-508` |
| `tax_type` | ประเภทภาษีของสินค้า 0 ภาษีมูลค่าเพิ่ม, 1 ยกเว้นภาษี; กริดเอกสารอ่านค่านี้ตอนใส่รหัสสินค้า | `ItemScreen.tsx:2221-2222`, `trans_grid.go:272-302` |
| `balance_qty`, `balance_qty_2` | ยอดคงเหลือ cache ที่ระบบคำนวณใหม่จาก [[tbl-ic-trans-detail]] | `service.go:1078-1133`, `:821` |
| `average_cost` | ต้นทุนเฉลี่ยเคลื่อนที่ล่าสุดของสินค้า เขียนกลับจากการคำนวณต้นทุนใน `RebuildStock`; กริดเอกสารและการแตกสินค้าชุดอ่านค่านี้ไปใช้เป็นต้นทุนบรรทัด | `service.go:557,1275-1297`, `trans_grid.go:276,486`, `trans_set_item.go:37` |
| `ic_serial_no` | 1 = สินค้ามี Serial Number (ป้ายในจอ "สินค้ามี Serial") | `item_master.go:52`, `ItemScreen.tsx:2194-2199` |
| `use_expire` | 1 = ใช้ระบบหมดอายุ (ป้ายในจอ "ใช้ระบบหมดอายุ"); กริดเอกสารอ่านค่านี้ไปที่บรรทัด (`GridLine.UseExpire`) | `item_master.go:52`, `ItemScreen.tsx:2768-2773`, `trans_grid.go:25-27` |
| `account_code_1..4` | รหัสผังบัญชีผูกกับสินค้า ([[tbl-gl-chart-of-account]]) | `item_master.go:48-49` |
| `supplier_code`, `manufacturer_code` | ผู้ขายหลัก / ผู้ผลิต | `item_master.go:47,51` |
| `item_brand`, `item_pattern`, `item_design`, `item_grade`, `item_model`, `item_category`, `group_main`, `item_class`, `group_sub`, `group_sub2` | รหัสกลุ่ม/ยี่ห้อ/รุ่น อ้าง lookup `ic_brand`, `ic_pattern`, `ic_design`, `ic_grade`, `ic_model`, `ic_category`, `ic_group`, `ic_class`, `ic_group_sub`, `ic_group_sub2` | `item_detail.go:43-52` |
| `update_detail`, `update_price` | สวิตช์ให้ซิงก์รายละเอียด/ราคา (ค่าตั้งต้นจอสินค้าใหม่ 1) | `item_master.go:50,70` |
| `commission_rate`, `serial_no_format`, `description`, `remark` | อัตราคอมมิชชั่น, รูปแบบ Serial, คำอธิบาย, หมายเหตุ | `item_detail.go:53-57` |
| `create_code`, `create_datetime`, `last_update_code`, `last_update_date_time` | ผู้สร้าง/แก้ไข และเวลา | `item_master.go:695,702` |

คอลัมน์อื่น เช่น `short_name`, `name_market`, `item_size`, `item_color`, `qc_product`, `tpu_code` ดูรายการเต็มใน `item_master.go:42-67` และ DDL ข้างต้น ความหมายเชิงธุรกิจของบางตัวไม่ชัดจากโค้ด

## คีย์และความสัมพันธ์

- 1 สินค้า : n บรรทัดเอกสาร [[tbl-ic-trans-detail]] (`item_code`)
- 1 สินค้า : 1 [[tbl-ic-inventory-detail]] (`ic_code`) สร้างอัตโนมัติถ้าไม่มี (`item_master.go:708-713`, `stock_tools.go:511-512`)
- 1 สินค้า : n [[tbl-ic-unit-use]] / [[tbl-ic-opposite-unit]] / [[tbl-ic-inventory-barcode]] / [[tbl-ic-wh-shelf]] / [[tbl-ic-standard-cost]] / [[tbl-ic-inventory-price]]
- สินค้าชุด (`item_type` 3) 1 : n [[tbl-ic-inventory-set-detail]] (`ic_set_code`)
- 1 สินค้า : n [[tbl-ic-serial]] (`ic_code`) เมื่อ `ic_serial_no = 1`

## ใครเขียน / ใครอ่าน

- **เขียน (บันทึกสินค้า):** `writeItemMaster` ใช้ INSERT/UPDATE ไม่ delete+insert เพื่อไม่ให้ยอดคงเหลือและต้นทุนหาย (`item_master.go:676-717`) แล้วเขียนตารางลูกใน `writeItemMasterGrids` (`item_master.go:719`) ฟิลด์ที่รับจากจออยู่ใน `itemMasterSpecs` (`:42-67`) และ `itemMasterUnitSpecs` (`:35-40`)
- **เขียน (คำนวณสต๊อก):** `RebuildStock` คำนวณ `balance_qty`/`balance_qty_2` ใหม่จาก `ic_trans_detail` ที่ผ่าน `stockBalancePredicate` (`service.go:1078-1133`) แล้วเขียน `average_cost` กลับ (`service.go:1275-1297`) ดู [[acc-inventory-cost-moving-average]], [[acc-inventory-stock-rebuild]]
- **เขียน (หลังแก้สินค้า):** `itemSavedSQL` ปรับ `unit_standard_name`, `unit_standard_stand_value`, `unit_standard_divide_value` และ `ic_inventory_barcode.description` (`stock_tools.go:494-512`)
- **ลบ:** `ItemMasterDelete` ลบได้เฉพาะจอ `menu_ic_item_detail` (`item_master.go:817-821`) และเฉพาะสินค้าที่ยังไม่เคยอยู่ใน `ic_trans_detail` (`:834-837`) ตัวที่ใช้แล้วถูกข้าม ตัวที่ลบได้จะลบตารางลูกตาม `itemChildTables` (`item_master.go:812-814`, `:847-857`) แล้วลบสินค้าพร้อมบันทึก `master_logs` (`:858-862`) ฝั่งจอแสดงข้อความ "สินค้ามีการใช้ไปแล้ว ห้ามลบ" (`ItemScreen.tsx:1125`)
- **อ่าน:** กริดรายการสินค้าในเอกสาร `loadGridItem` อ่านภาษี ประเภท หน่วย ต้นทุนเฉลี่ย การใช้วันหมดอายุ Serial และ join กับ [[tbl-ic-inventory-detail]] และ [[tbl-ic-wh-shelf]]/[[tbl-ic-shelf]] (`trans_grid.go:272-302`); เปลี่ยนรหัสสินค้า `changeCodeSpecs["item"]` แก้ทุกตารางที่อ้างรหัสนี้ (`workflow.go:133-148`)

## ข้อควรระวัง

- **ตัวกรองยอดสต๊อกอยู่ที่บรรทัดเอกสาร:** ตัวสร้างยอดสต๊อกนับเฉพาะบรรทัดที่ `ic_trans_detail.item_type` เป็น 0, 4, 6 (`stockRowsSQL` `stock_rebuild.go:18`) ป้ายรายงานระบุว่าสินค้าบริการและสินค้าชุด "ไม่ทำสต๊อก" (`report_menu_ic.go:913`) ส่วนสินค้าให้เช่า (2) ไม่อยู่ในกลุ่มที่นับเช่นกัน
- **`item_type = 5` ป้ายชื่อไม่ตรงกัน:** จอสินค้าเรียก "สูตรสี" (`ItemScreen.tsx:2246`) รายงานประเภทสินค้าเรียก "สูตรการผลิต" (`report_menu_ic.go:913`) และ `RebuildStock` ข้ามสินค้าชนิดนี้ทั้งตอนคำนวณ `balance_qty` และตอนเลือกสินค้าที่จะคิดต้นทุน (`service.go:1099,1123,1135-1138`) กริดเอกสารแตกลูกของสินค้า 5 เหมือนสินค้าชุด (ดู [[tbl-ic-inventory-set-detail]]) ความหมายทางธุรกิจที่แน่ชัดยังต้องยืนยันกับลุงจืด
- **ล็อกหลังมีรายการเคลื่อนไหว:** `unit_type`, `unit_cost`, `unit_standard`, `cost_type` ถูกล็อกไม่ให้แก้เมื่อสินค้ามีบรรทัดใน `ic_trans_detail` แล้ว backend อ่านค่าเดิมกลับมาทับ (`itemMasterState` `item_master.go:627-650`)
- **`balance_qty` เป็นค่า cache:** ความจริงอยู่ที่ผลรวมจาก [[tbl-ic-trans-detail]] ด้วยตัวกรอง `stockBalancePredicate` (`stock_rebuild.go:29`)
- ที่มาอื่น: logic ต้นทุนเฉลี่ยเคลื่อนที่ ดู [[acc-inventory-cost-moving-average]]; ข้อมูลหลักทั่วไป ดู [[proc-master-data]], [[proc-item-master-detail]]

## ที่มาในโค้ด

- `scripts/sql/02_data_schema.sql:5199-5301` (CREATE), `:5302-5308` (ALTER), `:5309` (index)
- `backend/internal/application/process/item_master.go:35-40` (unit specs), `:42-67` (specs), `:70` (ค่าตั้งต้น), `:627-651` (ตรวจใช้แล้ว/ล็อก), `:676-717` (writeItemMaster), `:719` (grids), `:812-814`, `:817-870` (ลบ)
- `backend/internal/application/process/item_detail.go:43-57` (itemSpecs)
- `backend/internal/application/process/service.go:557`, `:821`, `:1078-1133` (balance_qty), `:1135-1138`, `:1275-1297` (average_cost)
- `backend/internal/application/process/stock_rebuild.go:18-29`
- `backend/internal/application/process/stock_tools.go:494-512`
- `backend/internal/application/process/report_menu_ic.go:913-914`
- `backend/internal/application/process/trans_grid.go:25-27`, `:272-302`, `:486`
- `backend/internal/application/process/trans_set_item.go:37`
- `backend/internal/application/process/workflow.go:133-148`
- `frontend/account/master/ItemScreen.tsx:1125`, `:2194-2199`, `:2221-2222`, `:2241-2247`, `:2380-2383`, `:2458-2463`, `:2768-2773`
