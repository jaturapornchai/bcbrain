---
title: "หน่วยนับที่ใช้ของสินค้า (ic_unit_use)"
tags: [tables, ic]
aliases: ["ic_unit_use", "หน่วยนับสินค้า", "ตัวคูณหน่วย stand_value divide_value"]
sources: ["backend/internal/application/process/item_master.go:719", "backend/internal/application/process/trans_set_item.go:30", "backend/internal/application/process/stock_tools.go:499", "backend/internal/application/process/service.go:630", "backend/internal/application/process/report_menu_ic.go:875"]
---
# หน่วยนับที่ใช้ของสินค้า (`ic_unit_use`)

**หน้าที่:** 1 แถว = 1 หน่วยนับที่สินค้าหนึ่งตัวใช้ได้ พร้อมอัตราแปลงเข้าหน่วยมาตรฐาน: `ratio = stand_value / divide_value` (คำนวณตอน INSERT ที่ `item_master.go:727`) ใช้แปลงจำนวนในบรรทัดเอกสาร [[tbl-ic-trans-detail]] (คอลัมน์ `stand_value`, `divide_value`, `ratio` ในบรรทัดคือสำเนาของค่านี้ ณ ตอนบันทึก)

## คอลัมน์ (จาก INSERT ที่ `item_master.go:727`)

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `ic_code` | รหัสสินค้า ([[tbl-ic-inventory]].code) | key ทุกจุด |
| `code` | รหัสหน่วย ([[tbl-ic-unit]].code) | `trans_set_item.go:43` join `u.code = d.unit_code` |
| `stand_value`, `divide_value` | ตัวตั้ง/ตัวหาร ของอัตราแปลง | `item_master.go:727`, `stock_tools.go:499-503` |
| `ratio` | `stand_value / divide_value` | `item_master.go:728` |
| `row_order` | ลำดับแสดง (ค่าว่าง = ใช้ `line_number`) | `item_master.go:728` |
| `width_length_height`, `weight`, `unit_size` | ขนาด/น้ำหนัก/ขนาดหน่วย (`unit_size` ค่าว่าง = NULL) | `item_master.go:729` |
| `status`, `line_number` | สถานะ / ลำดับบรรทัด (server กำหนด `line_number`) | `item_master.go:729` |

## ความสัมพันธ์และกระบวนการ

- n:1 กับ [[tbl-ic-inventory]] (`ic_code`), n:1 กับ [[tbl-ic-unit]] (`code`)
- เขียน: บันทึกสินค้า = DELETE ทุกแถวของสินค้านั้นแล้ว INSERT ใหม่ในทรานแซกชันเดียว (`item_master.go:726-730`)
- หลังบันทึกสินค้า `unit_standard_stand_value/divide_value` ของ [[tbl-ic-inventory]] ถูกดึงจากแถวของหน่วยมาตรฐานเมื่อ `unit_type IN (1, 3)` (`stock_tools.go:499-503`)
- อ่านเมื่อขยายสินค้าชุดเข้ากริดเอกสาร (`trans_set_item.go:42-44`)
- ระบบ WMS (ระบบอื่น) มีตาราง `ic_wms_trans_detail` ซึ่งถูกซิงก์ `stand_value/divide_value` จากตารางนี้ (`service.go:630-636`) — ไม่บันทึกรายละเอียดในที่นี้

## ข้อควรระวัง

- ตอนมีเอกสารใช้สินค้าแล้ว ห้ามเปลี่ยน `unit_type` ของสินค้า (ดู [[tbl-ic-inventory]]) แต่ตารางหน่วยถูกเขียนใหม่ทั้งชุดทุกครั้งที่บันทึก
- สินค้าที่ลบ ตาราง `ic_unit_use` ถูกลบพร้อมกัน (`itemChildTables`, `item_master.go:812`)
- การเปลี่ยนรหัสสินค้าแก้คอลัมน์ `ic_code` ของตารางนี้ด้วย (`workflow.go:146`)

## ที่มาในโค้ด

- `backend/internal/application/process/item_master.go:726-730`, `:812`
- `backend/internal/application/process/stock_tools.go:499-503`
- `backend/internal/application/process/trans_set_item.go:42-44`
- `backend/internal/application/process/service.go:630-636`
- `backend/internal/application/process/workflow.go:146`
