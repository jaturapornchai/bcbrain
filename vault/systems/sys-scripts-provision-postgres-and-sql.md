---
title: "สร้างฐาน PostgreSQL และชุดสคริปต์ SQL (provision-postgres.mjs, scripts/sql)"
tags: [systems, scripts, postgres, schema, seed]
aliases: ["provision-postgres", "scripts/sql", "01_main_schema.sql", "02_data_schema.sql", "02b_sync_existing_db", "03_seed_main", "04_seed_data", "populate bcdemo", "13_fix_image_columns_bytea"]
sources: ["scripts/provision-postgres.mjs:4", "scripts/provision-postgres.mjs:5", "scripts/provision-postgres.mjs:9", "scripts/provision-postgres.mjs:55", "scripts/provision-postgres.mjs:124", "scripts/provision-postgres.mjs:208", "scripts/provision-postgres.mjs:234", "scripts/provision-postgres.mjs:259", "scripts/provision-postgres.mjs:268", "scripts/provision-postgres.mjs:341", "scripts/provision-postgres.mjs:929", "scripts/sql/03_audit_r1_migrations.sql:4", "scripts/sql/09_fix_bcdemo_stock_apar_opening.sql:3", "scripts/sql/11_fix_bcdemo_ar_receipt_links.sql:5", "scripts/sql/13_fix_image_columns_bytea.sql:1", "scripts/sql/17_seed_bcdemo_account_period.sql:10", "scripts/sql/22_erp_tambon_zip_code.sql:4", "scripts/sql/23_user_datalist_config.sql:5", "scripts/sql/30_tax_doc_no_index.sql:3"]
---
# สร้างฐาน PostgreSQL และชุดสคริปต์ SQL

ระบบใช้ PostgreSQL สองแบบ: ฐาน **main** (ผู้ใช้ กลุ่ม สิทธิ์เมนู และรายการฐานข้อมูลบริษัท ตาราง `bc_*`) กับฐาน **data** ของแต่ละบริษัท (ตาราง `erp_*`, `ic_*`, `gl_*`, `cb_*`, `pos_*` ฯลฯ) โฟลเดอร์ `scripts/` มีตัวสร้างไฟล์ SQL ของทั้งสองแบบ และมีไฟล์ SQL เขียนมือที่ใช้แก้ฐานหรือเติมข้อมูลสาธิต ภาพรวมสคริปต์ทั้งโฟลเดอร์อยู่ที่ [[sys-scripts-overview]]

## provision-postgres.mjs

สคริปต์นี้ **ไม่ได้ต่อฐานข้อมูล** แค่อ่านไฟล์นิยามตาราง (`*.json`) จากโฟลเดอร์นิยามที่อยู่นอก repo (ค่าคงที่ `TABLES_ROOT`, `:4`) แยกเป็นโฟลเดอร์ย่อย `main` กับ `data` แล้วเขียนไฟล์ SQL ลง `scripts/sql` ใต้โฟลเดอร์ที่สั่งรัน (`:5`) จึงต้องรันจากราก repo แล้วค่อยนำไฟล์ที่ได้ไปรันด้วย `psql`

```
node scripts/provision-postgres.mjs
psql -d <ชื่อฐาน> -v ON_ERROR_STOP=1 -f scripts/sql/01_main_schema.sql
```

### ไฟล์ที่สร้าง

| ไฟล์ | เขียนที่ | ใช้ทำอะไร |
|---|---|---|
| `01_main_schema.sql` | `:261` | โครงสร้างฐาน main |
| `02_data_schema.sql` | `:262` | โครงสร้างฐาน data พร้อมดัชนี |
| `02b_sync_existing_db.sql` | `:263` | ชุดเดียวกับ 02 แต่ข้ามดัชนี (`skipIndexes`, `:259`) ใช้เติมคอลัมน์ใหม่ให้ฐาน data ที่มีอยู่แล้ว |
| `03_seed_main.sql` | `:341` | ข้อมูลตั้งต้นฐาน main: ผู้ใช้ กลุ่ม รายการฐานและกลุ่มฐาน |
| `04_seed_data.sql` | `:929` | ข้อมูลตั้งต้นฐาน data: ค่าหลักสินค้า/คลัง/หน่วยนับ (`ic_*`), ผังบัญชีและสมุดรายวัน (`gl_*`), จังหวัด/ตำบล, ผู้ใช้ `erp_user`, ค่า option ระบบ และเอกสารสต็อกตัวอย่างจำนวนเล็กน้อย |

`03_seed_main.sql` เริ่มด้วย `TRUNCATE TABLE` ของ `bc_user_list`, `bc_database_group`, `bc_database_list`, `bc_database_list_user_and_group`, `bc_group_list`, `bc_user_and_group` แบบ `RESTART IDENTITY` (`:268`) จึงลบผู้ใช้และรายการฐานทั้งหมดก่อนใส่ค่าตั้งต้น ใช้ได้เฉพาะฐาน main ที่ยังไม่มีข้อมูลจริง ผู้ใช้และรหัสผ่านสาธิตที่ฝังในไฟล์ที่สร้างขึ้นไม่แสดงในบันทึกนี้

### กติกาที่สคริปต์ใส่ให้ทุกตาราง

- ทุกตารางได้คอลัมน์ระบบ `ignore_sync`, `is_lock_record`, `roworder` (serial) และ `create_date_time_now`; ตารางที่มี `name_1` จะได้ `name_2` กับ `status` เพิ่ม (`buildSchemaSql`, `:124`)
- สร้างตารางด้วย `CREATE TABLE IF NOT EXISTS` และดัชนีด้วย `CREATE INDEX IF NOT EXISTS` (`:208`) แล้วเติมคอลัมน์ที่ขาดด้วย `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` จึงรันซ้ำกับฐานเดิมได้
- `erp_option` ถูกเติมคอลัมน์ให้ครบตามฟิลด์ของหน้าตั้งค่าตัวเลือก (`extractErpOptionColumns`, `:55`) และสร้างตารางเสริม `erp_option_etax_inet` กับ `erp_option_mobillyst` (`:234-251`)
- การแปลงชนิด `mapPgType` (`:9-52`): `float`/`numeric`/`currency` เป็น `numeric` เสมอ (โค้ดระบุว่าไม่ใช้ทศนิยมแบบไบนารี), `int` เป็น `integer`, `tinyint`/`smallint` เป็น `smallint`, `image` เป็น `bytea`, `date`/`smalldatetime` เป็น `date`, `datetime`/`timestamp` เป็น `timestamp without time zone`, `varchar(n)` เป็น `character varying(n)` และ `varchar` ยาวเกิน 10000 หรือไม่ระบุความยาวเป็น `text`

## สคริปต์ SQL เขียนมือใน scripts/sql

โฟลเดอร์มี 25 ไฟล์ นอกจาก 5 ไฟล์ที่สร้างจากสคริปต์ข้างบนแล้ว อีก 20 ไฟล์เป็นแบบเขียนมือ ใช้ด้วย `psql -d <ฐาน> -v ON_ERROR_STOP=1 -f scripts/sql/<ไฟล์>` ส่วนใหญ่เขียนให้รันซ้ำได้ผลเดิม (idempotent) ตามที่หัวไฟล์ระบุ

### กลุ่ม 1: แก้โครงสร้างหรือข้อมูลของระบบ

| ไฟล์ | ทำอะไร |
|---|---|
| `03_audit_r1_migrations.sql` | ชุดคำสั่งเปลี่ยนโครงสร้าง/ข้อมูลที่ไฟล์จัดเป็นระดับเสี่ยงสูง (R1) มี 7 บล็อก: (1) สร้าง role แอป `bc_app` สิทธิ์น้อยสุด (2) เพิ่มคอลัมน์ `image_url` ในตารางรูป (3) เปลี่ยน `ic_wh_shelf.min_point`/`max_point` เป็น `NUMERIC(18,4)` (4) สร้างตาราง `erp_doc_format_etax` (5) ตรวจเอกสารที่ `trans_flag` ผิดกลุ่ม (6) ตรวจ `vat_type` ที่นอกมาตรฐาน (7) ซ่อมแถวที่ `stand_value` หรือ `divide_value` เป็น 0 แต่ละบล็อกมีคำสั่ง SELECT ตรวจก่อน และหัวไฟล์ระบุว่า **ห้ามรันอัตโนมัติ** ให้ผู้ดูแลตรวจผลก่อนรันทีละบล็อก (รหัสผ่านของ role ต้องตั้งจาก env ไม่เขียนในไฟล์) |
| `13_fix_image_columns_bytea.sql` | แปลงคอลัมน์ชนิดภาพที่สคริปต์ provision รุ่นเก่าสร้างเป็น `text` ให้เป็น `bytea` แก้อาการหน้าตรวจสอบข้อมูลหลัก (`master_logs`) ขึ้น error 500 แปลงเฉพาะคอลัมน์ที่ยังเป็น `text` |
| `15_add_permissions_image_file.sql` | เพิ่มคอลัมน์ `image_file` (bytea) ในตาราง `bc_permissions_user` และ `bc_permissions_group` ของฐาน main รุ่นเก่า มิฉะนั้นตัวคุมสิทธิ์อ่านสิทธิ์เมนูไม่ได้ และผู้ใช้ที่ไม่ใช่แอดมินเข้าเมนูไม่ได้ |
| `22_erp_tambon_zip_code.sql` | เพิ่มคอลัมน์ `zip_code` ใน `erp_tambon` (`:4`) คำสั่ง ALTER เดียวกันนี้ backend รันเองตอนทำงานด้วย (`process.erpSchemaSQL`) |
| `23_user_datalist_config.sql` | ตารางเก็บรูปแบบรายการด้านซ้ายของหน้าจอข้อมูลหลักแยกตามผู้ใช้ (คอลัมน์ ความกว้าง SELECT ที่ตั้งเอง) ที่หน้าเว็บบันทึกผ่าน `POST /process/master/datalistsave` backend สร้างให้เองเมื่อใช้ครั้งแรกของแต่ละฐาน ไฟล์นี้ไว้ให้ผู้ดูแลฐานข้อมูลสร้างล่วงหน้า (`:5`) |
| `30_tax_doc_no_index.sql` | ดัชนี `UPPER(vat_number)` บน `gl_journal_vat_sale` สำหรับตรวจใบกำกับภาษีซ้ำตอนบันทึก backend สร้างให้เองเมื่อใช้ครั้งแรก รันเองเมื่อต้องการสร้างล่วงหน้าบนทะเบียนภาษีขายที่มีข้อมูลมาก (`:1-3`) |

### กลุ่ม 2: ข้อมูลสาธิตฐาน bcdemo (สมมุติทั้งหมด)

ไฟล์ 05 ระบุในหัวไฟล์ว่าเป็นข้อมูลสมมุติ 100% ไม่ใช้ชื่อแบรนด์ ห้าง หรือธนาคารจริง ไฟล์ในกลุ่มนี้ใช้กับ bcdemo เท่านั้น ไม่ใช่ฐานลูกค้า

| ไฟล์ | ทำอะไร |
|---|---|
| `05_populate_bcdemo.sql` | ข้อมูลสมมุติปริมาณมากตั้งต้น (921 บรรทัด) |
| `06_populate_all_screens_bcdemo.sql` | เติมข้อมูลให้ครบทุกหน้าจอ: ค่าเริ่มต้นของแต่ละหมวด และเอกสารธุรกรรมทุกเมนู (1,596 บรรทัด) |
| `07_fix_bcdemo_chart_pos_gl.sql` | แก้ชนิดบัญชี/ด้านยอดคงเหลือในผังบัญชี เพิ่มบัญชีภาษีขาย POS และแก้ `trans_flag` ของสมุดรายวันขาย POS |
| `08_seed_fa_depreciation_bcdemo.sql` | สินทรัพย์สมมุติ 5 รายการสำหรับเมนูโอนค่าเสื่อมราคา (เริ่มต้นต้นปี กลางเดือน ปีอธิกสุรทิน ฯลฯ) |
| `09_fix_bcdemo_stock_apar_opening.sql` | ให้ยอดคงเหลือ/ต้นทุนสินค้าและหนี้ยกมามีค่า ต้องรันก่อนสั่งสร้างยอดสต็อกใหม่ครั้งแรก |
| `10_fix_bcdemo_apar_flags_after_vat.sql` | แก้ `trans_flag` ของเอกสารเจ้าหนี้/ลูกหนี้ที่ seed ไว้ผิดความหมาย และคำนวณ `total_after_vat` |
| `11_fix_bcdemo_ar_receipt_links.sql` | แก้ลูกหนี้ติดลบในรายงานสถานะลูกหนี้ (ใบลดหนี้เกินใบกำกับ ใบรับชำระไม่อ้างใบกำกับ) |
| `12_fix_bcdemo_seed_flags_deposit_accounts.sql` | แก้ `trans_flag` ของเอกสารสาธิต PR/PO/QT และเพิ่มบัญชีมัดจำ/เงินล่วงหน้า |
| `14_fix_bcdemo_negative_stock_opening.sql` | เติมเอกสารสินค้ายกมา (`trans_flag` 54) ให้สินค้าสาธิตที่สต็อกติดลบ ไม่สร้างอะไรเพิ่มถ้าไม่มีคลังติดลบ |
| `16_fix_bcdemo_corrupt_and_populate_all.sql` | แก้ข้อความที่เพี้ยนเป็น `???` จากการส่งผ่านท่อ PowerShell ทุกตาราง แล้วเติมข้อมูลไทยตัวอย่างให้หน้าจอที่ยังว่าง รวมเอกสารตัวอย่างของ 25 เมนูธุรกรรม |
| `17_seed_bcdemo_account_period.sql` | ใส่งวดบัญชีรายเดือนแบบเปิด 12 งวดต่อปีที่มีเอกสาร บวกปี 2026 และ 2027 ลง `erp_account_period` เพราะ backend ปฏิเสธบันทึก/ลบ/ยกเลิกเอกสารที่วันที่อยู่นอกงวดเปิด ต้องรันหลัง 07-16 พร้อมรุ่น backend ที่ตรวจงวด (`:10-11`) |
| `18_fix_bcdemo_pos_default_customer.sql` | ชี้ลูกค้าเริ่มต้นของ POS ไปยังลูกค้าขายสดที่มีอยู่จริง เฉพาะเมื่อค่าเดิมไม่มีในทะเบียนลูกหนี้ |
| `19_fix_bcdemo_party_status_active.sql` | ตั้งลูกค้า/ผู้ขายสาธิตให้ใช้งานได้ (ข้อมูลสาธิตเดิมเกือบทั้งหมดเป็นสถานะปิดใช้งาน) |
| `24_remove_bcdemo_placeholder_doc_format_gl.sql` | ลบแถวแม่แบบลงบัญชี `erp_doc_format_gl` ที่ seed 06 ใส่ไว้แล้วไม่สมดุล ลบเฉพาะแถวที่ตรงกับ seed เป๊ะ จึงไม่แตะแม่แบบที่ผู้ใช้ตั้งเอง แล้วต้องสั่ง RebuildGL ทั้งช่วง |

ลำดับเติมข้อมูลเดโมตามหัวไฟล์: 05, 06, 07, 08, 09, 10, 11 แล้วสั่งสร้างยอดสต็อกใหม่ผ่าน `POST /api/v1/process/stock/rebuild` (`11_fix_bcdemo_ar_receipt_links.sql:5` และ `09_fix_bcdemo_stock_apar_opening.sql:3-5`) ไฟล์ 10 ยังสั่งสร้าง GL ใหม่ผ่าน `POST /api/v1/process/gl/rebuild` หลังรัน

## ข้อจำกัด

- `TABLES_ROOT` ชี้ไปโฟลเดอร์นอก repo จึงรัน `provision-postgres.mjs` ไม่ได้บนเครื่องที่ไม่มีโฟลเดอร์นิยามตารางนั้น ไฟล์ SQL ที่สร้างแล้วใน `scripts/sql/` ใช้ได้เลย
- ทุกครั้งที่รัน สคริปต์เขียนทับไฟล์ `01`-`04` เดิม
- เลขนำหน้าไฟล์ไม่ใช่ลำดับรันทั้งหมด: เลข `03` มีสองไฟล์ (`03_audit_r1_migrations.sql` กับ `03_seed_main.sql`) และไม่มีไฟล์เลข 20, 21, 25-29

## ที่มาในโค้ด
- `scripts/provision-postgres.mjs:4-5` ต้นทางนิยามตารางและโฟลเดอร์ผลลัพธ์, `:9-52` แปลงชนิดข้อมูล, `:55` คอลัมน์ตัวเลือกระบบ, `:124-254` สร้างสคริปต์โครงสร้าง, `:259-263` ไฟล์ schema, `:268` TRUNCATE ของ seed main, `:341` และ `:929` ไฟล์ seed
- `scripts/sql/03_audit_r1_migrations.sql:1-5` คำเตือนห้ามรันอัตโนมัติ, `:9-135` 7 บล็อก, `13_fix_image_columns_bytea.sql:1-5` ที่มาและวิธีรัน
- `scripts/sql/22_erp_tambon_zip_code.sql:1-4`, `23_user_datalist_config.sql:1-6`, `30_tax_doc_no_index.sql:1-6`
- `scripts/sql/17_seed_bcdemo_account_period.sql:1-11` งวดบัญชีเดโม, `24_remove_bcdemo_placeholder_doc_format_gl.sql:1-5` แถวแม่แบบที่ลบ
- ดูเพิ่ม: [[sys-scripts-overview]] · [[sys-scripts-issuemate-watcher]] · [[be-deployment]]
