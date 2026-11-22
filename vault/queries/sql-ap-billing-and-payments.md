---
title: "SQL ใบรับวางบิลเจ้าหนี้ (213) ใบจ่ายชำระหนี้ (19) และยอดคงเหลือมัดจำจ่าย (10/11)"
audience: "dev"
tags: [queries, sql, ap, billing, payment_voucher, deposit, ap_ar_trans]
aliases:
  - "sql ใบรับวางบิลเจ้าหนี้ 213"
  - "sql ใบสำคัญจ่าย จ่ายชำระหนี้เจ้าหนี้ 19"
  - "sql เงินมัดจำจ่ายคงเหลือ เงินจ่ายล่วงหน้า 10 11"
  - "apBillingByInvoice apPaymentDetail"
sources:
  - "backend/internal/application/process/report_menu_ap_ar.go:778-922"
  - "backend/internal/application/process/report_menu_sopo.go:153-180"
  - "backend/internal/application/process/trans_deposit.go:25-266"
---

# SQL ใบรับวางบิลเจ้าหนี้ (`213`) ใบจ่ายชำระหนี้ (`19`) และยอดคงเหลือมัดจำจ่าย (`10/11`)

รวมคำสั่ง SQL สำหรับตรวจสอบฝั่งจ่ายชำระเจ้าหนี้ ตั้งแต่ใบรับวางบิลที่รอทำจ่าย (`213`), รายงานการจ่ายชำระหนี้แยกตามช่องทาง (`19`) และยอดคงเหลือเงินจ่ายล่วงหน้า (`10/9010`) / เงินมัดจำจ่าย (`11/9011`) (ดูแม่แบบคู่บัญชีใบสำคัญจ่าย `DE` ได้ที่ [[doc-gl-templates-trade-apar]])

---

## 1. รายงานการจ่ายชำระหนี้เจ้าหนี้ (`trans_flag = 19`) แจกแจงช่องทางจ่ายและหัก ณ ที่จ่าย

สกัดจาก `apPaymentDetail` และ `apPaymentDayFields` (`report_menu_ap_ar.go:823-922`):

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้น
- `$2` (`DATE`): วันที่สิ้นสุด

```sql
SELECT
    h.doc_date,
    h.doc_no AS payment_doc_no,
    COALESCE(h.cust_code, '') AS supplier_code,
    COALESCE(s.name_1, '') AS supplier_name,
    ROUND(COALESCE(h.total_net_amount, h.total_pay_money, 0), 2) AS settled_ap_amount,
    ROUND(COALESCE(cb.cash_amount, 0), 2) AS cash_paid,
    ROUND(COALESCE(cb.sum_amount_transfer, 0), 2) AS transfer_paid,
    ROUND(COALESCE(cb.sum_amount_chq, 0), 2) AS cheque_paid,
    ROUND(COALESCE(cb.petty_cash_amount, 0), 2) AS petty_cash_paid,
    ROUND(COALESCE(cb.sum_advance_amount, 0) + COALESCE(cb.sum_deposit_amount, 0), 2) AS deposit_applied,
    ROUND(COALESCE(cb.total_tax_at_pay, 0), 2) AS wht_withheld_pnd,
    ROUND(COALESCE(h.lost_profit_exchange_amount, 0), 2) AS fx_diff_amount,
    COALESCE(h.remark, '') AS remark
FROM ap_ar_trans h
LEFT JOIN ap_supplier s
  ON s.code = h.cust_code
LEFT JOIN cb_trans cb
  ON cb.doc_no = h.doc_no
 AND cb.trans_flag = h.trans_flag
 AND COALESCE(cb.last_status, 0) = 0
WHERE h.trans_flag = 19
  AND COALESCE(h.last_status, 0) = 0
  AND h.doc_date BETWEEN $1::date AND $2::date
ORDER BY h.doc_date ASC, h.doc_no ASC;
```

---

## 2. รายงานใบรับวางบิลเจ้าหนี้ที่ยังค้างจ่าย (`apBillingByInvoice`)

สกัดจาก `report_menu_ap_ar.go:778-812` แสดงใบรับวางบิล (`trans_flag = 213`) ที่รับวางบิลไว้แล้วแต่ยังจ่ายชำระ (`19`) ไม่ครบ:

### พารามิเตอร์
- `$1` (`DATE`): วันที่รับวางบิลเริ่มต้น
- `$2` (`DATE`): วันที่รับวางบิลสิ้นสุด

```sql
WITH paid_by_bill AS (
    SELECT
        p.billing_no,
        p.bill_type,
        SUM(COALESCE(p.sum_pay_money, 0))::numeric(18, 2) AS paid_amt
    FROM ap_ar_trans_detail p
    JOIN ap_ar_trans ph ON ph.doc_no = p.doc_no AND ph.trans_flag = p.trans_flag
    WHERE p.trans_flag = 19
      AND COALESCE(p.last_status, 0) = 0
      AND COALESCE(ph.last_status, 0) = 0
    GROUP BY p.billing_no, p.bill_type
)
SELECT
    b.doc_date AS billing_date,
    b.doc_no AS ap_billing_no,
    b.due_date AS scheduled_pay_date,
    COALESCE(b.cust_code, '') AS supplier_code,
    COALESCE(s.name_1, '') AS supplier_name,
    d.billing_no AS invoice_no,
    d.bill_type AS invoice_flag,
    ROUND(COALESCE(d.sum_pay_money, d.sum_debt_amount, 0), 2) AS billed_amount,
    ROUND(COALESCE(pb.paid_amt, 0), 2) AS paid_amount,
    ROUND(COALESCE(d.sum_pay_money, d.sum_debt_amount, 0) - COALESCE(pb.paid_amt, 0), 2) AS unpaid_billed_amount
FROM ap_ar_trans b
JOIN ap_ar_trans_detail d
  ON d.doc_no = b.doc_no AND d.trans_flag = b.trans_flag
LEFT JOIN ap_supplier s
  ON s.code = b.cust_code
LEFT JOIN paid_by_bill pb
  ON pb.billing_no = d.billing_no AND pb.bill_type = d.bill_type
WHERE b.trans_flag = 213
  AND COALESCE(b.last_status, 0) = 0
  AND COALESCE(d.last_status, 0) = 0
  AND b.doc_date BETWEEN $1::date AND $2::date
  AND ROUND(COALESCE(d.sum_pay_money, d.sum_debt_amount, 0) - COALESCE(pb.paid_amt, 0), 2) > 0
ORDER BY COALESCE(b.due_date, b.doc_date) ASC, b.doc_no ASC, d.line_number ASC;
```

---

## 3. รายงานเงินจ่ายล่วงหน้า (`10/9010`) และเงินมัดจำจ่าย (`11/9011`) คงเหลือรายใบ

หักยอดรับเงินคืน (`20, 25`) และยอดที่นำไปตัดในบิลซื้อ/ตั้งหนี้/ใบสำคัญจ่าย (`cb_trans_detail` `doc_type IN (5, 6)`):

### พารามิเตอร์
- `$1` (`DATE`): วันที่สิ้นสุดการคำนวณ (As-Of Date)

```sql
WITH ap_dep_returns AS (
    SELECT r.doc_ref AS dep_doc_no, SUM(COALESCE(r.total_amount, 0))::numeric(18, 2) AS ret_amt
    FROM ic_trans r
    WHERE COALESCE(r.last_status, 0) = 0
      AND r.trans_flag IN (20, 25)
      AND r.doc_date <= $1::date
      AND COALESCE(r.doc_ref, '') <> ''
    GROUP BY r.doc_ref
),
ap_dep_used AS (
    SELECT u.trans_number AS dep_doc_no, SUM(COALESCE(u.amount, 0))::numeric(18, 2) AS used_amt
    FROM cb_trans_detail u
    WHERE COALESCE(u.last_status, 0) = 0
      AND u.doc_type IN (5, 6)
      AND u.trans_flag NOT IN (10, 11, 9010, 9011)
      AND u.doc_date <= $1::date
      AND COALESCE(u.trans_number, '') <> ''
      AND (
          CASE
              WHEN u.trans_flag IN (19, 239) THEN EXISTS (
                  SELECT 1 FROM ap_ar_trans a WHERE a.doc_no = u.doc_no AND a.trans_flag = u.trans_flag AND COALESCE(a.last_status, 0) = 0
              )
              ELSE EXISTS (
                  SELECT 1 FROM ic_trans i WHERE i.doc_no = u.doc_no AND i.trans_flag = u.trans_flag AND COALESCE(i.last_status, 0) = 0
              )
          END
      )
    GROUP BY u.trans_number
)
SELECT
    t.doc_date,
    t.doc_no,
    t.trans_flag,
    CASE WHEN t.trans_flag IN (10, 9010) THEN 'เงินจ่ายล่วงหน้า (1155-00)' ELSE 'เงินมัดจำจ่าย (1156-00)' END AS deposit_type,
    COALESCE(t.cust_code, '') AS supplier_code,
    COALESCE(s.name_1, '') AS supplier_name,
    COALESCE(t.doc_ref, '') AS ref_po_no,
    ROUND(COALESCE(t.total_amount, 0), 2) AS paid_deposit,
    ROUND(COALESCE(dr.ret_amt, 0), 2) AS refunded_amount,
    ROUND(COALESCE(du.used_amt, 0), 2) AS applied_amount,
    ROUND(COALESCE(t.total_amount, 0) - COALESCE(dr.ret_amt, 0) - COALESCE(du.used_amt, 0), 2) AS remaining_balance
FROM ic_trans t
LEFT JOIN ap_supplier s ON s.code = t.cust_code
LEFT JOIN ap_dep_returns dr ON dr.dep_doc_no = t.doc_no
LEFT JOIN ap_dep_used du ON du.dep_doc_no = t.doc_no
WHERE COALESCE(t.last_status, 0) = 0
  AND t.trans_flag IN (10, 11, 9010, 9011)
  AND t.doc_date <= $1::date
  AND ROUND(COALESCE(t.total_amount, 0) - COALESCE(dr.ret_amt, 0) - COALESCE(du.used_amt, 0), 2) > 0
ORDER BY t.cust_code ASC, t.doc_date ASC, t.doc_no ASC;
```

---

## 4. ข้อควรระวัง (Gotchas)
- **เมื่อจ่ายชำระบิลบริการที่มีภาษีซื้อยังไม่ถึงกำหนด (`1152-00`)**: ใบจ่ายชำระหนี้ `19` จะสร้างแถวใน `gl_journal_vat_buy` (`vat_type = 0`, `ref_doc_no = เลขที่บิลบริการ`) เพื่อดึงภาษีซื้อเข้า ภ.พ.30 ของเดือนที่จ่ายชำระจริง (ดู [[sql-tax-vat-buy-sale-pp30]])
