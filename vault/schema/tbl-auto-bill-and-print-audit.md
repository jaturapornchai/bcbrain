---
title: โครงสร้างตารางวางบิลอัตโนมัติ ประวัติการพิมพ์ Hash Chain รูปแนบเอกสาร และพนักงาน (ar_auto_bill_rule, erp_print_audit_log, erp_doc_picture, erp_user)
tags: [schema, auto-billing, print-audit, minio, employee, postgresql]
aliases: [ar_auto_bill_rule, ar_auto_bill_log, ap_auto_bill_rule, ap_auto_bill_log, erp_print_audit_log, erp_doc_picture, erp_user, ar_shoptype2]
sources:
  - backend/internal/application/process/db_migrate.go:1450-1461
  - backend/internal/application/process/db_migrate.go:1890-1993
  - backend/internal/application/process/service.go:978-1012
  - scripts/sql/02_data_schema.sql:2925-2936
  - scripts/sql/02_data_schema.sql:3828-3895
  - scripts/sql/02_data_schema.sql:1497-1574
---

# โครงสร้างตารางวางบิลอัตโนมัติ ประวัติการพิมพ์ Hash Chain รูปแนบเอกสาร และพนักงาน

สรุปสคีมาของตารางควบคุมรอบวางบิลอัตโนมัติฝั่งลูกหนี้–เจ้าหนี้ ตารางหลักฐานการพิมพ์เอกสารแบบ SHA-256 Hash Chain + MinIO ตารางรูปภาพประกอบเอกสาร และตารางพนักงาน/เพดานอนุมัติรายบุคคล

---

## 1. กฎและประวัติวางบิลอัตโนมัติ (`ar_auto_bill_rule`, `ar_auto_bill_log`, `ap_auto_bill_rule`, `ap_auto_bill_log`)

- **ตารางกฎรายคู่ค้า (`ar_auto_bill_rule` / `ap_auto_bill_rule`)** — PK `cust_code VARCHAR(50)`:
  - ตารางรอบวางบิล: `schedule_mode SMALLINT` (`0`=รายวันที่ระบุในเดือน `month_days`, `1`=รายสัปดาห์ตาม `weekday_num` และ `week_ordinals` เช่น `'2,4'`), `cutoff_days_before INTEGER`, `holiday_shift SMALLINT`
  - เครดิตและภาษี: `credit_base_mode SMALLINT`, `credit_day INTEGER`, `min_bill_amount NUMERIC(18,4)`, `wht_rate NUMERIC(9,4)`, `wht_income_type VARCHAR(150)`, `promptpay_id VARCHAR(30)`, `contact_channel VARCHAR(150)`
- **ตารางประวัติการรันวางบิล (`ar_auto_bill_log` / `ap_auto_bill_log`)** — Indexes: `(cust_code, doc_date DESC)`, `(run_hash)`:
  - `run_hash VARCHAR(64) NOT NULL`, `doc_no VARCHAR(50) UNIQUE`, `doc_date DATE`, `due_date DATE`, `cust_code VARCHAR(50)`, `invoice_count INTEGER`
  - ยอดเงินแบบ `NUMERIC`: `sum_before_vat NUMERIC(18,4)`, `sum_vat_amount NUMERIC(18,4)`, `sum_bill_amount NUMERIC(18,4)`, `expected_wht_amount NUMERIC(18,4)`, `expected_net_amount NUMERIC(18,4)`, `promptpay_payload TEXT`

---

## 2. ตารางประวัติการพิมพ์และห่วงโซ่หลักฐาน (`erp_print_audit_log`)

เก็บหลักฐานทุกครั้งที่พิมพ์ฟอร์มเอกสารหรือรายงาน พร้อมผูกไฟล์ PDF/JSON ต้นฉบับใน MinIO:

| คอลัมน์หลัก | ชนิดข้อมูล | ความหมาย |
|---|---|---|
| `print_uid` | `VARCHAR(64) UNIQUE` | รหัสอ้างอิงเหตุการณ์การพิมพ์ |
| `printed_at` / `doc_date` | `TIMESTAMPTZ` / `DATE` | วันเวลาที่สั่งพิมพ์ และวันที่เอกสาร |
| `source_kind` / `event_type` | `VARCHAR(30)` | ชนิดต้นทาง (`DOC_FORM` ฯลฯ) และเหตุการณ์ (`PRINT`) |
| `doc_kind` / `trans_flag` / `doc_no` | `VARCHAR(40)` / `INTEGER` / `VARCHAR(80)` | ตารางต้นทาง (`ic_trans`, `ap_ar_trans` ฯลฯ), รหัสประเภทเอกสาร และเลขที่เอกสาร |
| `copy_mode` / `print_seq` | `VARCHAR(20)` / `INTEGER` | `original` (ต้นฉบับ) หรือ `copy` (สำเนา) และลำดับครั้งที่พิมพ์ |
| `total_before_vat` / `total_vat_value` / `total_amount` | `NUMERIC(18,2)` | ยอดเงินขณะสั่งพิมพ์สำหรับเทียบหาการแก้ไขหลังพิมพ์ |
| `minio_pdf_key` / `minio_json_key` | `TEXT` | พาธเก็บไฟล์ PDF และ Snapshot JSON ใน MinIO |
| `pdf_sha256` / `snapshot_sha256` | `VARCHAR(64)` | ค่าแฮชของไฟล์ PDF และ JSON ขณะพิมพ์ |
| `prev_chain_hash` / `chain_hash` | `VARCHAR(64)` | ห่วงโซ่ SHA-256 ต่อเนื่องป้องกันการลบหรือแก้ประวัติย้อนหลัง |
| `snapshot_json` | `JSONB` | ข้อมูลเอกสารขณะพิมพ์สำหรับตรวจเทียบฟิลด์ต่อฟิลด์ |

---

## 3. รูปภาพแนบเอกสาร (`erp_doc_picture`), พนักงาน (`erp_user`) และประเภทร้านค้าย่อย (`ar_shoptype2`..`ar_shoptype6`)

- **`erp_doc_picture`**: `doc_no VARCHAR(100)`, `system_id VARCHAR(100)` (โมดูล `ic`/`po`/`so`/`ap`/`ar`/`cb`/`gl`), `image_id VARCHAR(100)`, `image_order SMALLINT`, `image_url TEXT`, `image_file BYTEA`, `remark TEXT`
- **`erp_user`** (ทะเบียนพนักงานและสิทธิ์หน้างาน/วงเงินอนุมัติ):
  - สังกัด: `code VARCHAR(25)`, `name_1`, `name_2`, `side`, `department`, `branch_code`, `area_code`, `area_paybill`, `salary NUMERIC`
  - สิทธิ์หน้าขาย/POS/คลัง: `price_level_1`, `price_level_2`, `discount_level_1`, `pos_cashier`, `discount_bill_pos`, `delete_item_pos`, `cancel_pos_bill_level`, `open_cash_drawer`, `ic_wht`, `ic_shelf`, `show_item_cost`, `approve_ar_credit`, `disable_edit_doc_no_doc_date_user`
  - เพดานวงเงินอนุมัติ (`NUMERIC`): `po_approve_from..to`, `sr_approve_from..to`, `ss_approve_from..to`, `cr_approve_from..to`, `max_cr_approve`, `sr_approve_from_percent..to_percent`, `load_approve_percent`
- **`ar_shoptype2` ถึง `ar_shoptype6`**: ตารางจัดกลุ่มประเภทร้านค้าย่อยระดับ 2–6 (`code VARCHAR(25)`, `name_1`, `name_2`, `remark`, `status SMALLINT`)

---

## ความสัมพันธ์ในระบบ
- [[uses_table::tbl-ar-customer]] · [[uses_table::tbl-ap-supplier]]
- [[has_query::sql-marketplace-payroll-subledger-audit]] — คิวรีตรวจสอบประวัติการพิมพ์และกฎวางบิลอัตโนมัติ
- [[exposes_api::api-inbound-handlers-workflows]] — Endpoints `/process/print-audit/*` และ `/process/workflow/ar-auto-bill`
