---
title: "Header และ Toolbar 2 แถว ธีมการ์ด และสีพื้นหลัง Widget (EmployeeScreen Standard)"
tags: [standards, ux, ui, toolbar, theme, frontend]
aliases: ["header 2 แถว", "toolbar แก้ไข เพิ่มใหม่ ลบ", "EmployeeScreen standard", "card-head", "ปุ่มบันทึก ปิดหน้าจอ", "สีพื้นหลัง widget", "custom-widget-bg", "ห้ามดัดแปลง layout", "ธีม card ขาว"]
sources: ["AGENTS.md", "docs/kms/KMS_AGENTS_RULES_FULL.md", ".agents/skills/bc-ux-workflow-and-platform-standards/SKILL.md", "docs/kms/KMS_TABLE_GRID_AND_WIDGET_STANDARD.md", "frontend/account/master/EmployeeScreen.tsx", "frontend/shared/layout/AppearanceProvider.tsx:183", "frontend/shared/ui/Button.tsx", "frontend/src/app/globals.css"]
---

# Header และ Toolbar 2 แถว (มาตรฐาน EmployeeScreen)

ทุกหน้าจอใน `frontend/account` ใช้โครง Header 2 แถวและโหมดทำงาน 2 โหมด (ดูข้อมูล vs แก้ไข/เพิ่มใหม่) เหมือน `EmployeeScreen.tsx` บน Right/Detail Pane (กฎข้อ 1)

## กฎ/วิธีทำ
**แถว 1 – Title Bar** `<header className="card-head justify-between">`
- ซ้าย: ชื่อโหมดหน้าจอ (เช่น หน้าจอบันทึก/แก้ไขข้อมูล)
- ขวา: สถานะบันทึก, `แก้ไขแล้ว X ช่อง`, ป้ายโหมด (`ดูข้อมูล` / `กำลังแก้ไข` / `เพิ่มใหม่`)

**แถว 2 – Toolbar** `<div className="flex h-11 items-center justify-between border-b border-line bg-surface-subtle px-3 select-none">`
| โหมด | ปุ่มที่แสดง |
|---|---|
| `!isEditing` | `[✏️ แก้ไข]`, `[➕ เพิ่มใหม่]`, `[🗑️ ลบ]` (`variant="danger"`), `[❌ ปิดหน้าจอ]` — ใช้ `<Button size="sm">` |
| `isEditing` | เฉพาะ `[💾 บันทึก]` (`variant="accent"`) และ `[↩️ ปิดหน้าจอ]` |
- ห้ามแสดง 5 ปุ่มพร้อมกัน และห้ามใส่ `F1`–`F12` (เช่น `(F12)`) บนปุ่ม
- ขวาบนของแถว 2: Badge `{menuCode}` + `<h1 className="text-emerald-700 font-bold text-base md:text-lg tracking-wide select-none">{title}</h1>` (ชื่อจอสีเขียวมรกต)
- ปุ่ม `↩️ ปิดหน้าจอ` ในโหมดแก้ไขถามยืนยันผ่าน `confirmDiscard()` (ดู [[std-frontend-ux-bug-lessons]])

## ผังช่องกรอกและการห้ามดัดแปลง (กฎข้อ 2, 6)
- ถอด Row & Column จาก C# เดิมเป๊ะ ฟิลด์ข้ามคอลัมน์ใช้ `col-span` (วิธีถอดดู [[std-csharp-screen-porting]])
- ห้ามยุบตารางหลายตัวเป็นแท็บย่อยเอง ถ้าจอเดิมเรียงแนวตั้งต้องเรียงแนวตั้งเหมือนเดิม
- Motion/Polish ห้ามเปลี่ยนตำแหน่งช่องกรอก ลำดับฟิลด์ หรือโครง Toolbar 2 แถว

## ธีมและการตกแต่ง (กฎข้อ 3)
- Card ขาว: `bg-white rounded-lg border border-line shadow-sm`
- สีโฟกัสช่องกรอก `#fff9e6`; พื้นหลังหน้า `bg-surface-muted/20`

## สีพื้นหลัง Widget (Widget Background Color Picker)
- ผู้ใช้เลือกจาก 10 สีมาตรฐาน (`WIDGET_BG_PRESETS` ใน `AppearanceProvider.tsx:183`) หรือ `<input type="color">` ที่แผงตั้งค่าหัวข้อ `1.2 สีพื้นหลังของ Widget / กล่องข้อมูล`
- เก็บใน `localStorage` ที่ `widgetBgColor` (ค่าเริ่มต้น `""` = ขาวมาตรฐาน) และฉีดเป็น CSS Variable `--custom-widget-bg` บน `document.documentElement` พร้อมคลาส `.custom-widget-bg-active`
- มีผลกับ `.card`, `.bg-white`, `.bg-surface` เมื่ออยู่โหมดสว่าง; ไม่ใช้ `background-color` override ใน polish อื่น (ดู [[std-motion-ui]])
- หมายเหตุ: KMS เขียนชื่อ key เป็น `bc_appearance_v1.widgetBgColor` แต่ `AppearanceProvider.tsx:109` ใช้ `STORAGE_KEY = "bc_appearance_v2"` (prepaint script อ่าน v2 ก่อน แล้ว fallback v1)

## ที่มา
- `AGENTS.md` กฎข้อ 1, 2, 3, 6
- `docs/kms/KMS_AGENTS_RULES_FULL.md` ข้อ 1–3, 6
- `.agents/skills/bc-ux-workflow-and-platform-standards/SKILL.md` Workflow ข้อ 1
- `docs/kms/KMS_TABLE_GRID_AND_WIDGET_STANDARD.md` Workflow ข้อ 4 (สีพื้นหลัง Widget)
- `frontend/account/master/EmployeeScreen.tsx` (ตรวจแล้วมีจริง) — skill/KMS อ้าง `frontend/src/components/screens/master/EmployeeScreen.tsx` (ไฟล์อ้างอิงไม่พบแล้ว)

## ดูเพิ่ม
[[standards-overview]] · [[std-input-controls-and-labels]] · [[std-motion-ui]] · [[std-grid-autofit-reset]] · [[frontend-overview]]
