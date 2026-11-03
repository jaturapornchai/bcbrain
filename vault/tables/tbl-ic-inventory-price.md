---
title: "ราคาขายสินค้าตามเงื่อนไข (ic_inventory_price)"
tags: [tables, ic]
aliases: ["ic_inventory_price", "ราคาขายมาตรฐาน", "ราคาขายทั่วไป", "ราคาตามกลุ่มลูกค้า"]
sources: ["backend/internal/application/process/master_detail_specs.go:28", "backend/internal/application/process/master_detail_specs.go:40", "backend/internal/application/process/master_detail_specs.go:49", "backend/internal/application/process/modify_price.go:24", "backend/internal/application/process/modify_price.go:38"]
---
# ราคาขายสินค้าตามเงื่อนไข (`ic_inventory_price`)

**หน้าที่:** ตารางราคาขายของสินค้าหนึ่งตัวตามเงื่อนไข (หน่วย/ช่วงจำนวน/ช่วงวันที่/ชนิดการขาย) แบ่งตามผู้ซื้อด้วย `price_type` และแบ่งชุดราคาด้วย `price_mode` คนละชุดกับราคาบาร์โค้ดใน [[tbl-ic-inventory-barcode]]

## คอลัมน์

| column | ความหมาย | ที่มา |
|---|---|---|
| `ic_code` | รหัสสินค้า ([[tbl-ic-inventory]]) | `master_detail_specs.go:43` |
| `price_type` | 1 = ราคาของสินค้า (ทุกคน), 2 = ตามกลุ่มลูกหนี้, 3 = ตามลูกหนี้รายตัว | `master_detail_specs.go:40`, `modify_price.go:26` |
| `price_mode` | 0 = ราคามาตรฐาน (หน้าจอ `menu_ic_item_saleprice`), 1 = ราคาทั่วไป (`menu_ic_item_saleprice_2`) | `modify_price.go:27`, `master_detail_specs.go:168-169` |
| `cust_group_1`, `cust_group_2` | กลุ่มลูกหนี้ (เฉพาะ `price_type = 2`) | `master_detail_specs.go:55` |
| `cust_code` | รหัสลูกหนี้ (เฉพาะ `price_type = 3`; อ้าง [[tbl-ar-customer]]) | `master_detail_specs.go:57` |
| `unit_code` | หน่วยนับของราคา (ต้องเป็นหน่วยของสินค้านั้นใน [[tbl-ic-unit-use]]) | `master_detail_specs.go:44` |
| `sale_price1`, `sale_price2` | ราคาขาย 2 ช่อง (ถ้าทั้งสองเป็น 0 บรรทัดนั้นถูกข้าม) | `master_detail_specs.go:28,33-35` |
| `from_qty`, `to_qty` | ช่วงจำนวน | `master_detail_specs.go:28` |
| `from_date`, `to_date` | ช่วงวันที่ | `master_detail_specs.go:28` |
| `sale_type` | ชนิดการขาย 0-2 (ความหมายแต่ละค่าไม่ชัดจากโค้ดที่อ่าน) | `master_detail_specs.go:28,39` |
| `status` | สถานะ 0-1 | `master_detail_specs.go:39` |
| `line_number` | ลำดับบรรทัด | `master_detail_specs.go:45` |

## กระบวนการ

- **เขียน:** `salePriceSpec(mode)` สร้าง 3 กริด (normal / group / customer) เขียนด้วยชุด `price_mode` เดียวกัน และล้างเฉพาะ `price_mode` ของหน้าจอนั้นก่อนบันทึก (`master_detail_specs.go:49-59`); ถูกควบคุมด้วยสวิตช์ `update_price` ของสินค้า (`gate: "update_price"`, `:50`)
- **แก้ราคาทีละชุด:** `modifyPriceKinds` มีชนิด `standard_1..3`, `general_1..3` ชี้มาที่ตารางนี้ (`modify_price.go:38-43`)
- **ลบ/เปลี่ยนรหัส:** ลบพร้อมสินค้า (`item_master.go:814`); เปลี่ยนรหัสสินค้าแก้ `ic_code` และเปลี่ยนรหัสลูกหนี้แก้ `cust_code` (`workflow.go:137,152`)
- **อ่าน:** ชื่อหน่วยของราคา (`price_info.go:52`)

## ข้อควรระวัง

- ราคา 0 ทั้งคู่จะไม่ถูกบันทึก ไม่ใช่แถวราคา 0
- ตารางที่เกี่ยวข้องแต่แยกกัน: `ic_inventory_discount` (ส่วนลดตามเงื่อนไข, `master_detail_specs.go:65`), `ic_inventory_purchase_price` (ราคาซื้อ, `:76`), `ic_inventory_price_formula` (ราคาสูตร `price_0..price_9`, `modify_price.go:36`) — ดู [[tbl-group-ic]]

## ที่มาในโค้ด

- `backend/internal/application/process/master_detail_specs.go:28-59`, `:65`, `:76`, `:168-169`
- `backend/internal/application/process/modify_price.go:24-43`
- `backend/internal/application/process/item_master.go:814`
- `backend/internal/application/process/workflow.go:137`, `:152`
- `backend/internal/application/process/price_info.go:52`
