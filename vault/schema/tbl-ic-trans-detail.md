---
title: "ic_trans_detail — บรรทัดสินค้ารายตัวของทุกเอกสาร + สูตรคำนวณสต็อกและต้นทุน"
tags: [schema, inventory, transaction, detail, costing, bcaiaccount]
aliases: [ic_trans_detail, รายการสินค้าในเอกสาร, บรรทัดสต็อก]
sources:
  - scripts/sql/02_data_schema.sql:6812-6944
  - scripts/sql/03_audit_r1_migrations.sql:122-152
  - backend/internal/platform/db/pool.go:32-35
  - backend/internal/application/process/db_migrate.go:1018-1023
  - backend/internal/application/process/service.go:941-970
  - backend/internal/application/process/service.go:1132-1167
  - backend/internal/application/process/service.go:1390-1750
  - backend/internal/application/process/stock_rebuild.go:15-65
  - backend/internal/application/process/trans.go:693-724
  - backend/internal/application/process/trans_save_rules.go:241-271
  - backend/internal/application/process/trans_set_item.go:22-70
  - backend/internal/application/process/doc_approve_item.go:150-160
---

# `ic_trans_detail` — บรรทัดสินค้ารายตัวของทุกเอกสาร + สูตรคำนวณสต็อกและต้นทุน

`ic_trans_detail` เก็บรายการสินค้ารายบรรทัดของเอกสารทุกประเภทที่บันทึกใน [[tbl-ic-trans]] ตั้งแต่ใบขอ/สั่งซื้อ-ขาย, ซื้อ-ขาย-รับคืน-ส่งคืน, โอนคลัง `72`/`70`, ยอดยกมา `54`, เบิก-รับคืน-ประกอบ `56`/`58`/`60`, ไปจนถึงปรับปรุง `66`/`68` และยังเป็นแหล่งคำนวณหลักของ **ยอดคงเหลือสินค้า (`balance_qty`)** และ **การคำนวณต้นทุนเฉลี่ยเคลื่อนที่ (Moving Average Cost)**

> [!IMPORTANT] กฎการคำนวณหน่วยนับและป้องกันหารด้วยศูนย์
> ปริมาณฐาน (Base Unit Quantity) คำนวณจาก:
> `qty * COALESCE(NULLIF(stand_value, 0), 1) / COALESCE(NULLIF(divide_value, 0), 1)`
> และต้องใช้ `NUMERIC` เท่านั้น (ห้าม `float`) โดย `03_audit_r1_migrations.sql:136-152` กำหนด `DEFAULT 1` ให้ `stand_value` และ `divide_value` แล้ว

## Primary Key / Unique Key และ Indexes

- **ไม่มี SQL `PRIMARY KEY`** ใน `02_data_schema.sql` — ใช้ `roworder SERIAL NOT NULL` แทนตัวระบุแถว
- **Logical Key ระดับบรรทัด**: `(doc_no, trans_flag, line_number)` (หมายเหตุ: กรณีโอนคลัง `72` แถวฝั่ง `72` และ `70` ใช้ `doc_no` เดียวกันโดยฝั่ง `72` อยู่ `line_number = n` และฝั่ง `70` อยู่ `line_number = n + 1` ตาม `stock_rebuild.go:57-64`)
- **Indexes จาก `02_data_schema.sql:6940-6944`**:
  - `idx_ic_trans_detail_doc_no_trans_flag` ON `ic_trans_detail (doc_no, trans_flag)`
  - `idx_ic_trans_detail_doc_date_trans_flag` ON `ic_trans_detail (doc_date, trans_flag)`
  - `idx_ic_trans_detail_item_code` ON `ic_trans_detail (item_code)`
  - `idx_ic_trans_detail_barcode` ON `ic_trans_detail (barcode)`
  - `idx_ic_trans_detail_cust_code` ON `ic_trans_detail (cust_code)`
- **Performance Partial Indexes ที่ Go Backend สร้างอัตโนมัติ (`service.go:961-969`)**:
  - `idx_ic_trans_detail_stock_replay` ON `ic_trans_detail (item_code, COALESCE(doc_date_calc, doc_date), COALESCE(NULLIF(doc_time_calc, ''), doc_time), roworder) WHERE last_status = 0 AND COALESCE(is_doc_copy, 0) = 0`
  - `idx_ic_trans_detail_lot_balance` ON `ic_trans_detail (item_code, wh_code, shelf_code, lot_number_1) WHERE last_status = 0 AND COALESCE(is_doc_copy, 0) = 0`
  - `idx_ic_trans_detail_ref_doc` ON `ic_trans_detail (ref_doc_no, trans_flag) WHERE last_status = 0 AND ref_doc_no <> ''`

## คอลัมน์สำคัญและการใช้งาน

| คอลัมน์ | ชนิดข้อมูล SQL | ความหมาย / ค่า Flag ที่สำคัญ |
|---|---|---|
| `doc_no`, `trans_flag`, `line_number` | `varchar(25)`, `smallint`, `integer` | อ้างอิงหัวเอกสารใน `ic_trans` และลำดับบรรทัด |
| `doc_date`, `doc_time`, `doc_date_calc`, `doc_time_calc` | `date`, `varchar(5)` | วันที่/เวลาเอกสาร และวันที่/เวลาที่ใช้เรียง Replay ต้นทุน (สำหรับ `70` โอนเข้า `doc_time_calc` จะ `+1 นาที` เพื่อคำนวณหลัง `72`) |
| `item_code`, `item_name`, `barcode` | `varchar(25)`, `varchar(255)` | รหัสสินค้า (JOIN [[tbl-ic-inventory]]), ชื่อสินค้า, และบาร์โค้ดที่สแกน |
| `item_name_2`, `approve_status`, `approve_qty`, `wht_amount` | `text`, `integer`, `numeric(18,4)` | คอลัมน์เสริมที่ Go Runtime `ALTER TABLE` เพิ่ม (`pool.go:32-35`, `service.go:839-842`) รองรับชื่อภาษาที่ 2, สถานะ/จำนวนอนุมัติ, และหัก ณ ที่จ่ายรายบรรทัด |
| `unit_code`, `qty`, `stand_value`, `divide_value`, `ratio`, `total_qty` | `varchar(25)`, `numeric` | หน่วยนับเอกสาร, จำนวนที่กรอก, อัตราส่วนแปลงเป็นหน่วยฐาน (Unit Base) |
| `unit_code_2`, `qty_2`, `unit_size`, `total_size` | `varchar(25)`, `numeric` | หน่วยนับขนาน (`unit_type IN (2, 3)`) / หน่วยเทียบขนาด |
| `wh_code`, `shelf_code`, `wh_code_2`, `shelf_code_2` | `varchar(25)` | คลัง/ที่เก็บหลักของรายการ และคลัง/ที่เก็บคู่โอน (`transferDetailPairSQL` อัปเดตจากแถว `72`<->`70`) |
| `calc_flag` | `integer` | ทิศทางเคลื่อนไหวสต็อก: `1` = รับเข้า, `-1` = จ่ายออก, `0` = ไม่กระทบสต็อก |
| `last_status`, `is_doc_copy` | `integer`, `smallint` | `last_status = 0` และ `is_doc_copy = 0` เท่านั้นที่มีผลต่อยอดคงเหลือและต้นทุน |
| `item_type` | `integer` | ประเภทสินค้าที่ถูก sync จาก `ic_inventory` ระหว่าง Rebuild: `0` ทั่วไป, `1` บริการ, `2` ให้เช่า, `3` สินค้าชุด (แตกบรรทัดลูก), `4` ฝากขาย, `5` สูตรผลิต, `6` สีผสม (ดูเงื่อนไขคัดแยกด้านล่าง) |
| `price`, `price_exclude_vat`, `discount`, `discount_amount`, `sum_amount`, `sum_amount_exclude_vat`, `total_vat_value` | `numeric`, `varchar(25)` | ราคาต่อหน่วย, ส่วนลด, มูลค่ารวมบรรทัด (ก่อน/รวม VAT) |
| `average_cost`, `sum_of_cost`, `is_lock_cost`, `sum_of_cost_fix` | `numeric`, `smallint` | ต้นทุนเฉลี่ยต่อหน่วยฐานและต้นทุนรวมของบรรทัด (คำนวณโดย `rebuildStockTx`; ถ้า `is_lock_cost = 1` จะยึด `sum_of_cost_fix` เช่นเอกสารปรับปรุงจากต้นทุนแฝง `hidden_cost.go`) |
| `hidden_cost_1`, `hidden_cost_1_exclude_vat`, `hidden_cost_2`, `hidden_cost_2_exclude_vat`, `sum_of_cost_1`, `average_cost_1` | `numeric` | ต้นทุนแฝง / ต้นทุนรวมค่าใช้จ่ายนำเข้า (`service.go:654` ป้องกัน `average_cost_1 IS NULL`) |
| `lot_number`, `lot_number_1`, `date_expire`, `mfd_date`, `mfn_name`, `bat_number`, `bat_date`, `product_year`, `product_week` | `varchar`, `date` | ข้อมูล Lot (`db_migrate.go:1020-1022` และ `service.go:1137,1164-1166` รองรับทั้ง `lot_number` และ `lot_number_1`) / วันหมดอายุ / วันผลิต บนบรรทัด (คู่กับตาราง [[tbl-ic-trans-detail-lot]]) |
| `is_serial_number` | `smallint` | `1` = สินค้าคุม Serial Number (รายละเอียด SN อยู่ที่ [[tbl-ic-trans-serial-number]]) |
| `ref_doc_no`, `ref_doc_date`, `ref_line_number`, `doc_ref_type`, `ref_row`, `ref_guid`, `set_ref_line`, `item_code_main`, `is_permium` | `varchar`, `integer`, `smallint` | การอ้างอิงบรรทัดข้ามเอกสาร (PO -> ซื้อ, SO -> ขาย) และสายสัมพันธ์แม่-ลูกของสินค้าชุด (`ref_guid` / `set_ref_line`) กับของแถม (`is_permium`) |
| `temp_float_1`, `temp_float_2`, `temp_string_1` | `numeric`, `varchar(25)` | ช่องเก็บค่าอนุมัติชั่วคราวของใบอนุมัติซื้อ `trans_flag = 4` (`doc_approve_item.go`) |

## Predicate หลักในการคัดกรองสต็อกและ Moving Average (`stock_rebuild.go`)

ระบบแบ่งเงื่อนไขใน `stock_rebuild.go:15-42` ออกเป็น 3 ระดับชัดเจน (ห้ามละเว้นเงื่อนไขใด):

1. **`stockRowsSQL`** (บรรทัดที่มีผลต่อ **จำนวนหรือมูลค่า** ใน Replay ต้นทุน):
   - `last_status = 0 AND COALESCE(is_doc_copy, 0) = 0 AND COALESCE(item_type, 0) IN (0, 4, 6)`
   - `trans_flag IN (12,310, 14,311, 16, 44,46,48, 54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73, 521,522,523)`
   - ยกเว้น:
     - `NOT (trans_flag = 46 AND COALESCE(inquiry_type, 0) <> 0)`
     - `NOT (trans_flag = 48 AND COALESCE(inquiry_type, 0) > 1)`
     - `NOT (trans_flag = 44 AND COALESCE(doc_ref, '') <> '' AND COALESCE(is_pos, 0) = 1)` (กันบิล POS ที่ถูกสรุปปิดยอดแล้วนับซ้ำ)
2. **`stockValueOnlySQL`** (เพิ่มหนี้/ลดหนี้เฉพาะมูลค่า ไม่เปลี่ยนจำนวน):
   - `(trans_flag IN (14, 16, 311) AND COALESCE(inquiry_type, 0) IN (1, 3))` -> ใน Replay จะส่งจำนวนเป็น `0`
3. **`stockBalancePredicate`** (นับ **ยอดคงเหลือ `balance_qty`**):
   - `stockRowsSQL AND NOT stockValueOnlySQL`

> [!NOTE] ข้อแตกต่างของ `item_type` ระหว่าง `stock_rebuild.go` กับ `trans_save_rules.go`
> - ตอนคำนวณยอดคงเหลือและ Moving Average (`stock_rebuild.go:18` และ `service.go:1171`): ใช้ `COALESCE(item_type, 0) IN (0, 4, 6)` และซิงก์ `item_type` จาก `ic_inventory` พร้อมละเว้น `item_type = 5`
> - ตอนตรวจสอบสต็อกติดลบก่อนบันทึกเอกสาร (`trans_save_rules.go:247`): ตรวจกลุ่ม `item_type IN (0, 2, 4)`
> - ส่วนสินค้าชุด (`item_type = 3` หรือสูตรสี `item_type = 5`) ในการคำนวณยอดรวมหัวบิล (`transcalc.go:108`) จะข้ามแถวแม่แล้วรวมจากบรรทัดลูกที่มี `ref_guid` / `set_ref_line` แทน

## ตัวอย่าง SQL จริงจากระบบ

### 1. คำนวณยอดคงเหลือสินค้าแยกคลัง/ที่เก็บ (ตาม `stockBalancePredicate`)

```sql
SELECT d.item_code,
       COALESCE(d.wh_code, '') AS wh_code,
       COALESCE(d.shelf_code, '') AS shelf_code,
       SUM(
           COALESCE(d.qty, 0) * COALESCE(d.calc_flag, 0)
           * (COALESCE(NULLIF(d.stand_value, 0), 1) / COALESCE(NULLIF(d.divide_value, 0), 1))
       ) AS balance_qty
FROM ic_trans_detail d
WHERE d.last_status = 0
  AND COALESCE(d.is_doc_copy, 0) = 0
  AND COALESCE(d.item_type, 0) IN (0, 4, 6)
  AND d.trans_flag IN (12,310, 14,311, 16, 44,46,48, 54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73, 521,522,523)
  AND NOT (d.trans_flag = 46 AND COALESCE(d.inquiry_type, 0) <> 0)
  AND NOT (d.trans_flag = 48 AND COALESCE(d.inquiry_type, 0) > 1)
  AND NOT (d.trans_flag = 44 AND COALESCE(d.doc_ref, '') <> '' AND COALESCE(d.is_pos, 0) = 1)
  AND NOT (d.trans_flag IN (14, 16, 311) AND COALESCE(d.inquiry_type, 0) IN (1, 3))
  AND d.item_code = $1
GROUP BY d.item_code, COALESCE(d.wh_code, ''), COALESCE(d.shelf_code, '');
```

### 2. Query ลำดับ Movement สำหรับ Replay ต้นทุน (`service.go:1190-1216`)

```sql
SELECT item_code, roworder, COALESCE(doc_no, ''), COALESCE(trans_flag, 0), COALESCE(calc_flag, 0),
       CASE WHEN (trans_flag IN (14,16,311) AND COALESCE(inquiry_type, 0) IN (1,3)) THEN 0 ELSE COALESCE(qty, 0) END,
       COALESCE(NULLIF(stand_value, 0), 1),
       COALESCE(NULLIF(divide_value, 0), 1),
       COALESCE(price, 0),
       COALESCE(NULLIF(sum_amount_exclude_vat, 0), sum_amount, 0),
       COALESCE(sum_of_cost, 0), COALESCE(average_cost, 0),
       COALESCE(is_lock_cost, 0) = 1, COALESCE(sum_of_cost_fix, 0), COALESCE(inquiry_type, 0)
FROM ic_trans_detail
WHERE item_code = ANY($1)
  AND last_status = 0 AND COALESCE(is_doc_copy, 0) = 0 AND COALESCE(item_type, 0) IN (0, 4, 6)
ORDER BY item_code ASC,
         COALESCE(doc_date_calc, doc_date) ASC,
         COALESCE(NULLIF(doc_time_calc, ''), doc_time) ASC,
         CASE WHEN trans_flag = 70 THEN -2 ELSE calc_flag END DESC,
         trans_flag ASC, doc_no ASC, line_number ASC, roworder ASC;
```
