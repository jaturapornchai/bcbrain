---
title: ตารางบัญชีขั้นสูงและภาษีนิติบุคคล (gl_prepaid_schedule, gl_fx_revaluation, gl_corporate_tax_workpaper, gl_dbd_taxonomy_map, gl_director_loan_ledger, gl_foreign_tax_voucher)
tags:
  - schema
  - gl
  - prepaid
  - fx
  - pnd50
  - dbd
  - pp36
aliases:
  - gl_prepaid_schedule
  - gl_prepaid_schedule_line
  - gl_fx_revaluation
  - gl_fx_revaluation_detail
  - gl_corporate_tax_workpaper
  - gl_dbd_taxonomy_map
  - gl_director_loan_ledger
  - gl_foreign_tax_voucher
sources:
  - backend/internal/application/process/prepaid_deferred_amort.go:84
  - backend/internal/application/process/prepaid_deferred_amort.go:108
  - backend/internal/application/process/fx_revaluation.go:123
  - backend/internal/application/process/fx_revaluation.go:147
  - backend/internal/application/process/corporate_tax_pnd50_51.go:92
  - backend/internal/application/process/dbd_efiling_taxonomy.go:48
  - backend/internal/application/process/director_loan_guard.go:59
  - backend/internal/application/process/foreign_service_tax.go:67
---

# ตารางบัญชีขั้นสูงและภาษีนิติบุคคล

กลุ่มตารางสมัยใหม่ของโมดูล GL ที่ถูกสร้างอัตโนมัติใน Go Backend สำหรับงานปิดบัญชีตามมาตรฐานการบัญชีไทย (TFRS for PAEs/NPAEs) และภาษีกรมสรรพากร/กรมพัฒนาธุรกิจการค้า ได้แก่ ค่าใช้จ่ายจ่ายล่วงหน้า/รายได้รับล่วงหน้า, การปรับมูลค่าอัตราแลกเปลี่ยนสิ้นงวด (TAS 21), กระดาษทำการ ภ.ง.ด.50/51, การจัดผัง DBD e-Filing XBRL, เงินกู้ยืมกรรมการ และภาษีบริการต่างประเทศ (ภ.พ.36 / ภ.ง.ด.54)

---

## 1. `gl_prepaid_schedule` และ `gl_prepaid_schedule_line` — ตารางตัดจำหน่ายจ่ายล่วงหน้า/รับล่วงหน้า

- **วัตถุประสงค์**: บริหารงวดตัดจำหน่ายค่าใช้จ่ายจ่ายล่วงหน้า (Prepaid Expense) และรายได้รับล่วงหน้า (Deferred Revenue) รายเดือน พร้อมติดตามยอดที่ Post เข้า `gl_journal` แล้ว
- **Primary / Unique Key**:
  - `gl_prepaid_schedule`: `schedule_doc_no` (`VARCHAR(50) PRIMARY KEY`), Index `idx_gl_prepaid_schedule_dates` ON `(start_date DESC, schedule_doc_no DESC)`
  - `gl_prepaid_schedule_line`: `PRIMARY KEY (schedule_doc_no, line_no)`, `UNIQUE (schedule_doc_no, period_month)`

### คอลัมน์สำคัญ

| ตาราง | คอลัมน์ | ชนิดข้อมูล (SQL) | ความหมายและค่า Flag |
| :--- | :--- | :--- | :--- |
| Header | `schedule_type` | `VARCHAR(30)` | `'PREPAID_EXPENSE'` (จ่ายล่วงหน้า) หรือ `'DEFERRED_REVENUE'` (รับล่วงหน้า) |
| Header | `method` | `VARCHAR(25)` | วิธีตัดจำหน่าย: `'DAILY_ACT365'` (ตามวันจริงในเดือน) หรือ `'EQUAL_MONTH'` (เฉลี่ยเท่ากันทุกเดือน) |
| Header | `start_date`, `end_date`, `total_days`, `period_count` | `DATE`, `INTEGER` | ช่วงวันที่สัญญา, จำนวนวันรวม, จำนวนงวดเดือน |
| Header | `total_amount`, `posted_amount`, `remaining_amount` | `NUMERIC(18,2)` | ยอดรวมทั้งสัญญา, ยอดที่ตัดบัญชีแล้ว, ยอดคงเหลือ |
| Header | `asset_or_defer_account_code`, `pl_account_code` | `VARCHAR(25)` | รหัสบัญชีงบดุล (จ่าย/รับล่วงหน้า) และบัญชีงบกำไรขาดทุน (ค่าใช้จ่าย/รายได้) เชื่อม [[tbl-gl-chart-of-account]] |
| Header | `status` | `VARCHAR(25)` | `'ACTIVE'` (กำลังตัดบัญชี) หรือ `'COMPLETED'` (ตัดครบทุกงวดแล้ว) |
| Line | `period_month`, `slice_start_date`, `slice_end_date`, `days_in_slice` | `VARCHAR(7)`, `DATE`, `INTEGER` | งวด `YYYY-MM`, ช่วงวันที่ในงวด และจำนวนวันของงวดนั้น |
| Line | `amort_amount`, `accumulated_amount`, `remaining_balance` | `NUMERIC(18,2)` | ยอดตัดจำหน่ายประจำงวด, ยอดสะสม, ยอดคงเหลือหลังตัด |
| Line | `status`, `gl_doc_no`, `posted_at` | `VARCHAR(20)`, `VARCHAR(50)`, `TIMESTAMPTZ` | `'PENDING'` (รอ Post) หรือ `'POSTED'` (ลง GL แล้วที่ `gl_doc_no`) |

---

## 2. `gl_fx_revaluation` และ `gl_fx_revaluation_detail` — ปรับมูลค่าอัตราแลกเปลี่ยนสิ้นงวด (TAS 21)

- **วัตถุประสงค์**: คำนวณกำไร/ขาดทุนจากอัตราแลกเปลี่ยนที่ยังไม่เกิดขึ้นจริง (Unrealized FX Gain/Loss) ของลูกหนี้/เจ้าหนี้สกุลต่างประเทศ ณ วันสิ้นงวด (`as_of_date`) พร้อมตัวเลือกสร้างใบสำคัญกลับรายการต้นงวดถัดไป (`auto_reverse`)
- **Primary / Unique Key**:
  - `gl_fx_revaluation`: `roworder SERIAL PRIMARY KEY`, `doc_no VARCHAR(25) UNIQUE`
  - `gl_fx_revaluation_detail`: `roworder SERIAL PRIMARY KEY`, Index `idx_gl_fx_revaluation_detail_doc_no` ON `(doc_no)`

### คอลัมน์สำคัญ

| ตาราง | คอลัมน์ | ชนิดข้อมูล (SQL) | ความหมายและค่า Flag |
| :--- | :--- | :--- | :--- |
| Header | `doc_no`, `doc_date`, `as_of_date` | `VARCHAR(25)`, `DATE` | เลขที่เอกสาร, วันที่ทำรายการ, วันที่ปิดงวดที่ปรับมูลค่า |
| Header | `auto_reverse`, `reversal_date`, `reversal_doc_no` | `SMALLINT`, `DATE`, `VARCHAR(25)` | `1` = กลับรายการอัตโนมัติในวันต้นงวดถัดไป |
| Header | `journal_doc_no` | `VARCHAR(25)` | เลขที่ใบสำคัญที่ลง `gl_journal` ([[tbl-gl-journal]]) |
| Header | `gain_account_code`, `loss_account_code`, `ap_account_code`, `ar_account_code` | `VARCHAR(25)` | ผังบัญชีกำไร/ขาดทุน FX และบัญชีคุม AP/AR |
| Header | `total_gain_amount`, `total_loss_amount`, `net_fx_amount` | `NUMERIC(18,2)` | ยอดกำไร FX รวม, ขาดทุน FX รวม, ผลต่างสุทธิ |
| Header | `last_status` | `SMALLINT` | `0` = ปกติ, `1` = ยกเลิก |
| Detail | `party_type`, `cust_code`, `cust_name` | `VARCHAR` | ประเภทคู่ค้า (`AR`/`AP`), รหัสและชื่อคู่ค้า |
| Detail | `bill_doc_no`, `bill_doc_date`, `bill_trans_flag`, `currency_code` | `VARCHAR`/`DATE`/`SMALLINT` | บิลค้างรับ/ค้างจ่ายต้นทาง และรหัสสกุลเงินต่างประเทศ |
| Detail | `balance_fx_amount`, `book_rate`, `closing_rate` | `NUMERIC(18,2)` / `NUMERIC(18,6)` | ยอดค้างสกุลต่างประเทศ, เรตตามบัญชี, เรตปิดงวด |
| Detail | `book_thb_amount`, `revalued_thb_amount`, `gain_amount`, `loss_amount`, `fx_diff_amount` | `NUMERIC(18,2)` | มูลค่าบาทเดิม, มูลค่าบาทใหม่, กำไร/ขาดทุน/ผลต่าง |

---

## 3. `gl_corporate_tax_workpaper` — กระดาษทำการ ภ.ง.ด.50 และ ภ.ง.ด.51

- **วัตถุประสงค์**: เก็บการคำนวณภาษีเงินได้นิติบุคคลจากกำไรทางบัญชี ปรับปรุงบวกกลับรายจ่ายต้องห้ามมาตรา 65 ตรี ยกเว้นภาษี ผลขาดทุนยกมา อัตราภาษี SME (0% ≤300,000 / 15% 300,001–3,000,000 / 20% >3,000,000) และ Safe Harbor ภ.ง.ด.51
- **Primary Key**: `doc_no` (`VARCHAR(50)`)
- **คอลัมน์สำคัญ**: `form_type` (`'PND50'`/`'PND51'`), `tax_year`, `date_from`, `date_to`, `is_sme_rate` (`BOOLEAN`), `gl_actual_revenue`, `gl_actual_expense`, `effective_revenue`, `effective_expense`, `accounting_profit`, `auto_add_back_65_ter`, `manual_add_back_65_ter`, `tax_exempt_income`, `carried_forward_loss`, `net_taxable_profit`, `annual_cit_tax`, `form_cit_tax`, `wht_50_tawi_credit`, `half_year_pnd51_paid`, `net_tax_payable`, `prior_year_tax_paid`, `safe_harbor_half_tax` (`NUMERIC(18,2)`), `surcharge_20_pct_risk` (`TEXT`)

---

## 4. `gl_dbd_taxonomy_map` — ตาราง Map ผังบัญชีเข้ากับ DBD e-Filing Taxonomy

- **วัตถุประสงค์**: จับคู่รหัสบัญชีใน [[tbl-gl-chart-of-account]] เข้ากับรหัส Taxonomy XBRL ของกรมพัฒนาธุรกิจการค้า (DBD)
- **Primary Key**: `account_code` (`VARCHAR(25)`)
- **คอลัมน์สำคัญ**: `account_code`, `dbd_taxonomy_code` (`VARCHAR(30)`), `dbd_line_name_th` (`VARCHAR(255)`), `statement_type` (`'BS'` = งบแสดงฐานะการเงิน / `'PL'` = งบกำไรขาดทุน), `updated_by`

---

## 5. `gl_director_loan_ledger` — ทะเบียนคุมเงินกู้ยืมกรรมการและดอกเบี้ยขั้นต่ำ

- **วัตถุประสงค์**: คำนวณและติดตามสัญญาเงินให้กู้ยืมแก่กรรมการ (`AR_DIRECTOR`) และเงินกู้ยืมจากกรรมการ (`AP_DIRECTOR`) เทียบดอกเบี้ยตามสัญญากับดอกเบี้ยอ้างอิงตามประมวลรัษฎากร (กรณีคิดดอกเบี้ยต่ำกว่าตลาดต้องบวกกลับและคิดภาษีธุรกิจเฉพาะ 3.3% / ภ.ง.ด.2 หัก 15%)
- **Primary Key**: `loan_doc_no` (`VARCHAR(50)`)
- **คอลัมน์สำคัญ**:
  - `direction`: `'AR_DIRECTOR'` (บริษัทให้กรรมการกู้) หรือ `'AP_DIRECTOR'` (บริษัทกู้จากกรรมการ)
  - `funding_source`: `'INTERNAL_CASH'` (เงินหมุนเวียนภายใน) หรือ `'BANK_LOAN'` (กู้ธนาคารมาให้กู้อีกทอด)
  - `director_name`, `start_date`, `as_of_date`, `days_count`, `principal_amount` (`NUMERIC(18,2)`)
  - อัตราดอกเบี้ย (`NUMERIC(9,4)`): `contract_rate_pct`, `market_deposit_rate_pct`, `bank_borrowing_rate_pct`, `statutory_min_rate_pct`, `effective_tax_rate_pct`
  - ยอดดอกเบี้ยและภาษี (`NUMERIC(18,2)`): `contract_interest`, `statutory_min_interest`, `deemed_add_back_interest`, `sbt_33_amount`
  - การลงบัญชี: `interest_receivable_acct`, `interest_income_acct`, `gl_doc_no`, `legal_note`

---

## 6. `gl_foreign_tax_voucher` — เอกสารภาษีค่าบริการต่างประเทศ (ภ.พ.36 และ ภ.ง.ด.54)

- **วัตถุประสงค์**: คำนวณภาษีมูลค่าเพิ่มนำส่งเอง (ภ.พ.36) และภาษีหัก ณ ที่จ่ายต่างประเทศ (ภ.ง.ด.54 แบบหักไว้ `DEDUCT` หรือออกให้ตลอดไป `GROSS_UP`) สำหรับบริการต่างประเทศ (เช่น SaaS, โฆษณา, ลิขสิทธิ์) พร้อมติดตามใบเสร็จกรมสรรพากรเพื่อนำ VAT ภ.พ.36 มาเคลมเป็นภาษีซื้อ
- **Primary Key**: `doc_no` (`VARCHAR(50)`)
- **คอลัมน์สำคัญ**:
  - `doc_date`, `vendor_name`, `vendor_country`, `service_type` (เช่น `'SAAS'`), `foreign_currency`, `foreign_amount` (`NUMERIC(18,4)`), `exchange_rate` (`NUMERIC(18,6)`), `thb_base_amount` (`NUMERIC(18,2)`)
  - ภ.พ.36: `apply_pp36` (`BOOLEAN`), `pp36_vat_amount`, `pp36_due_date`
  - ภ.ง.ด.54: `apply_pnd54` (`BOOLEAN`), `pnd54_rate` (`NUMERIC(9,4)`), `pnd54_condition` (`'DEDUCT'` | `'GROSS_UP'`), `pnd54_wht_amount`
  - ยอดจ่ายและต้นทุน: `net_vendor_paid`, `total_company_cost` (`NUMERIC(18,2)`)
  - สถานะเคลมภาษีซื้อ ภ.พ.36: `vat_claim_status` (`'NONE'` | `'PENDING_RD_RECEIPT'` | `'CLAIMED'`), `rd_receipt_no`, `rd_receipt_date`, `gl_doc_no`, `vat_claim_gl_doc_no`, `expense_account_code`, `bank_account_code`, `vat_deferred_account_code`

---

## 7. ตัวอย่าง SQL Query

### ตัวอย่าง 1: ตรวจสอบงวดตัดจำหน่ายจ่ายล่วงหน้าที่ถึงกำหนด Post ในเดือนนี้
```sql
SELECT
    h.schedule_doc_no,
    h.schedule_type,
    h.title,
    l.line_no,
    l.period_month,
    l.slice_start_date,
    l.slice_end_date,
    l.amort_amount::NUMERIC(18,2) AS amort_amount,
    h.asset_or_defer_account_code,
    h.pl_account_code
FROM gl_prepaid_schedule h
JOIN gl_prepaid_schedule_line l
  ON l.schedule_doc_no = h.schedule_doc_no
WHERE h.status = 'ACTIVE'
  AND l.status = 'PENDING'
  AND l.period_month <= '2026-01'
ORDER BY l.period_month, h.schedule_doc_no, l.line_no;
```

### ตัวอย่าง 2: รายการบริการต่างประเทศที่จ่าย ภ.พ.36 แล้วแต่ยังรอใบเสร็จกรมสรรพากรเพื่อเคลม VAT
```sql
SELECT
    doc_no,
    doc_date,
    vendor_name,
    vendor_country,
    thb_base_amount::NUMERIC(18,2) AS thb_base_amount,
    pp36_vat_amount::NUMERIC(18,2) AS pp36_vat_amount,
    pp36_due_date,
    pnd54_wht_amount::NUMERIC(18,2) AS pnd54_wht_amount,
    vat_claim_status,
    gl_doc_no
FROM gl_foreign_tax_voucher
WHERE apply_pp36 = TRUE
  AND vat_claim_status = 'PENDING_RD_RECEIPT'
ORDER BY doc_date DESC;
```
