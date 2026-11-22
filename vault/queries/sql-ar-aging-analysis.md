---
title: "SQL วิเคราะห์อายุหนี้ลูกหนี้ (AR Aging Analysis) และสรุปบิลเกินกำหนดชำระ"
audience: "dev"
tags: [queries, sql, ar, aging, overdue, receivable]
aliases:
  - "sql อายุหนี้ลูกหนี้ AR aging"
  - "sql ลูกหนี้เกินกำหนดชำระ overdue"
  - "aparAgingReport ar"
  - "arOverdueSQL"
  - "แบ่งช่วงอายุหนี้ 1-30 31-60 61-90 >90 วัน"
sources:
  - "backend/internal/application/process/report_menu_ap_ar.go:578-655"
  - "backend/internal/adapter/inbound/http/mcp/gateway.go:2110-2122"
  - "backend/internal/adapter/inbound/http/ai/context_sales_ar.go:38-55"
---

# SQL วิเคราะห์อายุหนี้ลูกหนี้ (AR Aging Analysis) และสรุปบิลเกินกำหนดชำระ

รายงานอายุหนี้ลูกหนี้มาตรฐาน (`report_menu_ap_ar.go:aparAgingReport`) คำนวณจำนวนวันเกินกำหนดจาก **`($1::date - COALESCE(credit_date, due_date, doc_date))`** ณ วันสิ้นงวด (`$1`) โดยแบ่งเป็นช่วง **ยังไม่ครบกำหนด (`<= 0` วัน), `1–30` วัน, `31–60` วัน, `61–90` วัน และเกิน `90` วัน** พร้อมแยกคอลัมน์ใบลดหนี้คงค้างให้ตรวจสอบได้ชัดเจน (ดูสูตรบิลคงค้างพื้นฐานที่ [[sql-ar-outstanding-invoices]])

---

## 1. ตารางวิเคราะห์อายุหนี้ลูกหนี้รายตัว ณ วันสิ้นงวด (`As-Of Date`)

### พารามิเตอร์
- `$1` (`DATE`): วันที่วิเคราะห์อายุหนี้ (As-Of Date) เช่น `'2026-11-13'`

```sql
WITH paid_ar AS (
    SELECT
        d.billing_no,
        d.bill_type,
        SUM(COALESCE(d.sum_pay_money, 0)) AS paid_amt,
        SUM(COALESCE(d.lost_profit_exchange_amount, 0)) AS fx_amt
    FROM ap_ar_trans_detail d
    JOIN ap_ar_trans h ON h.doc_no = d.doc_no AND h.trans_flag = d.trans_flag
    WHERE d.trans_flag = 239
      AND COALESCE(d.last_status, 0) = 0
      AND COALESCE(h.last_status, 0) = 0
      AND d.doc_date <= $1::date
    GROUP BY d.billing_no, d.bill_type
),
open_docs AS (
    SELECT
        t.cust_code,
        COALESCE(t.credit_date, t.due_date, t.doc_date) AS due_dt,
        (COALESCE(t.total_amount, 0) - (COALESCE(p.paid_amt, 0) + CASE WHEN t.trans_flag = 44 THEN COALESCE(p.fx_amt, 0) ELSE 0 END))::numeric(18, 2) AS bal
    FROM ic_trans t
    LEFT JOIN paid_ar p ON p.billing_no = t.doc_no AND p.bill_type = t.trans_flag
    WHERE COALESCE(t.last_status, 0) = 0
      AND t.doc_date <= $1::date
      AND ((t.trans_flag IN (44, 46, 250, 254) AND COALESCE(t.inquiry_type, 0) IN (0, 2)) OR t.trans_flag IN (93, 95, 99, 101))

    UNION ALL

    SELECT
        s.cust_code,
        COALESCE(s.credit_date, s.doc_date) AS due_dt,
        (COALESCE(s.total_amount, 0) - (COALESCE(p.paid_amt, 0) + COALESCE(p.fx_amt, 0)))::numeric(18, 2) AS bal
    FROM as_trans s
    LEFT JOIN paid_ar p ON p.billing_no = s.doc_no AND p.bill_type = s.trans_flag
    WHERE COALESCE(s.last_status, 0) = 0
      AND s.trans_flag = 1802
      AND COALESCE(s.inquiry_type, 0) IN (0, 2)
      AND s.doc_date <= $1::date

    UNION ALL

    SELECT
        t.cust_code,
        COALESCE(t.credit_date, t.due_date, t.doc_date) AS due_dt,
        (-1 * (COALESCE(t.total_amount, 0) + COALESCE(p.paid_amt, 0)))::numeric(18, 2) AS bal
    FROM ic_trans t
    LEFT JOIN paid_ar p ON p.billing_no = t.doc_no AND p.bill_type = t.trans_flag
    WHERE COALESCE(t.last_status, 0) = 0
      AND t.doc_date <= $1::date
      AND ((t.trans_flag = 48 AND COALESCE(t.inquiry_type, 0) IN (0, 2, 4)) OR t.trans_flag IN (97, 103) OR (t.trans_flag = 252 AND COALESCE(t.inquiry_type, 0) IN (0, 2)))
)
SELECT
    o.cust_code,
    COALESCE(c.name_1, '') AS cust_name,
    ROUND(SUM(CASE WHEN o.bal > 0 AND ($1::date - o.due_dt) <= 0 THEN o.bal ELSE 0 END), 2) AS not_yet_due,
    ROUND(SUM(CASE WHEN o.bal > 0 AND ($1::date - o.due_dt) BETWEEN 1 AND 30 THEN o.bal ELSE 0 END), 2) AS overdue_1_30,
    ROUND(SUM(CASE WHEN o.bal > 0 AND ($1::date - o.due_dt) BETWEEN 31 AND 60 THEN o.bal ELSE 0 END), 2) AS overdue_31_60,
    ROUND(SUM(CASE WHEN o.bal > 0 AND ($1::date - o.due_dt) BETWEEN 61 AND 90 THEN o.bal ELSE 0 END), 2) AS overdue_61_90,
    ROUND(SUM(CASE WHEN o.bal > 0 AND ($1::date - o.due_dt) > 90 THEN o.bal ELSE 0 END), 2) AS overdue_over_90,
    ROUND(SUM(CASE WHEN o.bal < 0 THEN o.bal ELSE 0 END), 2) AS unapplied_cn,
    ROUND(SUM(o.bal), 2) AS net_ar_total
FROM open_docs o
LEFT JOIN ar_customer c ON c.code = o.cust_code
WHERE ROUND(o.bal, 2) <> 0
GROUP BY o.cust_code, c.name_1
HAVING ROUND(SUM(o.bal), 2) <> 0
ORDER BY overdue_over_90 DESC, net_ar_total DESC;
```

### คอลัมน์ผลลัพธ์หลัก
- `not_yet_due`: ยอดหนี้ที่ยังไม่ถึงวันครบกำหนด (`due_dt >= $1`)
- `overdue_1_30` .. `overdue_over_90`: ยอดหนี้เกินกำหนดชำระแยกตามช่วงวัน
- `unapplied_cn`: ยอดใบลดหนี้คงค้างที่ยังไม่ได้นำไปตัดกับใบเสร็จรับเงิน (ค่าติดลบ)
- `net_ar_total`: ยอดลูกหนี้สุทธิ (`not_yet_due + overdue_* + unapplied_cn`) ซึ่งต้องตรงกับยอดลูกหนี้สุทธิใน [[sql-ar-outstanding-invoices]]

---

## 2. รายการบิลเกินกำหนดชำระเร่งด่วน สำหรับติดตามทวงถาม (`arOverdueSQL`)

ดัดแปลงจาก `context_sales_ar.go:arOverdueSQL` สำหรับงานแจ้งเตือนติดตามหนี้ประจำวัน (Morning Briefing / AI Copilot):

### พารามิเตอร์
- `$1` (`DATE`): วันที่ปัจจุบัน

```sql
SELECT
    t.cust_code,
    COALESCE(c.name_1, '') AS cust_name,
    t.doc_no,
    t.doc_date,
    COALESCE(t.credit_date, t.due_date, t.doc_date) AS due_date,
    ($1::date - COALESCE(t.credit_date, t.due_date, t.doc_date)) AS days_past_due,
    ROUND(
        COALESCE(t.total_amount, 0) - COALESCE((
            SELECT SUM(COALESCE(d.sum_pay_money, 0) + CASE WHEN t.trans_flag = 44 THEN COALESCE(d.lost_profit_exchange_amount, 0) ELSE 0 END)
            FROM ap_ar_trans_detail d
            WHERE d.trans_flag = 239
              AND COALESCE(d.last_status, 0) = 0
              AND d.billing_no = t.doc_no
              AND d.bill_type = t.trans_flag
        ), 0),
        2
    ) AS overdue_balance
FROM ic_trans t
LEFT JOIN ar_customer c ON c.code = t.cust_code
WHERE COALESCE(t.last_status, 0) = 0
  AND ((t.trans_flag IN (44, 46, 250, 254) AND COALESCE(t.inquiry_type, 0) IN (0, 2)) OR t.trans_flag IN (93, 95, 99, 101))
  AND COALESCE(t.credit_date, t.due_date, t.doc_date) < $1::date
  AND (
      COALESCE(t.total_amount, 0) - COALESCE((
          SELECT SUM(COALESCE(d.sum_pay_money, 0) + CASE WHEN t.trans_flag = 44 THEN COALESCE(d.lost_profit_exchange_amount, 0) ELSE 0 END)
          FROM ap_ar_trans_detail d
          WHERE d.trans_flag = 239 AND COALESCE(d.last_status, 0) = 0 AND d.billing_no = t.doc_no AND d.bill_type = t.trans_flag
      ), 0)
  ) > 0.009
ORDER BY days_past_due DESC, overdue_balance DESC;
```

---

## 3. ข้อควรระวัง (Gotchas)
1. **ลำดับความสำคัญของวันครบกำหนด (`COALESCE(credit_date, due_date, doc_date)`)**: หน้าจอบิลขายและตั้งหนี้ใน BC บันทึกวันครบกำหนดเครดิตลงใน `credit_date` เป็นหลัก (ส่วนบางตารางเสริมใช้ `due_date`) หากทั้งสองเป็น `NULL` ให้ใช้วันที่เอกสาร `doc_date` แทน
2. **การเรียกผ่าน MCP Tool สำเร็จรูป**: สามารถเรียก `bc_financial_summary` ด้วย `summary_type = "ar_aging"` และ `date_to = "2026-11-13"` ได้เช่นกัน (ดู [[api-mcp-gateway]])
