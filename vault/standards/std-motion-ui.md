---
title: "UI พรีเมียมและคลาส Motion กลาง (Premium UI, bc-anim, Design Tokens)"
tags: [standards, ui, motion, css, frontend]
aliases: ["bc-anim-fade", "bc-anim-rise", "bc-anim-pop", "bc-stagger", "bc-kpi-row", "bc-lift", "bc-skeleton", "bc-aurora", "bc-gold-text", "bc-glass", "design tokens", "--bc-ease-out", "Button Modal กลาง", "animate-in fade-in-0 zoom-in-95"]
sources: ["docs/kms/KMS_PREMIUM_UI_MOTION_STANDARD.md", ".agents/skills/premium-ui-motion-system/SKILL.md", "AGENTS.md:35-38", "AGENTS.md:44", "AGENTS.md:60", "frontend/src/app/globals.css:1644", "frontend/src/app/globals.css:1651", "frontend/src/app/globals.css:2014-2022", "frontend/src/app/globals.css:2064", "frontend/src/app/globals.css:2141", "frontend/src/app/globals.css:2210", "frontend/shared/ui/Button.tsx:28", "frontend/shared/ui/Modal.tsx:83", "frontend/account/transaction/ItemGridContextMenu.tsx", "frontend/shared/layout/SystemPortalScreen.tsx", "frontend/shared/layout/WorkspaceWelcome.tsx"]
---

# UI พรีเมียมและคลาส Motion กลาง

ทุกหน้าจอใช้ภาษาการออกแบบเดียวกันจาก `frontend/src/app/globals.css` (§9–§14): ใช้คลาส Motion กลางและคอมโพเนนต์ `<Button>` / `<Modal>` กลาง ห้ามเขียน `@keyframes` หรือ `style={{ animation }}` เองใน `.tsx` (`AGENTS.md:60`) กฎความปลอดภัยของ animation ดู [[std-motion-animation-rules]]

## Design Tokens (`:root`, globals.css §9 เริ่ม `:1644`, tokens `:1651`)
| Token | ค่า | ใช้กับ |
|---|---|---|
| `--bc-ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | element เข้าทั่วไป |
| `--bc-ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | ปุ่ม/ไอคอนเด้ง |
| `--bc-ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | ภาพตกแต่งวนลูป (aurora) |
| `--bc-dur-fast/base/slow` | 140ms / 220ms / 420ms | ระยะเวลามาตรฐาน |
| `--bc-shadow-soft/raised/float` | เงา 3 ระดับ | การ์ด / hover / Modal-Popover |

## คลาส Motion กลาง (ตรวจแล้วมีใน globals.css ทั้งหมด)
| คลาส | พฤติกรรม | ตัวอย่างใช้จริง |
|---|---|---|
| `bc-anim-fade` | จางเข้า 220ms | backdrop เมนู, `<main>` ของ `AdminShell` |
| `bc-anim-rise` | ลอยขึ้น 10px + จาง หน่วงตาม `--bc-i` × 45ms | การ์ดหน้า login / select-database |
| `bc-anim-pop` | ยุบ-ขยายจากด้านบน | แบนเนอร์ session หมดอายุ, กล่อง error |
| `bc-stagger` (ที่ container) | ลูกไล่จังหวะเข้า (nth-child หรือ `--bc-i`) | การ์ดระบบใน `SystemPortalScreen`, แถว KPI |
| `bc-kpi-row` (คู่ `bc-stagger`) | การ์ด KPI ลอย 2px + เงาเมื่อชี้ | Dashboard ของ TMS/Procure/e-Tax/WMS |
| `bc-lift` | ลอย 3px + เงา float (กดยุบ) | การ์ดฐานข้อมูล/ระบบ/เมนูผู้ดูแล |
| `bc-skeleton` | แถบ shimmer ระหว่างโหลด | รายการฐานข้อมูล |
| `bc-aurora` + `-blob` + `-grid` | ฉากหลังออโรร่า (ตกแต่ง ใส่ `aria-hidden`) | Login, Portal Hero, `WorkspaceWelcome` |
| `bc-float`, `bc-spin-slow`, `bc-glow-pulse` | ลอย/หมุนช้า/เรืองแสง (วนลูป) | ไอคอนตกแต่ง Hero |
| `bc-gold-text` | ข้อความไล่เฉดทอง (บน Header เติม `[animation:none]`) | โลโก้ |
| `bc-glass` | พื้นกระจกฝ้า รองรับโหมดมืด | การ์ดลอยบนฉากหลังเข้ม |
| `animate-in fade-in-0 zoom-in-95 duration-150` | ไวยากรณ์ tailwindcss-animate ประกาศด้วย `@utility` (§11) | Modal ย่อยใน `account/transaction/*Modal.tsx`, `BcDialog`, `ItemGridContextMenu` |

## คอมโพเนนต์ที่เป็นพรีเมียมแล้ว (ใช้ต่อได้เลย)
- `<Button>` (`shared/ui/Button.tsx`): `primary`/`accent` ไล่เฉด+เงา, `ghost`/`secondary`/`danger` เงาบาง, กดยุบ `scale(0.97)`, มี focus ring — API เดิม (`variant`, `size`, `loading`) และเป็นมาตรฐาน Toolbar ([[std-screen-header-toolbar-theme]])
- `<Modal>` (`shared/ui/Modal.tsx`): backdrop `bg-slate-950/45` (`Modal.tsx:83`) + blur, กล่องเด้งเข้า (`bc-modal-dialog`), แถบสีแบรนด์ด้านบน, Esc ปิดเฉพาะชั้นบนสุด
- หน้าต่างที่เขียนเอง (`fixed inset-0` + พื้นหลัง `bg-black/..`, `bg-slate-900/..` หรือ `bg-slate-950/..` ที่ยังไม่มี `animate-in`) ได้ motion เด้งเข้าแบบ `<Modal>` อัตโนมัติจาก CSS (`globals.css:2014-2022`) เช่น `BcLookupModal`, `GlobalReportPrintModal`, `BcCalculatorDialog` — หน้าต่างใหม่ใช้พื้นหลัง 3 แบบนี้หรือใส่ `animate-in` เอง ห้ามเขียน keyframes แยก
- Header / MenuBar / แถบแท็บ MDI: dropdown เด้งเข้า (`[data-bc-dropdown] > div`), แท็บใหม่เด้งเข้า + แถบสีแบรนด์ 2px บนแท็บที่เปิดอยู่ (CSS ล้วน)
- `WorkspaceWelcome` แสดงเมื่อยังไม่เปิดหน้าจอใดใน MDI

## Polish ทั้งระบบ (CSS ล้วน ไม่เปลี่ยน Layout, §13–§14)
- ตาราง: หัวมีเงาสะท้อนแสงบาง, แถวที่เลือกมีแถบสีแบรนด์ 3px ที่เซลล์แรก, hover นุ่ม
- ช่องกรอก: โฟกัสมีวงแสงสีแบรนด์ (`box-shadow` 3px) ทั้งสว่าง/มืด; ช่องโปร่งใสใน Grid ใช้เส้นล่าง
- Toolbar แถว 2 และหัว DataList มีเงาสะท้อนแสงด้านบน — หน้าจอใหม่ที่ทำตามมาตรฐานได้อัตโนมัติ
- ใช้ `background-image` / `box-shadow` ซ้อนบนสีพื้นเดิมเท่านั้น **ห้าม override `background-color`** (สว่าง/มืด/สีพื้น Widget คุมอยู่แล้ว — ดู `--custom-widget-bg` ใน [[std-screen-header-toolbar-theme]])

## ตัวอย่าง
```tsx
<ul className="bc-stagger grid gap-3 sm:grid-cols-2">
  {rows.map((row, idx) => (
    <li key={row.code} style={{ "--bc-i": idx } as React.CSSProperties}
        className="bc-lift rounded-xl border border-line bg-white p-4">{row.name_1}</li>
  ))}
</ul>
{loading ? <div className="bc-skeleton h-8 w-full rounded-lg" /> : <Table />}
```

## ข้อจำกัด
- ห้ามเปลี่ยน Layout/ตำแหน่งช่องกรอกของหน้าจอมาตรฐานเพื่อความสวย (`AGENTS.md:35-38`, `:44`) — Motion ทำได้ระดับสี เงา เส้นขอบ และ animation
- ห้ามภาพเคลื่อนไหวที่มีตัวเลขธุรกิจสมมติ — ภาพประกอบใน Login/หน้าต้อนรับเป็นกราฟตกแต่งที่ไม่มีตัวเลข

## ที่มา
- `docs/kms/KMS_PREMIUM_UI_MOTION_STANDARD.md` Objective, Workflow §1–3.1, Usage, Limitation
- `.agents/skills/premium-ui-motion-system/SKILL.md` Workflow ข้อ 1, 5, Usage example

## ดูเพิ่ม
[[standards-overview]] · [[std-motion-animation-rules]] · [[std-screen-header-toolbar-theme]] · [[std-frontend-ux-bug-lessons]] · [[frontend-overview]]
