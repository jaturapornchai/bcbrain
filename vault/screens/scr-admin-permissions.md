---
title: "จัดกลุ่มผู้ใช้ ข้อความระบบ และสิทธิ์รายเมนู (UserGroupsScreen, SystemTextScreen, GroupPermissionScreen, DataPermissionScreen)"
tags: [screens, admin]
aliases: ["UserGroupsScreen", "SystemTextScreen", "GroupPermissionScreen", "DataPermissionScreen", "PermissionMatrixInner", "จัดกลุ่มผู้ใช้", "เปลี่ยนข้อความในระบบ", "กำหนดสิทธิ์กลุ่มใช้งาน", "กำหนดการเข้าถึงข้อมูล", "/admin/user-groups", "/admin/system-text", "/admin/group-permission", "/admin/data-permission"]
sources: ["frontend/account/admin/screens/ExtraAdminScreens.tsx:33", "frontend/account/admin/screens/ExtraAdminScreens.tsx:256", "frontend/account/admin/screens/ExtraAdminScreens.tsx:379", "frontend/account/admin/screens/ExtraAdminScreens.tsx:391", "frontend/account/admin/screens/ExtraAdminScreens.tsx:403", "frontend/account/admin/screens/ExtraAdminScreens.tsx:416", "frontend/src/config/adminMenu.ts:52", "frontend/src/config/adminMenu.ts:73"]
---
# จัดกลุ่มผู้ใช้ ข้อความระบบ และสิทธิ์รายเมนู

4 จอที่อยู่ในไฟล์เดียวกัน `ExtraAdminScreens.tsx` ทั้งหมดอยู่ในพื้นที่ `/admin` ([[scr-admin-console]]) และห่อด้วย `ProviderScopedScreen` คือต้องเลือก Provider ก่อน ไม่มีคีย์ลัด Ctrl+S / Esc

## วิธีเปิด
| จอ | path | ชื่อเมนูในหน้า `/admin` |
|---|---|---|
| UserGroupsScreen | `/admin/user-groups` | จัดกลุ่มผู้ใช้ |
| SystemTextScreen | `/admin/system-text` | เปลี่ยนข้อความในระบบ |
| GroupPermissionScreen | `/admin/group-permission` | กำหนดสิทธิ์กลุ่มใช้งาน |
| DataPermissionScreen | `/admin/data-permission` | กำหนดการเข้าถึงข้อมูล |

การจับคู่ path -> เมนู มาจาก `adminMenu.ts` และเพจใต้ `src/app/(admin)/admin/*/page.tsx` (ต้องเป็นโหมดผู้ดูแลระบบ ดู [[scr-admin-console]])

## 1) จัดกลุ่มผู้ใช้ (UserGroupsScreen, `:33-250`)
หมายเหตุหัวจอ "สร้างกลุ่มผู้ใช้ และผูกผู้ใช้เข้ากลุ่ม" ทำงานกับตาราง `bc_group_list` (รหัสกลุ่ม/ชื่อกลุ่ม) และ `bc_user_and_group` (ผู้ใช้ต่อกลุ่ม) ผ่าน `POST /api/admin/main-query`
- จอแบ่ง 2 ส่วน: **กลุ่มผู้ใช้ (N กลุ่ม)** กับ **สมาชิกในกลุ่ม <รหัสที่เลือก>**
- เพิ่มกลุ่ม: ช่อง "รหัสกลุ่ม" (ตัวอย่าง SALE) และ "ชื่อกลุ่มผู้ใช้" แล้วกดปุ่ม **เพิ่มกลุ่ม** (`addGroup`, `:86-104`) ต้องกรอกทั้งคู่ ไม่งั้นขึ้น "กรุณากรอกรหัสกลุ่มและชื่อกลุ่ม" (`:89`) รหัสถูกแปลงเป็นตัวพิมพ์ใหญ่ (`:87`) สำเร็จแล้วขึ้น `เพิ่มกลุ่ม "<รหัส> - <ชื่อ>" เรียบร้อย`
- คลิกแถวกลุ่มเพื่อเลือก แล้วติ๊ก/เอาติ๊กคอลัมน์ "สังกัด" ของผู้ใช้เพื่อเพิ่ม/ถอดสมาชิก (`toggleUserInGroup`, `:106-115`) ใช้ INSERT/DELETE บน `bc_user_and_group` ทันทีโดยไม่มีปุ่มบันทึก
- ปุ่มถังขยะ "ลบ" ที่แถวกลุ่ม (`:194-203`) ลบสมาชิกของกลุ่มก่อน แล้วลบกลุ่ม (`deleteGroup`, `:117-133`) **ไม่มีหน้าต่างยืนยัน** และไม่ตรวจว่ากลุ่มนั้นถูกใช้ในตารางสิทธิ์อยู่หรือไม่

## 2) เปลี่ยนข้อความในระบบ (SystemTextScreen, `:256-376`)
หมายเหตุ "กำหนดป้ายกำกับและคำแปลภาษาไทย/อังกฤษของระบบ" ตารางต้นทางตามคอมเมนต์คือ `bc_tooltip`
- ฟอร์มด้านบน: รหัสข้อความ (Code) เช่น `word_customer`, ข้อความภาษาไทย (Name 1) เช่น ลูกค้า / สมาชิก, ข้อความภาษาอังกฤษ (Name 2) เช่น Customer และปุ่ม **บันทึกข้อความ** (`:319-331`)
- ตารางด้านล่าง "ตารางข้อความระบบ" แสดงรหัส / ไทย / อังกฤษ (`:341-343`) โหลดจาก `GET /api/admin/menu-permissions?kind=tooltip&code=ALL&provider=..` (`:278-279`)
- บันทึกด้วย `PUT /api/admin/menu-permissions` ส่ง `{provider, kind: "tooltip", code, name_1, name_2}` (`:293-299`) ถ้า Code หรือ Name 1 ว่างจะไม่ทำอะไรเงียบ ๆ (`:291`) สำเร็จขึ้น "บันทึกข้อความระบบเรียบร้อย" แล้วโหลดตารางใหม่
- ข้อความท้ายจอ: ถ้าไม่ได้ตั้ง จะใช้ค่าข้อความมาตรฐานของ BC Account (`:365`) ที่เพิ่มได้คือคำเฉพาะกิจการ

## 3) กำหนดสิทธิ์กลุ่มใช้งาน และ 4) กำหนดการเข้าถึงข้อมูล (`PermissionMatrixInner`, `:416-615`)
สองจอใช้คอมโพเนนต์เดียวกัน ต่างกันที่ `mode`
- GroupPermissionScreen (`:379-389`): `mode="group"` เลือก **กลุ่มผู้ใช้** (จาก `bc_permissions_group` ตามคอมเมนต์ `:377`) หมายเหตุ "กำหนดสิทธิ์ อ่าน / เพิ่ม / แก้ไข / ลบ รายเมนูสำหรับแต่ละกลุ่ม"
- DataPermissionScreen (`:391-400`): `mode="user"` เลือก **ผู้ใช้รายคน** หมายเหตุ "กำหนดสิทธิ์การเข้าถึงเมนูและเอกสารรายบุคคล"
- แถบเครื่องมือ: dropdown "กลุ่มผู้ใช้:" หรือ "ผู้ใช้:" (รหัส — ชื่อ), dropdown "หมวดเมนู:" (หมวดระดับบนของ `bcMenu` เรียง 1..N) และปุ่ม **บันทึกสิทธิ์** ซึ่งกดไม่ได้จนกว่าจะโหลดสิทธิ์ของเป้าหมายที่เลือกเสร็จ (`disabled={busy || !selectedTarget || loadedTarget !== selectedTarget}`, `:545`)
- ตารางแสดงทุกเมนูใบ (leaf) ของหมวดที่เลือก: คอลัมน์ "รหัสเมนู" (แสดงชื่อเมนู `menu_*` ของโหนด), "ชื่อเมนู" (ข้อความเมนู) และ 4 ช่องติ๊ก **อ่าน / เพิ่ม / แก้ไข / ลบ** (`RIGHT_COLUMNS`, `:405-410`)
- เมนูที่อยู่ใน `ADMIN_ONLY_MENU_SET` แสดงป้าย "เฉพาะ Admin" และข้อความ "สงวนสิทธิ์เฉพาะผู้ดูแลระบบ (Admin เท่านั้น)" ติ๊กไม่ได้ (`toggle` ออกทันทีถ้า `isAdminOnlyMenu`, `:474`; ป้ายที่ `:583-592`) รายการนี้ตรงกับเมนูที่กล่าวใน [[scr-company-profile]] และ [[scr-options]]
- โหลด `GET /api/admin/menu-permissions?kind=group|user&code=<เป้าหมาย>` (`:455-456`) บันทึก `PUT /api/admin/menu-permissions` ส่ง `{kind, code, menus: [ {code, read, add, edit, delete} ]}` ของ **ทุกหมวด** ที่มีใน state ไม่ใช่เฉพาะหมวดที่เปิดอยู่ (`:485-489`) สำเร็จขึ้น `บันทึกสิทธิ์ N เมนูของ <รหัส> เรียบร้อย` (`:493`)
- สิทธิ์เก็บเป็น **ชื่อเมนู (`menu_*`)** ไม่ใช่รหัส 4 หลัก ดังนั้นการเปลี่ยนรหัสเมนูใน `bcMenu` ไม่กระทบสิทธิ์ที่บันทึกไว้ ([[fe-screen-registry-menu]]) แถวในตารางใช้คีย์ `${i}-${leaf.name}` (`:575-577`) ส่วนสิทธิ์ที่ติ๊กเก็บตามชื่อเมนู (`toggle(code, key)`, `:473`)
- สิทธิ์ที่บันทึกไปถูกอ่านใช้ในจอ ERP ผ่าน `useScreenRights` / `rights.canEdit` (ตัวอย่างใน [[scr-options]] และ [[scr-company-profile]]) กลไกอยู่ที่ [[fe-tabs-workspace]]

## Popups ที่จอกลุ่มนี้เรียก
ไม่มี popup ใช้ข้อความแถบสีแดง/เขียวเหนือตาราง (`err` / `done`) เท่านั้น

## ข้อควรระวัง
- การลบกลุ่มและการเพิ่ม/ถอดสมาชิกมีผลทันที ไม่มีปุ่มยกเลิก
- จอสิทธิ์โหลดเป้าหมายแรกเสมอเมื่อเปลี่ยน provider (`setSelectedTarget(list[0].code)`, `:436,445`) ถ้ายังไม่มีกลุ่มเลย dropdown จะว่างและปุ่มบันทึกกดไม่ได้
- การกด "บันทึกสิทธิ์" ส่งทั้ง state ที่ผู้ใช้เปิดดู: ถ้าสลับหมวดโดยไม่บันทึก การติ๊กของหมวดก่อนหน้ายังอยู่ใน state และถูกบันทึกไปด้วย

## ที่มาในโค้ด
- `frontend/account/admin/screens/ExtraAdminScreens.tsx:33-250` — กลุ่มผู้ใช้, `:256-376` ข้อความระบบ, `:379-400` สองจอสิทธิ์, `:403-615` เมทริกซ์สิทธิ์
- `frontend/src/config/bcMenu.ts:315-390,392-397` — `ADMIN_ONLY_MENU_SET` / `isAdminOnlyMenu`
- ดูเพิ่ม: [[scr-admin-console]] · [[scr-admin-database-tools]] · [[fe-screen-registry-menu]] · [[screens-overview]]
