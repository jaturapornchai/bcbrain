---
title: "รายละเอียดสินค้าเพิ่มเติม (ic_inventory_detail)"
tags: [tables, ic]
aliases: ["ic_inventory_detail", "รายละเอียดสินค้า", "dimension สินค้า"]
sources: ["backend/internal/application/process/item_detail.go:60", "backend/internal/application/process/item_detail.go:416", "backend/internal/application/process/item_master.go:708", "backend/internal/application/process/stock_tools.go:511", "backend/internal/application/process/lookup_hold.go:13", "backend/internal/application/process/trans_save_rules.go:108"]
---
# รายละเอียดสินค้าเพิ่มเติม (`ic_inventory_detail`)

**หน้าที่:** ตารางลูก 1:1 ของ [[tbl-ic-inventory]] (key `ic_code`) เก็บมิติสินค้า, คลัง/ที่เก็บ/หน่วยเริ่มต้นของการซื้อ-ขาย-เบิก, จุดสั่งซื้อ และสวิตช์ควบคุมการขาย/ซื้อ

## คอลัมน์ (จาก `buildDetailSpecs`, `item_detail.go:60-92`)

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `ic_code` | รหัสสินค้า (key ไป [[tbl-ic-inventory]]) | ทุกที่ |
| `dimension_1` ถึง `dimension_45` | มิติสินค้า 1-20 อ้าง lookup `ic_dimension`; 21-45 ข้อความอิสระ | `item_detail.go:62-67` |
| `start_purchase_wh/shelf/unit` | คลัง/ที่เก็บ/หน่วยเริ่มต้นตอนซื้อ (อ้าง [[tbl-ic-warehouse]], [[tbl-ic-shelf]], [[tbl-ic-unit]]) | `item_detail.go:70` |
| `start_sale_wh/shelf/unit`, `before_sale_unit` | คลัง/ที่เก็บ/หน่วยเริ่มต้นตอนขาย และหน่วยก่อนขาย | `item_detail.go:72-73` |
| `ic_out_wh`, `ic_out_shelf`, `start_unit_code` | คลัง/ที่เก็บ/หน่วยตอนเบิก | `item_detail.go:74` |
| `user_group_for_purchase/sale/manage/warehouse` | กลุ่มผู้ใช้ฝ่ายจัดซื้อ/ขาย/บริหาร/คลัง (อ้าง `erp_user_group`) | `item_detail.go:75-76` |
| `discount` | ส่วนลดมาตรฐานของสินค้า (ข้อความ) | `item_detail.go:80` |
| `purchase_point`, `minimum_qty`, `maximum_qty` | จุดสั่งซื้อ / ขั้นต่ำ / สูงสุด | `item_detail.go:81`, `report_menu_ic.go:611-636` |
| `have_point` | 1 = สินค้านี้สะสมแต้ม | `item_master.go:708-712`, `sysproc_tools.go:128` |
| `balance_control` | ควบคุมการตรวจยอดคงเหลือ (สินค้าที่ = 1 ไม่ถูกตรวจ ตามคอมเมนต์ใน `trans_save_rules.go:295`) | `trans_save_rules.go:108,295` |
| `accrued_control` | ควบคุมยอดค้างรับ/ค้างจ่าย (ไม่ชัดจากโค้ดที่อ่าน) | `item_detail.go:82` |
| `lock_cost`, `lock_price`, `lock_discount` | ล็อกต้นทุน/ราคา/ส่วนลด | `item_detail.go:82` |
| `is_end` | สิ้นสุดการใช้งานสินค้า (ไม่ชัดจากโค้ด) | `item_detail.go:82` |
| `is_hold_sale`, `is_hold_purchase` | 1 = ห้ามขาย / ห้ามซื้อ — เอกสารขาย/เสนอราคา/สั่งขาย/สั่งจองจะถูกปฏิเสธ | `lookup_hold.go:13-42` |
| `is_premium` | สินค้าของแถม | `item_detail.go:82` |

## ความสัมพันธ์และกระบวนการ

- 1:1 กับ [[tbl-ic-inventory]] ผ่าน `ic_code`
- ถูกสร้างอัตโนมัติถ้ายังไม่มีแถว: ตอนบันทึกสินค้า (`item_master.go:708`), ตอนบันทึกหน้ารายละเอียด (`item_detail.go:416` ข้ามถ้า `item_type = 5`), และหลังบันทึกสินค้า (`stock_tools.go:511`)
- แถวกำพร้า (ไม่มีสินค้า) ถูกลบโดย `stock_tools.go:554`
- อ่านตอนกริดเอกสารเลือกสินค้า (`trans_grid.go:288`), ตอนดึงรายการอ้างอิง (`trans_ref_import_lines.go:366`), ตอนตรวจกฎบันทึกเอกสาร (`trans_save_rules.go:108`)

## ข้อควรระวัง

- ทุกคอลัมน์มาจาก spec ในโค้ด ไม่ใช่ DDL: ชนิดข้อมูลจริงอาจต่างได้
- ตัวเลขใช้ `kNum` (decimal string ไม่ติดลบ ตาม `itemDetailNum`) และสวิตช์ใช้ `kFlag` (0/1 เท่านั้น) ตรวจใน `normField` (`item_detail.go:96-125`)
- ดูเพิ่ม [[proc-item-master-detail]]

## ที่มาในโค้ด

- `backend/internal/application/process/item_detail.go:60-92`, `:96-125`, `:171-173`, `:416-423`
- `backend/internal/application/process/item_master.go:708-712`
- `backend/internal/application/process/stock_tools.go:511-512`, `:554`
- `backend/internal/application/process/lookup_hold.go:13-42`
- `backend/internal/application/process/trans_save_rules.go:108`, `:295`
- `backend/internal/application/process/trans_grid.go:288`
