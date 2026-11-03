---
title: "สินค้ากับคลังและที่เก็บ (ic_wh_shelf)"
tags: [tables, ic]
aliases: ["ic_wh_shelf", "คลังและที่เก็บของสินค้า", "จุดสั่งซื้อต่อคลัง", "shelf_list"]
sources: ["backend/internal/application/process/item_master.go:747", "backend/internal/application/process/item_master.go:586", "backend/internal/application/process/barcode.go:338", "backend/internal/application/process/trans_grid.go:288", "backend/internal/application/process/perm_wh_shelf.go:135", "backend/internal/application/process/master_detail_specs.go:423"]
---
# สินค้ากับคลังและที่เก็บ (`ic_wh_shelf`)

**หน้าที่:** ตารางเชื่อมสินค้า ([[tbl-ic-inventory]]) กับคู่ (คลัง [[tbl-ic-warehouse]], ที่เก็บ [[tbl-ic-shelf]]) ที่สินค้านั้นเก็บได้ พร้อมจุดต่ำสุด/สูงสุดต่อที่เก็บ และรายการตำแหน่งย่อย `shelf_list` ในหน้าสินค้าเรียกว่า "ตารางคลังและที่เก็บ"

## คอลัมน์ (จาก INSERT ที่ `item_master.go:749-752` และ `ItemWhShelfRow`)

| column | ความหมาย | ที่มา |
|---|---|---|
| `ic_code` | รหัสสินค้า | key |
| `wh_code` | รหัสคลัง ([[tbl-ic-warehouse]]) | `item_master.go:750` |
| `shelf_code` | รหัสที่เก็บ ([[tbl-ic-shelf]]; จับคู่กับ `wh_code`) | `item_master.go:750` |
| `min_point` | จุดต่ำสุด (จำนวนเต็ม `int`) | `item_master.go:751` |
| `max_point` | จุดสูงสุด (`numeric`) | `item_master.go:751` |
| `shelf_list` | รายการตำแหน่งย่อยในที่เก็บ (ข้อความ คั่นหลายค่า) | `barcode.go:338-359` |
| `status` | สถานะ | `item_master.go:751` |
| `create_date_time_now` | เวลาสร้างแถว (เห็นเฉพาะตอน INSERT จาก `appendShelf`) | `barcode.go:345` |

## กระบวนการ

- **เขียน (หน้าสินค้า):** DELETE แถวของสินค้านั้นแล้ว INSERT ใหม่ (ข้ามเมื่อโหมด sync) แต่ถ้าตัวเลือก `erp_option.enable_all_ic_wh_shelf = 1` ("ทุกคลังและที่เก็บ") สินค้า **จะไม่เก็บแถวของตัวเองเลย** (`item_master.go:586-605,631,747-753`) ดู [[tbl-erp-option]]
- **เขียน (หน้า 2.1.14 "Update Shelf"):** `appendShelf` เติมค่าลงใน `shelf_list` ของ (สินค้า, คลัง, ที่เก็บ) ถ้ายังไม่มีแถวจะ INSERT ให้ (`barcode.go:93,338-359`)
- **อ่าน (กริดเอกสาร):** คลัง/ที่เก็บเริ่มต้นของสินค้าที่เลือกในเอกสารคือแถวแรกใน `ic_wh_shelf` ที่ผู้ใช้มีสิทธิ์ (เมื่อ "ทุกที่เก็บ" ปิด) มิฉะนั้นใช้ [[tbl-ic-shelf]] แรกแทน (`trans_grid.go:288-292`)
- **อ่าน (บาร์โค้ด):** แสดงที่เก็บของสินค้าพร้อมชื่อคลัง (`barcode.go:199-201`)
- **ตรวจสิทธิ์:** `erp_option.perm_wh_shelf = 1` ตรวจว่าแถว (สินค้า, คลัง, ที่เก็บ) อยู่ในกลุ่มสิทธิ์ของผู้ใช้ (`perm_wh_shelf.go:135-136`) ดู [[proc-wh-shelf-permission]]
- **ลบ:** ตารางนี้ถูกลบพร้อมสินค้า (`itemChildTables`, `item_master.go:812`); คลัง/ที่เก็บที่ถูกอ้างอิงในตารางนี้ลบไม่ได้ (`WarehouseScreen.tsx:489`, `icMasterSchemas.ts:381-384`)
- เปลี่ยนรหัสสินค้าแก้ `ic_code` ของตารางนี้ (`workflow.go:146`)
- **หน้าจอ 2.1.23 "คลังที่เก็บสินค้า"** (`menu_ic_warehouse_locaton`) แก้กริด `wh_shelf` ของสินค้าได้โดยตรง คอลัมน์ `wh_code`, `shelf_code`, `shelf_list`, `min_point`, `max_point`, `status` (`master_detail_specs.go:418-424`)

## ข้อควรระวัง

- ตารางนี้ **ไม่ใช่ยอดคงเหลือ** ยอดคงเหลือต่อคลัง/ที่เก็บคำนวณจาก [[tbl-ic-trans-detail]] (`wh_code`, `shelf_code`)
- ชื่อคอลัมน์ในตารางนี้คือ `wh_code` แต่ตาราง [[tbl-ic-shelf]] ใช้ `whcode`

## ที่มาในโค้ด

- `backend/internal/application/process/item_master.go:586-605`, `:631`, `:747-753`, `:812`
- `backend/internal/application/process/barcode.go:93`, `:199-201`, `:338-359`
- `backend/internal/application/process/trans_grid.go:288-292`
- `backend/internal/application/process/perm_wh_shelf.go:135-136`
- `backend/internal/application/process/master_detail_specs.go:423`
- `backend/internal/application/process/workflow.go:146`
- `frontend/account/master/WarehouseScreen.tsx:489`
