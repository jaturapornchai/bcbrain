---
title: "API คอนโซลผู้ดูแล /api/v1/admin — provider, user, database, main-query, menu-permissions (Admin console API)"
tags: [api, admin]
aliases: ["/api/v1/admin/providers","/api/v1/admin/users","/api/v1/admin/databases","/api/v1/admin/database-info","/api/v1/admin/main-query","/api/v1/admin/menu-permissions","/api/admin/users","/api/admin/databases","/api/admin/main-query","/api/admin/menu-permissions"]
sources: ["backend/internal/adapter/inbound/http/router.go:211","backend/internal/adapter/inbound/http/admin/handler.go:88","backend/internal/adapter/inbound/http/admin/handler.go:178","backend/internal/adapter/inbound/http/admin/handler.go:429","backend/internal/adapter/inbound/http/admin/handler.go:593","backend/internal/adapter/inbound/http/admin/handler.go:646","backend/internal/adapter/inbound/http/admin/menu_permissions.go:46","backend/internal/adapter/inbound/http/admin/menu_permissions.go:107","frontend/src/app/api/admin/users/route.ts:38","frontend/src/app/api/admin/main-query/route.ts:10","frontend/src/app/api/admin/menu-permissions/route.ts:14"]
---

# API คอนโซลผู้ดูแล `/api/v1/admin/*`

REST สำหรับหน้าจอ "ผู้ดูแลระบบ" (จัดการ provider, ผู้ใช้, รายชื่อฐานข้อมูล, สิทธิ์เมนู). ทั้งกลุ่มอยู่หลัง `AdminAuth` (header `X-Admin-Api-Key`, ดู [[api-tenant]]) ที่ router.go:213-214 — **ไม่ใช้ JWT**; ผู้เรียกฝั่งหน้าเว็บ (Next) ตรวจ session/level ก่อนแล้วแนบกุญแจเอง ([[fe-api-proxy-routes]], [[fe-auth-session]]). กลุ่ม `workspace/*` ที่อยู่ใต้ prefix เดียวกันแยกไว้ที่ [[api-admin-workspace]].

## รูปแบบ response (admin/handler.go:69-85)

- สำเร็จ: `{"ok":true,"data":...}` (200 เสมอ ยกเว้นระบุ)
- ล้มเหลว: `{"ok":false,"error":"<ข้อความ>","code":"<CODE>"}` (ต่างจากกลุ่มอื่นที่เป็น `{"error":{"message"}}`)
- เปิดฐานของ provider ไม่ได้: 400 `INVALID_PROVIDER` (provider ว่างหรือไม่มี) หรือ 500 `DB_CONNECT_ERROR` (`writePoolErr`); ฐาน auth ของ provider ชื่อ `bcerpmain<providerCode>` (handler.go:46-58)

## ตาราง endpoint

| method | path | หน้าที่ | input สำคัญ | ตาราง | handler |
|---|---|---|---|---|---|
| GET | `/providers` | รายชื่อ provider | - | (registry ของ tenant) | handler.go:88 |
| POST | `/providers` | สร้าง provider | `provider_code`, `provider_name`, `auth_database` | pg_database, registry | handler.go:113 |
| PATCH | `/providers` | stub: สะท้อน body กลับ ไม่แก้อะไร | any | - | handler.go:165 |
| DELETE | `/providers?code=` | stub: ตอบ `{deleted:code}` ไม่ลบจริง | `code` | - | handler.go:172 |
| GET | `/users?provider=` | รายชื่อผู้ใช้ + ฐานที่เข้าได้ | `provider` | bc_user_list, bc_database_list_user_and_group, bc_database_list | handler.go:178 |
| POST | `/users` | สร้างผู้ใช้ | `provider`,`user_code`,`user_name`,`user_password`,`user_level`,`is_active`,`email`,`allowed_databases[]` | bc_user_list + sync สิทธิ์ฐาน | handler.go:236 |
| PATCH | `/users` | แก้ชื่อ/รหัสผ่าน/ระดับ/สถานะ/อีเมล/ฐานที่เข้าได้ (ส่งเฉพาะที่จะแก้) | ฟิลด์เดียวกัน (level, is_active, email เป็น pointer) | bc_user_list, bc_database_list_user_and_group | handler.go:310 |
| DELETE | `/users?provider=&user=` | ลบผู้ใช้ | `user` | bc_database_list_user_and_group, bc_user_and_group, bc_user_list | handler.go:414 |
| GET | `/databases?provider=` | รายการฐานบริษัท | - | bc_database_list | handler.go:429 |
| POST | `/databases` | เพิ่มฐานในรายการ + ให้สิทธิ์ผู้ดูแลเริ่มต้น | `provider`,`data_code`,`data_name`,`data_database_name`,`data_group` (ค่าเริ่มต้น MAIN) | bc_database_list, bc_database_list_user_and_group | handler.go:467 |
| PATCH | `/databases` | แก้ชื่อ/ฐานของรายการ (ใน transaction) | ฟิลด์เดียวกัน | bc_database_list | handler.go:517 |
| DELETE | `/databases?provider=&database=` | ลบรายการฐาน (ไม่ drop ฐานจริง) | `database` | bc_database_list | handler.go:580 |
| GET | `/database-info?provider=` | สถิติต่อฐาน: จำนวนพนักงาน, มีข้อมูลบริษัทไหม, จำนวน option | `provider` | bc_database_list + ตารางของแต่ละฐาน | handler.go:593 |
| POST | `/main-query` | รัน SQL บนฐาน auth หรือฐานที่ระบุ | `provider`,`database`,`sql`,`mode` | ตามที่ SQL ระบุ | handler.go:646 |
| GET | `/menu-permissions` | อ่านสิทธิ์เมนูของ user/group (หรือ tooltip) | `provider`,`database`,`kind=user|group|tooltip`,`code` | bc_permissions_user, bc_permissions_group, bc_tooltip | menu_permissions.go:46 |
| PUT | `/menu-permissions` | บันทึกสิทธิ์เมนู (แทนแถวเดิมของ user+database) | `provider`,`database`,`kind`,`code`,`menus[]` (หรือ `name_1`,`name_2` สำหรับ tooltip) | ตารางเดียวกัน | menu_permissions.go:107 |

รายละเอียดที่ควรรู้:

- **POST /users**: รหัสผู้ใช้ยาวเกิน 50 ตัว = 400 `USER_CODE_TOO_LONG`; ซ้ำ (ไม่สนตัวพิมพ์) = 409 `DUPLICATE_USER`; รหัสผ่านถูกแฮชด้วย `domainidentity.HashPassword` ก่อนเก็บ (handler.go:236-300); เมื่อ GET คืนฟิลด์ `user_code, user_name, user_level, is_active, email, allowed_databases`.
- **POST /databases**: ชื่อฐานต้องตรง `validDBNameRe` และห้ามขึ้นต้น `bcerpmain` (400); ชื่อซ้ำ 409 `INSERT_DB_ERROR` (handler.go:467-515).
- **POST /providers**: สร้างฐาน auth ถ้ายังไม่มี แล้วลงทะเบียน provider; ซ้ำ/ล้มเหลว = 409 `CREATE_PROVIDER_ERROR` (handler.go:113-163) — ต่างจาก `POST /admin/providers` ใน [[api-tenant]] ที่รับ connection จาก body และทดสอบก่อน.
- **POST /main-query**: `mode:"exec"` ผ่าน `NewWriteStatement` (DML เดี่ยว) คืน `{rowsAffected}`; โหมดอื่นผ่าน `NewStatement` (SELECT/WITH) ใน transaction แบบ read-only REPEATABLE READ คืนอาร์เรย์แถว; SQL ผิด 400 `INVALID_SQL`, รันพัง 400 `QUERY_ERROR`/`EXEC_ERROR`. ถ้า SQL อ้าง `bc_tooltip` แต่ไม่ระบุ `database` จะ resolve ฐานบริษัทเอง (handler.go:646-720). กฎ SQL เดียวกับ [[api-query-gateway]] / [[api-query-exec]].
- **menu-permissions**: `kind=user|group` (ตาราง `bc_permissions_user` / `bc_permissions_group`), รหัสยาวเกิน 100 ตัว = 400 `INVALID_INPUT`; GET คืน `{code, menus:[...]}` (ถอดรหัส XML เก่าของ desktop หรือ JSON ใหม่ เป็นรูปเดียวกัน); PUT จำกัดบอดี้ 1 MB (`MaxBytesReader`, menu_permissions.go:117), ไม่พบ user/group = 404 `NOT_FOUND`; `kind=tooltip` อ่าน/เขียน `bc_tooltip` (code, name_1, name_2). ความหมายของสิทธิ์เมนูดู [[be-menu-rights-permission]].
- ตัวอย่าง:

```json
POST /api/v1/admin/users   (X-Admin-Api-Key: <adminKey>)
{"provider":"<provider>","user_code":"<userCode>","user_name":"<ชื่อ>","user_password":"<password>","user_level":1,"is_active":true,"email":"<email>","allowed_databases":["<dbName>"]}
```

## ผู้เรียกฝั่งหน้าเว็บ

Next route อยู่ใต้ `src/app/api/admin/` และเรียก `proxyToService` ซึ่งแนบกุญแจให้ (api-server.ts:402,510):

| Next route | ไปที่ Go | หน้าจอที่เรียก |
|---|---|---|
| `/api/admin/providers` (route.ts:27,40,76,108) | `/api/v1/admin/providers` | `account/admin/ProvidersTab.tsx:53`, `src/hooks/useProviders.ts:22` |
| `/api/admin/users` (route.ts:38,59) | `/api/v1/admin/users` | `account/admin/screens/ChangePasswordScreen.tsx:40,66`, `DataAccessScreen.tsx:26,74,88` |
| `/api/admin/databases` (route.ts:33,51,94,126) | `/api/v1/admin/databases` | `account/admin/DatabasesTab.tsx:40,57,78`, `DataGroupsScreen.tsx:24,58` |
| `/api/admin/database-info` (route.ts:31) | `/api/v1/admin/database-info` | `account/admin/screens/DatabaseInfoScreen.tsx:17` |
| `/api/admin/main-query` (route.ts:10) | `/api/v1/admin/main-query` | `account/admin/screens/ExtraAdminScreens.tsx:60,65,92,112,119` |
| `/api/admin/menu-permissions` (route.ts:14,29) | `/api/v1/admin/menu-permissions` | `account/admin/screens/ExtraAdminScreens.tsx:279,293` (tooltip), `456,485` (สิทธิ์ user/group) |
| `/api/admin/reset` (route.ts:7) | ไม่ยิง Go (รีเซ็ตข้อมูล mock) | `account/admin/MockResetButton.tsx:26` |

ฟังก์ชันที่ใช้ `demoSafe` ป้องกันโหมดสาธิตไม่ให้แก้ข้อมูลจริง. เส้นทาง `POST /api/auth/change-password` (ดู [[api-auth-login]]) เรียก `PATCH /api/v1/admin/users` แทนผู้ใช้เองหลังตรวจรหัสเดิม.

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/router.go:211-250`
- `backend/internal/adapter/inbound/http/admin/handler.go:36-85` (pool/response helpers), `88-176` (providers), `178-425` (users), `429-600` (databases), `593-640` (database-info), `646-722` (main-query)
- `backend/internal/adapter/inbound/http/admin/menu_permissions.go:16-30,46-103,107-215`
- `frontend/src/app/api/admin/*/route.ts`; `frontend/account/admin/**`
