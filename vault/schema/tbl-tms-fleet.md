---
title: ตารางระบบขนส่งและบริหารยานพาหนะ TMS (tms_*, transport_type, auto_ship_to)
tags:
  - schema
  - tms
  - logistics
  - epod
  - fleet
aliases:
  - tms_fleet_vehicle
  - tms_trip_manifest
  - tms_delivery_stop
  - tms_maintenance_log
  - transport_type
  - auto_ship_to
sources:
  - backend/internal/adapter/inbound/http/tms/handler.go:1607
  - backend/internal/adapter/inbound/http/tms/handler.go:1646
  - backend/internal/adapter/inbound/http/tms/handler.go:1672
  - backend/internal/adapter/inbound/http/tms/handler.go:1703
  - scripts/sql/02b_sync_existing_db.sql:9607
  - scripts/sql/02b_sync_existing_db.sql:9630
  - scripts/sql/02b_sync_existing_db.sql:9657
  - scripts/sql/02_data_schema.sql:9333
  - scripts/sql/02_data_schema.sql:1997
---

# ตารางระบบขนส่งและบริหารยานพาหนะ TMS (`tms_*`, `transport_type`, `auto_ship_to`)

กลุ่มตารางบริหารจัดการขนส่ง (Transportation Management System — `/tms`) สำหรับควบคุมทะเบียนรถขนส่ง ใบคุมเที่ยวรถ (Trip Manifest) จุดส่งมอบสินค้าและหลักฐาน e-POD พร้อมรูปถ่าย รวมถึงบันทึกซ่อมบำรุงรถ (PM/CM) และตารางอ้างอิงวิธีขนส่ง (`transport_type`) / จุดส่งอัตโนมัติ (`auto_ship_to`) เพื่อเชื่อมกับงานแพ็คจาก [[tbl-wms-modern]] และเอกสารขาย `ic_trans` ในระบบหลัก ([[schema-overview]])

---

## 1. ภาพรวมตารางในกลุ่ม TMS

| ตาราง | Primary Key / Index | วัตถุประสงค์หลัก | ที่มา DDL |
| :--- | :--- | :--- | :--- |
| `tms_fleet_vehicle` | `roworder` (`SERIAL PRIMARY KEY`) | ทะเบียนรถขนส่ง พนักงานขับ รถร่วม/รถบริษัท GPS และระยะ PM | `http/tms/handler.go:1607`, `02b_sync_existing_db.sql:9607` |
| `tms_trip_manifest` | `roworder` (`SERIAL PRIMARY KEY`) | ใบคุมเที่ยวรถ (Trip) ต้นทุนค่าขนส่ง และยอดขายรวมต่อเที่ยว | `http/tms/handler.go:1646`, `02b_sync_existing_db.sql:9630` |
| `tms_delivery_stop` | `roworder` (`SERIAL PRIMARY KEY`) | จุดส่งสินค้าปลายทาง เชื่อมใบแพ็ค WMS/บิล ERP เก็บ COD และ e-POD | `http/tms/handler.go:1672`, `02b_sync_existing_db.sql:9657` |
| `tms_maintenance_log` | `roworder` (`SERIAL PRIMARY KEY`) | ประวัติซ่อมบำรุงรถ (PM/ซ่อม) ค่าอะไหล่ ค่าแรง ภาษี และเชื่อมเอกสารจ่าย ERP | `http/tms/handler.go:1703` |
| `transport_type` | `roworder` (`SERIAL NOT NULL`), Index `idx_transport_type_code` | ตารางรหัสประเภท/วิธีการขนส่งมาตรฐาน ERP | `02_data_schema.sql:9333` |
| `auto_ship_to` | `roworder` (`SERIAL NOT NULL`) | ตารางกำหนดคลัง/ชั้นจัดส่งอัตโนมัติตามสาขา | `02_data_schema.sql:1997` |

---

## 2. โครงสร้างตารางละเอียด

### `tms_fleet_vehicle` — ทะเบียนรถขนส่งและสถานะ GPS/ซ่อมบำรุง
* **Primary Key**: `roworder SERIAL PRIMARY KEY`
* **คอลัมน์หลัก** (`02b_sync_existing_db.sql:9607` และขยายเพิ่มด้วย `ALTER TABLE` ใน `http/tms/handler.go:1637-1645`):
  * `vehicle_code` (`VARCHAR(40) NOT NULL DEFAULT ''`), `plate_no` (`VARCHAR(50) NOT NULL DEFAULT ''`), `vehicle_type` (`VARCHAR(100) NOT NULL DEFAULT ''`) — รหัสรถ ทะเบียน และประเภทรถ
  * `ownership_type` (`VARCHAR(80) DEFAULT 'OWN_FLEET'`) — ประเภทกรรมสิทธิ์ (ขยายจาก `varchar(40)` เป็น `varchar(80)` ใน `handler.go:1645`)
  * `contractor_name` (`VARCHAR(200)`), `cost_model` (`VARCHAR(150)`), `base_rate_baht` (`NUMERIC(18,2)`), `wht_tax_rate` (`NUMERIC(6,2)`) — ข้อมูลผู้รับเหมาขนส่ง รูปแบบคิดราคา ค่าจ้างตั้งต้น และอัตราหัก ณ ที่จ่าย
  * `driver_name` (`VARCHAR(100)`), `driver_phone` (`VARCHAR(50)`), `route_zone` (`VARCHAR(100)`) — พนักงานขับรถและโซนวิ่งงาน
  * `max_weight_kg` (`NUMERIC(18,2) DEFAULT 2000`), `current_load_kg` (`NUMERIC(18,2) DEFAULT 0`), `status` (`VARCHAR(30) DEFAULT 'AVAILABLE'`) — พิกัดบรรทุกสูงสุด น้ำหนักบรรทุกปัจจุบัน และสถานะรถ
  * `gps_lat` (`NUMERIC(12,6) DEFAULT 13.7563`), `gps_lng` (`NUMERIC(12,6) DEFAULT 100.5018`), `gps_location_name` (`VARCHAR(255)`) — พิกัด GPS ล่าสุด
  * `fuel_km_per_liter` (`NUMERIC(10,2) DEFAULT 10.5`), `odometer_km` (`NUMERIC(18,2) DEFAULT 45000`), `next_pm_km` (`NUMERIC(18,2) DEFAULT 50000`), `insurance_exp_date` (`VARCHAR(40)`), `health_score_pct` (`NUMERIC(10,2) DEFAULT 98.5`) — ตัวชี้วัดน้ำมัน เลขไมล์ รอบซ่อมบำรุง วันหมดอายุประกัน และคะแนนสุขภาพรถ
  * `image_key` (`TEXT`), `image_thumb_key` (`TEXT`), `evidence_photos_json` (`TEXT DEFAULT '[]'`), `updated_at` (`VARCHAR(40)`), `create_date_time_now` (`TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()`)

---

### `tms_trip_manifest` — ใบคุมเที่ยวรถขนส่ง (Trip Manifest)
* **Primary Key**: `roworder SERIAL PRIMARY KEY`
* **คอลัมน์สำคัญ**:
  * `trip_no` (`VARCHAR(50)`), `trip_date` (`VARCHAR(30)`), `route_name` (`VARCHAR(200)`), `vehicle_code` (`VARCHAR(40)`), `plate_no` (`VARCHAR(50)`)
  * `driver_name` (`VARCHAR(100)`), `driver_phone` (`VARCHAR(50)`), `trip_status` (`VARCHAR(30) DEFAULT 'LOADING'`)
  * `total_stops` (`INTEGER DEFAULT 0`), `completed_stops` (`INTEGER DEFAULT 0`), `total_boxes` (`INTEGER DEFAULT 0`), `total_weight_kg` (`NUMERIC(18,2) DEFAULT 0`)
  * `distance_km` (`NUMERIC(18,2)`), `fuel_cost` (`NUMERIC(18,2)`), `toll_cost` (`NUMERIC(18,2)`), `driver_allowance` (`NUMERIC(18,2)`), `total_freight_cost` (`NUMERIC(18,2)`), `total_invoice_amount` (`NUMERIC(18,2)`) — ระยะทางและต้นทุนเดินรถเทียบยอดบิลรวมต่อเที่ยว
  * `departure_time` (`VARCHAR(40)`), `eta_time` (`VARCHAR(40)`), `evidence_photos_json` (`TEXT DEFAULT '[]'`), `remark` (`TEXT`), `create_date_time_now`

---

### `tms_delivery_stop` — จุดจัดส่งและหลักฐานรับสินค้า e-POD
* **Primary Key**: `roworder SERIAL PRIMARY KEY`
* **คอลัมน์สำคัญ**:
  * `stop_code` (`VARCHAR(50)`), `trip_no` (`VARCHAR(50)`), `stop_seq` (`INTEGER DEFAULT 1`) — รหัสจุดส่ง เลขเที่ยวรถ และลำดับจุดส่งในเที่ยว
  * `wms_doc_no` (`VARCHAR(50)`), `erp_inv_doc_no` (`VARCHAR(50)`) — เชื่อมเลขใบเบิก/แพ็คใน [[tbl-wms-modern]] (`wms_fulfillment_order.wms_doc_no`) และเลขบิลขายใน ERP (`ic_trans.doc_no`)
  * `cust_code` (`VARCHAR(50)`), `cust_name` (`VARCHAR(255)`), `delivery_address` (`VARCHAR(255)`), `contact_phone` (`VARCHAR(50)`)
  * `ic_code` (`VARCHAR(50)`), `ic_name` (`VARCHAR(255)`), `qty` (`NUMERIC(18,2)`), `unit_code` (`VARCHAR(30) DEFAULT 'ชิ้น'`), `box_count` (`INTEGER DEFAULT 1`), `weight_kg` (`NUMERIC(18,2)`)
  * `invoice_amount` (`NUMERIC(18,2)`), `cod_amount` (`NUMERIC(18,2)`), `payment_term` (`VARCHAR(50) DEFAULT 'CREDIT_AR_30D'`), `stop_status` (`VARCHAR(30) DEFAULT 'IN_TRANSIT'`)
  * `receiver_name` (`VARCHAR(100)`), `receiver_role` (`VARCHAR(100)`), `delivered_at` (`VARCHAR(40)`), `gps_coords` (`VARCHAR(100)`), `pod_note` (`TEXT`), `pod_image_key` (`TEXT`), `pod_image_thumb_key` (`TEXT`), `evidence_photos_json` (`TEXT`), `create_date_time_now`

---

### `tms_maintenance_log` — บันทึกประวัติซ่อมบำรุงรถ (PM / CM)
* **Primary Key**: `roworder SERIAL PRIMARY KEY` (นิยามใน `http/tms/handler.go:1703`)
* **คอลัมน์สำคัญ**: `maint_doc_no` (`VARCHAR(50)`), `maint_date` (`VARCHAR(30)`), `vehicle_code` (`VARCHAR(40)`), `plate_no` (`VARCHAR(50)`), `vehicle_type` (`VARCHAR(100)`), `ownership_type` (`VARCHAR(80)`), `maint_type` (`VARCHAR(60) DEFAULT 'PM_SCHEDULED'`), `service_title` (`VARCHAR(255)`), `workshop_vendor` (`VARCHAR(200)`), `odometer_at_service` (`NUMERIC(18,2)`), `next_due_km` (`NUMERIC(18,2)`), `parts_cost` (`NUMERIC(18,2)`), `labor_cost` (`NUMERIC(18,2)`), `vat_amount` (`NUMERIC(18,2)`), `wht_amount` (`NUMERIC(18,2)`), `total_cost` (`NUMERIC(18,2)`), `maint_status` (`VARCHAR(40) DEFAULT 'COMPLETED_READY'`), `mechanic_note` (`TEXT`), `erp_expense_doc_no` (`VARCHAR(50)`), `image_key`, `image_thumb_key`, `evidence_photos_json`, `updated_at`, `create_date_time_now`

---

### ตารางอ้างอิงงานขนส่งในสคีมาหลัก (`transport_type`, `auto_ship_to`)
* `transport_type` (`02_data_schema.sql:9333`): `roworder` (`SERIAL NOT NULL`), `code` (`VARCHAR(25)`), `name_1` (`VARCHAR(100)`), `name_2` (`VARCHAR(100)` ขยายเป็น `VARCHAR(200)` ใน L9344), `status` (`SMALLINT DEFAULT 0` เพิ่มใน L9345), `guid_code` (`VARCHAR(35)`), Index `idx_transport_type_code` บน `(code)` (L9346)
* `auto_ship_to` (`02_data_schema.sql:1997`): `roworder` (`SERIAL NOT NULL`), `branch_code` (`VARCHAR(25)`), `wh_code` (`VARCHAR(100)`), `shelf_code` (`VARCHAR(100)`), `create_date_time_now`

---

## 3. รูปแบบการ JOIN และคำสั่ง SELECT พร้อมใช้งาน

* `tms_trip_manifest.vehicle_code = tms_fleet_vehicle.vehicle_code`
* `tms_delivery_stop.trip_no = tms_trip_manifest.trip_no`
* `tms_delivery_stop.wms_doc_no = wms_fulfillment_order.wms_doc_no` ([[tbl-wms-modern]])
* `tms_delivery_stop.erp_inv_doc_no = ic_trans.doc_no` โดยกรอง `COALESCE(ic_trans.last_status, 0) = 0` เสมอ ([[schema-overview]])

```sql
-- สรุปความคืบหน้าเที่ยวรถ ต้นทุนค่าขนส่ง และยอดเก็บ COD แยกตามจุดส่งที่ยังไม่เสร็จสิ้น
SELECT
    m.trip_no,
    m.trip_date,
    m.route_name,
    m.vehicle_code,
    v.plate_no,
    v.ownership_type,
    m.trip_status,
    m.completed_stops,
    m.total_stops,
    m.total_freight_cost::NUMERIC(18,2) AS total_freight_cost,
    m.total_invoice_amount::NUMERIC(18,2) AS total_invoice_amount,
    COALESCE(SUM(s.cod_amount), 0)::NUMERIC(18,2) AS total_cod_amount
FROM tms_trip_manifest m
LEFT JOIN tms_fleet_vehicle v
    ON v.vehicle_code = m.vehicle_code
LEFT JOIN tms_delivery_stop s
    ON s.trip_no = m.trip_no
GROUP BY
    m.roworder, m.trip_no, m.trip_date, m.route_name, m.vehicle_code,
    v.plate_no, v.ownership_type, m.trip_status, m.completed_stops,
    m.total_stops, m.total_freight_cost, m.total_invoice_amount
ORDER BY m.roworder DESC;
```

```sql
-- ตรวจสอบจุดส่งที่เชื่อมโยงกับใบเบิก WMS และบิลขาย ERP ที่ยังเป็นเอกสารใช้งาน
SELECT
    s.stop_code,
    s.trip_no,
    s.stop_seq,
    s.wms_doc_no,
    w.stage AS wms_stage,
    s.erp_inv_doc_no,
    t.doc_date AS erp_doc_date,
    s.cust_code,
    s.cust_name,
    s.invoice_amount::NUMERIC(18,2) AS invoice_amount,
    s.cod_amount::NUMERIC(18,2) AS cod_amount,
    s.stop_status,
    s.delivered_at
FROM tms_delivery_stop s
LEFT JOIN wms_fulfillment_order w
    ON w.wms_doc_no = s.wms_doc_no
LEFT JOIN ic_trans t
    ON t.doc_no = s.erp_inv_doc_no
   AND COALESCE(t.last_status, 0) = 0
ORDER BY s.trip_no ASC, s.stop_seq ASC;
```
