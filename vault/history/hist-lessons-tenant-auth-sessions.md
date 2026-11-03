---
title: "บทเรียนตัวตนผู้เช่า การล็อกอิน และ session (Tenant, Auth & Sessions)"
tags: [history, auth, tenant, session]
aliases: ["refresh token rotation", "session expired", "Google ID token", "OAuth state", "requireSystemAdmin"]
sources: ["git:6ba1a6d9", "git:9a2ce199", "git:6e9ae03e", "git:faa6e6d0", "git:7ab65d38", "git:a47413ec", "git:13f953cc", "frontend/src/lib/api-server.ts:89", "frontend/src/app/api/auth/google/route.ts:233"]
---

## ภาพรวม
ชั้นตัวตนผู้ใช้/ผู้เช่าถูกเจาะซ้ำ 2026-10-20 .. 2026-10-29: token หมดอายุแล้วหลุด, อีเมล Google ไม่ถูกพิสูจน์, โซนส่วนกลางเปิดกว้าง, ผู้เรียกเลือกฐานเองได้

## อาการ
- **T1 (6ba1a6d9, 9a2ce199):** 401 เมื่อ token หมดอายุ ผู้ใช้เด้งออกและเสียหน้าที่ทำอยู่ (ชื่อ commit: 401 token refresh & recovery; 10-27 เพิ่ม modal ล็อกอินใหม่)
- **T2 (6e9ae03e, faa6e6d0):** `/api/auth/google` ไม่เช็ก `aud`/`email_verified` ของ token; callback ไม่มี `state` (login CSRF)
- **T3 (7ab65d38, faa6e6d0):** production ไม่ตั้ง `ADMIN_API_KEY` แล้วเงียบ ๆ ใช้กุญแจสำรองที่รู้กันทั่วไป; `/api/admin/*` ใช้ `requireAdmin` ผู้ดูแล workspace เข้าส่วนกลางได้; `/api/workspace/*` ฝั่ง backend ตรวจแค่กุญแจ
- **T4 (a47413ec, 7ab65d38):** route แผนที่ไม่มี Auth ให้ผู้เรียกเลือกฐานใดก็ได้; telemetry (`fraudwarning`, `workmonitor`) ไม่มี session แล้วตกไปฐานสาธิต; สลับฐานโดยไม่ตรวจรายชื่อที่เข้าได้
- **T5 (13f953cc, a94b0748):** รหัสผ่านเก็บตามที่ admin กรอก
- **T6 (a3809aba):** `/login`, `/select-database`, `/admin` ยิง `/query/list` ก่อนล็อกอิน

## สาเหตุ (root cause)
- T1: refresh token ใช้ครั้งเดียว คำขอขนานแย่งกันหมุน (อนุมานจากโค้ดที่เพิ่ม) และ 401 ไม่จำหน้าปัจจุบัน
- T2: ไว้ใจข้อมูลจาก client แทนผลตรวจ token
- T3: fallback เป็นค่าคงที่ใน production; คำว่า "Admin" ปนระหว่างผู้ดูแล workspace กับส่วนกลาง
- T4: เลือกผู้เช่าจากข้อมูลที่ผู้เรียกคุมหรือ default แทน session
- T5: ไม่มี hash ตอนเขียน
- T6: โหลดข้อมูลที่ต้องมี session ในหน้าสาธารณะ

## วิธีแก้
- **T1:** `rotateRefreshToken` แบบ single-flight (map คำขอที่กำลังหมุน + แคชผลสั้น ๆ); 401 เก็บ `returnTo` ใน sessionStorage, ยิงเหตุการณ์ `bc:session-expired`, banner/modal ให้ล็อกอินใหม่แล้วกลับหน้าเดิม
- **T2:** บังคับ `idToken` (ไม่มี = 401 `NO_ID_TOKEN`), ตรวจ `aud` และ `email_verified`; `state` เป็น cookie httpOnly 10 นาที ใช้ครั้งเดียว เทียบด้วย `timingSafeEqual`
- **T3:** `getAdminApiKey()` คืน null ใน production ถ้าไม่ตั้ง => 503 `NO_ADMIN_API_KEY`; `/api/admin/*` ใช้ `requireSystemAdmin` (`session.mode === "admin"`; สาธิตอ่านอย่างเดียว `DEMO_READ_ONLY`); `isWorkspaceAdmin` กั้น workspace route
- **T4:** tile route ล็อกฐานสาธิต; telemetry ไม่มี `session.database` = 401; สลับฐานได้เฉพาะ `availableCompanies` หรือฐานปัจจุบัน (403 `DB_FORBIDDEN`)
- **T5:** `HashPassword` (bcrypt) ตอน admin create/update + ขยายคอลัมน์เป็น 255; `a94b0748` เพิ่ม `/api/auth/change-password` ที่ยืนยันรหัสเดิมกับ `/auth/login` ปฏิเสธบัญชี Google/สาธิต
- **T6:** `isPublicOrNoDbPath()` ข้ามการโหลด และตั้ง `loaded` เมื่อมีคำตอบสำเร็จเท่านั้น

## commit ที่เกี่ยวข้อง
- `6ba1a6d9` — refresh single-flight + กู้คืนหลัง 401 (2026-10-20); `9a2ce199` modal (10-27; ตามข้อความ commit)
- `6e9ae03e` — Google PDPA multi-tenant auth (2026-10-24; ตรวจเฉพาะ diff google route)
- `faa6e6d0` — ตรวจ Google ID token + `isWorkspaceAdmin` (2026-10-24)
- `7ab65d38` — fail-closed key, OAuth state, system-admin-only, DB-switch check, telemetry (2026-10-24)
- `a47413ec` — ล็อกฐานของ tile route (2026-10-24)
- `a94b0748` (10-24), `13f953cc` bcrypt, `a3809aba` (10-29)

## โค้ดปัจจุบันที่ป้องกัน
- `frontend/src/lib/api-server.ts:60` `getAdminApiKey`, `:89` `rotateRefreshToken`, `:359` `requireSystemAdmin`
- `frontend/src/app/api/auth/google/route.ts:58` (state), `:233` (idToken), `:252-260` (aud, email_verified); `oauth-state.ts:15-23`
- `frontend/src/app/api/auth/databases/route.ts:289-296`; `frontend/src/app/(admin)/layout.tsx:21`
- `frontend/src/lib/api-client.ts:77`; `frontend/shared/layout/PersistentWorkspaceHost.tsx:306,456`
- `backend/internal/adapter/inbound/http/monitormap/handler.go:122`; `backend/internal/domain/identity/identity.go:50`; `admin/handler.go:283,340`

## บทเรียน / กฎที่ได้
1. ผู้เช่ามาจาก session เท่านั้น ไม่รับจาก query string, body หรือ default ที่หละหลวม
2. ตัวตนต้องมาจากผลตรวจ token (aud, verified) ไม่ใช่ข้อมูลจาก client
3. กุญแจระบบไม่มี fallback ใน production ให้ fail-closed (503)
4. แยกผู้ดูแล workspace จากผู้ดูแลส่วนกลางด้วย `session.mode`
5. refresh token ใช้ครั้งเดียว ต้อง single-flight และจำหน้าที่ทำอยู่

## ดูเพิ่ม
[[adr-0003-per-tenant-identity]] · [[fe-auth-session]] · [[std-platform-google-login-pdpa-hub]] · [[hist-lessons-web-vulns-xss-redirect]] · [[history-overview]]

## ที่มาในโค้ด
- git:6ba1a6d9, git:faa6e6d0, git:7ab65d38, git:13f953cc
- frontend/src/lib/api-server.ts:60, :89, :359
- frontend/src/app/api/auth/google/route.ts:233, :252
