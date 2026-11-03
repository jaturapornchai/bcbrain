---
title: "erp_branch_list — ทะเบียนสาขา"
tags: [tables, erp, branch, company-db]
aliases: ["erp_branch_list", "สาขา", "branch_code", "เลือกสาขา"]
sources: ["backend/internal/application/process/trans.go:371", "backend/internal/application/process/master_detail_specs.go:25", "backend/internal/application/process/report_menu_singha.go:75", "backend/internal/application/process/report_menu_gl_fa.go:507", "backend/internal/platform/db/pool.go:69"]
---

# erp_branch_list — ทะเบียนสาขา

รายชื่อสาขาของบริษัท (Company DB) ตารางเดิม (legacy)

## คอลัมน์
| คอลัมน์ | ความหมาย | ที่มา |
|---|---|---|
| `code` | รหัสสาขา | — |
| `name_1` | ชื่อสาขา | report_menu_singha.go:75-76 |
| `latitude`, `longitude` | พิกัด (เพิ่มด้วย ALTER IF NOT EXISTS) | platform/db/pool.go:69-70 |

## การใช้
- `resolveBranch` (trans.go:371) ตรวจรหัสสาขาที่เอกสารใช้ — เทียบกับ `erp_user.branch_code` ([[tbl-erp-user]]) และโหมดหลายสาขาใน [[tbl-erp-company-profile]] (`branch_status`)
- ref ใน master-detail spec (`refBranch`, master_detail_specs.go:25) ([[proc-master-data]])
- แสดงชื่อสาขาในรายงาน (report_menu_singha.go:75-76, report_menu_gl_fa.go:507/542/593)
- หน้าจอ master เขียนตารางนี้ผ่าน `/query/exec` ตาม legacy write allow-list (ADR-0011)

## ลิงก์
[[tbl-group-erp]]

## ที่มาในโค้ด

- `backend/internal/application/process/trans.go:371`
- `backend/internal/application/process/master_detail_specs.go:25`
- `backend/internal/application/process/report_menu_singha.go:75`
- `backend/internal/application/process/report_menu_gl_fa.go:507`
- `backend/internal/platform/db/pool.go:69`
