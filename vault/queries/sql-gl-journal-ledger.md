---
title: "SQL สมุดรายวัน (01-05) บัญชีแยกประเภท (GL Running Balance) และตรวจความสมดุลใบสำคัญ"
audience: "dev"
tags: [queries, sql, gl, journal, ledger, audit, gl_journal, gl_journal_detail]
aliases:
  - "sql สมุดรายวัน gl_journal แยกตามเล่ม"
  - "sql บัญชีแยกประเภท general ledger running balance"
  - "sql ตรวจใบสำคัญไม่สมดุล เดบิตไม่เท่ากับเครดิต"
  - "glfaLedger gl_journal_detail"
sources:
  - "backend/internal/application/process/report_menu_gl_fa.go:809-952"
  - "backend/internal/application/process/service.go:509-556"
---

# SQL สมุดรายวัน (`01`–`05`) บัญชีแยกประเภท (GL Running Balance) และตรวจความสมดุลใบสำคัญ

รวมคำสั่ง SQL มาตรฐานสำหรับดึงสมุดรายวันแยกตามเล่มบัญชี (`01` ซื้อ, `02` ขาย, `03` รับ, `04` จ่าย, `05` ทั่วไป), รายงานบัญชีแยกประเภทพร้อมยอดยกมาและยอดคงเหลือสะสมรายบรรทัด (`glfaLedger`), และคำสั่งตรวจสอบสุขภาพใบสำคัญบัญชี (ดูกลไกการโพสต์บัญชีอัตโนมัติที่ [[doc-gl-posting-engine]], ผังบัญชีมาตรฐานที่ [[doc-gl-coa-standard]] และกฎกลางที่ [[sql-overview]])

---

## 1. สมุดรายวันเรียงตามเล่มและเลขที่ใบสำคัญ (`glfaJournal`)

สกัดจาก `report_menu_gl_fa.go:809-865` ดึงรายการใบสำคัญจาก `gl_journal` และ `gl_journal_detail` พร้อมชื่อสมุดรายวัน (`gl_journal_book`):

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้น
- `$2` (`DATE`): วันที่สิ้นสุด
- `$3` (`TEXT`): รหัสสมุดรายวัน `book_code` (เช่น `'01'`, `'02'`, `'03'`, `'04'`, `'05'` หรือส่ง `''` เพื่อดูทุกเล่ม)

```sql
SELECT
    h.doc_date,
    COALESCE(h.book_code, '') AS book_code,
    COALESCE(b.name_1, '') AS book_name,
    h.doc_no,
    d.line_number,
    d.account_code,
    COALESCE(c.name_1, d.account_name, '') AS account_name,
    COALESCE(d.description, h.description, '') AS description,
    ROUND(COALESCE(d.debit, 0), 2) AS debit,
    ROUND(COALESCE(d.credit, 0), 2) AS credit,
    COALESCE(h.journal_type, 0) AS journal_type,
    COALESCE(h.trans_flag, 0) AS source_trans_flag,
    COALESCE(d.branch_code, h.branch_code, '') AS branch_code
FROM gl_journal h
JOIN gl_journal_detail d
  ON d.doc_no = h.doc_no
 AND d.doc_date = h.doc_date
 AND COALESCE(d.book_code, '') = COALESCE(h.book_code, '')
LEFT JOIN gl_journal_book b
  ON b.code = h.book_code
LEFT JOIN gl_chart_of_account c
  ON c.code = d.account_code
WHERE COALESCE(d.is_pass, 0) IN (0, 1)
  AND h.doc_date BETWEEN $1::date AND $2::date
  AND ($3::text = '' OR COALESCE(h.book_code, '') = $3::text)
ORDER BY h.doc_date ASC, h.book_code ASC, h.doc_no ASC, d.line_number ASC;
```

---

## 2. บัญชีแยกประเภทพร้อมยอดยกมาและยอดคงเหลือสะสมรายบรรทัด (`glfaLedger`)

สกัดจาก `glfaLedger` (`report_menu_gl_fa.go:867-952`) คำนวณยอดยกมาต้นงวด (`doc_date < $1` หรือรายการยอดยกมา `journal_type = 1` ในวันต้นงวด `$1`) และคำนวณยอดคงเหลือสะสมตามธรรมชาติหมวดบัญชี (`account_type IN (0, 4)` สินทรัพย์/ค่าใช้จ่าย เดบิตเป็นบวก; `account_type IN (1, 2, 3)` หนี้สิน/ทุน/รายได้ เครดิตเป็นบวก):

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้นงวด
- `$2` (`DATE`): วันที่สิ้นสุดงวด
- `$3` (`TEXT`): รหัสผังบัญชี `account_code` (เช่น `'1112-01'` หรือส่ง `'1130%'` สำหรับใช้กับ `LIKE`)

```sql
WITH target_accounts AS (
    SELECT
        c.code AS account_code,
        COALESCE(c.name_1, '') AS account_name,
        COALESCE(c.account_type, 0) AS account_type,
        CASE WHEN COALESCE(c.account_type, 0) IN (0, 4) THEN 1 ELSE -1 END AS natural_dr_sign
    FROM gl_chart_of_account c
    WHERE c.code LIKE $3::text
),
opening_bal AS (
    SELECT
        t.account_code,
        COALESCE(SUM(
            (COALESCE(d.debit, 0) - COALESCE(d.credit, 0)) * t.natural_dr_sign
        ), 0)::numeric(18, 2) AS opening_signed_balance
    FROM target_accounts t
    LEFT JOIN gl_journal_detail d
      ON d.account_code = t.account_code
     AND COALESCE(d.is_pass, 0) IN (0, 1)
     AND (
         d.doc_date < $1::date
         OR (d.doc_date = $1::date AND COALESCE(d.journal_type, 0) = 1)
     )
    GROUP BY t.account_code
),
period_lines AS (
    SELECT
        d.account_code,
        d.doc_date,
        COALESCE(d.book_code, '') AS book_code,
        d.doc_no,
        d.line_number,
        COALESCE(d.description, '') AS description,
        COALESCE(d.debit, 0)::numeric(18, 2) AS debit,
        COALESCE(d.credit, 0)::numeric(18, 2) AS credit,
        ROW_NUMBER() OVER (
            PARTITION BY d.account_code
            ORDER BY d.doc_date ASC, d.book_code ASC, d.doc_no ASC, d.line_number ASC
        ) AS rn
    FROM gl_journal_detail d
    JOIN target_accounts t
      ON t.account_code = d.account_code
    WHERE COALESCE(d.is_pass, 0) IN (0, 1)
      AND d.doc_date BETWEEN $1::date AND $2::date
      AND NOT (d.doc_date = $1::date AND COALESCE(d.journal_type, 0) = 1)
)
SELECT
    t.account_code,
    t.account_name,
    p.doc_date,
    p.book_code,
    p.doc_no,
    p.line_number,
    p.description,
    ROUND(o.opening_signed_balance, 2) AS opening_balance,
    ROUND(p.debit, 2) AS debit,
    ROUND(p.credit, 2) AS credit,
    ROUND(
        o.opening_signed_balance + SUM((p.debit - p.credit) * t.natural_dr_sign)
            OVER (PARTITION BY p.account_code ORDER BY p.rn ASC),
        2
    ) AS running_balance
FROM period_lines p
JOIN target_accounts t
  ON t.account_code = p.account_code
JOIN opening_bal o
  ON o.account_code = p.account_code
ORDER BY p.account_code ASC, p.rn ASC;
```

---

## 3. คำสั่งตรวจสอบความสมบูรณ์ของใบสำคัญรายวัน (GL Integrity Audit)

สกัดจากกฎการตรวจสอบความสมดุลใน `service.go:509-556` ค้นหาใบสำคัญที่ผลรวมเดบิตไม่เท่ากับเครดิต หรือบรรทัดรายวันที่อ้างรหัสผังบัญชีซึ่งไม่มีอยู่ใน `gl_chart_of_account`:

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้นตรวจสอบ
- `$2` (`DATE`): วันที่สิ้นสุดตรวจสอบ

```sql
WITH unbalanced_vouchers AS (
    SELECT
        'UNBALANCED_VOUCHER'::text AS issue_type,
        d.doc_date,
        COALESCE(d.book_code, '') AS book_code,
        d.doc_no,
        ''::text AS invalid_account_code,
        ROUND(SUM(COALESCE(d.debit, 0)), 2) AS sum_debit,
        ROUND(SUM(COALESCE(d.credit, 0)), 2) AS sum_credit,
        ROUND(SUM(COALESCE(d.debit, 0)) - SUM(COALESCE(d.credit, 0)), 2) AS diff_amount
    FROM gl_journal_detail d
    WHERE COALESCE(d.is_pass, 0) IN (0, 1)
      AND d.doc_date BETWEEN $1::date AND $2::date
    GROUP BY d.doc_date, COALESCE(d.book_code, ''), d.doc_no
    HAVING ABS(SUM(COALESCE(d.debit, 0)) - SUM(COALESCE(d.credit, 0))) > 0.001
),
orphan_accounts AS (
    SELECT
        'MISSING_COA_ACCOUNT'::text AS issue_type,
        d.doc_date,
        COALESCE(d.book_code, '') AS book_code,
        d.doc_no,
        COALESCE(d.account_code, '') AS invalid_account_code,
        ROUND(COALESCE(d.debit, 0), 2) AS sum_debit,
        ROUND(COALESCE(d.credit, 0), 2) AS sum_credit,
        ROUND(COALESCE(d.debit, 0) - COALESCE(d.credit, 0), 2) AS diff_amount
    FROM gl_journal_detail d
    LEFT JOIN gl_chart_of_account c
      ON c.code = d.account_code
    WHERE COALESCE(d.is_pass, 0) IN (0, 1)
      AND d.doc_date BETWEEN $1::date AND $2::date
      AND c.code IS NULL
)
SELECT * FROM unbalanced_vouchers
UNION ALL
SELECT * FROM orphan_accounts
ORDER BY doc_date ASC, doc_no ASC;
```

---

## 4. ข้อควรระวัง (Gotchas)
- **ความหมายของ `journal_type` ใน `gl_journal` และ `gl_journal_detail`**:
  - `0` = รายการค้าระหว่างงวดปกติ
  - `1` = รายการยอดยกมาต้นปีบัญชี (เมื่อดูแยกประเภท ณ วันต้นปี `$1` ต้องนับรวมเป็น `opening_balance` ไม่ใช่นับซ้ำใน `period_lines`)
  - `2` = รายการปิดบัญชีรายได้-ค่าใช้จ่ายสิ้นปีเข้ากำไรสะสม (ดูผลกระทบต่องบทดลองที่ [[sql-gl-trial-balance]] และงบกำไรขาดทุนที่ [[sql-gl-profit-and-loss]])
