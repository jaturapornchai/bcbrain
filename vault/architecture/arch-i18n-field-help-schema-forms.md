---
title: สถาปัตยกรรม Schema-Driven Forms (erpOption 9 Tabs), Field Help, ระบบสองภาษา DOM, Report Hierarchy และ 3D Telemetry
tags: [architecture, schema-form, i18n, field-help, report-hierarchy, workmonitor, frontend]
aliases: [SchemaForm, bcFieldHelpCatalog, GlobalLanguageTranslator, bcI18n, buildReportMultiLevelHierarchy, WorkstationTelemetryAgent]
sources:
  - frontend/account/form/SchemaForm.tsx:1-397
  - frontend/account/form/FieldControl.tsx:1-335
  - frontend/src/config/schemas/erpOption/index.ts:1-61
  - frontend/src/config/help/bcFieldHelpCatalog.ts:1-579
  - frontend/src/config/i18n/bcI18n.tsx:1-150
  - frontend/src/config/i18n/bcLangEngine.ts:1-120
  - frontend/src/config/i18n/bcLanguageStore.ts:1-120
  - frontend/src/config/i18n/bcBilingualDataCache.ts:1-120
  - frontend/shared/components/GlobalLanguageTranslator.tsx:1-500
  - backend/internal/platform/i18n/catalog.go:1-150
  - backend/internal/platform/i18n/catalog_compose.go:1-183
  - backend/internal/platform/i18n/language.json:1-30
  - backend/internal/application/process/report_lang_lo.go:1-370
  - backend/internal/application/process/report_pdf.go:25-150
  - backend/internal/application/process/report_hierarchy.go:1-663
  - frontend/workmonitor/WorkstationTelemetryAgent.tsx:1-1676
---

# สถาปัตยกรรม Schema-Driven Forms, Field Help, ระบบสองภาษา DOM, Report Hierarchy และ 3D Telemetry

สรุปกลไก Global Shared Engine ฝั่ง Frontend และระบบรายงานหลายระดับชั้นที่ทำให้ทุกหน้าจอของ BC Ai Account ทำงานเป็นมาตรฐานเดียวกันทั้งหมด

---

## 1. Schema-Driven Forms & Edition Field Filtering (`SchemaForm.tsx`, `erpOption/*`)

- `SchemaForm.tsx` และ `FieldControl.tsx` เรนเดอร์ฟอร์มมาตรฐานจากนิยามสคีมา (`frontend/src/config/schemas/*`) รองรับชนิดช่องกรอกครบชุด (`code`, `textarea`, `checkbox`, `radio`, `select`, `lookup`, `number`, `date`, `image`, `label`)
- กรองซ่อนช่องกรอกตามรุ่นผลิตภัณฑ์อัตโนมัติ (`STARTER_HIDDEN_GL_FIELDS`, `STARTER_HIDDEN_BRANCH_DEPT_FIELDS`, `PRO_ONLY_SCHEMA_FIELDS`)
- สำหรับเมนู `1004` (`erpOption/index.ts`) ตัวแปลง prefix กระจายค่าลง 4 ตารางอัตโนมัติ: ไม่มี prefix → `erp_option`, `thaiqr.*` → `erp_thai_qr_config`, `etax.*` → `erp_option_etax_inet`, `mobillyst.*` → `erp_option_mobillyst`

---

## 2. Contextual Field Help & Multi-Language Store/DOM Engine (`bcFieldHelpCatalog.ts`, `bcI18n.tsx`, `bcLangEngine.ts`, `bcLanguageStore.ts`, `GlobalLanguageTranslator.tsx`)

- **Field Help**: `bcFieldHelpCatalog.ts` จับคู่ช่องกรอก ปุ่ม แท็บ และคอลัมน์เข้ากับคลังคำอธิบายภาษาไทยใน `frontend/src/config/help/data/*.json` (`bc_fields.json`, `bc_phrases.json`, `ar_ap.json`, `ic.json`, `gl_tax.json`, `trans.json`) และ endpoint `/api/v1/help`
- **Compact Language Packs (`bcLanguageStore.ts` + `bcLangEngine.ts`)**: โหลดชุดภาษาจาก Next.js Proxy (`/api/language?pack=<lang>` → Go Backend `GET /api/v1/language/pack` จาก `language.json` ที่มี `6,317` รายการใน `34` กลุ่ม ผ่าน `CatalogStore` ใน `catalog.go`) แบบ Lazy เฉพาะภาษาที่ใช้งาน (`th`, `en`, `lo`) รองรับ `ETag` (`304 Not Modified`) และ `gzip` แล้ว compile เทมเพลตข้อความและดัชนี hash (`cat`, `lex`) ไว้ในหน่วยความจำโดยไม่ bundle คำศัพท์ไว้ฝั่ง Client
- **Multi-Language DOM Engine & PDF Reports**: `GlobalLanguageTranslator.tsx` (`WeakMap` เก็บข้อความต้นฉบับ + `bcBilingualDataCache.ts` แปลข้อมูลหลักแบบขอดู) รองรับการสลับและแปลหน้าจอทั้ง **3 ภาษา (`th`, `en`, `lo`)** รวมถึงการปรับถ้อยคำภาษาไทยจากพจนานุกรมกลาง (`rewordThaiText`) โดยข้ามเซลล์ข้อมูลธุรกิจจริง (`isDataCellTextNode`, `isDataCellElement`), แปลทั้งข้อความ DOM, `document.title` (`syncDocumentTitle`), แอตทริบิวต์ (`placeholder`, `title`, `aria-label`, `data-hdr-tip`, `label` ของ `OPTGROUP`) และปุ่ม `INPUT`, พร้อมประมวลผล `MutationObserver` แบบแบ่งรอบผ่าน `requestAnimationFrame` (จำกัดเวลา `BUDGET_MS = 20`) เพื่อไม่ให้หน่วงหน้าจอ ส่วนฝั่ง Go Backend ใช้ `TranslateThaiToLao` / `TranslateThaiToEnglish` (`catalog_compose.go`) ร่วมกับ `report_lang_lo.go` (`addPDFFonts` ฝังฟอนต์ไทย-ลาว `thai`/`thai-bold`/`lao`/`lao-bold` และ `splitPDFScriptRuns`) เพื่อพิมพ์รายงาน PDF รองรับทั้ง **ไทย / อังกฤษ / ลาว** โดยแยกภาษาอิสระจากหน้าจอได้ (`report_pdf.go`)

---

## 3. Multi-Level Report Hierarchy (`report_hierarchy.go`) & 3D Workstation Telemetry

- **`buildReportMultiLevelHierarchy`**: คำนวณยอดรวมย่อยหลายชั้นด้วย `*math/big.Rat` และแยกคอลัมน์ยอดคงเหลือสะสม (`isRunningBalanceReport`: `ยอดคงเหลือ`, `มูลค่าคงเหลือ`, `ยอดคงค้าง`, `ต้นทุนเฉลี่ย`) ให้ดึงค่าบรรทัดสุดท้ายของกลุ่มแทนการบวกซ้ำ
- **`WorkstationTelemetryAgent.tsx`**: จับสถานะแท็บที่เปิดและเหตุการณ์หน้างาน (บันทึก/แก้ไข/ยกเลิก/ปิดโดยไม่บันทึก/สลับออกนอกหน้าต่าง) โดยกรองไม่เก็บค่ารหัสผ่านหรือข้อมูลลับ ส่งเข้า `fraudWarningData.ts` (7 แผนก) เพื่อแสดงบนโต๊ะ 3 มิติ

---

## ดูต่อที่เกี่ยวข้อง
- [[part_of_arch::arch-ui-grid-report-standard]] · [[part_of_arch::arch-feature-switchboard]]
- [[uses_table::tbl-erp-option]] · [[uses_table::tbl-tenant-workspace-governance]]
