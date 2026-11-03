---
title: "ทะเบียนสินค้า (ic_inventory)"
tags: [tables, ic]
aliases: ["ic_inventory", "ข้อมูลสินค้า", "item master", "สินค้า"]
sources: ["backend/internal/application/process/item_master.go:35", "backend/internal/application/process/item_master.go:674", "backend/internal/application/process/item_master.go:812", "backend/internal/application/process/item_detail.go:43", "backend/internal/application/process/service.go:1066", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/stock_tools.go:493", "backend/internal/application/process/report_menu_ic.go:884", "backend/internal/application/process/trans_grid.go:268"]
---
# ทะเบียนสินค้า (`ic_inventory`)

**หน้าที่:** ตารางหลักของสินค้า 1 แถว = 1 รหัสสินค้า (`code`) ทุกบรรทัดเอกสารใน [[tbl-ic-trans-detail]] อ้างถึงด้วย `item_code = ic_inventory.code` ส่วนที่เป็นรายละเอียดเพิ่มอยู่ใน [[tbl-ic-inventory-detail]], หน่วยนับใน [[tbl-ic-unit-use]], บาร์โค้ดใน [[tbl-ic-inventory-barcode]], คลัง/ที่เก็บใน [[tbl-ic-wh-shelf]]

ไม่มี DDL ของตารางนี้ใน repo (ตารางเดิมของ C#) คอลัมน์ด้านล่างอนุมานจาก `itemMasterSpecs`/`itemMasterUnitSpecs` (`item_master.go:35-76`), `itemSpecs` (`item_detail.go:43-58`) และ SQL ที่อ่าน/เขียนจริง

## คอลัมน์สำคัญ

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `code` | รหัสสินค้า (key; โค้ดเทียบด้วย `upper(code)`) | `item_master.go:629,695` |
| `name_1`, `name_2`, `name_eng_1`, `name_eng_2` | ชื่อสินค้า ไทย/อังกฤษ | `item_master.go:43` |
| `item_type` | ประเภทสินค้า 0 ทั่วไป, 1 บริการ (ไม่ทำสต๊อก), 2 ให้เช่า, 3 ชุด (ไม่ทำสต๊อก), 4 ฝากขาย, 5 สูตรการผลิต, 6 สีผสม | ป้ายชื่อใน `report_menu_ic.go:884` |
| `cost_type` | วิธีคิดต้นทุน 0 เฉลี่ย, 1 LOT FIFO, 2 LOT กำหนดเอง, 3 FEFO (วันหมดอายุ), 4 มาตรฐาน, 5 พิเศษ 1 | `report_menu_ic.go:885` |
| `unit_type` | 0 หน่วยเดี่ยว, 1 หลายหน่วย, 2 ขนาน, 3 หลายหน่วย+ขนาน | `item_master.go:36`, `stock_tools.go:499` |
| `unit_cost`, `unit_standard` | หน่วยต้นทุน / หน่วยมาตรฐาน (รหัสอ้าง [[tbl-ic-unit]]) | `item_master.go:37-38,645` |
| `unit_standard_name`, `unit_standard_stand_value`, `unit_standard_divide_value` | ค่าที่ derive จากหน่วยมาตรฐาน หลังบันทึกสินค้า | `stock_tools.go:495-510` |
| `tax_type` | ประเภทภาษีของสินค้า (ค่าตัวเลข; ความหมายแต่ละค่าไม่ชัดจากโค้ดที่อ่าน) | `item_master.go:44` |
| `balance_qty`, `balance_qty_2` | ยอดคงเหลือ cache ที่ระบบคำนวณใหม่จาก [[tbl-ic-trans-detail]] | `service.go:1066-1119`, `service.go:810` (ALTER เพิ่ม `balance_qty_2`) |
| `average_cost` | ต้นทุนเฉลี่ยเคลื่อนที่ล่าสุดของสินค้า เขียนกลับจากการคำนวณต้นทุนหลังบันทึกเอกสารสต๊อก | `service.go:546`, `:1264`, `trans_set_item.go:36` |
| `ic_serial_no` | 1 = สินค้ามี Serial Number | `item_master.go:50` |
| `use_expire` | ใช้วันหมดอายุ (ไม่ชัดจากโค้ดว่าใช้ที่ใดต่อ) | `item_master.go:50` |
| `account_code_1..4` | รหัสผังบัญชีผูกกับสินค้า ([[tbl-gl-chart-of-account]]) | `item_master.go:47-48` |
| `supplier_code`, `manufacturer_code` | ผู้ขายหลัก / ผู้ผลิต | `item_master.go:45,49` |
| `item_brand`, `item_pattern`, `item_design`, `item_grade`, `item_model`, `item_category`, `group_main`, `item_class`, `group_sub`, `group_sub2` | รหัสกลุ่ม/ยี่ห้อ/รุ่น อ้าง lookup `ic_brand`, `ic_pattern`, `ic_design`, `ic_grade`, `ic_model`, `ic_category`, `ic_group`, `ic_class`, `ic_group_sub`, `ic_group_sub2` | `item_detail.go:43-52` |
| `update_detail`, `update_price` | สวิตช์ให้ซิงก์รายละเอียด/ราคา (default 1) | `item_master.go:46,129` |
| `commission_rate`, `serial_no_format`, `description`, `remark` | อัตราคอมมิชชั่น, รูปแบบ Serial, คำอธิบาย, หมายเหตุ | `item_detail.go:53-56` |
| `create_code`, `create_datetime`, `last_update_code`, `last_update_date_time` | ผู้สร้าง/แก้ไข และเวลา | `item_master.go:695-702` |

คอลัมน์อื่นอีกมาก (เช่น `short_name`, `name_market`, `item_size`, `item_color`, `qc_product`, `tpu_code`) ดูรายการเต็มใน `item_master.go:42-58`; ความหมายเชิงธุรกิจของบางตัวไม่ชัดจากโค้ด

## คีย์และความสัมพันธ์

- 1 สินค้า : n บรรทัดเอกสาร [[tbl-ic-trans-detail]] (`item_code`)
- 1 สินค้า : 1 [[tbl-ic-inventory-detail]] (`ic_code`) — สร้างอัตโนมัติถ้าไม่มี (`item_master.go:708`, `stock_tools.go:511`)
- 1 สินค้า : n [[tbl-ic-unit-use]] / [[tbl-ic-opposite-unit]] / [[tbl-ic-inventory-barcode]] / [[tbl-ic-wh-shelf]] / [[tbl-ic-standard-cost]] / [[tbl-ic-inventory-price]]
- สินค้าชุด (`item_type` 3) 1 : n [[tbl-ic-inventory-set-detail]] (`ic_set_code`)
- 1 สินค้า : n [[tbl-ic-serial]] (`ic_code`) เมื่อ `ic_serial_no = 1`

## ใครเขียน / ใครอ่าน

- **เขียน (บันทึกสินค้า):** `writeItemMaster` ใช้ INSERT/UPDATE ไม่ delete+insert เพื่อไม่ให้ยอดคงเหลือและต้นทุนหาย (`item_master.go:676-706`) แล้วเขียนตารางลูกใน `writeItemMasterGrids` (`item_master.go:719-777`)
- **เขียน (คำนวณสต๊อก):** `RebuildStock` / `rebuildStockTx` คำนวณ `balance_qty` ใหม่หลังบันทึกเอกสารสต๊อก ดู [[acc-inventory-cost-moving-average]], [[acc-inventory-stock-rebuild]]
- **เขียน (หลังแก้สินค้า):** `itemSavedSQL` ปรับ `unit_standard_name/stand/divide` และ `ic_inventory_barcode.description` (`stock_tools.go:493-510`)
- **ลบ:** `ItemMasterDelete` ลบได้เฉพาะสินค้าที่ยังไม่เคยอยู่ใน `ic_trans_detail` ถ้ามีการใช้แล้วข้ามพร้อมข้อความ "สินค้ามีการใช้ไปแล้ว ห้ามลบ" และลบตารางลูกตาม `itemChildTables` (`item_master.go:812-870`)
- **อ่าน:** กริดรายการสินค้าในเอกสาร `loadGridItem` join กับ [[tbl-ic-inventory-detail]] และ [[tbl-ic-wh-shelf]]/[[tbl-ic-shelf]] (`trans_grid.go:268-300`); เปลี่ยนรหัสสินค้า `changeCodeSpecs["item"]` แก้ทุกตารางที่อ้างรหัสนี้ (`workflow.go:133-148`)

## ข้อควรระวัง

- สินค้าที่ **ขยับสต๊อกจริง** คือ `item_type IN (0, 4, 6)` เท่านั้น (`stock_rebuild.go:18`); 1, 2, 3, 5 ไม่ทำสต๊อก
- `item_type = 5` ป้ายชื่อไม่ตรงกัน: รายงานเรียก "สูตรการผลิต" (`report_menu_ic.go:884`) แต่ `trans_set_item.go:8-10` เรียก "สูตรสี" และจัดเป็นสินค้าชุดที่แตกลูก — ยืนยันความหมายจริงกับลุงจืดก่อนใช้
- `unit_type`, `unit_cost`, `unit_standard`, `cost_type` ถูกล็อกไม่ให้แก้เมื่อสินค้ามี `ic_trans_detail` แล้ว (`item_master.go:34`, `629-649`)
- `balance_qty` เป็นค่า cache; ความจริงอยู่ที่ผลรวมจาก [[tbl-ic-trans-detail]] ด้วยตัวกรอง `stockBalancePredicate` (`stock_rebuild.go:29`)
- ที่มาอื่น: logic ต้นทุนเฉลี่ยเคลื่อนที่ ดู [[acc-inventory-cost-moving-average]]; ข้อมูลหลักทั่วไป ดู [[proc-master-data]], [[proc-item-master-detail]]

## ที่มาในโค้ด

- `backend/internal/application/process/item_master.go:35-76` (specs), `:629-649` (ตรวจใช้แล้ว), `:674-706` (writeItemMaster), `:717-775` (grids), `:812-870` (delete)
- `backend/internal/application/process/item_detail.go:43-58` (itemSpecs)
- `backend/internal/application/process/service.go:545`, `:810`, `:1066-1119` (balance_qty)
- `backend/internal/application/process/stock_rebuild.go:18-29`
- `backend/internal/application/process/stock_tools.go:493-511`
- `backend/internal/application/process/report_menu_ic.go:884-885`
- `backend/internal/application/process/trans_grid.go:268-300`
- `backend/internal/application/process/workflow.go:133-148`
