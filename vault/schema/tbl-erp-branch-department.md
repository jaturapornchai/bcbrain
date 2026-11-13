---
title: โครงสร้างองค์กร สาขา ฝ่าย แผนก งาน โครงการ และงบประมาณ — erp_branch_list / erp_department_list / erp_department_budget
tags: [dev, schema, erp, branch, department, project, budget]
aliases: [erp_branch_list, erp_side_list, erp_department_list, erp_job_type, erp_job_list, erp_project_list, erp_allocate_list, erp_department_budget, สาขา, แผนก]
sources:
  - scripts/sql/02_data_schema.sql:2485-2499
  - scripts/sql/02_data_schema.sql:2565-2596
  - scripts/sql/02_data_schema.sql:2790-2805
  - scripts/sql/02_data_schema.sql:2963-2992
  - scripts/sql/02_data_schema.sql:3600-3614
  - scripts/sql/02_data_schema.sql:3712-3726
  - backend/internal/application/process/service.go:952-957
  - backend/internal/application/process/budget_approval_matrix.go:43-56
---

# โครงสร้างองค์กร มิติบัญชี และงบประมาณแผนก (`erp_branch_list` และตารางมิติ)

กลุ่มตารางมาสเตอร์สำหรับแบ่งมิติทางธุรกิจและบัญชี: **สาขา -> ฝ่าย (`side`) -> แผนก (`department`) -> ประเภทงาน/งาน (`job`) -> โครงการ (`project`) -> หน่วยปันส่วน (`allocate`)** รวมถึงวงเงินงบประมาณประจำปีของแผนก ดูภาพรวมโครงสร้างทั้งหมดได้ที่ [[schema-overview]]

---

## 1. ตารางหลักกลุ่มโครงสร้างองค์กร

### `erp_branch_list` — รายชื่อสาขา
- **Indexes**: `idx_erp_branch_list_code` ON `("code")` (ไม่มี SQL PK; ใช้ `roworder serial`)
- **Runtime ALTER (`service.go:953`)**: เพิ่ม `latitude NUMERIC(12,7) DEFAULT 0`, `longitude NUMERIC(12,7) DEFAULT 0`

| คอลัมน์ | ชนิดข้อมูล | ความหมาย / ค่า Flag |
|---|---|---|
| `code` | `varchar(25)` | รหัสสาขา (ใช้จับคู่กับ `branch_code` ใน `ic_trans`, `ap_ar_trans`, `gl_journal`) |
| `number` | `integer` | ลำดับเลขสาขาทางภาษี (เช่น `0`, `1`, `2`) |
| `name_1`, `name_2` | `varchar(100)` / `varchar(200)` | ชื่อสาขา (ไทย / อังกฤษ) |
| `address_1`, `address_2`, `telephone`, `fax`, `remark` | `varchar` | ที่อยู่ เบอร์ติดต่อ และหมายเหตุสาขา |
| `branch_type` | `smallint DEFAULT 0` | `0 = สำนักงานใหญ่`, `1 = สาขา` |
| `serial_list` | `varchar(255)` | รหัสเครื่อง / Serial ของสาขา |
| `phone_number_approve`, `sale_hub_approve`, `arm_code`, `arm_send_*` | `varchar` / `smallint` | ค่าแจ้งเตือนอนุมัติวงเงิน/ลดหนี้/ยกเลิกเอกสารระดับสาขา (ARM/SaleHub) |
| `status` | `smallint DEFAULT 0` | `0 = ใช้งาน`, `1 = ปิดใช้งาน` |

### `erp_side_list` และ `erp_department_list` — ฝ่ายและแผนก
- **ความสัมพันธ์**: แผนก (`erp_department_list`) ผูกกับฝ่ายผ่านคอลัมน์ **`ref_side_code`** -> `erp_side_list.code`
- **Indexes**: `idx_erp_side_list_code`, `idx_erp_department_list_code`

| ตาราง | คอลัมน์หลัก | ความหมาย |
|---|---|---|
| `erp_side_list` | `code` (`varchar(25)`), `name_1`, `name_2`, `status` (`smallint DEFAULT 0`), `guid_code` | ทะเบียน **ฝ่าย (Side / Division)** อ้างอิงจาก `side_code` ในเอกสาร |
| `erp_department_list` | `code` (`varchar(25)`), `name_1`, `name_2`, `ref_side_code` (`varchar(25)`), `status` (`smallint DEFAULT 0`) | ทะเบียน **แผนก (Department)** ผูกฝ่ายผ่าน `ref_side_code` |

---

## 2. ตารางมิติงาน โครงการ และปันส่วน (`erp_job_*`, `erp_project_list`, `erp_allocate_list`)

| ตาราง | Index / Key | คอลัมน์เฉพาะและบทบาท |
|---|---|---|
| `erp_job_type` | `idx_erp_job_type_code` | `code`, `name_1`, `name_2`, `status` — **ประเภทงาน** |
| `erp_job_list` | `idx_erp_job_list_code` | `code`, `name_1`, `name_2`, `status` — **ทะเบียนงาน (Job/Cost Center)** เชื่อมกับ `job_code` ใน `ic_trans` / `gl_journal_detail` |
| `erp_project_list` | `idx_erp_project_list_code` | `code`, `name_1`, `name_2`, `status` — **ทะเบียนโครงการ (Project)** เชื่อมกับ `project_code` |
| `erp_allocate_list` | `idx_erp_allocate_list_code` | `code`, `name_1`, `name_2`, `status` — **ทะเบียนกลุ่มปันส่วน (Allocate)** เชื่อมกับ `allocate_code` |

---

## 3. `erp_department_budget` — งบประมาณประจำปีระดับแผนก

| รายการ | รายละเอียด |
|---|---|
| **บทบาท** | กำหนดเพดานงบประมาณรายปีต่อแผนก สำหรับโมดูล Budget & Approval Matrix ควบคุมคำขอซื้อ/ค่าใช้จ่าย (`PO` / `EXPENSE`) |
| **Primary Key** | `budget_key TEXT PRIMARY KEY` (รูปแบบ เช่น `<dept_code>:<budget_year>`) |

| คอลัมน์ | ชนิดข้อมูล | ความหมาย |
|---|---|---|
| `budget_key` | `text PRIMARY KEY` | คีย์รวมแผนกและปีงบประมาณ |
| `dept_code`, `dept_name` | `text NOT NULL` | รหัสแผนก (อ้างอิง `erp_department_list.code`) และชื่อแผนก |
| `budget_year` | `integer NOT NULL` | ปีงบประมาณ (ค.ศ.) |
| `annual_budget` | `numeric(18,2) NOT NULL DEFAULT 0` | วงเงินงบประมาณทั้งปี |
| `hard_block` | `boolean NOT NULL DEFAULT true` | `true = ห้ามอนุมัติ/บันทึกเมื่อเกินงบ` ถ้าไม่มีอนุมัติพิเศษ |
| `created_by` | `text` | ผู้สร้างรายการ |

---

## ตัวอย่าง SQL และ JOIN ที่ใช้บ่อย

```sql
-- 1) แสดงโครงสร้าง ฝ่าย -> แผนก -> งบประมาณปีล่าสุด
SELECT s.code AS side_code,
       s.name_1 AS side_name,
       d.code AS dept_code,
       d.name_1 AS dept_name,
       b.budget_year,
       COALESCE(b.annual_budget, 0) AS annual_budget,
       b.hard_block
FROM erp_department_list d
LEFT JOIN erp_side_list s ON s.code = d.ref_side_code
LEFT JOIN erp_department_budget b ON b.dept_code = d.code
WHERE COALESCE(d.status, 0) = 0
ORDER BY s.code, d.code, b.budget_year DESC;

-- 2) สรุปยอดขายสุทธิแยกตามสาขา (ใช้ COALESCE(last_status, 0) = 0)
SELECT b.code AS branch_code,
       b.name_1 AS branch_name,
       COUNT(t.doc_no) AS doc_count,
       COALESCE(SUM(t.total_amount), 0) AS total_sales
FROM erp_branch_list b
LEFT JOIN ic_trans t
  ON t.branch_code = b.code
 AND t.trans_flag = 44
 AND COALESCE(t.last_status, 0) = 0
WHERE COALESCE(b.status, 0) = 0
GROUP BY b.code, b.name_1
ORDER BY b.code;
```
