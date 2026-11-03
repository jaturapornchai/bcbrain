---
title: "รายการเอกสารสินทรัพย์ (as_trans_detail)"
tags: [tables, as]
aliases: ["as_trans_detail", "รายการค่าเสื่อมราคา", "รายการขายสินทรัพย์", "บรรทัดเอกสารสินทรัพย์"]
sources: ["backend/internal/application/process/fa_depreciation.go:982", "backend/internal/application/process/fa_depreciation.go:660", "backend/internal/application/process/fa_sale.go:535", "backend/internal/application/process/fa_sale.go:289", "backend/internal/application/process/fa_sale.go:488", "backend/internal/application/process/gl_template.go:802", "backend/internal/application/process/gl_template.go:864", "backend/internal/application/process/master_detail_specs.go:223", "backend/internal/application/process/report_menu_gl_fa.go:1267", "backend/internal/application/process/report_menu_gl_fa.go:1542", "backend/internal/application/process/fa_depreciation.go:654", "backend/internal/application/process/fa_depreciation.go:980", "scripts/sql/02_data_schema.sql:1976", "docs/kms/KMS_PGSQL_NAMING_CONVENTION.md:48"]
---

# รายการเอกสารสินทรัพย์ (`as_trans_detail`)

บรรทัดลูกของ [[tbl-as-trans]] 1 แถวต่อ 1 สินทรัพย์ในเอกสาร ใช้สองแบบตาม `trans_flag`:

| trans_flag | ความหมายของแถว | ผู้เขียน |
|---|---|---|
| 1801 | ค่าเสื่อมราคาของสินทรัพย์ 1 ตัวในงวดนั้น (`sum_amount` = ค่าเสื่อมงวดนี้) | `fa_depreciation.go:982` |
| 1802 | สินทรัพย์ 1 ตัวที่ขาย (ทุน ค่าเสื่อมสะสม มูลค่าตามบัญชี ราคาขาย กำไรขาดทุน) | `fa_sale.go:535` |

นอกจากเป็นรายการของเอกสาร ตารางนี้ยังเป็นตัวเชื่อม "สินทรัพย์ → เอกสาร" (ผ่าน `item_code` = รหัส [[tbl-as-asset]]) ที่ใช้คำนวณค่าเสื่อมสะสม ตรวจว่าขายแล้ว และกันลบสินทรัพย์ที่มีเอกสาร

## คอลัมน์สำคัญ

DDL ใน `scripts/sql/02_data_schema.sql:1976-1991` กำหนดเฉพาะ `doc_no`, `doc_date`, `doc_time`, `item_code`, `item_name`, `sum_amount`, `remark`, `trans_flag`, `line_number`, `trans_type` บวกคอลัมน์ระบบมาตรฐานของทุกตาราง (`docs/kms/KMS_PGSQL_NAMING_CONVENTION.md:48-53`) และดัชนี `(doc_no, trans_flag)`, `(doc_date, trans_flag)`, `(item_code)` (`02_data_schema.sql:1992-1994`) คอลัมน์ที่เอกสารขาย 1802 เขียนเพิ่ม (`cust_code`, `price_default`, `average_cost`, `price`, `sum_amount_exclude_vat`, `profit_lost_cost_amount`, `last_status`, `branch_code` ฯลฯ) ไม่อยู่ใน DDL นี้ และไม่พบคำสั่ง ALTER ใน `scripts/sql` หรือ `backend` จึงยืนยันชนิดข้อมูลของคอลัมน์เหล่านี้จาก repo ไม่ได้ (ยังไม่ได้ตรวจกับฐานข้อมูลจริง)

### ร่วมกันทั้งสองชนิด

| คอลัมน์ | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `doc_no`, `doc_date`, `doc_time` | ตรงกับหัว [[tbl-as-trans]] | `fa_depreciation.go:982`, `fa_sale.go:535` |
| `trans_flag` | 1801 / 1802 (คีย์เชื่อมหัวคู่กับ `doc_no`) | ทุก SQL |
| `item_code` | รหัสสินทรัพย์ ([[tbl-as-asset]].`code`) | ทุกที่ที่เชื่อมสินทรัพย์ |
| `item_name` | ชื่อสินทรัพย์ ณ วันบันทึก ตัดที่ 255 ตัวอักษร | `fa_depreciation.go:980`, `fa_sale.go:544` |
| `line_number` | ลำดับบรรทัด เริ่มจาก 0 | `fa_depreciation.go:983-984`, `fa_sale.go:536`, `:538` |
| `sum_amount` | 1801 = ค่าเสื่อมราคาของงวด; 1802 = ราคาขาย (รวมตามที่ระบบเก็บ) | ดูตารางด้านล่าง |
| `branch_code` | สาขา | ทุก INSERT |

### เฉพาะ 1801

| คอลัมน์ | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `remark` | เก็บค่าว่าง | `fa_depreciation.go:983-984` |
| `sum_amount` | ค่าเสื่อมราคาของงวดที่คำนวณได้ต่อสินทรัพย์ (`Amount` ของแถวผลคำนวณ) | `fa_depreciation.go:527`, `:567`, `:980`, `:984` |

### เฉพาะ 1802

| คอลัมน์ | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `trans_type` | = 2 (`saleTransType` `fa_sale.go:17`) | `fa_sale.go:542` |
| `cust_code`, `inquiry_type`, `vat_type` | คัดลอกจากหัวเอกสาร | `fa_sale.go:542` |
| `tax_type` | เก็บ 0 | `fa_sale.go:538` |
| `price_default` | ราคาทุนของสินทรัพย์ (`Cost`) | `fa_sale.go:545`, รายงาน `report_menu_gl_fa.go:1543` |
| `average_cost` | ค่าเสื่อมราคาสะสม (`AccumDep`) | `fa_sale.go:545`, `gl_template.go:814` |
| `price` | มูลค่าตามบัญชี (`BookValue`) | `fa_sale.go:546`, `report_menu_gl_fa.go:1544` |
| `sum_amount` | ราคาขาย (`SalePrice`) | `fa_sale.go:546` |
| `sum_amount_exclude_vat` | ราคาขายไม่รวมภาษี (`ExcludeVat`) ใช้เป็น "ราคาขาย" ในรายงานขายสินทรัพย์และเป็น `as_sale_price` | `fa_sale.go:547`, `:552`, `report_menu_gl_fa.go:1544` |
| `total_vat_value` | ภาษีมูลค่าเพิ่มของบรรทัด | `fa_sale.go:547` |
| `profit_lost_cost_amount` | กำไร (ขาดทุน) จากการขาย | `fa_sale.go:548`, `report_menu_gl_fa.go:1544` |
| `last_status` | เก็บ 0 (ใช้บอกว่าบรรทัดยังใช้งาน) | `fa_sale.go:539`, `:291-292` |
| `creator_code`, `create_datetime` | ผู้บันทึก/เวลา | `fa_sale.go:539`, `:543` |

## คีย์และความสัมพันธ์
- หัว: [[tbl-as-trans]] ด้วย `doc_no` + `trans_flag` (ไม่มี FK; ลบด้วยโค้ดทั้งคู่ตามลำดับ ลูกก่อนหัว `fa_sale.go:488-496`, `fa_depreciation.go:880-884`)
- สินทรัพย์: `item_code` = [[tbl-as-asset]].`code` และ [[tbl-as-asset-detail]].`as_code` (ไม่มี FK)
- GL: เอกสารเดียวกันมีใน [[tbl-gl-journal]] / [[tbl-gl-journal-detail]] ด้วย `doc_no` + `trans_flag`

## ใครเขียน
- 1801: `insertDepDoc` `fa_depreciation.go:964` insert หลายแถวด้วย `unnest` เดียว (`fa_depreciation.go:982-987`) ([[acc-fixed-asset-depreciation]])
- 1802: `insertAssetSaleDoc` `fa_sale.go:513` insert หลายแถวด้วย `unnest` เดียว (`fa_sale.go:535-550`)
- ไม่มี UPDATE ของตารางนี้ในโค้ด แก้ไขด้วยการลบเอกสารทั้งใบแล้วสร้างใหม่

## ใครลบ
- 1801: `deleteFADepreciation` ลบเอกสาร `fa_depreciation.go:880-884` (พร้อม `as_trans`, `gl_journal_detail`, `gl_journal`); ตอนบันทึกซ้ำเลขที่เดิมจะลบ 4 ตารางนี้ก่อน insert ใหม่ (`fa_depreciation.go:823-827`) ภายใต้ advisory lock `fa-depreciation` (`fa_depreciation.go:817`)
- 1802: `deleteAssetSaleDoc` `fa_sale.go:487` (`as_trans_detail` เป็นตารางแรกในลำดับ `:488`)

## ใครอ่าน
- ค่าเสื่อมสะสม ณ วันขาย: `loadSaleAssets` `fa_sale.go:286-294` ใช้ `as_sum_value_balance` + Σ `sum_amount` ของ 1801 ต่อ `item_code` (`:289-290`) และรวม `doc_no` ของ 1802 ที่ยังใช้งาน (`last_status = 0`) ของสินทรัพย์เดียวกัน (`:291-292`) เพื่อปฏิเสธการขายซ้ำ (ยกเว้นเอกสารที่กำลังแก้) ด้วยข้อความ "ขายไปแล้วในเอกสาร ..." `fa_sale.go:312`
- วันที่ขายสินทรัพย์ในเอนจินค่าเสื่อม: `loadDepSources` `fa_depreciation.go:654` (subquery วันที่แรกของ 1802 ที่ `last_status = 0` `:660-661`)
- ตรวจสินทรัพย์ในเอกสาร 1801 ที่ถูกขายแล้ว: `fa_depreciation.go:868-871`; ตรวจช่วงวันที่ทับซ้อนระหว่างเอกสาร 1801 `fa_depreciation.go:940-943`
- ลง GL: ผลรวมต้นทุน/ค่าเสื่อมสะสมของหัว `gl_template.go:802`, `:814` และรายการ `glSQLDetailAS` `gl_template.go:864-871` ([[acc-gl-template-engine]])
- รายงาน: รายละเอียดสินทรัพย์/วันที่ขาย (`glfaLoadAssets` `report_menu_gl_fa.go:1267`); รายงานขายสินทรัพย์ `report_menu_gl_fa.go:1542-1550` (join ที่ `:1545`)
- ตัวกันลบสินทรัพย์: spec ของ master สินทรัพย์ห้ามลบถ้ามีแถวที่ `item_code` ตรง (ข้อความ "มีเอกสารสินทรัพย์อ้างอิงแล้ว") `master_detail_specs.go:223`

## ข้อควรระวัง
- `trans_flag` ต้องใส่ทุก SQL: เอกสาร 1801 และ 1802 ใช้ `doc_no` ร่วมกับตารางอื่นและเลขที่อาจซ้ำข้ามชนิด
- 1801 ไม่ได้ปรับยอดสะสมใน `as_asset_detail`; ยอดค่าเสื่อมสะสมที่แท้จริง = `as_sum_value_balance` + Σ `sum_amount` (1801) (`fa_sale.go:289-290`) ถ้าลบเอกสาร 1801 ยอดสะสมจะเปลี่ยนทันที
- ใน 1802 คอลัมน์ `price_default` / `average_cost` / `price` เป็นตัวเลขที่ GL ใช้ลงบัญชี รายงานขายสินทรัพย์ไม่คำนวณใหม่ แต่อ่านค่าที่เก็บไว้ตรง ๆ (`report_menu_gl_fa.go:1543-1544`) ห้ามแก้เองโดยไม่ลงบัญชีใหม่
- `glSQLDetailAS` เติม `''`/`'0'` ในช่องที่ตารางนี้ไม่มี เพื่อให้จำนวนคอลัมน์เท่ากับ SQL รายการฝั่งสินค้า/CB ที่ `UNION ALL` ด้วยกัน (`gl_template.go:864-871`, `:892`)
- ยอดเป็น NUMERIC ส่งเป็น string ([[acc-rounding-decimal]])

## ที่มาในโค้ด
- `backend/internal/application/process/fa_depreciation.go:567` โครงผลลัพธ์ค่าเสื่อมต่อสินทรัพย์
- `backend/internal/application/process/fa_depreciation.go:654` `loadDepSources` (วันที่ขายที่ `:660`)
- `backend/internal/application/process/fa_depreciation.go:823` ลบก่อน insert ใหม่ (1801)
- `backend/internal/application/process/fa_depreciation.go:868` ตรวจสินทรัพย์ที่ขายแล้ว
- `backend/internal/application/process/fa_depreciation.go:880` ลบ 1801
- `backend/internal/application/process/fa_depreciation.go:940` ตรวจช่วงวันที่ทับซ้อน
- `backend/internal/application/process/fa_depreciation.go:980` ตัดชื่อสินทรัพย์ที่ 255 ตัวอักษร
- `backend/internal/application/process/fa_depreciation.go:982` INSERT 1801
- `backend/internal/application/process/fa_sale.go:286` `loadSaleAssets`
- `backend/internal/application/process/fa_sale.go:312` ปฏิเสธการขายซ้ำ
- `backend/internal/application/process/fa_sale.go:488` ลบ 1802
- `backend/internal/application/process/fa_sale.go:535` INSERT 1802
- `backend/internal/application/process/gl_template.go:802` SQL หัวเอกสาร AS (ผลรวมจากลูก)
- `backend/internal/application/process/gl_template.go:864` `glSQLDetailAS`
- `backend/internal/application/process/master_detail_specs.go:223` ตัวกันลบสินทรัพย์
- `backend/internal/application/process/report_menu_gl_fa.go:1267` join วันที่ขาย
- `backend/internal/application/process/report_menu_gl_fa.go:1542` รายงานขายสินทรัพย์
- `scripts/sql/02_data_schema.sql:1976` DDL ของตาราง

## ดูเพิ่ม
- [[tbl-group-as]]
- [[tbl-as-trans]]
- [[acc-fixed-asset-depreciation]]
- [[acc-gl-template-engine]]
