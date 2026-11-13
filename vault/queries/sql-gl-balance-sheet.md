---
title: "SQL งบแสดงฐานะการเงิน (Balance Sheet) และบิลต่างประเทศรอปรับมูลค่า FX"
audience: "dev"
tags: [queries, sql, gl, balance_sheet, fx_revaluation, financial_statement]
aliases:
  - "sql งบแสดงฐานะการเงิน งบดุล balance sheet"
  - "sql สมการบัญชี สินทรัพย์เท่ากับหนี้สินบวกทุน"
  - "sql ปรับปรุงกำไรขาดทุนอัตราแลกเปลี่ยนสิ้นงวด fx revaluation"
  - "glfaBalanceSheet fxSideOpenBillsQuery"
sources:
  - "backend/internal/application/process/report_menu_gl_fa.go:639-692"
  - "backend/internal/adapter/inbound/http/mcp/gateway.go:2092-2109"
  - "backend/internal/application/process/fx_revaluation.go:121-177"
  - "backend/internal/application/process/fx_revaluation.go:467-553"
---

# SQL งบแสดงฐานะการเงิน (Balance Sheet) และบิลต่างประเทศรอปรับมูลค่า FX

รวมคำสั่ง SQL มาตรฐานสำหรับจัดทำงบแสดงฐานะการเงิน (งบดุล) ณ วันสิ้นงวดที่สมดุลทุกสตางค์แม้ยังไม่ได้ประมวลผลปิดบัญชีสิ้นปี พร้อมคำสั่งดึงบิลลูกหนี้-เจ้าหนี้สกุลเงินต่างประเทศที่ค้างชำระเพื่อประเมินกำไร/ขาดทุนจากอัตราแลกเปลี่ยนที่ยังไม่เกิดขึ้นจริง (Unrealized FX Gain/Loss) (ดูงบทดลองที่ [[sql-gl-trial-balance]], งบกำไรขาดทุนที่ [[sql-gl-profit-and-loss]] และกฎกลางที่ [[sql-overview]])

---

## 1. งบแสดงฐานะการเงิน ณ วันสิ้นงวด (`glfaBalanceSheet`) รวมกำไรสะสมระหว่างงวดอัตโนมัติ

สกัดจาก `glfaBalanceSheet` (`report_menu_gl_fa.go:639-692`) และ `execFinancialSummary` (`gateway.go:2092-2109`) ดึงยอดคงเหลือสะสมตั้งแต่เริ่มต้นจนถึงวันที่ `$1` ของหมวดสินทรัพย์ (`0`), หนี้สิน (`1`) และส่วนของเจ้าของ (`2`) **พร้อมเพิ่มบรรทัดกำไร (ขาดทุน) สะสมระหว่างงวดที่ยังไม่ปิดบัญชี** จากผลรวม `SUM(credit - debit)` ของหมวดรายได้และค่าใช้จ่าย (`account_type IN (3, 4)`):

### พารามิเตอร์
- `$1` (`DATE`): วันที่สิ้นสุดงวดที่ต้องการดูฐานะการเงิน (`as_of_date`)

```sql
WITH bs_lines AS (
    SELECT
        CASE c.account_type
            WHEN 0 THEN '1_ASSETS'
            WHEN 1 THEN '2_LIABILITIES'
            WHEN 2 THEN '3_EQUITY'
        END AS bs_section,
        c.code AS account_code,
        COALESCE(c.name_1, '') AS account_name,
        CASE
            WHEN c.account_type = 0 THEN SUM(COALESCE(d.debit, 0) - COALESCE(d.credit, 0))
            ELSE SUM(COALESCE(d.credit, 0) - COALESCE(d.debit, 0))
        END::numeric(18, 2) AS balance_amount
    FROM gl_journal_detail d
    JOIN gl_chart_of_account c
      ON c.code = d.account_code
    WHERE c.account_type IN (0, 1, 2)
      AND COALESCE(d.is_pass, 0) IN (0, 1)
      AND d.doc_date <= $1::date
    GROUP BY c.account_type, c.code, c.name_1
    HAVING SUM(COALESCE(d.debit, 0) - COALESCE(d.credit, 0)) <> 0
),
unclosed_pl AS (
    -- ถ้างวดนั้นปิดบัญชี (journal_type = 2) เข้า 3210-00 ไปแล้ว ผลรวมนี้จะเป็น 0.00 อัตโนมัติ
    -- ถ้ายังไม่ปิดบัญชี ผลรวมนี้คือกำไร(ขาดทุน)สุทธิสะสมที่ทำให้สมการงบดุลลงตัวทุกสตางค์
    SELECT
        '3_EQUITY'::text AS bs_section,
        '3210-UNCLOSED'::text AS account_code,
        'กำไร (ขาดทุน) สุทธิสะสมรอปิดบัญชี'::text AS account_name,
        COALESCE(SUM(COALESCE(d.credit, 0) - COALESCE(d.debit, 0)), 0)::numeric(18, 2) AS balance_amount
    FROM gl_journal_detail d
    JOIN gl_chart_of_account c
      ON c.code = d.account_code
    WHERE c.account_type IN (3, 4)
      AND COALESCE(d.is_pass, 0) IN (0, 1)
      AND d.doc_date <= $1::date
),
combined_bs AS (
    SELECT * FROM bs_lines
    UNION ALL
    SELECT * FROM unclosed_pl WHERE balance_amount <> 0
)
SELECT
    bs_section,
    account_code,
    account_name,
    ROUND(balance_amount, 2) AS balance_amount
FROM combined_bs
ORDER BY bs_section ASC, account_code ASC;
```

---

## 2. ตรวจสอบสมการงบแสดงฐานะการเงิน (`Assets = Liabilities + Equity`)

ใช้วัดความถูกต้องระดับสตางค์ของงบดุล ณ วันที่ `$1`:

### พารามิเตอร์
- `$1` (`DATE`): วันที่สิ้นสุดงวด (`as_of_date`)

```sql
SELECT
    ROUND(COALESCE(SUM(COALESCE(d.debit, 0) - COALESCE(d.credit, 0))
        FILTER (WHERE c.account_type = 0), 0), 2) AS total_assets,
    ROUND(COALESCE(SUM(COALESCE(d.credit, 0) - COALESCE(d.debit, 0))
        FILTER (WHERE c.account_type = 1), 0), 2) AS total_liabilities,
    ROUND(COALESCE(SUM(COALESCE(d.credit, 0) - COALESCE(d.debit, 0))
        FILTER (WHERE c.account_type = 2), 0), 2) AS posted_equity,
    ROUND(COALESCE(SUM(COALESCE(d.credit, 0) - COALESCE(d.debit, 0))
        FILTER (WHERE c.account_type IN (3, 4)), 0), 2) AS unclosed_net_profit,
    ROUND(COALESCE(SUM(COALESCE(d.credit, 0) - COALESCE(d.debit, 0))
        FILTER (WHERE c.account_type IN (1, 2, 3, 4)), 0), 2) AS total_liabilities_and_equity,
    ROUND(COALESCE(SUM(COALESCE(d.debit, 0) - COALESCE(d.credit, 0)), 0), 2) AS equation_variance_must_be_zero
FROM gl_journal_detail d
JOIN gl_chart_of_account c
  ON c.code = d.account_code
WHERE COALESCE(d.is_pass, 0) IN (0, 1)
  AND d.doc_date <= $1::date;
```

---

## 3. บิลลูกหนี้-เจ้าหนี้สกุลเงินต่างประเทศที่ค้างชำระเพื่อปรับมูลค่า FX สิ้นงวด (`fxSideOpenBillsQuery`)

สกัดจาก `fx_revaluation.go:121-177, 467-553` ดึงบิลที่บันทึกด้วยสกุลเงินต่างประเทศ (`currency_code` ไม่ว่างและไม่ใช่ `'THB'`) ซึ่งยังมียอดค้างชำระ ณ วันสิ้นงวด เพื่อคำนวณ Unrealized FX Gain/Loss เทียบกับอัตราแลกเปลี่ยนปิดงวด:

### พารามิเตอร์
- `$1` (`DATE`): วันที่ประเมินมูลค่าสิ้นงวด (`as_of_date`)

```sql
WITH ar_ap_paid AS (
    SELECT
        p.billing_no,
        p.bill_type,
        SUM(COALESCE(p.sum_pay_money, 0))::numeric(18, 2) AS paid_thb
    FROM ap_ar_trans_detail p
    JOIN ap_ar_trans ph ON ph.doc_no = p.doc_no AND ph.trans_flag = p.trans_flag
    WHERE p.trans_flag IN (19, 239)
      AND COALESCE(p.last_status, 0) = 0
      AND COALESCE(ph.last_status, 0) = 0
      AND ph.doc_date <= $1::date
    GROUP BY p.billing_no, p.bill_type
)
SELECT
    CASE
        WHEN h.trans_flag IN (44, 48, 93, 95, 97, 99, 250, 252, 254) THEN 'AR'
        ELSE 'AP'
    END AS ledger_side,
    h.doc_date,
    h.doc_no,
    h.trans_flag,
    COALESCE(h.cust_code, '') AS partner_code,
    UPPER(BTRIM(COALESCE(h.currency_code, ''))) AS currency_code,
    ROUND(COALESCE(NULLIF(h.exchange_rate, 0), 1), 6) AS booked_exchange_rate,
    ROUND(COALESCE(h.total_amount, 0), 2) AS original_thb_amount,
    ROUND(COALESCE(p.paid_thb, 0), 2) AS settled_thb_amount,
    ROUND(
        CASE
            WHEN h.trans_flag IN (48, 97, 252, 16, 317, 85, 262)
                THEN -1 * (COALESCE(h.total_amount, 0) + COALESCE(p.paid_thb, 0))
            ELSE COALESCE(h.total_amount, 0) - COALESCE(p.paid_thb, 0)
        END,
        2
    ) AS open_thb_carrying_amount
FROM ic_trans h
LEFT JOIN ar_ap_paid p
  ON p.billing_no = h.doc_no
 AND p.bill_type = h.trans_flag
WHERE COALESCE(h.last_status, 0) = 0
  AND h.doc_date <= $1::date
  AND UPPER(BTRIM(COALESCE(h.currency_code, ''))) NOT IN ('', 'THB')
  AND (
      (h.trans_flag IN (44, 12, 315) AND COALESCE(h.inquiry_type, 0) IN (0, 2))
      OR (h.trans_flag = 48 AND COALESCE(h.inquiry_type, 0) IN (0, 2, 4))
      OR (h.trans_flag IN (16, 317) AND COALESCE(h.inquiry_type, 0) IN (0, 1))
      OR h.trans_flag IN (93, 95, 97, 99, 250, 252, 254, 81, 83, 85, 87, 260, 262, 264)
  )
  AND ABS(
      CASE
          WHEN h.trans_flag IN (48, 97, 252, 16, 317, 85, 262)
              THEN -1 * (COALESCE(h.total_amount, 0) + COALESCE(p.paid_thb, 0))
          ELSE COALESCE(h.total_amount, 0) - COALESCE(p.paid_thb, 0)
      END
  ) > 0.005
ORDER BY ledger_side ASC, currency_code ASC, h.doc_date ASC, h.doc_no ASC;
```

---

## 4. ข้อควรระวัง (Gotchas)
- **ห้ามตัด `journal_type = 2` ในงบแสดงฐานะการเงิน**: ต่างจากงบกำไรขาดทุนที่ต้องกรอง `journal_type <> 2` เสมอ ในงบแสดงฐานะการเงิน**ต้องรวมทุก `journal_type` (`0, 1, 2`)** เพราะหากปิดบัญชีสิ้นปีแล้ว ยอดกำไรสะสมจะถูกโอนจากหมวด `3, 4` เข้าบัญชี `3210-00` (หมวด `2`) พอดีโดยไม่เกิดการนับซ้ำ
- **ใบปรับปรุงค่าเงินสิ้นงวด (`gl_fx_revaluation`)**: ประวัติการประมวลผลปรับมูลค่าเงินตราต่างประเทศสิ้นงวดและใบสำคัญกลับรายการต้นงวดถัดไปเก็บอยู่ในตาราง `gl_fx_revaluation` และ `gl_fx_revaluation_item`
