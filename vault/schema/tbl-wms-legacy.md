---
title: ตารางคลังสินค้าดั้งเดิม (Legacy WMS & IC WMS Tables)
tags: [schema, wms, inventory, warehouse, legacy]
aliases: [ic_wms_trans, ic_wms_trans_detail, wms_boxes, wms_cart, wms_job, wms_location, wms_pracel, wms_workers, wms_product_receive, wms_product_out, wms_product_adj_stock, wms_product_trans, wms_serial_master]
sources:
  - scripts/sql/02_data_schema.sql:7371-7602
  - scripts/sql/02_data_schema.sql:9319-9876
---

ชุดตารางระบบคลังสินค้าดั้งเดิม (Legacy WMS / Handheld / Boxing) จากสคีมาฐานข้อมูลกลาง ครอบคลุม 35 ตาราง แบ่งเป็นกลุ่มเอกสารโอนย้าย/WMS (`ic_wms_trans*`), กล่อง/ตะกร้า (`wms_boxes*`, `wms_cart*`), งานจัดเก็บ/หยิบ/ที่ตั้ง/พนักงาน (`wms_job*`, `wms_location`, `wms_pracel`, `wms_workers`) และเอกสารรับ-จ่าย-ปรับยอด-ย้าย-Serial (`wms_product_*`, `wms_serial_master`) สำหรับระบบ WMS ยุคใหม่ที่เป็น Bin & Fulfillment ของ Backend Go ดู [[tbl-wms-modern]] และสำหรับตารางสินค้า/เอกสารหลัก (`ic_inventory`, `ic_trans`) ดู [[schema-overview]]

> [!NOTE] คอลัมน์มาตรฐานทุกตารางในกลุ่มนี้
> ทุกตารางในสคีมาดั้งเดิมชุดนี้มีคอลัมน์ระบบชุดเดียวกัน ได้แก่ `ignore_sync integer DEFAULT 0`, `is_lock_record integer DEFAULT 0`, `roworder serial NOT NULL`, `create_date_time_now timestamp without time zone NOT NULL DEFAULT now()` (โดย `roworder` ทำหน้าที่เป็นรหัสลำดับเรคคอร์ดหลักของตาราง)

---

## 1. เอกสาร WMS ที่คู่ขนานกับ ic_trans (`ic_wms_trans`, `ic_wms_trans_detail`)

### `ic_wms_trans` (หัวเอกสาร WMS)
เก็บหัวเอกสารคลังสินค้า/ใบเบิก-โอน-ขายที่เชื่อมฝั่ง WMS โครงสร้างคล้าย `ic_trans` แต่แยกตารางคิว/เอกสาร WMS (`scripts/sql/02_data_schema.sql:7371`)

- **กุญแจและดัชนี (`L7486-7488`)**:
  - `roworder` (`serial NOT NULL`)
  - `idx_ic_wms_trans_doc_no_trans_flag` บน `(doc_no, trans_flag)`
  - `idx_ic_wms_trans_doc_date_trans_flag` บน `(doc_date, trans_flag)`
  - `idx_ic_wms_trans_cust_code` บน `(cust_code)`
- **คอลัมน์สำคัญ**:
  - **ระบุเอกสารและประเภท**: `trans_type` (`smallint`), `trans_flag` (`smallint`), `doc_group` (`varchar(25)`), `doc_date` (`date`), `doc_no` (`varchar(25)`), `doc_time` (`varchar(5)`), `doc_ref`, `doc_ref_date`, `doc_ref_trans`, `doc_format_code`, `doc_type`, `doc_no_guid`, `guid_code` (`varchar(35)`)
  - **ภาษีและคู่ค้า**: `tax_doc_no`, `tax_doc_date`, `inquiry_type`, `vat_type`, `vat_rate`, `cust_code`, `contactor`, `member_code`
  - **มิติองค์กร/โลจิสติกส์**: `branch_code`, `project_code`, `side_code`, `department_code`, `sale_area_code`, `sale_code`, `sale_group`, `allocate_code`, `job_code`, `wh_from`, `location_from`, `wh_to`, `location_to`, `transport_code`, `send_type`, `send_day`, `send_date`, `want_day`, `want_date`, `delivery_date`, `expire_date`, `credit_day`, `credit_date`, `due_date`, `deposit_day`, `deposit_date`
  - **มูลค่า (Numeric)**: `transport_value`, `discount_word`, `currency_code`, `exchange_rate`, `total_cost`, `total_value`, `total_discount`, `total_vat_value`, `total_after_vat`, `total_except_vat`, `total_amount`, `balance_amount`, `total_before_vat`, `pay_amount`, `money`, `sum_pay_money_diff`, `currency_money`, `total_debt_amount`, `advance_amount`, `ref_amount`, `ref_new_amount`, `ref_diff`, `sum_point`
  - **POS & ช่องทาง**: `cashier_code`, `is_pos`, `pos_id`, `pos_bill_type`, `pos_bill_change`, `send_mail`, `send_sms`
  - **สถานะและอนุมัติ**: `status` (`smallint`), `last_status` (`smallint` — ปกติกรอง `COALESCE(last_status, 0) = 0`), `used_status`, `used_status_2`, `doc_success`, `total_manual`, `on_hold`, `answer_type`, `adjust_reason`, `approve_code`, `approve_date`, `user_approve`, `not_approve_1`, `approve_status`, `expire_status`, `expire_day`, `user_request`, `recheck_count_day`, `recheck_count`, `auto_create`, `cancel_type` (`integer`), `is_cancel` (`smallint`), `cancel_code` (`varchar(255)`), `cancel_datetime`
  - **หมายเหตุและผู้บันทึก**: `remark`, `remark_2`, `remark_3`, `extra_word` (`varchar(100)`), `creator_code`, `last_editor_code`, `create_datetime`, `lastedit_datetime`

### `ic_wms_trans_detail` (รายการสินค้าในเอกสาร WMS)
เก็บรายละเอียดสินค้าแต่ละบรรทัดของ `ic_wms_trans` (`scripts/sql/02_data_schema.sql:7490`)

- **กุญแจและดัชนี (`L7598-7602`)**:
  - `roworder` (`serial NOT NULL`)
  - `idx_ic_wms_trans_detail_doc_no_trans_flag`
  - `idx_ic_wms_trans_detail_doc_date_trans_flag`
  - `idx_ic_wms_trans_detail_item_code`
  - `idx_ic_wms_trans_detail_barcode`
  - `idx_ic_wms_trans_detail_cust_code`
- **คอลัมน์สำคัญ**:
  - **เชื่อมหัวเอกสาร/อ้างอิง**: `trans_type`, `trans_flag`, `doc_group`, `doc_date`, `doc_no`, `doc_time`, `doc_ref`, `doc_ref_type`, `cust_code`, `inquiry_type`, `line_number` (`smallint`), `ref_doc_no`, `ref_doc_date`, `ref_line_number`, `ref_cust_code`, `ref_row`, `ref_guid` (`varchar(40)`), `set_ref_line` (`varchar(40)`), `set_ref_price`, `set_ref_qty`
  - **สินค้า หน่วย คลัง ล็อต**: `item_code`, `item_name`, `item_code_main`, `item_type` (`integer`), `barcode`, `unit_code`, `qty`, `cancel_qty`, `total_qty`, `stand_value`, `divide_value`, `ratio`, `ic_pattern`, `ic_color`, `ic_size`, `branch_code`, `wh_code`, `shelf_code`, `wh_code_2`, `shelf_code_2`, `department_code`, `is_serial_number`, `lot_number_1`, `mfd_date`, `mfn_name`, `date_expire`, `date_due`
  - **ราคา ต้นทุน ส่วนลด ภาษี**: `price`, `price_base`, `price_default`, `price_exclude_vat`, `price_type`, `price_mode`, `price_changed`, `price_set_ratio`, `price_guid` (`varchar(50)`), `discount`, `discount_number`, `discount_amount`, `discount_changed`, `sum_of_cost`, `average_cost`, `sum_of_cost_1`, `average_cost_1`, `hidden_cost_1`, `hidden_cost_1_exclude_vat`, `hidden_cost_2`, `hidden_cost_2_exclude_vat`, `sum_amount`, `sum_amount_exclude_vat`, `total_vat_value`, `vat_type` (`integer`), `tax_type`, `fee_amount`, `transfer_amount`, `is_permium`, `is_get_price`
  - **สถานะและผู้ทำรายการ**: `status`, `last_status` (`integer`), `calc_flag` (`integer`), `priority_level` (`integer`), `due_date`, `doc_date_calc`, `doc_time_calc`, `user_approve`, `sale_code`, `sale_group`, `sale_shift_id` (`varchar(50)`), `is_pos`, `auto_create`, `chq_number`, `item_code_2`, `bank_name_2`, `bank_branch_2`, `temp_float_1`, `temp_float_2`, `temp_string_1`, `remark`, `creator_code`, `last_editor_code`, `create_datetime`, `lastedit_datetime`

---

## 2. กลุ่มกล่องและประวัติย้ายกล่อง (`wms_boxes*` — 6 ตาราง)

| ตาราง | จุดอ้างอิง | หน้าที่หลัก | คอลัมน์สำคัญ | ดัชนี (`02_data_schema.sql`) |
| :--- | :--- | :--- | :--- | :--- |
| `wms_boxes` | `L9319` | ทะเบียนกล่อง/ภาชนะบรรจุ | `code` (`varchar(50)`), `wide`/`long`/`high` (`numeric`), `image_src` (`text`), `status` (`smallint`), `shelf_code` (`varchar(50)`) | `idx_wms_boxes_code` (`L9332`) |
| `wms_boxes_detail` | `L9334` | สต็อกคงเหลือรายสินค้าในกล่อง | `box_code`, `ref_doc_no`, `is_from_cart` (`smallint`), `item_code`, `qty` (`numeric`), `unit_code`, `status`, `last_update_date_time_now` (`timestamp`) | `idx_wms_boxes_detail_item_code` (`L9348`) |
| `wms_boxes_lot_detail` | `L9350` | สต็อกในกล่องแยกล็อตสินค้า | `box_code`, `ref_doc_no`, `is_from_cart`, `item_code`, `lot_number` (`varchar(255)`), `qty`, `last_update_date_time_now`, `status` | `idx_wms_boxes_lot_detail_item_code` (`L9364`) |
| `wms_boxes_trans` | `L9366` | หัวเอกสารประวัติย้ายกล่อง/ชั้นวาง | `trans_guid`, `from_box_code`, `from_shelf_code`, `to_box_code`, `to_shelf_code`, `created_at` (`timestamp`) | — |
| `wms_boxes_trans_detail` | `L9379` | รายละเอียดสินค้าที่ย้ายระหว่างกล่อง | `trans_guid`, `item_code`, `qty`, `unit_code`, `created_at` | `idx_wms_boxes_trans_detail_item_code` (`L9390`) |
| `wms_boxes_trans_lot` | `L9392` | รายละเอียดล็อตสินค้าที่ย้ายระหว่างกล่อง | `trans_guid`, `ref_doc_no`, `item_code`, `lot_number`, `qty`, `created_at` | `idx_wms_boxes_trans_lot_item_code` (`L9404`) |

---

## 3. กลุ่มรถเข็นจัดเก็บ/หยิบสินค้า (`wms_cart*` — 5 ตาราง)

| ตาราง | จุดอ้างอิง | หน้าที่หลัก | คอลัมน์สำคัญ | ดัชนี (`02_data_schema.sql`) |
| :--- | :--- | :--- | :--- | :--- |
| `wms_cart` | `L9406` | หัวรายการรถเข็นรับ/จัดสินค้า | `cart_guid` (`varchar(50)`), `receive_doc_no`, `ref_doc_no`, `cart_type` (`smallint`), `box_code`, `warehouse_code`, `shelf_code`, `branch_code`, `supplier_code`, `worker_code` (`varchar(100)`), `device_id` (`varchar(150)`), `remark` (`varchar(1000)`), `creator_code`, `create_datetime`, `last_update_datetime`, `last_update_user_code` | — |
| `wms_cart_detail` | `L9429` | สินค้าในรถเข็น | `cart_guid`, `ref_doc_no`, `item_code`, `qty`, `unit_code`, `price`, `sum_amount`, `discount`, `discount_amount`, `last_update_date_time_now` | `idx_wms_cart_detail_item_code` (`L9445`) |
| `wms_cart_lot` | `L9447` | ล็อตสินค้าในรถเข็น | `cart_guid`, `item_code`, `lot_number` (`varchar(50)`), `qty` (`integer`), `last_update_date_time_now` | `idx_wms_cart_lot_item_code` (`L9458`) |
| `wms_cart_ref` | `L9460` | เลขที่เอกสารอ้างอิงที่ผูกรถเข็น | `cart_guid`, `ref_doc_no` (`varchar(25)`), `line_order` (`smallint`) | — |
| `wms_cart_serial` | `L9470` | Serial Number สินค้าในรถเข็น | `cart_guid`, `item_code`, `serial_number` (`varchar(255)`), `last_update_date_time_now` | `idx_wms_cart_serial_item_code` (`L9480`) |

---

## 4. กลุ่มใบสั่งงาน ที่ตั้ง พัสดุ และพนักงานคลัง (`wms_job*`, `wms_location`, `wms_pracel`, `wms_workers` — 6 ตาราง)

| ตาราง | จุดอ้างอิง | หน้าที่หลัก | คอลัมน์สำคัญ | ดัชนี (`02_data_schema.sql`) |
| :--- | :--- | :--- | :--- | :--- |
| `wms_job` | `L9482` | หัวใบสั่งงานจัดเก็บ/หยิบ/ย้าย (`Put-away`/`Pick`) | `job_code`, `job_name`, `job_type` (`varchar(10)`), `job_date` (`date`), `job_time` (`varchar(20)`), `box_code`, `to_box_code`, `box_type` (`varchar(10)`), `from_shelf`, `to_shelf`, `worker_code`, `ref_doc_no`, `status`, `is_readed` (`boolean DEFAULT false`), `is_manual` (`smallint`), `remark`, `last_update_date_time_now` | — |
| `wms_job_detail` | `L9506` | รายการสินค้าในใบงาน | `job_code`, `box_code`, `to_box_code`, `item_code`, `item_name` (`varchar(250)`), `unit_code`, `qty`, `from_shelf`, `to_shelf`, `created_at`, `last_update_date_time_now` | `idx_wms_job_detail_item_code` (`L9523`) |
| `wms_job_lot_detail` | `L9525` | รายการล็อตในใบงาน | `job_code`, `box_code`, `to_box_code`, `item_code`, `lot_number` (`varchar(50)`), `qty`, `from_shelf`, `to_shelf`, `created_at` | `idx_wms_job_lot_detail_item_code` (`L9540`) |
| `wms_location` | `L9542` | ทะเบียนพื้นที่/จุดจัดเก็บคลังดั้งเดิม | `code` (`varchar(50)`), `branch_code`, `warehouse_code`, `status` | `idx_wms_location_code` (`L9552`) |
| `wms_pracel` | `L9554` | ข้อมูลพัสดุ/ปลายทาง *(ชื่อตารางสะกด `pracel` ตามสคีมาจริง)* | `pracel_guid`, `ref_doc_no`, `cust_code`, `address`, `cust_name` *(ทั้ง 5 คอลัมน์เป็น `character(1) DEFAULT ''` ในสคีมาเดิม)* | `idx_wms_pracel_cust_code` (`L9565`) |
| `wms_workers` | `L9862` | ทะเบียนพนักงานคลังสินค้า | `code`, `name_1`, `name_2` (`varchar(200)` จาก `ALTER TABLE L9874`), `description`, `user_code`, `status` (`smallint` จาก `ALTER TABLE L9875`) | `idx_wms_workers_code` (`L9876`) |

---

## 5. เอกสารปรับยอด รับเข้า จ่ายออก โอนย้าย และ Serial (`wms_product_*`, `wms_serial_master` — 16 ตาราง)

### ก. ปรับยอดสต็อก WMS (`wms_product_adj_stock*` — 3 ตาราง)
- **`wms_product_adj_stock` (`L9567`)**: หัวใบปรับยอด `doc_no`, `doc_date` (`date`), `doc_time` (`varchar(20)`), `doc_type` (`varchar(15)`), `remark`, `status`, `create_datetime`, `creator_code`, `last_update_datetime`, `last_update_user_code`
- **`wms_product_adj_stock_detail` (`L9584`)**: `doc_no`, `item_code`, `unit_code`, `box_code`, `shelf_code`, `qty`, `current_qty`, `diff_qty`, `last_update_datetime`, `last_update_date_time_now` | ดัชนี `idx_wms_product_adj_stock_detail_item_code` (`L9600`)
- **`wms_product_adj_stock_lot_detail` (`L9602`)**: `doc_no`, `item_code`, `lot_number` (`varchar(255)`), `box_code`, `shelf_code`, `qty`, `current_qty`, `diff_qty`, `last_update_datetime`, `last_update_date_time_now` | ดัชนี `idx_wms_product_adj_stock_lot_detail_item_code` (`L9618`)

### ข. จ่ายสินค้าออก (`wms_product_out*` — 5 ตาราง)
- **`wms_product_out` (`L9620`)**: หัวใบจ่ายออก `doc_no`, `doc_date`, `doc_time`, `status`, `warehouse_code` (`varchar(32)`), `branch_code` (`varchar(32)`), `customer_code` (`varchar(25)`), `total_amount`, `ref_doc_no`, `doc_type` (`smallint`), `box_code`, `shelf_code`, `remark`, `create_datetime`, `creator_code`, `last_update_datetime`, `last_update_user_code`
- **`wms_product_out_detail` (`L9644`)**: `doc_no` (`varchar(25)`), `doc_date`, `doc_time`, `item_code`, `item_name`, `unit_code`, `qty`, `price`, `discount` (`varchar(100)`), `discount_amount`, `sum_amount`, `box_code`, `shelf_code`, `last_update_date_time_now`, `last_update_datetime` | ดัชนี `idx_wms_product_out_detail_item_code` (`L9665`)
- **`wms_product_out_lot_detail` (`L9667`)**: `ref_out_doc` (`text`), `ref_out_date` (`date`), `item_code` (`text`), `lot_number` (`text`), `product_week` (`smallint`), `product_year` (`smallint`), `mfd_date`, `mfd_name`, `expire_date`, `qty` (`smallint`), `box_code`, `shelf_code`, `last_update_date_time_now` | ดัชนี `idx_wms_product_out_lot_detail_item_code` (`L9686`)
- **`wms_product_out_ref` (`L9688`)**: เอกสารอ้างอิง `doc_no`, `ref_doc_no`, `line_order`
- **`wms_product_out_serial_detail` (`L9698`)**: `ref_out_doc`, `ref_out_date`, `item_code`, `serial_number` (`varchar(255)`), `last_update_date_time_now` | ดัชนี `idx_wms_product_out_serial_detail_item_code` (`L9709`)

### ค. รับสินค้าเข้า (`wms_product_receive*` — 5 ตาราง)
- **`wms_product_receive` (`L9711`)**: หัวใบรับเข้า `doc_no`, `doc_date`, `doc_time`, `status`, `warehouse_code`, `branch_code`, `supplier_code` (`varchar(25)`), `total_amount`, `ref_doc_no`, `doc_type` (`smallint`), `box_code`, `shelf_code`, `remark`, `create_datetime`, `creator_code`, `last_update_datetime`, `last_update_user_code`
- **`wms_product_receive_detail` (`L9735`)**: คอลัมน์ชุดเดียวกับ `wms_product_out_detail` (ไม่มีคอลัมน์ `last_update_datetime`) | ดัชนี `idx_wms_product_receive_detail_item_code` (`L9755`)
- **`wms_product_receive_lot_detail` (`L9757`)**: `ref_rec_doc`, `ref_rec_date`, `item_code`, `lot_number`, `product_week`, `product_year`, `mfd_date`, `mfd_name`, `expire_date`, `qty` (`smallint`), `box_code`, `shelf_code`, `last_update_date_time_now` | ดัชนี `idx_wms_product_receive_lot_detail_item_code` (`L9776`)
- **`wms_product_receive_ref` (`L9778`)**: `doc_no`, `ref_doc_no`, `line_order`
- **`wms_product_receive_serial_detail` (`L9788`)**: `ref_rec_doc`, `ref_rec_date`, `item_code`, `serial_number`, `product_week`, `product_year`, `mfd_date`, `mfd_name`, `expire_date`, `last_update_date_time_now` | ดัชนี `idx_wms_product_receive_serial_detail_item_code` (`L9804`)

### ง. โอนย้ายสินค้าและทะเบียน Serial (`wms_product_trans*`, `wms_serial_master` — 3 ตาราง)
- **`wms_product_trans` (`L9806`)**: `ref_doc_no`, `ref_doc_type`, `trans_guid`, `from_box_code`, `to_box_code`, `from_shelf_code`, `to_shelf_code`, `item_code`, `unit_code`, `qty`, `created_at` | ดัชนี `idx_wms_product_trans_item_code` (`L9823`)
- **`wms_product_trans_lot` (`L9825`)**: `ref_doc_no`, `trans_guid`, `item_code`, `unit_code`, `lot_number`, `qty`, `from_box_code`, `to_box_code`, `from_shelf_code`, `to_shelf_code`, `created_at` | ดัชนี `idx_wms_product_trans_lot_item_code` (`L9842`)
- **`wms_serial_master` (`L9844`)**: ทะเบียน Serial Number คลังสินค้า `ref_rec_doc`, `ref_rec_date`, `item_code`, `serial_number`, `product_week`, `product_year`, `mfd_date`, `mfd_name`, `expire_date`, `last_update_date_time_now` | ดัชนี `idx_wms_serial_master_item_code` (`L9860`)

---

## รูปแบบการ JOIN และตัวอย่าง SQL

1. **ค้นหาใบงาน `wms_job` พร้อมชื่อพนักงานคลังและรายการสินค้าในกล่อง**
```sql
SELECT
  j.job_code,
  j.job_date,
  j.job_type,
  j.from_shelf,
  j.to_shelf,
  j.worker_code,
  COALESCE(w.name_1, '') AS worker_name,
  d.item_code,
  d.item_name,
  d.unit_code,
  d.qty::numeric AS qty
FROM wms_job j
JOIN wms_job_detail d
  ON d.job_code = j.job_code
LEFT JOIN wms_workers w
  ON w.code = j.worker_code
WHERE COALESCE(j.status, 0) = 0
ORDER BY j.job_date DESC, j.roworder DESC
LIMIT 100;
```

2. **ตรวจสอบสต็อกในกล่องแยกตามล็อตเทียบหัวเอกสารรับเข้า**
```sql
SELECT
  r.doc_no,
  r.doc_date,
  r.warehouse_code,
  r.supplier_code,
  l.item_code,
  l.lot_number,
  l.box_code,
  l.shelf_code,
  l.qty::numeric AS lot_qty,
  l.expire_date
FROM wms_product_receive r
JOIN wms_product_receive_lot_detail l
  ON l.ref_rec_doc = r.doc_no
WHERE r.doc_date >= DATE '2026-01-01'
ORDER BY r.doc_date DESC, l.item_code;
```
