---
title: "ประเภทสินทรัพย์ (as_asset_type)"
tags: [tables, as]
aliases: ["as_asset_type", "ประเภทสินทรัพย์", "หมวดสินทรัพย์", "asset type"]
sources: ["backend/internal/application/process/master_detail_specs.go:207", "backend/internal/application/process/report_menu_gl_fa.go:1265", "backend/internal/application/process/report_menu_gl_fa.go:1569", "backend/internal/application/process/report_menu_gl_fa.go:1633", "backend/internal/application/process/fa_depreciation.go:646", "frontend/account/master/BcLookupModal.tsx:109", "frontend/account/master/BcLookupModal.tsx:259", "frontend/account/master/StandardMasterScreen.tsx:74", "scripts/sql/02_data_schema.sql:1922", "frontend/src/config/schemas/icMasterSchemas.ts:791", "backend/internal/domain/query/write_policy_legacy.go:16", "docs/kms/KMS_PGSQL_NAMING_CONVENTION.md:48"]
---

# ประเภทสินทรัพย์ (`as_asset_type`)

master แบบง่าย (รหัส + ชื่อ) ของ "ประเภทสินทรัพย์" ใช้จัดกลุ่มสินทรัพย์ใน [[tbl-as-asset]] ผ่านคอลัมน์ `as_type` เพื่อกรองช่วงประเภทตอนประมวลผลค่าเสื่อมราคา และแสดงชื่อประเภทในรายงานสินทรัพย์ ตารางนี้ไม่มีตรรกะบัญชี (ไม่ผูกบัญชีค่าเสื่อม บัญชีผูกที่ตัวสินทรัพย์เอง ดู [[tbl-as-asset]])

## คอลัมน์สำคัญ

| คอลัมน์ | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `code` | รหัสประเภทสินทรัพย์ (คีย์) ตรงกับ `as_asset.as_type` | `master_detail_specs.go:207`, `report_menu_gl_fa.go:1265` |
| `name_1` | ชื่อประเภท แสดงในรายงานแทนรหัส | `report_menu_gl_fa.go:1265`, `:1569`, `:1633` |
| `name_2` | ชื่อรอง (หน้าค้นหาดึงมาแสดงเพราะตารางนี้ไม่อยู่ในรายการที่ไม่มี `name_2`) | `BcLookupModal.tsx:111`, `:259` |

คอลัมน์อื่นของตาราง: DDL อยู่ใน `scripts/sql/02_data_schema.sql:1922-1934` ได้แก่ `code` varchar(25), `name_1` varchar(100), `name_2` varchar(100), `status` smallint, `guid_code` varchar(35) (คำสั่ง `ALTER ... ADD COLUMN IF NOT EXISTS` ของ `name_2` varchar(200) และ `status` บรรทัด 1933-1934 มีผลเฉพาะฐานที่ยังไม่มีสองคอลัมน์นี้) และคอลัมน์ระบบมาตรฐานของทุกตาราง (`ignore_sync`, `is_lock_record`, `roworder`, `create_date_time_now` ตาม `docs/kms/KMS_PGSQL_NAMING_CONVENTION.md:48-53`) โค้ดเว็บอ่านเฉพาะ `code`, `name_1`, `name_2` จอ master ไม่ตั้ง `showStatus` จึงไม่เขียน `status` (`StandardMasterScreen.tsx:74`, `icMasterSchemas.ts:787-792`)

## คีย์และความสัมพันธ์
- ผู้ใช้: [[tbl-as-asset]].`as_type` = `code` (ตรวจตอนบันทึกสินทรัพย์ ข้อความ "ไม่พบประเภทสินทรัพย์" `master_detail_specs.go:207`)
- ตัวกรองค่าเสื่อม: เอกสาร 1801 เก็บช่วงประเภทที่ประมวลผลใน [[tbl-as-trans]] (`from_as_type`, `to_as_type` ตอน INSERT `fa_depreciation.go:966-977`) และกรอง `a.as_type` ตอนคิด (`depWhere` `fa_depreciation.go:646`)
- ไม่มีตารางลูกอื่นที่อ้างตารางนี้ในโค้ด

## ใครเขียน และใครอ่าน
- เขียน: ผ่านหน้า master มาตรฐาน (Standard master, schema `icMasterSchemas.ts:787-792`) ทาง `/query/exec` ตาม legacy write allow-list (ADR-0011, `write_policy_legacy.go:16`) ไม่มี process เฉพาะทางเขียนตารางนี้
- อ่านเพื่อเลือก: หน้าค้นหา (lookup modal) ของ frontend อนุญาตตารางนี้ (`BcLookupModal.tsx:45`, `:109`) ดึง `code, name_1, name_2`
- อ่านเพื่อรายงาน: `lateral join` ดึง `name_1` ของประเภทสินทรัพย์ใน `glfaLoadAssets` ซึ่งรายงานค่าเสื่อมสินทรัพย์ (`glfaAssetDep`) ใช้ `report_menu_gl_fa.go:1265`, รายงานทะเบียนสินทรัพย์ `glfaAssetList` `:1569`, รายงานภาพสินทรัพย์ (`menu_asset_picture`) `:1633`

## ข้อควรระวัง
- ไม่มีตัวกันลบจากโค้ดนี้: spec ของสินทรัพย์ตรวจว่า `as_type` มีอยู่ตอนบันทึก (`master_detail_specs.go:207`) แต่ไม่มีรายการ `uses` ที่กันการลบประเภทที่ยังมีสินทรัพย์ใช้อยู่ (ดู `uses` ของ spec สินทรัพย์ `master_detail_specs.go:220-223` ซึ่งตรวจเฉพาะตารางซ่อมบำรุง ตารางขาย และเอกสาร) และ schema ของหน้าประเภทสินทรัพย์ไม่มี `fkChecks` (`icMasterSchemas.ts:787-792`) การลบประเภทจะทำให้รายงานแสดงรหัสแทนชื่อ (รายงานใช้ `coalesce(ty.name_1, a.as_type, '')` `report_menu_gl_fa.go:1257`)
- ตารางสินทรัพย์อื่นที่มีรูปแบบเดียวกัน (รหัส+ชื่อ): `as_asset_location`, `as_asset_maintain`, `as_asset_maintain_unit` ดู [[tbl-group-as]]

## ที่มาในโค้ด
- `backend/internal/application/process/master_detail_specs.go:207` อ้างประเภทจากสินทรัพย์
- `backend/internal/application/process/master_detail_specs.go:220` ตัวกันลบของสินทรัพย์ (ไม่มีประเภท)
- `backend/internal/application/process/report_menu_gl_fa.go:1265` ชื่อประเภทในรายงานค่าเสื่อม (`glfaLoadAssets`)
- `backend/internal/application/process/report_menu_gl_fa.go:1569` ชื่อประเภทในรายงานทะเบียนสินทรัพย์
- `backend/internal/application/process/report_menu_gl_fa.go:1633` ชื่อประเภทในรายงานภาพสินทรัพย์
- `backend/internal/application/process/fa_depreciation.go:646` กรองช่วงประเภทตอนคิดค่าเสื่อม
- `frontend/account/master/BcLookupModal.tsx:109` ตารางที่ lookup อนุญาต
- `frontend/account/master/BcLookupModal.tsx:259` คอลัมน์ที่ lookup ดึง
- `scripts/sql/02_data_schema.sql:1922` DDL ของตาราง (`ALTER ... ADD COLUMN IF NOT EXISTS` `name_2`, `status` บรรทัด 1933-1934)
- `frontend/src/config/schemas/icMasterSchemas.ts:791` schema หน้าจอประเภทสินทรัพย์
- `backend/internal/domain/query/write_policy_legacy.go:16` legacy write allow-list

## ดูเพิ่ม
- [[tbl-group-as]]
- [[tbl-as-asset]]
- [[proc-master-data]]
