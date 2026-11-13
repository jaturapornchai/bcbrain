---
title: "SQL ทะเบียนสินทรัพย์ถาวร (as_asset) ประวัติค่าเสื่อมราคา (1801) และกระทบยอด NBV เทียบ GL"
audience: "dev"
tags: [queries, sql, fa, fixed_asset, depreciation, as_asset, as_trans]
aliases:
  - "sql ทะเบียนสินทรัพย์ถาวร as_asset as_asset_detail"
  - "sql คำนวณค่าเสื่อมราคาสะสม มูลค่าตามบัญชีสุทธิ nbv"
  - "sql ประวัติโอนค่าเสื่อมราคา 1801"
  - "sql กระทบยอดสินทรัพย์ถาวรกับแยกประเภท GL"
sources:
  - "backend/internal/application/process/fa_depreciation.go:654-685"
  - "backend/internal/application/process/fa_depreciation.go:960-1042"
  - "backend/internal/application/process/report_menu_gl_fa.go:1327-1572"
  - "backend/internal/application/process/report_menu_gl_fa.go:1625-1648"
---

# SQL ทะเบียนสินทรัพย์ถาวร (`as_asset`) ประวัติค่าเสื่อมราคา (`1801`) และกระทบยอด NBV เทียบ GL

รวมคำสั่ง SQL มาตรฐานสำหรับดึงทะเบียนคุมสินทรัพย์ถาวร (`as_asset` + `as_asset_detail`), คำนวณค่าเสื่อมราคาสะสมและมูลค่าตามบัญชีสุทธิ (Net Book Value — NBV) ณ วันสิ้นงวด, ตรวจประวัติใบคำนวณค่าเสื่อมราคา (`trans_flag = 1801`) และกระทบยอดทะเบียนย่อยสินทรัพย์เทียบกับบัญชีแยกประเภท (ดูแม่แบบการโพสต์บัญชีสินทรัพย์ที่ [[doc-gl-templates-cb-ic-fa]], การขายสินทรัพย์และลีสซิ่งที่ [[sql-fa-disposal-and-leasing]] และกฎกลางที่ [[sql-overview]])

---

## 1. ทะเบียนสินทรัพย์ถาวรและมูลค่าตามบัญชีสุทธิ ณ วันสิ้นงวด (FA Register & As-Of NBV)

สกัดจาก `report_menu_gl_fa.go:1327-1460` และ `fa_depreciation.go:654-685` รวมยอดค่าเสื่อมราคาสะสมยกมา (`ad.as_sum_value_balance`) บวกค่าเสื่อมราคาที่ประมวลผลแล้วใน `as_trans_detail` (`trans_flag = 1801`) จนถึงวันที่ `$1` โดยตัดสินทรัพย์ที่ขายหรือตัดจำหน่ายออกไปแล้ว (`trans_flag = 1802`) ก่อนหรือในวันที่ `$1`:

### พารามิเตอร์
- `$1` (`DATE`): วันที่สิ้นสุดงวดที่ต้องการดูมูลค่าสุทธิ (`as_of_date`)

```sql
WITH posted_dep AS (
    SELECT
        d.item_code AS asset_code,
        SUM(COALESCE(d.sum_amount, 0))::numeric(18, 2) AS dep_posted_amt
    FROM as_trans_detail d
    JOIN as_trans h
      ON h.doc_no = d.doc_no AND h.trans_flag = d.trans_flag
    WHERE d.trans_flag = 1801
      AND COALESCE(d.last_status, 0) = 0
      AND COALESCE(h.last_status, 0) = 0
      AND h.doc_date <= $1::date
    GROUP BY d.item_code
),
disposed_assets AS (
    SELECT DISTINCT d.item_code AS asset_code
    FROM as_trans_detail d
    JOIN as_trans h
      ON h.doc_no = d.doc_no AND h.trans_flag = d.trans_flag
    WHERE d.trans_flag = 1802
      AND COALESCE(d.last_status, 0) = 0
      AND COALESCE(h.last_status, 0) = 0
      AND h.doc_date <= $1::date
)
SELECT
    a.code AS asset_code,
    COALESCE(a.name_1, '') AS asset_name,
    COALESCE(a.as_type, '') AS asset_type_code,
    COALESCE(a.department_code, '') AS department_code,
    COALESCE(a.account_code, '') AS cost_gl_account,
    COALESCE(a.depreciation_sum_account_code, '') AS accum_dep_gl_account,
    ad.as_buy_date AS buy_date,
    ad.start_calc_date,
    COALESCE(ad.as_age, 0) AS useful_life_years,
    ROUND(COALESCE(ad.as_buy_price, 0), 2) AS cost_price,
    ROUND(COALESCE(ad.as_dead_value, 0), 2) AS salvage_value,
    ROUND(COALESCE(ad.as_sum_value_balance, 0) + COALESCE(p.dep_posted_amt, 0), 2) AS total_accum_depreciation,
    ROUND(
        GREATEST(
            COALESCE(ad.as_buy_price, 0) - (COALESCE(ad.as_sum_value_balance, 0) + COALESCE(p.dep_posted_amt, 0)),
            0
        ),
        2
    ) AS net_book_value
FROM as_asset a
LEFT JOIN as_asset_detail ad
  ON ad.as_code = a.code
LEFT JOIN posted_dep p
  ON p.asset_code = a.code
LEFT JOIN disposed_assets disp
  ON disp.asset_code = a.code
WHERE disp.asset_code IS NULL
  AND (ad.as_buy_date IS NULL OR ad.as_buy_date <= $1::date)
ORDER BY a.as_type ASC, a.code ASC;
```

---

## 2. ประวัติเอกสารคำนวณและบันทึกค่าเสื่อมราคารายงวด (`trans_flag = 1801`)

สกัดจาก `fa_depreciation.go:960-1042` และ `report_menu_gl_fa.go:1461-1535` แสดงรายการค่าเสื่อมราคาแต่ละงวดใน `as_trans` และ `as_trans_detail`:

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้นงวด
- `$2` (`DATE`): วันที่สิ้นสุดงวด

```sql
SELECT
    h.doc_date,
    h.doc_no,
    d.date_begin AS calc_period_start,
    d.date_end AS calc_period_end,
    d.item_code AS asset_code,
    COALESCE(a.name_1, d.item_name, '') AS asset_name,
    COALESCE(a.depreciation_account_code, '') AS dep_expense_gl_account,
    COALESCE(a.depreciation_sum_account_code, '') AS accum_dep_gl_account,
    ROUND(COALESCE(d.sum_amount, 0), 2) AS depreciation_amount,
    COALESCE(h.remark, '') AS remark
FROM as_trans h
JOIN as_trans_detail d
  ON d.doc_no = h.doc_no
 AND d.trans_flag = h.trans_flag
LEFT JOIN as_asset a
  ON a.code = d.item_code
WHERE h.trans_flag = 1801
  AND COALESCE(h.last_status, 0) = 0
  AND COALESCE(d.last_status, 0) = 0
  AND h.doc_date BETWEEN $1::date AND $2::date
ORDER BY h.doc_date ASC, h.doc_no ASC, d.line_number ASC;
```

---

## 3. กระทบยอดทะเบียนสินทรัพย์ถาวร (FA Sub-Ledger) เทียบบัญชีแยกประเภท (GL)

สกัดจาก `report_menu_gl_fa.go:1625-1648` ตรวจหาความแตกต่างระหว่างยอดรวมค่าเสื่อมราคาสะสมในทะเบียนสินทรัพย์กับยอดคงเหลือจริงในบัญชีค่าเสื่อมราคาสะสม (`1219%` / `depreciation_sum_account_code`) บนแยกประเภท ณ วันที่ `$1`:

### พารามิเตอร์
- `$1` (`DATE`): วันที่สิ้นสุดงวด (`as_of_date`)

```sql
WITH fa_accum_by_acct AS (
    SELECT
        a.depreciation_sum_account_code AS account_code,
        SUM(
            COALESCE(ad.as_sum_value_balance, 0) + COALESCE(dep.dep_amt, 0)
        )::numeric(18, 2) AS subledger_accum_dep
    FROM as_asset a
    LEFT JOIN as_asset_detail ad
      ON ad.as_code = a.code
    LEFT JOIN (
        SELECT d.item_code, SUM(COALESCE(d.sum_amount, 0))::numeric(18, 2) AS dep_amt
        FROM as_trans_detail d
        JOIN as_trans h ON h.doc_no = d.doc_no AND h.trans_flag = d.trans_flag
        WHERE d.trans_flag = 1801
          AND COALESCE(d.last_status, 0) = 0
          AND COALESCE(h.last_status, 0) = 0
          AND h.doc_date <= $1::date
        GROUP BY d.item_code
    ) dep ON dep.item_code = a.code
    WHERE COALESCE(a.depreciation_sum_account_code, '') <> ''
      AND (ad.as_buy_date IS NULL OR ad.as_buy_date <= $1::date)
      AND NOT EXISTS (
          SELECT 1 FROM as_trans_detail sd
          JOIN as_trans sh ON sh.doc_no = sd.doc_no AND sh.trans_flag = sd.trans_flag
          WHERE sd.trans_flag = 1802
            AND sd.item_code = a.code
            AND COALESCE(sd.last_status, 0) = 0
            AND COALESCE(sh.last_status, 0) = 0
            AND sh.doc_date <= $1::date
      )
    GROUP BY a.depreciation_sum_account_code
),
gl_accum_by_acct AS (
    SELECT
        d.account_code,
        SUM(COALESCE(d.credit, 0) - COALESCE(d.debit, 0))::numeric(18, 2) AS gl_credit_balance
    FROM gl_journal_detail d
    WHERE COALESCE(d.is_pass, 0) IN (0, 1)
      AND d.doc_date <= $1::date
    GROUP BY d.account_code
)
SELECT
    f.account_code,
    COALESCE(c.name_1, '') AS account_name,
    ROUND(f.subledger_accum_dep, 2) AS fa_register_accum_dep,
    ROUND(COALESCE(g.gl_credit_balance, 0), 2) AS gl_accum_dep_balance,
    ROUND(f.subledger_accum_dep - COALESCE(g.gl_credit_balance, 0), 2) AS variance_amount
FROM fa_accum_by_acct f
LEFT JOIN gl_accum_by_acct g
  ON g.account_code = f.account_code
LEFT JOIN gl_chart_of_account c
  ON c.code = f.account_code
ORDER BY f.account_code ASC;
```

---

## 4. ข้อควรระวัง (Gotchas)
- **ห้ามลืมบวก `ad.as_sum_value_balance` (ค่าเสื่อมราคาสะสมยกมาจากระบบเดิม)**: กิจการที่ย้ายข้อมูลสินทรัพย์เข้ามาพร้อมค่าเสื่อมสะสมตั้งต้นจะเก็บยอดยกมาไว้ที่ `as_asset_detail.as_sum_value_balance` ส่วนเอกสาร `trans_flag = 1801` จะเก็บเฉพาะค่าเสื่อมราคาที่ประมวลผลตั้งแต่วันเริ่มใช้ระบบเป็นต้นไป
- **สูตรคำนวณรายวันตามจำนวนวันจริงของปี**: Engine ค่าเสื่อมราคา (`fa_depreciation.go`) คำนวณตามจำนวนวันจริงหารด้วย `365` (หรือ `366` ในปีอธิกสุรทิน) และไม่หักค่าเสื่อมเกินกว่า `as_buy_price - as_dead_value` (ราคาซาก เช่น `1.00` บาท)
