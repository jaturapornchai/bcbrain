---
title: "ทำไมถูกเด้งออกจากระบบ / ขึ้น \"หมดเวลาใช้งาน\" (token หมดอายุ, idle 30 นาที, logout) ทำงานอย่างไร"
tags: [faq, session, jwt, auth, troubleshooting, backend, frontend]
aliases: ["หมดเวลาใช้งาน กรุณาเข้าสู่ระบบใหม่","SESSION_EXPIRED","NO_SESSION","session หมดอายุ","refresh token","access token หมดอายุ","idle timeout","bc_ai_session","401 เด้งไป login","returnTo"]
sources: ["backend/internal/adapter/outbound/identity/jwt_token_service.go:150", "backend/internal/application/identity/service.go:194", "backend/internal/application/identity/service.go:254", "frontend/src/lib/session.ts:24", "frontend/src/lib/api-server.ts:89", "frontend/src/lib/api-server.ts:248", "frontend/shared/layout/PersistentWorkspaceHost.tsx:279"]
---
# ทำไมถูกเด้งออกจากระบบ / ขึ้น "หมดเวลาใช้งาน"

**ตอบสั้น:** มี 2 ชั้นซ้อนกัน — (1) cookie เซสชันของ Next (`bc_ai_session`) หมดเมื่อไม่ได้ใช้งานเกิน 30 นาที (sliding) และ (2) JWT ของ backend: access token อายุ 15 นาที (หมุนต่ออัตโนมัติด้วย refresh token อายุ 7 วัน) ถ้าอย่างใดอย่างหนึ่งใช้ไม่ได้ คำขอจะได้ 401 และหน้าเว็บพาไป `/login?returnTo=<หน้าเดิม>` ให้เข้าสู่ระบบใหม่แล้วกลับมาหน้าเดิม

## รายละเอียด
**ฝั่ง Next (cookie):** `decodeSession` คืน null ถ้า `now - lastActivity > 30 นาที` (`session.ts:24`, ตรวจที่ `:74`) ทุกคำขอที่ผ่าน `requireSession` เขียน cookie ใหม่พร้อม `lastActivity` (`api-server.ts:248`) จึงเป็นแบบ sliding ไม่มี session → ตอบ 401 รหัส `NO_SESSION` ข้อความ "หมดเวลาใช้งาน กรุณาเข้าสู่ระบบใหม่"

**ฝั่ง backend (JWT, HS256):** `JWT_SIGNING_KEY` เซ็น 3 ชนิด — preauth (`PRE_AUTH_TOKEN_TTL_MINUTES` ค่าเริ่ม 5), access (`ACCESS_TOKEN_TTL_MINUTES` 15), refresh (`REFRESH_TOKEN_TTL_HOURS` 168) ค่าเริ่มต้นอยู่ที่ `config.go:42-44` access และ refresh ที่ออกคู่กันใช้ `jti` เดียวกัน `VerifyAccessToken` (`jwt_token_service.go:150`) ตรวจลายเซ็น หมดอายุ และ `IsRevoked(jti)` ถ้าไม่ผ่าน → 401 "missing or invalid access token" (`middleware/auth.go:39`)

**การต่ออายุอัตโนมัติ:** `getValidAccessToken` (`api-server.ts:555`) เรียก `/auth/refresh` ล่วงหน้าเมื่อ access token เหลือน้อยกว่า 1 นาที `Service.Refresh` (`service.go:254`) ตรวจ refresh token → `verifySession` ตรวจซ้ำว่าผู้ใช้ยังมีอยู่/ใช้งานได้ และยังเข้าบริษัทนั้นได้ → เพิกถอน `jti` เก่า → ออกคู่ใหม่ (ค่า `level` ถูกอ่านใหม่ตรงนี้) Next รวมคำขอ refresh ที่ชนกันเป็นรอบเดียว (`rotateRefreshToken`, `api-server.ts:89`, แคชผล 60 วินาที) เพราะ refresh token ใช้ซ้ำไม่ได้

**ออกจากระบบ:** `Logout` (`service.go:287`) เพิกถอน `jti` → access token เดิมใช้ไม่ได้ทันที (ไม่ต้องรอ 15 นาที) ส่วนฝั่งเว็บเรียก `/api/auth/logout` แล้วล้าง cookie

**เมื่อใดบังคับเข้าสู่ระบบใหม่:**
| สถานการณ์ | สาเหตุในโค้ด |
|---|---|
| ไม่ได้ใช้งานเกิน 30 นาที | cookie idle (`session.ts:74`) |
| ไม่มีการต่ออายุนานเกิน 7 วัน | refresh token หมดอายุ (ทุกครั้งที่ refresh ได้ refresh token ใหม่อายุ 7 วันอีกครั้ง) |
| ผู้ดูแลปิดผู้ใช้ (`ActiveStatus` ไม่ใช่ใช้งาน) หรือถอนสิทธิ์เข้าบริษัท | `verifySession` ตอบ "session is no longer valid" ตอน refresh (`service.go:208`, `:222`) |
| เปลี่ยน `JWT_SIGNING_KEY` | token เก่าทั้งหมดตรวจลายเซ็นไม่ผ่าน |
| Logout จากเครื่องอื่น | `jti` ถูกเพิกถอน |

**ฝั่งหน้าจอ:** `PersistentWorkspaceHost` ดัก `fetch` ที่ได้ 401 (`:279`) เก็บ `returnTo` ลง `sessionStorage` แล้วแสดงแถบ/ปุ่มให้เข้าสู่ระบบใหม่หรือพาไป `/login?returnTo=` — งานที่ยังไม่บันทึกบนจอไม่ถูกเก็บให้อัตโนมัติ

## ข้อควรระวัง
- สิทธิ์เมนูไม่ได้ฝังใน token โหลดสดทุกคำขอ จึงเปลี่ยนสิทธิ์แล้วมีผลทันที แต่ `level` ใน token เปลี่ยนเฉพาะตอน refresh ([[faq-menu-permission-denied]])
- อย่าแก้ปัญหา "เด้งออกบ่อย" ด้วยการยืด TTL โดยไม่ดู idle 30 นาทีของ cookie ซึ่งเป็นตัวที่ตัดก่อน
- ถ้า backend ไม่ได้ตั้ง `JWT_SIGNING_KEY` ทุกการออก/ตรวจ token ล้มเหลวแบบ fail-closed (`ErrSigningKeyNotConfigured`) — login ไม่ผ่านเลย ไม่ใช่เด้งออก
- บัญชีสาธิต (demo) ไม่ผ่านการ refresh ผ่าน backend (`!session.isDemo`, `api-server.ts:588`)

## ดูเพิ่ม
- [[be-jwt-session-tokens]]
- [[fe-auth-session]]
- [[be-identity-login-flow]]
- [[hist-lessons-tenant-auth-sessions]]
- [[faq-tenant-database-select]]
- [[adr-0004-session-revocation-store]]

## ที่มาในโค้ด
- `backend/internal/adapter/outbound/identity/jwt_token_service.go:150` `VerifyAccessToken` (เช็ก `IsRevoked` บรรทัด 162) / `:184` `VerifyRefreshToken`
- `backend/internal/adapter/inbound/http/middleware/auth.go:39` `Auth` ตอบ 401 เมื่อ token ไม่ถูกต้อง
- `backend/internal/application/identity/service.go:254` `Refresh`, `:287` `Logout`, `:194` `verifySession`
- `backend/internal/platform/config/config.go:42` ค่าเริ่มต้น TTL ของ preauth/access/refresh
- `frontend/src/lib/session.ts:24` `IDLE_TIMEOUT_MS` (30 นาที)
- `frontend/src/lib/api-server.ts:89` `rotateRefreshToken` / `:248` `requireSession` / `:555` `getValidAccessToken`
- `frontend/shared/layout/PersistentWorkspaceHost.tsx:279` ดัก 401 แล้วพาไป `/login?returnTo=`
