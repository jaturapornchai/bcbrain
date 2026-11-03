---
title: "bc_google_account / bc_google_workspace_db / bc_google_workspace_member — ล็อกอิน Google และ Workspace"
tags: [tables, bc, google, workspace, created-by-code, main-db]
aliases: ["bc_google_account", "bc_google_workspace_db", "bc_google_workspace_member", "workspace", "ล็อกอินด้วย Google", "mapped_user_code"]
sources: ["backend/internal/adapter/inbound/http/admin/workspace_google.go:36", "backend/internal/adapter/inbound/http/admin/workspace_google.go:133", "backend/internal/adapter/inbound/http/admin/workspace_google.go:641", "backend/internal/adapter/inbound/http/admin/workspace_google.go:617", "backend/internal/adapter/inbound/http/mcp/gateway.go:87", "backend/internal/adapter/inbound/http/mcp/gateway.go:30"]
---

# ชุดตาราง Google Workspace (bc_google_*)

รองรับการล็อกอินด้วย Google และการสร้าง/เชิญสมาชิกเข้า "Workspace" (ฐานบริษัทที่สร้างอัตโนมัติ) ทั้งสามตาราง **โค้ดสร้างเอง** (`CREATE TABLE IF NOT EXISTS` ใน `ensureWorkspaceTables`, workspace_google.go:36-72; MCP gateway สร้างซ้ำที่ gateway.go:87/95) อยู่ใน **Main Database** ของ Tenant (เรียกด้วย `mainPool` — workspace_google.go:617, 709)

> ไม่บันทึกค่าอีเมล/โทเคนใดๆ ในโน้ตนี้ — เป็นเพียงโครงสร้าง; MCP gateway ห้ามอ่าน `bc_google_account` (mcp/gateway.go:30)

## bc_google_account — บัญชี Google ที่เคยล็อกอิน
| คอลัมน์ | ชนิด | ความหมาย |
|---|---|---|
| `email` | TEXT **PK** | อีเมลบัญชี Google |
| `google_sub` | TEXT | รหัส subject ของ Google |
| `display_name`, `picture_url` | TEXT | ชื่อ/รูปโปรไฟล์ |
| `line_user_id`, `line_display_name` | TEXT | ผูกบัญชี LINE (เพิ่มด้วย ALTER IF NOT EXISTS) |
| `line_linked_at` | TIMESTAMPTZ | เวลาผูก LINE |
| `created_at`, `last_login_at` | TIMESTAMPTZ | สร้าง/ล็อกอินล่าสุด |

มีดัชนีบางส่วนบน `line_user_id` (เฉพาะค่าไม่ว่าง)

## bc_google_workspace_db — ทะเบียน Workspace (ฐานบริษัทที่สร้างจาก Google)
`database_name` **PK** (ชื่อฐานบริษัท), `data_code`, `company_name`, `owner_email`, `provider_code` (ค่าเริ่มต้น `bcdemo`), `created_at` — ลงทะเบียนตอนสร้างบริษัท (workspace_google.go:641-650) พร้อมแถวใน `bc_database_list` ([[tbl-bc-database-list]])

## bc_google_workspace_member — สมาชิก Workspace
`database_name` + `email` **PK คู่**, `role` (ค่าเริ่มต้น `MEMBER`; ผู้สร้างลงเป็น ADMIN), `mapped_user_code` (ผูกไปยัง `bc_user_list.user_code` — [[tbl-bc-user-list]]), `invited_by_email`, `created_at`
- ใช้หา Workspace ที่อีเมลนั้นเข้าได้ และนับสมาชิกต่อ Workspace (workspace_google.go:133-145, 218-221)

## ลิงก์
[[std-platform-google-login-pdpa-hub]] · [[tbl-group-bc]]

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/admin/workspace_google.go:36`
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:133`
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:641`
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:617`
- `backend/internal/adapter/inbound/http/mcp/gateway.go:87`
- `backend/internal/adapter/inbound/http/mcp/gateway.go:30`
