---
title: "มาตรฐาน Engine รายงานกลางและตัวออกแบบ JSON-First (Global Report Engine)"
tags: [standards, report, backend, frontend, json]
aliases: ["UniversalReportScreen", "report.go", "executedSql", "Live SQL Query Studio", "erp_report_template", "JSON-First", "FastReportDesigner", "FormDesigner", "ห้ามตัดข้อมูลรายงาน", "widthPct 100", "รายงานสลับภาษา"]
sources: ["docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md", ".agents/skills/report-and-form-engine/SKILL.md", "AGENTS.md", "backend/internal/application/process/report.go:131", "backend/internal/application/process/report_template.go", "backend/internal/adapter/inbound/http/process/handler.go:222", "frontend/account/report/UniversalReportScreen.tsx:641", "frontend/account/report/UniversalReportScreen.tsx:1085"]
---

# มาตรฐาน Engine รายงานกลาง (Global Report & Form Engine, JSON-First)

รายงานทุกตัวผ่าน `UniversalReportScreen.tsx` + `report.go` + `report_pdf.go` ให้ผลเหมือนกันทั้งหน้าจอและ PDF: แสดงครบ ไม่ตัดทิ้ง ตัวเลขไม่ปัดบรรทัด รองรับ 2 ภาษา และตัวออกแบบใช้ JSON/JSONB 100% (เลิก XML `.frx`/`.xml`)

## กฎ/วิธีทำ
1. **ห้ามตัดข้อมูลทิ้ง** — ห้าม `..` หรือ `LIMIT` แฝง; ข้อความยาวตัดบรรทัดอัตโนมัติแบบไม่แยกสระ/วรรณยุกต์ ([[std-report-pdf-thai-wrap-multilevel]])
2. **ตัวเลขและวันที่**
   - ตัวเลขชิดขวา `text-right tabular-nums whitespace-nowrap` ห้ามปัดบรรทัด; ค่า `0`/`0.00` แสดงเป็นว่าง `""`
   - วันที่ `DD/MM/YYYY` ตาม `erp_option.year_type` ทั้งหน้าจอและ PDF ([[std-ux-buddhist-year-bilingual]])
   - ยอดรวมท้ายรายงาน (Grand Total / Sub-total) เรียงแนวนอนบรรทัดเดียวและตรงคอลัมน์เป๊ะ
3. **ความกว้างคอลัมน์** — ทุกคอลัมน์มี `widthPct` รวม `100.00%` พร้อมปุ่ม `↔` (Auto-Fit) / `↺` (Reset); Auto-Fit วัดจากความยาวข้อมูลจริง (ไม่นับสระลอย/วรรณยุกต์) บีบคอลัมน์ตัวเลขให้กระชับ คืนพื้นที่ให้คอลัมน์ชื่อ (ฝั่งหน้าจอคือ `handleAutoFitDataWidths` ที่ `UniversalReportScreen.tsx:641`)
4. **เปิด/ปิดคอลัมน์ ปรับ % เปลี่ยนชื่อหัวคอลัมน์** แล้วบันทึกเป็นแม่แบบลงตาราง `erp_report_template` (JSONB) ได้ทันที (`report_template.go`)
5. **Live SQL Query Studio** — ทุก API รายงานต้องคืน `executedSql` (`ExecutedSQL` ใน `report.go:131`) ให้หน้าจอแสดงในแท็บ SQL Query Studio เพื่อตรวจและแก้ SQL On-The-Fly
6. **ซ่อนชื่อตัวแปร `_`** ในวงเล็บต่อท้ายหัวคอลัมน์/ป้ายช่องกรอก (กฎเดียวกับ [[std-input-controls-and-labels]])
7. **รายงานคลัง IC / ใบสั่ง SO-PO** (`report_menu_ic.go`, `report_menu_so_po.go`)
   - รายงานรายละเอียดเอกสารสินค้า และรายงานยอดคงเหลือ/ผลต่างตรวจนับ ต้องแสดง **`หน่วยนับขนาน`** กับ **`จำนวนขนาน` / `ยอดคงเหลือขนาน`** เสมอ (ดู [[std-parallel-unit-and-ref-import]])
   - ทุก `sopoSpec` / `icSpec` ผูกพารามิเตอร์ `$1..$7` ผ่าน CTE `prm` ครบ; alias `AS "..."` ต้องตรงกับ `ReportColumnMeta.Key` และไม่เกิน 63 bytes
   - ห้าม `SELECT *` และ `LIMIT 50000` ใน SQL รายงาน (ต้องผ่าน `TestSOPOSpecsWellFormed`, `TestICSpecsWellFormed`)
8. **2 ภาษาแยกอิสระ** (ไทย / English / TH+EN) ผ่าน `data-independent-lang="true"` — ดู [[std-ux-buddhist-year-bilingual]]
9. **JSON-First Designer** — `FastReportDesignerScreen.tsx` และ `FormDesignerScreen.tsx` เก็บ JSON Schema ใน `form_design` และ `erp_report_template` เท่านั้น

## API (ตามที่ skill ระบุ)
- `POST /api/process/report/run` body `{ menuKey, viewDetail, dateFrom, dateTo, fromCode, toCode, keyword, options }` — handler `RunReport` ใน `process/handler.go:222` (ตรวจแล้วเส้นทาง `/process/report/run` มีจริง)
- `POST /api/process/report/pdf` คืนไฟล์ `%PDF-1.4` (binary) — วิธีตัดคำใน PDF ดู [[std-report-pdf-thai-wrap-multilevel]]

## ตรวจสอบ
```bash
cd backend && go test ./internal/application/process -run "TestSOPO|TestIC"
```

## ไฟล์ที่อ้างแต่ชื่อ/ที่ตั้งไม่ตรงโค้ดปัจจุบัน
- skill/KMS ใช้ `frontend/account/reports/UniversalReportScreen.tsx` และ `frontend/account/tools/FastReportDesignerScreen.tsx` — ที่ตั้งจริงคือ `frontend/account/report/` (เอกสารชี้โฟลเดอร์ผิด; ไฟล์ `UniversalReportScreen.tsx`, `GlobalReportPrintModal.tsx`, `FastReportDesignerScreen.tsx`, `FormDesignerScreen.tsx` มีจริง)
- `GlobalDocFormPrintModal.tsx` อยู่ที่ `frontend/shared/components/`
- ฟังก์ชัน `cleanFieldDisplayLabel`, `visualRuneLen`, `autoFitColumns` (ฝั่ง Go) ไม่พบในโค้ดปัจจุบัน (ไฟล์อ้างอิงไม่พบแล้ว)

## ที่มา
- `docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md` Objective ข้อ 4, Workflow §3
- `.agents/skills/report-and-form-engine/SKILL.md` Workflow 1–4, Config, Limitation
- `AGENTS.md` กฎข้อ 12, 13, 21 (รายงานกลาง, JSON-First, 2 ภาษา)

## ดูเพิ่ม
[[standards-overview]] · [[std-report-pdf-thai-wrap-multilevel]] · [[std-grid-autofit-reset]] · [[std-ux-buddhist-year-bilingual]] · [[std-data-integrity-money-transactions]] · [[backend-overview]] · [[accounting-overview]]
