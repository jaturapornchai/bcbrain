---
title: "กลุ่มตาราง cb_* — เงินสด ธนาคาร เช็ค และเงินสดย่อย"
tags: [tables, cb, group]
aliases: ["cb_*", "ตารางเงินสดธนาคาร", "Cash Book tables", "กลุ่มตาราง CB"]
sources: ["backend/internal/domain/query/write_policy.go:24", "backend/internal/application/process/trans.go:1380", "backend/internal/application/process/pos_bill.go:421", "backend/internal/application/process/cheque.go:32", "backend/internal/application/process/report_menu_cb.go:692", "backend/internal/adapter/inbound/http/dashboard/handler.go:130"]
---

# กลุ่มตาราง `cb_*`

ตารางฝั่ง **เงินสด-ธนาคาร (Cash Book)**: ช่องทางรับ/จ่ายเงินของเอกสาร, ทะเบียนเช็ค/บัตร, และเงินสดย่อย. ใน SQL ของ `backend/internal` (ไม่รวม `_test`) พบ **เพียง 4 ตาราง** — ไม่มีตาราง `cb_*` อื่นปรากฏในโค้ด backend หรือใน `frontend/account` (จำนวนการอ้างชื่อ: `cb_trans` ~100, `cb_chq_list` ~84, `cb_trans_detail` ~78, `cb_petty_cash` ~8).

**นโยบายเขียน**: `cb_trans`, `cb_trans_detail`, `cb_chq_list` เป็นตารางเงิน — เขียนได้เฉพาะผ่าน `/api/process` (`write_policy.go:24` `moneyTablePattern`); `cb_petty_cash` เป็น master อยู่ใน legacy write allow-list (ADR-0011).

## ตารางที่มีโน้ตแยก

- `cb_trans` → [[tbl-cb-trans]] — หัวสรุปแท็บรับ/จ่ายเงินของเอกสาร: ยอดเงินสด/โอน/เช็ค/บัตร/ค่าใช้จ่ายอื่น และ `pay_type` (1 = รับ, 2 = จ่าย); คอลัมน์สะกด `tranfer_amount` ตามของจริง
- `cb_trans_detail` → [[tbl-cb-trans-detail]] — รายการช่องทางรับ/จ่ายทีละบรรทัด แยกด้วย `doc_type` (1 โอน, 2 เช็ค, 3 บัตรเครดิต, 4 เงินสดย่อย, 5 ใช้เงินล่วงหน้า, 6 ใช้มัดจำ, 11 รายจ่ายอื่น, 12 รายได้อื่น, 21 PromptPay/ e-wallet)
- `cb_chq_list` → [[tbl-cb-chq-list]] — ทะเบียนเช็ค/บัตร/e-wallet (`chq_type` 1 เช็ครับ, 2 เช็คจ่าย, 3 บัตร, 21 wallet) — สร้างจาก `cb_trans_detail` และ `status` คำนวณจากเอกสารเช็ค ไม่กรอกเอง
- `cb_petty_cash` → [[tbl-cb-petty-cash]] — master เงินสดย่อย (รหัส, ชื่อ, ผังบัญชี) ยอดคงเหลือในรายงานคำนวณจากความเคลื่อนไหว

## ความสัมพันธ์หลัก

- `cb_trans` 1 : N `cb_trans_detail` ด้วย (`doc_no`, `trans_flag`); `cb_trans_detail` doc_type 2/3/21 สร้างแถวใน `cb_chq_list` (`chqListFromPaySQL`, `trans.go:1543`)
- คู่ค้า: `cb_trans.ap_ar_code` และ `cb_chq_list.ap_ar_code` ชี้ [[tbl-ar-customer]] / [[tbl-ap-supplier]] ในกลุ่ม [[tbl-group-ap-ar]]
- เอกสารต้นทาง: ใบขาย/ซื้อ/โพสบิล [[tbl-ic-trans]]; เอกสารรับ-จ่ายชำระ [[tbl-ap-ar-trans]]; สมุดเงินฝาก [[tbl-erp-pass-book]]; ธนาคาร [[tbl-erp-bank]]
- ลงบัญชี: [[tbl-gl-journal]] (เงินสดย่อยดึงผังบัญชีจาก `cb_petty_cash.chart_of_account` ที่ `gl_template.go:202`) — [[acc-gl-posting-standard]], [[acc-gl-template-engine]]

## ใครเขียน (ที่เห็นในโค้ด)

- แท็บรับ/จ่ายของเอกสาร: `trans.go:1380` (บันทึกเอกสารทั่วไป) และลบก่อนบันทึกใหม่ที่ `docs.go:491-493`; POS `pos_bill.go:421-490`; ขายสินทรัพย์ `fa_sale.go:558`; รายได้/รายจ่ายอื่น `pay_other.go:123`; มัดจำ/เงินล่วงหน้า `trans_deposit.go:121-133`; เช็คส่งต่อ/โอน `cheque_forward.go:20-39`; ปรับยอดภาษี ณ จุดจ่าย `pay_check.go:78`; ซิงก์ `status`/`last_status` ตามเอกสารต้นทาง `doc_flow.go:263-264`, `service.go:721-722` — ภาพรวม [[acc-payment-tab]], [[acc-deposit-advance]]
- `cb_chq_list.status`: คำนวณใหม่โดย `chequeStatusSQL` (`cheque.go:32-65`) ผ่าน handler โอน/คืนเช็ค (`adapter/inbound/http/process/cheque_handler.go:14`; ฝั่ง service `cheque_forward.go`) — [[acc-cheque-transfer]]
- ยกเลิก/แก้เอกสาร: ลบแล้วสร้างใหม่ตามกฎ [[acc-transaction-delete-edit]], [[proc-doc-cancel-approve]]

## ใครอ่าน

- รายงาน CB และเงินสดย่อย: `report_menu_cb.go` (เงินสดย่อย `:692-723`, สถานะเช็ค `:152`) — [[proc-report-engine]]
- ตรวจวงเงินเครดิตลูกค้าจากเช็ครับที่ยังไม่เคลียร์: `creditChqSQL` (`trans_save_rules.go:610`)
- ผังเอกสาร/ย้อนดูต้นทาง-ปลายทาง: `doc_flow.go`, `doc_flow_graph.go`; รูปประกอบเอกสาร `doc_picture.go`

## ระบบอื่นที่ใช้ตารางกลุ่มนี้

- **Dashboard** — รวม `cb_trans.total_net_amount` เป็น "กระแสเงิน" และ `cb_chq_list.amount` เป็นยอดเช็ค (`dashboard/handler.go:130-131`) โดยรวมทั้งตาราง ไม่กรองสถานะหรือประเภท
- **MCP gateway / AI** — เปิดให้ AI อ่าน `cb_chq_list(chq_number, doc_no, amount, status)` (`mcp/gateway.go:993,2180`) และใส่คำอธิบาย `cb_trans` ในคู่มือเครื่องมือ (`mcp/gateway.go:1420`)
- **autocare** — ใบกำกับภาษีขายของ autocare โพสเป็น `ic_trans` flag 44 + `cb_trans` (ตามคอมเมนต์ `autocare/handler.go:2261`) — ใช้ตารางเดียวกับระบบบัญชี
- **POS** — โพสบิลเงินสด/โอน/เช็ค/บัตรลง `cb_trans` + `cb_trans_detail` flag 44 (`pos_bill.go:312,421-490`)
- **Frontend** — แท็บรับ/จ่ายใช้ doc_type จาก `TransPayTendersGrid.tsx:11-39`, รายการเช็คของหน้าข้อมูลซื้อ-ขาย `report/BuySaleInformationScreen.tsx:130`, ตัวเลือก lookup `cb_petty_cash` ที่ `master/BcLookupModal.tsx:106`

## ข้อควรระวัง

- ไม่มี DDL ของตารางใน repo — คอลัมน์ทั้งหมดในโน้ตมาจาก INSERT/SELECT ที่อ่าน
- `cb_trans.total_net_amount` = `total_amount` + `total_expense_other`; dashboard ใช้ผลรวมทั้งตารางจึงปนทั้งรับและจ่าย (`pay_type` 1/2) — อย่าอ่านเป็นยอดสุทธิ
- `cb_chq_list.status` ห้าม UPDATE ตรง — ถูกคำนวณใหม่จากเอกสารที่เกี่ยวข้อง; ตัวเลข `chq_type` = 21 ไม่พบจุด INSERT ใน backend ที่อ่าน
- เงินสดย่อยตัดจ่ายด้วย `doc_type = 4` ใน `cb_trans_detail` (`trans_number` = รหัสเงินสดย่อย); `cb_petty_cash.balance_money` เป็นเพียงยอดยกมา — ยอดคงเหลือคำนวณจาก `balance_money` + ความเคลื่อนไหวตอนออกรายงาน (`report_menu_cb.go:692-737`) ไม่ใช่ค่าที่เอกสารอัปเดต

## ที่มาในโค้ด

- `backend/internal/domain/query/write_policy.go:24`
- `backend/internal/application/process/trans.go:1380,1543`
- `backend/internal/application/process/docs.go:491-493`
- `backend/internal/application/process/pay_other.go:123`, `pay_check.go:78`, `trans_deposit.go:121-133`, `cheque_forward.go:20-39`, `doc_flow.go:263-264`, `service.go:721-722`
- `backend/internal/application/process/pos_bill.go:312,421-490`
- `backend/internal/application/process/fa_sale.go:558`
- `backend/internal/application/process/cheque.go:32-65`
- `backend/internal/application/process/gl_template.go:202`
- `backend/internal/application/process/report_menu_cb.go:152,692-723`
- `backend/internal/application/process/trans_save_rules.go:610`
- `backend/internal/adapter/inbound/http/process/cheque_handler.go:14`
- `backend/internal/adapter/inbound/http/dashboard/handler.go:130-131`
- `backend/internal/adapter/inbound/http/mcp/gateway.go:993,1420,2180`
- `backend/internal/adapter/inbound/http/autocare/handler.go:2261`
- `frontend/account/transaction/TransPayTendersGrid.tsx:11-39`
- `frontend/account/report/BuySaleInformationScreen.tsx:130`
- `frontend/account/master/BcLookupModal.tsx:106`
