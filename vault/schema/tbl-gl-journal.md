---
title: ตารางสมุดรายวันทั่วไป มิติปันส่วน และปิดงวดบัญชี (gl_journal, gl_journal_detail, gl_journal_book, gl_trans, gl_account_close)
tags:
  - schema
  - gl
  - journal
  - closing
aliases:
  - gl_journal
  - gl_journal_detail
  - gl_journal_book
  - gl_journal_allocate_list
  - gl_journal_depart_list
  - gl_journal_job_list
  - gl_journal_project_list
  - gl_journal_side_list
  - gl_trans
  - gl_trans_detail
  - gl_account_close
  - gl_account_close_detail
  - gl_journal_summary
  - gl_journal_summary_detail
  - gl_summary_close_account_detaiil
  - gl_recurring
  - gl_design_report
  - gl_list_view
  - gl_resource
sources:
  - scripts/sql/02_data_schema.sql:4058
  - scripts/sql/02_data_schema.sql:4085
  - scripts/sql/02_data_schema.sql:4248
  - scripts/sql/02_data_schema.sql:4260
  - scripts/sql/02_data_schema.sql:4314
  - scripts/sql/02_data_schema.sql:4355
  - scripts/sql/02_data_schema.sql:4456
  - scripts/sql/02_data_schema.sql:4500
  - scripts/sql/02_data_schema.sql:4614
  - scripts/sql/02_data_schema.sql:4643
  - scripts/sql/02_data_schema.sql:4687
  - scripts/sql/02_data_schema.sql:4710
  - backend/internal/platform/db/pool.go:78
  - backend/internal/application/process/workflow.go:481
  - backend/internal/application/process/workflow.go:892
  - backend/internal/application/process/report_menu_gl_fa.go:907
  - backend/internal/application/process/report_menu_gl_fa_tb.go:10
  - backend/internal/application/process/stock_beginning.go:112
  - backend/internal/application/process/service.go:2536-2555
---

# ตารางสมุดรายวันทั่วไป มิติปันส่วน และปิดงวดบัญชี

หัวใจหลักของระบบบัญชีแยกประเภท (General Ledger) ประกอบด้วยหัวเอกสารสมุดรายวัน (`gl_journal`), บรรทัดเดบิต/เครดิต (`gl_journal_detail`), สมุดรายวัน (`gl_journal_book`), ตารางปันส่วนมิติ 5 แกน และกลุ่มตารางปิดงวด/งบทดลอง/บันทึกประจำเดือน

> [!WARNING] ข้อควรรู้สำคัญที่สุดเมื่อ Query ตาราง GL
> 1. **`gl_journal` ไม่มีคอลัมน์ `last_status` ใน DDL มาตรฐาน** (`02_data_schema.sql:4260-4285`) — เมื่อเอกสารต้นทางถูกยกเลิก ระบบจะลบแถว GL ออก หรือให้ตรวจสอบกับหัวเอกสารต้นทาง (`ic_trans` / `ap_ar_trans`) ด้วย `trans_flag` และ `doc_no`
> 2. **คีย์เชื่อมหัว-ท้ายมาตรฐาน**: `gl_journal` และ `gl_journal_detail` เชื่อมกันด้วย `(doc_date, doc_no, COALESCE(book_code, ''))` (อ้างอิง `report_menu_gl_fa.go:907`, `service.go:2536`) และเวลาจัดทำงบต้องตรวจ `debit = credit` เสมอ
> 3. **สะกดผิดที่ต้องคงตาม Schema จริง**: ตาราง `gl_summary_close_account_detaiil` มีตัว `i` ซ้อนสองตัว (`detaiil`) และคอลัมน์ปันส่วนในตาราง `gl_journal_*_list` สะกดว่า `allocate_persent` (`persent`)

---

## 1. `gl_journal` — หัวใบสำคัญสมุดรายวันทั่วไป

- **วัตถุประสงค์**: เก็บหัวรายการบันทึกบัญชีทั้งที่คีย์มือผ่าน GL และที่ Post อัตโนมัติจากโมดูลซื้อ/ขาย/การเงิน/คลัง/สินทรัพย์/ปิดงวด
- **Indexes**:
  - `idx_gl_journal_doc_no_trans_flag` ON `gl_journal` (`doc_no`, `trans_flag`)
  - `idx_gl_journal_doc_date_trans_flag` ON `gl_journal` (`doc_date`, `trans_flag`)

### คอลัมน์สำคัญ

| คอลัมน์ | ชนิดข้อมูล (SQL) | ค่าเริ่มต้น | ความหมายและค่า Flag |
| :--- | :--- | :--- | :--- |
| `doc_date` | `date` | `NULL` | วันที่ลงบัญชี (ค.ศ.) |
| `book_code` | `varchar(25)` | `''` | รหัสสมุดรายวัน (เชื่อม `gl_journal_book.code`) |
| `doc_no` | `varchar(25)` | `''` | เลขที่ใบสำคัญลงบัญชี |
| `ref_no`, `ref_date` | `varchar(25)`, `date` | `''`, `NULL` | เลขที่และวันที่เอกสารอ้างอิง |
| `description` | `varchar(5000)` | `''` | คำอธิบายรายการประจำใบสำคัญ |
| `debit`, `credit` | `numeric` | `0.0` | ยอดรวมเดบิต และยอดรวมเครดิตทั้งใบ (ต้องสมดุลกัน `debit = credit`) |
| `account_year` | `smallint` | `0` | ปีบัญชี (พ.ศ. หรือ ค.ศ. ตามการตั้งค่าปีบัญชีของฐานข้อมูล) |
| `period_number` | `smallint` | `0` | งวดบัญชี (เช่น `1`–`12`) |
| `journal_type` | `smallint` | `0` | ประเภทใบสำคัญ (`report_menu_gl_fa_tb.go:10-18`, `stock_beginning.go:112`):<br>• `0` = รายวันปกติ<br>• `1` = ยอดยกมา / ยกมางวด<br>• `2` = ปิดบัญชี / ปิดงวด (Cut-off — งบกำไรขาดทุนต้องกรอง `<> 2`)<br>• `3` = รายการปรับปรุง (Adjustment)<br>• `4` = ยอดยกไป / ยกมา (Carry-forward) |
| `is_pass` | `smallint` | `0` | สถานะผ่านรายการ (`workflow.go:481`):<br>• `0` = ยังไม่ผ่านรายการ (Draft/Unposted)<br>• `1` = ผ่านรายการแล้ว (Posted) |
| `trans_flag` | `integer` | `0` | รหัสประเภทเอกสารต้นทาง (เช่น `1998`/`1999` สำหรับปิดงวด; ดู [[doctypes-overview]]) |
| `trans_direct` | `smallint` | `0` | ทิศทาง/ที่มาของการ Post (`0`/`1`) |
| `doc_format_code` | `varchar(25)` | `''` | รหัสรูปแบบเลขที่เอกสาร |
| `doc_code` | `varchar(25)` | `''` | รหัสเอกสารอ้างอิงย่อย |
| `ap_ar_code` | `varchar(20)` | `''` | รหัสลูกค้า/ผู้ขาย |
| `ap_ar_originate_from` | `varchar(255)` | `''` | แหล่งที่มาของคู่ค้า/โมดูล |
| `branch_code` | `varchar(25)` | `''` | รหัสสาขา |

---

## 2. `gl_journal_detail` — บรรทัดเดบิต-เครดิตสมุดรายวัน

- **วัตถุประสงค์**: เก็บคู่บัญชีเดบิตและเครดิตแต่ละบรรทัดของ `gl_journal` ใช้เป็นแหล่งข้อมูลหลักในการคำนวณงบทดลอง, บัญชีแยกประเภท, งบดุล และงบกำไรขาดทุน
- **Indexes**:
  - `idx_gl_journal_detail_doc_no_trans_flag` ON `gl_journal_detail` (`doc_no`, `trans_flag`)
  - `idx_gl_journal_detail_doc_date_trans_flag` ON `gl_journal_detail` (`doc_date`, `trans_flag`)
  - `idx_gl_journal_detail_account_code` ON `gl_journal_detail` (`account_code`)

### คอลัมน์สำคัญ

| คอลัมน์ | ชนิดข้อมูล (SQL) | ค่าเริ่มต้น | ความหมายและค่า Flag |
| :--- | :--- | :--- | :--- |
| `doc_date`, `book_code`, `doc_no` | `date`, `varchar(25)`, `varchar(25)` | - | คีย์เชื่อมกลับไปหัวเอกสาร `gl_journal` |
| `line_number` | `smallint` | `0` | ลำดับบรรทัด |
| `account_code` | `varchar(25)` | `''` | รหัสบัญชี (เชื่อม [[tbl-gl-chart-of-account]] ต้องเป็นบัญชีย่อย `status = 0`) |
| `account_name` | `varchar(100)` | `''` | ชื่อบัญชี ณ วันที่บันทึก |
| `description` | `varchar(5000)` | `''` | คำอธิบายบรรทัด |
| `debit`, `credit` | `numeric` | `0.0` | จำนวนเงินฝั่งเดบิต และฝั่งเครดิต |
| `debit_or_credit` | `smallint` | `0` | ฝั่งรายการ: `0` = เดบิต (Debit), `1` = เครดิต (Credit) |
| `journal_type`, `is_pass` | `smallint` | `0` | ค่าเดียวกับหัว `gl_journal` (ถูกซิงค์ผ่าน `workflow.go:520,627` และ `service.go:2538`) |
| `trans_flag`, `period_number`, `account_year`, `branch_code` | `int`/`smallint`/`varchar` | `0`/`''` | เมทาดาทาที่ซิงค์ตรงกับ `gl_journal` |

---

## 3. `gl_journal_book` — มาสเตอร์สมุดรายวัน

- **วัตถุประสงค์**: กำหนดสมุดรายวัน 5 เล่มหลักและเล่มเพิ่มเติม (เช่น รายวันทั่วไป, รายวันซื้อ, รายวันขาย, รายวันรับ, รายวันจ่าย) พร้อมคำนำหน้าเลขที่เอกสาร (`word_begin`)
- **Indexes**: `idx_gl_journal_book_code` ON `gl_journal_book` (`code`)
- **คอลัมน์สำคัญ**: `code` (`varchar(25)`), `name_1` (`varchar(100)`), `name_2` (`varchar(200)`), `word_begin` (`varchar(25)`), `status` (`smallint`)

---

## 4. ตารางปันส่วนมิติของรายการ GL (5 ตาราง)

บันทึกการแบ่งยอดเงิน (`allocate_amount`) และเปอร์เซ็นต์ (`allocate_persent`) ต่อ 1 บรรทัดของ `gl_journal_detail` (`line_number_detail` ชี้กลับไปยัง `gl_journal_detail.line_number`, `line_number` เป็นลำดับย่อยของการปันส่วน) ทั้ง 5 ตารางถูกสร้างใน `02_data_schema.sql` และ `pool.go:78-127` มี Index บน `(doc_no, trans_flag)`, `(doc_date, trans_flag)` และ `(account_code)` ทุกตาราง

| ตาราง | คอลัมน์รหัส / ชื่อมิติ | คอลัมน์ยอดและเปอร์เซ็นต์ |
| :--- | :--- | :--- |
| `gl_journal_side_list` | `side_code`, `side_name` (`varchar(25/100)`) | `allocate_persent`, `allocate_amount` (`numeric`) |
| `gl_journal_depart_list` | `department_code`, `department_name` | `allocate_persent`, `allocate_amount` |
| `gl_journal_allocate_list` | `allocate_code`, `allocate_name` | `allocate_persent`, `allocate_amount` |
| `gl_journal_project_list` | `project_code`, `project_name` | `allocate_persent`, `allocate_amount` |
| `gl_journal_job_list` | `job_code`, `job_name` | `allocate_persent`, `allocate_amount` |

*(หมายเหตุ: `gl_journal_depart_list.line_number` และ `line_number_detail` เป็น `integer` ส่วนอีก 4 ตารางเป็น `smallint`)*

---

## 5. ตารางปิดงวดบัญชี สรุปงบ และรายการเกิดซ้ำ

| ตาราง | Indexes | วัตถุประสงค์และคอลัมน์สำคัญ |
| :--- | :--- | :--- |
| `gl_trans` | `idx_gl_trans_doc_no_trans_flag`, `idx_gl_trans_doc_date_trans_flag` | หัวเอกสารปิดบัญชี (`trans_flag` `1998`/`1999`, `from_date`, `to_date`, `account_period`, `account_year`, `close_to_account`, `book_code`) |
| `gl_trans_detail` | `idx_gl_trans_detail_doc_no_trans_flag`, `idx_gl_trans_detail_doc_date_trans_flag`, `idx_gl_trans_detail_account_code` | สรุปยอดแต่ละบัญชีที่ใช้ปิดงวด (`account_code`, `account_name`, `debit`, `credit`, `line_number`) |
| `gl_account_close` | - | หัวประวัติการปิดบัญชี/คำนวณต้นทุนขาย (`product_balance_amount`, `product_next_amount`, `purchase_amount`, `sale_cost`, `sale_cost_account`, `gl_entry_type`, `from_date`, `to_date`) |
| `gl_account_close_detail` | `idx_gl_account_close_detail_account_code` | รายละเอียดบัญชีที่ปิดงวด (`account_code`, `balance_mode`, `account_type`, `amount`, `amount_2`, `ref_doc_type`) |
| `gl_journal_summary` | - | หัวประมวลผลสรุปงบ/ปิดบัญชีแบบช่วงบัญชี 5 ช่วง (`from_date`, `to_date`, `total_debit`, `total_credit`, `close_account_type_1..5`, `close_from_account_1..5`, `close_to_account_1..5`) |
| `gl_journal_summary_detail` | `idx_gl_journal_summary_detail_account_code` | รายละเอียดงบทดลองที่สรุป (`balance_debit`, `balance_credit`, `debit_amount`, `credit_amount`, `adjust_debit`, `adjust_credit`, `total_debit`, `total_credit`, `balance_mode`) |
| `gl_summary_close_account_detaiil` | `idx_gl_summary_close_account_detaiil_account_code` | ยอดสรุปปิดบัญชีต่อรหัสบัญชี (`doc_no`, `account_code`, `amount`, `line_number`) — **ระวังชื่อตารางสะกด `detaiil`** |
| `gl_recurring` | `idx_gl_recurring_code` | แม่แบบรายการบันทึกบัญชีเกิดซ้ำ (`code`, `gl_desc`, `xmlstring` ขนาด `varchar(5000)`) |
| `gl_design_report` | `idx_gl_design_report_code` | โครงสร้างรายงานงบการเงินที่ผู้ใช้/ระบบออกแบบ (`code`, `name1`, `name2`, `data` text) |
| `gl_list_view`, `gl_resource` | - | ตารางโครงสร้างพื้นฐานระบบ GL (ปัจจุบันมีเฉพาะคอลัมน์ระบบ `roworder`, `ignore_sync`, `is_lock_record`, `create_date_time_now`) |

---

## 6. รูปแบบการ JOIN และตัวอย่าง SQL Query

### ตัวอย่าง 1: ตรวจสอบสมุดรายวันที่ไม่สมดุล (Debit ≠ Credit)
```sql
SELECT
    j.doc_date,
    j.book_code,
    j.doc_no,
    j.debit::NUMERIC(18,2) AS header_debit,
    j.credit::NUMERIC(18,2) AS header_credit,
    COALESCE(SUM(d.debit), 0)::NUMERIC(18,2) AS detail_debit,
    COALESCE(SUM(d.credit), 0)::NUMERIC(18,2) AS detail_credit
FROM gl_journal j
LEFT JOIN gl_journal_detail d
  ON d.doc_date = j.doc_date
 AND d.doc_no = j.doc_no
 AND COALESCE(d.book_code, '') = COALESCE(j.book_code, '')
GROUP BY j.doc_date, j.book_code, j.doc_no, j.debit, j.credit
HAVING COALESCE(SUM(d.debit), 0) <> COALESCE(SUM(d.credit), 0)
    OR j.debit <> COALESCE(SUM(d.debit), 0)
ORDER BY j.doc_date DESC, j.doc_no;
```

### ตัวอย่าง 2: งบทดลองแยกยอดยกมาและยอดเคลื่อนไหวประจำงวด (แบบรวมทุก `is_pass`)
```sql
WITH prm AS (
    SELECT DATE '2026-01-01' AS d1, DATE '2026-01-31' AS d2
)
SELECT
    c.code AS account_code,
    c.name_1 AS account_name,
    c.account_type,
    COALESCE(SUM(CASE
        WHEN d.doc_date < prm.d1
          OR (COALESCE(d.journal_type, 0) = 1 AND d.doc_date <= prm.d2)
          OR (COALESCE(d.journal_type, 0) = 4 AND d.doc_date < prm.d2)
        THEN d.debit - d.credit ELSE 0 END), 0)::NUMERIC(18,2) AS opening_net,
    COALESCE(SUM(CASE
        WHEN d.doc_date BETWEEN prm.d1 AND prm.d2
         AND COALESCE(d.journal_type, 0) IN (0, 2, 3)
        THEN d.debit ELSE 0 END), 0)::NUMERIC(18,2) AS period_debit,
    COALESCE(SUM(CASE
        WHEN d.doc_date BETWEEN prm.d1 AND prm.d2
         AND COALESCE(d.journal_type, 0) IN (0, 2, 3)
        THEN d.credit ELSE 0 END), 0)::NUMERIC(18,2) AS period_credit
FROM gl_chart_of_account c
CROSS JOIN prm
LEFT JOIN gl_journal_detail d
  ON d.account_code = c.code
 AND COALESCE(d.is_pass, 0) IN (0, 1)
WHERE COALESCE(c.status, 0) = 0
GROUP BY c.code, c.name_1, c.account_type
HAVING COALESCE(SUM(ABS(d.debit) + ABS(d.credit)), 0) <> 0
ORDER BY c.code;
```
