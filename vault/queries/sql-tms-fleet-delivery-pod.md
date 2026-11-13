---
title: "SQL Operations: ระบบขนส่งและกระจายสินค้า TMS (Fleet, เที่ยววิ่ง, จุดส่ง POD/COD, ซ่อมบำรุง และ MonitorMap)"
audience: dev
tags:
  - sql
  - tms
  - fleet
  - pod
  - cod
  - maintenance
  - monitormap
  - dev
aliases:
  - sql-tms
  - query-tms-fleet
  - query-tms-pod
sources:
  - backend/internal/adapter/inbound/http/tms/handler.go:1607-1729
  - backend/internal/adapter/inbound/http/monitormap/handler.go:132
  - backend/internal/adapter/inbound/http/crm/handler.go:1791-1893
---

# SQL Operations: ระบบขนส่งและกระจายสินค้า TMS

> กติกาหลัก: ใช้ `[[dev-rules-accounting-sql]]` เสมอ — คอลัมน์วันที่ของตาราง TMS (`trip_date`, `maint_date`, `insurance_exp_date`) เก็บเป็น `varchar` (เช่น `DD/MM/YYYY` หรือ `YYYY-MM-DD`) จึงควรคัดกรองตาม `status` หรือเรียงจาก `create_date_time_now` / `roworder DESC` เพื่อไม่ให้เกิด Cast Error — ดู API ที่ [[api-rest-ops-ext]] และสายงานคลังที่ [[sql-wms-fulfillment-bins]]

---

## 1. สถานะรถบรรทุก, อัตราบรรทุก (Load Ratio) และแจ้งเตือนรอบซ่อม PM (`tms_fleet_vehicle`)

รวมข้อมูลรถบริษัท (`OWN_FLEET`) และรถจ้างเหมาภายนอกที่ต้องคำนวณภาษีหัก ณ ที่จ่าย 1%–3% (`wht_tax_rate`):

```sql
SELECT vehicle_code,
       plate_no,
       vehicle_type,
       ownership_type,
       contractor_name,
       cost_model,
       base_rate_baht::numeric(18, 2) AS base_rate_baht,
       wht_tax_rate::numeric(6, 2) AS wht_tax_rate,
       driver_name,
       route_zone,
       status,
       current_load_kg::numeric(18, 2) AS current_load_kg,
       max_weight_kg::numeric(18, 2) AS max_weight_kg,
       ROUND(
           COALESCE(current_load_kg, 0) * 100.0 / NULLIF(max_weight_kg, 0),
           2
       )::numeric(10, 2) AS load_utilization_pct,
       gps_lat::numeric(12, 6) AS gps_lat,
       gps_lng::numeric(12, 6) AS gps_lng,
       gps_location_name,
       odometer_km::numeric(18, 2) AS odometer_km,
       next_pm_km::numeric(18, 2) AS next_pm_km,
       (next_pm_km - odometer_km)::numeric(18, 2) AS km_until_pm,
       CASE
           WHEN odometer_km >= next_pm_km THEN 'OVERDUE_PM'
           WHEN (next_pm_km - odometer_km) <= 1000 THEN 'DUE_SOON_PM'
           ELSE 'OK'
       END AS pm_alert_status,
       insurance_exp_date,
       health_score_pct::numeric(10, 2) AS health_score_pct
FROM tms_fleet_vehicle
ORDER BY CASE WHEN odometer_km >= next_pm_km THEN 0 ELSE 1 END, vehicle_code;
```

---

## 2. สรุปเที่ยววิ่ง ต้นทุนขนส่ง และสัดส่วนต้นทุนต่อยอดบิล (`tms_trip_manifest`)

```sql
SELECT m.trip_no,
       m.trip_date,
       m.route_name,
       m.vehicle_code,
       m.plate_no,
       m.driver_name,
       m.trip_status,
       m.total_stops,
       m.completed_stops,
       m.total_boxes,
       m.total_weight_kg::numeric(18, 2) AS total_weight_kg,
       m.distance_km::numeric(18, 2) AS distance_km,
       m.fuel_cost::numeric(18, 2) AS fuel_cost,
       m.toll_cost::numeric(18, 2) AS toll_cost,
       m.driver_allowance::numeric(18, 2) AS driver_allowance,
       m.total_freight_cost::numeric(18, 2) AS total_freight_cost,
       m.total_invoice_amount::numeric(18, 2) AS total_invoice_amount,
       ROUND(
           COALESCE(m.total_freight_cost, 0) * 100.0 / NULLIF(m.total_invoice_amount, 0),
           2
       )::numeric(10, 2) AS freight_to_sales_pct,
       m.departure_time,
       m.eta_time
FROM tms_trip_manifest m
WHERE ($1 = '' OR m.trip_status = $1)
ORDER BY m.roworder DESC
LIMIT 200;
```

---

## 3. ติดตามจุดส่งสินค้า หลักฐาน POD และยอดเก็บเงินปลายทาง COD (`tms_delivery_stop`)

เชื่อมโยงครบ 4 ระบบ: **TMS Stop** -> **Trip Manifest** -> **WMS Doc (`wms_fulfillment_order`)** -> **ERP Invoice (`ic_trans`)**:

```sql
SELECT s.stop_code,
       s.trip_no,
       s.stop_seq,
       m.plate_no,
       m.driver_name,
       s.wms_doc_no,
       s.erp_inv_doc_no,
       s.cust_code,
       s.cust_name,
       s.ic_code,
       s.ic_name,
       s.qty::numeric(18, 2) AS qty,
       s.unit_code,
       s.box_count,
       s.weight_kg::numeric(18, 2) AS weight_kg,
       s.invoice_amount::numeric(18, 2) AS invoice_amount,
       COALESCE(t.total_amount, 0)::numeric(18, 2) AS erp_inv_total_amount,
       s.cod_amount::numeric(18, 2) AS cod_amount,
       s.payment_term,
       s.stop_status,
       w.stage AS wms_stage,
       s.receiver_name,
       s.receiver_role,
       s.delivered_at,
       s.gps_coords,
       (COALESCE(s.pod_image_key, '') <> '') AS has_pod_photo
FROM tms_delivery_stop s
LEFT JOIN tms_trip_manifest m ON m.trip_no = s.trip_no
LEFT JOIN wms_fulfillment_order w ON w.wms_doc_no = s.wms_doc_no
LEFT JOIN ic_trans t
       ON t.doc_no = s.erp_inv_doc_no
      AND t.trans_flag = 44
      AND COALESCE(t.last_status, 0) = 0
WHERE ($1 = '' OR s.trip_no = $1)
  AND ($2 = '' OR s.stop_status = $2)
ORDER BY s.trip_no DESC, s.stop_seq ASC;
```

---

## 4. ประวัติซ่อมบำรุงรถ (PM/CM) และเชื่อมโยงเอกสารค่าใช้จ่าย ERP (`tms_maintenance_log`)

```sql
SELECT maint_doc_no,
       maint_date,
       vehicle_code,
       plate_no,
       ownership_type,
       maint_type,
       service_title,
       workshop_vendor,
       odometer_at_service::numeric(18, 2) AS odometer_at_service,
       next_due_km::numeric(18, 2) AS next_due_km,
       parts_cost::numeric(18, 2) AS parts_cost,
       labor_cost::numeric(18, 2) AS labor_cost,
       vat_amount::numeric(18, 2) AS vat_amount,
       wht_amount::numeric(18, 2) AS wht_amount,
       total_cost::numeric(18, 2) AS total_cost,
       maint_status,
       erp_expense_doc_no
FROM tms_maintenance_log
WHERE ($1 = '' OR vehicle_code = $1)
ORDER BY roworder DESC
LIMIT 200;
```

---

## 5. MonitorMap Mission Tracking & KPI Projection (`monitormap_*`)

ดูสถานะรถวิ่งบนแผนที่แบบ Real-time เทียบความจุคลัง (`monitormap_hub_nodes`, `monitormap_fleet_missions`, `monitormap_kpi_projection`):

```sql
SELECT fm.mission_id,
       fm.vehicle_code,
       fm.plate_no,
       fm.driver_name,
       fm.route_zone,
       fm.trip_no,
       fm.origin_wh_code,
       hb.hub_name AS origin_hub_name,
       fm.target_stop_code,
       fm.target_customer_name,
       fm.load_kg::numeric(12, 2) AS load_kg,
       fm.max_weight_kg::numeric(12, 2) AS max_weight_kg,
       fm.utilization_pct,
       fm.invoice_value::numeric(18, 2) AS invoice_value,
       fm.mission_status,
       fm.updated_at
FROM monitormap_fleet_missions fm
LEFT JOIN monitormap_hub_nodes hb ON hb.wh_code = fm.origin_wh_code
ORDER BY fm.updated_at DESC;
```

หมายเหตุ: พารามิเตอร์ `$1` ใน §2 คือ `trip_status` (`LOADING`, `IN_TRANSIT`, `COMPLETED`), ใน §3 ใช้ `$1` (`trip_no`) และ `$2` (`stop_status`: `PENDING_LOAD`, `IN_TRANSIT`, `ARRIVED`, `DELIVERED_POD`) — ดูตารางเตือนวิกฤต MonitorMap SME Alerts เพิ่มเติมใน [[sql-ext-sme-briefing-automation]]
