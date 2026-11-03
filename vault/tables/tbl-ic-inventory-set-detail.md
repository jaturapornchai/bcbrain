---
title: "รายการย่อยสินค้าชุด (ic_inventory_set_detail)"
tags: [tables, ic]
aliases: ["ic_inventory_set_detail", "สินค้าจัดชุด", "ส่วนประกอบสินค้าชุด", "สูตรสี"]
sources: ["backend/internal/application/process/master_detail_specs.go:144", "backend/internal/application/process/trans_set_item.go:8", "backend/internal/application/process/trans_set_item.go:30", "backend/internal/application/process/item_master.go:852"]
---
# รายการย่อยสินค้าชุด (`ic_inventory_set_detail`)

**หน้าที่:** บอกว่าสินค้าชุด (`ic_inventory.item_type = 3`) ประกอบด้วยสินค้าย่อยอะไร กี่หน่วย ราคาเท่าไร เมื่อเลือกสินค้าชุดในเอกสาร ระบบแตกแถวย่อยจากตารางนี้ลงกริด และสต๊อกถูกตัดที่แถวย่อย ไม่ใช่แถวชุด

## คอลัมน์ (จากกริด `menu_ic_item_set`, `master_detail_specs.go:147-148`)

| column | ความหมาย | ที่มา |
|---|---|---|
| `ic_set_code` | รหัสสินค้าชุด (key; [[tbl-ic-inventory]].code) | `master_detail_specs.go:147` |
| `ic_code` | รหัสสินค้าย่อย (ต้องมีใน [[tbl-ic-inventory]]; ว่าง = ข้ามแถว) | `master_detail_specs.go:148-151` |
| `barcode` | บาร์โค้ดของสินค้าย่อย | `master_detail_specs.go:148` |
| `unit_code` | หน่วยของสินค้าย่อย (ต้องมีใน `ic_unit`) | `master_detail_specs.go:150`, อัตราแปลงอ่านจาก [[tbl-ic-unit-use]] `trans_set_item.go:42-44` |
| `qty` | จำนวนสินค้าย่อยต่อ 1 ชุด | `trans_set_item.go:36` |
| `price` | ราคาของสินค้าย่อย | `trans_set_item.go:36` |
| `sum_amount` | มูลค่ารวมของแถวย่อย | `trans_set_item.go:37` |
| `price_ratio` | สัดส่วนราคาของแถวย่อยต่อราคาชุด | `trans_set_item.go:37` |
| `line_number` | ลำดับแถว | `trans_set_item.go:46` |

## กระบวนการ

- **เขียน:** หน้าจอ `menu_ic_item_set` (สินค้าจัดชุด) บังคับ `itemType: 3` ล้างแล้วเขียนใหม่ทั้งชุด ควบคุมด้วยสวิตช์ `update_detail` ของสินค้า (`master_detail_specs.go:144-153`)
- **อ่าน:** เมื่อใส่รหัสสินค้า `item_type` 3 หรือ 5 ในกริดเอกสารขาย/ซื้อบางประเภท (`setExpandFlags`: 30, 34, 36, 44, 46, 122, 56, 58) ระบบแตกแถวย่อยจากตารางนี้ แถวชุดมี `ref_guid` และแถวย่อยมี `set_ref_line` = guid นั้น (`trans_set_item.go:8-15`, `loadSetDetail` ที่ `:33-48`)
- **สต๊อก:** มีเฉพาะแถวย่อยที่ขยับสต๊อก ยอดรวมบิลและการ rebuild สต๊อกไม่นับ `item_type` 3/5 (`trans_set_item.go:12-13`) ดู [[tbl-ic-trans-detail]]
- **ลบ:** ลบเมื่อลบสินค้าชุดตาม `ic_set_code` (`item_master.go:852`); เปลี่ยนรหัสสินค้าแก้ `ic_code` (`workflow.go:139`)

## ข้อควรระวัง

- `item_type = 5` ถูกจัดเป็นสินค้าชุดในโค้ดนี้ ("สูตรสี") แต่รายงานเรียก "สูตรการผลิต" (`report_menu_ic.go:884`) ดูข้อสังเกตใน [[tbl-ic-inventory]]
- โค้ดมีคอมเมนต์ `ponytail` บอกว่า C# type 3 อ่านหน่วยของชุด ส่วนที่นี่อ่านหน่วยของสินค้าย่อยเอง เพื่อให้สต๊อกของสินค้าย่อยถูกอัตราแปลง (`trans_set_item.go:31-32`)
- เอกสารรหัส 144 ยังไม่อยู่ในกริดเอกสารของ backend จึงยังไม่แตกชุด (`trans_set_item.go:16`)

## ที่มาในโค้ด

- `backend/internal/application/process/master_detail_specs.go:144-153`
- `backend/internal/application/process/trans_set_item.go:8-48`
- `backend/internal/application/process/item_master.go:852`
- `backend/internal/application/process/workflow.go:139`
