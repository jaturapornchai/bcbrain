---
title: "รายละเอียดสินทรัพย์ (as_asset_detail)"
tags: [tables, as]
aliases: ["as_asset_detail", "รายละเอียดสินทรัพย์", "ข้อมูลซื้อและค่าเสื่อมสินทรัพย์", "พารามิเตอร์ค่าเสื่อมราคา"]
sources: ["backend/internal/application/process/master_detail_specs.go:84", "backend/internal/application/process/master_detail_specs.go:215", "backend/internal/application/process/master_detail_specs.go:658", "backend/internal/application/process/master_detail_specs.go:673", "backend/internal/application/process/fa_depreciation.go:654", "backend/internal/application/process/fa_depreciation.go:471", "backend/internal/application/process/fa_depreciation.go:515", "backend/internal/application/process/fa_depreciation.go:141", "backend/internal/application/process/fa_sale.go:289", "backend/internal/application/process/fa_sale.go:497", "backend/internal/application/process/fa_sale.go:551", "backend/internal/application/process/asset_depreciation.go:49", "backend/internal/application/process/asset_depreciation.go:66", "backend/internal/application/process/report_menu_gl_fa.go:1261", "backend/internal/application/process/report_menu_gl_fa.go:1564", "frontend/src/config/schemas/masterDetailSchemas.ts:277", "scripts/sql/02_data_schema.sql:1713"]
---

# รายละเอียดสินทรัพย์ (`as_asset_detail`)

แถวเดียวต่อสินทรัพย์ (คีย์ `as_code` = [[tbl-as-asset]].`code`) เก็บ 3 กลุ่มข้อมูล: **ข้อมูลการซื้อ** (วัน ราคา ผู้ขาย เอกสาร) **ข้อมูลประกัน** และ **พารามิเตอร์ค่าเสื่อมราคา** ที่เอนจินค่าเสื่อม ([[acc-fixed-asset-depreciation]]) อ่านเป็นข้อมูลตั้งต้น รวมถึง **ฟิลด์การขาย** ที่เอกสารขาย 1802 เขียนกลับมา หน้าจอทะเบียนสินทรัพย์บันทึกตารางนี้พร้อมหัวเสมอ (grid `detail` `maxRows: 1` `master_detail_specs.go:215`; ถ้าผู้ใช้ไม่กรอก ระบบสร้างแถวว่างให้ `master_detail_specs.go:665`)

## คอลัมน์สำคัญ

### ข้อมูลการซื้อ

| คอลัมน์ | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `as_buy_date` | วันที่ซื้อ | รายงาน `report_menu_gl_fa.go:1261`, `:1564` |
| `as_buy_price` | ราคาซื้อ (ทุน) ใช้เป็นฐานคิดค่าเสื่อมถ้า `as_calc_value` = 0 และเป็น "ราคาทุน" ตอนขาย | `fa_depreciation.go:472-474`, `fa_sale.go:288` |
| `as_buy_from` | ซื้อจาก (ข้อความ) | `master_detail_specs.go:84` |
| `derived_from` | วิธีได้มา (ข้อความ ป้ายบนหน้าจอ "วิธีได้มา" `masterDetailSchemas.ts:281`; ไม่มีโค้ดอ่านไปคำนวณ) | `master_detail_specs.go:84` |
| `as_buy_year` | ปีที่ซื้อ | `master_detail_specs.go:84` |
| `doc_buy_ref`, `doc_buy_date` | เอกสารซื้ออ้างอิงและวันที่ (เก็บเป็นข้อความ/วันที่ ไม่มี FK ไปเอกสารซื้อ) | `master_detail_specs.go:84` |
| `as_buy_description` | รายละเอียดการซื้อ | `master_detail_specs.go:85` |

### ข้อมูลประกัน (ทั้งหมดเก็บเฉย ๆ ไม่มีโค้ดในโปรแกรมนี้ที่อ่านไปคำนวณ)

`insure_no`, `safety_code`, `insure_company`, `insure_money`, `insure_age`, `insure_start_date`, `insure_stop_date` (`master_detail_specs.go:85`) ป้ายบนหน้าจอ: `insure_no` = เลขที่กรมธรรม์, `safety_code` = เลขประกัน, `insure_company` = บริษัทประกัน, `insure_money` = เบี้ยประกัน, `insure_age` = อายุกรมธรรม์, `insure_start_date`/`insure_stop_date` = เริ่ม/สิ้นสุดการคุ้มครอง (`masterDetailSchemas.ts:286-292`)

### พารามิเตอร์ค่าเสื่อมราคา

| คอลัมน์ | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `calc_type` | วิธีคิด 0 = เส้นตรง, 1 = ลดน้อยถอยลง (ช่วง 0..1 `master_detail_specs.go:217`) เอนจินค่าเสื่อมคิดเส้นตรงอย่างเดียว (ค่าเสื่อมต่อปี = มูลค่า ÷ อายุ `fa_depreciation.go:141`) และไม่ได้อ่านคอลัมน์นี้ (`loadDepSources` ไม่ select `calc_type`) ใช้เฉพาะตอนเติมอัตราค่าเสื่อมบนหน้าจอ | `fa_depreciation.go:141`, `:656-661`, `asset_depreciation.go:59` |
| `as_start_cut` | ป้ายบนหน้าจอ "หักค่าเสื่อมเบื้องต้น" (`masterDetailSchemas.ts:297`) หน้าจอบันทึกอย่างเดียว ไม่มีโค้ดอ่านไปคำนวณ | `master_detail_specs.go:86` |
| `as_calc_value` | มูลค่าที่นำมาคิดค่าเสื่อม ถ้า 0 ใช้ `as_buy_price` | `fa_depreciation.go:471-474` |
| `as_dead_calc` | ช่องติ๊ก "คิดค่าซาก" (ช่วง 0..1 `master_detail_specs.go:217`, `masterDetailSchemas.ts:303`) เอนจินไม่ได้อ่านคอลัมน์นี้ | `master_detail_specs.go:217` |
| `as_dead_value` | ราคาซาก ถ้า <= 0 ระบบบันทึกเป็น 1 | `prepAsset` `master_detail_specs.go:676-677` |
| `as_age` | อายุการใช้งาน (ปี) | `fa_depreciation.go:654-662` |
| `as_rate` | อัตราค่าเสื่อมต่อปี (%) ค่าตั้งต้นบนหน้าจอ = 100 / อายุ (เส้นตรง) หรือคำนวณจากราคาซาก/มูลค่า/อายุ (ลดน้อยถอยลง) ผู้ใช้แก้ทับได้ และเอนจินไม่ได้อ่านฟิลด์นี้ (รายงานแสดงอย่างเดียว) | `asset_depreciation.go:58-59`, `:66-92`, `report_menu_gl_fa.go:1258` |
| `start_calc_date`, `stop_calc_date` | วันเริ่ม/สิ้นสุดคิดค่าเสื่อม สิ้นสุดต้อง >= เริ่ม ค่าตั้งต้นของวันสิ้นสุดคำนวณจากวันเริ่มและอายุ | `master_detail_specs.go:673`, `asset_depreciation.go:60`, `:155-169` |
| `as_value_balance` | มูลค่าคงเหลือที่ใช้คิด (ถ้า 0 และ `as_calc_value` > 0 ใช้ `as_calc_value`) | `fa_depreciation.go:476-479`, `:681` |
| `as_sum_value_balance` | ค่าเสื่อมราคาสะสมยกมา (ก่อนมีเอกสาร 1801) | `fa_depreciation.go:515`, `fa_sale.go:289` |

### ข้อมูลทั่วไป / อื่น ๆ

| คอลัมน์ | ความหมาย |
|---|---|
| `remark` | หมายเหตุ |
| `asset_status` | ช่องข้อความ "สถานะภาพ" (`masterDetailSchemas.ts:312`) ไม่มีโค้ดอ่านไปคำนวณ |
| `asset_province` | จังหวัดที่ตั้ง อ้าง `erp_province.code` (ข้อความ "ไม่พบจังหวัด" `master_detail_specs.go:216`) |
| `as_model`, `as_description` | รุ่น/รายละเอียดสินทรัพย์ |
| `as_price_group`, `as_budget` | ช่องข้อความ "กลุ่มราคา" / "งบประมาณ" (`masterDetailSchemas.ts:315-316`) หน้าจอบันทึกอย่างเดียว |

คอลัมน์ในตารางที่หน้าจอไม่บันทึกและไม่มีโค้ดเขียน: `picture_1`-`picture_4`, `status`, `guid_code` และ `as_sale_description` / `depreciate_balance` (สองตัวหลังหน้าจอแสดงในแท็บ "ขาย" แบบอ่านอย่างเดียว `masterDetailSchemas.ts:308`, `:311`) ตาม DDL `scripts/sql/02_data_schema.sql:1713-1764` พร้อมคอลัมน์ระบบมาตรฐานของทุกตาราง (`docs/kms/KMS_PGSQL_NAMING_CONVENTION.md:48-53`)

### ฟิลด์การขาย (เขียนโดยเอกสาร 1802 ไม่ใช่หน้าจอ)

| คอลัมน์ | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `as_sale_date`, `doc_sale_date` | วันที่ขาย (เท่ากัน ใช้วันที่เอกสาร) | `fa_sale.go:551` |
| `doc_sale_ref` | เลขที่เอกสารขาย 1802 | `fa_sale.go:551`, ล้างที่ `:497` |
| `as_sale_to` | ผู้ซื้อ (รหัสลูกหนี้ของเอกสาร) | `fa_sale.go:551` |
| `as_sale_price` | ราคาขายไม่รวมภาษี (`sum_amount_exclude_vat`) | `fa_sale.go:551` |

## คีย์และความสัมพันธ์
- แม่: [[tbl-as-asset]] ผ่าน `as_code` (1:1, ไม่มี FK; ลบด้วยโค้ดตอนลบสินทรัพย์ `clear` `master_detail_specs.go:218`)
- เอกสารขาย: `doc_sale_ref` ชี้เลขที่ [[tbl-as-trans]] 1802
- จังหวัด: `erp_province` ผ่าน `asset_province`

## ใครเขียน
- หน้าจอทะเบียนสินทรัพย์ (spec `menu_asset_lists` grid `detail` `master_detail_specs.go:215-217`) บันทึกคอลัมน์ทั้งหมดใน `assetDetailCols` (`master_detail_specs.go:84-88`) ยกเว้นฟิลด์การขาย
- เอกสารขาย 1802: `insertAssetSaleDoc` `fa_sale.go:551` อัปเดตห้าฟิลด์การขายต่อสินทรัพย์ในเอกสาร
- ไม่มีโค้ดใดอัปเดต `as_sum_value_balance`/`as_value_balance` หลังออกเอกสารค่าเสื่อม 1801 (มี UPDATE ของตารางนี้เฉพาะ `fa_sale.go:497`, `:551`) เอกสาร 1801 เป็นตัวเก็บค่าเสื่อมที่เกิดขึ้น (ดูข้อควรระวัง)

## ใครลบ
- ลบสินทรัพย์ผ่านหน้า master: `clear` `master_detail_specs.go:218`
- ล้างฟิลด์การขาย (`as_sale_date`, `doc_sale_date` = NULL, `as_sale_price` = 0, `as_sale_to`, `doc_sale_ref` = '') เมื่อลบ/แก้เอกสาร 1802 ที่ `doc_sale_ref = doc_no` — `deleteAssetSaleDoc` `fa_sale.go:497`

## ใครอ่าน
- เอนจินค่าเสื่อม: `loadDepSources` `fa_depreciation.go:654-662` อ่าน `as_buy_price`, `as_dead_value`, `as_age`, `start_calc_date`, `stop_calc_date`, `as_calc_value`, `as_value_balance`, `as_sum_value_balance` ต่อสินทรัพย์; `depAssetOf` `fa_depreciation.go:471-486` ตั้งฐานคิด; `depCompute` `fa_depreciation.go:515` นำ `as_sum_value_balance` + ค่าเสื่อมก่อนช่วงมารวมเป็นยอดสะสม
- ขายสินทรัพย์: `loadSaleAssets` `fa_sale.go:286-293` อ่าน `as_buy_price` (ทุน) และ `as_sum_value_balance` เพื่อคำนวณค่าเสื่อมสะสม ณ วันขาย
- หน้าจอเติมค่าตั้งต้นอัตราค่าเสื่อม/วันสิ้นสุด: `AssetDepDefaults` `asset_depreciation.go:40` / `assetDepDefaults` `:49` (ไม่เขียนฐาน แค่คำนวณคืนให้หน้าจอ)
- รายงาน: ค่าเสื่อมราคา `report_menu_gl_fa.go:1261`, ทะเบียนสินทรัพย์ `report_menu_gl_fa.go:1564`, รายงานขาย `report_menu_gl_fa.go:1547`

## ข้อควรระวัง
- ค่าเสื่อมสะสม ณ วันใดวันหนึ่ง = `as_sum_value_balance` + Σ `as_trans_detail.sum_amount` ของเอกสาร 1801 (`fa_sale.go:289-290`) ไม่ใช่ค่าที่ปรับเพิ่มในตารางนี้
- เอนจินค่าเสื่อมเป็นเส้นตรงอย่างเดียว (`fa_depreciation.go:141`) แม้ตั้ง `calc_type = 1` และ `as_rate` ไม่ได้ถูกเอนจินอ่าน (SELECT `fa_depreciation.go:656-661` ไม่มีสองคอลัมน์นี้) ถ้าต้องการให้เปลี่ยนวิธี ต้องแก้ที่เอนจิน ไม่ใช่ที่ตาราง
- สินทรัพย์ที่ขายแล้ว (มีเอกสาร 1802 ที่ `last_status = 0`) ถูกคิดค่าเสื่อมถึง "วันก่อนวันขาย" เท่านั้น (`fa_depreciation.go:481-483`) โดยวันขายอ่านจาก [[tbl-as-trans-detail]] ไม่ใช่จาก `as_sale_date` (`fa_depreciation.go:660-661`)
- `as_dead_value` ที่ <= 0 ถูกบังคับเป็น 1 ตอนบันทึก (`master_detail_specs.go:676-677`) เพื่อไม่ให้ราคาซากเป็นศูนย์
- ฟิลด์การขายถูกเขียนทับ/ล้างโดยเอกสาร 1802 ทุกครั้ง การแก้ฟิลด์เหล่านี้ที่หน้าจอทะเบียนไม่ใช่แหล่งจริง ให้ถือเอกสาร 1802 เป็นหลัก
- ยอดเงินเป็น NUMERIC ส่งเป็น string ([[acc-rounding-decimal]])

## ที่มาในโค้ด
- `backend/internal/application/process/master_detail_specs.go:84` `assetDetailCols`
- `backend/internal/application/process/master_detail_specs.go:215` grid `detail` (maxRows 1)
- `backend/internal/application/process/master_detail_specs.go:658` `prepAsset`
- `backend/internal/application/process/fa_depreciation.go:141` ค่าเสื่อมต่อปีแบบเส้นตรง (`yearVal`)
- `backend/internal/application/process/fa_depreciation.go:458` `depSource`
- `backend/internal/application/process/fa_depreciation.go:471` `depAssetOf`
- `backend/internal/application/process/fa_depreciation.go:515` ยอดสะสมยกมา
- `backend/internal/application/process/fa_depreciation.go:654` `loadDepSources`
- `backend/internal/application/process/fa_sale.go:286` `loadSaleAssets`
- `backend/internal/application/process/fa_sale.go:497` ล้างฟิลด์ขาย
- `backend/internal/application/process/fa_sale.go:551` เขียนฟิลด์ขาย
- `backend/internal/application/process/asset_depreciation.go:49` `assetDepDefaults`
- `backend/internal/application/process/asset_depreciation.go:66` `assetRate`
- `backend/internal/application/process/report_menu_gl_fa.go:1261` รายงานค่าเสื่อม
- `backend/internal/application/process/report_menu_gl_fa.go:1564` ทะเบียนสินทรัพย์
- `frontend/src/config/schemas/masterDetailSchemas.ts:277` ป้ายและชนิดช่องของหน้าจอ (`ASSET_DETAIL_FIELDS`)
- `scripts/sql/02_data_schema.sql:1713` DDL `as_asset_detail`

## ดูเพิ่ม
- [[tbl-group-as]]
- [[tbl-as-asset]]
- [[tbl-as-trans-detail]]
- [[acc-fixed-asset-depreciation]]
