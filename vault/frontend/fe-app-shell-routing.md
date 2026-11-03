---
title: "โครงหน้าเว็บและการนำทาง (App shell & routing)"
tags: [frontend, nextjs, routing, layout, keep-alive]
aliases: ["app shell", "โครงหน้าเว็บ", "route ของ frontend", "proxy.ts", "PersistentWorkspaceHost", "layout.tsx", "หน้า home", "keep-alive module"]
sources: ["frontend/package.json:16", "frontend/src/proxy.ts:27", "frontend/src/app/layout.tsx:64", "frontend/src/app/page.tsx:8", "frontend/src/app/(app)/layout.tsx:13", "frontend/src/app/(app)/home/page.tsx:14", "frontend/src/app/(admin)/layout.tsx:16", "frontend/shared/layout/PersistentWorkspaceHost.tsx:104", "frontend/tsconfig.json:44"]
---

# โครงหน้าเว็บและการนำทาง (App shell & routing)

frontend ของ BC Ai Account เป็น Next.js 16 (App Router) + React 19 + Tailwind 4 ที่ build แบบ `standalone`
หน้าทำงานหลักมีหน้าเดียวคือ `/home` ซึ่งเป็น "พื้นที่ทำงานแบบหลายแท็บ" (MDI) ทุกจอบัญชีเปิดเป็นแท็บอยู่ข้างใน ไม่ได้แยกเป็น route ต่อจอ

## ทำงานอย่างไร

**เวอร์ชัน/เครื่องมือ** (`package.json:15-17,24,30`): `next ^16.3.1` (:16), `react 19.2.1` (:17), `lucide-react` (:15), `tailwindcss ^4` + `@tailwindcss/postcss` (devDependencies :24,30); `next.config.ts:4` ตั้ง `output: "standalone"`.
Next 16 ใช้ไฟล์ `src/proxy.ts` แทน middleware (export default `proxy`, `proxy.ts:27`).

**ด่านแรก `src/proxy.ts`**
1. ไฟล์ static (รูป, ฟอนต์, `/images` ฯลฯ) ผ่านเลย (`proxy.ts:31-41`).
2. ถ้า host เป็นโฮสต์ bcdemo (`isBcDemoHost`, `proxy.ts:46`) อนุญาตเฉพาะ path ในรายการ `BCDEMO_ALLOWED_PATHS` (`proxy.ts:10-25`) ที่เหลือ redirect ไป `/home`.
3. โฮสต์อื่น: `/login` เป็น public (`proxy.ts:9,53`); path อื่นต้องมี cookie เซสชัน (`SESSION_COOKIE`) ไม่งั้น redirect `/login` (`proxy.ts:57-61`). proxy ตรวจแค่ "มี cookie หรือไม่" ไม่ตรวจลายเซ็น - การตรวจจริงอยู่ที่ `getSession()` ใน server layout ([[fe-auth-session]]).
4. `matcher` ข้าม `/api` และไฟล์ static (`proxy.ts:66-70`).

**Server layout เป็นตัวกันสิทธิ์จริง**
| ไฟล์ | พฤติกรรม |
|---|---|
| `src/app/page.tsx:8-12` | `/` redirect `/home` (ส่งต่อ `?open=` ด้วยถ้ามี) |
| `src/app/(app)/layout.tsx:13-18` | ไม่มี session -> `/login`; `session.mode === "admin"` -> `/admin`; ยังไม่เลือกฐานข้อมูล -> `/select-database` |
| `src/app/(app)/home/page.tsx:14-19` | อ่าน session แล้วเรนเดอร์ `WorkspaceRouteSync session autoOpen=?open=` เปิดจอตรงจาก URL เช่น `/home?open=menu_option` |
| `src/app/(admin)/layout.tsx:16-27` | เข้าได้เฉพาะ `session.mode === "admin"` หรือ demo viewer (`isDemoCentralViewer`) แล้วห่อด้วย `AdminShell` ([[fe-admin-console]]) |

**Root layout `src/app/layout.tsx:64-106`** (`<html>` 76-93, สคริปต์ 95, providers 98-102): ตั้ง `lang="th"`, ค่า `data-*` ของธีม (theme/mode/density/edition ฯลฯ), สคริปต์ `APPEARANCE_PREPAINT_SCRIPT` กันภาพกระพริบ, แล้วห่อ `AppearanceProvider` > `PersistentWorkspaceHost` + `GlobalLanguageTranslator` + `GlobalBalloonHelp` (ตัวแปลภาษา th/en กับบอลลูนช่วยเหลือระดับทั้งแอป; ดูรายละเอียดในหัวข้อด้านล่าง).

**`PersistentWorkspaceHost` (Keep-Alive)** (`shared/layout/PersistentWorkspaceHost.tsx`)
- `WorkspaceModuleId` (บรรทัด 104-120) คือโมดูลระดับบนที่ host รู้จัก 16 ค่า (portal, home, autocare, pos, dashboard, crm, market, procure, wms, tms, etax, ai, lineoa, monitormap, workmonitor, fraudwarning). `resolveModuleFromPath` (บรรทัด 137-175) แมป pathname -> โมดูล: `/home` ที่มี `open=` หรือ `system=account` = `home` (พื้นที่บัญชี), `/home` เฉยๆ = `portal` (`SystemPortalScreen` เมนูรวมระบบ).
- โมดูลที่เคยเปิดเก็บไว้ใน `visitedModules` (บรรทัด 258, 447-451) แล้วซ่อนด้วย CSS `hidden` แทนการ unmount (บรรทัด 521-534) เพื่อให้สลับระบบแล้วข้อมูลในจอไม่หาย.
- ใน host มีการ patch `window.fetch` (บรรทัด 341-367): ถ้า response `/api/*` ตอบ 401 (ยกเว้น `/api/auth/login|demo|google|logout`) จะเรียก `triggerSessionExpired` แสดง modal "หมดเวลาใช้งาน" แล้วพาไป `/login?returnTo=...` (`forceRedirectToLogin` 287-304 เรียก `/api/auth/logout` ก่อน, `triggerSessionExpired` 306-324 หน่วง 1.2 วินาที, modal เริ่ม 453, event `bc:session-expired` 369) ใช้ `sessionStorage["bc_return_to"]` จำหน้าเดิม. รายละเอียดเรื่อง returnTo ใน [[fe-login-select-database]].
- โมดูล `home` เรนเดอร์ `TabWorkspace` (544-551; [[fe-tabs-workspace]]); โมดูล `portal` เรนเดอร์ `SystemPortalScreen` (536-543) (รายการระบบอื่นของ ecosystem - นอกขอบเขตโน้ตชุดนี้).

**Shell อื่น**: `shared/layout/AppShell.tsx:15-22` ห่อ `Header` + เนื้อหา (แถบเมนู/แท็บอยู่ใน `TabWorkspace`). `Header.tsx` มีป้ายระบบปัจจุบัน `activeSystemMeta` (103-133), ปุ่ม "เปิดหน้าใหม่" (211-223), ลิงก์ `/mcp-tokens` (232-240) และลิงก์ `/select-database` พร้อมป้ายชื่อฐานกับบทบาท Demo/Admin/Member (242-269); ปุ่ม "เมนูรวมทุกระบบ" เรียก `handleBackToSelection` (135-143) กลับ portal โดยไม่โหลดหน้าใหม่.
`MenuBar.tsx:21` แบ่งหมวดสีเมนู 5 ประเภท `master/daily/cancel/report/general` (ข้อมูลหลัก/ข้อมูลรายวัน/ยกเลิกเอกสาร/รายงาน/ข้อมูลทั่วไป, `MENU_CATEGORY_META` 23-80) ด้วย `getMenuCategory` (บรรทัด 131).

**Path alias ที่ต้องรู้** (`tsconfig.json:22-47`): `@/components/layout/*` -> `shared/layout/*` (44), `@/components/ui/*` -> `shared/ui/*` (45), `@/components/*` -> `account/*` (46; ใช้ตอน import จอบัญชี เช่น `@/components/master/...` = `account/master/...`), `@/account/*` (23), `@/shared/*` (36), `@/*` -> `src/*` (47).
ดังนั้น `@/components/tabs/TabsContext` = `account/tabs/TabsContext.tsx`.

**ตัวช่วยระดับแอป (Global)**
- `GlobalLanguageTranslator` (`shared/components/GlobalLanguageTranslator.tsx:260`) ใช้พจนานุกรม `TH_TO_EN_EXACT` และ `translateThaiToEnglish` ใน `src/config/i18n/bcI18n.tsx:52,659` เพื่อสลับข้อความไทย/อังกฤษ (`BcLanguage = "th" | "en"`, บรรทัด 7) ตามค่า `settings.language`; ข้อความที่ยังไม่มีในพจนานุกรมถูกรวมเป็นชุด (สูงสุด 350 รายการ) ส่ง `POST /api/help` ไปขอคำแปล (`GlobalLanguageTranslator.tsx:287-300`, `api/help/route.ts:340-382`).
- `GlobalBalloonHelp` (`shared/components/GlobalBalloonHelp.tsx:54`) แสดงบอลลูนช่วยเหลือของช่องกรอก ใช้แคตตาล็อก `src/config/help/bcFieldHelpCatalog.ts` (ข้อมูลใน `src/config/help/data/*.json`) และ `GET /api/help?keys=...&lang=` (`api/help/route.ts:291`; [[fe-api-proxy-routes]]); เปิด/ปิดด้วย `settings.balloonHelp` (ค่าเริ่ม `false`, `AppearanceProvider.tsx:129`) ซึ่งเขียน `data-balloon-help="on|off"` ลง `<html>` (`AppearanceProvider.tsx:399`; ค่าเริ่ม `off` ที่ `layout.tsx:90`).

## ที่มาในโค้ด
- `frontend/src/proxy.ts:9-70` - ด่าน cookie, bcdemo allow-list, matcher
- `frontend/src/app/(app)/layout.tsx:13-18` - redirect ตาม session/mode/database
- `frontend/src/app/(admin)/layout.tsx:16-27` - เฉพาะ mode admin หรือ demo viewer
- `frontend/shared/layout/PersistentWorkspaceHost.tsx:104-165,258,287-324,341-367,453-481,521-551` - โมดูล, Keep-Alive, patch fetch 401, modal หมดเวลา
- `frontend/tsconfig.json:22-47` - alias `@/components/*` -> `account/*`, `@/account/*`, `@/shared/*`, `@/*`
- `frontend/src/app/layout.tsx:64-106`, `frontend/src/app/page.tsx:3-13`, `frontend/src/app/(app)/home/page.tsx:9-20` - root layout, redirect `/`, หน้า `/home`
- `frontend/shared/layout/AppShell.tsx:15-22`, `frontend/shared/layout/Header.tsx:103-143,211-269`, `frontend/shared/layout/MenuBar.tsx:21-80,131` - header และหมวดสีเมนู
- `frontend/shared/components/GlobalLanguageTranslator.tsx:260-300`, `frontend/shared/components/GlobalBalloonHelp.tsx:54-56`, `frontend/src/app/api/help/route.ts:291-382` - ตัวแปลภาษา, บอลลูนช่วยเหลือ

## ดูเพิ่ม
[[frontend-overview]] · [[fe-login-select-database]] · [[fe-auth-session]] · [[fe-tabs-workspace]] · [[fe-admin-console]] · [[fe-api-proxy-routes]]
