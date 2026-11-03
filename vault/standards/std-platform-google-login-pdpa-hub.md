---
title: "Google Login, Multi-Tenant PDPA และหน้าเลือกโมดูลหลัง Login (Google OAuth, Workspace DB, Portal)"
tags: [standards, auth, security, pdpa, multi-tenant, frontend, backend]
aliases: ["Google OAuth", "เข้าสู่ระบบด้วย Google", "bc_google_workspace_db", "bc_google_workspace_member", "bc_google_account", "PDPA multi-tenant", "portal เลือกระบบ", "select-database", "demo login", "สลับฐานข้อมูล", "Admin Member ฐานข้อมูล"]
sources: ["docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md:38-41", "docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md:56-57", "docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md:96", "AGENTS.md:61", "frontend/src/app/api/auth/google/route.ts:40", "frontend/src/app/api/auth/google/route.ts:54", "frontend/src/app/api/auth/google/route.ts:109", "frontend/src/app/api/auth/google/route.ts:228", "frontend/src/app/api/auth/google/route.ts:248", "frontend/src/app/api/auth/google/oauth-state.ts:7", "frontend/src/app/login/page.tsx:188", "frontend/src/app/login/page.tsx:660", "backend/internal/adapter/inbound/http/admin/workspace_google.go:19", "backend/internal/adapter/inbound/http/admin/workspace_google.go:40", "backend/internal/adapter/inbound/http/admin/workspace_google.go:345", "backend/internal/adapter/inbound/http/admin/workspace_google.go:739", "backend/internal/adapter/inbound/http/admin/workspace_google.go:839", "backend/internal/adapter/inbound/http/router.go:237", "frontend/shared/layout/Header.tsx:136", "frontend/shared/layout/SystemPortalScreen.tsx:490", "frontend/src/app/(app)/home/page.tsx:9"]
---

# Google Login, Multi-Tenant PDPA และหน้าเลือกโมดูล

เว็บ BC Ai Account รองรับ Google Login, ปุ่มทดลองใช้ (ฐานข้อมูลตัวอย่าง `bcdemo`) และแยกสิทธิ์ตามฐานข้อมูลเพื่อ PDPA หลัง Login ผู้ใช้เลือกฐานข้อมูลที่ `/select-database` แล้วเข้าหน้าเลือกระบบ (Portal) ที่ `/home`

## กฎ/วิธีทำ
- **หน้า Login** `frontend/src/app/login/page.tsx`: ปุ่มทดลองใช้ `ทดลองใช้งานทันที (Demo — ฐานข้อมูล bcdemo)` (`:660-676`) และปุ่ม Google `เข้าสู่ระบบด้วยบัญชี Google` (`:725`) ปุ่ม Google ใช้ Google Identity Services ได้ `idToken` แล้วเรียก `handleGoogleCredential` (`:188`) ซึ่ง `POST /api/auth/google` ส่ง `idToken` แล้วไป `/select-database` (ถ้ามี `returnTo` ที่ปลอดภัยจะแนบไปด้วย)
- **Google OAuth ฝั่ง Next.js** `frontend/src/app/api/auth/google/route.ts`:
  - `POST` (`:210`): **ไม่รับอีเมลจาก body ตรง ๆ** ต้องมี `idToken` (`:228-230` ไม่มี = 401 `NO_ID_TOKEN`) ตรวจกับ `oauth2.googleapis.com/tokeninfo` แล้วบังคับว่า `aud` ตรงกับ Client ID ของเว็บ (`:248-253`) และ `email_verified` เป็นจริง จึงใช้อีเมลจาก token เท่านั้น
  - `GET ?action=redirect` (`:109`) สร้าง `state` เก็บใน cookie `bc_google_oauth_state` อายุ 10 นาที (`oauth-state.ts:7-8`) ตอน callback ต้อง `isValidOAuthState` ตรงกัน (`:54`) ใช้ได้ครั้งเดียว กัน login CSRF; ผ่านแล้วรับเฉพาะอีเมลที่ยืนยันแล้ว (`:89`) และไป `/select-database` (`:96`)
  - ค่า Client ID / Secret อ่านจาก env `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (และ `NEXT_PUBLIC_GOOGLE_CLIENT_ID`) (`:42-43`, `:249-250`) — **ค่าอยู่ใน env ของเซิร์ฟเวอร์** ห้ามบันทึกลงเอกสาร/โค้ด
- **PDPA แยกสิทธิ์ตามฐานข้อมูล** ฝั่ง Go `backend/internal/adapter/inbound/http/admin/workspace_google.go` (เส้นทาง `/workspace/*` ลงทะเบียนที่ `router.go:237-247`):
  - สร้างตารางอัตโนมัติ (`ensureWorkspaceTables`, `:36`): `bc_google_account` (บัญชี Google, `:40`), `bc_google_workspace_db` (ฐานข้อมูลที่ผู้ใช้สร้างและ `owner_email`, `:55`), `bc_google_workspace_member` (อีเมล + `role` ค่าเริ่มต้น `MEMBER` + `mapped_user_code`, `:63`)
  - ชื่อฐานข้อมูลใหม่ต้องตรง `^[a-z][a-z0-9_]{2,40}$` (`:19`), ห้ามชื่อสงวน/ขึ้นต้น `bcerpmain`/`pg_` (`:348`), ห้ามซ้ำกับรายการในระบบหรือบนเซิร์ฟเวอร์ PostgreSQL — ซ้ำตอบ `409 DB_NAME_TAKEN` (`:345-380`, `:560`)
  - เลือกฐานข้อมูลที่ไม่มีสิทธิ์ ตอบ `403 FORBIDDEN_DATABASE` (`:739`); ผู้ใช้เห็นเฉพาะฐานข้อมูลที่เป็นสมาชิกหรือเจ้าของ (`queryAccessibleWorkspaceDatabases`, `:91`)
  - การเพิ่ม/ลบสมาชิกและตั้งบทบาท `ADMIN`/`MEMBER` ต้องผ่าน `isDatabaseAdmin` (`:839`; เรียกที่ `:1009`, `:1113`) — Admin คือสมาชิกบทบาท `ADMIN`, เจ้าของฐานข้อมูล หรือผู้ใช้ระดับ `user_level >= 9`
  - ฝั่ง Next.js `frontend/src/app/api/workspace/[...path]/route.ts` ตรวจ Admin ซ้ำก่อนส่งต่อ (`isWorkspaceAdmin`) และโหมดสาธิต (`session.isDemo`) ไม่เป็น Admin
- **ชื่อตาราง/ชื่อ middleware ใน KMS ไม่ตรงโค้ด**: KMS (`:40`, `:57`) เรียกตารางว่า `bc_tenant_databases` / `bc_tenant_members` และ middleware `CheckTenantDBAccess` แต่ค้นทั้ง `backend/` และ `frontend/` ไม่พบชื่อเหล่านี้ ตารางจริงคือ 3 ตาราง `bc_google_*` ข้างต้น และการกั้นข้ามฐานข้อมูลทำที่ `WorkspaceSelectDatabase` (`:674`) บวกสิทธิ์จอรายฐานข้อมูล ([[std-security-lessons-idor]])
- **หน้าเลือกระบบ (Portal) หลังเลือกฐานข้อมูล**: `/home` เป็นพื้นที่ทำงานแท็บ (`frontend/src/app/(app)/home/page.tsx:9-19`, ไม่มี session ไป `/login`) เนื้อหา Portal คือ `frontend/shared/layout/SystemPortalScreen.tsx` ที่ `PersistentWorkspaceHost.tsx` แสดงเมื่อโมดูลเป็น `portal`; การ์ดมีลิงก์เปิดแท็บใหม่ (`window.open`, `SystemPortalScreen.tsx:411`) และปุ่ม `สลับฐานข้อมูล / ตั้งค่าสิทธิ์` ไป `/select-database` (`:490-495`)
- **ปุ่มสลับบน Header** (`frontend/shared/layout/Header.tsx:136-142`): ถ้าอยู่ในโมดูล ให้กลับ Portal (`/home`) โดยไม่ต้อง Login ใหม่; ถ้าอยู่ Portal แล้ว ไป `/select-database` โดยไม่ลบ session
- ข้อกำหนดทั่วไป: ตัวตนต้องมาจาก token ที่ตรวจแล้ว (กฎข้อ 20, `AGENTS.md:61`) ดู [[std-security-authz-and-web-vulns]]

## สิ่งที่ KMS เขียนแต่ไม่พบในโค้ดปัจจุบัน
- `backend/internal/interfaces/http/handlers/google_auth_handler.go`, `frontend/shared/home/HomeHubScreen.tsx`, `frontend/shared/layout/EnterpriseWorkbench.tsx` — ไม่มีไฟล์เหล่านี้ (ตัวจริงคือไฟล์ข้างต้น)
- พารามิเตอร์ `/home?hub=1` และ "โหมด LAN" ในหน้า Login ค้นไม่พบใน `frontend/src` / `frontend/shared` / `frontend/account`

## ข้อห้าม (จาก KMS)
- ห้ามแสดงรายชื่อฐานข้อมูลของลูกค้ารายอื่นให้ผู้ใช้ที่ไม่ได้เป็นสมาชิกของฐานข้อมูลนั้น (`KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md:96`)

## ที่มา
- `docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md:38-41` (§5), `:56-57` (Config), `:96` (Limitation)
- `AGENTS.md:61` กฎข้อ 20

## ดูเพิ่ม
[[standards-overview]] · [[std-security-authz-and-web-vulns]] · [[std-security-lessons-idor]] · [[std-uat-issuemate-workflow]] · [[frontend-overview]] · [[backend-overview]]
