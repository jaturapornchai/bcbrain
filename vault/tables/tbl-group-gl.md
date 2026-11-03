---
title: "กลุ่มตารางบัญชีแยกประเภท (gl_*)"
tags: [tables, gl]
aliases: ["gl_*", "ตาราง gl", "กลุ่มตาราง GL", "general ledger tables"]
sources: ["backend/internal/application/process/service.go:807", "backend/internal/application/process/service.go:871", "backend/internal/platform/db/pool.go:16", "backend/internal/platform/db/pool.go:78", "backend/internal/application/process/master_detail_specs.go:106", "backend/internal/application/process/workflow.go:845", "backend/internal/application/process/workflow.go:889", "backend/internal/application/process/report_menu_gl_fa.go:1670", "backend/internal/application/process/report_menu_gl_fa.go:1678", "backend/internal/application/process/gl_recurring.go:51", "scripts/sql/02_data_schema.sql:4165"]
---

# กลุ่มตารางบัญชีแยกประเภท (`gl_*`)

รวมตารางที่ขึ้นต้น `gl_` ทั้งหมดที่ปรากฏใน SQL ของ `backend/internal` (FROM / JOIN / INTO / UPDATE / DELETE FROM ไม่รวมไฟล์ test) ตารางส่วนใหญ่ DB ของบริษัทมีอยู่แล้ว โค้ด Go ชุดนี้ **ไม่สร้างตารางหลัก** (`gl_journal`, `gl_chart_of_account` ฯลฯ ไม่มี `CREATE TABLE` ใน `backend/` โครงสร้างตารางหลักอยู่ใน DDL `scripts/sql/02_data_schema.sql` ดูช่วงบรรทัดด้านล่าง) สร้างเองเฉพาะ 5 ตารางมิติรายวัน `gl_journal_*_list` กฎเขียนผ่านเกตเวย์: ตารางที่ตรง `gl_journal(_\w+)?` ถือเป็น "ตารางเงิน" ห้ามเขียนผ่านหน้า master ทั่วไป ยกเว้น `gl_journal_book` ที่เป็น master จริง (`write_policy.go:27`) ภาพรวมการลงบัญชีดู [[acc-gl-posting-standard]] และ [[acc-gl-template-engine]]

## ตารางหลักของ GL (มีโน้ตแยก)

| ตาราง | บทบาท | ผู้เขียนหลัก / หมายเหตุ | โน้ต |
|---|---|---|---|
| `gl_journal` | หัวรายวัน 1 แถวต่อเอกสาร (ทุกระบบลงที่นี่) | เขียนโดยเอนจิน GL, JV, ยกเลิก, ค่าเสื่อม, ปิดบัญชี | [[tbl-gl-journal]] |
| `gl_journal_detail` | บรรทัดเดบิต/เครดิตของรายวัน | เขียนพร้อมหัว | [[tbl-gl-journal-detail]] |
| `gl_chart_of_account` | ผังบัญชี | หน้า master `master_detail_specs.go:90-137`; เพิ่มคอลัมน์ `tax_type`, `account_close`, `cash_flow_group` ครั้งแรกที่เปิดฐานข้อมูลของบริษัท (`service.go:853-855`, `pool.go:60-62`) ซึ่งคอลัมน์ทั้งสามมีใน `CREATE TABLE` ของ DDL อยู่แล้ว (`scripts/sql/02_data_schema.sql:4165-4193`) คำสั่งนี้จึงมีผลเฉพาะฐานที่ยังไม่มีคอลัมน์ | [[tbl-gl-chart-of-account]] |
| `gl_journal_vat_buy` | ทะเบียนภาษีซื้อ | เขียนโดยแท็บภาษีของเอกสาร/JV | [[tbl-gl-journal-vat-buy]] |
| `gl_journal_vat_sale` | ทะเบียนภาษีขาย | ดัชนี `UPPER(vat_number)` สร้างครั้งแรกที่เปิดฐานข้อมูลของบริษัท (`service.go:938-944`) | [[tbl-gl-journal-vat-sale]] |
| `gl_wht_list` | หัวใบหัก ณ ที่จ่าย | เขียนโดยแท็บ WHT | [[tbl-gl-wht-list]] |
| `gl_wht_list_detail` | บรรทัดประเภทเงินได้ของใบหัก | เขียนพร้อมใบหัก (`journaltax.go:257`) | [[tbl-gl-wht-list-detail]] |
| `gl_journal_book` | master สมุดรายวัน | หน้า master มาตรฐาน | [[tbl-gl-journal-book]] |

- DDL ของตารางหลักข้างต้นอยู่ใน `scripts/sql/02_data_schema.sql` (ช่วงรวมคำสั่ง `ALTER ... ADD COLUMN` และ `CREATE INDEX` ท้ายตาราง): `gl_chart_of_account` :4165-4196, `gl_journal` :4260-4287, `gl_journal_book` :4314-4328, `gl_journal_detail` :4355-4379, `gl_journal_vat_buy` :4522-4564, `gl_journal_vat_sale` :4566-4605, `gl_wht_list` :4728-4751, `gl_wht_list_detail` :4753-4774 ทั้ง 8 ตารางมีคอลัมน์ `ignore_sync`, `is_lock_record`, `roworder`, `create_date_time_now` ร่วมกัน ไม่ประกาศ PRIMARY KEY/UNIQUE และมีเฉพาะดัชนีธรรมดา (รายละเอียดคอลัมน์อยู่ในโน้ตของแต่ละตาราง)

## ตารางปิดบัญชีและสรุปยอด

| ตาราง | บทบาท | ผู้เขียน / ผู้อ่านในโค้ดนี้ |
|---|---|---|
| `gl_trans` | หัวเอกสารปิดบัญชี (GL close, trans_flag 1998/1999) ช่วงวันที่ `from_date`/`to_date`, `account_period`, `account_year`, `close_to_account` | เขียนโดย `insertGLCloseDoc` `workflow.go:903`; ลบก่อนบันทึกซ้ำ `workflow.go:845`; อ่านเลือกชนิด `workflow.go:874` |
| `gl_trans_detail` | บรรทัดสรุปยอดของเอกสารปิดบัญชี (ฝั่งยอดคงเหลือ) | เขียน `workflow.go:920`; ลบ `workflow.go:845`; เป็นตัวกันลบบัญชีใน master (`master_detail_specs.go:128`) |
| `gl_account_close` | เอกสารปิดบัญชีต้นทุนขาย: `doc_no`, `doc_date`, `from_date`, `to_date`, `product_next_amount`, `purchase_amount`, `sale_cost`, `sale_cost_account` | อ่านอย่างเดียวในรายงาน "ปิดบัญชีต้นทุนขาย" `report_menu_gl_fa.go:1670` ไม่มี writer ในรีโปนี้ |
| `gl_account_close_detail` | ตั้งค่าบัญชีที่ใช้ปิดบัญชี | ปรากฏเป็นตัวกันลบบัญชีเท่านั้น (ข้อความ "ถูกใช้ในการตั้งค่าปิดบัญชี" `master_detail_specs.go:129`) ไม่มี SQL อื่น |
| `gl_journal_summary` | หัวเอกสารสรุปยอดบัญชี (`doc_no`, `doc_date`) | อ่านอย่างเดียวในรายงานสรุปยอด `report_menu_gl_fa.go:1678`, `:1775` ไม่มี writer ในรีโปนี้ |
| `gl_journal_summary_detail` | ยอดต่อบัญชี: ยอดยกมา (`balance_debit/credit`), ประจำงวด (`debit_amount/credit_amount`), ปรับปรุง (`adjust_debit/credit`), ยอดรวม (`total_debit/credit`) | อ่านอย่างเดียว (รายงานสรุปยอด และรายงานการเงิน `GLFA_FINANCIAL`) `report_menu_gl_fa.go:1678`, `:1775` |

## ตารางมิติรายวัน (โค้ดนี้สร้างเอง)

ห้าตารางนี้มี DDL ในโค้ด Go ซ้ำสองที่ (และมีอีกชุดที่คอลัมน์ต่างออกไปในสคริปต์ `scripts/sql/02_data_schema.sql` ดูข้อสังเกตด้านล่าง) ทั้งคู่ใช้ `CREATE TABLE IF NOT EXISTS`: `companySchemaSQL` ที่ `pool.go:78-127` (รันตอนเปิด pool ของฐานบริษัท `pool.go:217`) และ `erpSchemaSQL` ที่ `service.go:871-880` และ `service.go:898-937` (ประกาศ `service.go:807`, รันที่ `service.go:972-975`) โครงสร้างเหมือนกัน: `doc_no`, `doc_date`, `account_code`, `line_number`, `<x>_code`, `allocate_persent NUMERIC(18,4)`, `amount NUMERIC(18,4)`, `roworder SERIAL PRIMARY KEY`

| ตาราง | มิติ (`<x>_code`) | ผู้อ่าน / หมายเหตุ |
|---|---|---|
| `gl_journal_side_list` | `side_code` (ฝ่าย/หน่วยงาน ตรงกับ `erp_side_list`) | รายงานแยกมิติ `report_menu_gl_fa.go:1610` |
| `gl_journal_depart_list` | แผนก (`erp_department_list`) | รายงานบัญชีกำไรขาดทุนแยกสาขา/แผนก `glfaBranchDept` `report_menu_gl_fa.go:581-589` (ยอดติดลบเมื่อเป็นบรรทัดเดบิต) และรายงานแยกมิติ `:1610` |
| `gl_journal_project_list` | โครงการ (`erp_project_list`) | รายงานแยกมิติ `report_menu_gl_fa.go:1610`; อยู่ในรายการเปลี่ยนรหัสผังบัญชี `workflow.go:164` |
| `gl_journal_allocate_list` | การจัดสรร (`erp_allocate_list`) | รายงานแยกมิติ `report_menu_gl_fa.go:1611` |
| `gl_journal_job_list` | งาน (`erp_job_list`) | รายงานแยกมิติ `report_menu_gl_fa.go:1611` |

ไม่มี SQL `INSERT` ลงห้าตารางนี้ในโค้ดชุดนี้ (ค้นทั้ง `backend` พบเฉพาะ DDL) ที่มาของแถวในตารางจึงไม่ชัดจากโค้ด ส่วน `account_code` ของทั้งห้าตารางถูกอัปเดตตอนเปลี่ยนรหัสผังบัญชี (`workflow.go:163-165`)

ข้อสังเกตจากโค้ด: รายงานแยกมิติอ่านคอลัมน์ `account_name`, `<x>_name`, `allocate_amount` (`report_menu_gl_fa.go:1614`) และ `glfaBranchDept` อ่าน `allocate_amount` (`report_menu_gl_fa.go:588`) ซึ่ง DDL ข้างต้นไม่มี (DDL มี `allocate_persent`, `amount`) ฐานที่ได้ตารางจาก DDL นี้อย่างเดียวจึงอาจรันรายงานเหล่านี้ไม่ผ่าน (ยังไม่ได้ทดสอบกับ DB จริง) ส่วนสคริปต์ `scripts/sql/02_data_schema.sql` ประกาศห้าตารางนี้ด้วย `side_name`/`department_name`/`allocate_name`/`job_name`/`project_name`, `allocate_persent`, `allocate_amount` และ `account_name` ครบ (เริ่มที่ allocate :4289, depart :4330, job :4381, project :4406, side :4431) ฐานที่สร้างจากสคริปต์นี้จึงมีคอลัมน์ที่รายงานอ่าน

## ตารางตั้งค่ามิติของผังบัญชี

`gl_chart_of_account_{side,depart,allocate,job,project}_list` ผูกบัญชีหนึ่งกับมิติที่อนุญาต: คอลัมน์ `side_code`→`erp_side_list`, `department_code`→`erp_department_list`, `allocate_code`→`erp_allocate_list`, `job_code`→`erp_job_list`, `project_code`→`erp_project_list` (`master_detail_specs.go:106-110`) คอลัมน์ `project_code`/`allocate_code` ถูกขยายเป็น `VARCHAR(25)` ครั้งแรกที่เปิดฐานข้อมูลของบริษัท (`service.go:868-869`, `pool.go:75-76`) เขียนผ่านหน้า master ของผังบัญชี ดู [[tbl-gl-chart-of-account]]

## master อื่นของ GL

| ตาราง | บทบาท | ที่มา |
|---|---|---|
| `gl_account_group` | กลุ่มบัญชี | ผังบัญชีอ้าง `account_group` (`master_detail_specs.go:119`), รายงานผังบัญชี join ชื่อ `report_menu_gl_fa.go:715`, legacy allow-list |
| `gl_cash_flow_group` | กลุ่มกระแสเงินสด | ผังบัญชีอ้าง `cash_flow_group` (`master_detail_specs.go:120`), allow-list |
| `gl_account_type` | ประเภทบัญชี | อยู่ใน legacy allow-list อย่างเดียว ไม่มี SQL อื่นในโค้ด (เนื้อหาไม่ชัดจากโค้ด; ประเภทบัญชี 0-4 ถูกกำหนดเป็นค่าคงที่ในโค้ดแทน ดู [[tbl-gl-chart-of-account]]) |
| `gl_tax_group` | กลุ่มภาษี (`code`, `name_1`, `tax_rate`, `remark`) | แท็บภาษีอ้างรหัสกลุ่มภาษี (`journaltax.go:31`); ระบุไว้ใน catalog ของเกตเวย์ `gateway.go:993`, `:1411`; legacy allow-list |
| `gl_tax_type` | ประเภทภาษี (`code`, `name_1`, `tax_rate`, `remark`) | `gateway.go:993`, `:1412`; legacy allow-list |
| `gl_recurring` | แม่แบบรายการประจำ (`code`, `gl_desc`, `xmlstring`) | อ่านอย่างเดียวโดย `loadGLRecurring` `gl_recurring.go:51` ส่งรหัส ชื่อ (`gl_desc`) และข้อมูลที่ถอดจาก `xmlstring` (`bookCode`, `description`, บรรทัดบัญชี) `gl_recurring.go:26-30`, `gl_recurring.go:78` ให้หน้าจอ JV; ไม่มี writer ในรีโปนี้ |

## ชื่อ `gl_` ที่ไม่ใช่ตาราง (กันสับสน)
- `gl_book`, `gl_description`: คอลัมน์ของ [[tbl-erp-doc-format]] (สมุดรายวันและข้อความอธิบายของ GL ที่เอกสารแต่ละรูปแบบลงบัญชี)
- `gl_no_decimal`: คอลัมน์ของ [[tbl-erp-option]] (จำนวนทศนิยมของ GL) `gateway.go:1635`
- `gl_doc_format`: เป็นเพียงชื่อคีย์ JSON ในไฟล์แม่แบบ GL เริ่มต้นที่ฝังไว้ (`gl_template_defaults.go:76`) ไม่ใช่ตารางที่ SQL อ่าน ตารางจริงที่เก็บเงื่อนไขคือ [[tbl-erp-doc-format-gl]]
- `gl_template`, `gl_template_rules`, `gl_template_defaults`: ชื่อไฟล์/ชุดตรรกะของเอนจินแม่แบบ ([[acc-gl-template-engine]]) ไม่ใช่ตาราง
- `gl_design_report`: ชื่อแบบฟอร์มรายงานในข้อความ (`report_menu_gl_fa.go:1771`)

## ที่มาในโค้ด
- `backend/internal/platform/db/pool.go:16` `companySchemaSQL` (DDL ฐานบริษัท)
- `backend/internal/platform/db/pool.go:78` DDL `gl_journal_*_list`
- `backend/internal/application/process/service.go:807` `erpSchemaSQL`
- `backend/internal/application/process/service.go:871` DDL `gl_journal_*_list` (ชุดที่สอง)
- `backend/internal/application/process/master_detail_specs.go:106` ตารางมิติของผังบัญชี
- `backend/internal/application/process/workflow.go:163` รายการเปลี่ยนรหัสผังบัญชี
- `backend/internal/application/process/workflow.go:845` ลบก่อนบันทึกปิดบัญชีซ้ำ
- `backend/internal/application/process/workflow.go:889` `insertGLCloseDoc`
- `backend/internal/application/process/report_menu_gl_fa.go:581` `glfaBranchDept` อ่านมิติแผนก
- `backend/internal/application/process/report_menu_gl_fa.go:1670` `gl_account_close`
- `backend/internal/application/process/report_menu_gl_fa.go:1678` `gl_journal_summary(_detail)`
- `backend/internal/application/process/report_menu_gl_fa.go:1610` รายงานแยกมิติ `gl_journal_*_list`
- `backend/internal/application/process/gl_recurring.go:51` `gl_recurring`
- `backend/internal/domain/query/write_policy.go:27` ข้อยกเว้น `gl_journal_book`
- `scripts/sql/02_data_schema.sql:4165` DDL ตารางหลัก GL (ช่วงบรรทัดต่อตารางอยู่ในหัวข้อตารางหลักของ GL)

## ดูเพิ่ม
- [[acc-gl-posting-standard]]
- [[acc-gl-template-engine]]
- [[acc-gl-rebuild]]
- [[acc-vat-register-wht]]
- [[tbl-group-as]]
