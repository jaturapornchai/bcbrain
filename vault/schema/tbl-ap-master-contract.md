---
title: AP Master Groups & Contracts — ประเภท/กลุ่มเจ้าหนี้ และสัญญาซื้อ/บริการรายงวด
tags: [dev, schema, ap, master, contract, postgres]
aliases: [ap_type, ap_group, ap_group_sub, ap_dimension, ap_contract, สัญญาซื้อ, กลุ่มเจ้าหนี้]
sources:
  - scripts/sql/02_data_schema.sql:680-727
  - scripts/sql/02_data_schema.sql:865-878
  - backend/internal/application/process/ap_contract.go:475-600
---

# AP Master Groups & Contracts — กลุ่มเจ้าหนี้และสัญญาฝั่งซื้อ

รวมตารางจัดหมวดหมู่เจ้าหนี้ (`ap_type`, `ap_group`, `ap_group_sub`, `ap_dimension`) ที่เชื่อมกับ [[tbl-ap-supplier]] และตารางสัญญาจ่ายรายงวด/สัญญาเช่า/บริการ (`ap_contract*`) ที่พัฒนาเพิ่มเติมใน Go Process Engine ดูโครงสร้างหลักได้ที่ [[schema-overview]]

---

## 1. ตารางจัดกลุ่มและจำแนกเจ้าหนี้ (`02_data_schema.sql`)

- **Primary Key / Unique Key**: ไม่มี SQL `PRIMARY KEY` ในสคีมาดั้งเดิม (มี `roworder SERIAL NOT NULL` และ Index บน `code`)

| ตาราง (`02_data_schema.sql`) | Index | คอลัมน์สำคัญ | ฟิลด์อ้างอิงใน `ap_supplier` / `_detail` |
|---|---|---|---|
| `ap_type` (`:865-878`) | `idx_ap_type_code` (`code`) | `code`, `name_1`, `name_2`, `status`, `guid_code` | `ap_supplier.ap_type` |
| `ap_group` (`:697-710`) | `idx_ap_group_code` (`code`) | `code`, `name_1`, `name_2`, `status`, `guid_code` | `ap_supplier_detail.group_main` |
| `ap_group_sub` (`:712-727`) | `idx_ap_group_sub_code` (`code`) | `code`, `name_1`, `name_2`, `sub_no integer`, `main_group varchar(10)`, `status`, `guid_code` | `ap_supplier_detail.group_sub_1`–`4` |
| `ap_dimension` (`:680-695`) | `idx_ap_dimension_code` (`code`) | `code`, `name_1`, `name_2`, `remark varchar(255)`, `dimension_no integer`, `status`, `guid_code` | `ap_supplier_detail.dimension_1`–`10` |

---

## 2. ระบบสัญญาจ่ายรายงวดฝั่งเจ้าหนี้ (`ap_contract`, `ap_contract_detail`, `ap_contract_log`)

สร้างอัตโนมัติโดย `ap_contract.go:475-583` สำหรับบริหารสัญญาเช่า สัญญาจ้างบริการ สัญญาผ่อนชำระ ที่ต้องคำนวณ VAT, หัก ณ ที่จ่าย (WHT) และตั้งค้างจ่าย (`accrue`) เป็นงวดๆ

### 2.1 ตาราง `ap_contract` (หัวสัญญาฝั่งซื้อ/ค่าใช้จ่าย)

- **Primary Key / Unique Key**: `roworder SERIAL PRIMARY KEY` และ `doc_no VARCHAR(25) UNIQUE NOT NULL` (`ap_contract.go:478-480`)

| คอลัมน์สำคัญ | ชนิดข้อมูล | ความหมาย |
|---|---|---|
| `doc_no`, `doc_date`, `contract_ref_no`, `name_1` | `varchar`/`date` | เลขที่สัญญา วันที่ เลขที่สัญญาอ้างอิง และชื่อสัญญา |
| `cust_code` | `varchar(25) NOT NULL` | **หมายเหตุชื่อคอลัมน์**: เก็บรหัสเจ้าหนี้ (`ap_supplier.code`) |
| `contract_tax_mode`, `vat_calc_mode`, `vat_rate` | `smallint` / `NUMERIC(18,4)` | รูปแบบภาษีสัญญา โหมดคำนวณ VAT และอัตราภาษี (Default `7`) |
| `currency_code`, `exchange_rate` | `varchar(10)` / `NUMERIC(18,6)` | สกุลเงิน (`THB`) และอัตราแลกเปลี่ยน (`1`) |
| `start_date`, `end_date`, `frequency_type`, `custom_days`, `credit_day`, `installment_count` | `date` / `smallint` / `integer` | วันเริ่มต้น/สิ้นสุด ความถี่งวด จำนวนวันกำหนดเอง และจำนวนงวดทั้งหมด |
| `accrual_doc_mode`, `item_or_expense_code`, `wh_code`, `shelf_code`, `unit_code`, `account_code` | `smallint` / `varchar` | โหมดสร้างเอกสารตั้งค้างจ่าย (`ic_trans` ซื้อ/ค่าใช้จ่าย), รหัสสินค้า/ค่าใช้จ่าย, คลัง/ที่เก็บ, หน่วย, ผังบัญชี |
| `wht_flag`, `wht_form_type`, `wht_income_type`, `wht_rate` | `smallint` / `varchar` / `NUMERIC(18,4)` | ตั้งค่าหัก ณ ที่จ่าย (ภ.ง.ด. 1/3/53), ประเภทเงินได้ และอัตรา WHT |
| `total_contract_input`, `total_before_vat_2`/`total_vat_value_2`/`total_amount_2`, `total_before_vat`/`total_vat_value`/`total_amount`, `total_wht_amount`, `total_net_pay_amount` | `NUMERIC(18,2)` | ยอดสัญญาตั้งต้น ยอดสกุลเงินต่างประเทศ (`_2`) ยอดบาท รวมภาษี WHT และยอดสุทธิที่ต้องจ่าย |
| `auto_accrue`, `branch_code`, `department_code`, `project_code`, `creator_code` | `smallint` / `varchar` | เปิดตั้งหนี้อัตโนมัติ (`DEFAULT 1`), สาขา แผนก โครงการ และผู้สร้าง |

### 2.2 ตาราง `ap_contract_detail` และ `ap_contract_log`

- **`ap_contract_detail`** (`ap_contract.go:524-555`, `roworder SERIAL PRIMARY KEY`; `idx_ap_contract_detail_doc (doc_no, installment_no)`, `idx_ap_contract_detail_due (accrual_status, due_date)`):
  - เก็บค่างวดแต่ละงวด: `doc_no`, `line_number`, `installment_no`, `due_date`, `period_desc`, ยอดสกุลต่างประเทศ (`amount_before_vat_2`, `vat_amount_2`, `sum_amount_2`), ยอดบาท (`amount_before_vat`, `vat_amount`, `sum_amount`), หัก ณ ที่จ่าย (`wht_rate`, `wht_amount`, `net_pay_amount`), สถานะ (`accrual_status`: `0=รอตั้งค้างจ่าย`, `1=ตั้งเอกสารแล้ว`), เอกสารที่สร้าง (`accrued_doc_no`, `accrued_trans_flag`, `accrued_date`, `accrued_by`, `tax_doc_no`, `tax_doc_date`, `remark`)
- **`ap_contract_log`** (`ap_contract.go:556-577`, `roworder SERIAL PRIMARY KEY`; `idx_ap_contract_log_doc (doc_no, roworder DESC)`):
  - บันทึก Audit Trail ทุกเหตุการณ์ของสัญญา: `doc_no`, `installment_no`, `action_type`, `ref_doc_no`, `ref_trans_flag`, `ref_date`, `wht_doc_no`, `vat_doc_no`, `amount`, `vat_amount`, `wht_amount`, `net_paid_amount`, `creator_code`, `remark`

```sql
-- ตัวอย่าง: สรุปยอดงวดสัญญาเจ้าหนี้ที่ค้างตั้งหนี้แยกตามผู้ขาย
SELECT c.cust_code AS ap_code,
       s.name_1 AS supplier_name,
       COUNT(d.roworder) AS pending_installments,
       SUM(d.sum_amount) AS pending_gross_amount,
       SUM(d.wht_amount) AS pending_wht_amount,
       SUM(d.net_pay_amount) AS pending_net_pay
FROM ap_contract c
JOIN ap_contract_detail d ON d.doc_no = c.doc_no
LEFT JOIN ap_supplier s ON s.code = c.cust_code
WHERE d.accrual_status = 0
GROUP BY c.cust_code, s.name_1
ORDER BY pending_net_pay DESC;
```
