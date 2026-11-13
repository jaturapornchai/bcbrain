---
title: บัตรเครดิต อนุมัติวงเงิน แผนการขาย และเงินเดือน — erp_credit* / erp_sale_plan* / erp_payroll_*
tags: [dev, schema, erp, credit, approval, sale-plan, payroll]
aliases: [erp_credit, erp_credit_type, erp_credit_approve_level, erp_credit_approved_logs, erp_credit_request, erp_sale_plan, erp_sale_plan_detail, erp_payroll_run, erp_payroll_line, วงเงินเครดิต, เงินเดือน]
sources:
  - scripts/sql/02_data_schema.sql:2668-2760
  - scripts/sql/02_data_schema.sql:3663-3694
  - backend/internal/application/process/trans_save_rules.go:576-595
  - backend/internal/application/process/payroll_sso_pnd1.go:115-172
---

# บัตรเครดิต อนุมัติวงเงินขายเชื่อ แผนการขาย และเงินเดือน (`erp_credit*`, `erp_sale_plan*`, `erp_payroll_*`)

กลุ่มตารางสำหรับตั้งค่าบัตรเครดิต/ค่าธรรมเนียมบัตร, ขั้นตอนอนุมัติวงเงินเกินเครดิตลูกหนี้, เป้าหมายการขาย และทะเบียนประมวลผลเงินเดือน-ประกันสังคม-ภ.ง.ด.1 ดูภาพรวมโครงสร้างทั้งหมดได้ที่ [[schema-overview]]

---

## 1. ประเภทบัตรเครดิตและเงื่อนไขการชำระ (`erp_credit`, `erp_credit_type`)

| ตาราง | Index | คอลัมน์สำคัญและบทบาท |
|---|---|---|
| `erp_credit` | `idx_erp_credit_code` | `code`, `name_1`, `name_2`, `start_date`, `stop_date`, `formular` (`varchar(100)`: สูตรคำนวณ), `remark`, `status` — รายการบัตรเครดิต/โปรโมชั่นบัตร |
| `erp_credit_type` | `idx_erp_credit_type_code`, `idx_erp_credit_type_account_code` | `code`, `name_1`, `name_2`, `charge_rate` (`varchar(100)`: อัตราค่าธรรมเนียม), `use_charge_rate` (`smallint`), `account_code` (`varchar(25)`: รหัสผังบัญชี GL ของประเภทบัตร), `status` |

---

## 2. การขอและอนุมัติวงเงินขายเชื่อ (`erp_credit_request`, `erp_credit_approve_level`, `erp_credit_approved_logs`)

### `erp_credit_request` — คำขออนุมัติขายเชื่อเกินวงเงิน
- **Index**: `idx_erp_credit_request_doc_no_trans_flag` ON `("doc_no", "trans_flag")`
- **บทบาทใน `trans_save_rules.go:590-594`**: เมื่อลูกค้ามีสถานะเครดิต `2` (ปิดชั่วคราว) และเปิด `erp_option.sr_ss_credit_check` ระบบจะตรวจตารางนี้จาก `doc_no` ของใบสั่งขาย/สั่งจองอ้างอิง

| คอลัมน์ | ชนิดข้อมูล | ความหมาย / ค่า Flag |
|---|---|---|
| `doc_no`, `trans_flag` | `varchar(50)` / `smallint` | เลขที่และประเภทเอกสารที่ขออนุมัติเครดิต |
| `credit_money`, `credit_money_max` | `numeric` | วงเงินเดิมและวงเงินสูงสุด |
| `chq_amount`, `advance_amount`, `ar_balance_amount`, `sr_amount`, `ss_amount`, `bill_amount`, `over_amount`, `over_percent` | `numeric` | ยอดเช็คค้างรับ เงินล่วงหน้า ยอดลูกหนี้คงค้าง ใบสั่งจอง ใบสั่งขาย ยอดบิล ยอดเกิน และ % เกินวงเงิน ณ เวลาขอ |
| `credit_status` | `smallint DEFAULT 0` | **`0 = อนุมัติแล้ว`**, ค่าอื่น `<> 0` = ยังไม่อนุมัติ (`trans_save_rules.go:577-590`) |
| `user_approve_status`, `user_approve_status_date` | `varchar(50)` / `timestamp` | ผู้อนุมัติและวันเวลาอนุมัติ |

### `erp_credit_approve_level` และ `erp_credit_approved_logs`

| ตาราง | Index | คอลัมน์สำคัญ |
|---|---|---|
| `erp_credit_approve_level` | ไม่มี SQL PK (`roworder serial`) | `from_amount`, `to_amount` (`numeric`), `user_approve`, `phone_number_approve`, `sale_hub_auth`, `branch_code` — ช่วงวงเงินและผู้มีสิทธิ์อนุมัติ |
| `erp_credit_approved_logs` | `idx_erp_credit_approved_logs_doc_no_trans_flag`, `_doc_date_trans_flag` | `doc_no`, `trans_flag`, `trans_type`, `doc_date`, `ref_no`, `creator_code`, `approve_user`, `create_datetime`, `approve_status` (`smallint`) — ประวัติการอนุมัติเครดิต (ใช้อ้างอิงสถานะ `creditLog` ใน `doc_flow.go:70`) |

---

## 3. แผนและเป้าหมายการขาย (`erp_sale_plan`, `erp_sale_plan_detail`)

| ตาราง | Index | คอลัมน์สำคัญและบทบาท |
|---|---|---|
| `erp_sale_plan` | `idx_erp_sale_plan_code` | `code`, `name_1`, `name_2`, `begin_date`, `end_date`, `remark`, `status` (`0 = ใช้งาน`) — หัวแผนเป้าขายตามช่วงวันที่ |
| `erp_sale_plan_detail` | `idx_erp_sale_plan_detail_item_code` | `plan_code` (เชื่อม `erp_sale_plan.code`), `sale_area_code`, `sale_code`, `item_code` (เชื่อม `ic_inventory.code`), `sale_plan_amount` (`numeric`), `remark` |

---

## 4. รอบจ่ายเงินเดือน ประกันสังคม และ ภ.ง.ด.1 (`erp_payroll_run`, `erp_payroll_line`)

| รายการ | รายละเอียด |
|---|---|
| **บทบาท** | จัดเก็บหัวรอบจ่ายเงินเดือนและรายละเอียดพนักงานรายบุคคล พร้อมเพดานค่าจ้างประกันสังคม มาตรา 33 (`17,500` / `875`) และการลงบัญชี GL (`payroll_sso_pnd1.go:115-171`) |
| **Primary Key / Indexes** | `erp_payroll_run`: `run_doc_no VARCHAR(50) PRIMARY KEY` + `idx_erp_payroll_run_period (pay_period DESC, pay_date DESC, run_doc_no DESC)`<br>`erp_payroll_line`: `PRIMARY KEY (run_doc_no, line_no)` |

| ตาราง | คอลัมน์สำคัญ |
|---|---|
| `erp_payroll_run` | `run_doc_no` (`PK`), `pay_period` (`varchar(7)` เช่น `2026-11`), `pay_date` (`date`), `bank_format` (`varchar(20)` Default `'KBANK'`), `employee_count`, `sso_wage_ceiling`, `sso_max_contrib`, `total_base_salary`, `total_overtime`, `total_allowance`, `total_deduct_absent`, `total_gross_pay`, `total_emp_sso`, `total_employer_sso`, `total_pnd1_tax`, `total_net_pay` (`numeric(18,2)`), ผังบัญชี (`salary_expense_acct`, `sso_expense_acct`, `bank_account_code`, `sso_payable_acct`, `wht_payable_acct`), `gl_doc_no`, `status` (`POSTED` ฯลฯ) |
| `erp_payroll_line` | `run_doc_no`, `line_no` (`PK คู่`), `emp_code`, `emp_name`, `national_id`, `bank_account_no`, `base_salary`, `overtime_amt`, `allowance_amt`, `deduct_absent_amt`, `gross_pay`, `sso_wage_base`, `emp_sso_amt`, `employer_sso_amt`, `pnd1_tax_amt`, `net_pay` (`numeric(18,2)`) |

---

## ตัวอย่าง SQL ใช้งานจริง

```sql
-- 1) ตรวจสอบสถานะคำขออนุมัติวงเงินของเอกสารสั่งขาย/สั่งจอง
SELECT r.doc_no, r.trans_flag, r.ar_balance_amount, r.over_amount,
       COALESCE(r.credit_status, 0) AS credit_status,
       r.user_approve_status, r.user_approve_status_date
FROM erp_credit_request r
ORDER BY r.roworder DESC
LIMIT 20;

-- 2) สรุปรอบเงินเดือนและยอดนำส่งประกันสังคม/ภ.ง.ด.1 รายงวด
SELECT run_doc_no, pay_period, pay_date, employee_count,
       total_gross_pay, total_emp_sso, total_employer_sso, total_pnd1_tax, total_net_pay, gl_doc_no
FROM erp_payroll_run
ORDER BY pay_period DESC, pay_date DESC;
```
