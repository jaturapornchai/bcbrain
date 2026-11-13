---
title: "ic_trans — หัวเอกสารธุรกรรมซื้อ ขาย คลัง และจุด POS"
tags: [schema, inventory, transaction, header, bcaiaccount]
aliases: [ic_trans, หัวเอกสารสินค้า, หัวบิลซื้อขาย]
sources:
  - scripts/sql/02_data_schema.sql:6571-6720
  - scripts/sql/03_audit_r1_migrations.sql:90-120
  - scripts/sql/04_seed_data.sql:459-520
  - backend/internal/application/process/trans.go:218-246
  - backend/internal/application/process/trans.go:395-430
  - backend/internal/application/process/trans.go:658-691
  - backend/internal/application/process/transcalc.go:14-100
  - backend/internal/application/process/stock_rebuild.go:44-95
  - backend/internal/application/process/point_doc.go:14-54
---

# `ic_trans` — หัวเอกสารธุรกรรมซื้อ ขาย คลัง และจุด POS

`ic_trans` เป็นตารางหัวเอกสารหลักของระบบจัดซื้อ (Purchase), ระบบขาย/POS (Sales & POS), ระบบควบคุมสินค้าคงคลัง (Inventory Control), ใบขออนุมัติ/สั่งซื้อ/สั่งขาย, รวมถึงเอกสารตั้งยอด/ตัดแต้มสมาชิก (`trans_flag` `801`, `802`) และบางธุรกรรมรับ-จ่ายที่มีเอกสารแม่ใน `ic_trans`

> [!WARNING] ข้อควรระวังสำคัญด้านโครงสร้าง DB
> ใน `scripts/sql/02_data_schema.sql` ไม่มี SQL `PRIMARY KEY` constraint บน `ic_trans` เลย — เอกลักษณ์ของเอกสารใช้ `(doc_no, trans_flag)` ผ่าน Index ไม่ซ้ำทางกายภาพที่ชื่อ `idx_ic_trans_doc_no_trans_flag` (non-unique `CREATE INDEX`) ร่วมกับการควบคุมระดับแอปพลิเคชัน Go (ตรวจสอบ `isNew` / replace ภายใน transaction + advisory lock) และมี `roworder SERIAL NOT NULL` เป็นลำดับแถวภายใน

## Primary Key / Unique Key และ Indexes

- **Logical Key ระดับเอกสาร**: `(doc_no, trans_flag)` (หมายเหตุ: เอกสารโอนคลัง `72` โอนออก จะสร้างหัวเอกสารคู่ `70` โอนเข้า ด้วย `doc_no` เดียวกันแต่คนละ `trans_flag`)
- **Surrogate Sequence**: `roworder SERIAL NOT NULL` (ไม่มี `PRIMARY KEY` บน DDL)
- **Indexes ที่มีจริงในฐานข้อมูล**:
  - `idx_ic_trans_doc_no_trans_flag` ON `ic_trans (doc_no, trans_flag)`
  - `idx_ic_trans_doc_date_trans_flag` ON `ic_trans (doc_date, trans_flag)`
  - `idx_ic_trans_cust_code` ON `ic_trans (cust_code)`

## คอลัมน์สำคัญและการใช้งาน

| คอลัมน์ | ชนิดข้อมูล SQL | ความหมาย / ค่า Flag ที่สำคัญ |
|---|---|---|
| `doc_no`, `doc_date`, `doc_time` | `varchar(25)`, `date`, `varchar(5)` | เลขที่เอกสาร, วันที่เอกสาร, เวลา (`HH:MM`) — `doc_time` ใช้จัดลำดับก่อนหลังตอนคำนวณ Moving Average |
| `trans_type` | `smallint` | หมวดใหญ่ของธุรกรรม (เช่น `1` ซื้อ, `2` ขาย, `3` คลัง/โอน/นับ/ปรับ) |
| `trans_flag` | `smallint` | รหัสชนิดเอกสารย่อย ควบคุมทิศทางสต็อก (`calc_flag`), ภาษี, และการลงบัญชี (ดูตารางด้านล่าง) |
| `cust_code` | `varchar(25)` | รหัสคู่ค้า — JOIN [[tbl-ap-supplier]] เมื่อเป็นฝั่งซื้อ และ [[tbl-ar-customer]] เมื่อเป็นฝั่งขาย |
| `inquiry_type` | `smallint` | รูปแบบการชำระเงิน/ผลต่อยอด (เช่น `0` เงินเชื่อ/ตัดสต็อกปกติ, `1` เงินสด หรือกรณี CN/DN คิดเฉพาะมูลค่าไม่คิดจำนวนสต็อก) |
| `vat_type`, `vat_rate` | `smallint`, `numeric` | `vat_type`: `0` = ภาษีแยกนอก (Exclude VAT), `1` = ภาษีรวมใน (Include VAT), `2` = ยกเว้น/ไม่คิดภาษี (ห้ามใช้ `3`; ดู `03_audit_r1_migrations.sql:108-120`) |
| `tax_doc_no`, `tax_doc_date` | `varchar(25)`, `date` | เลขที่และวันที่ใบกำกับภาษี (ซื้อ/ขาย) |
| `doc_ref`, `doc_ref_date`, `ref_doc_type` | `varchar(255)`, `date`, `varchar(50)` | เอกสารอ้างอิงที่ดึงมา (เช่น PO -> ซื้อ, SO/SR -> ขาย, ใบมัดจำ -> บิล) |
| `last_status` | `smallint` | สถานะยกเลิกเอกสาร: `0` = เอกสารใช้งานปกติ (Live), `1` = ยกเลิกแล้ว (**ทุก Query รายงาน/ยอดคงเหลือต้องกรอง `COALESCE(last_status, 0) = 0` เสมอ**) |
| `is_doc_copy` | `smallint` | `1` = เอกสารสำเนา (`saveACopy`) — **ห้ามนำมานับสต็อกหรือคำนวณยอด** (`COALESCE(is_doc_copy, 0) = 0`) |
| `is_pos`, `pos_id`, `sale_shift_id` | `smallint`, `varchar(25)`, `varchar(50)` | ระบุเอกสารจากหน้าขาย POS / รหัสเครื่อง / กะขาย (`pos_bill_type`, `pos_bill_change`, `cashier_code`, `member_code`) |
| `total_value`, `total_except_vat`, `discount_word`, `total_discount`, `advance_amount`, `total_before_vat`, `total_vat_value`, `total_after_vat`, `total_amount` | `numeric`, `varchar(25)` | สรุปยอดเงินหัวบิล (Go `transcalc.go` คำนวณใหม่ด้วย `big.Rat` เสมอ ไม่เชื่อค่าจาก Client) |
| `currency_code`, `exchange_rate`, `total_amount_2`, `lost_profit_exchange_amount` | `varchar(25)`, `numeric` | สกุลเงินต่างประเทศ (JOIN [[tbl-erp-currency-fx]]) และมูลค่า/ผลต่างอัตราแลกเปลี่ยน |
| `wh_from`, `location_from`, `wh_to`, `location_to` | `varchar(25)` | คลัง/ที่เก็บต้นทาง-ปลายทาง (JOIN [[tbl-ic-warehouse-shelf]]) ใช้มากในเอกสารโอน `72`/`70` และตั้งต้นสต็อก `54` |
| `branch_code`, `department_code`, `project_code`, `allocate_code`, `side_code`, `job_code` | `varchar(25)` | มิติองค์กรต้นทาง และมีคอลัมน์ `*_to` (`branch_code_to`, `department_code_to`, ฯลฯ) สำหรับฝั่งรับโอน |
| `sum_point`, `sum_point_2`, `point_telephone` | `numeric`, `varchar(25)` | คะแนนสะสม/แต้มยกมา (`trans_flag = 801`) และตัดแต้ม (`trans_flag = 802`) |
| `approve_status`, `approve_code`, `user_approve`, `on_hold`, `is_cancel`, `doc_close`, `used_status` | `smallint`, `varchar(25)` | สถานะอนุมัติ, พักบิล, ปิดเอกสาร, และสถานะถูกดึงอ้างอิงต่อแล้ว |

## ค่า `trans_flag` ที่สำคัญและผลต่อสต็อก (`calc_flag`)

อ้างอิงจาก `calcFlagByTransFlag` (`transcalc.go:14-27`), `showsVatType` (`32-42`), `depositFlags`/`depositVatFlags` (`trans.go:218-225`), `transMenuMap.ts` และ `point_doc.go`:

- **ฝั่งซื้อและจ่าย (`trans_type = 1`)**:
  - `2` = ใบเสนอซื้อ (PR), `4` = อนุมัติ PR, `6` = ใบสั่งซื้อ (PO), `8` = อนุมัติ PO *(กลุ่มขอ/สั่งยังไม่เดินสต็อกจริง)*
  - `12` = ซื้อสินค้า/ตั้งหนี้ซื้อ (`calc_flag = 1`), `310` = รับสินค้าตามใบสั่งซื้อ (ทยอยรับ) (`calc_flag = 1`), `315` = ตั้งหนี้ซื้อจากการรับสินค้า
  - `14` = เพิ่มหนี้ซื้อ/ราคาผิด (`calc_flag = 1` ใน `calcFlagByTransFlag`, เพิ่มยอดเทียบเอกสารเดิมผ่าน `refAmountFlags`), `316` = เพิ่มหนี้ซื้อจากใบตั้งหนี้ (`calc_flag = 1` ใน `calcFlagByTransFlag`)
  - `16` = ส่งคืนสินค้า/ลดหนี้ซื้อ (`calc_flag = -1`), `311` = ส่งคืนสินค้าจากการรับ (`calc_flag = -1`), `317` = ลดหนี้ซื้อจากใบตั้งหนี้ (`calc_flag = -1`)
  - กลุ่มเงินล่วงหน้า/มัดจำจ่าย (`depositFlags` ใน `trans.go:220-225`, ไม่เดินสต็อก — รายการเก็บใน [[tbl-ar-ap-trans-detail]]): `9010` = จ่ายเงินล่วงหน้ายกมา, `10` = จ่ายเงินล่วงหน้า, `20` = รับคืนจ่ายล่วงหน้า *(ไม่มีช่อง VAT / `vat_rate`)*; `9011` = จ่ายเงินมัดจำยกมา, `11` = จ่ายเงินมัดจำ, `25` = รับคืนจ่ายมัดจำ *(`depositVatFlags` มี VAT)*
- **ฝั่งขายและรับ (`trans_type = 2`)**:
  - `30` = ใบเสนอราคาขาย, `32` = อนุมัติใบเสนอราคาขาย, `34` = ใบสั่งจองสินค้า, `36` = ใบสั่งขายสินค้า (SO), `52` = อนุมัติใบสั่งขาย *(หมายเหตุ: `calcFlagByTransFlag` มี `32, 34, 36 = 1` ตามแมปดั้งเดิม แต่ `stockRowsSQL` ใน `stock_rebuild.go:18-22` นับสต็อกจริงเฉพาะ `44`, `46`, `48` — โปรดดูรายละเอียดใน [[tbl-ic-trans-detail]])*
  - `44` = ขายสินค้า/บริการ (`calc_flag = -1`), `46` = เพิ่มหนี้ขาย (`calc_flag = -1`), `48` = รับคืน/ลดหนี้ขาย (`calc_flag = 1`)
  - กลุ่มเงินล่วงหน้า/มัดจำรับ (`depositFlags` ใน `trans.go:220-225`, ไม่เดินสต็อก — รายการเก็บใน [[tbl-ar-ap-trans-detail]]): `9040` = รับเงินล่วงหน้ายกมา, `40` = รับเงินล่วงหน้า, `42` = คืนเงินรับล่วงหน้า *(ไม่มีช่อง VAT)*; `9110` = รับเงินมัดจำยกมา, `110` = รับเงินมัดจำ, `112` = คืนเงินมัดจำ *(`depositVatFlags` มี VAT)*
- **ฝั่งคลังสินค้า (`trans_type = 3`, ไม่มีหน้าจอ VAT — `showsVatType = false`)**:
  - `54` = สินค้า/วัตถุดิบ คงเหลือยกมา / รับเข้าจากประกอบสินค้า (`calc_flag = 1`)
  - `56` = เบิกสินค้า/เบิกวัตถุดิบ (`calc_flag = -1`), `58` = รับคืนจากการเบิก (`calc_flag = 1`)
  - `60` = รับสินค้าสำเร็จรูป/รับเข้าอื่น (`calc_flag = 1`)
  - `66` = ปรับปรุงสต็อก (เพิ่ม) / เอกสารปรับต้นทุนแฝง (`calc_flag = 1`), `68` = ปรับปรุงสต็อก (ลด) (`calc_flag = -1`)
  - `72` = โอนคลังออก (`calc_flag = -1`) -> ระบบ `syncStockTransferIn` (`stock_rebuild.go:69-81`) สร้างหัวเอกสารคู่ **`70` = โอนคลังเข้า (`calc_flag = 1`)** โดยอัตโนมัติ พร้อมสลับ `branch_code` / `*_to` ไปฝั่งรับ
  - `76` = ตรวจนับสินค้า (`calc_flag = 1` ใน `calcFlagByTransFlag` / `0` ใน UI `transMenuMap.ts`), `122` = ขอเบิก, `124` = ขอโอน, `276` = ขอตรวจนับ
- **ระบบแต้มสมาชิก (Header-Only, ไม่สร้าง `ic_trans_detail` / สต็อก / GL)**:
  - `801` = แต้มคงเหลือยกมา, `802` = บันทึกตัดแต้ม (`point_doc.go:18-21`)

## การเชื่อมโยง (JOIN Patterns)

- **รายการสินค้าในเอกสาร**: `LEFT JOIN ic_trans_detail d ON d.doc_no = t.doc_no AND d.trans_flag = t.trans_flag` ([[tbl-ic-trans-detail]])
- **ข้อมูลคู่ค้า**:
  - เอกสารซื้อ (`trans_type = 1` / ซื้อ-จ่าย): `LEFT JOIN ap_supplier s ON s.code = t.cust_code` ([[tbl-ap-supplier]])
  - เอกสารขาย (`trans_type = 2` / ขาย-รับ): `LEFT JOIN ar_customer c ON c.code = t.cust_code` ([[tbl-ar-customer]])
- **ที่อยู่จัดส่ง / ข้อมูลเพิ่มเติม / WMS**:
  - `LEFT JOIN ic_trans_shipment sh ON sh.doc_no = t.doc_no AND sh.trans_flag = t.trans_flag` ([[tbl-ic-trans-extensions]])
  - `LEFT JOIN ic_trans_additional ad ON ad.doc_no = t.doc_no AND ad.trans_flag = t.trans_flag`
- **สาขาและรูปแบบเอกสาร**:
  - `LEFT JOIN erp_branch_list b ON b.code = t.branch_code` ([[tbl-erp-branch-department]])
  - `LEFT JOIN erp_doc_format df ON df.code = t.doc_format_code` ([[tbl-erp-doc-format]])

## ตัวอย่าง SQL จริงจากระบบ

### 1. ตรวจสอบบิลขาย/ซื้อที่ยังมีผล (กรอง `last_status` และ `is_doc_copy` ถูกต้อง)

```sql
SELECT t.doc_no, t.doc_date, t.trans_flag, t.cust_code,
       t.vat_type, t.vat_rate,
       t.total_before_vat, t.total_vat_value, t.total_amount
FROM ic_trans t
WHERE t.trans_flag = 44
  AND COALESCE(t.last_status, 0) = 0
  AND COALESCE(t.is_doc_copy, 0) = 0
  AND t.doc_date BETWEEN $1::date AND $2::date
ORDER BY t.doc_date DESC, t.doc_no DESC;
```

### 2. คำนวณมูลค่าเอกสารเดิมและยอดสุทธิหลังเพิ่ม/ลดหนี้เทียบ `doc_ref` (`trans.go:227-246`)

สำหรับเอกสารเพิ่ม/ลดหนี้และส่งคืนกลุ่ม `refAmountFlags` (`14, 316` เพิ่มยอด; `16, 311, 317` ลดยอด) ระบบอ้างอิงบิลเดิมผ่าน `t.doc_ref` เพื่อคำนวณ `ref_amount` (มูลค่าเอกสารเดิม), `ref_diff` (ผลต่าง) และ `ref_new_amount` (มูลค่าที่ถูกต้อง):

```sql
WITH c AS (
    SELECT t.doc_no, t.trans_flag, t.doc_ref,
           CASE WHEN t.vat_type = 0
                THEN COALESCE(t.total_before_vat, 0) + COALESCE(t.total_except_vat, 0)
                ELSE COALESCE(t.total_amount, 0) END AS cur_amount,
           COALESCE((
               SELECT CASE WHEN t.vat_type = 0
                           THEN COALESCE(o.total_before_vat, 0) + COALESCE(o.total_except_vat, 0)
                           ELSE COALESCE(o.total_amount, 0) END
               FROM ic_trans o
               WHERE o.doc_no = t.doc_ref
                 AND o.trans_type = t.trans_type
                 AND o.trans_flag <> t.trans_flag
                 AND COALESCE(o.last_status, 0) = 0
               ORDER BY o.roworder DESC LIMIT 1
           ), 0) AS ref_amount
    FROM ic_trans t
    WHERE t.doc_no = $1 AND t.trans_flag = $2
)
SELECT doc_no, trans_flag, doc_ref,
       ref_amount,
       cur_amount AS ref_diff,
       ref_amount + CASE WHEN trans_flag IN (16, 311, 317) THEN -1 ELSE 1 END * cur_amount AS ref_new_amount
FROM c;
```
