---
title: "กลุ่มตาราง bc_* — ตัวตน สิทธิ์ และตารางระบบ"
tags: [tables, bc, group, main-db, company-db]
aliases: ["bc_*", "ตาราง bc", "กลุ่มตาราง bc", "Main Database", "ตารางระบบ"]
sources: ["backend/CONTEXT.md", "backend/test/testdata/identity_schema.sql:9", "backend/internal/adapter/outbound/identity/postgres_repository.go:72", "backend/internal/adapter/inbound/http/admin/menu_permissions.go:19", "backend/internal/adapter/inbound/http/admin/menu_permissions.go:58", "backend/internal/adapter/inbound/http/admin/handler.go:658", "backend/internal/application/process/barcode.go:628", "backend/internal/application/process/pos_config.go:275", "backend/internal/application/process/doc_picture.go:30"]
---

# กลุ่มตาราง `bc_*`

ตารางที่ขึ้นต้น `bc_` แบ่งเป็น 2 ที่อยู่ตามสถาปัตยกรรมหลายผู้เช่า (Tenant) — ดู `backend/CONTEXT.md`
- **Main Database** (ฐานตัวตนต่อ Tenant ชื่อรูปแบบ `bcerpmain<รหัส>`): ผู้ใช้ รายชื่อบริษัท สิทธิ์ Google / MCP
- **Company Database** (ฐานบริษัท): ตารางช่วยเหลือที่ผูกกับข้อมูลธุรกิจ (รูปเอกสาร รูปแบบบาร์โค้ด FastReport tooltip ฯลฯ)

ผู้ใช้ระดับ < 9 แตะ `bc_user_list` / `bc_database_list*` ผ่านเกตเวย์ไม่ได้ (query.go:63, 362) และ MCP gateway ห้ามอ่าน `bc_user_list`, `bc_mcp_*`, `bc_google_account` (mcp/gateway.go:30)

## Main Database
- `bc_user_list` — ผู้ใช้ล็อกอิน → [[tbl-bc-user-list]]
- `bc_database_list` — ทะเบียนบริษัท (ชี้ชื่อฐานบริษัทจริง) → [[tbl-bc-database-list]]
- `bc_database_list_user_and_group` — สิทธิ์เข้าบริษัท → [[tbl-bc-database-list-user-and-group]]
- `bc_database_group` — กลุ่มฐานข้อมูล: `group_code`, `group_name` (พบเฉพาะสคีมาทดสอบ identity_schema.sql ไม่พบ SQL ในโค้ดแอป)
- `bc_user_and_group` — สมาชิกกลุ่ม: `user_code`, `group_code`; ใช้หากลุ่มของผู้ใช้เพื่อรวมสิทธิ์เมนู (postgres_repository.go:89) · legacy
- `bc_group_list` — รายชื่อกลุ่ม (`group_code`; อ้างใน menu_permissions.go:20) · legacy
- `bc_permissions_user`, `bc_permissions_group` — สิทธิ์เมนู: `usercode`, `image_file` (BYTEA — บล็อบสิทธิ์รายเมนู ถอดรหัสโดย `menu_rights.go` และ OR รวมทุกเมนู), `database_name` (เพิ่มด้วย ALTER IF NOT EXISTS), `roworder`; แถวกลุ่มใช้ `usercode` เก็บรหัสกลุ่ม (postgres_repository.go:72-95) · legacy · ดู [[proc-permission-rights]]
- `bc_google_account`, `bc_google_workspace_db`, `bc_google_workspace_member` → [[tbl-bc-google-workspace]] (โค้ดสร้างเอง)
- `bc_mcp_access_tokens`, `bc_mcp_token_databases`, `bc_mcp_token_audit` → [[tbl-bc-mcp-tokens]] (โค้ดสร้างเอง)
- `bc_audit_log` — ไม่พบ DDL ในรีโป (ไม่ชัดจากโค้ดว่าคอลัมน์มีอะไร)

## Company Database
- `bc_fastreport` — นิยามรายงาน FastReport ของโปรแกรมเดิม: อ่านคอลัมน์ `report_type`, `menuid`, `menuname` เพื่อทำเมนู "รายงานอื่นๆ/launcher" ของ IC (type 1), CB (type 6), AP/AR, GL/FA, SO/PO (report_menu_*.go) · legacy
- `bc_barcode_print_format` — รูปแบบพิมพ์ป้ายบาร์โค้ด: `code`, `name`, `formatdata` (JSON ของเลย์เอาต์ป้าย), `create_date_time_now`; บันทึกโดยลบแล้วใส่ใหม่ในทรานแซกชัน (barcode.go:628-697) · legacy · ดู [[proc-barcode]]
- `bc_doc_images` — รูปแนบเอกสาร: `roworder`, `image_id` (คีย์เอกสาร), `guid_code`, `image_order`, `image_url`, `image_file` (BYTEA), `create_date_time_now`; **โค้ดสร้างเอง** + ALTER IF NOT EXISTS (pos_config.go:275-287); DDL ในโค้ดระบุ `image_id` VARCHAR(128) แต่คอมเมนต์ doc_picture.go:37 เขียนว่าฐานเดิม varchar(50) (`docPictureKeyLen`) · ดู [[proc-doc-item-pictures]]
- `bc_resource` — ข้อความหลายภาษา: `code`, `name_1`…`name_6`; **โค้ดสร้างเอง** (pos_config.go:359) (ไม่ชัดจากโค้ดว่าใช้แสดงผลที่ใด)
- `bc_tooltip` — ข้อความช่วยเหลือ: `code` (VARCHAR(100) PK), `name_1`, `name_2`; **โค้ดสร้างเอง** (menu_permissions.go:58, 139); เมื่อ SQL ที่แอดมินส่งมาแตะตารางนี้ โค้ดจะเปลี่ยนเป้าหมายเป็นฐานบริษัท (`resolveCompanyDB`, admin/handler.go:658)

## ใช้ร่วมกับระบบอื่น
ชุดตัวตน/สิทธิ์/บริษัทใช้ร่วมกับโปรแกรมเดิม (คอลัมน์ `ignore_sync`, `is_lock_record` เป็นของฝั่งนั้น); ฝั่งเว็บเพิ่มคอลัมน์ `email`, `line_user_id`, `database_name` เองด้วย ALTER IF NOT EXISTS

## ลิงก์
[[tbl-group-erp]] · [[proc-permission-rights]] · [[std-platform-google-login-pdpa-hub]]

## ที่มาในโค้ด

- `backend/CONTEXT.md`
- `backend/test/testdata/identity_schema.sql:9`
- `backend/internal/adapter/outbound/identity/postgres_repository.go:72`
- `backend/internal/adapter/inbound/http/admin/menu_permissions.go:19`
- `backend/internal/adapter/inbound/http/admin/menu_permissions.go:58`
- `backend/internal/adapter/inbound/http/admin/handler.go:658`
- `backend/internal/application/process/barcode.go:628`
- `backend/internal/application/process/pos_config.go:275`
- `backend/internal/application/process/doc_picture.go:30`
