---
title: "API Workspace — ล็อกอิน Google, เลือกฐานบริษัท, สมาชิก, สิทธิ์จอ, ผูก LINE (Admin workspace API)"
tags: [api, admin, workspace]
aliases: ["/api/v1/admin/workspace/google-login","/api/v1/admin/workspace/databases","/api/v1/admin/workspace/check-db-name","/api/v1/admin/workspace/select-db","/api/v1/admin/workspace/members","/api/v1/admin/workspace/my-screen-rights","/api/v1/admin/workspace/line-binding","/api/workspace/[...path]","WorkspaceSelectDatabase","WorkspaceCreateDatabase"]
sources: ["backend/internal/adapter/inbound/http/router.go:237","backend/internal/adapter/inbound/http/admin/workspace_google.go:263","backend/internal/adapter/inbound/http/admin/workspace_google.go:322","backend/internal/adapter/inbound/http/admin/workspace_google.go:381","backend/internal/adapter/inbound/http/admin/workspace_google.go:533","backend/internal/adapter/inbound/http/admin/workspace_google.go:674","backend/internal/adapter/inbound/http/admin/workspace_google.go:876","backend/internal/adapter/inbound/http/admin/workspace_google.go:972","backend/internal/adapter/inbound/http/admin/workspace_google.go:1096","backend/internal/adapter/inbound/http/admin/workspace_google.go:1195","backend/internal/adapter/inbound/http/admin/workspace_google.go:1256","backend/internal/adapter/inbound/http/admin/workspace_google.go:1368","frontend/src/app/api/workspace/[...path]/route.ts:67","frontend/src/app/api/auth/google/route.ts:152"]
---

# API Workspace `/api/v1/admin/workspace/*`

ชุด endpoint สำหรับโหมด "ล็อกอินด้วย Google + เลือกบริษัท" (workspace): ผู้ใช้ล็อกอินด้วยอีเมลแล้วเห็นรายชื่อฐานบริษัทที่ตนมีสิทธิ์ สร้างฐานใหม่ เชิญสมาชิก กำหนดสิทธิ์จอ และผูกบัญชี LINE. แนวคิด PDPA และตารางอยู่ที่ [[be-workspace-google]], [[std-platform-google-login-pdpa-hub]], [[tbl-bc-google-workspace]].

## สิทธิ์และรูปแบบ response

- ทุก route อยู่ใต้กลุ่ม admin หลัง `AdminAuth` (router.go:213-214; header `X-Admin-Api-Key: <adminKey>` ดู [[api-tenant]]) — ตัวตนผู้เรียกมาจาก session ที่ Next ใส่ให้
- response ใช้ envelope ของกลุ่ม admin: สำเร็จ `{"ok":true,"data":...}`, ล้มเหลว `{"ok":false,"error":"<ข้อความไทย>","code":"<CODE>"}` (admin/handler.go:69-85, ดู [[api-admin-console]])
- เปิดฐาน provider ไม่ได้ = `writePoolErr` (400 `INVALID_PROVIDER` / 500 `DB_CONNECT_ERROR`)
- ทุก handler เรียก `ensureWorkspaceTables` ก่อน (สร้างตาราง workspace ถ้ายังไม่มี)

## ตาราง endpoint

| method | path | หน้าที่ | input สำคัญ | ตาราง | handler |
|---|---|---|---|---|---|
| POST | `/workspace/google-login` | บันทึก/อัปเดตบัญชี Google แล้วคืนฐานที่เข้าได้ | body: `provider`,`email`,`google_sub`,`display_name`,`picture_url` | bc_google_account + ตารางสมาชิก | workspace_google.go:263 |
| GET | `/workspace/databases` | รายชื่อฐานที่อีเมล/user_code เข้าได้ | query: `provider`,`email`,`user_code` | bc_google_workspace_member/db, bc_database_list | :322 |
| GET | `/workspace/check-db-name` | ตรวจว่าชื่อฐานใหม่ใช้ได้ไหม | query: `provider`,`name` | bc_database_list, bc_google_workspace_db, pg_database | :381 |
| POST | `/workspace/databases` | สร้างฐานบริษัทใหม่ (CREATE DATABASE + คัดลอกโครงตาราง) | body: `provider`,`database_name`/`database_code`,`data_code`,`company_name`/`data_name`,`owner_email`/`email`,`user_code` | pg_database, bc_database_list, bc_database_list_user_and_group, bc_google_workspace_db/member | :533 |
| POST | `/workspace/select-db` | เลือกฐานแล้วออก token เข้าใช้งาน | body: `provider`,`database_name`/`database_code`/`database`,`email`,`user_code`,`is_demo` | bc_user_list, bc_database_list_user_and_group | :674 |
| GET | `/workspace/members` | รายชื่อสมาชิกของฐาน + ผู้ใช้ BC ที่จับคู่ได้ | query: `provider`,`database` | bc_google_workspace_member, bc_user_list | :876 |
| POST | `/workspace/members` | เพิ่ม/แก้บทบาทสมาชิก (เฉพาะ Admin ของฐาน) | body: `provider`,`database_name`,`email`,`role`(`ADMIN`/`MEMBER`),`mapped_user_code`,`user_name`,`actor_email`,`actor_user_code` | bc_google_workspace_member, bc_user_list, bc_database_list_user_and_group, erp_user | :972 |
| DELETE | `/workspace/members` | ลบสมาชิก (เฉพาะ Admin ของฐาน) | query: `provider`,`database`,`email`,`actor_email`,`actor_user_code` | bc_google_workspace_member | :1096 |
| GET | `/workspace/my-screen-rights` | สิทธิ์จอของผู้เรียก (รวมสิทธิ์ user + กลุ่ม) | query: `provider`,`database`,`user_code`,`role`,`email` | bc_permissions_user, bc_permissions_group | :1195 |
| GET | `/workspace/line-binding` | ดูการผูก LINE ของอีเมล/LINE ID | query: `provider`,`database`,`line_user_id`,`email` | bc_google_account, bc_user_list | :1256 |
| POST | `/workspace/line-binding` | ผูก/ยกเลิกผูก LINE กับอีเมล | body: `provider`,`database_name`,`email`,`line_user_id`,`line_display_name`,`unbind`,`actor_email`,`actor_user_code` | bc_google_account, bc_user_list, erp_user | :1368 |

หมายเหตุ: สิทธิ์จอแบบแก้ไข (`screen-rights`) ไม่มี route ใต้ `/workspace` ฝั่ง Go — Next catch-all เปลี่ยนเส้นไปเรียก `menu-permissions` ของ [[api-admin-console]] (ดูหัวข้อ Next ด้านล่าง).

## รายละเอียดที่ควรรู้

- **google-login** (:263-319): `email` ต้องมี `@` ไม่งั้น 400 `INVALID_EMAIL`; body ผิด 400 `BAD_JSON`; ทำ upsert `bc_google_account` (อัปเดต `last_login_at`) แล้วคืน `{email, display_name, picture_url, provider, databases[]}`; ดึงฐานล้มเหลว 500 `LIST_DB_ERROR`. **ไม่ออก token** ที่นี่ ต้องเรียก `select-db` ต่อ
- **รายการฐาน** (`workspaceDBItem`, :78): `database_name`, `data_database_name`, `data_code`, `company_name`, `data_name`, `data_group`, `role` (`ADMIN`/`MEMBER`), `mapped_user_code`, `owner_email`, `member_count`
- **check-db-name** (:343-398): ชื่อต้องตรง `^[a-z][a-z0-9_]{2,40}$` (`customDBNameRe`, :19) และไม่ชนชื่อสงวน (`reservedDBs`), ไม่ขึ้นต้น `bcerpmain` หรือ `pg_`, ไม่ซ้ำใน `bc_database_list`/`bc_google_workspace_db` และไม่มีใน `pg_database`; คืน `{database_name, available, message}` เสมอ 200 (ผลไม่ผ่านดูที่ `available:false`)
- **สร้างฐาน** (:533-672): ตรวจชื่อด้วย check เดียวกัน (ไม่ผ่าน 409 `DB_NAME_TAKEN`); ไม่มีผู้สร้าง 400 `MISSING_OWNER`; `CREATE DATABASE` ล้มเหลว 409 `CREATE_PG_DB_ERROR`; คัดลอกโครงตารางว่างจากฐานต้นแบบ (`cloneEmptySchemaFromTemplate`, :395) ล้มเหลว 500 `CLONE_SCHEMA_ERROR`; ลงทะเบียน `bc_database_list` (กลุ่มข้อมูล `MAIN`), ให้สิทธิ์ผู้ใช้ผู้ดูแลเริ่มต้น และเพิ่มผู้สร้างเป็น `ADMIN`; คืน `workspaceDBItem` ของฐานใหม่
- **select-db** (:674-870): ต้องเลือกฐาน (400 `MISSING_DB`); ฐานต้องอยู่ในรายการที่เข้าได้ของอีเมล/user_code ไม่งั้น 403 (ข้อความ PDPA Access Denied); เพิ่มสิทธิ์ใน `bc_database_list_user_and_group` ถ้ายังไม่มี; ADMIN = level 9, MEMBER ที่ล็อกอินด้วยอีเมล = level 0; ออก token ด้วย `IssueSession` (claims: provider, username, data_group, company_code, database_name, level) — ล้มเหลว 500 `ISSUE_TOKEN_ERROR` / `NO_TOKEN_SERVICE`
- **select-db response**: `{access_token, refresh_token, provider, database, database_name, data_database_name, data_code, company_name, data_group, user_code, user_name, user_level, role, email}` (:821-835). token ที่ได้ใช้กับ `Authorization: Bearer <token>` ของ API ทั่วไป ([[api-auth-login]])
- **members GET** (:876-970): `database` ว่าง 400 `MISSING_DB`; คืน `{database_name, members[{email,role,mapped_user_code,invited_by_email,created_at,line_user_id,line_display_name,line_linked_at}], bc_users[{user_code,user_name,user_level,email}]}` เรียง ADMIN ก่อน
- **members POST/DELETE**: ผู้เรียกต้องเป็น Admin ของฐานตาม `isDatabaseAdmin` (:839) ไม่งั้น 403 ข้อความ "เฉพาะผู้ดูแลฐานข้อมูล (Admin) เท่านั้น…"; `email`/ฐานไม่ถูกต้อง 400 `INVALID_INPUT`; บทบาทที่ไม่ใช่ `ADMIN` ถูกปรับเป็น `MEMBER`; ตอบ POST `{database_name,email,role,mapped_user_code}`, DELETE `{deleted,database_name}`
- **my-screen-rights** (:1195-1255): ADMIN ได้ `{is_admin:true, role:"ADMIN", user_code, menus:[]}` (menus ว่าง = ผ่านทั้งหมด); สมาชิกทั่วไปได้ `{is_admin:false, role:"MEMBER", user_code, menus:[...]}` จาก `loadMergedMenuRightsForUser` (รวมสิทธิ์ user + กลุ่ม). ความหมายสิทธิ์เมนูดู [[be-menu-rights-permission]]
- **line-binding GET** (:1256-1367): คืน `{email, line_user_id, line_display_name, line_linked_at, databases[], staff_bindings[{email,user_code,user_name,role,line_user_id,...}]}`
- **line-binding POST** (:1368-1470): อีเมลไม่ถูกต้อง 400 `INVALID_EMAIL`; ผูกกับอีเมลของตนเอง หรือเป็น Admin ของฐานเท่านั้น ไม่งั้น 403; ผูกต้องมี `line_user_id` (400 `MISSING_LINE_ID`); `unbind:true` เคลียร์ค่า; LINE ID เดิมที่ผูกกับอีเมลอื่นจะถูกปลดออกก่อน; DB ล้มเหลว 500 `BIND_LINE_ERROR`

## ตัวอย่าง

```json
POST /api/v1/admin/workspace/select-db   (X-Admin-Api-Key: <adminKey>)
{"provider":"<provider>","email":"<email>","user_code":"<userCode>","database_name":"<dbName>","database_code":"<dbName>"}
```

```json
POST /api/v1/admin/workspace/members   (X-Admin-Api-Key: <adminKey>)
{"provider":"<provider>","database_name":"<dbName>","email":"<memberEmail>","role":"MEMBER","mapped_user_code":"<userCode>","actor_email":"<adminEmail>","actor_user_code":"<adminUserCode>"}
```

## ผู้เรียกฝั่งหน้าเว็บ

Next route เดียวแบบ catch-all `src/app/api/workspace/[...path]/route.ts` (ฟังก์ชัน GET :67, POST :193, PUT :369, DELETE :409) — runtime nodejs, ตรวจ `getSession()` ก่อน (ไม่มี session = 401 `NO_SESSION`), ต้องมี admin key ฝั่ง Next ไม่งั้น `adminApiKeyMissing()` (503) ยกเว้น `my-screen-rights` ของ ADMIN/สาธิตที่ตอบเองได้, sub-path ที่ไม่รู้จัก = 404. provider ใช้จาก session เสมอ ไม่รับจากเบราว์เซอร์.

| Next sub-path | method | ไปที่ Go | หมายเหตุ |
|---|---|---|---|
| `databases` | GET (:85) / POST (:208) | `workspace/databases` | POST สร้าง `owner_email` จากอีเมลใน session เสมอ |
| `check-db-name` | GET (:102) | `workspace/check-db-name` | |
| `select-db` | POST (:246) | `workspace/select-db` | รับ token แล้ว `setSession` เขียน session ใหม่ (ฐาน, role, level, token) ให้ — เบราว์เซอร์ไม่เห็น token ตรง |
| `members` | GET (:116) / POST (:336) / DELETE (:424) | `workspace/members` | ตรวจ `isWorkspaceAdmin` (GET) และใส่ `actor_email`/`actor_user_code` จาก session (POST/DELETE) — ผู้เรียกปลอม actor ไม่ได้ |
| `screen-rights` | GET (:134) / PUT (:384) | `/api/v1/admin/menu-permissions` | ต้องเป็น Admin; PUT กรองเมนู admin-only ออกด้วย `isAdminOnlyMenu` |
| `my-screen-rights` | GET (:156) | `workspace/my-screen-rights` | session สาธิต/ADMIN/level>=9 ตอบ `is_admin:true` เองโดยไม่เรียก Go; สมาชิกทั่วไปถูกกรองเมนู admin-only ออก |

`isWorkspaceAdmin` (route.ts:25-60): session สาธิตไม่ผ่าน; ADMIN/level>=9 ของฐานเดียวกับ session ผ่าน; นอกนั้นเรียก `workspace/databases` แล้วหา role `ADMIN` ของฐานนั้น.

ผู้เรียกอื่น:

- `POST /api/auth/google` -> `workspace/google-login` ผ่านฟังก์ชันใน `src/app/api/auth/google/route.ts:152`
- `/api/lineoa` -> `workspace/line-binding` GET (`src/app/api/lineoa/route.ts:261`) และ POST (:618) — ดู [[api-ops-health-monitormap]]
- หน้าจอ: `src/app/select-database/page.tsx` (check-db-name :203, select-db :224, databases :286, members :329/:362/:395/:417, screen-rights :434/:551); แท็บทำงาน `account/tabs/TabWorkspace.tsx:267` (my-screen-rights) ดู [[fe-tabs-workspace]]; Next route ทั่วไปดู [[fe-api-proxy-routes]], session ดู [[fe-auth-session]]

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/router.go:237-247`
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:19-24` (regex/ชื่อสงวน), `78-89` (workspaceDBItem), `263-319` (google-login), `322-338` (list), `343-398` (check name), `395` (clone schema), `533-672` (create), `674-870` (select-db), `839` (isDatabaseAdmin), `876-1095` (members), `1096-1127` (delete member), `1195-1255` (my-screen-rights), `1256-1367` (line-binding GET), `1368-1470` (line-binding POST)
- `frontend/src/app/api/workspace/[...path]/route.ts:25-60,67-190,193-367,369-407,409-447`
- `frontend/src/app/api/auth/google/route.ts:140-175`; `frontend/src/app/api/lineoa/route.ts:261,618`
- `frontend/src/app/select-database/page.tsx:203-551`; `frontend/account/tabs/TabWorkspace.tsx:267`
