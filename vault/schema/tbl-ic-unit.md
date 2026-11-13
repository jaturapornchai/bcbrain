---
title: "ic_unit & ic_unit_use — หน่วยนับ ตัวคูณแปลงหน่วย หน่วยขนาน และสี/ขนาด/ลาย"
tags: [schema, inventory, unit, conversion, parallel_unit, bcaiaccount]
aliases: [ic_unit, ic_unit_use, ic_opposite_unit, ic_unit_type, ic_size_use, ic_color_use, ic_pattern_use]
sources:
  - scripts/sql/02_data_schema.sql:4910-4935
  - scripts/sql/02_data_schema.sql:5571-5582
  - scripts/sql/02_data_schema.sql:5935-5945
  - scripts/sql/02_data_schema.sql:5990-6014
  - scripts/sql/02_data_schema.sql:6450-6479
  - scripts/sql/02_data_schema.sql:7220-7268
  - scripts/sql/03_audit_r1_migrations.sql:131-152
  - backend/internal/platform/db/pool.go:27-29
  - backend/internal/application/process/service.go:650-663
  - backend/internal/application/process/service.go:824-836
  - backend/internal/application/process/service.go:970-971
  - backend/internal/application/process/item_master.go:273-320
  - backend/internal/application/process/item_detail.go:503-525
  - backend/internal/application/process/trans_grid.go:214
  - backend/internal/application/process/ai_copilot.go:135
---

# `ic_unit` & `ic_unit_use` — หน่วยนับ ตัวคูณแปลงหน่วย หน่วยขนาน และสี/ขนาด/ลาย

ระบบจัดการหน่วยนับของสินค้าใช้ตารางแม่ **`ic_unit`** สำหรับมาสเตอร์หน่วยนับทั่วระบบ, **`ic_unit_use`** สำหรับตารางอัตราแปลงหลายหน่วยต่อสินค้า (`stand_value` / `divide_value`), และ **`ic_opposite_unit`** สำหรับหน่วยนับขนาน/คู่ตรงข้าม (`unit_type IN (2, 3)`) รวมถึงตารางผูกสี ขนาด และลายต่อสินค้า

## 1. ตารางหน่วยนับหลัก (`ic_unit` & `ic_unit_type`)

- **`ic_unit`** (`7220-7233`): มาสเตอร์หน่วยนับ (`code varchar(25)`, `name_1 varchar(100)`, `name_2 varchar(100)`, `status smallint`, `guid_code`) — Index `idx_ic_unit_code` ON `(code)`
- **`ic_unit_type`** (`7235-7248`): ประเภทหน่วยนับ (`code`, `name_1`, `name_2`, `status`) — Index `idx_ic_unit_type_code`

## 2. ตารางตัวคูณแปลงหน่วยต่อสินค้า (`ic_unit_use`, `02_data_schema.sql:7250-7268`)

- **ไม่มี SQL `PRIMARY KEY`** (ใช้ `roworder SERIAL NOT NULL`)
- **Indexes**:
  - `idx_ic_unit_use_code` ON `ic_unit_use (code)` (`7268`)
  - `idx_ic_unit_use_ic_code_unit` ON `ic_unit_use (ic_code, code)` — **Go Runtime สร้างเพิ่ม** (`service.go:970-971`) เพื่อเร่ง JOIN กับ `ic_trans_detail`

| คอลัมน์ | ชนิดข้อมูล SQL | ความหมาย |
|---|---|---|
| `ic_code`, `code` | `varchar(25)` | รหัสสินค้า (`ic_inventory.code`) และรหัสหน่วยนับ (`ic_unit.code`) |
| `stand_value`, `divide_value` | `numeric` (DEFAULT `1` หลัง Migration R1) | **ตัวตั้งและตัวหารแปลงเป็นหน่วยฐาน** เช่น 1 ลัง = 12 ชิ้น -> `stand_value = 12, divide_value = 1` (Go `item_master.go:296` ห้ามเป็น 0 ทั้งคู่; `03_audit_r1_migrations.sql:141-152` แก้ค่า 0 ให้เป็น 1) |
| `ratio` | `numeric` | อัตราส่วนเปรียบเทียบ (`stand_value / divide_value`) |
| `width_length_height`, `weight`, `unit_size` | `varchar(100)`, `numeric` | ขนาด กว้างxยาวxสูง, น้ำหนัก, และขนาดเทียบของหน่วยนั้น *(สินค้าหน่วยเดี่ยวจะคัดลอกจาก header ลงแถวหน่วยต้นทุนตาม `item_master.go:300`)* |
| `line_number`, `row_order`, `status`, `remark` | `integer`, `smallint`, `varchar(255)` | ลำดับในตารางหน่วย (`row_order`), สถานะใช้งาน (`1` = ใช้งานใน `04_seed_data.sql:366-373`) |

## 3. หน่วยนับขนาน (`ic_opposite_unit`, `02_data_schema.sql:5935-5945`) & แพ็กเกจ

- **`ic_opposite_unit`**: เก็บหน่วยขนานสำหรับสินค้าที่มี `ic_inventory.unit_type IN (2, 3)` (เช่น เหล็ก/ท่อ/กระเบื้องที่ขายทั้ง "เส้น" และ "กิโลกรัม" โดย `qty` และ `qty_2` เดินคู่ขนานแยกจากกันตาม `trans_grid.go:214` และ `ai_copilot.go:135`)
  - ใน `02_data_schema.sql:5935-5945` มีคอลัมน์: `ic_code`, `unit_code`, `stand_value`, `divide_value`, `status`
  - **Go Runtime (`pool.go:27-29`, `service.go:824-836`)** `CREATE TABLE IF NOT EXISTS` (พร้อม `roworder SERIAL PRIMARY KEY`) และ `ALTER TABLE` เพิ่ม: `ratio NUMERIC(18,4) DEFAULT 1`, `status INTEGER DEFAULT 0`, `line_number INTEGER DEFAULT 0`
- **`ic_inventory_package`** (`5571-5582`, Index `code`): แปลงหน่วยบรรจุภัณฑ์ต่อสินค้า (`ic_code`, `code`, `stand_value`, `divide_value`, `price`)

## 4. ตารางมาสเตอร์และตารางผูกสี ขนาด และลายต่อสินค้า (`item_detail.go:503-525`)

| ตาราง Master (`02_data_schema.sql`) | ตารางผูกกับสินค้า (`*_use`) | คอลัมน์สำคัญใน `*_use` |
|---|---|---|
| `ic_color` (`4910-4923`) | `ic_color_use` (`4925-4935`) | `ic_code`, `code`, `remark`, `status` (Index `code`) |
| `ic_size` (`6450-6465`) | `ic_size_use` (`6467-6479`) | `ic_code`, `code`, `width_length_height`, `weight numeric`, `remark`, `status` (Index `code`) |
| `ic_pattern` (`5990-6003`) | `ic_pattern_use` (`6005-6014`) | `ic_code`, `code`, `status` (Index `code`) |

## ตัวอย่าง SQL จริงจากระบบ

### ตรวจสอบตัวคูณหน่วยนับบน `ic_trans_detail` เทียบกับ `ic_unit_use` สำหรับสินค้าหลายหน่วย (อ้างอิงเงื่อนไขจาก `service.go:652-653`)

```sql
SELECT d.doc_no, d.doc_date, d.item_code, d.unit_code,
       d.stand_value AS detail_stand_value,
       d.divide_value AS detail_divide_value,
       u.stand_value AS master_stand_value,
       u.divide_value AS master_divide_value,
       COALESCE(d.qty, 0) * (COALESCE(NULLIF(u.stand_value, 0), 1) / COALESCE(NULLIF(u.divide_value, 0), 1)) AS base_qty
FROM ic_trans_detail d
JOIN ic_inventory i ON i.code = d.item_code
JOIN ic_unit_use u ON u.ic_code = d.item_code AND u.code = d.unit_code
WHERE i.unit_type IN (1, 3)
  AND COALESCE(u.stand_value, 0) > 0
  AND COALESCE(u.divide_value, 0) > 0
  AND (
      COALESCE(d.stand_value, 0) IS DISTINCT FROM u.stand_value
      OR COALESCE(d.divide_value, 0) IS DISTINCT FROM u.divide_value
  )
ORDER BY d.doc_date DESC, d.doc_no
LIMIT 100;
```
