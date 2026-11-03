---
title: "หน่วยนับ ตัวตั้ง/ตัวหาร และหน่วยนับขนาน (unit / stand_value / divide_value / unit_type)"
tags: [glossary, ic, unit]
aliases: ["หน่วยนับ", "unit_code", "unitCode", "ic_unit", "ic_unit_use", "ตัวตั้ง", "ตัวหาร", "ค่ามาตรฐาน", "ค่าตัวหาร", "stand_value", "divide_value", "standValue", "divideValue", "ratio", "อัตราส่วนหน่วยนับ", "unit_type", "ประเภทหน่วยนับ", "หน่วยนับเดี่ยว", "หลายหน่วยนับ", "หน่วยนับขนาน", "ic_opposite_unit", "unit_cost", "หน่วยต้นทุน", "unit_standard", "หน่วยยอดคงเหลือ", "หน่วยช่วยขาย", "unit_code_2", "จำนวนขาย", "qty_2", "Stand Value", "Divide Value"]
sources: ["frontend/src/config/bcMenu.json:399", "frontend/src/config/schemas/icUnit.ts:22", "frontend/src/config/schemas/icInventory.ts:83", "frontend/src/config/schemas/icInventory.ts:88", "frontend/src/config/schemas/icInventory.ts:95", "frontend/account/master/ItemScreen.tsx:341", "frontend/account/master/ItemScreen.tsx:346", "frontend/account/master/ItemScreen.tsx:1047", "frontend/account/master/ItemScreen.tsx:2380", "frontend/account/master/ItemScreen.tsx:2918", "frontend/account/master/ItemScreen.tsx:3174", "frontend/src/config/schemas/masterDetailSchemas.ts:1020", "frontend/src/config/i18n/bcThaiWordDict.ts:2645", "backend/internal/application/process/trans.go:36", "backend/internal/application/process/trans.go:42", "backend/internal/application/process/trans.go:92", "backend/internal/application/process/service.go:630", "backend/internal/application/process/service.go:1080", "backend/internal/application/process/item_master.go:727", "backend/internal/application/process/trans_line_extra.go:16", "backend/internal/application/process/report_menu_ic.go:252", "backend/internal/application/process/report_menu_ic.go:345", "backend/internal/application/process/report_menu_ic.go:912", "frontend/account/transaction/TransItemGrid.tsx:232", "frontend/account/transaction/TransItemGrid.tsx:366", "frontend/account/transaction/TransItemGrid.tsx:411", "frontend/account/transaction/TransItemGrid.tsx:837"]
---

# หน่วยนับ และ ตัวตั้ง/ตัวหาร

## ในระบบนี้คืออะไร
- **หน่วยนับ** (`ic_unit`, จอ "กำหนดหน่วยนับสินค้า" bcMenu.json:399; ช่อง "รหัสหน่วยนับ" `code` และชื่อ `name_1` ใน `icUnit.ts:22-29`)
- **หน่วยของสินค้าแต่ละตัว** เก็บใน `ic_unit_use` (`ic_code`, `code`, `stand_value`, `divide_value`, `ratio` บันทึกที่ `item_master.go:727-730`) จอสินค้าแสดงหัวคอลัมน์ "ตัวตั้ง" และ "ตัวหาร" ในตาราง "1.1 ตารางหน่วยนับ" (`ItemScreen.tsx:2884-2887`, `:2918-2919`) ตารางหน่วยนับเทียบ/หน่วยนับขนาน (`ic_opposite_unit`) ก็มีหัวคอลัมน์เดียวกัน (`:3174-3175`) ส่วนจอ "ของแถมซื้อ" (`menu_ic_purchase_premium`) ใช้ป้าย "ค่ามาตรฐาน" และ "ค่าตัวหาร" (`masterDetailSchemas.ts:937-940`, `:1020-1021`) พจนานุกรมแปลเป็น Stand Value และ Divide Value (`bcThaiWordDict.ts:2645-2646`)
- จำนวนในหน่วยยอดคงเหลือคำนวณเป็น `qty × stand_value / divide_value` ยอดสต็อกคิดจาก `SUM(qty * calc_flag * (stand_value/divide_value))` ถ้าค่าเป็น 0 ให้ถือเป็น 1 (`service.go:1080`)
- รายงานสต็อกหารจำนวนฐานด้วยอัตราส่วน `stand_value / divide_value` ของ `unit_standard` ใน `ic_unit_use` เพื่อแสดงเป็นหน่วยยอดคงเหลือ (`ur`, `report_menu_ic.go:252`, `:345`) และสินค้า `unit_type` 1 หรือ 3 มีคอลัมน์ "คงเหลือ (ทอนหน่วย)" แตกเป็นหน่วยย่อย (`:349`)

## ประเภทหน่วยนับ (`ic_inventory.unit_type`)
| ค่า | dropdown (`ItemScreen.tsx:2380-2383`) | ผลบนจอ |
|---|---|---|
| 0 | 1.หน่วยนับเดี่ยว | กริดหน่วยนับล็อกไว้ 1 แถว ตัวตั้ง 1 / ตัวหาร 1 หน่วยยอดคงเหลือเท่ากับหน่วยต้นทุน |
| 1 | 2.หลายหน่วยนับ | ผู้ใช้แก้กริดหน่วยนับเอง |
| 2 | 3.หน่วยนับขนาน | เหมือนค่า 0 และมีหน่วยขนานใน `ic_opposite_unit` |
| 3 | 4.หลายหน่วยนับ+หน่วยนับขนาน | เหมือนค่า 1 และมีหน่วยขนาน |
(ค่า 0 และ 2 ล็อกกริดตาม `singleUnit` ที่ `ItemScreen.tsx:341-342` และ effect `:346-360` ตั้งหน่วยยอดคงเหลือ = หน่วยต้นทุน เหลือแถวเดียว ตัวตั้ง 1 / ตัวหาร 1; เลือกค่า 2 หรือ 3 จอเพิ่มแถวว่างในตารางหน่วยนับเทียบให้ `:2359-2370` และบันทึกไม่ได้ถ้าไม่มีรหัสหน่วยขนานสักแถว `:1047-1052`) ในรายงานรายละเอียดสินค้า "หน่วยนับขนาน" คือแถวแรกที่ใช้งานอยู่ใน `ic_opposite_unit` เฉพาะสินค้า `unit_type` 2 หรือ 3 (`report_menu_ic.go:912`)

## ช่องในเอกสาร
- `unitCode`, `standValue`, `divideValue`, `ratio` ในแต่ละบรรทัด (`trans.go:36`, `:42-44`)
- "หน่วยช่วยขาย" `unitCode2` → `unit_code_2` และ "จำนวนขาย" `qty2` → `qty_2` (`trans.go:92-93`, หัวคอลัมน์ `TransItemGrid.tsx:365-366` แสดงเมื่อ `showCompareUnit` `:232`)
- backend เก็บ `unit_code_2` / `qty_2` / `unit_size` ของบรรทัดเมื่อสินค้ามี `unit_type` 2 หรือ 3 หรือเมื่อ `erp_option.use_compare_unit = 1` และ `trans_flag` เป็น 30, 34, 36, 44, 144, 46, 48 นอกนั้นล้างเป็นค่าว่าง (`trans_line_extra.go:16`, `:22-27`, `:30-38`)
- สินค้า `unit_type` 2 หรือ 3 (`isParallelUnit`, `TransItemGrid.tsx:411`) ถ้าไม่ใส่หน่วยหรือจำนวนขนานจะขึ้นกรอบแดงและข้อความ "กรุณาระบุหน่วยและจำนวนขนาน" (`:413-414`, `:475-478`) ช่องหน่วยมี title "หน่วยนับขนาน (บังคับระบุ)" (`:837`)
- หน่วยหลักของสินค้า: "หน่วยต้นทุน" `unit_cost` และ "หน่วยยอดคงเหลือ" `unit_standard` (`icInventory.ts:88`, `:95`)

## ข้อควรระวัง
- เมนูคำนวณสต็อกใหม่จะคัดลอกตัวตั้ง/ตัวหารจาก `ic_unit_use` ลง `ic_trans_detail` เฉพาะสินค้าที่ unit_type เป็น 1 หรือ 3 สินค้าที่เป็น 0 หรือ 2 จะถูกบังคับให้เป็น 1/1 (`updateUnitRatioDetailTx`, `service.go:634-637`; ก่อนนั้นค่า 0 หรือว่างใน `ic_unit_use` ถูกแก้เป็น 1 `:632-633` และขั้นนี้ทำเมื่อไม่ได้ปิด `UpdateUnitRatio` `:605`)
- `ratio` เป็นอีกฟิลด์หนึ่งในบรรทัดเอกสาร อย่าสับสนกับตัวตั้งหรือตัวหาร ในตารางหน่วยนับของสินค้า `ratio` คือ `stand_value / divide_value` ที่คำนวณตอนบันทึก (`item_master.go:728`, `:733`)
- หน่วยนับขนานของสินค้าเก็บเป็นแถวในตาราง `ic_opposite_unit` (`item_master.go:732-734`) ส่วน `ic_trans_detail.unit_code_2` คือหน่วยช่วยขายของบรรทัดเอกสาร ถ้าจะสรุปต้องดูว่าเป็นคอลัมน์ของตารางไหน

## ลิงก์
[[std-parallel-unit-and-ref-import]] · [[term-stock-balance]] · [[term-item-type]] · [[tbl-ic-trans-detail]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/src/config/bcMenu.json:399`; `frontend/src/config/schemas/icUnit.ts:22-29`
- `frontend/src/config/schemas/icInventory.ts:83`, `:88`, `:95`
- `frontend/account/master/ItemScreen.tsx:341-342`, `:346-360`, `:1047-1052`, `:2359-2370`, `:2380-2383`, `:2884-2887`, `:2918-2919`, `:3174-3175`
- `frontend/src/config/schemas/masterDetailSchemas.ts:937-940`, `:1020-1021`; `frontend/src/config/i18n/bcThaiWordDict.ts:2645-2646`
- `backend/internal/application/process/trans.go:36`, `:42-44`, `:92-93`
- `backend/internal/application/process/trans_line_extra.go:16`, `:22-27`, `:30-38`; `item_master.go:727-734`
- `backend/internal/application/process/service.go:605`, `:630-658`, `:1080`
- `backend/internal/application/process/report_menu_ic.go:252`, `:345`, `:349`, `:912`
- `frontend/account/transaction/TransItemGrid.tsx:232`, `:365-366`, `:411-414`, `:475-478`, `:837`
