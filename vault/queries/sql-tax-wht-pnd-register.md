---
title: "SQL ทะเบียนภาษีหัก ณ ที่จ่าย ภ.ง.ด.3 / ภ.ง.ด.53 และติดตามใบรับรอง 50 ทวิ (gl_wht_list)"
audience: "dev"
tags: [queries, sql, tax, wht, pnd3, pnd53, 50tawi, gl_wht_list]
aliases:
  - "sql ภาษีหัก ณ ที่จ่าย ภ.ง.ด.3 ภ.ง.ด.53"
  - "sql สรุปยื่นภาษีหัก ณ ที่จ่าย rd prep"
  - "sql ทะเบียนภาษีถูกหัก ณ ที่จ่าย 50 ทวิ gl_wht_out_tracking"
  - "gl_wht_list gl_wht_list_detail"
sources:
  - "backend/internal/application/process/rd_tax_export_wht.go:257-560"
  - "backend/internal/application/process/report_menu_gl_fa.go:1155-1240"
---

# SQL ทะเบียนภาษีหัก ณ ที่จ่าย ภ.ง.ด.3 / ภ.ง.ด.53 และติดตามใบรับรอง 50 ทวิ (`gl_wht_list`)

รวมคำสั่ง SQL มาตรฐานสำหรับจัดทำทะเบียนภาษีหัก ณ ที่จ่ายนำส่งกรมสรรพากร (**ภ.ง.ด.3** บุคคลธรรมดา และ **ภ.ง.ด.53** นิติบุคคล) จากตาราง `gl_wht_list` + `gl_wht_list_detail` รวมถึงทะเบียนติดตามหนังสือรับรองการหักภาษี ณ ที่จ่าย (**50 ทวิ**) ที่ลูกค้าหักไว้จาก `gl_wht_out_tracking` (ดูผลกระทบทางภาษีของเอกสารที่ [[doc-impact-tax-vat-wht]] และกฎกลางที่ [[sql-overview]])

---

## 1. ทะเบียนภาษีหัก ณ ที่จ่ายฝั่งผู้ขายสำหรับยื่น ภ.ง.ด.3 และ ภ.ง.ด.53 (`rd_tax_export_wht.go`)

สกัดจาก `rd_tax_export_wht.go:257-465` และ `report_menu_gl_fa.go:1155-1205` ใช้วันที่มีผลยื่นแบบ `COALESCE(d.due_date, h.due_date, h.doc_date)`, กรองเฉพาะเอกสารฝั่งจ่ายชำระ/ซื้อ, ตรวจสถานะเอกสารต้นทางไม่ยกเลิก และกลับเครื่องหมาย `-1` สำหรับใบลดหนี้ (`16, 25, 262, 317`):

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้นงวดเดือนภาษี (เช่น `'2026-11-01'`)
- `$2` (`DATE`): วันที่สิ้นสุดงวดเดือนภาษี (เช่น `'2026-11-30'`)
- `$3` (`TEXT`): ประเภทแบบ `'PND3'`, `'PND53'` หรือส่ง `''` เพื่อดูทั้งหมด

```sql
WITH wht_payable_rows AS (
    SELECT
        COALESCE(d.due_date, h.due_date, h.doc_date) AS effective_wht_date,
        h.doc_no,
        h.trans_flag,
        COALESCE(h.tax_doc_no, d.tax_doc_no, h.doc_no) AS wht_cert_no,
        COALESCE(h.ap_ar_code, '') AS vendor_code,
        COALESCE(h.ap_ar_name, ap.name_1, '') AS vendor_name,
        REGEXP_REPLACE(COALESCE(h.tax_id, ap.tax_id, ''), '[^0-9]', '', 'g') AS clean_tax_id,
        CASE
            WHEN COALESCE(h.tax_type, 0) = 1 THEN 'PND3'
            WHEN COALESCE(h.tax_type, 0) = 2 THEN 'PND53'
            WHEN LEFT(REGEXP_REPLACE(COALESCE(h.tax_id, ap.tax_id, ''), '[^0-9]', '', 'g'), 1) = '0' THEN 'PND53'
            ELSE 'PND3'
        END AS pnd_form_type,
        d.line_number,
        COALESCE(d.description, '') AS income_type_desc,
        COALESCE(d.tax_rate, 0)::numeric(9, 2) AS wht_rate_pct,
        CASE WHEN h.trans_flag IN (16, 25, 262, 317) THEN -1 ELSE 1 END AS cn_sign,
        COALESCE(d.base_amount, 0)::numeric(18, 2) AS raw_base_amount,
        COALESCE(d.tax_amount, 0)::numeric(18, 2) AS raw_wht_amount
    FROM gl_wht_list h
    JOIN gl_wht_list_detail d
      ON d.doc_no = h.doc_no
     AND d.trans_flag = h.trans_flag
    LEFT JOIN ap_supplier ap
      ON ap.code = h.ap_ar_code
    WHERE h.trans_flag IN (10, 11, 12, 14, 16, 19, 25, 260, 262, 264, 315, 316, 317)
      AND COALESCE(d.due_date, h.due_date, h.doc_date) BETWEEN $1::date AND $2::date
      AND NOT EXISTS (
          SELECT 1 FROM ap_ar_trans a
          WHERE a.doc_no = h.doc_no AND a.trans_flag = h.trans_flag AND COALESCE(a.last_status, 0) <> 0
      )
      AND NOT EXISTS (
          SELECT 1 FROM ic_trans i
          WHERE i.doc_no = h.doc_no AND i.trans_flag = h.trans_flag AND COALESCE(i.last_status, 0) <> 0
      )
)
SELECT
    pnd_form_type,
    effective_wht_date,
    wht_cert_no,
    doc_no AS payment_doc_no,
    trans_flag,
    vendor_code,
    vendor_name,
    clean_tax_id AS vendor_tax_id_13,
    income_type_desc,
    ROUND(wht_rate_pct, 2) AS wht_rate_pct,
    ROUND(raw_base_amount * cn_sign, 2) AS paid_base_amount,
    ROUND(raw_wht_amount * cn_sign, 2) AS withheld_tax_amount
FROM wht_payable_rows
WHERE ($3::text = '' OR pnd_form_type = $3::text)
ORDER BY pnd_form_type ASC, effective_wht_date ASC, wht_cert_no ASC, line_number ASC;
```

---

## 2. สรุปยอดเงินได้และภาษีหัก ณ ที่จ่ายนำส่งแยกตามแบบ (ภ.ง.ด.3 vs ภ.ง.ด.53) และอัตราภาษี

ใช้กระทบยอดใบแนบก่อนส่งออกไฟล์ยื่นออนไลน์กรมสรรพากร (RD Prep):

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้นเดือนภาษี
- `$2` (`DATE`): วันที่สิ้นสุดเดือนภาษี

```sql
SELECT
    CASE
        WHEN COALESCE(h.tax_type, 0) = 1 THEN 'PND3 (บุคคลธรรมดา)'
        WHEN COALESCE(h.tax_type, 0) = 2 THEN 'PND53 (นิติบุคคล)'
        WHEN LEFT(REGEXP_REPLACE(COALESCE(h.tax_id, ''), '[^0-9]', '', 'g'), 1) = '0' THEN 'PND53 (นิติบุคคล)'
        ELSE 'PND3 (บุคคลธรรมดา)'
    END AS pnd_form,
    ROUND(COALESCE(d.tax_rate, 0), 2) AS wht_rate_pct,
    COUNT(DISTINCT h.doc_no)::int AS cert_count,
    ROUND(SUM(COALESCE(d.base_amount, 0) * CASE WHEN h.trans_flag IN (16, 25, 262, 317) THEN -1 ELSE 1 END), 2) AS total_income_paid,
    ROUND(SUM(COALESCE(d.tax_amount, 0) * CASE WHEN h.trans_flag IN (16, 25, 262, 317) THEN -1 ELSE 1 END), 2) AS total_wht_payable
FROM gl_wht_list h
JOIN gl_wht_list_detail d
  ON d.doc_no = h.doc_no
 AND d.trans_flag = h.trans_flag
WHERE h.trans_flag IN (10, 11, 12, 14, 16, 19, 25, 260, 262, 264, 315, 316, 317)
  AND COALESCE(d.due_date, h.due_date, h.doc_date) BETWEEN $1::date AND $2::date
  AND NOT EXISTS (
      SELECT 1 FROM ap_ar_trans a
      WHERE a.doc_no = h.doc_no AND a.trans_flag = h.trans_flag AND COALESCE(a.last_status, 0) <> 0
  )
  AND NOT EXISTS (
      SELECT 1 FROM ic_trans i
      WHERE i.doc_no = h.doc_no AND i.trans_flag = h.trans_flag AND COALESCE(i.last_status, 0) <> 0
  )
GROUP BY 1, ROUND(COALESCE(d.tax_rate, 0), 2)
ORDER BY 1 ASC, wht_rate_pct ASC;
```

---

## 3. ทะเบียนภาษีถูกหัก ณ ที่จ่ายฝั่งลูกค้า (50 ทวิ) และสถานะการติดตามใบรับรอง (`gl_wht_out_tracking`)

สกัดจาก `rd_tax_export_wht.go:470-560` และ `report_menu_gl_fa.go:1206-1240` ดึงรายการที่ลูกค้าหักภาษี ณ ที่จ่ายไว้เมื่อชำระเงิน (`trans_flag IN (40, 44, 46, 48, 110, 239, 250, 252, 254, 1802)`) พร้อมสถานะการได้รับเอกสารตัวจริงเพื่อใช้เป็นเครดิตภาษีปลายปี (`1153-00`):

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้น
- `$2` (`DATE`): วันที่สิ้นสุด
- `$3` (`TEXT`): กรองสถานะใบรับรอง `'PENDING'`, `'RECEIVED'`, `'WAIVED'` หรือส่ง `''` เพื่อดูทั้งหมด

```sql
SELECT
    COALESCE(d.due_date, h.due_date, h.doc_date) AS receipt_wht_date,
    h.doc_no AS receipt_doc_no,
    h.trans_flag,
    COALESCE(h.ap_ar_code, '') AS customer_code,
    COALESCE(h.ap_ar_name, ar.name_1, '') AS customer_name,
    COALESCE(tr.cert_no, h.tax_doc_no, '') AS customer_50tawi_no,
    COALESCE(tr.cert_status, 'PENDING') AS cert_status,
    tr.received_date,
    COALESCE(d.description, '') AS service_description,
    ROUND(COALESCE(d.tax_rate, 0), 2) AS wht_rate_pct,
    ROUND(COALESCE(d.base_amount, 0) * CASE WHEN h.trans_flag IN (48, 252) THEN -1 ELSE 1 END, 2) AS base_amount,
    ROUND(COALESCE(d.tax_amount, 0) * CASE WHEN h.trans_flag IN (48, 252) THEN -1 ELSE 1 END, 2) AS wht_asset_amount
FROM gl_wht_list h
JOIN gl_wht_list_detail d
  ON d.doc_no = h.doc_no
 AND d.trans_flag = h.trans_flag
LEFT JOIN ar_customer ar
  ON ar.code = h.ap_ar_code
LEFT JOIN gl_wht_out_tracking tr
  ON tr.doc_no = h.doc_no
 AND tr.trans_flag = h.trans_flag
 AND tr.line_number = d.line_number
WHERE h.trans_flag IN (40, 44, 46, 48, 110, 239, 250, 252, 254, 1802)
  AND COALESCE(d.due_date, h.due_date, h.doc_date) BETWEEN $1::date AND $2::date
  AND ($3::text = '' OR COALESCE(tr.cert_status, 'PENDING') = $3::text)
  AND NOT EXISTS (
      SELECT 1 FROM ap_ar_trans a
      WHERE a.doc_no = h.doc_no AND a.trans_flag = h.trans_flag AND COALESCE(a.last_status, 0) <> 0
  )
  AND NOT EXISTS (
      SELECT 1 FROM ic_trans i
      WHERE i.doc_no = h.doc_no AND i.trans_flag = h.trans_flag AND COALESCE(i.last_status, 0) <> 0
  )
ORDER BY receipt_wht_date ASC, h.doc_no ASC, d.line_number ASC;
```

---

## 4. ข้อควรระวัง (Gotchas)
- **ใช้วันที่ `COALESCE(d.due_date, h.due_date, h.doc_date)` เป็นเกณฑ์งวดยื่นแบบเสมอ**: ในทางปฏิบัติวันที่หักภาษีตามหน้าหนังสือรับรองอาจต่างจากวันที่ตั้งเอกสารในระบบ Engine ส่งออก RD Prep จึงยึด `COALESCE(d.due_date, h.due_date, h.doc_date)` เป็นหลัก
- **ระวังปนรายการฝั่งซื้อและฝั่งขายใน `gl_wht_list`**: ตาราง `gl_wht_list` เก็บทั้งภาษีหัก ณ ที่จ่ายที่กิจการหักผู้ขาย (หนี้สิน `2122-00`) และภาษีที่ลูกค้าหักกิจการไว้ (สินทรัพย์ `1153-00`) ต้องแยกด้วยชุด `h.trans_flag` เสมอ!
