---
title: "bc_user_list — ผู้ใช้ล็อกอิน (Main Database ของ Tenant)"
tags: [tables, bc, identity, login, main-db]
aliases: ["bc_user_list", "ผู้ใช้ระบบ", "user_code", "user_level", "ล็อกอิน", "ตารางผู้ใช้"]
sources: ["backend/test/testdata/identity_schema.sql:9", "backend/internal/adapter/outbound/identity/postgres_repository.go:39", "backend/internal/application/identity/service.go:162", "backend/internal/adapter/inbound/http/admin/handler.go:185", "backend/internal/adapter/inbound/http/admin/handler.go:257", "backend/internal/adapter/inbound/http/admin/handler.go:268", "backend/internal/adapter/inbound/http/admin/workspace_google.go:38", "backend/internal/domain/query/query.go:63", "backend/internal/adapter/inbound/http/mcp/gateway.go:30", "backend/CONTEXT.md"]
---

# bc_user_list — ผู้ใช้ล็อกอิน

ทะเบียนผู้ใช้ที่ล็อกอินเข้าระบบ อยู่ใน **Main Database ของ Tenant** (ฐานตัวตนต่อ Tenant — ตาม `backend/CONTEXT.md`) ไม่ใช่ฐานบริษัท ผู้ใช้หนึ่งคนถูกผูกกับบริษัทผ่าน [[tbl-bc-database-list-user-and-group]] ตารางเดิม (legacy) ที่โค้ดเพิ่มคอลัมน์เองบางส่วน

## คอลัมน์
(ชนิดจาก schema ทดสอบ `identity_schema.sql:9-21` + ALTER ในโค้ด)
| คอลัมน์ | ชนิด | ความหมายตามโค้ด |
|---|---|---|
| `user_code` | varchar(50) **PK** | รหัสผู้ใช้ — ค้นแบบไม่สนตัวพิมพ์ (`UPPER`) ใน FindByCode |
| `user_name` | varchar(100) | ชื่อ |
| `user_password` | varchar(25) ในสคีมาทดสอบ → โค้ดแอดมิน ALTER เป็น VARCHAR(255) (handler.go:257) | รหัสผ่าน · **ห้ามเปิดเผยค่า** |
| `user_level` | smallint | ระดับ — **≥ 9 = แอดมินเว็บ** (application/identity/service.go:162) |
| `active_status` | smallint | 1 = ใช้งาน |
| `device_id` | varchar(200) | รหัสอุปกรณ์ (ไม่ชัดจากโค้ดว่าใช้ทำอะไรต่อ) |
| `email` | TEXT | เพิ่มด้วย `ALTER … ADD COLUMN IF NOT EXISTS` (handler.go:185, workspace_google.go:38) |
| `line_user_id` | TEXT | ผูก LINE — ALTER IF NOT EXISTS (workspace_google.go:39) |
| `ignore_sync`, `is_lock_record`, `roworder`, `create_date_time_now` | — | คอลัมน์ฝั่งโปรแกรมเดิม ไม่ใช้ในเว็บ (ตามคอมเมนต์ในสคีมาทดสอบ) |

## ใครอ่าน/เขียน
- ล็อกอิน: `UserRepository.FindByCode` (postgres_repository.go:39-62)
- แอดมินเพิ่ม/แก้/ลบผู้ใช้: admin/handler.go:268-424
- workspace Google ผูก/สร้างผู้ใช้จากอีเมล (workspace_google.go)
- ความปลอดภัย: เขียนผ่านเกตเวย์ `/query/exec` ได้เฉพาะ `userLevel >= 9` (domain/query/query.go:63, 362); **MCP gateway ห้ามอ่านตารางนี้** (mcp/gateway.go:30)

## ความสัมพันธ์
- → [[tbl-bc-database-list-user-and-group]] (`user_or_group_code`) กำหนดบริษัทที่เข้าได้
- → สิทธิ์เมนู `bc_permissions_user` (`usercode`) และกลุ่ม `bc_user_and_group` ([[tbl-group-bc]], [[proc-permission-rights]])
- `erp_user` ([[tbl-erp-user]]) เป็นข้อมูลพนักงานระดับบริษัท คนละตาราง

## ลิงก์
[[tbl-bc-database-list]] · [[std-security-authz-and-web-vulns]] · [[tbl-group-bc]]

## ที่มาในโค้ด

- `backend/test/testdata/identity_schema.sql:9`
- `backend/internal/adapter/outbound/identity/postgres_repository.go:39`
- `backend/internal/application/identity/service.go:162`
- `backend/internal/adapter/inbound/http/admin/handler.go:185`
- `backend/internal/adapter/inbound/http/admin/handler.go:257`
- `backend/internal/adapter/inbound/http/admin/handler.go:268`
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:38`
- `backend/internal/domain/query/query.go:63`
- `backend/internal/adapter/inbound/http/mcp/gateway.go:30`
- `backend/CONTEXT.md`
