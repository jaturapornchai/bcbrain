---
title: คลังคำสั่ง SQL กระทบยอด Subledger vs GL, Marketplace Settlement, เงินเดือน ม.33, ประวัติพิมพ์ซ้ำ และสมุดเงินฝาก
tags: [queries, sql, subledger, marketplace, payroll, print-audit, book-bank, numeric]
aliases: [SQL กระทบยอดบัญชีย่อย, SQL ar_marketplace_settlement, SQL erp_payroll_run, SQL erp_print_audit_log, SQL cb_book_bank]
sources:
  - backend/internal/application/process/subledger_reconcile.go:1-492
  - backend/internal/application/process/marketplace_reconcile.go:1-1444
  - backend/internal/application/process/payroll_sso_pnd1.go:1-1177
  - backend/internal/application/process/print_audit.go:1-2071
  - scripts/sql/02_data_schema.sql:2080-2096
---

# คลังคำสั่ง SQL กระทบยอด Subledger vs GL, Marketplace Settlement, เงินเดือน ม.33, ประวัติพิมพ์ซ้ำ และสมุดเงินฝาก

ชุดคำสั่ง PostgreSQL `SELECT` / `WITH` แบบอ่านอย่างเดียว ใช้ชนิด `NUMERIC` ทุกจุดและกรอง `COALESCE(last_status, 0) = 0` ตามกฎเหล็กบัญชี

---

## 1. สรุปกระทบยอดขายร้านค้าออนไลน์ Shopee / Lazada / TikTok Shop (`ar_marketplace_settlement`)

พารามิเตอร์: `$1` = วันเริ่มต้น (`DATE`), `$2` = วันสิ้นสุด (`DATE`)

```sql
SELECT
  platform,
  COUNT(*) AS batch_count,
  SUM(COALESCE(order_count, 0)) AS total_orders,
  ROUND(SUM(COALESCE(gross_sales, 0)::NUMERIC), 2) AS gross_sales,
  ROUND(SUM(COALESCE(total_fees, 0)::NUMERIC), 2) AS total_fees,
  ROUND(SUM(COALESCE(expected_payout, 0)::NUMERIC), 2) AS expected_payout,
  ROUND(SUM(COALESCE(actual_payout, 0)::NUMERIC), 2) AS actual_payout,
  ROUND(SUM((COALESCE(actual_payout, 0) - COALESCE(expected_payout, 0))::NUMERIC), 2) AS payout_diff
FROM ar_marketplace_settlement
WHERE settlement_date BETWEEN $1 AND $2
GROUP BY platform
ORDER BY gross_sales DESC;
```

---

## 2. สรุปงวดเงินเดือน ประกันสังคม ม.33 และภาษี ภ.ง.ด.1 (`erp_payroll_run`)

พารามิเตอร์: `$1` = ปี ค.ศ. ของงวด เช่น `'2026-%'`

```sql
SELECT
  period_ym,
  doc_no,
  pay_date,
  employee_count,
  ROUND(COALESCE(total_gross_pay, 0)::NUMERIC, 2) AS gross_pay,
  ROUND(COALESCE(total_emp_sso, 0)::NUMERIC, 2) AS emp_sso,
  ROUND(COALESCE(total_employer_sso, 0)::NUMERIC, 2) AS employer_sso,
  ROUND(COALESCE(total_pnd1_tax, 0)::NUMERIC, 2) AS pnd1_tax,
  ROUND(COALESCE(total_net_pay, 0)::NUMERIC, 2) AS net_pay,
  gl_doc_no
FROM erp_payroll_run
WHERE period_ym LIKE $1
  AND COALESCE(last_status, 0) = 0
ORDER BY period_ym DESC, doc_no DESC;
```

---

## 3. ตรวจสอบเอกสารที่มีการพิมพ์ต้นฉบับซ้ำหรือแก้ไขหลังพิมพ์ (`erp_print_audit_log`)

พารามิเตอร์: `$1` = วันเริ่มต้น (`TIMESTAMPTZ`), `$2` = จำนวนแถวสูงสุด (`INTEGER`)

```sql
WITH doc_prints AS (
  SELECT
    doc_kind,
    trans_flag,
    doc_no,
    COUNT(*) FILTER (WHERE copy_mode = 'original') AS original_prints,
    COUNT(*) AS total_prints,
    MIN(total_amount::NUMERIC(18,2)) AS min_printed_amount,
    MAX(total_amount::NUMERIC(18,2)) AS max_printed_amount,
    MAX(printed_at) AS last_printed_at
  FROM erp_print_audit_log
  WHERE printed_at >= $1
  GROUP BY doc_kind, trans_flag, doc_no
)
SELECT
  doc_kind,
  trans_flag,
  doc_no,
  original_prints,
  total_prints,
  min_printed_amount,
  max_printed_amount,
  (max_printed_amount - min_printed_amount) AS printed_amount_spread,
  last_printed_at
FROM doc_prints
WHERE original_prints > 1
   OR max_printed_amount <> min_printed_amount
ORDER BY last_printed_at DESC
LIMIT $2;
```

---

## 4. รายชื่อสมุดบัญชีเงินฝากธนาคารพร้อมรหัสผังบัญชีแยกประเภท (`cb_book_bank`, `cb_bank`)

```sql
SELECT
  b.code AS book_code,
  b.book_number,
  b.name_1 AS book_name,
  b.book_type,
  bk.code AS bank_code,
  bk.name_1 AS bank_name,
  b.bank_branch,
  b.account_code_1 AS gl_account_code,
  COALESCE(b.currency_code, 'THB') AS currency_code
FROM cb_book_bank b
LEFT JOIN cb_bank bk ON bk.code = b.bank_code
WHERE COALESCE(b.status, 0) = 0
ORDER BY b.code;
```

---

## 5. ตรวจสอบกฎวางบิลลูกหนี้อัตโนมัติที่เปิดใช้งาน (`ar_auto_bill_rule`, `ar_customer`)

```sql
SELECT
  r.cust_code,
  c.name_1 AS customer_name,
  r.schedule_mode,
  r.month_days,
  r.weekday_num,
  r.week_ordinals,
  ROUND(COALESCE(r.min_bill_amount, 0)::NUMERIC, 2) AS min_bill_amount,
  ROUND(COALESCE(r.wht_rate, 0)::NUMERIC, 2) AS wht_rate,
  r.promptpay_id,
  r.contact_channel
FROM ar_auto_bill_rule r
LEFT JOIN ar_customer c ON c.code = r.cust_code
WHERE COALESCE(r.active_status, 1) = 1
ORDER BY r.cust_code;
```

---

## ดูต่อที่เกี่ยวข้อง
- [[uses_table::tbl-cb-bank-book-master]] · [[uses_table::tbl-auto-bill-and-print-audit]] · [[uses_table::tbl-ar-contract-marketplace]] · [[uses_table::tbl-gl-advanced]]
- [[posts_rule::doc-marketplace-payroll-dbd-evrt]] · [[posts_rule::doc-price-engine-ref-import-calc]]
