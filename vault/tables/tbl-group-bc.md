---
title: "กลุ่มตาราง bc_* — ตัวตน สิทธิ์ และตารางระบบ"
tags: [tables, bc, group, main-db, company-db]
aliases: ["bc_*", "ตาราง bc", "กลุ่มตาราง bc", "Main Database", "ตารางระบบ"]
sources: ["backend/CONTEXT.md:15", "scripts/sql/01_main_schema.sql:72", "scripts/sql/01_main_schema.sql:118", "scripts/sql/01_main_schema.sql:186", "scripts/sql/02_data_schema.sql:8811", "scripts/sql/02_data_schema.sql:8823", "scripts/sql/02_data_schema.sql:8835", "scripts/sql/02_data_schema.sql:8900", "backend/test/testdata/identity_schema.sql:23", "backend/internal/adapter/outbound/identity/postgres_repository.go:69", "backend/internal/adapter/inbound/http/admin/menu_permissions.go:18", "backend/internal/adapter/inbound/http/admin/menu_permissions.go:193", "docs/kms/KMS_PGSQL_NAMING_CONVENTION.md:48", "backend/internal/adapter/inbound/http/admin/menu_permissions.go:32", "backend/internal/adapter/inbound/http/admin/menu_permissions.go:58", "backend/internal/adapter/inbound/http/admin/handler.go:658", "backend/internal/adapter/inbound/http/admin/handler.go:423", "backend/internal/adapter/inbound/http/admin/workspace_google.go:1147", "backend/internal/adapter/inbound/http/process/permission.go:191", "backend/internal/domain/query/query.go:63", "backend/internal/adapter/inbound/http/mcp/gateway.go:30", "backend/internal/application/process/barcode.go:679", "backend/internal/application/process/barcode.go:715", "backend/internal/application/process/pos_config.go:275", "backend/internal/application/process/pos_config.go:359", "backend/internal/application/process/pos_config.go:386", "backend/internal/application/process/doc_picture.go:35", "backend/internal/application/process/doc_picture.go:42", "backend/internal/application/process/report_menu_cb.go:838"]
---

# กลุ่มตาราง `bc_*`

ตารางที่ขึ้นต้น `bc_` แบ่งเป็น 2 ที่อยู่ตามสถาปัตยกรรมหลายผู้เช่า (Tenant) — ดู `backend/CONTEXT.md:15-21`
- **Main Database** (ฐานตัวตนต่อ Tenant ชื่อรูปแบบ `bcerpmain<รหัส>`): ผู้ใช้ รายชื่อบริษัท สิทธิ์เข้าบริษัท สิทธิ์เมนู Google / MCP — สคริปต์ DDL คือ `scripts/sql/01_main_schema.sql`
- **Company Database** (ฐานบริษัท): ตารางช่วยเหลือที่ผูกกับข้อมูลธุรกิจ (รูปเอกสาร รูปแบบบาร์โค้ด FastReport tooltip) — สคริปต์ DDL คือ `scripts/sql/02_data_schema.sql`

การเขียนผ่านเกตเวย์ `/query/exec` ไปที่ `bc_user_list` / `bc_database_list*` ทำได้เฉพาะ `userLevel >= 9` (`query.go:63`, `ValidateUserLevel` `:360-379`) และ SQL ที่ AI ส่งผ่าน MCP อ่าน `bc_user_list`, `bc_mcp_*`, `bc_google_account` ไม่ได้ (`mcp/gateway.go:30`)

## Main Database
- `bc_user_list` — ผู้ใช้ล็อกอิน → [[tbl-bc-user-list]]
- `bc_database_list` — ทะเบียนบริษัท (ชี้ชื่อฐานบริษัทจริง) → [[tbl-bc-database-list]]
- `bc_database_list_user_and_group` — สิทธิ์เข้าบริษัท → [[tbl-bc-database-list-user-and-group]]
- `bc_database_group` — กลุ่มฐานข้อมูล: `group_code`, `group_name` (DDL `01_main_schema.sql:31-38`, สคีมาทดสอบ `identity_schema.sql:23-31`) ไม่พบโค้ด Go ที่อ่านหรือเขียน
- `bc_user_and_group` — สมาชิกกลุ่ม: `user_code`, `group_code` (DDL `01_main_schema.sql:186-193`) ใช้หากลุ่มของผู้ใช้เพื่อรวมสิทธิ์เมนู (`postgres_repository.go:89`, `workspace_google.go:1147`); `DeleteUser` ลบแถวของผู้ใช้ที่ถูกลบ (`handler.go:423`) — ไม่พบโค้ดเว็บที่เพิ่มสมาชิกกลุ่ม
- `bc_group_list` — รายชื่อกลุ่ม: `group_code`, `group_name`, `active_status` (DDL `01_main_schema.sql:72-80`); โค้ดอ่านเพียงตรวจว่ารหัสกลุ่มมีอยู่ก่อนบันทึกสิทธิ์เมนูของกลุ่ม (`menu_permissions.go:18-21`, `:193-199`)
- `bc_permissions_user`, `bc_permissions_group` — สิทธิ์เมนู: `usercode` (varchar(100) — `menu_permissions.go:23`), `image_file` (BYTEA — บล็อบสิทธิ์รายเมนู ถอดรหัสโดย `DecodeMenuRights` ใน `menu_rights.go:48` แล้ว OR รวมทุกเมนู — `postgres_repository.go:102-107`), `roworder`; DDL `01_main_schema.sql:118-138`; คอลัมน์ `database_name` โค้ดเพิ่มเองด้วย `ALTER … ADD COLUMN IF NOT EXISTS` (`postgres_repository.go:74-75`, `menu_permissions.go:26-27`); แถวกลุ่มใช้ `usercode` เก็บรหัสกลุ่ม; ตอนล็อกอินอ่านบล็อบของผู้ใช้ร่วมกับบล็อบของกลุ่มที่ผู้ใช้เป็นสมาชิกใน `bc_user_and_group` (`postgres_repository.go:76-93`) · ดู [[proc-permission-rights]]
- `bc_google_account`, `bc_google_workspace_db`, `bc_google_workspace_member` → [[tbl-bc-google-workspace]] (โค้ดสร้างเอง)
- `bc_mcp_access_tokens`, `bc_mcp_token_databases`, `bc_mcp_token_audit` → [[tbl-bc-mcp-tokens]] (โค้ดสร้างเอง)
- `bc_audit_log` — ไม่พบ DDL ในรีโป และไม่พบโค้ด Go ที่ INSERT; ตัวจัดสิทธิ์ของ SQL แบบ batch (`sqlBatchRight`) จัดคำสั่งที่แตะตารางนี้ตามค่าแรกของ `VALUES` — 1 = สิทธิ์เพิ่ม, 2 = สิทธิ์แก้, 3 = สิทธิ์ลบ (`http/process/permission.go:191-200`)
- DDL ใน `01_main_schema.sql` ที่ไม่พบโค้ดเว็บหรือหน้าจอใช้เลย: `bc_access_list`, `bc_custom_language`, `bc_database_group_admin`, `bc_guid`, `bc_language`, `bc_permission_links`, `bc_screen_capture`, `bc_screen_realtime`

## Company Database
- `bc_fastreport` — นิยามรายงาน FastReport ที่บันทึกไว้ (DDL `02_data_schema.sql:8835-8849`: `menuid`, `menuname`, `reportdata` bytea, `timeupdate`, `report_type`, `is_system_report`, `owner_code`) โค้ดเว็บที่พบ **อ่านอย่างเดียว** เพื่อทำเมนู "รายงานอื่นๆ" แยกตาม `report_type`: 1 = IC (`report_menu_ic.go:1359`), 2 = ซื้อ และ 3 = ขาย (`report_menu_so_po.go:913-919`), 4 = เจ้าหนี้ และ 5 = ลูกหนี้ (`report_menu_ap_ar.go:989`, `:997`), 6 = CB (`report_menu_cb.go:838`), 7 = สินทรัพย์ถาวร และ 8 = GL (`report_menu_gl_fa.go:1652`, `:1790`, query ที่ `:1582`)
- `bc_barcode_print_format` — รูปแบบพิมพ์ป้ายบาร์โค้ด (DDL `02_data_schema.sql:8811-8821`: `code`, `name`, `formatdata` bytea, `create_date_time_now`); บันทึกโดยลบรหัสเดิมแล้วใส่ใหม่ในทรานแซกชัน เก็บ `formatdata` เป็น JSON และรหัสยาวไม่เกิน 25 ตัวอักษร (`barcode.go:666-688`); ตอนอ่านรองรับทั้ง JSON และ blob แบบ zip + XML (`decodeBarcodeFormat` — `barcode.go:715-728`) · ดู [[proc-barcode]]
- `bc_doc_images` — รูปแนบเอกสาร: `roworder`, `image_id` (คีย์เอกสาร), `guid_code`, `image_order`, `image_url`, `image_file`, `create_date_time_now` · **โค้ดสร้างเองถ้ายังไม่มีตาราง** ด้วย `image_id` VARCHAR(128) และ `image_file` BYTEA แล้ว `ALTER … ADD COLUMN IF NOT EXISTS` ซ้ำ (`pos_config.go:275-288`, รันกับฐานบริษัทแบบไม่สนใจ error — `:386-391`); สคริปต์ `02_data_schema.sql:8823-8833` ประกาศ `image_id` varchar(50), `image_file` text และไม่มี `image_url` — ถ้าตารางมีอยู่แล้ว `ALTER … IF NOT EXISTS` ไม่เปลี่ยนชนิดคอลัมน์เดิม; โค้ดจำกัดคีย์เอกสารไว้ 50 ตัวอักษร (`doc_picture.go:42`) · ดู [[proc-doc-item-pictures]]
- `bc_resource` — ข้อความหลายภาษา: `code`, `name_1`…`name_6`; **โค้ดสร้างเอง** ในฐานบริษัท (`pos_config.go:359-368`) และสคริปต์ main มี DDL อีกชุด (`01_main_schema.sql:140-158`); ไม่พบโค้ดเว็บที่อ่านตารางนี้
- `bc_tooltip` — ข้อความช่วยเหลือ: `code` (VARCHAR(100) PK), `name_1`, `name_2` · **โค้ดสร้างเอง** `CREATE TABLE IF NOT EXISTS` ก่อนอ่านและก่อนบันทึก (`menu_permissions.go:58`, `:139`), บันทึกโดย DELETE แล้ว INSERT ในทรานแซกชัน (`:146-150`), รายการอ่านสูงสุด 200 แถว (`:59`); สคริปต์ประกาศ `code` varchar(25) ไม่มี PK (`02_data_schema.sql:8900-8914`); เมื่อ SQL ที่แอดมินส่งมาที่ `/admin/main-query` มีคำว่า `bc_tooltip` โดยไม่ระบุฐาน โค้ดจะเปลี่ยนเป้าหมายเป็นฐานบริษัท (`resolveCompanyDB` — `menu_permissions.go:32-43`, เรียกที่ `handler.go:658-660`)

## ข้อควรรู้เรื่องคอลัมน์
- ตารางในสคริปต์ DDL มีคอลัมน์ระบบมาตรฐาน `ignore_sync`, `is_lock_record`, `roworder`, `create_date_time_now` (`docs/kms/KMS_PGSQL_NAMING_CONVENTION.md:48-53`) โค้ดเว็บของกลุ่มตัวตน/สิทธิ์อ่านเฉพาะ `roworder` สำหรับเรียงลำดับ
- ฝั่งเว็บเพิ่มคอลัมน์ `email`, `line_user_id` (ใน `bc_user_list`), `database_name` (ใน `bc_permissions_*`) เองด้วย `ALTER … ADD COLUMN IF NOT EXISTS`

## ลิงก์
[[tbl-group-erp]] · [[proc-permission-rights]] · [[std-platform-google-login-pdpa-hub]]

## ที่มาในโค้ด

- `backend/CONTEXT.md:15-21` นิยาม Main Database / Company Database
- `scripts/sql/01_main_schema.sql:31-38, 72-80, 118-138, 140-158, 186-193` DDL ตารางฝั่ง Main
- `scripts/sql/02_data_schema.sql:8811-8849, 8900-8914` DDL ตารางฝั่งบริษัท
- `backend/test/testdata/identity_schema.sql:23-31` สคีมาทดสอบ `bc_database_group`
- `backend/internal/adapter/outbound/identity/postgres_repository.go:69-109` `MenuRights` รวมสิทธิ์ผู้ใช้กับกลุ่ม
- `backend/internal/adapter/inbound/http/admin/menu_permissions.go:18-44, 58, 139-150` สิทธิ์เมนู, `resolveCompanyDB`, tooltip
- `docs/kms/KMS_PGSQL_NAMING_CONVENTION.md:48-53` คอลัมน์ระบบมาตรฐาน
- `backend/internal/adapter/inbound/http/admin/handler.go:423, 658-660` ลบสมาชิกกลุ่มตอนลบผู้ใช้, เปลี่ยนเป้าหมาย tooltip
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:1147` อ่านสิทธิ์กลุ่มของผู้ใช้
- `backend/internal/adapter/inbound/http/process/permission.go:191-200` จัดสิทธิ์ SQL ที่แตะ `bc_audit_log`
- `backend/internal/domain/query/query.go:63` ตารางที่ต้องใช้ระดับ ≥ 9
- `backend/internal/adapter/inbound/http/mcp/gateway.go:30` ตารางที่ SQL ผ่าน MCP อ่านไม่ได้
- `backend/internal/application/process/barcode.go:666-728` บันทึกและอ่านรูปแบบบาร์โค้ด
- `backend/internal/application/process/pos_config.go:275-288, 359-368, 386-391` สร้าง `bc_doc_images`, `bc_resource`
- `backend/internal/application/process/doc_picture.go:35, 42` ตารางรูปเอกสารและความยาวคีย์
- `backend/internal/application/process/report_menu_cb.go:838` ตัวอย่างการอ่าน `bc_fastreport`
