---
title: "Google Login, Multi-Tenant PDPA และหน้าเลือกโมดูลหลัง Login (Google OAuth, Tenant Isolation, Home Hub)"
tags: [standards, auth, security, pdpa, multi-tenant, frontend]
aliases: ["Google OAuth", "เข้าสู่ระบบด้วย Google", "bc_tenant_databases", "bc_tenant_members", "PDPA multi-tenant", "home hub", "/home?hub=1", "select-database", "demo login", "สลับระบบ ฐานข้อมูล"]
sources: ["docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md", "AGENTS.md", "frontend/src/app/api/auth/google/route.ts:46", "frontend/src/app/api/auth/google/oauth-state.ts", "frontend/src/app/login/page.tsx:110", "frontend/src/app/select-database/page.tsx", "frontend/src/app/(app)/home/page.tsx"]
---

# Google Login, Multi-Tenant PDPA และหน้าเลือกโมดูล

เว็บ `www.bcsmethai.com` รองรับ Google OAuth, ปุ่มทดลองใช้ (ฐานข้อมูลตัวอย่าง `bcdemo`), โหมด LAN และแยกสิทธิ์ตามฐานข้อมูลเพื่อ PDPA หลัง Login ผู้ใช้เลือกฐานข้อมูลแล้วเข้าหน้าเลือกโมดูล

## กฎ/วิธีทำ
- **หน้า Login** `frontend/src/app/login/page.tsx`: ปุ่ม `เข้าสู่ระบบด้วย Google`, ปุ่ม `ทดลองใช้งานทันที (Demo — ฐานข้อมูล bcdemo)`, โหมด LAN (ซ่อนช่องรหัสผู้ใช้ไว้ใต้ปุ่มสลับ LAN)
- **Google OAuth** (ตรวจกับโค้ดจริง `frontend/src/app/api/auth/google/route.ts`):
  - เริ่มด้วย `?action=redirect` สร้าง `state` แล้วเก็บใน cookie เฉพาะ route นี้ (`oauth-state.ts`) กัน login CSRF — callback ต้อง `isValidOAuthState` ตรงกัน
  - redirect URI = `{origin}/api/auth/google`
  - ดึง userinfo แล้ว **รับเฉพาะอีเมลที่ยืนยันแล้ว** (`email_verified === true`) จากนั้น `completeGoogleWorkspaceSession` และ redirect ไป `/select-database`
  - ค่า Client ID / Secret อ่านจาก env ชื่อ `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (และ `NEXT_PUBLIC_GOOGLE_CLIENT_ID`) — **ดูค่าที่ env ของเซิร์ฟเวอร์** ห้ามบันทึกลงเอกสาร/โค้ด
- **PDPA Multi-Tenant Database Isolation** (กติกาตาม KMS):
  - ตารางควบคุม `bc_tenant_databases` และ `bc_tenant_members` (ใน DB หลัก) เก็บฐานข้อมูลและสิทธิ์ตามอีเมล `Admin` / `Member`
  - `Admin` สร้างฐานข้อมูลใหม่ได้ (กันชื่อซ้ำ) และเพิ่มอีเมลกำหนดสิทธิ์ได้; `Member` เห็นเฉพาะฐานข้อมูลที่ได้รับอนุญาต
  - **ห้ามแสดงรายชื่อฐานข้อมูลของลูกค้ารายอื่น** ให้ผู้ใช้ที่ไม่อยู่ใน `bc_tenant_members` ของฐานข้อมูลนั้นเด็ดขาด
- **Workspace Hub** (`/home` และ `/home?hub=1`): หลังเลือกฐานข้อมูลจะเห็นกล่องเมนูระบบทั้งหมด คลิกกล่องเพื่อเข้าในหน้าเดิม หรือกด `↗ เปิดแท็บใหม่` บนการ์ด; ในหน้าทำงานกด `สลับระบบ / ฐานข้อมูล` มุมซ้ายบนเพื่อกลับ `/home?hub=1` โดยไม่ต้อง Login ใหม่
- ข้อกำหนดทั่วไป: identity ต้องมาจาก token ที่ตรวจแล้ว ไม่ไว้ใจ client ([[std-security-authz-and-web-vulns]]); สิทธิ์จอแยกต่อฐานข้อมูล (`database_name` ใน `bc_permissions_user`/`bc_permissions_group`) ดู [[std-security-lessons-idor]]

## ไฟล์ที่ KMS อ้างแต่ไม่พบแล้ว / ไม่ตรงโค้ด (ไฟล์อ้างอิงไม่พบแล้ว)
- `backend/internal/interfaces/http/handlers/google_auth_handler.go` — ไม่มีไฟล์/โฟลเดอร์นี้; Google OAuth ปัจจุบันอยู่ที่ Next.js route ข้างต้น
- `frontend/shared/home/HomeHubScreen.tsx` และ `frontend/shared/layout/EnterpriseWorkbench.tsx` — ไม่พบ; หน้า Home อยู่ที่ `frontend/src/app/(app)/home/page.tsx`

## ที่มา
- `docs/kms/KMS_BCWORK_UX_REPORT_AUTH_MAP_STANDARDS.md` Objective ข้อ 6, Workflow §5, Config, Limitation
- `AGENTS.md` กฎข้อ 20 (ความปลอดภัย & Data Integrity)

## ดูเพิ่ม
[[standards-overview]] · [[std-security-authz-and-web-vulns]] · [[std-security-lessons-idor]] · [[std-uat-issuemate-workflow]] · [[frontend-overview]] · [[backend-overview]]
