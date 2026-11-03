---
title: "กฎความปลอดภัยของ Animation: fill-mode, reduced motion และ Prepaint 3 จุด (Motion Safety Rules)"
tags: [standards, ui, motion, css, theme, frontend]
aliases: ["fill-mode backwards", "containing block position fixed", "prefers-reduced-motion", "data-motion off", "APPEARANCE_PREPAINT_SCRIPT", "theme flash", "AppearanceSettings 3 จุด", "ห้ามตัวเลขสมมติ KPI", "bg-ink backdrop", "opacity only tab panel"]
sources: ["docs/kms/KMS_PREMIUM_UI_MOTION_STANDARD.md", ".agents/skills/premium-ui-motion-system/SKILL.md", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md", "frontend/src/app/layout.tsx:62", "frontend/shared/layout/AppearanceProvider.tsx:124", "frontend/shared/layout/AppearanceProvider.tsx:397", "frontend/src/app/globals.css"]
---

# กฎความปลอดภัยของ Animation และ Prepaint 3 จุด

Animation ต้องไม่ทำให้ Modal/Popover/Grid เพี้ยน ต้องเคารพผู้ใช้ที่ปิดการเคลื่อนไหว และการตั้งค่า Appearance ใหม่ต้องไม่ทำให้หน้าจอกะพริบตอนโหลด คลาสที่ใช้ได้ดู [[std-motion-ui]]

## กฎ/วิธีทำ
1. **หาคลาสกลางก่อนเขียน animation เสมอ**; ถ้าจำเป็นต้องมี keyframes ใหม่ ให้เพิ่มใน `globals.css` เท่านั้น (ห้ามใน `.tsx`)
2. **ทุก animation ที่มี `transform` ใช้ `animation-fill-mode: backwards`** — ห้าม `both`/`forwards` เพราะ element ที่ค้าง transform จะเป็น containing block ของลูก `position: fixed` ทำให้ Modal/Popover เลื่อนผิดที่ (บั๊ก U5: `.bc-motion-card` ที่ใช้ `both` แก้เป็น `backwards`)
3. **แผงที่ซ่อน/แสดงด้วย `hidden`** (แท็บ MDI `[data-workspace-tab-panel]`, โมดูล Keep-Alive `[data-persistent-module]`) ใช้ได้เฉพาะ `opacity` — ห้าม `transform`, `filter`, `will-change`
4. **Animation วนลูปเฉพาะหน้าตกแต่ง** (Login, Portal, Welcome, Dashboard) และต้องเป็น `transform`/`opacity` (GPU) ห้ามบน Header, MenuBar, แถบแท็บ, Grid
5. **เคารพ reduced motion**: `prefers-reduced-motion` ของ OS + ตัวเลือก `9. ภาพเคลื่อนไหว (Animation)` ในแผง `ธีม & ฟอนต์` (`settings.motion = "auto" | "off"` → `html[data-motion]`); `off` ปิด animation/transition ทั้งระบบ (globals.css §10)
6. **Backdrop ของ Modal ห้ามใช้ `bg-ink/..`** — ในโหมดมืด `--color-ink` เป็นสีขาว ฉากหลังกลายเป็นขาว ให้ใช้ `bg-slate-950/45` หรือ `bg-black/45` (บั๊ก U1)
7. **KPI/Dashboard ห้ามตัวเลขสมมติเป็นค่าสำรอง** (`?? 98.6`, `|| 300`) ใช้ `?? 0` เสมอ (บั๊ก D1)
8. **animate-in ต้องมีประกาศจริง**: คลาส `animate-in fade-in-0 zoom-in-95` ถูกใช้ 22 จุดแต่เคยไม่มีปลั๊กอิน จึงประกาศด้วย `@utility` ใน globals.css §11 (บั๊ก U4)

## เพิ่มค่าใน AppearanceSettings ต้องแก้ 3 จุดพร้อมกัน
| จุด | ไฟล์ |
|---|---|
| 1. ค่าเริ่มต้น `DEFAULT_APPEARANCE` | `frontend/shared/layout/AppearanceProvider.tsx` (เช่น `motion: "auto"` บรรทัด 124) |
| 2. `applyAttributesToHtml()` | `AppearanceProvider.tsx` (เช่น `data-motion` บรรทัด 397) |
| 3. `APPEARANCE_PREPAINT_SCRIPT` | `frontend/src/app/layout.tsx:62` สคริปต์อินไลน์ใน `<head>` |
- สคริปต์ prepaint อ่าน `localStorage.bc_appearance_v2` (fallback `v1`) แล้วใส่ `data-theme`, `data-mode`, `data-font`, `data-scale`, `data-motion`, `--bc-font-zoom`, `--custom-widget-bg` ฯลฯ ลง `<html>` **ก่อนวาดหน้าจอครั้งแรก** (`<html suppressHydrationWarning>`) — ขาดจุดใดจุดหนึ่งหน้าจอจะกะพริบเป็นธีมเริ่มต้นทุกครั้งที่รีเฟรช (บั๊ก U3)

## วิธีตรวจงาน (ตาม skill)
```bash
npx tsc --noEmit -p .
node --experimental-strip-types --test <ไฟล์ *.test.ts>
# คอมไพล์ CSS ด้วย @tailwindcss/postcss, และ curl หน้าเว็บบน next dev -p 3001
```
- **ไม่รัน Playwright อัตโนมัติเมื่อจบงาน** (ลุงจืด 2026-10-24) รอลุงจืดสั่ง; การตรวจเต็มรูปแบบใช้ UAT ดู [[std-uat-issuemate-workflow]]

## ที่มา
- `docs/kms/KMS_PREMIUM_UI_MOTION_STANDARD.md` Objective ข้อ 2–6, Workflow §4, Config, Limitation
- `.agents/skills/premium-ui-motion-system/SKILL.md` Workflow ข้อ 2–4, 6–9
- `docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md` U1, U3–U5, D1

## ดูเพิ่ม
[[standards-overview]] · [[std-motion-ui]] · [[std-screen-header-toolbar-theme]] · [[std-frontend-ux-bug-lessons]] · [[frontend-overview]]
