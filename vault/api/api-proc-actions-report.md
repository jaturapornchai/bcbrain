---
title: "API รายงาน (Process report actions: report/run, report/pdf, ai-report-*)"
tags: [api, process, report]
aliases: ["/api/v1/process/report/run","/api/v1/process/report/pdf","/process/report/run","/process/report/pdf","report/run","report/pdf","ai-report-sql","ai-report-analyze","/api/process/report/run","/api/process/report/pdf"]
sources: ["backend/internal/adapter/inbound/http/router.go:165","backend/internal/adapter/inbound/http/router.go:206","backend/internal/adapter/inbound/http/process/handler.go:223","backend/internal/adapter/inbound/http/process/handler.go:270","backend/internal/adapter/inbound/http/process/permission.go:60","backend/internal/application/process/report.go:26","backend/internal/application/process/report.go:246","backend/internal/application/process/report_pdf.go:111","backend/internal/application/process/ai_copilot.go:259","backend/internal/application/process/ai_copilot.go:341","frontend/src/app/api/process/report/run/route.ts:27","frontend/src/app/api/process/report/pdf/route.ts:30","frontend/src/lib/query-client.ts:1020"]
---

# API รายงาน (report/run, report/pdf, ai-report-*)

รายงานทุกตัวของระบบวิ่งผ่าน 2 route คงที่ + 2 action ของ `workflow` — ไม่มี endpoint แยกรายรายงาน; รายงานแต่ละตัวถูกเลือกด้วย `menuKey` ในบอดี้. ภาพรวม prefix, envelope และการตรวจสิทธิ์อยู่ที่ [[api-process-run]]; ตัวเครื่องยนต์รายงานอยู่ที่ [[proc-report-engine]].

## ตาราง action

| action | หน้าที่ | input สำคัญ | ตาราง | path:line |
|---|---|---|---|---|
| `report/run` | ประมวลผลรายงานตาม `menuKey` คืนคอลัมน์ แถว ยอดรวม การ์ดสรุป SQL ที่รันจริง และเทมเพลตที่บันทึกไว้ | `menuKey`, `mode`, `dateFrom`, `dateTo`, `fromCode`, `toCode`, `orderBy`, `keyword`, `viewDetail`, `options{}`, `customSql`, `customColumns[]`, `groupByColumn`, `templateAction` | erp_report_template, ic_inventory, erp_option, ic_warehouse, ic_shelf, erp_user_group_wh_shelf, erp_user_group_detail (ตารางข้อมูลอื่นแล้วแต่รายงาน) | handler.go:223 → report.go:246 |
| `report/pdf` | รัน `RunReport` ด้วยเงื่อนไขเดียวกับหน้าจอ แล้วเรนเดอร์เป็นไฟล์ PDF | `RunReportInput` ชุดเดียวกัน + `paperSize`, `orientation`, `fontSizePt`, `colorMode`, `printTheme`, `density`, `gridStyle`, `showZebra`, `showRowNumber`, `showCompanyHeader`, `showSignatureBlock`, `signatureLabels[]`, `footerNote`, `customTitle`, `customSubtitle`, `reportLang` | ตารางเดียวกับ report/run + erp_user, ic_trans (หัวบริษัท/ข้อมูลประกอบ) | handler.go:270 → report_pdf.go:111 |
| `workflow/ai-report-sql` | แปลงคำสั่งภาษาไทย/อังกฤษเป็น SELECT แบบอ่านอย่างเดียว แล้วลองรันใน transaction read-only เพื่อนับแถวและคืนชื่อคอลัมน์ | `prompt`, `menuKey`, `dateFrom`, `dateTo` | ic_opposite_unit, ic_trans_detail, ic_inventory, ic_trans, ar_customer, ap_supplier, gl_journal_detail | workflow_handler.go:124 → ai_copilot.go:259 |
| `workflow/ai-report-analyze` | วิเคราะห์แถว/ยอดรวมของรายงานที่แสดงอยู่ คืนหัวข้อสรุป จุดเด่น ความผิดปกติ และการ์ดตัวเลข (คำนวณด้วย `*big.Rat`) | `menuKey`, `title`, `rows[]`, `totals{}`, `summaryCards[]` | (ไม่แตะ DB — คำนวณจากบอดี้ที่ส่งมา) | workflow_handler.go:131 → ai_copilot.go:341 |

ทั้ง 4 action ผูกกับ claims ใน JWT: `ProviderCode`, `DatabaseName`, `Username` ถูกเติมจาก token เสมอ (`json:"-"` ใน struct) — ค่าในบอดี้ไม่มีผล (handler.go:235-237, workflow_handler.go:128,135).

## report/run

- **เมธอด + path**: `POST /api/v1/process/report/run` และ `POST /process/report/run` (ติดตั้งทั้งสอง prefix, router.go:165,206)
- **Auth**: `Authorization: Bearer <token>`; สิทธิ์ขั้นต่ำ `Read` (permission.go:25); ถ้าบอดี้มี `customSql` ไม่ว่าง ต้องเป็น Admin (permission.go:60-66)
- **ขนาดบอดี้**: 16 MB (`maxJSONBody`, handler.go:231); รันรายงานมี timeout 45 วินาทีใน service (report.go:253)
- **Request**:

```json
{
  "menuKey": "<menuKey>",
  "mode": "<mode>",
  "dateFrom": "2026-01-01",
  "dateTo": "2026-12-31",
  "fromCode": "<codeFrom>",
  "toCode": "<codeTo>",
  "orderBy": "<orderByKey>",
  "keyword": "<text>",
  "viewDetail": false,
  "options": { "<conditionKey>": "<value>" }
}
```

- **ฟิลด์ที่ service รับ** (report.go:26-100): ชื่อ snake_case ที่ใช้แทนกันได้ คือ `report_code`/`reportCode` (แทน menuKey), `doc_date_from`/`doc_date_to` (แทน dateFrom/dateTo), `doc_no_from`/`doc_no_to` (แทน fromCode/toCode) — `normalizeRunReportInput` รวมเข้าชื่อหลัก. วันที่ว่างใช้ค่าเริ่มต้น "ย้อนหลัง 1 ปี ถึงวันนี้" (report.go:271-272). ถ้า `menuKey` ไม่อยู่ใน `menuReports` และไม่ใช่ menu ของตัวออกแบบ จะลองรันแบบ legacy ตาม `mode`; ไม่เจอ = 400 "ไม่พบรายงาน <menuKey>" (report.go:288-296)
- **Custom SQL / เทมเพลต**: `customSql` รัน SQL อ่านอย่างเดียวแทนคิวรีมาตรฐาน — รายงานที่โชว์ต้นทุนสินค้า (`costGuarded`) หรือที่ล็อกตามคลัง/ชั้นของผู้ใช้ (`permGuarded`) จะปฏิเสธ Custom SQL (report.go:120-121); `templateAction` = `save` | `delete` | `set_default` พร้อม `templateId`/`templateName`/`templateDesc`/`templateIsDefault` เขียนตาราง `erp_report_template` ก่อนรันรายงาน (report.go:260). รายละเอียดเชิงแนวคิด: [[proc-report-custom-sql-template]], [[proc-report-registry-conditions]]
- **Response 200**: `{"ok":true,"data":{...}}` โดย `data` คือ `RunReportResult` (report.go:102-): `menuKey`, `yearType`, `reportTypeCode`, `reportCategory`, `subtitle`, `conditionText`, `usesDateRange`, `codeRangeLabel`, `orderByOptions[]`, `conditions[]`, `supportsDetail`, `viewDetailActive`, `columns[]`, `allColumns[]`, `rows[]`, `totals{}` (ค่าเงินเป็น string ทศนิยม), `hierarchyLevels[]`, `groupNodes[]`, `summaryCards[]`, `defaultSql`, `executedSql`, `executionMs`, `templates[]`, `savedTemplateId`. โครงลำดับชั้นกลุ่ม: [[proc-report-hierarchy-pdf]]
- **Errors**: ไม่มี token = 401; สิทธิ์ไม่พอ = 403 (ข้อความไทยจาก `deniedMessages`); บอดี้ JSON เสีย = 400 "invalid request body"; ไม่พบรายงาน / คิวรีรันไม่ได้ = 400 (report.go:295); error อื่น = 500 "internal server error"
- **เพดานเวลา**: 60 วินาทีของ router + 45 วินาทีของ service
- **ผู้เรียกฝั่งหน้าเว็บ**: `runBackendReport()` (query-client.ts:1020) → Next `POST /api/process/report/run` (route.ts:151) ซึ่งแปลง alias ของ menuKey (route.ts:12-30) แล้วเติม `total_vat_amount`/`total_base_amount` ในผลลัพธ์จาก `totals`; Next ยังมี `GET` ที่รับ query string (`menuKey`, `dateFrom`, `dateTo`, `fromCode`, `toCode`, ที่เหลือเข้า `options`) แล้วแปลงเป็น POST (route.ts:81-150). หน้าจอที่ใช้: `account/report/UniversalReportScreen.tsx:407,490`, `FastReportDesignerScreen.tsx:1094,1198,1309,1365`, `FormDesignerScreen.tsx:991,1764` — ภาพรวมที่ [[fe-report-screens]]

## report/pdf

- **เมธอด + path**: `POST /api/v1/process/report/pdf` และ `POST /process/report/pdf` (router.go:166,207)
- **Auth/สิทธิ์/ขนาด**: เหมือน `report/run` ทุกข้อ (Read; `customSql` = Admin; 16 MB)
- **Request**: `RunReportInput` ชุดเดียวกับ report/run เพิ่มตัวเลือกการพิมพ์ — `paperSize` (A4/A3/Letter/Legal/A5/Continuous), `orientation` (auto/portrait/landscape), `fontSizePt` (6.5-13.0 ค่าเริ่มต้น 8.5), `colorMode`, `printTheme`, `density`, `gridStyle`, `showZebra`/`showRowNumber`/`showCompanyHeader` (ค่าเริ่มต้น true), `showSignatureBlock` (ค่าเริ่มต้น false), `signatureLabels[]`, `footerNote`, `customTitle`, `customSubtitle`, `reportLang` (`en` แปลค่าในแถวผ่านพจนานุกรมสองภาษา) (report.go:47-65, report_pdf.go:111-135)
- **Response 200**: ไบต์ไฟล์ PDF ไม่ห่อ JSON — `Content-Type: application/pdf`, `Content-Disposition: inline; filename="<menuKey>_<yyyyMMdd_HHmm>.pdf"` (`bc_report` ถ้าไม่มี menuKey), `Cache-Control: no-store` (handler.go:308-310, report_pdf.go:141-146)
- **Errors**: เหมือน report/run (เป็น JSON `{"error":{"message"}}`); เรนเดอร์ไม่สำเร็จ = 500
- **ผู้เรียกฝั่งหน้าเว็บ**: `fetchBackendReportPdf()` (query-client.ts:1033) → Next `POST /api/process/report/pdf` (route.ts:28) ซึ่งแปลง alias ของ menuKey, เติม `title` จากชื่อเมนูถ้าไม่ได้ส่งมา, ส่งไบต์ PDF ต่อเป็น stream; ถ้าล้มเหลวคืน `fail(message, status)`. ใช้จาก `account/report/GlobalReportPrintModal.tsx:2330`

ตัวอย่าง (ค่าสมมติ):

```json
POST /api/v1/process/report/pdf     (Authorization: Bearer <token>)
{"menuKey":"<menuKey>","dateFrom":"2026-01-01","dateTo":"2026-12-31",
 "paperSize":"A4","orientation":"auto","printTheme":"<theme>","reportLang":"th"}
```

## workflow/ai-report-sql

- **เมธอด + path**: `POST /api/v1/process/workflow/ai-report-sql` (และ `/process/workflow/ai-report-sql`); บอดี้จำกัด 1 MB (workflow_handler.go:25)
- **สิทธิ์**: action นี้ **ไม่อยู่ใน** `routeRights` (permission.go:25-52) จึงตกเป็นต้อง Admin ตามค่าเริ่มต้น (ดู [[api-process-run]])
- **Request**: `{"prompt":"<คำสั่งภาษาไทย>","menuKey":"<menuKey>","dateFrom":"2026-01-01","dateTo":"2026-12-31"}`
- **การทำงาน**: ไม่ได้เรียก LLM ภายนอก — `compileThaiPromptToSQL` (ai_copilot.go:91) แปลงข้อความเป็น SQL ด้วยกฎคำสำคัญ, `validateReadOnlySelectSQL` บังคับ SELECT/WITH เท่านั้น แล้วรันใน transaction `ReadOnly` ที่ rollback ทุกครั้ง (ai_copilot.go:269-285) เพื่อนับแถวและอ่านชื่อคอลัมน์
- **Response 200**: `{"ok":true,"data":{"prompt","title","explanation","sql","suggestedGroupBy","previewRowCount","columns":[...]}}` (ai_copilot.go:59-67). `sql` ที่ได้ใช้ต่อเป็น `customSql` ของ report/run
- **Errors**: `prompt` ว่าง = 400 (ข้อความไทยให้ระบุคำสั่ง); SQL ที่สร้างไม่ผ่านกฎ read-only = 400; รันไม่ได้ = 400 "คำสั่ง SQL ที่สร้างไม่สามารถรันได้"
- **ผู้เรียกฝั่งหน้าเว็บ**: `GlobalReportPrintModal.tsx:1235` ผ่าน Next `/api/process/workflow/[action]` (ACTIONS whitelist มี `ai-report-sql`, route.ts:26)

## workflow/ai-report-analyze

- **เมธอด + path**: `POST /api/v1/process/workflow/ai-report-analyze`; บอดี้ 1 MB; สิทธิ์ Admin ตามค่าเริ่มต้นเช่นเดียวกัน
- **Request**: `{"menuKey":"<menuKey>","title":"<ชื่อรายงาน>","rows":[{...}],"totals":{"<คอลัมน์>":"1234.50"},"summaryCards":[...]}`
- **Response 200**: `{"ok":true,"data":{"headline","highlights":[...],"anomalies":[...],"metrics":[{"label","value","tone"}]}}` — `tone` เป็น emerald/amber/rose/brand (ai_copilot.go:326-338). ถ้า `rows` ว่างคืน highlight บอกว่าไม่พบรายการและจบทันที (ai_copilot.go:355-358). ไม่แตะ DB (รับ `_ context.Context`, ai_copilot.go:341) และไม่เรียก LLM
- **ผู้เรียกฝั่งหน้าเว็บ**: `UniversalReportScreen.tsx:238` (ปุ่ม `ai-report-analyze-btn`, แผง `ai-report-insight-panel`); whitelist เดียวกัน (route.ts:27). แนวคิด: [[proc-ai-copilot]]

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/router.go:165-166,206-207` (route ทั้งสอง prefix)
- `backend/internal/adapter/inbound/http/process/handler.go:223-266` (RunReport), `270-313` (RenderReportPDF)
- `backend/internal/adapter/inbound/http/process/permission.go:25,60-66` (Read / customSql = Admin)
- `backend/internal/adapter/inbound/http/process/workflow_handler.go:18-30,124-138` (ai-report-sql/analyze)
- `backend/internal/application/process/report.go:26-100,102-,246-376,390-431`
- `backend/internal/application/process/report_pdf.go:111-147`
- `backend/internal/application/process/ai_copilot.go:48,59-67,91,259-307,314-338,341-423`
- `frontend/src/app/api/process/report/run/route.ts:12-30,32-80,81-150,151-160`; `frontend/src/app/api/process/report/pdf/route.ts:12-26,28-90`
- `frontend/src/lib/query-client.ts:1017-1066` (runBackendReport, fetchBackendReportPdf)
- `frontend/account/report/UniversalReportScreen.tsx:238,407,490`; `GlobalReportPrintModal.tsx:1235,2330`
