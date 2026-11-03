---
title: "ทะเบียนเช็ค/บัตรเครดิต/กระเป๋าเงิน (cb_chq_list)"
tags: [tables, cb]
aliases: ["cb_chq_list", "ทะเบียนเช็ครับ", "ทะเบียนเช็คจ่าย", "ทะเบียนบัตรเครดิต", "cheque register"]
sources: ["scripts/sql/02_data_schema.sql:2058","backend/internal/application/process/trans.go:1543","backend/internal/application/process/cheque.go:32","backend/internal/application/process/cheque_forward.go:20","backend/internal/application/process/report_menu_cb.go:152","backend/internal/application/process/docs.go:435","backend/internal/application/process/trans_save_rules.go:610","backend/internal/application/process/gl_template.go:852","backend/internal/adapter/inbound/http/process/cheque_handler.go:15","backend/internal/adapter/inbound/http/process/permission.go:49","backend/internal/application/process/doc_flow_graph.go:301","backend/internal/application/process/sysproc_ic_checks_data.go:71","backend/internal/application/process/ai_copilot.go:225","backend/internal/adapter/inbound/http/dashboard/handler.go:131","backend/internal/adapter/inbound/http/mcp/gateway.go:2171","backend/internal/domain/query/write_policy.go:24"]
---

# ทะเบียนเช็ค / บัตรเครดิต `cb_chq_list`

ทะเบียนกลางของ **เครื่องมือชำระเงินที่ต้องติดตามสถานะต่อ** — หนึ่งแถวต่อหนึ่งเช็ค/บัตร/รายการกระเป๋าเงิน. **แถวไม่ได้ถูกกรอกโดยตรงจากหน้าจอทะเบียน** (หน้าจอทะเบียนเช็คเป็นแบบดูอย่างเดียว: `errChequeRegisterReadOnly` `docs.go:435`, `docKindCheque` `docs.go:21`) แต่ถูก *สร้างจาก* [[tbl-cb-trans-detail]] ด้วย SQL `chqListFromPaySQL` (`trans.go:1543-1553`) แล้ว `status` ถูก *คำนวณ* ใหม่จากเอกสารเช็คทุกครั้งที่มีการเปลี่ยนแปลง (`chequeStatusSQL` `cheque.go:32-64`).

แนวคิดเช็คโอน/ฝาก/ผ่าน/คืนในเชิงบัญชี: [[acc-cheque-transfer]]; แท็บชำระเงินที่เป็นต้นทาง: [[acc-payment-tab]]. ภาพรวมกลุ่มตาราง: [[tbl-group-cb]].

โครงสร้างตารางมาจาก DDL `scripts/sql/02_data_schema.sql:2058-2093` (สำเนาใน `02b_sync_existing_db.sql:1981`); ไม่มี `CREATE TABLE` ในโค้ด Go. ไม่มีคอลัมน์ `doc_no` — คีย์เอกสารคือ `doc_ref`.

## ชนิด (`chq_type`)

| chq_type | ความหมาย | ที่มา |
|---|---|---|
| 1 | เช็ครับ | `trans.go:1547` (`trans_number_type = 1`) |
| 2 | เช็คจ่าย | ค่าอื่นของ CASE เดียวกัน (`trans.go:1547`) |
| 3 | บัตรเครดิต | `doc_type = 3` ของ detail (`trans.go:1547`) |
| 21 | กระเป๋าเงิน/e-wallet | มีในตรรกะคำนวณสถานะ (`cheque.go:55-56`) และตัวเลือกเช็ค flag 463 (`cheque.go:259-260`) แต่ไม่มี INSERT ใดสร้างแถวชนิดนี้ — `chqListFromPaySQL` สร้างได้เฉพาะ 1, 2, 3. ที่มาของแถว 21 ไม่ชัดจากโค้ด |

## สถานะ (`status`) — ไม่ได้กรอกเอง แต่คำนวณ

`chequeStatusSQL` (`cheque.go:32-64`) หารายการ `ic_trans_detail` **ล่าสุดที่ยังใช้งาน** (`last_status = 0`, จับคู่ด้วย `d.doc_ref = l.doc_ref` และ `d.ref_row = l.doc_line_number` + เลขเช็ค `cheque.go:43-45`) เรียงด้วย `doc_date DESC, doc_time DESC` (กรณีเช็ครับตามด้วย `trans_flag DESC`, แล้ว `roworder DESC`) แล้วแปลง `trans_flag` เป็นสถานะ (`cheque.go:38-41`):

| chq_type | flag เอกสารที่กระทบ → status |
|---|---|
| 1 เช็ครับ | 410 → 1 นำฝาก; 411 → 2 ผ่าน; 412 → 3 รับคืน; 413 → 4 ยกเลิก; 414 → 6 คืนนำเข้าใหม่; 416 → 7 เปลี่ยนเช็ค; 418 → 8 ตั้งหนี้ใหม่; 405 (ยกมา) → 0 |
| 2 เช็คจ่าย | 451 → 2; 452 → 4; 453 → 3; 456 → 7; 406 (ยกมา) → 0 |
| 3 บัตรเครดิต | 461 → 1; 462 → 2 |
| 21 กระเป๋าเงิน | 463 → 1 |

- เลขเช็คที่ใช้จับคู่: 418 ใช้ `item_code`; 416 และ 456 ใช้ `chq_number` ถ้าไม่ว่าง ไม่งั้น `item_code`; flag อื่นใช้ `chq_number` (`cheque.go:46-52`).
- ไม่มีเอกสารที่ตรง → 0 (เช็คในมือ / บัตรปกติ). คำสั่งอัปเดตแตะเฉพาะแถวที่สถานะเปลี่ยนจริง (`cheque.go:64`).
- ป้ายสถานะที่รายงานแสดง: 0 เช็คในมือ, 1 เช็คนำฝาก, 2 เช็คผ่าน, 3 เช็ครับคืน, 4 เช็คยกเลิก, 5 เช็คขายลด, 6 เช็คคืนนำเข้าใหม่, 7 เช็คเปลี่ยน, 8 เช็คตั้งหนี้ใหม่ (`report_menu_cb.go:152`) — ค่า 5 ไม่มี flag ที่ map มาในฟังก์ชันคำนวณนี้ ("ไม่ชัดจากโค้ดว่าใครตั้ง").

## คอลัมน์สำคัญ

จาก INSERT `trans.go:1544-1550` (ชนิดคอลัมน์จาก DDL `02_data_schema.sql:2058-2093`):

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `chq_number` | เลขที่เช็ค/บัตร/อ้างอิงกระเป๋าเงิน (`varchar(25)`; = `cb_trans_detail.trans_number`) | จับคู่สถานะ `cheque.go:46-56`; ตัวเลือกเช็ค `cheque.go:291`, `:296` |
| `doc_ref` | เลขที่เอกสารที่ทำให้เกิดแถว (= `cb_trans_detail.doc_no`) | ลบด้วย `doc_ref + trans_flag` (หัวข้อ "ใครเขียน") |
| `doc_line_number` | ลำดับบรรทัดใน detail (= `line_number`) — ใช้จับคู่ `ic_trans_detail.ref_row` | `trans.go:1550`; `cheque.go:45` |
| `trans_type`, `trans_flag` | ฝั่งและชนิดเอกสารต้นทาง | `trans.go:1550` |
| `chq_get_date` | วันที่รับ/จ่ายเช็ค (= `doc_date`) | `trans.go:1546` |
| `chq_due_date` | วันครบกำหนด (ถ้าไม่ระบุใช้ `doc_date`) | `trans.go:1546`; เรียงตัวเลือกเช็ค `cheque.go:297` |
| `ap_ar_code`, `ap_ar_type` | ลูกหนี้/เจ้าหนี้เจ้าของเช็ค ([[tbl-ar-customer]] / [[tbl-ap-supplier]]) | `trans.go:1546-1547`; ตัวเลือกเช็ค `cheque.go:245`, `:247`; ตัดเครดิต `trans_save_rules.go:610-611` |
| `pass_book_code` | สมุดบัญชีบริษัท ([[tbl-erp-pass-book]]) | `trans.go:1546`; ตัวเลือกเช็ค 451-453 `cheque.go:253-255` |
| `bank_code`, `bank_branch` | ธนาคาร/สาขา ([[tbl-erp-bank]]) | `trans.go:1548`; GL template อ่าน `bank_code` `gl_template.go:852` |
| `amount` | จำนวนเงิน: ถ้า detail ไม่ใช่บัตรและ `sum_amount` ≠ 0 ใช้ `sum_amount` ไม่งั้นใช้ `amount` | `trans.go:1549` |
| `sum_amount` | `COALESCE(sum_amount, amount)` ของ detail | `trans.go:1549` |
| `charge` | ค่าธรรมเนียม (บัตร) | `trans.go:1549` |
| `no_approved`, `credit_card_type` | เลขอนุมัติ / ประเภทบัตร | `trans.go:1550`; GL template อ่าน `credit_card_type` `gl_template.go:854` |
| `external_chq` | เช็คภายนอก (ไม่ผ่านระบบเรา) | `trans.go:1550` |
| `remark` | หมายเหตุ | `trans.go:1546` |
| `status` | สถานะ (ตารางด้านบน) — INSERT ด้วย 0 แล้วคำนวณซ้ำ | `trans.go:1550`, `:1536` |

คอลัมน์ `chq_description`, `book_code`, `bank_description`, `currency_code`, `owner_name`, `person_code`, `side_code`, `department_code`, `guid_code` มีใน DDL แต่ไม่มี INSERT ในโค้ด Go ที่ระบุคอลัมน์เหล่านี้ (`trans.go:1544-1545`).

## ความสัมพันธ์

- ← [[tbl-cb-trans-detail]] (`doc_type IN (2,3)`, `trans_number` ไม่ว่าง, `chq_on_hand = 0`, `last_status = 0` — `trans.go:1552-1553`); เอกสารต้นทางอยู่ใน [[tbl-ap-ar-trans]] / ใบขาย-ซื้อ ผ่าน `doc_ref`
- ↔ [[tbl-ic-trans-detail]]: เอกสารเช็ค (410–418, 451–456, 461–463) อ้างกลับด้วย `doc_ref` + `ref_row` + เลขเช็ค เพื่อกำหนด `status` (`cheque.go:42-56`)
- → [[tbl-erp-pass-book]], [[tbl-erp-bank]]

## ใครเขียน / ใครอ่าน

- **สร้างแถว**: `chqListFromPaySQL` เรียกหลังบันทึกแท็บชำระเงินเมื่อมีเลขเช็ค/บัตร (`trans.go:1533-1536`) และหลัง INSERT เช็คยกมา 405/406 (`cheque_forward.go:49-51`); ทั้งสองทางตามด้วย `chequeStatusSQL` (`trans.go:1536`)
- **ลบแถว** (ลบแล้วสร้างใหม่ทุกครั้งที่บันทึก): แท็บชำระเงิน `payStmts` (`trans.go:1345`); ลบเอกสาร `deleteTransTx` (`trans.go:427`); เอกสารลูกหนี้/เจ้าหนี้ `apArPlan` (`docs.go:493`); เช็คยกมา (`cheque_forward.go:21`)
- **คำนวณ status**: `RebuildChequeStatus` (`cheque.go:68-77`) ถูกเรียกหลังบันทึกเอกสารเช็ค (`trans.go:619-626`; ชุด flag ที่นับ `isChequeFlag` `trans.go:631-633`) และ `RebuildCheque` (`cheque.go:329-355`) ผ่านเส้นทาง `POST /process/cheque/rebuild` (`cheque_handler.go:15`; จำกัดสิทธิ์ผู้ดูแล `permission.go:49`)
- **ตัวเลือกเช็คในเอกสารเช็ค**: เงื่อนไขสถานะต่อ flag `chequeCandidateWhere` (`cheque.go:220-262`) เช่น 410/413 เลือกสถานะ 0 หรือ 3, 411 เลือกสถานะ 1, 412 เลือกสถานะ 1 หรือ 2, 453 เลือกสถานะ 2; ดึงสูงสุด 1,000 แถว เรียงตามวันครบกำหนด (`cheque.go:290-298`)
- **รายงานทะเบียน**: รายการรายงานทะเบียนเช็ครับ/จ่าย/บัตรเครดิต `cbmChqSpecs` (`report_menu_cb.go:556-570`) รันด้วย `cbmRunChq` (`:572-586`); รายงาน Statement ล่วงหน้าเลือกเช็คสถานะ 0-1 และบัตรสถานะ 0 (`report_menu_cb.go:567-568`)
- **อ่านอื่น ๆ**: flow graph (`doc_flow_graph.go:301-305`, `:320`, `:522-540`, `:760-761`, `:1185-1195`); ตรวจ/ซ่อมระบบเติม `doc_ref` ให้บรรทัด `ic_trans_detail` flag 451-456 และ 430-436 ที่ว่าง (`sysproc_ic_checks_data.go:71-75`); AI copilot รายการเช็คและกระทบยอดธนาคาร (`ai_copilot.go:225-237`, `:508-516`); dashboard รวม `amount` ทั้งตาราง (`dashboard/handler.go:131`); GL template (`gl_template.go:852-855`); เครื่องมือ MCP `cash_bank_flow` (`mcp/gateway.go:2171-2183`)
- **เครดิตลูกหนี้**: `creditChqSQL` (`trans_save_rules.go:610-611`) รวม `amount` ของ `chq_type = 1` ของลูกค้าที่สถานะไม่ใช่ 2/7/8 (ผ่าน/เปลี่ยน/ตั้งหนี้ใหม่) ใช้เมื่อเปิดตัวเลือกเช็คนับเครดิต (`trans_save_rules.go:554`) ([[tbl-ar-customer-detail]])

## ข้อควรระวัง

- **ห้ามแก้ `status` ตรง** — ค่าถูกคำนวณจาก `ic_trans_detail` ล่าสุด หากแก้มือจะถูกทับเมื่อ rebuild (`cheque.go:64`); ถ้าเอกสารเช็คถูกยกเลิก (`last_status` ≠ 0) สถานะย้อนกลับเองเมื่อคำนวณใหม่ (`cheque.go:43`).
- ตารางเงิน: INSERT/UPDATE/DELETE ผ่าน `/query/exec` ถูกปฏิเสธ แก้ผ่าน `/api/process` เท่านั้น (`write_policy.go:24` มี `cb_chq_list`; ดู ADR-0011 ที่ `write_policy.go:10`).
- คู่ `(chq_number, doc_ref)` ไม่ใช่ unique constraint — DDL (`02_data_schema.sql:2058-2093`) ไม่มี PRIMARY KEY/UNIQUE; เช็คเลขเดียวกันอาจมีหลายแถวถ้ารับหลายครั้ง และการจับคู่สถานะใช้ `doc_ref` + `ref_row` ประกอบ.
- ถ้าเลือกเช็คเปลี่ยน/ตั้งหนี้ใหม่ (416/418/456) ต้องส่งรหัสลูกค้า `CustCode` ไปด้วย เพราะ `ap_ar_code` ของแถวเดิมใช้เป็นเงื่อนไข (`cheque.go:245`, `:247`).
- `cb_trans_detail.chq_on_hand <> 0` ทำให้ไม่สร้างแถวทะเบียน (`trans.go:1553`); ไม่มีโค้ดเว็บที่ตั้ง `chq_on_hand` ให้ไม่ใช่ 0 ([[tbl-cb-trans-detail]]).
- **คิวรีที่ผิดคอลัมน์**: เครื่องมือ MCP `cash_bank_flow` เลือกคอลัมน์ `doc_no` จาก `cb_chq_list` (`mcp/gateway.go:2174`) แต่ DDL ไม่มีคอลัมน์นี้ (มีแต่ `doc_ref`) — คำสั่งนี้จะ error เมื่อรันกับฐานที่สร้างจาก DDL ปัจจุบัน.

## ที่มาในโค้ด

- `scripts/sql/02_data_schema.sql:2058-2093` DDL
- `backend/internal/application/process/trans.go:427,619-633,1345,1533-1536,1543-1553`
- `backend/internal/application/process/cheque.go:32-77,220-262,290-298,329-355`
- `backend/internal/application/process/cheque_forward.go:20-21,49-51`
- `backend/internal/application/process/docs.go:21,432,493`
- `backend/internal/application/process/report_menu_cb.go:152,556-586`
- `backend/internal/application/process/trans_save_rules.go:554,610-611`
- `backend/internal/application/process/doc_flow_graph.go:301-320,522-540,760-761,1185-1195`
- `backend/internal/application/process/sysproc_ic_checks_data.go:71-75`
- `backend/internal/application/process/gl_template.go:852-855`
- `backend/internal/application/process/ai_copilot.go:225-237,508-516`
- `backend/internal/adapter/inbound/http/dashboard/handler.go:131`
- `backend/internal/adapter/inbound/http/mcp/gateway.go:2171-2183`
- `backend/internal/adapter/inbound/http/process/cheque_handler.go:13-15`, `permission.go:49`
- `backend/internal/domain/query/write_policy.go:10,24`
