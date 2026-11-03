---
title: "API กลุ่ม /auth — ล็อกอิน เลือกบริษัท รีเฟรช ออกจากระบบ (Auth endpoints)"
tags: [api, auth]
aliases: ["/auth/login","/auth/select-company","/auth/me","/auth/refresh","/auth/logout","/api/auth/login","/api/auth/session","/api/auth/databases","/api/auth/logout"]
sources: ["backend/internal/adapter/inbound/http/router.go:73","backend/internal/adapter/inbound/http/identity/handler.go:76","backend/internal/adapter/inbound/http/identity/handler.go:123","backend/internal/adapter/inbound/http/identity/handler.go:164","backend/internal/adapter/inbound/http/identity/handler.go:206","backend/internal/adapter/inbound/http/identity/handler.go:239","backend/internal/adapter/inbound/http/middleware/auth.go:39","frontend/src/app/api/auth/login/route.ts:9","frontend/src/app/api/auth/logout/route.ts:10","frontend/src/app/api/auth/databases/route.ts:28","frontend/src/lib/api-server.ts:569"]
---

# API กลุ่ม /auth

กลุ่มนี้คือประตูเข้าระบบทั้งหมด: ล็อกอินกับฐาน Main ของ provider (ผู้ให้บริการ) แต่ละราย แล้วได้ access token + refresh token (JWT, ดู [[be-jwt-session-tokens]] และ [[be-identity-login-flow]]). ทุก endpoint ด้านล่างเป็น Go backend ตรง ๆ ที่ `router.go:73-82` ไม่ผ่าน `RequireRight` และไม่มี envelope `{ok,data}` (ตอบ JSON ตรง ๆ ด้วย `response.JSON`). ภาพรวมวงจรคำขอดู [[api-overview]].

## สรุป endpoint

| method | path | auth | หน้าที่ | handler |
|---|---|---|---|---|
| POST | `/auth/login` | public | ตรวจรหัสผ่านกับฐาน Main ของ provider แล้วหา company ที่เข้าได้ | identity/handler.go:76 |
| POST | `/auth/select-company` | public (ใช้ preAuthToken) | แลก preAuthToken + companyCode เป็น session เต็ม | identity/handler.go:123 |
| POST | `/auth/refresh` | public (ใช้ refreshToken) | หมุน (rotate) refresh token ออก session ใหม่ | identity/handler.go:206 |
| POST | `/auth/logout` | public (ใช้ refreshToken) | เพิกถอน session ทั้ง access และ refresh | identity/handler.go:239 |
| GET | `/auth/me` | `Authorization: Bearer <token>` | โปรไฟล์ผู้ใช้ตาม session (ตรวจสดกับฐาน Main) | identity/handler.go:164 |

## POST /auth/login

- Request: `{"provider":"<provider>","dataGroup":"<dataGroup>","username":"<user>","password":"<password>"}`
- Response 200 มีสองรูปแบบ:
  - เข้าได้บริษัทเดียว: `{"session":{"accessToken":"<token>","refreshToken":"<token>"}}`
  - เข้าได้หลายบริษัท: `{"preAuthToken":"<token>","companies":[{"code":"<companyCode>","name":"<ชื่อบริษัท>"}]}` ต้องเรียก `/auth/select-company` ต่อ
- Errors (รูปแบบ `{"error":{"message":"..."}}` จาก `response.Error`): 400 body ไม่ใช่ JSON, 401 provider/dataGroup/username/password ไม่ถูก, 403 ไม่มี company ที่เข้าถึงได้ใน dataGroup นี้
- ตัวอย่าง:

```json
POST /auth/login
{"provider":"<provider>","dataGroup":"<dataGroup>","username":"<user>","password":"<password>"}
```

## POST /auth/select-company

- Request: `{"preAuthToken":"<token>","companyCode":"<companyCode>"}`
- Response 200: `{"accessToken":"<token>","refreshToken":"<token>"}` (ไม่ห่อด้วย `session`)
- Errors: 400 body ผิด, 401 preAuthToken ไม่ถูกหรือหมดอายุ หรือ company เข้าไม่ได้

## GET /auth/me

- Header: `Authorization: Bearer <accessToken>` (middleware `Auth`, middleware/auth.go:39-57)
- Response 200: `{"username","displayName","level","provider","dataGroup","company":{"code","name"}}`
- Errors: 401 token ขาด/ผิด หรือ session ถูกเพิกถอนแล้ว (ตรวจสดกับฐาน Main ไม่ใช่แค่ decode)

## POST /auth/refresh

- Request: `{"refreshToken":"<token>"}`
- Response 200: `{"accessToken","refreshToken"}` ชุดใหม่ ตัวเก่าใช้ไม่ได้ทันที (rotate)
- Errors: 400 body ผิด, 401 refresh token ผิด/หมดอายุ หรือสิทธิ์ถูกถอน

## POST /auth/logout

- Request: `{"refreshToken":"<token>"}`
- Response: 204 ไม่มี body; access token ที่คู่กันใช้ไม่ได้ทันที (ใช้ session id ร่วมกัน)
- Errors: 400, 401

## ขีดจำกัด

- timeout รวม 60 วินาทีจาก `chimiddleware.Timeout` (router.go:64)
- ค่า HTTP status มาจาก `apperr.Kind` ผ่าน `response.Error` (ดู [[be-error-response-shape]])

## ฝั่งหน้าเว็บ (Next.js proxy)

เบราว์เซอร์ไม่เรียก Go ตรง ๆ แต่เรียก `/api/auth/*` ของ Next แล้ว Next เรียก Go ต่อ (เก็บ token ใน session cookie ฝั่ง server, ดู [[fe-auth-session]], [[fe-api-proxy-routes]]):

- `POST /api/auth/login` (`app/api/auth/login/route.ts:9`): เรียก `/auth/login` (บรรทัด 46) แล้วถ้าเป็นโหมด admin จะเรียก `/auth/select-company` (90) และ `/auth/me` (123); โหมด user ต้องมี dataGroup, โหมด admin ต้อง level >= 9; บัญชีสาธิต (demo) ถูกบล็อกในโหมด admin ด้วย 403 `DEMO_ADMIN_FORBIDDEN`
- `POST /api/auth/logout` (route.ts:10): เรียก `/auth/logout` (17)
- `GET /api/auth/session` (route.ts:6): อ่าน session จาก cookie ไม่ยิง Go; ไม่มี session = 401 `NO_SESSION`
- `GET|POST /api/auth/databases` (route.ts:28, 107): แสดงรายชื่อฐานของผู้ใช้และเลือกฐาน ผ่าน [[api-admin-workspace]] (`workspace/databases`, `workspace/select-db`) แล้ว `/auth/select-company` (208) และ `/auth/me` (241)
- `GET|POST /api/auth/google` (route.ts:44, 214): OAuth Google แล้วเรียก `workspace/google-login` (152) ด้วย admin key
- `POST /api/auth/change-password` (route.ts:34): ตรวจรหัสเดิมด้วย `/auth/login` (77) แล้ว `PATCH /api/v1/admin/users` (95) ด้วย admin key — ดู [[api-admin-console]]
- `POST /api/auth/demo` (route.ts:9): ปุ่ม Demo
- ตัวช่วย `getValidAccessToken` (`src/lib/api-server.ts:569`) ต่ออายุ token ล่วงหน้าเมื่อเหลือไม่ถึง 60 วินาที; `fetchServiceWithAuthRetry` (388) ลอง refresh แล้วเรียกซ้ำเมื่อเจอ 401

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/router.go:73-82` (route table /auth)
- `backend/internal/adapter/inbound/http/identity/handler.go:31-260` (request/response struct และ 5 handler)
- `backend/internal/adapter/inbound/http/middleware/auth.go:39-57`
- `frontend/src/app/api/auth/login/route.ts:9-130`, `logout/route.ts:10`, `databases/route.ts:28-250`, `google/route.ts:44-214`, `change-password/route.ts:34-111`
- `frontend/src/lib/api-server.ts:402,569`
