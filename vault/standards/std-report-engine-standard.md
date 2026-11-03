---
title: "มาตรฐาน Engine รายงานกลางและตัวออกแบบ JSON-First (Global Report Engine)"
tags: [standards, report, backend, frontend, json, security]
aliases: ["UniversalReportScreen", "report.go", "executedSql", "Live SQL Query Studio", "erp_report_template", "JSON-First", "FastReportDesigner", "FormDesigner", "ห้ามตัดข้อมูลรายงาน", "widthPct 100", "รายงานสลับภาษา", "customSql", "validateReadOnlyReportSQL", "report On-The-Fly"]
sources: ["AGENTS.md:53-54", "AGENTS.md:59", "AGENTS.md:62", ".agents/skills/report-and-form-engine/SKILL.md:14-35", ".agents/skills/report-and-form-engine/SKILL.md:37-44", ".agents/skills/report-and-form-engine/SKILL.md:52-54", "docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md:27-32", "backend/internal/application/process/report.go:63", "backend/internal/application/process/report.go:131", "backend/internal/application/process/report.go:190", "backend/internal/application/process/report.go:327-336", "backend/internal/application/process/report.go:347", "backend/internal/application/process/report_template.go:69", "backend/internal/application/process/report_template.go:499-535", "backend/internal/application/process/report_template.go:642-671", "backend/internal/application/process/report_menu_ic.go:20", "backend/internal/application/process/report_menu_so_po.go:21", "backend/internal/application/process/report_menu_ic_test.go:103-120", "backend/internal/application/process/report_menu_so_po_test.go:142-165", "backend/internal/adapter/inbound/http/process/handler.go:222-268", "backend/internal/adapter/inbound/http/process/permission.go:60-67", "frontend/account/report/UniversalReportScreen.tsx:641", "frontend/account/report/UniversalReportScreen.tsx:1095", "frontend/account/report/formDesignerPresets.ts:1771", "frontend/account/report/formDesignerPresets.ts:1815", "frontend/shared/components/GlobalDocFormPrintModal.tsx"]
---

# มาตรฐาน Engine รายงานกลาง (Global Report & Form Engine, JSON-First)

รายงานทุกตัวผ่าน `UniversalReportScreen.tsx` + `report.go` + `report_pdf.go` ให้ผลเหมือนกันทั้งหน้าจอและ PDF: แสดงครบ ไม่ตัดทิ้ง ตัวเลขไม่ปัดบรรทัด รองรับ 2 ภาษา และตัวออกแบบใช้ JSON/JSONB (เลิก XML `.frx`/`.xml`) — กฎต้นทางคือข้อ 12, 13, 18 และ 21 (`AGENTS.md:53-54`, `:59`, `:62`)

## กฎ/วิธีทำ
1. **ห้ามตัดข้อมูลทิ้ง** — ห้าม `..` หรือ `LIMIT` แฝงใน SQL ของรายงานมาตรฐาน; ข้อความยาวตัดบรรทัดอัตโนมัติแบบไม่แยกสระ/วรรณยุกต์ ([[std-report-pdf-thai-wrap-multilevel]])
2. **ตัวเลขและวันที่** (`SKILL.md:16-19`)
   - ตัวเลขชิดขวา `text-right tabular-nums whitespace-nowrap` ห้ามปัดบรรทัด; ค่า `0`/`0.00` แสดงเป็นว่าง `""`
   - วันที่ `DD/MM/YYYY` ตาม `erp_option.year_type` ทั้งหน้าจอและ PDF — ฝั่ง backend อ่านค่าที่ `report.go:190` ([[std-ux-buddhist-year-bilingual]])
   - ยอดรวมท้ายรายงาน (Grand Total / Sub-total) เรียงแนวนอนบรรทัดเดียวและตรงคอลัมน์
3. **ความกว้างคอลัมน์** — ทุกคอลัมน์มี `widthPct` รวม `100.00%` พร้อมปุ่ม `↔` (Auto-Fit) / `↺` (Reset); ฝั่งหน้าจอ Auto-Fit คือ `handleAutoFitDataWidths` (`UniversalReportScreen.tsx:641`) ซึ่งเรียก `computeAutoColumnWidthsFromData` จากข้อมูลจริง
4. **เปิด/ปิดคอลัมน์ ปรับ % เปลี่ยนชื่อหัวคอลัมน์** แล้วบันทึกเป็นแม่แบบลงตาราง `erp_report_template` (JSONB) ได้ — ชนิดข้อมูลแม่แบบคือ `ReportTemplateDTO` (`report_template.go:69`)
5. **Live SQL Query Studio** — ผลรายงานคืน `executedSql` (`ExecutedSQL`, `report.go:131`; ตั้งค่าที่ `:347`) ให้หน้าจอแสดงในแท็บ SQL Query Studio เพื่อตรวจและแก้ SQL On-The-Fly
6. **ซ่อนชื่อตัวแปร `_`** ในวงเล็บต่อท้ายหัวคอลัมน์/ป้ายช่องกรอก (`AGENTS.md:59`, [[std-input-controls-and-labels]])
7. **รายงานคลัง IC / ใบสั่ง SO-PO** (`report_menu_ic.go`, `report_menu_so_po.go`)
   - รายงานรายละเอียดเอกสารสินค้า (`icDocDetailSpec`, `sopoDetailSpec`) และรายงานยอดคงเหลือ/ผลต่างตรวจนับ (`menu_item_balance`, `menu_diff_from_count`) ต้องแสดง **`หน่วยนับขนาน`** กับ **`จำนวนขนาน` / `ยอดคงเหลือขนาน`** เสมอ (`SKILL.md:27`, [[std-parallel-unit-and-ref-import]])
   - แต่ละ spec ผูกพารามิเตอร์ `$1..$7` ผ่าน CTE `prm` (`icPrm` `report_menu_ic.go:20`, `sopoPrm` `report_menu_so_po.go:21`) — เทสต์บังคับให้ `$1`–`$7` โผล่ในเอกสาร SQL ครั้งเดียวต่อหมายเลข
   - alias `AS "…"` ต้องตรงกับ `ReportColumnMeta.Key` และไม่เกิน 63 ไบต์ (PostgreSQL ตัดชื่อที่ยาวกว่า) — เทสต์ฝั่ง IC บังคับ `Key == Label` เพิ่มด้วย
8. **2 ภาษาแยกอิสระ** (ไทย / English / TH+EN) ผ่าน `data-independent-lang="true"` — พบที่รากของ `UniversalReportScreen.tsx` (`:1095`, `:1430`, `:1671`) และที่ `GlobalDocFormPrintModal.tsx`; `GlobalReportPrintModal.tsx` ไม่มีแอตทริบิวต์นี้แม้ skill (`SKILL.md:31`) ระบุไว้ คำอ่านจำนวนเงินบาทไทย/อังกฤษคือ `numberToThaiBahtText` (`formDesignerPresets.ts:1771`) และ `numberToEnglishBahtText` (`:1815`) — ดู [[std-ux-buddhist-year-bilingual]]
9. **JSON-First Designer** — `FastReportDesignerScreen.tsx` และ `FormDesignerScreen.tsx` (โฟลเดอร์ `frontend/account/report/`) เก็บ JSON Schema; `FastReportDesignerScreen.tsx` เก็บทั้งก้อนใน `description` พร้อม `columns` และ `customSql` (คอมเมนต์ `:1308`) และอ่านรายการแม่แบบจาก `erp_report_template` (`:942`)

## API และสิทธิ์ (ตรวจกับโค้ด)
- `POST /api/process/report/run` body `{ menuKey, viewDetail, dateFrom, dateTo, fromCode, toCode, keyword, options }` — handler `RunReport` (`process/handler.go:222-223`)
- `POST /api/process/report/pdf` คืน PDF — handler `RenderReportPDF` (`handler.go:268-269`); วิธีตัดคำดู [[std-report-pdf-thai-wrap-multilevel]]
- **สิทธิ์**: รายงานมาตรฐานต้องมีสิทธิ์ Read แต่ถ้า body มี `customSql` ไม่ว่างต้องเป็น Admin (`permission.go:60-67`; เทสต์ `permission_test.go:88-91`) — ใช้กับทั้ง `report/run` และ `report/pdf`

## On-The-Fly SQL (customSql) — ตรวจกับโค้ด
- `validateReadOnlyReportSQL` (`report_template.go:502`) รับเฉพาะคำสั่งเดียวที่ขึ้นต้น `SELECT` หรือ `WITH` ตัดคอมเมนต์ก่อน ปฏิเสธ `;` หลายคำสั่ง และคำสั่งเปลี่ยนข้อมูล (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `GRANT`, `REVOKE`, `CREATE`, `COPY`, `CALL`, `EXECUTE` ฯลฯ, regex ที่ `:499`) โดยไม่นับข้อความในเครื่องหมาย `'…'`
- `runCustomSQLReport` (`:644`) รันใน transaction ชนิด `ReadOnly` (`:664-667`) แล้ว rollback เสมอ (`:671`)
- **ข้อยกเว้นของกฎ "ห้าม LIMIT แฝง"**: ถ้า SQL ผู้ใช้ไม่มี `LIMIT` ระบบห่อด้วย `SELECT * FROM (…) AS _bc_otf_q LIMIT 50000` (`:660-662`) — เป็นเพดานความปลอดภัยของ SQL ผู้ใช้เท่านั้น ส่วน SQL ของรายงานมาตรฐานห้ามมี `LIMIT 50000`

## ตรวจสอบ
```bash
cd backend && go test ./internal/application/process -run "TestSOPO|TestIC"
```
- `TestICSpecsWellFormed` (`report_menu_ic_test.go:103`): รหัสรายงานไม่ซ้ำ, `$1..$7` ครบ, ไม่มี `LIMIT 50000`, key ไม่ซ้ำ/≤63 ไบต์/เท่ากับ label
- `TestSOPOSpecsWellFormed` (`report_menu_so_po_test.go:142`): เช่นเดียวกัน แต่ห้ามทั้ง `LIMIT 50000`/`LIMIT 100000` **และ `SELECT *`**
- เทสต์ฝั่ง IC ไม่ได้ตรวจ `SELECT *` และมีเคสที่ใช้ `SELECT * FROM (… UNION ALL …) u` เป็นตัวห่อ (`report_menu_ic.go:385`) — ข้อห้าม `SELECT *` ของ skill (`SKILL.md:53`) จึงถูกบังคับด้วยเทสต์เฉพาะฝั่ง SO/PO

## เอกสารที่ชี้ชื่อ/ที่ตั้งไม่ตรงโค้ดปัจจุบัน (ตรวจ 2026-11-03)
- `SKILL.md:43-44` ชี้ `frontend/account/reports/` และ `frontend/account/tools/` — ที่ตั้งจริงของ `UniversalReportScreen.tsx`, `GlobalReportPrintModal.tsx`, `FastReportDesignerScreen.tsx`, `FormDesignerScreen.tsx` คือ `frontend/account/report/`; `GlobalDocFormPrintModal.tsx` อยู่ที่ `frontend/shared/components/`
- `KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md:28` และ `:32` อ้างฟังก์ชัน `autoFitColumns` และ `cleanFieldDisplayLabel` — ไม่พบในโค้ด backend/frontend ปัจจุบัน

## ที่มา
- `.agents/skills/report-and-form-engine/SKILL.md` Workflow 1–4, Config, Limitation
- `docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md` Workflow §3
- `AGENTS.md` กฎข้อ 12, 13, 18, 21

## ดูเพิ่ม
[[standards-overview]] · [[std-report-pdf-thai-wrap-multilevel]] · [[std-grid-autofit-reset]] · [[std-ux-buddhist-year-bilingual]] · [[std-data-integrity-money-transactions]] · [[std-security-authz-and-web-vulns]] · [[backend-overview]] · [[accounting-overview]]
