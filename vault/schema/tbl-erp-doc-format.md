---
title: รูปแบบเอกสาร เลขที่รันอัตโนมัติ ผังบัญชีเอกสาร และ e-Tax — erp_doc_format / erp_doc_format_gl / erp_doc_format_etax
tags: [dev, schema, erp, doc-format, gl-template, etax]
aliases: [erp_doc_format, erp_doc_format_gl, erp_doc_format_etax, erp_doc_group, erp_ref_document, erp_request_order, erp_doc_approve, ประเภทเอกสาร]
sources:
  - scripts/sql/02_data_schema.sql:2806-2884
  - scripts/sql/02_data_schema.sql:3632-3662
  - scripts/sql/03_audit_r1_migrations.sql:75-86
  - backend/internal/application/process/doc_format_defaults.go:15-70
  - backend/internal/application/process/gl_template.go:19-20
  - backend/internal/application/process/gl_template.go:951-970
  - backend/internal/application/process/service.go:1615-1620
---

# รูปแบบเอกสาร เลขที่อัตโนมัติ และผังลงบัญชี (`erp_doc_format` กลุ่มเอกสาร)

กลุ่มตารางกำหนดรหัสเอกสารทั้ง 163 รูปแบบมาตรฐานของ BC 5.5 ตั้งแต่รูปแบบเลขที่วิ่งอัตโนมัติ สมุดรายวันลงบัญชี สูตรจับคู่เดบิต/เครดิต ไปจนถึงตั้งค่า e-Tax รายประเภทเอกสาร ดูภาพรวมโครงสร้างทั้งหมดได้ที่ [[schema-overview]]

---

## 1. `erp_doc_format` — ทะเบียนรูปแบบเอกสาร (Document Format)

| รายการ | รายละเอียด |
|---|---|
| **บทบาท** | กำหนด Mask การออกเลขที่เอกสาร ฟอร์มพิมพ์หลัก/สำเนา สมุดรายวัน (`gl_book`) และประเภทภาษีเริ่มต้นของหน้าจอแต่ละประเภท (`screen_code`) |
| **Index** | `idx_erp_doc_format_code` ON `("code")` (ไม่มี SQL PK; ใช้ `roworder serial`) |

| คอลัมน์ | ชนิดข้อมูล | ความหมาย / ค่า Flag |
|---|---|---|
| `code` | `varchar(25)` | รหัสรูปแบบเอกสาร (เช่น `IV`, `SO`, `PO`, `PV`, `RV`) เชื่อมกับ `doc_format_code` ใน `ic_trans` / `ap_ar_trans` |
| `name_1`, `name_2` | `varchar(100)` / `varchar(200)` | ชื่อประเภทเอกสาร (ไทย / อังกฤษ) |
| `format` | `varchar(100)` | แพตเทิร์นเลขที่เอกสาร เช่น `SI-YYMM-####`, `PO-######` |
| `screen_code` | `varchar(10)` | รหัสหน้าจอที่ผูกกับฟอร์แมต (163 รหัสมาตรฐาน เช่น `PR`, `PO`, `PI`, `SO`, `SS`, `SR`, `SI`, `GL`, `PV`, `RV`, `PA`, `PD`) |
| `form_code`, `form_code_1`..`form_code_5` | `varchar(1000)` / `varchar(100)` | ชื่อแบบฟอร์มพิมพ์เอกสารต้นฉบับและสำเนา (จับคู่กับ `formdesign.formcode`) |
| `gl_book` | `varchar(10)` | รหัสสมุดรายวัน (`gl_journal_book.code` เช่น `01`–`05`) |
| `gl_description` | `varchar(255)` | คำอธิบายรายวันเริ่มต้นเมื่อโพสต์บัญชี |
| `tax_format`, `doc_running` | `varchar(100)` | แพตเทิร์นเลขที่ใบกำกับภาษีแยกต่างหาก และตัววิ่งสะสม |
| `use_branch_select`, `branch_list` | `smallint` / `varchar(255)` | จำกัดสิทธิ์การใช้ฟอร์แมตเฉพาะสาขา (`1 = เปิดกรองตาม branch_list`) |
| `vat_type` | `smallint DEFAULT 0` | ประเภท VAT เริ่มต้นของเอกสาร (`0 = แยกนอก`, `1 = รวมใน`, `2/3 = ยกเว้น`) |
| `status` | `smallint DEFAULT 0` | `0 = ใช้งาน`, `1 = ปิดใช้งาน` |

---

## 2. `erp_doc_format_gl` — ผังลงบัญชีอัตโนมัติรายรูปแบบเอกสาร

| รายการ | รายละเอียด |
|---|---|
| **บทบาท** | กำหนดเงื่อนไขการลงบัญชี GL แบบ Custom ต่อ 1 รหัสเอกสาร (`doc_code`); หากเอกสารมีแถวในตารางนี้ ระบบ Go (`glTemplatePoster`) จะใช้สูตรนี้แทนผังมาตรฐาน (`service.go:1615`) |
| **ความสัมพันธ์** | `erp_doc_format_gl.doc_code` -> `erp_doc_format.code` (`UPPER(doc_code) = UPPER(code)`) |

| คอลัมน์ | ชนิดข้อมูล | ความหมาย |
|---|---|---|
| `doc_code` | `varchar(10)` | รหัสรูปแบบเอกสาร (`erp_doc_format.code`) |
| `line_number` | `integer` | ลำดับบรรทัดเรียงการจับคู่คู่กับ `roworder` |
| `condition_number` | `integer` | รหัสเงื่อนไข / Action Code ของบัญชี (ต้อง `> 0` จึงถูกใช้งานใน `gl_template.go:966`) |
| `condition_name`, `condition_case` | `varchar(255)` / `varchar(50)` | ชื่อเงื่อนไขและรูปแบบ Case พิเศษ |
| `account_code_debit`, `account_name` | `varchar(25)` / `varchar(255)` | รหัสและชื่อผังบัญชีฝั่งเดบิต |
| `account_code_credit`, `account_name2` | `varchar(25)` / `varchar(255)` | รหัสและชื่อผังบัญชีฝั่งเครดิต |
| `code_compare` | `varchar(100)` | ค่าเปรียบเทียบเพิ่มเติมเมื่อแยกบัญชีตามเงื่อนไข |

---

## 3. `erp_doc_format_etax` — ตั้งค่า e-Tax Invoice รายประเภทเอกสาร

| รายการ | รายละเอียด |
|---|---|
| **บทบาท** | แยกตั้งค่า e-Tax / e-Receipt ออกจากฟิลด์ `form_code` ปกติ (`03_audit_r1_migrations.sql:76-86`) |
| **Primary Key** | `code VARCHAR(50) PRIMARY KEY` (เชื่อมกับ `erp_doc_format.code`) |

| คอลัมน์ | ชนิดข้อมูล | ความหมาย |
|---|---|---|
| `code` | `varchar(50) PRIMARY KEY` | รหัสรูปแบบเอกสาร (`erp_doc_format.code`) |
| `enable_etax` | `smallint NOT NULL DEFAULT 0` | เปิดออก e-Tax สำหรับเอกสารนี้ (`1 = เปิด`) |
| `etax_doc_type_code` | `varchar(20) DEFAULT '388'` | รหัสประเภทเอกสารอิเล็กทรอนิกส์ของกรมสรรพากร (`388` = ใบกำกับภาษี, `T01`/`T02`/`80`/`81` ฯลฯ) |
| `etax_sign_mode` | `varchar(30) DEFAULT 'TIMESTAMP'` | โหมดลงลายมือชื่อดิจิทัล (`TIMESTAMP` ฯลฯ) |
| `updated_at` | `timestamp DEFAULT now()` | เวลาอัปเดตล่าสุด |

---

## 4. ตารางสนับสนุนเอกสารอื่นๆ

| ตาราง | Index / Key | คอลัมน์หลักและบทบาท |
|---|---|---|
| `erp_doc_group` | `idx_erp_doc_group_code` | `code`, `name_1`, `name_2`, `status` — กลุ่มเอกสาร (เปิดใช้เมื่อ `erp_option.use_doc_group = 1`) |
| `erp_doc_approve` | `idx_erp_doc_approve_code` | `code`, `name_1`, `name_2`, `status` — รหัส/ประเภทผู้อนุมัติเอกสาร |
| `erp_ref_document` | `idx_erp_ref_document_code` | `doc_no`, `doc_name`, `file_type`, `file_name`, `system_id`, `code` — เอกสารแนบอ้างอิง |
| `erp_request_order` | `idx_erp_request_order_doc_no_trans_flag`, `idx_erp_request_order_cust_code` | `trans_flag`, `trans_type`, `doc_no`, `req_datetime`, `approve_code`, `send_success`, `cust_code` — คิวคำขออนุมัติ/ส่งคำสั่งจากระบบภายนอก |

---

## ตัวอย่าง SQL ใช้งานจริง

```sql
-- ดูการตั้งค่ารูปแบบเอกสารพร้อมผังลงบัญชี Custom และสถานะ e-Tax
SELECT f.code AS doc_format_code,
       f.screen_code,
       f.name_1,
       f.format,
       f.gl_book,
       COALESCE(et.enable_etax, 0) AS enable_etax,
       COALESCE(et.etax_doc_type_code, '') AS etax_type,
       COUNT(gl.roworder) AS custom_gl_rules
FROM erp_doc_format f
LEFT JOIN erp_doc_format_etax et ON UPPER(et.code) = UPPER(f.code)
LEFT JOIN erp_doc_format_gl gl ON UPPER(gl.doc_code) = UPPER(f.code) AND gl.condition_number > 0
WHERE COALESCE(f.status, 0) = 0
GROUP BY f.code, f.screen_code, f.name_1, f.format, f.gl_book, et.enable_etax, et.etax_doc_type_code
ORDER BY f.screen_code, f.code;
```
