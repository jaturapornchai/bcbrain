---
title: ตารางภาษีซื้อและภาษีขาย (gl_journal_vat_buy, gl_journal_vat_sale, gl_tax_group, gl_tax_type)
tags:
  - schema
  - gl
  - vat
  - tax
aliases:
  - gl_journal_vat_buy
  - gl_journal_vat_sale
  - gl_tax_group
  - gl_tax_type
sources:
  - scripts/sql/02_data_schema.sql:4522
  - scripts/sql/02_data_schema.sql:4566
  - scripts/sql/02_data_schema.sql:4655
  - scripts/sql/02_data_schema.sql:4672
  - scripts/sql/30_tax_doc_no_index.sql:6
  - backend/internal/application/process/journaltax.go:24
  - backend/internal/application/process/journaltax.go:138
  - backend/internal/application/process/trans_tax.go:1
  - backend/internal/application/process/report_menu_gl_fa.go:1400
---

# ตารางภาษีซื้อและภาษีขาย (`gl_journal_vat_buy`, `gl_journal_vat_sale`)

กลุ่มตารางย่อยสำหรับจัดทำรายงานภาษีซื้อ (`ภ.พ.30` ฝั่งซื้อ) และรายงานภาษีขาย (`ภ.พ.30` ฝั่งขาย) โดยรับข้อมูลจากทั้งเอกสารซื้อ/ขาย (`ic_trans`), เอกสารรับ-จ่ายชำระหนี้ที่ตัดภาษีไม่ถึงกำหนด (`ap_ar_trans` flag `19`/`239`), ขายสินทรัพย์ (`as_trans` flag `1802`) และการบันทึกรายวันด้วยมือ (`gl_journal` flag `1999`)

> [!IMPORTANT] จุดที่มักสับสนระหว่าง `vat_buy` และ `vat_sale`
> 1. **ชื่อคอลัมน์เลขที่ใบกำกับภาษีต่างกัน**:
>    - ฝั่งซื้อ (`gl_journal_vat_buy`) ใช้คอลัมน์ **`vat_doc_no`**
>    - ฝั่งขาย (`gl_journal_vat_sale`) ใช้คอลัมน์ **`vat_number`** (มี functional index `UPPER(vat_number)` ใน `scripts/sql/30_tax_doc_no_index.sql:6`)
> 2. **ปีภาษี (`vat_effective_year`) เก็บเป็น ค.ศ. เสมอ** ในฐานข้อมูล (`journaltax.go:29` ยืนยันว่าเป็น ค.ศ.; ห้ามสมมติว่าเป็น พ.ศ.)
> 3. **ไม่สร้างแถวเมื่อ `vat_type = 3` (ไม่กระทบภาษี)** ใน `ic_trans` และในรายงานภาษีซื้อ/ขายต้องตัดเอกสารที่เอกสารถูกยกเลิก (`last_status = 1`) หรือเอกสารสำเนา (`is_doc_copy = 1`) ออกเสมอ

---

## 1. `gl_journal_vat_buy` — รายการภาษีซื้อ

- **วัตถุประสงค์**: เก็บข้อมูลใบกำกับภาษีซื้อแต่ละใบสำหรับรายงานภาษีซื้อประจำเดือน, ภาษีซื้อขอคืนไม่ได้, ภาษีซื้อยังไม่ถึงกำหนดชำระ และภาษีซื้อเฉลี่ย
- **Indexes / Constraints**:
  - `idx_gl_journal_vat_buy_doc_no_trans_flag` ON `gl_journal_vat_buy` (`doc_no`, `trans_flag`)
  - `idx_gl_journal_vat_buy_doc_date_trans_flag` ON `gl_journal_vat_buy` (`doc_date`, `trans_flag`)
  - `idx_gl_journal_vat_buy_ap_code` ON `gl_journal_vat_buy` (`ap_code`)
  - Unique check ในโค้ด (`pk_ap_code_tax_no`): ห้าม `(ap_code, vat_doc_no, vat_calc)` ซ้ำกันสำหรับผู้ขายรายเดียวกัน

### คอลัมน์สำคัญ

| คอลัมน์ | ชนิดข้อมูล (SQL) | ค่าเริ่มต้น | ความหมายและค่า Flag |
| :--- | :--- | :--- | :--- |
| `doc_date`, `doc_no`, `book_code` | `date`, `varchar(25)`, `varchar(25)` | - | วันที่ เลขที่ และสมุดเอกสารต้นทาง |
| `line_number` | `smallint` | `0` | ลำดับบรรทัดใบกำกับภาษีในเอกสาร |
| `vat_date` | `date` | `NULL` | วันที่ในใบกำกับภาษี |
| `vat_doc_no` | `varchar(25)` | `''` | เลขที่ใบกำกับภาษีซื้อ *(ไม่ใช่ `vat_number`)* |
| `vat_new_number` | `varchar(25)` | `''` | เลขที่ใบกำกับภาษีใหม่ (กรณีปรับ/อ้างอิงเพิ่มเติม) |
| `vat_group` | `varchar(25)` | `''` | รหัสกลุ่มภาษี (เชื่อม `gl_tax_group.code`) |
| `vat_description` | `varchar(255)` | `''` | รายการสินค้า/บริการในรายงานภาษีซื้อ |
| `vat_base_amount` | `numeric` | `0.0` | มูลค่าฐานภาษี (ก่อน VAT) |
| `vat_rate` | `numeric` | `0.0` | อัตราภาษี (%) |
| `vat_amount` | `numeric` | `0.0` | จำนวนเงินภาษีมูลค่าเพิ่ม |
| `vat_total_amount` | `numeric` | `0.0` | ยอดรวมทั้งสิ้น (ฐาน + VAT) |
| `vat_except_amount_1` | `numeric` | `0.0` | มูลค่ายกเว้นภาษี |
| `vat_claim_amount` | `numeric` | `0.0` | ยอดภาษีซื้อที่ขอคืนได้จริง |
| `vat_claim_rate` | `numeric` | `0.0` | สัดส่วน/อัตราที่ขอคืนได้ (%) |
| `vat_average` | `integer` | `0` | ธง/กลุ่มภาษีซื้อเฉลี่ย |
| `vat_type` | `smallint` | `0` | ประเภทภาษีซื้อ (`journaltax.go:38`):<br>• `0` = ภาษีซื้อปกติ (ขอคืนได้)<br>• `1` = ภาษีซื้อขอคืนไม่ได้<br>• `2` = ภาษีซื้อยังไม่ถึงกำหนดชำระ |
| `vat_calc` | `smallint` | `0` | ตัวคูณทิศทางภาษี:<br>• `1` = ปกติ (บวก)<br>• `-1` = ลดหนี้ (ติดลบในรายงานภาษีซื้อ) |
| `vat_effective_period` | `smallint` | `0` | เดือนภาษีที่ยื่น (`1`–`12`) |
| `vat_effective_year` | `smallint` | `0` | ปีภาษีที่ยื่น (**เก็บเป็น ค.ศ.**) |
| `is_add` | `smallint` | `0` | `1` = ยื่นเพิ่มเติม |
| `trans_type`, `trans_flag` | `smallint` | `0` | ประเภทธุรกรรม (`1`=ฝั่งซื้อ) และรหัสเอกสารต้นทาง |
| `ap_code`, `ap_name` | `varchar(25)`, `varchar(255)` | `''` | รหัสและชื่อเจ้าหนี้/ผู้ขาย (เชื่อม `ap_supplier` ใน [[schema-overview]]) |
| `tax_no` | `varchar(25)` | `''` | เลขประจำตัวผู้เสียภาษี 13 หลักของผู้ขาย |
| `branch_type`, `branch_code` | `smallint`, `varchar(25)` | `0`, `''` | `0` = สำนักงานใหญ่, `1` = สาขา (พร้อมรหัสสาขา 5 หลัก) |
| `manual_add` | `smallint` | `0` | `1` = กรอกชื่อ/เลขผู้เสียภาษี/สาขาเอง (`0` = ดึงจากมาสเตอร์ผู้ขาย) |
| `ref_vat_no`, `ref_vat_date`, `ref_doc_no`, `ref_doc_date` | `varchar(25)`/`date` | `''`/`NULL` | อ้างอิงใบกำกับภาษีซื้อยังไม่ถึงกำหนดเดิมที่นำมาตัดชำระในเอกสาร flag `19` |

---

## 2. `gl_journal_vat_sale` — รายการภาษีขาย

- **วัตถุประสงค์**: เก็บข้อมูลใบกำกับภาษีขายที่ออกให้ลูกค้า สำหรับจัดทำรายงานภาษีขายประจำเดือน
- **Indexes**:
  - `idx_gl_journal_vat_sale_doc_no_trans_flag` ON `gl_journal_vat_sale` (`doc_no`, `trans_flag`)
  - `idx_gl_journal_vat_sale_doc_date_trans_flag` ON `gl_journal_vat_sale` (`doc_date`, `trans_flag`)
  - `idx_gl_journal_vat_sale_ar_code` ON `gl_journal_vat_sale` (`ar_code`)
  - `idx_gl_journal_vat_sale_vat_number_upper` ON `gl_journal_vat_sale` (`UPPER(vat_number)`) (`30_tax_doc_no_index.sql:6`)

### คอลัมน์สำคัญ (เทียบจุดต่างกับฝั่งซื้อ)

| คอลัมน์ (`gl_journal_vat_sale`) | ชนิดข้อมูล (SQL) | ความหมายและจุดต่างจาก `vat_buy` |
| :--- | :--- | :--- |
| `vat_number` | `varchar(25)` | เลขที่ใบกำกับภาษีขาย *(เทียบเท่า `vat_doc_no` ของฝั่งซื้อ)* |
| `tax_group` | `varchar(25)` | รหัสกลุ่มภาษี *(เทียบเท่า `vat_group`)* |
| `description` | `varchar(255)` | รายการสินค้า/บริการ *(เทียบเท่า `vat_description`)* |
| `base_caltax_amount` | `numeric` | มูลค่าฐานคำนวณภาษี *(เทียบเท่า `vat_base_amount`)* |
| `tax_rate` | `numeric` | อัตราภาษี (%) *(เทียบเท่า `vat_rate`)* |
| `amount` | `numeric` | จำนวนเงินภาษีขาย *(เทียบเท่า `vat_amount`)* |
| `except_tax_amount` | `numeric` | มูลค่ายกเว้นภาษี *(เทียบเท่า `vat_except_amount_1`)* |
| `vat_type` | `smallint` | `0` = ปกติ, `1` = ภาษีขายยังไม่ถึงกำหนดชำระ (`journaltax.go:38`) |
| `vat_calc` | `smallint` | `1` = ปกติ (ขาย/เพิ่มหนี้), `-1` = ลดหนี้ |
| `ar_code`, `ar_name` | `varchar(25)`, `varchar(255)` | รหัสและชื่อลูกค้า |
| `vat_effective_period`, `vat_effective_year` | `smallint` | เดือน และปี ค.ศ. ที่ยื่นภาษี |
| `is_doc_copy` | `smallint` | `1` = สำเนา (รายงานต้องกรอง `COALESCE(is_doc_copy, 0) = 0`) |
| `tax_no`, `branch_type`, `branch_code`, `manual_add` | - | เลขผู้เสียภาษีลูกค้า, สำนักงานใหญ่(`0`)/สาขา(`1`), ธงกรอกเอง |
| `ref_vat_no`, `ref_vat_date`, `ref_doc_no`, `ref_doc_date` | - | อ้างอิงใบกำกับภาษียังไม่ถึงกำหนดเดิม (ใช้ในรับชำระหนี้ flag `239`) |

---

## 3. ตารางมาสเตอร์กลุ่มภาษี (`gl_tax_group`, `gl_tax_type`)

| ตาราง | Index | คอลัมน์หลักและวัตถุประสงค์ |
| :--- | :--- | :--- |
| `gl_tax_group` | `idx_gl_tax_group_code` | `code`, `name_1`, `name_2`, `tax_rate` (`numeric`), `remark`, `status` — กำหนดกลุ่ม/อัตราภาษี VAT |
| `gl_tax_type` | `idx_gl_tax_type_code` | `code`, `name_1`, `name_2`, `status` — มาสเตอร์ประเภทภาษี |

---

## 4. รูปแบบการ JOIN และตัวอย่าง SQL Query

1. **เชื่อมตรวจสอบเอกสารถูกยกเลิก**: เอกสารซื้อ/ขายเชื่อมกับ `ic_trans` ด้วย `(doc_no, trans_flag)`, เอกสารชำระหนี้ `19`/`239` เชื่อม `ap_ar_trans` ด้วย `(doc_no, trans_flag)`, ขายสินทรัพย์ `1802` เชื่อม `as_trans` และรายวันมือ `1999` เชื่อม `gl_journal` ([[tbl-gl-journal]])
2. **ลดหนี้และการคำนวณยอดรายงาน**: คูณ `vat_calc` (`1` หรือ `-1`) เพื่อให้ใบลดหนี้หักออกจากยอดฐานภาษีและยอด VAT ในงวดเดียวกัน

### ตัวอย่าง 1: รายงานภาษีซื้อประจำเดือนภาษี (รวมผลใบลดหนี้, ตัดเอกสารยกเลิก)
```sql
SELECT
    v.vat_effective_year,
    v.vat_effective_period,
    v.vat_date,
    v.vat_doc_no,
    v.doc_no,
    v.ap_code,
    v.ap_name,
    v.tax_no,
    v.branch_type,
    v.branch_code,
    v.vat_type,
    (v.vat_base_amount * CASE WHEN v.vat_calc = -1 THEN -1 ELSE 1 END)::NUMERIC(18,2) AS signed_base_amount,
    (v.vat_amount * CASE WHEN v.vat_calc = -1 THEN -1 ELSE 1 END)::NUMERIC(18,2) AS signed_vat_amount
FROM gl_journal_vat_buy v
LEFT JOIN ic_trans ic
  ON ic.doc_no = v.doc_no AND ic.trans_flag = v.trans_flag
LEFT JOIN ap_ar_trans ap
  ON ap.doc_no = v.doc_no AND ap.trans_flag = v.trans_flag AND v.trans_flag IN (19, 239)
WHERE v.vat_effective_year = 2026
  AND v.vat_effective_period = 1
  AND COALESCE(ic.last_status, 0) = 0
  AND COALESCE(ap.last_status, 0) = 0
ORDER BY v.vat_date, v.vat_doc_no;
```

### ตัวอย่าง 2: รายงานภาษีขายประจำเดือนภาษี (กรองสำเนาและเอกสารยกเลิก)
```sql
SELECT
    s.vat_date,
    s.vat_number,
    s.doc_no,
    s.ar_code,
    s.ar_name,
    s.tax_no,
    s.vat_type,
    (s.base_caltax_amount * CASE WHEN s.vat_calc = -1 THEN -1 ELSE 1 END)::NUMERIC(18,2) AS signed_base_amount,
    (s.amount * CASE WHEN s.vat_calc = -1 THEN -1 ELSE 1 END)::NUMERIC(18,2) AS signed_vat_amount
FROM gl_journal_vat_sale s
LEFT JOIN ic_trans ic
  ON ic.doc_no = s.doc_no AND ic.trans_flag = s.trans_flag
WHERE s.vat_effective_year = 2026
  AND s.vat_effective_period = 1
  AND COALESCE(s.is_doc_copy, 0) = 0
  AND COALESCE(ic.last_status, 0) = 0
ORDER BY s.vat_date, s.vat_number;
```
