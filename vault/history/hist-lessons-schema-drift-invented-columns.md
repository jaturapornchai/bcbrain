---
title: "บทเรียน schema drift และคอลัมน์ที่เดาเอง (Schema Drift & Invented Columns)"
tags: [history, lesson, schema, database, migration]
aliases: ["คอลัมน์ที่ประดิษฐ์เอง", "invented columns", "schema drift", "erp_business_ext", "ensure DDL", "schema-guard test"]
sources: ["AGENTS.md:69", "backend/internal/platform/db/pool.go:217", "backend/internal/application/process/service.go:973", "backend/internal/application/process/pos_config.go:386", "backend/internal/application/process/pos_config.go:296", "backend/internal/application/process/pos_config.go:274", "backend/internal/application/process/pos_sync_test.go:470", "backend/internal/application/process/pos_sync_test.go:431", "backend/internal/application/process/grid_calc.go:42", "backend/internal/application/process/report_options.go:123", "backend/internal/application/process/barcode_discount.go:319", "scripts/sql/02_data_schema.sql:5385", "scripts/provision-postgres.mjs:26", "scripts/sql/13_fix_image_columns_bytea.sql:1", "frontend/account/transaction/useExpireColumn.ts:22", "frontend/shared/components/BusinessExtFieldsCard.tsx:380"]
---
# บทเรียน schema drift และคอลัมน์ที่เดาเอง

SQL ที่อ้างคอลัมน์ซึ่งฐานข้อมูลจริงไม่มี ไม่พังตอน build แต่พังตอนผู้ใช้เปิดจอ (400/500) หรือเงียบ (เขียนลงที่ไม่มีใครอ่าน) และฐานของลูกค้าเก่าอาจไม่มีคอลัมน์ที่โค้ดใหม่ใช้

## อะไรพังได้
- **ชื่อคอลัมน์ผิด:** `erp_company_profile` ของจริงใช้ `tax_number` และ `telephone_number` ไม่ใช่ `tax_id`/`telephone` ถ้า select ตามความจำ จอที่อ่านข้อมูลบริษัทจะตอบ error
- **เก็บค่าในคอลัมน์ที่ไม่มี:** ส่วนลดบาร์โค้ดไม่ใช่คอลัมน์บน `ic_inventory_barcode` แต่เป็นแถวใน `ic_inventory_barcode_price` แยกตาม `discount_type` (1-5) การเดาคอลัมน์ส่วนลดขึ้นมาเองจะเขียนลงที่ไม่มีจริง
- **ฐานเก่าขาดตาราง/คอลัมน์:** เช่น `images.image_file`, `erp_business_ext` ที่โค้ดใหม่ต้องใช้
- **DDL ล้มแล้วไม่มีใครเห็น:** จุด ensure DDL ทิ้ง error จึงรู้ว่าคอลัมน์ขาดก็ต่อเมื่อ SQL ตัวถัดไปล้ม
- **ชนิดข้อมูลผิด:** คอลัมน์ภาพที่เป็น text แทน bytea ทำให้ `convert_from(...)` ตอบ 500
- **อ่านคอลัมน์ option ที่อาจไม่มีใน tx:** SELECT ที่ล้มกลาง transaction ทำให้คำสั่งถัดไปทั้งหมดล้ม (25P02)

## โค้ดป้องกันไว้อย่างไร
| ด่าน | ที่อยู่ | ทำอะไร |
|---|---|---|
| ตรวจชื่อจริงก่อนเขียน SQL | `AGENTS.md:69-72` (กฎข้อ 25) | ใช้ `information_schema.columns` และชื่อมาตรฐาน ห้ามตั้งชื่อย่อเอง ดู [[std-pgsql-naming-convention]] |
| schema-guard test | `pos_sync_test.go:431,470` | อ่าน `CREATE TABLE erp_company_profile` จาก `scripts/sql/02_data_schema.sql` แล้วเทียบทุก `SELECT ... FROM erp_company_profile LIMIT 1` ใน `pos_config.go` และไฟล์ frontend สามไฟล์ ล้มถ้าคอลัมน์ไม่มี หรือสคีมามี `tax_id`/`telephone`; ไฟล์ frontend ต้อง alias เป็น `telephone`/`tax_id` (`:496-499`); มีเวอร์ชันยิงบนฐานจริงที่ `:504` (ข้ามเมื่อไม่ตั้ง `GLIT_DB`) |
| คอลัมน์ที่ DDL เติมเอง | `pos_sync_test.go:443-445` เทียบ `pool.go:71-72` | `latitude`/`longitude` ไม่อยู่ใน CREATE ของสคีมา test จึงต้องประกาศเพิ่ม |
| ensure DDL ตอนเปิด pool | `pool.go:217` | รัน `companySchemaSQL` ทุกฐานบริษัท ยกเว้น `postgres`/`bcmain` แต่ทิ้ง error |
| ensure DDL ต่อบริการ | `backend/internal/application/process/service.go:972-974` (`erpSchemaSQL` เริ่ม `:807`) | รันครั้งเดียวต่อฐาน และจำว่าเสร็จเมื่อสำเร็จเท่านั้น ล้มแล้วรอบหน้าลองใหม่ |
| ensure DDL ของ POS | `pos_config.go:386-389` | รันทีละ statement ถ้าล้มข้ามไปตัวถัดไป |
| ภาพเป็น bytea | `provision-postgres.mjs:26-27`, `13_fix_image_columns_bytea.sql:1-4`, `pos_config.go:274` | สร้างใหม่เป็น bytea และมีสคริปต์แปลงฐานเก่าที่รันซ้ำได้ผลเดิม |
| ส่วนลดบาร์โค้ด | `barcode_discount.go:312,319`, `02_data_schema.sql:5380-5385` | ลบแล้วเขียนแถว `ic_inventory_barcode_price` ตาม `discount_type` |
| ข้อมูลเสริมต่อประเภทธุรกิจ | `pos_config.go:296-302`, `BusinessExtFieldsCard.tsx:380-385` | ตาราง `erp_business_ext` เก็บ `ext_data` เป็น jsonb แล้ว upsert แบบรวมค่า (`||`) แทนการเพิ่มคอลัมน์ |
| อ่าน option ที่อาจขาดอย่างปลอดภัย | `grid_calc.go:40-52` `scanOption`; `useExpireColumn.ts:22-25`; `report_options.go:123-129` | ใน tx ใช้ savepoint ล้มแล้วได้ค่าเริ่มต้น; hook ปิดคอลัมน์เมื่อ query ล้ม; รายงานซ่อนต้นทุนเมื่ออ่านค่าไม่ได้ |

## กฎที่ต้องจำ
1. ชื่อคอลัมน์ต้องมาจากสคีมาจริง (`scripts/sql/02_data_schema.sql` หรือ `information_schema`) ไม่ใช่ความจำหรือเอกสารสรุป
2. ถ้าเพิ่มคอลัมน์ผ่าน ensure DDL ให้ดูทั้งสามจุด (`pool.go`, `service.go`, `pos_config.go`) และบอก schema-guard test ว่าคอลัมน์นั้นมีอยู่ เพราะ error ของ DDL ถูกกลืน
3. ข้อมูลเสริมที่ไม่ใช่คอลัมน์มาตรฐานเก็บใน `erp_business_ext` (jsonb) ไม่ต้องเพิ่มคอลัมน์
4. ชนิดภาพ/ไฟล์ใช้ bytea
5. การอ่านคอลัมน์ option ที่อาจไม่มีต้องกำหนดค่าตกหล่นไว้ล่วงหน้า (ปิดฟีเจอร์ หรือซ่อนข้อมูลสำคัญ) และห้ามให้ SELECT ที่ล้มทำให้ tx ทั้งก้อนล้ม
6. ไม่ได้ตรวจ: จออื่นนอกจาก `erp_company_profile` ที่ select คอลัมน์ตรงสคีมาหรือไม่ มี test คุมเฉพาะตารางนี้

## ที่มาในโค้ด
- `backend/internal/application/process/pos_sync_test.go:431-499,504` schema-guard test
- ดูเพิ่ม: [[std-pgsql-naming-convention]] · [[tbl-ic-inventory-barcode-price]] · [[tbl-erp-option]] · [[proc-pos-config-shift]] · [[proc-doc-item-pictures]] · [[proc-master-data]] · [[std-data-integrity-money-transactions]] · [[hist-lessons-master-save-preserve-columns]] · [[hist-lessons-query-gateway-write-lockdown]] · [[history-overview]]
