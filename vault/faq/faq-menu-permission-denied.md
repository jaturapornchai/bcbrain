---
title: "ทำไมเข้าเมนู/กดบันทึกแล้วขึ้น 403 ไม่มีสิทธิ์ และตั้งสิทธิ์เมนูให้ผู้ใช้อย่างไร"
tags: [faq, permission, rights, troubleshooting, backend, admin]
aliases: ["ไม่มีสิทธิ์เรียกดูข้อมูล","ไม่มีสิทธิ์เพิ่มหรือแก้ไขข้อมูล","ไม่มีสิทธิ์ลบ","เฉพาะผู้ดูแลระบบ","RequireRight","MenuRights","bc_permissions_user","bc_permissions_group","กำหนดสิทธิ์กลุ่มใช้งาน","user group rights"]
sources: ["backend/internal/adapter/inbound/http/middleware/permission.go:31", "backend/internal/adapter/inbound/http/middleware/permission.go:41", "backend/internal/adapter/inbound/http/middleware/permission.go:62", "backend/internal/application/identity/service.go:174", "backend/internal/adapter/outbound/identity/postgres_repository.go:69", "backend/internal/adapter/inbound/http/process/permission.go:23", "backend/internal/adapter/inbound/http/router.go:234"]
---
# ทำไมเข้าเมนู/กดบันทึกแล้วขึ้น 403 ไม่มีสิทธิ์ และตั้งสิทธิ์เมนูให้ผู้ใช้อย่างไร

**ตอบสั้น:** ทุกคำขอไป `/process/*`, `/query/exec`, `/query/execBatch`, `/blob/insert` ผ่าน `RequireRight` ซึ่งโหลดสิทธิ์เมนูของผู้ใช้สดจาก Main Database แล้วเทียบกับ "สิทธิ์ที่ route ต้องการ" (อ่าน / เพิ่ม / แก้ / ลบ / Admin) ถ้าไม่ผ่านตอบ 403 ข้อความไทยตามชนิดสิทธิ์ ผู้ดูแลระบบตั้งสิทธิ์ที่จอ "กำหนดสิทธิ์กลุ่มใช้งาน" หรือ "กำหนดการเข้าถึงข้อมูล" (รายบุคคล)

## รายละเอียด
**อ่านข้อความ 403 ให้ออก** (`deniedMessages`, `middleware/permission.go:31`):

| ข้อความขึ้นต้น | ชนิดสิทธิ์ที่ขาด |
|---|---|
| "ไม่มีสิทธิ์เรียกดูข้อมูล" | Read |
| "ไม่มีสิทธิ์เพิ่มข้อมูลใหม่" | Add |
| "ไม่มีสิทธิ์แก้ไขข้อมูล" | Edit |
| "ไม่มีสิทธิ์เพิ่มหรือแก้ไขข้อมูล" | Write (Add หรือ Edit อย่างใดอย่างหนึ่ง) |
| "หน้าจอนี้ไม่อนุญาตให้ลบข้อมูล" | Delete |
| "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น..." | Admin |

**ใครได้สิทธิ์อะไร** (`Service.MenuRights`, `identity/service.go:174`):
- username `superadmin` (ไม่สนตัวพิมพ์) หรือ `level >= 9` (`webAdminLevel`, `:164`) → ได้ทุกสิทธิ์รวม Admin
- คนอื่นโหลดจาก DB ตามบริษัทใน token (`claims.DatabaseName`) — ถ้าไม่มีแถวสิทธิ์เลย ได้ศูนย์ ไม่ใช่ได้ทั้งหมด
- `Allows` (`permission.go:41`): Admin ผ่านทุกอย่าง; Write = Add หรือ Edit; ผู้ที่ไม่ใช่ Admin จะผ่านสิทธิ์ Admin ไม่ได้เลย

**สิทธิ์เก็บที่ไหน** (`UserRepository.MenuRights`, `postgres_repository.go:69`): ตาราง `bc_permissions_user` (ราย user) และ `bc_permissions_group` (ราย group ผ่าน `bc_user_and_group`) ใน Main DB คอลัมน์ `image_file` เป็น blob ของรายการเมนู (JSON `{"menus":[...]}` หรือ XML ที่มีสิทธิ์อ่าน/เพิ่ม/แก้/ลบต่อเมนู — `DecodeMenuRights` `menu_rights.go:48`; blob ที่อ่านไม่ออกถือว่าไม่ให้สิทธิ์เลย) แถวถูกกรองด้วย `database_name` ของบริษัทที่ล็อกอิน (แถวที่ตรงบริษัทมาก่อนแถวว่าง) และผลรวมของ user + group คือ OR กัน

**route ต้องการสิทธิ์อะไร:**
- `/process`: ตาราง `routeRights` (`process/permission.go:23`) คีย์ `"กลุ่ม/action"` → read/write/del/admin และ `RequiredRight` (`:57`) ปรับตาม body เช่น `trans/save` ดู `isNew` แยก Add/Edit
- `/query/exec|execBatch` และ `/blob/insert`: `QueryRequiredRight` (`:138`) แปลงคำกริยา SQL เป็น Add/Edit/Delete
- **route ที่ไม่อยู่ใน `routeRights` ต้องเป็น Admin** (`return admin`, `:132`) — สาเหตุที่พบบ่อยเมื่อเพิ่ม action ใหม่แล้วผู้ใช้ทั่วไปได้ 403 ([[faq-process-engine-dispatcher]])

**ตั้งสิทธิ์ให้ผู้ใช้ (ผู้ดูแลระบบ):**
1. จัดผู้ใช้เข้ากลุ่มที่จอ "จัดกลุ่มผู้ใช้" (`bc_group_list`, `bc_user_and_group`)
2. จอ "กำหนดสิทธิ์กลุ่มใช้งาน" ติ๊ก อ่าน/เพิ่ม/แก้ไข/ลบ รายเมนูของกลุ่ม หรือจอ "กำหนดการเข้าถึงข้อมูล" ตั้งรายคน แล้วกด "บันทึกสิทธิ์" ([[scr-admin-permissions]])
3. จอเรียก `GET/PUT /api/v1/admin/menu-permissions` (`router.go:234-235`) ซึ่งเขียน `image_file` ของ user หรือ group
4. ให้ผู้ใช้ล็อกอินเข้าใหม่เลือกบริษัทเดิม — สิทธิ์โหลดสดทุกคำขอ จึงมีผลทันที แต่ `level` ใน token เปลี่ยนเมื่อออก token ใหม่เท่านั้น ([[faq-session-logout-expired]])

## ข้อควรระวัง
- ถ้าผ่านด่านสิทธิ์เมนูแล้วยังได้ 403 ตารางเงิน/สต็อก/GL ไม่ใช่ปัญหาสิทธิ์เมนู แต่เป็นนโยบายล็อกเขียน ([[faq-query-exec-write-blocked]])
- คำสั่ง `ALTER TABLE ... ADD COLUMN IF NOT EXISTS database_name` รันทุกครั้งที่โหลดสิทธิ์ (`postgres_repository.go:74-75`) และผลถูกทิ้ง ถ้า DB user ไม่มีสิทธิ์ ALTER จะเงียบ
- สิทธิ์คลัง/ชั้นเก็บเป็นกลไกแยก ดู [[faq-wh-shelf-permission]]

## ดูเพิ่ม
- [[be-menu-rights-permission]]
- [[proc-permission-rights]]
- [[hist-lessons-permission-rights]]
- [[scr-admin-permissions]]
- [[faq-query-exec-write-blocked]]
- [[faq-wh-shelf-permission]]

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/middleware/permission.go:31` `deniedMessages` ข้อความ 403 ภาษาไทยต่อชนิดสิทธิ์
- `backend/internal/adapter/inbound/http/middleware/permission.go:41` `Allows` และ `:62` `RequireRight`
- `backend/internal/application/identity/service.go:174` `MenuRights` (superadmin / level >= 9 / โหลดจาก DB)
- `backend/internal/adapter/outbound/identity/postgres_repository.go:76-93` SQL สิทธิ์ user + group กรอง `database_name`
- `backend/internal/adapter/outbound/identity/menu_rights.go:48` `DecodeMenuRights` (JSON หรือ XML)
- `backend/internal/adapter/inbound/http/process/permission.go:23` `routeRights`, `:57` `RequiredRight` (default admin บรรทัด 132), `:138` `QueryRequiredRight`
- `backend/internal/adapter/inbound/http/router.go:234` `GET/PUT /menu-permissions` ของ admin
