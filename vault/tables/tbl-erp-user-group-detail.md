---
title: "erp_user_group / erp_user_group_detail / erp_user_group_approve / erp_user_group_wh_shelf — กลุ่มผู้ใช้ในบริษัท"
tags: [tables, erp, user-group, permission, company-db]
aliases: ["erp_user_group", "erp_user_group_detail", "erp_user_group_approve", "erp_user_group_wh_shelf", "กลุ่มผู้ใช้", "สิทธิ์คลัง-ที่เก็บ", "is_po_approve"]
sources: ["backend/internal/application/process/master_detail_specs.go:332", "backend/internal/application/process/master_detail_specs.go:346", "backend/internal/application/process/master_detail_specs.go:378", "backend/internal/application/process/perm_wh_shelf.go:26", "backend/internal/application/process/item_master.go:541", "scripts/sql/02_data_schema.sql:3842", "backend/internal/application/process/master_detail.go:683", "backend/internal/domain/query/write_policy_legacy.go:9", "backend/internal/domain/query/write_policy.go:9"]
---

# กลุ่มผู้ใช้ในบริษัท (erp_user_group*)

ชุดตารางกำหนดกลุ่มผู้ใช้ของ **บริษัท (Company DB)**: หัวกลุ่ม + สมาชิก + สิทธิ์อนุมัติ + สิทธิ์คลัง/ที่เก็บ จัดการผ่าน master-detail spec ([[proc-master-data]]) นิยามตาราง (DDL) อยู่ใน `scripts/sql/02_data_schema.sql` (`erp_user_group` :3842, `erp_user_group_approve` :3866, `erp_user_group_detail` :3876, `erp_user_group_wh_shelf` :3885) โค้ด Go ไม่ได้สร้างตารางเหล่านี้

> แยกจากกลุ่มระดับ Main Database (`bc_user_and_group`, `bc_permissions_group` — ดู [[tbl-group-bc]])

## erp_user_group — หัวกลุ่ม (master_detail_specs.go:332-375)
| คอลัมน์ | ความหมายตามโค้ด |
|---|---|
| `code`, `name_1`, `name_2` | รหัส/ชื่อกลุ่ม — ต้องระบุ `name_1` ("กรุณาระบุชื่อกลุ่มพนักงาน") |
| `is_po`, `is_so`, `is_wh` | กลุ่มจัดซื้อ / ขาย / คลัง (ตามชื่อคอลัมน์) — ทุกคอลัมน์ `is_*` รับเฉพาะ 0 หรือ 1 |
| `is_sale_group` | กลุ่มพนักงานขาย |
| `is_pr_approve`, `is_po_approve`, `is_price_list_approve`, `is_so_approve` | สิทธิ์อนุมัติ PR/PO/ราคา/SO |
| `is_change_masterdata` | แก้ข้อมูลหลักสินค้าได้ — ตรวจโดย `checkChangeMaster` (item_master.go:541-556): ผู้ใช้ที่ไม่อยู่กลุ่มใดผ่านเสมอ, ค่าว่างถือเป็น 1, อยู่หลายกลุ่มใช้ค่ามากสุด, ไม่ใช่ 1 = ปฏิเสธ "ไม่อนุญาตให้แก้ไขข้อมูลหลัก" |

## erp_user_group_detail — สมาชิก
`group_code` → `erp_user_group.code`, `user_code` → [[tbl-erp-user]] `code` (master_detail_specs.go:341-345) — `user_code` แปลงเป็นตัวพิมพ์ใหญ่และต้องมีใน `erp_user` ("ไม่พบรหัสพนักงาน") แถวที่ไม่กรอกรหัสถูกข้าม; บันทึกแล้วแถวสมาชิกของกลุ่มถูกลบและใส่ใหม่ตามที่ส่งมา (master_detail_specs.go:365-368; master_detail.go:683-687)

## erp_user_group_approve — ผู้อนุมัติ
`group_code`, `user_code`, `approve_flag` (0 = PO, 2 = SS, 1 = SR ตามสเปก master_detail_specs.go:346-363) กติกา `user_code` เหมือนสมาชิกกลุ่ม

## erp_user_group_wh_shelf — สิทธิ์คลัง/ที่เก็บของกลุ่ม
`group_code`, `wh_code` (→ `ic_warehouse`, "ไม่พบรหัสคลังสินค้า"), `shelf_code`, `screen_code` (PU/SI/IM/ST ใส่ให้ตามแท็บ) — master_detail_specs.go:378-416 (แถวที่ `wh_code` กับ `shelf_code` ว่างทั้งคู่ถูกข้าม), perm_wh_shelf.go:26-37

- เปิดใช้ด้วย `erp_option.perm_wh_shelf = 1`: ผู้ใช้เลือกคลัง/ที่เก็บได้เฉพาะแถวของกลุ่มที่ตนอยู่ (ผ่าน `erp_user_group_detail`) ตาม `screen_code` ของหน้าจอ (perm_wh_shelf.go:26-37, 42-59)
- `erp_user.ic_wht` / `ic_shelf` (ตั้งต้นรายบุคคล) ถ้ามีค่า จะแทนคลัง/ที่เก็บตั้งต้นของสินค้าในตะกร้ารายการ (perm_wh_shelf.go:74-103) — ดู [[proc-wh-shelf-permission]]
- `erp_user_group` อยู่ใน legacy write allow-list ของเกตเวย์ (domain/query/write_policy_legacy.go:9-39); `_detail`/`_approve`/`_wh_shelf` ไม่อยู่ในรายการ จึงเขียนผ่าน `/query/exec` ได้เฉพาะระดับ ≥ 9 (write_policy.go:9-20)

## ลิงก์
[[proc-permission-rights]] · [[tbl-erp-option]] · [[tbl-group-erp]]

## ที่มาในโค้ด

- `backend/internal/application/process/master_detail_specs.go:332` spec กลุ่มพนักงาน
- `backend/internal/application/process/master_detail_specs.go:346` spec ผู้อนุมัติ
- `backend/internal/application/process/master_detail_specs.go:378` spec สิทธิ์คลัง/ที่เก็บตามกลุ่ม
- `backend/internal/application/process/perm_wh_shelf.go:26` เงื่อนไขสิทธิ์คลัง/ที่เก็บของกลุ่ม
- `backend/internal/application/process/item_master.go:541`
- `scripts/sql/02_data_schema.sql:3842` นิยามตารางกลุ่มผู้ใช้
