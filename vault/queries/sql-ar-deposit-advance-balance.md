---
title: "SQL ยอดคงเหลือเงินรับล่วงหน้า (40/9040) และเงินมัดจำรับ (110/9110) พร้อมประวัติการตัดใช้"
audience: "dev"
tags: [queries, sql, ar, deposit, advance, cb_trans_detail]
aliases:
  - "sql เงินมัดจำรับคงเหลือ"
  - "sql เงินรับล่วงหน้าคงเหลือ"
  - "sopoBalanceCols sql"
  - "trans_flag 40 110 9040 9110"
  - "ประวัติการตัดมัดจำลูกหนี้ cb_trans_detail"
sources:
  - "backend/internal/application/process/trans_deposit.go:25-266"
  - "backend/internal/application/process/report_menu_sopo.go:34-41"
  - "backend/internal/application/process/report_menu_sopo.go:153-180"
  - "backend/internal/application/process/report_menu_so_po.go:355-378"
---

# SQL ยอดคงเหลือเงินรับล่วงหน้า (`40/9040`) และเงินมัดจำรับ (`110/9110`) พร้อมประวัติการตัดใช้

สูตรคำนวณยอดคงเหลือของใบรับเงินล่วงหน้า (ไม่มี VAT: `40` + ยกมา `9040`) และใบรับเงินมัดจำ (มี VAT: `110` + ยกมา `9110`) สกัดตรงจาก `report_menu_sopo.go:sopoBalanceCols` และ `trans_deposit.go` โดยต้องหักทั้ง **ยอดทำใบคืนเงินมัดจำ (`42, 112`)** และ **ยอดที่ถูกนำไปตัดชำระในบิลขาย/ใบเสร็จ (`cb_trans_detail` `doc_type IN (5, 6)`)** (ดูคำอธิบายกติกาที่ [[doc-impact-ar-ap-deposit]])

---

## 1. รายงานเงินมัดจำรับและเงินรับล่วงหน้าคงเหลือรายใบ (ณ วันที่ `$1`)

### พารามิเตอร์
- `$1` (`DATE`): วันที่สิ้นสุดการคำนวณ (As-Of Date) เช่น `'2026-11-13'`
- `$2` (`TEXT`): รหัสลูกหนี้ (`cust_code`) — ส่ง `''` เพื่อดึงทุกราย

```sql
WITH deposit_returns AS (
    SELECT
        r.doc_ref AS dep_doc_no,
        SUM(COALESCE(r.total_amount, 0))::numeric(18, 2) AS returned_amt
    FROM ic_trans r
    WHERE COALESCE(r.last_status, 0) = 0
      AND r.trans_flag IN (42, 112)
      AND r.doc_date <= $1::date
      AND COALESCE(r.doc_ref, '') <> ''
    GROUP BY r.doc_ref
),
deposit_used AS (
    SELECT
        u.trans_number AS dep_doc_no,
        SUM(COALESCE(u.amount, 0))::numeric(18, 2) AS used_amt
    FROM cb_trans_detail u
    WHERE COALESCE(u.last_status, 0) = 0
      AND u.doc_type IN (5, 6)
      AND u.trans_flag NOT IN (40, 110, 9040, 9110)
      AND u.doc_date <= $1::date
      AND COALESCE(u.trans_number, '') <> ''
      AND (
          CASE
              WHEN u.trans_flag IN (19, 239) THEN EXISTS (
                  SELECT 1 FROM ap_ar_trans a
                  WHERE a.doc_no = u.doc_no AND a.trans_flag = u.trans_flag AND COALESCE(a.last_status, 0) = 0
              )
              ELSE EXISTS (
                  SELECT 1 FROM ic_trans i
                  WHERE i.doc_no = u.doc_no AND i.trans_flag = u.trans_flag AND COALESCE(i.last_status, 0) = 0
              )
          END
      )
    GROUP BY u.trans_number
)
SELECT
    t.doc_date,
    t.doc_no,
    t.trans_flag,
    CASE
        WHEN t.trans_flag IN (40, 9040) THEN 'เงินรับล่วงหน้า (2131-00)'
        ELSE 'เงินมัดจำรับ (2132-00)'
    END AS deposit_category,
    COALESCE(t.cust_code, '') AS cust_code,
    COALESCE(c.name_1, '') AS cust_name,
    COALESCE(t.doc_ref, '') AS ref_so_no,
    ROUND(COALESCE(t.total_amount, 0), 2) AS deposit_amount,
    ROUND(COALESCE(dr.returned_amt, 0), 2) AS refunded_amount,
    ROUND(COALESCE(du.used_amt, 0), 2) AS applied_amount,
    ROUND(COALESCE(t.total_amount, 0) - COALESCE(dr.returned_amt, 0) - COALESCE(du.used_amt, 0), 2) AS remaining_balance
FROM ic_trans t
LEFT JOIN ar_customer c ON c.code = t.cust_code
LEFT JOIN deposit_returns dr ON dr.dep_doc_no = t.doc_no
LEFT JOIN deposit_used du ON du.dep_doc_no = t.doc_no
WHERE COALESCE(t.last_status, 0) = 0
  AND t.trans_flag IN (40, 110, 9040, 9110)
  AND t.doc_date <= $1::date
  AND ($2::text = '' OR t.cust_code = $2::text)
  AND ROUND(COALESCE(t.total_amount, 0) - COALESCE(dr.returned_amt, 0) - COALESCE(du.used_amt, 0), 2) > 0
ORDER BY t.cust_code ASC, t.doc_date ASC, t.doc_no ASC;
```

---

## 2. ประวัติการตัดใช้และคืนเงินของใบมัดจำใบหนึ่ง (`doc_no = $1`)

ใช้ตรวจสอบว่าใบรับเงินมัดจำ/เงินรับล่วงหน้าเลขที่ `$1` ถูกนำไปตัดในบิลขาย (`44`), เพิ่มหนี้ (`46`), ใบเสร็จ (`239`) หรือทำใบคืนเงิน (`42, 112`) ใบใดบ้าง:

### พารามิเตอร์
- `$1` (`TEXT`): เลขที่ใบรับมัดจำ/เงินล่วงหน้า เช่น `'SRV-000001'`

```sql
SELECT
    'APPLIED_IN_BILL' AS event_type,
    u.doc_date AS event_date,
    u.doc_no AS target_doc_no,
    u.trans_flag AS target_trans_flag,
    ROUND(COALESCE(u.amount, 0), 2) AS cut_amount
FROM cb_trans_detail u
WHERE u.trans_number = $1
  AND COALESCE(u.last_status, 0) = 0
  AND u.doc_type IN (5, 6)
  AND u.trans_flag NOT IN (40, 110, 9040, 9110)

UNION ALL

SELECT
    'REFUNDED' AS event_type,
    r.doc_date AS event_date,
    r.doc_no AS target_doc_no,
    r.trans_flag AS target_trans_flag,
    ROUND(COALESCE(r.total_amount, 0), 2) AS cut_amount
FROM ic_trans r
WHERE r.doc_ref = $1
  AND COALESCE(r.last_status, 0) = 0
  AND r.trans_flag IN (42, 112)

ORDER BY event_date ASC, target_doc_no ASC;
```

---

## 3. ข้อควรระวัง (Gotchas)
1. **ห้ามลืม `u.trans_flag NOT IN (40, 110, 9040, 9110)`**: เพราะบางกรณีตาราง `cb_trans_detail` ของใบรับมัดจำเองมีแถวรับชำระที่อ้างเลขตัวเอง หากไม่กรองออกจะทำให้ยอดมัดจำถูกตัดตัวเองเป็นศูนย์ทันที (`report_menu_so_po.go:366`)
2. **อย่าลืมรวมรหัสยอดยกมา `9040` และ `9110`**: บริษัทที่เริ่มใช้ระบบกลางปีจะคีย์มัดจำคงค้างยกมาในเมนู `9040` (`SDB`) และ `9110` (`SRVB`) ซึ่งสามารถนำไปตัดในบิลขายได้เหมือน `40` และ `110` ทุกประการ
