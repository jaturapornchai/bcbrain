---
title: "เซสชันและการยืนยันตัวตนฝั่ง frontend (Auth session & tokens)"
tags: [frontend, auth, session, jwt, cookie, security]
aliases: ["session cookie", "bc_ai_session", "refresh token", "JWT", "หมดเวลาใช้งาน", "401 session expired", "requireSession", "requireAdmin", "demo mode", "preAuthToken", "isDemo", "ADMIN_API_KEY"]
sources: ["frontend/src/lib/session.ts:15", "frontend/src/lib/session.ts:24", "frontend/src/lib/session.ts:56", "frontend/src/lib/session-name.ts:4", "frontend/src/types/auth.ts:44", "frontend/src/lib/api-server.ts:93", "frontend/src/lib/api-server.ts:262", "frontend/src/lib/api-server.ts:277", "frontend/src/lib/api-server.ts:402", "frontend/src/lib/api-server.ts:510", "frontend/src/lib/api-server.ts:569"]
---

# เซสชันและการยืนยันตัวตนฝั่ง frontend (Auth session & tokens)

เบราว์เซอร์ถือแค่ cookie เซสชันที่เซ็นลายเซ็นและ httpOnly; JWT access/refresh token ของ backend ถูกเก็บ "ใน cookie เซสชันนั้น" และ Next.js server (route handlers) เป็นคนแนบ `Authorization: Bearer` ให้เวลา proxy ไป Go backend
ฝั่งเบราว์เซอร์ไม่เห็น token โดยตรง

## ทำงานอย่างไร

**Cookie เซสชัน** (`src/lib/session.ts`)
- ชื่อ cookie `bc_ai_session` (`session-name.ts:4`). ค่าเป็น `base64(data).signature` เซ็นด้วย HMAC-SHA256 (`createHmac`, บรรทัด 44) และตรวจด้วย `crypto.timingSafeEqual` (บรรทัด 67) - ถ้าลายเซ็นไม่ตรงถือว่าไม่มี session.
- Idle timeout 30 นาที: `IDLE_TIMEOUT_MS = 30*60*1000` (บรรทัด 24); `decodeSession` คืน null ถ้า `Date.now() - lastActivity` เกิน (บรรทัด 74). แบบ sliding: ทุก request ที่ผ่าน `requireSession` เรียก `setSession` เขียน cookie ใหม่พร้อม `lastActivity` (`api-server.ts:267-272`; `maxAge` = `IDLE_TIMEOUT_MS / 1000` ที่ `session.ts:249`). `touchSession` (`session.ts:254`) มีไว้แต่ค้นใน `frontend/src`, `shared`, `account` ไม่พบผู้เรียก.
- ตัวเลือก cookie: `httpOnly: true`, `sameSite: "lax"`, `secure` เฉพาะ production (บรรทัด 82-84).
- API ของโมดูล: `getSession()` (215), `setSession()` (237), `touchSession()` (254), `clearSession()` (265), `encodeSession/decodeSession` (49/56), `getOrMintBcDemoSession()` (118) ออก session ของฐานสาธิต. ทั้งหมดเป็น server-only (ใช้ใน layout/route handler).

**ข้อมูลใน session** (`src/types/auth.ts:44-75`, `SessionData`): `provider`, `userCode`, `userName`, `userLevel`, `mode` ("user"|"admin"), `email?`, `role?` ("ADMIN"|"MEMBER"), `mappedUserCode?`, `isDemo?`, `pictureUrl?`, `dataGroup?`, `database?`, `databaseName?`, `loginAt`, `lastActivity`, `accessToken?`, `refreshToken?`, `preAuthToken?`, `availableCompanies?`.
- `preAuthToken` + `availableCompanies` = ช่วงรอเลือกบริษัท (ผู้ใช้ที่มีหลาย Company) แล้วเรียก `/auth/select-company` ต่อ (`api/auth/login/route.ts:82-96`, `api/auth/databases/route.ts:206-212`).
- ฝั่ง UI ถือว่าเป็นผู้ดูแลถ้า `session.isDemo || role === "ADMIN" || userLevel >= 9` (`TabWorkspace.tsx:201`, `api-server.ts:289`).

**ทางเข้า (route handlers ใน `src/app/api/auth/`)**
| ทาง | ไฟล์ | หลักการ |
|---|---|---|
| user/admin + รหัสผ่าน | `login/route.ts` | เรียก backend `/auth/login`; โหมด admin ต้อง `userLevel >= 9` (`login/route.ts:134-141,275`) |
| Demo | `demo/route.ts:11-20` | `getOrMintBcDemoSession(true)` แล้ว `setSession` พร้อม `isDemo: true`, `role: "ADMIN"` (ฐาน `bcdemo`) |
| Google | `google/route.ts` | รับ `idToken` (POST) หรือ redirect OAuth (GET) แล้วเรียก backend workspace `google-login` ด้วยหัว `X-Admin-Api-Key` (`google/route.ts:31-38,147-152`); state OAuth เก็บ cookie httpOnly สั้นๆ `bc_google_oauth_state` ที่ path `/api/auth/google` (`google/route.ts:24-29`, ชื่อ cookie `oauth-state.ts:7`) ตรวจแบบ constant-time (`oauth-state.ts:15-24`) |
| เลือกฐาน/บริษัท | `databases/route.ts` | `/api/v1/admin/workspace/databases|select-db`, `/auth/select-company`, `/auth/me` |
| ดู session | `session/route.ts:6-25` | คืนข้อมูล session หรือ `401 NO_SESSION` |
| ออก | `logout/route.ts:10-29` | session สาธิต/ฐาน `bcdemo` ล้างแคช session สาธิต ไม่เรียก backend; ที่เหลือเรียก backend `/auth/logout` ด้วย refresh token; ทุกกรณีจบด้วย `clearSession` |
| เปลี่ยนรหัสผ่าน | `change-password/route.ts` | ตรวจรหัสเดิมด้วย `/auth/login` แล้ว PATCH `/api/v1/admin/users` |

**Token refresh แบบกันชนกัน** (`src/lib/api-server.ts`)
- `rotateRefreshToken` (บรรทัด 103-167) เรียก `/auth/refresh` แบบ single-flight: `inFlightRefresh` (บรรทัด 93) รวมหลาย request ที่ใช้ refresh token ตัวเดียวกัน, และ `recentRefreshCache` (บรรทัด 97) เก็บคู่ token ใหม่ 60 วินาที (`RECENT_REFRESH_TTL_MS`, บรรทัด 101) เพราะ backend หมุน refresh token ทุกครั้ง (ใช้ซ้ำไม่ได้).
- `getValidAccessToken` (569-630) ไม่มี access token -> ขอใหม่ด้วย `reissueSessionTokens` (572-574); ใช้คู่ token จาก `recentRefreshCache` ถ้าเพิ่งหมุนไป (579-590); ตรวจอายุ access token (JWT `exp`) แล้ว refresh ล่วงหน้าถ้าเหลือน้อยกว่า 1 นาที (598-601; session สาธิตไม่หมุน refresh token ข้ามไปขอใหม่).
- `reissueSessionTokens` (173-255): ขอ token คู่ใหม่เมื่อ refresh ใช้ไม่ได้ - ผู้ใช้ Google/Workspace ที่มีอีเมลเรียก `/api/v1/admin/workspace/select-db` ด้วย `X-Admin-Api-Key` (183-228), ผู้ใช้สาธิตออก session สาธิตใหม่ (231-252).
- `fetchServiceWithAuthRetry` (402-504): ถ้า endpoint มี `/admin` แนบ `X-Admin-Api-Key` (จาก `getAdminApiKey()` `:74` ใน env; ไม่มี -> `503 NO_ADMIN_API_KEY` `:408-415`), ลองเรียก backend สูงสุด 3 ครั้งเมื่อได้ 502/503/504 หรือเชื่อมต่อไม่ได้ (`:430-459`), ถ้าได้ 401 จะหมุน token (หรือขอ token ใหม่ด้วย `reissueSessionTokens`) แล้วเรียกซ้ำ (`:463-501`).
- `proxyToService` (510) ห่อผลลัพธ์ให้เป็นรูป `{ ok, data|error, code }` เสมอ; 401 -> `SESSION_EXPIRED` ([[fe-api-proxy-routes]]).

**ตัวกันสิทธิ์ใน route handler** (`api-server.ts`)
- `requireSession()` (262-274) - ต้องมี session (ไม่งั้น 401) และเรียก `getValidAccessToken` + ต่ออายุ `lastActivity`.
- `requireAdmin()` (277-300) - `userLevel >= 9 || role === "ADMIN"` (289); โหมด demo (ฐาน bcdemo) ถูกบล็อก 403 (278-284, 290).
- `requireSystemAdmin()` (373) / `requireSystemAdminView()` (325) - โซนผู้ดูแลส่วนกลาง; `isDemoCentralViewer` (315-322; session สาธิต, โดเมนสาธิต หรือบัญชีสาธารณะของ provider `bcdemo` ใน `PUBLIC_DEMO_ADMIN_CODES`) ให้ผู้ใช้เหล่านี้ "ดูได้อย่างเดียว" และ `demoSafe` (359-371) กรองผลให้เห็นเฉพาะแถวของ bcdemo พร้อมตัดคีย์ที่ชื่อคล้ายรหัสผ่าน/token ออก (`stripSecrets` 345-356) ([[fe-admin-console]]).

**ฝั่งเบราว์เซอร์เมื่อ session หมด**: `PersistentWorkspaceHost` patch `fetch` ดัก 401 แล้วพาไป `/login?returnTo=` ([[fe-app-shell-routing]]). ตัว client `api-client.ts` คืน `ApiResult<T>` ไม่ throw ([[fe-query-client-sql-builder]]).

**ข้อควรระวัง**
- ห้ามใส่ค่าลับ (รหัส, `ADMIN_API_KEY`, token) ในโค้ด/โน้ต; อ่านจาก env เท่านั้น.
- proxy.ts ตรวจแค่ "มี cookie" - การตรวจลายเซ็น/หมดอายุจริงเกิดตอน `getSession()`.
- สิทธิ์จอ (`ScreenRights`) ฝั่ง UI เป็นแค่ UX guard backend ตรวจซ้ำ ([[fe-tabs-workspace]]).

## ที่มาในโค้ด
- `frontend/src/lib/session.ts:15-84,118,215-271` - cookie, HMAC, idle timeout
- `frontend/src/types/auth.ts:44-75` - SessionData
- `frontend/src/lib/api-server.ts:74,93-167,173-255,262-300,315-377,402-504,510-565,569-630` - refresh, guards, proxy
- `frontend/src/app/api/auth/*/route.ts` - ทางเข้า/ออก
- `frontend/src/app/api/auth/google/oauth-state.ts:7` - OAuth state cookie

## ดูเพิ่ม
[[frontend-overview]] · [[fe-login-select-database]] · [[fe-api-proxy-routes]] · [[fe-app-shell-routing]] · [[fe-admin-console]] · [[standards-overview]]
