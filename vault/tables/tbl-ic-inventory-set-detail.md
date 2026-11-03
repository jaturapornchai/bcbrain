---
title: "รายการย่อยสินค้าชุด (ic_inventory_set_detail)"
tags: [tables, ic]
aliases: ["ic_inventory_set_detail", "สินค้าจัดชุด", "ส่วนประกอบสินค้าชุด", "สูตรสี"]
sources: ["scripts/sql/02_data_schema.sql:5761", "backend/internal/application/process/master_detail_specs.go:146", "backend/internal/application/process/master_detail_specs.go:614", "backend/internal/application/process/master_detail.go:442", "backend/internal/application/process/master_detail.go:449", "backend/internal/application/process/trans_set_item.go:18", "backend/internal/application/process/trans_set_item.go:33", "backend/internal/application/process/trans_set_item.go:71", "backend/internal/application/process/trans_set_item.go:124", "backend/internal/application/process/trans_set_item.go:172", "backend/internal/application/process/transcalc.go:112", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/item_master.go:852", "backend/internal/application/process/workflow.go:139", "backend/internal/application/process/report_menu_ic.go:913", "backend/internal/application/process/report_menu_ic.go:936", "frontend/src/config/schemas/masterDetailSchemas.ts:337", "frontend/account/master/ItemScreen.tsx:2246", "frontend/src/config/schemas/erpOption/tab2Gl.ts:141"]
---
# รายการย่อยสินค้าชุด (`ic_inventory_set_detail`)

**หน้าที่:** บอกว่าสินค้าชุด (`ic_inventory.item_type = 3`) ประกอบด้วยสินค้าย่อยอะไร กี่หน่วย ราคาเท่าไร เมื่อเลือกสินค้าชุดในเอกสาร ระบบแตกแถวย่อยจากตารางนี้ลงกริด และสต๊อกถูกตัดที่แถวย่อย ไม่ใช่แถวชุด

## คอลัมน์ (DDL `scripts/sql/02_data_schema.sql:5761-5775`, จอ 2.1.17 "สินค้าชุด" `menu_ic_item_set` `master_detail_specs.go:146-154`)

| column | ความหมาย | ที่มา |
|---|---|---|
| `ic_set_code` | รหัสสินค้าชุด (key; [[tbl-ic-inventory]].code ที่ `item_type = 3`) | `master_detail_specs.go:146-147`, `masterDetailSchemas.ts:344,350` |
| `ic_code` | รหัสสินค้าย่อย (ต้องมีใน [[tbl-ic-inventory]]; ว่าง = ข้ามแถว; ห้ามเป็นรหัสของชุดตัวเอง) | `master_detail_specs.go:148,150,152`, `:618-620` |
| `barcode` | บาร์โค้ดของสินค้าย่อย (DDL varchar 25; ความยาวสูงสุดอ่านจากคอลัมน์จริงในฐานข้อมูล เกิน 25 ตอบ "ยาวเกิน 25 ตัวอักษร" แม้ช่องกรอกในจอตั้ง `maxLength: 50`) | `master_detail_specs.go:148`, `master_detail.go:442-443,449-468`, `masterDetailSchemas.ts:367` |
| `unit_code` | หน่วยของสินค้าย่อย (backend ตรวจแค่ว่ามีใน `ic_unit`; ช่องเลือกในจอแสดงเฉพาะหน่วยที่สินค้าย่อยมีใน [[tbl-ic-unit-use]]) | `master_detail_specs.go:151`, `masterDetailSchemas.ts:368-379` |
| `qty` | จำนวนสินค้าย่อยต่อ 1 ชุด (ต้องมากกว่า 0; ค่าตั้งต้นในจอ 1) | `master_detail_specs.go:622-624`, `masterDetailSchemas.ts:381` |
| `price` | ราคาของสินค้าย่อย; ตอนแตกชุด ถ้าเป็น -1 ระบบหาราคาขายของสินค้าย่อยแทน | `trans_set_item.go:99-106` |
| `sum_amount` | มูลค่าแถว = `qty x price` ปัด 2 ตำแหน่ง ระบบคำนวณทับตอนบันทึก | `master_detail_specs.go:625-627`, `masterDetailSchemas.ts:383` |
| `price_ratio` | อัตราส่วนราคาของแถวต่อราคารวม = `price / ผลรวม sum_amount` ปัด 3 ตำแหน่ง แถวสุดท้ายรับเศษให้ `sum(qty x ratio) = 1` | `master_detail_specs.go:629-642` |
| `line_number` | ลำดับแถว (ใช้เรียงตอนแตกชุด) | `trans_set_item.go:45` |
| `status` | มีใน DDL แต่จอสินค้าชุดไม่บันทึกและไม่พบตัวอ่านใน backend ที่ค้น | `02_data_schema.sql:5761-5775` |

## กระบวนการ

- **เขียน:** จอ `menu_ic_item_set` (สินค้าจัดชุด) บังคับ `itemType: 3` ล้างแล้วเขียนใหม่ทั้งชุด ควบคุมด้วยสวิตช์ `update_detail` ของสินค้า (`master_detail_specs.go:146-154`) คำนวณ `sum_amount` และ `price_ratio` ฝั่งเซิร์ฟเวอร์ก่อนเขียน (`prepItemSet` `:614-644`)
- **อ่านตอนแตกชุด:** เมื่อใส่รหัสสินค้า `item_type` 3 หรือ 5 ในกริดเอกสารที่ `trans_flag` อยู่ใน `setExpandFlags` (30, 34, 36, 44, 46, 122, 56, 58) ระบบแตกแถวย่อยจากตารางนี้ แถวชุดมี `ref_guid` และแถวย่อยมี `set_ref_line` = guid นั้น (`expandSet` `trans_set_item.go:71-120`, `setExpandFlags` `:18`, `isSetItem` `:22`) เอกสารชนิดอื่นไม่แตกชุด
- **อัตราแปลงหน่วย:** `loadSetDetail` อ่านอัตราแปลง (`stand_value`, `divide_value`, `ratio`) จากหน่วยของสินค้าย่อยเองใน [[tbl-ic-unit-use]] ถ้าไม่พบแถวหน่วยใช้ 1 (`trans_set_item.go:33-45`)
- **สูตรสี:** สินค้า `item_type = 5` แสดงแถวย่อยเพียง 2 แถวแรก (`trans_set_item.go:80-82`); แถวย่อยที่เป็นสีผสม (`item_type = 6`) คิดจำนวนและราคาจากสูตรของแถวที่ 3 เป็นต้นไป (`colorMix` `:227-260`)
- **ราคาชุด:** `price_ratio` ถูกใช้กับแถวย่อยของชุด `item_type = 3`; ถ้าเปิดตัวเลือก "ใช้ระบบกำหนดราคาสินค้าชุด" (`erp_option.fix_item_set_price`) แถวย่อยใช้ราคาที่เก็บไว้ตอนแตกชุด (`set_ref_price`) แทนการหาราคาขายใหม่ และคำนวณสัดส่วนราคาตอนแตกชุด (`trans_set_item.go:96-98,111-114,124-141,193-196`, `loadFixSetPrice` `:64-68`, ป้ายตัวเลือก `tab2Gl.ts:141-143`)
- **แก้จำนวนชุด:** แก้จำนวนของแถวชุด แถวย่อยได้จำนวน = `set_ref_qty x จำนวนชุด` และคิดราคาใหม่ ราคาแถวชุด = ยอดรวมแถวย่อย (`setQty` `:144-165`, `recalcSet` `:172-222`)
- **สต๊อกและยอดรวม:** ตัวสร้างยอดสต๊อกนับเฉพาะแถวเอกสารที่ `item_type` เป็น 0, 4, 6 จึงไม่นับแถวชุด (3/5) และนับแถวย่อยแทน (`stockRowsSQL` `stock_rebuild.go:18`); ยอดรวมท้ายเอกสารตัดแถวชุดออกเช่นกัน (`setTotalLines` `transcalc.go:112-125`) ดู [[tbl-ic-trans-detail]]
- **รายงาน:** รายงานสูตรสินค้าชุดอ่านตารางนี้ร่วมกับสินค้าชุด `item_type = 3` (`icSetFormulaSpec` `report_menu_ic.go:936-948`)
- **ลบ/เปลี่ยนรหัส:** ลบเมื่อลบสินค้าชุดตาม `ic_set_code` (`item_master.go:852`); เปลี่ยนรหัสสินค้าแก้เฉพาะ `ic_code` ไม่พบการแก้ `ic_set_code` ในรายการเปลี่ยนรหัส (`workflow.go:139`)

## ข้อควรระวัง

- `item_type = 5` ป้ายชื่อไม่ตรงกัน: จอสินค้าเรียก "สูตรสี" (`ItemScreen.tsx:2246`) แต่รายงานประเภทสินค้าเรียก "สูตรการผลิต" (`report_menu_ic.go:913`) ดูข้อสังเกตใน [[tbl-ic-inventory]]
- จอ 2.1.17 เปิดบันทึกได้เฉพาะสินค้า `item_type = 3` (`master_detail_specs.go:146`) ใน backend ที่ค้นไม่พบตัวเขียนแถวย่อยของสินค้า `item_type = 5` จึงยังไม่ทราบว่ารายการย่อยของสูตรสีถูกสร้างจากที่ใด
- ราคา `-1` ผ่านการตรวจตัวเลขของจอบันทึก (`decimalPattern` `trans.go:29` รับเลขติดลบ) และ `prepItemSet` คำนวณ `sum_amount` จาก `qty x price` ตรง ๆ ไม่แยกกรณี -1

## ที่มาในโค้ด

- `scripts/sql/02_data_schema.sql:5761-5775`
- `backend/internal/application/process/master_detail_specs.go:146-154`, `:614-644`
- `backend/internal/application/process/master_detail.go:442-443`, `:449-468`
- `backend/internal/application/process/trans_set_item.go:18`, `:22`, `:33-45`, `:64-68`, `:71-120`, `:124-141`, `:144-165`, `:172-222`, `:227-260`
- `backend/internal/application/process/trans.go:29`
- `backend/internal/application/process/transcalc.go:112-125`
- `backend/internal/application/process/stock_rebuild.go:18`
- `backend/internal/application/process/item_master.go:852`
- `backend/internal/application/process/workflow.go:139`
- `backend/internal/application/process/report_menu_ic.go:913`, `:936-947`
- `frontend/src/config/schemas/masterDetailSchemas.ts:337-390`
- `frontend/account/master/ItemScreen.tsx:2246`
- `frontend/src/config/schemas/erpOption/tab2Gl.ts:141-143`
