---
title: กลุ่มสิทธิ์ View รายงาน Record Lock และ Log เอกสาร — erp_user_group* / erp_record_lock / erp_view_* / erp_cancel_logs
tags: [dev, schema, erp, permissions, lock, view, log]
aliases: [erp_user_group, erp_user_group_detail, erp_user_group_approve, erp_user_group_wh_shelf, erp_user_datalist_config, erp_record_lock, erp_view_document, erp_view_table, erp_view_table_custom, erp_view_column, erp_view_column_custom, erp_report_template, erp_cancel_logs, erp_print_logs, erp_print_station, erp_send_message, erp_images]
sources:
  - scripts/sql/02_data_schema.sql:2597-2610
  - scripts/sql/02_data_schema.sql:2921-2931
  - scripts/sql/02_data_schema.sql:3580-3599
  - scripts/sql/02_data_schema.sql:3695-3711
  - scripts/sql/02_data_schema.sql:3842-3990
  - scripts/sql/23_user_datalist_config.sql:1-18
  - backend/internal/application/process/master_record_lock.go:21-51
  - backend/internal/application/process/master_datalist.go:50-56
  - backend/internal/application/process/report_template.go:201-218
---

# กลุ่มสิทธิ์ View รายงาน Record Lock และ Log เอกสาร (`erp_user_group*`, `erp_record_lock`, `erp_view_*`)

กลุ่มตารางจัดการสิทธิ์กลุ่มงาน/คลัง-ที่เก็บ การล็อกระเบียนระหว่างแก้ไข (Record Lock) การปรับแต่งตารางแสดงผลและเทมเพลตรายงาน รวมถึง Log การยกเลิกและการพิมพ์เอกสาร *(ยกเว้นตารางบัญชีผู้ใช้และข้อมูลรับรองเพื่อความปลอดภัย)* ดูภาพรวมโครงสร้างทั้งหมดได้ที่ [[schema-overview]]

---

## 1. กลุ่มสิทธิ์ระดับโครงสร้างงานและคลัง (`erp_user_group*`)

| ตาราง | Index | คอลัมน์สำคัญและบทบาท |
|---|---|---|
| `erp_user_group` | `idx_erp_user_group_code` | `code`, `name_1`, `name_2`, สิทธิ์บทบาท (`is_po`, `is_so`, `is_wh`, `is_sale_group`, `is_pr_approve`, `is_po_approve`, `is_price_list_approve`, `is_so_approve`, `is_change_masterdata`), `status` |
| `erp_user_group_detail` | ไม่มี SQL PK (`roworder serial`) | `group_code` (เชื่อม `erp_user_group.code`), `user_code` — จับคู่รหัสผู้ปฏิบัติงานเข้ากลุ่มงาน |
| `erp_user_group_approve` | ไม่มี SQL PK (`roworder serial`) | `group_code`, `user_code`, `approve_flag` (`smallint`) — สิทธิ์อนุมัติประจำกลุ่ม |
| `erp_user_group_wh_shelf` | ไม่มี SQL PK (`roworder serial`) | `group_code`, `wh_code`, `shelf_code`, `screen_code` — จำกัดสิทธิ์คลังและที่เก็บตามหน้าจอ (ใช้เมื่อ `erp_option.perm_wh_shelf = 1`) |

---

## 2. การล็อกเรคคอร์ดระหว่างแก้ไขและตั้งค่า Datalist (`erp_record_lock`, `erp_user_datalist_config`)

### `erp_record_lock` — ล็อกเอกสาร/มาสเตอร์แบบมี TTL
- **Primary Key**: `PRIMARY KEY (table_name, record_key)`
- **กลไก (`master_record_lock.go:17-51`)**: ป้องกัน 2 แท็บ/ผู้ใช้แก้เอกสารเดียวกันพร้อมกัน โดยมี Heartbeat และหมดอายุอัตโนมัติ (Default TTL `120` วินาที, สูงสุด `300` วินาที)

| คอลัมน์สำคัญ | ชนิดข้อมูล | ความหมาย |
|---|---|---|
| `table_name`, `record_key` | `varchar(100)` / `varchar(150)` | **PK คู่** ระบุชื่อตารางและรหัสเรคคอร์ดที่ถูกล็อก |
| `menu_code`, `tab_session_id`, `tab_label` | `varchar` | หน้าจอและแท็บที่ถือสิทธิ์แก้ไขอยู่ |
| `locked_by_code`, `locked_by_name` | `varchar(100)` / `varchar(250)` | รหัสและชื่อผู้ถือสิทธิ์แก้ไข |
| `acquired_at`, `heartbeat_at`, `expires_at` | `timestamptz` | เวลาที่เริ่มล็อก ส่งสัญญาณชีพ และเวลาหมดอายุ |

### `erp_user_datalist_config` — การจัดเรียง/ซ่อนคอลัมน์ Datalist รายผู้ใช้
- **Primary Key**: `PRIMARY KEY (user_code, list_key)` (`23_user_datalist_config.sql:1-18`, `master_datalist.go:50-56`)
- **คอลัมน์**: `user_code` (`varchar(100)`), `list_key` (`varchar(150)`), `config_json` (`jsonb`), `updated_at` (`timestamptz`)

---

## 3. ตารางกำหนด View หน้าจอค้นหาและเทมเพลตรายงาน

| ตาราง | Index / Key | บทบาทและคอลัมน์สำคัญ |
|---|---|---|
| `erp_view_document` | `idx_erp_view_document_code` | `screen_code`, `code`, `name_1`, `name_2`, `status` — เมนู/หมวดเอกสารของหน้าจอ |
| `erp_view_table` / `erp_view_table_custom` | ไม่มี SQL PK (`roworder serial`) | `screen_code`, `name_1`, `table_name`, `table_list`, `sort`, `filter`, `width_persent`, `sort_mode`, `status` — นิยามตารางมาตรฐานและแบบปรับแต่ง |
| `erp_view_column` / `erp_view_column_custom` | ไม่มี SQL PK (`roworder serial`) | `screen_group`, `screen_code`, `column_number`, `column_name`, `column_name_2`, `column_field_name`, `column_field_sort`, `column_width`, `column_type`, `column_align`, `column_format`, `column_resource`, `column_field_search`, `column_no_search` — คอลัมน์ตารางค้นหาของระบบและแบบกำหนดเอง |
| `erp_report_template` | `template_id VARCHAR(64) PRIMARY KEY`, `idx_erp_report_template_menu_key` | `menu_key`, `template_name`, `description`, `is_default`, `is_shared`, `custom_title`, `custom_subtitle`, `custom_sql`, `columns_json` (`jsonb`), `page_setup_json` (`jsonb`), `created_by`, `updated_by` — เทมเพลตรายงานปรับแต่งได้ใน BC Report Designer |

---

## 4. Log การยกเลิก พิมพ์ ส่งข้อความ และรูปภาพ (`erp_cancel_logs`, `erp_print_logs`, `erp_images`)

| ตาราง | Index | คอลัมน์สำคัญและบทบาท |
|---|---|---|
| `erp_cancel_logs` | `idx_erp_cancel_logs_doc_no_trans_flag` | `doc_no`, `trans_flag`, `user_code`, `cancel_flag`, `cancel_datetime`, `cancel_reason` (`varchar(500)`) — ประวัติการยกเลิกและคืนสถานะเอกสาร |
| `erp_print_logs` | `idx_erp_print_logs_doc_no_trans_flag` | `doc_no`, `trans_flag`, `user_code`, `print_datetime` — ประวัติการสั่งพิมพ์ (ใช้บังคับกฎพิมพ์ครั้งเดียวเมื่อ `print_invoice_one_time = 1`) |
| `erp_print_station` | ไม่มี SQL PK (`roworder serial`) | `printer_name` (`varchar(255)`) — รายชื่อเครื่องพิมพ์ |
| `erp_send_message` | ไม่มี SQL PK (`roworder serial`) | `send_type`, `send_to`, `send_title`, `send_message`, `send_status`, `send_date`, `send_to_date`, `send_process_guid` — คิวแจ้งเตือนข้อความ |
| `erp_images` | ไม่มี SQL PK (`roworder serial`) | `image_id` (`varchar(50)`), `image_file` (`text`), `system_id` (`varchar(10)`), `guid_code` (`varchar(100)`) — รูปภาพเอกสาร/มาสเตอร์ |

---

## ตัวอย่าง SQL ใช้งานจริง

```sql
-- 1) ตรวจสอบเอกสารที่กำลังถูกล็อกและยังไม่หมดอายุ
SELECT table_name, record_key, menu_code, locked_by_code, locked_by_name,
       acquired_at, expires_at,
       EXTRACT(EPOCH FROM (expires_at - NOW()))::int AS remaining_sec
FROM erp_record_lock
WHERE expires_at > NOW()
ORDER BY acquired_at DESC;

-- 2) ดูประวัติการยกเลิกเอกสารพร้อมเหตุผล
SELECT doc_no, trans_flag, user_code, cancel_flag, cancel_datetime, cancel_reason
FROM erp_cancel_logs
ORDER BY cancel_datetime DESC
LIMIT 50;
```
