---
title: "สินค้ากับคลังและที่เก็บ (ic_wh_shelf)"
tags: [tables, ic]
aliases: ["ic_wh_shelf", "คลังและที่เก็บของสินค้า", "จุดสั่งซื้อต่อคลัง", "shelf_list"]
sources: ["scripts/sql/02_data_schema.sql:7356", "backend/internal/application/process/item_master.go:749", "backend/internal/application/process/item_master.go:596", "backend/internal/application/process/item_master.go:812", "backend/internal/application/process/barcode.go:340", "backend/internal/application/process/trans_grid.go:290", "backend/internal/application/process/perm_wh_shelf.go:135", "backend/internal/application/process/master_detail_specs.go:422", "frontend/account/master/WarehouseScreen.tsx:489", "frontend/src/config/schemas/icMasterSchemas.ts:386"]
---
# สินค้ากับคลังและที่เก็บ (`ic_wh_shelf`)

**หน้าที่:** ตารางเชื่อมสินค้า ([[tbl-ic-inventory]]) กับคู่ (คลัง [[tbl-ic-warehouse]], ที่เก็บ [[tbl-ic-shelf]]) ที่สินค้านั้นเก็บได้ พร้อมจุดต่ำสุด/สูงสุดต่อที่เก็บ และรายการตำแหน่งย่อย `shelf_list` ในหน้าสินค้าเรียกว่า "ตารางคลังและที่เก็บ"

## คอลัมน์ (DDL `scripts/sql/02_data_schema.sql:7356-7369`, เขียนจาก INSERT ที่ `item_master.go:749-751` และ `ItemWhShelfRow` `item_master.go:104-111`)

DDL กำหนด `min_point` และ `max_point` เป็น `numeric` ส่วนการตรวจฝั่ง backend ให้ `min_point` เป็นจำนวนเต็มไม่ติดลบ DDL มีคอลัมน์ `remark` เพิ่มจากตารางข้างล่าง ซึ่ง INSERT ของหน้าสินค้าไม่เขียน

| column | ความหมาย | ที่มา |
|---|---|---|
| `ic_code` | รหัสสินค้า | key |
| `wh_code` | รหัสคลัง ([[tbl-ic-warehouse]]) ยาวไม่เกิน 25 ตัวอักษร | `item_master.go:750` |
| `shelf_code` | รหัสที่เก็บ ([[tbl-ic-shelf]]; จับคู่กับ `wh_code`) ยาวไม่เกิน 25 | `item_master.go:750` |
| `min_point` | จุดต่ำสุด (จำนวนเต็ม `int` ไม่ติดลบ) | `item_master.go:447-450,750` |
| `max_point` | จุดสูงสุด (`numeric`) | `item_master.go:451,750` |
| `shelf_list` | รายการตำแหน่งย่อยในที่เก็บ (ข้อความ คั่นหลายค่า ยาวไม่เกิน 255) | `item_master.go:440,750` |
| `status` | สถานะ | `item_master.go:750` |
| `create_date_time_now` | เวลาสร้างแถว (เห็นเฉพาะตอน INSERT จาก `appendShelf`) | `barcode.go:345` |

## กระบวนการ

- **เขียน (หน้าสินค้า):** `parseItemShelves` ข้ามแถวที่ `wh_code` ว่าง และปฏิเสธคู่ (คลัง, ที่เก็บ) ซ้ำ (`item_master.go:423-464`) จากนั้น DELETE แถวของสินค้านั้นแล้ว INSERT ใหม่ (ข้ามทั้งชุดเมื่อเป็นเมนู `menu_ic_item_for_sync`) แต่ถ้าตัวเลือก `erp_option.enable_all_ic_wh_shelf = 1` ("ทุกคลังและที่เก็บ") สินค้า **จะไม่เก็บแถวของตัวเองเลย** (`item_master.go:631,736-753`) ดู [[tbl-erp-option]]
- **ต้องมีอย่างน้อย 1 แถว:** ถ้าไม่ใช่เมนู sync และตัวเลือก "ทุกคลังและที่เก็บ" ปิด การบันทึกสินค้าที่ไม่มีแถวคลัง/ที่เก็บเลยถูกปฏิเสธ "ยังไม่บันทึกคลังที่เก็บ ..." (`item_master.go:596-598`)
- **เขียน (หน้า 2.1.14 "Update Shelf"):** `appendShelf` เติมค่าลงใน `shelf_list` ของ (สินค้า, คลัง, ที่เก็บ) ถ้ายังไม่มีแถวจะ INSERT ให้ (`barcode.go:93,340-364`) ถ้ากรอก Update Shelf แล้วไม่ได้เลือกคลัง/ที่เก็บเริ่มต้นจะถูกปฏิเสธ (`barcode.go:263-266`)
- **อ่าน (กริดเอกสาร):** คลัง/ที่เก็บเริ่มต้นของสินค้าที่เลือกในเอกสารคือแถวแรก (เรียงตาม `wh_code`) ใน `ic_wh_shelf` ที่ผู้ใช้มีสิทธิ์ เมื่อ "ทุกที่เก็บ" ปิด มิฉะนั้นใช้ [[tbl-ic-shelf]] แรกแทน (`trans_grid.go:272,289-292`)
- **อ่าน (บาร์โค้ด):** แสดงที่เก็บของสินค้าพร้อมชื่อคลัง (`barcode.go:199-201`)
- **ตรวจสิทธิ์:** `erp_option.perm_wh_shelf = 1` ตรวจว่าแถว (สินค้า, คลัง, ที่เก็บ) มีอยู่ในตารางนี้ และคลัง/ที่เก็บอยู่ในกลุ่มสิทธิ์ของผู้ใช้ (`perm_wh_shelf.go:127-143`) ดู [[proc-wh-shelf-permission]]
- **ลบ:** แถวของตารางนี้ถูกลบพร้อมสินค้าในหน้าลบสินค้า เฉพาะสินค้าที่ยังไม่มีรายการใน `ic_trans_detail` (สินค้าที่ถูกใช้แล้วถูกข้าม) — รายการตารางลูก `itemChildTables` ที่ `item_master.go:812` และลูปลบที่ `item_master.go:847-849` คลังที่ถูกอ้างอิงในตารางนี้ลบไม่ได้ (หน้าคลังตรวจ `count3` ก่อนลบ `WarehouseScreen.tsx:489`) และที่เก็บที่ถูกอ้างอิงก็ลบไม่ได้ (`icMasterSchemas.ts:386`)
- เปลี่ยนรหัสสินค้าแก้ `ic_code` ของตารางนี้ (`workflow.go:146`)
- **หน้าจอ 2.1.23 "คลังที่เก็บสินค้า"** (`menu_ic_warehouse_locaton`, `screenRegistry.tsx:310-312`) แก้กริด `wh_shelf` ของสินค้าได้โดยตรง คอลัมน์ `wh_code`, `shelf_code`, `shelf_list`, `min_point`, `max_point`, `status`; `wh_code` ต้องมีใน `ic_warehouse` ("ไม่พบคลังสินค้า"), `status` ต้อง 0-1, ข้ามแถวที่ `wh_code` ว่าง, `min_point`/`max_point` ว่างให้เป็น `0`, `status` ว่างให้เป็น `1`, คู่ (คลัง, ที่เก็บ) ซ้ำถูกปฏิเสธ (`master_detail_specs.go:419-451`)

## ข้อควรระวัง

- ตารางนี้ **ไม่ใช่ยอดคงเหลือ** ยอดคงเหลือต่อคลัง/ที่เก็บคำนวณจาก [[tbl-ic-trans-detail]] (`wh_code`, `shelf_code`)
- ชื่อคอลัมน์ในตารางนี้คือ `wh_code` แต่ตาราง [[tbl-ic-shelf]] ใช้ `whcode`

## ที่มาในโค้ด

- `scripts/sql/02_data_schema.sql:7356-7369`
- `backend/internal/application/process/item_master.go:104-111`, `:423-464`, `:596-598`, `:631`, `:736-753`, `:812`, `:847-849`
- `backend/internal/application/process/barcode.go:93`, `:199-201`, `:263-266`, `:340-364`
- `backend/internal/application/process/trans_grid.go:272`, `:289-292`
- `backend/internal/application/process/perm_wh_shelf.go:127-143`
- `backend/internal/application/process/master_detail_specs.go:419-451`
- `backend/internal/application/process/workflow.go:146`
- `frontend/account/master/WarehouseScreen.tsx:489`
- `frontend/src/config/schemas/icMasterSchemas.ts:386`
- `frontend/account/tabs/screenRegistry.tsx:310-312`
