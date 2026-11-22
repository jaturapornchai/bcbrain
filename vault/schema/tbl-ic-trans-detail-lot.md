---
title: "ic_trans_detail_lot — ความเคลื่อนไหวสต็อกระดับ Lot และวันหมดอายุ"
tags: [schema, inventory, lot, fefo, expiry, bcaiaccount]
aliases: [ic_trans_detail_lot, ตาราง Lot สินค้า, คุม Lot]
sources:
  - scripts/sql/02_data_schema.sql:7027-7054
  - backend/internal/application/process/stock_lot.go:157-185
  - backend/internal/application/process/stock_lot.go:313-332
  - backend/internal/application/process/db_migrate.go:994-1023
  - backend/internal/application/process/service.go:1159-1167
  - backend/internal/application/process/service.go:1621-1683
  - backend/internal/application/process/service.go:1926-2023
  - backend/internal/application/process/stock_beginning.go:39-125
  - backend/internal/application/process/stock_beginning.go:531-572
  - backend/internal/application/process/trans_lot_auto.go:85-135
  - backend/internal/application/process/trans_save_rules.go:178-188
  - backend/internal/application/process/trans.go:421-425
---

# `ic_trans_detail_lot` — ความเคลื่อนไหวสต็อกระดับ Lot และวันหมดอายุ

`ic_trans_detail_lot` ใช้จัดเก็บรายละเอียดความเคลื่อนไหวราย **Lot Number** และวันผลิต/วันหมดอายุสำหรับสินค้าที่มีการคุม Lot (`cost_type IN (1, 2, 3)` เช่น LOT FIFO, LOT กำหนดเอง, และ FEFO) โดยเชื่อมกับเอกสารใน [[tbl-ic-trans]] และบรรทัดสินค้าใน [[tbl-ic-trans-detail]] รวมถึงตารางเสริม [[tbl-ic-serial-cost-lot]] (`ic_lot_manage`, `ic_lot_expiry_register`)

> [!CAUTION] กับดักสำคัญของ `ic_trans_detail_lot` (ไม่มี `last_status`!)
> ตาราง `ic_trans_detail_lot` **ไม่มีคอลัมน์ `last_status`** และการยกเลิกเอกสารในระบบอาจคงแถวไว้ใน `ic_trans_detail_lot` โดยเปลี่ยนเฉพาะ `ic_trans.last_status = 1` ดังนั้น **ทุก Query ที่นับยอดคงเหลือจาก `ic_trans_detail_lot` ต้องกรองด้วย `NOT EXISTS (SELECT 1 FROM ic_trans h_ WHERE h_.doc_no = l.doc_no AND h_.trans_flag = l.trans_flag AND COALESCE(h_.last_status, 0) = 1)`** (`lotDocLive` ใน `stock_lot.go:315-318`)

## Primary Key / Unique Key และ Indexes

- **ไม่มี SQL `PRIMARY KEY`** ใน `02_data_schema.sql` — ใช้ `roworder SERIAL NOT NULL`
- **Logical Key**: `(doc_no, trans_flag, doc_line_number, line_number)` (1 บรรทัดใน `ic_trans_detail` สามารถแตกได้หลาย Lot)
- **Indexes จาก `02_data_schema.sql:7052-7054`**:
  - `idx_ic_trans_detail_lot_doc_no_trans_flag` ON `ic_trans_detail_lot (doc_no, trans_flag)`
  - `idx_ic_trans_detail_lot_doc_date_trans_flag` ON `ic_trans_detail_lot (doc_date, trans_flag)`
  - `idx_ic_trans_detail_lot_item_code` ON `ic_trans_detail_lot (item_code)`

## คอลัมน์สำคัญ

| คอลัมน์ | ชนิดข้อมูล SQL | ความหมาย |
|---|---|---|
| `doc_no`, `trans_flag` | `varchar(25)`, `smallint` | เลขที่และประเภทเอกสาร (JOIN [[tbl-ic-trans]]) |
| `doc_date`, `doc_time` | `timestamp`, `varchar(5)` | วัน-เวลาเอกสาร *(หมายเหตุ: `doc_date` เป็น `timestamp without time zone` ต่างจาก `ic_trans` ที่เป็น `date` จึงควร cast `::date` เวลาเทียบช่วงวันที่)* |
| `item_code`, `lot_number` | `varchar(25)`, `varchar(50)` | รหัสสินค้าและหมายเลข Lot *(สังเกตชื่อคอลัมน์ต่างจาก `ic_trans_detail.lot_number_1`)* |
| `qty`, `price`, `amount` | `numeric` | จำนวนในระดับ Lot, ราคาต่อหน่วย, และมูลค่า |
| `calc_flag` | `smallint` | `1` = รับ Lot เข้า, `-1` = จ่าย Lot ออก |
| `wh_code`, `shelf_code` | `varchar(25)` | คลังและที่เก็บของ Lot นั้น |
| `doc_line_number`, `line_number` | `smallint` | `doc_line_number` อ้างลำดับบรรทัดแม่ใน `ic_trans_detail`; `line_number` คือลำดับย่อยของ Lot ภายในบรรทัด |
| `mfd_date`, `expire_date`, `date_expire`, `mfn_name` | `date`, `date`, `date`, `varchar(255)` | วันที่ผลิต, วันหมดอายุ (`expire_date` และ `date_expire` ถูกซิงก์คู่กันโดย `db_migrate.go:1015-1019`, `stock_beginning.go:567-571` และ `service.go:2010`), และชื่อผู้ผลิต/แหล่งผลิต |
| `product_year`, `product_week` | `varchar(25)` | ปีและสัปดาห์ที่ผลิต |

## พฤติกรรมการใช้งานจริงใน Go Backend (Dual Storage Note)

1. **การตรวจสอบและเลือก Lot อัตโนมัติตอนบันทึกเอกสาร (`trans_save_rules.go`, `trans_lot_auto.go`)**:
   - สินค้าที่มี `ic_inventory.cost_type = 2` (LOT กำหนดเอง) ในรายการกลุ่ม `lotFlags` ถ้าไม่ส่ง Lot ระบบจะไม่อนุญาตให้บันทึก (เว้นแต่ตั้งค่า `erp_option.find_lot_auto = 1` ในบิลขาย `44` ซึ่ง `autoLots` ใน `trans_lot_auto.go:50-131` จะอ่านยอดคงเหลือจาก **`ic_trans_detail.lot_number_1`** ด้วย `stockBalancePredicate` แล้วแบ่งบรรทัดให้อัตโนมัติ)
2. **การบันทึกยอดยกมา ปรับปรุง Lot และคงเมทาดาต้า Lot ข้ามการ Rebuild (`stock_beginning.go`, `stock_lot.go`, `service.go`)**:
   - หน้าจอยอดยกมาสินค้า (`trans_flag = 54`) และหน้าจอปรับปรุง Lot อัตโนมัติ (`trans_flag = 66` ปรับเพิ่ม IA / `68` ปรับลด IS) บันทึกแถวลงทั้ง `ic_trans_detail` (รวม `lot_number`, `lot_number_1`, `mfd_date`, `date_expire` ใน `sbInsertDetail`) และ `ic_trans_detail_lot` พร้อมกัน และตอนลบเอกสาร `deleteTransTx` (`trans.go:423`) จะลบทั้ง `ic_trans_detail_lot` และ `ic_trans_detail` ด้วย
   - ระหว่างรัน `rebuildStockTxWithOptions` (`service.go:1621-1683, 1855-1869, 1926-2023`) ระบบจะอ่าน `preservedLots` (`lot_number`, `mfd_date`, `COALESCE(date_expire, expire_date)`, `mfn_name`) จาก `ic_trans_detail_lot` มาเติมกลับให้การเคลื่อนไหว และคงแถว Lot ที่คีย์มือในเอกสารยอดยกมา (`trans_flag = 54`) ไว้แม้ตัวคำนวณต้นทุนไม่ได้สร้างแถวใหม่ให้ก็ตาม
   - กระบวนการปรับยอดจากใบตรวจนับ (`76`) ใช้ marker ใน [[tbl-ar-ap-trans-detail]] (`m.trans_flag IN (66, 68) AND m.billing_no = t.doc_no`) เพื่อกันการกดสร้างเอกสารปรับซ้ำ (`stock_lot.go:158-160`)

## ตัวอย่าง SQL จริงจากระบบ

### 1. หา Lot ที่จำนวนเป็น 0 แต่มูลค่าค้าง (`lotResidualSQL`, `stock_lot.go:321-331`)

```sql
WITH g AS (
    SELECT l.item_code,
           COALESCE(l.wh_code, '') AS wh,
           COALESCE(l.shelf_code, '') AS sh,
           COALESCE(l.lot_number, '') AS lot,
           SUM(l.calc_flag * l.qty) AS bq,
           SUM(l.calc_flag * l.amount) AS ba
    FROM ic_trans_detail_lot l
    WHERE l.doc_date::date <= $1::date
      AND ($2 = '' OR l.item_code >= $2)
      AND ($3 = '' OR l.item_code <= $3)
      AND NOT EXISTS (
          SELECT 1 FROM ic_trans h_
          WHERE h_.doc_no = l.doc_no
            AND h_.trans_flag = l.trans_flag
            AND COALESCE(h_.last_status, 0) = 1
      )
    GROUP BY 1, 2, 3, 4
    HAVING SUM(l.calc_flag * l.qty) = 0
       AND ROUND(SUM(l.calc_flag * l.amount), 2) <> 0
)
SELECT g.item_code, COALESCE(i.name_1, ''), COALESCE(i.unit_cost, ''),
       g.wh, g.sh, g.lot, g.bq::text, ROUND(g.ba, 2)::text
FROM g
LEFT JOIN ic_inventory i ON i.code = g.item_code
ORDER BY g.item_code, g.wh, g.sh, g.lot
LIMIT $4;
```

### 2. อ่านยอดคงเหลือตาม Lot และวันหมดอายุเพื่อ Auto-Pick (`trans_lot_auto.go:106-111`)

```sql
SELECT d.item_code,
       COALESCE(d.wh_code, '') AS wh_code,
       COALESCE(d.shelf_code, '') AS shelf_code,
       d.lot_number_1,
       SUM(d.qty * d.calc_flag * (COALESCE(NULLIF(d.stand_value, 0), 1) / COALESCE(NULLIF(d.divide_value, 0), 1))) AS balance_qty,
       COALESCE((array_agg(to_char(d.date_expire, 'YYYY-MM-DD') ORDER BY d.doc_date, d.doc_time)
                 FILTER (WHERE d.calc_flag = 1 AND d.date_expire IS NOT NULL))[1], '') AS expire_date
FROM ic_trans_detail d
WHERE d.item_code = ANY($1)
  AND COALESCE(d.lot_number_1, '') <> ''
  AND d.last_status = 0
  AND COALESCE(d.is_doc_copy, 0) = 0
GROUP BY 1, 2, 3, 4
ORDER BY 1, 4;
```
