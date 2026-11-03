---
title: "JWT session token และการเพิกถอน (JWT + revocation store)"
tags: [backend, identity, jwt, session, security]
aliases: ["jwt", "access token", "refresh token", "pre-auth token", "jti", "revocation", "revoked_sessions.json", "JWT_SIGNING_KEY", "HS256"]
sources: ["backend/internal/adapter/outbound/identity/jwt_token_service.go:18", "backend/internal/adapter/outbound/identity/jwt_token_service.go:104", "backend/internal/adapter/outbound/identity/jwt_token_service.go:218", "backend/internal/adapter/outbound/identity/memory_revocation_store.go:33", "backend/internal/adapter/inbound/http/middleware/auth.go:39", "backend/internal/di/container.go:79"]
---

# JWT session token และการเพิกถอน

backend ออก JWT 3 ชนิดด้วย HS256: `preauth`, `access`, `refresh` (`jwt_token_service.go:18-20`). access และ refresh ที่ออกพร้อมกันใช้ `jti` (Session ID) เดียวกัน จึงเพิกถอนทั้งคู่ได้ด้วยการเพิกถอน `jti` เดียว. ค่ากุญแจตั้งผ่าน env `JWT_SIGNING_KEY` เท่านั้น ([[be-config-env]]).

## ทำงานอย่างไร

1. **ออก token**
   - `IssueSession` (`:218`): สร้าง `jti` สุ่ม 16 ไบต์ฐานสิบหก (`newSessionID`, `:71-77`) แล้วเซ็น access (อายุ `ACCESS_TOKEN_TTL_MINUTES`, default 15) และ refresh (`REFRESH_TOKEN_TTL_HOURS`, default 168 ชม. = 7 วัน) โดยใช้ claims ชุดเดียวกัน (`:230-252`).
   - `IssuePreAuthToken` (`:81`): อายุ `PRE_AUTH_TOKEN_TTL_MINUTES` (default 5) ใช้ได้กับ `/auth/select-company` เท่านั้น.
   - ถ้า `JWT_SIGNING_KEY` ว่าง ทุกการออก/ตรวจ token ล้มเหลวด้วย `ErrSigningKeyNotConfigured` (fail-closed, `:55-58,82,105,219`).
2. **Claims** (`:30-40`): `sub` = username, `tenantId` = Provider Code, `dataGroup`, `companyCode`, `databaseName`, `level`, `type`, `jti`.
3. **ตรวจ token** (`parse`, `:104-124`): ต้องเป็น HMAC เท่านั้น (กัน `alg` อื่นหลอก, `:111-113`), ตรวจลายเซ็น+หมดอายุด้วย validator มาตรฐาน; `VerifyAccessToken`/`VerifyRefreshToken`/`VerifyPreAuthToken` ตรวจ `type` ตรงชนิด (`:134,158,192`) — token คนละชนิดใช้แทนกันไม่ได้. access/refresh เช็ก `IsRevoked(jti)` ต่อ (`:162-169`).
4. **middleware `Auth`** (`middleware/auth.go:39`): อ่าน `Authorization: Bearer ...` → `VerifyAccessToken` → ใส่ `SessionClaims` ลง context ให้ handler/`RequireRight` ใช้ ([[be-http-router-routes]]).
5. **เพิกถอน** (`memory_revocation_store.go`): `Revoke(jti, expiresAt)` เก็บใน map `jti → expiresAt`; `IsRevoked` ลบรายการที่เลยเวลาแล้วทิ้งเอง (`:99-110`). `NewFileBackedRevocationStore(path)` โหลดไฟล์ตอนเริ่มและเขียนกลับด้วย tmp + `os.Rename` สิทธิ์ `0o600` ทุกครั้งที่เปลี่ยน (`:33-84`).
6. **ตำแหน่งไฟล์**: env `REVOCATION_STORE_FILE` หรือ default `<CONFIG_DIR>/revoked_sessions.json` (`di/container.go:79-82`).

## ตัวอย่างวงจร

| เหตุการณ์ | ผลต่อ `jti` |
|---|---|
| login สำเร็จ | ออก `jti` ใหม่ ใช้ร่วมกัน access+refresh |
| `/auth/refresh` | เพิกถอน `jti` เก่า แล้วออก `jti` ใหม่ ([[be-identity-login-flow]]) |
| `/auth/logout` | เพิกถอน `jti` → access token เดิมใช้ไม่ได้ทันที |
| เลย TTL | token หมดอายุเอง; รายการเพิกถอนถูกล้างเมื่อเลยเวลาเดิม |

## ข้อควรระวัง

- ชื่อ type คือ `InMemoryRevocationStore` แต่เปิดโหมดไฟล์ได้ — ADR-0004 พูดถึงเป็น in-memory ส่วนโค้ดจริงที่ `di` ใช้เป็นแบบไฟล์ ให้ยึดโค้ด ([[adr-0004-session-revocation-store]]).
- สิทธิ์เมนูไม่อยู่ใน token — โหลดสดทุกคำขอที่ผ่าน `RequireRight` ([[be-menu-rights-permission]]).
- ข้อมูลใน token (เช่น `level`) เป็นค่า ณ ตอนออก ไม่อัปเดตจนกว่าจะ refresh.

## ที่มาในโค้ด

- `backend/internal/adapter/outbound/identity/jwt_token_service.go:18-77` — ชนิด token, claims, ตัวสร้าง, session id.
- `backend/internal/adapter/outbound/identity/jwt_token_service.go:81-124` — ออก pre-auth และ `parse`.
- `backend/internal/adapter/outbound/identity/jwt_token_service.go:126-262` — verify + `IssueSession` + `sign`.
- `backend/internal/adapter/outbound/identity/memory_revocation_store.go:16-110` — store.
- `backend/internal/di/container.go:79-92` — เลือก store ไฟล์และประกอบ token service.
- `backend/internal/application/identity/port.go:121` — interface `RevocationStore`.

## ดูเพิ่ม

[[backend-overview]] · [[be-identity-login-flow]] · [[be-menu-rights-permission]] · [[be-config-env]] · [[adr-0004-session-revocation-store]] · [[adr-index]]
