---
title: "erp_user — ผู้ใช้/พนักงานในฐานบริษัท"
tags: [tables, erp, erp-user, staff, company-db]
aliases: ["erp_user", "พนักงาน", "ผู้ใช้ในบริษัท", "พนักงานขาย", "sale_code"]
sources: ["backend/internal/application/process/trans_credit.go", "backend/internal/application/process/trans.go:324", "backend/internal/application/process/perm_wh_shelf.go:77", "backend/internal/application/process/report_options.go:128", "backend/internal/application/process/trans_party.go:115", "backend/internal/application/process/report_menu_employee.go", "backend/internal/application/process/master_detail_specs.go:211", "backend/internal/adapter/inbound/http/admin/workspace_google.go:515", "backend/internal/adapter/inbound/http/mcp/gateway.go:1810"]
---

# erp_user — ผู้ใช้/พนักงานในฐานบริษัท

ทะเบียนผู้ใช้/พนักงานของ **บริษัทหนึ่งๆ (Company DB)** — ใช้เป็นรหัสพนักงานขาย (`sale_code`), ผู้อนุมัติเครดิต, สาขาประจำตัว, คลัง/ที่เก็บตั้งต้น และสิทธิ์ดูต้นทุน

> คนละตารางกับ [[tbl-bc-user-list]] (ตัวตนสำหรับล็อกอินอยู่ใน Main Database) — `erp_user` เป็นข้อมูลพนักงานในแต่ละบริษัท ตารางเดิม (legacy) ไม่มี DDL ในโค้ด

## คอลัมน์ที่โค้ดใช้
| คอลัมน์ | ความหมายตามโค้ด | ที่มา |
|---|---|---|
| `code` | รหัสผู้ใช้/พนักงาน (คีย์หลักในทางปฏิบัติ) | ทุกที่ |
| `name_1` | ชื่อ | report_menu_employee.go |
| `password` | รหัสผ่านที่ใช้ยืนยันอนุมัติเครดิต — **ห้ามเปิดเผยค่า**; MCP gateway ห้ามอ่านคอลัมน์นี้ | mcp/gateway.go:1810 |
| `active_status` | สถานะใช้งาน | (ไม่ชัดจากโค้ดว่ากรองที่ใด) |
| `user_level` | ระดับผู้ใช้ | (ไม่ชัดจากโค้ดว่าใช้ตัดสินสิทธิ์ที่ใด) |
| `email` | อีเมลผู้ใช้ (เพิ่มด้วย `ALTER … ADD COLUMN IF NOT EXISTS`) | workspace_google.go:515 |
| `line_user_id` | ผูก LINE (เพิ่มด้วย ALTER IF NOT EXISTS) | workspace_google.go:1464 |
| `branch_code` | สาขาประจำตัว (→ `erp_branch_list.code`) | trans.go:324-380 |
| `change_branch_code` | 1 = สลับสาขาได้ | trans.go:341-380 |
| `ic_wht`, `ic_shelf` | คลัง/ที่เก็บตั้งต้น — **ชนะสิทธิ์กลุ่ม** (`erp_user_group_wh_shelf`) | perm_wh_shelf.go:77-88 |
| `show_item_cost` | แสดงต้นทุนสินค้าในรายงานได้หรือไม่ (คู่กับ `erp_option.disable_item_cost`) | report_options.go:127-128 |
| `approve_ar_credit` | ระดับ/สิทธิ์อนุมัติเครดิตลูกหนี้ | trans_credit.go |
| `title` | ตำแหน่ง/กลุ่ม | report_menu_employee.go, item_picture.go:188 |
| `telephone`, `mobile`, `department` | ข้อมูลติดต่อ/แผนก | crm/handler.go:244-248 |
| `roworder` | ลำดับแถว | (ไม่ชัดจากโค้ด) |

## ความสัมพันธ์
- `erp_user.branch_code` → [[tbl-erp-branch-list]]; การหาสาขาของผู้ใช้ตอนทำเอกสารอยู่ใน `resolveBranch` (trans.go:371)
- `erp_user_group_detail.user_code` → `erp_user.code` ([[tbl-erp-user-group-detail]]); `erp_user_datalist_config.user_code` ([[tbl-erp-user-datalist-config]])
- เอกสาร: `sale_code` ในเอกสารขาย/ซื้อชี้มาที่ `erp_user.code` (trans_party.go:115, report_menu_singha.go:77, report_menu_sopo.go:193)
- refs ใน master-detail specs: master_detail_specs.go:211, 344-362, 462 ([[proc-master-data]])

## การเขียน / สิทธิ์
มีประเด็นด้านความปลอดภัยที่ทีมพัฒนาต้องตรวจ (ไม่เผยแพร่รายละเอียดบนเว็บสาธารณะ)

## ใช้ร่วมกับระบบอื่น
พนักงานขายในรายงาน (singha/sopo/employee), CRM (crm/handler.go), MCP gateway (อ่านได้ ยกเว้นคอลัมน์ password)

## ลิงก์
[[proc-permission-rights]] · [[proc-wh-shelf-permission]] · [[tbl-erp-option]] · [[tbl-group-erp]]

## ที่มาในโค้ด

- `backend/internal/application/process/trans_credit.go`
- `backend/internal/application/process/trans.go:324`
- `backend/internal/application/process/perm_wh_shelf.go:77`
- `backend/internal/application/process/report_options.go:128`
- `backend/internal/application/process/trans_party.go:115`
- `backend/internal/application/process/report_menu_employee.go`
- `backend/internal/application/process/master_detail_specs.go:211`
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:515`
- `backend/internal/adapter/inbound/http/mcp/gateway.go:1810`
