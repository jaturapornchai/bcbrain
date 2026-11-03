---
title: "ปีปฏิทิน พ.ศ./ค.ศ. และระบบ 2 ภาษา + Balloon Help (year_type, Bilingual)"
tags: [standards, ux, i18n, calendar, frontend, backend]
aliases: ["year_type", "ปีพุทธศักราช", "พ.ศ. ค.ศ.", "DB เก็บ ค.ศ.", "ระบบ 2 ภาษา", "ไทย English", "Balloon Help", "สลับภาษา", "ปปปป เลขที่เอกสาร", "วันที่แสดงผิดวัน timezone"]
sources: ["AGENTS.md", "docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md", ".agents/skills/bc-ux-workflow-and-platform-standards/SKILL.md", ".agents/skills/report-and-form-engine/SKILL.md", "frontend/shared/ui/DateBox.tsx:28", "frontend/shared/ui/dateText.ts:8", "frontend/src/lib/numeric.ts:394", "frontend/src/lib/numeric.ts:422", "frontend/src/lib/numeric.ts:516", "frontend/shared/components/GlobalBalloonHelp.tsx"]
---

# ปีปฏิทิน พ.ศ./ค.ศ. และระบบ 2 ภาษา

กฎข้อ 4, 17, 21: ฐานข้อมูลเก็บปี **ค.ศ.** เท่านั้น ส่วนหน้าจอ รายงาน และ PDF เปลี่ยนตามค่า `erp_option.year_type` ทันที ภาษาหน้าจอสลับไทย/English ได้ทั้งหน้า

## กฎปีปฏิทิน (year_type)
- DB (PostgreSQL) เก็บวันที่เป็น `YYYY-MM-DD` ค.ศ. 100% — **ห้ามบันทึกปี พ.ศ. (`25xx`) ลงตาราง** ต้องแปลงเป็น ค.ศ. ก่อนบันทึก
- `erp_option.year_type`: `0` หรือว่าง = ค.ศ., `1` = พ.ศ. (บวก 543)
- แสดงผล `DD/MM/YYYY` ที่ `DateBox.tsx`, `dateText.ts` (`isoToDmy(val, yearType)`), `numeric.ts` (`getBcYearType()` บรรทัด 394, `formatBcDate()` บรรทัด 422)
- ฝั่ง Backend รายงาน/PDF ใช้ `year_type` ใน `report.go`, `report_menu_so_po.go`, `report_menu_gl_fa.go`, `report_pdf.go` (เดิมบวก 543 ตายตัว แก้เป็นตาม `year_type` แล้ว)
- โทเคน `ปปปป` ในรูปแบบเลขที่เอกสาร (`stock_tools.go` `autoRunPattern`) เป็นรูปแบบข้อความของเลขที่ ไม่ใช่การเก็บวันที่ จึงคงไว้
- สลับฐานข้อมูลแล้วต้องล้างแคชค่าตั้งต้น: `invalidateBcSettings()` (`numeric.ts:516`) — `api-client.ts` เรียกให้อัตโนมัติหลัง login/เลือกฐานข้อมูล
- ระวังวันที่ timezone: `new Date("YYYY-MM-DD")` เป็นเที่ยงคืน UTC ทำให้เครื่อง timezone ช้ากว่าแสดงวันก่อนหน้า ให้แยก Y/M/D เป็นวันที่ท้องถิ่น (`formatThaiDate` ใน `utils.ts` แก้แล้ว) และค่าเริ่มต้น "วันนี้" ใช้ `todayLocal()` ไม่ใช่ `toISOString()`
- `GlobalYearTypeFormatter.tsx` ตามที่ KMS อ้างไม่พบในโค้ดแล้ว (ไฟล์อ้างอิงไม่พบแล้ว); `frontend/src/components/ui/DateBox.tsx` ก็ไม่พบ ของจริงอยู่ `frontend/shared/ui/DateBox.tsx`

## ระบบ 2 ภาษา (ไทย / English) และ Balloon Help (กฎข้อ 21)
- ปุ่มธงชาติบน Topbar สลับภาษาทั้งหน้าจอทันที (skill อ้าง `LanguageContext` ค่า `th` | `en` — ชื่อ context นี้ไม่พบเป็นไฟล์ใน source ปัจจุบัน)
- **รายงานและแบบฟอร์มสลับภาษาแยกอิสระ** (`ไทย / English / TH+EN`) จากภาษาหน้าจอหลัก ผ่าน `data-independent-lang="true"` (ตรวจแล้วใน `frontend/account/report/UniversalReportScreen.tsx:1085`) สลับทั้งหัวรายงาน ชื่อคอลัมน์ ข้อมูลหลักสองภาษา (`name_1` / `name_eng_1`) และคำอ่านจำนวนเงินบาท (`numberToThaiBahtText` / `numberToEnglishBahtText`)
- **Balloon Help**: ชี้เมาส์ที่ป้ายฟิลด์/ปุ่มแล้วแสดงคำอธิบายจากคลัง JSON `frontend/src/config/help/data/` ผ่าน `GlobalBalloonHelp.tsx` (ตำแหน่งจริง `frontend/shared/components/GlobalBalloonHelp.tsx`; skill อ้าง `frontend/src/components/common/` ซึ่งไม่พบแล้ว)
- ข้อความ UI ทุกส่วนเน้นภาษาไทยที่เข้าใจง่าย

## ตัวอย่าง (ตามที่ skill ให้)
```
เก็บ DB:   2026-10-30
yearType=1 แสดง 30/10/2569
yearType=0 แสดง 30/10/2026
```

## ที่มา
- `AGENTS.md` กฎข้อ 4, 17, 21
- `docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md` §4 + Limitation
- `docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md` ข้อ N5, N6, M8 และรอบที่ 3 (รายงานตาม `year_type`)
- `.agents/skills/report-and-form-engine/SKILL.md` Workflow ข้อ 3

## ดูเพิ่ม
[[standards-overview]] · [[std-input-controls-and-labels]] · [[std-report-engine-standard]] · [[std-data-integrity-money-transactions]] · [[frontend-overview]]
