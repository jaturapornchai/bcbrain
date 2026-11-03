---
title: "ภาพรวม Frontend ของ BC Ai Account (Frontend overview)"
tags: [frontend, hub, nextjs, overview]
aliases: ["frontend overview", "ภาพรวมหน้าเว็บ", "frontend/account", "Next.js", "สารบัญ frontend", "หน้าจอบัญชี"]
sources: ["frontend/package.json:16", "frontend/next.config.ts:4", "frontend/src/proxy.ts:27", "frontend/src/app/page.tsx:8", "frontend/src/app/(app)/home/page.tsx:14", "frontend/src/app/(admin)/layout.tsx:18", "frontend/tsconfig.json:23"]
---

# ภาพรวม Frontend ของ BC Ai Account (Frontend overview)

หน้าเว็บของ BC Ai Account เป็น Next.js 16 (App Router) + React 19 + Tailwind 4 build แบบ `standalone`; โค้ดจอบัญชีทั้งหมดอยู่ที่ `frontend/account/` และใช้ตัวประกอบร่วม (layout / ui) จาก `frontend/shared/`.
โน้ตนี้เป็นสารบัญ: บอกโครง route, วิธีที่หน้าจอเรียก backend และลิงก์ไปโน้ตรายหัวข้อทั้ง 19 เรื่อง (ขอบเขต: ไม่รวมโมดูล pos/wms/tms/procure/market/etax/crm ฯลฯ).

## ทำงานอย่างไร

**เทคโนโลยี**
- `next ^16.3.1`, `react 19.2.1`, `react-dom 19.2.1`, `tailwindcss ^4`, `typescript ^5` (`package.json:16-17,30-31`); `output: "standalone"` (`next.config.ts:4`).
- Next 16 ใช้ `src/proxy.ts` แทน middleware (`proxy.ts:27`).
- alias ใน `tsconfig.json` (`@/account/*` บรรทัด 23, `@/shared/*` 36, `@/components/*` 44-46): `@/account/*` → `account/*`; `@/components/*` ชี้ `account/*` (เช่น `@/components/admin/screens/X` = `account/admin/screens/X`), `@/components/layout/*` → `shared/layout/*`, `@/components/ui/*` → `shared/ui/*` (รายละเอียดใน [[fe-app-shell-routing]]).

**โครง route (`frontend/src/app/`)**

| Route | ไฟล์ | หน้าที่ |
|---|---|---|
| `/` | `page.tsx:8-12` | redirect ไป `/home` (ส่ง `?open=` ต่อให้ถ้ามี) |
| `/login` | `login/` | เข้าสู่ระบบ → [[fe-login-select-database]] |
| `/select-database` | `select-database/` | เลือกฐานข้อมูลหลัง login → [[fe-login-select-database]] |
| `/home` | `(app)/home/page.tsx` | พื้นที่ทำงานแบบหลายแท็บ (จอบัญชีทั้งหมดเปิดเป็นแท็บ) → [[fe-tabs-workspace]] |
| `/admin/*` | `(admin)/admin/*` | โซนผู้ดูแลระบบส่วนกลาง (`mode==="admin"` หรือผู้ชมสาธิต) → [[fe-admin-console]] |
| `/api/process`, `/api/query`, `/api/auth`, `/api/admin`, `/api/help` | `api/*/route.ts` | ตัวส่งต่อไป Go backend → [[fe-api-proxy-routes]] |

(ในโฟลเดอร์ `src/app/` ยังมีโมดูลอื่น เช่น pos, wms, crm, ai ฯลฯ ซึ่งอยู่นอกขอบเขตโน้ตชุดนี้ จึงไม่ได้อ่าน)

**หน้าจอเรียก backend อย่างไร (สองทาง)**
1. `/api/query/*` — เบราว์เซอร์ประกอบ SQL เองแล้วส่งผ่าน `query-client.ts`; ใช้กับข้อมูลหลักและค้นหา → [[fe-query-client-sql-builder]].
2. `/api/process/<กลุ่ม>/<action>` — route ตรวจ whitelist แล้ว `proxyToService("/api/v1/process/...")`; ใช้กับงานที่มีกติกาธุรกิจ (บันทึกเอกสาร, รายงาน, ปิดงวด, ตรวจสต๊อก ฯลฯ) → [[fe-api-proxy-routes]], [[fe-process-pos-screens]].
- ทุก route ตรวจ session จาก cookie แล้วแนบ JWT ของ backend (เก็บอยู่ใน cookie เซสชันที่เซ็นลายเซ็น ไม่เปิดให้ JS เห็น) → [[fe-auth-session]]. รูปคำตอบเดียวกันทุกที่: `{ ok:true, data }` หรือ `{ ok:false, error, code }`.

## สารบัญโน้ต frontend (19 เรื่อง)

| กลุ่ม | โน้ต | เนื้อหา |
|---|---|---|
| โครงและความปลอดภัย | [[fe-app-shell-routing]] | route, `proxy.ts`, layout, keep-alive workspace, help/i18n |
| | [[fe-login-select-database]] | หน้า login / เลือกฐานข้อมูล |
| | [[fe-auth-session]] | cookie เซสชัน, JWT, refresh |
| | [[fe-api-proxy-routes]] | route `/api/*` และ whitelist |
| | [[fe-query-client-sql-builder]] | `api-client`, `query-client`, ตัวประกอบ SQL |
| | [[fe-numeric-money]] | ตัวเลข เงิน ภาษี ปี พ.ศ. |
| เมนูและพื้นที่ทำงาน | [[fe-screen-registry-menu]] | `screenRegistry`, `bcMenu` |
| | [[fe-tabs-workspace]] | `TabWorkspace`, สิทธิ์จอ |
| ข้อมูลหลัก | [[fe-master-screens]] | จอ master ตารางเดียว (`IC_MASTER_CONFIGS`) |
| | [[fe-standard-master-screen]] | `StandardMasterScreen`, master-detail |
| ส่วนประกอบจอ | [[fe-grid-component]] | `BcDataList`, lookup |
| | [[fe-form-engine]] | `SchemaForm`, จอตั้งค่า |
| เอกสารธุรกรรม | [[fe-transaction-screens]] | `UniversalTransScreen` |
| | [[fe-transaction-menu-purchase-sale-stock]] | เมนูซื้อ ขาย สต๊อก (หมวด 1-3) |
| | [[fe-transaction-menu-debt-cashbank]] | เมนูเจ้าหนี้ ลูกหนี้ เงินสด ธนาคาร เช็ค สมุดรายวัน (หมวด 4-6) |
| รายงานและพิมพ์ | [[fe-report-screens]] | `UniversalReportScreen` |
| | [[fe-report-print-designer]] | พิมพ์รายงาน/เอกสาร, ตัวออกแบบ |
| ประมวลผลและ POS | [[fe-process-pos-screens]] | `SystemProcessWorkbenchScreen`, ตั้งค่า POS |
| ผู้ดูแลระบบ | [[fe-admin-console]] | หน้า `/admin/*` และ `/api/admin/*` |

## ที่มาในโค้ด
- `frontend/package.json:16-17,30-31` — เวอร์ชัน Next / React / Tailwind / TypeScript.
- `frontend/next.config.ts:4` — `output: "standalone"`.
- `frontend/src/proxy.ts:27` — ด่านแรกก่อนเข้าทุกหน้า (รายละเอียดใน [[fe-app-shell-routing]]).
- `frontend/src/app/page.tsx:8-12` — `/` redirect `/home`.
- `frontend/src/app/(app)/home/page.tsx:14` — หน้าเดียวของแอปบัญชี.
- `frontend/src/app/(admin)/layout.tsx:18-21` — ด่านเข้าโซน admin.
- `frontend/tsconfig.json:23,36,44-46` — path alias.

## ดูเพิ่ม
[[index]] · [[backend-overview]] · [[accounting-overview]] · [[process-overview]] · [[standards-overview]]
