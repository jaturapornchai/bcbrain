---
title: "หน่วยนับตรงข้าม/หน่วยขนาน (ic_opposite_unit)"
tags: [tables, ic]
aliases: ["ic_opposite_unit", "หน่วยตรงข้าม", "หน่วยขนาน"]
sources: ["backend/internal/application/process/service.go:797", "backend/internal/application/process/item_master.go:731", "backend/internal/application/process/item_master.go:812", "backend/internal/application/process/workflow.go:140"]
---
# หน่วยนับตรงข้าม (`ic_opposite_unit`)

**หน้าที่:** เก็บคู่หน่วยตรงข้ามของสินค้าที่ใช้หน่วยขนาน (`ic_inventory.unit_type` 2 หรือ 3) โครงสร้างเหมือน [[tbl-ic-unit-use]] แต่ใช้คอลัมน์ `unit_code` แทน `code` ความหมายเชิงธุรกิจเต็มๆ ของ "หน่วยตรงข้าม" ไม่ชัดจากโค้ดที่อ่าน (ระบุแค่ว่าเป็นกริดในหน้าสินค้า)

## คอลัมน์ (จาก DDL ใน `erpSchemaSQL`, `service.go:797-809`)

| column | ความหมาย | ชนิด |
|---|---|---|
| `ic_code` | รหัสสินค้า ([[tbl-ic-inventory]]) | VARCHAR(50) |
| `unit_code` | รหัสหน่วย ([[tbl-ic-unit]]) | VARCHAR(50) |
| `stand_value`, `divide_value` | ตัวตั้ง/ตัวหาร อัตราแปลง (default 1) | NUMERIC(18,4) |
| `ratio` | `stand_value / divide_value` (default 1) | NUMERIC(18,4) |
| `status`, `line_number` | สถานะ / ลำดับบรรทัด | INTEGER |
| `roworder` | SERIAL PRIMARY KEY | — |

## กระบวนการ

- ในกลุ่ม `ic_` ตารางนี้เป็นตารางเดียวที่ `erpSchemaSQL` มี `CREATE TABLE IF NOT EXISTS` ให้ (ตาราง `ic_` อื่นไม่มี DDL ใน `erpSchemaSQL`; เป็นตารางเดิมของ C#) พร้อม `ALTER ... ADD COLUMN IF NOT EXISTS` สำหรับ `ratio`, `status`, `line_number` (`service.go:797-809`)
- เขียน: บันทึกสินค้า = DELETE ของสินค้านั้นแล้ว INSERT ใหม่จากกริด `oppositeUnits` (`item_master.go:731-735`)
- ลบพร้อมสินค้า (`itemChildTables`, `item_master.go:812`) และแก้ตามเมื่อเปลี่ยนรหัสสินค้า (`workflow.go:140`)

## ที่มาในโค้ด

- `backend/internal/application/process/service.go:797-809`
- `backend/internal/application/process/item_master.go:731-735`, `:812`
- `backend/internal/application/process/workflow.go:140`
