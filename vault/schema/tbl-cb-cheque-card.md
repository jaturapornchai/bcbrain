---
title: ทะเบียนเช็ค บัตรเครดิต เงินสดย่อย และกระเป๋าเงิน (cb_chq_list, cb_credit_card, cb_petty_cash, banknotes, wallet_payments, temp_cash_movement)
tags:
  - schema
  - cb
  - cheque
  - petty-cash
  - wallet
aliases:
  - cb_chq_list
  - cb_credit_card
  - cb_petty_cash
  - banknotes
  - wallet_payments
  - temp_cash_movement
sources:
  - scripts/sql/02_data_schema.sql:2006
  - scripts/sql/02_data_schema.sql:2058
  - scripts/sql/02_data_schema.sql:2095
  - scripts/sql/02_data_schema.sql:2130
  - scripts/sql/02_data_schema.sql:9238
  - scripts/sql/02_data_schema.sql:9299
  - backend/internal/application/process/cheque.go:19-68
  - backend/internal/application/process/cheque.go:274-301
  - backend/internal/application/process/trans.go:799-816
  - backend/internal/application/process/trans.go:1544
  - backend/internal/application/process/report_menu_cb.go:152
  - backend/internal/application/process/report_menu_cb.go:689
---

# ทะเบียนเช็ค บัตรเครดิต เงินสดย่อย และกระเป๋าเงิน

กลุ่มตารางย่อยของโมดูล Cash & Bank ที่จัดเก็บทะเบียนติดตามสถานะตราสารทางการเงิน (เช็ค, บัตรเครดิต, Wallet), วงเงินสดย่อย (`cb_petty_cash`), ธนบัตร (`banknotes`), ประวัติการชำระผ่าน Wallet/QR (`wallet_payments`) และตารางพักคำนวณกระแสเงินสด (`temp_cash_movement`)

> [!NOTE] ไม่มีตารางชื่อ `cb_cheque`
> ทะเบียนเช็คทั้งหมด (ทั้งเช็ครับ, เช็คจ่าย, บัตรเครดิต และรายการ Wallet ที่รอเคลียริ่ง) เก็บอยู่ในตาราง **`cb_chq_list`** เพียงตารางเดียว โดยใช้คอลัมน์ `chq_type` จำแนกชนิด

---

## 1. `cb_chq_list` — ทะเบียนคุมเช็ครับ เช็คจ่าย บัตรเครดิต และ Wallet

- **วัตถุประสงค์**: เก็บสถานะวงจรชีวิตของเช็ค บัตรเครดิต และรายการ Wallet ตั้งแต่วันที่รับ/ออก จนถึงการนำฝาก เคลียร์ผ่าน คืน หรือยกเลิก
- **Primary / Unique Key**: ไม่มี `PRIMARY KEY` ใน DDL (`roworder serial NOT NULL`); แนะนำจับคู่เอกสารต้นทางด้วย `(doc_ref, trans_flag, doc_line_number)` และทะเบียนเช็คด้วย `chq_number`

### คอลัมน์สำคัญ

| คอลัมน์ | ชนิดข้อมูล (SQL) | ค่าเริ่มต้น | ความหมายและค่า Flag |
| :--- | :--- | :--- | :--- |
| `chq_type` | `smallint` | `0` | ประเภทตราสาร:<br>• `1` = เช็ครับ (Receive Cheque)<br>• `2` = เช็คจ่าย (Pay Cheque)<br>• `3` = บัตรเครดิต (Credit Card)<br>• `21` = Wallet / PromptPay |
| `chq_number` | `varchar(25)` | `''` | เลขที่เช็ค / เลขที่บัตร / เลขที่รายการ |
| `chq_get_date` | `date` | `NULL` | วันที่รับเช็ค หรือวันที่ออกเช็ค |
| `chq_due_date` | `date` | `NULL` | วันที่หน้าเช็ค / วันครบกำหนด |
| `chq_description` | `varchar(255)` | `''` | รายละเอียดหน้าเช็ค |
| `doc_ref` | `varchar(25)` | `''` | เลขที่เอกสารการเงินต้นทาง (`cb_trans_detail.doc_no`) |
| `doc_line_number` | `smallint` | `0` | ลำดับบรรทัดในเอกสารต้นทาง (`cb_trans_detail.line_number`) |
| `trans_type` | `smallint` | `0` | ประเภทธุรกรรมต้นทาง |
| `trans_flag` | `smallint` | `0` | รหัสประเภทเอกสารต้นทาง |
| `book_code` | `varchar(25)` | `''` | รหัสสมุดรายวัน |
| `pass_book_code` | `varchar(25)` | `''` | รหัสสมุดบัญชีธนาคาร (เชื่อม `erp_pass_book.code` ใน [[schema-overview]]) |
| `bank_code` | `varchar(25)` | `''` | รหัสธนาคารหน้าเช็ค |
| `bank_branch` | `varchar(100)` | `''` | สาขาธนาคาร |
| `bank_description` | `varchar(255)` | `''` | ชื่อ/คำอธิบายธนาคาร |
| `amount` | `numeric` | `0.0` | มูลค่าหน้าเช็ค/บัตร |
| `charge` | `numeric` | `0.0` | ค่าธรรมเนียม/ค่าชาร์จ |
| `sum_amount` | `numeric` | `0.0` | ยอดสุทธิ |
| `currency_code` | `varchar(25)` | `''` | รหัสสกุลเงิน |
| `ap_ar_type` | `smallint` | `0` | `1` = ลูกหนี้ (AR), `2` = เจ้าหนี้ (AP) |
| `ap_ar_code` | `varchar(25)` | `''` | รหัสลูกค้า/ผู้ขาย |
| `owner_name` | `varchar(100)` | `''` | ชื่อเจ้าของเช็ค/บัตร |
| `credit_card_type` | `varchar(25)` | `''` | ประเภทบัตร (กรณี `chq_type = 3`) |
| `no_approved` | `varchar(25)` | `''` | รหัสอนุมัติ |
| `person_code` | `varchar(25)` | `''` | รหัสพนักงานผู้บันทึก |
| `side_code` | `varchar(25)` | `''` | รหัสฝ่าย |
| `department_code` | `varchar(25)` | `''` | รหัสแผนก |
| `external_chq` | `smallint` | `0` | เช็คภายนอก (`1` = ใช่) |
| `status` | `smallint` | `0` | สถานะล่าสุดของเช็ค/บัตร (อัปเดตตาม `ic_trans_detail.trans_flag` และสถานะเอกสารแม่ใน `cheque.go`):<br>• `0` = เช็คในมือ (ยังไม่เคลียร์)<br>• `1` = เช็คนำฝาก (`410`) / บัตรผ่าน (`461`) / Wallet ผ่าน (`463`)<br>• `2` = เช็คผ่าน (`411`, `451`) / ยกเลิกบัตร (`462`)<br>• `3` = เช็ครับคืน/เช็คจ่ายคืน (`412`, `453`)<br>• `4` = เช็คยกเลิก (`413`, `452`)<br>• `5` = เช็คขายลด<br>• `6` = เช็คคืนนำเข้าใหม่ (`414`) **หรือ** เอกสารต้นทางใน `ic_trans` / `ap_ar_trans` ถูกยกเลิก (`last_status = 1`)<br>• `7` = เช็คเปลี่ยน (`416`, `456`)<br>• `8` = เช็คตั้งหนี้ใหม่ (`418`) |
| `remark` | `varchar(255)` | `''` | หมายเหตุ |
| `guid_code` | `varchar(35)` | `''` | รหัสอ้างอิงเฉพาะรายการ |

- **Indexes**: ไม่มี Index เฉพาะใน DDL (`02_data_schema.sql`) — เมื่อค้นหาตาม `chq_number` หรือ `doc_ref` ควรกรองช่วง `chq_due_date` หรือ `chq_get_date`

---

## 2. `cb_credit_card` — ทะเบียนบัตรเครดิต

- **วัตถุประสงค์**: เก็บข้อมูลบัตรเครดิต/รายการตัดบัตร (รองรับทั้งข้อมูลบัตรของลูกหนี้และยอดรูดบัตรรอตัดบัญชี)
- **Primary / Unique Key**: ไม่มี `PRIMARY KEY` (`roworder serial NOT NULL`)
- **Indexes**: `idx_cb_credit_card_ar_code` ON `cb_credit_card` (`ar_code`)

### คอลัมน์สำคัญ

| คอลัมน์ | ชนิดข้อมูล (SQL) | ความหมาย |
| :--- | :--- | :--- |
| `trans_type`, `trans_flag` | `smallint` | ประเภทธุรกรรมและรหัสเอกสาร |
| `credit_get_date` | `date` | วันที่รับ/รูดบัตร |
| `credit_card_type` | `varchar(25)` | ประเภทบัตร (เช่น VISA, MASTER) |
| `credit_card_no` | `varchar(25)` | เลขที่บัตรเครดิต (Masked/Code) |
| `credit_card_code` | `varchar(25)` | รหัสเครื่อง/บัญชีบัตรเครดิต |
| `owner_name` | `varchar(100)` | ชื่อผู้ถือบัตร |
| `credit_money` | `numeric` | วงเงินบัตร |
| `credit_card_expire` | `date` | วันหมดอายุบัตร |
| `credit_due_date` | `date` | วันครบกำหนดเคลียร์เงิน |
| `date_cut` | `date` | วันที่ตัดยอดเข้าบัญชีธนาคาร |
| `doc_ref`, `book_code` | `varchar(25)` | เลขที่เอกสารอ้างอิง และรหัสเล่ม |
| `pass_book_code`, `bank_code` | `varchar(25)` | สมุดบัญชีธนาคารและรหัสธนาคารรับเงิน |
| `ar_code` | `varchar(25)` | รหัสลูกค้า/เจ้าของบัญชี |
| `amount`, `charge`, `sum_amount` | `numeric` | ยอดเงิน, ค่าชาร์จ, ยอดสุทธิ |
| `no_approved` | `varchar(255)` | เลขที่อนุมัติสลิป |
| `status` | `smallint` | สถานะ (`0` = ปกติ) |

---

## 3. `cb_petty_cash` — ทะเบียนวงเงินสดย่อย

- **วัตถุประสงค์**: กำหนดวงเงินสดย่อย ยอดยกมา (`balance_money`) และผูกผังบัญชีเงินสดย่อย (`chart_of_account`) เพื่อใช้คำนวณการเบิกชดเชยและคงเหลือ
- **Primary / Unique Key**: ไม่มี `PRIMARY KEY` (`roworder serial NOT NULL`), ใช้ `code` เป็นรหัสหลัก
- **Indexes**: `idx_cb_petty_cash_code` ON `cb_petty_cash` (`code`)

### คอลัมน์สำคัญ

| คอลัมน์ | ชนิดข้อมูล (SQL) | ความหมาย |
| :--- | :--- | :--- |
| `code` | `varchar(25)` | รหัสวงเงินสดย่อย (เชื่อมกับ `cb_trans_detail.trans_number` เมื่อ `doc_type = 4`) |
| `name_1`, `name_2` | `varchar(100)` / `varchar(200)` | ชื่อวงเงินสดย่อย (ไทย / อังกฤษ) |
| `credit_money` | `numeric` | วงเงินอนุมัติสูงสุด |
| `balance_money` | `numeric` | ยอดยกมาตั้งต้น (Opening Balance ใช้ตั้งต้นในรายงานเงินสดย่อย `cbmPettyCTE`) |
| `chart_of_account` | `varchar(25)` | รหัสผังบัญชีที่ผูกไว้ (เชื่อม [[tbl-gl-chart-of-account]] `code`) |
| `currency_code` | `varchar(25)` | รหัสสกุลเงิน |
| `status` | `smallint` | สถานะ (`0` = ใช้งาน) |

---

## 4. `banknotes` — มาสเตอร์ชนิดธนบัตรและเหรียญ

- **วัตถุประสงค์**: เก็บหน้าตั๋วธนบัตร/เหรียญและมูลค่าต่อหน่วย สำหรับตรวจนับเงินสดปิดกะ POS หรือเตรียมเงินทอน
- **Indexes**: `idx_banknotes_code` ON `banknotes` (`code`)
- **คอลัมน์สำคัญ**: `code` (`varchar(25)`), `value` (`numeric`), `currency` (`varchar(255)`), `name_1` (`varchar(255)`), `name_2` (`varchar(200)`), `status` (`smallint`)

---

## 5. `wallet_payments` — รายการชำระผ่าน QR / e-Wallet

- **วัตถุประสงค์**: บันทึกคำขอและผลการยืนยันรายการชำระเงินผ่าน PromptPay / e-Wallet จากเครื่อง POS
- **Primary / Unique Key**: ไม่มี `PRIMARY KEY` ใน DDL (`roworder serial NOT NULL`)

### คอลัมน์สำคัญ

| คอลัมน์ | ชนิดข้อมูล (SQL) | ความหมาย |
| :--- | :--- | :--- |
| `wallet_code` | `varchar(25)` | รหัสผู้ให้บริการ/ช่องทาง Wallet |
| `qr_code` | `varchar(255)` | ข้อมูล QR Payload |
| `ref1`, `ref2` | `varchar(50)` | เลขอ้างอิงการชำระเงิน Ref1 / Ref2 |
| `approve_status` | `smallint` | สถานะการอนุมัติ (`0` = รอ, `1` = อนุมัติแล้ว) |
| `approve_code` | `varchar(100)` | รหัสอนุมัติจากผู้ให้บริการ |
| `approve_date`, `create_date` | `timestamp` | วันเวลาที่อนุมัติ และวันเวลาที่สร้างรายการ |
| `pos_id`, `computer_name`, `user_code` | `varchar(50)` | รหัสเครื่อง POS, ชื่อเครื่อง, รหัสผู้ทำรายการ |
| `amount` | `numeric` | จำนวนเงินที่ชำระ |
| `transection_id` | `varchar(255)` | Transaction ID จากฝั่งผู้ให้บริการ *(ชื่อคอลัมน์สะกด `transection_id`)* |

---

## 6. `temp_cash_movement` — ตารางพักรายงานความเคลื่อนไหวเงินสด

- **วัตถุประสงค์**: ตารางชั่วคราวสำหรับพักผลลัพธ์รายงานเคลื่อนไหวเงินสดรับเข้า-จ่ายออก (`amount_in`, `amount_out`, `amount_balance`)
- **Indexes**: `idx_temp_cash_movement_doc_no_trans_flag`, `idx_temp_cash_movement_doc_date_trans_flag`
- **คอลัมน์สำคัญ**: `doc_date` (`timestamp`), `doc_time` (`varchar(5)`), `doc_no` (`varchar(50)`), `ap_ar_code` (`varchar(50)`), `trans_flag` (`smallint`), `trans_detail` (`varchar(255)`), `amount_in`, `amount_out`, `amount_balance` (`numeric`)

---

## 7. รูปแบบการ JOIN และตัวอย่าง SQL Query

- **เช็คกับสมุดบัญชีและคู่ค้า**: `cb_chq_list` JOIN `erp_pass_book` บน `pass_book_code = code` และเชื่อมกลับมาที่ [[tbl-cb-trans]] (`cb_trans_detail`) ด้วย `(doc_ref = doc_no AND trans_flag = trans_flag AND doc_line_number = line_number)`
- **ประวัติเคลื่อนไหวเช็ค**: เอกสารบริหารเช็ค (นำฝาก `410`, เช็คผ่าน `411`/`451`, เช็คคืน `412`/`453`) เก็บอยู่ใน `ic_trans_detail` (ดู [[schema-overview]]) โดยจับคู่ `ic_trans_detail.item_code = cb_chq_list.chq_number` และ `ic_trans_detail.doc_ref = cb_chq_list.doc_ref`
- **ยอดคงเหลือเงินสดย่อย (`cbmPettyCTE`)**: เอา `cb_petty_cash.balance_money` บวกเข้า/หักออกด้วยผลรวม `cb_trans_detail` (`doc_type = 4`) ที่เอกสารแม่ยังไม่ถูกยกเลิก

### ตัวอย่าง 1: เช็ครับ/เช็คจ่ายคงเหลือที่ยังไม่ขึ้นเงิน (เช็คในมือ + นำฝาก)
```sql
SELECT
    c.chq_type,
    CASE c.chq_type WHEN 1 THEN 'เช็ครับ' WHEN 2 THEN 'เช็คจ่าย' ELSE 'อื่นๆ' END AS chq_kind,
    c.chq_number,
    c.chq_get_date,
    c.chq_due_date,
    c.ap_ar_code,
    c.bank_code,
    c.pass_book_code,
    pb.name_1 AS pass_book_name,
    c.status,
    c.amount::NUMERIC(18,2) AS chq_amount,
    c.doc_ref
FROM cb_chq_list c
LEFT JOIN erp_pass_book pb ON pb.code = c.pass_book_code
WHERE c.chq_type IN (1, 2)
  AND c.status IN (0, 1)
  AND c.chq_due_date <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY c.chq_due_date, c.chq_number;
```

### ตัวอย่าง 2: คำนวณยอดคงเหลือวงเงินสดย่อยรายบัญชี
```sql
SELECT
    pc.code,
    pc.name_1,
    pc.chart_of_account,
    pc.credit_money::NUMERIC(18,2) AS limit_amount,
    pc.balance_money::NUMERIC(18,2) AS opening_balance,
    COALESCE(SUM(CASE WHEN cb.pay_type = 1 THEN d.sum_amount ELSE 0 END), 0)::NUMERIC(18,2) AS total_in,
    COALESCE(SUM(CASE WHEN cb.pay_type = 2 THEN d.sum_amount ELSE 0 END), 0)::NUMERIC(18,2) AS total_out,
    (pc.balance_money
      + COALESCE(SUM(CASE WHEN cb.pay_type = 1 THEN d.sum_amount ELSE -d.sum_amount END), 0)
    )::NUMERIC(18,2) AS current_balance
FROM cb_petty_cash pc
LEFT JOIN cb_trans_detail d
  ON d.doc_type = 4
 AND d.trans_number = pc.code
 AND COALESCE(d.last_status, 0) = 0
LEFT JOIN cb_trans cb
  ON cb.doc_no = d.doc_no
 AND cb.trans_flag = d.trans_flag
GROUP BY pc.code, pc.name_1, pc.chart_of_account, pc.credit_money, pc.balance_money
ORDER BY pc.code;
```
