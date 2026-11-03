---
title: "รายละเอียดรับ/จ่ายเงินแยกรายการ (cb_trans_detail)"
tags: [tables, cb]
aliases: ["cb_trans_detail", "รายการช่องทางรับจ่าย", "บรรทัดโอน/เช็ค/บัตร/เงินสดย่อย"]
sources: ["backend/internal/application/process/trans.go:1506", "backend/internal/application/process/pay_other.go:123", "backend/internal/application/process/trans_deposit.go:133", "backend/internal/application/process/pos_bill.go:504", "backend/internal/application/process/cheque_forward.go:39", "backend/internal/application/process/report_menu_cb.go:667"]
---

# รายละเอียดรับ/จ่ายเงิน `cb_trans_detail`

บรรทัดย่อยของ [[tbl-cb-trans]] — **หนึ่งแถวต่อหนึ่งรายการ** ของช่องทางรับ/จ่าย ชนิดของรายการแยกด้วย `doc_type` (ไม่ใช่คนละตาราง) ความหมายของ `trans_number` และ `amount` เปลี่ยนไปตาม `doc_type` จึงต้องอ่านคู่กันเสมอ.

## รหัส `doc_type`

| doc_type | รายการ | `trans_number` เก็บอะไร | ผู้เขียน |
|---|---|---|---|
| 1 | เงินโอน | passbook (`pass_book_code`) หรือเลขอ้างอิง | `trans.go:1405-1425`; POS `pos_bill.go:496` |
| 2 | เช็ค | เลขที่เช็ค | pay tab `trans.go:1506-1530`; เช็คยกมา 405/406 `cheque_forward.go:39-48` (ใช้ doc_type 2 คงที่) |
| 3 | บัตรเครดิต | เลขบัตร/slip | pay tab; POS `pos_bill.go:497` |
| 4 | เบิกจ่ายเงินสดย่อย | **รหัสวงเงินสดย่อย** ([[tbl-cb-petty-cash]]) | อ่านที่ `report_menu_cb.go:667-681` |
| 5 | ใช้เงินล่วงหน้า (advance) | เลขเอกสารเงินล่วงหน้าที่ตัดใช้ | `trans_deposit.go:121-137` |
| 6 | ใช้เงินมัดจำ (deposit) | เลขเอกสารมัดจำที่ตัดใช้ | `trans_deposit.go:121-137` (กลุ่มที่ `useDocType` 5/6 ที่ `trans_deposit.go:40-43`) |
| 11 | ค่าใช้จ่ายอื่น | รหัสจากรายการตั้งค่า | `pay_other.go:64-86,119-126` (`payExpenseDocType = 11`) |
| 12 | รายได้อื่น | รหัสจากรายการตั้งค่า | `pay_other.go:26-27,119-126` (`payIncomeDocType = 12`) |
| 21 | PromptPay / e-Wallet / QR | เลขอ้างอิง (หรือ passbook) | `trans.go:1426-1440`; POS `pos_bill.go:498` |

ภาพรวมแท็บชำระเงินและความหมายทางบัญชี: [[acc-payment-tab]], เช็ค/โอนข้ามบัญชี: [[acc-cheque-transfer]], มัดจำ/ล่วงหน้า: [[acc-deposit-advance]].

## คอลัมน์สำคัญ

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `doc_no`, `trans_flag` | key ร่วมกับ [[tbl-cb-trans]] และเอกสารเจ้าของ | ทุกที่ |
| `trans_type` | 1 = ซื้อ/เจ้าหนี้, 2 = ขาย/ลูกหนี้ | `trans.go:1510` |
| `doc_date`, `doc_time`, `line_number` | วัน-เวลา / ลำดับรายการ | `trans.go:1510` |
| `doc_type` | ชนิดรายการ (ตารางบน) | ทุก INSERT |
| `pass_book_code` | สมุดบัญชีธนาคารของบริษัท ([[tbl-erp-pass-book]]) | `trans.go:1510`; `cheque_forward.go:39` |
| `bank_code`, `bank_branch` | ธนาคาร/สาขา — ถ้าไม่ระบุ ดึงจาก `erp_pass_book` ของ passbook นั้น | `trans.go:1510-1516` (COALESCE จาก `erp_pass_book`); [[tbl-erp-bank]] |
| `trans_number` | เลขเช็ค/เลขโอน/รหัสเงินสดย่อย/เลขเอกสารตัดใช้ (ตามชนิด) | ทุก INSERT |
| `trans_number_type` (และ `ap_ar_type`) | สำหรับเช็ค: 1 = เช็ครับ, 2 = เช็คจ่าย | `trans.go:1394`; `cheque_forward.go:39-41` |
| `ap_ar_type`, `ap_ar_code` | ฝั่งและรหัสลูกหนี้/เจ้าหนี้ ([[tbl-ar-customer]] / [[tbl-ap-supplier]]) | `trans.go:1510`; `trans_deposit.go:133` |
| `amount`, `sum_amount` | จำนวนเงินของรายการ (`sum_amount` คือยอดรวมที่ใช้ตอนตัดบัญชี; มัดจำเก็บ `sum_amount` = ยอดเอกสารต้นทาง, `amount` = ยอดที่ตัดใช้) | `trans.go:1510`; `trans_deposit.go:133-137` |
| `chq_date`, `chq_due_date` | วันที่เช็ค / วันครบกำหนด (หรือวันที่โอน) | `trans.go:1510`; `cheque_forward.go:39` |
| `doc_date_ref` | วันที่ของเอกสารที่ตัดใช้ (มัดจำ/ล่วงหน้า) | `trans_deposit.go:133` |
| `remark` | หมายเหตุรายการ | `trans.go:1520`, `pay_other.go:123` |
| `no_approved`, `credit_card_type`, `charge` | เลขอนุมัติ / ประเภทบัตร (หรือ passbook ของ PromptPay) / ค่าธรรมเนียม | `trans.go:1520` (ถ้ามีคอลัมน์ extra ใน DB — `hasExtraCols`) |
| `chq_on_hand`, `external_chq` | เช็คอยู่ในมือ / เช็คจากภายนอก — ถูกอ่านตอนสร้างทะเบียนเช็ค | `trans.go:1543-1555` (`chqListFromPaySQL`) |
| `status` | เช็คยกมาใส่ 0 (ความหมายอื่น "ไม่ชัดจากโค้ด") | `cheque_forward.go:39` |
| `last_status` | 0 = ใช้งาน, 1 = ยกเลิก (INSERT ด้วย 0 แล้วตามเอกสารเจ้าของ) | `doc_flow.go:262`; รายงาน CB กรอง `cbmParentOK` (`report_menu_cb.go:154`) |

## ความสัมพันธ์

- หัว: [[tbl-cb-trans]] (`doc_no + trans_flag`)
- เช็ค/บัตร (doc_type 2, 3) → สรุปเข้า [[tbl-cb-chq-list]] ด้วย `chqListFromPaySQL` โดย `cb_chq_list.doc_ref = cb_trans_detail.doc_no` และ `doc_line_number = line_number`
- passbook → [[tbl-erp-pass-book]] → ธนาคาร [[tbl-erp-bank]]
- เงินสดย่อย (doc_type 4) → [[tbl-cb-petty-cash]] ผ่าน `trans_number = cb_petty_cash.code`
- มัดจำ/ล่วงหน้า (5, 6) → เอกสาร [[tbl-ic-trans]] (`d.doc_no = trans_number`, ตรวจที่ `trans_deposit.go:133-137`)

## ใครเขียน / ใครอ่าน

- **เขียน**: `trans.go:1506-1535` (pay tab ทุกเอกสาร), `pay_other.go:123` (11/12), `trans_deposit.go:133` (5/6), `pos_bill.go:504-509` (POS 1/3/21), `cheque_forward.go:39` (405/406)
- **ลบ**: ทุก plan ที่ลบ-สร้างใหม่ตาม (doc_no, trans_flag) — `docs.go:491`, `trans_deposit.go:121` (ลบเฉพาะ `doc_type = useDocType`), `cheque_forward.go:21`
- **อัปเดตสถานะ**: `doc_flow.go:262`
- **อ่าน**: GL template (`gl_template.go:852-854` ดึงธนาคาร/ประเภทบัตรผ่าน `cb_chq_list`), รายงาน CB (`report_menu_cb.go:154,667-681,757`), เครดิตลูกหนี้ — ยอดมัดจำที่ใช้แล้ว (`trans_credit.go:223-227` `orderAdvanceSQL`: อ่าน `cb_trans_detail.amount` ที่ `trans_number = dp.doc_no` กับ `last_status = 0`), flow graph (`doc_flow_graph.go:598`)

## ข้อควรระวัง

- แยกทุกรายการด้วย `doc_type` — เงินสดย่อย (4) ไม่ใช่เช็คแม้อยู่ในตารางเดียวกัน; รายงานเช็คกรอง `doc_type IN (2,3)`.
- รายการ doc_type 5/6 ถูกลบแยกจากรายการอื่น (กรอง `doc_type`) เพื่อไม่ทับแท็บชำระปกติ (`trans_deposit.go:121`).
- คอลัมน์ `no_approved`, `credit_card_type`, `charge`, `remark` มีสองโหมด INSERT (`hasExtraCols`) แสดงว่าบางฐานข้อมูลยังไม่มีคอลัมน์เหล่านี้ — ตรวจโครงสร้างก่อนใช้ (`trans.go:1506-1530`).
- ตารางเงิน: แก้ได้ผ่าน `/api/process` เท่านั้น (`write_policy.go:24`).
- `last_status` ต้องตามเอกสารเจ้าของเสมอ ไม่เช่นนั้นรายงานเงินสดย่อย/เช็คจะนับเอกสารที่ยกเลิก (รายงาน CB ใช้เงื่อนไข parent OK `report_menu_cb.go:154`).

## ที่มาในโค้ด

- `backend/internal/application/process/trans.go:1392-1440,1506-1535,1543-1555`
- `backend/internal/application/process/pay_other.go:26-27,50-86,119-126`
- `backend/internal/application/process/trans_deposit.go:28-56,121-137`
- `backend/internal/application/process/pos_bill.go:495-509`
- `backend/internal/application/process/cheque_forward.go:5-50`
- `backend/internal/application/process/doc_flow.go:262`
- `backend/internal/application/process/report_menu_cb.go:154,667-681,757`
- `backend/internal/application/process/gl_template.go:852-854`
- `backend/internal/application/process/trans_credit.go:223-247`
- `backend/internal/domain/query/write_policy.go:24`
