---
title: ap_ar_trans — หัวเอกสารวางบิล รับชำระหนี้ และจ่ายชำระหนี้ (AR/AP Financial Header)
tags: [dev, schema, ar, ap, ap_ar_trans, billing, payment, postgres]
aliases: [ap_ar_trans, ใบวางบิล, ใบรับวางบิล, รับชำระหนี้, จ่ายชำระหนี้]
sources:
  - scripts/sql/02_data_schema.sql:461-546
  - backend/internal/application/process/docs.go:335-498
  - backend/internal/application/process/report_menu_ap_ar.go:1-280
---

# `ap_ar_trans` — หัวเอกสารวางบิล รับชำระหนี้ และจ่ายชำระหนี้

`ap_ar_trans` เป็นตารางหัวเอกสารการเงินฝั่งลูกหนี้ (AR) และเจ้าหนี้ (AP) สำหรับกระบวนการ **วางบิล / รับวางบิล / รับชำระหนี้ / จ่ายชำระหนี้** ซึ่งทำงานคู่กับตารางรายการตัดบิล [[tbl-ar-ap-trans-detail]] และตารางรับจ่ายเงิน/เช็ค (`cb_trans`, `cb_trans_detail`, `cb_chq_list`) ต่างจากใบกำกับ/ใบส่งของ/ใบซื้อที่เก็บหัวเอกสารใน [[tbl-ic-trans]]

---

## 1. ข้อมูลระบุตัวตน กุญแจหลัก และรหัสประเภทเอกสาร

- **Primary Key / Unique Key**:
  - ใน `scripts/sql/02_data_schema.sql:461-546` ไม่มี SQL `PRIMARY KEY` (มี `roworder SERIAL NOT NULL`)
  - ใน Go Backend (`docs.go:461-497`) ระบุชัดว่า `ap_ar_trans` **มีเอกลักษณ์บน `doc_no` เพียงฟิลด์เดียว** (สืบทอดแนวคิด PK `ap_ar_trans_ap_ar_trans_pk_primary` จาก C#) และคุมการชนกันด้วย Advisory Lock (`ap_ar_trans:<doc_no>`) รวมถึงตรวจสอบซ้ำด้วย `SELECT EXISTS (SELECT 1 FROM ap_ar_trans WHERE doc_no = $1)`
- **Indexes (`scripts/sql/02_data_schema.sql:544-546`)**:
  - `idx_ap_ar_trans_doc_no_trans_flag` ON `ap_ar_trans` (`doc_no`, `trans_flag`)
  - `idx_ap_ar_trans_doc_date_trans_flag` ON `ap_ar_trans` (`doc_date`, `trans_flag`)
  - `idx_ap_ar_trans_cust_code` ON `ap_ar_trans` (`cust_code`)

### ค่า `trans_type` และ `trans_flag` หลัก (`docs.go:526-529`, `report_menu_ap_ar.go`)

| `trans_flag` | `trans_type` | ประเภทเอกสาร | คู่ค้าใน `cust_code` | สถานะตัดหนี้ |
|---:|---:|---|---|---|
| `19` | `1` (AP) | จ่ายชำระหนี้ (เจ้าหนี้) | `ap_supplier.code` | ตัดยอดค้างจ่ายบิลซื้อ + ลงบัญชี GL + บันทึก `cb_trans*` |
| `213` | `1` (AP) | ใบรับวางบิล (จากเจ้าหนี้) | `ap_supplier.code` | รวมบิลเจ้าหนี้เตรียมจ่ายชำระ (ยังไม่ตัดหนี้จนกว่าจะเปิด `19`) |
| `235` | `2` (AR) | ใบวางบิล (ให้ลูกหนี้) | `ar_customer.code` | รวมบิลลูกหนี้ส่งเรียกเก็บเงิน (ยังไม่ตัดหนี้จนกว่าจะเปิด `239`) |
| `239` | `2` (AR) | รับชำระหนี้ (ลูกหนี้) | `ar_customer.code` | ตัดยอดค้างรับบิลขาย + ลงบัญชี GL + บันทึก `cb_trans*` |

> [!NOTE]
> ค่า `last_status = 1` หรือ `is_cancel = 1` คือเอกสารถูกยกเลิก; นอกจากนี้ `apArEditLocked` (`docs.go:458`) ห้ามแก้ไขหรือลบเอกสารเมื่อ `used_status = 1 OR doc_success = 1 OR last_status = 1`

---

## 2. คอลัมน์สำคัญใน `ap_ar_trans`

| กลุ่มคอลัมน์ | ชื่อคอลัมน์ และชนิดข้อมูล | ความหมาย / ค่า Flag |
|---|---|---|
| **ระบุเอกสาร** | `trans_type smallint`, `trans_flag smallint`, `doc_no varchar(25)`, `doc_date date`, `doc_time varchar(5)`, `doc_format_code varchar(25)`, `doc_group varchar(25)` | ชนิด/รหัสเอกสาร เลขที่ วันที่ เวลา รูปแบบรันเลข และกลุ่มเอกสาร |
| **อ้างอิง & เครดิต** | `doc_ref varchar(25)`, `doc_ref_date date`, `tax_doc_no varchar(25)`, `tax_doc_date date`, `credit_code varchar(25)`, `credit_day integer`, `due_date date`, `delivery_date date`, `ref_doc_type varchar(50)` | เลขที่อ้างอิง ใบกำกับภาษี วันเครดิต วันครบกำหนด และประเภทเอกสารอ้างอิง |
| **คู่ค้า & องค์กร** | `cust_code varchar(25)`, `branch_code varchar(25)`, `side_code varchar(25)`, `department_code varchar(25)`, `project_code varchar(25)`, `allocate_code varchar(25)`, `job_code varchar(25)`, `sale_area_code varchar(25)`, `sale_code varchar(25)` | รหัสลูกค้า (`ar_customer`) หรือเจ้าหนี้ (`ap_supplier`) ตาม `trans_flag` พร้อมรหัสสาขา/ฝ่าย/แผนก/โครงการ/พนักงานขาย |
| **ภาษี & สกุลเงิน** | `vat_type smallint`, `vat_rate numeric`, `currency_code varchar(25)`, `exchange_rate numeric`, `currency_money numeric`, `is_manual_vat smallint` | ประเภท/อัตราภาษีมูลค่าเพิ่ม, สกุลเงินตราต่างประเทศ และอัตราแลกเปลี่ยน |
| **มูลค่ารวม & FX** | `total_value numeric`, `total_discount numeric`, `discount_word varchar(25)`, `total_after_discount numeric`, `total_before_vat numeric`, `total_vat_value numeric`, `total_after_vat numeric`, `total_net_value numeric`, `total_net_value_2 numeric`, `lost_profit_exchange_amount numeric` | ยอดมูลค่าบิลรวม ส่วนลด ภาษี และยอดสุทธิ (`total_net_value` = ผลรวม `sum_pay_money` ในตาราง Detail สำหรับ `19`/`239`); `lost_profit_exchange_amount` และ `total_net_value_2` ใช้ปรับกำไร/ขาดทุนอัตราแลกเปลี่ยน |
| **ยอดชำระแยกช่องทาง** | `total_pay_money numeric`, `sum_pay_money_cash numeric`, `sum_pay_money_chq numeric`, `sum_pay_money_credit numeric`, `sum_pay_money_transfer numeric`, `sum_pay_money_diff numeric`, `total_pay_tax numeric`, `total_debt_value numeric`, `total_debt_balance numeric`, `amount numeric`, `money_balance numeric`, `payment_method varchar(100)`, `book_no varchar(100)`, `pay_installments varchar(100)` | แยกยอดจ่าย/รับชำระด้วยเงินสด เช็ค บัตรเครดิต เงินโอน ส่วนต่าง/ปัดเศษ และภาษีหัก ณ ที่จ่าย (`total_pay_tax`) |
| **สถานะเอกสาร** | `last_status smallint`, `used_status smallint`, `doc_success smallint`, `status smallint`, `is_cancel smallint`, `cancel_code varchar(25)`, `cancel_datetime timestamp` | สถานะใช้งาน/ยกเลิก/นำไปใช้ต่อ/ปิดจบเอกสาร (ใช้ใน `apArEditLocked`) |
| **แฟล็กขั้นตอนเดิม** | `po_debt_balance`, `po_cn_balance`, `po_purchase`, `po_addition_debt`, `so_billing`, `so_addition_debt`, `so_debt_balance`, `so_cn_balance` (`integer`) | สถานะอ้างอิงฝั่งซื้อ/ขายจากโครงสร้างดั้งเดิม |
| **Audit & Shift** | `sale_shift_id varchar(50)`, `remark varchar(255)`, `guid_code varchar(35)`, `creator_code`, `last_editor_code`, `create_datetime`, `lastedit_datetime` | รอบกะ POS หมายเหตุ รหัสผู้สร้าง และผู้แก้ไขล่าสุด |

---

## 3. รูปแบบการ JOIN และตัวอย่าง SQL Query จริง

### 3.1 ดึงใบรับชำระหนี้ลูกหนี้ (`trans_flag = 239`) พร้อมชื่อลูกค้าและสรุปบิลที่ตัดชำระ

```sql
SELECT h.doc_no,
       h.doc_date,
       h.cust_code,
       c.name_1 AS customer_name,
       h.currency_code,
       h.exchange_rate,
       h.total_net_value,
       h.sum_pay_money_cash,
       h.sum_pay_money_transfer,
       h.sum_pay_money_chq,
       h.total_pay_tax,
       h.lost_profit_exchange_amount,
       COUNT(d.roworder) AS bill_count
FROM ap_ar_trans h
LEFT JOIN ar_customer c ON c.code = h.cust_code
LEFT JOIN ap_ar_trans_detail d
       ON d.doc_no = h.doc_no
      AND d.trans_flag = h.trans_flag
      AND COALESCE(d.last_status, 0) = 0
WHERE h.trans_flag = 239
  AND COALESCE(h.last_status, 0) = 0
  AND h.doc_date BETWEEN $1::date AND $2::date
GROUP BY h.roworder, h.doc_no, h.doc_date, h.cust_code, c.name_1,
         h.currency_code, h.exchange_rate, h.total_net_value,
         h.sum_pay_money_cash, h.sum_pay_money_transfer, h.sum_pay_money_chq,
         h.total_pay_tax, h.lost_profit_exchange_amount
ORDER BY h.doc_date DESC, h.doc_no DESC;
```

### 3.2 ตรวจสอบเอกสารที่ถูกล็อกห้ามแก้ไขก่อนอนุญาตให้เขียนทับ/ลบ

```sql
SELECT doc_no,
       trans_flag,
       COALESCE(used_status, 0) AS used_status,
       COALESCE(doc_success, 0) AS doc_success,
       COALESCE(last_status, 0) AS last_status
FROM ap_ar_trans
WHERE doc_no = $1
LIMIT 1;
-- แก้ไข/ลบไม่ได้ถ้า used_status = 1 OR doc_success = 1 OR last_status = 1 (docs.go:458)
```
