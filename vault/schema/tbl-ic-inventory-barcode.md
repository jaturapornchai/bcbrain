---
title: "ic_inventory_barcode — บาร์โค้ด ราคาตามบาร์โค้ด เงื่อนไขส่วนลด และระดับสินค้า"
tags: [schema, inventory, barcode, pos, pricing, bcaiaccount]
aliases: [ic_inventory_barcode, ic_inventory_barcode_price, ic_inventory_barcode_condition, ic_inventory_level, บาร์โค้ดสินค้า]
sources:
  - scripts/sql/02_data_schema.sql:5336-5399
  - scripts/sql/02_data_schema.sql:5552-5569
  - scripts/sql/04_seed_data.sql:375-384
  - backend/internal/application/process/item_master.go:84-100
  - backend/internal/application/process/barcode_discount.go:19-180
  - backend/internal/application/process/stock_tools.go:125-131
  - backend/internal/application/process/report_menu_ic.go:920-931
---

# `ic_inventory_barcode` — บาร์โค้ด ราคาตามบาร์โค้ด เงื่อนไขส่วนลด และระดับสินค้า

กลุ่มตารางบาร์โค้ดใช้สำหรับสแกนขาย/POS, จัดซื้อ, และตรวจรับสต็อก โดย 1 สินค้าใน [[tbl-ic-inventory]] สามารถมีได้หลายบาร์โค้ดตามหน่วยนับใน [[tbl-ic-unit]] พร้อมกำหนดราคาขายปกติ-สมาชิก 4 ระดับ, ส่วนลดเฉพาะบาร์โค้ด, และระดับการจัดหมวดราคา/ลำดับการแสดงผล

## 1. `ic_inventory_barcode` (`02_data_schema.sql:5336-5361`)

- **ไม่มี SQL `PRIMARY KEY`** ใน `02_data_schema.sql` — ใช้ `roworder SERIAL NOT NULL` และ Index `idx_ic_inventory_barcode_barcode` ON `ic_inventory_barcode (barcode)`
- *(หมายเหตุ)*: เมื่อใช้ `barcode` ค้นหาใน SQL แนะนำ `ORDER BY roworder LIMIT 1` หรือ `DISTINCT ON (barcode)` ตามแบบ `stock_tools.go:126-130` และ `item_detail.go:555`

| คอลัมน์ | ชนิดข้อมูล SQL | ความหมาย |
|---|---|---|
| `ic_code`, `barcode` | `varchar(25)` | รหัสสินค้า (JOIN `ic_inventory.code`) และรหัสบาร์โค้ด *(หมายเหตุ: Go `stock_tools.go:109` ตรวจ input ยาวไม่เกิน 50 ตัวอักษร แต่คอลัมน์ใน `02_data_schema.sql` คือ `varchar(25)`)* |
| `unit_code`, `description` | `varchar(25)`, `varchar(255)` | หน่วยนับที่ผูกกับบาร์โค้ดนี้ และรายละเอียดบนป้าย/หน้าจอขาย |
| `wh_code`, `shelf_code` | `varchar(25)` | คลังและที่เก็บเฉพาะบาร์โค้ด (ถ้ากำหนด) |
| `price`, `price_2`, `price_3`, `price_4` | `numeric` | ราคาขายบุคคลทั่วไป ระดับ 1–4 |
| `price_member`, `price_member_2..4` | `numeric` | ราคาขายสำหรับสมาชิก ระดับ 1–4 |
| `hidden_text`, `no_point`, `status`, `line_number` | `smallint`, `integer` | ซ่อนข้อความ, งดให้แต้มสมาชิก (`no_point = 1`), สถานะใช้งาน (`1` ใน `04_seed_data.sql:376-383`), และลำดับแถว |

*(หมายเหตุ: `item_master.go:97-99` มีฟิลด์ `is_clearance`, `from_date`, `to_date` ในโครงสร้างรับค่า แต่ควรตรวจสอบคอลัมน์จริงในฐานข้อมูลปลายทางหากต้องใช้งานฟิลด์ดังกล่าว)*

## 2. `ic_inventory_barcode_price` (`02_data_schema.sql:5380-5399`)

ตารางกำหนด **ส่วนลดเฉพาะบาร์โค้ด** (`barcode_discount.go:19,82-180`) ตามช่วงจำนวน, ช่วงวันที่, และล็อกสิทธิ์:
- **Index**: `idx_ic_inventory_barcode_price_barcode` ON `ic_inventory_barcode_price (barcode)`
- **คอลัมน์สำคัญ**:
  - `barcode` (`varchar(25)`): อ้างบาร์โค้ดใน `ic_inventory_barcode`
  - `discount_type` (`integer`): กลุ่มเงื่อนไขส่วนลด (`1..5` ใน `barcode_discount.go:19`)
  - `discount_word` (`varchar(25)`): สูตรส่วนลด (เช่น `"10%"`, `"50"`, `"10%+5%"`)
  - `qty_begin`, `qty_end` (`integer`), `date_begin`, `date_end` (`date`): เงื่อนไขจำนวนและช่วงวันที่ที่มีผล
  - `priority`, `status`, `lock_discount` (`smallint`), `lock_code_list`, `lock_day` (`varchar(1000)`): ลำดับความสำคัญและการล็อกวัน/สาขา

## 3. `ic_inventory_barcode_condition` (`02_data_schema.sql:5363-5378`)

ตารางเก็บเงื่อนไขเพิ่มเติม 6 ช่องของบาร์โค้ด:
- **Index**: `idx_ic_inventory_barcode_condition_barcode` ON `ic_inventory_barcode_condition (barcode)`
- **คอลัมน์**: `ic_code`, `unit_code`, `barcode`, `condition_1`..`condition_6` (`varchar(255)`)

## 4. `ic_inventory_level` (`02_data_schema.sql:5552-5569`)

ตารางระดับ/หมวดหมู่ราคาขายปลีกย่อยผูกสินค้า-หน่วยนับ-บาร์โค้ด (`workflow.go:150`, `sysproc_ic_checks_data.go:47`):
- **Index**: `idx_ic_inventory_level_barcode` ON `ic_inventory_level (barcode)`
- **คอลัมน์**: `ic_code`, `unit_code`, `barcode`, `level_1..4` (`varchar(50)`), `price` (`numeric`), `suggest_remark`, `option` (`varchar(255)`), `sort_order` (`numeric`)

## ตัวอย่าง SQL จริงจากระบบ

### สแกนตรวจบาร์โค้ดพร้อมชื่อสินค้าและราคา 4 ระดับ (`stock_tools.go:125-130`)

```sql
SELECT DISTINCT ON (b.barcode)
       b.barcode,
       b.ic_code,
       COALESCE(i.name_1, '') AS item_name,
       COALESCE(b.unit_code, '') AS unit_code,
       COALESCE(b.price, 0)::text AS price_1,
       COALESCE(b.price_2, 0)::text AS price_2,
       COALESCE(b.price_3, 0)::text AS price_3,
       COALESCE(b.price_4, 0)::text AS price_4
FROM ic_inventory_barcode b
LEFT JOIN ic_inventory i ON i.code = b.ic_code
WHERE b.barcode = ANY($1)
ORDER BY b.barcode, b.roworder;
```
