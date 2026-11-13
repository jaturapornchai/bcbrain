---
title: ตารางศูนย์ปฏิบัติการแผนที่และมอนิเตอร์พนักงาน (monitormap_*, workmonitor_*)
tags:
  - schema
  - crm
  - monitormap
  - workmonitor
  - analytics
aliases:
  - monitormap_hub_nodes
  - monitormap_customer_nodes
  - monitormap_fleet_missions
  - monitormap_live_events
  - monitormap_kpi_projection
  - monitormap_sme_alerts
  - monitormap_tile_cache
  - workmonitor_desk_nodes
  - workmonitor_activity_logs
  - workmonitor_summary_projection
sources:
  - backend/internal/adapter/inbound/http/crm/handler.go:1791
  - backend/internal/adapter/inbound/http/crm/handler.go:1809
  - backend/internal/adapter/inbound/http/crm/handler.go:1825
  - backend/internal/adapter/inbound/http/crm/handler.go:1848
  - backend/internal/adapter/inbound/http/crm/handler.go:1862
  - backend/internal/adapter/inbound/http/crm/handler.go:1875
  - backend/internal/adapter/inbound/http/monitormap/handler.go:132
  - backend/migrations/0001_audit_schema.sql:8
  - backend/migrations/0001_audit_schema.sql:102
  - backend/migrations/0001_audit_schema.sql:134
  - backend/migrations/0001_audit_schema.sql:149
---

# ตารางศูนย์ปฏิบัติการแผนที่และมอนิเตอร์พนักงาน (`monitormap_*`, `workmonitor_*`)

กลุ่มตาราง Projection และ Telemetry สำหรับหน้าจอ Executive Command Center (แผนที่ Logistics Real-time ทั่วประเทศ `monitormap_*` ถูกสร้างใน `http/crm/handler.go` และ `http/monitormap/handler.go`) และหน้าจอจำลองสำนักงาน 3D / ติดตามสถานะการปฏิบัติงานของพนักงาน (`workmonitor_*` ใน `backend/migrations/0001_audit_schema.sql`)

---

## 1. กลุ่มตารางแผนที่ปฏิบัติการ (`monitormap_*`)

| ตาราง | Primary Key | วัตถุประสงค์และคอลัมน์สำคัญ |
| :--- | :--- | :--- |
| `monitormap_hub_nodes` | `hub_id VARCHAR(64)` | จุดคลังกระจายสินค้า (Hub): `wh_code`, `hub_name`, `region_name`, `address_text`, `lat`, `lng`, `total_sku`, `physical_qty`, `capacity_qty`, `utilization_pct`, `pending_pick_orders`, `packed_ready_orders`, `daily_throughput_value`, `theme_color` |
| `monitormap_customer_nodes` | `stop_id VARCHAR(64)` | หมุดจุดส่งลูกค้า: `stop_code`, `cust_code`, `cust_name`, `store_category` (`'B2B_WHOLESALE'`), `lat`, `lng`, `origin_wh_code`, `invoice_amount`, `box_count`, `delivery_status` (`'IN_TRANSIT'`), `product_summary` |
| `monitormap_fleet_missions` | `mission_id VARCHAR(64)` | ภารกิจรถวิ่งบนแผนที่: `vehicle_code`, `plate_no`, `driver_name`, `driver_phone`, `route_zone`, `trip_no`, `origin_wh_code`, `target_stop_code`, `target_customer_name`, `highway_id`, `load_kg`, `max_weight_kg`, `utilization_pct`, `invoice_value`, `speed_factor`, `initial_progress`, `mission_status` |
| `monitormap_live_events` | `event_id VARCHAR(64)` | ฟีดเหตุการณ์สด: `event_time_label`, `event_category`, `headline_text`, `detail_text`, `voice_narration`, `amount_baht`, `lat`, `lng`, `badge_color`, `sort_order` |
| `monitormap_kpi_projection` | `projection_key VARCHAR(32)` | ตารางสรุป KPI แผนที่: `total_warehouses`, `total_physical_stock`, `total_fleet_vehicles`, `active_trips`, `total_customer_stops`, `delivered_stops`, `on_time_rate_pct`, `total_revenue_baht`, `total_pos_terminals`, `rebuilt_at` |
| `monitormap_sme_alerts` | `alert_id VARCHAR(64)` | แจ้งเตือนวิกฤติรายแผนก (`WMS`, ฯลฯ): `severity` (`'CRITICAL'`), `dept_code`, `dept_label`, `alert_title`, `action_label`, `voice_alert`, `voice_resolved`, `impact_amount`, `target_entity_kind`, `target_entity_id`, `lat`, `lng`, `alert_status` (`'OPEN'`) |
| `monitormap_tile_cache` | `tile_key` / `cache_key` | แคชภาพ Map Tile (`layer`, `z`, `x`, `y`, `content_type`, Base64 tile, `hit_count`) *(หมายเหตุ: `http/monitormap/handler.go:132` ใช้ `tile_key`/`byte_size`/`tile_base64` ส่วน `0001_audit_schema.sql:8` ใช้ `cache_key`/`size_bytes`/`tile_b64` พร้อม Index `idx_monitormap_tile_zxy` / `idx_monitormap_tile_cache_lz`)* |

---

## 2. กลุ่มตารางติดตามการทำงาน 3D (`workmonitor_*`)

สร้างใน `backend/migrations/0001_audit_schema.sql:102-159` เพื่อเก็บสถานะหน้าจอและการทำงานแบบเรียลไทม์ของพนักงานแต่ละโต๊ะ:

| ตาราง | Primary Key | วัตถุประสงค์และคอลัมน์สำคัญ |
| :--- | :--- | :--- |
| `workmonitor_desk_nodes` | `desk_id VARCHAR(64)` | พิกัดโต๊ะทำงาน 3D (`pos_x`, `pos_z`, `rotation_y`), ข้อมูลพนักงาน (`emp_code`, `emp_name`, `nickname`, `role_title`, `department`), สถานะ (`work_status` `'ACTIVE'`), เมนูที่เปิดอยู่ (`active_module`, `active_route`, `active_menu_code`, `active_screen_title`, `active_doc_no`, `active_tx_amount`, `kpm_rate`, `today_docs_count`, `today_sales_amount`, `screen_payload_json`) |
| `workmonitor_activity_logs` | `log_id VARCHAR(64)` | บันทึกประวัติการทำงานแยกโต๊ะ (`desk_id`, `emp_code`, `module_id`, `screen_title`, `action_type`, `action_detail`, `doc_no`, `tx_amount`, `created_at`) |
| `workmonitor_summary_projection` | `projection_key VARCHAR(32)` | ตารางสรุป KPI รวม (`total_desks`, `online_desks`, `typing_desks`, `idle_desks`, `total_docs_processed`, `total_tx_volume`, `avg_kpm_rate`, `rebuilt_at`) |

---

## 3. ตัวอย่าง SQL Query

```sql
-- ตรวจสอบการแจ้งเตือนที่ยังเปิดอยู่และภารกิจขนส่งบนแผนที่เรียงตามผลกระทบทางการเงิน
SELECT
    alert_id,
    severity,
    dept_code,
    alert_title,
    impact_amount::NUMERIC(18,2) AS impact_amount,
    alert_status,
    updated_at
FROM monitormap_sme_alerts
WHERE alert_status = 'OPEN'
ORDER BY impact_amount DESC, sort_order ASC;
```
