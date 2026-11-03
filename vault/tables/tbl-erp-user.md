---
title: "erp_user — ผู้ใช้/พนักงานในฐานบริษัท"
tags: [tables, erp, erp-user, staff, company-db]
aliases: ["erp_user", "พนักงาน", "ผู้ใช้ในบริษัท", "พนักงานขาย", "sale_code"]
sources: ["backend/internal/application/process/trans_credit.go:59", "backend/internal/application/process/trans.go:350", "backend/internal/application/process/perm_wh_shelf.go:77", "backend/internal/application/process/report_options.go:128", "backend/internal/application/process/trans_party.go:115", "backend/internal/application/process/report_menu_employee.go:31", "backend/internal/application/process/master_detail_specs.go:211", "backend/internal/adapter/inbound/http/admin/workspace_google.go:515", "backend/internal/adapter/inbound/http/mcp/gateway.go:1810", "scripts/sql/02_data_schema.sql:3773"]
---

# erp_user — ผู้ใช้/พนักงานในฐานบริษัท

ทะเบียนผู้ใช้/พนักงานของ **บริษัทหนึ่งๆ (Company DB)** — ใช้เป็นรหัสพนักงานขาย (`sale_code`), ผู้อนุมัติเครดิต, สาขาประจำตัว, คลัง/ที่เก็บตั้งต้น และสิทธิ์ดูต้นทุน

> คนละตารางกับ [[tbl-bc-user-list]] (ตัวตนสำหรับล็อกอินอยู่ใน Main Database) — `erp_user` เป็นข้อมูลพนักงานในแต่ละบริษัท นิยามตาราง (DDL) อยู่ใน `scripts/sql/02_data_schema.sql:3773` โค้ด Go ไม่ได้สร้างตารางนี้ (เพิ่มได้เฉพาะคอลัมน์ `email`/`line_user_id` ด้วย `ALTER`)

## คอลัมน์ที่โค้ดใช้
| คอลัมน์ | ความหมายตามโค้ด | ที่มา |
|---|---|---|
| `code` | รหัสผู้ใช้/พนักงาน (คีย์หลักในทางปฏิบัติ) | ทุกที่ |
| `name_1` | ชื่อ | report_menu_employee.go:27 |
| `password` | รหัสผ่านที่ใช้ยืนยันอนุมัติเครดิต (ต้องตรงจึงอนุมัติได้) — **ห้ามเปิดเผยค่า**; MCP gateway ปฏิเสธคิวรีที่อ้าง `erp_user` ร่วมกับ `password`/`pass`/`*` | trans_credit.go:50-70; mcp/gateway.go:1809-1810 |
| `status` | สถานะ (มีใน DDL; ไม่ชัดจากโค้ดว่ากรองที่ใด) | 02_data_schema.sql:3773; mcp/gateway.go:1408 |
| `active_status`, `user_level` | พบเฉพาะในคำสั่ง INSERT ผู้ใช้เริ่มต้นตอนสร้างฐานบริษัท (ใส่ `active_status = 1`, `user_level = 9`) แต่ DDL ในรีโพของ `erp_user` ไม่มีสองคอลัมน์นี้ (มี `status`) และ INSERT นั้นไม่ตรวจ error; ฐานบริษัทใหม่คัดโครงตารางจากฐานเทมเพลต `bcdemo` (workspace_google.go:395-406) จึงยังไม่ทราบว่าฐานที่รันอยู่มีสองคอลัมน์นี้หรือไม่ (ไม่ได้ตรวจฐานจริง) — ไม่ชัดจากโค้ดว่าใช้ตัดสินสิทธิ์ที่ใด | workspace_google.go:395-406, 515-527; 02_data_schema.sql:3773-3837 |
| `email` | อีเมลผู้ใช้ (เพิ่มด้วย `ALTER … ADD COLUMN IF NOT EXISTS`; อัปเดตตามการผูกบัญชีของแอดมิน) | workspace_google.go:515, 1083-1084 |
| `line_user_id` | ผูก LINE (เพิ่มด้วย ALTER IF NOT EXISTS แล้วอัปเดตตามอีเมล) | workspace_google.go:1463-1465 |
| `branch_code` | สาขาประจำตัว (→ `erp_branch_list.code`) ใช้เป็นสาขาตั้งต้นของเอกสาร | trans.go:350-377 |
| `change_branch_code` | 1 = สลับสาขาได้; ไม่ใช่ 1 = บังคับใช้สาขาตั้งต้น | trans.go:350-377; lookup_trans.go:73-84 |
| `ic_wht`, `ic_shelf` | คลัง/ที่เก็บตั้งต้นของผู้ใช้ — เมื่อ `erp_option.perm_wh_shelf = 1` และมีค่า จะแทนคลัง/ที่เก็บตั้งต้นของสินค้า (สิทธิ์ตามกลุ่มอยู่ใน `erp_user_group_wh_shelf`) | perm_wh_shelf.go:74-103 |
| `show_item_cost` | แสดงต้นทุนสินค้าในรายงานได้หรือไม่ (คู่กับ `erp_option.disable_item_cost`) | report_options.go:124-130 |
| `approve_ar_credit` | ต้องเป็น 1 จึงอนุมัติเครดิตลูกหนี้เกินวงเงินได้ | trans_credit.go:59, 77-82 |
| `title` | ตำแหน่ง/กลุ่ม | report_menu_employee.go:28; item_picture.go:188 |
| `telephone`, `mobile`, `department` | ข้อมูลติดต่อ/แผนก | report_menu_employee.go:30; crm/handler.go:243-250 |
| `roworder` | ลำดับแถว ใช้เรียงตอนค้นผู้ใช้ด้วยรหัส (`ORDER BY roworder LIMIT 1`) | trans.go:359 |

## ความสัมพันธ์
- `erp_user.branch_code` → [[tbl-erp-branch-list]]; การหาสาขาของผู้ใช้ตอนทำเอกสารอยู่ใน `resolveBranch` (trans.go:350-377) — รหัสสาขาที่ไม่พบใน `erp_branch_list` ถูกปฏิเสธ ("ไม่พบรหัสสาขา")
- `erp_user_group_detail.user_code` → `erp_user.code` ([[tbl-erp-user-group-detail]]); `erp_user_datalist_config.user_code` ([[tbl-erp-user-datalist-config]])
- เอกสาร: `sale_code` ในเอกสารขาย/ซื้อชี้มาที่ `erp_user.code` (trans_party.go:115, report_menu_singha.go:77, report_menu_sopo.go:193)
- refs ใน master-detail specs: ผู้ใช้ในสินทรัพย์ master_detail_specs.go:211, กลุ่มพนักงาน :344-362, พนักงานขายในแผนการขาย :462 ([[proc-master-data]])

## การเขียน / สิทธิ์
มีประเด็นด้านความปลอดภัยที่ทีมพัฒนาต้องตรวจ (ไม่เผยแพร่รายละเอียดบนเว็บสาธารณะ)

## ใช้ร่วมกับระบบอื่น
พนักงานขายในรายงาน (singha/sopo/employee), CRM (crm/handler.go), MCP gateway (อ่านได้ แต่คิวรีที่อ้างคอลัมน์ password ถูกปฏิเสธ และไม่แสดงแถวตัวอย่างของ `erp_user` — gateway.go:1768, 1809-1810)

## ลิงก์
[[proc-permission-rights]] · [[proc-wh-shelf-permission]] · [[tbl-erp-option]] · [[tbl-group-erp]]

## ที่มาในโค้ด

- `backend/internal/application/process/trans_credit.go:59`
- `backend/internal/application/process/trans.go:350`
- `backend/internal/application/process/perm_wh_shelf.go:77`
- `backend/internal/application/process/report_options.go:128`
- `backend/internal/application/process/trans_party.go:115`
- `backend/internal/application/process/report_menu_employee.go:31`
- `backend/internal/application/process/master_detail_specs.go:211`
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:515`
- `backend/internal/adapter/inbound/http/mcp/gateway.go:1810`
- `scripts/sql/02_data_schema.sql:3773` นิยามตาราง `erp_user`
