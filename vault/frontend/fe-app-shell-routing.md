---
title: "โครงหน้าเว็บและการนำทาง (App shell & routing)"
tags: [frontend, nextjs, routing, layout, keep-alive]
aliases: ["app shell", "โครงหน้าเว็บ", "route ของ frontend", "proxy.ts", "PersistentWorkspaceHost", "layout.tsx", "หน้า home", "keep-alive module"]
sources: ["frontend/package.json:16", "frontend/src/proxy.ts:27", "frontend/src/app/layout.tsx:76", "frontend/src/app/page.tsx:8", "frontend/src/app/(app)/layout.tsx:13", "frontend/src/app/(app)/home/page.tsx:14", "frontend/src/app/(admin)/layout.tsx:16", "frontend/shared/layout/PersistentWorkspaceHost.tsx:104", "frontend/tsconfig.json:44"]
---

# โครงหน้าเว็บและการนำทาง (App shell & routing)

frontend ของ BC Ai Account เป็น Next.js 16 (App Router) + React 19 + Tailwind 4 ที่ build แบบ `standalone`
หน้าทำงานหลักมีหน้าเดียวคือ `/home` ซึ่งเป็น "พื้นที่ทำงานแบบหลายแท็บ" (MDI) ทุกจอบัญชีเปิดเป็นแท็บอยู่ข้างใน ไม่ได้แยกเป็น route ต่อจอ

## ทำงานอย่างไร

**เวอร์ชัน/เครื่องมือ** (`package.json:15-30`): `next ^16.3.1`, `react 19.2.1`, `tailwindcss ^4`, `lucide-react`; `next.config.ts:4` ตั้ง `output: "standalone"`.
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

**Root layout `src/app/layout.tsx:76-103`**: ตั้ง `lang="th"`, ค่า `data-*` ของธีม (theme/mode/density/edition ฯลฯ), สคริปต์ `APPEARANCE_PREPAINT_SCRIPT` กันภาพกระพริบ, แล้วห่อ `AppearanceProvider` > `PersistentWorkspaceHost` + `GlobalLanguageTranslator` + `GlobalBalloonHelp` (ตัวแปลภาษา th/en กับบอลลูนช่วยเหลือระดับทั้งแอป; ดูรายละเอียดในหัวข้อด้านล่าง).

**`PersistentWorkspaceHost` (Keep-Alive)** (`shared/layout/PersistentWorkspaceHost.tsx`)
- `WorkspaceModuleId` (บรรทัด 104-120) คือโมดูลระดับบนที่ host รู้จัก (portal, home, pos, dashboard ฯลฯ). `resolveModuleFromPath` (บรรทัด 137-165) แมป pathname -> โมดูล: `/home` ที่มี `open=` หรือ `system=account` = `home` (พื้นที่บัญชี), `/home` เฉยๆ = `portal` (`SystemPortalScreen` เมนูรวมระบบ).
- โมดูลที่เคยเปิดเก็บไว้ใน `visitedModules` (บรรทัด 258, 447-451) แล้วซ่อนด้วย CSS `hidden` แทนการ unmount (บรรทัด ~533) เพื่อให้สลับระบบแล้วข้อมูลในจอไม่หาย.
- ใน host มีการ patch `window.fetch` (บรรทัด 341-366): ถ้า response `/api/*` ตอบ 401 (ยกเว้น `/api/auth/login|demo|google|logout`) จะเรียก `triggerSessionExpired` แสดง modal "หมดเวลาใช้งาน" แล้วพาไป `/login?returnTo=...` (บรรทัด 290-298, 453-481) ใช้ `sessionStorage["bc_return_to"]` จำหน้าเดิม. รายละเอียดเรื่อง returnTo ใน [[fe-login-select-database]].
- โมดูล `home` เรนเดอร์ `TabWorkspace` ([[fe-tabs-workspace]]); โมดูล `portal` เรนเดอร์ `SystemPortalScreen` (รายการระบบอื่นของ ecosystem - นอกขอบเขตโน้ตชุดนี้).

**Shell อื่น**: `shared/layout/AppShell.tsx:15-18` ห่อ `Header` + เนื้อหา; `Header.tsx:42` มีลิงก์ไป `/select-database` (บรรทัด 243) และลิงก์สลับระบบอื่น (บรรทัด 63-79).
`MenuBar.tsx:21-23` แบ่งหมวดสีเมนู 5 ประเภท `master/daily/cancel/report/general` (ข้อมูลหลัก/รายวัน/ยกเลิกเอกสาร/รายงาน/ข้อมูลทั่วไป) ด้วย `getMenuCategory` (บรรทัด 125).

**Path alias ที่ต้องรู้** (`tsconfig.json:44-47`): `@/components/layout/*` -> `shared/layout/*`, `@/components/ui/*` -> `shared/ui/*`, `@/components/*` -> `account/*` (ใช้ตอน import จอบัญชี เช่น `@/components/master/...` = `account/master/...`), `@/shared/*`, `@/account/*`, `@/*` -> `src/*`.
ดังนั้น `@/components/tabs/TabsContext` = `account/tabs/TabsContext.tsx`.

**ตัวช่วยระดับแอป (Global)**
- `GlobalLanguageTranslator` (`shared/components/GlobalLanguageTranslator.tsx:253`) ใช้พจนานุกรม `TH_TO_EN_EXACT` และ `translateThaiToEnglish` ใน `src/config/i18n/bcI18n.tsx:52,659` เพื่อสลับข้อความไทย/อังกฤษ (`BcLanguage = "th" | "en"`, บรรทัด 7).
- `GlobalBalloonHelp` (`shared/components/GlobalBalloonHelp.tsx:54`) แสดงบอลลูนช่วยเหลือของช่องกรอก ใช้แคตตาล็อก `src/config/help/bcFieldHelpCatalog.ts` (ข้อมูลใน `src/config/help/data/*.json`) และ route `/api/help` ([[fe-api-proxy-routes]]); เปิด/ปิดด้วย `data-balloon-help` บน `<html>` (ค่าเริ่ม `off`, `layout.tsx:92`).

## ที่มาในโค้ด
- `frontend/src/proxy.ts:9-70` - ด่าน cookie, bcdemo allow-list, matcher
- `frontend/src/app/(app)/layout.tsx:13-18` - redirect ตาม session/mode/database
- `frontend/src/app/(admin)/layout.tsx:16-27` - เฉพาะ mode admin หรือ demo viewer
- `frontend/shared/layout/PersistentWorkspaceHost.tsx:104-165,258,341-366,453-481` - โมดูล, Keep-Alive, patch fetch 401
- `frontend/tsconfig.json:44-47` - alias `@/components/*` -> `account/*`

## ดูเพิ่ม
[[frontend-overview]] · [[fe-login-select-database]] · [[fe-auth-session]] · [[fe-tabs-workspace]] · [[fe-admin-console]] · [[fe-api-proxy-routes]]
