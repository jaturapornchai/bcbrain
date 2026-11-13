---
title: "สเปก Operational & Extension REST APIs (POS, AutoCare, WMS, TMS, e-Tax, CRM, Market, Procure)"
audience: dev
tags: [api, pos, autocare, wms, tms, etax, crm, procure, market]
aliases: ["POS API", "AutoCare API", "WMS API", "TMS API", "e-Tax API", "Procure API", "Market API", "CRM API", "MonitorMap API"]
sources: ["backend/internal/adapter/inbound/http/router.go:258-382", "backend/internal/adapter/inbound/http/pos/handler.go:60-290", "backend/internal/adapter/inbound/http/pos/sync.go:24-175", "backend/internal/adapter/inbound/http/autocare/handler.go:350-2120", "backend/internal/adapter/inbound/http/wms/handler.go:197-735", "backend/internal/adapter/inbound/http/tms/handler.go:272-1080", "backend/internal/adapter/inbound/http/procure/handler.go:298-1255", "backend/internal/adapter/inbound/http/etax/handler.go:190-270", "backend/internal/adapter/inbound/http/market/handler.go:250-650", "backend/internal/adapter/inbound/http/crm/handler.go:276-1140", "backend/internal/adapter/inbound/http/dashboard/handler.go:110-315", "backend/internal/adapter/inbound/http/monitormap/handler.go:420-520"]
---

กลุ่ม Endpoint ปฏิบัติการทั้งหมด mount อยู่ใต้ `/api/v1/<module>/*` (`router.go:258-382`) รองรับทั้ง Web App, Mobile App, และเครื่อง POS หน้าร้าน หลาย Endpoint รองรับทั้ง `application/json` และ `multipart/form-data` (แนบรูปหลักฐานเก็บลง MinIO)

---

## 1. POS System (`/api/v1/pos/*`, `pos/handler.go`, `pos/sync.go`, `pos/media.go`)

ระบบ POS ใช้ Middleware `Pos.Auth` แยก 2 โหมดชัดเจน:

### โหมดเครื่อง POS (`DeviceOnly` — ใช้ POS Device Bearer Token)
- `GET /api/v1/pos/sync` (บีบอัด gzip ระดับ 5): ดึง Master Delta Sync (`pos_sync_change` ผ่าน `xid8` cursor) ระบุ `cursor`, `limit`, `pending_bills`, `app_version`
- `GET /api/v1/pos/restore` (gzip ระดับ 5): โหลดข้อมูล Full Baseline Restore สำหรับเครื่องใหม่/ล้างแคช
- `POST /api/v1/pos/bills`: ส่งบิลขายจากหน้าร้านเข้า `pos_bill_inbox` แบบ Idempotent ด้วย `bill_guid` พร้อมคิวตัดสต็อกอัตโนมัติ (`pos_stock_queue`)
- `POST /api/v1/pos/media`: อัปโหลดรูปภาพสินค้า/แคมเปญจากเครื่อง POS

### โหมด Backoffice & ร่วม (`UserOnly` / Shared)
- `POST /api/v1/pos/shift` (Shared): เปิด/ปิดกะแคชเชียร์ (`pos_period`, `poscashiersettle`)
- `GET /api/v1/pos/image` (Shared): ดึงรูปสินค้าจาก MinIO หรือ fallback รูปมาตรฐาน (พร้อม thumbnail)
- `GET /api/v1/pos/bootstrap` (`UserOnly`): โหลดค่า `posconfig`, `pos_id`, โปรโมชั่น, แคมเปญสลิป, คะแนน และรายการกะขาย
- `POST /api/v1/pos/config` (`UserOnly`): บันทึกการตั้งค่า POS (ระบุ `section`)
- `GET /api/v1/pos/devices` (`UserOnly`): ดูสถานะเครื่อง POS ที่จับคู่แล้ว, cursor ล่าสุด และจำนวนบิลค้าง
- `POST /api/v1/pos/devices/{machine}/pair` (`UserOnly`): จับคู่เครื่อง POS ใหม่และออก Device Token
- `POST /api/v1/pos/bills/reprocess` (`UserOnly`): ประมวลผลบิลใน `pos_bill_inbox` ที่ตกค้างหรือผิดพลาดซ้ำ

---

## 2. AutoCare ศูนย์บริการรถยนต์/ยาง (`/api/v1/autocare/*`, `autocare/handler.go`)

- `GET /api/v1/autocare/overview`: โหลด KPI, รถ (`autocare_vehicle`), ช่องซ่อม (`autocare_service_bay`), ช่าง (`autocare_technician_wallet`), สต็อกยาง DOT (`autocare_tire_dot_stock`), คิวงานซ่อม (`autocare_job_order`), Tire Hotel, เคลมประกัน, Blind Receiving และคูปอง
- `POST /api/v1/autocare/action` — ส่ง JSON `{ "action": "<case>", ... }` ครอบคลุม 28 actions หลัก:
  - **คิวซ่อม & หน้างาน**: `create_intake_job`, `save_dvi_upsell`, `approve_lineoa_upsell`, `add_job_item`, `advance_job_stage` (สถานะ `INTAKE_PRECHECK` -> `ESTIMATE_PENDING` -> `IN_BAY_REPAIR` -> `QC_READY` -> `BILLED_POSTED`)
  - **ส่วนลด & ปิดบิลเข้าบัญชี BC**: `request_owner_discount`, `approve_owner_discount`, `close_bill_post_account` (รองรับชำระ `CASH`, `CREDIT_CARD`, `PROMPTPAY_QR`, `BANK_TRANSFER` และลง `ic_trans` + GL อัตโนมัติ)
  - **รับของปิดบังต้นทุน & ประกัน**: `create_blind_receiving`, `post_blind_receiving_account`, `advance_warranty_claim`, `use_member_coupon`, `check_in_tire_hotel`, `rebuild_autocare_results`
  - **CRUD ข้อมูลหลัก**: `save_vehicle`/`delete_vehicle`, `save_catalog_item`/`delete_catalog_item`, `save_bay`/`delete_bay`, `save_job_order`/`delete_job_order`, `delete_job_item`, `delete_blind_receiving`, `delete_tire_hotel`, `save_member_coupon`/`delete_member_coupon`, `save_warranty_claim`/`delete_warranty_claim`

---

## 3. WMS, TMS, Procure, Market, e-Tax, CRM, Dashboard, MonitorMap

| โมดูล | Endpoints & Content-Type | Actions / Statuses ที่รองรับ |
| :--- | :--- | :--- |
| **WMS** (`/api/v1/wms/*`) | `GET /overview`<br>`POST /fulfillment` (JSON/Multipart)<br>`POST /movement` (JSON/Multipart) | **Fulfillment Stages**: `WAITING_PICK` -> `PICKING` -> `PACKED` -> `SHIPPED` (เชื่อมอัปเดต `market_b2b_order` & `tms_delivery_stop`)<br>**Movement Types**: `INBOUND_PUTAWAY`, `BIN_TRANSFER`, `CYCLE_COUNT`, `ADJUST` พร้อมแนบรูป MinIO |
| **TMS** (`/api/v1/tms/*`) | `GET /overview`<br>`POST /pod` (JSON/Multipart)<br>`POST /trip` (JSON/Multipart) | **POD Status**: `PENDING_LOAD` -> `IN_TRANSIT` -> `ARRIVED` -> `DELIVERED_POD` พร้อมพิกัด GPS & ยอด COD<br>**Trip/Fleet Actions**: จัดเที่ยววิ่ง, `ADD_VEHICLE`, `CREATE_MAINTENANCE`, `COMPLETE_MAINTENANCE` |
| **Procure** (`/api/v1/procure/*`) | `GET /overview`<br>`POST /order` (JSON/Multipart) | **RFQ & Cart**: `ADD_TO_CART`, `UPDATE_CART_QTY`, `REMOVE_CART_ITEM`, `SEND_CART_TO_RFQ`, `CONSOLIDATE_CART_TO_RFQ`, `NEGOTIATE_RFQ_ROUND`, `CLOSE_RFQ_TO_PO`<br>**PO Stages & 3-Way Match**: `DRAFT_PR` -> `APPROVED_PO` -> `GRN_RECEIVED_WMS` -> `MATCHED_3WAY_AP` |
| **Market B2B** (`/api/v1/market/*`) | `GET /overview?q=...&group=...`<br>`POST /order` (JSON) | **Cart & Orders**: `ADD_TO_CART`, `UPDATE_CART_QTY`, `REMOVE_CART_ITEM`, `CLEAR_CART`, `PLACE_B2B_ORDER`, `ADVANCE_ORDER_STATUS` (`PENDING_CONFIRM`, `WMS_PACKING`), `REORDER_TO_CART`<br>**Vouchers**: `VIP3000`, `YIPUA1500`, `DEALER500` |
| **e-Tax & e-WHT** (`/api/v1/etax/*`) | `GET /overview`<br>`POST /document` (JSON/Multipart) | ส่ง/ประทับเวลา XML ETDA (`etda_timestamp_token`), OCR ตรวจสอบความมั่นใจ และตรวจสอบสลิป พร้อมฟิลด์เชื่อม `erp_ref_doc_no`, `wms_ref_doc_no`, `tms_ref_trip_no`, `procure_ref_po_no` |
| **CRM** (`/api/v1/crm/*`) | `GET /overview`, `GET /image`<br>`GET/POST /activities`, `POST /upload`<br>`POST /action` (JSON) | **CRM Actions**: `CREATE_DEAL`, `ADVANCE_DEAL_STAGE` (`lead` -> `qt` -> `so` -> `won`), `LOG_PROMISE_TO_PAY`, `SEND_DUNNING_LINE`, `VERIFY_WHT_CERT`, `SEND_OMNI_REPLY`, `CONVERT_CHAT_TO_DEAL`, `LAUNCH_CAMPAIGN`, `BROADCAST_CAMPAIGN` |
| **Dashboard** (`/api/v1/dashboard/*`) | `GET /overview` | KPI รวมกิจการ, กราฟรายได้/ค่าใช้จ่าย, Donut, Top Sellers, Risk Radar และ Document Pipeline |
| **MonitorMap** (`/api/v1/monitormap/*`) | `GET /tile` (Public tile loader)<br>`POST /tile` (JWT Prewarm) | บริการแผนที่ 3 Layer (`sat`, `trans`, `places`) พร้อมแคช 3 ชั้น (RAM -> Disk -> PG `monitormap_tile_cache`) |
