---
title: "bc_database_list_user_and_group — สิทธิ์เข้าบริษัท (Access Grant)"
tags: [tables, bc, identity, access-grant, main-db]
aliases: ["bc_database_list_user_and_group", "Access Grant", "สิทธิ์เข้าบริษัท", "user_or_group_code", "user_or_group_status"]
sources: ["backend/test/testdata/identity_schema.sql:47", "backend/internal/adapter/outbound/identity/postgres_repository.go:140", "backend/internal/adapter/inbound/http/admin/handler.go:438", "backend/internal/domain/query/query.go:63", "backend/CONTEXT.md"]
---

# bc_database_list_user_and_group — สิทธิ์เข้าบริษัท

ตารางกำหนดว่า "ผู้ใช้/กลุ่มไหน เข้าบริษัทไหนได้" (Access Grant) อยู่ใน **Main Database** ตารางเดิม (legacy)

## คอลัมน์ (identity_schema.sql:47-57)
| คอลัมน์ | ชนิด | ความหมาย |
|---|---|---|
| `data_group` | varchar(50) | กลุ่มฐานข้อมูล ↔ `bc_database_list.data_group` |
| `data_code` | varchar(50) | รหัสบริษัท ↔ `bc_database_list.data_code` |
| `user_or_group_code` | varchar(50) | รหัสผู้ใช้ (หรือกลุ่ม) ที่ได้รับสิทธิ์ |
| `user_or_group_status` | smallint | **0 = ใช้งานได้ (active)** — ตรงข้ามกับ `bc_user_list.active_status` ที่ 1 = ใช้งาน; NULL ถูกมองเป็น 1 (ไม่ใช้งาน) เพราะโค้ดใช้ `COALESCE(status,1) = 0` |
| `roworder`, `ignore_sync`, `is_lock_record`, `create_date_time_now` | — | ฝั่งโปรแกรมเดิม |

PK = (`data_group`, `data_code`, `user_or_group_code`)

## กฎที่ต้องจำ
- `AccessibleCompanies` (postgres_repository.go:140-146) กรอง `UPPER(data_group)`, `UPPER(user_or_group_code)` และ `status = 0` — **อ่านเฉพาะสิทธิ์ที่ให้ตรงตัวผู้ใช้ ไม่คลี่สิทธิ์ผ่านสมาชิกกลุ่ม** (ตามคอมเมนต์ในโค้ดและ CONTEXT.md)
- แอดมินให้/ถอนสิทธิ์: admin/handler.go:438-588
- เขียนผ่านเกตเวย์ได้เฉพาะ `userLevel >= 9` (query.go:63, 362)

## ความสัมพันธ์
[[tbl-bc-user-list]] (`user_code`) · [[tbl-bc-database-list]] (`data_group`+`data_code`)

## ลิงก์
[[tbl-group-bc]] · [[proc-permission-rights]]

## ที่มาในโค้ด

- `backend/test/testdata/identity_schema.sql:47`
- `backend/internal/adapter/outbound/identity/postgres_repository.go:140`
- `backend/internal/adapter/inbound/http/admin/handler.go:438`
- `backend/internal/domain/query/query.go:63`
- `backend/CONTEXT.md`
