---
title: "ข้อมูลหน่วยนับ (ic_unit)"
tags: [tables, ic]
aliases: ["ic_unit", "หน่วยนับ", "master หน่วย"]
sources: ["scripts/sql/02_data_schema.sql:7220", "backend/internal/application/process/item_detail.go:71", "backend/internal/application/process/stock_tools.go:495", "backend/internal/application/process/price_info.go:52", "backend/internal/application/process/report_pdf.go:88", "frontend/src/config/schemas/icMasterSchemas.ts:350", "frontend/account/master/StandardMasterScreen.tsx:620"]
---
# ข้อมูลหน่วยนับ (`ic_unit`)

**หน้าที่:** master ของรหัสหน่วยนับ (เช่น ชิ้น/กล่อง) ใช้เป็นรหัสอ้างจาก [[tbl-ic-unit-use]], [[tbl-ic-opposite-unit]], `unit_code` ในบรรทัดเอกสาร [[tbl-ic-trans-detail]] และ `unit_cost`/`unit_standard` ของ [[tbl-ic-inventory]]

โครงสร้างตาราง: `scripts/sql/02_data_schema.sql:7220-7232` คอลัมน์ใน DDL คือ `code` (varchar 25), `name_1`, `name_2` (varchar 100), `status`, `guid_code` ส่วนโค้ดและหน้าจอใช้เฉพาะ `code`, `name_1`, `name_2`

## คอลัมน์ที่เห็นในโค้ด

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `code` | รหัสหน่วย (key) | `stock_tools.go:495`, `price_info.go:52` |
| `name_1` | ชื่อหน่วย | `stock_tools.go:495`, `price_info.go:52`, `report_pdf.go:88` |
| `name_2` | ชื่อหน่วยภาษาที่สอง (ใช้จับคู่ชื่อไทย → ชื่อภาษาที่สองในรายงาน PDF `loadBilingualDataMap`) | `report_pdf.go:88`, `StandardMasterScreen.tsx:620-622` |

## ใครอ่าน

- ตั้งค่า `ic_inventory.unit_standard_name` จาก `name_1` ของหน่วยมาตรฐานหลังบันทึกสินค้า (`itemSavedSQL` `stock_tools.go:494-497`, เรียกจาก `item_master.go:618`)
- แสดงชื่อหน่วยของราคา (`price_info.go:52`)
- ตัวตรวจ lookup ของหน้ารายละเอียดสินค้า (`start_purchase_unit`, `start_sale_unit`, `before_sale_unit`, `start_unit_code` ต้องมีใน `ic_unit`) (`item_detail.go:36-41,71-74`)

## หน้าจอและการลบ

- เขียนผ่านหน้าจอ `menu_setup_ic_unit` (1.2.16 "กำหนดหน่วยนับสินค้า", `frontend/src/config/schemas/icMasterSchemas.ts:350-362`) ด้วย `/query/exec` ตาม legacy write allow-list (ADR-0011) หน้าจอมาตรฐานบันทึกคอลัมน์ `code`, `name_1`, `name_2` และไม่มีช่องสถานะ (`hideStatus`) (`StandardMasterScreen.tsx:424-425,620-622`)
- ลบไม่ได้ถ้ามีการใช้ใน `ic_inventory.unit_standard`, `ic_inventory.unit_cost`, `ic_unit_use.code` หรือ `ic_trans_detail.unit_code` (`icMasterSchemas.ts:356-361`)

## ที่มาในโค้ด

- `scripts/sql/02_data_schema.sql:7220-7232`
- `frontend/src/config/schemas/icMasterSchemas.ts:350-362`
- `backend/internal/application/process/stock_tools.go:494-497`
- `backend/internal/application/process/item_master.go:618`
- `frontend/account/master/StandardMasterScreen.tsx:424-425`, `:620-622`
- `backend/internal/application/process/price_info.go:52`
- `backend/internal/application/process/report_pdf.go:88`
- `backend/internal/application/process/item_detail.go:36-41`, `:71-74`
