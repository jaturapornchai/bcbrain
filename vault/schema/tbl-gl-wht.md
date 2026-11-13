---
title: ตารางภาษีหัก ณ ที่จ่าย และติดตามหนังสือรับรอง 50 ทวิ (gl_wht_list, gl_wht_list_detail, gl_wht_out_tracking)
tags:
  - schema
  - gl
  - wht
  - pnd3
  - pnd53
aliases:
  - gl_wht_list
  - gl_wht_list_detail
  - gl_wht_out_tracking
sources:
  - scripts/sql/02_data_schema.sql:4728
  - scripts/sql/02_data_schema.sql:4753
  - backend/internal/application/process/journaltax.go:18
  - backend/internal/application/process/journaltax.go:108
  - backend/internal/application/process/journaltax.go:243
  - backend/internal/application/process/report_menu_gl_fa.go:1152
  - backend/internal/application/process/rd_tax_export_wht.go:99
---

# ตารางภาษีหัก ณ ที่จ่าย และติดตาม 50 ทวิ (`gl_wht_*`)

กลุ่มตารางสำหรับจัดเก็บหนังสือรับรองการหักภาษี ณ ที่จ่าย (ทั้งฝั่ง **หัก ณ ที่จ่าย** เพื่อยื่น ภ.ง.ด.3 / ภ.ง.ด.53 และฝั่ง **ถูกหัก ณ ที่จ่าย** จากลูกค้า) พร้อมตารางติดตามการทวงถามใบ 50 ทวิที่ลูกค้าหักเราไว้ (`gl_wht_out_tracking`)

> [!IMPORTANT] ข้อควรระวังสำคัญที่สุดของตาราง WHT
> 1. **วันที่ที่ใช้ในรายงานภาษี WHT คือ `due_date` ไม่ใช่ `doc_date`**: โค้ดรายงาน (`report_menu_gl_fa.go:1153`) กรองงวดภาษีจาก **`gl_wht_list_detail.due_date`** (และบางเอกสารไม่ได้เขียนค่าลง `doc_date`)
> 2. **เลขที่หนังสือรับรองหัก ณ ที่จ่าย (`tax_doc_no`) ต้องไม่ซ้ำทั้งระบบ**: `journaltax.go:108` บังคับไม่ให้ `gl_wht_list.tax_doc_no` ซ้ำข้ามเอกสาร
> 3. **คีย์เชื่อมหัว-รายละเอียดครบชุด**: `(doc_no, trans_flag, tax_doc_no)`

---

## 1. `gl_wht_list` — หัวหนังสือรับรองการหักภาษี ณ ที่จ่าย

- **วัตถุประสงค์**: เก็บหัวใบรับรอง 50 ทวิ 1 ใบต่อเลขที่ `tax_doc_no` พร้อมข้อมูลผู้เสียภาษีและยอดรวมของใบรับรองนั้น
- **Indexes**:
  - `idx_gl_wht_list_doc_no_trans_flag` ON `gl_wht_list` (`doc_no`, `trans_flag`)
  - `idx_gl_wht_list_doc_date_trans_flag` ON `gl_wht_list` (`doc_date`, `trans_flag`)
  - `idx_gl_wht_list_cust_code` ON `gl_wht_list` (`cust_code`)

### คอลัมน์สำคัญ

| คอลัมน์ | ชนิดข้อมูล (SQL) | ค่าเริ่มต้น | ความหมายและค่า Flag |
| :--- | :--- | :--- | :--- |
| `tax_doc_no` | `varchar(25)` | `''` | เลขที่หนังสือรับรองการหักภาษี ณ ที่จ่าย (Unique ต่อใบใน `journaltax.go:108`) |
| `doc_no` | `varchar(25)` | `''` | เลขที่เอกสารต้นทาง (ซื้อ/จ่ายชำระหนี้/ขาย/รับชำระหนี้/JV) |
| `doc_date` | `date` | `NULL` | วันที่เอกสารต้นทาง *(บางหน้าจออาจว่าง ให้ยึด `due_date` เป็นหลัก)* |
| `due_date` | `date` | `NULL` | วันที่จ่ายเงิน / วันที่ออกใบ 50 ทวิ (ใช้จัดงวดยื่น ภ.ง.ด.3 / ภ.ง.ด.53) |
| `trans_flag` | `smallint` | `0` | รหัสประเภทเอกสาร:<br>• `1502` = หัก ณ ที่จ่ายจากรายการ GL (ฝั่งหักผู้ขาย)<br>• `1501` = ถูกหัก ณ ที่จ่ายจากรายการ GL (ฝั่งลูกค้าหักเรา)<br>• `1999` = แท็บ WHT ของใบสำคัญสมุดรายวัน (`gl_journal`)<br>• หรือรหัสเอกสารซื้อ/ขาย/รับ-จ่ายชำระหนี้ต้นทาง (เช่น `19`, `239`, `12`, `16`, `44`, `1802`) |
| `amount` | `numeric` | `0.0` | จำนวนเงินที่จ่าย/ฐานภาษีรวม |
| `tax_value` | `numeric` | `0.0` | ยอดภาษีที่หัก/ถูกหักรวม |
| `cust_code` | `varchar(35)` | `''` | รหัสผู้มีเงินได้ (ฝั่งซื้อ → `ap_supplier.code`) หรือผู้หัก (ฝั่งขาย → `ar_customer.code`) |
| `cust_name` | `varchar(255)` | `''` | ชื่อผู้เสียภาษีบนใบ 50 ทวิ |
| `cust_address` | `varchar(1000)` | `''` | ที่อยู่บนใบ 50 ทวิ |
| `card_number` | `varchar(50)` | `''` | เลขประจำตัวประชาชน 13 หลัก (กรณีบุคคลธรรมดา / ภ.ง.ด.3) |
| `tax_number` | `varchar(50)` | `''` | เลขประจำตัวผู้เสียภาษีนิติบุคคล (ภ.ง.ด.53) |
| `cust_tax_type` | `smallint` | `0` | ประเภทผู้เสียภาษี (`report_menu_gl_fa.go:1152-1158`):<br>• `0` = บุคคลธรรมดา (ยื่น **ภ.ง.ด.3**)<br>• `1` = นิติบุคคล (ยื่น **ภ.ง.ด.53**) |
| `line_number` | `integer` | `0` | ลำดับใบ 50 ทวิภายในเอกสาร 1 ใบ |
| `status` | `smallint` | `0` | สถานะ (`0` = ปกติ) |

---

## 2. `gl_wht_list_detail` — รายละเอียดประเภทเงินได้ในใบ 50 ทวิ

- **วัตถุประสงค์**: เก็บรายการย่อยแยกตามประเภทเงินได้ (`income_type`) และอัตราภาษี (`tax_rate`) ภายใต้ใบรับรอง `gl_wht_list` 1 ใบ
- **Indexes**:
  - `idx_gl_wht_list_detail_doc_no_trans_flag` ON `gl_wht_list_detail` (`doc_no`, `trans_flag`)
  - `idx_gl_wht_list_detail_doc_date_trans_flag` ON `gl_wht_list_detail` (`doc_date`, `trans_flag`)
  - `idx_gl_wht_list_detail_cust_code` ON `gl_wht_list_detail` (`cust_code`)

### คอลัมน์สำคัญ

| คอลัมน์ | ชนิดข้อมูล (SQL) | ค่าเริ่มต้น | ความหมายและค่า Flag |
| :--- | :--- | :--- | :--- |
| `doc_no`, `trans_flag`, `tax_doc_no` | `varchar(25)`, `smallint`, `varchar(25)` | - | คีย์เชื่อมกลับไปยังหัว `gl_wht_list` |
| `line_number` | `integer` | `0` | ลำดับบรรทัด |
| `income_type` | `varchar(100)` | `''` | ประเภทเงินได้พึงประเมิน (เช่น ค่าบริการ, ค่าเช่า, ค่าขนส่ง, ค่าโฆษณา) |
| `tax_rate` | `numeric` | `0.0` | อัตราภาษีที่หัก (%) เช่น `1`, `2`, `3`, `5` |
| `amount` | `numeric` | `0.0` | ฐานเงินได้ที่นำมาคำนวณหัก ณ ที่จ่าย |
| `tax_value` | `numeric` | `0.0` | จำนวนภาษีที่หักไว้ |
| `sum_amount` | `numeric` | `0.0` | ยอดสุทธิ |
| `due_date` | `date` | `NULL` | วันที่จ่าย/วันที่หัก (ใช้กรองงวดรายงานหลัก) |
| `cust_code` | `varchar(35)` | `''` | รหัสคู่ค้า |
| `status` | `smallint` | `0` | สถานะแถว (`0` = ปกติ) |

---

## 3. `gl_wht_out_tracking` — ติดตามรับใบ 50 ทวิจากลูกค้า

- **วัตถุประสงค์**: ตารางติดตามสถานะการขอรับหนังสือรับรอง 50 ทวิตัวจริง/e-WHT ที่ลูกค้าหักภาษีบริษัทเราไว้ (สร้างอัตโนมัติโดย `rd_tax_export_wht.go:99`) เพื่อไม่ให้เสียเครดิตภาษีปลายปี ภ.ง.ด.50
- **Primary Key**: `wht_doc_no` (`VARCHAR(50)`)
- **Indexes**: `idx_gl_wht_out_tracking_status` ON `gl_wht_out_tracking` (`cert_status`, `cust_code`)

### คอลัมน์สำคัญ

| คอลัมน์ | ชนิดข้อมูล (SQL) | ค่าเริ่มต้น | ความหมายและค่า Flag |
| :--- | :--- | :--- | :--- |
| `wht_doc_no` | `VARCHAR(50) PRIMARY KEY` | - | เลขที่อ้างอิงเอกสาร/ใบ 50 ทวิฝั่งถูกหัก |
| `cust_code` | `VARCHAR(50)` | `''` | รหัสลูกค้าผู้หักภาษี (`ar_customer.code`) |
| `cert_status` | `VARCHAR(20)` | `'PENDING'` | สถานะติดตามใบรับรอง (`rd_tax_export_wht.go:37`):<br>• `'PENDING'` = รอรับใบ 50 ทวิจากลูกค้า<br>• `'RECEIVED'` = ได้รับใบรับรองแล้ว<br>• `'WAIVED'` = ยกเว้น/ปิดติดตาม |
| `cert_no` | `VARCHAR(60)` | `''` | เลขที่ใบ 50 ทวิที่ได้รับจริงจากลูกค้า |
| `received_date` | `DATE` | `NULL` | วันที่ได้รับใบรับรอง |
| `remark` | `TEXT` | `''` | หมายเหตุการติดตามทวงถาม |

---

## 4. รูปแบบการ JOIN และตัวอย่าง SQL Query

1. **หัว-บรรทัด 50 ทวิ**: `gl_wht_list h JOIN gl_wht_list_detail d ON d.doc_no = h.doc_no AND d.trans_flag = h.trans_flag AND d.tax_doc_no = h.tax_doc_no`
2. **กรองเอกสารยกเลิก**: เช็ก `last_status = 0` ที่ `ap_ar_trans` (`19`/`239`), `as_trans` (`1802`), `ic_trans` (เอกสารซื้อ/ขาย) ส่วน `1501`/`1502`/`1999` ตรวจตรงกับ `gl_journal` ([[tbl-gl-journal]])
3. **แยก ภ.ง.ด.3 vs ภ.ง.ด.53**: ใช้ `COALESCE(h.cust_tax_type, m.ap_status, 0)` โดย `0` = ภ.ง.ด.3 และ `1` = ภ.ง.ด.53

### ตัวอย่าง 1: รายงานภาษีหัก ณ ที่จ่าย ภ.ง.ด.53 (นิติบุคคล) ประจำเดือนจาก `due_date`
```sql
SELECT
    h.tax_doc_no,
    d.due_date,
    h.doc_no,
    h.cust_code,
    COALESCE(NULLIF(h.cust_name, ''), m.name_1, '') AS payee_name,
    COALESCE(NULLIF(h.tax_number, ''), '') AS tax_id,
    d.income_type,
    d.tax_rate::NUMERIC(9,2) AS tax_rate,
    d.amount::NUMERIC(18,2) AS base_amount,
    d.tax_value::NUMERIC(18,2) AS wht_amount
FROM gl_wht_list_detail d
JOIN gl_wht_list h
  ON h.doc_no = d.doc_no
 AND h.trans_flag = d.trans_flag
 AND h.tax_doc_no = d.tax_doc_no
LEFT JOIN ap_supplier m
  ON m.code = h.cust_code
LEFT JOIN ic_trans ic
  ON ic.doc_no = d.doc_no AND ic.trans_flag = d.trans_flag
LEFT JOIN ap_ar_trans ap
  ON ap.doc_no = d.doc_no AND ap.trans_flag = d.trans_flag AND d.trans_flag IN (19, 239)
WHERE d.trans_flag IN (12, 14, 16, 19, 260, 1502, 1999)
  AND d.due_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31'
  AND COALESCE(h.cust_tax_type, m.ap_status, 0) = 1
  AND COALESCE(ic.last_status, 0) = 0
  AND COALESCE(ap.last_status, 0) = 0
ORDER BY d.due_date, h.tax_doc_no, d.line_number;
```

### ตัวอย่าง 2: รายการที่ลูกค้าหัก ณ ที่จ่ายเราไว้แต่ยังไม่ได้รับใบ 50 ทวิตัวจริง
```sql
SELECT
    h.tax_doc_no,
    d.due_date,
    h.cust_code,
    h.cust_name,
    d.amount::NUMERIC(18,2) AS base_amount,
    d.tax_value::NUMERIC(18,2) AS wht_withheld_amount,
    COALESCE(t.cert_status, 'PENDING') AS cert_status,
    (CURRENT_DATE - d.due_date) AS days_pending
FROM gl_wht_list h
JOIN gl_wht_list_detail d
  ON d.doc_no = h.doc_no AND d.trans_flag = h.trans_flag AND d.tax_doc_no = h.tax_doc_no
LEFT JOIN gl_wht_out_tracking t
  ON t.wht_doc_no = h.tax_doc_no
WHERE h.trans_flag IN (1501, 239, 44, 46)
  AND COALESCE(t.cert_status, 'PENDING') = 'PENDING'
ORDER BY d.due_date;
```
