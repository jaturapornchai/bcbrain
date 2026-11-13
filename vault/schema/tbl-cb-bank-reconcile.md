---
title: ตารางกระทบยอดธนาคารและกฎจับคู่อัตโนมัติ (cb_bank_reconcile_batch, cb_bank_reconcile_line, cb_bank_auto_rule)
tags:
  - schema
  - cb
  - bank-reconcile
aliases:
  - cb_bank_reconcile_batch
  - cb_bank_reconcile_line
  - cb_bank_auto_rule
sources:
  - backend/internal/application/process/bank_statement_reconcile.go:60
  - backend/internal/application/process/bank_statement_reconcile.go:335
  - backend/internal/application/process/bank_statement_reconcile.go:360
  - backend/internal/application/process/bank_statement_reconcile.go:383
  - backend/internal/application/process/bank_statement_reconcile.go:1139
---

# ตารางกระทบยอดธนาคารและกฎจับคู่อัตโนมัติ

กลุ่มตารางสำหรับนำเข้า Bank Statement (CSV/API), จับคู่รายการเดินบัญชีอัตโนมัติ (ช่วงเวลา ±5 วัน เทียบกับ `cb_trans` / `gl_journal`), บันทึกค่าธรรมเนียมธนาคารลง GL อัตโนมัติ และจำกฎจับคู่จากคำอธิบายรายการ (`cb_bank_auto_rule`) ตารางกลุ่มนี้ถูกสร้างอัตโนมัติแบบ `CREATE TABLE IF NOT EXISTS` ใน `ensureBankReconcileSchema`

---

## 1. `cb_bank_reconcile_batch` — หัวงวดการกระทบยอดธนาคาร

- **วัตถุประสงค์**: เก็บสรุปผลการกระทบยอด Bank Statement ประจำเดือน (`YYYY-MM`) และบัญชีธนาคาร พร้อมยอดเทียบระหว่าง Book Balance กับ Adjusted Bank Balance
- **Primary Key**: `rec_doc_no` (`VARCHAR(50)`)
- **Indexes**: `idx_cb_bank_reconcile_batch_month` ON `cb_bank_reconcile_batch` (`statement_month DESC`, `rec_doc_no DESC`)

### คอลัมน์สำคัญ

| คอลัมน์ | ชนิดข้อมูล (SQL) | ค่าเริ่มต้น | ความหมายและค่า Flag |
| :--- | :--- | :--- | :--- |
| `rec_doc_no` | `VARCHAR(50) PRIMARY KEY` | - | เลขที่ใบกระทบยอดธนาคาร (เช่น `RECKBK2601001`) |
| `bank_code` | `VARCHAR(20) NOT NULL` | `'KBANK'` | รหัสธนาคาร |
| `bank_account_code` | `VARCHAR(25) NOT NULL` | `''` | รหัสสมุดบัญชี/ผังบัญชีธนาคารในระบบ (เชื่อม `erp_pass_book.code` หรือ [[tbl-gl-chart-of-account]]) |
| `statement_month` | `VARCHAR(7) NOT NULL` | `''` | งวดเดือน Statement รูปแบบ `YYYY-MM` |
| `line_count` | `INTEGER NOT NULL` | `0` | จำนวนรายการบรรทัด Statement ทั้งหมด |
| `matched_count` | `INTEGER NOT NULL` | `0` | จำนวนบรรทัดที่จับคู่ได้ |
| `unmatched_count` | `INTEGER NOT NULL` | `0` | จำนวนบรรทัดที่ยังไม่จับคู่ |
| `total_deposit` | `NUMERIC(18,2) NOT NULL` | `0` | ยอดเงินฝากรวมตาม Statement |
| `total_withdrawal` | `NUMERIC(18,2) NOT NULL` | `0` | ยอดเงินถอนรวมตาม Statement |
| `bank_fee_total` | `NUMERIC(18,2) NOT NULL` | `0` | ยอดค่าธรรมเนียมธนาคารรวมที่ตรวจพบ |
| `ending_statement_balance` | `NUMERIC(18,2) NOT NULL` | `0` | ยอดคงเหลือปลายงวดตาม Statement |
| `book_balance` | `NUMERIC(18,2) NOT NULL` | `0` | ยอดคงเหลือทางบัญชี (Book Balance) |
| `adjusted_bank_balance` | `NUMERIC(18,2) NOT NULL` | `0` | ยอดธนาคารที่ปรับปรุงแล้ว |
| `diff_amount` | `NUMERIC(18,2) NOT NULL` | `0` | ผลต่างคงเหลือที่ยังกระทบยอดไม่ลงตัว |
| `fee_gl_doc_no` | `VARCHAR(50) NOT NULL` | `''` | เลขที่ใบสำคัญสมุดรายวันที่ลงบัญชีค่าธรรมเนียมอัตโนมัติ (เชื่อม [[tbl-gl-journal]]) |
| `status` | `VARCHAR(25) NOT NULL` | `'RECONCILED'` | สถานะงวดกระทบยอด:<br>• `'RECONCILED'` = กระทบยอดครบทุกรายการ<br>• `'PARTIAL'` = ยังมีรายการ `UNMATCHED` ค้างอยู่ |
| `remark` | `TEXT NOT NULL` | `''` | หมายเหตุ |
| `created_by` | `VARCHAR(50) NOT NULL` | `''` | รหัสผู้ทำรายการ |
| `create_date_time_now` | `TIMESTAMPTZ` | `NOW()` | วันเวลาที่สร้างรายการ |

---

## 2. `cb_bank_reconcile_line` — รายละเอียดรายการเดินบัญชีธนาคาร (Statement Lines)

- **วัตถุประสงค์**: เก็บรายการเคลื่อนไหวรายบรรทัดจากไฟล์ Bank Statement พร้อมสถานะและเอกสารต้นทางที่จับคู่ได้
- **Primary Key**: `(rec_doc_no, line_no)`

### คอลัมน์สำคัญ

| คอลัมน์ | ชนิดข้อมูล (SQL) | ค่าเริ่มต้น | ความหมายและค่า Flag |
| :--- | :--- | :--- | :--- |
| `rec_doc_no` | `VARCHAR(50) NOT NULL` | - | เลขที่ใบกระทบยอด (FK เชิงตรรกะ → `cb_bank_reconcile_batch.rec_doc_no`) |
| `line_no` | `INTEGER NOT NULL` | - | ลำดับบรรทัด Statement |
| `tx_date` | `DATE NOT NULL` | - | วันที่เกิดรายการใน Bank Statement |
| `description` | `TEXT NOT NULL` | `''` | คำอธิบายรายการจากธนาคาร |
| `withdrawal` | `NUMERIC(18,2) NOT NULL` | `0` | ยอดเงินถอน/หักบัญชี |
| `deposit` | `NUMERIC(18,2) NOT NULL` | `0` | ยอดเงินฝาก/เข้าบัญชี |
| `running_balance` | `NUMERIC(18,2) NOT NULL` | `0` | ยอดคงเหลือสะสมตาม Statement |
| `ref_no` | `VARCHAR(80) NOT NULL` | `''` | เลขอ้างอิงธนาคาร |
| `is_bank_fee` | `BOOLEAN NOT NULL` | `FALSE` | `TRUE` = รายการค่าธรรมเนียมธนาคาร |
| `match_status` | `VARCHAR(25) NOT NULL` | `'UNMATCHED'` | สถานะการจับคู่ (`bank_statement_reconcile.go:60`):<br>• `'MATCHED'` = จับคู่กับเอกสารบัญชีได้แล้ว<br>• `'BANK_FEE'` = รายการค่าธรรมเนียมธนาคาร<br>• `'UNMATCHED'` = ยังไม่พบคู่ในระบบ |
| `matched_source` | `VARCHAR(30) NOT NULL` | `''` | แหล่งตารางที่จับคู่ได้ (เช่น `cb_trans` หรือ `gl_journal`) |
| `matched_doc_no` | `VARCHAR(50) NOT NULL` | `''` | เลขที่เอกสารที่จับคู่ได้ |
| `matched_doc_date` | `VARCHAR(10) NOT NULL` | `''` | วันที่เอกสารที่จับคู่ได้ (`YYYY-MM-DD`) |

---

## 3. `cb_bank_auto_rule` — กฎจับคู่และลงบัญชีรายการธนาคารอัตโนมัติ

- **วัตถุประสงค์**: เก็บ Keyword Rule สำหรับจับคู่คำอธิบาย Statement เพื่อนำไปบันทึกบัญชีค่าใช้จ่าย/รายได้อัตโนมัติ (เช่น ค่าธรรมเนียมโอน, ดอกเบี้ยรับ)
- **Primary Key**: `id` (`BIGSERIAL`)
- **Unique Key**: `UNIQUE (keyword, direction)`

### คอลัมน์สำคัญ

| คอลัมน์ | ชนิดข้อมูล (SQL) | ค่าเริ่มต้น | ความหมาย |
| :--- | :--- | :--- | :--- |
| `id` | `BIGSERIAL PRIMARY KEY` | auto | รหัสลำดับกฎ |
| `keyword` | `VARCHAR(150) NOT NULL` | - | คำสำคัญใน `description` ของ Statement |
| `direction` | `VARCHAR(10) NOT NULL` | `'ANY'` | ทิศทางเงิน (`'ANY'`, ฝั่งถอน หรือฝั่งฝาก) |
| `bank_code` | `VARCHAR(20) NOT NULL` | `''` | รหัสธนาคาร (เว้นว่าง = ใช้ได้ทุกธนาคาร) |
| `target_account_code` | `VARCHAR(25) NOT NULL` | `''` | รหัสผังบัญชีปลายทาง (เชื่อม [[tbl-gl-chart-of-account]]) |
| `action_type` | `VARCHAR(30) NOT NULL` | `'GL_EXPENSE'` | รูปแบบการลงบัญชีอัตโนมัติ |
| `rule_source` | `VARCHAR(20) NOT NULL` | `'MANUAL'` | แหล่งที่มาของกฎ |
| `hit_count` | `INTEGER NOT NULL` | `1` | จำนวนครั้งที่กฎถูกเรียกใช้งาน |
| `active` | `BOOLEAN NOT NULL` | `TRUE` | `TRUE` = เปิดใช้งานกฎนี้ |
| `updated_at` | `TIMESTAMPTZ NOT NULL` | `NOW()` | วันเวลาอัปเดตล่าสุด |

---

## 4. รูปแบบการ JOIN และตัวอย่าง SQL Query

- **หัว-ท้ายกระทบยอด**: `cb_bank_reconcile_batch b JOIN cb_bank_reconcile_line l ON l.rec_doc_no = b.rec_doc_no`
- **เชื่อมสมุดบัญชีธนาคาร**: `b.bank_account_code` เทียบกับ `erp_pass_book.code` (ดู [[schema-overview]])
- **เชื่อมเอกสารค่าธรรมเนียม GL**: `b.fee_gl_doc_no` เทียบกับ [[tbl-gl-journal]] (`gl_journal.doc_no`)

### ตัวอย่าง 1: ค้นหารายการ Statement ที่ยังจับคู่ไม่ได้ (`UNMATCHED`) ตามงวดล่าสุด
```sql
SELECT
    b.statement_month,
    b.bank_code,
    b.bank_account_code,
    l.rec_doc_no,
    l.line_no,
    l.tx_date,
    l.description,
    l.withdrawal::NUMERIC(18,2) AS withdrawal,
    l.deposit::NUMERIC(18,2) AS deposit,
    l.ref_no,
    l.is_bank_fee
FROM cb_bank_reconcile_batch b
JOIN cb_bank_reconcile_line l
  ON l.rec_doc_no = b.rec_doc_no
WHERE l.match_status = 'UNMATCHED'
  AND b.statement_month = '2026-01'
ORDER BY l.tx_date, l.line_no;
```

### ตัวอย่าง 2: สรุปผลกระทบยอดแยกตามเดือนและบัญชีธนาคาร
```sql
SELECT
    b.statement_month,
    b.rec_doc_no,
    b.bank_code,
    b.bank_account_code,
    b.status,
    b.matched_count,
    b.unmatched_count,
    b.book_balance::NUMERIC(18,2) AS book_balance,
    b.adjusted_bank_balance::NUMERIC(18,2) AS adjusted_bank_balance,
    b.diff_amount::NUMERIC(18,2) AS diff_amount,
    b.fee_gl_doc_no
FROM cb_bank_reconcile_batch b
ORDER BY b.statement_month DESC, b.rec_doc_no DESC;
```
