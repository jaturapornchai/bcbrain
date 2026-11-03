---
title: "bc_google_account / bc_google_workspace_db / bc_google_workspace_member — ล็อกอิน Google และ Workspace"
tags: [tables, bc, google, workspace, created-by-code, main-db]
aliases: ["bc_google_account", "bc_google_workspace_db", "bc_google_workspace_member", "workspace", "ล็อกอินด้วย Google", "mapped_user_code"]
sources: ["backend/internal/adapter/inbound/http/admin/workspace_google.go:36", "backend/internal/adapter/inbound/http/admin/workspace_google.go:133", "backend/internal/adapter/inbound/http/admin/workspace_google.go:297", "backend/internal/adapter/inbound/http/admin/workspace_google.go:612", "backend/internal/adapter/inbound/http/admin/workspace_google.go:643", "backend/internal/adapter/inbound/http/admin/workspace_google.go:839", "backend/internal/adapter/inbound/http/admin/workspace_google.go:1031", "backend/internal/adapter/inbound/http/admin/workspace_google.go:1425", "backend/internal/adapter/inbound/http/admin/handler.go:377", "backend/internal/adapter/inbound/http/mcp/gateway.go:78", "backend/internal/adapter/inbound/http/mcp/gateway.go:87", "backend/internal/adapter/inbound/http/mcp/gateway.go:30"]
---

# ชุดตาราง Google Workspace (bc_google_*)

รองรับการล็อกอินด้วย Google และการสร้าง/เชิญสมาชิกเข้า "Workspace" (ฐานบริษัทที่สร้างอัตโนมัติ) ทั้งสามตาราง **โค้ดสร้างเอง** ด้วย `CREATE TABLE IF NOT EXISTS` ใน `ensureWorkspaceTables` (`workspace_google.go:36-76`) ซึ่งถูกเรียกทุกครั้งที่ endpoint ของ Workspace ทำงาน (เช่น `workspace_google.go:289`, `:617`, `:709`) และตอนแอดมินบันทึกผู้ใช้ (`handler.go:377`); MCP gateway สร้างซ้ำเฉพาะ `bc_google_workspace_db` กับ `bc_google_workspace_member` (`gateway.go:78-103`, ครั้งเดียวต่อ provider ต่อรอบการทำงานของโปรเซส) ไม่สร้าง `bc_google_account` ทั้งหมดอยู่ใน **Main Database** ของ Tenant (เปิดด้วย `h.openPool(..., "")` เป็น `mainPool` — `workspace_google.go:612`, `:704`)

> ไม่บันทึกค่าอีเมล/โทเคนใดๆ ในโน้ตนี้ — เป็นเพียงโครงสร้าง; SQL ที่ AI ส่งผ่าน MCP อ่าน `bc_google_account` ไม่ได้ (`forbiddenReadTables` — `mcp/gateway.go:30`) แต่โค้ดของ gateway เองอ่าน `bc_google_workspace_member` / `bc_google_workspace_db` เพื่อหาฐานที่ผู้ใช้ออกโทเคนได้ (`gateway.go:159-187`)

## bc_google_account — บัญชี Google ที่เคยล็อกอิน
| คอลัมน์ | ชนิด | ความหมาย |
|---|---|---|
| `email` | TEXT **PK** | อีเมลบัญชี Google |
| `google_sub` | TEXT | รหัส subject ของ Google |
| `display_name`, `picture_url` | TEXT | ชื่อ/รูปโปรไฟล์ |
| `line_user_id`, `line_display_name` | TEXT | ผูกบัญชี LINE (ประกาศใน `CREATE TABLE` และมี `ALTER … ADD COLUMN IF NOT EXISTS` ซ้ำ — `workspace_google.go:51-52`) |
| `line_linked_at` | TIMESTAMPTZ | เวลาผูก LINE |
| `created_at`, `last_login_at` | TIMESTAMPTZ | สร้าง/ล็อกอินล่าสุด |

มีดัชนีบางส่วน `idx_bc_google_account_line_uid` บน `line_user_id` (เฉพาะค่าไม่ว่าง — `workspace_google.go:54`)
- **เขียน**: `WorkspaceGoogleLogin` upsert ตาม `email` ทุกครั้งที่ล็อกอิน (`workspace_google.go:297-303`); `WorkspaceBindLineAccount` ผูก/ยกเลิกผูก LINE — 1 LINE ID ผูกได้กับ 1 อีเมล (ล้างอีเมลอื่นที่ถือ LINE ID เดิมก่อน — `workspace_google.go:1424-1427`, upsert `:1435-1449`)
- **อ่าน**: `WorkspaceResolveLineBinding` หาอีเมลจาก LINE ID หรือกลับกัน (`workspace_google.go:1277-1298`) และรายชื่อสมาชิกแสดงชื่อ/รูปจากตารางนี้ (`workspace_google.go:915`)

## bc_google_workspace_db — ทะเบียน Workspace (ฐานบริษัทที่สร้างจาก Google)
`database_name` **PK** (ชื่อฐานบริษัท), `data_code`, `company_name`, `owner_email`, `provider_code` (ค่าเริ่มต้น `bcdemo`), `created_at`
- ลงทะเบียนตอนสร้างบริษัทใน `WorkspaceCreateDatabase` (`workspace_google.go:641-649`, upsert ตาม `database_name`) พร้อมแถวใน `bc_database_list` ([[tbl-bc-database-list]]) และสิทธิ์ใน [[tbl-bc-database-list-user-and-group]]
- ใช้ตรวจว่าชื่อฐานถูกใช้แล้วหรือยัง (`workspace_google.go:360`) และตรวจว่าอีเมลเป็นเจ้าของ Workspace ไหม (`isDatabaseAdmin` — `workspace_google.go:850-858`)

## bc_google_workspace_member — สมาชิก Workspace
`database_name` + `email` **PK คู่**, `role` (ค่าเริ่มต้น `MEMBER`; มีสองค่าที่โค้ดเขียนคือ `ADMIN` / `MEMBER`), `mapped_user_code` (ผูกไปยัง `bc_user_list.user_code` — [[tbl-bc-user-list]]), `invited_by_email`, `created_at`
- **เขียน**: ผู้สร้าง Workspace ลงเป็น `ADMIN` (`workspace_google.go:651-657`); แอดมินของ Workspace เพิ่ม/แก้สมาชิกด้วย `WorkspaceUpsertMember` — role อื่นนอกจาก `ADMIN` ถูกปรับเป็น `MEMBER`, ถ้าไม่ระบุ `mapped_user_code` จะใช้ `SUPERADMIN` (ADMIN) หรือ `0001` (MEMBER) (`workspace_google.go:1014-1038`); `syncUserAllowedDatabases` ของหน้าผู้ใช้เพิ่มแถวให้ผู้ใช้ที่มีอีเมลโดยตั้ง `invited_by_email` เป็น `SYSTEM` (`handler.go:401-409`)
- **ลบ**: `WorkspaceDeleteMember` (`workspace_google.go:1118-1121`) — ทั้งเพิ่มและลบสมาชิกอนุญาตเฉพาะผู้ที่ผ่าน `isDatabaseAdmin` (เป็น `ADMIN` ของ Workspace, เจ้าของ Workspace, ผู้ใช้ `user_level >= 9` หรือรหัส `SUPERADMIN`/`admin` — `workspace_google.go:839-873`)
- **อ่าน**: หา Workspace ที่อีเมลนั้นเข้าได้ และนับสมาชิกต่อ Workspace (`workspace_google.go:133-146`, `:218-221`)

## ลิงก์
[[std-platform-google-login-pdpa-hub]] · [[tbl-group-bc]] · [[tbl-bc-mcp-tokens]]

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/admin/workspace_google.go:36-76` DDL ทั้งสามตาราง (`ensureWorkspaceTables`)
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:133-146` อ่านสมาชิกเพื่อหา Workspace ที่เข้าได้
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:297-303` upsert บัญชี Google ตอนล็อกอิน
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:612-657` ลงทะเบียน Workspace + สมาชิกผู้สร้าง
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:839-873` `isDatabaseAdmin`
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:1031-1038` upsert สมาชิก
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:1424-1449` ผูก LINE กับอีเมล
- `backend/internal/adapter/inbound/http/admin/handler.go:377` เรียก `ensureWorkspaceTables` ตอนบันทึกผู้ใช้
- `backend/internal/adapter/inbound/http/mcp/gateway.go:78-103` MCP gateway สร้างสองตารางซ้ำ
- `backend/internal/adapter/inbound/http/mcp/gateway.go:30` ตารางที่ SQL ผ่าน MCP อ่านไม่ได้
