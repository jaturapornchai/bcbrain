---
title: "bc_database_list — ทะเบียนบริษัท (Company registry)"
tags: [tables, bc, identity, company, main-db]
aliases: ["bc_database_list", "ทะเบียนบริษัท", "data_code", "data_database_name", "data_group", "เลือกบริษัท"]
sources: ["backend/test/testdata/identity_schema.sql:34", "backend/internal/domain/identity/identity.go:75", "backend/internal/adapter/inbound/http/admin/handler.go:438", "backend/internal/adapter/inbound/http/admin/workspace_google.go:620", "backend/internal/domain/query/query.go:63", "backend/CONTEXT.md"]
---

# bc_database_list — ทะเบียนบริษัท

ทะเบียน "บริษัท" ของ Tenant อยู่ใน **Main Database** — หนึ่งแถว = หนึ่งบริษัท บอกชื่อฐานข้อมูลจริงที่เก็บข้อมูลธุรกิจของบริษัทนั้น (Company Database) ตารางเดิม (legacy)

## คอลัมน์ (identity_schema.sql:34-45 + identity.go:75-81)
| คอลัมน์ | ชนิด | ความหมาย |
|---|---|---|
| `data_group` | varchar(50) | กลุ่ม/แพ็กเกจฐานข้อมูล (ใช้คู่กับ `data_code`; เทียบแบบ `UPPER`) |
| `data_code` | varchar(50) **PK** | รหัสบริษัท |
| `data_name` | varchar(150) | ชื่อบริษัท |
| `data_database_name` | varchar(100) | **ชื่อ PostgreSQL database จริงของบริษัท** (ที่ใช้เปิด Company pool) |
| `last_database_xml_update` | timestamp | เวลาอัปเดต XML ของฐาน (ไม่ชัดจากโค้ดว่าเว็บใช้อย่างไร) |
| `roworder` | bigserial | ใช้เรียงลำดับในรายการบริษัท (`ORDER BY dl.roworder`) |
| `ignore_sync`, `is_lock_record`, `create_date_time_now` | — | ฝั่งโปรแกรมเดิม |

## ใครใช้
- หลังล็อกอิน: `AccessibleCompanies` JOIN ตารางนี้กับ [[tbl-bc-database-list-user-and-group]] เพื่อได้รายการบริษัทที่ผู้ใช้เข้าได้ (postgres_repository.go:140-146)
- แอดมินจัดการบริษัท: admin/handler.go:438-588
- workspace Google สร้างฐานบริษัทใหม่แล้วลงทะเบียนที่นี่ (workspace_google.go:620)
- เขียนผ่านเกตเวย์ได้เฉพาะ `userLevel >= 9` (query.go:63, 362)

## ความสัมพันธ์
`data_database_name` → ฐานบริษัท (erp_*, ic_*, gl_* ดู [[tbl-group-erp]]); ผู้ใช้ผ่าน [[tbl-bc-user-list]]

## ลิงก์
[[tbl-group-bc]] · [[be-hexagonal-architecture]]

## ที่มาในโค้ด

- `backend/test/testdata/identity_schema.sql:34`
- `backend/internal/domain/identity/identity.go:75`
- `backend/internal/adapter/inbound/http/admin/handler.go:438`
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:620`
- `backend/internal/domain/query/query.go:63`
- `backend/CONTEXT.md`
