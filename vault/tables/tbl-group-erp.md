---
title: "กลุ่มตาราง erp_* — ข้อมูลตั้งค่า/ข้อมูลหลักของบริษัท"
tags: [tables, erp, group, company-db]
aliases: ["erp_*", "ตาราง erp", "กลุ่มตาราง erp", "ตารางตั้งค่าบริษัท"]
sources: ["scripts/sql/02_data_schema.sql:3615", "backend/internal/adapter/inbound/http/admin/workspace_google.go:395", "backend/internal/domain/query/write_policy_legacy.go:17", "backend/internal/domain/query/query.go:63", "backend/internal/adapter/inbound/http/mcp/gateway.go:1809", "backend/internal/platform/db/pool.go:16", "backend/internal/platform/db/pool.go:128", "backend/internal/platform/db/pool.go:217", "backend/internal/application/process/service.go:807", "backend/internal/application/process/service.go:841", "backend/internal/application/process/service.go:881", "backend/internal/application/process/service.go:972", "backend/internal/application/process/province_load.go:149", "backend/internal/application/process/fx.go:115", "backend/internal/application/process/gl_template.go:196", "backend/internal/application/process/pay_other.go:118", "backend/internal/application/process/master_detail_specs.go:23", "backend/internal/application/process/master_detail_specs.go:454", "backend/internal/application/process/master_detail_specs.go:485", "backend/internal/application/process/pos_config.go:97", "backend/internal/application/process/pos_config.go:296", "backend/internal/application/process/report_template.go:200", "backend/internal/application/process/workflow.go:971", "frontend/src/config/schemas/icMasterSchemas.ts:902"]
---

# กลุ่มตาราง `erp_*`

ตารางตั้งค่า/ข้อมูลหลักที่อยู่ใน **ฐานบริษัท (Company Database)** นิยามตาราง (DDL) ส่วนใหญ่อยู่ใน `scripts/sql/02_data_schema.sql` (มีสำเนาซ้ำใน `02b_sync_existing_db.sql`) โค้ด Go สร้างเองด้วย `CREATE TABLE IF NOT EXISTS` เพียง 5 ตาราง คือ `erp_initial`, `erp_thai_qr_config`, `erp_business_ext`, `erp_report_template` และ `erp_user_datalist_config` ที่เหลือโค้ดแค่อ่าน/เขียนหรือเติมคอลัมน์ให้

ฐานบริษัทใหม่ที่สร้างจากหน้าผู้ดูแลถูกคัดโครงสร้างตารางมาจากฐานต้นแบบ `bcdemo` (workspace_google.go:395, เรียกที่ :606) จึงมีคอลัมน์เท่าที่ฐานต้นแบบมีตอนนั้น ซึ่งอาจต่างจากไฟล์ DDL ได้ — คอลัมน์ที่ระบุในโน้ตกลุ่มนี้มาจาก DDL และจากที่โค้ดอ่าน/เขียนจริง

หลักการที่ใช้ร่วมกัน
- หน้าจอ master เขียนตารางผ่านเกตเวย์ `/query/exec` ได้เฉพาะตารางใน write allow-list (ADR-0011; `legacyClientWritable`, write_policy_legacy.go:9-39) ตารางนอกรายการแก้ได้เฉพาะระดับ ≥ 9 (write_policy.go:9-20) และ `erp_option` ต้องระดับ ≥ 9 เสมอ (query.go:63)
- ตารางในกลุ่มนี้ที่ไม่อยู่ใน allow-list: `erp_initial`, `erp_wallet_list`, `erp_thai_qr_config`, `erp_business_ext`, `erp_report_template`, `erp_view_column_custom`, `erp_sale_plan_detail`, `erp_logs`, `erp_user_datalist_config`, `erp_user_group_detail`/`_approve`/`_wh_shelf`, `erp_credit_request`, `erp_credit_approved_logs` (บางตารางเขียนผ่าน master-detail spec หรือ process endpoint ฝั่งเซิร์ฟเวอร์แทน)
- โค้ดเติมคอลัมน์ให้ฐานที่มีอยู่แล้วด้วย `ALTER TABLE … ADD COLUMN IF NOT EXISTS` จากสองชุดคำสั่ง: `companySchemaSQL` (pool.go:16 รันตอนเปิดฐานบริษัท pool.go:217) และ `erpSchemaSQL` (service.go:807 รันครั้งแรกต่อฐาน service.go:972-976)
- ตารางตัวตน/สิทธิ์ผู้ใช้ระดับ Tenant อยู่ฝั่ง Main Database — ดู [[tbl-group-bc]]

## ตารางที่มีโน้ตแยก
- `erp_option` → [[tbl-erp-option]] — สวิตช์/ทศนิยม/ปี พ.ศ. (แถวเดียว; DDL 02_data_schema.sql:2993)
- `erp_user` → [[tbl-erp-user]] — พนักงาน/ผู้ใช้ในบริษัท (DDL 02_data_schema.sql:3773-3837)
- `erp_account_period` → [[tbl-erp-account-period]] — งวดบัญชี เปิด/ปิด (DDL 02_data_schema.sql:2473-2483)
- `erp_company_profile` → [[tbl-erp-company-profile]] — ข้อมูลบริษัท (แถวเดียว; DDL 02_data_schema.sql:2626-2666)
- `erp_pass_book` → [[tbl-erp-pass-book]] — สมุดเงินฝาก (DDL 02_data_schema.sql:3532-3559)
- `erp_bank`, `erp_bank_branch` → [[tbl-erp-bank]] (DDL 02_data_schema.sql:2518-2529, 2534-2545)
- `erp_branch_list` → [[tbl-erp-branch-list]] — สาขา (DDL 02_data_schema.sql:2565-2595)
- `erp_doc_format` → [[tbl-erp-doc-format]] (DDL 02_data_schema.sql:2821-2848); `erp_doc_format_gl` → [[tbl-erp-doc-format-gl]] (DDL 02_data_schema.sql:2853-2868)
- `erp_credit_request`, `erp_credit_approved_logs` → [[tbl-erp-credit-approved-logs]] — คำขอ/บันทึกการอนุมัติเครดิต (DDL 02_data_schema.sql:2719-2739, 2701-2715)
- `erp_user_group`, `_detail`, `_approve`, `_wh_shelf` → [[tbl-erp-user-group-detail]] (DDL 02_data_schema.sql:3842-3894)
- `erp_user_datalist_config` → [[tbl-erp-user-datalist-config]] (โค้ดสร้างเอง)

## ตารางที่อธิบายในหน้านี้ (หนึ่งบรรทัดต่อตาราง)
**ภูมิศาสตร์ / อ้างอิง**
- `erp_province` — จังหวัด: `code`, `name_1`, `name_2`, `lat`, `lng`, `status`, `guid_code` (DDL 02_data_schema.sql:3615-3627) ฟังก์ชัน `ProvinceLoad` (province_load.go:176) ลบแถวตามรหัสแล้วใส่ใหม่จากข้อมูลภูมิศาสตร์ที่ฝังมากับโปรแกรม โดยเก็บพิกัดที่ไม่เป็นศูนย์ของเดิมไว้ (province_load.go:149-155); อยู่ใน allow-list (write_policy_legacy.go:20) · ดู [[std-thai-geo-map-bank-logos]]
- `erp_amper` — อำเภอ: `province`, `code`, `name_1`, `name_2`, `lat`, `lng`, `status`, `guid_code` (DDL 02_data_schema.sql:2500-2513) โหลดด้วย `ProvinceLoad` เช่นกัน (province_load.go:156-163); allow-list บรรทัด 17
- `erp_tambon` — ตำบล: `province`, `amper`, `code`, `name_1`, `name_2`, `lat`, `lng`, `status`, `guid_code` (DDL 02_data_schema.sql:3727-3741) ส่วน `zip_code` VARCHAR(10) ไม่อยู่ใน DDL — เติมด้วย ALTER (service.go:841) และ `ProvinceLoad` เก็บรหัสไปรษณีย์ที่ไม่ว่างของเดิมไว้ (province_load.go:164-171); allow-list บรรทัด 21
- `erp_currency` — สกุลเงิน: `code`, `name_1`, `name_2`, `symbol`, `exchange_rate_present`, `status` (DDL 02_data_schema.sql:2761-2773) โค้ดอ่าน `name_1` กับ `exchange_rate_present` ตามรหัส และปฏิเสธรหัสยาวเกิน 25 ตัวอักษร (fx.go:112-117); allow-list บรรทัด 19 · ดู [[acc-fx-multi-currency]]
- `erp_initial` — คำนำหน้าชื่อ: `roworder` PK, `code` (UNIQUE), `name_1`, `name_2` ไม่มีใน DDL ของ 02 — **โค้ดสร้างเอง** สองที่ (service.go:881 ใน `erpSchemaSQL`, pool.go:128 ใน `companySchemaSQL`) พร้อม seed 9 แถว (นาย นาง นางสาว คุณ บริษัท ห้างหุ้นส่วนจำกัด หจก. บจก. บมจ.) แบบ `ON CONFLICT DO NOTHING` (service.go:887-897); หน้าจออ้างผ่านตารางค้นหากลางของ frontend (lookup-tables.ts:30)

**บัญชี / การเงิน (ผูกกับ GL)**
- `erp_credit_type` — ชนิดบัตรเครดิต: `code`, `name_1`, `name_2`, `charge_rate`, `use_charge_rate`, `account_code`, `status` (DDL 02_data_schema.sql:2742-2755) ตัวลง GL อ่าน `account_code` ตามรหัส (gl_template.go:196); allow-list บรรทัด 18
- `erp_wallet_list` — กระเป๋าเงิน: `code`, `name_1`, `name_2`, `account_code`, `credit_period`, `status` (DDL 02_data_schema.sql:3991-4003) ตัวลง GL อ่าน `account_code` (gl_template.go:204); ไม่อยู่ใน allow-list
- `erp_expenses_list`, `erp_income_list` — รายการค่าใช้จ่าย/รายได้อื่น: `code`, `name_1`, `name_2`, `gl_account_code`, `status` (DDL 02_data_schema.sql:2905-2916, 2932-2943) ตัวลง GL อ่าน `gl_account_code` (gl_template.go:199-200); เอกสารจ่ายอื่นเก็บรหัสใน `cb_trans_detail.trans_number` โดย `doc_type` 11 = ค่าใช้จ่าย, 12 = รายได้ (pay_other.go:118-123) และบันทึกไม่ผ่านถ้ารหัสไม่มีในรายการ (pay_other.go:133-141); allow-list บรรทัด 19
- `erp_pass_book_type` — ประเภทสมุดเงินฝาก: `code`, `name_1`, `name_2`, `remark`, `status` (DDL 02_data_schema.sql:3564-3575) มีหน้าจอกำหนด เมนู 1.6.3 (icMasterSchemas.ts:989-993) ไม่พบโค้ด Go อื่นอ่านตารางนี้; allow-list บรรทัด 20 <!-- pragma: allowlist secret -->
- `erp_book_bank_trans_type` — ตัวย่อในสมุดเงินฝาก: `code`, `name_1`, `name_2`, `status` (DDL 02_data_schema.sql:2550-2560) มีหน้าจอกำหนด เมนู 1.6.4 (icMasterSchemas.ts:998-1002) ไม่พบโค้ด Go อื่นอ่านตารางนี้; allow-list บรรทัด 18 <!-- pragma: allowlist secret -->
- `erp_credit_approve_level` — กลุ่มอนุมัติวงเงิน: `from_amount`, `to_amount`, `user_approve`, `phone_number_approve`, `sale_hub_auth`, `branch_code` (DDL 02_data_schema.sql:2687-2699) หน้าจอกำหนดกลุ่มอนุมัติวงเงิน เมนู 1.3.5 เลือกผู้อนุมัติจาก `erp_user` (icMasterSchemas.ts:902-920) ไม่พบโค้ด Go อื่นอ่านตารางนี้ (ขั้นตอนอนุมัติจริงดู [[tbl-erp-credit-approved-logs]]); allow-list บรรทัด 18 <!-- pragma: allowlist secret -->
- `erp_doc_format_etax` — ตั้งค่า e-Tax ต่อรูปแบบเอกสาร: DDL อยู่ใน `scripts/sql/03_audit_r1_migrations.sql:80-86` (`code` PK, `enable_etax`, `etax_doc_type_code`, `etax_sign_mode`, `updated_at`) ไม่มีใน 02_data_schema.sql; ฝั่ง Go พบเฉพาะใน allow-list (write_policy_legacy.go:33) ดู [[tbl-erp-doc-format]]

**องค์กร / รหัสอ้างอิง**
- `erp_department_list` — แผนก: `code`, `name_1`, `name_2`, `ref_side_code`, `status` (DDL 02_data_schema.sql:2790-2801) master-detail spec ตรวจรหัสแผนกด้วย `refDept` (master_detail_specs.go:24, ใช้ที่ :209, :230) และรายงานบัญชีแสดงชื่อแผนก (report_menu_gl_fa.go:600); allow-list บรรทัด 19
- `erp_side_list` (หน่วยงาน, DDL บรรทัด 3712-3722, allow-list บรรทัด 21), `erp_project_list` (โครงการ, DDL บรรทัด 3600-3610, :20), `erp_job_list` (งาน, DDL บรรทัด 2963-2973, :20), `erp_allocate_list` (การจัดสรร, DDL บรรทัด 2485-2495, :17), `erp_doc_group` (กลุ่มเอกสาร, DDL บรรทัด 2870-2880, :19) — โครงเดียวกัน `code`, `name_1`, `name_2`, `status` (เลขหลัง DDL คือบรรทัดใน 02_data_schema.sql); หน้าผังบัญชี (`gl_chart_of_account`) เลือกรหัสหน่วยงาน/แผนก/จัดสรร/งาน/โครงการผ่านตารางลูก `gl_chart_of_account_*_list` และตรวจว่ารหัสมีในตารางเหล่านี้ (master_detail_specs.go:99-110); รหัสหน่วยงานของเอกสารสินทรัพย์ตรวจด้วย `refSide` (master_detail_specs.go:23, :230) · [[proc-master-data]]

**ตั้งค่า POS / QR / ส่วนเสริม**
- `erp_thai_qr_config` — พร้อมเพย์/QR ต่อ POS: **โค้ดสร้างเอง** (pos_config.go:97-107 พร้อมดัชนี UNIQUE ที่ `pos_id` :108; รันใน `EnsurePosTables` pos_config.go:373) คอลัมน์ที่ Go ประกาศ: `roworder` PK, `pos_id` (ค่าเริ่มต้น `ALL`), `promp_pay_telephone_number`, `promp_pay_wallet_id`, `merchant_name`, `company_biller_id`, `company_terminal_id`, `company_store_id`, `config_type`; มี DDL ใน 02_data_schema.sql:3746-3771 ด้วย (เพิ่ม `service_code`, `ref_1_format`, `ref_2_format`, `prompt_pay_book_code` และความยาวคอลัมน์ต่างจาก Go) — ฐานที่มีตารางอยู่แล้ว `CREATE TABLE IF NOT EXISTS` ของ Go ไม่ทำอะไร; บันทึกจากการตั้งค่า POS (pos_config.go:662) อ่านที่ pos/handler.go:80-83 และ pos_sync.go:591
- `erp_qr_payment` — ตั้งค่า QR Code Payment: ไม่พบ DDL ในสคริปต์หรือโค้ด Go; มีหน้าจอ "กำหนดค่า QR Code Payment" เมนู 1.1.18 ที่มีช่องสมุดเงินฝาก (`pass_book_code`) และรูปแบบ QR (`qr_type` 0-3) (icMasterSchemas.ts:855-880); อยู่ใน allow-list (write_policy_legacy.go:21) <!-- pragma: allowlist secret -->
- `erp_business_ext` — ข้อมูลส่วนขยายต่อเอนทิตี: `entity_type`, `entity_code`, `ext_data` (JSONB), `updated_at`, PK (`entity_type`, `entity_code`) — **โค้ดสร้างเอง** (pos_config.go:296-302) ไม่พบโค้ด Go ที่อ่านหรือเขียน มีเพียงคอมเมนต์ใน editionConfig.ts:1800, 2065 ว่าจะเก็บข้อมูลส่วนขยายของ `ap_supplier` และ `ic_trans` ที่นี่

**รายงาน / หน้าจอ**
- `erp_report_template` — เทมเพลตรายงานที่ผู้ใช้บันทึก: `template_id` PK, `menu_key`, `template_name`, `description`, `is_default`, `is_shared`, `custom_title`, `custom_subtitle`, `custom_sql`, `columns_json`/`page_setup_json` (JSONB), ผู้สร้าง/ผู้แก้, เวลา; ดัชนี `menu_key` (report_template.go:200-217, สร้างเมื่อใช้ครั้งแรก :244, :343) ตั้งค่า default ได้ต่อเมนูเดียว — บันทึกแบบ default ล้างค่าเดิมของเมนูก่อน (:377) และ `set_default` ล้างแล้วตั้งใหม่ใน transaction เดียว (:335, :447-460) · **โค้ดสร้างเอง** · ดู [[proc-report-custom-sql-template]]
- `erp_view_table_custom` — รูปแบบการค้นหาข้อมูลต่อหน้าจอ: `screen_code`, `name_1`, `name_2`, `table_name`, `table_list`, `sort`, `filter`, `width_persent`, `sort_mode`, `status` (DDL 02_data_schema.sql:3971-3987); `erp_view_column_custom` — คอลัมน์ของแต่ละรูปแบบ: `screen_group`, `screen_code`, `column_number`, `column_field_name`, `column_name`, `column_width`, … (DDL 02_data_schema.sql:3916-3935) ไม่มีคอลัมน์ผู้ใช้ จึงมีตาราง `erp_user_datalist_config` แยกสำหรับเลย์เอาต์รายผู้ใช้ (master_datalist.go:14-19); หน้าจอเป็น master-detail (หัว + ตารางคอลัมน์) ของเมนู 1.11.1.1 ที่ master_detail_specs.go:485-493 และ icMasterSchemas.ts:1105-1109; `erp_view_table_custom` อยู่ใน allow-list (บรรทัด 21) ส่วน `erp_view_column_custom` ไม่อยู่ <!-- pragma: allowlist secret -->

**ขาย / ล็อก**
- `erp_sale_plan`, `erp_sale_plan_detail` — แผนการขาย: หัว `code`, `name_1`, `name_2`, `begin_date`, `end_date`, `remark`, `status` (DDL 02_data_schema.sql:3663-3676) และบรรทัด `plan_code`, `sale_area_code`, `sale_code`, `item_code`, `sale_plan_amount`, `remark` (DDL 02_data_schema.sql:3681-3692); บันทึกเป็น master-detail ตรวจเขตการขาย พนักงานขาย (`erp_user`) และสินค้า (master_detail_specs.go:454-470) มีสคีมาหน้าจอสองชุด: เมนู 1.5.14 แบบหน้าจอ master ธรรมดา (icMasterSchemas.ts:972-976) และเมนู 1.2.25 แบบ master-detail (masterDetailSchemas.ts:1485); `erp_sale_plan` อยู่ใน allow-list (บรรทัด 21) ส่วน `erp_sale_plan_detail` ไม่อยู่ <!-- pragma: allowlist secret -->
- `erp_logs` — ประวัติแก้เลข/วัน/ยอดเอกสาร (หน้าประวัติการใช้งานชนิด `full`): `user_code`, `function_code`, `computer_name`, `date_time`, `menu_name`, `doc_date`, `doc_no`, `doc_amount`, `old_doc_date`, `old_doc_no`, `old_doc_amount` (workflow.go:970-972) ไม่มี DDL ในสคริปต์และโค้ด Go ไม่เขียนตารางนี้ — ถ้าฐานไม่มีคอลัมน์ `doc_no` จะตอบ `note` ว่าไม่พบตารางและบอกว่าเก็บไว้ในฐานข้อมูล logs แยก (workflow.go:989-993) · ดู [[proc-workflow]]
- `erp_log_x` — พบเฉพาะในเทสต์นโยบายเขียนเป็นตัวอย่าง "ตารางที่ไม่อยู่ในรายการ" (write_policy_test.go:27-28) ไม่ใช่ตารางจริง

## ใช้ร่วมกับระบบอื่น
อ่านโดย report engine ([[proc-report-engine]]) และ lookup ([[proc-lookup-filters]]) และโดย MCP gateway แบบอ่านอย่างเดียว: รันเฉพาะ SELECT/WITH ใน transaction แบบ READ ONLY (gateway.go:1550-1560, 1801-1812) โดยปฏิเสธ SQL ที่อ้าง `erp_user` ร่วมกับคำว่า `password`/`pass`/`*` (gateway.go:1809-1811)

## ลิงก์
[[proc-master-data]] · [[acc-transaction-save-flow]] · [[tbl-group-bc]]

## ที่มาในโค้ด

- `scripts/sql/02_data_schema.sql:3615` นิยามตารางกลุ่มนี้ (ช่วงบรรทัดของแต่ละตารางระบุในรายการด้านบน)
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:395` `cloneEmptySchemaFromTemplate` คัดโครงสร้างจากฐานต้นแบบ `bcdemo`
- `backend/internal/domain/query/write_policy_legacy.go:17` allow-list การเขียนผ่านเกตเวย์
- `backend/internal/domain/query/query.go:63` `erp_option` เป็นตารางป้องกัน
- `backend/internal/adapter/inbound/http/mcp/gateway.go:1809` กันอ่านคอลัมน์รหัสผ่านของ `erp_user`
- `backend/internal/platform/db/pool.go:16` `companySchemaSQL` (รันที่ :217; `erp_initial` ที่ :128)
- `backend/internal/application/process/service.go:807` `erpSchemaSQL` (รันที่ :972; ALTER `zip_code` ที่ :841; `erp_initial` ที่ :881)
- `backend/internal/application/process/province_load.go:149` SQL โหลดจังหวัด/อำเภอ/ตำบล
- `backend/internal/application/process/fx.go:115` อ่านอัตราแลกเปลี่ยนจาก `erp_currency`
- `backend/internal/application/process/gl_template.go:196` ตัวลง GL อ่านบัญชีของ `erp_credit_type`
- `backend/internal/application/process/pay_other.go:118` เลือกรายการค่าใช้จ่าย/รายได้อื่นตาม `doc_type`
- `backend/internal/application/process/master_detail_specs.go:23` `refSide`/`refDept`/`refBranch`
- `backend/internal/application/process/master_detail_specs.go:454` master-detail แผนการขาย
- `backend/internal/application/process/master_detail_specs.go:485` master-detail รูปแบบการค้นหาข้อมูล
- `backend/internal/application/process/pos_config.go:97` สร้าง `erp_thai_qr_config`
- `backend/internal/application/process/pos_config.go:296` สร้าง `erp_business_ext`
- `backend/internal/application/process/report_template.go:200` สร้าง `erp_report_template`
- `backend/internal/application/process/workflow.go:971` หน้าประวัติการใช้งานชนิด `full` อ่าน `erp_logs`
- `frontend/src/config/schemas/icMasterSchemas.ts:902` สคีมาหน้าจอกำหนดกลุ่มอนุมัติวงเงิน
