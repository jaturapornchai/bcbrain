---
title: "ช่องกรอกมาตรฐานและกฎป้ายข้อความ (NumberBox, DateBox, CodeBox, LookupBox, ห้าม F1-F12)"
tags: [standards, ux, ui, input, label, frontend]
aliases: ["NumberBox", "ศูนย์แสดงว่าง", "0 แสดงเป็นค่าว่าง", "ห้ามใช้ F1 F12", "ห้ามชื่อตัวแปรในวงเล็บ", "CodeBox uppercase", "LookupBox แว่นขยาย", "ปุ่มเครื่องคิดเลข", "auditScreen", "BcLookupInput"]
sources: ["AGENTS.md:40-42", "AGENTS.md:59", "docs/kms/KMS_AGENTS_RULES_FULL.md:23-28", "docs/kms/KMS_AGENTS_RULES_FULL.md:68-70", ".agents/skills/bc-ux-workflow-and-platform-standards/SKILL.md:21-25", ".agents/skills/bc-ux-workflow-and-platform-standards/SKILL.md:54-56", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:36-39", "frontend/shared/ui/NumberBox.tsx:34", "frontend/shared/ui/NumberBox.tsx:97", "frontend/shared/ui/DateBox.tsx:28", "frontend/shared/ui/dateText.ts:8", "frontend/account/master/BcLookupInput.tsx:38", "frontend/account/master/BcLookupModal.tsx:980", "frontend/src/lib/numeric.ts:110", "frontend/src/lib/numeric.ts:231", "frontend/src/lib/numeric.ts:842"]
---

# ช่องกรอกมาตรฐานและกฎป้ายข้อความ

กฎข้อ 4 และ 18 ของ `AGENTS.md` (`:40-42`, `:59`) กำหนดพฤติกรรมช่องกรอกและป้ายข้อความให้เหมือนกันทั้งระบบ (หน้าจอและรายงาน)

## ชนิดช่องกรอก
| ชนิด | กฎ |
|---|---|
| **NumberBox** (`frontend/shared/ui/NumberBox.tsx`) | บล็อกตัวอักษร 100% (รับ `0-9`, `.`, `-`), ชิดขวา `text-right font-mono`, มีปุ่มเครื่องคิดเลข `🧮` (`BcCalculatorDialog`), คั่นหลักพัน `,` เสมอ (หัวคอมเมนต์ `:94-100`), จำนวนทศนิยมรับ prop `decimals`/`decimalKind` (`:82-83`) |
| ค่าศูนย์ | ถ้าค่าเป็น `0` หรือ `0.00` ให้แสดงว่าง (`""`) **ทั้งหน้าจอและรายงาน** (กฎข้อ 4); ใน NumberBox ตอนโฟกัสค่าศูนย์จะเป็นช่องว่างให้พิมพ์ได้ทันที (`focusText`/`isZeroDecimal`, `:34`) |
| **DateBox** (`frontend/shared/ui/DateBox.tsx`) | แสดง `DD/MM/YYYY` ตาม `erp_option.year_type` (`0`=ค.ศ., `1`=พ.ศ.; `:28`) เก็บ DB เป็น `YYYY-MM-DD` (ค.ศ.) เท่านั้น — ดู [[std-ux-buddhist-year-bilingual]] |
| **CodeBox** | แสดงตัวพิมพ์ใหญ่ (Uppercase) และ Read-Only เมื่ออยู่โหมดแก้ไข (กฎข้อ 4) — ไม่มีไฟล์ชื่อ `CodeBox`; ช่องรหัสแบบมีแว่นขยาย `BcLookupInput.tsx` มี prop `uppercase` ค่าเริ่มต้น `true` (`:38`) ที่แปลงเป็นตัวใหญ่ตอนพิมพ์ |
| **LookupBox** | กล่องค้นหาพร้อมปุ่มแว่นขยาย (ไอคอน `Search` ใน `BcLookupInput.tsx`); ตารางใน Modal (`BcLookupModal.tsx`) คลิกแถวเดียวเลือกแล้วปิดทันที — `onClick` เรียก `handleConfirmSelect(row)` (`:980-983`) |

## กฎห้ามบนป้ายและปุ่ม
- **ห้ามใช้ `F1`–`F12`** ทั้งบนปุ่ม Tooltip และป้าย — ทุกคำสั่งต้องเป็นปุ่มที่คลิกได้จริง (`KMS_AGENTS_RULES_FULL.md:25`)
- **ห้ามมีชื่อตัวแปรที่มี `_` ในวงเล็บต่อท้ายป้ายภาษาไทย** เช่น ห้าม `(doc_no)` (กฎข้อ 18, `AGENTS.md:59`) — KMS เล่าว่ามีฟังก์ชันล้างป้าย `cleanFieldDisplayLabel` ที่ backend (`KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md:32`) แต่ค้นชื่อนี้ใน `backend/` และ `frontend/` ไม่พบ จึงต้องตรวจป้ายด้วยตา/UAT เอง
- ห้ามมี `undefined`, `NaN`, `[object Object]` บนหน้าจอ
- ห้ามปุ่มที่ไร้ชื่อ ไร้ `title` และไร้ `aria-label`
- ปุ่ม/ตัวหนังสือ/ช่องกรอกในแถวเดียวกันต้องอยู่ระนาบ Baseline เดียวกัน (ตรวจด้วย `bc.auditScreen` ดู [[std-uat-swarm-dsl-and-tester-rules]])

## ตัวเลขฝั่ง Frontend
- ห้ามคำนวณเงิน/ภาษี/สต็อกด้วย `parseFloat` หรือ `Number()` ให้ใช้ helper ใน `frontend/src/lib/numeric.ts` (`decimalSql` `:110`, `roundBc` `:231`, `evalArithmeticSafe` `:842`) และให้ Go backend เป็นผู้คุมกฎหลัก (`SKILL.md:54-56` Limitation, กฎข้อ 10 `AGENTS.md:51`)
- บทเรียนบั๊กที่เคยพบกับ NumberBox/เครื่องคิดเลข (`KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:36-39`): `100+7%` ต้องได้ 107 (ไม่ใช่ 100.07), ช่องจำนวนเต็ม `"30.00"` ต้องไม่กลายเป็น `"300"`, พิมพ์ `.5` ต้องเป็น `0.5`, วางตัวเลขกลางค่า `1,234` ต้องไม่แทรกผิดตำแหน่ง (รายละเอียดใน [[std-data-integrity-money-transactions]])
- ตัวอย่างใน skill ใช้ `formatDisplayNumber` กับ `@/lib/date` — ทั้งสองชื่อ/ไฟล์นี้ไม่พบใน repo ปัจจุบัน ตัวที่มีจริงคือ `formatBcDate` / `getBcYearType` ใน `numeric.ts` และ `isoToDmy` ใน `frontend/shared/ui/dateText.ts`

## ที่มา
- `AGENTS.md:40-42`, `:59` กฎข้อ 4, 18
- `docs/kms/KMS_AGENTS_RULES_FULL.md:23-28`, `:68-70` ข้อ 4, 18
- `.agents/skills/bc-ux-workflow-and-platform-standards/SKILL.md:21-25` (Workflow ข้อ 2) และ `:54-56` (Limitation)
- `docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:36-39` ตาราง N1–N4

## ดูเพิ่ม
[[standards-overview]] · [[std-screen-header-toolbar-theme]] · [[std-ux-buddhist-year-bilingual]] · [[std-grid-autofit-reset]] · [[frontend-overview]]
