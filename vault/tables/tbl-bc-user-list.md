---
title: "bc_user_list — ผู้ใช้ล็อกอิน (Main Database ของ Tenant)"
tags: [tables, bc, identity, login, main-db]
aliases: ["bc_user_list", "ผู้ใช้ระบบ", "user_code", "user_level", "ล็อกอิน", "ตารางผู้ใช้"]
sources: ["scripts/sql/01_main_schema.sql:195", "backend/test/testdata/identity_schema.sql:9", "backend/internal/adapter/outbound/identity/postgres_repository.go:42", "backend/internal/domain/identity/identity.go:63", "backend/internal/application/identity/service.go:164", "backend/internal/adapter/inbound/http/admin/handler.go:185", "backend/internal/adapter/inbound/http/admin/handler.go:257", "backend/internal/adapter/inbound/http/admin/handler.go:268", "backend/internal/adapter/inbound/http/admin/handler.go:283", "backend/internal/adapter/inbound/http/admin/workspace_google.go:38", "backend/internal/adapter/inbound/http/admin/workspace_google.go:39", "backend/internal/adapter/inbound/http/admin/workspace_google.go:774", "backend/internal/domain/query/query.go:63", "backend/internal/adapter/inbound/http/mcp/gateway.go:30", "backend/internal/adapter/inbound/http/mcp/gateway.go:204", "backend/CONTEXT.md:27"]
---

# bc_user_list — ผู้ใช้ล็อกอิน

ทะเบียนผู้ใช้ที่ล็อกอินเข้าระบบ อยู่ใน **Main Database ของ Tenant** (ฐานตัวตนต่อ Tenant — `backend/CONTEXT.md:15-17, 27-29`) ไม่ใช่ฐานบริษัท ผู้ใช้หนึ่งคนถูกผูกกับบริษัทผ่าน [[tbl-bc-database-list-user-and-group]] ตารางนี้ไม่มี `CREATE TABLE` ในโค้ด Go — DDL อยู่ในสคริปต์ `scripts/sql/01_main_schema.sql:195-206` ส่วนคอลัมน์ `email`, `line_user_id` และขนาด `user_password` โค้ดเพิ่ม/ขยายเองด้วย `ALTER`

## คอลัมน์
(ชนิดจากสคริปต์ `01_main_schema.sql:195-206`, สคีมาทดสอบ `identity_schema.sql:9-21` และ `ALTER` ในโค้ด)
| คอลัมน์ | ชนิด | ความหมายตามโค้ด |
|---|---|---|
| `user_code` | varchar(50) | รหัสผู้ใช้ (PK ในสคีมาทดสอบ — `identity_schema.sql:20`) — ค้นแบบไม่สนตัวพิมพ์ (`UPPER`) ใน `FindByCode`; ตอนแอดมินสร้างผู้ใช้ รหัสยาวเกิน 50 ตัวอักษรหรือซ้ำ (เทียบแบบ `UPPER`) จะถูกปฏิเสธ (`handler.go:263`, `:268-275`) |
| `user_name` | varchar(100) | ชื่อ |
| `user_password` | varchar(25) ในสคริปต์ → โค้ดแอดมิน `ALTER` เป็น VARCHAR(255) (`handler.go:257`, `:331`) | รหัสผ่าน · **ห้ามเปิดเผยค่า** — แอดมินสร้าง/แก้รหัสผ่านจะเก็บเป็นแฮช bcrypt (`HashPassword` — `identity.go:48-59`; `handler.go:283`, `:340`) ตอนล็อกอินรองรับทั้งค่าแฮชและค่าข้อความตรงๆ (`identity.go:63-72`) |
| `user_level` | smallint | ระดับ — **≥ 9 = แอดมินเว็บ** (`webAdminLevel`, `application/identity/service.go:162-164`, ใช้ที่ `:175`) |
| `active_status` | smallint | 1 = ใช้งาน (`StatusActive` — `identity.go:30`); ล็อกอินไม่ผ่านถ้าไม่ใช่ 1 (`identity.go:65`) |
| `device_id` | varchar(200) | รหัสอุปกรณ์ (ไม่พบโค้ดเว็บที่อ่านหรือเขียนคอลัมน์นี้) |
| `email` | TEXT | เพิ่มด้วย `ALTER … ADD COLUMN IF NOT EXISTS` (`handler.go:185`, `workspace_google.go:38`) |
| `line_user_id` | TEXT | ผูก LINE — `ALTER … IF NOT EXISTS` (`workspace_google.go:39`) |
| `roworder` | serial | ใช้เรียงรายการผู้ใช้ในหน้าแอดมิน (`ORDER BY u.roworder` — `handler.go:200`) |
| `ignore_sync`, `is_lock_record`, `create_date_time_now` | — | คอลัมน์ระบบมาตรฐานของทุกตาราง (`docs/kms/KMS_PGSQL_NAMING_CONVENTION.md:48-53`) เว็บไม่ได้ใช้ |

ค่า NULL ของ `user_level`/`active_status` ถูกตีความต่างกัน: ล็อกอินใช้ `COALESCE(..., 0)` (ไม่ใช้งาน) ที่ `postgres_repository.go:51` ส่วนหน้ารายการผู้ใช้ของแอดมินใช้ `COALESCE(u.active_status, 1)` (ใช้งาน) ที่ `handler.go:187`

## ใครอ่าน/เขียน
- ล็อกอิน: `UserRepository.FindByCode` (`postgres_repository.go:42-64`) แล้ว `User.Authenticate` ตรวจสถานะ+รหัสผ่าน (`identity.go:63-72`)
- แอดมินดู/เพิ่ม/แก้/ลบผู้ใช้: `ListUsers` (`handler.go:178-233`), `CreateUser` (`:236-307`), `UpdateUser` (`:310-374`), `DeleteUser` (`:414-426` — ลบสิทธิ์เข้าบริษัท, สมาชิกกลุ่มใน `bc_user_and_group` แล้วจึงลบผู้ใช้)
- Workspace Google: เลือกฐานแล้วยังไม่มีผู้ใช้ตามรหัสที่ใช้ → เพิ่มแถวใหม่ (ADMIN ของ Workspace ได้ `user_level` 9) (`workspace_google.go:757-778`); เพิ่มสมาชิกที่ผูกรหัสผู้ใช้ที่ยังไม่มี → สร้างแถว ถ้ามีอยู่แล้วตั้ง `active_status = 1` และเติม `email` ถ้ายังว่าง (`workspace_google.go:1043-1062`); แถวที่สองกรณีนี้สร้างให้ใช้รหัสผ่านเริ่มต้นที่ฝังในโค้ดโดยไม่ผ่านแฮช (ค่าไม่บันทึกในโน้ตนี้); ผูก LINE เขียน `line_user_id` ตาม `email` (`workspace_google.go:1456-1459`)
- MCP gateway: โค้ดอ่าน `user_level`/`email` ของผู้ออกโทเคนเพื่อหาฐานที่ออกโทเคนได้ (`mcp/gateway.go:204`) แต่ SQL ที่ AI ส่งผ่าน MCP อ่านตารางนี้ไม่ได้ (`forbiddenReadTables` — `gateway.go:30`)
- ความปลอดภัย: เขียนผ่านเกตเวย์ `/query/exec` ได้เฉพาะ `userLevel >= 9` (`domain/query/query.go:63`, `ValidateUserLevel` `:360-379`)

## ความสัมพันธ์
- → [[tbl-bc-database-list-user-and-group]] (`user_or_group_code`) กำหนดบริษัทที่เข้าได้
- → สิทธิ์เมนู `bc_permissions_user` (`usercode`) และกลุ่ม `bc_user_and_group` ([[tbl-group-bc]], [[proc-permission-rights]])
- → `bc_google_workspace_member.mapped_user_code` ผูกอีเมล Google เข้ากับรหัสผู้ใช้ ([[tbl-bc-google-workspace]])
- `erp_user` ([[tbl-erp-user]]) เป็นข้อมูลพนักงานระดับบริษัท คนละตาราง

## ลิงก์
[[tbl-bc-database-list]] · [[std-security-authz-and-web-vulns]] · [[tbl-group-bc]]

## ที่มาในโค้ด

- `scripts/sql/01_main_schema.sql:195-206` DDL ของตาราง
- `backend/test/testdata/identity_schema.sql:9-21` สคีมาทดสอบ (มี PK)
- `backend/internal/adapter/outbound/identity/postgres_repository.go:42-64` `FindByCode`
- `backend/internal/domain/identity/identity.go:48-72` แฮชและตรวจรหัสผ่าน
- `backend/internal/application/identity/service.go:162-164` ระดับแอดมินเว็บ
- `backend/internal/adapter/inbound/http/admin/handler.go:178-426` จัดการผู้ใช้โดยแอดมิน
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:38-39` `ALTER` เพิ่ม `email`, `line_user_id`
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:757-778` สร้างผู้ใช้ตอนเลือกฐาน Workspace
- `backend/internal/domain/query/query.go:63` ตารางที่ต้องใช้ระดับ ≥ 9
- `backend/internal/adapter/inbound/http/mcp/gateway.go:30` ตารางที่ SQL ผ่าน MCP อ่านไม่ได้
- `backend/CONTEXT.md:27-29` นิยามผู้ใช้
