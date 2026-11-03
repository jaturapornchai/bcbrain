---
title: "Admin API สำหรับจัดการ Provider/ผู้ใช้/ฐานข้อมูล/สิทธิ์เมนู (Admin API)"
tags: [backend, admin, http, tenant, security]
aliases: ["/api/v1/admin", "AdminAuth", "X-Admin-Api-Key", "ADMIN_API_KEY", "main-query", "database-info", "menu-permissions", "admin handler", "หลังบ้านแอดมิน"]
sources: ["backend/internal/adapter/inbound/http/router.go:213", "backend/internal/adapter/inbound/http/middleware/adminauth.go:18", "backend/internal/adapter/inbound/http/admin/handler.go:44", "backend/internal/adapter/inbound/http/admin/handler.go:113", "backend/internal/adapter/inbound/http/admin/handler.go:646", "backend/internal/adapter/inbound/http/admin/menu_permissions.go:46"]
---

# Admin API (`/api/v1/admin/*`)

กลุ่ม route สำหรับหน้าจอผู้ดูแลระบบ: จัดการ Provider, ผู้ใช้, รายการบริษัท (`bc_database_list`), ข้อมูลสรุปฐาน, SQL ตรงกับ Main DB, สิทธิ์เมนู และ Workspace Google ([[be-workspace-google]]). ป้องกันด้วยกุญแจ API ไม่ใช่ JWT ของผู้ใช้ ([[be-jwt-session-tokens]]). ไม่ได้ทำผ่าน use case ใน `application/` ทั้งหมด — handler คุย SQL กับ Main DB ของ Provider เองเป็นส่วนใหญ่ ([[be-hexagonal-architecture]]).

## ทำงานอย่างไร

1. ทุก route อยู่ใต้ `r.Use(AdminAuth(adminAPIKey))` (`router.go:213-215`). `AdminAuth` (`middleware/adminauth.go:18`) อ่าน header `X-Admin-Api-Key` เทียบกับ env `ADMIN_API_KEY` ด้วย `subtle.ConstantTimeCompare`; **ถ้าตั้งกุญแจเป็นค่าว่าง จะปฏิเสธทุกคำขอ** (fail closed) → 401 รูปแบบ `apperr` ([[be-error-response-shape]]).
2. รูปแบบตอบของ handler ในแพ็กเกจ `admin` **ต่างจาก API อื่น**: สำเร็จ `{"ok":true,"data":...}`, ล้มเหลว `{"ok":false,"error":"...","code":"..."}` (`handler.go:69-85`). `code` เช่น `BAD_JSON`, `INVALID_PROVIDER` (400), `DB_CONNECT_ERROR` (500), `INSERT_USER_ERROR` (409).
3. `openPool(ctx, provider, dbName)` (`handler.go:44`): ตัดช่องว่าง provider (ว่าง → `INVALID_PROVIDER`), หาการเชื่อมต่อจาก registry ผ่าน `tenants.GetProviderConnection` ([[be-provider-registry]]), `dbName` ว่าง = Main DB `bcerpmain<code>` (ตัวพิมพ์เล็ก), ประกอบ DSN แล้วขอ pool จาก `PoolManager` ([[be-db-pool-manager]]). Provider ถูกส่งมาใน body/query ของทุกคำขอ (`provider`).

## ตาราง route (`router.go:216-250`)

| กลุ่ม | Method + path | ทำอะไร |
|---|---|---|
| Provider | `GET/POST/PATCH/DELETE /providers` | ดู/สร้าง Provider (PATCH, DELETE เป็น stub) |
| ผู้ใช้ | `GET/POST/PATCH/DELETE /users` | จัดการ `bc_user_list` + สิทธิ์เข้าบริษัท |
| บริษัท | `GET/POST/PATCH/DELETE /databases` | จัดการ `bc_database_list` |
| ข้อมูลฐาน | `GET /database-info` | นับผู้ใช้/โปรไฟล์บริษัท/option ต่อฐาน |
| SQL | `POST /main-query` | รัน SELECT หรือ DML กับ Main DB/ฐานที่ระบุ |
| สิทธิ์เมนู | `GET/PUT /menu-permissions` | อ่าน/เขียน `image_file` (และ tooltip) |
| Workspace | `/workspace/*` (11 route) | ดู [[be-workspace-google]] |

นอกจากนี้มี `/admin/providers` (`Create`/`List` ผ่าน `tenantHandler`, `router.go:114-119`) ที่ใช้ `AdminAuth` ตัวเดียวกัน — เป็นเส้นทางสร้าง Provider แบบถูกต้องผ่าน use case ([[be-provider-registry]]).

## รายละเอียดแต่ละกลุ่ม

**Provider** — `CreateProvider` (`handler.go:113`): รับ `provider_code`, `provider_name`, `auth_database`, `is_active`; ทำรหัสเป็นพิมพ์เล็ก; `auth_database` ว่าง = `bcerpmain<code>`; พยายามเชื่อมฐาน `postgres` ผ่าน Provider ชื่อ `demo` เพื่อ `CREATE DATABASE` ถ้ายังไม่มี (ผลถูกกลืน `_ =`); จากนั้นเรียก `tenants.CreateProvider`. ซ้ำ/ผิดกติกา → 409 `CREATE_PROVIDER_ERROR`. `UpdateProvider` (`:165`) แค่สะท้อน body กลับ และ `DeleteProvider` (`:172`) แค่ตอบ `{"deleted":code}` — **ไม่ได้ทำอะไรกับ registry จริง**.

**ผู้ใช้** (`bc_user_list`):
- `ListUsers` (`:178`) รัน `ALTER TABLE ... ADD COLUMN IF NOT EXISTS email` ทุกครั้ง แล้ว SELECT พร้อมรวมรายชื่อฐานที่ได้สิทธิ์จาก `bc_database_list_user_and_group` (เฉพาะ `user_or_group_status = 0`); `is_active` = `active_status == 1`.
- `CreateUser` (`:236`): `user_code` ยาวสุด 50 (`USER_CODE_TOO_LONG`), เช็กซ้ำแบบไม่สนตัวพิมพ์ (409 `DUPLICATE_USER`), ขยายคอลัมน์ `user_password` เป็น `VARCHAR(255)`, ถ้ามีรหัสผ่านจะ hash ด้วย `domainidentity.HashPassword` (bcrypt) ก่อนเก็บ ([[be-identity-login-flow]]); แล้วเรียก `syncUserAllowedDatabases`.
- `UpdateUser` (`:310`) รับ field แบบ pointer (ส่งเฉพาะที่แก้) และรับ `allowed_databases` ซ้ำได้.
- `syncUserAllowedDatabases` (`:376`): ลบแถวสิทธิ์เข้าบริษัทแบบ user ตรง (`user_or_group_status = 0`) ของผู้ใช้นั้นทั้งหมด แล้ว insert ใหม่ตามรายการ (จับคู่ด้วย `data_database_name` หรือ `data_code`); ถ้าผู้ใช้มีอีเมล จะ upsert `bc_google_workspace_member` ด้วย role `ADMIN` (level ≥ 9) หรือ `MEMBER` ด้วย.
- `DeleteUser` (`:414`): ลบจาก `bc_database_list_user_and_group`, `bc_user_and_group`, `bc_user_list` ตามลำดับ (ผล error ถูกกลืน; ไม่อยู่ใน transaction); ไม่ลบแถวสิทธิ์เมนู `bc_permissions_user`.

**บริษัท** (`bc_database_list`):
- `ListDatabases` (`:429`) คืน `data_code/data_name/data_database_name/data_group` เรียงตาม `roworder`.
- `CreateDatabase` (`:467`): ชื่อฐานต้องตรง `^[a-z0-9_]{1,63}$` (`validDBNameRe`, `:27`) และ **ห้ามขึ้นต้น `bcerpmain`**; `data_group` ว่าง = `MAIN`; แค่ INSERT แถวลงรายการ — **ไม่ได้สร้างฐาน PostgreSQL จริง**.
- `UpdateDatabase` (`:517`) ใน transaction: แก้ `data_code/data_name/data_group` (ใช้ `COALESCE(NULLIF(x,''),เดิม)` จึงแก้เฉพาะที่ส่งมา) และตาม rename `data_code`/`data_group` ในตารางสิทธิ์.
- `DeleteDatabase` (`:580`) ลบ **เฉพาะแถวในรายการ** (ไม่ drop ฐาน, ไม่ลบแถวสิทธิ์ใน `bc_database_list_user_and_group`).

**`database-info`** (`:593`): วนทุกบริษัทแล้วเปิด pool ของแต่ละฐานเพื่อนับ `erp_user`, `erp_company_profile`, `erp_option` → `employee_count`, `has_company_profile`, `option_count`. **`option_count` เป็นค่าตายตัว 42 เมื่อ `erp_option` มีข้อมูล ไม่ใช่จำนวนจริง** (`:631-635`); ฐานที่เปิดไม่ได้จะได้ค่าศูนย์เงียบ ๆ. คำขอเดียวเปิด pool ถึง N ฐาน (ดูข้อควรระวัง).

**`main-query`** (`:646`): body `{provider, database, sql, mode}`.
- ฐานเป้าหมาย: `database` ถ้าส่งมา; ถ้าไม่ส่งแต่ SQL มีคำว่า `bc_tooltip` จะหาฐานบริษัทด้วย `resolveCompanyDB`; ไม่งั้น Main DB.
- `mode = exec` → `domainquery.NewWriteStatement` (ตรวจ DML เดียว) แล้ว `pool.Exec` คืน `rowsAffected`.
- โหมดอื่น → `NewStatement` (SELECT/WITH เท่านั้น) ใน tx ReadOnly+RepeatableRead แบบ SimpleProtocol; ค่า NUMERIC ถูกแปลงเป็นสตริงด้วย `NormalizeValue` ([[be-query-gateway]]).

**`menu-permissions`** (`menu_permissions.go`):
- `kind=user|group` (`menuPermissionTables`, `:18-21`) → ตาราง `bc_permissions_user|group`, ต้องมีรหัสอยู่ใน `bc_user_list|bc_group_list`; รหัสเมนู/รหัสเจ้าของยาวสุด 100.
- `GET` คืน `image_file` ล่าสุดของ (`usercode`, `database_name`) ถอดรหัสด้วย `DecodeMenuRights`; `PUT` (body จำกัด 1MB) ลบแถวเดิมแล้ว INSERT แถวใหม่ใน transaction ด้วย `EncodeMenuRights` เป็น JSON (`:107-212`) ([[be-menu-rights-permission]]). ไม่พบรหัสเจ้าของ → 404 `NOT_FOUND`.
- `kind=tooltip` ใช้ตาราง `bc_tooltip(code, name_1, name_2)` (สร้างด้วย `CREATE TABLE IF NOT EXISTS` ทุกครั้งที่เรียก, `:58,139`); `GET` คืนไม่เกิน 200 แถว.
- `ensureMenuPermissionColumns` (`:25`) เติมคอลัมน์ `database_name` ให้ตารางสิทธิ์ทุกคำขอ — แบบเดียวกับฝั่งอ่านสิทธิ์.

## ข้อควรระวัง

- `ADMIN_API_KEY` ต้องเก็บเป็นความลับ ตั้งผ่าน env เท่านั้น ([[be-config-env]]).
- ผลของ SQL ส่วนใหญ่ใน handler นี้ถูกกลืน (`_, _ =`) และไม่อยู่ใน transaction (ยกเว้น `UpdateDatabase`, `SaveMenuPermissions`) → สำเร็จบางส่วนแต่ตอบ `ok:true` ได้ (เช่น `DeleteUser`, `CreateDatabase` ส่วน grant).
- ปุ่มลบ/แก้ Provider และลบฐานในหน้าจอไม่ทำสิ่งที่ชื่อบอกครบ (stub / ลบแค่แถวรายการ) — ตรวจก่อนอธิบายให้ผู้ใช้.
- `ListUsers`/`CreateUser`/`UpdateUser` รัน `ALTER TABLE` ทุกครั้ง; `database-info` เปิด pool หลายฐานในคำขอเดียวและ pool ไม่ถูกปล่อยคืน ([[be-db-pool-manager]]).
- `CONTEXT.md`/`docs/PLAN.md` อธิบาย admin เป็นแค่ `/admin/providers`; โค้ดปัจจุบันมีชุด `/api/v1/admin/*` เต็ม — ให้ยึดโค้ด.

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/router.go:213-250` — route และ `AdminAuth` ของกลุ่ม; `:114-119` `/admin/providers` (use case).
- `backend/internal/adapter/inbound/http/middleware/adminauth.go:13-31` — header, fail-closed, constant-time compare.
- `backend/internal/adapter/inbound/http/admin/handler.go:22-85` — `validDBNameRe`, `Handler`, `openPool`, `writeOK/writeFail`.
- `backend/internal/adapter/inbound/http/admin/handler.go:88-176` — provider handler (stub ที่ `:165,172`).
- `backend/internal/adapter/inbound/http/admin/handler.go:178-427` — ผู้ใช้ + `syncUserAllowedDatabases`.
- `backend/internal/adapter/inbound/http/admin/handler.go:429-644` — บริษัท + `DatabaseInfo`.
- `backend/internal/adapter/inbound/http/admin/handler.go:646-722` — `MainQuery`.
- `backend/internal/adapter/inbound/http/admin/menu_permissions.go:18-216` — สิทธิ์เมนู/tooltip.

## ดูเพิ่ม

[[backend-overview]] · [[be-http-router-routes]] · [[be-provider-registry]] · [[be-menu-rights-permission]] · [[be-workspace-google]] · [[be-multi-tenant]] · [[adr-index]]
