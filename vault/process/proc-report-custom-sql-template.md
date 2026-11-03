---
title: "SQL กำหนดเองและเทมเพลตรายงาน (Custom SQL & report templates)"
tags: [process, report, custom-sql, template, security, postgres]
aliases: ["Report On-The-Fly", "customSql", "erp_report_template", "templateAction", "read-only SQL", "รูปแบบรายงาน", "formdesign"]
sources: ["backend/internal/application/process/report_template.go:38", "backend/internal/application/process/report_template.go:198", "backend/internal/application/process/report_template.go:243", "backend/internal/application/process/report_template.go:338", "backend/internal/application/process/report.go:380"]
---

# SQL กำหนดเองและเทมเพลตรายงาน (Custom SQL & report templates)

ผู้ดูแลระบบแก้ SQL ของรายงานเองได้ (Report On-The-Fly) และบันทึก "รูปแบบรายงาน" (ชื่อ/หัวเรื่อง/SQL/คอลัมน์/ตั้งค่าหน้ากระดาษ) ลงตาราง `erp_report_template` ของฐานข้อมูลบริษัท ส่วน SQL ที่ผู้ใช้เขียนรันใน transaction แบบ read-only

## ทำงานอย่างไร

### เส้นทางการรัน Custom SQL
1. `RequiredRight` เห็น `customSql` ไม่ว่าง -> ต้องสิทธิ์ `admin` ([[proc-permission-rights]])
2. `RunReport` รันรายงานมาตรฐานของเมนูก่อนเพื่อรู้คอลัมน์/`DefaultSQL` แล้วถ้ามี `customSql` เรียก `customSQLRefusal`: ปฏิเสธเมื่อ `costHidden` ("ไม่มีสิทธิ์ดูต้นทุนสินค้า...") หรือเมื่อรายงานเป็น `permGuarded` ("รายงานนี้จำกัดสิทธิ์คลัง/ที่เก็บ ไม่อนุญาตแก้ SQL")
3. `runCustomSQLReport`:
   - มีประเด็นด้านความปลอดภัยที่ทีมพัฒนาต้องตรวจ (ไม่เผยแพร่รายละเอียดบนเว็บสาธารณะ)
   - `expandNamedReportParams` แทนที่พารามิเตอร์ชื่อ: `:date_from`/`:from_date`/`{{date_from}}`, `:date_to`/`:to_date`/`{{date_to}}`, `:from_code`/`{{from_code}}`, `:to_code`/`{{to_code}}`, `:kw_like`/`{{kw_like}}`, `:keyword`/`:search`/`{{keyword}}` ด้วย literal ที่หนี `'` เป็น `''` (`toSQLLiteral`) และแทน `$1..$6` ที่หลงเหลือจากการคัดลอก SQL (ลำดับ: วันเริ่ม, วันสิ้นสุด, keyword, kwLike, จากรหัส, ถึงรหัส)
   - ถ้า SQL ไม่มีคำ `LIMIT ` จะห่อด้วย `SELECT * FROM (...) AS _bc_otf_q LIMIT 50000`
   - รันใน `pool.BeginTx` ด้วย `AccessMode: pgx.ReadOnly` (`ReadCommitted`) แล้ว rollback เสมอ
   - สร้าง `ReportColumnMeta` จากชื่อคอลัมน์ผลลัพธ์ (ชื่อซ้ำ/ว่าง/`?column?` ถูกตั้งชื่อ `คอลัมน์_N`), จับคู่คอลัมน์เดิมของรายงานเมื่อ PostgreSQL ตัด alias ที่ยาวเกิน 63 ไบต์, ตรวจชนิดตัวเลขจาก OID (`isPostgresNumericOID`)
4. ผลที่ได้แทนที่ผลมาตรฐาน แต่คง `UsesDateRange`, `CodeRangeLabel`, `Conditions` เดิม และ `ExecutedSQL` บันทึก SQL ที่รันจริง

### เทมเพลตรายงาน (`erp_report_template`)
- ตารางสร้างเองเมื่อจำเป็น (`ensureReportTemplateTable`, `CREATE TABLE IF NOT EXISTS`): คอลัมน์ `template_id` (PK), `menu_key`, `template_name`, `description`, `is_default`, `is_shared`, `custom_title`, `custom_subtitle`, `custom_sql`, `columns_json` (jsonb), `page_setup_json` (jsonb), `created_by`, `updated_by`, เวลา; มีดัชนีที่ `menu_key`; ในคำสั่งเดียวกันยังสร้างตาราง `formdesign` (แบบฟอร์ม) ถ้ายังไม่มี
- `listReportTemplates`: อ่านเทมเพลตที่ `menu_key = <เมนู>` หรือ `menu_key = '*'` (ใช้ร่วมทุกเมนู) เรียง `is_default DESC, updated_at DESC, template_name`; ถ้าตารางสร้างไม่ได้ (DB อ่านอย่างเดียว) ไม่ถือเป็น error คืนรายการว่าง
- `executeTemplateMutation` (จาก `templateAction`):
  - `save`: `template_id` ว่าง -> สร้าง `rtpl_<hex 8 ไบต์>`; ชื่อว่าง -> "รูปแบบกำหนดเอง dd/mm hh:mm"; ถ้า `templateIsDefault` ล้างค่า default ของเมนูก่อน; upsert `ON CONFLICT (template_id)` โดยมีเงื่อนไข `WHERE menu_key = EXCLUDED.menu_key` (id ของรายงานอื่นจะไม่ถูกเขียนทับ -> `KindNotFound`); ทั้งหมดใน transaction
  - พิเศษสำหรับเมนู `menu_form_edit` / `menu_import_formdesign`: เขียนแถวลง `formdesign` ด้วย (`formcode` = `customSubtitle` ตัดไม่เกิน 25 ตัวอักษร, `formdesigntext` = ค่าใน `footerNote`) หลังลบแถวเดิมที่ `formcode`/`guid_code` ตรงกัน
  - `delete`: ลบตาม `template_id` + `menu_key`; ไม่พบ -> `KindNotFound`
  - `set_default`: ล้าง default ทั้งเมนู แล้วตั้งตัวใหม่ (rollback ถ้า id ไม่อยู่ในเมนูนี้)
  - ผู้บันทึกคือ `Username` (ว่าง = `system`); `menuKey` ว่างใช้ `default`
- ข้อมูลที่เก็บใน `ReportTemplateDTO`: `columns` = `[]ReportColumnOverride` (`key`, `label`, `visible`, `widthPercent`, `align`, `isNumeric`, `isSummable`, `aggregate`, `order`) และ `pageSetup` = `ReportPageSetup` (กระดาษ, แนว, ขนาดฟอนต์, ธีม, ความหนาแน่น, เส้นตาราง, ลายม้าลาย, ลายเซ็น, `footerNote`, `groupByColumn`, `subGroupByColumn`)

## จุดที่ต้องระวัง
- เมนูตัวออกแบบ (`fast_report_designer`, `menu_form_edit`, `menu_import_formdesign`) ไม่มีรายงานมาตรฐานให้รัน ใช้ `RunReport` เพื่อบันทึก/ลบเทมเพลตและรัน SQL ของตัวเองเท่านั้น (`report.go` ค่าคงที่ท้ายไฟล์)
- เมนูตัวออกแบบ (`fast_report_designer`, `menu_form_edit`, `menu_import_formdesign`) ไม่มีรายงานมาตรฐานให้รัน (`report.go` ค่าคงที่ท้ายไฟล์)
- เทมเพลตผูกกับ `menu_key`: จะ save/delete/set_default ข้ามเมนูไม่ได้

## ที่มาในโค้ด
- `backend/internal/application/process/report_template.go:38-86` - `ReportColumnOverride`, `ReportPageSetup`, `ReportTemplateDTO`
- `backend/internal/application/process/report_template.go:198` - `ensureReportTemplateTable` (ตาราง `erp_report_template`, `formdesign`)
- `backend/internal/application/process/report_template.go:237` - `generateTemplateID` (`rtpl_` + hex)
- `backend/internal/application/process/report_template.go:243` - `listReportTemplates`
- `backend/internal/application/process/report_template.go:338` - `executeTemplateMutation`
- `backend/internal/application/process/report.go:380` - `customSQLRefusal`
- `backend/internal/application/process/report.go:393-402` - ชื่อเมนูตัวออกแบบ (`reportDesignerMenuKey` ฯลฯ)

## ดูเพิ่ม
- [[proc-report-engine]]
- [[proc-report-registry-conditions]]
- [[proc-report-hierarchy-pdf]]
- [[proc-permission-rights]]
- [[process-overview]]
