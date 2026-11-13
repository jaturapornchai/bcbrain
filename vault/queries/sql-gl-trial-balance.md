---
title: "SQL งบทดลอง 6 ช่อง (Trial Balance) งบทดลองแยกสาขา และผังบัญชีลำดับชั้น"
audience: "dev"
tags: [queries, sql, gl, trial_balance, branch, chart_of_account]
aliases:
  - "sql งบทดลอง trial balance 6 ช่อง"
  - "sql งบทดลองแยกสาขา branch trial balance"
  - "sql งบทดลองรวมยอดบัญชีคุม main_code"
  - "glfaTB glfaBranchTB"
sources:
  - "backend/internal/application/process/report_menu_gl_fa.go:343-393"
  - "backend/internal/application/process/report_menu_gl_fa.go:503-536"
  - "backend/internal/adapter/inbound/http/mcp/gateway.go:2062-2076"
---

# SQL งบทดลอง 6 ช่อง (Trial Balance) งบทดลองแยกสาขา และผังบัญชีลำดับชั้น

รวมคำสั่ง SQL สำหรับดึงงบทดลองมาตรฐาน 6 ช่อง (ยอดยกมา เดบิต/เครดิต, ประจำงวด เดบิต/เครดิต, ยอดคงเหลือยกไป เดบิต/เครดิต), งบทดลองแยกตามสาขา (`glfaBranchTB`) และการรวมยอดจากบัญชีย่อยขึ้นสู่บัญชีคุม (`main_code`) ตามลำดับชั้นผังบัญชี (ดูผังบัญชีมาตรฐานที่ [[doc-gl-coa-standard]], แยกประเภทที่ [[sql-gl-journal-ledger]] และกฎกลางที่ [[sql-overview]])

---

## 1. งบทดลองมาตรฐาน 6 ช่อง (`glfaTB`)

สกัดจาก `glfaTB` (`report_menu_gl_fa.go:343-393`) แยกยอดยกมา (`doc_date < $1` หรือรายการเปิดงวด `journal_type = 1` ในวันที่ `$1`) ออกจากรายการเคลื่อนไหวประจำงวด พร้อมพารามิเตอร์เลือกตัดรายการปิดบัญชีสิ้นปี (`journal_type = 2`):

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้นงวด
- `$2` (`DATE`): วันที่สิ้นสุดงวด
- `$3` (`BOOLEAN`): `true` = งบทดลองก่อนปิดบัญชี (ตัด `journal_type = 2` ออก), `false` = งบทดลองหลังปิดบัญชี

```sql
WITH acct_agg AS (
    SELECT
        c.code AS account_code,
        COALESCE(c.name_1, '') AS account_name,
        COALESCE(c.account_type, 0) AS account_type,
        COALESCE(c.account_level, 0) AS account_level,
        COALESCE(SUM(COALESCE(d.debit, 0) - COALESCE(d.credit, 0)) FILTER (
            WHERE d.doc_date < $1::date
               OR (d.doc_date = $1::date AND COALESCE(d.journal_type, 0) = 1)
        ), 0)::numeric(18, 2) AS opening_net,
        COALESCE(SUM(COALESCE(d.debit, 0)) FILTER (
            WHERE d.doc_date BETWEEN $1::date AND $2::date
              AND NOT (d.doc_date = $1::date AND COALESCE(d.journal_type, 0) = 1)
              AND (NOT $3::boolean OR COALESCE(d.journal_type, 0) <> 2)
        ), 0)::numeric(18, 2) AS period_debit,
        COALESCE(SUM(COALESCE(d.credit, 0)) FILTER (
            WHERE d.doc_date BETWEEN $1::date AND $2::date
              AND NOT (d.doc_date = $1::date AND COALESCE(d.journal_type, 0) = 1)
              AND (NOT $3::boolean OR COALESCE(d.journal_type, 0) <> 2)
        ), 0)::numeric(18, 2) AS period_credit
    FROM gl_chart_of_account c
    LEFT JOIN gl_journal_detail d
      ON d.account_code = c.code
     AND COALESCE(d.is_pass, 0) IN (0, 1)
     AND d.doc_date <= $2::date
    GROUP BY c.code, c.name_1, c.account_type, c.account_level
),
tb_calc AS (
    SELECT
        account_code,
        account_name,
        account_type,
        account_level,
        GREATEST(opening_net, 0)::numeric(18, 2) AS opening_dr,
        GREATEST(-opening_net, 0)::numeric(18, 2) AS opening_cr,
        period_debit AS period_dr,
        period_credit AS period_cr,
        (opening_net + period_debit - period_credit)::numeric(18, 2) AS ending_net
    FROM acct_agg
    WHERE opening_net <> 0 OR period_debit <> 0 OR period_credit <> 0
)
SELECT
    account_code,
    account_name,
    account_type,
    CASE account_type
        WHEN 0 THEN 'สินทรัพย์'
        WHEN 1 THEN 'หนี้สิน'
        WHEN 2 THEN 'ส่วนของเจ้าของ'
        WHEN 3 THEN 'รายได้'
        WHEN 4 THEN 'ค่าใช้จ่าย'
        ELSE 'อื่นๆ'
    END AS account_type_name,
    ROUND(opening_dr, 2) AS opening_debit,
    ROUND(opening_cr, 2) AS opening_credit,
    ROUND(period_dr, 2) AS period_debit,
    ROUND(period_cr, 2) AS period_credit,
    ROUND(GREATEST(ending_net, 0), 2) AS ending_debit,
    ROUND(GREATEST(-ending_net, 0), 2) AS ending_credit
FROM tb_calc
ORDER BY account_code ASC;
```

### คอลัมน์ผลลัพธ์สำคัญ
| คอลัมน์ | คำอธิบาย |
|---|---|
| `opening_debit` / `opening_credit` | ยอดดุลยกมาสุทธิด้านเดบิตหรือด้านเครดิต ณ ต้นงวด `$1` |
| `period_debit` / `period_credit` | ยอดเคลื่อนไหวรวมด้านเดบิตและเครดิตระหว่าง `$1` ถึง `$2` |
| `ending_debit` / `ending_credit` | ยอดดุลคงเหลือสุทธิยกไป ณ สิ้นงวด `$2` (ผลรวมทั้งตาราง `SUM(ending_debit) = SUM(ending_credit)` ทุกสตางค์) |

---

## 2. งบทดลองแยกตามสาขา (`glfaBranchTB`)

สกัดจาก `glfaBranchTB` (`report_menu_gl_fa.go:503-536`) แสดงยอดเคลื่อนไหวและยอดคงเหลือแยกตาม `branch_code`:

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้นงวด
- `$2` (`DATE`): วันที่สิ้นสุดงวด
- `$3` (`TEXT`): รหัสสาขา `branch_code` (ส่ง `''` เพื่อดูทุกสาขา)

```sql
SELECT
    COALESCE(d.branch_code, h.branch_code, '') AS branch_code,
    COALESCE(br.name_1, 'ไม่ระบุสาขา') AS branch_name,
    d.account_code,
    COALESCE(c.name_1, '') AS account_name,
    COALESCE(c.account_type, 0) AS account_type,
    ROUND(SUM(COALESCE(d.debit, 0)) FILTER (WHERE d.doc_date BETWEEN $1::date AND $2::date), 2) AS period_debit,
    ROUND(SUM(COALESCE(d.credit, 0)) FILTER (WHERE d.doc_date BETWEEN $1::date AND $2::date), 2) AS period_credit,
    ROUND(GREATEST(SUM(COALESCE(d.debit, 0) - COALESCE(d.credit, 0)), 0), 2) AS ending_debit,
    ROUND(GREATEST(SUM(COALESCE(d.credit, 0) - COALESCE(d.debit, 0)), 0), 2) AS ending_credit
FROM gl_journal_detail d
JOIN gl_journal h
  ON h.doc_no = d.doc_no
 AND h.doc_date = d.doc_date
 AND COALESCE(h.book_code, '') = COALESCE(d.book_code, '')
LEFT JOIN gl_chart_of_account c
  ON c.code = d.account_code
LEFT JOIN erp_branch_list br
  ON br.code = COALESCE(d.branch_code, h.branch_code, '')
WHERE COALESCE(d.is_pass, 0) IN (0, 1)
  AND d.doc_date <= $2::date
  AND ($3::text = '' OR COALESCE(d.branch_code, h.branch_code, '') = $3::text)
GROUP BY
    COALESCE(d.branch_code, h.branch_code, ''),
    br.name_1,
    d.account_code,
    c.name_1,
    c.account_type
ORDER BY branch_code ASC, d.account_code ASC;
```

---

## 3. งบทดลองรวมยอดตามลำดับชั้นผังบัญชีแม่-ลูก (`WITH RECURSIVE` COA Roll-Up)

สำหรับการออกรายงานผู้บริหารที่ต้องการเห็นยอดรวมระดับบัญชีคุม (`main_code` ระดับ 1–3) ไล่ลงมาถึงบัญชีย่อยโดยไม่นับยอดซ้ำ:

### พารามิเตอร์
- `$1` (`DATE`): วันที่สิ้นสุดงวด (`as_of_date`)

```sql
WITH RECURSIVE leaf_balances AS (
    SELECT
        d.account_code,
        SUM(COALESCE(d.debit, 0))::numeric(18, 2) AS total_dr,
        SUM(COALESCE(d.credit, 0))::numeric(18, 2) AS total_cr
    FROM gl_journal_detail d
    WHERE COALESCE(d.is_pass, 0) IN (0, 1)
      AND d.doc_date <= $1::date
    GROUP BY d.account_code
),
coa_rollup AS (
    -- เริ่มจากบัญชีที่มีรายการโพสต์จริงทุกตัว
    SELECT
        c.code AS account_code,
        c.main_code,
        lb.total_dr,
        lb.total_cr
    FROM gl_chart_of_account c
    JOIN leaf_balances lb ON lb.account_code = c.code

    UNION ALL

    -- ส่งยอดขึ้นหาบัญชีแม่ (main_code) จนถึงระดับสูงสุด
    SELECT
        parent.code AS account_code,
        parent.main_code,
        child.total_dr,
        child.total_cr
    FROM coa_rollup child
    JOIN gl_chart_of_account parent
      ON parent.code = child.main_code
     AND COALESCE(child.main_code, '') <> ''
     AND parent.code <> child.account_code
)
SELECT
    c.code AS account_code,
    COALESCE(c.name_1, '') AS account_name,
    COALESCE(c.account_level, 0) AS account_level,
    COALESCE(c.main_code, '') AS parent_account_code,
    ROUND(SUM(r.total_dr), 2) AS rollup_debit,
    ROUND(SUM(r.total_cr), 2) AS rollup_credit,
    ROUND(SUM(r.total_dr - r.total_cr), 2) AS net_dr_minus_cr
FROM coa_rollup r
JOIN gl_chart_of_account c
  ON c.code = r.account_code
GROUP BY c.code, c.name_1, c.account_level, c.main_code
ORDER BY c.code ASC;
```

---

## 4. ข้อควรระวัง (Gotchas)
- **ห้ามนำบรรทัดบัญชีคุมจากคำสั่งที่ 3 มา `SUM` รวมกับบัญชีย่อยซ้ำ**: ในคำสั่งที่ 1 (`glfaTB`) ทุกแถวคือบัญชีย่อยที่มีการลงรายการจริงจึงรวมยอดท้ายตารางได้ทันที ส่วนคำสั่งที่ 3 เป็นตารางแบบต้นไม้ (`rollup`) หากต้องการเช็คยอดรวมทั้งหมดต้อง `SUM` เฉพาะแถวระดับเดียว (เช่น `account_level = 1`)
- **งบทดลองก่อนปิดงวด vs หลังปิดงวด**: หากต้องการตรวจตัวเลขเพื่อจัดทำงบกำไรขาดทุนและภ.ง.ด.50 ให้ส่ง `$3 = true` เพื่อไม่ให้ใบสำคัญปิดบัญชีสิ้นปี (`journal_type = 2`) ล้างหมวด 4 และหมวด 5 เป็นศูนย์ (ดู [[sql-gl-profit-and-loss]] และ [[sql-gl-balance-sheet]])
