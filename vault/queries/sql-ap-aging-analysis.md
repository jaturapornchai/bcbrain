---
title: "SQL วิเคราะห์อายุหนี้เจ้าหนี้ (AP Aging Analysis) และการ์ดความเคลื่อนไหวเจ้าหนี้"
audience: "dev"
tags: [queries, sql, ap, aging, payable, movement]
aliases:
  - "sql อายุหนี้เจ้าหนี้ AP aging"
  - "aparAgingReport ap"
  - "aparMovementReport ap"
  - "การ์ดเจ้าหนี้รายตัว ยอดสะสม"
sources:
  - "backend/internal/application/process/report_menu_ap_ar.go:455-655"
  - "backend/internal/adapter/inbound/http/mcp/gateway.go:2123-2135"
---

# SQL วิเคราะห์อายุหนี้เจ้าหนี้ (AP Aging Analysis) และการ์ดความเคลื่อนไหวเจ้าหนี้

สกัดจาก `report_menu_ap_ar.go:aparAgingReport` และ `aparMovementReport` ฝั่งเจ้าหนี้ เพื่อแบ่งช่วงอายุหนี้คงค้าง ณ วันสิ้นงวด (`$1`) และตรวจสอบรายการเคลื่อนไหวเจ้าหนี้รายตัวเทียบกับยอดบัญชีคุมเจ้าหนี้การค้า `2111-00` (ดูเงื่อนไขรหัสเอกสารเจ้าหนี้ที่ [[doc-impact-ar-ap-deposit]])

---

## 1. ตารางวิเคราะห์อายุหนี้เจ้าหนี้รายผู้จำหน่าย ณ วันสิ้นงวด (`As-Of Date`)

### พารามิเตอร์
- `$1` (`DATE`): วันที่วิเคราะห์อายุหนี้ (As-Of Date) เช่น `'2026-11-13'`

```sql
WITH paid_ap AS (
    SELECT
        d.billing_no,
        d.bill_type,
        SUM(COALESCE(d.sum_pay_money, 0)) AS paid_amt,
        SUM(COALESCE(d.lost_profit_exchange_amount, 0)) AS fx_amt
    FROM ap_ar_trans_detail d
    JOIN ap_ar_trans h ON h.doc_no = d.doc_no AND h.trans_flag = d.trans_flag
    WHERE d.trans_flag = 19
      AND COALESCE(d.last_status, 0) = 0
      AND COALESCE(h.last_status, 0) = 0
      AND d.doc_date <= $1::date
    GROUP BY d.billing_no, d.bill_type
),
open_docs AS (
    SELECT
        t.cust_code,
        COALESCE(t.credit_date, t.due_date, t.doc_date) AS due_dt,
        (COALESCE(t.total_amount, 0) - (COALESCE(p.paid_amt, 0) + CASE WHEN t.trans_flag = 12 THEN COALESCE(p.fx_amt, 0) ELSE 0 END))::numeric(18, 2) AS bal
    FROM ic_trans t
    LEFT JOIN paid_ap p ON p.billing_no = t.doc_no AND p.bill_type = t.trans_flag
    WHERE COALESCE(t.last_status, 0) = 0
      AND t.doc_date <= $1::date
      AND ((t.trans_flag IN (12, 315, 14, 316, 260, 264) AND COALESCE(t.inquiry_type, 0) IN (0, 2)) OR t.trans_flag IN (81, 83, 87, 89))

    UNION ALL

    SELECT
        t.cust_code,
        COALESCE(t.credit_date, t.due_date, t.doc_date) AS due_dt,
        (-1 * (COALESCE(t.total_amount, 0) + COALESCE(p.paid_amt, 0)))::numeric(18, 2) AS bal
    FROM ic_trans t
    LEFT JOIN paid_ap p ON p.billing_no = t.doc_no AND p.bill_type = t.trans_flag
    WHERE COALESCE(t.last_status, 0) = 0
      AND t.doc_date <= $1::date
      AND ((t.trans_flag IN (16, 317) AND COALESCE(t.inquiry_type, 0) IN (0, 1)) OR t.trans_flag IN (85, 91) OR (t.trans_flag = 262 AND COALESCE(t.inquiry_type, 0) IN (0, 2)))
)
SELECT
    o.cust_code AS supplier_code,
    COALESCE(s.name_1, '') AS supplier_name,
    ROUND(SUM(CASE WHEN o.bal > 0 AND ($1::date - o.due_dt) <= 0 THEN o.bal ELSE 0 END), 2) AS not_yet_due,
    ROUND(SUM(CASE WHEN o.bal > 0 AND ($1::date - o.due_dt) BETWEEN 1 AND 30 THEN o.bal ELSE 0 END), 2) AS overdue_1_30,
    ROUND(SUM(CASE WHEN o.bal > 0 AND ($1::date - o.due_dt) BETWEEN 31 AND 60 THEN o.bal ELSE 0 END), 2) AS overdue_31_60,
    ROUND(SUM(CASE WHEN o.bal > 0 AND ($1::date - o.due_dt) BETWEEN 61 AND 90 THEN o.bal ELSE 0 END), 2) AS overdue_61_90,
    ROUND(SUM(CASE WHEN o.bal > 0 AND ($1::date - o.due_dt) > 90 THEN o.bal ELSE 0 END), 2) AS overdue_over_90,
    ROUND(SUM(CASE WHEN o.bal < 0 THEN o.bal ELSE 0 END), 2) AS unapplied_cn,
    ROUND(SUM(o.bal), 2) AS net_ap_total
FROM open_docs o
LEFT JOIN ap_supplier s ON s.code = o.cust_code
WHERE ROUND(o.bal, 2) <> 0
GROUP BY o.cust_code, s.name_1
HAVING ROUND(SUM(o.bal), 2) <> 0
ORDER BY overdue_over_90 DESC, net_ap_total DESC;
```

---

## 2. สรุปยอดเคลื่อนไหวเจ้าหนี้รายตัว (ยกมา + ตั้งหนี้ - ลดหนี้ - จ่ายชำระ = ยอดยกไป)

สกัดจาก `aparStatusReport` (`report_menu_ap_ar.go:399-448`) สำหรับกระทบยอดเจ้าหนี้ทั้งบริษัทในช่วงวันที่ `$1` ถึง `$2`:

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้นงวด
- `$2` (`DATE`): วันที่สิ้นสุดงวด

```sql
WITH ap_events AS (
    SELECT t.cust_code, t.doc_date,
           COALESCE(t.total_amount, 0)::numeric(18, 2) AS inc_amt,
           0::numeric(18, 2) AS dec_amt
    FROM ic_trans t
    WHERE COALESCE(t.last_status, 0) = 0
      AND t.doc_date <= $2::date
      AND ((t.trans_flag IN (12, 315, 14, 316, 260, 264) AND COALESCE(t.inquiry_type, 0) IN (0, 2)) OR t.trans_flag IN (81, 83, 87, 89))

    UNION ALL

    SELECT t.cust_code, t.doc_date,
           0::numeric(18, 2) AS inc_amt,
           COALESCE(t.total_amount, 0)::numeric(18, 2) AS dec_amt
    FROM ic_trans t
    WHERE COALESCE(t.last_status, 0) = 0
      AND t.doc_date <= $2::date
      AND ((t.trans_flag IN (16, 317) AND COALESCE(t.inquiry_type, 0) IN (0, 1)) OR t.trans_flag IN (85, 91) OR (t.trans_flag = 262 AND COALESCE(t.inquiry_type, 0) IN (0, 2)))

    UNION ALL

    SELECT h.cust_code, d.doc_date,
           0::numeric(18, 2) AS inc_amt,
           (COALESCE(d.sum_pay_money, 0) + CASE WHEN d.bill_type = 12 THEN COALESCE(d.lost_profit_exchange_amount, 0) ELSE 0 END)::numeric(18, 2) AS dec_amt
    FROM ap_ar_trans_detail d
    JOIN ap_ar_trans h ON h.doc_no = d.doc_no AND h.trans_flag = d.trans_flag
    WHERE d.trans_flag = 19
      AND COALESCE(d.last_status, 0) = 0
      AND COALESCE(h.last_status, 0) = 0
      AND d.doc_date <= $2::date
)
SELECT
    e.cust_code AS supplier_code,
    COALESCE(s.name_1, '') AS supplier_name,
    ROUND(SUM(CASE WHEN e.doc_date < $1::date THEN e.inc_amt - e.dec_amt ELSE 0 END), 2) AS opening_ap,
    ROUND(SUM(CASE WHEN e.doc_date >= $1::date THEN e.inc_amt ELSE 0 END), 2) AS period_increase,
    ROUND(SUM(CASE WHEN e.doc_date >= $1::date THEN e.dec_amt ELSE 0 END), 2) AS period_decrease,
    ROUND(SUM(e.inc_amt - e.dec_amt), 2) AS closing_ap
FROM ap_events e
LEFT JOIN ap_supplier s ON s.code = e.cust_code
GROUP BY e.cust_code, s.name_1
HAVING ROUND(SUM(CASE WHEN e.doc_date < $1::date THEN e.inc_amt - e.dec_amt ELSE 0 END), 2) <> 0
    OR ROUND(SUM(CASE WHEN e.doc_date >= $1::date THEN e.inc_amt ELSE 0 END), 2) <> 0
    OR ROUND(SUM(CASE WHEN e.doc_date >= $1::date THEN e.dec_amt ELSE 0 END), 2) <> 0
ORDER BY closing_ap DESC, e.cust_code ASC;
```

---

## 3. ข้อควรระวัง (Gotchas)
- **การเรียกผ่าน MCP Tool สำเร็จรูป**: สามารถใช้ `bc_financial_summary` โดยส่ง `summary_type = "ap_aging"` และ `date_to = "2026-11-13"` เพื่อดึงสรุปอายุหนี้เจ้าหนี้อย่างรวดเร็วได้ (ดู [[api-mcp-gateway]])
