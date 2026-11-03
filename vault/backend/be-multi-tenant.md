---
title: "โมเดลผู้เช่าหลายราย: Tenant, Provider, Main DB, Company (Multi-tenant model)"
tags: [backend, tenant, multi-tenant, database, identity]
aliases: ["tenant", "provider code", "main database", "bcerpmain", "company database", "data group", "datagroup", "ผู้เช่า", "ฐานข้อมูลหลัก"]
sources: ["backend/CONTEXT.md:7", "backend/internal/application/identity/service.go:17", "backend/internal/domain/tenant/provider.go:21", "backend/internal/adapter/outbound/identity/postgres_repository.go:132", "backend/internal/adapter/inbound/http/admin/handler.go:55"]
---

# โมเดลผู้เช่าหลายราย (Multi-tenant)

ระบบแยกลูกค้าแต่ละรายเป็น **Tenant** โดยแต่ละ Tenant มีฐานข้อมูล PostgreSQL ของตัวเอง ไม่ใช้ตารางร่วมกัน. ตัวระบุ Tenant คือ **Provider Code** (ตัวพิมพ์ใหญ่/เลข 2-20 ตัว) ซึ่งตรงกับ claim `tenantId` ใน JWT. ฐานข้อมูลมี 2 ระดับ: Main Database (ผู้ใช้/สิทธิ์/รายชื่อบริษัท) และ Company Database (ข้อมูลบัญชีของแต่ละบริษัท).

## ทำงานอย่างไร

1. ผู้ดูแลลงทะเบียน Provider (code + ชื่อ + connection ไปยัง PostgreSQL ของ Tenant) → เก็บเป็นไฟล์ ดู [[be-provider-registry]].
2. ตอน login ระบบรับ `provider` + `dataGroup` + `username` + `password` แล้ว:
   - ดึง connection ของ Provider (`ResolveConnection`).
   - คำนวณชื่อ Main Database = `"bcerpmain" + lower(providerCode)` (`application/identity/service.go:20,57`) — **สูตรตายตัว ไม่เก็บในไฟล์ config**. admin ใช้สูตรเดียวกัน (`admin/handler.go:55,105,128`).
   - อ่านผู้ใช้จาก Main DB (`bc_user_list`) แล้วหาบริษัทที่ผู้ใช้เข้าได้ ([[be-identity-login-flow]]).
3. บริษัทที่เลือก → `DatabaseName` = `bc_database_list.data_database_name` (ชื่อฐานข้อมูลของบริษัท) ถูกฝังใน access token claim `databaseName` ([[be-jwt-session-tokens]]).
4. คำขอ `/query`, `/blob`, `/process` ใช้ claim `databaseName` นี้เปิด pool ไปยัง Company DB ด้วย connection ของ Provider เดิม (เปลี่ยนแค่ชื่อฐานข้อมูล) ([[be-db-pool-manager]]).

## ตารางใน Main Database ที่โค้ด backend ใช้

| ตาราง | ใช้ทำอะไร | ที่มา |
|---|---|---|
| `bc_user_list` | ผู้ใช้: `user_code`, `user_name`, `user_password`, `user_level`, `active_status` | `postgres_repository.go:50-53` |
| `bc_database_list` | รายชื่อบริษัท: `data_code`, `data_group`, `data_name`, `data_database_name`, `roworder` | `postgres_repository.go:138-145` |
| `bc_database_list_user_and_group` | สิทธิ์เข้าบริษัท: `user_or_group_code`, `user_or_group_status` | `postgres_repository.go:138-145` |
| `bc_permissions_user` / `bc_permissions_group` / `bc_user_and_group` | สิทธิ์เมนู (blob `image_file`) ของผู้ใช้/กลุ่ม | [[be-menu-rights-permission]] |

## คำศัพท์ (ตาม `CONTEXT.md`)

- **Tenant / Provider**: ลูกค้าหนึ่งรายที่ลงทะเบียนไว้; Provider Code เป็นตัวระบุหลัก (`CONTEXT.md:7`).
- **Main Database**: ฐานข้อมูลควบคุมของ Tenant (ผู้ใช้ กลุ่ม สิทธิ์ รายชื่อบริษัท).
- **Company / Company Database**: บริษัทหนึ่งแห่งที่ผู้ใช้เลือกทำงานด้วย.
- **DataGroup**: ตัวกรองกลุ่มของ `bc_database_list.data_group` (เทียบแบบไม่สนตัวพิมพ์ `UPPER(...)`).
- **Pre-auth token**: โทเค็นสั้นหลังรหัสผ่านถูก แต่ยังไม่เลือกบริษัท ([[be-jwt-session-tokens]]).

## กติกา/ข้อควรระวัง

- Provider Code ต้องตรง `^[A-Z0-9]{2,20}$` (`domain/tenant/provider.go:21`) และถูก `ToUpper(TrimSpace)` ก่อนตรวจ (`:70-74`).
- admin ห้ามสร้างฐานข้อมูลบริษัทที่ชื่อขึ้นต้น `bcerpmain` (`admin/handler.go:480`) เพื่อกันชนกับ Main DB ([[be-admin-api]]).
- ADR ที่เกี่ยวข้อง: [[adr-0003-per-tenant-identity]], [[adr-0001-provider-config-json-files]].

## ที่มาในโค้ด

- `backend/CONTEXT.md:7-41` — คำศัพท์โดเมน.
- `backend/internal/application/identity/service.go:17-20,57,123,182,199` — สูตรชื่อ Main DB.
- `backend/internal/domain/tenant/provider.go:21,70-97` — รูปแบบ code และ `Provider`.
- `backend/internal/adapter/outbound/identity/postgres_repository.go:42,132` — query ผู้ใช้/บริษัท.
- `backend/internal/adapter/inbound/http/admin/handler.go:55,105,480` — admin ใช้สูตร Main DB และห้ามชื่อซ้ำ.

## ดูเพิ่ม

[[backend-overview]] · [[be-provider-registry]] · [[be-identity-login-flow]] · [[be-db-pool-manager]] · [[adr-index]]
