---
title: "เซสชันและการยืนยันตัวตนฝั่ง frontend (Auth session & tokens)"
tags: [frontend, auth, session, jwt, cookie, security]
aliases: ["session cookie", "bc_ai_session", "refresh token", "JWT", "หมดเวลาใช้งาน", "401 session expired", "requireSession", "requireAdmin", "demo mode", "preAuthToken", "isDemo", "ADMIN_API_KEY"]
sources: ["frontend/src/lib/session.ts:15", "frontend/src/lib/session.ts:24", "frontend/src/lib/session.ts:56", "frontend/src/lib/session-name.ts:6", "frontend/src/types/auth.ts:44", "frontend/src/lib/api-server.ts:87", "frontend/src/lib/api-server.ts:248", "frontend/src/lib/api-server.ts:263", "frontend/src/lib/api-server.ts:388", "frontend/src/lib/api-server.ts:496", "frontend/src/lib/api-server.ts:555"]
---

# เซสชันและการยืนยันตัวตนฝั่ง frontend (Auth session & tokens)

เบราว์เซอร์ถือแค่ cookie เซสชันที่เซ็นลายเซ็นและ httpOnly; JWT access/refresh token ของ backend ถูกเก็บ "ใน cookie เซสชันนั้น" และ Next.js server (route handlers) เป็นคนแนบ `Authorization: Bearer` ให้เวลา proxy ไป Go backend
ฝั่งเบราว์เซอร์ไม่เห็น token โดยตรง

## ทำงานอย่างไร

**Cookie เซสชัน** (`src/lib/session.ts`)
- ชื่อ cookie `bc_ai_session` (`session-name.ts:6`). ค่าเป็น `base64(data).signature` เซ็นด้วย HMAC-SHA256 (`createHmac`, บรรทัด ~44) และตรวจด้วย `crypto.timingSafeEqual` (บรรทัด 67) - ถ้าลายเซ็นไม่ตรงถือว่าไม่มี session.
- Idle timeout 30 นาที: `IDLE_TIMEOUT_MS = 30*60*1000` (บรรทัด 24); `decodeSession` คืน null ถ้า `Date.now() - lastActivity` เกิน (บรรทัด 74). แบบ sliding: ทุก request ที่ผ่าน `requireSession` เขียน cookie ใหม่พร้อม `lastActivity` (`touchSession` บรรทัด 251, `maxAge` บรรทัด 246).
- ตัวเลือก cookie: `httpOnly: true`, `sameSite: "lax"`, `secure` เฉพาะ production (บรรทัด 82-84).
- API ของโมดูล: `getSession()` (212), `setSession()` (234), `touchSession()` (251), `clearSession()` (262), `encodeSession/decodeSession` (49/56). ทั้งหมดเป็น server-only (ใช้ใน layout/route handler).

**ข้อมูลใน session** (`src/types/auth.ts:44-76`, `SessionData`): `provider`, `userCode`, `userName`, `userLevel`, `mode` ("user"|"admin"), `email?`, `role?` ("ADMIN"|"MEMBER"), `mappedUserCode?`, `isDemo?`, `dataGroup?`, `database?`, `databaseName?`, `loginAt`, `lastActivity`, `accessToken?`, `refreshToken?`, `preAuthToken?`, `availableCompanies?`.
- `preAuthToken` + `availableCompanies` = ช่วงรอเลือกบริษัท (ผู้ใช้ที่มีหลาย Company) แล้วเรียก `/auth/select-company` ต่อ (`api/auth/login/route.ts:82-90`, `api/auth/databases/route.ts:208`).
- ฝั่ง UI ถือว่าเป็นผู้ดูแลถ้า `session.isDemo || role === "ADMIN" || userLevel >= 9` (`TabWorkspace.tsx:197`, `api-server.ts:271`).

**ทางเข้า (route handlers ใน `src/app/api/auth/`)**
| ทาง | ไฟล์ | หลักการ |
|---|---|---|
| user/admin + รหัสผ่าน | `login/route.ts` | เรียก backend `/auth/login`; โหมด admin ต้อง `userLevel >= 9` (`login/route.ts:135-141,275`) |
| Demo | `demo/route.ts:11-15` | `getOrMintBcDemoSession(true)` แล้ว `setSession` (ฐาน `bcdemo`) |
| Google | `google/route.ts` | รับ `idToken` (POST) หรือ redirect OAuth (GET) แล้วเรียก backend workspace `google-login` ด้วยหัว `X-Admin-Api-Key` (บรรทัด 27-35,152); state OAuth เก็บ cookie httpOnly สั้นๆ `bc_google_oauth_state` ที่ path `/api/auth/google` (`oauth-state.ts:7`) เทียบแบบ constant-time |
| เลือกฐาน/บริษัท | `databases/route.ts` | `/api/v1/admin/workspace/databases|select-db`, `/auth/select-company`, `/auth/me` |
| ดู session | `session/route.ts:6-11` | คืนข้อมูล session หรือ `401 NO_SESSION` |
| ออก | `logout/route.ts:17` | เรียก backend `/auth/logout` แล้ว `clearSession` |
| เปลี่ยนรหัสผ่าน | `change-password/route.ts` | ตรวจรหัสเดิมด้วย `/auth/login` แล้ว PATCH `/api/v1/admin/users` |

**Token refresh แบบกันชนกัน** (`src/lib/api-server.ts`)
- `rotateRefreshToken` (บรรทัด 88-150) เรียก `/auth/refresh` แบบ single-flight: `inFlightRefresh` (บรรทัด 104) รวมหลาย request ที่ใช้ refresh token ตัวเดียวกัน, และ `recentRefreshCache` เก็บคู่ token ใหม่ 60 วินาที (`RECENT_REFRESH_TTL_MS`, บรรทัด 87) เพราะ backend หมุน refresh token ทุกครั้ง (ใช้ซ้ำไม่ได้).
- `getValidAccessToken` (555) ตรวจอายุ access token และ refresh ล่วงหน้าถ้าเหลือน้อยกว่า 1 นาที (บรรทัด 586).
- `fetchServiceWithAuthRetry` (388): ถ้า endpoint มี `/admin` แนบ `X-Admin-Api-Key` (จาก `getAdminApiKey()` ใน env; ไม่มี -> `503 NO_ADMIN_API_KEY`), retry สูงสุด 3 ครั้ง, ถ้า 401 จะหมุน token แล้วลองใหม่ (บรรทัด 454-458).
- `proxyToService` (496) ห่อผลลัพธ์ให้เป็นรูป `{ ok, data|error, code }` เสมอ; 401 -> `SESSION_EXPIRED` ([[fe-api-proxy-routes]]).

**ตัวกันสิทธิ์ใน route handler** (`api-server.ts`)
- `requireSession()` (248) - ต้องมี session (ไม่งั้น 401) และเรียก `getValidAccessToken` + ต่ออายุ `lastActivity`.
- `requireAdmin()` (263) - `userLevel >= 9 || role === "ADMIN"`; โหมด demo (ฐาน bcdemo) ถูกบล็อก 403.
- `requireSystemAdmin()` (359) / `requireSystemAdminView()` (311) - โซนผู้ดูแลส่วนกลาง; `isDemoCentralViewer` (301) ให้ผู้ใช้ demo "ดูได้อย่างเดียว" และ `demoSafe` (345) กรองผลให้เห็นเฉพาะแถวของ bcdemo ([[fe-admin-console]]).

**ฝั่งเบราว์เซอร์เมื่อ session หมด**: `PersistentWorkspaceHost` patch `fetch` ดัก 401 แล้วพาไป `/login?returnTo=` ([[fe-app-shell-routing]]). ตัว client `api-client.ts` คืน `ApiResult<T>` ไม่ throw ([[fe-query-client-sql-builder]]).

**ข้อควรระวัง**
- ห้ามใส่ค่าลับ (รหัส, `ADMIN_API_KEY`, token) ในโค้ด/โน้ต; อ่านจาก env เท่านั้น.
- proxy.ts ตรวจแค่ "มี cookie" - การตรวจลายเซ็น/หมดอายุจริงเกิดตอน `getSession()`.
- สิทธิ์จอ (`ScreenRights`) ฝั่ง UI เป็นแค่ UX guard backend ตรวจซ้ำ ([[fe-tabs-workspace]]).

## ที่มาในโค้ด
- `frontend/src/lib/session.ts:15-84,212-262` - cookie, HMAC, idle timeout
- `frontend/src/types/auth.ts:44-76` - SessionData
- `frontend/src/lib/api-server.ts:87-150,248-300,388-458,496-553,555-612` - refresh, guards, proxy
- `frontend/src/app/api/auth/*/route.ts` - ทางเข้า/ออก
- `frontend/src/app/api/auth/google/oauth-state.ts:7` - OAuth state cookie

## ดูเพิ่ม
[[frontend-overview]] · [[fe-login-select-database]] · [[fe-api-proxy-routes]] · [[fe-app-shell-routing]] · [[fe-admin-console]] · [[standards-overview]]
