---
title: Data Dictionary & Database Schema Overview — โครงสร้างฐานข้อมูล BC AI Account
tags: [dev, schema, overview, postgres, data-dictionary]
aliases: [schema overview, database schema, โครงสร้างฐานข้อมูล, ตารางหลัก]
sources:
  - scripts/sql/02_data_schema.sql:1-9928
  - scripts/sql/03_audit_r1_migrations.sql:1-153
  - backend/internal/application/process/service.go:823-974
  - backend/internal/application/process/doc_flow.go:14-100
---

# Data Dictionary & Database Schema Overview — โครงสร้างฐานข้อมูล BC AI Account

ฐานข้อมูลบริษัท (Company DB) บน PostgreSQL ของ BC AI Account สืบทอดโครงสร้างมาจาก BC Account 5.5 / CHAMP และต่อยอดด้วยตารางเฉพาะทางของระบบใหม่ใน Go Process Engine (ดูแนวทางการใช้งานร่วมกับ [[dev-rules-accounting-sql]], [[sql-overview]], [[doctypes-overview]], [[api-overview]], [[arch-overview]], [[playbook-dev]] และ [[dev-integration-quickstart]])

## ลักษณะทางสถาปัตยกรรมที่นักพัฒนาต้องรู้ก่อน Query

1. **ตารางรุ่นดั้งเดิม (`scripts/sql/02_data_schema.sql`) ไม่มี SQL `PRIMARY KEY` / `FOREIGN KEY`**
   - ใช้คอลัมน์มาตรฐาน 5 ตัวบนทุกตารางหลัก: `ignore_sync INTEGER DEFAULT 0`, `is_lock_record INTEGER DEFAULT 0`, `roworder SERIAL NOT NULL`, `create_date_time_now TIMESTAMP DEFAULT now()`
   - ความเป็นเอกลักษณ์ (Natural Key เช่น `code`, `doc_no`, `(doc_no, trans_flag)`) ถูกบังคับด้วย Advisory Lock / Validation ใน Go Backend และใช้ `CREATE INDEX` ธรรมดาเพื่อช่วยค้นหา
   - ตารางรุ่นใหม่ที่สร้างผ่าน Migration หรือ Go DDL (`erp_feature_option`, `erp_user_datalist_config`, `erp_doc_format_etax`, `erp_record_lock`, `ic_bom_header`, `ic_assembly_order`, `ar_contract`, `ap_contract` ฯลฯ) จะมี SQL `PRIMARY KEY` ชัดเจน
2. **Soft Cancel & Null-Safety (`last_status`)**
   - เอกสารยกเลิกใช้ `last_status = 1` ดังนั้น **ทุก Query เอกสารที่ยังมีผลต้องกรอง `COALESCE(last_status, 0) = 0`** เสมอ (ห้ามใช้แค่ `last_status = 0` เพราะค่าเดิมอาจเป็น `NULL`)
3. **ห้ามใช้ Binary Float กับเงิน/จำนวน/ราคา (`NUMERIC` Only)**
   - คอลัมน์จำนวนเงิน ต้นทุน ราคา และจำนวนในตารางธุรกรรมเป็น `NUMERIC` ทั้งหมด การคำนวณยอดรวมใน Go ใช้ `*big.Rat` และใน SQL ต้องคำนวณด้วย `NUMERIC` ห้าม `::float8` หรือ `::double precision`
   - สูตรแปลงหน่วยนับสินค้ามาตรฐานคือ `qty * COALESCE(NULLIF(stand_value, 0), 1) / COALESCE(NULLIF(divide_value, 0), 1)`
4. **ความหมายของชื่อคอลัมน์ที่ไม่ตรงตามชื่อที่คาด**
   - ในตารางสต็อกและเจ้าหนี้/ลูกหนี้ `ic_trans` และ `ic_trans_detail` ใช้ `cust_code` เก็บทั้ง **รหัสลูกค้า (`ar_customer.code`) และรหัสเจ้าหนี้ (`ap_supplier.code`)** แยกตาม `trans_flag`
   - ค่า `status` บนตารางมาสเตอร์ส่วนใหญ่: `0 = ใช้งาน (Active)`, `1 = ปิดใช้งาน (Inactive)`
   - วัน/เวลาในฐานข้อมูลเก็บเป็น **ปี ค.ศ. (AD)** เสมอ แล้วค่อยแปลงแสดง พ.ศ. ที่ฝั่ง UI/Report ตาม `erp_option.year_type = 1`

---

## แผนผังกลุ่มตารางหลัก (Core Schema Catalog)

### 1. ERP Core & System Configuration (`erp_*`)
- [[tbl-erp-company-profile]] — ข้อมูลกิจการและที่ตั้งสาขา (`erp_company_profile`, `erp_business_ext`, `erp_tax_id_directory`, `erp_data_center`)
- [[tbl-erp-option]] — สวิตช์พารามิเตอร์ระบบกลาง 190+ ข้อและ Feature Switchboard (`erp_option`, `erp_feature_option`, `erp_option_etax_inet`, `erp_option_mobillyst`)
- [[tbl-erp-branch-department]] — โครงสร้างองค์กร สาขา ฝ่าย แผนก งาน โครงการ และงบประมาณ (`erp_branch_list`, `erp_side_list`, `erp_department_list`, `erp_job_type`, `erp_job_list`, `erp_project_list`, `erp_allocate_list`, `erp_department_budget`)
- [[tbl-erp-doc-format]] — เลขที่เอกสารอัตโนมัติ 163 รหัสมาตรฐาน, ผังการลงบัญชี, e-Tax (`erp_doc_format`, `erp_doc_format_gl`, `erp_doc_format_etax`, `erp_doc_group`, `erp_ref_document`, `erp_request_order`, `erp_doc_approve`)
- [[tbl-erp-account-period]] — งวดบัญชีเปิด/ปิด, ตารางอนุมัติ, Batch e-WHT, เอกสารติดตาม (`erp_account_period`, `erp_approval_matrix_rule`, `erp_approval_request`, `erp_etax_ewht_batch`, `erp_missing_doc_request`)
- [[tbl-erp-currency-fx]] — สกุลเงิน, อัตราแลกเปลี่ยน, ธนาคาร, สมุดบัญชี, Wallet และ Thai QR (`erp_currency`, `erp_exchange_rate`, `erp_bank`, `erp_bank_branch`, `erp_pass_book_type`, `erp_pass_book`, `erp_book_bank_trans_type`, `erp_wallet_list`, `erp_thai_qr_config`)
- [[tbl-erp-geo-reason-master]] — ข้อมูลภูมิศาสตร์ไทย, คำนำหน้า, ค่าใช้จ่าย/รายได้อื่นๆ, เหตุผล (`erp_province`, `erp_amper`, `erp_tambon`, `erp_initial`, `erp_expenses_list`, `erp_income_list`, `erp_cn_reason`, `erp_package_reason`, `erp_insure_type`)
- [[tbl-erp-credit-approval-hr]] — ประเภทบัตรเครดิต, อนุมัติวงเงินขายเชื่อ, แผนการขาย และ Payroll SSO (`erp_credit`, `erp_credit_type`, `erp_credit_approve_level`, `erp_credit_approved_logs`, `erp_credit_request`, `erp_sale_plan`, `erp_sale_plan_detail`, `erp_payroll_run`, `erp_payroll_line`)
- [[tbl-erp-view-log-util]] — สิทธิ์กลุ่มงาน, Record Lock, View/Report Template, Log ยกเลิก/พิมพ์ (`erp_user_group*`, `erp_user_datalist_config`, `erp_record_lock`, `erp_view_*`, `erp_report_template`, `erp_cancel_logs`, `erp_print_logs`, `erp_images`)

### 2. AR / AP Master, Contracts & Debt Ledger (`ar_*`, `ap_*`, `ap_ar_*`)
- [[tbl-ar-customer]] — ทะเบียนลูกค้า/ลูกหนี้และข้อมูลเครดิต (`ar_customer`, `ar_customer_detail`, `ar_contactor`, `ar_customer_connected`, `ar_item_by_customer`)
- [[tbl-ar-master-groups]] — ตารางกลุ่ม/ประเภท/พื้นที่ขาย/ดีลเลอร์/เงื่อนไขวางบิลของลูกหนี้ (`ar_type`, `ar_group*`, `ar_sale_area`, `ar_dealer`, `ar_shoptype1`–`7`, ฯลฯ)
- [[tbl-ar-contract-marketplace]] — สัญญาลูกค้า, ฝากขาย, กลุ่มเครดิต, ค่าปรับ, คอมมิชชั่น, เงินประกันผลงาน และ Marketplace (`ar_contract*`, `ar_consignment_*`, `ar_credit_group*`, `ar_commission_*`, `ar_ap_retention_ledger`, `ar_marketplace_*`)
- [[tbl-ap-supplier]] — ทะเบียนเจ้าหนี้/ผู้ขาย (`ap_supplier`, `ap_supplier_detail`, `ap_contactor`, `ap_supplier_connected`, `ap_item_by_supplier`)
- [[tbl-ap-master-contract]] — ประเภท/กลุ่ม/มิติเจ้าหนี้ และสัญญาซื้อ/SLA (`ap_type`, `ap_group*`, `ap_dimension`, `ap_contract*`)
- [[tbl-ar-ap-trans]] — หัวเอกสารฝั่งการเงินลูกหนี้/เจ้าหนี้: รับชำระหนี้ จ่ายชำระหนี้ วางบิล (`ap_ar_trans`)
- [[tbl-ar-ap-trans-detail]] — ตารางลูกหนี้-เจ้าหนี้แบบ 3+ บทบาท: รายการตัดบิล, รายการมัดจำ/ล่วงหน้า และตัวเชื่อม PO/ตรวจนับ Lot (`ap_ar_trans_detail`, `ap_ar_trans_detail_draft`, `ap_ar_transport_label`, `ap_ar_resource`)
- [[tbl-ar-ap-debt-balance]] — ยอดตั้งต้นหนี้และประวัติวางบิล/ตัดบิล (`ap_ar_debt_balance`, `ap_ar_debt_billing*`)
- [[tbl-ar-ap-pay-bill-deposit]] — ตารางจ่ายบิลและเงินมัดจำย่อย (`ap_ar_pay_bill`, `ap_ar_pay_bill_detail`, `ap_ar_deposit_money`)

### 3. Inventory Control & Transactions (`ic_*`)
- [[tbl-ic-trans]] — หัวเอกสารซื้อ ขาย คลัง โอน รับเข้า เบิกออก มัดจำ ล่วงหน้า ทั้งหมด (`ic_trans`)
- [[tbl-ic-trans-detail]] — บรรทัดสินค้ารายตัวของทุกเอกสาร + สูตรคำนวณคงเหลือและต้นทุน (`ic_trans_detail`)
- [[tbl-ic-trans-detail-lot]] — รายการระดับ Lot / วันหมดอายุ (`ic_trans_detail_lot`)
- [[tbl-ic-trans-serial-number]] — ความเคลื่อนไหว Serial Number รายชิ้น (`ic_trans_serial_number`)
- [[tbl-ic-trans-extensions]] — ตารางเพิ่มเติม/Temp/Draft/Shipment/มิติย่อย/WMS ของธุรกรรมสินค้า (`ic_trans_additional`, `ic_trans_temp`, `ic_trans_draft`, `ic_trans_shipment`, `ic_trans_detail_*`, `ic_wms_trans*`, ฯลฯ)
- [[tbl-ic-inventory]] — มาสเตอร์สินค้า วิธีคำนวณต้นทุน (`cost_type`), ยอดสะสม (`average_cost`, `balance_qty`), หน่วยหลัก (`ic_inventory`, `ic_account_group`, `ic_name_*`)
- [[tbl-ic-inventory-detail]] — ตั้งค่าขั้นสูงของสินค้า (สะสมแต้ม, บัญชีเฉพาะตัว, ควบคุมยอดติดลบ `balance_control`, มิติ 1–45, Bundle/สินค้าทดแทน) (`ic_inventory_detail`, `ic_inventory_permission`, `ic_inventory_bundle`, ฯลฯ)
- [[tbl-ic-inventory-barcode]] — รหัสบาร์โค้ด เงื่อนไข ราคาขายตามบาร์โค้ด และระดับสต็อก (`ic_inventory_barcode`, `ic_inventory_barcode_condition`, `ic_inventory_barcode_price`, `ic_inventory_level`)
- [[tbl-ic-inventory-price]] — ตารางราคาขาย สูตรคำนวณราคา ราคารับซื้อ ส่วนลด และชุดสินค้า Set (`ic_inventory_price*`, `ic_price_formula_template`, `ic_inventory_purchase_price`, `ic_purchase_price*`, `ic_inventory_discount`, `ic_inventory_set*`)
- [[tbl-ic-unit]] — หน่วยนับ ตัวคูณแปลงหน่วย และหน่วยนับขนาน/คู่ตรงข้าม (`ic_unit`, `ic_unit_type`, `ic_unit_use`, `ic_opposite_unit`, `ic_size*`, `ic_color*`, `ic_pattern*`)
- [[tbl-ic-warehouse-shelf]] — คลังสินค้า ที่เก็บ/ชั้นวาง จุด Reorder และกลุ่มตำแหน่งคลัง (`ic_warehouse`, `ic_shelf`, `ic_wh_shelf`, `ic_inventory_wh`, `ic_warehouse_location_group*`)
- [[tbl-ic-serial-cost-lot]] — ทะเบียน Serial, ต้นทุนมาตรฐาน, Lot Expiry FEFO, คำร้องตัดทำลาย, RMA, QC และ Stock Build/Temp (`ic_serial*`, `ic_standard_cost`, `ic_cost_date`, `ic_lot_manage`, `ic_lot_expiry_register`, `ic_writeoff_petition`, `ic_warranty_rma_ticket`, `ic_quality_control`, `ic_qc_lab`, `ic_stk_build*`, `stock_expire_*temp`)
- [[tbl-ic-hidden-cost-process]] — ประมวลผลต้นทุนแฝง / นำเข้า และต้นทุนตามน้ำหนัก (`ic_hidden_cost_process*`, `ic_weight_cost*`, `ic_import_duty`)
- [[tbl-ic-bom-assembly]] — สูตรผลิต BOM, ใบสั่งประกอบ/แยกชุด และสูตรผลิต C# (`ic_bom_header`, `ic_bom_detail`, `ic_assembly_order`, `ic_formular*`, `ic_production_formula*`)
- [[tbl-ic-promotion-master]] — คุณลักษณะสินค้า (หมวด ยี่ห้อ รุ่น สี ไซส์ มิติ ฯลฯ), โปรโมชั่น, ของแถม และแต้มสมาชิก POS (`ic_type`, `ic_group*`, `ic_category*`, `ic_brand`, `ic_promotion*`, `ic_purchase_permium*`, `pos_point_*`, `point_center_*`)

### 4. กลุ่มตารางโมดูลการเงินและระบบต่อขยายอื่นๆ (ดูเฉพาะหัวข้อใน Schema)
- **Cash & Bank / Cheque (`cb_*`)**: `cb_trans`, `cb_trans_detail`, `cb_chq_list`, `cb_credit_card`, `cb_trans_bank_reconcile` ฯลฯ
- **General Ledger & Tax (`gl_*`)**: `gl_journal`, `gl_journal_detail`, `gl_chart_of_account`, `gl_journal_book`, `gl_journal_vat_buy`, `gl_journal_vat_sale`, `gl_wht_list`, `gl_wht_list_detail` ฯลฯ
- **Fixed Assets (`as_*`)**: `as_asset`, `as_trans`, `as_trans_detail` ฯลฯ
- **ระบบเสริม (`pos*`, `autocare_*`, `wms_*`, `tms_*`, `crm_*`, `procure_*`, `etax_*`)**: ใช้รหัสตารางตามโมดูลเฉพาะทางที่ต่อยอดบนฐานเดียวกัน

---

## ความสัมพันธ์หลักระหว่างกลุ่มตาราง (Core Relational Flow)

```sql
-- ตัวอย่าง Pattern มาตรฐาน: ยอดคงเหลือสินค้าจาก Transaction ดิบ (ไม่พึ่ง counter สะสม)
SELECT d.item_code,
       i.name_1,
       d.wh_code,
       d.shelf_code,
       SUM(
         d.qty * d.calc_flag
         * COALESCE(NULLIF(d.stand_value, 0), 1)
         / COALESCE(NULLIF(d.divide_value, 0), 1)
       ) AS qty_base
FROM ic_trans_detail d
JOIN ic_inventory i ON i.code = d.item_code
WHERE COALESCE(d.last_status, 0) = 0
  AND d.is_doc_copy = 0
  AND d.item_type NOT IN (3, 5)
GROUP BY d.item_code, i.name_1, d.wh_code, d.shelf_code;
```
- [[uses_table::tbl-cb-bank-book-master]] — ตารางทำเนียบธนาคาร สาขา และสมุดบัญชีเงินฝาก (`cb_bank`, `cb_bank_branch`, `cb_book_bank`)
- [[uses_table::tbl-auto-bill-and-print-audit]] — ตารางกฎวางบิลอัตโนมัติ ประวัติการพิมพ์ Hash Chain รูปเอกสาร และพนักงาน (`ar_auto_bill_rule`, `erp_print_audit_log`, `erp_doc_picture`, `erp_user`)
- [[uses_table::tbl-tenant-workspace-governance]] — ตารางทะเบียนฐานข้อมูลบริษัท กลุ่มผู้ใช้ สิทธิ์เมนู และภาษา (`bc_database_list`, `bc_group_list`, `bc_permission_links`, `bc_language`)
