---
title: "SQL ใบวางบิลลูกหนี้ (235) ใบเสร็จรับเงินประจำวัน (239) และการ์ดเคลื่อนไหวลูกหนี้"
audience: "dev"
tags: [queries, sql, ar, billing_note, receipt, movement, ap_ar_trans]
aliases:
  - "sql ใบวางบิลลูกหนี้ 235"
  - "sql ใบเสร็จรับเงินประจำวัน 239"
  - "aparReceiptDaily sql"
  - "aparMovementReport ar"
  - "รายงานการรับชำระหนี้แยกช่องทาง เงินสด โอน เช็ค"
sources:
  - "backend/internal/application/process/report_menu_ap_ar.go:293-422"
  - "backend/internal/application/process/report_menu_ap_ar.go:455-535"
---

# SQL ใบวางบิลลูกหนี้ (`235`) ใบเสร็จรับเงินประจำวัน (`239`) และการ์ดเคลื่อนไหวลูกหนี้

ตาราง `ap_ar_trans` เก็บเอกสารของระบบลูกหนี้ 2 ประเภทหลัก คือ **ใบวางบิล (`trans_flag = 235`)** และ **ใบรับชำระหนี้/ใบเสร็จรับเงิน (`trans_flag = 239`)** โดยมีรายละเอียดบิลที่นำมาวางบิลหรือตัดชำระใน `ap_ar_trans_detail` และรายละเอียดช่องทางการรับเงินใน `cb_trans` (ดูบทบาทตารางที่ [[doc-impact-ar-ap-deposit]])

---

## 1. รายงานใบเสร็จรับเงินประจำวัน พร้อมแจกแจงช่องทางการรับชำระ (`aparReceiptDaily`)

สกัดจาก `report_menu_ap_ar.go:353-395` เพื่อดูยอดรับชำระหนี้แต่ละใบ แยกเงินสด เงินโอน เช็ครับ บัตรเครดิต ตัดมัดจำ และภาษีถูกหัก ณ ที่จ่าย:

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้น
- `$2` (`DATE`): วันที่สิ้นสุด

```sql
SELECT
    h.doc_date,
    h.doc_no AS receipt_no,
    COALESCE(h.cust_code, '') AS cust_code,
    COALESCE(c.name_1, '') AS cust_name,
    ROUND(COALESCE(h.total_net_amount, h.total_pay_money, 0), 2) AS settled_ar_amount,
    ROUND(COALESCE(cb.cash_amount, 0), 2) AS cash_amount,
    ROUND(COALESCE(cb.sum_amount_transfer, 0), 2) AS transfer_amount,
    ROUND(COALESCE(cb.sum_amount_chq, 0), 2) AS cheque_amount,
    ROUND(COALESCE(cb.sum_amount_credit_card, 0), 2) AS card_amount,
    ROUND(COALESCE(cb.sum_advance_amount, 0) + COALESCE(cb.sum_deposit_amount, 0), 2) AS deposit_applied,
    ROUND(COALESCE(cb.total_tax_at_pay, 0), 2) AS wht_deducted_50tawi,
    ROUND(COALESCE(h.lost_profit_exchange_amount, 0), 2) AS fx_diff_amount,
    COALESCE(h.remark, '') AS remark
FROM ap_ar_trans h
LEFT JOIN ar_customer c
  ON c.code = h.cust_code
LEFT JOIN cb_trans cb
  ON cb.doc_no = h.doc_no
 AND cb.trans_flag = h.trans_flag
 AND COALESCE(cb.last_status, 0) = 0
WHERE h.trans_flag = 239
  AND COALESCE(h.last_status, 0) = 0
  AND h.doc_date BETWEEN $1::date AND $2::date
ORDER BY h.doc_date ASC, h.doc_no ASC;
```

---

## 2. รายงานใบวางบิลลูกหนี้ที่รอรับชำระ (`trans_flag = 235` และบิลข้างในยังค้างชำระ)

ตรวจสอบว่าใบวางบิลใบใดวางบิลไปแล้ว นัดรับชำระเมื่อใด และมียอดคงเหลือที่ยังไม่ได้ออกใบเสร็จ (`239`) เท่าใด:

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้นใบวางบิล
- `$2` (`DATE`): วันที่สิ้นสุดใบวางบิล

```sql
SELECT
    b.doc_date AS billing_date,
    b.doc_no AS billing_no,
    b.due_date AS appoint_pay_date,
    COALESCE(b.cust_code, '') AS cust_code,
    COALESCE(c.name_1, '') AS cust_name,
    d.billing_no AS invoice_no,
    d.billing_date AS invoice_date,
    d.bill_type AS invoice_flag,
    ROUND(COALESCE(d.sum_pay_money, d.sum_debt_amount, 0), 2) AS billed_amount,
    ROUND(COALESCE((
        SELECT SUM(COALESCE(r.sum_pay_money, 0))
        FROM ap_ar_trans_detail r
        JOIN ap_ar_trans rh ON rh.doc_no = r.doc_no AND rh.trans_flag = r.trans_flag
        WHERE r.trans_flag = 239
          AND COALESCE(r.last_status, 0) = 0
          AND COALESCE(rh.last_status, 0) = 0
          AND r.billing_no = d.billing_no
          AND r.bill_type = d.bill_type
    ), 0), 2) AS received_amount
FROM ap_ar_trans b
JOIN ap_ar_trans_detail d
  ON d.doc_no = b.doc_no AND d.trans_flag = b.trans_flag
LEFT JOIN ar_customer c
  ON c.code = b.cust_code
WHERE b.trans_flag = 235
  AND COALESCE(b.last_status, 0) = 0
  AND COALESCE(d.last_status, 0) = 0
  AND b.doc_date BETWEEN $1::date AND $2::date
ORDER BY COALESCE(b.due_date, b.doc_date) ASC, b.doc_no ASC, d.line_number ASC;
```

---

## 3. การ์ดความเคลื่อนไหวลูกหนี้รายตัว พร้อมยอดสะสม (`aparMovementReport`)

สกัดจาก `report_menu_ap_ar.go:399-535` แสดงยอดยกมาก่อน `$1` บวกตั้งหนี้/เพิ่มหนี้ หักลดหนี้และรับชำระหนี้ในงวด พร้อมยอดคงเหลือสะสมรายบรรทัด (`SUM(...) OVER`):

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้นงวด
- `$2` (`DATE`): วันที่สิ้นสุดงวด
- `$3` (`TEXT`): รหัสลูกหนี้ (`cust_code`) เช่น `'AR-0001'`

```sql
WITH ar_moves AS (
    -- ตั้งหนี้และเพิ่มหนี้ใน ic_trans (+)
    SELECT t.cust_code, t.doc_date, t.doc_no, t.trans_flag,
           COALESCE(t.total_amount, 0)::numeric(18, 2) AS debit_ar,
           0::numeric(18, 2) AS credit_ar
    FROM ic_trans t
    WHERE COALESCE(t.last_status, 0) = 0
      AND t.cust_code = $3
      AND t.doc_date <= $2::date
      AND ((t.trans_flag IN (44, 46, 250, 254) AND COALESCE(t.inquiry_type, 0) IN (0, 2)) OR t.trans_flag IN (93, 95, 99, 101))

    UNION ALL

    -- ขายสินทรัพย์เงินเชื่อใน as_trans (+)
    SELECT s.cust_code, s.doc_date, s.doc_no, s.trans_flag,
           COALESCE(s.total_amount, 0)::numeric(18, 2) AS debit_ar,
           0::numeric(18, 2) AS credit_ar
    FROM as_trans s
    WHERE COALESCE(s.last_status, 0) = 0
      AND s.cust_code = $3
      AND s.trans_flag = 1802
      AND COALESCE(s.inquiry_type, 0) IN (0, 2)
      AND s.doc_date <= $2::date

    UNION ALL

    -- ใบลดหนี้ลูกหนี้ (-)
    SELECT t.cust_code, t.doc_date, t.doc_no, t.trans_flag,
           0::numeric(18, 2) AS debit_ar,
           COALESCE(t.total_amount, 0)::numeric(18, 2) AS credit_ar
    FROM ic_trans t
    WHERE COALESCE(t.last_status, 0) = 0
      AND t.cust_code = $3
      AND t.doc_date <= $2::date
      AND ((t.trans_flag = 48 AND COALESCE(t.inquiry_type, 0) IN (0, 2, 4)) OR t.trans_flag IN (97, 103) OR (t.trans_flag = 252 AND COALESCE(t.inquiry_type, 0) IN (0, 2)))

    UNION ALL

    -- รับชำระหนี้ 239 (- ยอดสุทธิของบิลหนี้หักบิลลดหนี้ที่ตัดในใบเสร็จนั้น)
    SELECT h.cust_code, d.doc_date, d.doc_no, d.trans_flag,
           0::numeric(18, 2) AS debit_ar,
           SUM(COALESCE(d.sum_pay_money, 0) + CASE WHEN d.bill_type IN (44, 1802) THEN COALESCE(d.lost_profit_exchange_amount, 0) ELSE 0 END)::numeric(18, 2) AS credit_ar
    FROM ap_ar_trans_detail d
    JOIN ap_ar_trans h ON h.doc_no = d.doc_no AND h.trans_flag = d.trans_flag
    WHERE d.trans_flag = 239
      AND COALESCE(d.last_status, 0) = 0
      AND COALESCE(h.last_status, 0) = 0
      AND h.cust_code = $3
      AND d.doc_date <= $2::date
    GROUP BY h.cust_code, d.doc_date, d.doc_no, d.trans_flag
),
opening AS (
    SELECT COALESCE(SUM(debit_ar - credit_ar), 0)::numeric(18, 2) AS bf_balance
    FROM ar_moves
    WHERE doc_date < $1::date
),
period_rows AS (
    SELECT 0 AS sort_grp, $1::date AS doc_date, 'BF' AS doc_no, 0 AS trans_flag,
           0::numeric(18, 2) AS debit_ar, 0::numeric(18, 2) AS credit_ar,
           bf_balance AS net_change
    FROM opening
    UNION ALL
    SELECT 1 AS sort_grp, doc_date, doc_no, trans_flag,
           debit_ar, credit_ar, (debit_ar - credit_ar) AS net_change
    FROM ar_moves
    WHERE doc_date >= $1::date
)
SELECT
    doc_date,
    doc_no,
    trans_flag,
    ROUND(debit_ar, 2) AS debit_increase,
    ROUND(credit_ar, 2) AS credit_decrease,
    ROUND(SUM(net_change) OVER (ORDER BY sort_grp ASC, doc_date ASC, doc_no ASC, trans_flag ASC), 2) AS running_ar_balance
FROM period_rows
ORDER BY sort_grp ASC, doc_date ASC, doc_no ASC, trans_flag ASC;
```

---

## 4. ข้อควรระวัง (Gotchas)
- **ใน CTE การ์ดลูกหนี้ บรรทัด `239` หักใบลดหนี้โดยอัตโนมัติ**: เพราะเมื่อใบลดหนี้ถูกหักไปแล้วในบรรทัดของตัวใบลดหนี้เอง (`credit_ar = total_amount`) ตอนนำใบลดหนี้ไปผูกในใบเสร็จ `239` คอลัมน์ `d.sum_pay_money` ของแถวใบลดหนี้จะมีค่าติดลบ จึงลดยอด `SUM(d.sum_pay_money)` ของใบเสร็จลงพอดีกับเงินที่รับจริง ทำให้ไม่เกิดการหักลดหนี้ซ้ำสองรอบ!
