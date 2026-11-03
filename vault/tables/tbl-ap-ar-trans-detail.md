---
title: "รายการบรรทัดใบวางบิล/ชำระหนี้ (ap_ar_trans_detail)"
tags: [tables, ap-ar]
aliases: ["ap_ar_trans_detail", "รายการวางบิล", "บรรทัดรับชำระหนี้", "บรรทัดจ่ายชำระหนี้"]
sources: ["backend/internal/application/process/docs.go:566", "backend/internal/application/process/docs.go:499", "backend/internal/application/process/docs.go:621", "backend/internal/application/process/trans.go:933", "backend/internal/application/process/stock_lot.go:158", "backend/internal/application/process/stock_lot.go:774", "backend/internal/application/process/doc_flow.go:69", "backend/internal/application/process/doc_cancel.go:560", "backend/internal/application/process/report_menu_ap_ar.go:309", "backend/internal/application/process/workflow.go:116", "backend/internal/adapter/inbound/http/ai/context_sales_ar.go:46", "scripts/sql/02_data_schema.sql:548"]
---

# รายการบรรทัด `ap_ar_trans_detail`

ตารางนี้ใช้ **สามบทบาทที่ต่างกัน** ต้องแยกให้ออกเวลาอ่านข้อมูล:

1. **บรรทัดบิลที่วางบิล/ชำระ** ของเอกสาร 213 / 235 / 19 / 239 (หัวอยู่ใน [[tbl-ap-ar-trans]]) — บทบาทหลัก
2. **บรรทัดมัดจำ/เงินล่วงหน้า** ของเอกสารซื้อ-ขายที่มีแท็บมัดจำ (หัวอยู่ใน [[tbl-ic-trans]]) — เขียนรายละเอียด + จำนวนเงิน (`trans.go:220,933-945`)
3. **แถว marker** ของเอกสารปรับยอดสต็อก trans_flag 66/68 ที่ผูกกับใบตรวจนับ (`stock_lot.go:158-160,774-780`)

## คอลัมน์สำคัญ

จาก INSERT ของบทบาท 1 (`docs.go:565-571`):

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `doc_no`, `trans_flag`, `doc_date` | เอกสารชำระที่เป็นเจ้าของบรรทัด (key ร่วมกับหัว) | join กับ [[tbl-ap-ar-trans]] ที่ `report_menu_ap_ar.go:309,354,780,855` |
| `trans_type` | 1 = เจ้าหนี้, 2 = ลูกหนี้ (marker สต็อกใช้ 2 คงที่ `stock_lot.go:778-779`) | `docs.go:565-571` |
| `line_number` | ลำดับบรรทัด | `docs.go:565-571`, `trans.go:940` |
| `cust_code` | ลูกหนี้/เจ้าหนี้ของบรรทัด | `docs.go:565-571`; อ้างใน `workflow.go:116` (ตอนเปลี่ยนรหัส) |
| `billing_no` | เลขที่เอกสารหนี้ที่ถูกวางบิล/ชำระ (เลข `ic_trans.doc_no` ของใบขาย/ซื้อ/ลดหนี้) | `docs.go:565-571`; `billPaidSQL` `docs.go:621-626`; `doc_flow.go:69` |
| `billing_date` | วันที่ของเอกสารหนี้นั้น | `docs.go:565-571`; AI context รายงานลูกหนี้ค้างชำระจับคู่ `billing_date = t.doc_date` (`ai/context_sales_ar.go:46-48`) |
| `bill_type` | `trans_flag` ของเอกสารหนี้นั้น (44, 46, 12, 14, ... ) | `docs.go:565-571` (`BillLine.BillType` `docs.go:502`) |
| `ref_doc_no`, `ref_doc_date`, `doc_ref` | เอกสารอ้างอิงของบรรทัด | `docs.go:565-571` |
| `due_date` | วันครบกำหนดของหนี้ | `docs.go:565-571` |
| `sum_debt_amount` | ยอดหนี้ของเอกสารนั้น (ในบทบาท 2 = จำนวนเงินของรายการมัดจำ) | `docs.go:565-571`; `trans.go:940` |
| `balance_ref` | ยอดคงเหลืออ้างอิง ณ ตอนบันทึก | `docs.go:565-571` |
| `sum_pay_money` | ยอดที่ชำระในบรรทัดนี้ | `docs.go:565-571`; ใช้เป็น "paid" ใน `billPaidSQL` และรายงาน |
| `lost_profit_exchange_amount` | กำไร/ขาดทุนอัตราแลกเปลี่ยนต่อบรรทัด (19/239 หลายสกุล) | `docs.go:572-579,621-625`; ดู [[acc-fx-multi-currency]] |
| `calc_flag` | ธงคำนวณของ marker 66/68 (ผลจาก `adjustCalc`) | `stock_lot.go:778-779` |
| `remark` | หมายเหตุ (บทบาท 2 ใช้ `Remark` หรือชื่อรายการ) | `trans.go:940` |
| `last_status` | 0 = ใช้งาน, 1 = ยกเลิก; INSERT ด้วย 0 แล้วตามสถานะหัวผ่าน doc flow | `docs.go:565-571`; `doc_flow.go:262` |
| `status` | ถูกอ้างใน `doc_flow.go:96` (`r.status = 0` กับ trans_flag 87, 260) — ความหมายนอกเหนือจากนี้ "ไม่ชัดจากโค้ด" | `doc_flow.go:96` |

คอลัมน์สกุลเงินที่สอง (เฉพาะ 19/239 เมื่อมี `billFx`): `sum_debt_amount_2`, `balance_ref_2`, `sum_pay_money_2`, `currency_code`, `exchange_rate`, `exchange_rate_old`, `lost_profit_exchange_amount` — เขียนด้วย UPDATE ต่อจาก INSERT ที่ `docs.go:572-579` (field ใน `BillLine` `docs.go:513-519`).

DDL ครบทุกคอลัมน์ (52 คอลัมน์) อยู่ที่ `scripts/sql/02_data_schema.sql:548-601`; คอลัมน์ที่มีใน DDL แต่ตารางด้านบนไม่ได้อธิบาย (โค้ด backend ที่อ่านไม่ได้ INSERT ค่า → "ไม่ชัดจากโค้ด"): `doc_group`, `sum_debt_value`, `sum_tax_value`, `sum_discount`, `sum_after_discount`, `sum_pay_money_cash`, `sum_pay_money_chq`, `sum_pay_money_credit`, `sum_pay_money_transfer`, `sum_debt_balance`, `sum_before_vat`, `sum_value`, `vat_rate`, `final_amount`, `bill_tax_no`, `bill_tax_date`, `sale_shift_id`, `creator_code`, `last_editor_code`, `create_datetime`, `lastedit_datetime`.

## หนี้คงค้าง (OutstandingBills)

ยอดค้างของเอกสารหนี้ = ยอดเอกสาร − Σ `sum_pay_money` (+ ผลต่างอัตราแลกเปลี่ยนเฉพาะเอกสารซื้อ/ขาย/ขายสินทรัพย์ flag 12, 44, 1802) ของบรรทัดที่ `last_status = 0`, `trans_flag` เป็นเอกสารชำระ (19 หรือ 239) และ `billing_no/bill_type` ตรงกับเอกสารหนี้ โดยไม่นับเอกสารที่กำลังแก้ (`p.doc_no <> docNo`) — `billPaidSQL` `docs.go:621-626`.
ชุด trans_flag ของหนี้:

- ลูกหนี้: debit `44 (inquiry_type 0,2), 46, 93, 95, 99, 101, 418, 250/254, 1802`; credit `48, 97, 103, 252` (`docs.go:600-603`)
- เจ้าหนี้: debit `12, 14, 316, 81, 83, 87, 89, 315, 260/264`; credit `16, 317, 85, 91, 262` (`docs.go:604-608`)

## ความสัมพันธ์

- `doc_no + trans_flag` → [[tbl-ap-ar-trans]] (หัว) ; ปิดบัญชี/ชำระ → [[tbl-cb-trans]]
- `billing_no + bill_type` → [[tbl-ic-trans]] (`doc_no + trans_flag`) หรือ [[tbl-as-trans]] flag 1802 (`docs.go:612-617`)
- `cust_code` → [[tbl-ar-customer]] / [[tbl-ap-supplier]]

## ใครเขียน / ใครอ่าน

- **เขียน**: `billStmts` (`docs.go:532-585`) สำหรับ 213/235/19/239; `trans.go:933-945` (มัดจำ/ล่วงหน้า — ลบแล้วสร้างใหม่ตามเอกสาร); `stock_lot.go:774-780` (marker 66/68).
- **ลบพร้อมหัว**: `trans.go:428` (ลบ deposit lines ตอนลบเอกสาร ic), `apArPlan` `docs.go:483,489`.
- **อ่าน/อัปเดตสถานะ**: `doc_flow.go:69,71,96,219,262` (ใช้ตัดสินว่าเอกสารถูกวางบิล/ชำระแล้ว → ยกเลิก/แก้ไม่ได้), `doc_cancel.go:494-497,560-564,353-356`, `report_menu_ap_ar.go:538,780-855`, AI context (`ai/context_sales_ar.go:35-48` ใช้ flag 239 สำหรับลูกหนี้ค้างชำระ).

## ข้อควรระวัง

- แถวของ **บทบาท 3 (marker)** มี `billing_no` = เลขใบตรวจนับและ trans_flag = 66/68 ไม่ใช่บิลชำระหนี้ — รายงานหนี้ต้องกรอง `trans_flag IN (19,239,213,235)` เสมอ.
- `billing_no` อ้างด้วย **เลขเอกสาร + bill_type** ไม่ใช่ id; เลขซ้ำข้ามชนิดเอกสารได้ จึงต้อง join ทั้งสอง (`docs.go:621-626`; `doc_flow.go:69`).
- ในบรรทัดมัดจำ `sum_debt_amount` เก็บจำนวนเงินรายการ ไม่ใช่ยอดหนี้ — ห้ามรวมกับบทบาท 1.
- ยกเลิกเอกสารชำระ → ต้องเปลี่ยน `last_status` ของบรรทัดด้วย (ไม่งั้นบิลจะยังถูกนับว่าชำระ): ทำใน `doc_flow.go:262`.

## ที่มาในโค้ด

- `backend/internal/application/process/docs.go:499-520` (BillLine), `:528`, `:532-585` (billStmts), `:565-571` (INSERT), `:572-579` (UPDATE สกุลเงิน), `:600-626`, `:489`
- `backend/internal/application/process/trans.go:220,428,933-945`
- `backend/internal/application/process/stock_lot.go:158-160,774-780`
- `backend/internal/application/process/doc_flow.go:69,71,96,219,262`
- `backend/internal/application/process/doc_cancel.go:353-356,494-498,560-564`
- `backend/internal/application/process/report_menu_ap_ar.go:309,354,538,780-855`
- `backend/internal/adapter/inbound/http/ai/context_sales_ar.go:35-48`
- `backend/internal/application/process/workflow.go:116`
- `scripts/sql/02_data_schema.sql:548-601`
