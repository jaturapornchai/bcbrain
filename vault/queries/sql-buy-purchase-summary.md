---
title: "SQL สรุปยอดซื้อสุทธิ แยกตามผู้ขาย กลุ่มสินค้า และประเภทภาษี (Purchase Summary)"
audience: "dev"
tags: [queries, sql, buy, purchase, supplier, ic_trans, ic_trans_detail]
aliases:
  - "sql สรุปยอดซื้อสุทธิ"
  - "sql ยอดซื้อแยกตามเจ้าหนี้ ผู้ขาย"
  - "sql ยอดซื้อสินค้าและบริการ"
  - "trans_flag 12 315 14 316 16 317 purchase sql"
  - "PO_FR purchase summary"
sources:
  - "backend/internal/application/process/report_menu_so_po.go:524-649"
  - "backend/internal/application/process/report_menu_so_po.go:789-835"
---

# SQL สรุปยอดซื้อสุทธิ แยกตามผู้ขาย กลุ่มสินค้า และประเภทภาษี

การคำนวณยอดซื้อสุทธิในระบบ BC Ai Account ต้องระวังกรณีบริษัทใช้ทั้งเมนู **ซื้อสินค้าปกติ (`trans_flag = 12`)** และวงจร **ทะยอยรับสินค้าตาม PO (`310` → ตั้งหนี้ `315`)**:
- หากต้องการ **ยอดซื้อตามใบกำกับภาษี/ใบตั้งหนี้**: ใช้ `trans_flag IN (12, 315)` บวกเพิ่มหนี้ `(14, 316)` หักลดหนี้ `(16, 317)` (ไม่นับ `310` ที่ถูกดึงไปตั้งหนี้ `315` แล้ว เพื่อไม่ให้ซ้ำ!)
- หากต้องการ **ปริมาณของรับเข้าคลังจริง**: ใช้ `trans_flag IN (12, 310)` หักส่งคืนของ `(16, 311)` ที่ `calc_flag <> 0` (ดู [[doc-trans-flag-catalog]] และ [[doc-gl-templates-trade-apar]])

---

## 1. สรุปยอดซื้อสุทธิรายผู้จำหน่าย (`ap_supplier`) ตามเอกสารตั้งหนี้/ซื้อสด

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้น
- `$2` (`DATE`): วันที่สิ้นสุด

```sql
SELECT
    COALESCE(t.cust_code, '') AS supplier_code,
    COALESCE(s.name_1, '') AS supplier_name,
    COUNT(*) FILTER (WHERE t.trans_flag IN (12, 315)) AS bill_count,
    COUNT(*) FILTER (WHERE t.trans_flag IN (16, 317)) AS cn_count,
    ROUND(SUM(CASE WHEN t.trans_flag IN (12, 315, 14, 316)
        THEN COALESCE(t.total_before_vat, 0) + COALESCE(t.total_except_vat, 0)
        ELSE 0 END), 2) AS gross_purchase_ex_vat,
    ROUND(SUM(CASE WHEN t.trans_flag IN (16, 317)
        THEN COALESCE(t.total_before_vat, 0) + COALESCE(t.total_except_vat, 0)
        ELSE 0 END), 2) AS return_cn_ex_vat,
    ROUND(SUM(
        (CASE WHEN t.trans_flag IN (16, 317) THEN -1 ELSE 1 END)
        * (COALESCE(t.total_before_vat, 0) + COALESCE(t.total_except_vat, 0))
    ), 2) AS net_purchase_ex_vat,
    ROUND(SUM(
        (CASE WHEN t.trans_flag IN (16, 317) THEN -1 ELSE 1 END)
        * COALESCE(t.total_vat_value, 0)
    ), 2) AS net_input_vat,
    ROUND(SUM(
        (CASE WHEN t.trans_flag IN (16, 317) THEN -1 ELSE 1 END)
        * COALESCE(t.total_amount, 0)
    ), 2) AS net_total_inc_vat
FROM ic_trans t
LEFT JOIN ap_supplier s ON s.code = t.cust_code
WHERE COALESCE(t.last_status, 0) = 0
  AND t.trans_flag IN (12, 315, 14, 316, 16, 317)
  AND t.doc_date BETWEEN $1::date AND $2::date
GROUP BY COALESCE(t.cust_code, ''), COALESCE(s.name_1, '')
ORDER BY net_purchase_ex_vat DESC;
```

---

## 2. สรุปปริมาณและมูลค่าซื้อสุทธิแยกตามสินค้า (`ic_inventory`) และกลุ่มสินค้า (`group_code`)

ดึงระดับบรรทัด `ic_trans_detail` สำหรับการวิเคราะห์จัดซื้อและต่อรองราคาซัพพลายเออร์:

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้น
- `$2` (`DATE`): วันที่สิ้นสุด

```sql
SELECT
    COALESCE(i.group_code, '') AS item_group_code,
    d.item_code,
    MAX(COALESCE(NULLIF(i.name_1, ''), d.item_name, '')) AS item_name,
    COALESCE(i.unit_standard, MAX(d.unit_code), '') AS base_unit,
    ROUND(SUM(
        (CASE WHEN d.trans_flag IN (16, 317) THEN -1 ELSE 1 END)
        * CASE WHEN d.trans_flag IN (14, 316) THEN 0
               WHEN d.trans_flag IN (16, 317) AND COALESCE(d.inquiry_type, 0) IN (1, 3) THEN 0
               ELSE COALESCE(d.qty, 0) * (COALESCE(NULLIF(d.stand_value, 0), 1) / COALESCE(NULLIF(d.divide_value, 0), 1))
          END
    ), 2) AS net_received_base_qty,
    ROUND(SUM(
        (CASE WHEN d.trans_flag IN (16, 317) THEN -1 ELSE 1 END)
        * COALESCE(d.sum_amount_exclude_vat, d.sum_amount, 0)
    ), 2) AS net_purchase_ex_vat,
    MIN(CASE WHEN d.trans_flag IN (12, 315) AND COALESCE(d.qty, 0) > 0
        THEN ROUND(COALESCE(d.sum_amount_exclude_vat, 0) / (d.qty * COALESCE(NULLIF(d.stand_value, 0), 1) / COALESCE(NULLIF(d.divide_value, 0), 1)), 4)
    END) AS min_base_unit_cost,
    MAX(CASE WHEN d.trans_flag IN (12, 315) AND COALESCE(d.qty, 0) > 0
        THEN ROUND(COALESCE(d.sum_amount_exclude_vat, 0) / (d.qty * COALESCE(NULLIF(d.stand_value, 0), 1) / COALESCE(NULLIF(d.divide_value, 0), 1)), 4)
    END) AS max_base_unit_cost
FROM ic_trans_detail d
JOIN ic_trans h
  ON h.doc_no = d.doc_no AND h.trans_flag = d.trans_flag
LEFT JOIN ic_inventory i
  ON i.code = d.item_code
WHERE COALESCE(h.last_status, 0) = 0
  AND COALESCE(d.last_status, 0) = 0
  AND d.trans_flag IN (12, 315, 14, 316, 16, 317)
  AND h.doc_date BETWEEN $1::date AND $2::date
  AND COALESCE(d.item_code, '') <> ''
GROUP BY COALESCE(i.group_code, ''), d.item_code, i.unit_standard
ORDER BY net_purchase_ex_vat DESC;
```

---

## 3. ข้อควรระวัง (Gotchas)
1. **ลดหนี้ราคาผิด (`inquiry_type IN (1, 3)` บน `trans_flag IN (16, 317)`)**: บรรทัดเหล่านี้ระบุจำนวนสินค้าเพื่อใช้อ้างอิงคำนวณส่วนต่างราคาเฉยๆ แต่ **ไม่ได้ส่งของคืนออกจากคลัง** จึงต้องใส่ `WHEN d.trans_flag IN (16, 317) AND COALESCE(d.inquiry_type, 0) IN (1, 3) THEN 0` เมื่อคำนวณปริมาณรับสุทธิ (`net_received_base_qty`)
2. **ค่าใช้จ่ายอื่น (`trans_flag = 260, 262, 264`) และตั้งหนี้อื่น (`87, 89, 91`)**: บันทึกค่าไฟ ค่าเช่า ค่าขนส่ง ไม่ได้รวมอยู่ในยอดซื้อสินค้า หากต้องการดูค่าใช้จ่ายรวมทั้งบริษัทให้ดูงบกำไรขาดทุนที่ [[sql-gl-profit-and-loss]]
