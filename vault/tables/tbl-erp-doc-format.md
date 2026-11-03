---
title: "erp_doc_format — รูปแบบ/ชนิดเอกสารและเลขที่รัน"
tags: [tables, erp, doc-format, running-number, company-db]
aliases: ["erp_doc_format", "รูปแบบเลขที่เอกสาร", "doc_format_code", "autorun เลขที่เอกสาร", "@YYMM-####"]
sources: ["backend/internal/application/process/stock_tools.go:58", "backend/internal/application/process/stock_tools.go:670", "backend/internal/application/process/stock_tools.go:699", "backend/internal/application/process/doc_cancel.go:391", "backend/internal/application/process/doc_cancel.go:611", "backend/internal/application/process/doc_no_next.go:12", "backend/internal/application/process/master_autorun.go:106", "backend/internal/application/process/doc_picture.go:47", "backend/internal/application/process/gl_post.go:26", "backend/internal/application/process/service.go:1612", "backend/internal/application/process/gl_template.go:972", "backend/internal/application/process/fa_depreciation.go:915", "backend/internal/application/process/fa_sale.go:435", "backend/internal/application/process/workflow.go:579", "backend/internal/domain/query/write_policy_legacy.go:33", "scripts/sql/02_data_schema.sql:2821", "scripts/sql/03_audit_r1_migrations.sql:80"]
---

# erp_doc_format — รูปแบบเอกสาร

หนึ่งแถว = หนึ่ง "ชนิดเอกสาร/รูปแบบเลขที่" ของบริษัท (Company DB) กำหนดรูปแบบเลขที่ที่ระบบรันให้ ผูกกับหน้าจอ และสมุดบัญชี GL นิยามตาราง (DDL) อยู่ใน `scripts/sql/02_data_schema.sql:2821-2848` โค้ด Go ไม่ได้สร้างตารางนี้

## คอลัมน์ที่โค้ดใช้
| คอลัมน์ | ความหมายตามโค้ด | ที่มา |
|---|---|---|
| `code` | รหัสรูปแบบเอกสาร varchar(25) — `ic_trans.doc_format_code` ชี้มาที่นี่ การค้นเทียบแบบ `upper(code)` | workflow.go:579; doc_cancel.go:403-406; 02_data_schema.sql:2825 |
| `name_1` | ชื่อรูปแบบ varchar(100) ใช้แสดงในตัวเลือกประเภทเอกสาร | stock_tools.go:58-60; doc_picture.go:91-95; 02_data_schema.sql:2826 |
| `format` | แพตเทิร์นเลขที่ varchar(100) — ถ้าไม่พบแถวหรือว่าง ตอนออกเลขเอกสารใช้ `@YYMM-####` | stock_tools.go:699-721 `autoRunPattern`; doc_cancel.go:410-412; 02_data_schema.sql:2829 |
| `screen_code` | รหัสหน้าจอ/ชนิดเอกสาร varchar(10) (เช่น IB, IF, IO …) — แต่ละโมดูล ic/po/so/ap/ar/cb มีรายการ `screen_code` ของตัวเอง (โมดูลสมุดรายวัน gl ไม่มีตัวเลือกนี้); ถ้าไม่พบแถวที่ `code` ตรง การออกเลขเอกสารใช้แถวที่ `screen_code` ตรงแทน | doc_picture.go:47-53, 84-85, 91-95; stock_tools.go:58-60; doc_cancel.go:403-407; 02_data_schema.sql:2830 |
| `gl_book` | รหัสสมุดรายวัน GL varchar(10) ที่ใช้ตอนลงบัญชีของรูปแบบนี้ (ตอนสร้าง GL ใหม่ของเอกสารยกเลิก/อนุมัติ ถ้าว่างใช้สมุดของใบสมุดรายวันเดิมที่ `doc_no` = `doc_ref`) | service.go:1612; gl_template.go:972-973; fa_depreciation.go:915; fa_sale.go:435; doc_cancel.go:611-614; 02_data_schema.sql:2832 |
| `gl_description` | ข้อความคำอธิบายหัวรายการสมุดรายวัน varchar(255) — แทนตัวแทน `&REMARK&`, `&CUST_CODE&`, `&CUST_NAME&`, `&AP_CODE&`, `&AP_NAME&`, `&AR_CODE&`, `&AR_NAME&`, `&DOC_NO&`, `&DOC_DATE&`, `&TAX_NO&`, `&DOC_REF&`, `&TAX_DATE&`; ว่าง = ใช้หมายเหตุของเอกสาร | gl_post.go:26-43; service.go:1612, 1636; gl_template.go:972, 1049; 02_data_schema.sql:2833 |

คอลัมน์อื่นใน DDL (`name_2`, `guid_code`, `form_code`, `form_code_1`–`form_code_5`, `tax_format`, `doc_running`, `use_branch_select`, `branch_list`, `scan_folder`, `scan_computer_id`, `vat_type`, `status`) ไม่พบโค้ด Go ที่อ่านจาก `erp_doc_format` (คิวรีทุกจุดที่แสดงด้านล่างเลือกเฉพาะ `code`, `name_1`, `format`, `screen_code`, `gl_book`, `gl_description`) — 02_data_schema.sql:2821-2848

### โทเค็นใน `format` (stock_tools.go:699-721)
`DD`/`MM`/`YYYY`/`YY` = วัน/เดือน/ปี ค.ศ. (4 หลัก, 2 หลัก) ของวันที่เอกสาร; `วว`/`ดด`/`ปปปป`/`ปป` = วัน/เดือน/ปี พ.ศ. (ปี ค.ศ. + 543); `@` = รหัสรูปแบบ (`code`); กลุ่ม `#` แรกคือหลักเลขรัน (ความกว้าง = จำนวน `#`) — เลือก พ.ศ. หรือ ค.ศ. ที่ตัวโทเค็นเอง ไม่ขึ้นกับ `erp_option.year_type` (stock_tools.go:702-720) ส่วน `year_type = 1` (หรือยังไม่มีแถว `erp_option`) มีผลกับวันที่ที่แทนใน `&DOC_DATE&`/`&TAX_DATE&` ของ `gl_description` ให้ออกเป็น d/M/yyyy พ.ศ. (gl_post.go:46-69; [[tbl-erp-option]])

## วิธีรันเลขถัดไป
- `nextDocNo` (doc_cancel.go:391-456) ออกเลขเอกสารถัดไป ใช้โดยหน้าจอยกเลิก/อนุมัติ (insertStatusDoc) และ API ขอเลขถัดไป `NextDocNo` (doc_no_next.go:66) หา format จาก `code` ก่อน ไม่พบใช้ `screen_code` (403-407); ไม่ส่งทั้งสองอย่างใช้รหัส `DOC` หรือ `DOC<trans_flag>` (392-401); แพตเทิร์นที่ไม่มี `#` ใช้เลขรัน 4 หลักต่อท้าย (426-428); ล็อกด้วย advisory lock `docno:<table>:<prefix>` (433) แล้วหาเลขสูงสุดที่ขึ้นต้นด้วย prefix (กรอง `trans_flag` เมื่อกำหนด 438-441) + 1 (449-452); เลขที่ยาวเกิน 25 ตัวอักษรคืนข้อผิดพลาด (453-455)
- ผู้เรียก `nextDocNo` อื่น: doc_cancel.go:300, hidden_cost.go:467 และ 489, stock_lot.go:172, stock_tools.go:425
- `doc_no_next.go:12` ครอบตาราง `ic_trans`, `ap_ar_trans`, `cb_trans`, `gl_journal`, `as_trans`, `ic_hidden_cost_process`
- `autoRunNext` (stock_tools.go:725): เลขล่าสุดที่ตรงแพตเทิร์น + 1 เติมศูนย์ ถ้าเกินความกว้างของ `#` วนกลับเป็น 1
- รหัสเจ้าหนี้/ลูกหนี้: master_autorun.go:106 อ่านแถวที่ `code` ตรงกับรหัสที่พิมพ์ ถ้ามีแถวใช้ `format` ออกรหัสถัดไป (ไม่มี `#` ในแพตเทิร์น → error) ถ้าไม่มีแถวใช้กฎคำนำหน้าที่พิมพ์ (ลูกหนี้ปิดกฎนี้ได้ด้วย `erp_option.disable_ar_autorun`, master_autorun.go:123-132)
- รหัสสินค้า: stock_tools.go:670 อ่านแถวด้วยวิธีเดียวกัน แล้วหาเลขถัดไปจาก `ic_inventory.code` (stock_tools.go:676-684)
- ตัวเลือก `OnlyBookSelect` ของ `GLCheck` (workflow.go:554) เลือกเฉพาะเอกสาร `ic_trans` ที่รูปแบบมี `gl_book` (workflow.go:577-580)

## ความสัมพันธ์
- [[tbl-erp-doc-format-gl]] (`doc_code` → `erp_doc_format.code`) เก็บกฎลงบัญชี GL ของแต่ละรูปแบบ
- `erp_doc_format_etax` (`code`, `enable_etax`, `etax_doc_type_code`, `etax_sign_mode`, `updated_at`) สร้างด้วยสคริปต์ scripts/sql/03_audit_r1_migrations.sql:80-86 และอยู่ใน legacy write allow-list (domain/query/write_policy_legacy.go:33) แต่ไม่พบโค้ด Go หรือหน้าจอที่อ่านคอลัมน์ของมัน
- หน้าจอ master เขียนตารางนี้ผ่าน `/query/exec` เพราะอยู่ใน legacy write allow-list (domain/query/write_policy_legacy.go:33; ADR-0011)

## ลิงก์
[[proc-doc-flow-numbering]] · [[acc-gl-template-engine]] · [[acc-transaction-save-flow]] · [[tbl-group-erp]]

## ที่มาในโค้ด

- `backend/internal/application/process/stock_tools.go:58` ตัวเลือกรูปแบบเอกสาร (IA / IS / CO)
- `backend/internal/application/process/stock_tools.go:670` รหัสสินค้าถัดไป
- `backend/internal/application/process/stock_tools.go:699` `autoRunPattern`
- `backend/internal/application/process/doc_cancel.go:391` `nextDocNo`
- `backend/internal/application/process/doc_cancel.go:611` สมุดรายวันของรูปแบบเอกสารตอนสร้าง GL ใหม่
- `backend/internal/application/process/doc_no_next.go:12` ตารางที่ออกเลขได้
- `backend/internal/application/process/master_autorun.go:106` รหัสเจ้าหนี้/ลูกหนี้ถัดไป
- `backend/internal/application/process/doc_picture.go:47` รายการ `screen_code` ต่อโมดูล
- `backend/internal/application/process/gl_post.go:26` `glDescription` ตัวแทนในคำอธิบาย GL
- `backend/internal/application/process/service.go:1612` อ่าน `gl_book`/`gl_description` ตอนสร้าง GL มาตรฐาน
- `backend/internal/application/process/gl_template.go:972` อ่านรูปแบบตอนลงบัญชีตามเทมเพลต
- `backend/internal/application/process/fa_depreciation.go:915` สมุดรายวันของค่าเสื่อมราคา
- `backend/internal/application/process/fa_sale.go:435` สมุดรายวันของการขายสินทรัพย์
- `backend/internal/application/process/workflow.go:579` ตัวกรองเอกสารที่รูปแบบมีสมุดรายวัน
- `backend/internal/domain/query/write_policy_legacy.go:33` allow-list การเขียน
- `scripts/sql/02_data_schema.sql:2821` นิยามตาราง `erp_doc_format`
- `scripts/sql/03_audit_r1_migrations.sql:80` นิยามตาราง `erp_doc_format_etax`
