---
title: "ระบบขนส่ง TMS ภาพรวม (SYS-07 Smart TMS)"
tags: [systems, tms, transport, logistics]
aliases: ["TMS", "ระบบขนส่ง", "Smart TMS", "SYS-07", "/tms", "tms_trip_manifest", "tms_delivery_stop", "tms_fleet_vehicle", "tms_maintenance_log", "e-POD"]
sources: ["frontend/src/app/tms/page.tsx:5-16", "frontend/shared/layout/SystemPortalScreen.tsx:195-210", "frontend/shared/layout/Header.tsx:120", "frontend/shared/layout/PersistentWorkspaceHost.tsx:559", "backend/internal/adapter/inbound/http/router.go:286-294", "backend/internal/adapter/inbound/http/tms/handler.go:97-114", "backend/internal/adapter/inbound/http/tms/handler.go:272-288", "backend/internal/adapter/inbound/http/tms/handler.go:1344-1595", "backend/internal/adapter/inbound/http/tms/handler.go:1597-1735", "frontend/tms/TmsDashboard.tsx:280-290", "frontend/tms/TmsDashboard.tsx:353", "frontend/src/app/api/tms/overview/route.ts:1-35"]
---
# ระบบขนส่ง TMS (SYS-07 Smart TMS)

TMS คือระบบ "จัดสายรถและการจัดส่ง" ของ BC Ai Account ใช้ปล่อยรถออกส่งของ ติดตามว่าแต่ละจุดส่งถึงหรือยัง เก็บหลักฐานส่งมอบ (e-POD) พร้อมรูปถ่ายหลายมุม บริหารรถของบริษัท/รถเหมา/รถรับจ้าง และบันทึกงานซ่อมบำรุงรถ (PM/CM) ที่ต่อเข้าเอกสารภาษี

## ใครใช้ / เปิดอย่างไร
- ผู้ใช้หลัก: ฝ่ายจัดส่ง (จัดเที่ยวรถ ปล่อยรถ) คนขับ/ผู้ประสานงานที่บันทึกการส่งมอบ และผู้ดูแลกองรถ (ซ่อมบำรุง ต้นทุนขนส่ง)
- เปิดจากหน้ารวมระบบ (Portal) การ์ด `SYS-07` "ขนส่ง TMS" กลุ่ม "supply" ซึ่งลิงก์ไป `/tms` หรือจากแถบหัวระบบ "ระบบ ขนส่ง TMS"
- หน้า `/tms` เป็น Server Page เหมือน [[sys-wms-overview]]: ไม่มี session จะเด้งไป `/login`, ยังไม่เลือกฐานข้อมูลจะเด้งไป `/select-database` ถ้าผ่านจะวาง `WorkspaceRouteSync` แล้วให้ `PersistentWorkspaceHost` แสดงจอ `TmsDashboard` (ค้างสถานะไว้เมื่อสลับระบบ ดู [[fe-tabs-workspace]])

## 5 แท็บในจอ
| แท็บ (id) | เนื้อหา | อ่านต่อ |
|---|---|---|
| ใบกำกับเที่ยวรถ & จุดส่งมอบ e-POD (`manifest`) | รายการเที่ยวรถและจุดส่ง บันทึกส่งมอบ ถ่ายรูปหลายมุม | [[sys-tms-trip-pod-flow]] |
| ทะเบียนรถตัวเอง·รถเหมาช่วง·รถรับจ้าง (`fleet`) | ทะเบียนรถ ประเภทความเป็นเจ้าของ ต้นทุน | [[sys-tms-fleet-maintenance]] |
| ระบบซ่อมบำรุงรถ PM/CM & ต่อภาษี (`maintenance`) | ใบสั่งซ่อม ค่าอะไหล่ ค่าแรง VAT/หัก ณ ที่จ่าย | [[sys-tms-fleet-maintenance]] |
| 4. บันทึกส่งมอบ e-POD · ถ่ายรูปหลายมุม (`dispatch`) | ฟอร์มเลือกจุดส่ง (Stop Code) บันทึกผู้รับ/COD/พิกัด แนบรูปหลายมุม; ปุ่มหัวจอ "ปล่อยเที่ยวรถด่วน" เปิดเที่ยวตัวอย่างพร้อมรูปขึ้นรถ 3 มุม | [[sys-tms-trip-pod-flow]] |
| สายพานเชื่อมโยง 8 ระบบ (`ecosystem`) | แท็บผังเชื่อมโยงของโมดูล มีลิงก์ไป /crm /home /procure /wms /etax /dashboard /ai | - |

## ข้อมูลและตาราง
เมื่อเรียก Overview แบ็กเอนด์สร้างตารางเองด้วย `CREATE TABLE IF NOT EXISTS` (สิทธิ์ `AllowDDL`) ครั้งแรกของแต่ละฐานข้อมูล:
- `tms_fleet_vehicle`: ทะเบียนรถ (รหัสรถ, ทะเบียน, ประเภท, `ownership_type`, ผู้รับเหมา, ค่าเช่าตั้งต้น `base_rate_baht`, `wht_tax_rate`, เลขไมล์ `odometer_km`, ระยะเช็กถัดไป `next_pm_km`, `health_score_pct`, สถานะ, น้ำหนักบรรทุกสูงสุด/ปัจจุบัน, รูปตรวจสภาพ)
- `tms_trip_manifest`: เที่ยวรถ (เลขเที่ยว, เส้นทาง, รถ, จำนวนจุดส่ง/ส่งแล้ว, ระยะทาง, ค่าน้ำมัน ค่าทางด่วน เบี้ยเลี้ยง, ค่าขนส่งรวม, มูลค่าบิลรวม)
- `tms_delivery_stop`: จุดส่งมอบหนึ่งแถวต่อหนึ่งใบงานคลัง (ผูก `wms_doc_no` กับ `erp_inv_doc_no`, ลูกค้า, สินค้า, จำนวน, ยอด COD, ผู้รับ, เวลา/พิกัดส่งมอบ, รูป e-POD)
- `tms_maintenance_log`: ใบสั่งซ่อมบำรุง (ประเภท PM/CM, อู่, เลขไมล์, ค่าอะไหล่/ค่าแรง/VAT/หัก ณ ที่จ่าย, เลขเอกสารค่าใช้จ่าย `erp_expense_doc_no`)
- ตารางที่เขียนข้ามระบบ: `wms_fulfillment_order`, `wms_movement_log`, `wms_stock_bin` (ปิดใบงานคลัง) `crm_customer_activity` (บันทึกกิจกรรมลูกค้า) `etax_document_log` (เอกสารภาษีค่าซ่อม) รายละเอียดที่ [[sys-tms-trip-pod-flow]] และ [[sys-tms-fleet-maintenance]]
- ข้อมูลตัวอย่าง (seed) ใส่ให้เฉพาะฐาน `bcdemo` ฐานอื่นสร้างตารางแล้วเริ่มว่าง

## ตัวเลขสรุปบนหัวจอ (KPI)
Overview ส่ง `kpi` พร้อมรายการรถ เที่ยว จุดส่ง และงานซ่อม:
- จำนวนรถรวม และแยกกลุ่ม: ชื่อประเภทเจ้าของที่มีคำว่า `OWN` นับเป็นรถตัวเอง, มีคำว่า `SUBCONTRACT` นับเป็นรถเหมาช่วง, ที่เหลือนับเป็นรถรับจ้าง/เหมาเที่ยว (`spot_hire_3pl_count`)
- ค่าขนส่งรวม มูลค่าบิลรวม และสัดส่วนค่าขนส่งต่อยอดขาย (`freight_to_sales_pct` = ค่าขนส่ง / มูลค่าบิล x 100 ปัด 2 ตำแหน่ง)
- จำนวนงานซ่อมที่ยังไม่เสร็จ (`maint_status` ไม่ใช่ `COMPLETED_READY`) และค่าซ่อมรวม
- อัตราส่งตรงเวลา (`on_time_rate_pct`) **เป็นค่าคงที่ 98.6 ที่ฝังในโค้ด** ไม่ได้คำนวณจากเวลาส่งจริง จึงไม่ควรใช้อ้างอิงผลงานจริง
- การใช้น้ำหนักบรรทุกของรถ = น้ำหนักปัจจุบัน / น้ำหนักสูงสุด (สูงสุด 100%)

## API และการเชื่อมต่อ
- Next.js proxy: `/api/tms/overview`, `/api/tms/pod`, `/api/tms/trip` (ตรวจ session แล้วเรียก Go ด้วย token; ไม่มี token ตอบ `NO_TOKEN` 401) ดู [[fe-api-proxy-routes]]
- Go (chi) ใต้ `/api/v1/tms` ทุกเส้นอยู่หลัง `Auth`: `GET /overview`, `POST /pod`, `POST /trip` ดูภาพรวมทุกโมดูลที่ [[api-business-modules]]
- เชื่อมกับคลัง: จุดส่ง `tms_delivery_stop` ถูกสร้างจาก checkout ร้านค้าส่ง `/market` พร้อมใบงานคลัง และเมื่อส่งมอบสำเร็จ TMS ปิดใบงานคลังและตัดสต็อกคลังให้ ดู [[sys-wms-fulfillment-pick-pack-ship]], [[flow-order-to-cash]]

## ข้อจำกัดที่ควรรู้
- ตัวเลขเงินและน้ำหนักในแฮนด์เลอร์ใช้ `float64` ไม่ใช่ decimal (หลักการเงินดู [[std-data-integrity-money-transactions]])
- คำสั่ง SQL ประกอบด้วยการจัดรูปแบบข้อความ + `escapeSQL` (ไม่ใช่ parameterized) การเขียนหลายคำสั่งรวมเป็น transaction เดียวด้วย `ExecBatch`
- ค่าตั้งต้นฝังในโค้ดหลายจุด (ข้อมูลรถ จุดส่ง ผู้รับ พิกัด) ใช้เติมเมื่อฟอร์มไม่ได้ส่งค่ามา ควรกรอกค่าจริงเสมอเมื่อใช้งานจริง

## ที่มาในโค้ด
- `frontend/src/app/tms/page.tsx:5-16` หัวหน้าเว็บ redirect ตาม session และวาง `WorkspaceRouteSync`
- `frontend/shared/layout/SystemPortalScreen.tsx:195-210` การ์ด SYS-07; `frontend/shared/layout/Header.tsx:120` ปุ่มหัวระบบ; `frontend/shared/layout/PersistentWorkspaceHost.tsx:559` ติดตั้งจอ `TmsDashboard`
- `backend/internal/adapter/inbound/http/router.go:286-294` เส้นทาง `/api/v1/tms`
- `backend/internal/adapter/inbound/http/tms/handler.go:97-114` โครง KPI; `:272-288` `Overview`; `:1344-1595` `buildOverview` (นับกลุ่มรถ, งานซ่อมค้าง, `OnTimeRatePct = 98.6`)
- `backend/internal/adapter/inbound/http/tms/handler.go:1597-1735` DDL สี่ตารางและเงื่อนไข seed เฉพาะ `bcdemo`
- `frontend/tms/TmsDashboard.tsx:280-290` ชนิดแท็บ; `:353` เรียก `/api/tms/overview`
- ดูเพิ่ม: [[sys-tms-trip-pod-flow]] · [[sys-tms-fleet-maintenance]] · [[sys-wms-overview]] · [[api-business-modules]] · [[backend-overview]] · [[be-multi-tenant]]
