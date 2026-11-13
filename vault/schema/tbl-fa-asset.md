---
title: ตารางทะเบียนสินทรัพย์ถาวรและซ่อมบำรุง (as_asset, as_asset_detail, as_asset_type, as_asset_location, as_asset_maintenance)
tags:
  - schema
  - fa
  - fixed-asset
  - maintenance
aliases:
  - as_asset
  - as_asset_detail
  - as_asset_type
  - as_asset_location
  - as_asset_retire
  - as_asset_maintain
  - as_asset_maintain_unit
  - as_asset_maintenance
  - as_asset_maintenance_detail
  - as_asset_result
  - as_resource
sources:
  - scripts/sql/02_data_schema.sql:1683
  - scripts/sql/02_data_schema.sql:1713
  - scripts/sql/02_data_schema.sql:1766
  - scripts/sql/02_data_schema.sql:1781
  - scripts/sql/02_data_schema.sql:1796
  - scripts/sql/02_data_schema.sql:1811
  - scripts/sql/02_data_schema.sql:1827
  - scripts/sql/02_data_schema.sql:1846
  - scripts/sql/02_data_schema.sql:1860
  - scripts/sql/02_data_schema.sql:1922
  - scripts/sql/02_data_schema.sql:1937
  - backend/internal/platform/db/pool.go:64
  - backend/internal/application/process/service.go:873
  - backend/internal/application/process/fa_depreciation.go:4
---

# ตารางทะเบียนสินทรัพย์ถาวรและซ่อมบำรุง (`as_asset_*`)

กลุ่มตารางมาสเตอร์ทะเบียนทรัพย์สินถาวร (Fixed Assets), ข้อมูลราคาทุน/อายุการใช้งาน/ค่าเสื่อมตั้งต้น, ประเภทและสถานที่ตั้งสินทรัพย์, และการซ่อมบำรุงสินทรัพย์ หมายเหตุสำคัญ: ตารางสินทรัพย์ถาวรดั้งเดิมทั้งหมดขึ้นต้นด้วย **`as_`** (ส่วนตารางเช่าซื้อสมัยใหม่ขึ้นต้นด้วย `fa_hire_purchase_*` ดู [[tbl-fa-hire-purchase]])

---

## 1. `as_asset` — ทะเบียนหลักสินทรัพย์ถาวร

- **วัตถุประสงค์**: เก็บข้อมูลระบุตัวตนสินทรัพย์ รหัสผังบัญชี 3 บัญชีหลัก (บัญชีสินทรัพย์, ค่าเสื่อมราคา, ค่าเสื่อมสะสม), ฝ่าย/แผนก, สาขา และสถานที่ตั้ง
- **Indexes**:
  - `idx_as_asset_code` ON `as_asset` (`code`)
  - `idx_as_asset_account_code` ON `as_asset` (`account_code`)

### คอลัมน์สำคัญ

| คอลัมน์ | ชนิดข้อมูล (SQL) | ค่าเริ่มต้น | ความหมาย |
| :--- | :--- | :--- | :--- |
| `code`, `code_old` | `varchar(25)` | `''` | รหัสสินทรัพย์ และรหัสเดิม |
| `name_1`, `name_2` | `varchar(100)` / `varchar(200)` | `''` | ชื่อสินทรัพย์ (ไทย / อังกฤษ) |
| `name_eng_1`, `name_eng_2` | `varchar(100)` | `''` | ชื่อภาษาอังกฤษเพิ่มเติม |
| `unit_code` | `varchar(25)` | `''` | รหัสหน่วยนับ (เชื่อม `ic_unit` ใน [[schema-overview]]) |
| `as_type` | `varchar(25)` | `''` | รหัสประเภทสินทรัพย์ (เชื่อม `as_asset_type.code`) |
| `as_location` | `varchar(25)` | `''` | รหัสสถานที่ตั้ง (เชื่อม `as_asset_location.code`) |
| `side_code`, `department_code`, `branch_code` | `varchar(25)` | `''` | ฝ่าย, แผนก และสาขาที่ครอบครองสินทรัพย์ |
| `account_code` | `varchar(25)` | `''` | รหัสผังบัญชีสินทรัพย์ (Asset Account) |
| `depreciation_account_code` | `varchar(25)` | `''` | รหัสผังบัญชีค่าเสื่อมราคา (ฝั่ง Dr ตอนโอนค่าเสื่อม) |
| `depreciation_sum_account_code` | `varchar(25)` | `''` | รหัสผังบัญชีค่าเสื่อมราคาสะสม (ฝั่ง Cr ตอนโอนค่าเสื่อม) |
| `status` | `smallint` | `0` | สถานะ (`0` = ปกติ/ใช้งาน) |

---

## 2. `as_asset_detail` — ข้อมูลการซื้อ ขาย ค่าเสื่อม และประกันภัยสินทรัพย์

- **วัตถุประสงค์**: เก็บข้อมูลต้นทุนซื้อ, วันที่เริ่ม-หยุดคำนวณค่าเสื่อม, อายุการใช้งาน/อัตราค่าเสื่อม, มูลค่าซาก, ค่าเสื่อมยกมา, ข้อมูลการขาย/ตัดจำหน่าย และข้อมูลประกันภัย (1:1 กับ `as_asset` ผ่าน `as_code`)
- **Primary Key**: ไม่มี PK ใน DDL (`roworder serial NOT NULL`); เชื่อมกับ `as_asset.code` ด้วย `as_code`

### คอลัมน์สำคัญ

| คอลัมน์ | ชนิดข้อมูล (SQL) | ค่าเริ่มต้น | ความหมายและข้อสังเกตจากระบบคำนวณ |
| :--- | :--- | :--- | :--- |
| `as_code` | `varchar(25)` | `''` | รหัสสินทรัพย์ (เชื่อม `as_asset.code`) |
| `as_buy_date`, `doc_buy_date`, `doc_buy_ref`, `as_buy_year` | `date` / `varchar(25)` / `smallint` | `NULL` / `''` | วันที่ซื้อ, วันที่เอกสารซื้อ, เลขที่เอกสารซื้อ, ปีที่ซื้อ |
| `as_buy_price` | `numeric` | `0.0` | ราคาทุนซื้อสินทรัพย์ |
| `as_buy_from`, `as_buy_description` | `varchar(255)` | `''` | ชื่อผู้ขายและรายละเอียดการซื้อ |
| `calc_type` | `smallint` | `0` | ประเภทวิธีคิดค่าเสื่อม *(หมายเหตุ `fa_depreciation.go:4`: เอนจิน C#/Go อ่านค่าไว้แต่คำนวณด้วยวิธีเส้นตรง Straight-line เท่านั้น)* |
| `as_age`, `as_rate` | `numeric` | `0.0` | อายุการใช้งาน (ปี) และอัตราค่าเสื่อมราคาต่อปี (%) |
| `start_calc_date`, `stop_calc_date` | `date` | `NULL` | วันที่เริ่มคิดค่าเสื่อมราคา และวันที่หยุดคิดค่าเสื่อม |
| `as_start_cut`, `as_calc_value`, `as_dead_value`, `as_dead_calc` | `numeric`, `smallint` | `0.0`, `0` | ค่าเสื่อมสะสมยกมา (`as_start_cut`), มูลค่าฐานคิดค่าเสื่อม, มูลค่าซาก (`as_dead_value`), ธงหักซาก |
| `as_value_balance`, `as_sum_value_balance`, `depreciate_balance` | `numeric` | `0.0` | มูลค่าสุทธิตามบัญชีคงเหลือ และค่าเสื่อมสะสมคงเหลือ |
| `as_sale_date`, `doc_sale_date`, `doc_sale_ref`, `as_sale_price`, `as_sale_to` | `date` / `varchar` / `numeric` | - | วันที่ขาย, เลขที่เอกสารขายสินทรัพย์ (`1802`), ราคาขายก่อน VAT, รหัสผู้ซื้อ (อัปเดตโดย `fa_sale.go:571`) |
| `insure_no`, `safety_code`, `insure_company`, `insure_money`, `insure_age`, `insure_start_date`, `insure_stop_date` | - | - | เลขกรมธรรม์, รหัสความปลอดภัย, บริษัทประกัน, ทุนประกัน และช่วงคุ้มครอง |
| `asset_status`, `asset_province`, `as_model`, `as_description`, `as_price_group`, `as_budget`, `derived_from` | `varchar` | `''` | สถานะสินทรัพย์, จังหวัด, รุ่น, คำอธิบาย, กลุ่มราคา, แหล่งงบประมาณ |

---

## 3. ตารางมาสเตอร์ประกอบและตารางซ่อมบำรุงสินทรัพย์

| ตาราง | Indexes / Cols เพิ่มเติม | วัตถุประสงค์และคอลัมน์สำคัญ |
| :--- | :--- | :--- |
| `as_asset_type` | `idx_as_asset_type_code` | `code`, `name_1`, `name_2`, `status` — ประเภทสินทรัพย์ (เชื่อม `as_asset.as_type`) |
| `as_asset_location` | `idx_as_asset_location_code` | `code` (`varchar(10)`), `name_1`, `name_2`, `status` — สถานที่ตั้งสินทรัพย์ |
| `as_asset_retire` | `idx_as_asset_retire_code` | `code`, `name_1`, `name_2`, `status` — เหตุผล/รหัสเลิกใช้สินทรัพย์ |
| `as_asset_maintain` | `idx_as_asset_maintain_code` | `code`, `name_1`, `name_2`, `status` — มาสเตอร์รายการซ่อมบำรุง |
| `as_asset_maintain_unit` | `idx_as_asset_maintain_unit_code` | `code`, `name_1`, `name_2`, `status` — มาสเตอร์หน่วยซ่อมบำรุง |
| `as_asset_maintenance` | + `doc_time`, `doc_format_code` (`pool.go:64`, `service.go:873`) | หัวเอกสารบันทึกค่าซ่อมบำรุง (`doc_date`, `doc_no`, `branch_code`, `side_code`, `department_code`, `total_maintain_value`, `status`) |
| `as_asset_maintenance_detail` | - | รายละเอียดซ่อมบำรุงรายสินทรัพย์ (`doc_no`, `as_code`, `maintain_code`, `maintain_name`, `maintain_unit`, `maintain_date`, `maintain_location`, `maintain_price`, `line_number`) |
| `as_asset_result` | - | แผน/ผลการซ่อมบำรุงประจำสินทรัพย์ (`as_code`, `maintain_code`, `maintain_name`, `maintain_unit`, `description`, `line_number`) |
| `as_resource` | - | ตาราง placeholder ทรัพยากรโมดูลสินทรัพย์ถาวร |

---

## 4. รูปแบบการ JOIN และตัวอย่าง SQL Query

1. **ทะเบียนสินทรัพย์ครบชุด**: `as_asset a LEFT JOIN as_asset_detail d ON d.as_code = a.code LEFT JOIN as_asset_type t ON t.code = a.as_type LEFT JOIN as_asset_location l ON l.code = a.as_location`
2. **เชื่อมผังบัญชี**: `a.account_code`, `a.depreciation_account_code`, `a.depreciation_sum_account_code` → [[tbl-gl-chart-of-account]] `code`
3. **เชื่อมประวัติซ่อมบำรุง**: `as_asset_maintenance h JOIN as_asset_maintenance_detail md ON md.doc_no = h.doc_no LEFT JOIN as_asset a ON a.code = md.as_code`

### ตัวอย่าง 1: ทะเบียนสินทรัพย์ที่ยังใช้งานอยู่ (ยังไม่ขาย) พร้อมผังบัญชีและข้อมูลค่าเสื่อม
```sql
SELECT
    a.code,
    a.name_1,
    t.name_1 AS asset_type_name,
    l.name_1 AS location_name,
    d.as_buy_date,
    d.start_calc_date,
    d.as_buy_price::NUMERIC(18,2) AS cost_price,
    d.as_start_cut::NUMERIC(18,2) AS accum_dep_brought_forward,
    d.as_age::NUMERIC(9,2) AS useful_life_years,
    d.as_rate::NUMERIC(9,2) AS dep_rate_pct,
    d.as_dead_value::NUMERIC(18,2) AS salvage_value,
    a.account_code,
    a.depreciation_account_code,
    a.depreciation_sum_account_code
FROM as_asset a
LEFT JOIN as_asset_detail d ON d.as_code = a.code
LEFT JOIN as_asset_type t ON t.code = a.as_type
LEFT JOIN as_asset_location l ON l.code = a.as_location
WHERE COALESCE(a.status, 0) = 0
  AND d.as_sale_date IS NULL
ORDER BY a.code;
```

### ตัวอย่าง 2: สรุปค่าใช้จ่ายซ่อมบำรุงแยกตามสินทรัพย์
```sql
SELECT
    md.as_code,
    a.name_1 AS asset_name,
    COUNT(*)::INT AS maintain_count,
    COALESCE(SUM(md.maintain_price), 0)::NUMERIC(18,2) AS total_maintain_cost,
    MAX(md.maintain_date) AS latest_maintain_date
FROM as_asset_maintenance_detail md
JOIN as_asset_maintenance h
  ON h.doc_no = md.doc_no
LEFT JOIN as_asset a
  ON a.code = md.as_code
WHERE COALESCE(h.status, 0) = 0
  AND COALESCE(md.status, 0) = 0
GROUP BY md.as_code, a.name_1
ORDER BY total_maintain_cost DESC;
```
