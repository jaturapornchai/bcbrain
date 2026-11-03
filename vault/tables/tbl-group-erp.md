---
title: "กลุ่มตาราง erp_* — ข้อมูลตั้งค่า/ข้อมูลหลักของบริษัท"
tags: [tables, erp, group, company-db]
aliases: ["erp_*", "ตาราง erp", "กลุ่มตาราง erp", "ตารางตั้งค่าบริษัท"]
sources: ["backend/internal/application/process/master_detail_specs.go:25", "backend/internal/application/process/pos_config.go:97", "backend/internal/application/process/report_template.go:200", "backend/internal/application/process/service.go:829", "backend/internal/platform/db/pool.go:128", "backend/internal/application/process/province_load.go:151", "backend/internal/application/process/fx.go:115", "backend/internal/application/process/pay_other.go:118", "backend/internal/application/process/workflow.go:971"]
---

# กลุ่มตาราง `erp_*`

ตารางตั้งค่า/ข้อมูลหลักที่อยู่ใน **ฐานบริษัท (Company Database)** — ส่วนใหญ่เป็น **ตารางเดิม (legacy)** จากโปรแกรมเดิมที่ไม่มี DDL ในโค้ด Go (คอลัมน์ในโน้ตมาจากที่ INSERT/SELECT จริง) ส่วนที่ *โค้ดสร้างเอง* (`CREATE TABLE IF NOT EXISTS`) ระบุไว้ท้ายบรรทัด

หลักการที่ใช้ร่วมกัน
- หน้าจอ master เขียนบางตารางผ่านเกตเวย์ `/query/exec` ตาม legacy write allow-list (ADR-0011) — ตารางที่ไม่อยู่ในรายการแก้ได้เฉพาะระดับ ≥ 9; `erp_option` ต้องระดับ ≥ 9 เสมอ (query.go:63)
- โค้ดเติมคอลัมน์ให้ฐานเก่าเองด้วย `ALTER TABLE … ADD COLUMN IF NOT EXISTS` (platform/db/pool.go, service.go:829-870)
- ตารางตัวตน/สิทธิ์ผู้ใช้ระดับ Tenant อยู่ฝั่ง Main Database — ดู [[tbl-group-bc]]

## ตารางที่มีโน้ตแยก
- `erp_option` → [[tbl-erp-option]] — สวิตช์/ทศนิยม/ปี พ.ศ. (แถวเดียว)
- `erp_user` → [[tbl-erp-user]] — พนักงาน/ผู้ใช้ในบริษัท
- `erp_account_period` → [[tbl-erp-account-period]] — งวดบัญชี เปิด/ปิด
- `erp_company_profile` → [[tbl-erp-company-profile]] — ข้อมูลบริษัท (แถวเดียว)
- `erp_pass_book` → [[tbl-erp-pass-book]] — สมุดเงินฝาก
- `erp_bank`, `erp_bank_branch` → [[tbl-erp-bank]]
- `erp_branch_list` → [[tbl-erp-branch-list]]
- `erp_doc_format` → [[tbl-erp-doc-format]]; `erp_doc_format_gl` → [[tbl-erp-doc-format-gl]]
- `erp_credit_request`, `erp_credit_approved_logs` → [[tbl-erp-credit-approved-logs]]
- `erp_user_group`, `_detail`, `_approve`, `_wh_shelf` → [[tbl-erp-user-group-detail]]
- `erp_user_datalist_config` → [[tbl-erp-user-datalist-config]] (โค้ดสร้างเอง)

## ตารางที่อธิบายในหน้านี้ (หนึ่งบรรทัดต่อตาราง)
**ภูมิศาสตร์ / อ้างอิง**
- `erp_province` — จังหวัด: `code`, `name_1`, `name_2`, `latitude`/`longitude`, `status`, `guid_code`; โหลดใหม่โดย province_load.go:151-167; เขียนผ่านเกตเวย์ได้ · legacy · ดู [[std-thai-geo-map-bank-logos]]
- `erp_amper` — อำเภอ: `province`, `code`, … (โครงสร้างเดียวกับจังหวัด); province_load.go · legacy
- `erp_tambon` — ตำบล: `province`, `amper`, `code`, `name_1`, `name_2`, พิกัด, `zip_code` (เติมด้วย ALTER service.go:829-830), `status`, `guid_code`; province_load.go · legacy
- `erp_currency` — สกุลเงิน: `code`, `name_1`, `exchange_rate_present` (fx.go:115) · legacy · ดู [[acc-fx-multi-currency]]
- `erp_initial` — คำนำหน้าชื่อ: `roworder`, `code` (UNIQUE), `name_1`, `name_2`; **โค้ดสร้างเอง** และ seed คำนำหน้า (service.go:870, platform/db/pool.go:128)

**บัญชี / การเงิน (ผูกกับ GL)**
- `erp_credit_type` — ชนิดบัตรเครดิต: `code`, `account_code` (gl_template.go:196); เขียนผ่านเกตเวย์ได้ · legacy
- `erp_wallet_list` — กระเป๋าเงิน: `code`, `name_1`, `account_code` (gl_template.go:204) · legacy
- `erp_expenses_list`, `erp_income_list` — รายการค่าใช้จ่าย/รายได้อื่น: `code`, `gl_account_code`; ผูกกับ `cb_trans_detail.doc_type` 11 = ค่าใช้จ่าย, 12 = รายได้ (รหัสเก็บใน `trans_number`) ใน pay_other.go:118-140 · legacy
- `erp_pass_book_type`, `erp_book_bank_trans_type`, `erp_credit_approve_level` — พบชื่อเท่านั้น (ไม่ชัดจากโค้ดว่าใช้ทำอะไร)
- `erp_doc_format_etax` — พบเฉพาะใน legacy write allow-list ของเกตเวย์ ไม่พบการใช้อื่น (ไม่ชัดจากโค้ด)

**องค์กร / รหัสอ้างอิง**
- `erp_department_list` — แผนก: `code`, `name_1` (ref `refDept` ใน master-detail spec); เขียนผ่านเกตเวย์ได้ · legacy
- `erp_project_list`, `erp_job_list`, `erp_allocate_list`, `erp_side_list`, `erp_doc_group` — พบชื่อใน master-detail spec / รายการอ้างอิง (ไม่ชัดจากโค้ดที่อ่านในรายละเอียดคอลัมน์) · [[proc-master-data]]

**ตั้งค่า POS / QR / ส่วนเสริม (โค้ดสร้างเองใน pos_config.go)**
- `erp_thai_qr_config` — พร้อมเพย์/QR ต่อ POS: `roworder` PK, `pos_id` (UNIQUE ค่าเริ่มต้น `ALL`), `promp_pay_telephone_number`, `promp_pay_wallet_id`, `merchant_name`, `company_biller_id`, `company_terminal_id`, `company_store_id`, `config_type` (pos_config.go:97) · **โค้ดสร้างเอง**
- `erp_qr_payment` — พบชื่อ (ไม่ชัดจากโค้ดที่อ่าน)
- `erp_business_ext` — ข้อมูลส่วนขยายต่อเอนทิตี: `entity_type`, `entity_code`, `ext_data` (JSONB), `updated_at`, PK (`entity_type`, `entity_code`) (pos_config.go:296) · **โค้ดสร้างเอง**

**รายงาน / หน้าจอ**
- `erp_report_template` — เทมเพลตรายงานที่ผู้ใช้บันทึก: `template_id` PK, `menu_key`, `template_name`, `description`, `is_default`, `is_shared`, `custom_title`, `custom_subtitle`, `custom_sql`, `columns_json`/`page_setup_json` (JSONB), ผู้สร้าง/ผู้แก้, เวลา; ดัชนี `menu_key`; ตั้งค่า default ได้ต่อเมนูเดียว (report_template.go:200-217, 335, 377) · **โค้ดสร้างเอง** · ดู [[proc-report-custom-sql-template]]
- `erp_view_table_custom`, `erp_view_column_custom` — เลย์เอาต์มุมมองของโปรแกรมเดิม (อ้างใน master_detail_specs; `erp_view_column_custom` ไม่มีคอลัมน์ผู้ใช้ ตามคอมเมนต์ master_datalist.go) · legacy

**ขาย / ล็อก**
- `erp_sale_plan`, `erp_sale_plan_detail` — แผนการขาย (master-detail spec; ไม่ชัดจากโค้ดที่อ่านในรายละเอียดคอลัมน์) · legacy
- `erp_logs` — ประวัติแก้เลข/วัน/ยอดเอกสาร: `doc_no`, `old_doc_date`, `old_doc_no`, `old_doc_amount` (workflow.go:971-991); คอมเมนต์ในโค้ดว่าโปรแกรมเดิมเก็บแยกฐาน logs · legacy
- `erp_log_x` — พบเฉพาะในเทสต์นโยบายเขียนเป็นตัวอย่าง "ตารางที่ไม่อยู่ในรายการ" (ไม่ชัดจากโค้ด)

## ใช้ร่วมกับระบบอื่น
อ่านโดย report engine ([[proc-report-engine]]), lookup ([[proc-lookup-filters]]), MCP gateway (อ่านได้ ยกเว้นคอลัมน์รหัสผ่านของ `erp_user`), และโปรแกรมเดิม (C#) ที่ใช้ฐานเดียวกัน

## ลิงก์
[[proc-master-data]] · [[acc-transaction-save-flow]] · [[tbl-group-bc]]

## ที่มาในโค้ด

- `backend/internal/application/process/master_detail_specs.go:25`
- `backend/internal/application/process/pos_config.go:97`
- `backend/internal/application/process/report_template.go:200`
- `backend/internal/application/process/service.go:829`
- `backend/internal/platform/db/pool.go:128`
- `backend/internal/application/process/province_load.go:151`
- `backend/internal/application/process/fx.go:115`
- `backend/internal/application/process/pay_other.go:118`
- `backend/internal/application/process/workflow.go:971`
