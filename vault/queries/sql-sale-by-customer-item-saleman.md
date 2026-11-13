---
title: "SQL ยอดขายแยกตามสินค้า ลูกค้า พนักงานขาย กำไรขั้นต้น และตรวจขายต่ำกว่าทุน"
audience: "dev"
tags: [queries, sql, sale, margin, top_products, customer, saleman, ic_trans_detail]
aliases:
  - "sql สินค้าขายดี top products"
  - "sql กำไรขั้นต้นรายสินค้า gross margin"
  - "sql ยอดขายแยกตามลูกค้า พนักงานขาย"
  - "sql ขายต่ำกว่าทุน sale below cost"
  - "SO_FR_MARGIN_REACCEPTANCE SO_FR_PRODUCT_SALE_LOSS"
sources:
  - "backend/internal/adapter/inbound/http/ai/context_sales_ar.go:18-37"
  - "backend/internal/adapter/inbound/http/mcp/gateway.go:2168-2184"
  - "backend/internal/application/process/report_menu_so_po.go:651-788"
  - "backend/internal/application/process/report_menu_sopo.go:190-212"
---

# SQL ยอดขายแยกตามสินค้า ลูกค้า พนักงานขาย กำไรขั้นต้น และตรวจขายต่ำกว่าทุน

เมื่อวิเคราะห์ระดับรายการสินค้า (`ic_trans_detail`) ต้องใช้ยอดก่อนภาษีระดับบรรทัด **`sum_amount_exclude_vat`** เทียบกับต้นทุนตัดสต็อก **`sum_of_cost`** และหักยอดรับคืนสินค้า (`trans_flag = 48`) เสมอ (ดูกลไกการคิดต้นทุนที่ [[doc-impact-stock-lot-serial]])

---

## 1. สินค้าขายดีและกำไรขั้นต้นสุทธิหลังหักรับคืน (`SO_FR_MARGIN_REACCEPTANCE`)

ดัดแปลงตรงจาก `context_sales_ar.go:salesBySkuMonthSQL` และ `report_menu_so_po.go:651-745` โดยคำนวณปริมาณหน่วยฐาน ยอดขายสุทธิ ต้นทุนขายสุทธิ กำไรขั้นต้น และอัตรากำไรขั้นต้น (`%`):

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้น
- `$2` (`DATE`): วันที่สิ้นสุด
- `$3` (`INTEGER`): จำนวนอันดับสูงสุดที่ต้องการ เช่น `50`

```sql
SELECT
    d.item_code,
    MAX(COALESCE(NULLIF(i.name_1, ''), d.item_name, '')) AS item_name,
    COALESCE(i.unit_standard, MAX(d.unit_code), '') AS base_unit,
    ROUND(SUM(
        (CASE WHEN d.trans_flag = 48 THEN -1 ELSE 1 END)
        * COALESCE(d.qty, 0)
        * (COALESCE(NULLIF(d.stand_value, 0), 1) / COALESCE(NULLIF(d.divide_value, 0), 1))
    ), 2) AS net_base_qty,
    ROUND(SUM(
        (CASE WHEN d.trans_flag = 48 THEN -1 ELSE 1 END)
        * COALESCE(d.sum_amount_exclude_vat, d.sum_amount, 0)
    ), 2) AS net_sales_ex_vat,
    ROUND(SUM(
        (CASE WHEN d.trans_flag = 48 THEN -1 ELSE 1 END)
        * COALESCE(d.sum_of_cost, 0)
    ), 2) AS net_cogs,
    ROUND(SUM(
        (CASE WHEN d.trans_flag = 48 THEN -1 ELSE 1 END)
        * (COALESCE(d.sum_amount_exclude_vat, d.sum_amount, 0) - COALESCE(d.sum_of_cost, 0))
    ), 2) AS gross_profit,
    CASE
        WHEN SUM((CASE WHEN d.trans_flag = 48 THEN -1 ELSE 1 END) * COALESCE(d.sum_amount_exclude_vat, d.sum_amount, 0)) > 0
        THEN ROUND(
            SUM((CASE WHEN d.trans_flag = 48 THEN -1 ELSE 1 END) * (COALESCE(d.sum_amount_exclude_vat, d.sum_amount, 0) - COALESCE(d.sum_of_cost, 0)))
            * 100.0
            / SUM((CASE WHEN d.trans_flag = 48 THEN -1 ELSE 1 END) * COALESCE(d.sum_amount_exclude_vat, d.sum_amount, 0)),
            2
        )
        ELSE 0::numeric(18, 2)
    END AS gross_margin_pct
FROM ic_trans_detail d
JOIN ic_trans h
  ON h.doc_no = d.doc_no AND h.trans_flag = d.trans_flag
LEFT JOIN ic_inventory i
  ON i.code = d.item_code
WHERE COALESCE(h.last_status, 0) = 0
  AND COALESCE(d.last_status, 0) = 0
  AND d.trans_flag IN (44, 46, 48)
  AND h.doc_date BETWEEN $1::date AND $2::date
  AND COALESCE(d.item_code, '') <> ''
GROUP BY d.item_code, i.unit_standard
ORDER BY net_sales_ex_vat DESC
LIMIT $3;
```

---

## 2. สรุปยอดขายสุทธิแยกตามลูกค้า (`ar_customer`) และพนักงานขาย (`sale_code`)

สกัดจาก `report_menu_sopo.go:sopoSellBySale` เพื่อดูยอดขายรวม หักรับคืน และจำนวนบิลต่อลูกค้าหรือพนักงานขาย:

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้น
- `$2` (`DATE`): วันที่สิ้นสุด

```sql
SELECT
    COALESCE(t.cust_code, '') AS cust_code,
    COALESCE(c.name_1, '') AS cust_name,
    COALESCE(t.sale_code, '') AS sale_code,
    COUNT(*) FILTER (WHERE t.trans_flag = 44) AS invoice_count,
    ROUND(SUM(CASE WHEN t.trans_flag IN (44, 46)
        THEN COALESCE(t.total_before_vat, 0) + COALESCE(t.total_except_vat, 0)
        ELSE 0 END), 2) AS sales_ex_vat,
    ROUND(SUM(CASE WHEN t.trans_flag = 48
        THEN COALESCE(t.total_before_vat, 0) + COALESCE(t.total_except_vat, 0)
        ELSE 0 END), 2) AS return_ex_vat,
    ROUND(SUM(
        (CASE WHEN t.trans_flag = 48 THEN -1 ELSE 1 END)
        * (COALESCE(t.total_before_vat, 0) + COALESCE(t.total_except_vat, 0))
    ), 2) AS net_sales_ex_vat,
    ROUND(SUM(
        (CASE WHEN t.trans_flag = 48 THEN -1 ELSE 1 END)
        * COALESCE(t.total_amount, 0)
    ), 2) AS net_total_inc_vat
FROM ic_trans t
LEFT JOIN ar_customer c ON c.code = t.cust_code
WHERE COALESCE(t.last_status, 0) = 0
  AND t.trans_flag IN (44, 46, 48)
  AND t.doc_date BETWEEN $1::date AND $2::date
GROUP BY COALESCE(t.cust_code, ''), COALESCE(c.name_1, ''), COALESCE(t.sale_code, '')
ORDER BY net_sales_ex_vat DESC;
```

---

## 3. ตรวจสอบรายการขายต่ำกว่าทุน (`SO_FR_PRODUCT_SALE_LOSS`)

สกัดตรงจากรายงานตรวจความผิดปกติ `SO_FR_PRODUCT_SALE_LOSS` (`report_menu_so_po.go:755-785`) เพื่อดึงบรรทัดบิลขายที่มีมูลค่าขายก่อนภาษีต่ำกว่าต้นทุนตัดสต็อก (`sum_amount_exclude_vat < sum_of_cost`):

```sql
SELECT
    d.doc_date,
    d.doc_no,
    COALESCE(h.cust_code, '') AS cust_code,
    COALESCE(c.name_1, '') AS cust_name,
    d.item_code,
    COALESCE(d.item_name, '') AS item_name,
    ROUND(COALESCE(d.qty, 0), 2) AS qty,
    COALESCE(d.unit_code, '') AS unit_code,
    ROUND(COALESCE(d.sum_amount_exclude_vat, 0), 2) AS sale_ex_vat,
    ROUND(COALESCE(d.sum_of_cost, 0), 2) AS cost_amount,
    ROUND(COALESCE(d.sum_amount_exclude_vat, 0) - COALESCE(d.sum_of_cost, 0), 2) AS loss_amount
FROM ic_trans_detail d
JOIN ic_trans h
  ON h.doc_no = d.doc_no AND h.trans_flag = d.trans_flag
LEFT JOIN ar_customer c
  ON c.code = h.cust_code
WHERE COALESCE(h.last_status, 0) = 0
  AND COALESCE(d.last_status, 0) = 0
  AND d.trans_flag = 44
  AND d.doc_date BETWEEN $1::date AND $2::date
  AND COALESCE(d.qty, 0) > 0
  AND COALESCE(d.sum_of_cost, 0) > COALESCE(d.sum_amount_exclude_vat, 0)
ORDER BY loss_amount ASC, d.doc_date DESC;
```

---

## 4. ข้อควรระวัง (Gotchas)
1. **ต้องคำนวณต้นทุนสต็อก (`RebuildStock`) ให้เป็นปัจจุบัน**: หากมีบิลรับเข้าสินค้าย้อนหลังโดยยังไม่ได้รันประมวลผลต้นทุน `sum_of_cost` ใน `ic_trans_detail` อาจยังเป็นค่าก่อนปรับปรุง
2. **ส่วนลดท้ายบิล (`ic_trans.total_discount`)**: คอลัมน์ `d.sum_amount_exclude_vat` ใน `ic_trans_detail` ปันส่วนลดท้ายบิลและแยกภาษีออกให้เรียบร้อยแล้วจาก `transcalc.go` จึงสามารถนำมารวมเทียบกับหัวบิลได้โดยตรง
