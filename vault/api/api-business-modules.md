---
title: "API โมดูลธุรกิจ /api/v1/{dashboard,crm,ai,wms,tms,procure,etax,market,autocare} (Business module endpoints)"
tags: [api, business-modules]
aliases: ["/api/v1/dashboard/overview","/api/v1/crm/overview","/api/v1/crm/activities","/api/v1/crm/upload","/api/v1/crm/image","/api/v1/ai/chat","/api/v1/ai/context","/api/v1/wms/fulfillment","/api/v1/wms/movement","/api/v1/tms/pod","/api/v1/tms/trip","/api/v1/procure/order","/api/v1/etax/document","/api/v1/market/order","/api/v1/autocare/action","action_type","next_stage","STAMP_ETDA","PLACE_B2B_ORDER"]
sources: ["backend/internal/adapter/inbound/http/router.go:250","backend/internal/adapter/inbound/http/router.go:326","backend/internal/adapter/inbound/http/dashboard/handler.go:110","backend/internal/adapter/inbound/http/crm/handler.go:155","backend/internal/adapter/inbound/http/ai/handler.go:409","backend/internal/adapter/inbound/http/wms/handler.go:217","backend/internal/adapter/inbound/http/tms/handler.go:290","backend/internal/adapter/inbound/http/procure/handler.go:318","backend/internal/adapter/inbound/http/etax/handler.go:168","backend/internal/adapter/inbound/http/market/handler.go:275","backend/internal/adapter/inbound/http/autocare/handler.go:973"]
---

# API โมดูลธุรกิจ (dashboard, crm, ai, wms, tms, procure, etax, market, autocare)

กลุ่ม endpoint ที่ลงทะเบียนเป็น `r.Route("/api/v1/<module>")` ใน `router.go:250-326` ทุกกลุ่มผ่าน `appmiddleware.Auth(accessTokenVerifier)` ตัวเดียว. Handler ดึงบริษัทจาก claims ใน JWT เท่านั้น ไม่รับ `db`/`provider` จาก body (ตัวอย่าง `middleware.ClaimsFromContext` ใน `wms/handler.go:218`). ส่วน POS (`/api/v1/pos`) แยกอยู่ใน [[api-pos]] และภาพรวมการเรียกอยู่ใน [[api-overview]].

## พฤติกรรมร่วมของทุกโมดูล

| หัวข้อ | รายละเอียด | ที่มา |
|---|---|---|
| Auth | Header `Authorization: Bearer <token>` (access token หลังเลือกบริษัท) ไม่มี token = 401 จาก middleware; ถ้า claims หายใน handler ตอบ `KindUnauthorized` (401) | router.go:250-326, wms/handler.go:218-221 |
| รูปแบบ error | `{"error":{"message":"..."}}` — Validation=400, Unauthorized=401, Forbidden=403, NotFound=404, Conflict=409, อื่น ๆ=500 (ข้อความทั่วไป ไม่เปิดเผยรายละเอียด) | response/response.go:49-79 |
| รูปแบบ success | Go คืน JSON ดิบของ struct/map ตรง ๆ (ไม่หุ้ม `{ok,data}`) ส่วนชั้น Next BFF หุ้มเป็น `{ok:true,data}` ด้วย `ok()` และ error เป็น `{ok:false,error,code}` ด้วย `fail()` | response/response.go, frontend/src/lib/api-server.ts:34-51 |
| สร้างตารางตอนเรียก | ทุกโมดูลรัน `CREATE TABLE IF NOT EXISTS` ที่คำขอแรกของแต่ละบริษัท (เช่น `ensureWmsSeeded` ใน wms/handler.go:204, `EnsureSeeded` ใน crm/handler.go:839) | แต่ละ handler |
| ข้อมูลตัวอย่าง | โมดูล crm/wms/tms/procure/etax/market ใส่แถว seed เฉพาะฐานข้อมูล demo (เงื่อนไข `dbKey != "<demo>"` ข้ามไป: crm:993, wms:1298, tms:1732, procure:1902, etax:639, market:1362); autocare ใส่ให้ทุกบริษัทด้วย `ON CONFLICT DO NOTHING` (autocare/seed.go:14) | แต่ละ handler |
| Content-Type ของ POST | wms/tms/procure/etax รับได้ทั้ง `application/json` และ `multipart/form-data` (แนบรูปหลักฐาน); market/autocare รับ JSON อย่างเดียว; crm/activities รับทั้งสองแบบ | แต่ละ handler |
| รูปหลักฐาน | multipart field `photos`/`photo` (wms) เก็บใน MinIO พร้อม thumbnail, DB เก็บแค่ key/URL; ส่ง `generate_sample_photo=true` + `sample_photo_count` เพื่อให้ระบบสร้างภาพตัวอย่างแทนไฟล์จริง | wms/handler.go:239-293 |
| ขีดจำกัดขนาด | multipart ที่ wms/tms/procure/etax ใช้ `ParseMultipartForm(32<<20)`; crm ใช้ `MaxBytesReader 12MB` + `ParseMultipartForm(10<<20)`; autocare action `MaxBytesReader 2MB`; timeout รวม 60 วินาที (router.go:64) | แต่ละ handler |
| ชนิดเงิน/จำนวน | ฟิลด์เงิน/จำนวนใน JSON เป็น `float64` (`order_qty`, `unit_price`, `base_amount`, `cod_amount`, `weight_kg`) — ขัดกฎ ACCOUNTING NUMBER (ดู [[std-data-integrity-money-transactions]]) | procure/handler.go:413-414, etax/handler.go:257-259 |

Caller ฝั่งหน้าเว็บ: ทุกกลุ่มมี Next route คู่กันใน `frontend/src/app/api/<module>/<name>/route.ts` ที่ตรวจ session (`requireSession`), ดึง token (`getValidAccessToken`) แล้วส่งต่อไป Go; ไม่มี token ตอบ 401 รหัส `NO_TOKEN` (ตัวอย่าง `wms/fulfillment/route.ts`). ดูตารางรวมที่ [[fe-api-proxy-routes]].

## 1. Dashboard — GET /api/v1/dashboard/overview

- Handler: `dashboard/handler.go:110` (`Overview`). ไม่มี body/parameter.
- ทำงาน: ยิง SQL 7 คำสั่งเป็น batch เดียวผ่าน `batchUseCase.Batch` (อ่านอย่างเดียว) จากตาราง `ic_trans`, `ic_inventory`, `ar_customer`, `ap_supplier`, `ap_ar_trans`, `cb_trans`, `cb_chq_list`.
- Response 200 (`OverviewResponse`, handler.go:99-107): `kpi` (`total_sales`, `sales_doc_count`, `total_purchase`, `purchase_doc_count`, `total_inventory_val`, `item_count`, `ar_outstanding`, `ar_count`, `ap_outstanding`, `ap_count`, `cash_flow_val`, `chq_total_val`), `dailyPoints[]` (`label`,`primary`,`secondary`), `donutSlices[]`, `topItems[]`, `riskRows[]`, `recentDocs[]`, `pipeline[]`.
- Errors: 401 (ไม่มี claims), 500 (batch ล้มเหลว).
- Caller: `frontend/dashboard/ExecutiveDashboard.tsx:184` ผ่าน `/api/dashboard/overview`.
- ตัวอย่าง: `GET /api/v1/dashboard/overview` + `Authorization: Bearer <token>`
- ข้อสังเกต: ยอด "ซื้อ" นับ `trans_flag IN (12, 32)` (handler.go:122-123,137) แต่คำอธิบาย trans_flag ใน MCP guide ระบุ 32 เป็นใบสั่งขาย (SO) — ควรตรวจกับ [[api-mcp]] และ doctype ที่เกี่ยวข้องก่อนใช้ตัวเลขนี้เป็นยอดซื้อ.

## 2. CRM — /api/v1/crm/*

| method path | handler | request | response | caller |
|---|---|---|---|---|
| GET `/overview` | `Overview` crm/handler.go:155 | ไม่มี | `OverviewResponse` (crm/handler.go:144): `kpi`, `dailyPipeline[]`, `customers[]`, `deals[]`, `dealItems[]`, `salesReps[]`, `activities[]` | `frontend/crm/CrmDashboard.tsx:347` |
| GET `/activities` | `ListActivities` :426 | ไม่มี | อาร์เรย์ `ActivityLogRow` (รันสร้างตาราง/seed ก่อนอ่าน) | Next route `crm/activities` |
| POST `/activities` | `CreateActivity` :442 | JSON หรือ multipart: `cust_code`, `cust_name`, `channel`, `subject`, `note` (หรือ `note_text` ใน multipart), `contact_person`, `contact_result`, `next_followup_date`, `by`, ไฟล์ `file`/`image` | `ActivityLogRow` ที่เพิ่ม (มี `image_url`, `image_thumb_url`) | `CrmDashboard.tsx:730` |
| POST `/upload` | `UploadImage` :649 | multipart ไฟล์ `file` หรือ `image` | `{ok,image_key,image_thumb_key,image_url,image_thumb_url}` | `frontend/account/master/ItemScreen.tsx:1191,1293` |
| GET `/image?key=<key>&variant=thumbnail` | `ServeImage` :605 | query `key` (ต้องขึ้นต้นด้วยชื่อฐานข้อมูลของ token), `variant` | ไบต์รูป + `Cache-Control: private, max-age=86400` | ใช้จากหน้า CRM/สินค้า ผ่าน `/api/crm/image` |

กติกา/ขีดจำกัด:
- multipart: `MaxBytesReader` 12 MB และ `ParseMultipartForm` 10 MB (handler.go:465-466, 656-657); รูปที่รับตรวจโดย `uploadActivityImageToMinIO` (ผิดชนิด/พัง = 400).
- `POST /activities`: ถ้าไม่ระบุ `note` = 400 (ข้อความไทย "กรุณาระบุรายละเอียดการพูดคุย..." handler.go:530); ฟิลด์ `cust_code`/`channel`/`subject` ว่างจะถูกแทนด้วยค่าเริ่มต้นฝังในโค้ด (handler.go:522-529).
- `GET /image`: key ที่มี `..` หรือไม่ขึ้นต้นด้วย `<ชื่อฐานข้อมูล>/` = 404 `image not found`; ถ้าอ่านจาก MinIO ไม่ได้จะตอบรูปแทน (placeholder PNG) แต่ไม่เขียนทับของจริง (handler.go:612-640). วัตถุประสงค์: ใช้เป็นปลายทางของ URL ที่ [[api-blob]] เก็บในคอลัมน์รูป.
- ตาราง: `crm_customer_activity` (เขียนผ่าน `insertUseCase` ของ blob, handler.go:567), `monitormap_*` (สร้างพร้อมกัน handler.go:843).

ตัวอย่าง:

```
POST /api/v1/crm/activities   Authorization: Bearer <token>   Content-Type: application/json
{"cust_code":"<custCode>","subject":"<subject>","note":"<note>","by":"<userName>"}
```

## 3. AI — /api/v1/ai/*

| method path | handler | request | response | caller |
|---|---|---|---|---|
| GET `/context` | `Context` ai/handler.go:83 | ไม่มี | `ContextResponse` (handler.go:70): `kpi{totalSales,salesCount,totalStockVal,itemCount,customerCount,supplierCount}`, `summaryText`, `latestModel`, `latestFlash`, `latestPro`, `latestReasoner`, `runtimeModel`, `availableModels[]` | `frontend/ai/AiChatWorkspace.tsx:592` |
| POST `/chat` | `Chat` :409 | `ChatRequest` (handler.go:396): `messages[{role,content}]`, `model`, `outputMode`, `roomTitle`, `roomPrompt`, `dbContextSummary`, `attachments[{name,kind,mimeType,sizeKB,width,height,colorSummary,extractedText}]` | `{content,reasoning,model,requestedModel,latestChatModel,latestFlash,latestPro,latestReasoner,availableModels,usage}` (handler.go:637-648) | `AiChatWorkspace.tsx:861` |

กติกา:
- `/chat` ส่งต่อไปยังผู้ให้บริการ DeepSeek (chat completions) ด้วยคีย์จาก env `DEEPSEEK_API_KEY`; ไม่มีคีย์ = 500 (ข้อความไทยบอกให้ตั้งค่า, handler.go:418). `max_tokens` 6000 (handler.go:573), timeout ของ HTTP client 55 วินาที (handler.go:52).
- เลือกโมเดล: `model` ว่าง/`auto`/`latest`/`flash` -> flash; `pro`/`deepseek-chat` -> pro; `reasoner` -> reasoner; ชื่ออื่นต้องตรงรายการ `availableModels` (handler.go:430-448).
- ตัดข้อความ: เก็บ 20 ข้อความล่าสุดเฉพาะ role `user`/`assistant`, ตัดแต่ละข้อความที่ 16,000 ไบต์ (handler.go:455-466); ไม่มีข้อความที่ใช้ได้ = 400.
- `outputMode` เริ่มต้น `pdf` (handler.go:451). เมื่อ DeepSeek ตอบไม่ใช่ 2xx = 400 (handler.go:612-619).
- `GET /context` สร้าง KPI จากฐานของ token ด้วย `buildDbContext` (handler.go:111) ส่วน `dbContextSummary` ใน `/chat` เป็นข้อความที่ฝั่งหน้าเว็บส่งมาเอง.

ตัวอย่าง:

```
POST /api/v1/ai/chat   Authorization: Bearer <token>
{"messages":[{"role":"user","content":"<question>"}],"model":"auto","outputMode":"pdf"}
```

## 4. WMS (คลังสินค้า) — /api/v1/wms/*

| method path | handler | request | response | caller |
|---|---|---|---|---|
| GET `/overview` | `Overview` wms/handler.go:197 | ไม่มี | `OverviewResponse` (handler.go:182): `kpi`, `stock_ledger[]`, `fulfillment_orders[]`, `zones[]`, `movements[]` | `frontend/wms/WmsDashboard.tsx:429` |
| POST `/fulfillment` | `AdvanceFulfillment` :217 | JSON/multipart: `wms_doc_no` (บังคับ), `next_stage`, `picker_name`, `carrier_name`, `tracking_no`, `box_count`, `weight_kg`, `remark`, `generate_sample_photo`, `sample_photo_count`, รูป `photos`/`photo`, `photo_labels` | `OverviewResponse` ใหม่ (handler.go:528) | `WmsDashboard.tsx:588,656` |
| POST `/movement` | `CreateMovement` :534 | JSON/multipart: `move_type`, `ref_erp_doc`, `ic_code` (บังคับ), `from_bin`, `to_bin`, `qty`, `staff_name`, `note_text`, `generate_sample_photo`, `sample_photo_count`, รูป | `OverviewResponse` ใหม่ (handler.go:836) | `WmsDashboard.tsx:694` |

กติกา:
- สถานะใบงาน: `WAITING_PICK` -> `PICKING` -> `PACKED` -> `SHIPPED` (เมื่อไม่ส่ง `next_stage` ระบบเลือกขั้นถัดไปเอง handler.go:328-340); ตัดสต็อกกายภาพเมื่อถึง `SHIPPED` (ดูคอมเมนต์ handler.go:216).
- `move_type`: `INBOUND_PUTAWAY` (ค่าเริ่มต้น), `BIN_TRANSFER`, `CYCLE_COUNT`/`ADJUST` (switch handler.go:673-740; CYCLE_COUNT/ADJUST ตั้งหรือบวกยอดตาม `qty`).
- Errors: ไม่ระบุ `wms_doc_no` = 400 ("กรุณาระบุเลขที่ใบงานคลัง" :310); ไม่พบใบงาน = 404 (:319); ไม่ระบุ `ic_code` = 400 (:627); multipart ผิดรูป/JSON ผิดรูป = 400.
- ตาราง: `wms_fulfillment_order`, `wms_stock_bin`, `wms_movement_log`, `wms_evidence`. `buildOverview` รัน SQL สร้างยอดยกมา/ประกอบยอดถังเก็บใหม่ (`WmsBinOpeningSQL`/`WmsBinRebuildSQL`) ผ่าน `ExecBatch` ทุกครั้งที่เรียก overview (handler.go:842-850).

ตัวอย่าง:

```
POST /api/v1/wms/fulfillment   Authorization: Bearer <token>   Content-Type: application/json
{"wms_doc_no":"<wmsDocNo>","next_stage":"PICKING","picker_name":"<pickerName>"}
```

## 5. TMS (ขนส่ง) — /api/v1/tms/*

| method path | handler | request | response | caller |
|---|---|---|---|---|
| GET `/overview` | `Overview` tms/handler.go:272 | ไม่มี | `kpi`, `vehicles[]`, `trips[]`, `stops[]`, `maintenances[]` | `frontend/tms/TmsDashboard.tsx:353` |
| POST `/pod` | `UpdateDeliveryPod` :290 | JSON/multipart: `stop_code` (บังคับ), `next_status`, `receiver_name`, `receiver_role`, `cod_amount`, `pod_note`, `gps_coords`, `generate_sample_photo`, `sample_photo_count`, `photo_labels`, รูป | overview ใหม่ (handler.go:614) | `TmsDashboard.tsx:379,427` |
| POST `/trip` | `CreateTripDispatch` :623 | JSON/multipart ตัวแปรหลัก: `action_type`, `route_name`, `vehicle_code`, `plate_no`, `vehicle_type`, `ownership_type`, `contractor_name`, `cost_model`, `base_rate_baht`, `wht_tax_rate`, `driver_name`, `driver_phone`, `odometer_km`, `next_pm_km`, `maint_doc_no`, `maint_type`, `service_title`, `workshop_vendor`, `parts_cost`, `labor_cost`, `wms_doc_no` | overview ใหม่ (handler.go:943,1067,1166,1341) | `TmsDashboard.tsx:452,499,539,571` |

กติกา:
- `/pod` สถานะจุดส่ง: `PENDING_LOAD` -> `IN_TRANSIT` -> `DELIVERED_POD` (ค่าเริ่มต้นเมื่อไม่ส่ง `next_status` handler.go:403-410; มี `ARRIVED` ในสวิตช์ :2089). ไม่ระบุ `stop_code` = 400 `stop_code is required`; ไม่พบจุดส่ง = 404 `delivery stop not found`.
- `/trip` สวิตช์ `action_type` (handler.go:833): `ADD_VEHICLE`, `CREATE_MAINTENANCE`, `COMPLETE_MAINTENANCE`; **ค่าอื่นหรือว่างตกลงไปทางสร้างทริป/ปล่อยรถ** (โค้ดสร้าง `TRIP-...`/`STOP-...` ที่ handler.go:1285) ไม่ตอบ error.
- ค่าเงิน (`base_rate_baht`, `wht_tax_rate`, `parts_cost`, `labor_cost`, `cod_amount`) เป็น float64.

ตัวอย่าง:

```
POST /api/v1/tms/trip   Authorization: Bearer <token>
{"action_type":"ADD_VEHICLE","vehicle_code":"<vehicleCode>","plate_no":"<plateNo>","driver_name":"<driverName>"}
```

## 6. Procure (จัดซื้อ) — /api/v1/procure/*

| method path | handler | request | response | caller |
|---|---|---|---|---|
| GET `/overview` | `Overview` procure/handler.go:298 | ไม่มี | `kpi`, `cart_items[]`, `rfq_inquiries[]`, `replenishments[]`, `purchase_orders[]`, `supplier_matrix[]` | `frontend/procure/ProcureDashboard.tsx:363` |
| POST `/order` | `AdvanceOrCreateOrder` :318 | JSON/multipart: `action_type`, `po_doc_no`, `cart_item_no`, `rfq_doc_no`, `next_stage`, `ap_code`, `ap_name`, `ic_code`, `ic_name`, `unit_code`, `target_bin`, `order_qty`, `unit_price`, `wms_grn_doc_no`, `ap_tax_inv_no`, `buyer_name`, `remark`, `generate_sample_photo`, `sample_photo_count` | overview ใหม่ | `ProcureDashboard.tsx:396-682` (หลายปุ่ม) |

`action_type` (switch procure/handler.go:452): `ADD_TO_CART`, `UPDATE_CART_QTY`, `REMOVE_CART_ITEM`, `SEND_CART_TO_RFQ`, `CONSOLIDATE_CART_TO_RFQ`, `NEGOTIATE_RFQ_ROUND`, `CLOSE_RFQ_TO_PO`; ถ้าเป็น `CREATE_PO` หรือไม่มี `po_doc_no` จะสร้าง PO มาตรฐาน (handler.go:1116) ไม่เช่นนั้นเลื่อนสถานะ PO.

- สถานะ PO: `DRAFT_PR` -> `APPROVED_PO` -> `GRN_RECEIVED_WMS` -> `MATCHED_3WAY_AP` (handler.go:1243-1255).
- เมื่อถึง `GRN_RECEIVED_WMS`/`MATCHED_3WAY_AP` ระบบเขียนข้ามโมดูลในธุรกรรมเดียว: เอกสาร `ic_trans`/`ic_trans_detail`, การเคลื่อนไหว WMS (`wms_movement_log`/`wms_stock_bin`) และแถวภาษีซื้อใน `etax_document_log` (handler.go:1355-1440).
- Errors: `rfq_doc_no` ว่างใน NEGOTIATE/CLOSE = 400 `rfq_doc_no is required`; ไม่พบ RFQ = 404 `RFQ document not found`; ไม่พบ PO = 404 `purchase order not found` (handler.go:1238).

ตัวอย่าง:

```
POST /api/v1/procure/order   Authorization: Bearer <token>
{"action_type":"CLOSE_RFQ_TO_PO","rfq_doc_no":"<rfqDocNo>"}
```

## 7. e-Tax — /api/v1/etax/*

| method path | handler | request | response | caller |
|---|---|---|---|---|
| GET `/overview` | `Overview` etax/handler.go:150 | ไม่มี | `kpi`, `documents[]` | `frontend/etax/EtaxDashboard.tsx:212` |
| POST `/document` | `CreateOrStampDocument` :168 | JSON/multipart: `action_type`, `etax_doc_no`, `doc_type`, `erp_ref_doc_no`, `wms_ref_doc_no`, `tms_ref_trip_no`, `procure_ref_po_no`, `party_code`, `party_name`, `party_tax_id`, `branch_code`, `base_amount`, `vat_rate`, `wht_rate`, `remark`, `generate_sample_photo`, `sample_photo_count`, รูป | overview ใหม่ | `EtaxDashboard.tsx:237,293,332` |

- `action_type = STAMP_ETDA` + `etax_doc_no` = ประทับเวลาเอกสารเดิม (handler.go:287-): สร้างโทเค็นขึ้นต้น `ETDA-TS-` ด้วยโค้ดเอง (`docno.Stamp`, handler.go:337) แล้วอัปเดต `etda_status = TIMESTAMP_VERIFIED` — **เป็นการจำลองในระบบ ไม่ได้ส่งไปยังผู้ให้บริการประทับเวลาจริง**; ถ้าไม่ใช่ STAMP จะสร้างเอกสารใหม่ลง `etax_document_log` พร้อมโทเค็นแบบเดียวกัน (handler.go:432-456).
- คำนวณยอดด้วย `etaxAmounts` (handler.go:1016) จาก `base_amount`, `vat_rate`, `wht_rate` (float64).
- ค่าเริ่มต้นของคู่ค้า/เลขผู้เสียภาษีฝังในโค้ดเมื่อไม่ส่งมา (ไม่คัดลอกค่าจริงมาไว้ที่นี่).

ตัวอย่าง:

```
POST /api/v1/etax/document   Authorization: Bearer <token>
{"action_type":"STAMP_ETDA","etax_doc_no":"<etaxDocNo>"}
```

## 8. Market (ตลาดค้าส่ง B2B) — /api/v1/market/*

| method path | handler | request | response | caller |
|---|---|---|---|---|
| GET `/overview` | `Overview` market/handler.go:248 | query ตัวกรองตามที่หน้าส่ง (`${qs}`) | `kpi`, `products[]`, `sub_dealers[]`, `cart_items[]`, `orders[]` | `frontend/market/MarketDashboard.tsx:456` |
| POST `/order` | `CartOrOrderAction` :275 | JSON เท่านั้น: `action_type`, `cart_id`, `sku_code`, `order_qty`, `dealer_code`, `order_type`, `voucher_code`, `delivery_address`, `remark`, `order_no` | overview ใหม่ (handler.go:802) | `MarketDashboard.tsx:866,899`; ยังถูกเรียกจาก Next `lineoa` (CREATE_LINE_ORDER) |

- `action_type` (switch market/handler.go:304): `ADD_TO_CART`, `UPDATE_CART_QTY`, `REMOVE_CART_ITEM`, `CLEAR_CART`, `ADVANCE_ORDER_STATUS`, `REORDER_TO_CART`, `PLACE_B2B_ORDER` (:550); **ไม่มี `default`** — action ที่ไม่รู้จักไม่ error แต่คืน overview ปกติ.
- สถานะออเดอร์ `market_b2b_order.order_status`: `PENDING_CONFIRM` -> `WMS_PACKING` -> `TMS_IN_TRANSIT` -> `DELIVERED_COMPLETED` (handler.go:511-545).
- `PLACE_B2B_ORDER` เขียนซิงก์ไป ERP/WMS/TMS/CRM/e-Tax ในคำขอเดียว (คอมเมนต์ handler.go:273); รหัสตัวแทน/ประเภทออเดอร์ว่างจะถูกแทนด้วยค่าเริ่มต้นในโค้ด.
- ตาราง: `market_product_catalog`, `market_subdealer_profile`, `market_cart_item`, `market_b2b_order`.

ตัวอย่าง:

```
POST /api/v1/market/order   Authorization: Bearer <token>
{"action_type":"ADD_TO_CART","sku_code":"<skuCode>","order_qty":2}
```

## 9. AutoCare (อู่/ศูนย์บริการรถ) — /api/v1/autocare/*

| method path | handler | request | response | caller |
|---|---|---|---|---|
| GET `/overview?q=<keyword>&mode=<ALL|mode>` | `Overview` autocare/handler.go:350 | query `q` (ค้นทะเบียน/ชื่อ/เบอร์), `mode` | `{success, cost_masked, database, user, kpi, vehicles, catalog, bays, tech_wallets, jobs, tire_hotel, warranty_claims, blind_receivings, member_coupons}` (handler.go:870-) | `frontend/autocare/AutoCareWorkspace.tsx:161` |
| POST `/action` | `Action` :973 | JSON `autoCareActionRequest` (`MaxBytesReader` 2 MB): `action` + ฟิลด์ตามคำสั่ง (`job_no`, `business_mode`, `stage`, `plate_no`, `brand`, `model`, `cust_code`, `cust_name`, `bay_code`, `tech_code`, `item_code`, `qty`, `unit_price`, `payment_method`, `turn_in_discount`, `special_discount_amount`, `supplier_code`, ...) | `{success:true, job_no, message}` หรือผลสรุปตามคำสั่ง | `AutoCareWorkspace.tsx:220` |

`action` (ตัวพิมพ์เล็ก, switch autocare/handler.go:990-2076; ไม่รู้จัก = 400 `ไม่รู้จักคำสั่ง action`):

| กลุ่ม | action |
|---|---|
| ใบงาน | `create_intake_job`, `save_job_order`, `delete_job_order`, `add_job_item`, `delete_job_item`, `advance_job_stage`, `save_dvi_upsell`, `approve_lineoa_upsell` |
| ส่วนลด/ปิดบิล | `request_owner_discount`, `approve_owner_discount`, `close_bill_post_account`, `use_member_coupon` |
| รับของ/ยาง/รับประกัน | `create_blind_receiving`, `delete_blind_receiving`, `check_in_tire_hotel`, `delete_tire_hotel`, `save_warranty_claim`, `advance_warranty_claim`, `delete_warranty_claim` |
| ข้อมูลหลัก | `save_vehicle`, `delete_vehicle`, `save_catalog_item`, `delete_catalog_item`, `save_bay`, `delete_bay`, `save_member_coupon`, `delete_member_coupon` |
| ประมวลผลใหม่ | `rebuild_autocare_results` (คำนวณยอดใบงาน ช่องบริการ กระเป๋าช่าง อายุสต็อก และใบแจ้งหนี้ใหม่จากข้อมูลดิบ — `rebuildFromRawData` handler.go:2082) |

- `close_bill_post_account` เรียก `postJobToBCAccount` (handler.go:2262) เพื่อสร้างเอกสารขาย/ลงบัญชีฝั่ง BC Account; ผูกกับ [[api-proc-actions-transaction]] ในแง่ผลลัพธ์เอกสาร.
- Overview ตอบ `cost_masked: true` เป็นค่าคงที่ (handler.go:872).

ตัวอย่าง:

```
POST /api/v1/autocare/action   Authorization: Bearer <token>
{"action":"create_intake_job","plate_no":"<plateNo>","cust_name":"<custName>","service_title":"<service>"}
```

## ข้อสังเกตและความไม่สอดคล้องที่พบ (ไม่ได้แก้โค้ด)

1. **เงินเป็น float64** ทั้ง request และ SQL (ขัดกฎ ACCOUNTING NUMBER).
2. **action ไม่รู้จักไม่ error** ใน market (ไม่มี default) และ tms/trip (ตกไปสร้างทริป).
3. **e-Tax ประทับเวลาเป็นการจำลอง** (โทเค็นสร้างในโค้ด) — อย่าใช้เป็นหลักฐานการยื่นจริง.
4. **ค่าเริ่มต้นฝังในโค้ด** (ลูกค้า/คู่ค้า/สินค้า/ชื่อพนักงานตัวอย่าง) ใน crm, wms, procure, etax, market — ทำให้คำขอที่ไม่ครบสร้างข้อมูลสมมติลงฐานจริง.
5. Next `ai/chat` มีทางสำรองเรียกผู้ให้บริการตรงเมื่อ Go ใช้ไม่ได้ (ดู `frontend/src/app/api/ai/chat/route.ts`).

## ที่มาในโค้ด

- backend/internal/adapter/inbound/http/router.go:250-326 (กลุ่มโมดูล), :64 (Timeout 60s)
- backend/internal/adapter/inbound/http/response/response.go:49-79 (รูปแบบ error)
- backend/internal/adapter/inbound/http/dashboard/handler.go:99-107,110,122-137
- backend/internal/adapter/inbound/http/crm/handler.go:144,155,426,442,465-466,530,567,605,649,656-657,839,843,993
- backend/internal/adapter/inbound/http/ai/handler.go:52,70,83,396,409,418,430-466,573,612-648
- backend/internal/adapter/inbound/http/wms/handler.go:182,197,204,217,310,319,328-340,534,627,673-740,836,842-850,1204,1298
- backend/internal/adapter/inbound/http/tms/handler.go:272,290,403-410,614,623,833,1285,1732
- backend/internal/adapter/inbound/http/procure/handler.go:298,318,452,1116,1238,1243-1255,1355-1440,1902
- backend/internal/adapter/inbound/http/etax/handler.go:150,168,287-337,432-456,639,1016
- backend/internal/adapter/inbound/http/market/handler.go:248,273,275,304,511-550,802,1362
- backend/internal/adapter/inbound/http/autocare/handler.go:350,870-872,973,990-2076,2082,2262; autocare/seed.go:14
- frontend/src/lib/api-server.ts:34-51 (`ok`/`fail`); frontend/src/app/api/{dashboard,crm,ai,wms,tms,procure,etax,market,autocare}/*/route.ts
- ผู้เรียกฝั่งหน้าเว็บ: frontend/dashboard/ExecutiveDashboard.tsx:184, frontend/crm/CrmDashboard.tsx:347,730, frontend/ai/AiChatWorkspace.tsx:592,861, frontend/wms/WmsDashboard.tsx:429,588,656,694, frontend/tms/TmsDashboard.tsx:353-571, frontend/procure/ProcureDashboard.tsx:363-682, frontend/etax/EtaxDashboard.tsx:212,237,293,332, frontend/market/MarketDashboard.tsx:456,866,899, frontend/autocare/AutoCareWorkspace.tsx:161,220, frontend/account/master/ItemScreen.tsx:1191,1293
