---
title: "ic_warehouse, ic_shelf & ic_wh_shelf — คลังสินค้า ที่เก็บ/ชั้นวาง และจุด Reorder"
tags: [schema, inventory, warehouse, shelf, reorder, bcaiaccount]
aliases: [ic_warehouse, ic_shelf, ic_wh_shelf, ic_inventory_wh, ic_warehouse_location_group, คลังสินค้า]
sources:
  - scripts/sql/02_data_schema.sql:5881-5891
  - scripts/sql/02_data_schema.sql:6485-6505
  - scripts/sql/02_data_schema.sql:7328-7378
  - scripts/sql/02_data_schema.sql:7414-7427
  - scripts/sql/02b_sync_existing_db.sql:7054-7068
  - scripts/sql/03_audit_r1_migrations.sql:49-70
  - scripts/sql/04_seed_data.sql:228-241
  - scripts/sql/04_seed_data.sql:385-390
  - backend/internal/application/process/item_master.go:164-168
  - backend/internal/application/process/stock_rebuild.go:54-65
---

# `ic_warehouse`, `ic_shelf` & `ic_wh_shelf` — คลังสินค้า ที่เก็บ/ชั้นวาง และจุด Reorder

กลุ่มตารางจัดการโครงสร้างการจัดเก็บสินค้าภายในกิจการ เชื่อมโยงระหว่างสาขา ([[tbl-erp-branch-department]]), คลังสินค้า (`ic_warehouse`), ที่เก็บ/ชั้นวาง (`ic_shelf`), และเกณฑ์จุดต่ำสุด-สูงสุดต่อสินค้าในแต่ละคลัง/ที่เก็บ (`ic_wh_shelf`)

> [!IMPORTANT] ข้อสังเกตเรื่องชนิดข้อมูล `ic_wh_shelf.min_point` ในฐานข้อมูลเก่า
> ใน `02_data_schema.sql:7414-7427` คอลัมน์ `min_point` และ `max_point` เป็น `numeric DEFAULT 0.0` แล้ว แต่สำหรับฐานข้อมูลเก่าจาก C# เดิมที่เคยเป็น `varchar(100)` จะมี Migration ใน `02b_sync_existing_db.sql:7068` และ `03_audit_r1_migrations.sql:49-70` แปลง `min_point` เป็น `NUMERIC(18,4)` เพื่อป้องกันความผิดพลาดในการเปรียบเทียบจุดสั่งซื้อ

## 1. `ic_warehouse` — ทะเบียนคลังสินค้า (`02_data_schema.sql:7328-7352`)

- **ไม่มี SQL `PRIMARY KEY`** (ใช้ `roworder SERIAL NOT NULL` และ Index `idx_ic_warehouse_code` ON `ic_warehouse (code)`)
- **คอลัมน์สำคัญ**:
  - `code`, `name_1`, `name_2`: รหัสคลังและชื่อคลัง (เชื่อมกับ `ic_trans.wh_from`/`wh_to` และ `ic_trans_detail.wh_code`/`wh_code_2`)
  - `branch_code`, `branch_use` (`varchar(25)`, `varchar(500)`): สาขาหลักเจ้าของคลัง และรายชื่อสาขาที่อนุญาตให้ใช้งานคลังนี้
  - `address`, `telephone`, `fax`, `latitude`, `longitude`: ที่อยู่และพิกัดคลังสินค้า
  - `user_group`, `wh_manager`, `status` (`smallint`): กลุ่มผู้ดูแล/หัวหน้าคลัง และสถานะ (`0` = ใช้งานปกติ)

## 2. `ic_shelf` — ที่เก็บ / ชั้นวางสินค้า (`02_data_schema.sql:6485-6505`)

- **Index**: `idx_ic_shelf_code` ON `ic_shelf (code)` (ไม่มี SQL `PRIMARY KEY`)
- **คอลัมน์สำคัญ**:
  - `code`, `whcode` (`varchar(10)`): รหัสที่เก็บและรหัสคลังสังกัด (JOIN `ic_warehouse.code = ic_shelf.whcode` — *หมายเหตุ: ชื่อคอลัมน์ใน `ic_shelf` คือ `whcode` ไม่มี underscore ต่างจากตารางอื่นที่ใช้ `wh_code`*)
  - `name_1`, `name_2`, `remark`, `status`
  - `width`, `weight`, `height`, `depth` (`varchar(10)`): ขนาดและน้ำหนักรับได้ของชั้นวาง
  - `stock_control` (`smallint`): สถานะควบคุมสต็อกระดับที่เก็บ

## 3. `ic_wh_shelf` — ผูกสินค้าเข้าคลัง/ที่เก็บ และจุด Reorder (`02_data_schema.sql:7414-7427`)

- **ไม่มี SQL `PRIMARY KEY`** (ใช้ `roworder SERIAL NOT NULL`)
- **Logical Key**: `(ic_code, wh_code, shelf_code)`
- **คอลัมน์สำคัญ**:
  - `ic_code`, `wh_code`, `shelf_code` (`varchar(25)`): สินค้า คลัง และที่เก็บที่อนุญาต/กำหนดค่าจุดสต็อก
  - `min_point`, `max_point` (`numeric`): จุดสั่งซื้อต่ำสุด (Reorder Point) และจุดเก็บสูงสุด
  - `shelf_list` (`varchar(255)`), `remark`, `status` (`smallint`) — ใน `04_seed_data.sql:386-390` ตั้ง `status = 1` เพื่อแสดงว่าคลัง/ที่เก็บนี้เปิดใช้งานกับสินค้านั้น

## 4. ตารางเสริมกลุ่มคลังและที่เก็บ

- **`ic_inventory_wh`** (`5881-5891`): คู่อนุญาต/ค่าตั้งต้นคลัง-ที่เก็บ (`wh_code`, `shelf_code`, `remark`, `status`)
- **`ic_warehouse_location_group`** (`7354-7367`): หัวกลุ่มตำแหน่งจัดเก็บ (`wh_code`, `location_group`, `name_1`, `name_2`, `status`)
- **`ic_warehouse_location_group_detail`** (`7369-7378`): สมาชิกตำแหน่งในกลุ่ม (`wh_code`, `location_group`, `location`, `priolity smallint` *(สะกด `priolity` ตาม DDL จริง)*)

## ตัวอย่าง SQL จริง: ตรวจจับสินค้าต่ำกว่าจุดสั่งซื้อ (`min_point`) เทียบยอดคงเหลือจริงรายคลัง

```sql
WITH stock_bal AS (
    SELECT d.item_code,
           COALESCE(d.wh_code, '') AS wh_code,
           COALESCE(d.shelf_code, '') AS shelf_code,
           SUM(
               COALESCE(d.qty, 0) * COALESCE(d.calc_flag, 0)
               * (COALESCE(NULLIF(d.stand_value, 0), 1) / COALESCE(NULLIF(d.divide_value, 0), 1))
           ) AS balance_qty
    FROM ic_trans_detail d
    WHERE d.last_status = 0
      AND COALESCE(d.is_doc_copy, 0) = 0
      AND COALESCE(d.item_type, 0) IN (0, 4, 6)
      AND d.trans_flag IN (12,310, 14,311, 16, 44,46,48, 54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73, 521,522,523)
      AND NOT (d.trans_flag = 46 AND COALESCE(d.inquiry_type, 0) <> 0)
      AND NOT (d.trans_flag = 48 AND COALESCE(d.inquiry_type, 0) > 1)
      AND NOT (d.trans_flag = 44 AND COALESCE(d.doc_ref, '') <> '' AND COALESCE(d.is_pos, 0) = 1)
      AND NOT (d.trans_flag IN (14, 16, 311) AND COALESCE(d.inquiry_type, 0) IN (1, 3))
    GROUP BY d.item_code, COALESCE(d.wh_code, ''), COALESCE(d.shelf_code, '')
)
SELECT ws.ic_code, i.name_1,
       ws.wh_code, w.name_1 AS wh_name,
       ws.shelf_code, s.name_1 AS shelf_name,
       ws.min_point, ws.max_point,
       COALESCE(sb.balance_qty, 0) AS current_qty
FROM ic_wh_shelf ws
JOIN ic_inventory i ON i.code = ws.ic_code
LEFT JOIN ic_warehouse w ON w.code = ws.wh_code
LEFT JOIN ic_shelf s ON s.code = ws.shelf_code AND s.whcode = ws.wh_code
LEFT JOIN stock_bal sb
  ON sb.item_code = ws.ic_code AND sb.wh_code = ws.wh_code AND sb.shelf_code = ws.shelf_code
WHERE COALESCE(ws.min_point, 0) > 0
  AND COALESCE(sb.balance_qty, 0) < ws.min_point
ORDER BY ws.wh_code, ws.ic_code;
```
