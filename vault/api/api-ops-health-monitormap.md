---
title: "API ตรวจสุขภาพ แผนที่ติดตาม และเส้นทางเฉพาะชั้น Next (Health, Monitormap, Next-only routes)"
tags: [api, ops, monitormap]
aliases: ["/health","/swagger","/api/v1/monitormap/tile","/api/monitormap","/api/monitormap/tile","/api/fraudwarning","/api/workmonitor","/api/workmonitor/stream","/api/help","/api/lineoa","RESOLVE_ALERT","run_deepseek_scan","webrtc_signal","BIND_LINE_EMAIL"]
sources: ["backend/internal/adapter/inbound/http/router.go:62","backend/internal/adapter/inbound/http/ops/health.go:24","backend/internal/adapter/inbound/http/monitormap/handler.go:420","backend/internal/adapter/inbound/http/monitormap/handler.go:508","frontend/src/app/api/monitormap/route.ts:321","frontend/src/app/api/fraudwarning/route.ts:20","frontend/src/app/api/workmonitor/route.ts:24","frontend/src/app/api/workmonitor/stream/route.ts:1","frontend/src/app/api/help/route.ts:1","frontend/src/app/api/lineoa/route.ts:228"]
---

# API ตรวจสุขภาพ / แผนที่ติดตาม / เส้นทางเฉพาะชั้น Next

รวม 3 กลุ่ม: (1) endpoint ปฏิบัติการของ Go (`/health`, `/swagger`), (2) แผนที่ติดตามฝั่ง Go (`/api/v1/monitormap/tile`), (3) เส้นทางที่ **มีเฉพาะในชั้น Next** (ไม่มีคู่ใน Go): `monitormap`, `monitormap/tile`, `fraudwarning`, `workmonitor`, `workmonitor/stream`, `help`, `lineoa`. ภาพรวมที่ [[api-overview]]; ตารางเส้นทาง Go ที่ [[be-http-router-routes]]; ตารางเส้นทาง Next ที่ [[fe-api-proxy-routes]].

## 1. Go: /health และ /swagger

| method path | auth | ผล | ที่มา |
|---|---|---|---|
| GET `/health` | ไม่มี | 200 `{"status":"ok"}` เป็น liveness เท่านั้น — **ไม่ตรวจ DB/MinIO/ปลายทางอื่น** | ops/health.go:24-27, router.go:68 |
| GET `/swagger/*` | ไม่มี | หน้า Swagger UI — ลงทะเบียนเฉพาะเมื่อ `env == "development"` | router.go:69-71 |

- ตัวอย่าง: `GET /health` → `{"status":"ok"}`.
- ไม่มี readiness/metrics endpoint ในไฟล์ router (ค้นแล้วไม่พบ route เพิ่ม); การเฝ้าระวังอาศัย `RequestLogger` (router.go:66).

## 2. Go: /api/v1/monitormap/tile — แผ่นแผนที่พร้อมแคช

ลงทะเบียน router.go:352-358 (GET `/tile` ไม่มี middleware; POST `/tile` ครอบด้วย `Auth` ที่ :356).

### GET /api/v1/monitormap/tile

- Query:

| query | ค่า | หมายเหตุ |
|---|---|---|
| `stats=1` | — | คืน JSON สถิติแคช: `mode` (`backend_shared_multi_node`), `ramCachedTiles`, `diskCachedTiles`, `pgCachedTiles`, `hits`, `hitRatePct` ฯลฯ |
| `layer` | `sat` \| `trans` \| `places` \| `osm` | ค่าเริ่มต้น `sat` (ค่าอื่นถูกแทนด้วย `sat`) |
| `z` | 0..18 | นอกช่วง = 400 `invalid zoom` |
| `x`, `y` | 0..2^z-1 | นอกช่วง = 400 `tile out of range` |

- Response: ไบต์ภาพแผ่นแผนที่ + header `Content-Type`, `X-Tile-Cache` ∈ `HIT-BACKEND-RAM`, `HIT-BACKEND-DISK`, `HIT-BACKEND-PG`, `HIT-INFLIGHT`, `MISS-SAVED-BACKEND`, `FALLBACK`; `X-Tile-Key` (`layer:z:x:y`); `Cache-Control: public, max-age=31536000, immutable` (ถ้า `FALLBACK` เป็นภาพโปร่งใส 1x1 พร้อม `no-store, must-revalidate`) (handler.go:420-).
- GET เส้นนี้ไม่มี `Auth` (แผนที่โหลดโดยไม่มี Bearer): ถ้าไม่มี claims ของ session ระบบใช้ฐาน `bcdemo` ของ provider `bcdemo` เป็นค่ากลางเสมอ และ **ไม่รับ** `?db=`/`?provider=` จากผู้เรียก (`resolveClaims` handler.go:114-124). ตารางแคชคือ `monitormap_tile_cache` ในฐานนั้น (`ensureTileTable` handler.go:127).
- ต้นทางภาพคือบริการแผนที่ภายนอก (ไม่ระบุโฮสต์ในโน้ตนี้); แคช RAM สูงสุด 1,500 แผ่น (:105), ดึงต้นทางพร้อมกันสูงสุด 24 (:107), HTTP client timeout 12 วินาที (:109), โฟลเดอร์แคชดิสก์จาก env `BC_TILE_CACHE_DIR` (:86).

```
GET /api/v1/monitormap/tile?layer=sat&z=10&x=800&y=450
```

### POST /api/v1/monitormap/tile (ต้อง Bearer)

- `PrewarmTiles` (handler.go:508): ไม่มี claims = 401 `authentication required`.
- สร้างงานดึงแผ่นล่วงหน้า (ประเทศไทยระดับ z6-8 + จุดเมืองหลัก 8 จุด z9-13, 3 layer = `sat`,`trans`,`places`; handler.go:521-571) จำนวนหลายร้อยแผ่น รันเบื้องหลังด้วย worker 12 ตัว (handler.go:579) ครั้งละ 1 งาน (single-flight ด้วย `CompareAndSwap` :573; ถ้ามีงานค้างอยู่ตอบ `alreadyRunning:true`, `queuedTiles:0`), timeout 10 นาที (`prewarmJobTimeout` :70).
- Response 200: `{ok, mode, queuedTiles, alreadyRunning, diskCachedTiles, diskCacheMB, pgCachedTiles}`.

## 3. Next-only routes

ทุกเส้นด้านล่างอยู่ใน `frontend/src/app/api/...` และ **ไม่มีเส้นทางเทียบใน Go** (หรือเป็น orchestrator ที่เรียก Go หลายเส้น). รูปแบบ response ของ Next: สำเร็จ `{ok:true,data}` / ล้มเหลว `{ok:false,error,code}` ตาม `api-server.ts:34,63` (บางเส้นใช้ `{success,...}` ของตัวเอง).

### 3.1 /api/monitormap (route.ts, 468 บรรทัด)

- `GET` (:321): อ่านตาราง `monitormap_*` ผ่าน Go `/query/list` และ `/query/execBatch` พร้อมข้อมูลสรุป TMS, WMS, dashboard overview, POS bootstrap รวมเป็น payload เดียวสำหรับหน้าแผนที่.
- `POST` (:419) action: `RESOLVE_ALERT` (ต้องมี `alertId`, ค่าเริ่มต้นเมื่อไม่ส่ง action; กรอง `alertId` ให้เหลือ `[a-zA-Z0-9_-]`), `RESET_ALERTS`, `APPROVE_ALL_ALERTS` (:432-444).
- Caller: `frontend/monitormap/ThailandMonitorMapScreen.tsx` (:701, :1220, :1241, :1260).

### 3.2 /api/monitormap/tile (route.ts, 488 บรรทัด)

- `GET` (:312): พร็อกซีแผ่นแผนที่พร้อมแคชดิสก์ในโฟลเดอร์ `.tile-cache` (หรือ `BC_TILE_CACHE_DIR`, :25). query `layer`, `z`, `x`, `y`; `stats=1` รวมสถิติดิสก์ของ Next กับ `pgCachedTiles`/`pgCacheMB` จาก Go (:316-330). Header `Cache-Control: public, max-age=31536000, s-maxage=31536000, immutable` และ `X-Tile-Cache` (:377-381).
- `POST` (:392): ต้อง session (`requireSession`, 401 ถ้าไม่มี) — ยิง Go prewarm แบบไม่รอผล และ prewarm ฝั่ง Next ตามจุดใน `points[{lat,lng}]` (ถ้าไม่ส่งใช้รายชื่อคลัง/เมืองหลักที่ฝังในโค้ด).
- Caller: `ThailandMonitorMapScreen.tsx` (tile :187, stats :672, POST :731/:1120).

### 3.3 /api/fraudwarning (route.ts, 201 บรรทัด)

- Auth: `getSession()` ไม่ต่ออายุ session (เพราะ telemetry ยิงถี่) — ไม่มี session = 401 (:24-28, :54-58).
- `GET` (:20): snapshot คำเตือนทุจริตของบริษัทนั้น. `POST` (:50) ตาม `action`: `record_activity` / `record_batch` (ตัวเลือก `autoRunDeepSeek`), `run_deepseek_scan`, `simulate_fraud_scenario`, `update_warning_status` (ต้องมี `warningId` + `status`). ไม่มี action = 400.
- เก็บใน MongoDB audit store แยกตามฐาน (`withAuditDatabase(session.database)`) และเรียกบริการ AI ภายนอก (DeepSeek) เพื่อวิเคราะห์.
- Caller: `frontend/workmonitor/EmployeeFraudWarning3DScreen.tsx` (:157/209/241/283), `WorkstationTelemetryAgent.tsx`.

### 3.4 /api/workmonitor (route.ts, 235 บรรทัด)

- Auth: `getSession()` เช่นเดียวกัน (401 ถ้าไม่มี).
- `GET` (:24): snapshot ในหน่วยความจำของเซิร์ฟเวอร์ Next (`source: "in-memory-webrtc"`) — ไม่ได้อ่านฐานข้อมูล.
- `POST` (:44) `action`: `webrtc_signal` (ต้องมี `signal`), `set_monitor_power`, `move_desk`, `apply_preset_layout`, `disconnect`, `telemetry_ping` (ต้องมี `telemetry`). ไม่รู้จัก = 400 `Unsupported action` (:223).
- Caller: `frontend/workmonitor/EmployeeWorkMonitor3DScreen.tsx` (:434), `WorkstationTelemetryAgent.tsx`.

### 3.5 /api/workmonitor/stream (route.ts, 176 บรรทัด)

- `GET` แบบ Server-Sent Events (`text/event-stream`), ต้อง session (401 ถ้าไม่มี).
- Query: `role=viewer|agent`, `viewerId`, `enabled`, `focusedDeskId`, `deskId`, `empCode`, `empName`, `machineLabel`, `desktopResolution`, `routePath`, `moduleId`, `menuCode`, `screenTitle`.
- Event: `init_snapshot`, `watch_state`, `webrtc_signal`. สถานะอยู่ในหน่วยความจำของ process เดียว (ไม่ข้ามหลาย instance).
- Caller: `EmployeeWorkMonitor3DScreen.tsx` ผ่าน `EventSource` (:614).

### 3.6 /api/help (route.ts, 382 บรรทัด)

- **ไม่มี auth** (เป็นข้อความช่วยเหลือสาธารณะ).
- `GET ?keys=a|b&lang=th|en`: สูงสุด 8 คีย์ แต่ละคีย์ไม่เกิน 120 ตัวอักษร → `{entry}` พร้อม `Cache-Control: public, max-age=300, stale-while-revalidate=600`.
- `POST {texts[<=400], codes[<=200]}` → `{translations, codes}` (แปล/ค้นคำช่วยเหลือเป็นชุด).
- Caller: `frontend/shared/components/GlobalLanguageTranslator.tsx`, `frontend/src/config/help/bcFieldHelpCatalog.ts`.

### 3.7 /api/lineoa (route.ts, 1005 บรรทัด)

- มีประเด็นด้านความปลอดภัยที่ทีมพัฒนาต้องตรวจ (ไม่เผยแพร่รายละเอียดบนเว็บสาธารณะ)
- `GET` (:228): ผูก LINE ปัจจุบันจาก Go `/api/v1/admin/workspace/line-binding` (ใช้ admin key ฝั่งเซิร์ฟเวอร์ ดู [[api-admin-workspace]]) พร้อมข้อมูลภาพรวม.
- `POST` (:596) ตาม `action`: `BIND_LINE_EMAIL` / `UNBIND_LINE_EMAIL` (:608-) เรียก line-binding ของ workspace; `CREATE_LINE_ORDER` (:672) เรียก `/api/v1/market/order` และ `/api/v1/crm/activities` ([[api-business-modules]]); ค่าเริ่มต้น `CHAT` ส่งไป Go `/api/v1/ai/chat` แล้วถอยไปเรียกผู้ให้บริการ AI ตรงถ้า Go ใช้ไม่ได้.
- Caller: `frontend/lineoa/LineOaChatStudio.tsx` (:757, :850, :1629, :1763).

## ข้อสังเกต

1. `/health` ตรวจแค่ว่า process ตอบ — ไม่เหมาะเป็น readiness probe.
2. สถานะ `workmonitor` และ SSE อยู่ในหน่วยความจำของ process Next เดียว — ใช้ไม่ได้ถ้ารันหลาย instance.

## ที่มาในโค้ด

- backend/internal/adapter/inbound/http/router.go:62-71 (middleware global, /health, /swagger), :352-358 (monitormap)
- backend/internal/adapter/inbound/http/ops/health.go:24-27
- backend/internal/adapter/inbound/http/monitormap/handler.go:70 (prewarmJobTimeout), :86 (BC_TILE_CACHE_DIR), :105-109 (เพดาน RAM/ต้นทาง/timeout), :127 (ensureTileTable), :420 (ServeTile), :508 (PrewarmTiles), :579 (worker 12)
- frontend/src/app/api/monitormap/route.ts:321,419-444
- frontend/src/app/api/monitormap/tile/route.ts:25,312-330,377-381,392-420
- frontend/src/app/api/fraudwarning/route.ts:20-58,86-173
- frontend/src/app/api/workmonitor/route.ts:24-52,97-169,223
- frontend/src/app/api/workmonitor/stream/route.ts
- frontend/src/app/api/help/route.ts
- frontend/src/app/api/lineoa/route.ts:228,574-608,672
- ผู้เรียก: frontend/monitormap/ThailandMonitorMapScreen.tsx:187,672,701,731,1120,1220,1241,1260; frontend/workmonitor/EmployeeFraudWarning3DScreen.tsx:157,209,241,283; frontend/workmonitor/EmployeeWorkMonitor3DScreen.tsx:434,614; frontend/lineoa/LineOaChatStudio.tsx:757,850,1629,1763
