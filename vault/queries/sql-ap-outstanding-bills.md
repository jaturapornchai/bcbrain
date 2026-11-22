---
title: "SQL บิลเจ้าหนี้คงค้างรายเอกสารและตารางนัดจ่ายตามวันครบกำหนด (AP Outstanding Bills)"
audience: "dev"
tags: [queries, sql, ap, payable, open_bills, credit_note, due_date]
aliases:
  - "sql เจ้าหนี้คงค้าง"
  - "sql บิลเจ้าหนี้รอจ่ายชำระ"
  - "aparOpenDocsCTE ap"
  - "ตารางนัดจ่ายชำระหนี้เจ้าหนี้ตาม due_date"
  - "เจ้าหนี้การค้ารายตัว หักใบลดหนี้ซื้อ 16 317"
sources:
  - "backend/internal/application/process/report_menu_ap_ar.go:541-573"
  - "backend/internal/application/process/report_menu_ap_ar.go:659-758"
  - "backend/internal/application/process/docs.go:600-690"
---

# SQL บิลเจ้าหนี้คงค้างรายเอกสารและตารางนัดจ่ายตามวันครบกำหนด

สกัดตรงจาก `aparOpenDocsCTE` ฝั่งเจ้าหนี้ (`report_menu_ap_ar.go:541-573`) และ `docs.go:apDebtWhere/apCreditWhere` ครอบคลุมครบทั้ง **ซื้อเชื่อ (`12`), ตั้งหนี้ทะยอยรับ (`315`), เพิ่มหนี้ซื้อ (`14, 316`), ตั้ง/เพิ่มหนี้ย่อยและยกมา (`81, 83, 87, 89`), ค่าใช้จ่ายอื่นเชื่อ (`260, 264`) และหักใบลดหนี้เจ้าหนี้ (`16, 317, 85, 91, 262`)** (ดูกติกาเครื่องหมายลบของใบลดหนี้ที่ [[doc-impact-ar-ap-deposit]])

---

## 1. รายการบิลเจ้าหนี้คงค้างรายเอกสาร ณ วันที่ระบุ (`As-Of Date`)

### พารามิเตอร์
- `$1` (`DATE`): วันที่สิ้นสุดการคำนวณยอดคงค้าง (As-Of Date) เช่น `'2026-11-13'`
- `$2` (`TEXT`): รหัสเจ้าหนี้ (`cust_code`) — ส่ง `''` เพื่อดึงทุกราย

```sql
WITH paid_ap AS (
    SELECT
        d.billing_no,
        d.bill_type,
        SUM(COALESCE(d.sum_pay_money, 0)) AS paid_amt,
        SUM(COALESCE(d.lost_profit_exchange_amount, 0)) AS fx_amt
    FROM ap_ar_trans_detail d
    JOIN ap_ar_trans h
      ON h.doc_no = d.doc_no AND h.trans_flag = d.trans_flag
    WHERE d.trans_flag = 19
      AND COALESCE(d.last_status, 0) = 0
      AND COALESCE(h.last_status, 0) = 0
      AND d.doc_date <= $1::date
    GROUP BY d.billing_no, d.bill_type
),
open_ap_docs AS (
    -- 1. บิลตั้งหนี้และเพิ่มหนี้เจ้าหนี้ (ยอดบวก)
    SELECT
        t.cust_code,
        t.doc_no,
        t.doc_date,
        COALESCE(t.credit_date, t.due_date, t.doc_date) AS due_date,
        t.trans_flag,
        COALESCE(t.tax_doc_no, '') AS supplier_inv_no,
        COALESCE(t.branch_code, '') AS branch_code,
        COALESCE(t.total_amount, 0)::numeric(18, 2) AS doc_amount,
        (COALESCE(p.paid_amt, 0) + CASE WHEN t.trans_flag = 12 THEN COALESCE(p.fx_amt, 0) ELSE 0 END)::numeric(18, 2) AS paid_amount,
        (COALESCE(t.total_amount, 0) - (COALESCE(p.paid_amt, 0) + CASE WHEN t.trans_flag = 12 THEN COALESCE(p.fx_amt, 0) ELSE 0 END))::numeric(18, 2) AS ap_balance
    FROM ic_trans t
    LEFT JOIN paid_ap p ON p.billing_no = t.doc_no AND p.bill_type = t.trans_flag
    WHERE COALESCE(t.last_status, 0) = 0
      AND t.doc_date <= $1::date
      AND ($2::text = '' OR t.cust_code = $2::text)
      AND (
          (t.trans_flag IN (12, 315, 14, 316, 260, 264) AND COALESCE(t.inquiry_type, 0) IN (0, 2))
          OR t.trans_flag IN (81, 83, 87, 89)
      )

    UNION ALL

    -- 2. ใบลดหนี้เจ้าหนี้ (p.paid_amt เก็บค่าติดลบ ดังนั้นยอดคงเหลือ = -1 * (total_amount + paid_amt))
    SELECT
        t.cust_code,
        t.doc_no,
        t.doc_date,
        COALESCE(t.credit_date, t.due_date, t.doc_date) AS due_date,
        t.trans_flag,
        COALESCE(t.tax_doc_no, '') AS supplier_inv_no,
        COALESCE(t.branch_code, '') AS branch_code,
        (-1 * COALESCE(t.total_amount, 0))::numeric(18, 2) AS doc_amount,
        COALESCE(p.paid_amt, 0)::numeric(18, 2) AS paid_amount,
        (-1 * (COALESCE(t.total_amount, 0) + COALESCE(p.paid_amt, 0)))::numeric(18, 2) AS ap_balance
    FROM ic_trans t
    LEFT JOIN paid_ap p ON p.billing_no = t.doc_no AND p.bill_type = t.trans_flag
    WHERE COALESCE(t.last_status, 0) = 0
      AND t.doc_date <= $1::date
      AND ($2::text = '' OR t.cust_code = $2::text)
      AND (
          (t.trans_flag IN (16, 317) AND COALESCE(t.inquiry_type, 0) IN (0, 1))
          OR t.trans_flag IN (85, 91)
          OR (t.trans_flag = 262 AND COALESCE(t.inquiry_type, 0) IN (0, 2))
      )
)
SELECT
    o.cust_code AS supplier_code,
    COALESCE(s.name_1, '') AS supplier_name,
    o.doc_date,
    o.due_date,
    o.doc_no,
    o.supplier_inv_no,
    o.trans_flag,
    ($1::date - o.due_date) AS overdue_days,
    ROUND(o.doc_amount, 2) AS original_amount,
    ROUND(o.paid_amount, 2) AS settled_amount,
    ROUND(o.ap_balance, 2) AS open_balance
FROM open_ap_docs o
LEFT JOIN ap_supplier s ON s.code = o.cust_code
WHERE ROUND(o.ap_balance, 2) <> 0
ORDER BY o.due_date ASC, o.cust_code ASC, o.doc_no ASC;
```

---

## 2. สรุปแผนจ่ายชำระเงินเจ้าหนี้ตามวันครบกำหนด (`Due Schedule`)

ใช้จัดเตรียมกระแสเงินสดจ่ายล่วงหน้า ณ วันที่ระบุ `$1::date` (As-Of Date เช่น `CURRENT_DATE`) โดยส่ง `$2::text = ''` เพื่อดูเจ้าหนี้ทุกราย หรือระบุรหัสเจ้าหนี้เฉพาะราย (คัดลอกรันเดี่ยวได้ทันที):

```sql
WITH paid_ap AS (
    SELECT
        d.billing_no,
        d.bill_type,
        SUM(COALESCE(d.sum_pay_money, 0)) AS paid_amt,
        SUM(COALESCE(d.lost_profit_exchange_amount, 0)) AS fx_amt
    FROM ap_ar_trans_detail d
    JOIN ap_ar_trans h
      ON h.doc_no = d.doc_no AND h.trans_flag = d.trans_flag
    WHERE d.trans_flag = 19
      AND COALESCE(d.last_status, 0) = 0
      AND COALESCE(h.last_status, 0) = 0
      AND d.doc_date <= $1::date
    GROUP BY d.billing_no, d.bill_type
),
open_ap_docs AS (
    -- 1. บิลตั้งหนี้และเพิ่มหนี้เจ้าหนี้ (ยอดบวก)
    SELECT
        t.cust_code,
        t.doc_no,
        t.doc_date,
        COALESCE(t.credit_date, t.due_date, t.doc_date) AS due_date,
        t.trans_flag,
        COALESCE(t.tax_doc_no, '') AS supplier_inv_no,
        COALESCE(t.branch_code, '') AS branch_code,
        COALESCE(t.total_amount, 0)::numeric(18, 2) AS doc_amount,
        (COALESCE(p.paid_amt, 0) + CASE WHEN t.trans_flag = 12 THEN COALESCE(p.fx_amt, 0) ELSE 0 END)::numeric(18, 2) AS paid_amount,
        (COALESCE(t.total_amount, 0) - (COALESCE(p.paid_amt, 0) + CASE WHEN t.trans_flag = 12 THEN COALESCE(p.fx_amt, 0) ELSE 0 END))::numeric(18, 2) AS ap_balance
    FROM ic_trans t
    LEFT JOIN paid_ap p ON p.billing_no = t.doc_no AND p.bill_type = t.trans_flag
    WHERE COALESCE(t.last_status, 0) = 0
      AND t.doc_date <= $1::date
      AND ($2::text = '' OR t.cust_code = $2::text)
      AND (
          (t.trans_flag IN (12, 315, 14, 316, 260, 264) AND COALESCE(t.inquiry_type, 0) IN (0, 2))
          OR t.trans_flag IN (81, 83, 87, 89)
      )

    UNION ALL

    -- 2. ใบลดหนี้เจ้าหนี้ (p.paid_amt เก็บค่าติดลบ ดังนั้นยอดคงเหลือ = -1 * (total_amount + paid_amt))
    SELECT
        t.cust_code,
        t.doc_no,
        t.doc_date,
        COALESCE(t.credit_date, t.due_date, t.doc_date) AS due_date,
        t.trans_flag,
        COALESCE(t.tax_doc_no, '') AS supplier_inv_no,
        COALESCE(t.branch_code, '') AS branch_code,
        (-1 * COALESCE(t.total_amount, 0))::numeric(18, 2) AS doc_amount,
        COALESCE(p.paid_amt, 0)::numeric(18, 2) AS paid_amount,
        (-1 * (COALESCE(t.total_amount, 0) + COALESCE(p.paid_amt, 0)))::numeric(18, 2) AS ap_balance
    FROM ic_trans t
    LEFT JOIN paid_ap p ON p.billing_no = t.doc_no AND p.bill_type = t.trans_flag
    WHERE COALESCE(t.last_status, 0) = 0
      AND t.doc_date <= $1::date
      AND ($2::text = '' OR t.cust_code = $2::text)
      AND (
          (t.trans_flag IN (16, 317) AND COALESCE(t.inquiry_type, 0) IN (0, 1))
          OR t.trans_flag IN (85, 91)
          OR (t.trans_flag = 262 AND COALESCE(t.inquiry_type, 0) IN (0, 2))
      )
)
SELECT
    o.due_date,
    COUNT(*) FILTER (WHERE o.ap_balance > 0) AS bill_count,
    ROUND(SUM(CASE WHEN o.ap_balance > 0 THEN o.ap_balance ELSE 0 END), 2) AS gross_due_payable,
    ROUND(SUM(CASE WHEN o.ap_balance < 0 THEN o.ap_balance ELSE 0 END), 2) AS available_cn_deduction,
    ROUND(SUM(o.ap_balance), 2) AS net_payable_amount
FROM open_ap_docs o
WHERE ROUND(o.ap_balance, 2) <> 0
GROUP BY o.due_date
ORDER BY o.due_date ASC;
```

---

## 3. ข้อควรระวัง (Gotchas)
1. **`inquiry_type` ของใบลดหนี้ซื้อ (`16, 317`) คือ `(0, 1)`**: ต่างจากใบลดหนี้ขาย (`48`) ที่เป็น `(0, 2, 4)` เพราะในฝั่งซื้อ `inquiry_type = 0` คือส่งคืนสินค้าหักหนี้เชื่อ และ `1` คือลดหนี้ราคาผิดหักหนี้เชื่อ (ส่วน `2, 3` คือรับเงินสดคืน ไม่กระทบเจ้าหนี้)
2. **ใบทะยอยรับสินค้า (`310`) ไม่รวมใน `open_ap_docs`**: เพราะ `310` ยังไม่ได้รับใบแจ้งหนี้/ใบกำกับภาษี (พักอยู่ใน `2113-00` ตาม [[sql-buy-pr-po-grn-backlog]]) เมื่อเปิดใบตั้งหนี้ `315` แล้วจึงจะกลายเป็นเจ้าหนี้การค้าใน Query นี้
