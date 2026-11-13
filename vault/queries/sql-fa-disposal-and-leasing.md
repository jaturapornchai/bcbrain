---
title: "SQL รายงานขาย/ตัดจำหน่ายสินทรัพย์ (1802) และสัญญาเช่าซื้อ/ลีสซิ่ง (fa_hire_purchase_contract)"
audience: "dev"
tags: [queries, sql, fa, asset_disposal, hire_purchase, leasing, as_trans]
aliases:
  - "sql ขายสินทรัพย์ถาวร กำไรขาดทุนจากการจำหน่ายสินทรัพย์ 1802"
  - "sql สัญญาเช่าซื้อ ลีสซิ่ง รถยนต์นั่งเกิน 1 ล้าน พ.ร.ฎ. 315"
  - "sql ตารางค่างวดเช่าซื้อ ดอกเบี้ยเช่าซื้อรอตัดบัญชี"
  - "fa_hire_purchase_contract fa_hire_purchase_installment"
sources:
  - "backend/internal/application/process/fa_sale.go:292-300"
  - "backend/internal/application/process/fa_sale.go:535-575"
  - "backend/internal/application/process/report_menu_gl_fa.go:1590-1624"
  - "backend/internal/application/process/hire_purchase_leasing.go:113-174"
  - "backend/internal/application/process/hire_purchase_leasing.go:892-986"
---

# SQL รายงานขาย/ตัดจำหน่ายสินทรัพย์ (`1802`) และสัญญาเช่าซื้อ/ลีสซิ่ง (`fa_hire_purchase_contract`)

รวมคำสั่ง SQL มาตรฐานสำหรับตรวจสอบรายการขายหรือตัดจำหน่ายสินทรัพย์ถาวร (`trans_flag = 1802`) พร้อมกำไร/ขาดทุนจากการขายสินทรัพย์ รวมถึงทะเบียนสัญญาเช่าซื้อและลีสซิ่ง (`fa_hire_purchase_contract`) ที่รองรับเพดานภาษีรถยนต์นั่งไม่เกิน 10 ที่นั่งตามพระราชกฤษฎีกา (ฉบับที่ 315) และภาษีซื้อต้องห้ามมาตรา 82/5(6) (ดูทะเบียนสินทรัพย์และค่าเสื่อมที่ [[sql-fa-register-and-depreciation]], แม่แบบคู่บัญชีขายสินทรัพย์ที่ [[doc-gl-templates-cb-ic-fa]] และกฎกลางที่ [[sql-overview]])

---

## 1. รายงานการขายและตัดจำหน่ายสินทรัพย์ถาวร พร้อมกำไร/ขาดทุน (`trans_flag = 1802`)

สกัดจาก `fa_sale.go:292-300, 535-575` และ `report_menu_gl_fa.go:1590-1624` ดึงรายละเอียดราคาทุนเดิม (`d.price_default`), ค่าเสื่อมราคาสะสม ณ วันขาย (`d.average_cost`), มูลค่าตามบัญชีสุทธิ (`d.price`), มูลค่าขายก่อนภาษี (`d.sum_amount_exclude_vat`) และกำไร/ขาดทุนจากการจำหน่าย (`d.profit_lost_cost_amount`):

### พารามิเตอร์
- `$1` (`DATE`): วันที่เริ่มต้น
- `$2` (`DATE`): วันที่สิ้นสุด

```sql
SELECT
    h.doc_date,
    h.doc_no,
    COALESCE(h.cust_code, '') AS buyer_code,
    COALESCE(ar.name_1, '') AS buyer_name,
    CASE WHEN COALESCE(h.inquiry_type, 0) = 1 THEN 'ขายเงินสด' ELSE 'ขายเงินเชื่อ' END AS sale_payment_term,
    d.item_code AS asset_code,
    COALESCE(a.name_1, d.item_name, '') AS asset_name,
    ROUND(COALESCE(d.price_default, 0), 2) AS original_cost_price,
    ROUND(COALESCE(d.average_cost, 0), 2) AS accum_dep_at_disposal,
    ROUND(COALESCE(d.price, 0), 2) AS net_book_value_at_disposal,
    ROUND(COALESCE(d.sum_amount_exclude_vat, 0), 2) AS sale_price_ex_vat,
    ROUND(COALESCE(d.total_vat_value, 0), 2) AS output_vat_amount,
    ROUND(COALESCE(d.sum_amount, 0), 2) AS total_sale_inc_vat,
    ROUND(COALESCE(d.profit_lost_cost_amount, 0), 2) AS gain_or_loss_on_disposal
FROM as_trans h
JOIN as_trans_detail d
  ON d.doc_no = h.doc_no
 AND d.trans_flag = h.trans_flag
LEFT JOIN as_asset a
  ON a.code = d.item_code
LEFT JOIN ar_customer ar
  ON ar.code = h.cust_code
WHERE h.trans_flag = 1802
  AND COALESCE(h.last_status, 0) = 0
  AND COALESCE(d.last_status, 0) = 0
  AND h.doc_date BETWEEN $1::date AND $2::date
ORDER BY h.doc_date ASC, h.doc_no ASC, d.line_number ASC;
```

### คอลัมน์ผลลัพธ์สำคัญ
| คอลัมน์ | คำอธิบาย |
|---|---|
| `original_cost_price` | ราคาทุนเดิมของสินทรัพย์ที่ล้างออกจากบัญชีสินทรัพย์ (`d.price_default`) |
| `accum_dep_at_disposal` | ค่าเสื่อมราคาสะสมจนถึงวันจำหน่ายที่ล้างออก (`d.average_cost`) |
| `net_book_value_at_disposal` | มูลค่าตามบัญชีสุทธิ ณ วันขาย (`original_cost_price - accum_dep_at_disposal`) |
| `gain_or_loss_on_disposal` | กำไร (`> 0`, เครดิต `4220-00`) หรือขาดทุน (`< 0`, เดบิต `5360-00`) จากการจำหน่ายสินทรัพย์ |

---

## 2. ทะเบียนสัญญาเช่าซื้อและลีสซิ่งพร้อมเพดานภาษี พ.ร.ฎ. 315 (`fa_hire_purchase_contract`)

สกัดจาก `hire_purchase_leasing.go:113-174, 892-940` ตรวจสอบสัญญาเช่าซื้อ/ลีสซิ่งที่มีผลอยู่ ยอดเจ้าหนี้เช่าซื้อคงเหลือ ดอกเบี้ยเช่าซื้อรอตัดบัญชี ภาษีซื้อต้องห้ามที่รวมเป็นต้นทุนรถยนต์นั่ง (`forbidden_vat_capitalized`) และยอดบวกกลับรายจ่ายต้องห้ามมาตรา 65 ตรี ต่อเดือน:

### พารามิเตอร์
- `$1` (`TEXT`): สถานะสัญญา (เช่น `'ACTIVE'` หรือส่ง `''` เพื่อดูทุกสถานะ)

```sql
SELECT
    c.contract_no,
    c.contract_date,
    COALESCE(c.vendor_code, '') AS lessor_code,
    COALESCE(c.vendor_name, '') AS lessor_name,
    COALESCE(c.asset_code, '') AS linked_asset_code,
    COALESCE(c.vehicle_type, '') AS vehicle_type,
    COALESCE(c.total_installments, 0) AS total_installments,
    ROUND(COALESCE(c.cash_price_ex_vat, 0), 2) AS cash_price_ex_vat,
    ROUND(COALESCE(c.forbidden_vat_capitalized, 0), 2) AS sec82_5_6_vat_capitalized,
    ROUND(COALESCE(c.total_interest_amount, 0), 2) AS total_deferred_interest,
    ROUND(COALESCE(c.tax_deductible_cost_cap, 0), 2) AS rd315_tax_cost_cap,
    ROUND(COALESCE(c.non_deductible_cost_excess, 0), 2) AS non_deductible_excess_cost,
    ROUND(COALESCE(c.monthly_add_back_65ter, 0), 2) AS monthly_addback_65ter,
    COALESCE(c.status, '') AS contract_status
FROM fa_hire_purchase_contract c
WHERE ($1::text = '' OR COALESCE(c.status, '') = $1::text)
ORDER BY c.contract_date DESC, c.contract_no ASC;
```

---

## 3. ตารางค่างวดเช่าซื้อ/ลีสซิ่งที่ถึงกำหนดชำระและรอโพสต์บัญชี (`fa_hire_purchase_installment`)

สกัดจาก `hire_purchase_leasing.go:941-986` แสดงงวดผ่อนชำระที่ถึงกำหนดในช่วงวันที่ เพื่อเตรียมจ่ายค่างวดและตัดดอกเบี้ยเช่าซื้อรอตัดบัญชีเข้าเป็นค่าใช้จ่ายประจำงวด:

### พารามิเตอร์
- `$1` (`DATE`): วันครบกำหนดเริ่มต้น
- `$2` (`DATE`): วันครบกำหนดสิ้นสุด
- `$3` (`TEXT`): สถานะงวด (เช่น `'PENDING'`, `'POSTED'` หรือส่ง `''` เพื่อดูทั้งหมด)

```sql
SELECT
    i.due_date,
    c.contract_no,
    COALESCE(c.vendor_name, '') AS lessor_name,
    COALESCE(c.asset_code, '') AS asset_code,
    i.installment_no,
    COALESCE(c.total_installments, 0) AS total_installments,
    ROUND(COALESCE(i.principal_amt, 0), 2) AS principal_amt,
    ROUND(COALESCE(i.interest_amt, 0), 2) AS interest_expense_amt,
    ROUND(COALESCE(i.vat_amt, 0), 2) AS installment_vat_amt,
    ROUND(COALESCE(i.payment_inc_vat, 0), 2) AS total_payment_inc_vat,
    ROUND(COALESCE(i.add_back_65ter_amt, 0), 2) AS pnd50_addback_65ter_amt,
    ROUND(COALESCE(i.remaining_balance, 0), 2) AS remaining_liability_balance,
    COALESCE(i.status, 'PENDING') AS installment_status,
    COALESCE(i.gl_doc_no, '') AS posted_gl_doc_no
FROM fa_hire_purchase_installment i
JOIN fa_hire_purchase_contract c
  ON c.id = i.contract_id
WHERE i.due_date BETWEEN $1::date AND $2::date
  AND ($3::text = '' OR COALESCE(i.status, 'PENDING') = $3::text)
ORDER BY i.due_date ASC, c.contract_no ASC, i.installment_no ASC;
```

---

## 4. ข้อควรระวัง (Gotchas)
- **บิลขายสินทรัพย์เป็นเงินเชื่อ (`trans_flag = 1802`, `inquiry_type IN (0, 2)`) เป็นลูกหนี้ที่ต้องติดตามรับชำระด้วย**: บิลขายสินทรัพย์เชื่อไม่ได้อยู่ใน `ic_trans` แต่อยู่ใน `as_trans` และถูกนำไปรับชำระใน `ap_ar_trans_detail` (`trans_flag = 239`, `bill_type = 1802`) เช่นเดียวกับบิลขายปกติ (ดู [[sql-ar-outstanding-invoices]])
- **ภาษีซื้อค่างวดรถยนต์นั่งไม่เกิน 10 ที่นั่ง (`PASSENGER_CAR_LE10`)**: ตามมาตรา 82/5(6) แห่งประมวลรัษฎากร ภาษีซื้อของรถยนต์นั่งขอคืนไม่ได้แต่ให้นำมารวมเป็นต้นทุนทรัพย์สิน/ค่าใช้จ่ายได้ตามเพดาน พ.ร.ฎ. 315 ระบบจึงแยกเก็บไว้ในคอลัมน์ `forbidden_vat_capitalized` และไม่ส่งเข้า `gl_journal_vat_buy` ประเภทขอคืนได้ (`vat_type = 0`)
