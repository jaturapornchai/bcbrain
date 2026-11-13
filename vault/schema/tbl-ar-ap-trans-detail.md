---
title: ap_ar_trans_detail & Transport Labels — ตารางอเนกประสงค์ 3 บทบาท (ตัดบิล / มัดจำ / เชื่อม PO-ตรวจนับ)
tags: [dev, schema, ar, ap, ap_ar_trans_detail, ap_ar_transport_label, multi-role, postgres]
aliases: [ap_ar_trans_detail, ap_ar_trans_detail_draft, ap_ar_transport_label, ap_ar_resource, รายการตัดบิล]
sources:
  - scripts/sql/02_data_schema.sql:454-459
  - scripts/sql/02_data_schema.sql:548-660
  - backend/internal/application/process/docs.go:500-685
  - backend/internal/application/process/trans.go:218-230
  - backend/internal/application/process/trans.go:942-957
  - backend/internal/application/process/doc_flow.go:14-100
  - backend/internal/application/process/stock_lot.go:140-175
  - backend/internal/application/process/sysproc_ic_checks_data.go:75-94
  - backend/internal/application/process/service.go:844-856
  - backend/internal/application/process/report_menu_ap_ar.go:954-985
---

# `ap_ar_trans_detail` & Transport Labels — ตาราง 3 บทบาทและที่อยู่จัดส่ง

`ap_ar_trans_detail` เป็นหนึ่งในตารางที่มีพฤติกรรมซับซ้อนที่สุดใน BC AI Account เพราะถูกใช้งานข้ามโมดูลมากกว่า 3 บทบาทขึ้นอยู่กับ `trans_flag` (ไม่ได้ผูกกับหัวเอกสารใน `ap_ar_trans` เพียงอย่างเดียว แต่ผูกกับ `ic_trans` ด้วย!) ดูภาพรวมใน [[schema-overview]] และหัวเอกสารที่ [[tbl-ar-ap-trans]] กับ [[tbl-ic-trans]]

---

## 1. ตาราง `ap_ar_trans_detail` และ 3+ บทบาทสำคัญ (Multi-Role Usage)

- **Primary Key / Unique Key**: ไม่มี SQL `PRIMARY KEY` ใน `02_data_schema.sql` (ใช้ `roworder SERIAL NOT NULL`)
- **Indexes (`scripts/sql/02_data_schema.sql:602-604`)**:
  - `idx_ap_ar_trans_detail_doc_no_trans_flag` ON `ap_ar_trans_detail` (`doc_no`, `trans_flag`)
  - `idx_ap_ar_trans_detail_doc_date_trans_flag` ON `ap_ar_trans_detail` (`doc_date`, `trans_flag`)
  - `idx_ap_ar_trans_detail_cust_code` ON `ap_ar_trans_detail` (`cust_code`)

### สรุป 3 บทบาทหลักของ `ap_ar_trans_detail`

| บทบาท | ตารางหัวเอกสารที่เป็นแม่ | `trans_flag` ที่เกี่ยวข้อง | คอลัมน์คีย์ที่ใช้เชื่อมและหน้าที่ |
|---|---|---|---|
| **1. รายการตัดบิล / วางบิล (Bills Grid)** (`docs.go:526-685`) | `ap_ar_trans` | `19` (จ่ายชำระหนี้ AP), `213` (รับวางบิล AP), `235` (วางบิล AR), `239` (รับชำระหนี้ AR) | `billing_no` + `bill_type` ชี้ไปที่ `doc_no` + `trans_flag` ของบิลตั้งหนี้ใน `ic_trans` (หรือ `as_trans` flag `1802`) เพื่อคำนวณยอดตั้งหนี้ `sum_debt_amount`, คงเหลือ `balance_ref`, ยอดชำระ `sum_pay_money` และส่วนต่าง FX |
| **2. บรรทัดข้อความ+จำนวนเงินของเอกสารเงินล่วงหน้า/มัดจำ** (`trans.go:218-221, 943-953`) | **`ic_trans`** *(ไม่ใช่ `ap_ar_trans`!)* | `9010, 10, 20` (จ่ายล่วงหน้า AP), `9011, 11, 25` (จ่ายมัดจำ AP), `9040, 40, 42` (รับล่วงหน้า AR), `9110, 110, 112` (รับมัดจำ AR) | เก็บคำอธิบายรายการใน `remark` และจำนวนเงินใน `sum_debt_amount` (`line_number` เรียงลำดับ) |
| **3. ตัวเชื่อมบิลค่าใช้จ่ายกับ PO และตัวมาร์กใบตรวจนับ Lot** (`doc_flow.go:71,96`, `sysproc_ic_checks_data.go:92`, `stock_lot.go:158-160`) | **`ic_trans`** *(ไม่ใช่ `ap_ar_trans`!)* | - ค่าใช้จ่ายอ้าง PO: `87, 260` (และ `status = 0`)<br>- มาร์กตรวจนับ/ปรับปรุง Lot: `66, 68` | - Flag `87`/`260`: `billing_no` ชี้ `doc_no` ของใบสั่งซื้อ (PO) เพื่อบันทึกต้นทุนค่าใช้จ่ายเข้า PO<br>- Flag `66`/`68`: `billing_no` ชี้ `doc_no` ของเอกสารตรวจนับใน `ic_trans` เพื่อทำเครื่องหมายรายการที่ปรับสต็อกแล้ว |

> [!WARNING]
> **ข้อผิดพลาดที่พบบ่อย**: ห้ามเขียน Query สมมติว่า `ap_ar_trans_detail.doc_no` ต้องมีแถวแม่ใน `ap_ar_trans` เสมอ! สำหรับ `trans_flag` กลุ่มเงินล่วงหน้า/มัดจำ (`10, 11, 20, 25, 40, 42, 110, 112, 9010..9110`) หัวเอกสารอยู่ที่ `ic_trans`

### คอลัมน์สำคัญใน `ap_ar_trans_detail` (`02_data_schema.sql:548-601`)

| คอลัมน์ | ชนิดข้อมูล | ความหมายในการใช้งานจริง |
|---|---|---|
| `trans_type`, `trans_flag`, `doc_no`, `doc_date`, `doc_group`, `line_number` | `smallint` / `varchar(25)` / `date` | ชนิด (`1=AP`, `2=AR`), รหัสเอกสาร, เลขที่/วันที่เอกสาร, ลำดับบรรทัด |
| `cust_code` | `varchar(25)` | รหัสลูกค้า/เจ้าหนี้ |
| `billing_no`, `billing_date`, `bill_type`, `due_date`, `bill_tax_no`, `bill_tax_date` | `varchar` / `date` / `smallint` | เลขที่บิลอ้างอิง วันที่บิล `trans_flag` ของบิลต้นทาง (`bill_type`) วันครบกำหนด และเลขใบกำกับภาษี |
| `ref_doc_no`, `ref_doc_date`, `doc_ref` | `varchar(255)` / `date` | เลขที่/วันที่เอกสารอ้างอิงเพิ่มเติม |
| `sum_debt_value`, `sum_tax_value`, `sum_debt_amount`, `sum_discount`, `sum_after_discount`, `sum_before_vat`, `sum_value`, `vat_rate`, `final_amount` | `numeric DEFAULT 0.0` | ยอดเต็มของบิลตั้งต้น (ในบทบาทมัดจำ ใช้ `sum_debt_amount` เก็บจำนวนเงินต่อบรรทัด) |
| `balance_ref`, `sum_pay_money`, `sum_debt_balance` | `numeric DEFAULT 0.0` | ยอดค้างก่อนตัด (`balance_ref`), ยอดจ่าย/รับตัดบิลในเอกสารนี้ (`sum_pay_money`), ยอดคงเหลือ |
| `sum_pay_money_cash`, `sum_pay_money_chq`, `sum_pay_money_credit`, `sum_pay_money_transfer` | `numeric DEFAULT 0.0` | ส่วนแยกการชำระรายบรรทัด |
| `currency_code`, `exchange_rate`, `exchange_rate_old`, `sum_debt_amount_2`, `balance_ref_2`, `sum_pay_money_2`, `lost_profit_exchange_amount` | `varchar` / `numeric` | ยอดบิลสกุลเงินต่างประเทศ (`_2`), อัตราแลกเปลี่ยนเดิม/ใหม่ และกำไรขาดทุนจากอัตราแลกเปลี่ยน (`docs.go:574-580`) |
| `status`, `last_status`, `calc_flag` | `smallint DEFAULT 0` | `last_status = 1` = ยกเลิก; `status = 0` ใช้กรองใน PO expense link (`87`/`260`) |
| `remark`, `sale_shift_id`, `creator_code`, `last_editor_code`, `create_datetime`, `lastedit_datetime` | `varchar` / `timestamp` | คำอธิบายรายการ (ในบทบาทมัดจำเก็บชื่อรายการที่แสดงบนบิล), กะ POS และประวัติแก้ไข |

---

## 2. ตารางข้างเคียง: `ap_ar_trans_detail_draft`, `ap_ar_resource`, `ap_ar_transport_label`

| ตาราง (`02_data_schema.sql`) | คีย์ / Index | โครงสร้างและการใช้งาน |
|---|---|---|
| `ap_ar_trans_detail_draft` (`:606-611`) | คอลัมน์ระบบ 4 ตัว | ตารางร่าง (Draft) สำรองสำหรับบรรทัดเอกสารลูกหนี้/เจ้าหนี้ (ปัจจุบันโครงสร้างสคีมามีเฉพาะคอลัมน์ระบบพื้นฐาน) |
| `ap_ar_resource` (`:454-459`) | คอลัมน์ระบบ 4 ตัว | ตาราง Resource เสริมฝั่ง AR/AP (สคีมาฐานมีเฉพาะคอลัมน์ระบบพื้นฐาน) |
| `ap_ar_transport_label` (`:613-660`) | `idx_ap_ar_transport_label_cust_code` (`cust_code`) | ป้ายที่อยู่จัดส่ง/ผู้ส่งและผู้รับของคู่ค้า (`ar_ap_type`: `0/1` = ลูกหนี้, `2` = เจ้าหนี้ ตามการใช้งานแยกฝั่ง): มีชื่อ/ที่อยู่ผู้รับ (`cust_code`, `ship_code`, `name_1`, `address`, `home_address`, `moo`, `soi`, `road`, `tambon`, `amper`, `province`, `zip_code`, `telephone`, `mobile1`, `mobile2`, `transport_type`, `receive_day`, `time_period`, `logistic_area`, `latitude`, `longitude`, `branch_type`, `branch_code`, `tax_id`, `status`) และ **คอลัมน์ผู้ส่งที่เพิ่มตอน Runtime (`service.go:844-855`, `pool.go:37-48`)**: `send_name_1`, `send_address`, `send_country`, `send_province`, `send_amper`, `send_tambon`, `send_zip_code`, `send_telephone`, `send_fax`, `send_email`, `send_id_date`, `transport_code` |

---

## 3. รูปแบบการ JOIN และตัวอย่าง SQL Query จริง

### 3.1 คำนวณยอดรับชำระแล้วของบิลขาย/ซื้อ (ตามหลัก `billPaidSQL` ใน `docs.go:620-625`)

```sql
SELECT h.doc_no,
       h.doc_date,
       h.trans_flag,
       h.cust_code,
       h.total_amount,
       COALESCE(paid.paid_amount, 0) AS paid_amount,
       h.total_amount - COALESCE(paid.paid_amount, 0) AS outstanding_amount
FROM ic_trans h
LEFT JOIN LATERAL (
  SELECT SUM(
           COALESCE(p.sum_pay_money, 0)
           + CASE
               WHEN h.trans_flag IN (12, 44, 1802)
               THEN COALESCE(p.lost_profit_exchange_amount, 0)
               ELSE 0
             END
         ) AS paid_amount
  FROM ap_ar_trans_detail p
  WHERE COALESCE(p.last_status, 0) = 0
    AND p.trans_flag = 239
    AND p.billing_no = h.doc_no
    AND p.bill_type = h.trans_flag
) paid ON true
WHERE COALESCE(h.last_status, 0) = 0
  AND h.trans_flag IN (44, 46, 48, 250)
  AND h.inquiry_type IN (0, 2)
  AND h.total_amount - COALESCE(paid.paid_amount, 0) > 0;
```

### 3.2 ดึงรายการรายละเอียดเงินมัดจำ/ล่วงหน้าจาก `ic_trans` (บทบาทที่ 2)

```sql
SELECT h.doc_no,
       h.doc_date,
       h.trans_flag,
       h.cust_code,
       d.line_number,
       d.remark AS deposit_line_desc,
       d.sum_debt_amount AS line_amount
FROM ic_trans h
JOIN ap_ar_trans_detail d
  ON d.doc_no = h.doc_no
 AND d.trans_flag = h.trans_flag
WHERE COALESCE(h.last_status, 0) = 0
  AND COALESCE(d.last_status, 0) = 0
  AND h.trans_flag IN (10, 11, 20, 25, 40, 42, 110, 112, 9010, 9011, 9040, 9110)
ORDER BY h.doc_date DESC, h.doc_no, d.line_number;
```
