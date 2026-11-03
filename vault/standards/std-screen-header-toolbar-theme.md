---
title: "Header และ Toolbar 2 แถว ธีมการ์ด และสีพื้นหลัง Widget (EmployeeScreen Standard)"
tags: [standards, ux, ui, toolbar, theme, frontend]
aliases: ["header 2 แถว", "toolbar แก้ไข เพิ่มใหม่ ลบ", "EmployeeScreen standard", "card-head", "ปุ่มบันทึก ปิดหน้าจอ", "สีพื้นหลัง widget", "custom-widget-bg", "ห้ามดัดแปลง layout", "ธีม card ขาว"]
sources: ["AGENTS.md:35-39", "AGENTS.md:44", "docs/kms/KMS_AGENTS_RULES_FULL.md:10-22", "docs/kms/KMS_AGENTS_RULES_FULL.md:32-34", ".agents/skills/bc-ux-workflow-and-platform-standards/SKILL.md:14-20", "docs/kms/KMS_TABLE_GRID_AND_WIDGET_STANDARD.md:31-33", "docs/kms/KMS_TABLE_GRID_AND_WIDGET_STANDARD.md:45-46", "frontend/account/master/EmployeeScreen.tsx:275", "frontend/account/master/EmployeeScreen.tsx:786", "frontend/account/master/EmployeeScreen.tsx:809", "frontend/account/master/EmployeeScreen.tsx:885", "frontend/shared/layout/AppearanceProvider.tsx:109", "frontend/shared/layout/AppearanceProvider.tsx:183", "frontend/shared/layout/AppearanceProvider.tsx:410", "frontend/shared/layout/AppearanceProvider.tsx:1280", "frontend/src/app/globals.css:352", "frontend/src/app/globals.css:1260", "frontend/src/app/layout.tsx:62"]
---

# Header และ Toolbar 2 แถว (มาตรฐาน EmployeeScreen)

ทุกหน้าจอใน `frontend/account` ใช้โครง Header 2 แถวและโหมดทำงาน 2 โหมด (ดูข้อมูล vs แก้ไข/เพิ่มใหม่) เหมือน `EmployeeScreen.tsx` บน Right/Detail Pane (กฎข้อ 1, `AGENTS.md:35-37`)

## กฎ/วิธีทำ
**แถว 1 – Title Bar** `<header className="card-head justify-between">` (`EmployeeScreen.tsx:786`)
- ซ้าย: ชื่อโหมดหน้าจอ (`หน้าจอบันทึก/แก้ไขข้อมูล`)
- ขวา: สถานะบันทึก (`บันทึกล่าสุด …`), `แก้ไขแล้ว X ช่อง` (`:796-798`), ป้ายโหมดที่โชว์เมื่ออยู่โหมดแก้ไข (`เพิ่มรายการใหม่` / `โหมดแก้ไข`, `:800-803`)

**แถว 2 – Toolbar** `<div className="flex h-11 items-center justify-between border-b border-line bg-surface-subtle px-3 select-none">` (`EmployeeScreen.tsx:809`)
| โหมด | ปุ่มที่แสดง |
|---|---|
| `!isEditing` | `[✏️ แก้ไข]`, `[➕ เพิ่มใหม่]`, `[🗑️ ลบ]` (`variant="danger"`), `[❌ ปิดหน้าจอ]` — ใช้ `<Button size="sm">` (`frontend/shared/ui/Button.tsx`) |
| `isEditing` | เฉพาะ `[💾 บันทึก]` (`variant="accent"`) และ `[↩️ ปิดหน้าจอ]` |
- ห้ามแสดง 5 ปุ่มพร้อมกัน และห้ามใส่ `F1`–`F12` (เช่น `(F12)`) บนปุ่ม
- ขวาบนของแถว 2: Badge `{menuCode}` + `<h1 className="text-emerald-700 font-bold text-base md:text-lg tracking-wide select-none">{title}</h1>` (ชื่อจอสีเขียวมรกต, `EmployeeScreen.tsx:885`)
- ถ้ามีข้อมูลแก้ค้าง การปิดหน้าจอ/เปลี่ยนแถวถามยืนยันผ่าน `confirmDiscardIfDirty()` (`EmployeeScreen.tsx:275`; ดู [[std-frontend-ux-bug-lessons]])

## ผังช่องกรอกและการห้ามดัดแปลง (กฎข้อ 2, 6)
- จัดวาง Row & Column ตาม Schema มาตรฐานของ BC ฟิลด์ข้ามคอลัมน์ใช้ `col-span` (`AGENTS.md:38`) — ขั้นตอนเพิ่มหน้าจอดู [[std-add-screen-workflow]]
- ห้ามยุบตารางหลายตัวเป็นแท็บย่อยเอง ถ้าหน้าจอเรียงแนวตั้งต้องเรียงแนวตั้งเหมือนเดิม (`AGENTS.md:44`)
- Motion/Polish ห้ามเปลี่ยนตำแหน่งช่องกรอก ลำดับฟิลด์ หรือโครง Toolbar 2 แถว ([[std-motion-ui]])

## ธีมและการตกแต่ง (กฎข้อ 3, `AGENTS.md:39`)
- Card ขาว: `bg-white rounded-lg border border-line shadow-sm`
- สีโฟกัสช่องกรอก `#fff9e6` (ตัวแปร `--input-focus-bg`, `globals.css:1260`); พื้นหลังหน้า `bg-surface-muted/20`

## สีพื้นหลัง Widget (Widget Background Color Picker)
- ผู้ใช้เลือกจาก 10 ตัวเลือก (`WIDGET_BG_PRESETS` ใน `AppearanceProvider.tsx:183` รวม `ตามโทนหลัก` ที่ค่าว่าง) หรือ `<input type="color">` (ปุ่ม `กำหนดสีเอง`) ที่แผงตั้งค่าหัวข้อ `1.2 สีพื้นหลังของ Widget / กล่องข้อมูล` (`:1280`)
- เก็บใน `localStorage` ที่ฟิลด์ `widgetBgColor` ของ `STORAGE_KEY = "bc_appearance_v2"` (`AppearanceProvider.tsx:109`; ค่าเริ่มต้น `""` = ใช้สีมาตรฐาน) และฉีดเป็น CSS Variable `--custom-widget-bg` บน `document.documentElement` พร้อม attribute `data-custom-widget-bg="true"` (`:410-413`); สคริปต์ pre-paint ใน `frontend/src/app/layout.tsx:62` ตั้งค่าเดียวกันก่อนหน้าโหลด (อ่านคีย์ `bc_appearance_v2` ก่อน แล้ว fallback `bc_appearance_v1`)
- มีผลกับ `.card`, `.bc-motion-card` และ `section/aside/div.bg-white` เมื่ออยู่โหมดสว่าง (`globals.css:352-358` ใช้ `background-color: var(--custom-widget-bg, var(--light-card-bg))`); ไม่ใช้ `background-color` override ใน polish อื่น (ดู [[std-motion-ui]])
- KMS เขียนชื่อ key เป็น `bc_appearance_v1.widgetBgColor` และคลาส `.custom-widget-bg-active` แต่โค้ดปัจจุบันใช้คีย์ `bc_appearance_v2` และ attribute `data-custom-widget-bg` ข้างต้น

## ที่มา
- `AGENTS.md:35-39`, `:44` กฎข้อ 1, 2, 3, 6
- `docs/kms/KMS_AGENTS_RULES_FULL.md:10-22`, `:32-34`
- `.agents/skills/bc-ux-workflow-and-platform-standards/SKILL.md:14-20` (Workflow ข้อ 1)
- `docs/kms/KMS_TABLE_GRID_AND_WIDGET_STANDARD.md:31-33` (Workflow ข้อ 4 สีพื้นหลัง Widget), `:45-46` (Config)
- `frontend/account/master/EmployeeScreen.tsx` (ตรวจแล้วมีจริง) — skill/KMS อ้าง `frontend/src/components/screens/master/EmployeeScreen.tsx` ซึ่งไม่พบแล้ว

## ดูเพิ่ม
[[standards-overview]] · [[std-input-controls-and-labels]] · [[std-motion-ui]] · [[std-grid-autofit-reset]] · [[std-add-screen-workflow]] · [[frontend-overview]]
