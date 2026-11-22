---
title: "SQL ทะเบียนเช็ครับ เช็คจ่าย บัตรเครดิต Wallet และประวัติสถานะเช็ค (cb_chq_list)"
audience: "dev"
tags: [queries, sql, cb, cheque, credit_card, wallet, cb_chq_list]
aliases:
  - "sql ทะเบียนเช็ครับ เช็คในมือ เช็คครบกำหนด"
  - "sql ทะเบียนเช็คจ่ายค้างตัด"
  - "sql บัตรเครดิตและ Wallet รอขึ้นเงิน"
  - "sql ประวัติการเปลี่ยนสถานะเช็ค cb_chq_list"
sources:
  - "backend/internal/application/process/report_menu_cb.go:152-160"
  - "backend/internal/application/process/report_menu_cb.go:520-605"
  - "backend/internal/application/process/cheque.go:18-355"
---

# SQL ทะเบียนเช็ครับ เช็คจ่าย บัตรเครดิต Wallet และประวัติสถานะเช็ค (`cb_chq_list`)

รวมคำสั่ง SQL สำหรับตรวจสอบทะเบียนเช็ครับ (`chq_type = 1`), เช็คจ่าย (`chq_type = 2`), บัตรเครดิต (`chq_type = 3`) และ e-Wallet (`chq_type = 21`) ในตาราง `cb_chq_list` พร้อมคำสั่งแกะรอยประวัติการเปลี่ยนสถานะเช็ครายใบจาก `ic_trans_detail` (ดูแผนผังสถานะเช็คเต็มรูปแบบที่ [[doc-impact-cash-bank-cheque]] และกฎกลางที่ [[sql-overview]])

---

## 1. ทะเบียนเช็ครับในมือและเช็ครอเคลียริ่ง (`chq_type = 1`) เรียงตามวันถึงกำหนด

สกัดจาก `report_menu_cb.go:152, 520-585` และ `cheque.go:19-41` กรองเช็ครับที่ยังไม่ปิดจบ (`COALESCE(status, 0) IN (0, 1, 3, 6)` — ในมือ, นำฝาก, เช็คคืน, คืนนำเข้าใหม่; ตัดสถานะจบ `2`=ผ่าน, `4`=ยกเลิก/ขาดสิทธิ์, `5`=ขายลด, `7`=เปลี่ยนเช็ค, `8`=ตั้งหนี้ใหม่ และหมายเหตุว่า Statement ล่วงหน้า `menu_statement_advance` ใช้เฉพาะ `c.status IN (0, 1)`):

### พารามิเตอร์
- `$1` (`DATE`): วันที่อ้างอิงตรวจสอบเช็คถึงกำหนด (เช่น `CURRENT_DATE`)

```sql
SELECT
    c.chq_number,
    c.chq_get_date,
    c.chq_due_date,
    ($1::date - COALESCE(c.chq_due_date, c.chq_get_date))::int AS days_past_due,
    COALESCE(c.ap_ar_code, '') AS customer_code,
    COALESCE(ar.name_1, '') AS customer_name,
    COALESCE(c.bank_code, '') AS cheque_bank_code,
    COALESCE(c.bank_branch, '') AS cheque_bank_branch,
    COALESCE(c.pass_book_code, '') AS deposit_pass_book_code,
    COALESCE(c.doc_ref, '') AS source_receipt_doc_no,
    COALESCE(c.status, 0) AS status_code,
    CASE COALESCE(c.status, 0)
        WHEN 0 THEN '0: เช็คในมือ (405)'
        WHEN 1 THEN '1: เช็คนำฝาก (410)'
        WHEN 2 THEN '2: เช็คผ่าน (411)'
        WHEN 3 THEN '3: เช็ครับคืน (412)'
        WHEN 4 THEN '4: เช็คยกเลิก/ขาดสิทธิ์ (413)'
        WHEN 5 THEN '5: เช็คขายลด'
        WHEN 6 THEN '6: เช็คคืนนำเข้าใหม่ (414)'
        WHEN 7 THEN '7: เช็คเปลี่ยน (416)'
        WHEN 8 THEN '8: เช็คตั้งหนี้ใหม่ (418)'
        ELSE 'สถานะอื่น (' || COALESCE(c.status, 0)::text || ')'
    END AS status_label,
    ROUND(COALESCE(c.amount, 0), 2) AS cheque_amount
FROM cb_chq_list c
LEFT JOIN ar_customer ar
  ON ar.code = c.ap_ar_code
WHERE c.chq_type = 1
  AND COALESCE(c.status, 0) IN (0, 1, 3, 6)
ORDER BY COALESCE(c.chq_due_date, c.chq_get_date) ASC, c.chq_number ASC;
```

### คอลัมน์ผลลัพธ์สำคัญ
| คอลัมน์ | คำอธิบาย |
|---|---|
| `days_past_due` | จำนวนวันที่เลยวันหน้าเช็ค (`> 0` = ถึงกำหนดนำฝาก/เคลียริ่งแล้ว, `< 0` = เช็คล่วงหน้ายังไม่ถึงกำหนด) |
| `status_code` / `status_label` | สถานะเช็คล่าสุดใน `cb_chq_list` ตาม `cbmChqStatus` และ `chequeStatusSQL` |
| `cheque_amount` | มูลค่าหน้าเช็ค (`NUMERIC(18,2)`) |

---

## 2. ทะเบียนเช็คจ่ายค้างตัดบัญชีธนาคาร (`chq_type = 2`) แยกตามสมุดเงินฝาก

สกัดจาก `report_menu_cb.go:520-585` และ `cheque.go:22, 40` ตรวจสอบเช็คจ่ายที่ยังไม่ผ่านตัดบัญชี ไม่ขาดสิทธิ์/ยกเลิก และไม่ถูกเปลี่ยนใบใหม่ (`COALESCE(status, 0) IN (0, 3)` — รอตัดบัญชี/คืน):

### พารามิเตอร์
- `$1` (`DATE`): วันที่สิ้นสุดวันครบกำหนดหน้าเช็ค (ส่ง `'2999-12-31'` เพื่อดูเช็คจ่ายค้างตัดทั้งหมด)

```sql
SELECT
    COALESCE(c.pass_book_code, '') AS pass_book_code,
    COALESCE(pb.name_1, '') AS pass_book_name,
    c.chq_number,
    c.chq_get_date AS issue_date,
    c.chq_due_date,
    COALESCE(c.ap_ar_code, '') AS supplier_code,
    COALESCE(ap.name_1, '') AS supplier_name,
    COALESCE(c.doc_ref, '') AS payment_doc_no,
    COALESCE(c.status, 0) AS status_code,
    CASE COALESCE(c.status, 0)
        WHEN 0 THEN '0: เช็คจ่ายในมือ/รอตัดบัญชี (406)'
        WHEN 2 THEN '2: เช็คจ่ายผ่าน (451)'
        WHEN 3 THEN '3: เช็คจ่ายคืน (453)'
        WHEN 4 THEN '4: เช็คจ่ายยกเลิก/ขาดสิทธิ์ (452)'
        WHEN 7 THEN '7: เช็คจ่ายเปลี่ยน (456)'
        ELSE 'สถานะอื่น (' || COALESCE(c.status, 0)::text || ')'
    END AS status_label,
    ROUND(COALESCE(c.amount, 0), 2) AS cheque_amount
FROM cb_chq_list c
LEFT JOIN erp_pass_book pb
  ON pb.code = c.pass_book_code
LEFT JOIN ap_supplier ap
  ON ap.code = c.ap_ar_code
WHERE c.chq_type = 2
  AND COALESCE(c.status, 0) IN (0, 3)
  AND COALESCE(c.chq_due_date, c.chq_get_date) <= $1::date
ORDER BY c.pass_book_code ASC, COALESCE(c.chq_due_date, c.chq_get_date) ASC, c.chq_number ASC;
```

---

## 3. ทะเบียนสลิปบัตรเครดิต (`chq_type = 3`) และ e-Wallet (`chq_type = 21`) รอขึ้นเงินเข้าธนาคาร

สกัดจาก `cheque.go:25-27, 41` และ `report_menu_cb.go:583` (`c.chq_type = 3 AND c.status = 0`): เอกสารขึ้นเงินบัตร (`461`) และขึ้นเงิน Wallet (`463`) จะเปลี่ยน `status = 1` ส่วนยกเลิกบัตร (`462`) เปลี่ยนเป็น `status = 2` ดังนั้นการดึงรายการ **รอขึ้นเงิน** ต้องกรอง **`COALESCE(c.status, 0) = 0`** เท่านั้น:

```sql
SELECT
    c.chq_type,
    CASE c.chq_type
        WHEN 3 THEN 'บัตรเครดิต (Credit Card)'
        WHEN 21 THEN 'กระเป๋าเงินอิเล็กทรอนิกส์ (e-Wallet)'
        ELSE 'อื่นๆ'
    END AS instrument_type,
    c.chq_number AS slip_or_ref_no,
    c.chq_get_date AS transaction_date,
    COALESCE(c.ap_ar_code, '') AS customer_code,
    COALESCE(ar.name_1, '') AS customer_name,
    COALESCE(c.doc_ref, '') AS source_doc_no,
    COALESCE(c.status, 0) AS status_code,
    ROUND(COALESCE(c.amount, 0), 2) AS pending_settlement_amount
FROM cb_chq_list c
LEFT JOIN ar_customer ar
  ON ar.code = c.ap_ar_code
WHERE c.chq_type IN (3, 21)
  AND COALESCE(c.status, 0) = 0
ORDER BY c.chq_type ASC, c.chq_get_date ASC, c.chq_number ASC;
```

---

## 4. ประวัติการเปลี่ยนสถานะเช็ครายใบ (Cheque Status Lifecycle History)

สกัดจาก `cheque.go:19-64` ไล่เส้นทางของเช็คใบหนึ่งตั้งแต่เอกสารเปลี่ยนสถานะเช็คใน `ic_trans_detail` (`trans_flag` ช่วง `410`–`476`, จับคู่ด้วย `COALESCE(NULLIF(d.chq_number, ''), d.item_code)` เพื่อรองรับทั้งแถวทั่วไปและ `416`/`456`/`418`):

### พารามิเตอร์
- `$1` (`TEXT`): เลขที่เช็ค `chq_number` ที่ต้องการตรวจสอบ

```sql
SELECT
    d.doc_date,
    d.doc_no,
    d.trans_flag,
    CASE d.trans_flag
        WHEN 410 THEN 'นำฝากเช็ครับเข้าธนาคาร (→ status 1)'
        WHEN 411 THEN 'เช็ครับผ่านเข้าบัญชี (→ status 2)'
        WHEN 412 THEN 'เช็ครับคืน/เช็คเด้ง (→ status 3)'
        WHEN 413 THEN 'เช็ครับขาดสิทธิ์/ยกเลิก (→ status 4)'
        WHEN 414 THEN 'เช็คคืนนำเข้าใหม่ (→ status 6)'
        WHEN 416 THEN 'เปลี่ยนเช็ครับ (→ status 7)'
        WHEN 418 THEN 'คืนเช็ครับตั้งหนี้ใหม่ (→ status 8)'
        WHEN 451 THEN 'เช็คจ่ายผ่านตัดบัญชีธนาคาร (→ status 2)'
        WHEN 452 THEN 'เช็คจ่ายขาดสิทธิ์/ยกเลิก (→ status 4)'
        WHEN 453 THEN 'เช็คจ่ายคืน (→ status 3)'
        WHEN 456 THEN 'เปลี่ยนเช็คจ่าย (→ status 7)'
        WHEN 461 THEN 'ขึ้นเงินบัตรเครดิต (→ status 1)'
        WHEN 462 THEN 'ยกเลิกบัตรเครดิต (→ status 2)'
        WHEN 463 THEN 'ขึ้นเงิน Wallet (→ status 1)'
        ELSE 'รายการทะเบียนเช็ค (' || d.trans_flag::text || ')'
    END AS action_name,
    COALESCE(d.chq_number, '') AS chq_number,
    COALESCE(d.item_code, '') AS item_or_pass_book_code,
    ROUND(COALESCE(d.sum_amount, 0), 2) AS amount,
    COALESCE(h.remark, '') AS remark
FROM ic_trans_detail d
JOIN ic_trans h
  ON h.doc_no = d.doc_no
 AND h.trans_flag = d.trans_flag
WHERE COALESCE(NULLIF(d.chq_number, ''), d.item_code) = $1::text
  AND d.trans_flag IN (410, 411, 412, 413, 414, 416, 418, 430, 431, 432, 433, 434, 436, 451, 452, 453, 456, 461, 462, 463, 471, 472, 473, 476)
  AND COALESCE(d.last_status, 0) = 0
  AND COALESCE(h.last_status, 0) = 0
ORDER BY d.doc_date ASC, d.doc_no ASC;
```

---

## 5. ข้อควรระวัง (Gotchas)
- **ความหมายของ `cb_chq_list.status` ในเช็ค (`chq_type = 1, 2`)**: `0`=ในมือ, `1`=นำฝาก (`410`), `2`=เช็คผ่าน (`411`/`451`), `3`=เช็คคืน (`412`/`453`), `4`=เช็คยกเลิก/ขาดสิทธิ์ (`413`/`452`), `5`=ขายลด, `6`=เช็คคืนนำเข้าใหม่ (`414`) **หรือ** เอกสารต้นทางใน `ic_trans`/`ap_ar_trans` ถูกยกเลิก (`last_status = 1` ตาม `cheque.go:36-43`, ซึ่ง `cashflow_forecast.go:342` กรอง `NOT IN (2, 6, 7, 8)` ตัดออกแล้ว), `7`=เช็คเปลี่ยน (`416`/`456`), `8`=เช็คตั้งหนี้ใหม่ (`418`) — ส่วนรายงาน Statement ล่วงหน้า (`report_menu_cb.go:583`) ใช้เฉพาะ `c.status IN (0, 1)` เท่านั้น
- **บัตรเครดิต (`chq_type = 3`) และ Wallet (`chq_type = 21`) ต้องกรอง `COALESCE(c.status, 0) = 0`**: เพราะ `461`/`463` ตั้ง `status = 1` (ขึ้นเงินแล้ว) และ `462` ตั้ง `status = 2` (ยกเลิกแล้ว) หากเผลอกรอง `NOT IN (2, 6, 7, 8)` จะติดรายการที่ขึ้นเงินแล้ว (`status = 1`) มาด้วย (ดู [[doc-impact-cash-bank-cheque]])
