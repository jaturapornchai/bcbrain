---
title: "erp_company_profile — ข้อมูลบริษัท (แถวเดียว)"
tags: [tables, erp, company, branch, company-db]
aliases: ["erp_company_profile", "ข้อมูลบริษัท", "company profile", "branch_status", "เลขประจำตัวผู้เสียภาษี"]
sources: ["backend/internal/application/process/report_pdf.go:35", "backend/internal/application/process/trans.go:350", "backend/internal/application/process/trans_validate.go:29", "backend/internal/application/process/lookup_trans.go:73", "backend/internal/application/process/report_menu_ap_ar_opts.go:57", "backend/internal/application/process/pos_config.go:399", "backend/internal/adapter/inbound/http/mcp/gateway.go:1631", "backend/internal/adapter/inbound/http/admin/workspace_google.go:509", "backend/internal/adapter/inbound/http/admin/handler.go:629", "backend/internal/platform/db/pool.go:71", "backend/internal/application/process/service.go:864", "backend/internal/domain/query/write_policy_legacy.go:38", "scripts/sql/02_data_schema.sql:2626", "scripts/sql/04_seed_data.sql:5"]
---

# erp_company_profile — ข้อมูลบริษัท

ข้อมูลหัวบริษัทของ **ฐานบริษัท (Company DB)** ใช้พิมพ์หัวรายงาน/PDF, บอกว่าบริษัทเปิดโหมดหลายสาขาหรือไม่ และสาขาตั้งต้นของบริษัท โค้ดทุกจุดอ่านด้วย `LIMIT 1` (ไม่มี `ORDER BY`) จึงสมมติว่าตารางมีแถวเดียว นิยามตาราง (DDL) อยู่ใน `scripts/sql/02_data_schema.sql:2626-2666` โค้ด Go ไม่ได้สร้างตารางนี้ (เพิ่มได้เฉพาะ `latitude`/`longitude` ด้วย `ALTER`)

## คอลัมน์ที่โค้ดใช้
| คอลัมน์ | ความหมาย | ที่มา |
|---|---|---|
| `company_name_1`, `company_name_2` | ชื่อบริษัท (ไทย/อังกฤษ) varchar(100) — หัว PDF ภาษาอังกฤษใช้ `_2` ถ้าไม่ว่าง ไม่เช่นนั้นใช้ `_1`; ไม่มีแถวหรืออ่านไม่ได้ ใช้ชื่อเริ่มต้นที่เขียนไว้ในโค้ด | report_pdf.go:35-74; 02_data_schema.sql:2630-2631 |
| `address_1`, `address_2` | ที่อยู่ (ไทย/อังกฤษ) varchar(255) — เลือกใช้เหมือนชื่อบริษัท | report_pdf.go:54-55, 66-69; 02_data_schema.sql:2634-2635 |
| `tax_number` | เลขประจำตัวผู้เสียภาษี varchar(100) — ขึ้นหัว PDF; ตั้งค่า POS ตัวอย่างของฐาน `bcdemo` อ่านชื่อกับเลขนี้ไปใช้ | report_pdf.go:56, 71; pos_config.go:398-428 |
| `telephone_number`, `fax_number` | เบอร์โทร/แฟกซ์ varchar(100) (ชื่อคอลัมน์ตาม DDL) — ไม่พบโค้ด Go ที่อ่าน | 02_data_schema.sql:2648-2649; 04_seed_data.sql:9, 15 |
| `branch_status` | **1 = โหมดหลายสาขา** smallint default 0 — (ก) หน้าจอเอกสารตรวจกล่องสาขาต่อเมื่อ `erp_option.warning_branch_input = 1` และ `branch_status = 1` ([[tbl-erp-option]]) (ข) lookup เอกสารอ้างอิงจำกัดตามสาขาของผู้ใช้เมื่อ `branch_status = 1` และ `erp_option.show_branch_doc_only = 1` และผู้ใช้ไม่มีสิทธิ์สลับสาขา และกรองคลัง/ที่เก็บตามสาขา (ค) รายงานแสดงเงื่อนไขสาขาเมื่อค่าเป็น 1 (ไม่มีแถว = ไม่มีสาขา) | trans_validate.go:29-30; lookup_trans.go:73-74, 173-190; report_menu_ap_ar_opts.go:56-65 |
| `branch_code` | varchar(25) — สาขาตั้งต้นของเอกสารเมื่อผู้ใช้ไม่มี `erp_user.branch_code` โดยใช้เฉพาะรหัสที่มีใน [[tbl-erp-branch-list]] (JOIN) | trans.go:350-377 (JOIN ที่ :356); 02_data_schema.sql:2656 |
| `branch_type` | smallint default 0 — ไม่ชัดจากโค้ดว่าใช้ตัดสินสิ่งใด (พบเพียงตอนใส่ค่าเริ่มต้น = 0) | workspace_google.go:510-511; 02_data_schema.sql:2655 |
| `latitude`, `longitude` | NUMERIC(18,6) default 0 — เพิ่มด้วย `ALTER … ADD COLUMN IF NOT EXISTS`; ไม่พบโค้ดที่อ่านค่า | platform/db/pool.go:71-72; process/service.go:864-865 |

คอลัมน์อื่นใน DDL (เช่น `business_name_1/2`, `workplace_1/2`, ที่อยู่แยกส่วน `house_no`…`postcode`, `last_backup`) ไม่พบโค้ด Go ที่อ่านหรือเขียน
- MCP gateway `bc_company_overview` เลือก `tel`, `fax`, `email_address` จากตารางนี้ (gateway.go:1626-1632) แต่ DDL ในรีโพไม่มีสามคอลัมน์นี้ (มี `telephone_number`, `fax_number` และไม่มีอีเมล) — ยังไม่ได้ตรวจฐานจริง จึงไม่รู้ว่าฐานที่รันอยู่มีคอลัมน์เหล่านี้หรือไม่
- `branch_name` ไม่อยู่ใน DDL ของตารางนี้ (`branch_name` ใน 02_data_schema.sql พบเฉพาะตารางอื่น) แต่ถูกใส่ใน INSERT ตอนสร้างฐานบริษัท (workspace_google.go:510) — ดูหัวข้อ "การเขียน"

## การเขียน
- สร้างฐานบริษัทใหม่ผ่าน workspace: `cloneEmptySchemaFromTemplate` คัดโครงตารางจากฐานเทมเพลต `bcdemo` (workspace_google.go:395-406) แล้วใส่แถวเริ่มต้นหนึ่งแถวถ้าตารางว่าง — `company_name_1` = ชื่อบริษัทที่ตั้ง, `tax_number` ว่าง, `branch_type` 0, `branch_code` '00000', `branch_name` 'สำนักงานใหญ่' (workspace_google.go:509-513); `branch_status` ไม่ได้ตั้ง (ใช้ค่าเริ่มต้น 0 = ไม่ใช่โหมดหลายสาขา)
- คำสั่ง INSERT นั้นไม่ตรวจ error (`_, _ =`) และใส่ `branch_name` ที่ไม่อยู่ใน DDL ของรีโพ — ถ้าฐานเทมเพลตจริงไม่มีคอลัมน์นี้ คำสั่งจะล้มเงียบและไม่มีแถวถูกสร้าง (ยังไม่ได้ตรวจฐานเทมเพลตจริง)
- สคริปต์ข้อมูลตัวอย่าง `04_seed_data.sql` ล้างตารางแล้วใส่แถวเดียวที่ตั้ง `branch_status = 1` (04_seed_data.sql:5-18)
- หน้าจอ master เขียนตารางนี้ผ่าน `/query/exec` เพราะอยู่ใน legacy write allow-list (domain/query/write_policy_legacy.go:38; ADR-0011)

## ใครอ่าน
รายงาน PDF (หัวกระดาษ: report_pdf.go:35-74), ตรวจหน้าจอเอกสาร (trans_validate.go:29-30), การหาสาขาตั้งต้นของเอกสาร (`resolveBranch`, trans.go:350-377), lookup เอกสาร/คลัง (lookup_trans.go:73-74, 173-190), เงื่อนไขสาขาในรายงาน (`reportBranchEnabled`, report_menu_ap_ar_opts.go:56-65), ตั้งค่า POS ตัวอย่างของฐาน `bcdemo` (pos_config.go:398-428), MCP gateway (gateway.go:1626-1632), และหน้ารายการฐานข้อมูลของแอดมินที่นับว่ามีแถวบริษัทหรือยัง (admin/handler.go:629-630)

## ลิงก์
[[tbl-erp-branch-list]] · [[proc-report-engine]] · [[tbl-group-erp]]

## ที่มาในโค้ด

- `backend/internal/application/process/report_pdf.go:35` ดึงข้อมูลหัวบริษัทของ PDF
- `backend/internal/application/process/trans.go:350` `resolveBranch` สาขาตั้งต้นจากบริษัท
- `backend/internal/application/process/trans_validate.go:29` `branch_status` ในตัวเลือกตรวจหน้าจอ
- `backend/internal/application/process/lookup_trans.go:73` `branch_status` ในกฎ lookup
- `backend/internal/application/process/report_menu_ap_ar_opts.go:57` `reportBranchEnabled`
- `backend/internal/application/process/pos_config.go:399` ชื่อ/เลขภาษีสำหรับ POS ตัวอย่าง
- `backend/internal/adapter/inbound/http/mcp/gateway.go:1631` คอลัมน์ที่ `bc_company_overview` เลือก
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:509` แถวเริ่มต้นตอนสร้างฐานบริษัท
- `backend/internal/adapter/inbound/http/admin/handler.go:629` นับแถวบริษัท
- `backend/internal/platform/db/pool.go:71` `ALTER` พิกัด
- `backend/internal/application/process/service.go:864` `ALTER` พิกัด
- `backend/internal/domain/query/write_policy_legacy.go:38` allow-list การเขียน
- `scripts/sql/02_data_schema.sql:2626` นิยามตาราง `erp_company_profile`
- `scripts/sql/04_seed_data.sql:5` แถวตัวอย่าง
