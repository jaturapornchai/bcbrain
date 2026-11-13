---
title: ตาราง Log ระบบ, Sync สาขา, แบบฟอร์ม และรูปภาพ (Logs, Sync, FormDesign & Media)
tags: [schema, sync, logs, media, formdesign, legacy]
aliases: [cloud_config, device_uuid, docflowthread, formdesign, images, images_erp_user, bc_doc_images, bc_image_document, bc_barcode_print_format, bc_fastreport, bc_tooltip, internet_center_sync, logs, master_logs, process, sync_access_log, sync_branch_list, sync_branch_list_server, sync_change_code, sync_field_list, sync_log, sync_receive_data, sync_table_list]
sources:
  - scripts/sql/02_data_schema.sql:2295-2355
  - scripts/sql/02_data_schema.sql:4043-4058
  - scripts/sql/02_data_schema.sql:7604-7639
  - scripts/sql/02_data_schema.sql:7758-7783
  - scripts/sql/02_data_schema.sql:8130-8152
  - scripts/sql/02_data_schema.sql:8643-8654
  - scripts/sql/02_data_schema.sql:8811-8873
  - scripts/sql/02_data_schema.sql:8900-8917
  - scripts/sql/02_data_schema.sql:8982-9068
  - scripts/sql/03_audit_r1_migrations.sql:45
  - backend/internal/application/process/report_template.go:219-232
  - backend/internal/application/process/pos_config.go:273-286
  - backend/internal/application/process/pos_sync.go:97-109
  - backend/internal/application/process/pos_sync.go:174
  - backend/internal/adapter/inbound/http/admin/menu_permissions.go:57-58
---

ชุดตารางบันทึกประวัติการใช้งาน (`logs`, `master_logs`), แบบฟอร์มพิมพ์และรายงาน (`formdesign`, `bc_fastreport`, `bc_barcode_print_format`), สื่อรูปภาพ (`images`, `images_erp_user`, `bc_doc_images`, `bc_image_document`), ข้อความคำอธิบายเมนู (`bc_tooltip`), การติดตามสายเอกสาร/คิวงาน (`docflowthread`, `process`) และโครงสร้างซิงก์ข้อมูลระหว่างสาขา/ส่วนกลาง (`sync_*`, `internet_center_sync`, `cloud_config`, `device_uuid`) รวม 23 ตาราง สำหรับตารางจัดการ View/เทมเพลตรายงาน (`erp_report_template`) และ Log การยกเลิก/พิมพ์ของ ERP ดู [[schema-overview]] ส่วนคิวซิงก์ POS ดู [[tbl-pos-sync-restaurant]]

> [!NOTE] คอลัมน์ระบบประจำตาราง
> ตารางใน `scripts/sql/02_data_schema.sql` ชุดนี้มีคอลัมน์มาตรฐานชุดเดียวกันทุกตาราง ได้แก่ `ignore_sync integer DEFAULT 0`, `is_lock_record integer DEFAULT 0`, `roworder serial NOT NULL`, `create_date_time_now timestamp without time zone NOT NULL DEFAULT now()`

---

## 1. แบบฟอร์มพิมพ์และไฟล์รูปภาพ (`formdesign`, `images`, `images_erp_user`)

### `formdesign` (แบบฟอร์มเอกสารดั้งเดิม)
ใช้เก็บเทมเพลตแบบฟอร์มพิมพ์เอกสาร (เช่น ใบกำกับภาษี ใบเสร็จ ใบสั่งซื้อ) ทั้งฝั่งเดสก์ท็อปเดิมและ Backend Go ในโมดูลรายงาน (`scripts/sql/02_data_schema.sql:4043`, `report_template.go:219-232`)

- **กุญแจหลัก**: `roworder` (`serial NOT NULL`); แยกแบบฟอร์มด้วยรหัส `formcode` และ `guid_code`
- **คอลัมน์สำคัญ**:
  - `formcode` (`varchar(25)`): รหัสแบบฟอร์มเอกสาร
  - `formguid_code` (`varchar(40)`), `guid_code` (`varchar(40)`): GUID ระบุเรคคอร์ดและเวอร์ชันแบบฟอร์ม
  - `formname` (`varchar(255)`): ชื่อแบบฟอร์มที่แสดงให้ผู้ใช้เลือก
  - `timeupdate` (`varchar(50)`): เวลาอัปเดตล่าสุดฝั่งแบบฟอร์ม
  - `formdesigntext` (`bytea`): เนื้อหา XML/โครงสร้างการจัดวางฟิลด์ในแบบฟอร์ม
  - `formbackground` (`bytea`): ภาพพื้นหลังแบบฟอร์ม (ไบนารี)
  - `form_type` (`smallint DEFAULT 0`): ประเภทแบบฟอร์ม (`0` = ฟอร์มมาตรฐานดั้งเดิม)

### `images` (คลังรูปภาพสินค้า ลูกค้า และ POS)
เก็บไฟล์รูปภาพไบนารีหรือ URL อ้างอิง ใช้ร่วมกันทั้งระบบ ERP เดิมและ POS/Member (`02_data_schema.sql:7604`, `03_audit_r1_migrations.sql:45`, `pos_config.go:273-279`, `pos_sync.go:174`)

- **กุญแจและดัชนี**:
  - `roworder` (`serial NOT NULL`)
  - `idx_pos_images_id` บน `(image_id, image_order)` (`pos_sync.go:174`)
- **คอลัมน์สำคัญ**:
  - `image_id` (`varchar`): คีย์อ้างอิงภาพ — ใน `pos_sync.go:97-109` หากขึ้นต้นด้วย `'CONTRACT' || cust_code` คือรูปประจำตัวลูกค้า/สมาชิก ส่วนรหัสทั่วไปคือรหัสสินค้า (`item_code`)
  - `image_file` (`text` ในสคีมาเดิม / `BYTEA` ใน `pos_config.go:279`): ข้อมูลภาพสำหรับแสดงผล
  - `image_url` (`text`): ลิงก์ URL ภายนอกของรูปภาพ (เพิ่มใน migration/POS media)
  - `system_id` (`varchar(10)`): รหัสระบบต้นทาง
  - `guid_code`: GUID อ้างอิงเรคคอร์ดภาพ
  - `image_order` (`smallint`): ลำดับภาพกรณี 1 สินค้ามีหลายรูป
- **ตารางรูปภาพ แบบฟอร์ม และคำอธิบายเพิ่มเติม**:
  - `images_erp_user` (`02_data_schema.sql:7617`): รูปภาพฝั่งผู้ใช้ ERP (`image_id`, `image_file text`, `system_id`, `guid_code`, `image_order`)
  - `bc_doc_images` (`02_data_schema.sql:8823`, `pos_config.go:285`): รูปภาพแนบเอกสาร (`image_id varchar(50)`, `image_file text`, `system_id varchar(10)`, `guid_code varchar(100)`, `image_order smallint`)
  - `bc_image_document` (`02_data_schema.sql:8858`): รูปภาพแนบเอกสารพร้อมพิกัดและอุปกรณ์ (`image_id`, `image_file text`, `system_id`, `guid`, `latitude numeric`, `longitude numeric`, `mac_address`, `user_code`, `refer_doc_no`, `refer_trans_flag smallint`)
  - `bc_barcode_print_format` (`02_data_schema.sql:8811`, ดัชนี `idx_bc_barcode_print_format_code` `L8821`): รูปแบบสติกเกอร์บาร์โค้ด (`code varchar(100)`, `name varchar(100)`, `formatdata bytea`, `guid_code varchar(10)`)
  - `bc_fastreport` (`02_data_schema.sql:8835`): เทมเพลตรายงาน FastReport (`menuid`, `menuname`, `reportdata bytea`, `guid_code`, `timeupdate`, `report_type smallint`, `is_system_report smallint`, `owner_code`, `ref_no`)
  - `bc_tooltip` (`02_data_schema.sql:8900`, ดัชนี `idx_bc_tooltip_code` `L8917`, และ `http/admin/menu_permissions.go:57` ที่กำหนด `code VARCHAR(100) PRIMARY KEY`): ข้อความคำอธิบาย/Tooltip ของเมนู (`code`, `name_1`–`name_6`, `status smallint`, `data_group`)

---

## 2. Audit Log & การประมวลผลระบบ (`logs`, `master_logs`, `docflowthread`, `process`)

| ตาราง | จุดอ้างอิง | หน้าที่หลัก | คอลัมน์สำคัญและดัชนี |
| :--- | :--- | :--- | :--- |
| `logs` | `L7758` | บันทึกประวัติการเข้า-ออก/แก้ไขเอกสารและกิจกรรมผู้ใช้ | `function_code` (`smallint`), `function_type`, `screen_code` (`smallint`), `menu_name`, `user_code`, `computer_name`, `date_time`, `date_time_out`, `guid`, `doc_no`, `doc_no_old`, `doc_date`, `doc_date_old`, `doc_amount`, `doc_amount_old`, `doc_qty`, `doc_qty_old`, `data1`, `data2` (`varchar(5000)`) |
| `master_logs` | `L8130` | บันทึกประวัติเปลี่ยนแปลงข้อมูลหลัก (Master Data) เก็บสแนปช็อตก่อน/หลังเป็นไบนารี | `function_code`, `function_type`, `screen_code` (`varchar(50)`), `menu_name`, `user_code`, `computer_name`, `date_time`, `guid`, `data1` (`bytea`), `data2` (`bytea`), `code`, `name_1`, `name_2` (`L8150`), `status` (`L8151`) \| ดัชนี `idx_master_logs_code` (`L8152`) |
| `docflowthread` | `L2347` | เก็บเส้นทางความเชื่อมโยงเอกสาร/สินค้าแบบรายการคั่น (`item_list` / `doc_no_list`) | `trans_flag` (`smallint`), `item_list` (`varchar(5000)`), `doc_no_list` (`varchar(5000)`) |
| `process` | `L8643` | บันทึกจุด Checkpoint ของ Background Process / Batch | `process_name`, `last_guid`, `last_time` (`date`), `wherein` (`varchar(500)`), `last_process_time` |

---

## 3. โครงสร้างซิงก์ข้อมูลระหว่างสาขาและอุปกรณ์ (`sync_*`, `internet_center_sync`, `cloud_config`, `device_uuid`)

| ตาราง | จุดอ้างอิง | หน้าที่หลัก | คอลัมน์สำคัญ (ตัดคอลัมน์เชื่อมต่อที่ละเอียดอ่อนออก) |
| :--- | :--- | :--- | :--- |
| `sync_branch_list` | `L8991` | ทะเบียนสาขาที่เปิดซิงก์ข้อมูลและตารางเวลาซิงก์ | `branch_code`, `branch_name`, `access_code`, `branch_computer_name`, `active` (`smallint`), `wait_time` (`smallint`), `sync_time_active` (`smallint`), `start_sync_time`, `end_sync_time` |
| `sync_branch_list_server` | `L9007` | กำหนดปลายทางเซิร์ฟเวอร์และฐานข้อมูลรายสาขา | `branch_code`, `server_url`, `provider_code`, `db_name` |
| `sync_table_list` | `L9059` | รายชื่อตารางและคำสั่ง/เงื่อนไขสำหรับงานซิงก์ | `table_name`, `trans_type` (`smallint`), `trans_command` (`varchar(255)`), `always_sync` (`smallint`) |
| `sync_field_list` | `L9029` | กำหนดฟิลด์และค่าเริ่มต้น (`default_value`) ระหว่างซิงก์ | `table_name`, `field_name`, `default_value` |
| `sync_change_code` | `L9018` | บันทึกการเปลี่ยนรหัสข้อมูลที่ต้องกระจายข้ามสาขา | `change_mode`, `old_code`, `new_code`, `branch_code` |
| `sync_receive_data` | `L9049` | สรุปจำนวนเรคคอร์ดที่รับซิงก์แล้วรายสาขา/ตาราง | `branch_code`, `table_name`, `sync_count` (`smallint`) |
| `sync_access_log` | `L8982` | ประวัติเวลาที่สาขาติดต่อเข้ามาซิงก์ | `branch_code`, `date_time` |
| `sync_log` | `L9039` | บันทึกข้อความและข้อผิดพลาดของกระบวนการซิงก์ | `date_time`, `message` (`text`), `branch_code` |
| `internet_center_sync` | `L7629` | คิวคำสั่งซิงก์ผ่านศูนย์กลาง (`table_number`, `command_code`) | `table_number` (`smallint`), `command_code` (`smallint`), `code` (`varchar(50)`) \| ดัชนี `idx_internet_center_sync_code` (`L7638`) |
| `cloud_config` | `L2295` | ค่าคอนฟิกเชื่อมต่อ Cloud Sync และเวลาอัปเดตสคีมา | `schema_update` (`timestamp`) *(คอลัมน์รับรองการเชื่อมต่อสงวนไม่แสดง)* |
| `device_uuid` | `L2338` | ทะเบียนรหัส UUID อุปกรณ์ที่เชื่อมต่อระบบ | `uuid` (`varchar(255)`), `gen_code_1` (`varchar(255)`) |

---

## รูปแบบการ JOIN และตัวอย่าง SQL

1. **ดึงรูปภาพหลักของสินค้าและรูปภาพลูกค้า/สมาชิกจาก `images`**
```sql
SELECT
  image_id,
  image_order,
  image_url,
  system_id,
  CASE
    WHEN image_id LIKE 'CONTRACT%' THEN 'CUSTOMER_OR_CONTRACT'
    ELSE 'ITEM'
  END AS target_kind
FROM images
WHERE image_id = $1
ORDER BY COALESCE(image_order, 0) ASC, roworder ASC;
```

2. **ตรวจสอบ Log การแก้ไข/เปลี่ยนแปลงยอดเอกสารใน `logs` และประวัติซิงก์สาขา**
```sql
SELECT
  l.date_time,
  l.user_code,
  l.menu_name,
  l.function_code,
  l.doc_no,
  l.doc_amount::numeric AS doc_amount,
  l.doc_amount_old::numeric AS doc_amount_old,
  l.computer_name
FROM logs l
WHERE l.doc_no IS NOT NULL
ORDER BY l.date_time DESC
LIMIT 100;
```
