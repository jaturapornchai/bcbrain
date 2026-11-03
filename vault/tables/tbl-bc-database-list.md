---
title: "bc_database_list — ทะเบียนบริษัท (Company registry)"
tags: [tables, bc, identity, company, main-db]
aliases: ["bc_database_list", "ทะเบียนบริษัท", "data_code", "data_database_name", "data_group", "เลือกบริษัท"]
sources: ["scripts/sql/01_main_schema.sql:49", "backend/test/testdata/identity_schema.sql:33", "backend/internal/domain/identity/identity.go:77", "backend/internal/adapter/outbound/identity/postgres_repository.go:141", "backend/internal/adapter/inbound/http/admin/handler.go:429", "backend/internal/adapter/inbound/http/admin/handler.go:480", "backend/internal/adapter/inbound/http/admin/handler.go:588", "backend/internal/adapter/inbound/http/admin/workspace_google.go:358", "backend/internal/adapter/inbound/http/admin/workspace_google.go:620", "backend/internal/domain/query/query.go:63", "backend/CONTEXT.md:19"]
---

# bc_database_list — ทะเบียนบริษัท

ทะเบียน "บริษัท" ของ Tenant อยู่ใน **Main Database** — หนึ่งแถว = หนึ่งบริษัท บอกชื่อฐานข้อมูลจริงที่เก็บข้อมูลธุรกิจของบริษัทนั้น (Company Database) ตารางนี้ไม่มี `CREATE TABLE` ในโค้ด Go — DDL อยู่ในสคริปต์ `scripts/sql/01_main_schema.sql:49-59` (และสคีมาทดสอบ `identity_schema.sql:33-44`)

## คอลัมน์ (01_main_schema.sql:49-59 + identity.go:77-82)
| คอลัมน์ | ชนิด | ความหมาย |
|---|---|---|
| `data_group` | varchar(50) | กลุ่ม/แพ็กเกจฐานข้อมูล (ใช้คู่กับ `data_code`; เทียบแบบ `UPPER`; NULL ถูกอ่านเป็น `MAIN` ในรายการแอดมิน — `handler.go:437`) |
| `data_code` | varchar(50) | รหัสบริษัท (สคีมาทดสอบกำหนดเป็น PK — `identity_schema.sql:43`; สคริปต์ `01_main_schema.sql` ไม่ได้ประกาศ PK) |
| `data_name` | varchar(150) | ชื่อบริษัท |
| `data_database_name` | varchar(100) | **ชื่อ PostgreSQL database จริงของบริษัท** (ที่ใช้เปิด Company pool) |
| `last_database_xml_update` | timestamp | โค้ดตั้งเป็นเวลาปัจจุบันตอนสร้างบริษัท (`handler.go:494`, `workspace_google.go:620`) ไม่พบโค้ดเว็บที่อ่านค่านี้ต่อ |
| `roworder` | serial | ใช้เรียงลำดับในรายการบริษัท (`ORDER BY dl.roworder` — `postgres_repository.go:145`) |
| `ignore_sync`, `is_lock_record`, `create_date_time_now` | — | คอลัมน์ระบบมาตรฐานของทุกตาราง (`docs/kms/KMS_PGSQL_NAMING_CONVENTION.md:48-53`) เว็บไม่ได้ใช้ |

## ใครใช้
- หลังล็อกอิน: `AccessibleCompanies` JOIN ตารางนี้กับ [[tbl-bc-database-list-user-and-group]] เพื่อได้รายการบริษัทที่ผู้ใช้เข้าได้ (`postgres_repository.go:132-145`)
- แอดมินจัดการบริษัท: `ListDatabases` (`handler.go:429-464`), `CreateDatabase` (`handler.go:467-514`), `UpdateDatabase` (`handler.go:517-577`), `DeleteDatabase` (`handler.go:580-590`)
- `CreateDatabase` ปฏิเสธชื่อฐานที่ไม่ตรง `^[a-z0-9_]{1,63}$` หรือขึ้นต้นด้วย `bcerpmain` (`handler.go:480-483`) แล้วใส่ `data_group` เป็น `MAIN` ถ้าไม่ระบุ และให้สิทธิ์ `SUPERADMIN`/`admin`/`0001` อัตโนมัติ
- `DeleteDatabase` ลบเฉพาะแถวในตารางนี้ (`handler.go:588`) ไม่ได้ DROP ฐานบริษัท และไม่ได้ลบสิทธิ์ใน [[tbl-bc-database-list-user-and-group]]
- Workspace Google สร้างฐานบริษัทใหม่ (`CREATE DATABASE`) แล้วลงทะเบียนที่นี่ด้วย `data_group = 'MAIN'` (`workspace_google.go:612-623`); ตรวจชื่อซ้ำจากตารางนี้ก่อนสร้าง (`workspace_google.go:358`)
- MCP gateway อ่านตารางนี้เพื่อหาฐานที่ผู้ใช้ออกโทเคนได้ (`mcp/gateway.go:212-214`) — ดู [[tbl-bc-mcp-tokens]]
- เขียนผ่านเกตเวย์ `/query/exec` ได้เฉพาะ `userLevel >= 9` (`query.go:63`, `ValidateUserLevel` `query.go:360-379`)

## ความสัมพันธ์
`data_database_name` → ฐานบริษัท (erp_*, ic_*, gl_* ดู [[tbl-group-erp]]); ผู้ใช้ผ่าน [[tbl-bc-user-list]]

## ลิงก์
[[tbl-group-bc]] · [[be-hexagonal-architecture]]

## ที่มาในโค้ด

- `scripts/sql/01_main_schema.sql:49-59` DDL ของตาราง
- `backend/test/testdata/identity_schema.sql:33-44` สคีมาทดสอบ (มี PK)
- `backend/internal/domain/identity/identity.go:77-82` struct `Company`
- `backend/internal/adapter/outbound/identity/postgres_repository.go:138-145` query รายการบริษัทที่เข้าได้
- `backend/internal/adapter/inbound/http/admin/handler.go:429-590` จัดการบริษัทโดยแอดมิน
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:612-623` ลงทะเบียนบริษัทของ Workspace
- `backend/internal/domain/query/query.go:63` ตารางที่ต้องใช้ระดับ ≥ 9
- `backend/CONTEXT.md:19-21` นิยาม Company
