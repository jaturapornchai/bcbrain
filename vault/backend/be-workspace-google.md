---
title: "Workspace Google: ล็อกอินด้วยอีเมล สร้างบริษัทใหม่ สมาชิก และผูก LINE (Workspace Google API)"
tags: [backend, admin, workspace, google, line, multi-tenant]
aliases: ["workspace/google-login", "workspace/select-db", "bc_google_workspace_member", "bc_google_workspace_db", "bc_google_account", "cloneEmptySchemaFromTemplate", "line-binding", "my-screen-rights", "สร้างฐานข้อมูลบริษัทใหม่"]
sources: ["backend/internal/adapter/inbound/http/admin/workspace_google.go:36", "backend/internal/adapter/inbound/http/admin/workspace_google.go:91", "backend/internal/adapter/inbound/http/admin/workspace_google.go:263", "backend/internal/adapter/inbound/http/admin/workspace_google.go:395", "backend/internal/adapter/inbound/http/admin/workspace_google.go:533", "backend/internal/adapter/inbound/http/admin/workspace_google.go:674", "backend/internal/adapter/inbound/http/router.go:237"]
---

# Workspace Google (`/api/v1/admin/workspace/*`)

ชุด 11 route ที่ให้ผู้ใช้ "ล็อกอินด้วยอีเมล Google" แล้วเลือก/สร้างบริษัท (ฐานข้อมูล) ของตนเอง, เชิญสมาชิกด้วยอีเมล, ขอดูสิทธิ์หน้าจอ และผูกบัญชี LINE. อยู่ใต้ `AdminAuth` (กุญแจ `X-Admin-Api-Key`) เหมือน Admin API ส่วนอื่น ([[be-admin-api]]).

## ทำงานอย่างไร

1. **ตารางที่ใช้** (สร้างด้วย `ensureWorkspaceTables` ทุกครั้งที่ handler เรียก, `workspace_google.go:36-76`; ผลถูกกลืน): `bc_google_account` (PK `email`, `google_sub`, `display_name`, `picture_url`, `line_user_id`, `line_display_name`, `line_linked_at`), `bc_google_workspace_db` (PK `database_name`, `data_code`, `company_name`, `owner_email`, `provider_code`), `bc_google_workspace_member` (PK `database_name`+`email`, `role`, `mapped_user_code`, `invited_by_email`) และเติมคอลัมน์ `email`, `line_user_id` ให้ `bc_user_list`. อยู่ใน Main DB ของ Provider ([[be-multi-tenant]]); Provider ว่าง = `bcdemo` (ค่า default ในทุก handler).
2. `POST /workspace/google-login` (`:263`): ต้องมี `email` ที่มี `@`; upsert `bc_google_account` (เก็บ `google_sub`/ชื่อ/รูปเฉพาะค่าที่ไม่ว่าง) แล้วคืนรายการบริษัทที่เข้าถึงได้.
3. `queryAccessibleWorkspaceDatabases` (`:91`) รวมบริษัทจาก 3 แหล่ง แล้ว merge ตามชื่อฐาน (role ADMIN ชนะ), ข้ามชื่อขึ้นต้น `bcerpmain`:
   - (1) `bc_google_workspace_member` ตามอีเมล — role `MEMBER` ต้องผูก `bc_user_list` ที่ active (ตาม `mapped_user_code` หรือหาจาก `email`) ไม่งั้นถูกข้าม.
   - (2) `bc_user_list.email` ตรงอีเมล + มีสิทธิ์เข้าบริษัทใน `bc_database_list_user_and_group` (`user_or_group_status=0`); role = ADMIN ถ้า `user_level >= 9`.
   - (3) ถ้าส่ง `user_code`: บริษัทที่ผู้ใช้ได้สิทธิ์ตรง; role ADMIN ถ้า level ≥ 9 หรือรหัส `SUPERADMIN`/`admin`; บริษัทที่ Google-owner เป็นคนอื่นจะไม่รั่วให้ เว้นแต่ผู้ใช้ถูกเชิญ/ผูกอยู่ในตารางสมาชิก.
4. `GET /workspace/databases` ใช้ฟังก์ชันเดียวกัน (query `email`, `user_code`); `GET /workspace/check-db-name?name=` เรียก `checkDatabaseNameAvailable` (`:343`).
5. **กติกาชื่อฐานข้อมูล** (`:19,345-373`): `^[a-z][a-z0-9_]{2,40}$` (ตัวพิมพ์เล็ก) , ห้ามอยู่ใน `reservedDBs` (`:20-33` เช่น `postgres`, `template0/1`, `bcdemo`, `default`, `admin`, `system`, `public`), ห้ามขึ้นต้น `bcerpmain` หรือ `pg_`, ห้ามซ้ำกับ `bc_database_list`/`bc_google_workspace_db` (ชื่อหรือ `data_code`) และห้ามมีอยู่แล้วใน `pg_database` ของเซิร์ฟเวอร์ → ไม่ผ่าน = 409 `DB_NAME_TAKEN`.
6. `POST /workspace/databases` (`:533`) สร้างบริษัทใหม่ 3 ขั้น:
   - ต้องมี `owner_email` (หรือ `email`; ถ้าไม่มีแต่มี `user_code` จะใช้ `user_code` พิมพ์เล็กแทน) ไม่งั้น 400 `MISSING_OWNER`; ชื่อบริษัทว่าง = `กิจการ <ชื่อฐานพิมพ์ใหญ่>`; `data_code` ว่าง = ชื่อฐานพิมพ์ใหญ่.
   - `CREATE DATABASE ... ENCODING 'UTF8'` บนฐาน `postgres` ของ Provider (`:597`) แล้ว `cloneEmptySchemaFromTemplate` ภายใต้ timeout 45 วินาที (`:604`).
   - ลงทะเบียนใน Main DB: แถว `bc_database_list` (group `MAIN`), สิทธิ์เข้าบริษัท, แถว `bc_google_workspace_db` และสมาชิก ADMIN. ผลของการลงทะเบียนถูกกลืน (`_, _ =`).
7. `cloneEmptySchemaFromTemplate` (`:395-531`): อ่านโครงตารางทั้งหมดใน schema `public` ของฐานแม่แบบ **`bcdemo`** จาก catalog (`pg_attribute`, `pg_constraint`) แล้ว `CREATE TABLE IF NOT EXISTS` ทีละตารางในฐานใหม่ (ถ้าพังใช้ DDL แบบพื้นฐานแทน), คัดลอก PRIMARY KEY/UNIQUE, แล้ว seed เฉพาะ `erp_option` (ทศนิยม 2 ตำแหน่ง), `erp_company_profile` (ชื่อบริษัท สาขา 00000 "สำนักงานใหญ่") และผู้ใช้ `erp_user` เริ่มต้น — **ไม่คัดลอกข้อมูลและไม่คัดลอก index/FK/view/function** (คัดเฉพาะ PK/UNIQUE; ส่วนอื่นยังไม่ยืนยันว่ามีที่อื่นสร้างให้หรือไม่).
8. `POST /workspace/select-db` (`:674`): รับชื่อบริษัท (`database_name|database_code|database`) แล้วหา `chosen` จากรายการที่เข้าถึงได้ ไม่เจอ → 403; จากนั้นเรียก `tokens.IssueSession` (`:808`) ออก access/refresh token ของบริษัทนั้นพร้อม `level` ([[be-jwt-session-tokens]]).
9. **สมาชิก**: `GET /workspace/members?database=` คืนสมาชิก + สถานะ LINE + รายชื่อ `bc_users` ที่ active (ให้แอดมินเลือกผูก); `POST /workspace/members` (`:972`) และ `DELETE /workspace/members` (`:1096`) ต้องผ่าน `isDatabaseAdmin` (`:839`) — ตรวจจาก role ในตารางสมาชิก / `owner_email` / `user_level >= 9` / รหัส `SUPERADMIN|admin`. Upsert สร้าง `mapped_user_code`, สร้าง `bc_user_list` ถ้ายังไม่มี, เพิ่มสิทธิ์เข้าบริษัท และซิงก์อีเมลไป `erp_user` ในฐานบริษัท.
10. `GET /workspace/my-screen-rights` (`:1195`): ถ้าเป็น Database Admin (`isDatabaseAdmin`) → `{"is_admin":true,"menus":[]}`; ไม่งั้นหา `mapped_user_code` จากอีเมลแล้วรวม `image_file` ของ user + กลุ่มโดย **รวมรายรหัสเมนู (OR ต่อเมนู)** ด้วย `loadMergedMenuRightsForUser` (`:1129`) → `{"is_admin":false,"menus":[...]}` ([[be-menu-rights-permission]]).
11. **LINE**: `GET /workspace/line-binding` (`:1256`) แปลงอีเมล ↔ `line_user_id` (จาก `bc_google_account` ก่อน แล้ว `bc_user_list`) พร้อมรายชื่อพนักงานและสถานะผูก LINE ของบริษัท; `POST /workspace/line-binding` (`:1368`) ผูก/ยกเลิก (`unbind`) — ผูกได้เมื่อเป็นบัญชีของตัวเองหรือผู้เรียกเป็น Database Admin; การผูกใหม่จะล้าง `line_user_id` เดิมที่ซ้ำกับบัญชีอื่น แล้วเขียนทั้ง `bc_google_account`, `bc_user_list` และ `erp_user` (เพิ่มคอลัมน์ `line_user_id`) ในฐานบริษัท.

## ข้อควรระวัง

- มีประเด็นด้านความปลอดภัยที่ทีมพัฒนาต้องตรวจ (ไม่เผยแพร่รายละเอียดบนเว็บสาธารณะ)
- การสร้างบริษัทไม่ atomic: ถ้า `CREATE DATABASE` สำเร็จแต่ clone ล้ม ฐานจริงค้างอยู่โดยไม่มีแถวลงทะเบียน (ไม่พบขั้นตอน rollback/DROP ในโค้ด).
- ฐานแม่แบบถูกกำหนดตายตัวเป็น `bcdemo` ของ Provider ที่เรียก (`:396`) — ถ้า Provider นั้นไม่มีฐานนี้ ฟังก์ชันคืน error (`:398`) และการสร้างบริษัทล้ม (ยังไม่ยืนยันพฤติกรรมตอนเปิด pool ฐานที่ไม่มีอยู่จริง).
- ทุก handler รัน `CREATE TABLE/ALTER TABLE IF NOT EXISTS` ซ้ำทุกคำขอ และกลืน error — ถ้าผู้ใช้ DB ไม่มีสิทธิ์ DDL ตารางจะไม่ถูกสร้างและ query ถัดไปล้มเงียบ ๆ ([[be-db-pool-manager]]).
- `ensureWorkspaceTables` ยังถูกเรียกจาก `syncUserAllowedDatabases` ของ Admin API ([[be-admin-api]]) จึงเป็นตาราง "ของระบบ" ไม่ใช่เฉพาะ route กลุ่มนี้.

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/admin/workspace_google.go:18-76` — regex ชื่อฐาน, `reservedDBs`, ตารางที่สร้าง.
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:91-261` — `queryAccessibleWorkspaceDatabases` (3 แหล่ง).
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:263-393` — google-login, list, ตรวจชื่อ.
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:395-672` — clone แม่แบบ + สร้างบริษัท.
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:674-837` — `select-db` + ออก token.
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:839-1128` — `isDatabaseAdmin`, สมาชิก.
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:1129-1481` — สิทธิ์หน้าจอ, LINE binding.
- `backend/internal/adapter/inbound/http/router.go:237-247` — route ทั้ง 11 ตัว.

## ดูเพิ่ม

[[backend-overview]] · [[be-admin-api]] · [[be-multi-tenant]] · [[be-jwt-session-tokens]] · [[be-menu-rights-permission]] · [[be-identity-login-flow]] · [[adr-0003-per-tenant-identity]] · [[adr-index]]
