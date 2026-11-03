---
title: "API ลงทะเบียนผู้ให้บริการ /admin/providers และกุญแจผู้ดูแล (Tenant registration + AdminAuth)"
tags: [api, tenant, admin]
aliases: ["/admin/providers","X-Admin-Api-Key","AdminAuth","tenantHandler.Create","tenantHandler.List"]
sources: ["backend/internal/adapter/inbound/http/router.go:114","backend/internal/adapter/inbound/http/tenant/handler.go:66","backend/internal/adapter/inbound/http/tenant/handler.go:104","backend/internal/adapter/inbound/http/middleware/adminauth.go:18","backend/internal/application/tenant/service.go:28","frontend/src/lib/api-server.ts:60"]
---

# API /admin/providers และ AdminAuth

ลงทะเบียน provider (ผู้ให้บริการ = tenant, ผู้เช่าแต่ละรายมีฐาน Main ของตัวเอง ดู [[be-provider-registry]], [[be-multi-tenant]], [[adr-0003-per-tenant-identity]]) เข้าระบบ. กลุ่มนี้ **ไม่ใช้ JWT** แต่ใช้กุญแจผู้ดูแลใน header. กลุ่ม REST ผู้ดูแลอีกชุดที่ใช้กุญแจเดียวกันคือ [[api-admin-console]] และ [[api-admin-workspace]].

## AdminAuth (middleware/adminauth.go:18-28)

- Header: `X-Admin-Api-Key: <adminKey>` (ค่าจาก env ของ server ไม่ใส่ลงโน้ต)
- เทียบแบบ constant-time (`subtle.ConstantTimeCompare`); ถ้ากุญแจฝั่ง server ว่าง จะปฏิเสธทุกคำขอเสมอ (ไม่มีทางปล่อยเปิดโดยลืมตั้งค่า)
- ไม่ผ่าน = 401 `{"error":{"message":"missing or invalid admin API key"}}`
- ใช้กับ: `/admin/*` (router.go:114), `/api/v1/admin/*` (router.go:213), `/api/v1/mcp/tokens` ([[api-mcp]])

## POST /admin/providers  (tenant/handler.go:66)

ทดสอบการเชื่อมต่อฐานข้อมูลจริงก่อน แล้วลงทะเบียนเมื่อทดสอบผ่านเท่านั้น (ล้มเหลว = ไม่บันทึกอะไร).

- Request:

```json
POST /admin/providers   (X-Admin-Api-Key: <adminKey>)
{"code":"<providerCode>","name":"<ชื่อผู้ให้บริการ>",
 "connection":{"host":"<host>","port":5432,"database":"<dbName>","user":"<dbUser>","password":"<dbPassword>","sslmode":"disable"}}
```

- Response 201: `{"code","name","status":"active","createdAt":"<RFC3339>"}` (ไม่คืนรายละเอียดการเชื่อมต่อ/รหัสผ่าน)
- Errors: 400 body ผิด/ข้อมูลไม่ครบ/เชื่อมฐานไม่ได้, 401 กุญแจผิด, 409 รหัส provider ซ้ำ
- การจัดเก็บ config ของ provider ดู [[adr-0001-provider-config-json-files]]

## GET /admin/providers  (tenant/handler.go:104)

- Response 200: อาร์เรย์ `[{"code","name","status","createdAt"}]` เฉพาะฟิลด์ดัชนี ไม่มีรายละเอียดการเชื่อมต่อหรือรหัสผ่าน
- Errors: 401

## ขีดจำกัด

timeout รวม 60 วินาทีของ router (router.go:64).

## ผู้เรียกฝั่งหน้าเว็บ

Next ไม่มี route ที่ส่งตรงไป `/admin/providers` ของ Go: หน้าจอผู้ดูแลเรียก `GET|POST|PATCH|DELETE /api/admin/providers` (Next) ซึ่ง proxy ไป `/api/v1/admin/providers` (ชุด admin console, `src/app/api/admin/providers/route.ts:27,40,76,108`) แทน — ดู [[api-admin-console]].
กุญแจแนบอัตโนมัติโดย `fetchServiceWithAuthRetry` เมื่อ endpoint มีคำว่า `/admin` (`src/lib/api-server.ts:388`); `getAdminApiKey` (api-server.ts:60) ใน production ต้องมี env ไม่งั้นตอบ 503 `NO_ADMIN_API_KEY`.

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/router.go:114-122`
- `backend/internal/adapter/inbound/http/tenant/handler.go:26-120`
- `backend/internal/adapter/inbound/http/middleware/adminauth.go:10-28`
- `backend/internal/application/tenant/service.go:28`
- `frontend/src/lib/api-server.ts:60,388`; `frontend/src/app/api/admin/providers/route.ts:27-108`
