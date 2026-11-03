---
title: "หน่วยนับที่ใช้ของสินค้า (ic_unit_use)"
tags: [tables, ic]
aliases: ["ic_unit_use", "หน่วยนับสินค้า", "ตัวคูณหน่วย stand_value divide_value"]
sources: ["scripts/sql/02_data_schema.sql:7250", "backend/internal/application/process/item_master.go:727", "backend/internal/application/process/item_master.go:273", "backend/internal/application/process/trans_set_item.go:42", "backend/internal/application/process/stock_tools.go:499", "backend/internal/application/process/stock_tools.go:514", "backend/internal/application/process/service.go:630", "backend/internal/application/process/report_menu_ic.go:292"]
---
# หน่วยนับที่ใช้ของสินค้า (`ic_unit_use`)

**หน้าที่:** 1 แถว = 1 หน่วยนับที่สินค้าหนึ่งตัวใช้ได้ พร้อมอัตราแปลงเข้าหน่วยมาตรฐาน: `ratio = stand_value / divide_value` (คำนวณตอน INSERT ที่ `item_master.go:728`) ใช้แปลงจำนวนในบรรทัดเอกสาร [[tbl-ic-trans-detail]] (คอลัมน์ `stand_value`, `divide_value`, `ratio` ในบรรทัดคือสำเนาของค่านี้ ณ ตอนบันทึก)

## คอลัมน์ (DDL `scripts/sql/02_data_schema.sql:7250-7267` ดัชนี `idx_ic_unit_use_code` บน `code` ที่ `:7268`, เขียนจาก INSERT ที่ `item_master.go:727-730`)

DDL มีคอลัมน์ `remark` เพิ่มจากตารางข้างล่าง แต่ INSERT ของหน้าสินค้าไม่เขียนคอลัมน์นี้

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `ic_code` | รหัสสินค้า ([[tbl-ic-inventory]].code) | key ทุกจุด |
| `code` | รหัสหน่วย ([[tbl-ic-unit]].code) | `trans_set_item.go:42-43` เงื่อนไข `code = d.unit_code` |
| `stand_value`, `divide_value` | ตัวตั้ง/ตัวหาร ของอัตราแปลง | `item_master.go:728`, `stock_tools.go:499-508` |
| `ratio` | `stand_value / divide_value` | `item_master.go:728` |
| `row_order` | ลำดับแสดง (ค่าว่าง = ใช้ `line_number`) | `item_master.go:728` |
| `width_length_height`, `weight`, `unit_size` | ขนาด/น้ำหนัก/ขนาดหน่วย (`unit_size` ค่าว่าง = NULL) | `item_master.go:729` |
| `status`, `line_number` | สถานะ / ลำดับบรรทัด (server กำหนด `line_number`) | `item_master.go:729` |

## ความสัมพันธ์และกระบวนการ

- n:1 กับ [[tbl-ic-inventory]] (`ic_code`), n:1 กับ [[tbl-ic-unit]] (`code`)
- เขียน: บันทึกสินค้า = DELETE ทุกแถวของสินค้านั้นแล้ว INSERT ใหม่ในทรานแซกชันเดียว (`item_master.go:726-730`)
- ตรวจก่อนเขียน: ข้ามแถวที่ `code` ว่าง, ตัวตั้ง/ตัวหารต้องมากกว่า 0, หน่วยซ้ำในตารางไม่ได้, `line_number` = ลำดับแถวที่เหลือ และ `row_order` ว่างใช้ค่าเดียวกับ `line_number` (`parseItemUnits` `item_master.go:273-338`)
- หลังบันทึกสินค้า `unit_standard_stand_value/divide_value` ของ [[tbl-ic-inventory]] ถูกดึงจากแถวของหน่วยมาตรฐานเมื่อ `unit_type IN (1, 3)` ส่วน `unit_type IN (0, 2)` ใช้ 1 (`stock_tools.go:499-508`) และแถวของสินค้านี้ที่ตัวตั้ง/ตัวหารเป็น 0 หรือ NULL ถูกปรับเป็น 1 พร้อมให้บรรทัดเอกสารที่ใช้หน่วยนั้นเปลี่ยนตาม (`stock_tools.go:514-523`)
- อ่านเมื่อขยายสินค้าชุดเข้ากริดเอกสาร (`trans_set_item.go:42-44`)
- อ่านในรายงานยอดคงเหลือสินค้า: สินค้า `unit_type IN (1, 3)` แสดงคอลัมน์ "คงเหลือ (ทอนหน่วย)" ที่แยกจำนวนตามหน่วยใน `ic_unit_use` (เฉพาะแถว `status = 1` ที่ตัวตั้ง/ตัวหาร > 0 เรียงจากอัตราแปลงมากไปน้อย) (`icPackWordSQL` `report_menu_ic.go:290-316`, ใช้ที่ `:349`)
- งานปรับอัตราแปลงทั้งระบบ `updateUnitRatioDetailTx` ปรับแถวที่เป็น 0/NULL เป็น 1 แล้วซิงก์ `stand_value/divide_value` ลงบรรทัดเอกสาร และถ้าฐานข้อมูลมีตาราง `ic_wms_trans_detail` ก็ซิงก์ลงตารางนั้นด้วย (`service.go:630-647`) — ไม่บันทึกรายละเอียดของตาราง WMS ในที่นี้

## ข้อควรระวัง

- ตอนมีเอกสารใช้สินค้าแล้ว ห้ามเปลี่ยน `unit_type` ของสินค้า (ดู [[tbl-ic-inventory]]) แต่ตารางหน่วยถูกเขียนใหม่ทั้งชุดทุกครั้งที่บันทึก
- สินค้าที่ลบ (เฉพาะที่ยังไม่ถูกใช้ในเอกสาร) แถวใน `ic_unit_use` ถูกลบพร้อมกัน (`itemChildTables`, `item_master.go:812`)
- การเปลี่ยนรหัสสินค้าแก้คอลัมน์ `ic_code` ของตารางนี้ด้วย (`workflow.go:146`)

## ที่มาในโค้ด

- `scripts/sql/02_data_schema.sql:7250-7268`
- `backend/internal/application/process/item_master.go:273-338`, `:726-730`, `:812`
- `backend/internal/application/process/stock_tools.go:499-508`, `:514-523`
- `backend/internal/application/process/trans_set_item.go:42-44`
- `backend/internal/application/process/service.go:630-647`
- `backend/internal/application/process/report_menu_ic.go:290-316`
- `backend/internal/application/process/workflow.go:146`
