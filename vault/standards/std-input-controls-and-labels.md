---
title: "ช่องกรอกมาตรฐานและกฎป้ายข้อความ (NumberBox, DateBox, CodeBox, LookupBox, ห้าม F1-F12)"
tags: [standards, ux, ui, input, label, frontend]
aliases: ["NumberBox", "ศูนย์แสดงว่าง", "0 แสดงเป็นค่าว่าง", "ห้ามใช้ F1 F12", "ห้ามชื่อตัวแปรในวงเล็บ", "CodeBox uppercase", "LookupBox แว่นขยาย", "ปุ่มเครื่องคิดเลข", "auditScreen"]
sources: ["AGENTS.md", "docs/kms/KMS_AGENTS_RULES_FULL.md", ".agents/skills/bc-ux-workflow-and-platform-standards/SKILL.md", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md", "docs/BCERP_SCREEN_PORTING_STANDARDS.md", "frontend/shared/ui/NumberBox.tsx", "frontend/shared/ui/DateBox.tsx", "frontend/src/lib/numeric.ts"]
---

# ช่องกรอกมาตรฐานและกฎป้ายข้อความ

กฎข้อ 4 และ 18 ของ `AGENTS.md` กำหนดพฤติกรรมช่องกรอกและป้ายข้อความให้เหมือนกันทั้งระบบ (หน้าจอและรายงาน)

## ชนิดช่องกรอก
| ชนิด | กฎ |
|---|---|
| **NumberBox** (`frontend/shared/ui/NumberBox.tsx`) | บล็อกตัวอักษร 100% (รับ `0-9`, `.`, `-`), ชิดขวา, มีปุ่มเครื่องคิดเลข `🧮`, คั่นหลักพัน `,`, ทศนิยมตาม `erp_option` |
| ค่าศูนย์ | ถ้าค่าเป็น `0` หรือ `0.00` ให้แสดงว่าง (`""`) **ทั้งหน้าจอและรายงาน** |
| **DateBox** (`frontend/shared/ui/DateBox.tsx`) | แสดง `DD/MM/YYYY` ตาม `erp_option.year_type` (`0`=ค.ศ., `1`=พ.ศ.) เก็บ DB เป็น `YYYY-MM-DD` (ค.ศ.) เท่านั้น — ดู [[std-ux-buddhist-year-bilingual]] |
| **CodeBox** | แสดงตัวพิมพ์ใหญ่ (Uppercase) และ Read-Only เมื่ออยู่โหมดแก้ไข |
| **LookupBox** | กล่องค้นหาพร้อมปุ่มแว่นขยาย `🔍`; ตารางใน Modal คลิกแถวเดียวเลือกทันที (Single-Click) |

## กฎห้ามบนป้ายและปุ่ม
- **ห้ามใช้ `F1`–`F12`** ทั้งบนปุ่ม Tooltip และป้าย — ทุกคำสั่งต้องเป็นปุ่มที่คลิกได้จริง
- **ห้ามมีชื่อตัวแปรที่มี `_` ในวงเล็บต่อท้ายป้ายภาษาไทย** เช่น ห้าม `(doc_no)` (ฝั่ง backend ใช้ฟังก์ชันล้างป้ายชื่อฟิลด์ตามเอกสารเรียกว่า `cleanFieldDisplayLabel` แต่ชื่อนี้ไม่พบใน source ปัจจุบัน — ตรวจก่อนอ้าง)
- ห้ามมี `undefined`, `NaN`, `[object Object]` บนหน้าจอ
- ห้ามปุ่มที่ไร้ชื่อ ไร้ `title` และไร้ `aria-label`
- ปุ่ม/ตัวหนังสือ/ช่องกรอกในแถวเดียวกันต้องอยู่ระนาบ Baseline เดียวกัน (ตรวจด้วย `bc.auditScreen` ดู [[std-uat-swarm-dsl-and-tester-rules]])

## ตัวเลขฝั่ง Frontend
- ห้ามคำนวณเงิน/ภาษี/สต็อกด้วย `parseFloat` หรือ `Number()` ให้ใช้ helper ใน `frontend/src/lib/numeric.ts` (`decimalSql`, `roundBc`, `evalArithmeticSafe`) และให้ Go backend เป็นผู้คุมกฎหลัก
- บทเรียนบั๊กที่เคยพบกับ NumberBox/เครื่องคิดเลข: `100+7%` ต้องได้ 107 (ไม่ใช่ 100.07), ช่องจำนวนเต็ม `"30.00"` ต้องไม่กลายเป็น `"300"`, พิมพ์ `.5` ต้องเป็น `0.5`, วางตัวเลขกลางค่า `1,234` ต้องไม่แทรกผิดตำแหน่ง (รายละเอียดใน [[std-data-integrity-money-transactions]])
- ตัวอย่างใน skill ใช้ `formatDisplayNumber` กับ `@/lib/date` — ทั้งสองชื่อ/ไฟล์นี้ไม่พบใน repo ปัจจุบัน (ไฟล์อ้างอิงไม่พบแล้ว) ตัวที่มีจริงคือ `formatBcDate` / `getBcYearType` ใน `numeric.ts` และ `isoToDmy` ใน `frontend/shared/ui/dateText.ts`

## ที่มา
- `AGENTS.md` กฎข้อ 4, 18
- `docs/kms/KMS_AGENTS_RULES_FULL.md` ข้อ 4, 18
- `.agents/skills/bc-ux-workflow-and-platform-standards/SKILL.md` Workflow ข้อ 2 + Limitation
- `docs/BCERP_SCREEN_PORTING_STANDARDS.md` §23 (รายการที่ UAT ตรวจบนหน้าจอ)
- `docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md` ตาราง N1–N4

## ดูเพิ่ม
[[standards-overview]] · [[std-screen-header-toolbar-theme]] · [[std-ux-buddhist-year-bilingual]] · [[std-grid-autofit-reset]] · [[frontend-overview]]
