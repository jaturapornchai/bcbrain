---
title: "หน่วยนับ ตัวตั้ง/ตัวหาร และหน่วยนับขนาน (unit / stand_value / divide_value / unit_type)"
tags: [glossary, ic, unit]
aliases: ["หน่วยนับ", "unit_code", "unitCode", "ic_unit", "ic_unit_use", "ตัวตั้ง", "ตัวหาร", "ค่ามาตรฐาน", "ค่าตัวหาร", "stand_value", "divide_value", "standValue", "divideValue", "ratio", "อัตราส่วนหน่วยนับ", "unit_type", "ประเภทหน่วยนับ", "หน่วยนับเดี่ยว", "หลายหน่วยนับ", "หน่วยนับขนาน", "ic_opposite_unit", "unit_cost", "หน่วยต้นทุน", "unit_standard", "หน่วยยอดคงเหลือ", "หน่วยช่วยขาย", "unit_code_2", "จำนวนขาย", "qty_2", "Stand Value", "Divide Value"]
sources: ["frontend/src/config/bcMenu.json:399", "frontend/src/config/schemas/icUnit.ts:22", "frontend/src/config/schemas/icInventory.ts:83", "frontend/src/config/schemas/icInventory.ts:88", "frontend/src/config/schemas/icInventory.ts:95", "frontend/account/master/ItemScreen.tsx:338", "frontend/account/master/ItemScreen.tsx:2376", "frontend/account/master/ItemScreen.tsx:2900", "frontend/src/config/schemas/masterDetailSchemas.ts:1013", "frontend/src/config/i18n/bcThaiWordDict.ts:2645", "backend/internal/application/process/trans.go:36", "backend/internal/application/process/trans.go:42", "backend/internal/application/process/trans.go:92", "backend/internal/application/process/service.go:618", "backend/internal/application/process/service.go:1069", "backend/internal/application/process/report_menu_ic.go:883", "backend/internal/application/process/report_menu_ic.go:886", "frontend/account/transaction/TransItemGrid.tsx:837"]
---

# หน่วยนับ และ ตัวตั้ง/ตัวหาร

## ในระบบนี้คืออะไร
- **หน่วยนับ** (`ic_unit`, จอ "กำหนดหน่วยนับสินค้า" bcMenu.json:399; ช่อง "รหัสหน่วยนับ" `code` และชื่อ `name_1` ใน `icUnit.ts:22-29`)
- **หน่วยของสินค้าแต่ละตัว** เก็บใน `ic_unit_use` (`ic_code`, `code`, `stand_value`, `divide_value`) จอสินค้าแสดงหัวคอลัมน์ "ตัวตั้ง" และ "ตัวหาร" (`ItemScreen.tsx:2900-2901`) ในจอ master-detail ใช้ป้าย "ค่ามาตรฐาน" และ "ค่าตัวหาร" (`masterDetailSchemas.ts:1013-1014`) พจนานุกรมแปลเป็น Stand Value และ Divide Value (`bcThaiWordDict.ts:2645-2646`)
- จำนวนในหน่วยยอดคงเหลือคำนวณเป็น `qty × stand_value / divide_value` ยอดสต็อกคิดจาก `SUM(qty * calc_flag * (stand_value/divide_value))` ถ้าค่าเป็น 0 ให้ถือเป็น 1 (`service.go:1069`)

## ประเภทหน่วยนับ (`ic_inventory.unit_type`)
| ค่า | dropdown (`ItemScreen.tsx:2376-2379`) | ผลบนจอ |
|---|---|---|
| 0 | 1.หน่วยนับเดี่ยว | กริดหน่วยนับล็อกไว้ 1 แถว ตัวตั้ง 1 / ตัวหาร 1 หน่วยยอดคงเหลือเท่ากับหน่วยต้นทุน |
| 1 | 2.หลายหน่วยนับ | ผู้ใช้แก้กริดหน่วยนับเอง |
| 2 | 3.หน่วยนับขนาน | เหมือนค่า 0 และมีหน่วยขนานใน `ic_opposite_unit` |
| 3 | 4.หลายหน่วยนับ+หน่วยนับขนาน | เหมือนค่า 1 และมีหน่วยขนาน |
(กติกาบนจอมาจากคอมเมนต์ `ItemScreen.tsx:338-340` ชื่อในรายงานมาจาก `report_menu_ic.go:886` หน่วยนับขนานหาจาก `ic_opposite_unit` ที่ `report_menu_ic.go:883`)

## ช่องในเอกสาร
- `unitCode`, `standValue`, `divideValue`, `ratio` ในแต่ละบรรทัด (`trans.go:36`, `:42-44`)
- "หน่วยช่วยขาย" `unitCode2` → `unit_code_2` และ "จำนวนขาย" `qty2` → `qty_2` (`trans.go:92-93`, หัวคอลัมน์ `TransItemGrid.tsx:365-366`)
- สินค้าหน่วยนับขนานบังคับให้ระบุหน่วยขนาน (`TransItemGrid.tsx:837` "หน่วยนับขนาน (บังคับระบุ)")
- หน่วยหลักของสินค้า: "หน่วยต้นทุน" `unit_cost` และ "หน่วยยอดคงเหลือ" `unit_standard` (`icInventory.ts:88`, `:95`)

## ข้อควรระวัง
- เมนูคำนวณสต็อกใหม่จะคัดลอกตัวตั้ง/ตัวหารจาก `ic_unit_use` ลง `ic_trans_detail` เฉพาะสินค้าที่ unit_type เป็น 1 หรือ 3 สินค้าที่เป็น 0 หรือ 2 จะถูกบังคับให้เป็น 1/1 (`service.go:618-628`)
- `ratio` เป็นอีกฟิลด์หนึ่งในบรรทัดเอกสาร อย่าสับสนกับตัวตั้งหรือตัวหาร
- KMS อธิบาย `ic_inventory.unit_code_2` ว่าเป็นหน่วยขนาน ส่วน `ic_trans_detail.unit_code_2` ในโค้ดเป็นหน่วยช่วยขาย ถ้าจะสรุปต้องดูว่าเป็นคอลัมน์ของตารางไหน

## ลิงก์
[[std-parallel-unit-and-ref-import]] · [[term-stock-balance]] · [[term-item-type]] · [[tbl-ic-trans-detail]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/src/config/bcMenu.json:399`; `frontend/src/config/schemas/icUnit.ts:22-29`
- `frontend/src/config/schemas/icInventory.ts:83`, `:88`, `:95`
- `frontend/account/master/ItemScreen.tsx:338-340`, `:2376-2379`, `:2900-2901`
- `frontend/src/config/schemas/masterDetailSchemas.ts:1013-1014`; `frontend/src/config/i18n/bcThaiWordDict.ts:2645-2646`
- `backend/internal/application/process/trans.go:36`, `:42-44`, `:92-93`
- `backend/internal/application/process/service.go:618-628`, `:1069`
- `backend/internal/application/process/report_menu_ic.go:883`, `:886`
- `frontend/account/transaction/TransItemGrid.tsx:365-366`, `:837`
