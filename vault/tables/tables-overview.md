---
title: "ภาพรวมพจนานุกรมข้อมูล: ตารางฐานข้อมูล (tables overview)"
tags: [tables, ic, gl, ap-ar, cb, as, erp, bc]
aliases: ["tables overview", "ER overview", "แผนที่ตาราง", "data dictionary"]
sources: ["scripts/sql/02_data_schema.sql:6571", "scripts/sql/01_main_schema.sql:49", "backend/internal/application/process/trans.go:510", "backend/internal/application/process/trans.go:593", "backend/internal/application/process/trans.go:642", "backend/internal/application/process/trans.go:657", "backend/internal/application/process/service.go:807", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/domain/query/write_policy_legacy.go:9"]
---
# ภาพรวมพจนานุกรมข้อมูล: ตารางฐานข้อมูล

**ขอบเขต:** ตารางที่ `backend/` (Go) และ `frontend/account/` ใช้จริง ระบบอื่น (`autocare_`, `wms_`, `pos_`, `tms_`, `market_`, `procure_`, `crm_` ฯลฯ) ไม่ได้อธิบายรายละเอียด — ใช้โดยระบบอื่น ถ้าต้องดูให้เปิดโค้ดระบบนั้น

## ข้อเท็จจริงที่ใช้ร่วมกันทุกตาราง

- DDL ของตารางส่วนใหญ่อยู่ใน `scripts/sql/02_data_schema.sql` (ตารางตัวตน `bc_` ใน `scripts/sql/01_main_schema.sql`) แต่ DDL ไม่ครบทุกคอลัมน์ที่โค้ด Go ใช้: Go เพิ่มคอลัมน์/ดัชนี/ตารางเองด้วย `erpSchemaSQL` (`service.go:807-958`) และ `ALTER TABLE … ADD COLUMN IF NOT EXISTS` เฉพาะที่ — โน้ตทุกใบจึงเทียบ DDL กับ INSERT/SELECT และ struct ในโค้ด และบอกคอลัมน์ที่อยู่ฝั่งเดียว; ตารางที่ไม่มี DDL ใน repo ระบุไว้ในโน้ตนั้น (เช่น [[tbl-ic-hidden-cost-process]])
- เอกสารทุกชนิดใช้คีย์ (`doc_no`, `trans_flag`) และ `doc_no` ถูกแปลงเป็นตัวพิมพ์ใหญ่ก่อนบันทึก (`normalizeDocNo` `trans.go:642`) รหัส `trans_flag` ทั้งหมดดู [[acc-trans-flag-map]]
- บันทึกเอกสาร = ลบของเดิมแล้วสร้างใหม่ใน transaction เดียว (`saveTransTx` `trans.go:510`) จากนั้นสร้างซีเรียลใหม่ แล้ว `rebuildTransDerived` (`trans.go:593`) คำนวณสต๊อก/ต้นทุน → สมุดรายวัน → สถานะเช็ค ตามลำดับ ([[acc-transaction-save-flow]]) จึงห้ามใช้ `roworder` เป็นคีย์ถาวร
- ค่าที่ derive ไม่ควรแก้ตรง: `ic_inventory.balance_qty/average_cost`, `ic_trans_detail.average_cost/sum_of_cost`, `ic_serial`, `last_status/used_status/doc_success` ของหัวเอกสาร ([[acc-inventory-stock-rebuild]], [[acc-inventory-cost-moving-average]])
- ตารางเงิน (`ap_ar_trans` ฯลฯ) แก้ได้ผ่านงานประมวลผลเท่านั้น ส่วน master จำนวนหนึ่งแก้ผ่าน `/query/exec` ตาม legacy write allow-list (ADR-0011, `write_policy_legacy.go:9`) ดู [[proc-master-data]], [[proc-dispatcher]]
- ค่าเงิน/จำนวนที่กระทบเงินเป็น decimal ส่งเป็น string (กฎเหล็กข้อ 20)
- มาตรฐานลงบัญชี: [[acc-gl-posting-standard]]; ข้อยกเว้นสต๊อกพิเศษ: [[acc-stock-special-docs]]

## ตระกูลตาราง (7 กลุ่ม)

| กลุ่ม | prefix | โน้ตกลุ่ม | ตารางหลักที่มีโน้ต |
|---|---|---|---|
| สินค้า/คลัง/สต๊อก/เอกสารซื้อ-ขาย | `ic_` | [[tbl-group-ic]] | 20 ตาราง/ชุด |
| บัญชีแยกประเภท | `gl_` | [[tbl-group-gl]] | 8 ตาราง |
| เจ้าหนี้/ลูกหนี้/วางบิล | `ap_`, `ar_`, `ap_ar_` | [[tbl-group-ap-ar]] | 9 ตาราง |
| เงินสด/ธนาคาร/เช็ค | `cb_` | [[tbl-group-cb]] | 4 ตาราง |
| สินทรัพย์ถาวร | `as_` | [[tbl-group-as]] | 5 ตาราง |
| ตั้งค่า/ข้อมูลหลักบริษัท | `erp_` | [[tbl-group-erp]] | 12 ตาราง/ชุด |
| ตัวตน สิทธิ์ ระบบ | `bc_` | [[tbl-group-bc]] | 5 ตาราง/ชุด |

## ความสัมพันธ์ (ER-style)

### เอกสารสินค้า (ic)
- `ic_trans` 1:n `ic_trans_detail` ผ่าน (`doc_no`, `trans_flag`) — [[tbl-ic-trans]] → [[tbl-ic-trans-detail]]
- `ic_trans` 1:1 `ic_trans_shipment` ผ่าน (`doc_no`, `trans_flag`) — [[tbl-ic-trans-shipment]]
- `ic_trans_detail` 1:n `ic_trans_serial_number` ผ่าน `doc_line_number` = `line_number` — [[tbl-ic-trans-serial-number]]
- `ic_trans_serial_number` n:1 `ic_serial` ผ่าน (`ic_code`, `serial_number`) — [[tbl-ic-serial]] (derive)
- `ic_trans_detail` → `ic_trans_detail_lot` ผ่าน (`doc_no`, `trans_flag`, `line_number`) เฉพาะยอดยกมา/ใบปรับล็อต — [[tbl-ic-trans-detail-lot]]
- `ic_trans.cust_code` → [[tbl-ap-supplier]] เมื่อ `trans_type` 1, 4; → [[tbl-ar-customer]] เมื่อ `trans_type` 2, 5 (`gl_template.go:768-769`)
- `ic_trans_detail.item_code` → [[tbl-ic-inventory]].`code`; `unit_code` → [[tbl-ic-unit-use]] / [[tbl-ic-unit]]; (`wh_code`, `shelf_code`) → [[tbl-ic-warehouse]] / [[tbl-ic-shelf]]
- `ic_trans` 72 (โอนคลัง) 1:1 `ic_trans` 70 (หัวคู่ที่สร้างใหม่ทุกครั้ง) และบรรทัดคู่ n / n+1 ใน `ic_trans_detail`
- `ic_hidden_cost_process` 1:n `_ref` และ `_item` ผ่าน `doc_no`; สร้างใบปรับต้นทุน `ic_trans` flag 66 (`doc_ref` = เลขที่ต้นทุนแฝง) — [[tbl-ic-hidden-cost-process]]

### สินค้า (master)
- `ic_inventory` 1:1 `ic_inventory_detail` ผ่าน `ic_code` — [[tbl-ic-inventory]], [[tbl-ic-inventory-detail]]
- `ic_inventory` 1:n [[tbl-ic-inventory-barcode]] (แล้ว 1:n [[tbl-ic-inventory-barcode-price]]), [[tbl-ic-inventory-price]], [[tbl-ic-unit-use]], [[tbl-ic-opposite-unit]], [[tbl-ic-standard-cost]]
- `ic_inventory` (ชุด, `item_type` 3) 1:n `ic_inventory_set_detail` ผ่าน `ic_set_code` → `ic_code` — [[tbl-ic-inventory-set-detail]]
- `ic_wh_shelf` เชื่อม [[tbl-ic-inventory]] กับ [[tbl-ic-warehouse]] + [[tbl-ic-shelf]] — [[tbl-ic-wh-shelf]]; `ic_shelf` n:1 `ic_warehouse` ผ่าน `ic_shelf.whcode` (ชื่อไม่มี underscore)
- สวิตช์ `erp_option.enable_all_ic_wh_shelf` / `perm_wh_shelf` ควบคุมการใช้ `ic_wh_shelf` และสิทธิ์ผ่าน `erp_user_group_wh_shelf` — [[tbl-erp-option]], [[tbl-erp-user-group-detail]], [[proc-wh-shelf-permission]]

### บัญชีแยกประเภท (gl)
- `gl_journal` 1:n `gl_journal_detail` ผ่าน (`doc_no`, `doc_date`, `book_code`) — [[tbl-gl-journal]], [[tbl-gl-journal-detail]]
- `gl_journal_detail.account_code` → [[tbl-gl-chart-of-account]]; `book_code` → [[tbl-gl-journal-book]]
- เอกสารต้นทาง ([[tbl-ic-trans]], [[tbl-ap-ar-trans]], [[tbl-cb-trans]], [[tbl-as-trans]]) → `gl_journal` ผ่าน `doc_no` + `trans_flag` โดยกฎลงบัญชีมาจาก [[tbl-erp-doc-format-gl]] ตาม [[tbl-erp-doc-format]]
- ภาษี: [[tbl-gl-journal-vat-buy]] / [[tbl-gl-journal-vat-sale]] สร้างจากแท็บภาษีของเอกสาร; หัก ณ ที่จ่าย [[tbl-gl-wht-list]] 1:n [[tbl-gl-wht-list-detail]]

### เจ้าหนี้/ลูกหนี้ (ap-ar)
- [[tbl-ar-customer]] 1:1 [[tbl-ar-customer-detail]]; [[tbl-ap-supplier]] 1:1 [[tbl-ap-supplier-detail]] (ผ่าน `ar_code`/`ap_code` = `code` ของแม่ตามลำดับ); ลูกหนี้ตัวแทน [[tbl-ar-dealer]]; ที่อยู่ขนส่ง [[tbl-ap-ar-transport-label]]; นัดวางบิล [[tbl-ar-credit-pay-bill]]
- [[tbl-ap-ar-trans]] 1:n [[tbl-ap-ar-trans-detail]] ผ่าน (`doc_no`, `trans_flag`); บรรทัดอ้างเอกสารซื้อ-ขายใน [[tbl-ic-trans]] ผ่าน `billing_no` = `ic_trans.doc_no`
- อนุมัติเครดิต: [[tbl-erp-credit-approved-logs]]

### เงินสด/ธนาคาร (cb)
- [[tbl-cb-trans]] (ยอดรวมตามช่องทาง) 1:n [[tbl-cb-trans-detail]] ผ่าน (`doc_no`, `trans_flag`); เกิดจากแท็บรับ/จ่ายชำระของ [[tbl-ic-trans]] และ [[tbl-ap-ar-trans]]
- เช็ค/บัตร: [[tbl-cb-chq-list]] (เอกสาร flag 405-418, 451-456, 461-463 อัปเดตสถานะ — `chequeStatusSQL` `cheque.go:32-64`); บัญชีธนาคาร [[tbl-erp-pass-book]] → [[tbl-erp-bank]]; เงินสดย่อย [[tbl-cb-petty-cash]]

### สินทรัพย์ถาวร (as)
- [[tbl-as-asset]] 1:1 [[tbl-as-asset-detail]] ผ่าน `as_code`; n:1 [[tbl-as-asset-type]]
- [[tbl-as-trans]] 1:n [[tbl-as-trans-detail]] ผ่าน (`doc_no`, `trans_flag`)

### ตั้งค่า ผู้ใช้ และตัวตน
- [[tbl-bc-user-list]] (ล็อกอินใน Main Database) → [[tbl-bc-database-list-user-and-group]] → [[tbl-bc-database-list]] (ทะเบียนบริษัท) ซึ่งชี้ไปยังฐานข้อมูลบริษัทที่เก็บตาราง `ic_/gl_/ap_/ar_/cb_/as_/erp_`
- [[tbl-bc-google-workspace]] (ล็อกอิน Google), [[tbl-bc-mcp-tokens]] (โทเคน MCP อ่านอย่างเดียว)
- ผู้ใช้/พนักงานในบริษัท [[tbl-erp-user]] + กลุ่มสิทธิ์ [[tbl-erp-user-group-detail]] ([[proc-permission-rights]]); เลย์เอาต์รายการข้อมูล [[tbl-erp-user-datalist-config]]
- ตั้งค่าบริษัท: [[tbl-erp-option]], [[tbl-erp-company-profile]], [[tbl-erp-branch-list]], [[tbl-erp-account-period]], [[tbl-erp-doc-format]], [[tbl-erp-doc-format-gl]]

## ดัชนีโน้ตทุกตาราง

**ic:** [[tbl-ic-trans]], [[tbl-ic-trans-detail]], [[tbl-ic-trans-serial-number]], [[tbl-ic-serial]], [[tbl-ic-trans-detail-lot]], [[tbl-ic-trans-shipment]], [[tbl-ic-hidden-cost-process]], [[tbl-ic-inventory]], [[tbl-ic-inventory-detail]], [[tbl-ic-inventory-barcode]], [[tbl-ic-inventory-barcode-price]], [[tbl-ic-inventory-price]], [[tbl-ic-inventory-set-detail]], [[tbl-ic-standard-cost]], [[tbl-ic-unit]], [[tbl-ic-unit-use]], [[tbl-ic-opposite-unit]], [[tbl-ic-warehouse]], [[tbl-ic-shelf]], [[tbl-ic-wh-shelf]]

**gl:** [[tbl-gl-journal]], [[tbl-gl-journal-detail]], [[tbl-gl-chart-of-account]], [[tbl-gl-journal-book]], [[tbl-gl-journal-vat-buy]], [[tbl-gl-journal-vat-sale]], [[tbl-gl-wht-list]], [[tbl-gl-wht-list-detail]]

**ap-ar:** [[tbl-ap-supplier]], [[tbl-ap-supplier-detail]], [[tbl-ar-customer]], [[tbl-ar-customer-detail]], [[tbl-ar-dealer]], [[tbl-ap-ar-trans]], [[tbl-ap-ar-trans-detail]], [[tbl-ap-ar-transport-label]], [[tbl-ar-credit-pay-bill]]

**cb:** [[tbl-cb-trans]], [[tbl-cb-trans-detail]], [[tbl-cb-chq-list]], [[tbl-cb-petty-cash]]

**as:** [[tbl-as-trans]], [[tbl-as-trans-detail]], [[tbl-as-asset]], [[tbl-as-asset-detail]], [[tbl-as-asset-type]]

**erp:** [[tbl-erp-option]], [[tbl-erp-user]], [[tbl-erp-account-period]], [[tbl-erp-company-profile]], [[tbl-erp-pass-book]], [[tbl-erp-bank]], [[tbl-erp-doc-format]], [[tbl-erp-doc-format-gl]], [[tbl-erp-branch-list]], [[tbl-erp-credit-approved-logs]], [[tbl-erp-user-group-detail]], [[tbl-erp-user-datalist-config]]

**bc:** [[tbl-bc-user-list]], [[tbl-bc-database-list]], [[tbl-bc-database-list-user-and-group]], [[tbl-bc-google-workspace]], [[tbl-bc-mcp-tokens]]

**โน้ตกลุ่ม:** [[tbl-group-ic]], [[tbl-group-gl]], [[tbl-group-ap-ar]], [[tbl-group-cb]], [[tbl-group-as]], [[tbl-group-erp]], [[tbl-group-bc]]

## ตารางของระบบอื่น (ไม่อธิบายในชุดนี้)

ตารางขึ้นต้น `autocare_`, `wms_`, `pos_`, `tms_`, `market_`, `procure_`, `crm_` ใช้โดยระบบอื่น (WMS, POS, TMS, ตลาด, จัดซื้อ, CRM) — ถ้า backend บัญชีแตะตารางเหล่านี้ มีแค่การตรวจว่ามีตารางหรือซิงก์ข้อมูล เช่น `ic_wms_trans_detail` (`service.go:641`) และ `pos_` sync (`pos_sync.go`, `pos_bill.go`) ไม่ได้ถือเป็นส่วนหนึ่งของพจนานุกรมนี้

## ความไม่สอดคล้องที่พบ (ไว้ตรวจเมื่อใช้งานจริง)

- `ic_inventory.item_type = 5`: จอสินค้าเรียก "สูตรสี" (`ItemScreen.tsx:2246`) แต่รายงานประเภทสินค้าเรียก "สูตรการผลิต" (`report_menu_ic.go:913`) — [[tbl-ic-inventory]]
- `ic_shelf` ใช้คอลัมน์ `whcode` แต่ตารางอื่นใช้ `wh_code` (`stock_tools.go:384`) — [[tbl-ic-shelf]]
- `erp_doc_format_gl`: ตัวลงบัญชีอ่าน `account_name` (`gl_template.go:962`) แต่ค่าตั้งต้นและเทสต์ใส่ `account_name2` (`gl_template_defaults.go:43`) — [[tbl-erp-doc-format-gl]]
- `erp_credit_approved_logs`: ไม่พบ INSERT ใน Go (อ่านที่ `doc_flow.go:70`, `:290`; ลบที่ `trans_credit.go:203`) ส่วน `erp_credit_request` ถูกเขียนที่ `trans_credit.go:204-210` — [[tbl-erp-credit-approved-logs]]
- CRM อ่าน `ap_ar_trans` flag 41/43 (`crm/handler.go:177-178`) ขณะฝั่ง process ใช้ 235/239 (`docs.go:528`) — [[tbl-ap-ar-trans]]
- ยอดตามล็อต: รายงานอ่าน `ic_trans_detail_lot` (`report_menu_ic.go:1206-1238`) แต่บันทึกเอกสารปกติ (`saveTransTx`) เขียนเฉพาะ `ic_trans_detail.lot_number_1` — `ic_trans_detail_lot` เขียนเฉพาะยอดยกมาและใบปรับล็อต 66/68 (`stock_lot.go:29-30`) — [[tbl-ic-trans-detail-lot]]

## ที่มาในโค้ด

- `scripts/sql/02_data_schema.sql:6571` (ตัวอย่าง DDL `ic_trans`) และ `scripts/sql/01_main_schema.sql:49` (`bc_database_list`)
- `backend/internal/application/process/trans.go:510` (`saveTransTx`), `:593` (`rebuildTransDerived`), `:642` (`normalizeDocNo`), `:657` (`insertTransSQL`)
- `backend/internal/application/process/service.go:807` (`erpSchemaSQL`)
- `backend/internal/application/process/stock_rebuild.go:18` (`stockRowsSQL`)
- `backend/internal/domain/query/write_policy_legacy.go:9` (`legacyClientWritable`)
