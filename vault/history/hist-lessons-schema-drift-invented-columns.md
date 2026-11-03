---
title: "บทเรียน schema drift และคอลัมน์ที่เดาเอง (Schema Drift & Invented Columns)"
tags: [history, schema, parity, database, migration]
aliases: ["คอลัมน์ที่ประดิษฐ์เอง", "invented columns", "schema drift", "erp_business_ext"]
sources: ["TODO.md:8", "git:7064535f", "git:6983d7ea", "git:e7168c84", "git:28307282", "git:a50a0122", "backend/internal/platform/db/pool.go:217"]
---

## ภาพรวม
ตลอด 2026-10-19..29 โค้ดอ้างคอลัมน์/ตารางที่ DB จริงไม่มีหรือชื่อไม่ตรง เพราะสร้างจอจาก markdown หรือจำชื่อเอา ผลคือ SQL 400/500 หรือเขียนลงคอลัมน์ที่ POS ไม่อ่าน แล้วต้องเติม DDL ใน backend ให้ DB เก่าตามทัน

## อาการ
- **A (TODO.md, 7064535f):** จอ 1.1.2 รอบแรกสร้างจาก markdown ฟิลด์หาย 7 ตัว เดาเอง 3 ตัว; บาร์โค้ดมีช่อง `discount_item`, `discount_item_2..5` ใน `ic_inventory_barcode`
- **B (6983d7ea, 79c3afb6):** `CustomerScreen` select `logistic_area`, `last_update_by` จาก `ar_customer`; `SerialStockCountScreen` select `wh_code`/`shelf_code` จาก `ic_trans`; `erp_company_profile` ใช้ `tax_id`/`telephone` (จริง: `tax_number`/`telephone_number`) เมนูตอบ 400
- **C (e7168c84, 1d86f0ad):** `master_logs` ใช้ `convert_from` กับคอลัมน์ text แล้ว 500; ตาราง `images` ไม่มี `image_file`
- **D (28307282):** DB เก่าขาดตาราง/คอลัมน์ที่พอร์ตใหม่ต้องใช้
- **E (เปิดอยู่):** `useExpireColumn` ถาม `use_compare_unit`, `use_quality_control_system` จาก `erp_option` ถ้า DB ไม่มีคอลัมน์จะพัง

## สาเหตุ (root cause)
- A: อ่านเอกสารแทน C# (TODO.md ข้อ 1: โค้ด C# -> `information_schema` -> ภาพจอ -> markdown); `bcdatabase.xml` ของ BCERPTemplate ไม่มี `discount_item` ใน `ic_inventory_barcode` ส่วนลดจริงเป็นแถว `ic_inventory_barcode_price` `discount_type` 1..5
- B: ชื่อคอลัมน์ไม่ผ่านการเทียบ `information_schema`; C: ชนิด "image" ของ BC ถูกแม็ปเป็น text
- E: `scripts/sql/02_data_schema.sql:3221,3254` มีสองคอลัมน์นี้ แต่ ensure DDL ใน `pool.go`/`service.go` ไม่เติมให้ (ไม่พบ commit แก้)

## วิธีแก้
- A: 7064535f เอาคอลัมน์ที่เดาออกจาก `barcode.go` แล้วพอร์ต 2.1.8/2.1.9 เป็น `barcode_discount.go` ตาม `_icBarcodeDiscount.cs` (POS อ่านรูปแบบนี้ใน `_findPriceClass.cs`)
- B: `logistic_area` อ่านจาก `ar_customer_detail`, ใช้ `last_update_code`, `wh_from`/`location_from`; 79c3afb6 alias ที่ frontend (`tax_number AS tax_id`) และเพิ่ม schema-guard test เทียบ `scripts/sql/02_data_schema.sql`
- C: `provision-postgres.mjs` แม็ป image เป็น bytea; `scripts/sql/13_fix_image_columns_bytea.sql` แปลงคอลัมน์เดิม (ทำซ้ำได้); `posConfigDDL` สร้าง `images.image_file`
- D: ensure DDL แบบ `IF NOT EXISTS` สองที่ (ด้านล่าง); หมายเหตุ: `HANDOFF_CLAUDE_CODE_100_CLONE.md` ข้อ 1.2 ระบุ `pool.go` กับ `workflow.go` แต่ `workflow.go` ไม่มี CREATE TABLE จุดที่สองคือ `service.go`
- D ต่อ (a50a0122): ส่วนเสริมตามประเภทธุรกิจเลิก `ALTER TABLE erp_option` ที่ browser ยิงทุกครั้งที่บันทึก ไปเก็บใน `erp_business_ext(entity_type, entity_code, ext_data jsonb)`; 3ca3b07b ย้ายการสร้างตารางจาก browser ไป `pos_config.go` (commit ไม่ระบุเหตุผล; สันนิษฐานว่า DDL จาก browser ล้มเงียบหลัง lockdown 239b0997 ยังไม่ได้ทดสอบ)

## commit ที่เกี่ยวข้อง
- `7064535f` — ถอดคอลัมน์ที่เดา เพิ่ม 2.1.8/2.1.9
- `6983d7ea` — แก้ query คอลัมน์ผิด; seed `bcdemo` ด้วยบริษัทสมมติ
- `79c3afb6` — `erp_company_profile` + schema-guard test
- `e7168c84` — image เป็น bytea; `1d86f0ad` — ตาราง `images`
- `28307282` — เริ่มมี `companySchemaSQL` (pool.go) กับ `erpSchemaSQL` (service.go) 2026-10-21; `83214656`, `c0bcbb85` เติม `logo_url`, latitude/longitude
- `a50a0122`, `3ca3b07b` — `erp_business_ext`

## โค้ดปัจจุบันที่ป้องกัน
- `backend/internal/platform/db/pool.go:16` `companySchemaSQL` รันที่ `:217` ตอนเปิด pool DB บริษัท (กลืน error) มี 42 บรรทัด `ADD COLUMN IF NOT EXISTS`
- `backend/internal/application/process/service.go:796` `erpSchemaSQL`, รันที่ `:962` แคชต่อ pool และถือว่าเสร็จเมื่อสำเร็จเท่านั้น
- `backend/internal/application/process/pos_config.go:274` (`images.image_file`), `:296` (`erp_business_ext`), `:399` (`tax_number`)
- `backend/internal/application/process/pos_sync_test.go:470` (schema-guard test); `barcode_discount.go:15-19`; `scripts/provision-postgres.mjs:27`
- `frontend/account/transaction/useExpireColumn.ts:22` ยังถามสองคอลัมน์ข้างต้น (ใช้ที่ `TransItemGrid.tsx:192`)

## บทเรียน / กฎที่ได้
1. ชื่อฟิลด์ = ชื่อคอลัมน์จริงใน PostgreSQL (TODO.md ข้อ 3) ตรวจ `information_schema` ก่อนเขียน SQL
2. ensure DDL มีสองจุด เพิ่มคอลัมน์ต้องดูทั้ง `pool.go` และ `service.go`; error ที่ถูกกลืนทำให้ไม่เห็นว่า DDL ล้ม
3. ชนิด "image" ใช้ bytea; test ที่ parse DDL เทียบ SELECT (79c3afb6) กันชื่อผิดได้
4. ข้อมูลนอก C# ใช้ JSONB (`erp_business_ext`) ไม่ใช่เพิ่มคอลัมน์; ห้ามรัน DDL จาก browser
5. เปิดอยู่ตาม handoff ข้อ 8 (`HANDOFF_BCCM_PARITY_2026-10-22.md:77`): `useExpireColumn`, "set is_serial_number" ยังไม่พบ commit ปิด; MIS 3 ฟิลด์ใน TODO.md เป็น `resource_only` ไม่ใช่คอลัมน์

## ดูเพิ่ม
[[std-csharp-screen-porting]] · [[proc-doc-item-pictures]] · [[proc-master-data]] · [[std-data-integrity-money-transactions]] · [[hist-lessons-master-save-preserve-columns]] · [[hist-lessons-query-gateway-write-lockdown]] · [[hist-todo-open-items]] · [[hist-parity-bccm]] · [[history-overview]]

## ที่มาในโค้ด
- git: 7064535f, 6983d7ea, 79c3afb6, e7168c84, 1d86f0ad, 28307282, a50a0122, 3ca3b07b, 239b0997
- `TODO.md:8` (วิธีทำงาน ข้อ 1), `docs/HANDOFF_CLAUDE_CODE_100_CLONE.md` ข้อ 1.2, `docs/HANDOFF_BCCM_PARITY_2026-10-22.md:77`
