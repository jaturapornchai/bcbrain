---
title: ตารางระบบซิงค์ POS และร้านอาหาร/ห้องครัว (pos_sync_change, pos_bill_inbox, table_*, kitchen_*, order_*)
tags:
  - schema
  - pos
  - pos-sync
  - restaurant
  - kitchen
aliases:
  - pos_sync_change
  - pos_sync_machine
  - pos_bill_inbox
  - pos_stock_queue
  - pos_sync_device
  - table_master
  - table_trans
  - table_order
  - table_order_doc
  - table_order_cancel
  - table_order_log
  - take_order_temp
  - kitchen_master
  - kitchen_master_item
  - kitchen_master_order_id
  - kitchen_master_pos_id
  - kitchen_command
  - kitchen_print_copy
  - kitchen_print_cancel_copy
  - kitchen_print_count
  - chef_master
  - chef_master_item
  - order_cart
  - order_item
  - order_checker
  - order_device_id
  - order_message
  - printer_order_check
  - printer_order_check_table
sources:
  - backend/internal/application/process/pos_sync.go:31
  - backend/internal/application/process/pos_sync.go:40
  - backend/internal/application/process/pos_sync.go:54
  - backend/internal/application/process/pos_sync.go:72
  - backend/internal/application/process/pos_sync.go:118
  - scripts/sql/02_data_schema.sql:2274
  - scripts/sql/02_data_schema.sql:2285
  - scripts/sql/02_data_schema.sql:7640
  - scripts/sql/02_data_schema.sql:7652
  - scripts/sql/02_data_schema.sql:8189
  - scripts/sql/02_data_schema.sql:8207
  - scripts/sql/02_data_schema.sql:8222
  - scripts/sql/02_data_schema.sql:8242
  - scripts/sql/02_data_schema.sql:8267
  - scripts/sql/02_data_schema.sql:8430
  - scripts/sql/02_data_schema.sql:8616
  - scripts/sql/02_data_schema.sql:9070
  - scripts/sql/02_data_schema.sql:9097
  - scripts/sql/02_data_schema.sql:9135
  - scripts/sql/02_data_schema.sql:9158
  - scripts/sql/02_data_schema.sql:9181
  - scripts/sql/02_data_schema.sql:9193
  - scripts/sql/02_data_schema.sql:9222
---

# ตารางระบบซิงค์ POS และร้านอาหาร/ห้องครัว (`pos_sync_*`, `pos_bill_inbox`, `table_*`, `kitchen_*`, `order_*`)

ครอบคลุมสองส่วนสำคัญที่ต่อยอดจากระบบ [[tbl-pos-config]]:
1. **กลไก POS Delta Sync & Bill Inbox (`pos_sync_*`, `pos_bill_inbox`, `pos_stock_queue`)** ใน `pos_sync.go` สำหรับให้เครื่องลูก Flutter POS ทำงานแบบ Offline-first ซิงค์ข้อมูลสินค้า สมาชิก โปรโมชั่น และส่งบิลขายดิบกลับมาบันทึกเข้า `ic_trans` / ตัดสต็อกแบบ Batch
2. **กลุ่มตารางร้านอาหาร โต๊ะอาหาร ห้องครัว และอุปกรณ์สั่งอาหาร (`table_*`, `kitchen_*`, `chef_*`, `order_*`, `printer_order_check*`)** ใน `02_data_schema.sql`

---

## 1. ตารางระบบซิงค์เครื่อง POS (`pos_sync.go:31-75`)

| ตาราง | Primary Key | Indexes / Triggers | วัตถุประสงค์หลัก |
| :--- | :--- | :--- | :--- |
| `pos_sync_change` | `(entity, entity_key)` | `idx_pos_sync_change_cursor` บน `(xid, entity, entity_key)` | บันทึกคีย์ที่มีการเปลี่ยนแปลงพร้อม transaction id (`xid8`) จาก Trigger `pos_sync_log()` / `pos_sync_log_image()` บนตาราง `ic_inventory`, `ic_inventory_barcode`, `ic_unit_use`, `ar_customer`, `pos_promotions`, `coupon_list`, `posconfig`, `pos_id`, `erp_thai_qr_config`, `pos_point_condition`, `images` |
| `pos_sync_machine` | `machine_code VARCHAR(50)` | - | สถานะเครื่อง POS ที่จับคู่แล้ว: `paired_at`, `paired_by`, `last_seen_at`, `last_sync_at`, `last_cursor`, `pending_bills`, `last_bill_at`, `app_version` *(ค่า credential สำหรับยืนยันตัวตนเครื่องถูกเก็บภายในและไม่เปิดเผยในเอกสารสคีมา)* |
| `pos_bill_inbox` | `bill_guid UUID` | `idx_pos_bill_inbox_doc_no` (`UNIQUE` บน `doc_no`), `idx_pos_bill_inbox_status` (`WHERE status <> 1`) | เก็บ Payload JSON ดิบของบิลจากเครื่อง POS (`machine_code`, `doc_no`, `payload JSONB`, `received_at`, `status`, `error`, `processed_at`, `earned_points`, `cancelled_at`, `cancel_reason`, `cancelled_by`) โดย **`status`: `0` = รอประมวลผล, `1` = สำเร็จ, `2` = ผิดพลาด** |
| `pos_stock_queue` | `item_code VARCHAR(50)` | - | คิวสินค้า (`queued_at TIMESTAMPTZ`) ที่รอคำนวณยอด/ต้นทุนสต็อกแบบ Batch (`drainPosStock`) หลังรับบิล POS |
| `pos_sync_device` | `roworder` (`SERIAL NOT NULL`) | `idx_pos_sync_device_cust_code` (`cust_code`) | ตารางคำสั่งซิงค์อุปกรณ์แบบ Legacy (`02_data_schema.sql:8430`): `command`, `command_guid`, `last_status`, `cust_code`, `food_discount`, `is_promotion`, `total_discount`, `sale_code`, `table_number`, `result1`, `result2`, `service_charge` |

---

## 2. ตารางระบบร้านอาหาร โต๊ะ และใบสั่งอาหาร (`table_*`, `order_*`, `kitchen_*`, `chef_*`)

### 2.1 โต๊ะอาหารและประวัติเปิด-ปิดโต๊ะ
* **`table_master`** (`02_data_schema.sql:9070`, `ALTER TABLE` เพิ่ม `name_2`, `status` L9094-9095):
  * `roworder`, `number` (`VARCHAR(25)`), `name_1`, `name_2`, `status` (`smallint`), `guid_code`, `level_1`..`level_4`, `open_date`, `open_time`, `trans_guid`, `priority`, `last_member_code`, `last_discount`, `last_service_charge`, `table_qrcode`, `table_barcode`
* **`table_trans`** (`02_data_schema.sql:9193`, Index `idx_table_trans_cust_code` L9220):
  * `trans_guid`, `open_doc_date`/`time`/`sale_code`, `close_doc_date`/`time`/`sale_code`, `cashier_doc_date`/`time`/`sale_code`/`doc_no`, `table_number`, `table_number_2`, `cust_code`, `food_discount`, `total_discount`, `print_count`, `ispromotion_process`, `service_charge`, `customer_count`, `discount_group`
* **`table_order_doc`** (`02_data_schema.sql:9158`, Index `idx_table_order_doc_cust_code` L9179):
  * หัวเอกสารสั่งอาหาร: `doc_no`, `doc_date`, `doc_time`, `table_number`, `sale_code`, `order_status`, `cust_code`, `sum_amount` (`numeric`), `qty` (`numeric`), `trans_guid`, `last_status`, `device_type`, `order_number_barcode`, `cashier_doc_no`, `cashier_doc_date`
* **`table_order`** (`02_data_schema.sql:9097`, Indexes `idx_table_order_item_code`, `idx_table_order_barcode` L9132-9133):
  * รายการอาหารต่อโต๊ะ: `table_number`, `item_code`, `unit_code`, `barcode`, `doc_no`, `price`, `qty`, `discount_word`, `discount_amount`, `sum_amount`, `guid_line`, `last_status`, `qty_send`, `order_type`, `remark`, `doc_date`, `doc_time`, `line_number`, `trans_guid`, `kitchen_code`, `qty_cancel`, `qty_balance`, `as_item_name`, `confirm_guid`, `confirm_status`, `isspeech`, `order_number_barcode`, `old_doc_no`, `topping_list`
* **`table_order_cancel`** (`02_data_schema.sql:9135`, Index `idx_table_order_cancel_item_code` L9156):
  * ประวัติยกเลิกรายการอาหาร: `table_number`, `guid_line`, `qty`, `remark`, `item_code`, `unit_code`, `line_number`, `price`, `sum_amount`, `cancel_guid`, `doc_date`, `doc_time`, `sale_code`, `cancel_flag`, `table_number_2`
* **`table_order_log`** (`02_data_schema.sql:9181`) & **`take_order_temp`** (`02_data_schema.sql:9222`, Index `idx_take_order_temp_barcode` L9236): Log คำสั่งโต๊ะและตะกร้าสั่งอาหารชั่วคราว

### 2.2 ห้องครัว พ่อครัว และเครื่องพิมพ์เช็คบิล
* **`kitchen_master`** (`02_data_schema.sql:7652`, `ALTER TABLE` เพิ่ม `name_2`, `status` L7691-7692, Index `idx_kitchen_master_code` L7693):
  * `code`, `name_1`, `name_2`, `status`, `guid_code`, `printer_name`, `printer_mode`, `print_to_kitchen`, `print_summery`, `served_control`, `slip_header_font`, `slip_sub_header_font`, `slip_detail_font`, `last_member_code`, `printer_manual_feed`, `printer_slip_width`, `barcode_print`, `print_order_for_check`, `print_order_per_unit`, `kitchen_ready`, `print_tableopen`, `print_order_number_barcode`, `print_barcode`, `print_copy`, `print_copy_mode`, `print_copy_name`, `print_number_order_check`, `print_language_index`, `no_price_print`, `speech_serial`, `no_number_order_for_check`, `hide_table_footer_bill`, `hide_repeat_order_bill`
* **ตารางผูกครัวและคิวพิมพ์ครัว** (`02_data_schema.sql`):
  * `kitchen_master_item` (`L7695`: `kitchen_code`, `food_code`)
  * `kitchen_master_order_id` (`L7704`: `kitchen_code`, `order_device`)
  * `kitchen_master_pos_id` (`L7713`: `kitchen_code`, `pos_id`, `selected`)
  * `kitchen_command` (`L7640`: `doc_no`, `doc_date`, `doc_time`, `doc_type`, `kitchen_data TEXT`)
  * `kitchen_print_copy` (`L7735`), `kitchen_print_cancel_copy` (`L7723`), `kitchen_print_count` (`L7747`)
* **`chef_master`** (`L2274`: `chef_code`, `chef_name`, `status`) และ **`chef_master_item`** (`L2285`, Index `idx_chef_master_item_item_code` L2293: `chef_code`, `item_code`)
* **จุดสั่งอาหารและเครื่องพิมพ์ตรวจรายการ (`order_*`, `printer_order_check*`)**:
  * `order_cart` (`L8189`, Index `idx_order_cart_cust_code` L8205), `order_item` (`L8242`, Indexes `idx_order_item_item_code`, `idx_order_item_barcode` L8264-8265), `order_message` (`L8267`, Index `idx_order_message_cust_code` L8280)
  * `order_checker` (`L8207`: `doc_no`, `doc_date`, `guid_line`, `guid_confirm`, `cofirm_date` *(สะกด `cofirm_date` ตามจริง)*, `confirm_time`, `confirm_status`, `order_qty`)
  * `order_device_id` (`L8222`: `device_id`, `device_name`, `doc_format_order`, `device_status`, `guid_code`, `price_number`, `close_form_number`, `pos_config_number`, `device_android`, `print_from_center`, `device_html`, `user_access`)
  * `printer_order_check` (`L8616`, Index `idx_printer_order_check_code` L8631) และ `printer_order_check_table` (`L8633`: `zone_code`, `table_number`, `line_number`)

---

## 3. คำสั่ง SELECT พร้อมใช้งาน

```sql
-- ตรวจสอบบิล POS ใน pos_bill_inbox ที่ยังรอประมวลผล (status = 0) หรือมี error (status = 2)
SELECT
    b.bill_guid,
    b.machine_code,
    b.doc_no,
    b.status,
    CASE b.status
        WHEN 0 THEN 'PENDING'
        WHEN 1 THEN 'DONE'
        WHEN 2 THEN 'ERROR'
        ELSE 'UNKNOWN'
    END AS status_label,
    b.received_at,
    b.processed_at,
    b.earned_points::NUMERIC(18,2) AS earned_points,
    b.cancelled_at,
    b.error
FROM pos_bill_inbox b
WHERE b.status <> 1
ORDER BY b.received_at DESC;
```

```sql
-- ตรวจสอบโต๊ะที่กำลังเปิดใช้งานและยอดรายการสั่งอาหารที่ยังไม่ถูกยกเลิก (last_status = 0)
SELECT
    t.number AS table_number,
    t.name_1 AS table_name,
    tt.open_doc_date,
    tt.open_doc_time,
    tt.customer_count,
    COUNT(o.roworder) AS item_lines,
    COALESCE(SUM(o.qty - COALESCE(o.qty_cancel, 0)), 0)::NUMERIC(18,4) AS net_qty,
    COALESCE(SUM(o.sum_amount), 0)::NUMERIC(18,2) AS order_total_amount
FROM table_master t
LEFT JOIN table_trans tt
    ON tt.trans_guid = t.trans_guid
LEFT JOIN table_order o
    ON o.trans_guid = t.trans_guid
   AND COALESCE(o.last_status, 0) = 0
WHERE t.status = 1
GROUP BY t.number, t.name_1, tt.open_doc_date, tt.open_doc_time, tt.customer_count
ORDER BY t.number ASC;
```
