---
title: "รายการบัญชีแยกประเภท (gl_journal_detail)"
tags: [tables, gl]
aliases: ["gl_journal_detail", "บรรทัดรายวัน", "รายการแยกประเภท", "journal lines", "journal detail"]
sources: ["backend/internal/application/process/gl_template.go:1066", "backend/internal/application/process/service.go:1634", "backend/internal/application/process/service.go:1705", "backend/internal/application/process/docs.go:269", "backend/internal/application/process/doc_cancel.go:648", "backend/internal/application/process/fa_depreciation.go:1007", "backend/internal/application/process/fa_sale.go:589", "backend/internal/application/process/workflow.go:925", "backend/internal/application/process/stock_beginning.go:565", "backend/internal/application/process/workflow.go:553", "backend/internal/application/process/report_menu_gl_fa.go:586"]
---

# รายการบัญชีแยกประเภท (`gl_journal_detail`)

บรรทัดเดบิต/เครดิตของเอกสารบัญชี เอกสาร 1 ใบมีหลายบรรทัด ตารางนี้คือฐานของงบทดลอง แยกประเภท และงบการเงินทั้งหมด หัวเอกสารอยู่ที่ [[tbl-gl-journal]]

## คอลัมน์สำคัญ

| คอลัมน์ | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `doc_no`, `doc_date`, `book_code` | คีย์เชื่อมหัว [[tbl-gl-journal]] | ทุก writer และรายงาน |
| `line_number` | ลำดับบรรทัด เรียงเดบิตก่อนแล้วเรียงรหัสบัญชี (บรรทัดที่ rebuild จาก template คง line เดิมของ template) | `gl_template.go:1059-1066` |
| `account_code` | รหัสบัญชี อ้าง [[tbl-gl-chart-of-account]] `code` | ทุกรายงาน, GLCheck `workflow.go:592` |
| `account_name` | ชื่อบัญชีสำเนา (ตัดที่ 100 ตัวอักษร) บรรทัดกลับรายการยกเลิกขึ้นต้นด้วย `*` | `gl_template.go:1066`, `doc_cancel.go:650` |
| `debit_or_credit` | 0 = บรรทัดเดบิต, 1 = บรรทัดเครดิต | `docs.go:269-290`, `gl_template.go:1066` |
| `debit`, `credit` | จำนวนเงิน NUMERIC (ฝั่งตรงข้ามเป็น 0) | งบทดลอง, `workflow.go` GLCheck |
| `description` | คำอธิบายบรรทัด | `gl_template.go:1066` |
| `trans_flag` | ชนิดเอกสารต้นทาง คัดลอกจากหัว | rebuild/ลบ |
| `journal_type` | 0 รายวัน, 1 ยกมางวด, 2 ปิดงวด, 3 ปรับปรุง, 4 ยอดยกมา คัดลอกจากหัว | `report_menu_gl_fa_tb.go:8-24` |
| `period_number`, `account_year`, `branch_code` | คัดลอกจากหัว rebuild ซิงก์ให้ตรงหัวทุกครั้ง | `service.go:1705-1727` |
| `is_pass` | สถานะผ่านรายการ ซิงก์จากหัว | `workflow.go:517-521` |
| `roworder` | ลำดับแถวภายใน ใช้ตัดสินลำดับเมื่อ line ซ้ำ | `doc_cancel.go:620` |

## คีย์และความสัมพันธ์
- หัว: [[tbl-gl-journal]] ด้วย (`doc_no`, `doc_date`, `book_code`) บาง SQL ผูกเฉพาะ `doc_no` + `trans_flag`
- ผังบัญชี: [[tbl-gl-chart-of-account]] (`account_code` = `code`)
- สมุดรายวัน: [[tbl-gl-journal-book]]
- ตารางแยกมิติของบรรทัดเดียวกัน: `gl_journal_side_list`, `gl_journal_depart_list`, `gl_journal_project_list`, `gl_journal_allocate_list`, `gl_journal_job_list` เชื่อมด้วย `doc_no` + `line_number` + `account_code` (ดู [[tbl-group-gl]])

## ใครเขียน (writers)
- ลงบัญชีตาม template `gl_template.go:1066` และมาตรฐาน `service.go:1634` (ดู [[acc-gl-template-engine]], [[acc-gl-posting-standard]])
- JV ทำมือ `docs.go:269` (หนึ่ง statement ต่อบรรทัด, คำนวณงวดจาก `erp_account_period`)
- เอกสารยกเลิก `doc_cancel.go:648` (คัดลอกบรรทัดต้นฉบับ สลับ debit/credit และ `debit_or_credit`)
- ค่าเสื่อม 1801 `fa_depreciation.go:1007`, ขายสินทรัพย์ 1802 `fa_sale.go:589`, ปิดบัญชี `workflow.go:925`, ยอดยกมาสต็อก `stock_beginning.go:565`
- ซิงก์ metadata จากหัว `service.go:1705`, ซิงก์ `is_pass` `workflow.go:517`

## ใครลบและใครอ่าน
- ลบพร้อมหัวในจุดเดียวกับ [[tbl-gl-journal]]: `service.go:1427`, `gl_template.go:1161`, `docs.go:421`, `doc_cancel.go:627`, `stock_beginning.go:486`, `fa_sale.go:488`
- อ่าน: งบทดลอง/แยกประเภท/สมุดรายวันสรุป (`report_menu_gl_fa.go`), การจัดสรรแผนก `report_menu_gl_fa.go:586`, ตรวจรายวัน `workflow.go:553-612`, ตัวกันลบรหัสผังบัญชีที่ถูกใช้ `master_detail_specs.go:127`, เปลี่ยนรหัสผังบัญชี `workflow.go:162`

## ข้อควรระวัง
- GLCheck ตรวจว่า: บรรทัดที่ `account_code` ไม่อยู่ใน [[tbl-gl-chart-of-account]], บรรทัดที่ใช้ผังบัญชี `status = 1` (บัญชีหลัก), เอกสารที่ SUM(debit) ไม่เท่า SUM(credit), และบรรทัดที่ไม่พบหัว (`workflow.go:590-604`)
- ถ้าแก้ metadata ที่หัวต้องซิงก์ลงบรรทัดด้วย ไม่เช่นนั้น join (`book_code`, `doc_no`, `account_year`, `period_number`, `journal_type`, `branch_code`) จะไม่ตรง (คอมเมนต์ `service.go:1705`)
- ห้ามแก้บรรทัดตรง ๆ เพื่อแก้บัญชีของเอกสารอัตโนมัติ rebuild จะลบแล้วสร้างใหม่; แก้ที่ template หรือ master แล้ว rebuild ([[acc-gl-rebuild]])
- เงินทุกช่องเป็น NUMERIC ห้ามคำนวณด้วย float ([[acc-rounding-decimal]])
- rebuild แก้บรรทัดยอดยกมาสต็อก (`trans_flag = 54`) ที่ `account_code` ไม่อยู่ในผังบัญชี ให้ใช้บัญชีสินค้า/ทุนที่หาได้จากผัง (`service.go:1666-1676`)

## ที่มาในโค้ด
- `backend/internal/application/process/gl_template.go:1066` insert บรรทัดจาก template
- `backend/internal/application/process/service.go:1634` insert บรรทัดมาตรฐาน
- `backend/internal/application/process/service.go:1705` ซิงก์ metadata จากหัว
- `backend/internal/application/process/docs.go:269` insert บรรทัด JV ทำมือ
- `backend/internal/application/process/doc_cancel.go:648` insert บรรทัดกลับด้าน
- `backend/internal/application/process/fa_depreciation.go:1007` บรรทัด 1801
- `backend/internal/application/process/fa_sale.go:589` บรรทัด 1802
- `backend/internal/application/process/workflow.go:925` บรรทัดปิดบัญชี
- `backend/internal/application/process/stock_beginning.go:565` บรรทัดยอดยกมา
- `backend/internal/application/process/workflow.go:553` GLCheck
- `backend/internal/application/process/report_menu_gl_fa.go:586` การจัดสรรตามแผนก
- `backend/internal/application/process/master_detail_specs.go:127` ตัวกันลบผังบัญชี

## ดูเพิ่ม
- [[tbl-group-gl]]
- [[acc-gl-rebuild]]
- [[acc-gl-posting-standard]]
