---
title: มาสเตอร์ภูมิศาสตร์ คำนำหน้า ค่าใช้จ่าย/รายได้อื่นๆ และรหัสเหตุผล — erp_province / erp_tambon / erp_expenses_list
tags: [dev, schema, erp, master, address, expenses, income]
aliases: [erp_province, erp_amper, erp_tambon, erp_initial, erp_expenses_list, erp_income_list, erp_cn_reason, erp_package_reason, erp_insure_type, จังหวัด, ค่าใช้จ่าย]
sources:
  - scripts/sql/02_data_schema.sql:2540-2556
  - scripts/sql/02_data_schema.sql:2651-2664
  - scripts/sql/02_data_schema.sql:2958-3014
  - scripts/sql/02_data_schema.sql:3570-3583
  - scripts/sql/02_data_schema.sql:3668-3683
  - scripts/sql/02_data_schema.sql:3780-3799
  - scripts/sql/02b_sync_existing_db.sql:3597-3615
  - scripts/sql/22_erp_tambon_zip_code.sql:1-5
  - backend/internal/application/process/db_migrate.go:1393-1409
  - backend/internal/application/process/service.go:897-912
  - backend/internal/application/process/service.go:949-951
---

# มาสเตอร์ภูมิศาสตร์ คำนำหน้า ค่าใช้จ่าย/รายได้อื่นๆ และเหตุผล (`erp_province` – `erp_expenses_list`)

กลุ่มตารางข้อมูลอ้างอิงพื้นฐานระดับระบบ (Master Lookup Tables) ทั้งด้านที่อยู่ประเทศไทย คำนำหน้านาม หมวดรายได้-ค่าใช้จ่ายเบ็ดเตล็ด และเหตุผลลดหนี้/คืนบรรจุภัณฑ์ ดูภาพรวมโครงสร้างทั้งหมดได้ที่ [[schema-overview]]

---

## 1. ตารางภูมิศาสตร์ไทย 3 ระดับ (`erp_province` -> `erp_amper` -> `erp_tambon`)

ความสัมพันธ์ลำดับชั้น: `erp_tambon.amper` -> `erp_amper.code` และ `erp_tambon.province` / `erp_amper.province` -> `erp_province.code`

| ตาราง | Index / PK | คอลัมน์สำคัญ |
|---|---|---|
| `erp_province` | `idx_erp_province_code` | `code` (`varchar(25)`), `name_1` / `name_2`, `lat` / `lng` (`numeric`: พิกัดกลางจังหวัด), `status` (`smallint`: `0 = ใช้งาน`) |
| `erp_amper` | `idx_erp_amper_code` | `code` (`varchar(25)`), `name_1` / `name_2`, `province` (เชื่อม `erp_province.code`), `lat` / `lng` (`numeric`), `status` |
| `erp_tambon` | `idx_erp_tambon_code` | `code` (`varchar(25)`), `name_1` / `name_2`, `amper` (เชื่อม `erp_amper.code`), `province` (เชื่อม `erp_province.code`), `lat` / `lng` (`numeric`), **`zip_code`** (`varchar(10)` — นิยามใน `02_data_schema.sql:3789,3798`, `02b_sync_existing_db.sql:3606,3615`, `db_migrate.go:1404,1409`, `22_erp_tambon_zip_code.sql:4` และ `service.go:949`), `status` |

---

## 2. คำนำหน้านาม/ชื่อกิจการ (`erp_initial`)

| รายการ | รายละเอียด |
|---|---|
| **บทบาท** | เก็บคำนำหน้าบุคคลธรรมดาและนิติบุคคล สร้างอัตโนมัติใน `service.go:897-912` พร้อมค่าเริ่มต้น 9 รายการ (`01` นาย ถึง `09` บมจ.) |
| **Primary Key / Unique Key** | `roworder SERIAL PRIMARY KEY`, `code VARCHAR(50) UNIQUE NOT NULL` |
| **คอลัมน์** | `code` (`varchar(50)`), `name_1` (`varchar(255)` ภาษาไทย), `name_2` (`varchar(255)` ภาษาอังกฤษ) |

---

## 3. ค่าใช้จ่ายอื่นๆ และรายได้อื่นๆ (`erp_expenses_list`, `erp_income_list`)

| ตาราง | Index | คอลัมน์สำคัญและบทบาท |
|---|---|---|
| `erp_expenses_list` | `idx_erp_expenses_list_code` | `code` (`varchar(25)`), `name_1` / `name_2`, **`gl_account_code`** (`varchar(25)`: ผังบัญชีค่าใช้จ่าย GL), `status` (`smallint`) — ใช้ในเอกสารค่าใช้จ่ายอื่นๆ (เช่น Flag `87`/`260` ใน `ic_trans` หรือตารางค่าใช้จ่าย) |
| `erp_income_list` | `idx_erp_income_list_code` | `code` (`varchar(25)`), `name_1` / `name_2`, **`gl_account_code`** (`varchar(25)`: ผังบัญชีรายได้ GL), `status` (`smallint`) — ใช้ในเอกสารรายได้อื่นๆ (เช่น Flag `250`–`254`) |

---

## 4. รหัสเหตุผลและประเภทประกัน (`erp_cn_reason`, `erp_package_reason`, `erp_insure_type`)

| ตาราง | Index | คอลัมน์สำคัญและบทบาท |
|---|---|---|
| `erp_cn_reason` | `idx_erp_cn_reason_code` | `code` (`varchar(25)`), `cn_type` (`smallint`: ประเภทเหตุผลลดหนี้), `name_1` (`varchar(255)`), `name_2` (`varchar(200)`), `status` |
| `erp_package_reason` | `idx_erp_package_reason_code` | `code` (`varchar(50)`), `name_1` / `name_2`, `status` — เหตุผลเกี่ยวกับบรรจุภัณฑ์/ภาชนะ |
| `erp_insure_type` | `idx_erp_insure_type_code` | `code` (`varchar(25)`), `name_1` / `name_2`, `remark`, `status` — ประเภทการรับประกันสินค้า/บริการ |

---

## ตัวอย่าง SQL ใช้งานจริง

```sql
-- 1) ดึงรายชื่อตำบล-อำเภอ-จังหวัด พร้อมรหัสไปรษณีย์
SELECT t.code AS tambon_code,
       t.name_1 AS tambon_name,
       a.name_1 AS amphur_name,
       p.name_1 AS province_name,
       COALESCE(t.zip_code, '') AS zip_code
FROM erp_tambon t
LEFT JOIN erp_amper a ON a.code = t.amper
LEFT JOIN erp_province p ON p.code = t.province
WHERE COALESCE(t.status, 0) = 0
ORDER BY p.name_1, a.name_1, t.name_1;

-- 2) ดูรหัสค่าใช้จ่ายอื่นๆ พร้อมผังบัญชี GL ที่ผูกไว้
SELECT code, name_1, gl_account_code
FROM erp_expenses_list
WHERE COALESCE(status, 0) = 0
ORDER BY code;
```
