---
title: ตารางเช่าซื้อและลีสซิ่งสินทรัพย์ (fa_hire_purchase_contract, fa_hire_purchase_installment)
tags:
  - schema
  - fa
  - hire-purchase
  - leasing
aliases:
  - fa_hire_purchase_contract
  - fa_hire_purchase_installment
sources:
  - backend/internal/application/process/hire_purchase_leasing.go:20
  - backend/internal/application/process/hire_purchase_leasing.go:113
  - backend/internal/application/process/hire_purchase_leasing.go:150
  - backend/internal/application/process/hire_purchase_leasing.go:248
  - backend/internal/application/process/hire_purchase_leasing.go:815
---

# ตารางเช่าซื้อและลีสซิ่งสินทรัพย์ (`fa_hire_purchase_*`)

ตารางเฉพาะทางในโมดูลสินทรัพย์ถาวรที่สร้างอัตโนมัติใน Go Backend (`ensureHirePurchaseSchema`) สำหรับบริหารสัญญาเช่าซื้อและเช่าทางการเงิน (Hire Purchase / Leasing) พร้อมกฎภาษีไทยตามพระราชกฤษฎีกา ฉบับที่ 315 และมาตรา 82/5(6) แห่งประมวลรัษฎากร (จำกัดฐานมูลค่ารถยนต์นั่ง ≤ 10 ที่นั่งที่ 1,000,000 บาท หรือค่าเช่าเดือนละ ≤ 36,000 บาท และบวกกลับภาษีซื้อต้องห้ามเข้าเป็นราคาทุนสินทรัพย์)

---

## 1. `fa_hire_purchase_contract` — หัวสัญญาเช่าซื้อ/ลีสซิ่ง

- **วัตถุประสงค์**: เก็บเงื่อนไขสัญญา ต้นทุนทรัพย์สิน เงินดาวน์ ดอกเบี้ยรอตัดบัญชี เพดานภาษีซื้อและรายจ่ายบวกกลับตามมาตรา 65 ตรี รวมถึงผังบัญชีที่ใช้ Post ตั้งหนี้และตัดจ่ายงวด
- **Primary Key**: `contract_no` (`VARCHAR(50)`)
- **Indexes**: `idx_fa_hp_contract_date` ON `fa_hire_purchase_contract` (`contract_date DESC, contract_no DESC`)

### คอลัมน์สำคัญ

| คอลัมน์ | ชนิดข้อมูล (SQL) | ค่าเริ่มต้น | ความหมายและค่า Flag |
| :--- | :--- | :--- | :--- |
| `contract_no` | `VARCHAR(50) PRIMARY KEY` | - | เลขที่สัญญาเช่าซื้อ/ลีสซิ่ง |
| `asset_name` | `VARCHAR(200) NOT NULL` | `''` | ชื่อทรัพย์สินตามสัญญา |
| `vehicle_type` | `VARCHAR(35) NOT NULL` | `'PASSENGER_CAR_LE10'` | ประเภททรัพย์สินตามเกณฑ์ภาษี (`hire_purchase_leasing.go:36`):<br>• `'PASSENGER_CAR_LE10'` = รถยนต์นั่งไม่เกิน 10 ที่นั่ง (ภาษีซื้อต้องห้าม ม.82/5(6), เพดานทุน 1 ล้านบาท)<br>• `'COMMERCIAL_TRUCK_EQUIP'` = รถกระบะ/รถบรรทุก/เครื่องจักรเชิงพาณิชย์ (ภาษีซื้อขอคืนได้ ไม่ติดเพดาน 1 ล้าน)<br>• `'OPERATING_RENTAL'` = สัญญาเช่าดำเนินงาน/เช่าใช้ (เพดานค่าเช่า 36,000 บาท/เดือน สำหรับรถยนต์นั่ง) |
| `contract_date` | `DATE NOT NULL` | - | วันที่ทำสัญญา |
| `installment_months`, `paid_installments` | `INTEGER NOT NULL` | `1`, `0` | จำนวนงวดทั้งหมด และจำนวนงวดที่ชำระแล้ว |
| `cash_price_ex_vat`, `cash_price_vat`, `total_cost_inc_vat` | `NUMERIC(18,2) NOT NULL` | `0` | ราคาเงินสดก่อน VAT, VAT, ราคารวม VAT |
| `down_payment_ex_vat`, `financed_principal`, `total_interest` | `NUMERIC(18,2) NOT NULL` | `0` | เงินดาวน์ก่อน VAT, ยอดจัดไฟแนนซ์, ดอกเบี้ยเช่าซื้อรอตัดจ่ายรวม |
| `monthly_rent_inc_vat`, `total_contract_payable` | `NUMERIC(18,2) NOT NULL` | `0` | ค่างวดต่อเดือนรวม VAT และยอดหนี้รวมทั้งสัญญา |
| `claimable_vat`, `forbidden_vat_capitalized` | `NUMERIC(18,2) NOT NULL` | `0` | VAT ขอคืนได้ และ VAT ต้องห้ามที่นำไปรวมเป็นราคาทุนทรัพย์สิน |
| `tax_deductible_cost_cap`, `non_deductible_cost_excess` | `NUMERIC(18,2) NOT NULL` | `0` | ราคาทุนส่วนที่หักค่าเสื่อมทางภาษีได้ (เพดาน) และส่วนเกินเพดาน |
| `monthly_deductible_cap`, `monthly_add_back_65ter` | `NUMERIC(18,2) NOT NULL` | `0` | ค่าเช่าต่อเดือนที่หักภาษีได้ และส่วนต้องบวกกลับ ม.65 ตรี |
| `asset_account_code`, `hp_liability_account_code`, `deferred_interest_account_code`, `interest_expense_account_code`, `bank_account_code` | `VARCHAR(25) NOT NULL` | `''` | ผังบัญชีทรัพย์สิน, เจ้าหนี้เช่าซื้อ, ดอกเบี้ยเช่าซื้อรอตัดจ่าย, ดอกเบี้ยจ่าย, บัญชีธนาคารจ่ายเงิน (เชื่อม [[tbl-gl-chart-of-account]]) |
| `status` | `VARCHAR(25) NOT NULL` | `'ACTIVE'` | `'ACTIVE'` (ผ่อนชำระอยู่) หรือ `'COMPLETED'` (ชำระครบทุกงวดแล้ว) |

---

## 2. `fa_hire_purchase_installment` — ตารางค่างวดเช่าซื้อรายเดือน

- **วัตถุประสงค์**: เก็บตารางผ่อนชำระรายงวด แยกเงินต้น (`principal_amt`), ดอกเบี้ยตัดบัญชี (`interest_amt`), ฐานก่อน VAT, VAT, ยอดที่ต้องบวกกลับ 65 ตรี และอ้างอิงเอกสารสมุดรายวันที่ Post จ่ายค่างวด
- **Primary Key**: `(contract_no, installment_no)`

### คอลัมน์สำคัญ

| คอลัมน์ | ชนิดข้อมูล (SQL) | ค่าเริ่มต้น | ความหมายและค่า Flag |
| :--- | :--- | :--- | :--- |
| `contract_no`, `installment_no` | `VARCHAR(50)`, `INTEGER` | PK | เลขที่สัญญา และงวดที่ (`1..N`) |
| `due_date` | `DATE NOT NULL` | - | วันครบกำหนดชำระค่างวด |
| `principal_amt`, `interest_amt` | `NUMERIC(18,2) NOT NULL` | `0` | เงินต้น และดอกเบี้ยประจำงวด |
| `installment_ex_vat`, `vat_amt`, `payment_inc_vat` | `NUMERIC(18,2) NOT NULL` | `0` | ค่างวดก่อน VAT, VAT งวดนี้, ยอดจ่ายจริงรวม VAT |
| `claimable_vat_amt`, `forbidden_vat_amt` | `NUMERIC(18,2) NOT NULL` | `0` | VAT ขอคืนได้ และ VAT ต้องห้ามของงวดนี้ |
| `add_back_65ter_amt` | `NUMERIC(18,2) NOT NULL` | `0` | ส่วนต่างต้องห้ามบวกกลับ ภ.ง.ด.50 ประจำงวด |
| `remaining_balance` | `NUMERIC(18,2) NOT NULL` | `0` | หนี้สินเช่าซื้อคงเหลือหลังงวดนี้ |
| `status` | `VARCHAR(20) NOT NULL` | `'PENDING'` | `'PENDING'` (รอจ่าย) หรือ `'PAID'` (จ่ายและลงบัญชีแล้ว) |
| `gl_doc_no`, `paid_at` | `VARCHAR(50)`, `TIMESTAMPTZ` | `''`, `NULL` | เลขที่ใบสำคัญสมุดรายวัน (เชื่อม [[tbl-gl-journal]]) และเวลาที่บันทึกจ่าย |

---

## 3. รูปแบบการ JOIN และตัวอย่าง SQL Query

- **สัญญากับงวดผ่อนชำระ**: `fa_hire_purchase_contract c JOIN fa_hire_purchase_installment i ON i.contract_no = c.contract_no`
- **ตรวจเอกสารลงบัญชีงวด**: เชื่อม `i.gl_doc_no = j.doc_no` กับ [[tbl-gl-journal]]

### ตัวอย่าง: ตารางค่างวดค้างชำระภายใน 60 วันข้างหน้า พร้อมภาระ VAT และยอดบวกกลับ
```sql
SELECT
    c.contract_no,
    c.asset_name,
    c.vehicle_type,
    i.installment_no,
    i.due_date,
    i.principal_amt::NUMERIC(18,2) AS principal_amt,
    i.interest_amt::NUMERIC(18,2) AS interest_amt,
    i.vat_amt::NUMERIC(18,2) AS vat_amt,
    i.payment_inc_vat::NUMERIC(18,2) AS payment_inc_vat,
    i.claimable_vat_amt::NUMERIC(18,2) AS claimable_vat_amt,
    i.add_back_65ter_amt::NUMERIC(18,2) AS add_back_65ter_amt,
    i.remaining_balance::NUMERIC(18,2) AS remaining_balance
FROM fa_hire_purchase_contract c
JOIN fa_hire_purchase_installment i
  ON i.contract_no = c.contract_no
WHERE c.status = 'ACTIVE'
  AND i.status = 'PENDING'
  AND i.due_date <= CURRENT_DATE + INTERVAL '60 days'
ORDER BY i.due_date, c.contract_no, i.installment_no;
```
