---
title: ตารางการเงินรับ-จ่าย (cb_trans, cb_trans_detail, cb_trans_detail_draft, cb_resource)
tags:
  - schema
  - cb
  - cash-bank
  - payment
aliases:
  - cb_trans
  - cb_trans_detail
  - cb_trans_detail_draft
  - cb_resource
sources:
  - scripts/sql/02_data_schema.sql:2150
  - scripts/sql/02_data_schema.sql:2157
  - scripts/sql/02_data_schema.sql:2214
  - scripts/sql/02_data_schema.sql:2267
  - backend/internal/application/process/trans.go:1277
  - backend/internal/application/process/pay_other.go:24
  - backend/internal/application/process/report_menu_cb.go:154
  - backend/internal/application/process/report_menu_cb.go:620
---

# ตารางการเงินรับ-จ่าย (`cb_trans`, `cb_trans_detail`)

กลุ่มตารางบันทึกการรับเงินและการจ่ายเงินของทุกเอกสารในระบบ (เช่น ขายเงินสด/เชื่อ รับชำระหนี้ ซื้อเงินสด/เชื่อ จ่ายชำระหนี้ เงินมัดจำ เงินล่วงหน้า ค่าใช้จ่ายอื่น รายได้อื่น และการขายสินทรัพย์) โดยแยก **หัวตารางการชำระเงิน (`cb_trans`)** ออกเป็น 1 แถวต่อเอกสาร และแยก **รายละเอียดช่องทางชำระเงิน (`cb_trans_detail`)** เป็นหลายแถวตามประเภทการชำระ (โอนเข้าสมุดธนาคาร, เช็ค, บัตรเครดิต, เงินสดย่อย, PromptPay/QR/e-Wallet, ค่าใช้จ่ายอื่น/รายได้อื่น)

> [!IMPORTANT] ข้อควรระวังในการค้นหาและ JOIN
> - **ไม่มีตาราง `cb_bank_book` ในฐานข้อมูล** — ทะเบียนสมุดบัญชีธนาคารเก็บอยู่ในตารางกลาง `erp_pass_book` (ดูโครงสร้างได้จาก [[schema-overview]]) โดยเชื่อมผ่านคอลัมน์ `pass_book_code` (ฝั่ง `cb_trans_detail` / `cb_chq_list`) กับ `code` (ฝั่ง `erp_pass_book`)
> - **ชื่อคอลัมน์ `tranfer_amount` สะกดขาดตัว `s`** ใน `cb_trans` (`tranfer_amount` ไม่ใช่ `transfer_amount`)
> - **`cb_trans` ไม่มีคอลัมน์ `last_status`** (มีเฉพาะ `status`) การตรวจสอบว่าเอกสารถูกยกเลิกหรือไม่ ต้อง JOIN เช็ก `last_status = 0` ที่เอกสารต้นทาง (`ic_trans`, `ap_ar_trans` หรือ `as_trans`) ด้วย

---

## 1. `cb_trans` — หัวรายการรับ-จ่ายเงินประจำเอกสาร

- **วัตถุประสงค์**: เก็บยอดรวมแยกตามช่องทางชำระเงิน (เงินสด, เช็ค, เงินโอน, บัตรเครดิต, Wallet, เงินสดย่อย, มัดจำ/ล่วงหน้า, คูปอง/แต้ม, เงินทอน, ค่าธรรมเนียม, ภาษีหัก ณ ที่จ่ายตอนรับ/จ่าย) ต่อเอกสาร 1 ใบ
- **Primary / Unique Key**: ไม่มี `PRIMARY KEY` ที่ระดับ DDL (มี `roworder serial NOT NULL` และ `guid_code`) แนะนำอ้างอิงร่วมด้วย `(doc_no, trans_flag)`

### คอลัมน์สำคัญ

| คอลัมน์ | ชนิดข้อมูล (SQL) | ค่าเริ่มต้น | ความหมายและค่า Flag |
| :--- | :--- | :--- | :--- |
| `roworder` | `serial NOT NULL` | auto | ลำดับแถวภายในฐานข้อมูล |
| `trans_type` | `smallint` | `0` | ประเภทธุรกรรม (ตามโมดูลต้นทาง เช่น ขาย/ซื้อ/การเงิน) |
| `trans_flag` | `smallint` | `0` | รหัสประเภทเอกสาร (ดู [[doctypes-overview]]) เช่น `44`=ขายสด, `239`=รับชำระหนี้, `19`=จ่ายชำระหนี้, `1802`=ขายสินทรัพย์ |
| `doc_date` | `date` | `NULL` | วันที่เอกสาร (ค.ศ.) |
| `doc_time` | `varchar(5)` | `''` | เวลาเอกสาร (`HH:MM`) |
| `doc_no` | `varchar(25)` | `''` | เลขที่เอกสาร (เชื่อม 1:1 กับหัวเอกสารต้นทาง) |
| `doc_ref` | `varchar(25)` | `''` | เลขที่เอกสารอ้างอิง |
| `book_code` | `varchar(25)` | `''` | รหัสสมุดรายวัน/เล่มเอกสาร |
| `doc_format_code` | `varchar(25)` | `''` | รหัสรูปแบบเลขที่เอกสาร |
| `doc_group` | `varchar(25)` | `''` | กลุ่มเอกสาร |
| `ap_ar_code` | `varchar(25)` | `''` | รหัสลูกค้า/ผู้ขาย/คู่ค้า |
| `pay_type` | `smallint` | `0` | ทิศทางการเงิน: `1` = รับเงิน (`in`), `2` = จ่ายเงิน (`out`) |
| `currency_code` | `varchar(25)` | `''` | รหัสสกุลเงิน |
| `exchange_rate` | `numeric` | `0.0` | อัตราแลกเปลี่ยน |
| `total_amount` | `numeric` | `0.0` | ยอดรวมเอกสารที่นำมาชำระ |
| `total_fee_amount` | `numeric` | `0.0` | ค่าธรรมเนียมรวม |
| `total_other_amount` | `numeric` | `0.0` | ยอดอื่นๆ รวม |
| `total_tax_at_pay` | `numeric` | `0.0` | ภาษีถูกหัก/หัก ณ ที่จ่ายตอนรับ-จ่ายรวม |
| `total_net_amount` | `numeric` | `0.0` | ยอดเงินสุทธิหลังหักภาษี/ปรับค่าธรรมเนียม |
| `total_amount_pay` | `numeric` | `0.0` | ยอดเงินที่รับหรือจ่ายจริงรวมทุกช่องทาง |
| `total_income_amount` | `numeric` | `0.0` | ยอดเงินรับรวม |
| `cash_amount` | `numeric` | `0.0` | ยอดชำระด้วยเงินสด (สุทธิหลังทอน) |
| `pay_cash_amount` | `numeric` | `0.0` | ยอดเงินสดที่รับจากลูกค้าจริง (ก่อนหักเงินทอน — ใช้ใน flag `44`/`144`) |
| `money_change` | `numeric` | `0.0` | เงินทอน |
| `chq_amount` | `numeric` | `0.0` | ยอดชำระด้วยเช็ค |
| `tranfer_amount` | `numeric` | `0.0` | ยอดโอนเงินผ่านธนาคาร *(หมายเหตุ: ชื่อคอลัมน์สะกด `tranfer`)* |
| `card_amount` | `numeric` | `0.0` | ยอดชำระด้วยบัตรเครดิต |
| `wallet_amount` | `numeric` | `0.0` | ยอดชำระผ่าน PromptPay / QR / e-Wallet |
| `petty_cash_amount` | `numeric` | `0.0` | ยอดชำระผ่านเงินสดย่อย (`cb_petty_cash`) |
| `deposit_amount` | `numeric` | `0.0` | ยอดตัดมัดจำ |
| `advance_amount` | `numeric` | `0.0` | ยอดตัดเงินล่วงหน้า |
| `coupon_amount` | `numeric` | `0.0` | ยอดชำระด้วยคูปอง |
| `point_amount` | `numeric` | `0.0` | มูลค่าเงินจากการใช้แต้มสะสม |
| `point_qty` | `numeric` | `0.0` | จำนวนแต้มที่ใช้ |
| `point_rate` | `numeric` | `0.0` | อัตราแลกแต้ม |
| `total_credit_charge` | `numeric` | `0.0` | ค่าธรรมเนียมชาร์จบัตรเครดิต |
| `total_income_other` | `numeric` | `0.0` | ยอดรายได้อื่นเพิ่มเติมตอนรับชำระ |
| `total_expense_other` | `numeric` | `0.0` | ยอดค่าใช้จ่ายอื่นเพิ่มเติมตอนจ่ายชำระ |
| `discount_amount` | `numeric` | `0.0` | ส่วนลดท้ายบิลตอนชำระเงิน |
| `total_other_currency` | `numeric` | `0.0` | ยอดชำระสกุลเงินอื่น |
| `total_other_currency_charge` | `numeric` | `0.0` | ค่าธรรมเนียมสกุลเงินอื่น |
| `branch_code` | `varchar(25)` | `''` | รหัสสาขา |
| `cashier_code` | `varchar(25)` | `''` | รหัสแคชเชียร์ (POS) |
| `sale_shift_id` | `varchar(50)` | `''` | รหัสกะการขาย (POS Shift) |
| `is_doc_copy` | `smallint` | `0` | `1` = เอกสารสำเนา |
| `status` | `smallint` | `0` | สถานะ (`0` = ปกติ) |
| `description` | `varchar(255)` | `''` | คำอธิบายรายการ |
| `remark` | `varchar(255)` | `''` | หมายเหตุ |
| `guid_code` | `varchar(35)` | `''` | รหัสอ้างอิงเฉพาะรายการ |

### การกำหนดค่า `pay_type = 1` (รับเงิน) ใน Backend
ใน `backend/internal/application/process/trans.go` ระบบตั้งค่า `pay_type = 1` สำหรับ `trans_flag` กลุ่มรับเงิน ได้แก่ `16`, `20`, `25`, `40`, `44`, `46`, `99`, `110`, `239`, `250`, `254`, `262`, `300`, `317`, `402`, `416` และตั้ง `pay_type = 2` (จ่ายเงิน) สำหรับกลุ่มที่เหลือ (เช่น ซื้อสด `12`, จ่ายชำระหนี้ `19`)

### Indexes (`cb_trans`)
- `idx_cb_trans_doc_no_trans_flag` ON `cb_trans` (`doc_no`, `trans_flag`)
- `idx_cb_trans_doc_date_trans_flag` ON `cb_trans` (`doc_date`, `trans_flag`)

---

## 2. `cb_trans_detail` — รายละเอียดช่องทางชำระเงินและรายได้/ค่าใช้จ่ายอื่น

- **วัตถุประสงค์**: เก็บรายละเอียดแต่ละรายการย่อยของการรับ-จ่ายเงิน เช่น เงินโอนระบุ `pass_book_code`, เช็คระบุเลขเช็คและวันครบกำหนด, บัตรเครดิตระบุเลขอนุมัติและค่าชาร์จ, PromptPay ระบุ `ref1`/`ref2`, เงินสดย่อยระบุรหัสวงเงิน, หรือรายการค่าใช้จ่ายอื่น/รายได้อื่นที่แนบมากับเอกสาร
- **Primary / Unique Key**: ไม่มี `PRIMARY KEY` ใน DDL (ใช้ `roworder serial NOT NULL`; อ้างอิงกลุ่มแถวด้วย `(doc_no, trans_flag, line_number)`)

### คอลัมน์สำคัญ

| คอลัมน์ | ชนิดข้อมูล (SQL) | ค่าเริ่มต้น | ความหมายและค่า Flag |
| :--- | :--- | :--- | :--- |
| `roworder` | `serial NOT NULL` | auto | ลำดับแถว |
| `trans_type` | `smallint` | `0` | ประเภทธุรกรรม |
| `trans_flag` | `smallint` | `0` | รหัสประเภทเอกสาร (ต้องตรงกับหัวเอกสาร `cb_trans`) |
| `doc_date` | `date` | `NULL` | วันที่เอกสาร |
| `doc_time` | `varchar(5)` | `''` | เวลาเอกสาร |
| `doc_no` | `varchar(25)` | `''` | เลขที่เอกสาร |
| `doc_ref` | `varchar(25)` | `''` | เลขที่อ้างอิงเอกสาร |
| `doc_date_ref` | `date` | `NULL` | วันที่อ้างอิงเอกสาร |
| `doc_group` | `varchar(25)` | `''` | กลุ่มเอกสาร |
| `line_number` | `smallint` | `0` | ลำดับบรรทัดในเอกสาร (ใช้จับคู่กับ `cb_chq_list.doc_line_number`) |
| `doc_type` | `smallint` | `0` | ชนิดช่องทางชำระเงิน:<br>• `1` = เงินโอน / สมุดบัญชีธนาคาร<br>• `2` = เช็ค<br>• `3` = บัตรเครดิต<br>• `4` = เงินสดย่อย (`cb_petty_cash`)<br>• `11` = ค่าใช้จ่ายอื่น (Pay Other Expense)<br>• `12` = รายได้อื่น (Pay Other Income)<br>• `21` = PromptPay / QR / e-Wallet |
| `trans_number` | `varchar(100)` | `''` | เลขที่อ้างอิงหลักตาม `doc_type`:<br>• `doc_type = 1`: เลขที่บัญชี/สลิปโอน<br>• `doc_type = 2`: เลขที่เช็ค (`chq_number`)<br>• `doc_type = 3`: เลขที่บัตรเครดิต (`card_no`)<br>• `doc_type = 4`: รหัสวงเงินสดย่อย (`petty_cash_code` → `cb_petty_cash.code`)<br>• `doc_type IN (11,12)`: รหัสค่าใช้จ่ายอื่น/รายได้อื่น<br>• `doc_type = 21`: รหัส/เลขที่รายการ PromptPay/Wallet |
| `trans_number_type` | `smallint` | `0` | ใช้กับเช็ค (`doc_type = 2`): `1` = เช็ครับ, `2` = เช็คจ่าย |
| `chq_ref` | `varchar(25)` | `''` | เลขอ้างอิงเช็ค |
| `chq_date` | `date` | `NULL` | วันที่หน้าเช็ค/วันที่รับ-ออกเช็ค |
| `chq_due_date` | `date` | `NULL` | วันครบกำหนดขึ้นเงินเช็ค / วันที่เคลียร์บัตร |
| `chq_on_hand` | `smallint` | `0` | `1` = เช็คในมือ (ยังไม่นำฝาก) |
| `external_chq` | `smallint` | `0` | สถานะเช็คภายนอก (`1` = เช็คภายนอก) |
| `pass_book_code` | `varchar(25)` | `''` | รหัสสมุดบัญชีธนาคาร (เชื่อม `erp_pass_book.code`) |
| `bank_code` | `varchar(25)` | `''` | รหัสธนาคาร (เชื่อม `erp_bank` ใน [[schema-overview]]) |
| `bank_branch` | `varchar(100)` | `''` | ชื่อสาขาธนาคาร |
| `no_approved` | `varchar(25)` | `''` | เลขที่อนุมัติ (บัตรเครดิต/Wallet) |
| `approve_code` | `varchar(100)` | `''` | รหัสอนุมัติ |
| `approve_date` | `date` | `NULL` | วันที่อนุมัติ |
| `credit_card_type` | `varchar(25)` | `''` | ประเภทบัตรเครดิต |
| `charge` | `numeric` | `0.0` | ค่าชาร์จบัตรเครดิต |
| `amount` | `numeric` | `0.0` | จำนวนเงินต้นของรายการ |
| `fee_amount` | `numeric` | `0.0` | ค่าธรรมเนียมธนาคาร |
| `other_amount` | `numeric` | `0.0` | ยอดอื่นๆ |
| `tax_at_pay` | `numeric` | `0.0` | ภาษีหัก ณ ที่จ่ายของรายการนี้ |
| `sum_amount` | `numeric` | `0.0` | ยอดสุทธิของแถว |
| `sum_amount_2` | `numeric` | `0.0` | ยอดสุทธิสำรอง (กรณีสกุลเงิน/ภาษีอื่น) |
| `balance_amount` | `numeric` | `0.0` | ยอดคงเหลือ |
| `exchange_rate` | `numeric` | `0.0` | อัตราแลกเปลี่ยน |
| `currency_code` | `varchar(25)` | `''` | รหัสสกุลเงิน |
| `period_number` | `smallint` | `0` | งวดที่ |
| `ap_ar_type` | `smallint` | `0` | ประเภทคู่ค้า: `1` = ลูกหนี้ (AR), `2` = เจ้าหนี้ (AP) |
| `ap_ar_code` | `varchar(25)` | `''` | รหัสคู่ค้า |
| `sale_shift_id` | `varchar(50)` | `''` | รหัสกะการขาย POS |
| `ref1` | `varchar(50)` | `''` | เลขอ้างอิง 1 (เช่น PromptPay Ref1) |
| `ref2` | `varchar(50)` | `''` | เลขอ้างอิง 2 (เช่น PromptPay Ref2) |
| `is_doc_copy` | `smallint` | `0` | `1` = สำเนา |
| `status` | `smallint` | `0` | สถานะแถว (`0` = ปกติ) |
| `last_status` | `smallint` | `0` | สถานะยกเลิก (`0` = ใช้งานปกติ, `1` = ยกเลิก) |
| `remark` | `varchar(255)` | `''` | หมายเหตุ |

### Indexes (`cb_trans_detail`)
- `idx_cb_trans_detail_doc_no_trans_flag` ON `cb_trans_detail` (`doc_no`, `trans_flag`)
- `idx_cb_trans_detail_doc_date_trans_flag` ON `cb_trans_detail` (`doc_date`, `trans_flag`)

---

## 3. ตารางโครงสร้างพื้นฐานเสริมในกลุ่มนี้

### `cb_trans_detail_draft`
- **วัตถุประสงค์**: ตารางสำรอง/ร่างรายละเอียดการรับ-จ่ายเงิน ปัจจุบันใน `02_data_schema.sql` มีเฉพาะคอลัมน์ระบบ (`ignore_sync`, `is_lock_record`, `roworder`, `create_date_time_now`)

### `cb_resource`
- **วัตถุประสงค์**: ตาราง placeholder ทรัพยากรโมดูล Cash/Bank ปัจจุบันมีเฉพาะคอลัมน์ระบบ (`ignore_sync`, `is_lock_record`, `roworder`, `create_date_time_now`)

---

## 4. รูปแบบการ JOIN ที่ใช้จริง

1. **หัว-ท้ายการเงิน**: `cb_trans` 1 : N `cb_trans_detail` เชื่อมด้วย `(doc_no, trans_flag)`
2. **ตรวจสถานะยกเลิกเอกสารต้นทาง (`cbmParentOK`)**:
   - เมื่อ `trans_flag IN (19, 239)` (จ่าย/รับชำระหนี้) → `EXISTS` / `LEFT JOIN ap_ar_trans p ON p.doc_no = cb.doc_no AND p.trans_flag = cb.trans_flag AND COALESCE(p.last_status, 0) = 0`
   - เมื่อ `trans_flag = 1802` (ขายสินทรัพย์) → เช็ก `as_trans` ([[tbl-fa-trans]]) ด้วย `COALESCE(last_status, 0) = 0`
   - `trans_flag` อื่นๆ (ขาย/ซื้อ/POS/ฝาก-ถอน) → เช็ก `ic_trans` ด้วย `COALESCE(last_status, 0) = 0`
3. **เชื่อมสมุดบัญชีธนาคาร (`erp_pass_book`)**:
   - `LEFT JOIN erp_pass_book pb ON pb.code = d.pass_book_code` (ใช้เมื่อ `d.doc_type = 1` เงินโอน หรือ `cb_chq_list.pass_book_code` สำหรับเช็ค/บัตรเครดิต/Wallet)
4. **เชื่อมวงเงินสดย่อย (`cb_petty_cash`)**:
   - เมื่อ `d.doc_type = 4` → `JOIN cb_petty_cash pc ON pc.code = d.trans_number` (ดู [[tbl-cb-cheque-card]])
5. **เชื่อมทะเบียนเช็ค/บัตร/Wallet (`cb_chq_list`)**:
   - `cb_trans_detail` (`doc_type IN (2, 3, 21)`) เชื่อม `cb_chq_list` ด้วย `c.doc_ref = d.doc_no AND c.trans_flag = d.trans_flag AND c.doc_line_number = d.line_number` (ดู [[tbl-cb-cheque-card]])

---

## 5. ตัวอย่าง SQL Query

### ตัวอย่าง 1: สรุปยอดรับ-จ่ายแยกตามช่องทางชำระเงินรายวัน (กรองเอกสารยกเลิกแล้ว)
```sql
SELECT
    cb.doc_date,
    cb.pay_type,
    COUNT(*)::INT AS doc_count,
    COALESCE(SUM(cb.cash_amount), 0)::NUMERIC(18,2) AS cash_total,
    COALESCE(SUM(cb.tranfer_amount), 0)::NUMERIC(18,2) AS transfer_total,
    COALESCE(SUM(cb.chq_amount), 0)::NUMERIC(18,2) AS chq_total,
    COALESCE(SUM(cb.card_amount), 0)::NUMERIC(18,2) AS card_total,
    COALESCE(SUM(cb.wallet_amount), 0)::NUMERIC(18,2) AS wallet_total,
    COALESCE(SUM(cb.petty_cash_amount), 0)::NUMERIC(18,2) AS petty_cash_total,
    COALESCE(SUM(cb.total_amount_pay), 0)::NUMERIC(18,2) AS net_paid_total
FROM cb_trans cb
WHERE cb.doc_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31'
  AND COALESCE(cb.is_doc_copy, 0) = 0
  AND (
      (cb.trans_flag IN (19, 239) AND EXISTS (
          SELECT 1 FROM ap_ar_trans p
          WHERE p.doc_no = cb.doc_no AND p.trans_flag = cb.trans_flag AND COALESCE(p.last_status, 0) = 0
      ))
      OR (cb.trans_flag = 1802 AND EXISTS (
          SELECT 1 FROM as_trans a
          WHERE a.doc_no = cb.doc_no AND a.trans_flag = cb.trans_flag AND COALESCE(a.last_status, 0) = 0
      ))
      OR (cb.trans_flag NOT IN (19, 239, 1802) AND EXISTS (
          SELECT 1 FROM ic_trans ic
          WHERE ic.doc_no = cb.doc_no AND ic.trans_flag = cb.trans_flag AND COALESCE(ic.last_status, 0) = 0
      ))
  )
GROUP BY cb.doc_date, cb.pay_type
ORDER BY cb.doc_date, cb.pay_type;
```

### ตัวอย่าง 2: ความเคลื่อนไหวเงินโอนเข้า-ออกแยกตามสมุดบัญชีธนาคาร (`erp_pass_book`)
```sql
SELECT
    pb.code AS pass_book_code,
    pb.name_1 AS bank_account_name,
    pb.book_no,
    d.doc_date,
    d.doc_no,
    d.trans_flag,
    CASE WHEN cb.pay_type = 1 THEN d.sum_amount ELSE 0 END::NUMERIC(18,2) AS amount_in,
    CASE WHEN cb.pay_type = 2 THEN d.sum_amount ELSE 0 END::NUMERIC(18,2) AS amount_out,
    d.trans_number AS ref_no
FROM cb_trans_detail d
JOIN cb_trans cb
  ON cb.doc_no = d.doc_no
 AND cb.trans_flag = d.trans_flag
LEFT JOIN erp_pass_book pb
  ON pb.code = d.pass_book_code
WHERE d.doc_type = 1
  AND COALESCE(d.last_status, 0) = 0
  AND d.doc_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31'
ORDER BY pb.code, d.doc_date, d.doc_no, d.line_number;
```
