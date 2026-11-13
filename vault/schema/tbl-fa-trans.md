---
title: ตารางโอนค่าเสื่อมราคาและขายสินทรัพย์ (as_trans, as_trans_detail, as_asset_sale, as_asset_sale_detail)
tags:
  - schema
  - fa
  - depreciation
  - asset-sale
aliases:
  - as_trans
  - as_trans_detail
  - as_asset_sale
  - as_asset_sale_detail
sources:
  - scripts/sql/02_data_schema.sql:1875
  - scripts/sql/02_data_schema.sql:1903
  - scripts/sql/02_data_schema.sql:1944
  - scripts/sql/02_data_schema.sql:1976
  - backend/internal/application/process/fa_depreciation.go:28
  - backend/internal/application/process/fa_depreciation.go:991
  - backend/internal/application/process/fa_sale.go:15
  - backend/internal/application/process/fa_sale.go:533
---

# ตารางโอนค่าเสื่อมราคาและขายสินทรัพย์ (`as_trans`, `as_asset_sale`)

กลุ่มตารางบันทึกรายการเคลื่อนไหวทางบัญชีของสินทรัพย์ถาวร ได้แก่ **เอกสารโอนค่าเสื่อมราคาประจำงวด (`trans_flag = 1801`)** และ **เอกสารขายสินทรัพย์ (`trans_flag = 1802`)** รวมถึงตารางขายสินทรัพย์ดั้งเดิม (`as_asset_sale` / `as_asset_sale_detail`)

> [!IMPORTANT] ข้อสังเกตสำคัญของ `as_trans` ระหว่าง Schema กลางกับโค้ดขายสินทรัพย์
> ใน `scripts/sql/02_data_schema.sql:1944-1991` โครงสร้าง `as_trans` และ `as_trans_detail` มีเฉพาะคอลัมน์หลักสำหรับการโอนค่าเสื่อมราคา (`1801`) แต่ใน `backend/internal/application/process/fa_sale.go:535-570` (`trans_flag = 1802` ซึ่งพอร์ตจาก C# `_saleAssets`) มีการเขียนคอลัมน์รูปแบบเดียวกับ `ic_trans` / `ic_trans_detail` เพิ่มเติม (เช่น `last_status`, `cust_code`, `tax_doc_no`, `inquiry_type`, `vat_type`, `vat_rate`, `total_value`, `total_before_vat`, `total_vat_value`, `total_after_vat`, `total_except_vat`, `profit_lost_cost_amount`) ซึ่งมีอยู่เฉพาะในฐานข้อมูลเก่าที่ Migrate มาจากระบบเดิม ดังนั้นหาก Query `as_trans` จาก Schema ฐานข้อมูลใหม่ตรงๆ ต้องตรวจสอบว่ามีคอลัมน์ `last_status` อยู่หรือไม่

---

## 1. `as_trans` — หัวเอกสารโอนค่าเสื่อมราคาและธุรกรรมสินทรัพย์

- **วัตถุประสงค์**: เก็บหัวเอกสารโอนค่าเสื่อมราคา (`1801`) พร้อมช่วงสินทรัพย์ ช่วงวันที่ประมวลผล วิธีคำนวณ และยอดค่าเสื่อมรวมทั้งใบ รวมถึงหัวเอกสารขายสินทรัพย์ (`1802`) ในฐานข้อมูลแบบเต็ม
- **Indexes**:
  - `idx_as_trans_doc_no_trans_flag` ON `as_trans` (`doc_no`, `trans_flag`)
  - `idx_as_trans_doc_date_trans_flag` ON `as_trans` (`doc_date`, `trans_flag`)

### คอลัมน์สำคัญ (จาก `02_data_schema.sql`)

| คอลัมน์ | ชนิดข้อมูล (SQL) | ค่าเริ่มต้น | ความหมายและค่า Flag |
| :--- | :--- | :--- | :--- |
| `doc_no`, `doc_date`, `doc_time` | `varchar(50)`, `date`, `varchar(10)` | `''`, `NULL`, `''` | เลขที่ วันที่ และเวลาเอกสาร |
| `doc_format_code` | `varchar(25)` | `''` | รหัสรูปแบบเอกสาร |
| `trans_type` | `smallint` | `0` | ประเภทธุรกรรม (`2` = ขายสินทรัพย์ ใน `fa_sale.go:18`) |
| `trans_flag` | `smallint` | `0` | รหัสประเภทเอกสาร (`fa_depreciation.go:29-30`):<br>• `1801` = โอนค่าเสื่อมราคาสินทรัพย์<br>• `1802` = ขายสินทรัพย์ |
| `process_mode` | `smallint` | `0` | เกณฑ์จำนวนวันคิดค่าเสื่อม (`fa_depreciation.go:32-34`):<br>• `0` = จำนวนวันสรรพากร (365 วัน/ปี)<br>• `1` = จำนวนวันบัญชี (30 วัน/เดือน, 360 วัน/ปี)<br>• `2` = จำนวนวันจริงตามปฏิทิน |
| `process_by` | `smallint` | `0` | งวดประมวลผลที่บันทึกลง DB (`fa_depreciation.go:1000` เก็บ `Input - 1`):<br>• `0` = รายวัน (`by_day`)<br>• `1` = รายเดือน (`by_month`)<br>• `2` = รายปี (`by_year`) |
| `date_begin`, `date_end` | `date` | `NULL` | ช่วงวันที่คำนวณค่าเสื่อมราคา |
| `from_as_code`, `to_as_code` | `varchar(25)` | `''` | ช่วงรหัสสินทรัพย์ |
| `from_as_type`, `to_as_type` | `varchar(25)` | `''` | ช่วงรหัสประเภทสินทรัพย์ |
| `from_as_department`, `to_as_department` | `varchar(25)` | `''` | ช่วงรหัสแผนกสินทรัพย์ |
| `from_as_period`, `to_as_period`, `by_year` | `smallint` | `0` | ช่วงงวด และธงรายปี |
| `department_split` | `smallint` | `0` | ธงแยกตามแผนก |
| `total_amount` | `numeric` | `0.0` | ยอดค่าเสื่อมราคา/ยอดเอกสารรวม |
| `remark` | `varchar(500)` | `''` | หมายเหตุ |

---

## 2. `as_trans_detail` — รายละเอียดสินทรัพย์รายรายการในเอกสาร

- **วัตถุประสงค์**: เก็บค่าเสื่อมราคาของสินทรัพย์แต่ละรหัสในการโอนค่าเสื่อมราคา 1 ครั้ง (`1801`) หรือบรรทัดรายการสินทรัพย์ที่ขาย (`1802`)
- **Indexes**:
  - `idx_as_trans_detail_doc_no_trans_flag` ON `as_trans_detail` (`doc_no`, `trans_flag`)
  - `idx_as_trans_detail_doc_date_trans_flag` ON `as_trans_detail` (`doc_date`, `trans_flag`)
  - `idx_as_trans_detail_item_code` ON `as_trans_detail` (`item_code`)

### คอลัมน์สำคัญ (จาก `02_data_schema.sql`)

| คอลัมน์ | ชนิดข้อมูล (SQL) | ความหมาย |
| :--- | :--- | :--- |
| `doc_no`, `doc_date`, `doc_time` | `varchar(50)`, `date`, `varchar(10)` | คีย์เชื่อมหัว `as_trans` |
| `trans_flag`, `trans_type` | `smallint` | รหัสประเภทเอกสาร (`1801`/`1802`) และประเภทธุรกรรม |
| `line_number` | `smallint` | ลำดับบรรทัด (เริ่มจาก `0` ใน `fa_depreciation.go:1011`) |
| `item_code`, `item_name` | `varchar(50)`, `varchar(255)` | รหัสสินทรัพย์ (`as_asset.code`) และชื่อสินทรัพย์ |
| `sum_amount` | `numeric` | ยอดค่าเสื่อมราคาในงวดนี้ (`1801`) หรือยอดขาย (`1802`) |
| `remark` | `varchar(500)` | หมายเหตุ |

---

## 3. `as_asset_sale` และ `as_asset_sale_detail` — ตารางขายสินทรัพย์เฉพาะทาง

- **วัตถุประสงค์**: เก็บหัวและรายละเอียดการขายสินทรัพย์พร้อมต้นทุน ค่าเสื่อมสะสม มูลค่าตามบัญชีคงเหลือ ราคาขาย VAT และยอดสุทธิ
- **Indexes**: `idx_as_asset_sale_ar_code` ON `as_asset_sale` (`ar_code`)

### คอลัมน์สำคัญ

| ตาราง | คอลัมน์สำคัญ |
| :--- | :--- |
| `as_asset_sale` | `doc_date`, `doc_no`, `doc_group`, `doc_ref`, `bill_no`, `bill_date`, `ar_code`, `sale_type`, `sale_date`, `side_code`, `department_code`, `total_value`, `total_depreciate_value`, `after_depreciate_value`, `total_sale_price`, `total_vat_value`, `total_net_value`, `status` |
| `as_asset_sale_detail` | `doc_date`, `doc_no`, `as_code`, `as_value`, `depreciate_value`, `after_depreciate`, `sale_price`, `vat_value`, `net_value`, `line_number`, `status` |

---

## 4. รูปแบบการ JOIN และตัวอย่าง SQL Query

1. **รายละเอียดการโอนค่าเสื่อมกับทะเบียนสินทรัพย์**: `as_trans h JOIN as_trans_detail d ON d.doc_no = h.doc_no AND d.trans_flag = h.trans_flag LEFT JOIN as_asset a ON a.code = d.item_code`
2. **เชื่อมใบสำคัญสมุดรายวัน (`gl_journal`)**: การโอนค่าเสื่อม (`1801`) และการขายสินทรัพย์ (`1802`) จะ Post เข้า `gl_journal` ด้วย `doc_no` และ `trans_flag` เดียวกัน ([[tbl-gl-journal]])

### ตัวอย่าง 1: สรุปค่าเสื่อมราคาสะสมที่โอนบัญชีแล้วรายสินทรัพย์จากเอกสาร `1801`
```sql
SELECT
    d.item_code AS asset_code,
    COALESCE(a.name_1, d.item_name) AS asset_name,
    MIN(h.date_begin) AS first_dep_date,
    MAX(h.date_end) AS last_dep_date,
    COUNT(DISTINCT h.doc_no)::INT AS dep_doc_count,
    COALESCE(SUM(d.sum_amount), 0)::NUMERIC(18,2) AS total_posted_depreciation
FROM as_trans h
JOIN as_trans_detail d
  ON d.doc_no = h.doc_no
 AND d.trans_flag = h.trans_flag
LEFT JOIN as_asset a
  ON a.code = d.item_code
WHERE h.trans_flag = 1801
GROUP BY d.item_code, COALESCE(a.name_1, d.item_name)
ORDER BY d.item_code;
```

### ตัวอย่าง 2: รายการขายสินทรัพย์จาก `as_asset_sale` พร้อมกำไร/ขาดทุนเบื้องต้น
```sql
SELECT
    h.doc_date,
    h.doc_no,
    h.ar_code,
    d.as_code,
    a.name_1 AS asset_name,
    d.as_value::NUMERIC(18,2) AS cost_value,
    d.depreciate_value::NUMERIC(18,2) AS accum_depreciation,
    d.after_depreciate::NUMERIC(18,2) AS book_value,
    d.sale_price::NUMERIC(18,2) AS sale_price_ex_vat,
    (d.sale_price - d.after_depreciate)::NUMERIC(18,2) AS gain_or_loss
FROM as_asset_sale h
JOIN as_asset_sale_detail d
  ON d.doc_no = h.doc_no
LEFT JOIN as_asset a
  ON a.code = d.as_code
WHERE COALESCE(h.status, 0) = 0
ORDER BY h.doc_date DESC, h.doc_no, d.line_number;
```
