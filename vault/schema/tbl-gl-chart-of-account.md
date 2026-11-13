---
title: ตารางผังบัญชีและมิติวิเคราะห์ทางบัญชี (gl_chart_of_account, gl_account_type, gl_account_group, gl_cash_flow_group)
tags:
  - schema
  - gl
  - coa
  - dimensions
aliases:
  - gl_chart_of_account
  - gl_chart_of_account_allocate_list
  - gl_chart_of_account_depart_list
  - gl_chart_of_account_job_list
  - gl_chart_of_account_project_list
  - gl_chart_of_account_side_list
  - gl_account_type
  - gl_account_group
  - gl_account_cost
  - gl_cash_flow_group
  - gl_sap_account_code
sources:
  - scripts/sql/02_data_schema.sql:4105
  - scripts/sql/02_data_schema.sql:4120
  - scripts/sql/02_data_schema.sql:4135
  - scripts/sql/02_data_schema.sql:4150
  - scripts/sql/02_data_schema.sql:4165
  - scripts/sql/02_data_schema.sql:4198
  - scripts/sql/02_data_schema.sql:4632
  - backend/internal/platform/db/pool.go:60
  - backend/internal/platform/db/pool.go:75
  - backend/internal/application/process/coa_presets.go:14
  - backend/internal/application/process/report_menu_gl_fa.go:49
  - backend/internal/application/process/workflow.go:600
---

# ตารางผังบัญชีและมิติวิเคราะห์ทางบัญชี (`gl_chart_of_account`)

กลุ่มตารางมาสเตอร์สำหรับกำหนดผังบัญชี (Chart of Accounts — COA), ลำดับชั้นบัญชีคุม/บัญชีย่อย, การจัดหมวดหมู่งบการเงินและงบกระแสเงินสด, การผูกบัญชีคุมมิติ 5 แกน (ฝ่าย/แผนก/ปันส่วน/โครงการ/งาน) และการจับคู่รหัสบัญชี SAP

---

## 1. `gl_chart_of_account` — ผังบัญชีหลัก

- **วัตถุประสงค์**: เก็บรหัสบัญชีแยกประเภททั้งหมดของกิจการ พร้อมระดับชั้นผังบัญชี (`main_code`, `account_level`), หมวดบัญชี (`account_type`), สถานะการอนุญาตให้ลงรายการ (`status`) และกฎการบังคับกรอกมิติ
- **Primary Key / Index**: ไม่มี `PRIMARY KEY` ที่ระดับ DDL (`roworder serial NOT NULL`); มี Index `idx_gl_chart_of_account_code` ON `gl_chart_of_account` (`code`) และใช้ `code` เป็นคีย์อ้างอิงหลักจาก `gl_journal_detail.account_code`

### คอลัมน์สำคัญและค่า Flag

| คอลัมน์ | ชนิดข้อมูล (SQL) | ค่าเริ่มต้น | ความหมายและค่า Flag (จาก `coa_presets.go`) |
| :--- | :--- | :--- | :--- |
| `code` | `varchar(25)` | `''` | รหัสบัญชี (เช่น `1110-00`, `4100-01`) |
| `name_1`, `name_2` | `varchar(100)` / `varchar(200)` | `''` | ชื่อบัญชีภาษาไทย (`name_1`) และภาษาอังกฤษ (`name_2`) *(หมายเหตุ: `ALTER TABLE` เพิ่ม `name_2 varchar(200)` ท้าย DDL)* |
| `main_code` | `varchar(25)` | `''` | รหัสบัญชีแม่ (Parent Account Code สำหรับสร้างผังบัญชีแบบต้นไม้ในรายงาน) |
| `account_level` | `smallint` | `0` | ระดับความลึกในโครงสร้างผังบัญชี |
| `status` | `smallint` | `0` | ประเภทระดับการลงบัญชี **(สำคัญมาก)**:<br>• `0` = บัญชีย่อย (Posting Account — ลงรายการใน `gl_journal_detail` ได้)<br>• `1` = บัญชีคุม / บัญชีหลัก (Control Account — **ห้ามลงรายการโดยตรง** `workflow.go:600` จะ Reject) |
| `account_type` | `smallint` | `0` | หมวดบัญชี 5 หมวด:<br>• `0` = สินทรัพย์ (Asset)<br>• `1` = หนี้สิน (Liability)<br>• `2` = ทุน / ส่วนของเจ้าของ (Equity)<br>• `3` = รายได้ (Revenue)<br>• `4` = ค่าใช้จ่าย (Expense) |
| `balance_mode` | `smallint` | `0` | ดุลบัญชีปกติ:<br>• `0` = ดุลเดบิต (Debit Normal — สินทรัพย์, ค่าใช้จ่าย)<br>• `1` = ดุลเครดิต (Credit Normal — หนี้สิน, ทุน, รายได้) |
| `balance_sheet_status` | `smallint` | `0` | การจัดกลุ่มงบการเงิน:<br>• `0` = ทั่วไป<br>• `1` = ต้นทุนขาย<br>• `2` = การผลิต<br>• `3` = ค่าใช้จ่าย<br>• `4` = กำไรสะสม |
| `tax_type` | `smallint` | `0` | ประเภทบัญชีภาษี (ยืนยันผ่าน `pool.go:60`):<br>• `0` = ไม่เกี่ยวข้อง<br>• `1` = ภาษีขาย<br>• `2` = ภาษีซื้อ<br>• `3` = หัก ณ ที่จ่าย<br>• `4` = ถูกหัก ณ ที่จ่าย |
| `account_close` | `varchar(25)` | `''` | รหัสบัญชีปลายทางเมื่อปิดงวดบัญชี (เช่น บัญชีกำไรสะสม) *(เพิ่มใน `pool.go:61`)* |
| `account_group` | `varchar(25)` | `''` | รหัสกลุ่มบัญชี (เชื่อม `gl_account_group.code`) |
| `cash_flow_group` | `varchar(25)` | `''` | รหัสกลุ่มงบกระแสเงินสด (เชื่อม `gl_cash_flow_group.code`) *(ยืนยันใน `pool.go:62`)* |
| `side_status` | `smallint` | `0` | เปิด/บังคับใช้มิติ **ฝ่าย** (`side_code`) กับบัญชีนี้ (`1` = ใช้) |
| `department_status` | `smallint` | `0` | เปิด/บังคับใช้มิติ **แผนก** (`department_code`) (`1` = ใช้) |
| `allocate_status` | `smallint` | `0` | เปิด/บังคับใช้มิติ **การจัดสรร/ปันส่วน** (`allocate_code`) (`1` = ใช้) |
| `project_status` | `smallint` | `0` | เปิด/บังคับใช้มิติ **โครงการ** (`project_code`) (`1` = ใช้) |
| `job_status` | `smallint` | `0` | เปิด/บังคับใช้มิติ **งาน/Job** (`job_code`) (`1` = ใช้) |
| `active_status` | `smallint` | `0` | สถานะการใช้งาน (`1` = เปิดใช้งาน) |
| `work_in_process_status` | `smallint` | `0` | บัญชีงานระหว่างทำ |
| `interco`, `remark` | `varchar(255)` | `''` | รหัสบริษัทในเครือ และหมายเหตุ |

---

## 2. ตารางผูกสิทธิ์มิติวิเคราะห์ของผังบัญชี (5 ตาราง)

ทุกตารางเชื่อมด้วย `account_code` → `gl_chart_of_account.code` และมี Index บน `account_code` (`idx_gl_chart_of_account_*_list_account_code`)

| ตาราง | คอลัมน์เชื่อม | หมายเหตุ Schema (`pool.go:75-76`) |
| :--- | :--- | :--- |
| `gl_chart_of_account_side_list` | `account_code`, `side_code` (`varchar(25)`) | ผูกฝ่ายที่ใช้ได้กับรหัสบัญชี |
| `gl_chart_of_account_depart_list` | `account_code`, `department_code` (`varchar(25)`) | ผูกแผนกที่ใช้ได้กับรหัสบัญชี |
| `gl_chart_of_account_allocate_list` | `account_code`, `allocate_code` (`varchar(25)`) | `02_data_schema.sql` เดิม `varchar(10)`, `pool.go:76` ขยายเป็น `VARCHAR(25)` อัตโนมัติ |
| `gl_chart_of_account_project_list` | `account_code`, `project_code` (`varchar(25)`) | `02_data_schema.sql` เดิม `varchar(10)`, `pool.go:75` ขยายเป็น `VARCHAR(25)` อัตโนมัติ |
| `gl_chart_of_account_job_list` | `account_code`, `job_code` (`varchar(25)`) | ผูก Job ที่ใช้ได้กับรหัสบัญชี |

---

## 3. ตารางหมวดหมู่และตารางจับคู่บัญชีเสริม

| ตาราง | Index | คอลัมน์หลักและวัตถุประสงค์ |
| :--- | :--- | :--- |
| `gl_account_type` | `idx_gl_account_type_code` | `code`, `name_1`, `name_2`, `status` — มาสเตอร์ประเภทบัญชี |
| `gl_account_group` | `idx_gl_account_group_code` | `code`, `name_1`, `name_2`, `status` — กลุ่มบัญชี (เชื่อม `gl_chart_of_account.account_group`) |
| `gl_account_cost` | `idx_gl_account_cost_code` | `code`, `name_1` (`varchar(255)`), `name_2`, `status` — มาสเตอร์หมวดต้นทุนบัญชี |
| `gl_cash_flow_group` | `idx_gl_cash_flow_group_code` | `code`, `name_1`, `name_2`, `status` — กลุ่มกิจกรรมงบกระแสเงินสด (เชื่อม `cash_flow_group`) |
| `gl_sap_account_code` | `idx_gl_sap_account_code_code` | `code` (`varchar(255)`), `sap_code` (`varchar(255)`), `guid_code` — ตาราง Map รหัสบัญชีภายในกับ SAP |

---

## 4. รูปแบบการ JOIN และตัวอย่าง SQL Query

1. **หาความสัมพันธ์บัญชีแม่-ลูก**: Self-join `gl_chart_of_account child LEFT JOIN gl_chart_of_account parent ON parent.code = child.main_code`
2. **ตรวจสิทธิ์ลงสมุดรายวัน**: ควรกรอง `COALESCE(status, 0) = 0` เสมอเมื่อดึงเฉพาะบัญชีย่อยที่ลง `gl_journal_detail` ได้
3. **เชื่อมงบ DBD e-Filing**: จับคู่ `gl_chart_of_account.code` กับ [[tbl-gl-advanced]] (`gl_dbd_taxonomy_map.account_code`)

### ตัวอย่าง 1: แสดงเฉพาะบัญชีย่อยที่ลงรายการได้ พร้อมชื่อกลุ่มบัญชีและบัญชีแม่
```sql
SELECT
    c.code,
    c.name_1,
    c.account_type,
    c.balance_mode,
    c.tax_type,
    c.main_code,
    p.name_1 AS parent_name,
    g.name_1 AS account_group_name
FROM gl_chart_of_account c
LEFT JOIN gl_chart_of_account p
  ON p.code = c.main_code
LEFT JOIN gl_account_group g
  ON g.code = c.account_group
WHERE COALESCE(c.status, 0) = 0
  AND COALESCE(c.active_status, 1) = 1
ORDER BY c.code;
```

### ตัวอย่าง 2: ตรวจสอบรายการใน `gl_journal_detail` ที่ลงผิดไปใช้บัญชีคุม (`status = 1`)
```sql
SELECT
    d.doc_date,
    d.doc_no,
    d.book_code,
    d.account_code,
    c.name_1 AS control_account_name,
    d.debit::NUMERIC(18,2) AS debit,
    d.credit::NUMERIC(18,2) AS credit
FROM gl_journal_detail d
JOIN gl_chart_of_account c
  ON c.code = d.account_code
WHERE c.status = 1
ORDER BY d.doc_date DESC, d.doc_no;
```
