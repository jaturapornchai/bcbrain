---
title: "บทเรียนบั๊กสิทธิ์และการข้ามฐานข้อมูล (Auth Bypass, Cross-Tenant, Demo Read-Only, Screen Rights)"
tags: [standards, security, lessons, auth, multi-tenant, bugs]
aliases: ["demo อ่านอย่างเดียว", "DEMO_READ_ONLY", "requireSystemAdmin", "requireSystemAdminView", "isDemoCentralViewer", "DEMO_ADMIN_FORBIDDEN", "สิทธิ์จอแยกต่อฐานข้อมูล", "database_name permissions", "OAuth state", "NO_ADMIN_API_KEY", "DB_FORBIDDEN", "IDOR"]
sources: ["docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:14-15", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:23-24", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:76", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:79", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:86", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:88", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:94", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:96", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:100-101", "frontend/src/app/api/auth/google/route.ts:49-54", "frontend/src/app/api/auth/google/route.ts:110-122", "frontend/src/app/api/auth/google/oauth-state.ts:10-23", "frontend/src/app/api/auth/databases/route.ts:289-296", "frontend/src/app/api/auth/login/route.ts:24-31", "frontend/src/app/api/auth/login/route.ts:275", "frontend/src/app/api/auth/change-password/route.ts:22", "frontend/src/app/api/auth/change-password/route.ts:48", "frontend/src/app/api/auth/change-password/route.ts:77-89", "frontend/src/app/api/workspace/[...path]/route.ts:28", "frontend/src/app/api/workspace/[...path]/route.ts:208-227", "frontend/src/app/api/monitormap/tile/route.ts:392-396", "frontend/src/lib/api-server.ts:74", "frontend/src/lib/api-server.ts:277", "frontend/src/lib/api-server.ts:309-322", "frontend/src/lib/api-server.ts:325-332", "frontend/src/lib/api-server.ts:359", "frontend/src/lib/api-server.ts:373-390", "frontend/account/tabs/TabsContext.tsx:64", "backend/internal/adapter/inbound/http/admin/menu_permissions.go:26-27", "backend/internal/adapter/inbound/http/blob/handler.go:98", "backend/internal/adapter/inbound/http/monitormap/handler.go:116-126", "backend/internal/adapter/inbound/http/process/permission.go:57", "backend/internal/adapter/inbound/http/process/permission.go:138", "backend/internal/adapter/inbound/http/router.go:87", "backend/internal/adapter/inbound/http/router.go:129"]
---

# บทเรียนบั๊กสิทธิ์และการข้ามฐานข้อมูล

บั๊กด้านการยืนยันตัวตน การแบ่งสิทธิ์ และการแยกฐานข้อมูล (tenant) ที่ตรวจพบและแก้แล้วในรอบไล่หาบั๊กทั้งโปรเจกต์ 2026-10-24 บน branch `dev` (`KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:4`) KMS ระบุว่าแก้ครบทุกรายการ ไม่มีรายการค้าง (`:100-101`) เช็กลิสต์ที่ใช้ตรวจก่อน commit อยู่ที่ [[std-security-authz-and-web-vulns]] โน้ตนี้เก็บ "เหตุการณ์ → วิธีแก้ → กฎที่ต้องจำ" ซึ่งตรวจกับโค้ดปัจจุบัน 2026-11-03 แล้ว

## บั๊ก → วิธีแก้ → กฎที่ต้องจำ (`KMS…LESSONS.md:14-15`, `:23-24`)
| รหัส | อาการ | วิธีแก้ (ที่พบในโค้ด) | กฎ |
|---|---|---|---|
| S1 | Google login เชื่อ `body.email` โดยไม่ตรวจ `idToken` จึงขอ session ของเจ้าของฐานข้อมูลได้ | บังคับ `idToken` ตรวจ `aud` และ `email_verified` (`api/auth/google/route.ts:229-260`) | ตัวตนต้องมาจากข้อมูลที่ตรวจแล้ว ห้ามเชื่อ body |
| S2 | route ที่เรียก backend ด้วยกุญแจ Admin ตรวจแค่มี session ทำให้ Member ให้สิทธิ์จอตัวเองได้ | `isWorkspaceAdmin()` (`workspace/[...path]/route.ts:28`) ตรวจว่าเป็น Admin ของฐานนั้นจริง ผู้ใช้สาธิตถูกปฏิเสธ | route ที่ใช้กุญแจ Admin ต้องตรวจ Admin ฝั่ง server |
| B1 | `/blob/insert` ข้ามนโยบาย write lockdown ผู้ใช้ระดับ 1 insert ตารางระบบ/บัญชีได้ | `domainquery.ValidateClientInsert()` ที่ `blob/handler.go:98` นโยบายเดียวกับ `/query/exec` ([[std-security-authz-and-web-vulns]] หมวด C) | ทุกทางเขียนจากเบราว์เซอร์ใช้นโยบายเดียวกัน |
| B2 | route แผนที่ที่ไม่ต้อง login ให้ `?db=` เลือกฐานข้อมูลบริษัทและสร้างแคชในฐานนั้นได้ | `resolveClaims` ตรึงผู้ไม่มี claims ที่ `bcdemo` (`monitormap/handler.go:116-126`) | ห้ามให้ผู้เรียกเลือก tenant เองเมื่อไม่ยืนยันตัวตน |

## รอบที่ 2: เสริมเกราะ Auth/API (`KMS…LESSONS.md:76`)
- `getAdminApiKey()` ไม่ส่งกุญแจ dev ใน production และตอบ 503 `NO_ADMIN_API_KEY` (`api-server.ts:74`)
- Google OAuth redirect ตั้ง `state` ใน cookie แล้วตรวจตอน callback ด้วย `crypto.timingSafeEqual` กัน login CSRF (`google/route.ts:49-54`, `:110-122`; `oauth-state.ts:10-23`)
- เลือกฐานข้อมูลหลัง login: ถ้ามี token ใน session แล้ว ยอมเฉพาะฐานที่อยู่ใน `availableCompanies` หรือฐานที่เลือกอยู่แล้ว มิฉะนั้นตอบ 403 `DB_FORBIDDEN` (`auth/databases/route.ts:289-296`)
- `/api/admin/*` ใช้ `requireSystemAdmin()` (`api-server.ts:373`) ซึ่งต้อง `session.mode === "admin"` (`:383`)
- `POST /api/monitormap/tile` ต้องมี session (`requireSession`, `monitormap/tile/route.ts:392-396`) และรวมงานดึงแผ่นซ้ำด้วย map `inFlightRequests` (single-flight)
- `POST /api/workspace/databases` ใช้ `session.email` เป็น `owner_email` เท่านั้น ไม่รับอีเมลจาก client (`workspace/[...path]/route.ts:208-227`)

## รอบที่ 3 และการตัดสินใจของลุงจืด (2026-10-24)
**1) สิทธิ์จอแยกต่อฐานข้อมูล** (`KMS…LESSONS.md:88`)
- ตาราง `bc_permissions_user` และ `bc_permissions_group` มีคอลัมน์ `database_name` ที่ backend เพิ่มเองด้วย `ADD COLUMN IF NOT EXISTS` (`admin/menu_permissions.go:26-27`)
- Backend บังคับสิทธิ์ซ้ำเสมอ ไม่พึ่งแค่หน้าจอ: `/process/*` ใช้ `RequiredRight` (`process/permission.go:57`; ผูกที่ `router.go:129`) และ `/query/exec`, `/query/execBatch`, `/blob/insert` ใช้ `QueryRequiredRight` (`permission.go:138`; ผูกที่ `router.go:87`) รายละเอียดระดับสิทธิ์อยู่ที่ [[std-security-authz-and-web-vulns]]
- ฝั่งหน้าจอ hook `useScreenRights()` (`account/tabs/TabsContext.tsx:64`) ถูกเรียกใน 34 ไฟล์นอกตัวนิยาม แต่เป็นเพียงชั้นแรก (`KMS…LESSONS.md:79`)

**2) โหมดสาธิตดูระบบส่วนกลางได้ แต่ห้ามเพิ่ม/แก้ไข/ลบ** (`KMS…LESSONS.md:94`)
- `isDemoCentralViewer()` (`api-server.ts:315`) เป็นจริงเมื่อ session เป็นผู้ใช้สาธิต, คำขอมาจากโดเมนสาธิต, หรือเป็นบัญชีสาธารณะของ `bcdemo` ตามรายการ `PUBLIC_DEMO_ADMIN_CODES` (`:309`)
- GET ของระบบส่วนกลางใช้ `requireSystemAdminView()` (`:325`) ที่ปล่อยผู้ใช้สาธิตผ่าน แล้วล็อก provider เป็น `bcdemo` และตัดฟิลด์ลับด้วย `demoSafe()` (`:359`)
- เขียนทุกชนิดผ่าน `requireSystemAdmin()` ซึ่งปฏิเสธผู้ใช้สาธิตด้วย 403 `DEMO_READ_ONLY` (`:376-380`)

**3) Login ผู้ดูแลส่วนกลางและเปลี่ยนรหัสผ่านตัวเอง** (`KMS…LESSONS.md:96`)
- login `mode: "admin"` ต้อง `user_level >= 9` (`auth/login/route.ts:275`) และปฏิเสธบัญชีสาธารณะของ `bcdemo` ด้วย 403 `DEMO_ADMIN_FORBIDDEN` (`:24-31`)
- `/api/auth/change-password` ตรวจรหัสเดิมกับ `/auth/login` ก่อนเปลี่ยน (`change-password/route.ts:77-89`) และบัญชี Google ถูกแจ้งให้เปลี่ยนที่ Google (`:22`, `:48`)

## กฎที่ใช้ซ้ำ
- ตัวตนและ tenant มาจาก session/claims ที่ตรวจแล้วเท่านั้น ไม่รับจาก body/query ของคนไม่ล็อกอิน
- สิทธิ์ที่ตรวจที่หน้าจอต้องตรวจซ้ำที่ backend เสมอ
- โหมดสาธิตต้องอ่านได้อย่างเดียวและต้องตัดข้อมูลลับก่อนส่งออก
- รายการที่เป็นการตัดสินใจเชิงโครงสร้างสิทธิ์/ข้อมูล ห้ามแก้เองโดยไม่ถามลุงจืด (`KMS…LESSONS.md:122` และกฎข้อ 14)

## บทเรียนอื่นของรอบเดียวกัน
S3–S5, B7 ดู [[std-security-authz-and-web-vulns]] · B3–B6, B8–B9, N1–N4 ดู [[std-data-integrity-money-transactions]] · N5–N6 ดู [[std-ux-buddhist-year-bilingual]] · U1–U5, D1, T1–T9, M1–M9 ดู [[std-frontend-ux-bug-lessons]]

## ที่มา
- `docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md` ตาราง S1–S2, B1–B2, รอบที่ 2–3, "การตัดสินใจของลุงจืด" ข้อ 1 และ 3
- อ่านโค้ดจริง: `frontend/src/lib/api-server.ts`, `frontend/src/app/api/{auth,admin,workspace,monitormap}/**`, `backend/internal/adapter/inbound/http/{admin,blob,monitormap,process}/**`, `router.go`

## ดูเพิ่ม
[[standards-overview]] · [[std-security-authz-and-web-vulns]] · [[std-platform-google-login-pdpa-hub]] · [[std-data-integrity-money-transactions]] · [[std-frontend-ux-bug-lessons]] · [[backend-overview]]
