---
title: "ข้อมูลหน่วยนับ (ic_unit)"
tags: [tables, ic]
aliases: ["ic_unit", "หน่วยนับ", "master หน่วย"]
sources: ["backend/internal/application/process/item_detail.go:70", "backend/internal/application/process/stock_tools.go:495", "backend/internal/application/process/price_info.go:52", "backend/internal/application/process/report_pdf.go:88", "frontend/src/config/schemas/icMasterSchemas.ts:350"]
---
# ข้อมูลหน่วยนับ (`ic_unit`)

**หน้าที่:** master ของรหัสหน่วยนับ (เช่น ชิ้น/กล่อง) ใช้เป็นรหัสอ้างจาก [[tbl-ic-unit-use]], [[tbl-ic-opposite-unit]], `unit_code` ในบรรทัดเอกสาร [[tbl-ic-trans-detail]] และ `unit_cost`/`unit_standard` ของ [[tbl-ic-inventory]]

ไม่มี DDL ใน repo และไม่มีหน้าจอ CRUD ของตารางนี้ในส่วนที่อ่าน คอลัมน์ที่เห็นในโค้ดมีแค่ที่ใช้ join

## คอลัมน์ที่เห็นในโค้ด

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `code` | รหัสหน่วย (key) | `stock_tools.go:495`, `price_info.go:52` |
| `name_1` | ชื่อหน่วย | `stock_tools.go:495`, `price_info.go:52`, `report_pdf.go:88` |
| `name_2` | ชื่อหน่วยภาษาที่สอง (ใช้กรองคู่ชื่อในงาน PDF) | `report_pdf.go:88` |

## ใครอ่าน

- ตั้งค่า `ic_inventory.unit_standard_name` จาก `name_1` ของหน่วยมาตรฐานหลังบันทึกสินค้า (`stock_tools.go:495-497`)
- แสดงชื่อหน่วยของราคา (`price_info.go:52`)
- ตัวตรวจ lookup ของหน้ารายละเอียดสินค้า (`start_purchase_unit`, `start_sale_unit`, `before_sale_unit`, `start_unit_code` ต้องมีใน `ic_unit`) (`item_detail.go:39`, `:349`)

## หน้าจอและการลบ

- เขียนผ่านหน้าจอ `menu_setup_ic_unit` (1.2.16 "กำหนดหน่วยนับสินค้า", `frontend/src/config/schemas/icMasterSchemas.ts:350-362`) ด้วย `/query/exec` ตาม legacy write allow-list (ADR-0011)
- ลบไม่ได้ถ้ามีการใช้ใน `ic_inventory.unit_standard`, `ic_inventory.unit_cost`, `ic_unit_use.code` หรือ `ic_trans_detail.unit_code` (`icMasterSchemas.ts:356-361`)

## ที่มาในโค้ด

- `frontend/src/config/schemas/icMasterSchemas.ts:350-362`
- `backend/internal/application/process/stock_tools.go:495-497`
- `backend/internal/application/process/price_info.go:52`
- `backend/internal/application/process/report_pdf.go:88`
- `backend/internal/application/process/item_detail.go:39`, `:349`
