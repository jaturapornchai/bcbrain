---
title: "บทเรียนระบบสิทธิ์เมนู (Permission & Menu Rights)"
tags: [history, lesson, permission, rights, security]
aliases: ["menu rights", "RequireRight", "routeRights", "QueryRequiredRight", "perm_wh_shelf", "screenRights", "adminOnly menu", "Custom SQL guard"]
sources: ["backend/internal/adapter/inbound/http/middleware/permission.go:41", "backend/internal/adapter/inbound/http/middleware/permission.go:62", "backend/internal/adapter/inbound/http/process/permission.go:23", "backend/internal/adapter/inbound/http/process/permission.go:57", "backend/internal/adapter/inbound/http/process/permission.go:132", "backend/internal/adapter/inbound/http/process/permission.go:138", "backend/internal/adapter/inbound/http/process/permission.go:184", "backend/internal/adapter/inbound/http/process/permission_test.go:36", "backend/internal/adapter/inbound/http/process/permission_test.go:107", "backend/internal/adapter/inbound/http/router.go:129", "backend/internal/adapter/inbound/http/router.go:170", "backend/internal/adapter/outbound/identity/postgres_repository.go:69", "backend/internal/application/identity/service.go:174", "backend/internal/application/process/perm_wh_shelf.go:42", "backend/internal/application/process/report.go:378", "backend/internal/application/process/report_menu_ic.go:54", "backend/internal/application/process/perm_wh_shelf_rest_test.go:62", "frontend/account/tabs/TabsContext.tsx:64", "frontend/account/tabs/TabWorkspace.tsx:625", "frontend/src/config/bcMenu.ts:315"]
---

# ระบบสิทธิ์เมนู (Read / Add / Edit / Delete / Admin)

สิทธิ์ของผู้ใช้ถูกบังคับที่ backend ทุกประตูที่เขียนหรืออ่านข้อมูลสำคัญ ส่วนปุ่มบนจอเป็นแค่ตัวช่วยให้ผู้ใช้เห็นว่ากดอะไรได้ ไม่ใช่ความปลอดภัย บันทึกนี้เก็บเฉพาะด่านที่ยังเห็นในโค้ดวันนี้ และกฎที่ทำให้ route ใหม่ไม่หลุดการตรวจสิทธิ์

## อะไรพังได้
- **route ใหม่ไม่มีใครจัดประเภทสิทธิ์:** ถ้า route ที่ไม่อยู่ในตาราง "ปล่อยผ่าน" ผู้ใช้ระดับต่ำเรียกงานประมวลผลทั้งฐานได้
- **สิทธิ์ Add/Edit ซ่อนอยู่ใน body:** `trans/save` route เดียวใช้ทั้งเอกสารใหม่และแก้เอกสารเดิม ถ้าดูแค่ path ผู้มีสิทธิ์ Add อย่างเดียวจะแก้เอกสารเดิมได้
- **route เดียวทำหลาย action:** `barcode/format` ทั้งดู บันทึก ลบ ในที่เดียว
- **ประตูเขียนบานที่สอง:** `/query/exec`, `/query/execBatch`, `/blob/insert` เขียนข้อมูลตรง ถ้าไม่ตรวจ Add/Edit/Delete จะข้ามสิทธิ์ของหน้าจอ
- **สิทธิ์ข้ามฐานข้อมูล:** รหัสผู้ใช้เดียวกันมีสิทธิ์ต่างกันในแต่ละฐานข้อมูล (workspace) ถ้าค้นสิทธิ์โดยไม่กรอง `database_name` สิทธิ์จะปนกัน
- **Custom SQL ข้ามกฎรายผู้ใช้:** รายงานที่ผู้ใช้แก้ SQL เองอ่านตารางตรง ข้ามการกรองคลัง/ที่เก็บและการซ่อนต้นทุน
- **ปุ่มบนจอเป็นด่านเดียว:** ถ้ากันแค่ที่ปุ่ม คำขอ API ตรงๆ ผ่านได้

## โค้ดป้องกันไว้อย่างไร
| ด่าน | ที่อยู่ | ทำอะไร |
|---|---|---|
| ตัวตรวจสิทธิ์ | `backend/internal/adapter/inbound/http/middleware/permission.go:41` `Allows`, `:62` `RequireRight` | ตอบ 403 ข้อความไทยตามชนิดสิทธิ์ (`RightRead/Write/Delete/Admin/Add/Edit`); ผู้ดูแล (`Admin`) ผ่านทุกด่าน |
| ผู้ดูแลระบบ | `backend/internal/application/identity/service.go:174` `MenuRights` | ผู้ใช้ `superadmin` หรือระดับ ≥ 9 ได้สิทธิ์เต็ม นอกนั้นโหลดจากฐานข้อมูลของ tenant |
| ต่อเข้ากับ route | `backend/internal/adapter/inbound/http/router.go:129,170` (`/process`, `/api/v1/process`), `:87,96-97,107-108` (`/query` กลุ่มเขียน, `/blob`) | `RequireRight(..., processhttp.RequiredRight)` และ `QueryRequiredRight` ครอบหลัง `Auth` |
| ตาราง route → สิทธิ์ | `backend/internal/adapter/inbound/http/process/permission.go:23` `routeRights` | จับคู่ `group/action` กับสิทธิ์; comment ที่ตารางบอกว่า route ที่ไม่อยู่ในตารางต้อง Admin |
| fail-closed | `process/permission.go:129-133` | หา route ไม่เจอใน map → `admin` |
| สิทธิ์ที่ขึ้นกับ body | `process/permission.go:57` `RequiredRight` + `peekJSON` | `itemmaster/save`, `trans/save`, `doc/save`, `stocktools/pointdocsave`, `stocktools/stockbeginningsave`: `isNew` → Add ไม่ใช่ → Edit (`:81-87`); `barcode/format` แยกตาม `action` (`:102-111`) |
| Custom SQL ต้อง Admin | `process/permission.go:60-66` | `report/run`, `report/pdf` ที่มี `customSql` → Admin มิฉะนั้นใช้ Read |
| สิทธิ์ของ SQL ตรง | `process/permission.go:138` `QueryRequiredRight`, `:171` `sqlStatementRight`, `:184` `sqlBatchRight` | แปลง verb ของ SQL (`insert`→Add, `update`→Edit, `delete`→Delete) และ `/blob/insert` → write |
| สิทธิ์แยกตามฐานข้อมูล | `backend/internal/adapter/outbound/identity/postgres_repository.go:69-109` `MenuRights` | กรอง `database_name` ที่ตรงหรือว่าง ใช้แถวที่ตรงฐานก่อน (`DISTINCT ON`) แล้วรวม (OR) สิทธิ์ของผู้ใช้กับกลุ่ม |
| จำกัดคลัง/ที่เก็บ | `backend/internal/application/process/perm_wh_shelf.go:42` `applyPermWhShelf`, `:118` `WarehousePickAllowed`; `perm_wh_shelf_rest.go:25` `WarehousePermFilter` | เมื่อ `erp_option.perm_wh_shelf = 1` ตัวเลือกคลัง/ที่เก็บถูกกรองตามกลุ่มผู้ใช้ |
| Custom SQL ถูกปฏิเสธเมื่อรายงานจำกัดสิทธิ์ | `backend/internal/application/process/report.go:378` `customSQLRefusal`, `report.go:121` `permGuarded`, `report_menu_ic.go:54-60` | อ่านสิทธิ์คลังไม่ได้หรือถูกปฏิเสธ → ยังถือว่า guarded (fail-closed); รายงานที่ซ่อนต้นทุนก็ปฏิเสธเช่นกัน |
| จอรู้สิทธิ์ของตัวเอง | `frontend/account/tabs/TabsContext.tsx:64` `useScreenRights`, `:56-58` `canSaveWithRights`; `frontend/account/tabs/TabWorkspace.tsx:625-636` | แต่ละแท็บได้ `canAdd/canEdit/canDelete/readOnly`; เมนู admin-only ถูกบังคับเป็นอ่านอย่างเดียว |
| เมนูเฉพาะผู้ดูแล | `frontend/src/config/bcMenu.ts:315` `ADMIN_ONLY_MENU_SET`, `:392` `isAdminOnlyMenu` | ผู้ใช้ที่ไม่ใช่ Admin เปิดไม่ได้ (`TabWorkspace.tsx:524,542`) |
| เทสต์ | `process/permission_test.go:36` `TestRequireRight_AllowAndDeny` (เคส adder/editor กับ `isNew` ที่ `:49-51`), `:107` `TestQueryRequiredRight_EnforcesAddEditDelete`; `perm_wh_shelf_rest_test.go:62` `TestICPermRefusesCustomSQL` | |

## กฎที่ต้องจำ
1. การ์ดสิทธิ์ต้อง fail-closed: route ใหม่ที่ยังไม่ลงทะเบียนใน `routeRights` ต้องได้ Admin จนกว่าจะมีคนจัดประเภท
2. สิทธิ์ Add/Edit ที่อยู่ใน body ต้องอ่านผ่าน `peekJSON` ไม่ใช่ดูแค่ path และเพิ่มเคสทั้งสองทิศในเทสต์
3. ทุกประตูเขียน (`/process`, `/query/exec`, `/query/execBatch`, `/blob/insert`) ใช้การ์ดสิทธิ์ชุดเดียวกัน (ดู [[hist-lessons-query-gateway-write-lockdown]]) ปุ่มบนจอไม่ใช่ความปลอดภัย
4. การค้นสิทธิ์ต้องกรอง `database_name` และใช้แถวที่ตรงฐานก่อนแถวว่าง
5. ฟีเจอร์ที่ข้ามกฎรายผู้ใช้ (Custom SQL) ต้องเป็น Admin หรือถูกปฏิเสธเมื่อรายงานถูกจำกัดสิทธิ์ และต้องปฏิเสธเมื่ออ่านสิทธิ์ไม่ได้
6. สิทธิ์ของผู้ใช้ทั่วไปคือ OR ของทุกเมนูที่ได้รับ ไม่ผูกกับเมนูที่เรียก route (`backend/internal/application/identity/service.go:171-173` เขียนเพดานนี้ไว้ พร้อมทางอัปเกรดคือผูก `trans_flag` กับรหัสเมนูฝั่ง server)
7. ข้อสังเกตที่ยังเหลือ: `sqlBatchRight` (`backend/internal/adapter/inbound/http/process/permission.go:184-228`) ใช้ verb แรกของ batch เป็นตัวตัดสิน (ยกเว้นทั้งชุดเป็น `delete`) และไม่พบเทสต์ที่ตรวจการกรอง `database_name` ใน `MenuRights` ไม่ได้ตรวจเกินกว่านี้

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/middleware/permission.go:41,62` ตัวตรวจ; `backend/internal/application/identity/service.go:171-187` โหลดสิทธิ์ของ session
- `backend/internal/adapter/inbound/http/process/permission.go:23,57,129-133,138,171,184` ตารางสิทธิ์และ fail-closed
- `backend/internal/adapter/inbound/http/router.go:87,96-97,107-108,129,170` การต่อ middleware
- `backend/internal/adapter/outbound/identity/postgres_repository.go:69-109` `MenuRights`
- `backend/internal/application/process/perm_wh_shelf.go:42,118`, `report.go:378`, `report_menu_ic.go:54-60`
- `frontend/account/tabs/TabsContext.tsx:56-66`, `frontend/account/tabs/TabWorkspace.tsx:625-636`, `frontend/src/config/bcMenu.ts:315,392`
- ดูเพิ่ม: [[proc-permission-rights]] · [[proc-wh-shelf-permission]] · [[hist-lessons-query-gateway-write-lockdown]] · [[hist-lessons-tenant-auth-sessions]] · [[std-security-authz-and-web-vulns]]
