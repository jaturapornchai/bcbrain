---
title: "คลังสินค้า (ic_warehouse)"
tags: [tables, ic]
aliases: ["ic_warehouse", "คลังสินค้า", "master คลัง", "wh_code"]
sources: ["scripts/sql/02_data_schema.sql:7270", "frontend/src/config/schemas/icWarehouse.ts:20", "frontend/account/master/WarehouseScreen.tsx:188", "frontend/account/master/WarehouseScreen.tsx:484", "backend/internal/application/process/perm_wh_shelf_rest.go:40", "backend/internal/application/process/perm_wh_shelf.go:26", "backend/internal/application/process/pos_config.go:402"]
---
# คลังสินค้า (`ic_warehouse`)

**หน้าที่:** master ของคลังสินค้า 1 แถว = 1 คลัง (`code`) ใช้เป็นรหัสอ้างจาก `wh_code` ในบรรทัดเอกสาร [[tbl-ic-trans-detail]], `wh_from/wh_to` ในหัวเอกสาร [[tbl-ic-trans]], คลังเริ่มต้นใน [[tbl-ic-inventory-detail]] และการผูกสินค้า-คลัง-ที่เก็บใน [[tbl-ic-wh-shelf]] ที่เก็บย่อยในคลังอยู่ใน [[tbl-ic-shelf]]

## คอลัมน์ (DDL `scripts/sql/02_data_schema.sql:7270-7293` ดัชนี `idx_ic_warehouse_code` บน `code` ที่ `:7294`, ช่องกรอกจากสคีมาหน้าจอ `icWarehouse.ts:20-106`)

DDL มีคอลัมน์ `guid_code` เพิ่มจากตารางข้างล่าง ซึ่งหน้าจอกำหนดคลังไม่ได้กรอก

| column | ความหมาย | หมายเหตุ |
|---|---|---|
| `code` | รหัสคลัง (key) | ยาวไม่เกิน 25 (`icWarehouse.ts:30-34`) ตรวจซ้ำก่อนบันทึกคลังใหม่ `WarehouseScreen.tsx:375-376` |
| `name_1`, `name_2` | ชื่อคลัง ไทย / อังกฤษ (`name_1` บังคับกรอก) | `icWarehouse.ts:36-48` |
| `address`, `telephone`, `fax` | ที่อยู่ / โทรศัพท์ / โทรสาร | `icWarehouse.ts:49-66` |
| `user_group` | กลุ่มผู้ใช้งาน | `icWarehouse.ts:67-72` |
| `wh_manager` | ผู้จัดการคลัง (รหัสผู้ใช้ `erp_user`) | `WarehouseScreen.tsx:203-204` ดึงชื่อจาก [[tbl-erp-user]] |
| `branch_code` | สาขาของคลัง ([[tbl-erp-branch-list]]) | `WarehouseScreen.tsx:208-209` |
| `branch_use` | สาขาที่ใช้งานคลัง (ถ้าไม่ว่างชนะ `branch_code`) | `perm_wh_shelf_rest.go:47-49` |
| `latitude`, `longitude` | พิกัดคลัง | `WarehouseScreen.tsx:1074-1131` |

## ความสัมพันธ์และกระบวนการ

- 1 คลัง : n ที่เก็บ [[tbl-ic-shelf]] (`ic_shelf.whcode = ic_warehouse.code`)
- 1 คลัง : n [[tbl-ic-wh-shelf]] (`wh_code`) และ n บรรทัดเอกสาร [[tbl-ic-trans-detail]] (`wh_code`, `wh_code_2`)
- **เขียน:** หน้าจอ "กำหนดคลังสินค้า" `menu_setup_ic_wh` (`frontend/account/master/WarehouseScreen.tsx`) INSERT/UPDATE/DELETE ผ่าน `/query/exec` ตาม legacy write allow-list (ADR-0011) (`screenRegistry.tsx:303-307`)
- **ลบ:** หน้าจอตรวจก่อนว่าไม่มีการใช้ใน `ic_trans_detail` (`wh_code`/`wh_code_2`), `ic_shelf` (`whcode`) และ `ic_wh_shelf` (`wh_code`) (`WarehouseScreen.tsx:484-490`)
- **กรองสิทธิ์:** เมื่อ `erp_option.perm_wh_shelf = 1` รายการคลังที่ผู้ใช้เลือกได้ถูกจำกัดตาม `erp_user_group_wh_shelf` (`perm_wh_shelf.go:10,24-37`, `perm_wh_shelf_rest.go:40-56`) ดู [[proc-wh-shelf-permission]], [[tbl-erp-option]]
- **กรองสาขา:** ฟอร์มยอดคงเหลือต่อคลัง/ที่เก็บ เมื่อล็อกอินด้วยสาขา กรองคลังตาม `COALESCE(branch_use,'')='' ? branch_code : branch_use LIKE %สาขา%` (`perm_wh_shelf_rest.go:47-49`)
- **ข้อมูลตัวอย่าง POS:** เฉพาะฐานข้อมูล `bcdemo` ตอนสร้างเครื่อง POS ตัวอย่างใน `pos_id` ใช้รหัสคลังน้อยสุดของตารางนี้ (ไม่พบใช้ `MMA01`) เป็น `pos_ic_wht` (`pos_config.go:392-404,430-450`)

## ข้อควรระวัง

- ที่เก็บในคลังใช้ชื่อคอลัมน์ `whcode` (ไม่มี underscore) ใน [[tbl-ic-shelf]] แต่ตารางอื่นใช้ `wh_code` — ระวังตอน join (`perm_wh_shelf_rest.go:74`)
- ไม่มีบันทึกบัญชี/สต๊อกในตารางนี้ เป็นแค่ master

## ที่มาในโค้ด

- `scripts/sql/02_data_schema.sql:7270-7294`
- `frontend/src/config/schemas/icWarehouse.ts:20-106`
- `frontend/account/master/WarehouseScreen.tsx:188`, `:203-210`, `:375-376`, `:484-490`, `:1074-1131`
- `frontend/account/tabs/screenRegistry.tsx:303-307`
- `backend/internal/application/process/perm_wh_shelf.go:10`, `:26-37`
- `backend/internal/application/process/perm_wh_shelf_rest.go:40-56`, `:74`
- `backend/internal/application/process/pos_config.go:392-404`, `:430-450`
