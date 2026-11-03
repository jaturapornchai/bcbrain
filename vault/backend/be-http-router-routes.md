---
title: "Router, middleware และแผนผัง route ทั้งหมดของ backend (chi router)"
tags: [backend, go, http, router, middleware]
aliases: ["router.go", "chi router", "route map", "middleware chain", "ExtraHandlers", "api/v1", "แผนที่ endpoint", "swagger"]
sources: ["backend/internal/adapter/inbound/http/router.go:59", "backend/internal/adapter/inbound/http/router.go:73", "backend/internal/adapter/inbound/http/router.go:90", "backend/internal/adapter/inbound/http/router.go:213", "backend/internal/adapter/inbound/http/middleware/middleware.go:18", "backend/internal/adapter/inbound/http/middleware/auth.go:39"]
---

# Router, middleware และแผนผัง route

`NewRouter` (`router.go:59`) สร้าง `chi` router ตัวเดียวที่รวมทุก route: กลุ่มแกนกลาง (`/auth`, `/query`, `/blob`, `/admin/providers`) ที่ต้องมีเสมอ และกลุ่มโมดูล (`/api/v1/...`, `/process`, `/mcp`) ที่ลงทะเบียนเฉพาะเมื่อ `ExtraHandlers` มี handler นั้นไม่ใช่ nil (`router.go:40-57,121`). แคตตาล็อก endpoint รายละเอียดของโมดูลอยู่นอกขอบเขตโน้ตนี้ — ที่นี่สรุปโครงและกติกาการป้องกัน.

## ทำงานอย่างไร

1. ชั้นนอกสุด (ทุกคำขอ) ตามลำดับ `router.go:62-66`: `RequestID` → `Recoverer` → `Timeout(60s)` → `SecurityHeaders` → `RequestLogger`.
   - `SecurityHeaders` เรียก `security.SetSecureHeaders` (`middleware.go:18-23`) ดู [[be-platform-utilities]].
   - `RequestLogger` log 1 บรรทัด/คำขอ: method, path, status, duration, request_id (`middleware.go:26-45`) — ไม่ log body/query string.
2. `GET /health` เสมอ (`router.go:68`); `GET /swagger/*` เฉพาะเมื่อ `env == "development"` (`:69-71`) ([[be-deployment]]).
3. กลุ่มแกนกลางลงทะเบียนเสมอ; กลุ่มโมดูลตรวจ `ex.X != nil` ทีละกลุ่ม.
4. `queryWriteGuard` = `RequireRight(Rights, processhttp.QueryRequiredRight)` (`router.go:86-89`; `di` ส่ง `Rights: identityService` ดู [[be-hexagonal-architecture]]).

## แผนผัง route

| กลุ่ม | route | หมายเหตุ |
|---|---|---|
| `/auth` | `POST /login`, `/select-company`, `/refresh`, `/logout` | `router.go:73-77` ([[be-identity-login-flow]]) |
| `/auth` | `GET /me` | `:79-81` |
| `/query` | `POST /list`, `/limit`, `/batch` | `:90-94,102` ([[be-query-gateway]]) |
| `/query` | `POST /exec`, `/execBatch` | `:95-101` ([[be-query-write-policy]]) |
| `/blob` | `POST /insert` | `:105-111` ([[be-blob-insert]]) |
| `/admin/providers` | `POST /`, `GET /` | `:114-120` ([[be-provider-registry]]) |
| `/process` และ `/api/v1/process` | ชุด endpoint เดียวกัน 2 prefix | `:127-209` (engine นอกขอบเขต ดู [[process-overview]]) |
| `/api/v1/admin` | providers, users, databases, database-info, main-query, menu-permissions, workspace/* | `:213-250` ([[be-admin-api]], [[be-workspace-google]]) |
| `/api/v1/dashboard` | `GET /overview` | `:253-255` |
| `/api/v1/crm` | `GET /image`, `/overview`, `/activities`; `POST /activities`, `/upload` | `:260-266` |
| `/api/v1/ai` | `GET /context`, `POST /chat` | `:271-274` |
| `/api/v1/wms`, `tms`, `procure`, `etax`, `market`, `autocare` | endpoint ของโมดูล | `:277-325` |
| `/api/v1/pos` | `shift`, `image` + กลุ่ม DeviceOnly / UserOnly | `:328-351` ([[be-pos-sync-api]]) |
| `/api/v1/monitormap` | `GET /tile`, `POST /tile` | `:354-360` |
| `/mcp`, `/api/v1/mcp` | `GET`/`POST` | `:363-366` |
| `/api/v1/mcp/tokens` | list / create / revoke | `:368-373` |

## สิ่งที่ควรรู้

- `Auth` (`middleware/auth.go:39`) อ่าน `Authorization: Bearer <token>` เรียก `VerifyAccessToken` แล้วใส่ `SessionClaims` ลง context (`ClaimsFromContext`); ล้มเหลวตอบ 401 `missing or invalid access token` ([[be-jwt-session-tokens]]).
- `AdminAuth` (`adminauth.go:18`) ใช้กุญแจ `ADMIN_API_KEY` เทียบแบบ constant-time; กุญแจว่าง = ปฏิเสธทุกคำขอ ([[be-config-env]]).
- `RequireRight` (`permission.go:62`) รับฟังก์ชันที่คืน `Right` ต่อคำขอ — `/process` ใช้ `RequiredRight` (map `routeRights` ตาม path), `/query/exec*` และ `/blob/insert` ใช้ `QueryRequiredRight` (จำแนกตามคำสั่ง SQL) ([[be-menu-rights-permission]]).
- มี 2 prefix ซ้ำสำหรับ process (`/process/...` และ `/api/v1/process/...`) ลงทะเบียนชุดเดียวกัน — คาดว่าไว้ให้ client เก่า/ใหม่ใช้ได้ทั้งคู่ (ยังไม่ยืนยันเจตนา).
- `/api/v1/crm/image` คือ route จริง (`router.go:262`) แต่ URL ที่ฝังใน DB ตอน blob insert ขึ้นต้น `/api/crm/image` ([[be-blob-insert]]).

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/router.go:40-57` — `ExtraHandlers`.
- `backend/internal/adapter/inbound/http/router.go:59-121` — middleware ชั้นนอก, auth, query, blob, admin/providers.
- `backend/internal/adapter/inbound/http/router.go:121-376` — กลุ่มโมดูล.
- `backend/internal/adapter/inbound/http/middleware/middleware.go:18-45` — headers + logger.
- `backend/internal/adapter/inbound/http/middleware/auth.go:39` — `Auth`.

## ดูเพิ่ม

[[backend-overview]] · [[be-error-response-shape]] · [[be-menu-rights-permission]] · [[be-hexagonal-architecture]] · [[adr-index]]
