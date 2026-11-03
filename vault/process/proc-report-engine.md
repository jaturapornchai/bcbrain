---
title: "เครื่องมือรายงานฝั่ง Backend (Report engine / RunReport)"
tags: [process, report, engine, big-rat, multi-tenant]
aliases: ["RunReport", "report/run", "RunReportInput", "RunReportResult", "ลำดับการรันรายงาน", "menuKey"]
sources: ["backend/internal/application/process/report.go:1", "backend/internal/application/process/report.go:209", "backend/internal/application/process/report.go:246", "backend/internal/application/process/report.go:380", "backend/internal/application/process/report.go:427", "backend/internal/application/process/report.go:436", "backend/internal/application/process/report.go:650", "backend/internal/application/process/report.go:695", "backend/internal/adapter/inbound/http/process/handler.go:223"]
---

# เครื่องมือรายงานฝั่ง Backend (Report engine / RunReport)

`Service.RunReport` คือจุดเดียวที่ทุกรายงานผ่าน: รับเงื่อนไขจากหน้าจอ (`RunReportInput`) -> เลือกตัวสร้างรายงานตาม `menuKey` -> รวมยอดด้วย `big.Rat` -> ส่งผล (`RunReportResult`) กลับให้ frontend แสดงเป็นตาราง หัวเอกสารของ package ระบุว่าการจัดประเภท/SQL/ยอดสะสม/ยอดรวมทำที่ backend ทั้งหมด (Thin Client)

## ทำงานอย่างไร

### ทางเข้า
- `POST /process/report/run` และ `/api/v1/process/report/run` -> `Handler.RunReport` อ่าน JSON (จำกัด 16 MB) แล้ว **เขียนทับ** `ProviderCode`, `DatabaseName`, `Username` จาก claims (ฟิลด์เหล่านี้ tag `json:"-"` ผู้เรียกส่งเองไม่ได้)
- สิทธิ์: `read` ปกติ แต่ถ้า body มี `customSql` ต้อง `admin` ([[proc-permission-rights]])

### ลำดับใน `RunReport` (ตามโค้ด)
1. `normalizeRunReportInput`: ถ้าไม่มี `menuKey` ใช้ `reportCode`/`report_code`; แปลง alias เก่าผ่าน `reportCodeAliases` (เช่น `report_vat_sale` -> `menu_report_vat_sale`, `ic_stock_balance` -> `menu_ic_info_stk_balance`); รับชื่อฟิลด์ snake_case `doc_date_from/to`, `doc_no_from/to` แทน `dateFrom/dateTo/fromCode/toCode`
2. เปิด pool ของบริษัท (`companyPool`) และตั้ง timeout 45 วินาทีต่อคำขอ
3. โหลดเทมเพลตของเมนู (`listReportTemplates`) ดู [[proc-report-custom-sql-template]]
4. วันที่เริ่มต้น: `dateFrom` = ย้อนหลัง 1 ปี, `dateTo` = วันนี้ (ถ้าไม่ส่ง)
5. `withSQLCapture` เก็บ SQL ที่รันจริงไว้ใน `DefaultSQL`/`ExecutedSQL` (ถ้าจับไม่ได้ใช้ `fallbackDefaultSQL`)
6. เลือกตัวสร้างรายงาน: `menuReports[lowerKey]` (ลงทะเบียนไว้ ดู [[proc-report-registry-conditions]]) ถ้าไม่มี และไม่ใช่เมนูตัวออกแบบ (`fast_report_designer`, `menu_form_edit`, `menu_import_formdesign`) ไปที่ `runLegacyReport` ซึ่งรองรับเฉพาะ `mode == "sql_utility"` (ที่เหลือคืน `errNoLegacyReport` -> ข้อความ "ไม่พบรายงาน <menuKey>" `KindValidation`)
7. กฎต้นทุน (fail closed): ถ้ารายงานตั้ง `costGuarded` และ `itemCostHidden` เป็นจริง -> ตัวสร้างที่ไม่ได้ลงทะเบียนจะถูกปฏิเสธ "ไม่มีสิทธิ์ดูต้นทุนสินค้า" หรือตัดเฉพาะคอลัมน์ใน `costCols` (`dropCostColumns`); รายงาน IC ที่ลงทะเบียนใช้กฎนี้ใน `icRun` เอง
8. ถ้ามี `customSql` -> ตรวจ `customSQLRefusal` (ต้นทุนซ่อน หรือ `permGuarded` คือรายงานที่กรองคลัง/ที่เก็บตามสิทธิ์ผู้ใช้ => ปฏิเสธ) แล้วรัน `runCustomSQLReport` แทนผลเดิม
9. ปี: อ่าน `erp_option.year_type` (`readErpYearType`; ค่า "1" = พ.ศ., อื่น ๆ = ค.ศ.) แล้ว `applyReportYearType` แปลงวันที่ใน `ConditionText` และในเซลล์ข้อความ; ถ้า ค.ศ. เปลี่ยนคำ "ปี พ.ศ. " เป็น "ปี ค.ศ. "
10. `finalizeReportConditionsAndOrder`: เติม `CodeRangeLabel`, `OrderByOptions` (ถ้าว่าง ใช้ทุกคอลัมน์), กรองช่วงรหัสจาก/ถึงในหน่วยความจำเมื่อ SQL ยังไม่ได้กรอง (`codeRangeInSQL=false`) แล้วสร้าง `ConditionText`
11. `applyReportColumnOverridesAndAggregates`: ปรับความกว้าง %, ซ่อน/แสดง, ชื่อคอลัมน์, ลำดับ, การจัดชิด, ฟังก์ชันรวม (`sum/avg/count/min/max`)
12. ยอดรวม: `computeExactColumnTotals` รวมเฉพาะคอลัมน์ `IsSummable` ด้วย `*big.Rat` (`ParseDecimalRat`) แล้วฟอร์แมตทศนิยม 2 ตำแหน่งเป็นสตริง; สร้าง `SummaryCards` ถ้ายังว่างหรือผู้ใช้แก้คอลัมน์/ใช้ SQL เอง
13. `buildReportMultiLevelHierarchy` สร้าง `HierarchyLevels`/`GroupNodes` ([[proc-report-hierarchy-pdf]])
14. คืน `ExecutionMs`, `Templates`, `SavedTemplateID`

### ฟิลด์สำคัญ
- Input: `menuKey`, `mode`, `title`, `dateFrom`, `dateTo`, `fromCode`, `toCode`, `orderBy`, `keyword`, `viewDetail`, `options` (map ค่าเงื่อนไขเพิ่ม), `customSql`, `customColumns`, `groupByColumn`, `subGroupByColumn`, ตัวเลือกพิมพ์ (`paperSize`, `orientation`, `fontSizePt`, `printTheme`, `reportLang` ฯลฯ)
- Output: `columns` (`key/label/align/isNumeric/isSummable/widthPercent/visible/aggregate`), `rows`, `totals` (สตริงทศนิยม), `conditions` (ตัวควบคุมเพิ่มเติมที่หน้าจอต้องวาด), `summaryCards`, `defaultSql`, `executedSql`, `templates`
- ตัวเลขเงินเป็นสตริงทศนิยมตลอด (ไม่ใช้ float) ตามหัวเอกสารที่อ้าง Rule 20

## จุดที่ต้องระวัง
- ไม่ลงทะเบียน `menuKey` และ `mode` ไม่ใช่ `sql_utility` => รายงานไม่มี (ไม่ใช่ว่างเปล่า)
- ส่ง `customSql` พร้อมเมนูที่ซ่อนต้นทุน => 403 ทั้งที่ผู้ใช้เป็น Admin ก็ยังถูก `customSQLRefusal` เช็ก (ตรวจที่ระดับ result ไม่ใช่ระดับสิทธิ์)
- ถ้า error แต่มี `customSql` ในคำขอ ตัวรายงานมาตรฐานที่พังจะถูกข้าม (`err != nil && CustomSQL == ""` จึงจะคืน error) และตั้ง `costGuarded` กันรั่ว

## ที่มาในโค้ด
- `backend/internal/application/process/report.go:20-70` - `RunReportInput`
- `backend/internal/application/process/report.go:88-135` - `RunReportResult` (ฟิลด์ private `codeRangeInSQL`, `costGuarded`, `permGuarded`, `costCols`)
- `backend/internal/application/process/report.go:185` - `readErpYearType`
- `backend/internal/application/process/report.go:209` - `reportCodeAliases`
- `backend/internal/application/process/report.go:225` - `normalizeRunReportInput`
- `backend/internal/application/process/report.go:246-377` - `RunReport`
- `backend/internal/application/process/report.go:380` - `customSQLRefusal`
- `backend/internal/application/process/report.go:427` - `runLegacyReport`
- `backend/internal/application/process/report.go:436` - `finalizeReportConditionsAndOrder`
- `backend/internal/application/process/report.go:650` - `applyReportYearType`
- `backend/internal/application/process/report.go:695` - `computeExactColumnTotals`
- `backend/internal/application/process/report_options.go:124` - `itemCostHidden`
- `backend/internal/adapter/inbound/http/process/handler.go:223` - handler `RunReport`

## ดูเพิ่ม
- [[proc-report-registry-conditions]]
- [[proc-report-custom-sql-template]]
- [[proc-report-hierarchy-pdf]]
- [[proc-stock-tools]]
- [[proc-permission-rights]]
- [[process-overview]]
