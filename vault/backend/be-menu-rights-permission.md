---
title: "สิทธิ์เมนูและ middleware RequireRight (Menu rights / permission)"
tags: [backend, security, permission, identity, middleware]
aliases: ["RequireRight", "MenuRights", "image_file", "bc_permissions_user", "routeRights", "QueryRequiredRight", "สิทธิ์เมนู", "superadmin", "level 9"]
sources: ["backend/internal/adapter/inbound/http/middleware/permission.go:62", "backend/internal/adapter/inbound/http/process/permission.go:23", "backend/internal/adapter/inbound/http/process/permission.go:138", "backend/internal/application/identity/service.go:174", "backend/internal/adapter/outbound/identity/postgres_repository.go:69", "backend/internal/adapter/outbound/identity/menu_rights.go:48"]
---

# สิทธิ์เมนูและ middleware `RequireRight`

หลัง `Auth` ยืนยันตัวตนแล้ว บาง route ต้องมีสิทธิ์เมนูด้วย: `/process/*`, `/query/exec`, `/query/execBatch`, `/blob/insert` ([[be-http-router-routes]]). สิทธิ์โหลดสดจาก Main Database ทุกคำขอ (ไม่ฝังใน JWT) แล้วเทียบกับ "สิทธิ์ที่ route ต้องการ".

## ทำงานอย่างไร

1. `RequireRight(loader, need)` (`middleware/permission.go:62`): ดึง `SessionClaims` จาก context → `loader.MenuRights(claims)` → `need(r)` ได้ `Right` → `Allows(rights, right)`; ไม่ผ่าน → 403 พร้อมข้อความไทยของสิทธิ์นั้น ([[be-error-response-shape]]).
2. ชนิด `Right` (`permission.go:15-22`): `Read`, `Write` (= Add หรือ Edit), `Delete`, `Admin`, `Add`, `Edit`. `Allows` คืน true ทันทีถ้า `rights.Admin` (`:41-58`); `RightAdmin` ที่ผู้ใช้ไม่ใช่ Admin = ไม่ผ่านเสมอ.
3. `Service.MenuRights` (`application/identity/service.go:174`):
   - username `superadmin` (ไม่สนตัวพิมพ์) **หรือ** `level >= 9` (`webAdminLevel`, `:164`) → ได้ทุกสิทธิ์ + `Admin`.
   - นอกนั้นโหลดจาก DB (ข้อ 4) ตาม `claims.DatabaseName` — ผู้ใช้ไม่มีแถวสิทธิ์เลย = ไม่ได้อะไร.
4. `UserRepository.MenuRights` (`outbound/identity/postgres_repository.go:69`): ก่อนอ่านจะรัน `ALTER TABLE ... ADD COLUMN IF NOT EXISTS database_name` กับ `bc_permissions_user` และ `bc_permissions_group` **ทุกครั้ง** (`:74-75`) แล้ว `UNION ALL`:
   - แถวของผู้ใช้เอง: `bc_permissions_user` (`usercode`) กรอง `database_name` ตรงกับบริษัทหรือว่าง โดยให้แถวที่ตรงบริษัทมาก่อน แล้วเอา `roworder` ล่าสุด 1 แถว.
   - แถวของกลุ่มที่ผู้ใช้อยู่: `bc_permissions_group` ผ่าน `bc_user_and_group` (`group_code`/`user_code`).
5. แต่ละแถวมี blob `image_file` → `DecodeMenuRights` (`menu_rights.go:48`): ตัด BOM UTF-8; ถ้าขึ้นต้น `{` อ่านเป็น JSON `{"menus":[{"code","read","add","edit","delete"}]}`; ไม่ใช่ก็แปลงจาก XML ของ C# เดิม (`_submeid`, `_isRead`, `_isAdd`, `_isEdit`, `_isDelete`); อ่านไม่ได้ = ไม่ให้สิทธิ์.

## `/process` — แมปสิทธิ์ต่อ route

- `process/permission.go:23` `routeRights`: คีย์ `"<group>/<action>"` → สิทธิ์ (`read`/`write`/`del`/`admin`). **route ที่ไม่อยู่ในแมปต้องเป็น Admin** (`:20-22,133`) เพื่อให้ route ใหม่ล็อกไว้ก่อน.
- `RequiredRight` (`:57`) ปรับตามเนื้อหา body ผ่าน `peekJSON` (อ่าน body ไม่เกิน 1MB แล้วคืนให้ handler): เช่น `report/run` ที่มี `customSql` = Admin; `stock/rebuild` ที่ระบุ `ItemCodes` = write ไม่ระบุ = Admin; `trans/save`/`doc/save` ใช้ `IsNew` → Add / Edit; `master/datalist*` ของผู้ใช้อื่น = Admin.

## `/query/exec`, `/query/execBatch`, `/blob/insert`

`QueryRequiredRight` (`process/permission.go:138`):

| เส้นทาง | สิทธิ์ที่ต้องการ |
|---|---|
| `/blob/insert` | `Write` |
| `/query/exec` | ตามชนิดคำสั่ง: `insert`→Add, `update`→Edit, `delete`→Delete (`sqlStatementRight`) |
| `/query/execBatch` | จำแนกจากชุดคำสั่ง (`sqlBatchRight`) |
| body อ่านไม่ออก | `Write` |

นี่เป็นด่านสิทธิ์เมนู **ก่อน** นโยบายล็อกเขียนของตาราง ([[be-query-write-policy]]); ทั้งสองต้องผ่านทั้งคู่.

## จัดการสิทธิ์ (admin)

`GET/PUT /api/v1/admin/menu-permissions` (`router.go:234-235`, handler ใน `admin/menu_permissions.go:46,107`) อ่าน/เขียน `image_file` ของผู้ใช้/กลุ่ม ผ่าน `EncodeMenuRights` ที่เก็บเฉพาะเมนูที่ให้สิทธิ์อย่างน้อยหนึ่งอย่าง (`menu_rights.go:35-43`) ([[be-admin-api]]).

## ข้อควรระวัง

- `ALTER TABLE` ทุกคำขอเพิ่มภาระ/lock เล็กน้อยบน Main DB และผู้ใช้ DB ต้องมีสิทธิ์ ALTER (ผลถูกทิ้ง `_, _ =` จึงเงียบเมื่อพลาด).
- สิทธิ์เข้าบริษัท (`/auth/login`) ใช้แถวผู้ใช้ตรงเท่านั้น แต่สิทธิ์เมนูรวมกลุ่ม ([[be-identity-login-flow]]).

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/middleware/permission.go:15-86` — `Right`, `Allows`, `RequireRight`.
- `backend/internal/application/identity/service.go:162-190` — `webAdminLevel`, `MenuRights`.
- `backend/internal/adapter/outbound/identity/postgres_repository.go:69-114` — SQL สิทธิ์.
- `backend/internal/adapter/outbound/identity/menu_rights.go:9-70` — โครง JSON/XML และ decode/encode.
- `backend/internal/adapter/inbound/http/process/permission.go:23-136,138-239` — `routeRights`, `RequiredRight`, `QueryRequiredRight`, `peekJSON`.

## ดูเพิ่ม

[[backend-overview]] · [[be-query-write-policy]] · [[be-jwt-session-tokens]] · [[be-http-router-routes]] · [[adr-0011-query-exec-write-lockdown]] · [[adr-index]]
