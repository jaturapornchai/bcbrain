---
title: "ขั้นตอน login / เลือกบริษัท / refresh / logout (Identity login flow)"
tags: [backend, identity, auth, login]
aliases: ["login", "select-company", "pre-auth", "refresh token", "logout", "/auth/login", "bc_user_list", "รหัสผ่าน bcrypt", "เข้าสู่ระบบ"]
sources: ["backend/internal/application/identity/service.go:51", "backend/internal/application/identity/service.go:113", "backend/internal/application/identity/service.go:254", "backend/internal/domain/identity/identity.go:64", "backend/internal/adapter/outbound/identity/postgres_repository.go:42", "backend/internal/adapter/inbound/http/identity/handler.go:76"]
---

# ขั้นตอน login / เลือกบริษัท / refresh / logout

ผู้ใช้พิสูจน์ตัวตนกับ Main Database ของ Tenant ตัวเอง ([[be-multi-tenant]]). ถ้าเข้าได้บริษัทเดียว ระบบออก session ทันที; ถ้าเข้าได้หลายบริษัท ระบบออก pre-auth token ให้ไปเรียก `/auth/select-company` อีกครั้ง. รายละเอียดชนิดโทเค็นอยู่ที่ [[be-jwt-session-tokens]].

## ทำงานอย่างไร

### 1) `POST /auth/login` (`identity/handler.go:76`)

- body: `{"provider","dataGroup","username","password"}` (`handler.go:32-37`) — ถ้า JSON พัง → 400.
- `Service.Login` (`service.go:51`):
  1. `ResolveConnection(provider)` ไม่พบ → 401 ข้อความกลาง `invalid provider, data group, username or password` (ไม่บอกว่าผิดตรงไหน, `service.go:22-25`).
  2. คำนวณ Main DB `bcerpmain<lower(provider)>` แล้ว `FindByCode`: `SELECT ... FROM bc_user_list WHERE UPPER(user_code) = UPPER($1)` (เทียบชื่อผู้ใช้แบบไม่สนตัวพิมพ์เหมือนระบบเดิม, `postgres_repository.go:42-66`); `user_level`/`active_status` เป็น NULL → ถือเป็น 0 (ไม่ active).
  3. `user.Authenticate(password)` (`domain/identity/identity.go:64`): ต้อง `active_status = 1`; ถ้า `user_password` เป็น bcrypt hash (`$2a$/$2b$/$2y$`) ใช้ `bcrypt.CompareHashAndPassword`.
  4. `AccessibleCompanies(provider main DB, dataGroup, user.Code)` (SQL อยู่ `postgres_repository.go:132-175`): JOIN `bc_database_list_user_and_group` กับ `bc_database_list` โดย `user_or_group_status = 0` (COALESCE NULL → 1 = ไม่อนุญาต) และเรียงตาม `roworder`.
  5. ผลตามจำนวนบริษัท: 0 → 403 `no accessible company for this data group`; 1 → `IssueSession` ได้ `accessToken` + `refreshToken` ทันที; มากกว่า 1 → `IssuePreAuthToken` พร้อมรายการ `companies` (`code`, `name`) (`service.go:68-105`).
- รูปผลลัพธ์: `{"session":{"accessToken","refreshToken"}}` หรือ `{"preAuthToken","companies":[...]}` (`handler.go:39-60`).

### 2) `POST /auth/select-company` (`service.go:113`)

body `preAuthToken` + `companyCode`. ตรวจ pre-auth token → **คิวรีรายการบริษัทใหม่ ไม่เชื่อรายการที่ client เคยได้** → ถ้า `companyCode` ไม่อยู่ในรายการ (เทียบไม่สนตัวพิมพ์) → 401 → อ่าน `level` ล่าสุดของผู้ใช้ (`:141-146`) → `IssueSession`.

### 3) `GET /auth/me` (ต้อง `Auth`)

`GetProfile` คิวรีผู้ใช้/บริษัทสดจาก Main DB ทุกครั้ง (`service.go:231`) จึงจับกรณีผู้ใช้ถูกปิด/ถอนสิทธิ์ระหว่าง session ได้ แม้ token ยังใช้ได้.

### 4) `POST /auth/refresh` (`service.go:254`)

ตรวจ refresh token (รวมเช็กว่าถูกเพิกถอนหรือยัง) → `verifySession` ตรวจซ้ำว่าผู้ใช้ยัง active และยังเข้าบริษัทนั้นได้ (`:194-228`) → **เพิกถอน session เก่า** → ออกคู่ token ใหม่ด้วย `level` ล่าสุด (rotation).

### 5) `POST /auth/logout` (`service.go:287`)

ตรวจ refresh token แล้วเพิกถอน `jti` ของ session — ทำให้ access token ที่ออกมาคู่กันใช้ไม่ได้ทันทีด้วย (ใช้ `jti` เดียวกัน) ([[adr-0004-session-revocation-store]]).

## กติกา/ข้อควรระวัง

- สิทธิ์เข้าบริษัทคิดจากแถวที่ `user_or_group_code` = ผู้ใช้โดยตรงเท่านั้น (ไม่รวมกลุ่ม) ขณะที่สิทธิ์เมนูรวมแถวกลุ่ม ([[be-menu-rights-permission]]).
- `level` ใน access token อัปเดตเฉพาะตอน `select-company` และ `refresh` — ถ้าเปลี่ยนระดับผู้ใช้กลางอายุ access token (15 นาที) จะยังเป็นค่าเก่า.
- `CONTEXT.md` ล้าสมัยเรื่องรหัสผ่าน — โค้ดใช้ bcrypt (`HashPassword` ใน `identity.go:50`) ให้ยึดโค้ด.
- ADR: [[adr-0003-per-tenant-identity]].

## ที่มาในโค้ด

- `backend/internal/application/identity/service.go:22-25,51-111` — `Login`.
- `backend/internal/application/identity/service.go:113-160` — `SelectCompany`.
- `backend/internal/application/identity/service.go:194-228,254-300` — `verifySession`, `Refresh`, `Logout`.
- `backend/internal/domain/identity/identity.go:43-72` — bcrypt และ `Authenticate`.
- `backend/internal/adapter/outbound/identity/postgres_repository.go:42,132` — SQL ผู้ใช้/บริษัท.
- `backend/internal/adapter/inbound/http/identity/handler.go:32-60,76,123,164,206,239` — DTO และ handler.

## ดูเพิ่ม

[[backend-overview]] · [[be-jwt-session-tokens]] · [[be-multi-tenant]] · [[be-menu-rights-permission]] · [[adr-0003-per-tenant-identity]] · [[adr-index]]
