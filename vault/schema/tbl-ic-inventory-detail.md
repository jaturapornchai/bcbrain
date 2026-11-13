---
title: "ic_inventory_detail — ค่าควบคุมสต็อกขั้นสูง มิติ 1–45 และสินค้าเชื่อมโยง/Bundle"
tags: [schema, inventory, control, dimension, bundle, bcaiaccount]
aliases: [ic_inventory_detail, ic_inventory_permission, ic_inventory_bundle, ic_inventory_replacement, มิติสินค้า]
sources:
  - scripts/sql/02_data_schema.sql:5311-5334
  - scripts/sql/02_data_schema.sql:5401-5525
  - scripts/sql/02_data_schema.sql:5584-5602
  - scripts/sql/02_data_schema.sql:5712-5747
  - scripts/sql/02_data_schema.sql:5779-5788
  - scripts/sql/02_data_schema.sql:6343-6371
  - backend/internal/application/process/item_detail.go:62-90
  - backend/internal/application/process/item_detail.go:170-195
  - backend/internal/application/process/item_detail.go:415-558
  - backend/internal/application/process/trans_save_rules.go:108
  - backend/internal/application/process/trans_save_rules.go:295-322
---

# `ic_inventory_detail` — ค่าควบคุมสต็อกขั้นสูง มิติ 1–45 และสินค้าเชื่อมโยง/Bundle

`ic_inventory_detail` เก็บการตั้งค่าขั้นสูง 1:1 ของสินค้าใน [[tbl-ic-inventory]] โดยเน้นเรื่อง **กฎควบคุมการตัดสต็อก (`balance_control`)**, **ล็อกราคา/ส่วนลด/ต้นทุน**, **ระงับซื้อ-ขาย**, **คลังเริ่มต้นซื้อ-ขาย-เบิก**, และ **มิติสินค้า 45 ช่อง (`dimension_1..45`)** พร้อมตารางประกอบกลุ่มสิทธิ์, สินค้าแนบ/ทดแทน/แนะนำ/Bundle

> [!IMPORTANT] ความสัมพันธ์กับ `item_type = 5`
> ใน `item_detail.go:416` (`ItemDetailSave`) ระบบสร้างแถว `ic_inventory_detail` ให้เฉพาะสินค้าที่ `item_type <> 5` เท่านั้น

## `ic_inventory_detail` (`02_data_schema.sql:5415-5525`)

- **ไม่มี SQL `PRIMARY KEY`** ใน `02_data_schema.sql` — เชื่อมด้วย `ic_code` (`varchar(25)`) 1:1 กับ `ic_inventory.code`
- **ไม่มี Index แยกใน `02_data_schema.sql`** — เวลา JOIN กับ `ic_inventory` แนะนำให้คัดกรองจาก `ic_inventory.code` หรือทำ Expression Index ตามต้องการ

| คอลัมน์ | ชนิดข้อมูล SQL | ความหมาย / ค่า Flag ที่สำคัญ |
|---|---|---|
| `ic_code` | `varchar(25)` | รหัสสินค้า (1:1 กับ `ic_inventory.code`) |
| `balance_control` | `smallint` | **ตัวควบคุมสต็อกติดลบระดับรายสินค้า** (`trans_save_rules.go:108,295,319`): `0` = ใช้กฎตรวจยอดคงเหลือตาม `erp_option`, **`1` = ยกเว้นการตรวจสต็อกติดลบ (Unchecked)** |
| `accrued_control` | `smallint` | ควบคุมยอดค้างรับ/ค้างส่งระดับสินค้า |
| `lock_price`, `lock_discount`, `lock_cost` | `smallint` | ล็อกไม่ให้แก้ราคาขาย, ส่วนลด, หรือต้นทุนบนหน้าเอกสาร (`1` = ล็อก) |
| `is_hold_purchase`, `is_hold_sale`, `is_stop`, `is_end` | `smallint` | ระงับการสั่งซื้อ, ระงับการขาย, หยุดเคลื่อนไหว, เลิกผลิต/จำหน่าย |
| `have_point`, `is_premium` | `smallint` | เปิดสะสมแต้ม (`1`) / กำหนดเป็นสินค้าของแถม |
| `start_purchase_wh`, `start_purchase_shelf`, `start_purchase_unit` | `varchar(25)` | คลัง, ที่เก็บ, และหน่วยนับเริ่มต้นเมื่อเปิดเอกสารซื้อ |
| `start_sale_wh`, `start_sale_shelf`, `start_sale_unit`, `before_sale_unit` | `varchar(25)` | คลัง, ที่เก็บ, และหน่วยนับเริ่มต้นเมื่อเปิดเอกสารขาย |
| `ic_out_wh`, `ic_out_shelf`, `ic_reserve_wh`, `reserve_status` | `varchar(25)`, `smallint` | คลังเบิกออก, ที่เก็บเบิกออก, และคลังจองสินค้า |
| `po_over`, `so_over` | `integer` | เปอร์เซ็นต์/เงื่อนไขรับเกินใบสั่งซื้อ หรือส่งเกินใบสั่งขาย |
| `maximum_qty`, `minimum_qty`, `purchase_point` | `numeric` | จุดสูงสุด, จุดต่ำสุด, และจุดสั่งซื้อระดับภาพรวมสินค้า |
| `sale_price_1..4`, `cost_produce`, `cost_standard`, `discount` | `numeric`, `varchar(50)` | ราคาอ้างอิง 4 ระดับ, ต้นทุนผลิต/มาตรฐาน, ส่วนลด |
| `dimension_1..20` | `varchar(25)` | มิติสินค้า 1–20 (อ้างอิงรหัสจาก `ic_dimension` ตาม `dimension_number` ใน `item_detail.go:65`) |
| `dimension_21..45` | `varchar(255)` | มิติสินค้า 21–45 แบบข้อความอิสระความยาว 255 ตัวอักษร (`item_detail.go:68`) |
| `ref_file_1..5` | `varchar(255)` | พาธเอกสารแนบอ้างอิง 1–5 |

## ตารางเสริมความสัมพันธ์และสิทธิ์สินค้า (`item_detail.go:464-558`)

1. **`ic_inventory_permission`** (`5584-5602`): คุมสิทธิ์สินค้าตามโมดูล/ชนิดเอกสารด้วย Flag `smallint` (`ib`, `if`, `rim`, `wsdw`, `wsdd`, `io`, `pu`, `pa`, `pi`, `ir`, `st`, `line_number`) ต่อ `ic_code`
2. **สินค้าที่ต้องขาย/ซื้อแนบคู่กัน (`ic_inventory_append` `5311-5321` & `ic_inventory_append_detail` `5323-5334`)**:
   - หัวกลุ่ม `ic_inventory_append`: `ic_append_code`, `ic_append_name`, `status`
   - รายการลูก `ic_inventory_append_detail`: `ic_append_code`, `ic_code`, `unit_code`, `line_number`
3. **สินค้าทดแทน (`ic_inventory_replace` `5712-5722`, `ic_inventory_replace_detail` `5724-5735`, `ic_inventory_replacement` `5737-5747`)**:
   - `ic_inventory_replacement`: ตารางคู่ตรงระหว่างสินค้าหลัก `ic_code` กับสินค้าทดแทน `ic_replace_code` (`line_number`, `remark`, `status`) ที่ `ItemDetailSave` (`item_detail.go:527`) เขียนโดยตรง
4. **สินค้าแนะนำขายต่อ (`ic_inventory_suggest` `5779-5788`)**: `ic_code`, `ic_suggest_code`, `line_number`, `status` (`item_detail.go:535`)
5. **สินค้าจัดชุดแบบขายด้วยบาร์โค้ด (`ic_inventory_bundle` `5401-5413`)**: `ic_code_bundle` (สินค้าหัว Bundle), `barcode`, `ic_code` (สินค้าลูก), `unit_code`, `qty`, `line_number` + Index `idx_ic_inventory_bundle_barcode` (`5413`) — ใช้คู่กับ `ic_inventory_barcode` (`item_detail.go:479,552`)
6. **ตารางความสัมพันธ์ทั่วไป (`ic_relation` `6343-6354` & `ic_relation_detail` `6356-6371`)**: จับคู่สินค้า/เอกสารเชื่อม (`ic_code_1`/`qty_1` <-> `ic_code_2`/`qty_2`, `transection_flag`)
7. *หมายเหตุตารางเสริม C# ใน Go Runtime*: `item_detail.go:189,540-544` อ้างถึงตาราง `ic_manufacturer_list (ic_code, manufacturer_code, status, line_number)` เพื่อผูกหลายผู้ผลิตจาก [[tbl-ap-supplier]] (ซึ่งไม่อยู่ใน `02_data_schema.sql` แต่อาจมีอยู่ในฐานข้อมูลเดิมที่ย้ายจาก C#)

## ตัวอย่าง SQL จริง: ดึงข้อมูลควบคุมสต็อกและรายชื่อผู้ผลิต/สินค้าทดแทนของสินค้า

```sql
SELECT i.code, i.name_1,
       COALESCE(d.balance_control, 0) AS balance_control,
       COALESCE(d.is_hold_sale, 0) AS is_hold_sale,
       COALESCE(d.is_hold_purchase, 0) AS is_hold_purchase,
       d.dimension_1,
       r.ic_replace_code,
       s.ic_suggest_code
FROM ic_inventory i
LEFT JOIN ic_inventory_detail d ON d.ic_code = i.code
LEFT JOIN ic_inventory_replacement r ON r.ic_code = i.code AND COALESCE(r.status, 0) = 0
LEFT JOIN ic_inventory_suggest s ON s.ic_code = i.code AND COALESCE(s.status, 0) = 0
WHERE i.code = $1;
```
