---
title: "กลุ่มตาราง cb_* — เงินสด ธนาคาร เช็ค และเงินสดย่อย"
tags: [tables, cb, group]
aliases: ["cb_*", "ตารางเงินสดธนาคาร", "Cash Book tables", "กลุ่มตาราง CB"]
sources: ["scripts/sql/02_data_schema.sql:2058","backend/internal/domain/query/write_policy.go:24","backend/internal/application/process/trans.go:1380","backend/internal/application/process/pos_bill.go:421","backend/internal/application/process/cheque.go:32","backend/internal/application/process/report_menu_cb.go:692","backend/internal/adapter/inbound/http/dashboard/handler.go:130","backend/internal/domain/query/write_policy_legacy.go:16","backend/internal/application/process/gl_template.go:202","backend/internal/application/process/docs.go:373","backend/internal/application/process/fa_sale.go:558","backend/internal/application/process/pay_other.go:122","backend/internal/application/process/trans_deposit.go:121","backend/internal/application/process/cheque_forward.go:20","backend/internal/application/process/pay_check.go:78","backend/internal/application/process/doc_flow.go:263","backend/internal/application/process/service.go:732","backend/internal/adapter/inbound/http/process/cheque_handler.go:15","backend/internal/application/process/trans_save_rules.go:610","backend/internal/application/process/doc_picture.go:169","backend/internal/adapter/inbound/http/mcp/gateway.go:993","backend/internal/application/process/doc_flow_graph.go:1303","backend/internal/adapter/inbound/http/autocare/handler.go:2494"]
---

# กลุ่มตาราง `cb_*`

ตารางฝั่ง **เงินสด-ธนาคาร (Cash Book)**: ช่องทางรับ/จ่ายเงินของเอกสาร, ทะเบียนเช็ค/บัตร, และเงินสดย่อย. DDL ใน `scripts/sql/02_data_schema.sql:2058-2272` มี 7 ตาราง `cb_*` แต่ SQL ใน `backend/internal` (ไม่รวม `_test`) และ `frontend/account`, `frontend/src` อ้างถึง **เพียง 4 ตาราง** — อีก 3 ตารางมีใน DDL แต่ไม่มีโค้ดใช้:

| ตาราง | DDL | สถานะในโค้ด |
|---|---|---|
| `cb_credit_card` | `02_data_schema.sql:2095-2128` | ไม่มีโค้ดอ้าง (ทะเบียนบัตรเครดิตใช้ `chq_type = 3` ของ `cb_chq_list`) |
| `cb_resource` | `:2150-2155` | ไม่มีโค้ดอ้าง; มีแต่คอลัมน์ระบบ (`roworder`, `create_date_time_now` ฯลฯ) |
| `cb_trans_detail_draft` | `:2267-2272` | ไม่มีโค้ดอ้าง; มีแต่คอลัมน์ระบบ |

**นโยบายเขียน**: `cb_trans`, `cb_trans_detail`, `cb_chq_list` เป็นตารางเงิน — เขียนได้เฉพาะผ่าน `/api/process` (`write_policy.go:24` `moneyTablePattern`); `cb_petty_cash` เป็น master อยู่ใน legacy write allow-list (ADR-0011; `write_policy_legacy.go:16`).

## ตารางที่มีโน้ตแยก

- `cb_trans` → [[tbl-cb-trans]] — หัวสรุปแท็บรับ/จ่ายเงินของเอกสาร: ยอดเงินสด/โอน/เช็ค/บัตร/ค่าใช้จ่ายอื่น และ `pay_type` (1 = รับ, 2 = จ่าย); คอลัมน์สะกด `tranfer_amount` ตามของจริง (DDL `:2157-2210`)
- `cb_trans_detail` → [[tbl-cb-trans-detail]] — รายการช่องทางรับ/จ่ายทีละบรรทัด แยกด้วย `doc_type` (1 โอน, 2 เช็ค, 3 บัตรเครดิต, 4 เงินสดย่อย, 5 ใช้เงินล่วงหน้า, 6 ใช้มัดจำ, 11 รายจ่ายอื่น, 12 รายได้อื่น, 21 PromptPay/e-wallet); `doc_type = 4` ไม่มีโค้ดเว็บเขียน (DDL `:2214-2263`)
- `cb_chq_list` → [[tbl-cb-chq-list]] — ทะเบียนเช็ค/บัตร/e-wallet (`chq_type` 1 เช็ครับ, 2 เช็คจ่าย, 3 บัตร, 21 wallet) — สร้างจาก `cb_trans_detail` (doc_type 2/3) และ `status` คำนวณจากเอกสารเช็ค ไม่กรอกเอง; `chq_type = 21` ไม่มี INSERT ที่สร้างแถว (DDL `:2058-2093`)
- `cb_petty_cash` → [[tbl-cb-petty-cash]] — master เงินสดย่อย (รหัส, ชื่อ, `credit_money`, `balance_money`, ผังบัญชี); `balance_money` เป็นยอดยกมา ยอดคงเหลือในรายงานคำนวณจากความเคลื่อนไหว (DDL `:2130-2148`)

## ความสัมพันธ์หลัก

- `cb_trans` 1 : N `cb_trans_detail` ด้วย (`doc_no`, `trans_flag`) — ไม่มี FK ใน DDL; ทั้งสองตารางถูกลบแล้วสร้างใหม่ด้วยคีย์นี้ทุกครั้งที่บันทึกแท็บชำระเงิน (`trans.go:1343-1345`); `cb_trans_detail` doc_type 2/3 สร้างแถวใน `cb_chq_list` (`chqListFromPaySQL`, `trans.go:1543-1553`; `cb_chq_list.doc_ref` = `doc_no`)
- คู่ค้า: `cb_trans.ap_ar_code` และ `cb_chq_list.ap_ar_code` ชี้ [[tbl-ar-customer]] / [[tbl-ap-supplier]] ในกลุ่ม [[tbl-group-ap-ar]]
- เอกสารต้นทาง: ใบขาย/ซื้อ/โพสบิล [[tbl-ic-trans]]; เอกสารรับ-จ่ายชำระ [[tbl-ap-ar-trans]]; สมุดเงินฝาก [[tbl-erp-pass-book]]; ธนาคาร [[tbl-erp-bank]]
- ลงบัญชี: [[tbl-gl-journal]] (เงินสดย่อยดึงผังบัญชีจาก `cb_petty_cash.chart_of_account` ที่ `gl_template.go:202`, `:571-580`; เอกสาร 300/301 `service.go:2218-2230`) — [[acc-gl-posting-standard]], [[acc-gl-template-engine]]

## ใครเขียน (ที่เห็นในโค้ด)

- แท็บรับ/จ่ายของเอกสารทั่วไป: `payStmts` `trans.go:1338-1538` (INSERT `cb_trans` ที่ `:1379-1386`, `cb_trans_detail` ที่ `:1509-1530`); ใบรับ/จ่ายชำระหนี้ 19/239 เรียก `payStmts` ที่ `docs.go:373` และลบที่ `docs.go:491-493`; ลบเอกสาร `trans.go:425-427`
- ช่องทางอื่น: POS `pos_bill.go:421-510` (`savePosPaymentTx`); ขายสินทรัพย์เงินสด `fa_sale.go:558`; รายได้/รายจ่ายอื่น `pay_other.go:122-126`; มัดจำ/เงินล่วงหน้า `trans_deposit.go:121-138`; เช็คยกมา/ส่งต่อ 405/406 `cheque_forward.go:20-51`; ปรับยอดภาษี ณ จุดจ่ายใน `cb_trans` `pay_check.go:78`
- ตาม `status`/`last_status` ของเอกสารเจ้าของ: `doc_flow.go:263-264` (`cb_trans.status`, `cb_trans_detail.last_status`), `service.go:732-733` (ตรวจ flow ซ้ำ) — ภาพรวม [[acc-payment-tab]], [[acc-deposit-advance]]
- `cb_chq_list.status`: คำนวณใหม่โดย `chequeStatusSQL` (`cheque.go:32-64`) หลังบันทึกเอกสารเช็ค (`trans.go:619-626`) และเรียกซ้ำได้ที่ `POST /process/cheque/rebuild` (`cheque_handler.go:15`) — [[acc-cheque-transfer]]
- ยกเลิก/แก้เอกสาร: ลบแล้วสร้างใหม่ตามกฎ [[acc-transaction-delete-edit]], [[proc-doc-cancel-approve]]

## ใครอ่าน

- รายงาน CB และเงินสดย่อย: `report_menu_cb.go` (ทะเบียนเช็ค `:556-586`, ป้ายสถานะเช็ค `:152`, เงินสดย่อย `:667-743`) — [[proc-report-engine]]
- ตรวจวงเงินเครดิตลูกค้าจากเช็ครับที่ยังไม่เคลียร์: `creditChqSQL` (`trans_save_rules.go:610-611`)
- ผังเอกสาร/ย้อนดูต้นทาง-ปลายทาง: `doc_flow.go`, `doc_flow_graph.go` (อ่านรายการช่องทาง `:1303-1317`); ค้นเอกสารตอนแนบรูปประกอบ `doc_picture.go:169`, `:224`

## ระบบอื่นที่ใช้ตารางกลุ่มนี้

- **Dashboard** — รวม `cb_trans.total_net_amount` เป็น "กระแสเงิน" และ `cb_chq_list.amount` เป็นยอดเช็ค (`dashboard/handler.go:130-131`) โดยรวมทั้งตาราง ไม่กรองสถานะหรือประเภท
- **MCP gateway / AI** — คำอธิบายเครื่องมือระบุ `cb_chq_list(chq_number,doc_no,amount,status)` (`mcp/gateway.go:993`) และเครื่องมือ `cash_bank_flow` อ่าน `cb_chq_list` (`mcp/gateway.go:2171-2183`) — ทั้งสองจุดใช้คอลัมน์ `doc_no` ที่ DDL ของ `cb_chq_list` ไม่มี (มีแต่ `doc_ref`) จึงเป็นข้อบกพร่องของคิวรี; คำอธิบาย `cb_trans` ในคู่มือเครื่องมือที่ `mcp/gateway.go:1420`
- **AutoCare** — ใบกำกับภาษีขายของ AutoCare โพสเป็น `ic_trans` flag 44 + `cb_trans` (`autocare/handler.go:2494`) โดยแปลงวิธีชำระเป็นแท็บชำระเงินของ `appprocess.TransPay` (`invoicePay` `autocare/handler.go:2756-2768`)
- **POS** — โพสบิลเงินสด/โอน/เช็ค/บัตรลง `cb_trans` + `cb_trans_detail` flag 44 (`pos_bill.go:312`, `:421-510`)
- **Frontend** — แท็บรับ/จ่ายใช้ doc_type จาก `TransPayTendersGrid.tsx:11-39`; ยอดเช็คในมือของลูกค้าในหน้าข้อมูลซื้อ-ขายอ่าน `cb_chq_list` ที่ `report/BuySaleInformationScreen.tsx:129-131`; ตัวเลือก lookup `cb_petty_cash` ที่ `master/BcLookupModal.tsx:107`; หน้าจอ master วงเงินสดย่อย `icMasterSchemas.ts:758-784`

## ข้อควรระวัง

- `cb_trans.total_net_amount` = `total_amount` + `total_expense_other` (`trans.go:1383`); dashboard ใช้ผลรวมทั้งตารางจึงปนทั้งรับและจ่าย (`pay_type` 1/2) — อย่าอ่านเป็นยอดสุทธิ
- `cb_chq_list.status` ห้าม UPDATE ตรง — ถูกคำนวณใหม่จากเอกสารที่เกี่ยวข้อง; ตัวเลข `chq_type` = 21 ไม่พบจุด INSERT ใน backend ที่อ่าน
- เงินสดย่อยตัดจ่ายด้วย `doc_type = 4` ใน `cb_trans_detail` (`trans_number` = รหัสเงินสดย่อย) แต่ไม่มีโค้ดเว็บเขียนแถวนี้; `cb_petty_cash.balance_money` เป็นเพียงยอดยกมา — ยอดคงเหลือคำนวณจาก `balance_money` + ความเคลื่อนไหวตอนออกรายงาน (`report_menu_cb.go:695`, `:698`) ไม่ใช่ค่าที่เอกสารอัปเดต
- ตารางเงินทั้งสามห้ามแก้ผ่าน `/query/exec` — ต้องผ่านเส้นทาง process ที่รันกฎธุรกิจในธุรกรรมเดียว (`write_policy.go:10-12`)

## ที่มาในโค้ด

- `scripts/sql/02_data_schema.sql:2058-2272` DDL ตาราง `cb_*`
- `backend/internal/domain/query/write_policy.go:10-12,24`, `write_policy_legacy.go:16`
- `backend/internal/application/process/trans.go:425-427,619-626,1338-1386,1509-1530,1543-1553`
- `backend/internal/application/process/docs.go:373,491-493`
- `backend/internal/application/process/pay_other.go:122-126`, `pay_check.go:78`, `trans_deposit.go:121-138`, `cheque_forward.go:20-51`, `doc_flow.go:263-264`, `service.go:732-733`
- `backend/internal/application/process/pos_bill.go:312,421-510`
- `backend/internal/application/process/fa_sale.go:558`
- `backend/internal/application/process/cheque.go:32-64`
- `backend/internal/application/process/gl_template.go:202,571-580`, `service.go:2218-2230`
- `backend/internal/application/process/report_menu_cb.go:152,556-586,667-743`
- `backend/internal/application/process/trans_save_rules.go:610-611`
- `backend/internal/application/process/doc_flow_graph.go:1303-1317`, `doc_picture.go:169,224`
- `backend/internal/adapter/inbound/http/process/cheque_handler.go:15`
- `backend/internal/adapter/inbound/http/dashboard/handler.go:130-131`
- `backend/internal/adapter/inbound/http/mcp/gateway.go:993,1420,2171-2183`
- `backend/internal/adapter/inbound/http/autocare/handler.go:2494,2756-2768`
- `frontend/account/transaction/TransPayTendersGrid.tsx:11-39`
- `frontend/account/report/BuySaleInformationScreen.tsx:129-131`
- `frontend/account/master/BcLookupModal.tsx:107`
- `frontend/src/config/schemas/icMasterSchemas.ts:758-784`
