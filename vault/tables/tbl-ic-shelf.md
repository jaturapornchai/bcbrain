---
title: "พื้นที่เก็บสินค้า (ic_shelf)"
tags: [tables, ic]
aliases: ["ic_shelf", "ที่เก็บสินค้า", "shelf_code", "พื้นที่เก็บ"]
sources: ["scripts/sql/02_data_schema.sql:6428", "frontend/src/config/schemas/icMasterSchemas.ts:365", "backend/internal/application/process/stock_tools.go:384", "backend/internal/application/process/perm_wh_shelf_rest.go:74", "backend/internal/application/process/trans_grid.go:291", "backend/internal/application/process/report_menu_ic.go:332", "frontend/account/master/ItemScreen.tsx:1632", "frontend/account/master/StandardMasterScreen.tsx:618"]
---
# พื้นที่เก็บสินค้า (`ic_shelf`)

**หน้าที่:** master ของที่เก็บ/ชั้นวางภายในคลัง key คือคู่ (`whcode`, `code`) ใช้เป็นรหัสอ้างจาก `shelf_code` ในบรรทัดเอกสาร [[tbl-ic-trans-detail]] (คู่กับ `wh_code`) และจาก [[tbl-ic-wh-shelf]]

## คอลัมน์ (DDL `scripts/sql/02_data_schema.sql:6428-6448`)

DDL มี `code`, `name_1`, `name_2`, `whcode`, `width`, `weight`, `height`, `depth` (ชนิด varchar 10 ยกเว้นชื่อ), `status`, `guid_code`, `stock_control`, `remark` และดัชนี `idx_ic_shelf_code` บน `code` (ไม่ใช่ unique) หน้าจอตั้งค่ากรอกเฉพาะคอลัมน์ในตารางข้างล่าง (`icMasterSchemas.ts:365-384`)

| column | ความหมาย | ที่มา |
|---|---|---|
| `whcode` | รหัสคลังเจ้าของที่เก็บ ([[tbl-ic-warehouse]].code) — ชื่อคอลัมน์ไม่มี underscore | `icMasterSchemas.ts:371-379`, `stock_tools.go:384` |
| `code` | รหัสที่เก็บ (ไม่ซ้ำภายในคลังเดียวกัน) | `stock_tools.go:384` |
| `name_1` | ชื่อที่เก็บ | `ItemScreen.tsx:1632` (frontend/account/master) |
| `name_2` | ชื่อภาษาที่สอง (หน้าจอมาตรฐานบันทึกให้เมื่อไม่ตั้ง `noName2`) | `StandardMasterScreen.tsx:620-622` |
| `width`, `height`, `depth` | ขนาดที่เก็บ (กว้าง/สูง/ลึก) | `icMasterSchemas.ts:380-384`, `StandardMasterScreen.tsx:645-650` |

หน้าจอ `menu_setup_ic_shelf` (1.2.18 "กำหนดพื้นที่เก็บสินค้า") ใช้ `StandardMasterScreen` ที่กรองตามคลังก่อนเสมอ (`parentFilter` บังคับเลือกคลัง) และไม่แสดงสถานะ (`hideStatus`) (`icMasterSchemas.ts:365-379`)

## ความสัมพันธ์และกระบวนการ

- n:1 กับ [[tbl-ic-warehouse]] (`whcode`)
- ลบไม่ได้ถ้าถูกใช้ใน [[tbl-ic-wh-shelf]] (`shelf_code` scope ด้วย `wh_code`) หรือ [[tbl-ic-trans-detail]] (`shelf_code` scope ด้วย `wh_code`) (`icMasterSchemas.ts:385-388`)
- **เขียน:** หน้าจอตั้งค่าผ่าน `/query/exec` ตาม legacy write allow-list (ADR-0011)
- **ตรวจ:** ก่อนบันทึก Serial ด้วยเครื่องมือ ตรวจว่า (คลัง, ที่เก็บ) มีจริง (`stock_tools.go:384`)
- **อ่าน:** กริดเอกสารเมื่อเปิด "ทุกที่เก็บ" ใช้ที่เก็บแรกที่ผู้ใช้มีสิทธิ์แทนแถวของสินค้า (`trans_grid.go:291`); รายงานยอดคงเหลือระดับคลัง+ที่เก็บ join ด้วย `s.code=g.sh AND s.whcode=g.wh` (`report_menu_ic.go:332`); สิทธิ์ผู้ใช้ตาม `erp_user_group_wh_shelf` (`perm_wh_shelf_rest.go:73-74,110`)

## ข้อควรระวัง

- ชื่อคอลัมน์ `whcode` ไม่ตรงกับ `wh_code` ที่ตารางอื่นใช้
- ต้องระบุทั้ง `whcode` และ `code` เสมอเมื่อ join เพราะรหัสที่เก็บซ้ำข้ามคลังได้

## ที่มาในโค้ด

- `scripts/sql/02_data_schema.sql:6428-6448`
- `frontend/src/config/schemas/icMasterSchemas.ts:365-389`
- `frontend/account/master/StandardMasterScreen.tsx:618-650`
- `frontend/account/master/ItemScreen.tsx:1632`
- `backend/internal/application/process/stock_tools.go:384`
- `backend/internal/application/process/trans_grid.go:291`
- `backend/internal/application/process/report_menu_ic.go:332`
- `backend/internal/application/process/perm_wh_shelf_rest.go:73-74`, `:110`
