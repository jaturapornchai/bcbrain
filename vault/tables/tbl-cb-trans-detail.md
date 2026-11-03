---
title: "รายละเอียดรับ/จ่ายเงินแยกรายการ (cb_trans_detail)"
tags: [tables, cb]
aliases: ["cb_trans_detail", "รายการช่องทางรับจ่าย", "บรรทัดโอน/เช็ค/บัตร/เงินสดย่อย"]
sources: ["scripts/sql/02_data_schema.sql:2214","backend/internal/application/process/trans.go:1338","backend/internal/application/process/trans.go:1415","backend/internal/application/process/trans.go:1509","backend/internal/application/process/trans.go:1543","backend/internal/application/process/pay_other.go:122","backend/internal/application/process/trans_deposit.go:132","backend/internal/application/process/pos_bill.go:503","backend/internal/application/process/cheque_forward.go:38","backend/internal/application/process/report_menu_cb.go:667","backend/internal/application/process/doc_flow.go:264","backend/internal/application/process/service.go:733","backend/internal/application/process/gl_template.go:873","backend/internal/application/process/gl_pay_other.go:22","backend/internal/application/process/trans_credit.go:224","backend/internal/application/process/doc_flow_graph.go:1303","backend/internal/application/process/docs.go:491","backend/internal/application/process/doc_cancel.go:566","backend/internal/application/process/workflow.go:118","backend/internal/domain/query/write_policy.go:24","backend/internal/application/process/report_menu_so_po.go:446","backend/internal/application/process/fa_sale.go:488","backend/internal/application/process/sysproc_ic_checks_data.go:35","backend/internal/application/process/trans_save_rules.go:618"]
---

# รายละเอียดรับ/จ่ายเงิน `cb_trans_detail`

บรรทัดย่อยของ [[tbl-cb-trans]] — **หนึ่งแถวต่อหนึ่งรายการ** ของช่องทางรับ/จ่าย ชนิดของรายการแยกด้วย `doc_type` (ไม่ใช่คนละตาราง) ความหมายของ `trans_number` และ `amount` เปลี่ยนไปตาม `doc_type` จึงต้องอ่านคู่กันเสมอ ตารางนี้ไม่มี `CREATE TABLE` ในโค้ด Go — DDL อยู่ที่ `scripts/sql/02_data_schema.sql:2214-2263` มีเพียงดัชนี `(doc_no, trans_flag)` และ `(doc_date, trans_flag)` (`:2264-2265`) ไม่มี PK/FK

## รหัส `doc_type`

| doc_type | รายการ | `trans_number` เก็บอะไร | ผู้เขียน |
|---|---|---|---|
| 1 | เงินโอน | passbook (`pass_book_code`) ถ้าไม่มีใช้เลขอ้างอิง | pay tab `trans.go:1413-1418`, `:1421`; POS `pos_bill.go:495` (ยอดอย่างเดียว) |
| 2 | เช็ค | เลขที่เช็ค | pay tab `trans.go:1464-1467`, `:1474-1476`; เช็คยกมา 405/406 `cheque_forward.go:38-47` |
| 3 | บัตรเครดิต | เลขบัตร/slip | pay tab `trans.go:1493-1496`, `:1499`; POS `pos_bill.go:496` (ยอดอย่างเดียว) |
| 4 | เบิกจ่ายเงินสดย่อย | **รหัสวงเงินสดย่อย** ([[tbl-cb-petty-cash]]) | **ไม่พบโค้ดเว็บที่เขียน** — รายงานเงินสดย่อยอ่านอย่างเดียว (`report_menu_cb.go:676-680`) |
| 5 | ใช้เงินล่วงหน้า (advance) | เลขเอกสารเงินล่วงหน้าที่ตัดใช้ | `trans_deposit.go:132-138` (กลุ่ม `useDocType` 5 ที่ `:39`, `:41`) |
| 6 | ใช้เงินมัดจำ (deposit) | เลขเอกสารมัดจำที่ตัดใช้ | `trans_deposit.go:132-138` (กลุ่ม `useDocType` 6 ที่ `:40`, `:42`) |
| 11 | ค่าใช้จ่ายอื่น | รหัสจากรายการ `erp_expenses_list` | `pay_other.go:26`, `:118-126` |
| 12 | รายได้อื่น | รหัสจากรายการ `erp_income_list` | `pay_other.go:27`, `:119-126` |
| 21 | PromptPay / e-Wallet / QR | เลขอ้างอิง ถ้าไม่มีใช้ passbook | pay tab `trans.go:1435-1439`, `:1442`; POS `pos_bill.go:497` (ยอดอย่างเดียว) |

ภาพรวมแท็บชำระเงินและความหมายทางบัญชี: [[acc-payment-tab]], เช็ค/โอนข้ามบัญชี: [[acc-cheque-transfer]], มัดจำ/ล่วงหน้า: [[acc-deposit-advance]].

## คอลัมน์สำคัญ

ชนิดจาก DDL `02_data_schema.sql:2214-2263`; ค่าที่เขียนจริงดู INSERT ของแต่ละผู้เขียนในตารางบน

| column | ความหมายตามโค้ด | ใช้ที่ไหน |
|---|---|---|
| `doc_no`, `trans_flag` | key ร่วมกับ [[tbl-cb-trans]] และเอกสารเจ้าของ | ทุก INSERT |
| `trans_type` | ค่า `transType` ของเอกสารเจ้าของ; 2 = ขาย/ลูกหนี้ ทำให้ `ap_ar_type` = 1 นอกนั้น 2; POS ใส่ 2 คงที่ | `trans.go:1371-1377`; `pos_bill.go:507` |
| `doc_date`, `doc_time` | วัน-เวลาเอกสาร (`doc_time` varchar(5)) | `trans.go:1510` |
| `line_number` | pay tab: 1,2,… ตามรายการที่ผ่านการกรอง; 11/12: ลำดับแถวในกริดนั้น (เริ่ม 0); 5/6: ลำดับแถวที่ส่งมา (เริ่ม 1 นับรวมแถวว่างที่ข้าม) | `trans.go:1506-1507`; `pay_other.go:85`; `trans_deposit.go:123`, `:137` |
| `doc_type` | ชนิดรายการ (ตารางบน) | ทุก INSERT |
| `pass_book_code` | สมุดบัญชีธนาคารของบริษัท ([[tbl-erp-pass-book]]); เช็คจ่ายใช้ passbook ของบริษัท ส่วนเช็ครับเก็บธนาคารลูกค้าใน `bank_code` | `trans.go:1387-1390`, `:1454-1459`; `cheque_forward.go:25-29` |
| `bank_code`, `bank_branch` | ถ้าไม่ระบุ ดึงจาก `erp_pass_book` ของ passbook นั้น ([[tbl-erp-bank]]); สาขาที่กรอกในกริดใช้เฉพาะ INSERT แบบยาว | `trans.go:1513-1514`, `:1524-1525`; `cheque_forward.go:42-43` |
| `trans_number` | varchar(100) — เลขเช็ค/เลขโอน/รหัสรายการอื่น/เลขเอกสารที่ตัดใช้ (ตามชนิด) | ทุก INSERT |
| `trans_number_type` | เช็ค: 1 = เช็ครับ, 2 = เช็คจ่าย (ตาม `payType`); ชนิดอื่นใน pay tab เป็น 0; เช็คยกมา 405 → 1, 406 → 2 | `trans.go:1466`, `:1475`; `cheque_forward.go:15-18` |
| `ap_ar_type`, `ap_ar_code` | ฝั่งและรหัสลูกหนี้ ([[tbl-ar-customer]], 1) / เจ้าหนี้ ([[tbl-ap-supplier]], 2); POS ใส่เฉพาะ `ap_ar_code`; 11/12 ไม่ใส่ทั้งคู่; เมื่อเปลี่ยนรหัสลูกหนี้/เจ้าหนี้ ระบบแก้ `ap_ar_code` ตาม | `trans.go:1511`, `:1516`; `trans_deposit.go:116-119`, `:134`; `pos_bill.go:506`; `workflow.go:118` |
| `amount`, `sum_amount` | pay tab: สองค่าเท่ากัน; มัดจำ/ล่วงหน้า: `sum_amount` = ยอดรวมของเอกสารต้นทาง, `amount` = ยอดที่ตัดใช้; 11/12 และเช็คยกมาเขียนเฉพาะ `amount` (`sum_amount` เป็นค่าตั้งต้นของ DDL) | `trans.go:1515`; `trans_deposit.go:135`; `pay_other.go:123`; `cheque_forward.go:40` |
| `chq_date`, `chq_due_date` | `chq_due_date` = วันครบกำหนดเช็ค หรือวันที่โอน/PromptPay; `chq_date` เขียนเฉพาะเช็คยกมา (= วันที่เอกสาร) | `trans.go:1409`, `:1429`, `:1511`; `cheque_forward.go:40`, `:44` |
| `doc_date_ref` | วันที่ของเอกสารมัดจำ/ล่วงหน้าที่ตัดใช้ | `trans_deposit.go:135` |
| `remark` | หมายเหตุรายการ | `trans.go:1527`; `pay_other.go:123` |
| `no_approved`, `credit_card_type`, `charge` | เลขอ้างอิงโอน/PromptPay หรือเลขอนุมัติบัตร / ประเภทบัตร (PromptPay ใส่ passbook) / ค่าธรรมเนียมบัตร — เขียนเฉพาะ INSERT แบบยาว | `trans.go:1417`, `:1438`, `:1495`, `:1519-1529` |
| `status` | เช็คยกมาใส่ 0 (ความหมายอื่นไม่ชัดจากโค้ด) | `cheque_forward.go:41` |
| `last_status` | 0 = ใช้งาน, 1 = ยกเลิก — ทุกผู้เขียน INSERT ด้วย 0 แล้วตามสถานะเอกสารเจ้าของ (หัวข้อ "ใครเขียน / ใครอ่าน") | `trans.go:1511`; `doc_flow.go:264` |
| `chq_on_hand`, `external_chq` | **ไม่มีโค้ดเว็บเขียน** (ค่าตั้งต้น 0) — อ่านตอนลงทะเบียนเช็ค: ข้ามแถวที่ `chq_on_hand` ≠ 0 และส่ง `external_chq` ต่อไปยัง `cb_chq_list` | `trans.go:1550`, `:1553` |
| `is_doc_copy` | ไม่มีโค้ดเว็บเขียน; รายงานการใช้มัดจำกรอง `is_doc_copy = 0` | `report_menu_so_po.go:446` |

คอลัมน์ที่เหลือใน DDL (`doc_group`, `doc_ref`, `chq_ref`, `exchange_rate`, `fee_amount`, `other_amount`, `tax_at_pay`, `period_number`, `approve_code`, `approve_date`, `balance_amount`, `sale_shift_id`, `currency_code`, `ref1`, `ref2`) ไม่พบ INSERT/UPDATE จากโค้ดเว็บ; `sum_amount_2` มีเฉพาะผู้อ่านใน GL (`gl_template.go:879`)

## ความสัมพันธ์

- หัว: [[tbl-cb-trans]] (`doc_no + trans_flag`)
- เช็ค/บัตร (doc_type 2, 3) → สรุปเข้า [[tbl-cb-chq-list]] ด้วย `chqListFromPaySQL` (`trans.go:1543-1553`): เลือกเฉพาะแถวที่ `trans_number` ไม่ว่าง, `chq_on_hand` = 0 และ `last_status` = 0; `cb_chq_list.doc_ref` = `doc_no` และ `doc_line_number` = `line_number`; เรียกต่อท้ายแท็บชำระ (`trans.go:1533-1536`) และหลังเช็คยกมา (`cheque_forward.go:49-51`)
- passbook → [[tbl-erp-pass-book]] → ธนาคาร [[tbl-erp-bank]]
- เงินสดย่อย (doc_type 4) → [[tbl-cb-petty-cash]] ผ่าน `trans_number = cb_petty_cash.code` (`report_menu_cb.go:692`, ผ่าน CTE `pm`)
- มัดจำ/ล่วงหน้า (5, 6) → เอกสาร [[tbl-ic-trans]] ที่ `trans_number = ic_trans.doc_no` (ค้นด้วย `kind.flags` — `trans_deposit.go:135-136`)

## ใครเขียน / ใครอ่าน

- **เขียน**: `trans.go:1509-1530` (pay tab ทุกเอกสาร — INSERT สองแบบ), `pay_other.go:122-126` (11/12), `trans_deposit.go:132-138` (5/6), `pos_bill.go:503-509` (POS 1/3/21), `cheque_forward.go:38-47` (เช็คยกมา 405/406)
- **ลบ**: ทุกแผนลบ-สร้างใหม่ตาม (`doc_no`, `trans_flag`) — pay tab `trans.go:1343`; ลบเอกสาร IC `trans.go:425`, เอกสาร AP/AR `docs.go:491`, ขายสินทรัพย์ `fa_sale.go:488-493`, POS `pos_bill.go:465`; เช็คยกมา `cheque_forward.go:20`; มัดจำ/ล่วงหน้าลบเฉพาะ `doc_type = useDocType` (`trans_deposit.go:121`)
- **อัปเดตสถานะ**: `last_status` ตามเอกสารเจ้าของที่ `doc_flow.go:264` (ใน `deriveLastStatus`) และ `service.go:733` (ตรวจสถานะ flow ซ้ำ); ยกเลิกบิล POS ตั้ง 1 ที่ `pos_bill.go:608`; เครื่องมือตรวจระบบเติม NULL เป็น 0 (`sysproc_ic_checks_data.go:35-36`)
- **อ่าน (GL)**: ดึงรายการเป็นบรรทัดบัญชี (`gl_template.go:873-880`) และรวมยอด doc_type 3 (`gl_template.go:765`)
- **อ่าน (GL รายการอื่น)**: จับ doc_type 11/12 กับผังบัญชีของรายการ (`gl_pay_other.go:22-31`)
- **อ่าน (หา passbook ของเอกสาร)**: ตอนสร้าง GL (`service.go:1811`)
- **อ่าน (รายงานเงินสดย่อย)**: `report_menu_cb.go:667-683` กรองเอกสารเจ้าของที่ไม่ถูกยกเลิกด้วย `cbmParentOK` (`:155`)
- **อ่าน (รายงานเงินโอนรายสมุดบัญชี)**: doc_type 1 — `report_menu_cb.go:750-762`
- **อ่าน (รายงานการใช้มัดจำ)**: `report_menu_so_po.go:370`, `:446`
- **อ่าน (ยอดมัดจำ/ล่วงหน้าที่ใช้แล้ว)**: `trans_deposit.go:65-69`, `:222`, `:253`; เครดิตลูกหนี้ `trans_credit.go:224-227`; `trans_save_rules.go:618`; กฎ flow `doc_flow.go:77`; ห้ามยกเลิกมัดจำที่ถูกใช้ `doc_cancel.go:566`
- **อ่าน (flow graph)**: ขอบการตัดมัดจำ `doc_flow_graph.go:1127-1136`; รายการช่องทางต่อเอกสาร (กรอง `last_status = 0`, จัดชนิดตาม `doc_type`) `doc_flow_graph.go:1303-1317`, `:1346-1372`

## ข้อควรระวัง

- แยกทุกรายการด้วย `doc_type` — เงินสดย่อย (4) ไม่ใช่เช็คแม้อยู่ในตารางเดียวกัน; ลงทะเบียนเช็คจะหยิบเฉพาะ `doc_type IN (2, 3)` (`trans.go:1552`).
- รายการ doc_type 5/6 ถูกลบแยกจากรายการอื่น (กรอง `doc_type`) เพื่อไม่ทับแท็บชำระปกติ (`trans_deposit.go:121`).
- INSERT ของแท็บชำระมีสองแบบ: แบบสั้นเมื่อไม่มีกริดโอน/PromptPay/เช็ค/บัตรและไม่มียอดกระเป๋าเงิน, แบบยาว (มี `remark`, `no_approved`, `credit_card_type`, `charge` และสาขาจากกริด) เมื่อมีอย่างใดอย่างหนึ่ง — เลือกด้วย `hasExtraCols` (`trans.go:1504`, `:1508`) ไม่เกี่ยวกับว่าฐานข้อมูลมีคอลัมน์ครบหรือไม่.
- `last_status` ต้องตามเอกสารเจ้าของ: ผู้อ่านมัดจำ ลงทะเบียนเช็ค และ flow graph กรองด้วย `last_status = 0` ของตารางนี้เอง (`trans.go:1553`, `trans_deposit.go:68`, `doc_flow_graph.go:1316`) ขณะที่รายงาน CB ดูสถานะของเอกสารเจ้าของผ่าน `cbmParentOK`.
- ตารางเงิน: เขียนผ่านเกตเวย์ `/query/exec` ไม่ได้ ต้องผ่าน `/api/process` เท่านั้น (`write_policy.go:24`, ADR-0011).

## ที่มาในโค้ด

- `scripts/sql/02_data_schema.sql:2214-2265` DDL และดัชนี
- `backend/internal/application/process/trans.go:1338-1346,1371-1377,1387-1390,1413-1530,1543-1553` สร้างรายการแท็บชำระ + SQL ลงทะเบียนเช็ค
- `backend/internal/application/process/pay_other.go:26-27,85,119-126` รายการอื่น 11/12
- `backend/internal/application/process/trans_deposit.go:39-42,65-69,116-138,222,253` มัดจำ/ล่วงหน้า
- `backend/internal/application/process/pos_bill.go:465-466,490-511,608` POS
- `backend/internal/application/process/cheque_forward.go:15-51` เช็คยกมา
- `backend/internal/application/process/doc_flow.go:77,239-264` สถานะตามเอกสารเจ้าของ
- `backend/internal/application/process/service.go:733,1811` ตรวจสถานะซ้ำ / หา passbook
- `backend/internal/application/process/gl_template.go:765,873-880` และ `gl_pay_other.go:22-31` อ่านเข้า GL
- `backend/internal/application/process/report_menu_cb.go:155,667-683,750-762` รายงาน CB
- `backend/internal/application/process/trans_credit.go:224-227`, `trans_save_rules.go:618`, `doc_cancel.go:566`
- `backend/internal/application/process/doc_flow_graph.go:1127-1136,1303-1372`
- `backend/internal/application/process/docs.go:491`, `workflow.go:118`, `fa_sale.go:488`
- `backend/internal/domain/query/write_policy.go:24`
