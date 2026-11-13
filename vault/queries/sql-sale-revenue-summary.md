---
title: "SQL สรุปยอดขายสุทธิรายวัน/รายเดือน แยกขายสด-ขายเชื่อ-POS (Sales Revenue Summary)"
audience: "dev"
tags: [queries, sql, sale, revenue, pos, ic_trans]
aliases:
  - "sql ยอดขายสุทธิ"
  - "sql สรุปยอดขายรายวัน รายเดือน"
  - "query ยอดขาย หักรับคืน เพิ่มหนี้"
  - "แยกยอดขายสด ขายเชื่อ POS"
  - "trans_flag 44 46 48 revenue sql"
sources:
  - "backend/internal/application/process/report_menu_so_po.go:272-380"
  - "backend/internal/application/process/report_menu_so_po.go:789-835"
  - "backend/internal/adapter/inbound/http/ai/context_sales_ar.go:18-37"
---

# SQL สรุปยอดขายสุทธิรายวัน/รายเดือน แยกขายสด-ขายเชื่อ-POS

การคำนวณยอดขายสุทธิทางธุรกิจจากตาราง `ic_trans` ต้องนำ **บิลขายสินค้า/บริการ (`44`) + ใบเพิ่มหนี้ขาย (`46`) หักด้วย ใบรับคืน/ลดหนี้ขาย (`48`)** โดยกรองเฉพาะเอกสารที่ไม่ถูกยกเลิก (`COALESCE(last_status, 0) = 0`) ดูรายละเอียดรหัสเอกสารและประเภทภาษีที่ [[doc-trans-flag-catalog]] และ [[doc-calc-vat-discount]]

---

## 1. สรุปยอดขายสุทธิรายเดือน แยกขายสด ขายเชื่อ และ POS

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้น เช่น `'2026-01-01'`
- `$2` (`DATE`): วันที่สิ้นสุด เช่น `'2026-12-31'`
- `$3` (`TEXT`): รหัสสาขา (`branch_code`) — ส่ง `''` เพื่อดึงทุกสาขา

```sql
WITH sale_docs AS (
    SELECT
        date_trunc('month', t.doc_date)::date AS sale_month,
        t.trans_flag,
        COALESCE(t.inquiry_type, 0) AS inquiry_type,
        COALESCE(t.is_pos, 0) AS is_pos,
        CASE WHEN t.trans_flag = 48 THEN -1 ELSE 1 END AS sign_mult,
        (COALESCE(t.total_before_vat, 0) + COALESCE(t.total_except_vat, 0))::numeric(18, 2) AS ex_vat_amt,
        COALESCE(t.total_vat_value, 0)::numeric(18, 2) AS vat_amt,
        COALESCE(t.total_amount, 0)::numeric(18, 2) AS total_amt
    FROM ic_trans t
    WHERE COALESCE(t.last_status, 0) = 0
      AND t.trans_flag IN (44, 46, 48)
      AND t.doc_date BETWEEN $1::date AND $2::date
      AND ($3::text = '' OR COALESCE(t.branch_code, '') = $3::text)
)
SELECT
    to_char(sale_month, 'YYYY-MM') AS year_month,
    COUNT(*) FILTER (WHERE trans_flag = 44) AS invoice_count,
    COUNT(*) FILTER (WHERE trans_flag = 48) AS cn_count,
    ROUND(SUM(CASE WHEN trans_flag IN (44, 46) THEN ex_vat_amt ELSE 0 END), 2) AS gross_sales_ex_vat,
    ROUND(SUM(CASE WHEN trans_flag = 48 THEN ex_vat_amt ELSE 0 END), 2) AS sales_return_ex_vat,
    ROUND(SUM(sign_mult * ex_vat_amt), 2) AS net_sales_ex_vat,
    ROUND(SUM(sign_mult * vat_amt), 2) AS net_vat_amount,
    ROUND(SUM(sign_mult * total_amt), 2) AS net_total_inc_vat,
    ROUND(SUM(CASE
        WHEN trans_flag IN (44, 46) AND inquiry_type IN (1, 3) AND is_pos = 0 THEN ex_vat_amt
        WHEN trans_flag = 48 AND inquiry_type IN (1, 3, 5) THEN -ex_vat_amt
        ELSE 0
    END), 2) AS net_cash_sales_ex_vat,
    ROUND(SUM(CASE
        WHEN trans_flag = 44 AND is_pos = 1 THEN ex_vat_amt
        ELSE 0
    END), 2) AS pos_sales_ex_vat,
    ROUND(SUM(CASE
        WHEN trans_flag IN (44, 46) AND inquiry_type IN (0, 2) THEN ex_vat_amt
        WHEN trans_flag = 48 AND inquiry_type IN (0, 2, 4) THEN -ex_vat_amt
        ELSE 0
    END), 2) AS net_credit_sales_ex_vat
FROM sale_docs
GROUP BY sale_month
ORDER BY sale_month ASC;
```

### คอลัมน์ผลลัพธ์หลัก
- `gross_sales_ex_vat`: ยอดขายรวมก่อน VAT (`44 + 46`) รวมทั้งส่วนที่มีภาษีและยกเว้นภาษี (`total_before_vat + total_except_vat`)
- `sales_return_ex_vat`: ยอดรับคืนและลดหนี้ก่อน VAT (`48`)
- `net_sales_ex_vat`: **ยอดขายสุทธิก่อน VAT** (ตัวเลขที่เทียบได้กับหมวดรายได้ `4110`–`4130` หัก `4120` ในงบกำไรขาดทุน [[sql-gl-profit-and-loss]])
- `net_cash_sales_ex_vat` / `pos_sales_ex_vat` / `net_credit_sales_ex_vat`: แยกสัดส่วนขายสดหลังบ้าน, ขายหน้าร้าน POS (`is_pos = 1`) และขายเชื่อ

---

## 2. สรุปยอดขายรายวัน พร้อมแยกช่องทางรับชำระของบิลขายสด/POS

เชื่อม `ic_trans` เข้ากับ `cb_trans` เพื่อดูว่ายอดขายสดในแต่ละวันรับเป็นเงินสด เงินโอน บัตรเครดิต หรือเช็คเท่าใด:

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้น
- `$2` (`DATE`): วันที่สิ้นสุด

```sql
SELECT
    t.doc_date,
    COUNT(*) AS bill_count,
    ROUND(SUM(COALESCE(t.total_before_vat, 0) + COALESCE(t.total_except_vat, 0)), 2) AS sales_ex_vat,
    ROUND(SUM(COALESCE(t.total_vat_value, 0)), 2) AS vat_amount,
    ROUND(SUM(COALESCE(t.total_amount, 0)), 2) AS total_amount,
    ROUND(SUM(CASE WHEN COALESCE(t.inquiry_type, 0) IN (0, 2) THEN COALESCE(t.total_amount, 0) ELSE 0 END), 2) AS credit_ar_amount,
    ROUND(SUM(COALESCE(cb.cash_amount, 0)), 2) AS cash_received,
    ROUND(SUM(COALESCE(cb.sum_amount_transfer, 0)), 2) AS transfer_received,
    ROUND(SUM(COALESCE(cb.sum_amount_credit_card, 0)), 2) AS card_received,
    ROUND(SUM(COALESCE(cb.sum_amount_chq, 0)), 2) AS cheque_received
FROM ic_trans t
LEFT JOIN cb_trans cb
  ON cb.doc_no = t.doc_no
 AND cb.trans_flag = t.trans_flag
 AND COALESCE(cb.last_status, 0) = 0
WHERE COALESCE(t.last_status, 0) = 0
  AND t.trans_flag = 44
  AND t.doc_date BETWEEN $1::date AND $2::date
GROUP BY t.doc_date
ORDER BY t.doc_date DESC;
```

---

## 3. ข้อควรระวัง (Gotchas)
1. **อย่าใช้ `total_before_vat` เพียงคอลัมน์เดียวสำหรับธุรกิจที่มีสินค้ายกเว้น VAT**: สินค้ายกเว้นภาษี (`vat_type = 2` หรือ `ic_inventory.tax_type = 1`) จะถูกเก็บไว้ใน `total_except_vat` ไม่ใช่ `total_before_vat` ดังนั้นยอดขายไม่รวมภาษีที่ครบถ้วนคือ `COALESCE(total_before_vat, 0) + COALESCE(total_except_vat, 0)`
2. **การขายสินทรัพย์ถาวร (`as_trans.trans_flag = 1802`)**: ไม่ได้อยู่ใน `ic_trans` และไม่นับเป็นรายได้จากการขายสินค้าปกติ (รับรู้เป็นกำไร/ขาดทุนจากการจำหน่ายสินทรัพย์ — ดู [[sql-fa-disposal-and-leasing]])
