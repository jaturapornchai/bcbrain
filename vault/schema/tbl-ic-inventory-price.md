---
title: "ic_inventory_price — ตารางราคาขาย สูตรคำนวณราคา ราคารับซื้อ ส่วนลด และสินค้าชุด Set"
tags: [schema, inventory, pricing, discount, set_item, bcaiaccount]
aliases: [ic_inventory_price, ic_inventory_price_formula, ic_inventory_purchase_price, ic_inventory_discount, ic_inventory_set_detail]
sources:
  - scripts/sql/02_data_schema.sql:5043-5059
  - scripts/sql/02_data_schema.sql:5527-5550
  - scripts/sql/02_data_schema.sql:5617-5701
  - scripts/sql/02_data_schema.sql:5749-5777
  - scripts/sql/02_data_schema.sql:6016-6041
  - scripts/sql/02_data_schema.sql:6259-6294
  - backend/internal/application/process/price_engine.go:47-86
  - backend/internal/application/process/price_engine.go:203-227
  - backend/internal/application/process/modify_price.go:26-46
  - backend/internal/application/process/master_detail_specs.go:40-66
  - backend/internal/application/process/trans_set_item.go:30-63
  - backend/internal/application/process/report_menu_ic.go:935-955
---

# `ic_inventory_price` — ตารางราคาขาย สูตรคำนวณราคา ราคารับซื้อ ส่วนลด และสินค้าชุด Set

กลุ่มตารางกำหนดกลยุทธ์ราคาซื้อ-ขาย ส่วนลดตามเงื่อนไข และโครงสร้างสินค้าชุด Set (`item_type = 3` / `5`) โดยฝั่งขายใช้ `price_engine.go` เป็นตัวคำนวณลำดับความสำคัญ (Priority Cascade) จากระดับลูกค้ารายตัว -> กลุ่มลูกค้า -> ราคาทั่วไป -> ราคามาตรฐาน -> สูตรราคา `price_0..9`

## 1. ตารางราคาขายตามเงื่อนไข (`ic_inventory_price` `02_data_schema.sql:5617-5643`)

- **ไม่มี SQL `PRIMARY KEY`** (ใช้ `roworder SERIAL NOT NULL` และ Index `idx_ic_inventory_price_cust_code` ON `ic_inventory_price (cust_code)`)
- **กลไกแบ่งหมวดด้วย `price_mode` และ `price_type`** (`modify_price.go:26,38-44`, `price_engine.go:67-76`):
  - `price_mode`: `0` = **ราคามาตรฐาน** (Standard), `1` = **ราคาทั่วไป/ปกติ** (General)
  - `price_type`: `1` = ราคาตามสินค้าทั่วไป, `2` = ราคาตามกลุ่มลูกค้า (`cust_group_1`, `cust_group_2` เชื่อม `ar_customer_detail`), `3` = ราคาเฉพาะลูกค้า (`cust_code`)
- **คอลัมน์สำคัญ**: `ic_code`, `unit_code`, `from_qty`, `to_qty`, `from_date`, `to_date`, `sale_type` (`0` ทุกประเภท / `1` สด / `2` เชื่อ), `transport_type`, `sale_price1` (ราคาขายปกติ), `sale_price2` (ราคา 2), `price_currency`, `currency_code`, `status`, `line_number`

### ลำดับ Priority การค้นหาราคาขายจริง (`price_engine.go:67-76`)

1. เฉพาะลูกค้า: `cust_code = $cust AND price_type = 3` (`ORDER BY price_mode DESC, sale_type DESC, transport_type DESC`)
2. ตามกลุ่มลูกค้า: `price_type = 2` โดยจับคู่ `cust_group_1` กับ `ar_customer_detail.group_main` และ `cust_group_2` กับ `group_sub_1..4` (หรือ `''`)
3. ราคาตามสินค้าปกติ: `price_type = 1 AND price_mode = 1`
4. ราคาตามสินค้ามาตรฐาน: `price_type = 1 AND price_mode = 0`

## 2. สูตรคำนวณราคา (`ic_inventory_price_formula` & `ic_price_formula_template`)

- **`ic_inventory_price_formula`** (`5645-5666`): เก็บราคากลางและสูตรราคา 10 ระดับต่อ `(ic_code, unit_code)` ได้แก่ `price_0` (ใช้เป็นราคากลางเทียบราคาขายใน `report_menu_so_po.go:757`) ถึง `price_9` (`varchar(50)` รองรับทั้งตัวเลขหรือสูตร เช่น บวก/คูณ/เปอร์เซ็นต์), `sale_type`, `tax_type`, `price_currency`, `currency_code`
- **`ic_price_formula_template`** (`6025-6041`): แม่แบบสูตรราคา (`code`, `price_1`..`price_9`) มี Index `idx_ic_price_formula_template_code`
- **`ic_inventory_price_thai7`** (`5668-5679`) & **`ic_price_adjust_detail`** (`6016-6023`): ราคาเพิ่มเติมสำหรับแพลตฟอร์มภายนอก (`price_name`, `price`, `date_save`) และตารางรายการปรับราคา (`ic_code`, `unit_code`)

## 3. ตารางส่วนลดสินค้าและกลุ่มส่วนลด

- **`ic_inventory_discount`** (`5527-5550`, Index `cust_code`):
  - แบ่งระดับตาม `discount_type` (`price_engine.go:79-86`): `2` = เฉพาะลูกค้า (`cust_code`), `1` = กลุ่มลูกค้า (`cust_group_1`/`2`), `0` = ทั่วไป
  - เงื่อนไข: `from_qty..to_qty`, `from_date..to_date`, `sale_type`, `transport_type`, `discount` (`varchar(255)`), `discount_mode`
- **`ic_discount_group`** (`5043-5059`, Index `code`): รหัสกลุ่มส่วนลด (`code`, `name_1`, `date_begin`, `date_end`, `discount_list varchar(500)`) ใช้เชื่อมกับ `ic_inventory.ic_discount_group`

## 4. ราคารับซื้อ / ราคาผู้จำหน่าย

- **`ic_inventory_purchase_price`** (`5681-5701`): ราคารับซื้อตามสินค้า-หน่วยนับ-ผู้จำหน่าย (`ic_code`, `unit_code`, `supplier_code`, `from_qty..to_qty`, `from_date..to_date`, `sale_type`, `transport_type`, `sale_price1`, `sale_price2`, `price_type`, `discount`)
- **`ic_purchase_price`** (`6259-6275`, Index `ap_code`) & **`ic_purchase_price_detail`** (`6277-6294`): เอกสารใบเสนอราคามาตรฐานจากผู้จำหน่าย (`doc_no`, `doc_date`, `ap_code`, `start_date`, `stop_date`, `tax_group`) และบรรทัดราคาตามช่วงจำนวน (`ic_code`, `unit_code`, `credit_code`, `sending_type`, `from_qty..to_qty`, `price`, `discount`, `line_number`)

## 5. สินค้าจัดชุด (`ic_inventory_set` & `ic_inventory_set_detail`)

- **`ic_inventory_set`** (`5749-5759`): หัวสูตรชุดสินค้า (`ic_set_code`, `ic_set_neme` *(สะกดตาม DDL จริง)*, `remark`, `status`)
- **`ic_inventory_set_detail`** (`5761-5777`, Index `idx_ic_inventory_set_detail_barcode`): รายการสินค้าส่วนประกอบในชุด (`ic_set_code`, `ic_code`, `unit_code`, `qty`, `price`, `sum_amount`, `price_ratio`, `barcode`, `line_number`, `status`)
  - เมื่อเลือกสินค้า `item_type IN (3, 5)` ลงเอกสาร (`trans_set_item.go:30-45`), ระบบจะดึงแถวจาก `ic_inventory_set_detail` มาแตกเป็นบรรทัดลูกที่ผูก `set_ref_line = parent.ref_guid` โดยบรรทัดแม่ (`item_type = 3/5`) จะไม่นับเข้าสต็อกและยอดรวมบิล แต่จะนับผ่านบรรทัดลูกแทน

## ตัวอย่าง SQL จริง: แตกส่วนประกอบสินค้าชุด Set พร้อมตัวคูณหน่วย (`trans_set_item.go:34-45`)

```sql
SELECT d.ic_code,
       COALESCE(i.name_1, '') AS item_name,
       COALESCE(d.unit_code, '') AS unit_code,
       COALESCE(u.stand_value, 1)::text AS stand_value,
       COALESCE(u.divide_value, 1)::text AS divide_value,
       COALESCE(u.ratio, 1)::text AS ratio,
       COALESCE(d.qty, 0) AS qty,
       COALESCE(d.price, 0) AS price,
       COALESCE(d.price_ratio, 0) AS price_ratio,
       COALESCE(d.sum_amount, 0) AS sum_amount,
       COALESCE(i.item_type, 0)::int AS item_type
FROM ic_inventory_set_detail d
LEFT JOIN ic_inventory i ON i.code = d.ic_code
LEFT JOIN LATERAL (
    SELECT stand_value, divide_value, ratio
    FROM ic_unit_use
    WHERE ic_code = d.ic_code AND code = d.unit_code
    LIMIT 1
) u ON true
WHERE d.ic_set_code = $1
ORDER BY d.line_number;
```
