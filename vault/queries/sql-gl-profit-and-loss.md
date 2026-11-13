---
title: "SQL งบกำไรขาดทุน (Income Statement) รายเดือน แยกสาขา และแยกแผนก"
audience: "dev"
tags: [queries, sql, gl, profit_and_loss, income_statement, department, branch]
aliases:
  - "sql งบกำไรขาดทุน profit and loss income statement"
  - "sql กำไรขั้นต้น กำไรสุทธิจากบัญชีแยกประเภท"
  - "sql งบกำไรขาดทุนแยกสาขา แยกแผนก gl_journal_depart_list"
  - "glfaIncomeStatement glfaPLBranch"
sources:
  - "backend/internal/application/process/report_menu_gl_fa.go:537-637"
  - "backend/internal/application/process/report_menu_gl_fa.go:954-985"
  - "backend/internal/adapter/inbound/http/mcp/gateway.go:2077-2091"
---

# SQL งบกำไรขาดทุน (Income Statement) รายเดือน แยกสาขา และแยกแผนก

รวมคำสั่ง SQL สำหรับจัดทำงบกำไรขาดทุนจากบัญชีแยกประเภท (`gl_journal_detail` คู่กับ `gl_chart_of_account`) ทั้งแบบแยกหมวด รายได้ / ต้นทุนขาย / ค่าใช้จ่ายดำเนินงาน, แนวโน้มรายเดือน, แยกตามสาขา และปันส่วนตามแผนก (`gl_journal_depart_list`) (ดูงบทดลองที่ [[sql-gl-trial-balance]], งบดุลที่ [[sql-gl-balance-sheet]] และกฎกลางที่ [[sql-overview]])

---

## 1. งบกำไรขาดทุนมาตรฐานแยก รายได้ / ต้นทุนขาย / ค่าใช้จ่าย (`glfaIncomeStatement`)

สกัดจาก `glfaIncomeStatement` (`report_menu_gl_fa.go:537-594`) และ `execFinancialSummary` (`gateway.go:2077-2091`) ดึงหมวดรายได้ (`account_type = 3`) และค่าใช้จ่าย (`account_type = 4`) โดยแยกต้นทุนขายด้วย `COALESCE(c.balance_sheet_status, 0) = 1` (หรือรหัสขึ้นต้น `'51'`) และ**บังคับตัดรายการปิดงวด `COALESCE(d.journal_type, 0) <> 2`** เสมอ:

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้นงวด
- `$2` (`DATE`): วันที่สิ้นสุดงวด

```sql
WITH pl_accounts AS (
    SELECT
        c.code AS account_code,
        COALESCE(c.name_1, '') AS account_name,
        c.account_type,
        CASE
            WHEN c.account_type = 3 THEN '1_REVENUE'
            WHEN c.account_type = 4 AND (COALESCE(c.balance_sheet_status, 0) = 1 OR c.code LIKE '51%') THEN '2_COGS'
            ELSE '3_OPEX'
        END AS pl_section,
        CASE
            WHEN c.account_type = 3 THEN SUM(COALESCE(d.credit, 0) - COALESCE(d.debit, 0))
            ELSE SUM(COALESCE(d.debit, 0) - COALESCE(d.credit, 0))
        END::numeric(18, 2) AS amount
    FROM gl_journal_detail d
    JOIN gl_chart_of_account c
      ON c.code = d.account_code
    WHERE c.account_type IN (3, 4)
      AND COALESCE(d.is_pass, 0) IN (0, 1)
      AND COALESCE(d.journal_type, 0) <> 2
      AND d.doc_date BETWEEN $1::date AND $2::date
    GROUP BY c.code, c.name_1, c.account_type, c.balance_sheet_status
    HAVING SUM(COALESCE(d.debit, 0) - COALESCE(d.credit, 0)) <> 0
),
pl_totals AS (
    SELECT
        COALESCE(SUM(amount) FILTER (WHERE pl_section = '1_REVENUE'), 0)::numeric(18, 2) AS total_revenue,
        COALESCE(SUM(amount) FILTER (WHERE pl_section = '2_COGS'), 0)::numeric(18, 2) AS total_cogs,
        COALESCE(SUM(amount) FILTER (WHERE pl_section = '3_OPEX'), 0)::numeric(18, 2) AS total_opex
    FROM pl_accounts
)
SELECT
    a.pl_section,
    a.account_code,
    a.account_name,
    ROUND(a.amount, 2) AS account_amount,
    ROUND(t.total_revenue, 2) AS total_revenue,
    ROUND(t.total_cogs, 2) AS total_cogs,
    ROUND(t.total_revenue - t.total_cogs, 2) AS gross_profit,
    ROUND(t.total_opex, 2) AS total_operating_expense,
    ROUND(t.total_revenue - t.total_cogs - t.total_opex, 2) AS net_profit
FROM pl_accounts a
CROSS JOIN pl_totals t
ORDER BY a.pl_section ASC, a.account_code ASC;
```

---

## 2. สรุปงบกำไรขาดทุนเปรียบเทียบรายเดือน (Monthly P&L Trend)

สำหรับสร้างกราฟเปรียบเทียบรายได้ ต้นทุนขาย ค่าใช้จ่าย และกำไรสุทธิรายเดือน:

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้น (เช่น ต้นปีบัญชี)
- `$2` (`DATE`): วันที่สิ้นสุด (เช่น สิ้นปีบัญชี)

```sql
SELECT
    TO_CHAR(DATE_TRUNC('month', d.doc_date), 'YYYY-MM') AS year_month,
    ROUND(COALESCE(SUM(COALESCE(d.credit, 0) - COALESCE(d.debit, 0))
        FILTER (WHERE c.account_type = 3), 0), 2) AS revenue,
    ROUND(COALESCE(SUM(COALESCE(d.debit, 0) - COALESCE(d.credit, 0))
        FILTER (WHERE c.account_type = 4 AND (COALESCE(c.balance_sheet_status, 0) = 1 OR c.code LIKE '51%')), 0), 2) AS cogs,
    ROUND(COALESCE(SUM(COALESCE(d.debit, 0) - COALESCE(d.credit, 0))
        FILTER (WHERE c.account_type = 4 AND NOT (COALESCE(c.balance_sheet_status, 0) = 1 OR c.code LIKE '51%')), 0), 2) AS operating_expense,
    ROUND(COALESCE(SUM(COALESCE(d.credit, 0) - COALESCE(d.debit, 0))
        FILTER (WHERE c.account_type IN (3, 4)), 0), 2) AS net_profit
FROM gl_journal_detail d
JOIN gl_chart_of_account c
  ON c.code = d.account_code
WHERE c.account_type IN (3, 4)
  AND COALESCE(d.is_pass, 0) IN (0, 1)
  AND COALESCE(d.journal_type, 0) <> 2
  AND d.doc_date BETWEEN $1::date AND $2::date
GROUP BY DATE_TRUNC('month', d.doc_date)
ORDER BY year_month ASC;
```

---

## 3. งบกำไรขาดทุนแยกตามสาขา (`glfaPLBranch`) และปันส่วนตามแผนก (`gl_journal_depart_list`)

สกัดจาก `glfaPLBranch` (`report_menu_gl_fa.go:595-637`) และรายงานปันส่วนแผนก (`report_menu_gl_fa.go:954-985`) ใช้ตาราง `gl_journal_depart_list` เมื่อมีการปันส่วนรายได้/ค่าใช้จ่ายเข้าแต่ละแผนก (`erp_department_list`):

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้นงวด
- `$2` (`DATE`): วันที่สิ้นสุดงวด

```sql
SELECT
    COALESCE(dp.department_code, '') AS department_code,
    COALESCE(dm.name_1, 'ไม่ระบุแผนก') AS department_name,
    ROUND(COALESCE(SUM(COALESCE(dp.credit, 0) - COALESCE(dp.debit, 0))
        FILTER (WHERE c.account_type = 3), 0), 2) AS dept_revenue,
    ROUND(COALESCE(SUM(COALESCE(dp.debit, 0) - COALESCE(dp.credit, 0))
        FILTER (WHERE c.account_type = 4), 0), 2) AS dept_expense,
    ROUND(COALESCE(SUM(COALESCE(dp.credit, 0) - COALESCE(dp.debit, 0))
        FILTER (WHERE c.account_type IN (3, 4)), 0), 2) AS dept_net_profit
FROM gl_journal_depart_list dp
JOIN gl_chart_of_account c
  ON c.code = dp.account_code
LEFT JOIN erp_department_list dm
  ON dm.code = dp.department_code
WHERE c.account_type IN (3, 4)
  AND dp.doc_date BETWEEN $1::date AND $2::date
GROUP BY COALESCE(dp.department_code, ''), dm.name_1
ORDER BY dept_net_profit DESC, department_code ASC;
```

---

## 4. ข้อควรระวัง (Gotchas)
- **ห้ามลืม `COALESCE(d.journal_type, 0) <> 2` เด็ดขาด**: เมื่อนักบัญชีสั่งประมวลผลปิดบัญชีสิ้นปี ระบบจะสร้างใบสำคัญ `journal_type = 2` เพื่อล้างยอดบัญชีรายได้และค่าใช้จ่ายทุกตัวเข้ากำไรสะสม (`3210-00`) หากไม่ใส่เงื่อนไข `journal_type <> 2` ยอดงบกำไรขาดทุนของปีที่ปิดบัญชีแล้วจะกลายเป็น `0.00` ทันที!
- **ทิศทางเครื่องหมายของรายได้ vs ค่าใช้จ่าย**: รายได้ (`account_type = 3`) มีดุลปกติอยู่ด้านเครดิตจึงใช้ `SUM(credit - debit)` ส่วนค่าใช้จ่าย (`account_type = 4`) มีดุลปกติอยู่ด้านเดบิตจึงใช้ `SUM(debit - credit)` แต่เมื่อหา `net_profit` รวมของทั้งสองหมวด สามารถใช้ `SUM(credit - debit)` ครอบ `account_type IN (3, 4)` ได้ตรงกัน 100%
