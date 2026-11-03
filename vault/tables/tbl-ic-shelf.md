---
title: "พื้นที่เก็บสินค้า (ic_shelf)"
tags: [tables, ic]
aliases: ["ic_shelf", "ที่เก็บสินค้า", "shelf_code", "พื้นที่เก็บ"]
sources: ["frontend/src/config/schemas/icMasterSchemas.ts:365", "backend/internal/application/process/stock_tools.go:384", "backend/internal/application/process/perm_wh_shelf_rest.go:73", "backend/internal/application/process/trans_grid.go:291", "backend/internal/application/process/report_menu_ic.go:303"]
---
# พื้นที่เก็บสินค้า (`ic_shelf`)

**หน้าที่:** master ของที่เก็บ/ชั้นวางภายในคลัง key คือคู่ (`whcode`, `code`) ใช้เป็นรหัสอ้างจาก `shelf_code` ในบรรทัดเอกสาร [[tbl-ic-trans-detail]] (คู่กับ `wh_code`) และจาก [[tbl-ic-wh-shelf]]

## คอลัมน์ที่เห็นในโค้ด

| column | ความหมาย | ที่มา |
|---|---|---|
| `whcode` | รหัสคลังเจ้าของที่เก็บ ([[tbl-ic-warehouse]].code) — ชื่อคอลัมน์ไม่มี underscore | `icMasterSchemas.ts:369-374`, `stock_tools.go:384` |
| `code` | รหัสที่เก็บ (ไม่ซ้ำภายในคลังเดียวกัน) | `stock_tools.go:384` |
| `name_1` | ชื่อที่เก็บ | `ItemScreen.tsx:1630-1632` (frontend/account/master) |
| `width`, `height`, `depth` | ขนาดที่เก็บ (กว้าง/สูง/ลึก) | `icMasterSchemas.ts:376-380` |

หน้าจอ `menu_setup_ic_shelf` (1.2.18 "กำหนดพื้นที่เก็บสินค้า") ใช้ `StandardMasterScreen` ที่กรองตามคลังก่อนเสมอ (`parentFilter` บังคับเลือกคลัง) และไม่แสดงสถานะ (`hideStatus`) (`icMasterSchemas.ts:365-375`)

## ความสัมพันธ์และกระบวนการ

- n:1 กับ [[tbl-ic-warehouse]] (`whcode`)
- ลบไม่ได้ถ้าถูกใช้ใน [[tbl-ic-wh-shelf]] (`shelf_code` scope ด้วย `wh_code`) หรือ [[tbl-ic-trans-detail]] (`shelf_code` scope ด้วย `wh_code`) (`icMasterSchemas.ts:381-384`)
- **เขียน:** หน้าจอตั้งค่าผ่าน `/query/exec` ตาม legacy write allow-list (ADR-0011)
- **ตรวจ:** ก่อนบันทึก Serial ด้วยเครื่องมือ ตรวจว่า (คลัง, ที่เก็บ) มีจริง (`stock_tools.go:384`)
- **อ่าน:** กริดเอกสารเมื่อเปิด "ทุกที่เก็บ" ใช้ที่เก็บแรกที่ผู้ใช้มีสิทธิ์แทนแถวของสินค้า (`trans_grid.go:291`); รายงานยอดคงเหลือ join ด้วย `s.code = g.sh AND s.whcode = g.wh` (`report_menu_ic.go:303`); สิทธิ์ผู้ใช้ตาม `erp_user_group_wh_shelf` (`perm_wh_shelf_rest.go:73-74,110`)

## ข้อควรระวัง

- ชื่อคอลัมน์ `whcode` ไม่ตรงกับ `wh_code` ที่ตารางอื่นใช้
- ต้องระบุทั้ง `whcode` และ `code` เสมอเมื่อ join เพราะรหัสที่เก็บซ้ำข้ามคลังได้

## ที่มาในโค้ด

- `frontend/src/config/schemas/icMasterSchemas.ts:365-385`
- `backend/internal/application/process/stock_tools.go:384`
- `backend/internal/application/process/trans_grid.go:291`
- `backend/internal/application/process/report_menu_ic.go:303`
- `backend/internal/application/process/perm_wh_shelf_rest.go:73-74`, `:110`
