---
title: AR Contracts, Credit Groups, Commission, Retention & Marketplace — ตารางสัญญาและระบบต่อยอดลูกหนี้
tags: [dev, schema, ar, contract, credit, commission, retention, marketplace, postgres]
aliases: [ar_contract, ar_consignment_account, ar_credit_group, ar_commission_plan, ar_ap_retention_ledger, ar_marketplace_settlement, สัญญาขาย, ฝากขาย, ค่าคอมมิชชั่น, ar_marketplace_settlement_detail, ar_marketplace_daily_abb, ar_public_bill_link]
sources:
  - scripts/sql/02_data_schema.sql:954-1013
  - backend/internal/application/process/ar_contract.go:40-158
  - backend/internal/application/process/consignment.go:131-175
  - backend/internal/application/process/credit_group_penalty.go:93-148
  - backend/internal/application/process/sales_commission.go:156-205
  - backend/internal/application/process/project_retention.go:118-161
  - backend/internal/application/process/public_bill_pay.go:187-212
  - backend/internal/application/process/marketplace_reconcile.go:153-246
  - backend/internal/application/process/sme_thai_pack.go:1556-1620
  - backend/internal/application/process/sme_thai_pack.go:1900-1960
  - backend/internal/application/process/trans_party.go:200-255
---

# AR Contracts, Credit Groups, Commission, Retention & Marketplace

กลุ่มตารางส่วนขยายฝั่งลูกหนี้ในยุค Go Process Engine (พร้อมตารางเครดิตดั้งเดิมบางส่วนจาก `02_data_schema.sql`) ครอบคลุมสัญญาบริการ/เช่าซื้อรายงวด, ฝากขาย, กลุ่มวงเงินเครดิตและเบี้ยปรับล่าช้า, คอมมิชชั่นพนักงานขาย, เงินประกันผลงานรับเหมา (Retention AR/AP), ลิงก์ชำระบิลสาธารณะ และกระทบยอด Marketplace

---

## 1. สัญญาลูกหนี้รายงวด (`ar_contract`, `ar_contract_detail`, `ar_contract_log`)

สร้างอัตโนมัติโดย `ar_contract.go:40-148` (มี SQL `PRIMARY KEY` ทุกตาราง) เพื่อแบ่งงวดสัญญาบริการ/เช่าซื้อ (รายเดือน/ไตรมาส/กำหนดวัน) และสร้างเอกสารตั้งหนี้ขาย (`ic_trans` หรือใบแจ้งหนี้) เมื่อถึงกำหนด

| ตาราง | PK / Unique / Index | คอลัมน์สำคัญ |
|---|---|---|
| `ar_contract` (`:40-88`) | `roworder SERIAL PRIMARY KEY`, `UNIQUE (doc_no)` | `doc_no varchar(25)`, `doc_date date`, `contract_ref_no`, `name_1`, `cust_code`, `contract_tax_mode` (`0/1`), `vat_calc_mode`, `vat_rate NUMERIC(18,4)`, `currency_code`, `exchange_rate NUMERIC(18,6)`, `start_date`, `end_date`, `frequency_type`, `custom_days`, `credit_day`, `installment_count`, `accrual_doc_mode`, `item_or_expense_code`, `wh_code`, `shelf_code`, `unit_code`, `account_code`, `wht_flag`, `wht_form_type`, `wht_income_type`, `wht_rate NUMERIC(18,4)`, `total_contract_input`, `total_before_vat_2`/`total_vat_value_2`/`total_amount_2` (สกุลต่างประเทศ), `total_before_vat`/`total_vat_value`/`total_amount`/`total_wht_amount`/`total_net_pay_amount` (`NUMERIC(18,2)`), `auto_accrue`, `branch_code`, `department_code`, `project_code`, `creator_code` |
| `ar_contract_detail` (`:89-120`) | `roworder SERIAL PRIMARY KEY`; `idx_ar_contract_detail_doc (doc_no, installment_no)`, `idx_ar_contract_detail_due (accrual_status, due_date)` | `doc_no`, `line_number`, `installment_no`, `due_date`, `period_desc`, `amount_before_vat_2`/`vat_amount_2`/`sum_amount_2`, `amount_before_vat`/`vat_amount`/`sum_amount`, `wht_rate`, `wht_amount`, `net_pay_amount`, `accrual_status` (`0=รอตั้งหนี้`, `1=ตั้งหนี้แล้ว`), `accrued_doc_no`, `accrued_trans_flag`, `accrued_date`, `accrued_by`, `tax_doc_no`, `tax_doc_date`, `remark` |
| `ar_contract_log` (`:121-143`) | `roworder SERIAL PRIMARY KEY`; `idx_ar_contract_log_doc (doc_no, roworder DESC)` | `doc_no`, `installment_no`, `action_type`, `ref_doc_no`, `ref_trans_flag`, `ref_date`, `wht_doc_no`, `vat_doc_no`, `amount`, `vat_amount`, `wht_amount`, `net_paid_amount`, `creator_code`, `remark` |

---

## 2. ฝากขายลูกหนี้ (`ar_consignment_account`, `ar_consignment_log`)

จัดการบัญชีร้านฝากขาย ผูกคลังฝากขาย (`consign_wh_code`) กับคลังต้นทาง (`source_wh_code`) ส่งของ/รับคืนด้วยเอกสารโอน `trans_flag = 72` และสรุปขายวางบิล (`trans_flag = 44 + 235`) (`consignment.go:131-192`):

- **`ar_consignment_account`** (`PK: cust_code VARCHAR(30)`): `consign_wh_code`, `consign_shelf_code`, `source_wh_code`, `source_shelf_code`, `gp_percent NUMERIC(9,4)` (% ส่วนแบ่ง GP), `credit_day`, `active_status SMALLINT` (`1 = ใช้งาน`), `remark`, `updated_at`
- **`ar_consignment_log`** (`PK: log_id BIGSERIAL`; `idx_ar_consignment_log_cust (cust_code, doc_date DESC, log_id DESC)`): `action_type` (`DISPATCH`/`RETURN`/`SETTLE`), `cust_code`, `doc_no`, `trans_flag`, `billing_doc_no`, `doc_date`, `total_qty NUMERIC(18,4)`, `total_amount NUMERIC(18,2)`, `created_by`, `created_at`

---

## 3. กลุ่มเครดิต การคำนวณวันครบกำหนด และเบี้ยปรับล่าช้า

| ตาราง (ที่มา) | PK / Index | คอลัมน์สำคัญและการใช้งาน |
|---|---|---|
| `ar_credit_group` (`02_data_schema.sql:969-984` + `credit_group_penalty.go:93-104`) | `code VARCHAR(30) PRIMARY KEY` (ใน Go DDL) | กำหนดวงเงินเครดิตรวมทั้งกลุ่มบริษัท/เครือข่าย (`credit_limit NUMERIC(18,2)` / `credit_money`, `credit_max`), `grace_days INT`, `penalty_rate_pct NUMERIC(9,4)` (Default `7.50`% ต่อปี), `lock_mode SMALLINT DEFAULT 1`, `active_status SMALLINT DEFAULT 1`, `status SMALLINT`, `name_1`, `name_2`, `remark` |
| `ar_credit_group_detail` (`02_data_schema.sql:986-996`) | `idx_ar_credit_group_detail_ar_code (ar_code)` | จับคู่ `ar_code` กับ `credit_group` (`status`, `line_number`); ส่วนรุ่นใหม่ผูกผ่าน `ar_customer_detail.credit_group_code` |
| `ar_credit_approve` (`02_data_schema.sql:954-967`) | `idx_ar_credit_approve_code (code)` | ตารางรหัสผู้อนุมัติ/สถานะอนุมัติเครดิต (`code`, `name_1`, `name_2`, `status`) |
| `ar_credit_pay_bill` (`02_data_schema.sql:998-1013`, `trans_party.go:224-255`) | ไม่มี SQL PK | ตารางสูตรคำนวณวันครบกำหนดวางบิล/รับเงิน (`credit_day`, `day_to_due`, `month_to_due`, `day_to_close`, `month_to_close`, `day_to_noties`, `month_to_noties`, `day_to_noties_2`, `month_to_noties_2`, `line_number`) ใช้เมื่อ `erp_option.use_credit_pay_bill_calc = 1` |
| `ar_late_penalty_log` (`credit_group_penalty.go:106-118`) | `penalty_hash VARCHAR(64) PRIMARY KEY` | ป้องกันออกใบเพิ่มหนี้เบี้ยปรับซ้ำ (`debit_note_doc_no`, `source_doc_no`, `cust_code`, `as_of_date`, `principal_amount NUMERIC(18,2)`, `net_penalty_days`, `penalty_rate_pct NUMERIC(9,4)`, `penalty_amount NUMERIC(18,2)`, `created_by`, `created_at`) |

---

## 4. คอมมิชชั่นพนักงานขาย และเงินประกันผลงานรับเหมา (Retention)

- **`ar_commission_plan`** (`sales_commission.go:156-171`, `PK: plan_code VARCHAR(30)`): `name_1`, `calc_basis SMALLINT DEFAULT 2` (เกณฑ์คำนวณ เช่น ยอดขาย/ยอดเก็บเงิน), `use_item_rate SMALLINT DEFAULT 1`, `tiers_json JSONB` (ขั้นบันไดอัตราคอมมิชชั่น), `expense_account_code`, `payable_account_code`, `active_status`, `remark`, `updated_at`
- **`ar_commission_run`** (`sales_commission.go:173-193`, `PK: run_doc_no VARCHAR(30)`; `idx_ar_commission_run_hash`, `idx_ar_commission_run_period`): `period_from`, `period_to`, `plan_code`, `total_base_amount NUMERIC(18,2)`, `total_commission NUMERIC(18,2)`, `salesman_count INT`, `gl_doc_no`, `run_hash VARCHAR(64)`, `created_by`, `created_at`
- **`ar_ap_retention_ledger`** (`project_retention.go:118-153`, `PK: ret_doc_no VARCHAR(50)`; `idx_ar_ap_retention_project`, `idx_ar_ap_retention_status_due`):
  - บัญชีคุมเงินประกันผลงานทั้งฝั่งรับ (`direction = 'AR'`) และจ่าย (`direction = 'AP'`) ตามโครงการ (`project_code`, `boq_budget`)
  - คอลัมน์เงินหลัก: `gross_progress_amount`, `vat_rate`, `vat_amount`, `wht_rate`, `wht_amount`, `retention_rate`, `retention_amount`, `net_cash_on_progress` (`NUMERIC(18,2)`), `retention_account_code`, `bank_account_code`, `status` (`HELD`/`RELEASED`), `warranty_due_date`, `release_gl_doc_no`, `release_date`, `ref_invoice_no`, `party_code`

---

## 5. ชำระบิลออนไลน์ มือถือ และกระทบยอด Marketplace (`ar_public_bill_link`, `ar_mobile_quick_bill`, `ar_marketplace_*`)

| ตาราง (ที่มา) | PK / Unique / Index | คอลัมน์สำคัญทางธุรกิจ |
|---|---|---|
| `ar_public_bill_link` (`public_bill_pay.go:187-209`) | `doc_no VARCHAR(30) PRIMARY KEY` | ลิงก์รับชำระเงินออนไลน์ + แนบสลิป: `cust_code`, `status` (`OPEN`/`PAID` ฯลฯ), `expires_at`, `promptpay_id`, `wht_rate`, `wht_income_type`, `slip_paid_amount`, `slip_wht_deducted`, `slip_transfer_ref`, `slip_transfer_date`, `slip_transfer_time`, `slip_payer_note`, `slip_mime`, `slip_data_base64`, `slip_submitted_at`, `receipt_doc_no`, `created_by`, `updated_at` |
| `ar_mobile_quick_bill` (`sme_thai_pack.go:1556-1620, 1900-1960`) | `doc_no VARCHAR(40) PRIMARY KEY` | ออกบิลด่วน 30 วินาทีบนมือถือพร้อม PromptPay QR: `doc_type` (`INVOICE`/`QUOTATION`), `doc_date`, `due_date`, `cust_code`, `cust_name`, `cust_tax_id`, `vat_type`, `before_vat`, `vat_amount`, `total_amount`, `promptpay_id`, `promptpay_payload`, `share_path`, `status`, `lines_json JSONB`, `remark` *(การลบผ่าน `deleteMobileQuickBillTx` ล็อก `FOR UPDATE` ทั้ง `ar_mobile_quick_bill` และ `ar_public_bill_link`, ปฏิเสธหาก `status = 'RECEIPTED'` หรือ `receipt_doc_no <> ''` และลบลิงก์สาธารณะพร้อมกันเฉพาะกรณีที่มีแถวใน `ar_mobile_quick_bill` เพื่อไม่กระทบเอกสาร AR ปกติ)* |
| `ar_marketplace_connection` (`marketplace_reconcile.go:210-224`) | `id BIGSERIAL PRIMARY KEY`, `UNIQUE (platform, shop_id)` | ตั้งค่าเชื่อมต่อร้านค้า (`SHOPEE`/`TIKTOK`/`LAZADA`): `platform`, `shop_id`, `shop_name`, `auto_sync_enabled BOOLEAN`, `default_bank_account`, `default_revenue_account`, `oauth_status`, `last_sync_at`, `updated_at` *(เก็บ config เชิงบัญชีแยกต่างหาก ไม่นำข้อมูล credential ออกเผยแพร่)* |
| `ar_marketplace_settlement` (`marketplace_reconcile.go:153-183,206-208`) | `batch_doc_no VARCHAR(50) PRIMARY KEY`; `idx_ar_marketplace_settlement_hash`, `_date` | หัวกระทบยอดเงินโอนจาก Marketplace: `platform`, `settlement_date`, `order_count`, `gross_sales`, `total_platform_fee`, `total_payment_fee`, `total_shipping_diff`, `total_ads_fee`, `total_refund`, `total_fees`, `fee_vat_amount`, `wht_deducted`, `expected_payout`, `actual_bank_received`, `variance_amount`, `bank_account_code`, `revenue_account_code`, `fee_expense_account_code`, `shipping_expense_account_code`, `gl_doc_no`, `abb_doc_no`, `batch_hash` |
| `ar_marketplace_settlement_detail` (`marketplace_reconcile.go:185-204`) | `PRIMARY KEY (batch_doc_no, line_number)` | รายละเอียดระดับคำสั่งซื้อ (`order_id`, `order_date`, `gross_sales`, `platform_fee`, `payment_fee`, `shipping_diff`, `ads_fee`, `refund_amount`, `fee_vat_amount`, `wht_deducted`, `net_payout`) |
| `ar_marketplace_daily_abb` (`marketplace_reconcile.go:226-240`) | `abb_doc_no VARCHAR(50) PRIMARY KEY` | สรุปใบกำกับภาษีอย่างย่อ (ABB) รายวันจากยอดขาย Marketplace: `batch_doc_no`, `platform`, `tax_date`, `order_count`, `gross_sales`, `refund_amount`, `net_taxable_amount`, `before_vat`, `vat_amount`, `vat_rate` |

```sql
-- ตัวอย่าง: ตรวจดูงวดสัญญา AR ที่ถึงกำหนดตั้งหนี้แล้วแต่ยังไม่เปิดบิล
SELECT h.doc_no,
       h.cust_code,
       c.name_1 AS customer_name,
       d.installment_no,
       d.due_date,
       d.sum_amount,
       d.wht_amount,
       d.net_pay_amount
FROM ar_contract h
JOIN ar_contract_detail d ON d.doc_no = h.doc_no
LEFT JOIN ar_customer c ON c.code = h.cust_code
WHERE d.accrual_status = 0
  AND d.due_date <= CURRENT_DATE
ORDER BY d.due_date, h.doc_no, d.installment_no;
```
