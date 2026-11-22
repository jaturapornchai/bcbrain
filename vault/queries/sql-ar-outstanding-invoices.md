---
title: "SQL บิลลูกหนี้คงค้างรายตัวและรายลูกหนี้ (AR Outstanding Invoices)"
audience: "dev"
tags: [queries, sql, ar, receivable, open_bills, credit_note, as_trans]
aliases:
  - "sql ลูกหนี้คงค้าง"
  - "sql บิลลูกหนี้ค้างชำระ"
  - "aparOpenDocsCTE ar"
  - "OutstandingBills sql"
  - "ลูกหนี้การค้ารายตัว หักใบลดหนี้ 48"
sources:
  - "backend/internal/application/process/report_menu_ap_ar.go:541-573"
  - "backend/internal/application/process/report_menu_ap_ar.go:659-774"
  - "backend/internal/application/process/docs.go:600-690"
---

# SQL บิลลูกหนี้คงค้างรายตัวและรายลูกหนี้ (AR Outstanding Invoices)

คำสั่ง SQL นี้สกัดตรงจาก `aparOpenDocsCTE` (`report_menu_ap_ar.go:541-573`) ซึ่งเป็นสูตรมาตรฐานเดียวกับรายงานลูกหนี้คงค้างและหน้าจอดึงบิลไปวางบิล/รับชำระหนี้ ครอบคลุมครบทั้ง **บิลขายเชื่อ (`44`), เพิ่มหนี้ (`46`), หนี้ย่อย/ยกมา (`93, 95, 99, 101`), รายได้อื่นเชื่อ (`250, 254`), ขายสินทรัพย์ถาวรเชื่อ (`as_trans` `1802`) และหักใบลดหนี้ลูกหนี้ (`48, 97, 103, 252`)** ตามกฎเครื่องหมายจริง (ดูคำอธิบายละเอียดที่ [[doc-impact-ar-ap-deposit]])

---

## 1. รายการเอกสารลูกหนี้คงค้างรายบิล ณ วันที่ระบุ (`As-Of Date`)

### พารามิเตอร์
- `$1` (`DATE`): วันที่สิ้นสุดการคำนวณยอดคงค้าง (As-Of Date) เช่น `'2026-11-13'` (นับเฉพาะเอกสารและใบเสร็จที่เกิดไม่เกินวันนี้ — ทำย้อนหลังได้แม่นยำ!)
- `$2` (`TEXT`): รหัสลูกหนี้ (`cust_code`) — ส่ง `''` เพื่อดึงลูกหนี้ทุกราย

```sql
WITH paid_ar AS (
    SELECT
        d.billing_no,
        d.bill_type,
        SUM(COALESCE(d.sum_pay_money, 0)) AS paid_amt,
        SUM(COALESCE(d.lost_profit_exchange_amount, 0)) AS fx_amt
    FROM ap_ar_trans_detail d
    JOIN ap_ar_trans h
      ON h.doc_no = d.doc_no AND h.trans_flag = d.trans_flag
    WHERE d.trans_flag = 239
      AND COALESCE(d.last_status, 0) = 0
      AND COALESCE(h.last_status, 0) = 0
      AND d.doc_date <= $1::date
    GROUP BY d.billing_no, d.bill_type
),
open_ar_docs AS (
    -- 1. บิลตั้งหนี้และเพิ่มหนี้ลูกหนี้ใน ic_trans (ยอดบวก)
    SELECT
        t.cust_code,
        t.doc_no,
        t.doc_date,
        COALESCE(t.credit_date, t.due_date, t.doc_date) AS due_date,
        t.trans_flag,
        COALESCE(t.doc_ref, '') AS doc_ref,
        COALESCE(t.sale_code, '') AS sale_code,
        COALESCE(t.branch_code, '') AS branch_code,
        COALESCE(t.total_amount, 0)::numeric(18, 2) AS doc_amount,
        (COALESCE(p.paid_amt, 0) + CASE WHEN t.trans_flag = 44 THEN COALESCE(p.fx_amt, 0) ELSE 0 END)::numeric(18, 2) AS paid_amount,
        (COALESCE(t.total_amount, 0) - (COALESCE(p.paid_amt, 0) + CASE WHEN t.trans_flag = 44 THEN COALESCE(p.fx_amt, 0) ELSE 0 END))::numeric(18, 2) AS ar_balance
    FROM ic_trans t
    LEFT JOIN paid_ar p ON p.billing_no = t.doc_no AND p.bill_type = t.trans_flag
    WHERE COALESCE(t.last_status, 0) = 0
      AND t.doc_date <= $1::date
      AND ($2::text = '' OR t.cust_code = $2::text)
      AND (
          (t.trans_flag IN (44, 46, 250, 254) AND COALESCE(t.inquiry_type, 0) IN (0, 2))
          OR t.trans_flag IN (93, 95, 99, 101)
      )

    UNION ALL

    -- 2. บิลขายสินทรัพย์ถาวรเงินเชื่อใน as_trans (trans_flag = 1802)
    SELECT
        s.cust_code,
        s.doc_no,
        s.doc_date,
        COALESCE(s.credit_date, s.doc_date) AS due_date,
        s.trans_flag,
        COALESCE(s.doc_ref, '') AS doc_ref,
        '' AS sale_code,
        COALESCE(s.branch_code, '') AS branch_code,
        COALESCE(s.total_amount, 0)::numeric(18, 2) AS doc_amount,
        (COALESCE(p.paid_amt, 0) + COALESCE(p.fx_amt, 0))::numeric(18, 2) AS paid_amount,
        (COALESCE(s.total_amount, 0) - (COALESCE(p.paid_amt, 0) + COALESCE(p.fx_amt, 0)))::numeric(18, 2) AS ar_balance
    FROM as_trans s
    LEFT JOIN paid_ar p ON p.billing_no = s.doc_no AND p.bill_type = s.trans_flag
    WHERE COALESCE(s.last_status, 0) = 0
      AND s.trans_flag = 1802
      AND COALESCE(s.inquiry_type, 0) IN (0, 2)
      AND s.doc_date <= $1::date
      AND ($2::text = '' OR s.cust_code = $2::text)

    UNION ALL

    -- 3. ใบลดหนี้ลูกหนี้ใน ic_trans (p.paid_amt เก็บค่าติดลบ ดังนั้นยอดคงเหลือ = -1 * (total_amount + paid_amt))
    SELECT
        t.cust_code,
        t.doc_no,
        t.doc_date,
        COALESCE(t.credit_date, t.due_date, t.doc_date) AS due_date,
        t.trans_flag,
        COALESCE(t.doc_ref, '') AS doc_ref,
        COALESCE(t.sale_code, '') AS sale_code,
        COALESCE(t.branch_code, '') AS branch_code,
        (-1 * COALESCE(t.total_amount, 0))::numeric(18, 2) AS doc_amount,
        COALESCE(p.paid_amt, 0)::numeric(18, 2) AS paid_amount,
        (-1 * (COALESCE(t.total_amount, 0) + COALESCE(p.paid_amt, 0)))::numeric(18, 2) AS ar_balance
    FROM ic_trans t
    LEFT JOIN paid_ar p ON p.billing_no = t.doc_no AND p.bill_type = t.trans_flag
    WHERE COALESCE(t.last_status, 0) = 0
      AND t.doc_date <= $1::date
      AND ($2::text = '' OR t.cust_code = $2::text)
      AND (
          (t.trans_flag = 48 AND COALESCE(t.inquiry_type, 0) IN (0, 2, 4))
          OR t.trans_flag IN (97, 103)
          OR (t.trans_flag = 252 AND COALESCE(t.inquiry_type, 0) IN (0, 2))
      )
)
SELECT
    o.cust_code,
    COALESCE(c.name_1, '') AS cust_name,
    o.doc_date,
    o.due_date,
    o.doc_no,
    o.trans_flag,
    o.doc_ref,
    o.sale_code,
    ($1::date - o.due_date) AS overdue_days,
    ROUND(o.doc_amount, 2) AS original_amount,
    ROUND(o.paid_amount, 2) AS settled_amount,
    ROUND(o.ar_balance, 2) AS open_balance
FROM open_ar_docs o
LEFT JOIN ar_customer c ON c.code = o.cust_code
WHERE ROUND(o.ar_balance, 2) <> 0
ORDER BY o.cust_code ASC, o.due_date ASC, o.doc_date ASC, o.doc_no ASC;
```

---

## 2. สรุปยอดลูกหนี้คงค้างรวมรายลูกค้า เทียบวงเงินเครดิต (`credit_money`)

นำ CTE `paid_ar` และ `open_ar_docs` มารวมยอดระดับลูกหนี้ เพื่อตรวจดูรายที่ใช้วงเงินเครดิตเกินกำหนด (คัดลอกรันเดี่ยวได้ทันที พารามิเตอร์ `$1::date` = As-Of Date, `$2::text` = รหัสลูกหนี้ หรือ `''` เพื่อดูทุกราย):

```sql
WITH paid_ar AS (
    SELECT
        d.billing_no,
        d.bill_type,
        SUM(COALESCE(d.sum_pay_money, 0)) AS paid_amt,
        SUM(COALESCE(d.lost_profit_exchange_amount, 0)) AS fx_amt
    FROM ap_ar_trans_detail d
    JOIN ap_ar_trans h
      ON h.doc_no = d.doc_no AND h.trans_flag = d.trans_flag
    WHERE d.trans_flag = 239
      AND COALESCE(d.last_status, 0) = 0
      AND COALESCE(h.last_status, 0) = 0
      AND d.doc_date <= $1::date
    GROUP BY d.billing_no, d.bill_type
),
open_ar_docs AS (
    -- 1. บิลตั้งหนี้และเพิ่มหนี้ลูกหนี้ใน ic_trans (ยอดบวก)
    SELECT
        t.cust_code,
        t.doc_no,
        t.doc_date,
        COALESCE(t.credit_date, t.due_date, t.doc_date) AS due_date,
        t.trans_flag,
        COALESCE(t.doc_ref, '') AS doc_ref,
        COALESCE(t.sale_code, '') AS sale_code,
        COALESCE(t.branch_code, '') AS branch_code,
        COALESCE(t.total_amount, 0)::numeric(18, 2) AS doc_amount,
        (COALESCE(p.paid_amt, 0) + CASE WHEN t.trans_flag = 44 THEN COALESCE(p.fx_amt, 0) ELSE 0 END)::numeric(18, 2) AS paid_amount,
        (COALESCE(t.total_amount, 0) - (COALESCE(p.paid_amt, 0) + CASE WHEN t.trans_flag = 44 THEN COALESCE(p.fx_amt, 0) ELSE 0 END))::numeric(18, 2) AS ar_balance
    FROM ic_trans t
    LEFT JOIN paid_ar p ON p.billing_no = t.doc_no AND p.bill_type = t.trans_flag
    WHERE COALESCE(t.last_status, 0) = 0
      AND t.doc_date <= $1::date
      AND ($2::text = '' OR t.cust_code = $2::text)
      AND (
          (t.trans_flag IN (44, 46, 250, 254) AND COALESCE(t.inquiry_type, 0) IN (0, 2))
          OR t.trans_flag IN (93, 95, 99, 101)
      )

    UNION ALL

    -- 2. บิลขายสินทรัพย์ถาวรเงินเชื่อใน as_trans (trans_flag = 1802)
    SELECT
        s.cust_code,
        s.doc_no,
        s.doc_date,
        COALESCE(s.credit_date, s.doc_date) AS due_date,
        s.trans_flag,
        COALESCE(s.doc_ref, '') AS doc_ref,
        '' AS sale_code,
        COALESCE(s.branch_code, '') AS branch_code,
        COALESCE(s.total_amount, 0)::numeric(18, 2) AS doc_amount,
        (COALESCE(p.paid_amt, 0) + COALESCE(p.fx_amt, 0))::numeric(18, 2) AS paid_amount,
        (COALESCE(s.total_amount, 0) - (COALESCE(p.paid_amt, 0) + COALESCE(p.fx_amt, 0)))::numeric(18, 2) AS ar_balance
    FROM as_trans s
    LEFT JOIN paid_ar p ON p.billing_no = s.doc_no AND p.bill_type = s.trans_flag
    WHERE COALESCE(s.last_status, 0) = 0
      AND s.trans_flag = 1802
      AND COALESCE(s.inquiry_type, 0) IN (0, 2)
      AND s.doc_date <= $1::date
      AND ($2::text = '' OR s.cust_code = $2::text)

    UNION ALL

    -- 3. ใบลดหนี้ลูกหนี้ใน ic_trans (p.paid_amt เก็บค่าติดลบ ดังนั้นยอดคงเหลือ = -1 * (total_amount + paid_amt))
    SELECT
        t.cust_code,
        t.doc_no,
        t.doc_date,
        COALESCE(t.credit_date, t.due_date, t.doc_date) AS due_date,
        t.trans_flag,
        COALESCE(t.doc_ref, '') AS doc_ref,
        COALESCE(t.sale_code, '') AS sale_code,
        COALESCE(t.branch_code, '') AS branch_code,
        (-1 * COALESCE(t.total_amount, 0))::numeric(18, 2) AS doc_amount,
        COALESCE(p.paid_amt, 0)::numeric(18, 2) AS paid_amount,
        (-1 * (COALESCE(t.total_amount, 0) + COALESCE(p.paid_amt, 0)))::numeric(18, 2) AS ar_balance
    FROM ic_trans t
    LEFT JOIN paid_ar p ON p.billing_no = t.doc_no AND p.bill_type = t.trans_flag
    WHERE COALESCE(t.last_status, 0) = 0
      AND t.doc_date <= $1::date
      AND ($2::text = '' OR t.cust_code = $2::text)
      AND (
          (t.trans_flag = 48 AND COALESCE(t.inquiry_type, 0) IN (0, 2, 4))
          OR t.trans_flag IN (97, 103)
          OR (t.trans_flag = 252 AND COALESCE(t.inquiry_type, 0) IN (0, 2))
      )
)
SELECT
    o.cust_code,
    COALESCE(c.name_1, '') AS cust_name,
    COUNT(*) FILTER (WHERE o.ar_balance > 0) AS open_invoice_count,
    COUNT(*) FILTER (WHERE o.ar_balance < 0) AS open_cn_count,
    ROUND(SUM(o.ar_balance), 2) AS net_ar_balance,
    ROUND(COALESCE(cd.credit_money, 0), 2) AS credit_limit,
    ROUND(COALESCE(cd.credit_money, 0) - SUM(o.ar_balance), 2) AS remaining_credit_limit
FROM open_ar_docs o
LEFT JOIN ar_customer c ON c.code = o.cust_code
LEFT JOIN ar_customer_detail cd ON cd.ar_code = o.cust_code
WHERE ROUND(o.ar_balance, 2) <> 0
GROUP BY o.cust_code, c.name_1, cd.credit_money
HAVING ROUND(SUM(o.ar_balance), 2) <> 0
ORDER BY net_ar_balance DESC;
```

---

## 3. ข้อควรระวัง (Gotchas)
1. **ต้อง Join `paid_ar` ด้วยทั้ง `billing_no` และ `bill_type`**: เพื่อป้องกันกรณีเลขที่เอกสารบังเอิญซ้ำกันคนละประเภทเอกสาร
2. **ห้ามนำใบวางบิล (`trans_flag = 235`) มาหักยอดลูกหนี้**: แถว `trans_flag = 235` ใน `ap_ar_trans_detail` เป็นเพียงใบแจ้งรวมบิล ยังไม่ได้รับเงินจริง ต้องกรองเฉพาะ `d.trans_flag = 239` เท่านั้น (ดูรายงานใบวางบิลที่ [[sql-ar-billing-and-receipts]])
