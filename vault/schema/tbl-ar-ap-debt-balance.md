---
title: AR/AP Debt Balance & Billing Legacy Tables — ยอดตั้งต้นหนี้และตารางวางบิล/ตัดบิลดั้งเดิม
tags: [dev, schema, ar, ap, debt, billing, legacy, postgres]
aliases: [ap_ar_debt_balance, ap_ar_debt_billing, ap_ar_debt_billing_cut, ap_ar_debt_billing_temp, ยอดตั้งต้นหนี้]
sources:
  - scripts/sql/02_data_schema.sql:192-371
---

# AR/AP Debt Balance & Billing Legacy Tables

กลุ่มตารางจากสคีมาดั้งเดิม (`scripts/sql/02_data_schema.sql:192-371`) สำหรับบันทึกยอดตั้งต้นลูกหนี้/เจ้าหนี้ (`ap_ar_debt_balance`) และโครงสร้างตารางวางบิล/ตัดบิลชุดดั้งเดิม (`ap_ar_debt_billing*`)

> [!IMPORTANT]
> ใน Go Process Engine ปัจจุบัน กระบวนการวางบิลและตัดบิลหลักทำงานผ่าน [[tbl-ar-ap-trans]] (`ap_ar_trans`) + [[tbl-ar-ap-trans-detail]] (`ap_ar_trans_detail` สำหรับ `trans_flag` `19, 213, 235, 239`) ส่วนกลุ่ม `ap_ar_debt_billing*` คงไว้เพื่อรองรับฐานข้อมูลที่ Migrate มาจากระบบเก่าและการตรวจความเข้ากันได้ของ Policy

---

## 1. ตาราง `ap_ar_debt_balance` (ยอดหนี้ยกมา / ตั้งต้นหนี้)

- **หน้าที่**: เก็บรายการเอกสารหนี้ยกมาจากงวดก่อนหรือก่อนเริ่มระบบ (`scripts/sql/02_data_schema.sql:192-221`)
- **Primary Key / Unique Key**: ไม่มี SQL `PRIMARY KEY` (มี `roworder SERIAL NOT NULL`)
- **Indexes**: `idx_ap_ar_debt_balance_ar_code` ON `ap_ar_debt_balance` (`ar_code`)

| คอลัมน์ | ชนิดข้อมูล | ความหมาย |
|---|---|---|
| `doc_date`, `doc_no`, `doc_ref`, `doc_group` | `date` / `varchar(25)` | วันที่เอกสาร เลขที่บิลยกมา เอกสารอ้างอิง และกลุ่มเอกสาร |
| `debt_type` | `smallint DEFAULT 0` | ประเภทหนี้ (แยกฝั่งลูกหนี้/เจ้าหนี้ หรือตั้งเพิ่ม/ลดหนี้) |
| `ar_code` | `varchar(25)` | รหัสคู่ค้า (ลูกหนี้หรือเจ้าหนี้) |
| `due_date`, `credit_code`, `book_code` | `date` / `varchar(25)` | วันครบกำหนด เงื่อนไขเครดิต และสมุดบัญชี |
| `currency_code`, `exchange_rate`, `sum_debt_value` | `varchar(25)` / `numeric` | สกุลเงิน อัตราแลกเปลี่ยน และมูลค่าหนี้ยกมา |
| `project_code`, `allocate_code`, `side_code`, `department_code`, `sale_code`, `area_code`, `job_code` | `varchar(25)` | มิติองค์กรและพนักงานขาย/เขตขาย |
| `transection_flag`, `status`, `remark`, `guid_code` | `smallint` / `varchar` | แฟล็กประเภทธุรกรรม สถานะ หมายเหตุ และ GUID |

---

## 2. กลุ่มตารางวางบิล/ตัดบิลดั้งเดิม (`ap_ar_debt_billing*`)

ทั้ง 6 ตารางมีคู่หัว-รายการเหมือนกัน ไม่มี SQL `PRIMARY KEY` ใน `02_data_schema.sql`

| ตาราง (`02_data_schema.sql`) | บทบาท | คอลัมน์สำคัญ |
|---|---|---|
| `ap_ar_debt_billing` (`:223-251`) | หัวเอกสารวางบิลชุดเดิม | `doc_date`, `doc_no`, `doc_ref`, `doc_group`, `billing_flag smallint`, `ap_ar_code`, `side_code`, `department_code`, `project_code`, `allocate_code`, `person_code`, `total_debt_value`, `total_discount`, `total_after_discount`, `total_money`, `total_debt_balance`, `bill_no`, `bill_date`, `tax_value`, `remark`, `transection_flag`, `status`, `guid_code` |
| `ap_ar_debt_billing_detail` (`:303-321`) | บรรทัดบิลในเอกสารวางบิลชุดเดิม | `doc_date`, `doc_no`, `billing_no`, `billing_date`, `due_date`, `currency_code`, `exchange_rate`, `sum_value`, `sum_money`, `sum_debt_balance`, `remark`, `status`, `line_number` |
| `ap_ar_debt_billing_cut` (`:253-281`) | หัวเอกสารตัดบิล/ลดยอดหนี้ชุดเดิม | โครงสร้างเดียวกับ `ap_ar_debt_billing` แต่เปลี่ยน `billing_flag` เป็น `billing_type smallint` |
| `ap_ar_debt_billing_cut_detail` (`:283-301`) | บรรทัดเอกสารตัดบิลชุดเดิม | `doc_date`, `doc_no`, `billing_no`, `billing_date`, `due_date`, `currency_code`, `exchange_rate`, `debt_value`, `debt_cut_value`, `sum_debt_balance`, `remark`, `status`, `line_number` |
| `ap_ar_debt_billing_temp` (`:323-351`) | หัวเอกสารวางบิลชั่วคราว (Temp/Staging) | คอลัมน์เดียวกับ `ap_ar_debt_billing` |
| `ap_ar_debt_billing_temp_detail` (`:353-371`) | บรรทัดเอกสารวางบิลชั่วคราว | คอลัมน์เดียวกับ `ap_ar_debt_billing_detail` |

```sql
-- ตัวอย่าง: ตรวจดูรายการหนี้ยกมาและเอกสารวางบิลเดิม (กรณีฐานข้อมูลมีข้อมูลย้ายมาจากระบบเก่า)
SELECT b.doc_no,
       b.doc_date,
       b.ap_ar_code,
       b.total_debt_value,
       b.total_debt_balance,
       d.billing_no,
       d.sum_value,
       d.sum_money
FROM ap_ar_debt_billing b
JOIN ap_ar_debt_billing_detail d ON d.doc_no = b.doc_no
WHERE COALESCE(b.status, 0) = 0
ORDER BY b.doc_date DESC, b.doc_no, d.line_number;
```
