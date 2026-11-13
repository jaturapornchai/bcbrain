---
title: งวดบัญชี การอนุมัติเอกสาร และงานค้างบัญชี — erp_account_period / erp_approval_request / erp_etax_ewht_batch
tags: [dev, schema, erp, period, approval, ewht, workflow]
aliases: [erp_account_period, erp_approval_matrix_rule, erp_approval_request, erp_etax_ewht_batch, erp_missing_doc_request, งวดบัญชี]
sources:
  - scripts/sql/02_data_schema.sql:2473-2483
  - backend/internal/application/process/period.go:1-131
  - backend/internal/application/process/budget_approval_matrix.go:60-97
  - backend/internal/application/process/etax_ewht_export.go:87-108
  - backend/internal/application/process/sme_thai_pack.go:975-1007
---

# งวดบัญชี การอนุมัติเอกสาร และงานค้างบัญชี (`erp_account_period` กลุ่ม Workflow)

กลุ่มตารางควบคุมงวดเวลาที่อนุญาตให้ลงบัญชีได้ ตารางสิทธิ์อนุมัติตามวงเงิน Batch ส่งหัก ณ ที่จ่ายอิเล็กทรอนิกส์ (e-WHT) และรายการตามเก็บใบกำกับภาษี/เอกสารค้างส่ง ดูภาพรวมโครงสร้างทั้งหมดได้ที่ [[schema-overview]]

---

## 1. `erp_account_period` — งวดบัญชี (Account Period)

| รายการ | รายละเอียด |
|---|---|
| **บทบาท** | กำหนดช่วงวันที่เริ่มต้น-สิ้นสุดของแต่ละงวดบัญชีและสถานะเปิด/ปิดงวด ทุกการบันทึก แก้ไข ลบ ยกเลิกเอกสาร (ยกเว้นเอกสารที่ไม่กระทบงวดเช่น ใบเปิดงบ/ค่าใช้จ่ายบางรายการใน `periodExemptFlags`) จะตรวจเทียบกับตารางนี้ |
| **Primary Key** | ไม่มี SQL PK (ใช้ `roworder serial`) ค้นหาใน Go ด้วย `date BETWEEN date_start AND date_end ORDER BY period_number, roworder LIMIT 1` (`period.go:53-62`) |

| คอลัมน์ | ชนิดข้อมูล | ความหมาย / ค่า Flag |
|---|---|---|
| `period_number` | `integer DEFAULT 0` | ลำดับงวดบัญชี (เช่น `1` ถึง `12`) |
| `period_year` | `smallint DEFAULT 0` | ปีบัญชี (เช่น ค.ศ. `2026` หรือตามตั้งค่าองค์กร; การกรองช่วงวันที่ยึด `date_start`–`date_end` เป็น ค.ศ.) |
| `date_start` | `date` | วันที่เริ่มต้นงวด |
| `date_end` | `date` | วันที่สิ้นสุดงวด |
| `status` | `integer DEFAULT 0` | **`0 = เปิดงวด (Open)`**, ค่าอื่นเช่น `1 = ปิดงวด (Closed)` — หากวันที่เอกสารไม่อยู่ในช่วงที่มี `status = 0` ระบบจะปฏิเสธการบันทึก/แก้ไข/ลบ |

---

## 2. `erp_approval_matrix_rule` และ `erp_approval_request` — สายอนุมัติตามวงเงิน

| รายการ | รายละเอียด |
|---|---|
| **บทบาท** | กำหนดขั้นวงเงินและตำแหน่งผู้อนุมัติสำหรับคำขอสั่งซื้อ/เบิกจ่าย และบันทึกคำขออนุมัติพร้อมสถานะเกินงบประมาณแผนก |
| **Primary Key** | `erp_approval_matrix_rule`: `rule_code TEXT PRIMARY KEY`<br>`erp_approval_request`: `request_doc_no TEXT PRIMARY KEY` |

### คอลัมน์หลัก (`erp_approval_matrix_rule`)
- `rule_code` (`text PK`), `step_order` (`integer DEFAULT 1`), `min_amount` (`numeric(18,2)`), `max_amount` (`numeric(18,2)`), `approver_role` (`text DEFAULT 'กรรมการผู้จัดการ'`), `created_by` (`text`)

### คอลัมน์หลัก (`erp_approval_request`)
- `request_doc_no` (`text PK`), `request_date` (`date NOT NULL`), `ref_doc_no` (`text`: เลขที่ PO/เอกสารอ้างอิง), `doc_type` (`text DEFAULT 'PO'`), `dept_code` (`text`), `amount` (`numeric(18,2)`), `over_budget` (`boolean`), `required_role` (`text`), `status` (`text DEFAULT 'PENDING'`: `PENDING` / `APPROVED` / `REJECTED`), `decided_by` (`text`), `decided_at` (`timestamptz`), `remark` (`text`), `created_by` (`text`)

---

## 3. `erp_etax_ewht_batch` — ชุดส่งข้อมูล e-Withholding Tax (e-WHT)

| รายการ | รายละเอียด |
|---|---|
| **บทบาท** | เก็บ Batch การจ่ายเงินและคำนวณสิทธิลดอัตรา e-WHT 1% พร้อมสิทธิประโยชน์ลดหย่อน 2 เท่าค่าบริการระบบ (`etax_ewht_export.go:87-120`) |
| **Primary Key** | `batch_doc_no TEXT PRIMARY KEY` |

| คอลัมน์ | ชนิดข้อมูล | ความหมาย |
|---|---|---|
| `batch_doc_no` | `text PRIMARY KEY` | เลขที่ชุดคำนวณ e-WHT |
| `pay_date` | `date NOT NULL` | วันที่จ่ายเงิน (ตรวจเกณฑ์ปีที่มีผลลดอัตราถึง `2027-12-31`) |
| `bank_code` | `text DEFAULT 'KBANK'` | ธนาคารตัวแทนนำส่ง e-WHT |
| `payee_count` | `integer` | จำนวนผู้ถูกหัก ณ ที่จ่ายใน Batch |
| `total_base_amount`, `total_normal_wht`, `total_ewht_1pct`, `total_cashflow_saved`, `total_net_transfer` | `numeric(18,2)` | ยอดฐาน, ภาษีปกติ, ภาษี e-WHT 1%, กระแสเงินสดที่ประหยัดได้ และยอดโอนสุทธิ |
| `system_service_fee`, `double_deduction_benefit` | `numeric(18,2)` | ค่าบริการระบบและสิทธิลดหย่อน 2 เท่า |
| `payload_json` | `jsonb` | รายละเอียดรายการผู้ถูกหักใน Batch |

---

## 4. `erp_missing_doc_request` — ติดตามทวงเอกสารบัญชีค้างรับ (Accountant Chaser)

| รายการ | รายละเอียด |
|---|---|
| **บทบาท** | ติดตามทวงใบกำกับภาษี / หนังสือรับรอง 50 ทวิ / สลิปโอนเงินที่ยังไม่ครบจากคู่ค้าหรือพนักงาน |
| **Primary Key / Unique Key** | `id BIGSERIAL PRIMARY KEY`, `request_no VARCHAR(40) NOT NULL UNIQUE` |

| คอลัมน์ | ชนิดข้อมูล | ความหมาย |
|---|---|---|
| `request_no` | `varchar(40) UNIQUE` | เลขที่ใบตามเอกสาร |
| `doc_type`, `source_module` | `varchar(40)` | ประเภทเอกสาร (`TAX_INVOICE`, 50 ทวิ ฯลฯ) และที่มา |
| `ref_doc_no`, `trans_date`, `counterparty_code`, `counterparty_name`, `amount` | `varchar`/`date`/`numeric(18,2)` | เอกสารอ้างอิง วันที่ รหัสคู่ค้า และยอดเงิน |
| `assigned_to`, `contact_channel`, `due_date`, `chase_count`, `priority`, `status` | `varchar`/`date`/`int` | ผู้รับผิดชอบ, ช่องทาง (`LINE` ฯลฯ), วันครบกำหนด, จำนวนครั้งที่ทวง, ความสำคัญ (`HIGH`), สถานะ (`OPEN` ฯลฯ) |
| `received_doc_no`, `remark` | `varchar(60)` / `text` | เลขที่เอกสารที่ได้รับกลับมาแล้ว |

---

## ตัวอย่าง SQL ตรวจสอบงวดบัญชีและคำขออนุมัติ

```sql
-- 1) ตรวจสอบว่าวันที่เอกสารเป้าหมายอยู่ในงวดบัญชีที่เปิดอยู่หรือไม่
SELECT period_year,
       period_number,
       date_start,
       date_end,
       status,
       CASE WHEN COALESCE(status, 0) = 0 THEN 'เปิดงวด' ELSE 'ปิดงวด' END AS status_label
FROM erp_account_period
WHERE DATE '2026-11-13' BETWEEN date_start AND date_end
ORDER BY period_number, roworder
LIMIT 1;

-- 2) ดูคำขออนุมัติที่ยังรออนุมัติและเกินงบประมาณแผนก
SELECT r.request_doc_no, r.request_date, r.doc_type, r.ref_doc_no,
       r.dept_code, r.amount, r.over_budget, r.required_role
FROM erp_approval_request r
WHERE r.status = 'PENDING'
ORDER BY r.over_budget DESC, r.request_date ASC;
```
