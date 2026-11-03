---
title: "คลังสินค้า (ic_warehouse)"
tags: [tables, ic]
aliases: ["ic_warehouse", "คลังสินค้า", "master คลัง", "wh_code"]
sources: ["frontend/src/config/schemas/icWarehouse.ts:28", "frontend/account/master/WarehouseScreen.tsx:188", "frontend/account/master/WarehouseScreen.tsx:482", "backend/internal/application/process/perm_wh_shelf_rest.go:40", "backend/internal/application/process/perm_wh_shelf.go:14", "backend/internal/application/process/pos_config.go:402"]
---
# คลังสินค้า (`ic_warehouse`)

**หน้าที่:** master ของคลังสินค้า 1 แถว = 1 คลัง (`code`) ใช้เป็นรหัสอ้างจาก `wh_code` ในบรรทัดเอกสาร [[tbl-ic-trans-detail]], `wh_from/wh_to` ในหัวเอกสาร [[tbl-ic-trans]], คลังเริ่มต้นใน [[tbl-ic-inventory-detail]] และการผูกสินค้า-คลัง-ที่เก็บใน [[tbl-ic-wh-shelf]] ที่เก็บย่อยในคลังอยู่ใน [[tbl-ic-shelf]]

## คอลัมน์ (จากสคีมาหน้าจอ `icWarehouse.ts:28-100`)

| column | ความหมาย | หมายเหตุ |
|---|---|---|
| `code` | รหัสคลัง (key) | ตรวจซ้ำก่อนบันทึก `WarehouseScreen.tsx:376` |
| `name_1`, `name_2` | ชื่อคลัง ไทย / อังกฤษ | `icWarehouse.ts` |
| `address`, `telephone`, `fax` | ที่อยู่ / โทรศัพท์ / โทรสาร | `icWarehouse.ts` |
| `user_group` | กลุ่มผู้ใช้งาน | `icWarehouse.ts` |
| `wh_manager` | ผู้จัดการคลัง (รหัสผู้ใช้ `erp_user`) | `WarehouseScreen.tsx:204` ดึงชื่อจาก [[tbl-erp-user]] |
| `branch_code` | สาขาของคลัง ([[tbl-erp-branch-list]]) | `WarehouseScreen.tsx:208` |
| `branch_use` | สาขาที่ใช้งานคลัง (ถ้าไม่ว่างชนะ `branch_code`) | `perm_wh_shelf_rest.go:47-49` |
| `latitude`, `longitude` | พิกัดคลัง | `WarehouseScreen.tsx:1073-1096` |

## ความสัมพันธ์และกระบวนการ

- 1 คลัง : n ที่เก็บ [[tbl-ic-shelf]] (`ic_shelf.whcode = ic_warehouse.code`)
- 1 คลัง : n [[tbl-ic-wh-shelf]] (`wh_code`) และ n บรรทัดเอกสาร [[tbl-ic-trans-detail]] (`wh_code`, `wh_code_2`)
- **เขียน:** หน้าจอ "กำหนดคลังสินค้า" `menu_setup_ic_wh` (`frontend/account/master/WarehouseScreen.tsx`) INSERT/UPDATE/DELETE ผ่าน `/query/exec` ตาม legacy write allow-list (ADR-0011)
- **ลบ:** หน้าจอตรวจก่อนว่าไม่มีการใช้ใน `ic_trans_detail` (`wh_code`/`wh_code_2`), `ic_shelf` (`whcode`) และ `ic_wh_shelf` (`wh_code`) (`WarehouseScreen.tsx:482-490`)
- **กรองสิทธิ์:** เมื่อ `erp_option.perm_wh_shelf = 1` รายการคลังที่ผู้ใช้เลือกได้ถูกจำกัดตาม `erp_user_group_wh_shelf` (`perm_wh_shelf.go:7-8`, `perm_wh_shelf_rest.go:40-60`) ดู [[proc-wh-shelf-permission]], [[tbl-erp-option]]
- **กรองสาขา:** ยอดคงเหลือที่รายงานกรองคลังตาม `COALESCE(branch_use,'')='' ? branch_code : branch_use LIKE %สาขา%` (`perm_wh_shelf_rest.go:47-49`)
- **ค่าเริ่มต้น POS:** ถ้าไม่มีตั้งค่า ใช้คลังรหัสน้อยสุด (`pos_config.go:402`)

## ข้อควรระวัง

- ที่เก็บในคลังใช้ชื่อคอลัมน์ `whcode` (ไม่มี underscore) ใน [[tbl-ic-shelf]] แต่ตารางอื่นใช้ `wh_code` — ระวังตอน join (`perm_wh_shelf_rest.go:74`)
- ไม่มีบันทึกบัญชี/สต๊อกในตารางนี้ เป็นแค่ master

## ที่มาในโค้ด

- `frontend/src/config/schemas/icWarehouse.ts:28-100`
- `frontend/account/master/WarehouseScreen.tsx:188`, `:204-210`, `:376`, `:482-490`, `:1073-1096`
- `backend/internal/application/process/perm_wh_shelf.go:7-8`
- `backend/internal/application/process/perm_wh_shelf_rest.go:40-60`, `:74`
- `backend/internal/application/process/pos_config.go:402`
