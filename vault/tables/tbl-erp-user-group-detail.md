---
title: "erp_user_group / erp_user_group_detail / erp_user_group_approve / erp_user_group_wh_shelf — กลุ่มผู้ใช้ในบริษัท"
tags: [tables, erp, user-group, permission, company-db]
aliases: ["erp_user_group", "erp_user_group_detail", "erp_user_group_approve", "erp_user_group_wh_shelf", "กลุ่มผู้ใช้", "สิทธิ์คลัง-ที่เก็บ", "is_po_approve"]
sources: ["backend/internal/application/process/master_detail_specs.go:331", "backend/internal/application/process/master_detail_specs.go:350", "backend/internal/application/process/master_detail_specs.go:379", "backend/internal/application/process/perm_wh_shelf.go:77", "backend/internal/application/process/item_master.go:541"]
---

# กลุ่มผู้ใช้ในบริษัท (erp_user_group*)

ชุดตารางกำหนดกลุ่มผู้ใช้ของ **บริษัท (Company DB)**: หัวกลุ่ม + สมาชิก + สิทธิ์อนุมัติ + สิทธิ์คลัง/ที่เก็บ จัดการผ่าน master-detail spec ([[proc-master-data]]) ตารางเดิม (legacy)

> แยกจากกลุ่มระดับ Main Database (`bc_user_and_group`, `bc_permissions_group` — ดู [[tbl-group-bc]])

## erp_user_group — หัวกลุ่ม (master_detail_specs.go:331-376)
| คอลัมน์ | ความหมายตามโค้ด |
|---|---|
| `code`, `name_1`, `name_2` | รหัส/ชื่อกลุ่ม |
| `is_po`, `is_so`, `is_wh` | กลุ่มจัดซื้อ / ขาย / คลัง (ตามชื่อคอลัมน์) |
| `is_sale_group` | กลุ่มพนักงานขาย |
| `is_pr_approve`, `is_po_approve`, `is_price_list_approve`, `is_so_approve` | สิทธิ์อนุมัติ PR/PO/ราคา/SO |
| `is_change_masterdata` | แก้ข้อมูลหลักสินค้าได้ — ตรวจโดย `checkChangeMaster` (item_master.go:541-557) |

## erp_user_group_detail — สมาชิก
`group_code` → `erp_user_group.code`, `user_code` → [[tbl-erp-user]] `code` (master_detail_specs.go:344-362)

## erp_user_group_approve — ผู้อนุมัติ
`group_code`, `user_code`, `approve_flag` (0 = PO, 2 = SS, 1 = SR ตามสเปก master_detail_specs.go:350-366)

## erp_user_group_wh_shelf — สิทธิ์คลัง/ที่เก็บของกลุ่ม
`group_code`, `wh_code` (→ `ic_warehouse`), `shelf_code`, `screen_code` (PU/SI/IM/ST) — master_detail_specs.go:379-410, perm_wh_shelf.go

- `erp_user.ic_wht` / `ic_shelf` (ตั้งต้นรายบุคคล) **ชนะ** สิทธิ์กลุ่ม (perm_wh_shelf.go:77-88); เปิดใช้ด้วย `erp_option.perm_wh_shelf` — ดู [[proc-wh-shelf-permission]]

## ลิงก์
[[proc-permission-rights]] · [[tbl-erp-option]] · [[tbl-group-erp]]

## ที่มาในโค้ด

- `backend/internal/application/process/master_detail_specs.go:331`
- `backend/internal/application/process/master_detail_specs.go:350`
- `backend/internal/application/process/master_detail_specs.go:379`
- `backend/internal/application/process/perm_wh_shelf.go:77`
- `backend/internal/application/process/item_master.go:541`
