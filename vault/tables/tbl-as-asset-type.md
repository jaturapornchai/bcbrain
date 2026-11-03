---
title: "ประเภทสินทรัพย์ (as_asset_type)"
tags: [tables, as]
aliases: ["as_asset_type", "ประเภทสินทรัพย์", "หมวดสินทรัพย์", "asset type"]
sources: ["backend/internal/application/process/master_detail_specs.go:207", "backend/internal/application/process/report_menu_gl_fa.go:1262", "backend/internal/application/process/report_menu_gl_fa.go:1566", "backend/internal/application/process/report_menu_gl_fa.go:1630", "backend/internal/application/process/fa_depreciation.go:646", "frontend/account/master/BcLookupModal.tsx:108", "frontend/account/master/BcLookupModal.tsx:258"]
---

# ประเภทสินทรัพย์ (`as_asset_type`)

master แบบง่าย (รหัส + ชื่อ) ของ "ประเภทสินทรัพย์" ใช้จัดกลุ่มสินทรัพย์ใน [[tbl-as-asset]] ผ่านคอลัมน์ `as_type` เพื่อกรองช่วงประเภทตอนประมวลผลค่าเสื่อมราคา และแสดงชื่อประเภทในรายงานสินทรัพย์ ตารางนี้ไม่มีตรรกะบัญชี (ไม่ผูกบัญชีค่าเสื่อม บัญชีผูกที่ตัวสินทรัพย์เอง ดู [[tbl-as-asset]])

## คอลัมน์สำคัญ

| คอลัมน์ | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `code` | รหัสประเภทสินทรัพย์ (คีย์) ตรงกับ `as_asset.as_type` | `master_detail_specs.go:207`, `report_menu_gl_fa.go:1262` |
| `name_1` | ชื่อประเภท แสดงในรายงานแทนรหัส | `report_menu_gl_fa.go:1262`, `:1566`, `:1630` |
| `name_2` | ชื่อรอง (หน้าค้นหาดึงมาแสดงเพราะตารางนี้ไม่อยู่ในรายการที่ไม่มี `name_2`) | `BcLookupModal.tsx:258` |

คอลัมน์อื่นของตาราง: (ไม่ชัดจากโค้ด) ไม่พบ DDL หรือ spec หน้าจอเฉพาะของตารางนี้ในรีโป โค้ดอ่านเฉพาะ `code`, `name_1`, `name_2`

## คีย์และความสัมพันธ์
- ผู้ใช้: [[tbl-as-asset]].`as_type` = `code` (ตรวจตอนบันทึกสินทรัพย์ ข้อความ "ไม่พบประเภทสินทรัพย์" `master_detail_specs.go:207`)
- ตัวกรองค่าเสื่อม: เอกสาร 1801 เก็บช่วงประเภทที่ประมวลผลใน [[tbl-as-trans]] (`from_as_type`, `to_as_type`) และกรอง `a.as_type` ตอนคิด (`depWhere` `fa_depreciation.go:646`)
- ไม่มีตารางลูกอื่นที่อ้างตารางนี้ในโค้ด

## ใครเขียน และใครอ่าน
- เขียน: ผ่านหน้า master มาตรฐาน (Standard master) ทาง `/query/exec` ตาม legacy write allow-list (ADR-0011) ไม่มี process เฉพาะทางเขียนตารางนี้
- อ่านเพื่อเลือก: หน้าค้นหา (lookup modal) ของ frontend อนุญาตตารางนี้ (`BcLookupModal.tsx:44`, `:108`) ดึง `code, name_1, name_2`
- อ่านเพื่อรายงาน: `lateral join` ดึง `name_1` ของประเภทสินทรัพย์ในรายงานค่าเสื่อม `report_menu_gl_fa.go:1262`, รายละเอียดสินทรัพย์ `:1566`, รายการอื่น `:1630`

## ข้อควรระวัง
- ไม่มีตัวกันลบจากโค้ดนี้: spec ของสินทรัพย์ตรวจว่า `as_type` มีอยู่ตอนบันทึก (`master_detail_specs.go:207`) แต่ไม่มีรายการ `uses` ที่กันการลบประเภทที่ยังมีสินทรัพย์ใช้อยู่ (ดู `uses` ของ spec สินทรัพย์ `master_detail_specs.go:220-223` ซึ่งตรวจเฉพาะตารางซ่อมบำรุง ตารางขาย และเอกสาร) การลบประเภทจะทำให้รายงานแสดงรหัสแทนชื่อ (รายงานใช้ `coalesce(ty.name_1, a.as_type, '')` `report_menu_gl_fa.go:1245-1262`)
- ตารางสินทรัพย์อื่นที่มีรูปแบบเดียวกัน (รหัส+ชื่อ): `as_asset_location`, `as_asset_maintain`, `as_asset_maintain_unit` ดู [[tbl-group-as]]

## ที่มาในโค้ด
- `backend/internal/application/process/master_detail_specs.go:207` อ้างประเภทจากสินทรัพย์
- `backend/internal/application/process/master_detail_specs.go:220` ตัวกันลบของสินทรัพย์ (ไม่มีประเภท)
- `backend/internal/application/process/report_menu_gl_fa.go:1262` ชื่อประเภทในรายงานค่าเสื่อม
- `backend/internal/application/process/report_menu_gl_fa.go:1566` ชื่อประเภทในรายละเอียดสินทรัพย์
- `backend/internal/application/process/report_menu_gl_fa.go:1630` ชื่อประเภทในรายงานอื่น
- `backend/internal/application/process/fa_depreciation.go:646` กรองช่วงประเภทตอนคิดค่าเสื่อม
- `frontend/account/master/BcLookupModal.tsx:108` ตารางที่ lookup อนุญาต
- `frontend/account/master/BcLookupModal.tsx:258` คอลัมน์ที่ lookup ดึง

## ดูเพิ่ม
- [[tbl-group-as]]
- [[tbl-as-asset]]
- [[proc-master-data]]
