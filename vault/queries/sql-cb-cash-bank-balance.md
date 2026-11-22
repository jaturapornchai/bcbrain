---
title: "SQL ความเคลื่อนไหวเงินสดในมือ วงเงินสดย่อย สมุดเงินฝากธนาคาร และพยากรณ์กระแสเงินสด"
audience: "dev"
tags: [queries, sql, cb, cash, petty_cash, passbook, cashflow, cb_trans, erp_pass_book]
aliases:
  - "sql เงินสดคงเหลือ ความเคลื่อนไหวเงินสดในมือ"
  - "sql วงเงินสดย่อย cb_petty_cash"
  - "sql สมุดเงินฝากธนาคาร ยอดคงเหลือธนาคาร erp_pass_book"
  - "sql พยากรณ์กระแสเงินสด 30 60 90 วัน"
  - "cbmRunCashMovement cbmPettyCTE cbmPassbookCTE"
sources:
  - "backend/internal/application/process/report_menu_cb.go:155-160"
  - "backend/internal/application/process/report_menu_cb.go:640-845"
  - "backend/internal/application/process/cashflow_forecast.go:146-378"
---

# SQL ความเคลื่อนไหวเงินสดในมือ วงเงินสดย่อย สมุดเงินฝากธนาคาร และพยากรณ์กระแสเงินสด

รวมคำสั่ง SQL มาตรฐานสำหรับตรวจสอบยอดเงินสดในมือ วงเงินสดย่อย (`cb_petty_cash`) สมุดเงินฝากธนาคาร (`erp_pass_book`) และพยากรณ์กระแสเงินสดล่วงหน้า 30/60/90 วัน โดยถอดตรรกะตรงจาก Engine รายงานการเงินและระบบบริหารสภาพคล่อง (ดูผลกระทบเอกสารการเงินที่ [[doc-impact-cash-bank-cheque]], แม่แบบคู่บัญชีการเงินที่ [[doc-gl-templates-cb-ic-fa]] และกฎกลางที่ [[sql-overview]])

---

## 1. รายงานความเคลื่อนไหวเงินสดในมือพร้อมยอดคงเหลือสะสม (`cbmRunCashMovement`)

สกัดจาก `cbmRunCashMovement` และ `cbmParentOK` (`report_menu_cb.go:155-160, 640-681`) รวมรายการเงินสดจาก 5 แหล่ง: ยอดยกมาเงินสด (`602`), รับเงินสด (`cb_trans.pay_type = 1`), จ่ายเงินสด (`cb_trans.pay_type = 2`), นำเงินสดฝากธนาคาร (`401`) และถอนเงินสดจากธนาคาร (`402`):

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้นงวด
- `$2` (`DATE`): วันที่สิ้นสุดงวด

```sql
WITH cash_events AS (
    -- 1) ยอดยกมาเงินสดตั้งต้น (trans_flag = 602)
    SELECT
        t.doc_date,
        t.doc_no,
        t.trans_flag,
        'ยอดยกมาเงินสด'::text AS event_type,
        COALESCE(t.total_amount, 0)::numeric(18, 2) AS cash_in,
        0::numeric(18, 2) AS cash_out,
        COALESCE(t.remark, '') AS remark
    FROM ic_trans t
    WHERE t.trans_flag = 602
      AND COALESCE(t.last_status, 0) = 0
      AND t.doc_date <= $2::date

    UNION ALL

    -- 2) รับ-จ่ายเงินสดผ่าน cb_trans (ตรวจเอกสารแม่ไม่ยกเลิกตาม cbmParentOK)
    SELECT
        cb.doc_date,
        cb.doc_no,
        cb.trans_flag,
        CASE WHEN cb.pay_type = 1 THEN 'รับเงินสด' ELSE 'จ่ายเงินสด' END AS event_type,
        CASE WHEN cb.pay_type = 1 THEN COALESCE(cb.cash_amount, 0) ELSE 0 END::numeric(18, 2) AS cash_in,
        CASE WHEN cb.pay_type = 2 THEN COALESCE(cb.cash_amount, 0) ELSE 0 END::numeric(18, 2) AS cash_out,
        COALESCE(cb.remark, '') AS remark
    FROM cb_trans cb
    WHERE COALESCE(cb.last_status, 0) = 0
      AND COALESCE(cb.cash_amount, 0) <> 0
      AND cb.pay_type IN (1, 2)
      AND cb.doc_date <= $2::date
      AND (
          (cb.trans_flag IN (19, 239) AND EXISTS (
              SELECT 1 FROM ap_ar_trans p
              WHERE p.doc_no = cb.doc_no AND p.trans_flag = cb.trans_flag AND COALESCE(p.last_status, 0) = 0
          ))
          OR (cb.trans_flag = 1802 AND EXISTS (
              SELECT 1 FROM as_trans a
              WHERE a.doc_no = cb.doc_no AND a.trans_flag = cb.trans_flag AND COALESCE(a.last_status, 0) = 0
          ))
          OR (cb.trans_flag NOT IN (19, 239, 1802) AND EXISTS (
              SELECT 1 FROM ic_trans i
              WHERE i.doc_no = cb.doc_no AND i.trans_flag = cb.trans_flag AND COALESCE(i.last_status, 0) = 0
          ))
      )

    UNION ALL

    -- 3) นำเงินสดฝากธนาคาร (401 = เงินสดออก) และถอนเงินสดจากธนาคาร (402 = เงินสดเข้า)
    SELECT
        t.doc_date,
        t.doc_no,
        t.trans_flag,
        CASE WHEN t.trans_flag = 402 THEN 'ถอนเงินสดจากธนาคาร' ELSE 'นำฝากเงินสดเข้าธนาคาร' END AS event_type,
        CASE WHEN t.trans_flag = 402 THEN COALESCE(t.cash_amount, COALESCE(t.total_amount, 0)) ELSE 0 END::numeric(18, 2) AS cash_in,
        CASE WHEN t.trans_flag = 401 THEN COALESCE(t.cash_amount, COALESCE(t.total_amount, 0)) ELSE 0 END::numeric(18, 2) AS cash_out,
        COALESCE(t.remark, '') AS remark
    FROM ic_trans t
    WHERE t.trans_flag IN (401, 402)
      AND COALESCE(t.last_status, 0) = 0
      AND t.doc_date <= $2::date
),
opening_cash AS (
    SELECT COALESCE(SUM(cash_in - cash_out), 0)::numeric(18, 2) AS opening_balance
    FROM cash_events
    WHERE doc_date < $1::date
),
period_rows AS (
    SELECT
        doc_date,
        doc_no,
        trans_flag,
        event_type,
        cash_in,
        cash_out,
        remark,
        ROW_NUMBER() OVER (ORDER BY doc_date ASC, trans_flag ASC, doc_no ASC) AS rn
    FROM cash_events
    WHERE doc_date BETWEEN $1::date AND $2::date
)
SELECT
    p.doc_date,
    p.doc_no,
    p.trans_flag,
    p.event_type,
    ROUND(o.opening_balance, 2) AS period_opening_balance,
    ROUND(p.cash_in, 2) AS cash_in,
    ROUND(p.cash_out, 2) AS cash_out,
    ROUND(
        o.opening_balance + SUM(p.cash_in - p.cash_out) OVER (ORDER BY p.rn ASC),
        2
    ) AS running_cash_balance,
    p.remark
FROM period_rows p
CROSS JOIN opening_cash o
ORDER BY p.rn ASC;
```

---

## 2. สรุปสถานะวงเงินสดย่อยและยอดคงเหลือรายวงเงิน (`cbmPettyCTE`)

สกัดจาก `cbmPettyCTE` (`report_menu_cb.go:683-763`) คำนวณยอดคงเหลือวงเงินสดย่อยจากตารางหลัก `cb_petty_cash` บวกยอดตั้ง/เบิกชดเชย (`trans_flag = 301`) หักยอดคืน/ลดวงเงิน (`trans_flag = 300`) และหักรายการจ่ายจากวงเงินสดย่อย (`cb_trans_detail.doc_type = 4`):

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้นงวด
- `$2` (`DATE`): วันที่สิ้นสุดงวด

```sql
WITH petty_tx AS (
    -- เบิกตั้ง/เพิ่ม/ชดเชยวงเงินสดย่อย (301) และคืน/ลดวงเงินสดย่อย (300)
    SELECT
        d.item_code AS petty_code,
        d.doc_date,
        CASE WHEN d.trans_flag = 301 THEN COALESCE(d.sum_amount, 0) ELSE 0 END::numeric(18, 2) AS amt_in,
        CASE WHEN d.trans_flag = 300 THEN COALESCE(d.sum_amount, 0) ELSE 0 END::numeric(18, 2) AS amt_out
    FROM ic_trans_detail d
    JOIN ic_trans h ON h.doc_no = d.doc_no AND h.trans_flag = d.trans_flag
    WHERE d.trans_flag IN (300, 301)
      AND COALESCE(d.last_status, 0) = 0
      AND COALESCE(h.last_status, 0) = 0
      AND d.doc_date <= $2::date

    UNION ALL

    -- จ่ายเงินจากวงเงินสดย่อยผ่าน cb_trans_detail (doc_type = 4)
    SELECT
        cd.trans_number AS petty_code,
        cd.doc_date,
        0::numeric(18, 2) AS amt_in,
        COALESCE(cd.sum_amount, cd.amount, 0)::numeric(18, 2) AS amt_out
    FROM cb_trans_detail cd
    JOIN cb_trans cb ON cb.doc_no = cd.doc_no AND cb.trans_flag = cd.trans_flag
    WHERE cd.doc_type = 4
      AND COALESCE(cd.last_status, 0) = 0
      AND COALESCE(cb.last_status, 0) = 0
      AND cd.doc_date <= $2::date
)
SELECT
    pc.code AS petty_cash_code,
    COALESCE(pc.name_1, '') AS petty_cash_name,
    COALESCE(pc.account_code, '') AS gl_account_code,
    ROUND(COALESCE(pc.balance_money, 0), 2) AS max_fund_limit,
    ROUND(COALESCE(SUM(t.amt_in - t.amt_out) FILTER (WHERE t.doc_date < $1::date), 0), 2) AS opening_balance,
    ROUND(COALESCE(SUM(t.amt_in) FILTER (WHERE t.doc_date BETWEEN $1::date AND $2::date), 0), 2) AS period_replenished,
    ROUND(COALESCE(SUM(t.amt_out) FILTER (WHERE t.doc_date BETWEEN $1::date AND $2::date), 0), 2) AS period_spent,
    ROUND(COALESCE(SUM(t.amt_in - t.amt_out), 0), 2) AS ending_balance
FROM cb_petty_cash pc
LEFT JOIN petty_tx t
  ON t.petty_code = pc.code
GROUP BY pc.code, pc.name_1, pc.account_code, pc.balance_money
ORDER BY pc.code ASC;
```

---

## 3. ยอดคงเหลือและรายการเดินสมุดเงินฝากธนาคาร (`cbmPassbookCTE`)

สกัดจาก `cbmPassbookCTE` (`report_menu_cb.go:765-845`) รวมความเคลื่อนไหวสมุดบัญชีธนาคาร (`erp_pass_book`) ทั้ง 4 ช่องทาง: (1) โอนรับ/โอนจ่ายใน `cb_trans_detail` (`doc_type = 1`), (2) เอกสารธนาคารใน `ic_trans_detail` (`401, 402, 411, 412, 420, 422, 451, 453, 461, 463`), (3) ค่าธรรมเนียมโอนเงิน (`422.fee_amount`) และ (4) ยอดยกมาสมุดเงินฝาก (`604`):

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้นงวด
- `$2` (`DATE`): วันที่สิ้นสุดงวด
- `$3` (`TEXT`): รหัสสมุดเงินฝาก `erp_pass_book.code` (ส่ง `''` เพื่อดูทุกสมุดบัญชี)

```sql
WITH pb_movements AS (
    -- 1) โอนเงินรับ-จ่ายผ่าน cb_trans_detail (doc_type = 1)
    SELECT
        cd.pass_book_code,
        cd.doc_date,
        cd.doc_no,
        cd.trans_flag,
        CASE WHEN cb.pay_type = 1 THEN COALESCE(cd.sum_amount, cd.amount, 0) ELSE 0 END::numeric(18, 2) AS deposit_amt,
        CASE WHEN cb.pay_type = 2 THEN COALESCE(cd.sum_amount, cd.amount, 0) ELSE 0 END::numeric(18, 2) AS withdraw_amt
    FROM cb_trans_detail cd
    JOIN cb_trans cb ON cb.doc_no = cd.doc_no AND cb.trans_flag = cd.trans_flag
    WHERE cd.doc_type = 1
      AND COALESCE(cd.last_status, 0) = 0
      AND COALESCE(cb.last_status, 0) = 0
      AND cd.doc_date <= $2::date

    UNION ALL

    -- 2) เอกสารธนาคาร เช็คผ่าน/เช็คคืน ขึ้นเงินบัตร/Wallet และดอกเบี้ยรับ/จ่าย
    SELECT
        d.item_code AS pass_book_code,
        d.doc_date,
        d.doc_no,
        d.trans_flag,
        CASE WHEN d.trans_flag IN (401, 411, 420, 453, 461, 463) THEN COALESCE(d.sum_amount, 0) ELSE 0 END::numeric(18, 2) AS deposit_amt,
        CASE WHEN d.trans_flag IN (402, 412, 422, 451) THEN COALESCE(d.sum_amount, 0) ELSE 0 END::numeric(18, 2) AS withdraw_amt
    FROM ic_trans_detail d
    JOIN ic_trans h ON h.doc_no = d.doc_no AND h.trans_flag = d.trans_flag
    WHERE d.trans_flag IN (401, 402, 411, 412, 420, 422, 451, 453, 461, 463)
      AND COALESCE(d.last_status, 0) = 0
      AND COALESCE(h.last_status, 0) = 0
      AND d.doc_date <= $2::date

    UNION ALL

    -- 3) ค่าธรรมเนียมธนาคารจากใบโอนเงิน/ค่าธรรมเนียม (422)
    SELECT
        d.item_code AS pass_book_code,
        d.doc_date,
        d.doc_no,
        d.trans_flag,
        0::numeric(18, 2) AS deposit_amt,
        COALESCE(h.fee_amount, 0)::numeric(18, 2) AS withdraw_amt
    FROM ic_trans_detail d
    JOIN ic_trans h ON h.doc_no = d.doc_no AND h.trans_flag = d.trans_flag
    WHERE d.trans_flag = 422
      AND COALESCE(h.fee_amount, 0) > 0
      AND COALESCE(d.last_status, 0) = 0
      AND COALESCE(h.last_status, 0) = 0
      AND d.doc_date <= $2::date

    UNION ALL

    -- 4) ยอดยกมาบัญชีเงินฝากธนาคาร (604)
    SELECT
        d.item_code AS pass_book_code,
        d.doc_date,
        d.doc_no,
        d.trans_flag,
        COALESCE(d.sum_amount, 0)::numeric(18, 2) AS deposit_amt,
        0::numeric(18, 2) AS withdraw_amt
    FROM ic_trans_detail d
    JOIN ic_trans h ON h.doc_no = d.doc_no AND h.trans_flag = d.trans_flag
    WHERE d.trans_flag = 604
      AND COALESCE(d.last_status, 0) = 0
      AND COALESCE(h.last_status, 0) = 0
      AND d.doc_date <= $2::date
)
SELECT
    pb.code AS pass_book_code,
    COALESCE(pb.name_1, '') AS pass_book_name,
    COALESCE(pb.bank_code, '') AS bank_code,
    COALESCE(pb.bank_branch, '') AS bank_branch,
    COALESCE(pb.account_code, '') AS gl_account_code,
    ROUND(COALESCE(SUM(m.deposit_amt - m.withdraw_amt) FILTER (WHERE m.doc_date < $1::date), 0), 2) AS opening_balance,
    ROUND(COALESCE(SUM(m.deposit_amt) FILTER (WHERE m.doc_date BETWEEN $1::date AND $2::date), 0), 2) AS period_deposit,
    ROUND(COALESCE(SUM(m.withdraw_amt) FILTER (WHERE m.doc_date BETWEEN $1::date AND $2::date), 0), 2) AS period_withdraw,
    ROUND(COALESCE(SUM(m.deposit_amt - m.withdraw_amt), 0), 2) AS ending_balance
FROM erp_pass_book pb
LEFT JOIN pb_movements m
  ON m.pass_book_code = pb.code
WHERE ($3::text = '' OR pb.code = $3::text)
GROUP BY pb.code, pb.name_1, pb.bank_code, pb.bank_branch, pb.account_code
ORDER BY pb.code ASC;
```

---

## 4. พยากรณ์กระแสเงินสดล่วงหน้า 30 / 60 / 90 วัน (`cashflow_forecast`)

สกัดจาก `cashflow_forecast.go:146-378` คำนวณเงินสดและเงินฝากธนาคารตั้งต้นจาก GL (`111%` และผังบัญชีสมุดเงินฝาก) เทียบกับเงินไหลเข้า/ออกจากบิลลูกหนี้ค้างรับ เจ้าหนี้ค้างจ่าย และเช็ครับ-เช็คจ่ายล่วงหน้า (`cb_chq_list`):

### พารามิเตอร์
- `$1` (`DATE`): วันที่ฐานสำหรับพยากรณ์ (เช่น `CURRENT_DATE`)

```sql
WITH cash_gl_accounts AS (
    SELECT DISTINCT c.code AS account_code
    FROM gl_chart_of_account c
    WHERE c.code LIKE '111%'
    UNION
    SELECT DISTINCT pb.account_code
    FROM erp_pass_book pb
    WHERE COALESCE(pb.account_code, '') <> ''
),
opening_liquidity AS (
    SELECT COALESCE(SUM(COALESCE(d.debit, 0) - COALESCE(d.credit, 0)), 0)::numeric(18, 2) AS cash_and_bank_now
    FROM gl_journal_detail d
    JOIN cash_gl_accounts ca ON ca.account_code = d.account_code
    WHERE COALESCE(d.is_pass, 0) IN (0, 1)
      AND d.doc_date <= $1::date
),
ar_paid AS (
    SELECT p.billing_no, p.bill_type, SUM(COALESCE(p.sum_pay_money, 0))::numeric(18, 2) AS paid_amt
    FROM ap_ar_trans_detail p
    JOIN ap_ar_trans ph ON ph.doc_no = p.doc_no AND ph.trans_flag = p.trans_flag
    WHERE p.trans_flag = 239 AND COALESCE(p.last_status, 0) = 0 AND COALESCE(ph.last_status, 0) = 0
    GROUP BY p.billing_no, p.bill_type
),
ap_paid AS (
    SELECT p.billing_no, p.bill_type, SUM(COALESCE(p.sum_pay_money, 0))::numeric(18, 2) AS paid_amt
    FROM ap_ar_trans_detail p
    JOIN ap_ar_trans ph ON ph.doc_no = p.doc_no AND ph.trans_flag = p.trans_flag
    WHERE p.trans_flag = 19 AND COALESCE(p.last_status, 0) = 0 AND COALESCE(ph.last_status, 0) = 0
    GROUP BY p.billing_no, p.bill_type
),
future_flows AS (
    -- ลูกหนี้การค้าค้างรับสุทธิ
    SELECT
        GREATEST(COALESCE(t.due_date, t.doc_date), $1::date) AS expected_date,
        CASE
            WHEN t.trans_flag IN (48, 97, 252) THEN -1 * (COALESCE(t.total_amount, 0) + COALESCE(p.paid_amt, 0))
            ELSE COALESCE(t.total_amount, 0) - COALESCE(p.paid_amt, 0)
        END::numeric(18, 2) AS inflow_amt,
        0::numeric(18, 2) AS outflow_amt
    FROM ic_trans t
    LEFT JOIN ar_paid p ON p.billing_no = t.doc_no AND p.bill_type = t.trans_flag
    WHERE COALESCE(t.last_status, 0) = 0
      AND (
          (t.trans_flag = 44 AND COALESCE(t.inquiry_type, 0) IN (0, 2))
          OR (t.trans_flag = 48 AND COALESCE(t.inquiry_type, 0) IN (0, 2, 4))
          OR t.trans_flag IN (93, 95, 97, 99, 250, 252, 254)
      )

    UNION ALL

    -- เจ้าหนี้การค้าค้างจ่ายสุทธิ
    SELECT
        GREATEST(COALESCE(t.due_date, t.doc_date), $1::date) AS expected_date,
        0::numeric(18, 2) AS inflow_amt,
        CASE
            WHEN t.trans_flag IN (16, 317, 85, 262) THEN -1 * (COALESCE(t.total_amount, 0) + COALESCE(p.paid_amt, 0))
            ELSE COALESCE(t.total_amount, 0) - COALESCE(p.paid_amt, 0)
        END::numeric(18, 2) AS outflow_amt
    FROM ic_trans t
    LEFT JOIN ap_paid p ON p.billing_no = t.doc_no AND p.bill_type = t.trans_flag
    WHERE COALESCE(t.last_status, 0) = 0
      AND (
          (t.trans_flag IN (12, 315) AND COALESCE(t.inquiry_type, 0) IN (0, 2))
          OR (t.trans_flag IN (16, 317) AND COALESCE(t.inquiry_type, 0) IN (0, 1))
          OR t.trans_flag IN (81, 83, 85, 87, 260, 262, 264)
      )

    UNION ALL

    -- เช็ครับในมือ (chq_type = 1) และเช็คจ่ายค้างตัด (chq_type = 2)
    SELECT
        GREATEST(COALESCE(c.chq_due_date, c.chq_get_date, $1::date), $1::date) AS expected_date,
        CASE WHEN c.chq_type = 1 THEN COALESCE(c.amount, 0) ELSE 0 END::numeric(18, 2) AS inflow_amt,
        CASE WHEN c.chq_type = 2 THEN COALESCE(c.amount, 0) ELSE 0 END::numeric(18, 2) AS outflow_amt
    FROM cb_chq_list c
    WHERE c.chq_type IN (1, 2)
      AND COALESCE(c.status, 0) NOT IN (2, 6, 7, 8)
)
SELECT
    ROUND(o.cash_and_bank_now, 2) AS current_cash_bank_balance,
    ROUND(COALESCE(SUM(f.inflow_amt) FILTER (WHERE f.expected_date <= $1::date + 30 AND (f.inflow_amt <> 0 OR f.outflow_amt <> 0)), 0), 2) AS inflow_0_30d,
    ROUND(COALESCE(SUM(f.outflow_amt) FILTER (WHERE f.expected_date <= $1::date + 30 AND (f.inflow_amt <> 0 OR f.outflow_amt <> 0)), 0), 2) AS outflow_0_30d,
    ROUND(COALESCE(SUM(f.inflow_amt - f.outflow_amt) FILTER (WHERE f.expected_date BETWEEN $1::date + 31 AND $1::date + 60), 0), 2) AS net_flow_31_60d,
    ROUND(COALESCE(SUM(f.inflow_amt - f.outflow_amt) FILTER (WHERE f.expected_date BETWEEN $1::date + 61 AND $1::date + 90), 0), 2) AS net_flow_61_90d,
    ROUND(
        o.cash_and_bank_now + COALESCE(SUM(f.inflow_amt - f.outflow_amt) FILTER (WHERE f.expected_date <= $1::date + 90), 0),
        2
    ) AS projected_90d_balance
FROM opening_liquidity o
LEFT JOIN future_flows f ON ABS(f.inflow_amt) > 0.005 OR ABS(f.outflow_amt) > 0.005
GROUP BY o.cash_and_bank_now;
```

---

## 5. ข้อควรระวัง (Gotchas)
- **ต้องตรวจสถานะเอกสารแม่ของ `cb_trans` เสมอ (`cbmParentOK`)**: ในบางกรณีเอกสารหลักถูกยกเลิกที่ `ap_ar_trans` (`19, 239`), `as_trans` (`1802`) หรือ `ic_trans` การเช็คทั้ง `cb.last_status = 0` และ `parent.last_status = 0` ช่วยป้องกันยอดเงินสดค้างจากบิลที่ยกเลิกแล้ว
- **เช็ครับที่นำฝากแล้วแต่ยังไม่ผ่าน (`410`) ยังไม่เข้าสมุดเงินฝากธนาคาร**: ยอดเงินใน `erp_pass_book` จะเพิ่มขึ้นก็ต่อเมื่อบันทึกเอกสาร **เช็ครับผ่าน (`trans_flag = 411`)** เท่านั้น (ดูรายละเอียดสถานะเช็คที่ [[sql-cb-cheque-card-register]] และการกระทบยอดธนาคารที่ [[sql-cb-bank-reconcile]])
