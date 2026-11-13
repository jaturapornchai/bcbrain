---
title: "SQL รายงานภาษีขาย-ภาษีซื้อ (ภ.พ.30) บิลยกเลิกยอดศูนย์ และภาษีบริการยังไม่ถึงกำหนด (ม.78/1)"
audience: "dev"
tags: [queries, sql, tax, vat, pp30, gl_journal_vat_sale, gl_journal_vat_buy, deferred_vat]
aliases:
  - "sql รายงานภาษีขาย รายงานภาษีซื้อ ภ.พ.30"
  - "sql คำนวณภาษีมูลค่าเพิ่มประจำเดือน pp30"
  - "sql ภาษีขายยังไม่ถึงกำหนด ภาษีซื้อยังไม่ถึงกำหนด มาตรา 78/1"
  - "gl_journal_vat_sale gl_journal_vat_buy"
sources:
  - "backend/internal/application/process/report_menu_gl_fa.go:1021-1153"
  - "backend/internal/application/process/tax_health.go:122-260"
  - "backend/internal/application/process/tax_health.go:715-865"
  - "backend/internal/adapter/inbound/http/mcp/gateway.go:2136-2154"
---

# SQL รายงานภาษีขาย-ภาษีซื้อ (ภ.พ.30) บิลยกเลิกยอดศูนย์ และภาษีบริการยังไม่ถึงกำหนด (ม.78/1)

รวมคำสั่ง SQL มาตรฐานสำหรับจัดทำรายงานภาษีขาย (`gl_journal_vat_sale`), รายงานภาษีซื้อ (`gl_journal_vat_buy`), สรุปยอดยื่นแบบ **ภ.พ.30** ประจำเดือน และการตรวจสอบภาษีมูลค่าเพิ่มธุรกิจบริการที่ยังไม่ถึงกำหนดชำระตามมาตรา 78/1 (ดูผลกระทบทางภาษีของแต่ละเอกสารที่ [[doc-impact-tax-vat-wht]], การตรวจสุขภาพภาษีที่ [[sql-tax-health-and-pnd50]] และกฎกลางที่ [[sql-overview]])

---

## 1. รายงานภาษีขายตามแบบกรมสรรพากร (`gl_journal_vat_sale`) พร้อมคงบรรทัดบิลยกเลิกยอด `0.00`

สกัดจาก `report_menu_gl_fa.go:1021-1086` รองรับการแปลงปี `vat_effective_year` ทั้ง พ.ศ. และ ค.ศ., กรองเฉพาะภาษีขายถึงกำหนด (`COALESCE(v.vat_type, 0) = 0`), แสดงแถวใบกำกับภาษีที่ยกเลิกด้วยยอด `0.00` เพื่อให้เลขลำดับใบกำกับต่อเนื่อง และกลับเครื่องหมายใบลดหนี้ (`48, 97, 103, 252`) เป็นค่าติดลบ:

### พารามิเตอร์
- `$1` (`INT`): ปีภาษี ค.ศ. (เช่น `2026`)
- `$2` (`INT`): เดือนภาษี `1`–`12` (เช่น `11`)

```sql
WITH vat_sale_enriched AS (
    SELECT
        v.vat_date,
        COALESCE(v.vat_doc_no, v.doc_no, '') AS tax_invoice_no,
        v.doc_no AS source_doc_no,
        v.trans_flag,
        COALESCE(v.ar_code, '') AS customer_code,
        COALESCE(v.ar_name, '') AS customer_name,
        COALESCE(v.tax_id, '') AS tax_id,
        COALESCE(v.branch_type, 0) AS branch_type,
        COALESCE(v.branch_code, '00000') AS customer_branch_code,
        CASE WHEN v.trans_flag IN (48, 97, 103, 252) THEN -1 ELSE 1 END AS cn_sign,
        (
            EXISTS (SELECT 1 FROM ic_trans i WHERE i.doc_no = v.doc_no AND i.trans_flag = v.trans_flag AND COALESCE(i.last_status, 0) <> 0)
            OR EXISTS (SELECT 1 FROM ap_ar_trans a WHERE a.doc_no = v.doc_no AND a.trans_flag = v.trans_flag AND COALESCE(a.last_status, 0) <> 0)
            OR EXISTS (SELECT 1 FROM as_trans s WHERE s.doc_no = v.doc_no AND s.trans_flag = v.trans_flag AND COALESCE(s.last_status, 0) <> 0)
        ) AS is_cancelled,
        COALESCE(NULLIF(v.base_caltax, 0), v.except_amount_1, 0)::numeric(18, 2) AS raw_taxable_base,
        COALESCE(v.amount, 0)::numeric(18, 2) AS raw_vat_amount,
        COALESCE(v.except_amount_2, 0)::numeric(18, 2) AS raw_exempt_amount
    FROM gl_journal_vat_sale v
    WHERE COALESCE(v.vat_type, 0) = 0
      AND COALESCE(v.vat_calc, 1) <> 0
      AND (
          CASE
              WHEN COALESCE(v.vat_effective_year, 0) > 2400 THEN v.vat_effective_year - 543
              WHEN COALESCE(v.vat_effective_year, 0) > 0 THEN v.vat_effective_year
              ELSE EXTRACT(YEAR FROM v.vat_date)::int
          END
      ) = $1::int
      AND COALESCE(NULLIF(v.vat_effective_period, 0), EXTRACT(MONTH FROM v.vat_date)::int) = $2::int
)
SELECT
    vat_date,
    tax_invoice_no,
    source_doc_no,
    trans_flag,
    CASE WHEN is_cancelled THEN 'ยกเลิก' ELSE customer_name END AS customer_display_name,
    tax_id,
    CASE WHEN branch_type = 0 OR customer_branch_code IN ('', '00000') THEN 'สำนักงานใหญ่' ELSE customer_branch_code END AS branch_display,
    CASE WHEN is_cancelled THEN 'ยกเลิก' ELSE 'ปกติ' END AS doc_status,
    ROUND(CASE WHEN is_cancelled THEN 0 ELSE raw_taxable_base * cn_sign END, 2) AS taxable_base_amount,
    ROUND(CASE WHEN is_cancelled THEN 0 ELSE raw_vat_amount * cn_sign END, 2) AS output_vat_amount,
    ROUND(CASE WHEN is_cancelled THEN 0 ELSE raw_exempt_amount * cn_sign END, 2) AS exempt_amount
FROM vat_sale_enriched
ORDER BY vat_date ASC, tax_invoice_no ASC, source_doc_no ASC;
```

---

## 2. รายงานภาษีซื้อขอคืนได้ตามแบบกรมสรรพากร (`gl_journal_vat_buy`)

สกัดจาก `report_menu_gl_fa.go:1087-1153` กรองภาษีซื้อขอคืนได้ (`COALESCE(v.vat_type, 0) = 0`), ตัดเอกสารต้นทางที่ถูกยกเลิก และกลับเครื่องหมายใบลดหนี้ซื้อ (`16, 85, 91, 262, 317`) เป็นค่าติดลบ:

### พารามิเตอร์
- `$1` (`INT`): ปีภาษี ค.ศ. (เช่น `2026`)
- `$2` (`INT`): เดือนภาษี `1`–`12` (เช่น `11`)

```sql
SELECT
    v.vat_date,
    COALESCE(v.vat_doc_no, '') AS supplier_tax_invoice_no,
    v.doc_no AS internal_doc_no,
    v.trans_flag,
    COALESCE(v.ap_code, '') AS supplier_code,
    COALESCE(v.ap_name, '') AS supplier_name,
    COALESCE(v.tax_id, '') AS tax_id,
    CASE WHEN COALESCE(v.branch_type, 0) = 0 OR COALESCE(v.branch_code, '00000') IN ('', '00000')
         THEN 'สำนักงานใหญ่'
         ELSE v.branch_code
    END AS branch_display,
    ROUND(
        COALESCE(v.base_amount, 0) * CASE WHEN v.trans_flag IN (16, 85, 91, 262, 317) THEN -1 ELSE 1 END,
        2
    ) AS taxable_base_amount,
    ROUND(
        COALESCE(v.vat_amount, 0) * CASE WHEN v.trans_flag IN (16, 85, 91, 262, 317) THEN -1 ELSE 1 END,
        2
    ) AS claimable_input_vat_amount,
    ROUND(
        COALESCE(v.except_vat, 0) * CASE WHEN v.trans_flag IN (16, 85, 91, 262, 317) THEN -1 ELSE 1 END,
        2
    ) AS exempt_amount
FROM gl_journal_vat_buy v
WHERE COALESCE(v.vat_type, 0) = 0
  AND COALESCE(v.vat_calc, 1) <> 0
  AND (
      CASE
          WHEN COALESCE(v.vat_effective_year, 0) > 2400 THEN v.vat_effective_year - 543
          WHEN COALESCE(v.vat_effective_year, 0) > 0 THEN v.vat_effective_year
          ELSE EXTRACT(YEAR FROM v.vat_date)::int
      END
  ) = $1::int
  AND COALESCE(NULLIF(v.vat_effective_period, 0), EXTRACT(MONTH FROM v.vat_date)::int) = $2::int
  AND NOT EXISTS (
      SELECT 1 FROM ic_trans i
      WHERE i.doc_no = v.doc_no AND i.trans_flag = v.trans_flag AND COALESCE(i.last_status, 0) <> 0
  )
  AND NOT EXISTS (
      SELECT 1 FROM ap_ar_trans a
      WHERE a.doc_no = v.doc_no AND a.trans_flag = v.trans_flag AND COALESCE(a.last_status, 0) <> 0
  )
ORDER BY v.vat_date ASC, v.vat_doc_no ASC, v.doc_no ASC;
```

---

## 3. สรุปยอดยื่นแบบ ภ.พ.30 ประจำเดือน (Monthly PP.30 Calculation Summary)

สกัดจาก `tax_health.go:122-260` และ `gateway.go:2136-2154` คำนวณภาษีขายสุทธิ หักภาษีซื้อขอคืนได้สุทธิ เพื่อหาภาษีที่ต้องชำระเพิ่มเติม (`> 0`) หรือภาษีชำระเกินยกไป (`< 0`):

### พารามิเตอร์
- `$1` (`INT`): ปีภาษี ค.ศ. (เช่น `2026`)
- `$2` (`INT`): เดือนภาษี `1`–`12` (เช่น `11`)

```sql
WITH sale_agg AS (
    SELECT
        COALESCE(SUM(COALESCE(NULLIF(v.base_caltax, 0), v.except_amount_1, 0) * CASE WHEN v.trans_flag IN (48, 97, 103, 252) THEN -1 ELSE 1 END), 0)::numeric(18, 2) AS sale_taxable_base,
        COALESCE(SUM(COALESCE(v.except_amount_2, 0) * CASE WHEN v.trans_flag IN (48, 97, 103, 252) THEN -1 ELSE 1 END), 0)::numeric(18, 2) AS sale_exempt_base,
        COALESCE(SUM(COALESCE(v.amount, 0) * CASE WHEN v.trans_flag IN (48, 97, 103, 252) THEN -1 ELSE 1 END), 0)::numeric(18, 2) AS output_vat
    FROM gl_journal_vat_sale v
    WHERE COALESCE(v.vat_type, 0) = 0
      AND COALESCE(v.vat_calc, 1) <> 0
      AND (CASE WHEN COALESCE(v.vat_effective_year, 0) > 2400 THEN v.vat_effective_year - 543 WHEN COALESCE(v.vat_effective_year, 0) > 0 THEN v.vat_effective_year ELSE EXTRACT(YEAR FROM v.vat_date)::int END) = $1::int
      AND COALESCE(NULLIF(v.vat_effective_period, 0), EXTRACT(MONTH FROM v.vat_date)::int) = $2::int
      AND NOT EXISTS (SELECT 1 FROM ic_trans i WHERE i.doc_no = v.doc_no AND i.trans_flag = v.trans_flag AND COALESCE(i.last_status, 0) <> 0)
      AND NOT EXISTS (SELECT 1 FROM ap_ar_trans a WHERE a.doc_no = v.doc_no AND a.trans_flag = v.trans_flag AND COALESCE(a.last_status, 0) <> 0)
      AND NOT EXISTS (SELECT 1 FROM as_trans s WHERE s.doc_no = v.doc_no AND s.trans_flag = v.trans_flag AND COALESCE(s.last_status, 0) <> 0)
),
buy_agg AS (
    SELECT
        COALESCE(SUM(COALESCE(v.base_amount, 0) * CASE WHEN v.trans_flag IN (16, 85, 91, 262, 317) THEN -1 ELSE 1 END), 0)::numeric(18, 2) AS buy_taxable_base,
        COALESCE(SUM(COALESCE(v.vat_amount, 0) * CASE WHEN v.trans_flag IN (16, 85, 91, 262, 317) THEN -1 ELSE 1 END), 0)::numeric(18, 2) AS input_vat
    FROM gl_journal_vat_buy v
    WHERE COALESCE(v.vat_type, 0) = 0
      AND COALESCE(v.vat_calc, 1) <> 0
      AND (CASE WHEN COALESCE(v.vat_effective_year, 0) > 2400 THEN v.vat_effective_year - 543 WHEN COALESCE(v.vat_effective_year, 0) > 0 THEN v.vat_effective_year ELSE EXTRACT(YEAR FROM v.vat_date)::int END) = $1::int
      AND COALESCE(NULLIF(v.vat_effective_period, 0), EXTRACT(MONTH FROM v.vat_date)::int) = $2::int
      AND NOT EXISTS (SELECT 1 FROM ic_trans i WHERE i.doc_no = v.doc_no AND i.trans_flag = v.trans_flag AND COALESCE(i.last_status, 0) <> 0)
      AND NOT EXISTS (SELECT 1 FROM ap_ar_trans a WHERE a.doc_no = v.doc_no AND a.trans_flag = v.trans_flag AND COALESCE(a.last_status, 0) <> 0)
)
SELECT
    $1::int AS tax_year_ad,
    $2::int AS tax_month,
    ROUND(s.sale_taxable_base, 2) AS pp30_line1_taxable_sales,
    ROUND(s.sale_exempt_base, 2) AS pp30_line3_exempt_sales,
    ROUND(s.output_vat, 2) AS pp30_line4_output_vat,
    ROUND(b.buy_taxable_base, 2) AS pp30_line6_taxable_purchases,
    ROUND(b.input_vat, 2) AS pp30_line7_claimable_input_vat,
    ROUND(GREATEST(s.output_vat - b.input_vat, 0), 2) AS pp30_net_vat_payable,
    ROUND(GREATEST(b.input_vat - s.output_vat, 0), 2) AS pp30_excess_vat_carryforward
FROM sale_agg s
CROSS JOIN buy_agg b;
```

---

## 4. ตรวจสอบภาษีขายและภาษีซื้อบริการที่ยังไม่ถึงกำหนดชำระ (มาตรา 78/1 — `tax_health.go`)

สกัดจาก `tax_health.go:715-865` ตรวจสอบรายการตั้งพักภาษีขายยังไม่ถึงกำหนด (`gl_journal_vat_sale.vat_type = 1`, ผังบัญชี `2121-01`) และภาษีซื้อยังไม่ถึงกำหนด (`gl_journal_vat_buy.vat_type = 2`, ผังบัญชี `1154-01`) ที่ยังไม่ได้รับชำระเงิน (`239`) หรือจ่ายชำระเงิน (`19, 315`):

```sql
WITH open_deferred_sale AS (
    SELECT
        'DEFERRED_OUTPUT_VAT'::text AS vat_side,
        v.vat_date AS invoice_date,
        v.doc_no AS invoice_doc_no,
        COALESCE(v.ar_code, '') AS partner_code,
        COALESCE(v.ar_name, '') AS partner_name,
        ROUND(COALESCE(NULLIF(v.base_caltax, 0), v.except_amount_1, 0), 2) AS base_amount,
        ROUND(COALESCE(v.amount, 0), 2) AS deferred_vat_amount
    FROM gl_journal_vat_sale v
    WHERE COALESCE(v.vat_type, 0) = 1
      AND NOT EXISTS (
          SELECT 1 FROM gl_journal_vat_sale r
          WHERE r.trans_flag = 239
            AND COALESCE(r.vat_type, 0) = 0
            AND r.ref_doc_no = v.doc_no
            AND NOT EXISTS (
                SELECT 1 FROM ap_ar_trans a
                WHERE a.doc_no = r.doc_no AND a.trans_flag = 239 AND COALESCE(a.last_status, 0) <> 0
            )
      )
),
open_deferred_buy AS (
    SELECT
        'DEFERRED_INPUT_VAT'::text AS vat_side,
        v.vat_date AS invoice_date,
        v.doc_no AS invoice_doc_no,
        COALESCE(v.ap_code, '') AS partner_code,
        COALESCE(v.ap_name, '') AS partner_name,
        ROUND(COALESCE(v.base_amount, 0), 2) AS base_amount,
        ROUND(COALESCE(v.vat_amount, 0), 2) AS deferred_vat_amount
    FROM gl_journal_vat_buy v
    WHERE COALESCE(v.vat_type, 0) = 2
      AND NOT EXISTS (
          SELECT 1 FROM gl_journal_vat_buy r
          WHERE r.trans_flag IN (19, 315)
            AND COALESCE(r.vat_type, 0) = 0
            AND r.ref_doc_no = v.doc_no
      )
)
SELECT * FROM open_deferred_sale
UNION ALL
SELECT * FROM open_deferred_buy
ORDER BY vat_side ASC, invoice_date ASC, invoice_doc_no ASC;
```

---

## 5. ข้อควรระวัง (Gotchas)
- **รหัส `vat_type` ของภาษีขาย vs ภาษีซื้อไม่เหมือนกัน**:
  - `gl_journal_vat_sale.vat_type`: `0` = ภาษีขายปกติยื่น ภ.พ.30, `1` = ภาษีขายยังไม่ถึงกำหนด (บริการ ม.78/1)
  - `gl_journal_vat_buy.vat_type`: `0` = ภาษีซื้อขอคืนได้ยื่น ภ.พ.30, `1` = ภาษีซื้อขอคืนไม่ได้ (เข้าต้นทุน/ค่าใช้จ่าย), `2` = ภาษีซื้อยังไม่ถึงกำหนด (รอใบกำกับภาษี/ใบเสร็จเมื่อจ่ายเงิน)
- **`vat_effective_year` รองรับทั้ง พ.ศ. และ ค.ศ.**: ต้องใส่ `CASE WHEN vat_effective_year > 2400 THEN vat_effective_year - 543 ...` ทุกครั้งเพื่อให้ตรงกับข้อมูลทั้งที่นำเข้าจากระบบเก่าและที่บันทึกใหม่
