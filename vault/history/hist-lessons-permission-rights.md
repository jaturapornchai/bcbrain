---
title: "บทเรียนระบบสิทธิ์เมนู (Permission & Menu Rights)"
tags: [history, permission, rights]
aliases: ["menu rights", "RequireRight", "routeRights", "QueryRequiredRight", "perm_wh_shelf", "screenRights", "adminOnly menu"]
sources: ["git:2c273e19", "git:5f188fc3", "git:dbd2ef35", "git:0d77e6fb", "git:a264a99a", "git:6cb904f7", "git:a67dc5f0", "git:1b79fbc9", "git:13f953cc", "backend/internal/adapter/inbound/http/process/permission.go:57"]
---

## ภาพรวม
สิทธิ์เมนูแบบ C# (Read/Add/Edit/Delete/Admin) ถูกบังคับที่ backend เป็นระยะ 2026-10-19 .. 2026-10-29 แต่ละรอบพบประตูที่ยังไม่ตรวจสิทธิ์: route `/process`, SQL เขียนตรง, สิทธิ์ข้ามฐาน, ปุ่มบนจอ, คลัง/ชั้นเก็บ, รายงาน Custom SQL

## อาการ
- **P1 (2c273e19):** `/process` ไม่ตรวจสิทธิ์เมนู และจอกำหนดสิทธิ์กลุ่ม/ผู้ใช้เซฟจริงไม่ได้ (ตามข้อความ commit)
- **P2 (5f188fc3, dbd2ef35, 0d77e6fb):** ผู้มีแค่ Add เรียก `trans/save` แก้เอกสารเดิมได้ (เดิมเป็น write = Add หรือ Edit); route `barcode/format` เดียวทั้งดู/เซฟ/ลบ; `/query/exec` เขียนตารางใน allow-list โดยไม่ดู Add/Edit/Delete
- **P3 (a264a99a):** สิทธิ์ที่เซฟของรหัสผู้ใช้หนึ่งปนกันข้ามฐานข้อมูล (workspace) ของ provider เดียวกัน
- **P4 (6cb904f7, a67dc5f0):** ปุ่ม "+" ไอคอนล้วน ดินสอ ดับเบิลคลิก Insert F12 ข้ามเช็กสิทธิ์ที่ผูกกับข้อความปุ่ม; เมนูเฉพาะผู้ดูแลยังเปิดได้
- **P5 (720536ab, 1b79fbc9, 13f953cc):** `erp_option.perm_wh_shelf` ไม่ถูกใช้กับรายการเลือกคลัง/ยอดคงเหลือ/รายงานสต็อก/ref-import และผู้มีสิทธิ์ Read รันรายงาน Custom SQL อ่านตารางตรงได้

## สาเหตุ (root cause)
- P1: ไม่มีชั้น `RequireRight` ตามชนิดการกระทำ
- P2: สิทธิ์ผูกกับ route ไม่ผูกกับ "ใหม่/แก้" ใน body; ประตูเขียนบานที่สอง (query/exec, blob) ไม่มีการ์ด
- P3: การค้นหา `image_file` ไม่กรอง `database_name`
- P4: จอเช็กจากข้อความปุ่ม ไม่มี state สิทธิ์ต่อแท็บ
- P5: C# กรองที่ lookup/ค่าเริ่มต้น ยังไม่ port; Custom SQL อ่านตารางตรง ข้ามกฎรายผู้ใช้

## วิธีแก้
- **P1:** `RequireRight(loader, need)` คืน 403 ข้อความไทย; `routeRights` ต่อ `group/action`; route ที่ไม่อยู่ใน map = Admin (fail-closed); สิทธิ์ผู้ใช้กับกลุ่ม OR กัน เก็บ JSON ใน `image_file` และอ่าน XML เดิมได้
- **P2:** `itemmaster/save`, `trans/save`, `doc/save`, `pointdocsave`, `stockbeginningsave`: `isNew` => Add ไม่ใช่ => Edit (`peekJSON`); `barcode/format` ดู `action`; `QueryRequiredRight` แปลง verb SQL เป็น Add/Edit/Delete, `/blob/insert` = write
- **P3:** กรอง `database_name IN (db, '')` ใช้แถวที่ตรงฐานก่อน (`DISTINCT ON`)
- **P4:** `TabsContext.screenRights` + `useScreenRights()` จาก `/api/workspace/my-screen-rights` ซ่อน/ปิดปุ่มและกันเซฟ; `ADMIN_ONLY_MENU_SET` กรองเมนูที่ proxy workspace
- **P5:** `applyPermWhShelf` กรอง lookup, `WarehousePickAllowed`/`WarehousePermFilter` (รวม ref-import); รายงานที่ `permGuarded` ปฏิเสธ Custom SQL และ fail-closed เมื่ออ่านสิทธิ์ไม่ได้; `report/run|pdf` ที่มี `customSql` ต้อง Admin

## commit ที่เกี่ยวข้อง
- `2c273e19` — `RequireRight` บน `/process` + จอบันทึกสิทธิ์ (2026-10-19)
- `5f188fc3` — `trans/save` แยก Add/Edit ตาม isNew (2026-10-21)
- `dbd2ef35` — `barcode/format` แยกสิทธิ์ตาม action (2026-10-22)
- `720536ab`, `1b79fbc9` — perm_wh_shelf กับ lookup, สต็อก, รายงาน (2026-10-22)
- `a264a99a` — สิทธิ์แยกตาม `database_name` (2026-10-24 11:00)
- `0d77e6fb` — Add/Edit/Delete บน `/query/exec|execBatch|blob/insert` (2026-10-24 11:08)
- `6cb904f7` — `screenRights` ในจอ shared (2026-10-24)
- `a67dc5f0` — เมนู admin-only (2026-10-25)
- `13f953cc` — Custom SQL ต้อง Admin (2026-10-29)

## โค้ดปัจจุบันที่ป้องกัน
- `backend/internal/adapter/inbound/http/middleware/permission.go:41` `Allows`, `:62` `RequireRight`
- `backend/internal/adapter/inbound/http/process/permission.go:23` `routeRights`, `:57` `RequiredRight` (ไม่พบใน map = admin ที่ `:129-133`), `:138` `QueryRequiredRight`
- `backend/internal/adapter/outbound/identity/postgres_repository.go:69-109` `MenuRights` กรอง `database_name`
- `backend/internal/application/process/perm_wh_shelf.go:26,42,118`; `report.go:121,378`; `report_menu_ic.go:54-60`
- `frontend/account/tabs/TabsContext.tsx:27,66`; `frontend/src/config/bcMenu.ts:277,354`

## บทเรียน / กฎที่ได้
1. การ์ดสิทธิ์ต้อง fail-closed: route ใหม่ที่ไม่ลงทะเบียน = Admin
2. สิทธิ์ Add/Edit อยู่ใน body (`isNew`) ต้อง `peekJSON` ไม่ใช่ดูแค่ path
3. ทุกประตูเขียน (process, query, blob) ใช้การ์ดเดียวกัน ปุ่มบนจอไม่ใช่ความปลอดภัย
4. ตารางสิทธิ์ต้องมี `database_name` และเทสต์ทั้งกรณีฐานตรงและค่าว่าง
5. ฟีเจอร์ที่ข้ามกฎรายผู้ใช้ (Custom SQL) ต้อง Admin หรือถูกปฏิเสธเมื่อรายงานถูกจำกัดสิทธิ์

## ดูเพิ่ม
[[proc-permission-rights]] · [[proc-wh-shelf-permission]] · [[hist-lessons-query-gateway-write-lockdown]] · [[hist-lessons-tenant-auth-sessions]] · [[std-security-authz-and-web-vulns]] · [[history-overview]]

## ที่มาในโค้ด
- git:2c273e19, git:5f188fc3, git:0d77e6fb, git:a264a99a, git:6cb904f7, git:13f953cc
- backend/internal/adapter/inbound/http/process/permission.go:23, :57, :138
