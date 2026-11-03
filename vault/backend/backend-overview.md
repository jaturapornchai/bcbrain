---
title: "ภาพรวม Backend Go ของ BC Ai Account (Backend overview)"
tags: [backend, overview, hub, go, hexagonal, multi-tenant]
aliases: ["backend overview", "bcaiaccountapi", "Go backend", "ภาพรวมระบบหลังบ้าน", "สารบัญ backend"]
sources: ["backend/internal/di/container.go:62", "backend/internal/adapter/inbound/http/router.go:64", "backend/internal/adapter/inbound/http/router.go:65", "backend/internal/platform/db/pool.go:16", "backend/internal/adapter/inbound/http/query/handler.go:245", "backend/README.md:85", "backend/Makefile"]
---

# ภาพรวม Backend Go (`d:\bcaiaccount\backend`)

Backend ของ BC Ai Account เป็นเซอร์วิส Go เดียว (โมดูล `github.com/bcsoft/bcaiaccountapi`, go 1.26.0) แบบ hexagonal: HTTP (chi v5) → use case → port → adapter ที่ต่อ PostgreSQL (pgx v5) / MinIO / ไฟล์ JSON. ระบบเป็น multi-tenant: หนึ่ง Provider มีฐานหลักของตัวเอง และแต่ละบริษัทมีฐานข้อมูลแยก. โน้ตชุดนี้ครอบคลุมแกนกลาง **ยกเว้น** `internal/application/process` (เอนจินเอกสารบัญชี → [[process-overview]]).

## ทำงานอย่างไร

### ชั้นของระบบ (ดู [[be-hexagonal-architecture]])
1. **`cmd`** — จุดเริ่มต้นและวงจรชีวิตเซอร์วิส (รันเป็น service ข้าม OS ด้วย kardianos/service) → [[be-service-lifecycle]].
2. **`internal/di`** — composition root สร้างทุกชิ้นแล้วต่อสายกัน (`di/container.go:62`) → [[be-hexagonal-architecture]].
3. **`internal/adapter/inbound/http`** — router, middleware, handler ของแต่ละโมดูล. router ใส่ `Timeout(60s)` และ `SecurityHeaders` ให้ทุกคำขอ (`router.go:64-65`) → [[be-http-router-routes]].
4. **`internal/application`** — use case: `identity`, `tenant`, `blob`, `query` (ในขอบเขตโน้ตนี้) และ `process` (อีกชุด).
5. **`internal/domain`** + **port** — โครงสร้างและ interface ที่ชั้นนอกต้อง implement.
6. **`internal/adapter/outbound`** — PostgreSQL, ไฟล์ registry, ที่เก็บ revocation, MinIO.
7. **`internal/platform`** — ของกลาง: `apperr`, `config`, `db` (pool), `docno`, `sqllit`, `search`, `security`, `httpserver`, `logger` → [[be-platform-utilities]], [[be-error-response-shape]], [[be-config-env]], [[be-db-pool-manager]].

### การไหลของคำขอหลัก
- **เข้าสู่ระบบ**: `{provider, dataGroup, username, password}` → หา Provider จาก registry → ต่อฐานหลัก/ฐานบริษัทของผู้เช่านั้น → ตรวจรหัสผ่าน → ออก JWT HS256 → [[be-identity-login-flow]], [[be-jwt-session-tokens]].
- **ผู้เช่า**: Provider Code `^[A-Z0-9]{2,20}$`; ฐานหลัก = `"bcerpmain"+lower(code)` (คำนวณจากสูตร ไม่เก็บ); ฐานบริษัท = ค่า `data_database_name` → [[be-multi-tenant]], [[be-provider-registry]].
- **สิทธิ์**: อ่านสิทธิ์เมนูจาก `image_file` (JSON หรือ XML เดิมของ C#) แล้วบังคับด้วย `RequireRight`; admin = `superadmin` หรือ level ≥ 9 → [[be-menu-rights-permission]].
- **อ่าน/เขียนข้อมูลทั่วไป**: ผ่าน Query Gateway (`/query/list|exec|execBatch`) ซึ่งอ่านใน transaction read-only และจำกัดจำนวนแถว/ขนาด; ฝั่งเขียนมีนโยบายล็อกตารางเงิน/สต็อก/GL → [[be-query-gateway]], [[be-query-write-policy]].
- **รูปภาพ**: `POST /blob/insert` รับ multipart แล้วเก็บใน MinIO พร้อมภาพย่อ ฐานข้อมูลเก็บเพียง URL → [[be-blob-insert]].
- **ฐานข้อมูล**: `PoolManager` เปิด pool ต่อ (host, port, user, db) และรัน DDL ช่วย (`companySchemaSQL`, `platform/db/pool.go:16`) ทุกครั้งที่เปิด pool ใหม่ → [[be-db-pool-manager]].

### ส่วนจัดการ/เชื่อมภายนอก
- **Admin API** `/api/v1/admin/*` (ยืนยันด้วย header `X-Admin-Api-Key` เทียบ env `ADMIN_API_KEY`) → [[be-admin-api]].
- **Workspace Google** — ล็อกอินด้วยอีเมล สร้าง/เลือกบริษัท → [[be-workspace-google]].
- **POS Sync** — เครื่อง POS ดึง bootstrap/ส่งบิล/อัปโหลดสลิป ด้วย device token หรือ JWT ผู้ใช้ → [[be-pos-sync-api]].

### การปล่อยระบบ
- Docker, Kubernetes, `Makefile` (build/test/vet/lint — ไม่มีเป้าหมาย migrate) → [[be-deployment]].
- ไฟล์ SQL เดียวใน `migrations/` ไม่มีตัวรัน; ตารางจริงถูกสร้างตอนรันโดยโค้ด Go → [[be-audit-migrations]].

## สารบัญโน้ต backend (ครบทุกไฟล์)

| กลุ่ม | โน้ต | เรื่อง |
|---|---|---|
| โครงสร้าง | [[be-hexagonal-architecture]] | ชั้น hexagonal และ DI |
| | [[be-config-env]] | ตัวแปร env และการโหลดค่า (ชื่อเท่านั้น) |
| | [[be-service-lifecycle]] | รันเป็น service, graceful shutdown |
| | [[be-deployment]] | Docker, K8s, Makefile |
| | [[be-error-response-shape]] | รูปแบบ error/response |
| | [[be-platform-utilities]] | docno, sqllit, search, security |
| HTTP | [[be-http-router-routes]] | router, middleware, แผนที่ route |
| ผู้เช่า | [[be-multi-tenant]] | Provider, ฐานหลัก, ฐานบริษัท |
| | [[be-provider-registry]] | ทะเบียน Provider แบบไฟล์ JSON |
| ยืนยันตัวตน | [[be-identity-login-flow]] | login / เลือกบริษัท / refresh / logout |
| | [[be-jwt-session-tokens]] | JWT และการเพิกถอน |
| | [[be-menu-rights-permission]] | สิทธิ์เมนูและ `RequireRight` |
| ข้อมูล | [[be-query-gateway]] | `/query/*` |
| | [[be-query-write-policy]] | นโยบายล็อกการเขียน |
| | [[be-blob-insert]] | แทรกแถว + รูปใน MinIO |
| | [[be-db-pool-manager]] | pool ต่อฐาน |
| | [[be-audit-migrations]] | migration และ DDL ตอนรัน |
| ส่วนต่อขยาย | [[be-admin-api]] | Admin API |
| | [[be-workspace-google]] | Workspace Google |
| | [[be-pos-sync-api]] | POS Sync |

การตัดสินใจเชิงสถาปัตยกรรม 11 ข้อ (ADR-0001 ถึง 0011) อยู่ที่ [[adr-index]].

## ข้อควรระวังระดับระบบ

- **ADR/เอกสารบางส่วนล้าสมัย — ให้ถือโค้ดเป็นความจริง**: ที่เก็บ revocation เป็นไฟล์ (ไม่ใช่ตามที่ ADR-0004 เดิมบอก), `/query/exec` มีจริง, รูปภาพใช้ MinIO (ไม่ใช่ bytea), รหัสผ่านรองรับ bcrypt, README/PLAN เรื่อง `golang-migrate` ไม่มีใน `go.mod` (`README.md:85`).
- **ออกแบบเป็นอินสแตนซ์เดียว**: registry เป็นไฟล์พร้อม mutex ในโปรเซส — แต่ manifest K8s ตั้ง `replicas: 2` (ยังไม่ยืนยันว่าแชร์ volume กัน) → [[be-provider-registry]], [[be-deployment]].
- **เงิน**: `sqllit.Literal` พิมพ์ `float64` เป็นทศนิยมฐานสอง — ส่งยอดเงินเป็นสตริงทศนิยมแทน → [[be-platform-utilities]].
- **schema ในไฟล์ SQL กับ DDL ในโค้ด Go ไม่ตรงกัน** (เช่น `cache_key` กับ `tile_key`) → [[be-audit-migrations]].

## ที่มาในโค้ด

- `backend/internal/di/container.go:62` — composition root.
- `backend/internal/adapter/inbound/http/router.go:64-65` — middleware ระดับ router.
- `backend/internal/platform/db/pool.go:16` — `companySchemaSQL` ที่รันตอนเปิด pool.
- `backend/internal/adapter/inbound/http/query/handler.go:245` — จุดที่ตั้ง `ClientRequest=true` ของนโยบายเขียน.
- `backend/README.md:85`, `backend/Makefile` — เอกสาร/เป้าหมาย build ที่ล้าสมัยหรือไม่มี migrate.

## ดูเพิ่ม

[[adr-index]] · [[process-overview]] · [[frontend-overview]] · [[standards-overview]] · [[index]]
