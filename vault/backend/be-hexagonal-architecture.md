---
title: "สถาปัตยกรรม Hexagonal และ composition root ของ Go backend (Hexagonal Architecture + DI)"
tags: [backend, go, architecture, di]
aliases: ["hexagonal", "ports and adapters", "di container", "composition root", "โครงสร้างโฟลเดอร์ backend", "internal/di"]
sources: ["backend/go.mod:1", "backend/README.md:29", "backend/internal/di/container.go:62", "backend/internal/application/query/port.go:64", "backend/CONTEXT.md:7"]
---

# สถาปัตยกรรม Hexagonal และ composition root

backend ของ BC Ai Account เป็น Go module `github.com/bcsoft/bcaiaccountapi` (go 1.26.0, `go.mod:1,3`) จัดชั้นแบบ Hexagonal: `domain` (กฎล้วน) → `application` (use case + port) → `adapter` (inbound = HTTP, outbound = DB/ไฟล์/MinIO) โดย `internal/di/container.go` เป็นจุดเดียวที่ประกอบ (wire) ทุกชั้นเข้าด้วยกัน.

## ทำงานอย่างไร

1. `cmd/api/main.go` เรียก `config.Load()` → `logger.New()` → `di.Build(cfg, log)` → `httpserver.New(port, container.Handler, log)` ([[be-service-lifecycle]]).
2. `di.Build` (`internal/di/container.go:62`) ประกอบตามลำดับ:
   - `response.SetLogger(log)` (`:63`) ให้ helper ตอบ error มี logger ([[be-error-response-shape]]).
   - `db.NewPoolManager()` (`:65`) pool กลาง ([[be-db-pool-manager]]).
   - tenant: `NewJSONFileRepository(cfg.ConfigDir)` + `NewConnectionTester()` → `apptenant.NewService` (`:67-74`) ([[be-provider-registry]]).
   - identity: resolver + `UserRepository` + `CompanyRepository` + revocation store + `JWTTokenService` → `appidentity.NewService` (`:76-92`) ([[be-identity-login-flow]], [[be-jwt-session-tokens]]).
   - query: `dynamicsql.NewGateway(pools)` → `appquery.NewService` (`:94-97`) ([[be-query-gateway]]).
   - process: `appprocess.NewService(queryConnectionResolver, pools)` (`:99-100`) — engine นี้อยู่นอกขอบเขตโน้ตชุดนี้ ดู [[process-overview]].
   - blob: `blobsql.NewGateway(pools)` → `appblob.NewService` (`:102-105`) ([[be-blob-insert]]).
   - handler ของโมดูล (admin, dashboard, crm, ai, wms, tms, procure, etax, market, pos, autocare, monitormap, mcp) (`:107-119`) ([[be-http-router-routes]]).
   - `inboundhttp.NewRouter(...)` พร้อม `ExtraHandlers{... Rights: identityService}` (`:147-178`); `Rights` คือตัวโหลดสิทธิ์เมนูให้ `RequireRight` ([[be-menu-rights-permission]]).
3. `Container{Config, Logger, Pools, Handler}` (`:54-59`); `Close()` เรียก `Pools.CloseAll()` (`:184-186`) ตอนปิดเซอร์วิส.

## กติการะหว่างชั้น (ตามคำอธิบายใน README)

- `domain`: Go ล้วน ไม่ import SQL/HTTP/framework.
- `application`: import `domain` เท่านั้น เป็นที่อยู่ของ port (`port.go`) และ use case (`service.go`).
- `adapter/inbound/*`: เรียก inbound port; `adapter/outbound/*`: implement outbound port ด้วย pgx/ไฟล์/MinIO.
- `platform/*`: ของข้ามชั้น (config, logger, db pool, security, apperr) (`README.md:47-56`).

## โครงสร้างจริงใต้ `backend/internal` (ตรวจจากต้นไม้ไฟล์)

| ชั้น | โฟลเดอร์ที่มีจริง |
|---|---|
| `domain` | `blob`, `identity`, `query`, `tenant` |
| `application` | `blob`, `identity`, `process`, `query`, `tenant` |
| `adapter/inbound/http` | `admin`, `ai`, `autocare`, `blob`, `crm`, `dashboard`, `etax`, `identity`, `market`, `mcp`, `middleware`, `monitormap`, `ops`, `pos`, `process`, `procure`, `query`, `response`, `tenant`, `tms`, `wms` + `router.go` |
| `adapter/outbound` | `blob`, `blobsql`, `crypto`, `dynamicsql`, `identity`, `query`, `tenant` |
| `platform` | `apperr`, `config`, `db`, `docno`, `httpserver`, `logger`, `search`, `security`, `sqllit` |

รูปแบบซ้ำ: ทุก context ที่ต้องต่อ DB ผู้เช่ามี `provider_connection_resolver.go` ใน outbound (identity/query/blob) ซึ่งห่อ `tenantService.GetProviderConnection` เพื่อให้ application ไม่รู้จักไฟล์ config ([[be-multi-tenant]]).

## จุดที่โค้ดจริงต่างจากแผนใน README

- README (`README.md:62-85`) วางแผนโฟลเดอร์ `adapter/inbound/consumer`, `outbound/postgres`, `storage`, `mqpublisher`, `pdf`, `qrcode`, และ `golang-migrate` — ในต้นไม้จริงไม่มีโฟลเดอร์เหล่านี้ และ `go.mod` ไม่มี golang-migrate ([[be-audit-migrations]]). ตาราง bounded context (`README.md:90-110`) ระบุหลาย context ว่า "ยังไม่เริ่ม" แต่ router มี `pos`/`dashboard`/`wms` ฯลฯ อยู่แล้ว — README ล้าสมัย ให้ยึดโค้ด.
- handler ของโมดูล (wms, tms, procure, etax, market, crm, autocare, monitormap) ไม่ผ่าน repository เฉพาะของตัวเอง แต่เรียก use case ของ `query`/`blob` ผ่าน `ExecInput.AllowDDL = true` เพื่อสร้างตาราง/เขียนข้อมูลเอง (`application/query/port.go:64`) และบางตัวมี `EnsureSeeded` ที่ `di` ผูกต่อกัน (`container.go:120-145`).
- ADR/คำศัพท์โดเมน (Tenant, Main Database, Company, DataGroup, Access Grant, Session, Pre-auth token) นิยามไว้ที่ `CONTEXT.md:7-41` ([[be-multi-tenant]]).

## ที่มาในโค้ด

- `backend/go.mod:1-3` — ชื่อ module และเวอร์ชัน Go.
- `backend/internal/di/container.go:62-182` — ลำดับการ wire ทั้งหมด; `:184` `Close`.
- `backend/README.md:29-56` — หลักการ Hexagonal และกติกา dependency.
- `backend/internal/application/query/port.go:64` — `AllowDDL` ที่โมดูลใช้.

## ดูเพิ่ม

[[backend-overview]] · [[be-http-router-routes]] · [[be-config-env]] · [[be-service-lifecycle]] · [[adr-index]]
