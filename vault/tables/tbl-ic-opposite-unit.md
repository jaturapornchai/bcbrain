---
title: "หน่วยนับตรงข้าม/หน่วยขนาน (ic_opposite_unit)"
tags: [tables, ic]
aliases: ["ic_opposite_unit", "หน่วยตรงข้าม", "หน่วยขนาน"]
sources: ["scripts/sql/02_data_schema.sql:5935", "backend/internal/application/process/service.go:808", "backend/internal/platform/db/pool.go:17", "backend/internal/application/process/item_master.go:340", "backend/internal/application/process/item_master.go:731", "backend/internal/application/process/item_master.go:812", "backend/internal/application/process/workflow.go:140"]
---
# หน่วยนับตรงข้าม (`ic_opposite_unit`)

**หน้าที่:** เก็บคู่หน่วยตรงข้ามของสินค้าที่ใช้หน่วยขนาน (`ic_inventory.unit_type` 2 หรือ 3) โครงสร้างเหมือน [[tbl-ic-unit-use]] แต่ใช้คอลัมน์ `unit_code` แทน `code` ความหมายเชิงธุรกิจเต็มๆ ของ "หน่วยตรงข้าม" ไม่ชัดจากโค้ดที่อ่าน (ระบุแค่ว่าเป็นกริดในหน้าสินค้า)

## คอลัมน์ (จาก DDL ใน `erpSchemaSQL`, `service.go:808-820`)

| column | ความหมาย | ชนิด |
|---|---|---|
| `ic_code` | รหัสสินค้า ([[tbl-ic-inventory]]) | VARCHAR(50) |
| `unit_code` | รหัสหน่วย ([[tbl-ic-unit]]) | VARCHAR(50) |
| `stand_value`, `divide_value` | ตัวตั้ง/ตัวหาร อัตราแปลง (default 1) | NUMERIC(18,4) |
| `ratio` | `stand_value / divide_value` (default 1) | NUMERIC(18,4) |
| `status`, `line_number` | สถานะ / ลำดับบรรทัด | INTEGER |
| `roworder` | SERIAL PRIMARY KEY | — |

## กระบวนการ

- Go backend สร้างตารางนี้เองด้วย `CREATE TABLE IF NOT EXISTS` พร้อม `ALTER ... ADD COLUMN IF NOT EXISTS` สำหรับ `ratio`, `status`, `line_number` ใน `erpSchemaSQL` ซึ่งรันครั้งแรกที่เปิดฐานข้อมูลบริษัท (`service.go:808-820,972-974`) และมี DDL ชุดเดียวกันใน `companySchemaSQL` ที่รันตอนเปิด pool (`pool.go:17-32,215-217`); สคริปต์ `scripts/sql/02_data_schema.sql:5935-5945` มี CREATE ของตารางนี้อีกชุด (`unit_code`/`ic_code` varchar 25, `stand_value`, `divide_value`, `status`) ที่ไม่มี `ratio` และ `line_number` สองคอลัมน์นี้จึงมาจาก `erpSchemaSQL` และชนิดคอลัมน์ขึ้นกับว่าชุดไหนสร้างตารางก่อน (`CREATE TABLE IF NOT EXISTS`)
- เขียน: บันทึกสินค้า = DELETE ของสินค้านั้นแล้ว INSERT ใหม่จากกริด `oppositeUnits` โดย `ratio` คำนวณเป็น `stand_value / divide_value` (`item_master.go:731-734`)
- ตรวจก่อนเขียน: ข้ามแถวที่ `unit_code` ว่าง, ตัวตั้ง/ตัวหารต้องมากกว่า 0, หน่วยซ้ำในตารางไม่ได้ (`parseItemOppositeUnits` `item_master.go:340-375`); สินค้าที่ `unit_type` เป็น 2 หรือ 3 ต้องมีอย่างน้อย 1 แถว (`item_master.go:593-595`)
- ลบพร้อมสินค้าที่ยังไม่ถูกใช้ในเอกสาร (`itemChildTables`, `item_master.go:812`) และแก้ตามเมื่อเปลี่ยนรหัสสินค้า (`workflow.go:140`)

## ที่มาในโค้ด

- `scripts/sql/02_data_schema.sql:5935-5945`
- `backend/internal/application/process/service.go:808-820`, `:972-974`
- `backend/internal/platform/db/pool.go:17-32`, `:215-217`
- `backend/internal/application/process/item_master.go:340-375`, `:593-595`, `:731-734`, `:812`
- `backend/internal/application/process/workflow.go:140`
