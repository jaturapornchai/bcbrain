---
title: "ตารางและตัวสร้างชุดข้อมูลของ 3D Monitor TV (monitormap_*)"
tags: [systems, monitormap, tables, seed]
aliases: ["monitormap_hub_nodes", "monitormap_customer_nodes", "monitormap_fleet_missions", "monitormap_live_events", "monitormap_kpi_projection", "monitormap_sme_alerts", "buildMonitorWorldDataset", "monitorDataBuilder", "NATIONAL_LIVE"]
sources: ["backend/internal/adapter/inbound/http/crm/handler.go:867-1015", "backend/internal/adapter/inbound/http/crm/handler.go:893-995", "backend/internal/domain/query/write_policy_legacy.go:41-42", "frontend/src/app/api/monitormap/route.ts:80-100", "frontend/src/app/api/monitormap/route.ts:117-124", "frontend/src/app/api/monitormap/route.ts:252-261", "frontend/src/app/api/monitormap/route.ts:263-318", "frontend/src/app/api/monitormap/route.ts:369-383", "frontend/monitormap/monitorDataBuilder.ts:10-72", "frontend/monitormap/monitorDataBuilder.ts:74-91", "frontend/monitormap/monitorDataBuilder.ts:492-531", "frontend/monitormap/monitorDataBuilder.ts:572-617", "frontend/monitormap/monitorDataBuilder.ts:618-690", "frontend/monitormap/monitorDataBuilder.ts:692-705", "frontend/monitormap/monitorDataBuilder.ts:786-800", "frontend/monitormap/monitorDataBuilder.ts:900-945", "frontend/monitormap/thailandGeoData.ts:84-95", "frontend/monitormap/thailandGeoData.ts:528-533"]
---
# ตารางและชุดข้อมูลของ 3D Monitor TV

หน้า [[sys-monitormap-overview]] ไม่อ่านตารางบัญชีโดยตรง แต่อ่านตาราง `monitormap_*` 6 ตารางซึ่งเป็น "แคชที่สร้างไว้สำหรับแสดงผล" แล้วแปลงเป็นชุดข้อมูลสำหรับวาด 3 มิติ บันทึกนี้อธิบายตาราง วิธีสร้าง/หว่านข้อมูล และข้อสังเกตของตัวสร้างชุดข้อมูล

## การสร้างตาราง
- ตารางทั้ง 6 สร้างด้วย `CREATE TABLE IF NOT EXISTS` ในฟังก์ชัน `ensureCrmAndMonitorMapTables` ของโมดูล CRM ฝั่ง Go (ใช้ `AllowDDL`) ซึ่งถูกเรียกครั้งแรกต่อฐานข้อมูลผ่าน `ensureSeedActivities` (ใช้ `seedDone` กันซ้ำ) เส้นทาง `/api/monitormap` จึงเรียก `GET /api/v1/crm/overview` ก่อนเสมอเมื่อต้องหว่านข้อมูล
- นโยบายเขียนของเกตเวย์คิวรีอนุญาตคำนำหน้า `monitormap_` เป็นพิเศษ เพราะเป็น "แคชที่สร้างจากข้อมูลดิบ" ดู [[be-query-write-policy]] และ [[adr-0011-query-exec-write-lockdown]]
- ตารางแผ่นแผนที่ `monitormap_tile_cache` เป็นอีกตารางหนึ่ง สร้างโดยโมดูล `monitormap` เอง ดู [[api-ops-health-monitormap]]

## ตารางทั้ง 6
| ตาราง | คีย์ | เก็บอะไร (คอลัมน์สำคัญ) |
|---|---|---|
| `monitormap_hub_nodes` | `hub_id` | คลังสินค้า/ศูนย์กระจายสินค้า: `wh_code`, `hub_name`, `region_name`, `lat`/`lng`, `total_sku`, `physical_qty`, `capacity_qty`, `utilization_pct`, `pending_pick_orders`, `packed_ready_orders`, `daily_throughput_value`, `theme_color` |
| `monitormap_customer_nodes` | `stop_id` | ลูกค้า/สาขา POS ที่เป็นจุดส่ง: `stop_code`, `cust_code`, `cust_name`, `store_category` (ค่าเริ่มต้น `B2B_WHOLESALE`), พิกัด, `origin_wh_code`, `invoice_amount`, `box_count`, `delivery_status` (ค่าเริ่มต้น `IN_TRANSIT`), `product_summary` |
| `monitormap_fleet_missions` | `mission_id` | รถและภารกิจส่งของ: `vehicle_code`, `plate_no`, `vehicle_type`, `driver_name`, `driver_phone`, `route_zone`, `trip_no`, `origin_wh_code`, `target_stop_code`, `highway_id`, `load_kg`, `max_weight_kg`, `utilization_pct`, `invoice_value`, `speed_factor`, `initial_progress`, `mission_status` |
| `monitormap_live_events` | `event_id` | เหตุการณ์สดสำหรับแถบข่าวและเสียงบรรยาย: `event_time_label`, `event_category`, `headline_text`, `detail_text`, `voice_narration`, `amount_baht`, พิกัด, `badge_color`, `sort_order` |
| `monitormap_kpi_projection` | `projection_key` | แถวสรุปตัวเลขทั้งประเทศ (คีย์ `NATIONAL_LIVE`): จำนวนคลัง สต็อกรวม จำนวนรถ ทริปที่วิ่งอยู่ จำนวนจุดส่ง จุดที่ส่งแล้ว `on_time_rate_pct` รายได้รวม `total_pos_terminals` และ `rebuilt_at` |
| `monitormap_sme_alerts` | `alert_id` | การแจ้งเตือนสำหรับผู้บริหาร: `severity` (ค่าเริ่มต้น `CRITICAL`), `dept_code`, `dept_label`, `alert_title`, `alert_detail`, `action_label`, `voice_alert`, `voice_resolved`, `impact_amount`, `target_entity_kind`/`target_entity_id`, พิกัด, `alert_status` (`OPEN`/`RESOLVED`), `sort_order` |

ค่าเงินในตารางเป็น `NUMERIC` ที่ฝั่งฐานข้อมูล แต่ตัวสร้างชุดข้อมูลฝั่งหน้าจออ่านเป็น `Number` เพื่อวาดภาพเท่านั้น (ตัวเลขสรุปเพื่อแสดงผล ไม่ใช่ตัวเลขทางบัญชี ดู [[std-data-integrity-money-transactions]])

## การหว่านข้อมูลตัวอย่าง (เฉพาะฐาน `bcdemo`)
`ensureMonitorMapDatabaseSeeded` ใน `route.ts` ทำงานครั้งเดียวต่อฐานต่อโปรเซส (จำใน `schemaSeededForDb`) ถ้าฐานไม่ใช่ `bcdemo` และไม่ได้สั่ง `?reseed=1` จะข้ามทันทีโดยไม่เพิ่มแถว ถ้าเข้าเงื่อนไขจะส่งคำสั่งชุดเดียว (`/query/execBatch`) ประกอบด้วย:
1. คลัง 12 แห่งทั่วประเทศ (เช่น กรุงเทพฯ อยุธยา EEC ระยอง อีสาน เหนือ ใต้)
2. ลูกค้า/สาขา POS 24 จุด
3. รถบรรทุก 22 คัน พร้อมภารกิจ
4. เหตุการณ์สด 12 รายการ พร้อมข้อความเสียงบรรยายภาษาไทย
5. การแจ้งเตือน 8 รายการ จากหลายแผนก
6. สร้างแถว `NATIONAL_LIVE` ใหม่จากตารางดิบ

ทุกคำสั่งใช้ `ON CONFLICT ... DO UPDATE` จึงรันซ้ำได้ ข้อสังเกต: การหว่านซ้ำปรับเฉพาะคอลัมน์ตัวเลข/สถานะของคลัง และ `alert_status` ของการแจ้งเตือนจะถูกคืนเป็น `OPEN` เฉพาะตอนสั่ง `?reseed=1` เท่านั้น

### แถว KPI `NATIONAL_LIVE`
จำนวนคลัง สต็อกรวม จำนวนรถ ทริปที่ `IN_TRANSIT` จำนวนจุดส่ง และจุดที่ `DELIVERED` คำนวณจากตารางดิบ ส่วนรายได้รวมคือผลรวม `daily_throughput_value` ของคลังบวกผลรวม `invoice_amount` ของจุดส่ง แต่ `on_time_rate_pct` (98.70) และ `total_pos_terminals` (15) เป็นค่าที่เขียนตรง ๆ ในคำสั่ง ไม่ได้คำนวณจากข้อมูลจริง แถวนี้ถูกสร้างใหม่เฉพาะตอนเข้าเงื่อนไขหว่านข้อมูลข้างต้น

## ตัวสร้างชุดข้อมูล `buildMonitorWorldDataset`
ฟังก์ชันนี้ (`frontend/monitormap/monitorDataBuilder.ts`) รับคำตอบจาก `GET /api/monitormap` แล้วคืน `MonitorWorldDataset` ที่มี `kpi`, `finance`, `warehouses`, `customers`, `trucks`, `events`, `alerts`:

- **แหล่งข้อมูล**: ใช้แถวจากตาราง `monitormap_*` เป็นหลัก ถ้าตารางว่างและเป็นฐาน `bcdemo` จะใช้ชุดตัวอย่างที่เขียนไว้ในโค้ด (คลังเริ่มต้น 12 แห่ง `DEFAULT_WAREHOUSE_HUBS`, จุดส่งเริ่มต้น, เหตุการณ์ตัวอย่าง 5 รายการ, การแจ้งเตือนตัวอย่าง 6 รายการ, รถที่สร้างจากคลังกับลูกค้า) ฐานอื่นจะได้อาร์เรย์ว่าง
- **ข้อมูล TMS/WMS/แดชบอร์ด/POS** ที่ route ดึงมาพ่วง ถูกอ่านเข้าตัวแปรแต่ใช้เพียงตั้งค่า `isLiveBackend` (มีคลังในตาราง หรือได้คำตอบจากระบบใดระบบหนึ่ง) ไม่ได้เอาตัวเลขจริงของระบบเหล่านั้นมาแสดง
- **ตัวเลขการเงินของผู้บริหาร** (`finance`): ฐาน `bcdemo` เป็นค่าคงที่ที่เขียนไว้ในโค้ด (เงินสด ลูกหนี้ เจ้าหนี้ ใบสั่งซื้อค้าง จำนวนใบกำกับภาษีอิเล็กทรอนิกส์วันนี้ ฯลฯ) ฐานอื่นเป็น 0 ยกเว้น 3 ค่าที่คำนวณจากสูตรง่าย ๆ: กำไรสุทธิประมาณการ = รายได้รวม x 0.168, ภาษีขายประมาณการ = รายได้รวม x 0.07, มูลค่าสต็อก = จำนวนชิ้นรวม x 145 ทุกค่านี้เป็นค่าประมาณเพื่อภาพรวม ไม่ใช่ผลจากสมุดบัญชี
- **รถ**: ทุกคันถูกระบุเป็น `OWN_FLEET` (ไม่แยกรถร่วม) ภารกิจจากฐานข้อมูลได้ `healthScorePct` 96, `totalStops` 6, `completedStops` 4 เป็นค่าคงที่ จุดผ่าน (`routeWaypoints`) สร้างจากสูตรโค้งระหว่างคลังต้นทางกับพิกัดลูกค้า ไม่ใช่เส้นทางถนนจริง
- **ค่าเริ่มต้นแบบ `||`**: ฟิลด์ตัวเลขเขียนเป็น `Number(row.xxx || ค่าเริ่มต้น)` ดังนั้นค่า 0 จากฐานข้อมูลจะถูกแทนด้วยค่าเริ่มต้น (เช่น คลังที่ `physical_qty` เป็น 0 จะแสดง 100000) ควรระวังเมื่อใช้ฐานจริงที่มีคลังว่าง
- **สถานะแจ้งเตือน**: `RESOLVED` เมื่อ `alert_status` เป็น `RESOLVED` นอกนั้นเป็น `OPEN`

พิกัดและการแปลงเป็นฉาก 3 มิติ (Mercator, แม่น้ำ, ทางหลวง, ขอบเขตภาค) อยู่ใน `thailandGeoData.ts` ดูเพิ่ม [[std-thai-geo-map-bank-logos]]

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/crm/handler.go:867-1015` ฟังก์ชันสร้างตารางและตัวป้องกันซ้ำ; `:893-995` DDL ของตารางทั้ง 6
- `backend/internal/domain/query/write_policy_legacy.go:41-42` คำนำหน้า `monitormap_` ที่เขียนผ่านเกตเวย์ได้
- `frontend/src/app/api/monitormap/route.ts:80-100` เงื่อนไขหว่านข้อมูล (`bcdemo` หรือ `reseed`); `:117-124` และ `:252-261` `ON CONFLICT`; `:263-318` สร้างแถว `NATIONAL_LIVE` และส่งคำสั่งชุดเดียว; `:369-383` คิวรีอ่านตาราง
- `frontend/monitormap/monitorDataBuilder.ts:10-72` ชนิดข้อมูล; `:74-91` สูตรจุดผ่านของรถ; `:492-531` ต้นฟังก์ชันและคลัง; `:572-690` รถ (จากฐานข้อมูลและตัวอย่าง); `:692-705` เหตุการณ์; `:786-800` การแจ้งเตือน; `:900-945` ผลลัพธ์ KPI และ finance
- `frontend/monitormap/thailandGeoData.ts:84-95` ชนิดภาค; `:528-533` คลังเริ่มต้น
- ดูเพิ่ม: [[sys-monitormap-overview]] · [[sys-monitormap-3d-screen]] · [[api-ops-health-monitormap]] · [[be-query-write-policy]] · [[std-data-integrity-money-transactions]]
