---
title: "SQL ระบบ Lot สินค้า, วันหมดอายุ FEFO และคำขอทำลายสินค้า ป.79/2541"
audience: dev
tags: [sql, queries, ic, lot, fefo, expiry]
aliases: ["SQL Lot สินค้า", "SQL FEFO วันหมดอายุ", "ic_trans_detail_lot", "ic_lot_expiry_register", "ic_writeoff_petition"]
sources: ["backend/internal/application/process/stock_lot.go:315-360", "backend/internal/application/process/stock_expiry_fefo.go:75-265", "backend/internal/application/process/trans_lot_auto.go:105-140"]
---

ชุดคำสั่ง SQL สำหรับตรวจสอบยอดคงเหลือราย Lot (`ic_trans_detail_lot`), หามูลค่าค้างปลายงวดเมื่อปริมาณเป็น 0 (`lotResidualSQL`), คุมวันหมดอายุแบบ FEFO (`ic_lot_expiry_register`) และติดตามคำขอทำลายสินค้าต่อกรมสรรพากร ป.79/2541 (`ic_writeoff_petition`)

---

## 1. ยอดคงเหลือราย Lot ต่อคลังและพื้นที่เก็บ (`ic_trans_detail_lot`)

อ้างอิงตรรกะกรองเอกสารปกติจาก `lotDocLive` (`stock_lot.go:315-318`) เพื่อไม่ให้นับ Lot ที่หัวเอกสาร `ic_trans` ถูกยกเลิก (`last_status = 1`):

**พารามิเตอร์**: `$1::date` (ณ วันที่), `$2::text` (รหัสสินค้า หรือ `''` = ทั้งหมด)

```sql
SELECT l.item_code,
       COALESCE(i.name_1, '') AS item_name,
       COALESCE(l.wh_code, '') AS wh_code,
       COALESCE(l.shelf_code, '') AS shelf_code,
       COALESCE(l.lot_number, '') AS lot_number,
       MIN(l.date_expire) AS expire_date,
       SUM(l.calc_flag * l.qty)::numeric(18, 4) AS balance_qty,
       ROUND(SUM(l.calc_flag * l.amount), 2)::numeric(18, 2) AS balance_amount
FROM ic_trans_detail_lot l
LEFT JOIN ic_inventory i ON i.code = l.item_code
WHERE l.doc_date::date <= $1::date
  AND ($2 = '' OR l.item_code = $2)
  AND NOT EXISTS (
      SELECT 1
      FROM ic_trans h
      WHERE h.doc_no = l.doc_no
        AND h.trans_flag = l.trans_flag
        AND COALESCE(h.last_status, 0) = 1
  )
GROUP BY l.item_code, COALESCE(i.name_1, ''), COALESCE(l.wh_code, ''), COALESCE(l.shelf_code, ''), COALESCE(l.lot_number, '')
HAVING SUM(l.calc_flag * l.qty) <> 0 OR ROUND(SUM(l.calc_flag * l.amount), 2) <> 0
ORDER BY l.item_code, expire_date NULLS LAST, wh_code, shelf_code, lot_number;
```

- **ประโยชน์**: ใช้หาทั้ง Lot ที่พร้อมจ่าย (เรียง `expire_date ASC` สำหรับ FEFO) และ Lot ที่ `balance_qty = 0` แต่มูลค่าคงเหลือ (`balance_amount <> 0`) เพื่อส่งเข้าปรับมูลค่าค้าง (`lotamountsave`)

---

## 2. ทะเบียนคุมวันหมดอายุสินค้า FEFO & กลุ่มแจ้งเตือน (`ic_lot_expiry_register`)

อ้างอิงจาก `stock_expiry_fefo.go:75-175`:

**พารามิเตอร์**: `$1::date` (วันอ้างอิงเทียบอายุ เช่น `CURRENT_DATE`)

```sql
SELECT lot_key,
       lot_no,
       item_code,
       item_name,
       wh_code,
       mfg_date,
       expiry_date,
       (expiry_date - $1::date) AS days_remaining,
       CASE
           WHEN expiry_date < $1::date THEN 'EXPIRED'
           WHEN (expiry_date - $1::date) <= 30 THEN 'CRITICAL_30D'
           WHEN (expiry_date - $1::date) <= 90 THEN 'WARNING_90D'
           ELSE 'HEALTHY'
       END AS expiry_bucket,
       qty_balance::numeric(18, 4) AS qty_balance,
       unit_code,
       unit_cost::numeric(18, 4) AS unit_cost,
       ROUND(qty_balance * unit_cost, 2)::numeric(18, 2) AS stock_value_at_risk,
       fda_reg_no
FROM ic_lot_expiry_register
WHERE qty_balance > 0
ORDER BY expiry_date ASC, lot_no ASC;
```

---

## 3. ติดตามคำขอทำลายสินค้าเสื่อมสภาพ ป.79/2541 (`ic_writeoff_petition`)

ตรวจสอบเงื่อนไขแจ้งสรรพากรล่วงหน้าอย่างน้อย 30 วัน (`meets_30day_rule` หรือ `is_perishable_immediate` สำหรับของเสียง่ายทำลายทันที):

```sql
SELECT petition_doc_no,
       notice_date,
       earliest_destroy_date,
       planned_destroy_date,
       is_perishable_immediate,
       meets_30day_rule,
       lot_no,
       item_code,
       item_name,
       destroy_qty::numeric(18, 4) AS destroy_qty,
       unit_cost::numeric(18, 4) AS unit_cost,
       total_writeoff_cost::numeric(18, 2) AS total_writeoff_cost,
       vat_exempt_amount::numeric(18, 2) AS vat_exempt_amount,
       destroy_method,
       witness_committee,
       rd_area_office,
       status
FROM ic_writeoff_petition
ORDER BY notice_date DESC, petition_doc_no DESC;
```
