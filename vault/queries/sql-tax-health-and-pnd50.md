---
title: "SQL ตรวจสุขภาพภาษี (Tax Health) บริการต่างประเทศ (ภ.พ.36/ภ.ง.ด.54) และภาษีเงินได้นิติบุคคล (ภ.ง.ด.50/51)"
audience: "dev"
tags: [queries, sql, tax, tax_health, pp36, pnd54, pnd50, pnd51, audit]
aliases:
  - "sql ตรวจสุขภาพภาษี ใบกำกับภาษีซื้อซ้ำ ภาษีซื้อเกิน 6 เดือน"
  - "sql กระทบยอดบัญชีแยกประเภทเทียบรายงานภาษี"
  - "sql ภาษีบริการต่างประเทศ ภ.พ.36 ภ.ง.ด.54 gl_foreign_tax_voucher"
  - "sql คำนวณภาษีเงินได้นิติบุคคล ภ.ง.ด.50 ภ.ง.ด.51 มาตรา 65 ตรี"
sources:
  - "backend/internal/application/process/tax_health.go:320-1060"
  - "backend/internal/application/process/foreign_service_tax.go:433-530"
  - "backend/internal/application/process/corporate_tax_pnd50_51.go:204-405"
---

# SQL ตรวจสุขภาพภาษี (Tax Health) บริการต่างประเทศ (ภ.พ.36/ภ.ง.ด.54) และภาษีเงินได้นิติบุคคล (ภ.ง.ด.50/51)

รวมคำสั่ง SQL เชิงลึกสำหรับสอบทานความเสี่ยงทางภาษีก่อนปิดงบ: ตรวจใบกำกับภาษีซื้อซ้ำหรือขาดอายุเกิน 6 เดือน, กระทบยอด GL เทียบทะเบียนภาษี, ตรวจใบสำคัญจ่ายบริการต่างประเทศ (**ภ.พ.36** / **ภ.ง.ด.54**) และคำนวณกำไรสุทธิทางภาษีพร้อมบวกกลับรายจ่ายต้องห้ามมาตรา 65 ตรี สำหรับ **ภ.ง.ด.50 / ภ.ง.ด.51** (ดูรายงาน ภ.พ.30 ที่ [[sql-tax-vat-buy-sale-pp30]], หัก ณ ที่จ่ายที่ [[sql-tax-wht-pnd-register]] และกฎกลางที่ [[sql-overview]])

---

## 1. ตรวจหาใบกำกับภาษีซื้อซ้ำซ้อน และภาษีซื้อยื่นล่าช้าเกิน 6 เดือน (`tax_health.go`)

สกัดจาก `tax_health.go:320-520` ตรวจสอบ 2 ความเสี่ยงสำคัญใน `gl_journal_vat_buy`: (1) เลขที่ใบกำกับภาษีซื้อซ้ำในผู้ขายรายเดียวกัน และ (2) งวดเดือนที่นำมาขอคืนเกินกว่า 6 เดือนนับจากเดือนที่ระบุในใบกำกับภาษี:

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้นตรวจสอบ
- `$2` (`DATE`): วันที่สิ้นสุดตรวจสอบ

```sql
WITH active_vat_buy AS (
    SELECT
        v.doc_no,
        v.trans_flag,
        v.vat_date,
        UPPER(BTRIM(COALESCE(v.vat_doc_no, ''))) AS norm_vat_doc_no,
        COALESCE(v.ap_code, '') AS ap_code,
        COALESCE(v.ap_name, '') AS ap_name,
        COALESCE(v.vat_amount, 0)::numeric(18, 2) AS vat_amount,
        (
            CASE
                WHEN COALESCE(v.vat_effective_year, 0) > 2400 THEN v.vat_effective_year - 543
                WHEN COALESCE(v.vat_effective_year, 0) > 0 THEN v.vat_effective_year
                ELSE EXTRACT(YEAR FROM v.vat_date)::int
            END
        ) AS eff_year_ad,
        COALESCE(NULLIF(v.vat_effective_period, 0), EXTRACT(MONTH FROM v.vat_date)::int) AS eff_month
    FROM gl_journal_vat_buy v
    WHERE COALESCE(v.vat_type, 0) = 0
      AND COALESCE(v.vat_calc, 1) <> 0
      AND v.vat_date BETWEEN $1::date AND $2::date
      AND COALESCE(BTRIM(v.vat_doc_no), '') <> ''
      AND NOT EXISTS (
          SELECT 1 FROM ic_trans i
          WHERE i.doc_no = v.doc_no AND i.trans_flag = v.trans_flag AND COALESCE(i.last_status, 0) <> 0
      )
      AND NOT EXISTS (
          SELECT 1 FROM ap_ar_trans a
          WHERE a.doc_no = v.doc_no AND a.trans_flag = v.trans_flag AND COALESCE(a.last_status, 0) <> 0
      )
),
dup_keys AS (
    SELECT ap_code, norm_vat_doc_no
    FROM active_vat_buy
    GROUP BY ap_code, norm_vat_doc_no
    HAVING COUNT(*) > 1
)
SELECT
    'DUPLICATE_INPUT_VAT'::text AS risk_code,
    b.doc_no,
    b.vat_date,
    b.norm_vat_doc_no AS tax_invoice_no,
    b.ap_code,
    b.ap_name,
    (b.eff_year_ad::text || '-' || LPAD(b.eff_month::text, 2, '0')) AS claimed_period,
    ROUND(b.vat_amount, 2) AS vat_amount
FROM active_vat_buy b
JOIN dup_keys dk
  ON dk.ap_code = b.ap_code AND dk.norm_vat_doc_no = b.norm_vat_doc_no

UNION ALL

SELECT
    'EXPIRED_OVER_6_MONTHS'::text AS risk_code,
    b.doc_no,
    b.vat_date,
    b.norm_vat_doc_no AS tax_invoice_no,
    b.ap_code,
    b.ap_name,
    (b.eff_year_ad::text || '-' || LPAD(b.eff_month::text, 2, '0')) AS claimed_period,
    ROUND(b.vat_amount, 2) AS vat_amount
FROM active_vat_buy b
WHERE ((b.eff_year_ad * 12 + b.eff_month) - (EXTRACT(YEAR FROM b.vat_date)::int * 12 + EXTRACT(MONTH FROM b.vat_date)::int)) >= 6
ORDER BY risk_code ASC, vat_date ASC, tax_invoice_no ASC;
```

---

## 2. กระทบยอดบัญชีแยกประเภท (GL) เทียบทะเบียนภาษีขาย-ภาษีซื้อ (`tax_health.go`)

สกัดจาก `tax_health.go:560-714` ตรวจผลต่างระหว่างยอดเคลื่อนไหวใน `gl_journal_detail` ของบัญชีภาษีขาย (`2121-00`) และภาษีซื้อ (`1151-00`) เทียบกับทะเบียนภาษีจริงในงวดเดียวกัน:

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้นเดือนภาษี (เช่น `'2026-11-01'`)
- `$2` (`DATE`): วันที่สิ้นสุดเดือนภาษี (เช่น `'2026-11-30'`)

```sql
WITH gl_vat AS (
    SELECT
        COALESCE(SUM(COALESCE(d.credit, 0) - COALESCE(d.debit, 0)) FILTER (WHERE d.account_code = '2121-00' AND d.trans_flag <> 0), 0)::numeric(18, 2) AS gl_output_vat,
        COALESCE(SUM(COALESCE(d.debit, 0) - COALESCE(d.credit, 0)) FILTER (WHERE d.account_code = '1151-00' AND d.trans_flag <> 0), 0)::numeric(18, 2) AS gl_input_vat
    FROM gl_journal_detail d
    WHERE COALESCE(d.is_pass, 0) IN (0, 1)
      AND d.doc_date BETWEEN $1::date AND $2::date
),
reg_sale AS (
    SELECT
        COALESCE(SUM(COALESCE(v.amount, 0) * CASE WHEN v.trans_flag IN (48, 97, 103, 252) THEN -1 ELSE 1 END), 0)::numeric(18, 2) AS reg_output_vat
    FROM gl_journal_vat_sale v
    WHERE COALESCE(v.vat_type, 0) = 0
      AND v.vat_date BETWEEN $1::date AND $2::date
      AND NOT EXISTS (SELECT 1 FROM ic_trans i WHERE i.doc_no = v.doc_no AND i.trans_flag = v.trans_flag AND COALESCE(i.last_status, 0) <> 0)
      AND NOT EXISTS (SELECT 1 FROM ap_ar_trans a WHERE a.doc_no = v.doc_no AND a.trans_flag = v.trans_flag AND COALESCE(a.last_status, 0) <> 0)
),
reg_buy AS (
    SELECT
        COALESCE(SUM(COALESCE(v.vat_amount, 0) * CASE WHEN v.trans_flag IN (16, 85, 91, 262, 317) THEN -1 ELSE 1 END), 0)::numeric(18, 2) AS reg_input_vat
    FROM gl_journal_vat_buy v
    WHERE COALESCE(v.vat_type, 0) = 0
      AND v.vat_date BETWEEN $1::date AND $2::date
      AND NOT EXISTS (SELECT 1 FROM ic_trans i WHERE i.doc_no = v.doc_no AND i.trans_flag = v.trans_flag AND COALESCE(i.last_status, 0) <> 0)
      AND NOT EXISTS (SELECT 1 FROM ap_ar_trans a WHERE a.doc_no = v.doc_no AND a.trans_flag = v.trans_flag AND COALESCE(a.last_status, 0) <> 0)
)
SELECT
    ROUND(g.gl_output_vat, 2) AS gl_2121_output_vat,
    ROUND(s.reg_output_vat, 2) AS register_output_vat,
    ROUND(g.gl_output_vat - s.reg_output_vat, 2) AS output_vat_variance,
    ROUND(g.gl_input_vat, 2) AS gl_1151_input_vat,
    ROUND(b.reg_input_vat, 2) AS register_input_vat,
    ROUND(g.gl_input_vat - b.reg_input_vat, 2) AS input_vat_variance
FROM gl_vat g
CROSS JOIN reg_sale s
CROSS JOIN reg_buy b;
```

---

## 3. ทะเบียนใบสำคัญจ่ายค่าบริการต่างประเทศ ภ.พ.36 และ ภ.ง.ด.54 (`gl_foreign_tax_voucher`)

สกัดจาก `foreign_service_tax.go:433-530` ตรวจสอบรายการจ่ายค่าบริการ/ลิขสิทธิ์ไปต่างประเทศ (เช่น โฆษณาออนไลน์, Cloud, SaaS) และสถานะการนำใบเสร็จกรมสรรพากร (`rd_receipt_no`) จากการยื่น ภ.พ.36 มาขอคืนเป็นภาษีซื้อ:

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้นจ่ายเงิน
- `$2` (`DATE`): วันที่สิ้นสุดจ่ายเงิน

```sql
SELECT
    v.doc_date,
    v.doc_no,
    COALESCE(v.vendor_name, '') AS foreign_vendor_name,
    COALESCE(v.vendor_country, '') AS vendor_country,
    COALESCE(v.service_type, '') AS service_type,
    COALESCE(v.foreign_currency, 'USD') AS foreign_currency,
    ROUND(COALESCE(v.foreign_amount, 0), 2) AS foreign_amount,
    ROUND(COALESCE(v.exchange_rate, 0), 6) AS exchange_rate,
    ROUND(COALESCE(v.thb_base_amount, 0), 2) AS thb_base_amount,
    COALESCE(v.apply_pp36, false) AS apply_pp36,
    ROUND(COALESCE(v.pp36_vat_amount, 0), 2) AS pp36_vat_amount,
    v.pp36_due_date,
    COALESCE(v.vat_claim_status, 'PENDING') AS pp36_input_vat_claim_status,
    COALESCE(v.rd_receipt_no, '') AS rd_receipt_no,
    COALESCE(v.apply_pnd54, false) AS apply_pnd54,
    ROUND(COALESCE(v.pnd54_rate, 0), 2) AS pnd54_rate_pct,
    ROUND(COALESCE(v.pnd54_wht_amount, 0), 2) AS pnd54_wht_amount
FROM gl_foreign_tax_voucher v
WHERE v.doc_date BETWEEN $1::date AND $2::date
ORDER BY v.doc_date ASC, v.doc_no ASC;
```

---

## 4. คำนวณกำไรทางบัญชีและบวกกลับรายจ่ายต้องห้าม ม.65 ตรี สำหรับ ภ.ง.ด.50 / ภ.ง.ด.51 (`corporate_tax_pnd50_51.go`)

สกัดจาก `corporate_tax_pnd50_51.go:204-405` ดึงกำไรสุทธิทางบัญชีจากแยกประเภท (`account_type IN (3, 4)` ตัดรายการปิดงวด `journal_type <> 2`) บวกกลับรายจ่ายต้องห้ามจากใบเบิกค่าใช้จ่าย/สลิป (`cb_expense_claim.forbidden_add_back_amount`) และส่วนเกินค่าเช่าซื้อรถยนต์นั่ง (`fa_hire_purchase_installment.add_back_65ter_amt`):

### พารามิเตอร์
- `$1` (`DATE`): วันเริ่มรอบระยะเวลาบัญชี (เช่น `'2026-01-01'`)
- `$2` (`DATE`): วันสิ้นรอบระยะเวลาบัญชี (เช่น `'2026-12-31'`)

```sql
WITH gl_profit AS (
    SELECT
        COALESCE(SUM(COALESCE(d.credit, 0) - COALESCE(d.debit, 0)) FILTER (WHERE c.account_type = 3), 0)::numeric(18, 2) AS total_revenue,
        COALESCE(SUM(COALESCE(d.debit, 0) - COALESCE(d.credit, 0)) FILTER (WHERE c.account_type = 4), 0)::numeric(18, 2) AS total_expense
    FROM gl_journal_detail d
    JOIN gl_chart_of_account c ON c.code = d.account_code
    WHERE c.account_type IN (3, 4)
      AND COALESCE(d.is_pass, 0) IN (0, 1)
      AND COALESCE(d.journal_type, 0) <> 2
      AND d.doc_date BETWEEN $1::date AND $2::date
),
expense_addback AS (
    SELECT
        COALESCE(SUM(COALESCE(e.forbidden_add_back_amount, 0)), 0)::numeric(18, 2) AS slip_addback_65ter
    FROM cb_expense_claim e
    WHERE e.doc_date BETWEEN $1::date AND $2::date
      AND COALESCE(e.status, '') NOT IN ('CANCELLED', 'REJECTED')
),
hp_addback AS (
    SELECT
        COALESCE(SUM(COALESCE(i.add_back_65ter_amt, 0)), 0)::numeric(18, 2) AS vehicle_addback_65ter
    FROM fa_hire_purchase_installment i
    WHERE i.due_date BETWEEN $1::date AND $2::date
      AND COALESCE(i.status, '') = 'POSTED'
)
SELECT
    ROUND(g.total_revenue, 2) AS accounting_revenue,
    ROUND(g.total_expense, 2) AS accounting_expense,
    ROUND(g.total_revenue - g.total_expense, 2) AS accounting_net_profit,
    ROUND(ea.slip_addback_65ter, 2) AS addback_expense_claims_65ter,
    ROUND(ha.vehicle_addback_65ter, 2) AS addback_passenger_car_65ter,
    ROUND(
        (g.total_revenue - g.total_expense) + ea.slip_addback_65ter + ha.vehicle_addback_65ter,
        2
    ) AS estimated_taxable_net_profit
FROM gl_profit g
CROSS JOIN expense_addback ea
CROSS JOIN hp_addback ha;
```

---

## 5. ข้อควรระวัง (Gotchas)
- **รายการปิดภาษีปลายเดือนใน GL (`trans_flag = 0` สมุดรายวันทั่วไป)**: ในคำสั่งที่ 2 (`GL_VS_TAX_TIEOUT`) มีการกรอง `d.trans_flag <> 0` เพื่อตัดใบสำคัญปิดภาษีซื้อ-ภาษีขายเข้าบัญชีเจ้าหนี้กรมสรรพากร (`2123-00`) ตอนสิ้นเดือนออก มิฉะนั้นยอดเคลื่อนไหวของ `2121-00` และ `1151-00` ในเดือนที่ทำใบสำคัญปิดภาษีแล้วจะหักล้างกันเหลือศูนย์
- **การขอคืนภาษีซื้อจาก ภ.พ.36**: ภาษีมูลค่าเพิ่มที่นำส่งตามแบบ ภ.พ.36 จะถือเป็นภาษีซื้อขอคืนได้ในเดือนที่มี**ใบเสร็จรับเงินของกรมสรรพากร (`rd_receipt_no`)** เท่านั้น ไม่ใช่วันที่จ่ายเงินไปต่างประเทศ
