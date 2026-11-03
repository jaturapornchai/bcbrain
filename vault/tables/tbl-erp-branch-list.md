---
title: "erp_branch_list — ทะเบียนสาขา"
tags: [tables, erp, branch, company-db]
aliases: ["erp_branch_list", "สาขา", "branch_code", "เลือกสาขา"]
sources: ["backend/internal/application/process/trans.go:350", "backend/internal/application/process/master_detail_specs.go:25", "backend/internal/application/process/master_detail.go:561", "backend/internal/application/process/report_menu_singha.go:75", "backend/internal/application/process/report_menu_gl_fa.go:503", "backend/internal/platform/db/pool.go:69", "backend/internal/application/process/service.go:862", "backend/internal/domain/query/write_policy_legacy.go:18", "frontend/src/config/schemas/icMasterSchemas.ts:458", "scripts/sql/02_data_schema.sql:2565"]
---

# erp_branch_list — ทะเบียนสาขา

รายชื่อสาขาของบริษัท (Company DB) เป็นแหล่งรหัสสาขาที่เอกสารและรายงานอ้างถึง นิยามตาราง (DDL) อยู่ใน `scripts/sql/02_data_schema.sql:2565-2595` (CREATE TABLE 2565-2592, ดัชนีที่ `code` บรรทัด 2595) โค้ด Go ไม่ได้สร้างตารางนี้ มีแต่เพิ่มคอลัมน์ `latitude`/`longitude` ให้

## คอลัมน์
| คอลัมน์ | ความหมาย | ที่มา |
|---|---|---|
| `code` | รหัสสาขา varchar(25) — คีย์ที่เอกสารอ้างผ่าน `branch_code` DDL ไม่ประกาศ FK หรือ unique มีแต่ดัชนีธรรมดาที่ `code` | trans.go:371; 02_data_schema.sql:2569, 2595 |
| `name_1` | ชื่อสาขา varchar(100) — รายงานหาชื่อสาขาด้วย `code` = `branch_code` ของเอกสาร; รายงานบัญชีแยกสาขาอ่าน `code` + `name_1` ทั้งตารางแล้วแสดงเป็น "รหัส ชื่อ" | report_menu_singha.go:75-76; report_menu_gl_fa.go:80-87, 472-475; 02_data_schema.sql:2571 |
| `name_2` | ชื่อสาขาคอลัมน์ที่สอง — ไม่พบโค้ด Go อ่าน (DDL ประกาศ varchar(100) และมี `ADD COLUMN IF NOT EXISTS` ขนาด 200 ซ้ำอีกครั้ง ซึ่งไม่มีผลเมื่อคอลัมน์มีอยู่แล้ว) | 02_data_schema.sql:2572, 2593 |
| `branch_type` | ประเภทสถานประกอบการ smallint — หน้าจอกำหนดสาขาให้เลือก 0 = สาขา, 1 = สำนักงานใหญ่ ไม่พบโค้ด Go ที่อ่านค่านี้จากตารางนี้ | icMasterSchemas.ts:464-473; 02_data_schema.sql:2589 |
| `latitude`, `longitude` | พิกัด NUMERIC(18,6) — ไม่อยู่ใน CREATE TABLE แต่เพิ่มด้วย `ALTER … ADD COLUMN IF NOT EXISTS` ตอนเปิดฐานบริษัท (`companySchemaSQL` รันที่ pool.go:217) และชุดคำสั่ง ERP schema ครั้งแรกต่อฐาน (service.go:972-976); หน้าจอมีช่อง "ละติจูด"/"ลองจิจูด" แต่ไม่พบโค้ด Go ที่อ่านพิกัดสาขา | platform/db/pool.go:69-70; service.go:862-863; icMasterSchemas.ts:483-484 |

คอลัมน์อื่นใน DDL — `number`, `address_1`, `address_2`, `telephone`, `fax`, `remark`, `serial_list`, `phone_number_approve`, `sale_hub_approve` มีช่องบนหน้าจอกำหนดสาขา (icMasterSchemas.ts:474-482) ส่วน `arm_code`, `arm_send_*`, `status`, `guid_code`, `ignore_sync`, `is_lock_record` ไม่อยู่ในรายการช่องเพิ่มเติมของหน้าจอ (icMasterSchemas.ts:463-485) — ไม่พบโค้ด Go ที่อ่านหรือเขียนโดยเฉพาะ (02_data_schema.sql:2565-2592)

## การใช้
- เอกสารสินค้าหาสาขาที่จะบันทึกด้วย `resolveBranch` (trans.go:350-377): ไม่ได้ส่งรหัสมา → ใช้สาขาตั้งต้นของผู้ใช้ `erp_user.branch_code` ([[tbl-erp-user]]) ถ้าว่างใช้ `erp_company_profile.branch_code` เฉพาะที่มีอยู่ใน `erp_branch_list` (trans.go:354-362, [[tbl-erp-company-profile]]); ผู้ใช้ที่ไม่มีสิทธิ์เปลี่ยนสาขา (`change_branch_code` ไม่เป็น 1) และมีสาขาตั้งต้นจะถูกบังคับใช้สาขาตั้งต้น (trans.go:363-366); ถ้าได้รหัสแล้วแต่ไม่พบใน `erp_branch_list` ตอบ error "ไม่พบรหัสสาขา …" (trans.go:370-376); ถ้าไม่มีสาขาเลยคืนค่าว่างโดยไม่ error (trans.go:367-369)
- ผู้เรียก: `transBranch` (trans.go:341), `userBranchCode` (trans.go:328; ถูกเรียกที่ trans.go:270, 319, docs.go:121, hidden_cost.go:456, point_doc.go:97, stock_beginning.go:312) และตัวกรองคลัง/ชั้นเก็บ (lookup_trans.go:127-129 ข้าม error ชนิด validation เมื่อสาขาล็อกอินไม่พบในตาราง)
- `erp_company_profile.branch_status` ไม่ได้ถูก `resolveBranch` ตรวจ — ใช้ที่อื่น (lookup_trans.go:74, report_menu_ap_ar_opts.go:57-63, trans_validate.go:30; ดู [[tbl-erp-company-profile]])
- ตรวจ reference ใน master-detail spec: `refBranch` (master_detail_specs.go:25) ใช้กับ `branch_code` ของทะเบียนสินทรัพย์ (`menu_asset_lists`, master_detail_specs.go:212) และเอกสารซ่อมบำรุงสินทรัพย์ (`menu_asset_maintenance`, master_detail_specs.go:230) ผ่าน `checkRefs`/`checkRef` (master_detail.go:535-542, 561-604): ค่าว่างไม่ตรวจ ค่าที่ไม่พบในตารางได้ข้อความ "ไม่พบสาขา: <รหัส>" ([[proc-master-data]])
- รายงานแสดงชื่อสาขา: คอลัมน์ "ชื่อสาขา" (report_menu_singha.go:75-76, ใช้ที่ 325, 491, 508) และรายงานบัญชีแยกสาขา — งบทดลอง (แยกสาขา) `glfaBranchTB` (report_menu_gl_fa.go:503-510, เมนู `menu_gl_report_trial_balance_branch` :1742), งบกำไรขาดทุน (แยกสาขา) `glfaPLBranch` (:537-545, `menu_gl_report_profit_and_lost_branch_1` :1764), สาขา x แผนก `glfaBranchDept` (:581-596, :1765); `branch_code` ว่างใน `gl_journal_detail` แสดงเป็น "ERR. (ไม่ระบุสาขา)" และรหัสที่ไม่พบในตารางแสดงเฉพาะตัวรหัส (report_menu_gl_fa.go:472-479, 500)
- หน้าจอกำหนดรายละเอียดสาขา (เมนู 1.1.3 `menu_setup_branch`, icMasterSchemas.ts:458-489) เขียนตารางนี้ผ่าน `/query/exec` เพราะอยู่ใน legacy write allow-list (domain/query/write_policy_legacy.go:18; ADR-0011) <!-- pragma: allowlist secret -->
- สคีมาหน้าจอประกาศ `fkChecks` ว่า `ic_trans.branch_code` และ `gl_journal.branch_code` ถือว่าสาขานั้นถูกใช้งานแล้ว (icMasterSchemas.ts:486-489) แต่ไม่พบโค้ดฝั่งหน้าจอที่อ่าน `fkChecks` (พบเฉพาะการประกาศชนิดข้อมูลที่ icMasterSchemas.ts:54) จึงยังไม่ยืนยันว่ามีการกันลบสาขาที่ถูกใช้

## ลิงก์
[[tbl-group-erp]]

## ที่มาในโค้ด

- `backend/internal/application/process/trans.go:350` `resolveBranch` ตรวจ/กำหนดสาขาของเอกสาร
- `backend/internal/application/process/master_detail_specs.go:25` `refBranch`
- `backend/internal/application/process/master_detail.go:561` `checkRef` ตรวจรหัสอ้างอิง
- `backend/internal/application/process/report_menu_singha.go:75` คิวรีย่อยชื่อสาขา
- `backend/internal/application/process/report_menu_gl_fa.go:503` รายงานบัญชีแยกสาขา
- `backend/internal/platform/db/pool.go:69` เพิ่มคอลัมน์ `latitude` ตอนเปิดฐานบริษัท
- `backend/internal/application/process/service.go:862` เพิ่มคอลัมน์ `latitude` ใน ERP schema
- `backend/internal/domain/query/write_policy_legacy.go:18` allow-list การเขียน
- `frontend/src/config/schemas/icMasterSchemas.ts:458` สคีมาหน้าจอกำหนดสาขา
- `scripts/sql/02_data_schema.sql:2565` นิยามตาราง `erp_branch_list`
