---
title: AR/AP Pay Bill & Deposit Money Legacy Tables — ตารางจ่ายบิลและเงินมัดจำโครงสร้างดั้งเดิม
tags: [dev, schema, ar, ap, pay_bill, deposit, legacy, postgres]
aliases: [ap_ar_pay_bill, ap_ar_pay_bill_detail, ap_ar_deposit_money, เงินมัดจำ]
sources:
  - scripts/sql/02_data_schema.sql:373-452
  - backend/internal/application/process/trans_deposit.go:1-150
---

# AR/AP Pay Bill & Deposit Money Legacy Tables

อธิบายโครงสร้างตาราง `ap_ar_pay_bill`, `ap_ar_pay_bill_detail` และ `ap_ar_deposit_money` ใน `scripts/sql/02_data_schema.sql:373-452` พร้อมแยกความแตกต่างกับระบบปฏิบัติการปัจจุบันใน Go Process Engine

> [!IMPORTANT]
> **ระบบปัจจุบัน (Go Engine)** จัดการเอกสารเงินมัดจำ/ล่วงหน้า (`trans_flag` `10, 11, 20, 25, 40, 42, 110, 112, 9010..9110`) ผ่าน **[[tbl-ic-trans]] (หัว) + [[tbl-ar-ap-trans-detail]] (รายการข้อความ/ยอดเงิน) + `cb_trans_detail`** (`trans_deposit.go:1-150`), และจัดการเอกสารรับ/จ่ายชำระหนี้ (`19, 239`) ผ่าน **[[tbl-ar-ap-trans]] + [[tbl-ar-ap-trans-detail]]** — ส่วน 3 ตารางในหน้านี้เป็นโครงสร้างสคีมาดั้งเดิมสำหรับความเข้ากันได้ของฐานข้อมูลเก่า

---

## 1. ตาราง `ap_ar_deposit_money` (เงินมัดจำดั้งเดิม)

- **หน้าที่**: เก็บหัวเอกสารรับ/จ่ายเงินมัดจำในสคีมารุ่นเก่า (`scripts/sql/02_data_schema.sql:373-407`)
- **Primary Key / Indexes**: ไม่มี SQL `PRIMARY KEY` และไม่มี Index เพิ่มเติม (มี `roworder SERIAL NOT NULL`)

| คอลัมน์ | ชนิดข้อมูล | ความหมาย |
|---|---|---|
| `doc_date`, `doc_no`, `doc_ref`, `doc_group` | `date` / `varchar` | วันที่ เลขที่เอกสาร เอกสารอ้างอิง และกลุ่มเอกสาร |
| `deposit_type` | `smallint DEFAULT 0` | ประเภทมัดจำ (ฝั่งจ่ายล่วงหน้า/มัดจำ AP หรือฝั่งรับล่วงหน้า/มัดจำ AR) |
| `ap_ar_code` | `varchar(25)` | รหัสเจ้าหนี้หรือลูกหนี้ |
| `bill_no`, `bill_date`, `credit_day`, `due_date` | `varchar(25)` / `date` / `integer` | เลขที่บิลอ้างอิง วันที่บิล วันเครดิต และวันครบกำหนด |
| `vat_type`, `vat_rate`, `total_value`, `total_vat_value`, `total_after_vat`, `total_net_value`, `amount`, `money_balance` | `smallint` / `numeric` | ประเภท/อัตรา VAT มูลค่ามัดจำ ภาษี ยอดสุทธิ และยอดมัดจำคงเหลือ (`money_balance`) |
| `sale_code`, `side_code`, `department_code`, `project_code`, `allocate_code` | `varchar(25)` | พนักงานขายและมิติวิเคราะห์ |
| `currency_code`, `exchange_rate` | `varchar(25)` / `numeric` | สกุลเงินและอัตราแลกเปลี่ยน |
| `remark`, `transection_flag`, `status`, `guid_code` | `varchar` / `smallint` | หมายเหตุ แฟล็กธุรกรรม สถานะ และ GUID |

---

## 2. ตาราง `ap_ar_pay_bill` และ `ap_ar_pay_bill_detail` (จ่าย/รับบิลดั้งเดิม)

- **หน้าที่**: เก็บหัวและรายการเอกสารวางบิล/ตัดจ่ายบิลในโครงสร้างสคีมาดั้งเดิม (`scripts/sql/02_data_schema.sql:409-452`)
- **Primary Key / Indexes**: ไม่มี SQL `PRIMARY KEY` และไม่มี Index เพิ่มเติม (มี `roworder SERIAL NOT NULL`)

| ตาราง | คอลัมน์สำคัญ | ความหมาย |
|---|---|---|
| `ap_ar_pay_bill` (`:409-432`) | `doc_date`, `doc_no`, `doc_group`, `doc_ref`, `ap_ar_code`, `credit_day`, `due_date`, `sale_code`, `department_code`, `total_value`, `debt_decrease`, `debt_increase`, `total_net_value`, `total_debt_balance`, `remark`, `transection_flag`, `status`, `guid_code` | หัวเอกสารตัดจ่ายบิล รวมส่วนเพิ่ม/ลดหนี้และยอดคงค้าง |
| `ap_ar_pay_bill_detail` (`:434-452`) | `doc_date`, `doc_no`, `bill_type smallint`, `bill_no`, `bill_date`, `bill_ref`, `due_date`, `debt_value`, `pay_bill_value`, `value_balance`, `remark`, `status`, `line_number` | รายการบิลที่นำมาตัดจ่าย (`debt_value` ยอดบิล, `pay_bill_value` ยอดที่จ่าย, `value_balance` คงเหลือ) |

```sql
-- ตัวอย่าง: เทียบการดึงยอดเงินมัดจำคงเหลือตาม Logic จริงใน Go Engine (trans_deposit.go)
-- ใช้เอกสารมัดจำจาก ic_trans ร่วมกับ cb_trans_detail แทน ap_ar_deposit_money
SELECT t.doc_no,
       t.doc_date,
       t.trans_flag,
       t.cust_code,
       t.total_amount AS deposit_total,
       t.remark
FROM ic_trans t
WHERE COALESCE(t.last_status, 0) = 0
  AND t.trans_flag IN (10, 11, 20, 25, 40, 42, 110, 112, 9010, 9011, 9040, 9110)
ORDER BY t.doc_date DESC, t.doc_no;
```
