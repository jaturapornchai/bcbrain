---
title: "bc_database_list_user_and_group — สิทธิ์เข้าบริษัท (Access Grant)"
tags: [tables, bc, identity, access-grant, main-db]
aliases: ["bc_database_list_user_and_group", "Access Grant", "สิทธิ์เข้าบริษัท", "user_or_group_code", "user_or_group_status"]
sources: ["scripts/sql/01_main_schema.sql:61", "backend/test/testdata/identity_schema.sql:46", "backend/internal/adapter/outbound/identity/postgres_repository.go:132", "backend/internal/adapter/outbound/identity/postgres_repository.go:144", "backend/internal/adapter/inbound/http/admin/handler.go:376", "backend/internal/adapter/inbound/http/admin/handler.go:502", "backend/internal/adapter/inbound/http/admin/handler.go:588", "backend/internal/adapter/inbound/http/admin/workspace_google.go:634", "backend/internal/domain/query/query.go:63", "backend/CONTEXT.md:31"]
---

# bc_database_list_user_and_group — สิทธิ์เข้าบริษัท

ตารางกำหนดว่า "ผู้ใช้/กลุ่มไหน เข้าบริษัทไหนได้" (Access Grant) อยู่ใน **Main Database** ของ Tenant ตารางนี้ไม่มี `CREATE TABLE` ในโค้ด Go — DDL อยู่ในสคริปต์ `scripts/sql/01_main_schema.sql:61-70` (และสคีมาทดสอบ `identity_schema.sql:46-56`)

## คอลัมน์ (01_main_schema.sql:61-70)
| คอลัมน์ | ชนิด | ความหมาย |
|---|---|---|
| `data_group` | varchar(50) | กลุ่มฐานข้อมูล ↔ `bc_database_list.data_group` |
| `data_code` | varchar(50) | รหัสบริษัท ↔ `bc_database_list.data_code` |
| `user_or_group_code` | varchar(50) | รหัสผู้ใช้ (หรือกลุ่ม) ที่ได้รับสิทธิ์ |
| `user_or_group_status` | smallint | **0 = ใช้งานได้ (active)** — ตรงข้ามกับ `bc_user_list.active_status` ที่ 1 = ใช้งาน (สคริปต์ตั้งค่าเริ่มต้น 0) |
| `roworder`, `ignore_sync`, `is_lock_record`, `create_date_time_now` | — | คอลัมน์ระบบมาตรฐานของทุกตาราง (`docs/kms/KMS_PGSQL_NAMING_CONVENTION.md:48-53`) โค้ด Go ของตารางนี้ไม่ได้อ่าน/เขียน |

สคีมาทดสอบกำหนด PK = (`data_group`, `data_code`, `user_or_group_code`) (`identity_schema.sql:55`) ส่วนสคริปต์ `01_main_schema.sql` ไม่ได้ประกาศ PK

## กฎที่ต้องจำ
- **ล็อกอิน** `AccessibleCompanies` (`postgres_repository.go:132-145`) กรอง `UPPER(data_group)`, `UPPER(user_or_group_code)` และ `COALESCE(status, 1) = 0` — แถวที่ status เป็น NULL จึงถูกมองว่า **ไม่ใช้งาน**; **อ่านเฉพาะสิทธิ์ที่ให้ตรงตัวผู้ใช้ ไม่คลี่สิทธิ์ผ่านสมาชิกกลุ่ม** (คอมเมนต์ `postgres_repository.go:129-131`, `backend/CONTEXT.md:31-33`)
- ฝั่งแอดมิน/Workspace นับ NULL เป็น **ใช้งาน** (`COALESCE(status, 0) = 0` — `handler.go:195`, `workspace_google.go:793`) ซึ่งต่างจากฝั่งล็อกอิน
- เขียนผ่านเกตเวย์ `/query/exec` ได้เฉพาะ `userLevel >= 9` เพราะชื่อตารางตรงกับ `bc_database_list\w*` (`query.go:63`, `ValidateUserLevel` `query.go:360-379`)

## ใครเขียนตารางนี้
| ที่ | ทำอะไร |
|---|---|
| `CreateDatabase` (`handler.go:501-507`) | สร้างบริษัทใหม่แล้วให้สิทธิ์ `SUPERADMIN`, `admin`, `0001` (status 0) อัตโนมัติ |
| `syncUserAllowedDatabases` (`handler.go:376-411`) | บันทึกผู้ใช้: ลบสิทธิ์ status 0 เดิมของผู้ใช้ แล้วใส่ใหม่ตามรายการบริษัทที่เลือก |
| `UpdateDatabase` (`handler.go:563-571`) | ถ้าเปลี่ยน `data_code`/`data_group` ของบริษัท จะแก้แถวสิทธิ์ตามในทรานแซกชันเดียวกัน |
| `DeleteUser` (`handler.go:422`) | ลบสิทธิ์ทุกแถวของผู้ใช้นั้น |
| `DeleteDatabase` (`handler.go:588`) | ลบเฉพาะแถวใน `bc_database_list` — **ไม่ได้ลบแถวสิทธิ์ที่ผูกกับบริษัทนั้น** |
| `WorkspaceCreateDatabase` (`workspace_google.go:629-639`) | สร้าง Workspace ใหม่ ให้สิทธิ์ `SUPERADMIN`, `admin` และผู้ใช้ที่ผูกไว้ |
| `WorkspaceSelectDatabase` (`workspace_google.go:786-801`) | ถ้ายังไม่มีสิทธิ์ของผู้ใช้ที่เลือกเข้า จะเพิ่มให้ |
| `WorkspaceUpsertMember` (`workspace_google.go:1064-1079`) | เพิ่มสมาชิก: ให้สิทธิ์ผู้ใช้ที่ผูกไว้ถ้ายังไม่มี |

## ความสัมพันธ์
[[tbl-bc-user-list]] (`user_code`) · [[tbl-bc-database-list]] (`data_group`+`data_code`)

## ลิงก์
[[tbl-group-bc]] · [[proc-permission-rights]]

## ที่มาในโค้ด

- `scripts/sql/01_main_schema.sql:61-70` DDL ของตาราง
- `backend/test/testdata/identity_schema.sql:46-56` สคีมาทดสอบ (มี PK)
- `backend/internal/adapter/outbound/identity/postgres_repository.go:132-145` `AccessibleCompanies`
- `backend/internal/adapter/inbound/http/admin/handler.go:376-411` `syncUserAllowedDatabases`
- `backend/internal/adapter/inbound/http/admin/handler.go:501-507` ให้สิทธิ์ตอนสร้างบริษัท
- `backend/internal/adapter/inbound/http/admin/handler.go:588` `DeleteDatabase`
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:629-639` สิทธิ์ตอนสร้าง Workspace
- `backend/internal/domain/query/query.go:63` ตารางที่ต้องใช้ระดับ ≥ 9
- `backend/CONTEXT.md:31-33` นิยาม Access Grant
