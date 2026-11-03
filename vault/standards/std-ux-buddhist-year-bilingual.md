---
title: "ปีปฏิทิน พ.ศ./ค.ศ. และระบบ 2 ภาษา + Balloon Help (year_type, Bilingual)"
tags: [standards, ux, i18n, calendar, frontend, backend]
aliases: ["year_type", "ปีพุทธศักราช", "พ.ศ. ค.ศ.", "DB เก็บ ค.ศ.", "ระบบ 2 ภาษา", "ไทย English", "Balloon Help", "สลับภาษา", "ปปปป เลขที่เอกสาร", "วันที่แสดงผิดวัน timezone"]
sources: ["AGENTS.md:42", "AGENTS.md:58", "AGENTS.md:62", "docs/kms/KMS_AGENTS_RULES_FULL.md:65-67", "docs/kms/KMS_AGENTS_RULES_FULL.md:77-79", "docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md:34-36", "docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md:97", ".agents/skills/bc-ux-workflow-and-platform-standards/SKILL.md:23", ".agents/skills/bc-ux-workflow-and-platform-standards/SKILL.md:26-28", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:40-41", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:85", ".agents/skills/report-and-form-engine/SKILL.md:18", "frontend/shared/ui/DateBox.tsx:28", "frontend/shared/ui/dateText.ts:8", "frontend/src/lib/numeric.ts:137", "frontend/src/lib/numeric.ts:394", "frontend/src/lib/numeric.ts:422", "frontend/src/lib/numeric.ts:516", "frontend/src/lib/utils.ts:20", "frontend/account/tabs/TabWorkspace.tsx:182", "backend/internal/application/process/report.go:185", "backend/internal/application/process/report.go:357", "backend/internal/application/process/report_pdf.go:892", "backend/internal/application/process/stock_tools.go:701", "frontend/account/report/UniversalReportScreen.tsx:1095", "frontend/shared/layout/AppearanceProvider.tsx:978", "frontend/shared/components/GlobalBalloonHelp.tsx:19"]
---

# ปีปฏิทิน พ.ศ./ค.ศ. และระบบ 2 ภาษา

กฎข้อ 4, 17, 21 (`AGENTS.md:42`, `:58`, `:62`): ฐานข้อมูลเก็บปี **ค.ศ.** เท่านั้น ส่วนหน้าจอ รายงาน และ PDF เปลี่ยนตามค่า `erp_option.year_type` ทันที ภาษาหน้าจอสลับไทย/English ได้ทั้งหน้า

## กฎปีปฏิทิน (year_type)
- DB (PostgreSQL) เก็บวันที่เป็น `YYYY-MM-DD` ค.ศ. 100% — **ห้ามบันทึกปี พ.ศ. (`25xx`) ลงตาราง** ต้องแปลงเป็น ค.ศ. ก่อนบันทึก (`KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md:97`)
- `erp_option.year_type`: `0` หรือว่าง = ค.ศ., `1` = พ.ศ. (บวก 543)
- แสดงผล `DD/MM/YYYY` ที่ `DateBox.tsx` (`:28`), `dateText.ts` (`isoToDmy(val, yearType)`, `:8`), `numeric.ts` (`getBcYearType()` `:394`, `formatBcDate()` `:422`) และ `formatThaiDate` ใน `utils.ts:20` ที่อ่าน `getBcYearType()` ด้วย
- ค่า `year_type` โหลดแบบ async: `account/tabs/TabWorkspace.tsx:182` subscribe ครั้งเดียว (`useSyncExternalStore(subscribeBcSettings, getBcYearType, …)`) ให้ทุกจอที่เปิดอยู่ render ใหม่เอง จอใหม่ไม่ต้อง subscribe ซ้ำ (skill `SKILL.md:23` เตือนว่าถ้าลบออก จอที่เปิดครั้งแรกจะโชว์ ค.ศ.)
- ฝั่ง Backend รายงานอ่านค่าด้วย `readErpYearType` (`report.go:185`, query `SELECT COALESCE(year_type::text,'0') FROM erp_option` ที่ `:190`; ถ้าไม่มี pool คืน `1`) ส่งกลับในผลรายงาน `YearType` แล้ว `applyReportYearType` (`report.go:357`) แปลงวันที่; PDF ตัดสินที่ `report_pdf.go:892` (`res.YearType == 1`); รายงานกลุ่ม SO/PO และ GL/FA ก็อ่าน `readErpYearType` (`report_menu_so_po.go:829`, `report_menu_gl_fa.go:1385`) — บทเรียน "เดิมบวก 543 ตายตัว แก้เป็นตาม `year_type`" อยู่ใน `KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:85`
- โทเคน `ปปปป` ในรูปแบบเลขที่เอกสาร (`autoRunPattern`, `stock_tools.go:701-704`) แทนด้วยปี `ค.ศ. + 543` เสมอ เป็นรูปแบบข้อความของเลขที่ ไม่ใช่การเก็บวันที่ จึงคงไว้
- สลับฐานข้อมูลแล้วต้องล้างแคชค่าตั้งต้น: `invalidateBcSettings()` (`numeric.ts:516`) — `api-client.ts:147` เรียกให้หลัง login/เลือกฐานข้อมูล (บทเรียน N5, `KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:40`)
- ระวังวันที่ timezone (บทเรียน N6 `:41`): `new Date("YYYY-MM-DD")` เป็นเที่ยงคืน UTC ทำให้เครื่อง timezone ช้ากว่าแสดงวันก่อนหน้า ให้แยก Y/M/D เป็นวันที่ท้องถิ่น (`formatThaiDate`, `utils.ts:22-29`) และค่าเริ่มต้น "วันนี้" ใช้ `todayLocal()` (`numeric.ts:137`) ไม่ใช่ `toISOString()`
- KMS (`:36`) อ้าง `frontend/shared/ui/GlobalYearTypeFormatter.tsx` และ `frontend/src/components/ui/DateBox.tsx` ซึ่งไม่พบในโค้ดปัจจุบัน — ตัวจริงคือ `frontend/shared/ui/DateBox.tsx`

## ระบบ 2 ภาษา (ไทย / English) และ Balloon Help (กฎข้อ 21)
- ปุ่มธงชาติสลับภาษาอยู่ใน Header (`LanguageFlagSwitcher`, `AppearanceProvider.tsx:978-985`) เก็บค่าเป็น `settings.language` (`th` | `en`, ค่าเริ่มต้น `th`) และ `GlobalLanguageTranslator.tsx` (ติดตั้งที่ `frontend/src/app/layout.tsx:100`) แปลข้อความบนหน้าจอ skill เรียกกลไกนี้ว่า `LanguageContext` (`SKILL.md:27`) แต่ชื่อนี้ไม่มีในโค้ด
- **รายงานและแบบฟอร์มสลับภาษาแยกอิสระ** (`ไทย / English / TH+EN`) จากภาษาหน้าจอหลัก ผ่าน `data-independent-lang="true"` (`UniversalReportScreen.tsx:1095`, ภาษารายงาน `reportLang` ที่ `:212`) สลับทั้งหัวรายงาน ชื่อคอลัมน์ ข้อมูลหลักสองภาษา (`name_1` / `name_2`) และคำอ่านจำนวนเงินบาท (`numberToThaiBahtText` / `numberToEnglishBahtText` ใน `frontend/account/report/formDesignerPresets.ts:1771`, `:1815`)
- **Balloon Help**: ชี้เมาส์ที่ป้ายฟิลด์/ปุ่มค้างไว้ 2 วินาที (`HOVER_DELAY_MS`, `GlobalBalloonHelp.tsx:19`) แล้วแสดงคำอธิบายจากแค็ตตาล็อก `frontend/src/config/help/bcFieldHelpCatalog.ts` (ข้อมูลใน `frontend/src/config/help/data/*.json`) ผ่าน `frontend/shared/components/GlobalBalloonHelp.tsx` (ติดตั้งที่ `layout.tsx:101`) ผู้ใช้เปิด/ปิดได้ที่ปุ่มบน Header (`data-testid="header-balloon-help-toggle"`) ค่าเริ่มต้น **ปิด** (`balloonHelp: false`, `AppearanceProvider.tsx:129`)
- ข้อความ UI ทุกส่วนเน้นภาษาไทยที่เข้าใจง่าย

## ตัวอย่าง (ตามที่ skill ให้)
```
เก็บ DB:   2026-10-30
yearType=1 แสดง 30/10/2569
yearType=0 แสดง 30/10/2026
```
ตัวอย่างโค้ดใน skill ใช้ `formatDisplayNumber` กับ `@/lib/date` ซึ่งไม่มีในโค้ดปัจจุบัน ตัวที่มีจริงคือ `formatBcDate` / `getBcYearType` ใน `numeric.ts`

## ที่มา
- `AGENTS.md:42`, `:58`, `:62` กฎข้อ 4, 17, 21
- `docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md:34-36` (§4) และ `:97` (Limitation)
- `.agents/skills/bc-ux-workflow-and-platform-standards/SKILL.md:23`, `:26-28`
- `docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:40-41` (N5, N6), `:85`
- `.agents/skills/report-and-form-engine/SKILL.md:18`

## ดูเพิ่ม
[[standards-overview]] · [[std-input-controls-and-labels]] · [[std-report-engine-standard]] · [[std-data-integrity-money-transactions]] · [[frontend-overview]]
