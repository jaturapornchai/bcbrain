---
title: "SQL กระทบยอดรายการเดินบัญชีธนาคาร (Bank Statement Reconciliation)"
audience: "dev"
tags: [queries, sql, cb, bank_reconcile, gl_journal_detail, cb_bank_reconcile_batch]
aliases:
  - "sql กระทบยอดธนาคาร bank reconciliation"
  - "sql รายการเดินบัญชีธนาคารค้างกระทบยอด unmatched"
  - "sql ยอดคงเหลือธนาคารตามสมุดบัญชี GL เทียบ statement"
  - "loadBankLedgerCandidates queryBookBalanceAsOf"
sources:
  - "backend/internal/application/process/bank_statement_reconcile.go:333-403"
  - "backend/internal/application/process/bank_statement_reconcile.go:684-844"
  - "backend/internal/application/process/bank_statement_reconcile.go:1236-1338"
---

# SQL กระทบยอดรายการเดินบัญชีธนาคาร (Bank Statement Reconciliation)

รวมคำสั่ง SQL สำหรับตรวจสอบรอบการกระทบยอดธนาคาร (`cb_bank_reconcile_batch`), รายการเดินบัญชีธนาคาร (Bank Statement) ที่ยังจับคู่ไม่สำเร็จ (`cb_bank_reconcile_line`), และคำสั่งดึงรายการบัญชีแยกประเภทฝั่งสมุดบัญชี (`gl_journal_detail`) ที่รอจับคู่ (ดูภาพรวมกระแสเงินสดที่ [[sql-cb-cash-bank-balance]] และกฎกลางที่ [[sql-overview]])

---

## 1. สรุปรอบการกระทบยอดธนาคารและผลต่างคงเหลือ (`cb_bank_reconcile_batch`)

สกัดจาก `bank_statement_reconcile.go:333-403, 1276-1338` แสดงสถานะของแต่ละ Batch การนำเข้า Bank Statement เทียบจำนวนบรรทัดที่จับคู่แล้ว (`MATCHED` / `BANK_FEE`) กับบรรทัดที่ยังค้าง (`UNMATCHED`):

### พารามิเตอร์
- `$1` (`TEXT`): รหัสสมุดเงินฝาก `pass_book_code` (ส่ง `''` เพื่อดูทุกสมุดเงินฝาก)

```sql
SELECT
    b.id AS batch_id,
    COALESCE(b.pass_book_code, '') AS pass_book_code,
    COALESCE(b.account_code, '') AS gl_account_code,
    b.statement_from_date,
    b.statement_to_date,
    COALESCE(b.status, '') AS batch_status,
    ROUND(COALESCE(b.statement_ending_balance, 0), 2) AS statement_ending_balance,
    ROUND(COALESCE(b.book_ending_balance, 0), 2) AS book_ending_balance,
    COUNT(l.id)::int AS total_statement_lines,
    COUNT(l.id) FILTER (WHERE COALESCE(l.match_status, '') IN ('MATCHED', 'BANK_FEE', 'AUTO_POSTED'))::int AS matched_lines,
    COUNT(l.id) FILTER (WHERE COALESCE(l.match_status, 'UNMATCHED') = 'UNMATCHED')::int AS unmatched_lines,
    ROUND(
        COALESCE(SUM(COALESCE(l.deposit_amount, 0) - COALESCE(l.withdraw_amount, 0))
            FILTER (WHERE COALESCE(l.match_status, 'UNMATCHED') = 'UNMATCHED'), 0),
        2
    ) AS net_unmatched_statement_amount
FROM cb_bank_reconcile_batch b
LEFT JOIN cb_bank_reconcile_line l
  ON l.batch_id = b.id
WHERE ($1::text = '' OR b.pass_book_code = $1::text)
GROUP BY
    b.id, b.pass_book_code, b.account_code,
    b.statement_from_date, b.statement_to_date, b.status,
    b.statement_ending_balance, b.book_ending_balance
ORDER BY b.statement_to_date DESC, b.id DESC;
```

---

## 2. รายการใน Bank Statement ที่ยังค้างกระทบยอด (`UNMATCHED` Lines)

ดึงบรรทัดรายการเดินบัญชีจากธนาคารที่ยังไม่ได้จับคู่กับใบสำคัญในระบบ (เช่น เงินโอนเข้าจากลูกค้าที่ยังไม่ส่งสลิป หรือค่าธรรมเนียม/ดอกเบี้ยธนาคารที่ยังไม่บันทึกบัญชี):

### พารามิเตอร์
- `$1` (`BIGINT`): รหัสรอบการกระทบยอด `batch_id`

```sql
SELECT
    l.id AS line_id,
    l.line_no,
    l.trans_date,
    COALESCE(l.trans_time, '') AS trans_time,
    COALESCE(l.channel_code, '') AS channel_code,
    COALESCE(l.cheque_no, '') AS cheque_no,
    COALESCE(l.description, '') AS bank_description,
    ROUND(COALESCE(l.deposit_amount, 0), 2) AS deposit_amount,
    ROUND(COALESCE(l.withdraw_amount, 0), 2) AS withdraw_amount,
    ROUND(COALESCE(l.running_balance, 0), 2) AS statement_running_balance,
    COALESCE(l.match_status, 'UNMATCHED') AS match_status
FROM cb_bank_reconcile_line l
WHERE l.batch_id = $1::bigint
  AND COALESCE(l.match_status, 'UNMATCHED') = 'UNMATCHED'
ORDER BY l.trans_date ASC, l.line_no ASC, l.id ASC;
```

---

## 3. ยอดคงเหลือตามสมุดบัญชีแยกประเภท (`queryBookBalanceAsOf`) และรายการฝั่งบัญชีที่รอจับคู่ (`loadBankLedgerCandidates`)

สกัดจาก `queryBookBalanceAsOf` และ `loadBankLedgerCandidates` (`bank_statement_reconcile.go:684-768, 1236-1275`) ดึงรายการเคลื่อนไหวของรหัสผังบัญชีธนาคารใน `gl_journal_detail` ที่เอกสารต้นทางไม่ถูกยกเลิก และยังไม่ถูกผูกเข้ากับ `cb_bank_reconcile_line`:

### พารามิเตอร์
- `$1` (`TEXT`): รหัสผังบัญชีแยกประเภทของสมุดธนาคาร (เช่น `'1112-01'`)
- `$2` (`DATE`): วันที่เริ่มต้นช่วงตรวจสอบ
- `$3` (`DATE`): วันที่สิ้นสุดงวดกระทบยอด (`as_of_date`)

```sql
WITH book_as_of AS (
    SELECT
        ROUND(COALESCE(SUM(COALESCE(d.debit, 0) - COALESCE(d.credit, 0)), 0), 2) AS gl_book_balance_as_of
    FROM gl_journal_detail d
    JOIN gl_journal h
      ON h.doc_no = d.doc_no
     AND h.doc_date = d.doc_date
     AND COALESCE(h.book_code, '') = COALESCE(d.book_code, '')
    WHERE d.account_code = $1::text
      AND COALESCE(d.is_pass, 0) IN (0, 1)
      AND d.doc_date <= $3::date
),
matched_gl_docs AS (
    SELECT DISTINCT
        l.matched_gl_doc_no AS doc_no,
        l.matched_gl_line_no AS line_number
    FROM cb_bank_reconcile_line l
    WHERE COALESCE(l.matched_gl_doc_no, '') <> ''
      AND COALESCE(l.match_status, '') IN ('MATCHED', 'BANK_FEE', 'AUTO_POSTED')
)
SELECT
    d.doc_date,
    COALESCE(d.book_code, '') AS book_code,
    d.doc_no,
    d.line_number,
    d.trans_flag,
    COALESCE(d.description, h.description, '') AS gl_description,
    ROUND(COALESCE(d.debit, 0), 2) AS gl_debit_in,
    ROUND(COALESCE(d.credit, 0), 2) AS gl_credit_out,
    b.gl_book_balance_as_of
FROM gl_journal_detail d
JOIN gl_journal h
  ON h.doc_no = d.doc_no
 AND h.doc_date = d.doc_date
 AND COALESCE(h.book_code, '') = COALESCE(d.book_code, '')
CROSS JOIN book_as_of b
LEFT JOIN matched_gl_docs m
  ON m.doc_no = d.doc_no
 AND (m.line_number IS NULL OR m.line_number = d.line_number)
WHERE d.account_code = $1::text
  AND COALESCE(d.is_pass, 0) IN (0, 1)
  AND d.doc_date BETWEEN $2::date AND $3::date
  AND m.doc_no IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM ic_trans i
      WHERE i.doc_no = d.doc_no AND COALESCE(i.last_status, 0) <> 0
  )
  AND NOT EXISTS (
      SELECT 1 FROM ap_ar_trans a
      WHERE a.doc_no = d.doc_no AND COALESCE(a.last_status, 0) <> 0
  )
ORDER BY d.doc_date ASC, d.doc_no ASC, d.line_number ASC;
```

---

## 4. ข้อควรระวัง (Gotchas)
- **การ Join `gl_journal` กับ `gl_journal_detail` ต้องผูกครบ 3 คีย์**: ต้องเชื่อม `h.doc_no = d.doc_no AND h.doc_date = d.doc_date AND COALESCE(h.book_code, '') = COALESCE(d.book_code, '')` ตามรูปแบบมาตรฐานของ `bank_statement_reconcile.go` เพื่อกันกรณีเลขที่เอกสารซ้ำข้ามเล่มหรือข้ามปี
- **ความต่างระหว่างสมุดเงินฝาก (`erp_pass_book`) กับแยกประเภท (`gl_journal_detail`)**: สมุดเงินฝากคำนวณจาก `cb_trans_detail` / `ic_trans_detail` ส่วนหน้าจอกระทบยอดธนาคารเทียบกับ `gl_journal_detail` ของ `account_code` ที่ผูกไว้กับสมุดเงินฝากนั้นโดยตรง (ดู [[sql-gl-journal-ledger]])
