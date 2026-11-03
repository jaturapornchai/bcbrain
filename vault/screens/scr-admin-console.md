---
title: "ศูนย์จัดการระบบ Admin: ผู้ใช้ ผู้ให้บริการ ฐานข้อมูล สิทธิ์เข้าฐาน (UsersScreen, ProvidersScreen, DatabasesScreen, DataAccessScreen, DataGroupsScreen, DatabaseInfoScreen)"
tags: [screens, admin]
aliases: ["Admin Console", "จัดการระบบ", "UsersScreen", "UsersTab", "ProvidersScreen", "ProvidersTab", "DatabasesScreen", "DatabasesTab", "DataAccessScreen", "DataGroupsScreen", "DatabaseInfoScreen", "ProviderScopedScreen", "/admin", "กำหนดผู้ใช้และกลุ่มผู้ใช้", "เชื่อมฐานข้อมูล"]
sources: ["frontend/src/app/(admin)/layout.tsx:17", "frontend/src/app/(admin)/admin/page.tsx:7", "frontend/src/config/adminMenu.ts:41", "frontend/account/admin/ProviderScopedScreen.tsx:17", "frontend/account/admin/AdminScreenFrame.tsx:13", "frontend/account/admin/UsersTab.tsx:28", "frontend/account/admin/ProvidersTab.tsx:53", "frontend/account/admin/DatabasesTab.tsx:57", "frontend/account/admin/screens/DataAccessScreen.tsx:74", "frontend/account/admin/screens/DataGroupsScreen.tsx:48", "frontend/account/admin/screens/DatabaseInfoScreen.tsx:16", "frontend/account/admin/MockResetButton.tsx:12"]
---
# ศูนย์จัดการระบบ Admin (พื้นที่ `/admin`)

พื้นที่ผู้ดูแลระบบส่วนกลางของเว็บ แยกจากเมนู ERP ปกติ (ไม่อยู่ในต้นไม้เมนู `bcMenu.json` และไม่ผ่าน `screenRegistry`) เป็นหน้า Next.js ใต้ `src/app/(admin)/admin/*` ที่เรียกคอมโพเนนต์ใน `frontend/account/admin/`
มี 2 จอที่ถูกเรียกจากทั้งสองทาง คือ [[scr-change-password]] และ [[scr-mcp-token]] (ผูกกับเมนู ERP ด้วย)

กลไกฝั่งหน้าเว็บของพื้นที่นี้อธิบายไว้ใน [[fe-admin-console]] และ API ที่จอเหล่านี้เรียกอยู่ใน [[api-admin-console]] (โน้ตนี้ไม่ซ้ำกลไก เน้นว่าแต่ละจอทำอะไรให้ผู้ใช้)
จอเรื่องกลุ่มผู้ใช้/สิทธิ์ดู [[scr-admin-permissions]] จอสร้าง/ตรวจ/โอนฐานข้อมูลดู [[scr-admin-database-tools]]

## วิธีเปิด
- เข้า `/admin` ได้เฉพาะ session โหมด `admin` (ผู้ใช้ระดับ >= 9 ตามคอมเมนต์ที่ `(admin)/layout.tsx:6-11`) ถ้าไม่มี session ไป `/login` (`:18`) ถ้าไม่ใช่โหมด admin ส่งไป `/home` (`:21`)
- ผู้ใช้สาธิตดูได้แบบอ่านอย่างเดียว (`isDemoCentralViewer` -> `AdminShell readOnly`, `:20-26`) การเพิ่ม/แก้/ลบถูก API บล็อก (ตามคอมเมนต์ในไฟล์เดียวกัน)
- หน้าแรก `/admin` (`admin/page.tsx`) แสดงชื่อผู้ดูแลกับ Provider ที่เข้าใช้ และการ์ดเมนู 3 กลุ่มจาก `adminMenuGroups` (`adminMenu.ts:41,88,142`) การ์ดที่ `status` ไม่ใช่ `ready` จะมีป้าย "ยังไม่ทำ" (ปัจจุบันทุกการ์ดเป็น `ready`)

| กลุ่มเมนู | เมนู (path) | หมายเหตุ |
|---|---|---|
| User Manage (Provider) | กำหนดผู้ใช้และกลุ่มผู้ใช้ (`/admin/users`) | บันทึกนี้ |
| | จัดกลุ่มผู้ใช้ (`/admin/user-groups`), เปลี่ยนข้อความในระบบ (`/admin/system-text`), กำหนดสิทธิ์กลุ่มใช้งาน (`/admin/group-permission`) | [[scr-admin-permissions]] |
| | เปลี่ยนรหัสผ่าน (`/admin/change-password`) | [[scr-change-password]] |
| | กำหนดผู้มีสิทธิ์เข้าใช้ข้อมูล (`/admin/data-access`) | บันทึกนี้ |
| Database Manage (Provider) | กำหนดกลุ่มข้อมูล (`/admin/data-groups`), เชื่อมฐานข้อมูล (`/admin/databases`), Database Information (`/admin/database-info`) | บันทึกนี้ |
| | สร้างฐานข้อมูลใหม่ (`/admin/create-database`), ตรวจสอบฐานข้อมูล (`/admin/check-database`), โอนข้อมูล (`/admin/transfer`), กำหนดการเข้าถึงข้อมูล (`/admin/data-permission`) | [[scr-admin-database-tools]], [[scr-admin-permissions]] |
| ระบบและการเชื่อมต่อ AI ภายนอก (เฉพาะเว็บ) | จัดการ Provider (`/admin/providers`), จัดการ MCP Token (`/admin/mcp-tokens`) | Provider ในบันทึกนี้, MCP ที่ [[scr-mcp-token]] |

## กรอบร่วมของทุกจอย่อย
- `AdminScreenFrame` (`AdminScreenFrame.tsx:13`) ใส่หัวจอมาตรฐาน: ปุ่ม "จัดการระบบ" ย้อนกลับ `/admin`, ชื่อจอ, บรรทัดหมายเหตุ และช่องว่างด้านขวาสำหรับตัวเลือก
- `ProviderScopedScreen` (`ProviderScopedScreen.tsx:17`) ใช้กับจอที่ต้องเลือก **Provider** (ผู้เช่า/tenant) ก่อนทำงาน ใส่ `ProviderPicker` (dropdown "Provider: รหัส — ชื่อ") ที่หัวจอ โหลดรายการด้วย hook `useProviders` และส่ง provider ที่เลือกให้เนื้อหา ถ้าโหลดอยู่ขึ้น "กำลังโหลด..."
- ทุกจอไม่ใช้ `ScreenHeader` ของ ERP จึง **ไม่มีคีย์ลัด Ctrl+S / Esc** ต้องกดปุ่มในจอเอง
- ปุ่ม "ล้างข้อมูลจำลอง" (`MockResetButton.tsx:12`) โผล่บนหน้าแรก `/admin` เฉพาะเมื่อ `NEXT_PUBLIC_USE_MOCK` ไม่ใช่ `"0"` (`:9,15`) กดแล้วถาม "ล้างข้อมูลจำลองทั้งหมดกลับเป็นค่าตั้งต้น?" แล้วเรียก `POST /api/admin/reset`

## 1) กำหนดผู้ใช้และกลุ่มผู้ใช้ (UsersScreen -> UsersTab)
หัวจอบอกว่าเป็น "ผู้ใช้ระบบในตาราง bc_user_list ของ auth database" ([[tbl-bc-user-list]]) ตารางแสดงผู้ใช้ของ provider ที่เลือก (`UsersTab.tsx:149-160`)
- คอลัมน์: รหัสผู้ใช้, ชื่อ, อีเมล (Gmail ที่ผูก), สิทธิ์ (ผู้ดูแลระบบ/สมาชิก), ฐานข้อมูลที่เข้าได้, สถานะ, ปุ่มแก้ไข/ลบ
- ถ้าสิทธิ์ >= 9 หรือไม่ได้ระบุฐานข้อมูล แสดง "ทุกฐานข้อมูล" (`:191-194`)
- ปุ่ม **เพิ่มผู้ใช้** (`:129-140`) เปิด modal "เพิ่มผู้ใช้ระบบ" ส่วนปุ่มแก้ไขเปิด modal "แก้ไข <รหัส>"
- ช่องใน modal (`:262-380`)
  - รหัสผู้ใช้ (แก้ไม่ได้ตอนแก้ไข, ระบบแปลงเป็นตัวพิมพ์ใหญ่ทันที `:271`)
  - ชื่อผู้ใช้
  - อีเมล (ผูกบัญชี Google สำหรับ Login By Google) ถูกแปลงเป็นตัวพิมพ์เล็กและ trim ก่อนส่ง (`:71`)
  - รหัสผ่าน: ตอนแก้ไขเว้นว่าง = ไม่เปลี่ยนรหัสเดิม (`:309`)
  - สิทธิ์: 0 = สมาชิก (ใช้จอตามสิทธิ์), 9 = ผู้ดูแลระบบ (ทำได้ทุกอย่าง) (`:326-327`)
  - ฐานข้อมูลที่เข้าได้ (checkbox ต่อฐานของ provider นั้น) และสถานะใช้งาน
- บันทึก: `POST /api/admin/users` (ใหม่) หรือ `PATCH /api/admin/users` (แก้) พร้อม `provider` (`:74-76`) ลบ: confirm `ลบผู้ใช้ "<รหัส> — <ชื่อ>" ?` แล้ว `DELETE /api/admin/users?provider=..&user=..` (`:87-110`)
- ข้อควรระวัง: มีการตรวจฝั่งจอเพียงปุ่มและค่าว่าง ผลสำเร็จ/ล้มเหลวมาจากข้อความ error ของ API ที่แสดงเหนือฟอร์ม (`setError`) การกำหนดรหัสผ่านใหม่แยกอีกจอที่ [[scr-change-password]]

## 2) จัดการ Provider (ProvidersScreen -> ProvidersTab)
หัวจอ "รายการ tenant และ auth database" ซึ่งหมายเหตุในโค้ดระบุว่า **ไม่มีใน BCERP22 เดิม** เป็นของที่ฝั่งเว็บเพิ่ม (`ProvidersScreen.tsx:17-18`)
- ตาราง: รหัส, ชื่อ, ชื่อ Auth Database, สถานะ (เปิดใช้งาน/ปิด) และป้าย "ใช้งานอยู่" ที่ provider ที่ session กำลังใช้ (`ProvidersTab.tsx:104-133`)
- modal "เพิ่ม Provider / แก้ไข <รหัส>": รหัส Provider (แก้ภายหลังไม่ได้), ชื่อ Provider, ชื่อ Auth Database, เปิดใช้งาน (`:186-229`)
- บันทึก `POST/PATCH /api/admin/providers` (`:53-54`) ลบ `DELETE /api/admin/providers?code=..` (`:73-74`)
- ข้อความยืนยันลบเตือนว่าข้อมูลผู้ใช้และรายการฐานข้อมูลของ provider ถูกกระทบ (`:69-70`)

## 3) เชื่อมฐานข้อมูล (DatabasesScreen -> DatabasesTab)
หมายเหตุหัวจอ "ผูกฐานข้อมูลที่มีอยู่แล้วเข้ากับ provider" (`DatabasesScreen.tsx:13-14`)
- ตาราง: รหัส, ชื่อกิจการ, ชื่อฐานข้อมูล, กลุ่ม (`DatabasesTab.tsx:123-126`)
- modal: รหัส, ชื่อกิจการ, ชื่อฐานข้อมูล (PostgreSQL), กลุ่ม (`:197-231`)
- บันทึก `POST/PATCH /api/admin/databases` (`:57-58`) ลบ `DELETE /api/admin/databases?provider=..&database=..` ด้วยข้อความ `ลบฐานข้อมูล "<ชื่อ>" ออกจากรายการ?` (`:73-78`) หมายถึงลบจาก **รายการที่ผูก** ไม่ได้ลบฐานข้อมูล PostgreSQL จริงจากโค้ดฝั่งจอนี้

## 4) กำหนดผู้มีสิทธิ์เข้าใช้ข้อมูล (DataAccessScreen)
เมทริกซ์ ผู้ใช้ x ฐานข้อมูลของ provider (`DataAccessScreen.tsx:144-174`)
- แถวผู้ดูแลระบบแสดง "ผู้ดูแล — ทุกฐาน" แก้ไม่ได้ ผู้ใช้อื่นที่ไม่ติ๊กเลยแสดง "ไม่ระบุ = ทุกฐาน" (`:174,206-207`)
- แสดงตัวนับ "แก้ไขแล้ว N คน" และปุ่ม **บันทึกสิทธิ์** (`:113,124`)
- บันทึกด้วย `PATCH /api/admin/users` ทีละผู้ใช้ที่แก้ ตามลำดับ (`:74-81`) ถ้าผู้ใช้คนใดล้มเหลวจะหยุดทันทีและขึ้น `<รหัส>: <ข้อความ>` (ผู้ใช้ก่อนหน้าบันทึกไปแล้ว ไม่มีการย้อนกลับ) แล้วโหลดค่าใหม่ (`:86-93`)

## 5) กำหนดกลุ่มข้อมูล (DataGroupsScreen)
หมายเหตุ "กลุ่มข้อมูล ที่ผู้ใช้ต้องกรอกตอน login" (`DataGroupsScreen.tsx:194-195`)
- กลุ่มคำนวณจากค่า `data_group` ของฐานข้อมูล ไม่มีตารางกลุ่มแยก; ฐานที่ไม่ระบุกลุ่มรวมเป็น "(ไม่ระบุ)" (`:39`)
- ตารางแสดง กลุ่มข้อมูล, จำนวนฐาน, ฐานข้อมูลในกลุ่ม และปุ่มไอคอน "เปลี่ยนชื่อกลุ่ม" (`:108-125`)
- modal เปลี่ยนชื่อ: ถ้าไม่กรอกชื่อใหม่ขึ้น "กรุณากรอกชื่อกลุ่มใหม่" (`:48`) บันทึกด้วย `PATCH /api/admin/databases` กับทุกฐานในกลุ่มพร้อมกัน แล้วขึ้น `เปลี่ยนชื่อกลุ่มเป็น "<ชื่อ>" แล้ว (N ฐานข้อมูล)` (`:54-74`)
- จะเพิ่มกลุ่มใหม่ต้องไปกรอกช่อง "กลุ่ม" ตอน "เชื่อมฐานข้อมูล" (ข้อความอธิบายท้ายจอ `:150-152`)

## 6) Database Information (DatabaseInfoScreen)
ตารางสรุปรายฐานข้อมูลของ provider: รหัส, ชื่อกิจการ, ชื่อฐานข้อมูล, กลุ่ม, จำนวนพนักงาน, สถานะ "ข้อมูลบริษัท" และ "ค่ากำหนด" (ตั้งค่าแล้ว/ยังไม่ตั้งค่า) อ่านจาก `GET /api/admin/database-info?provider=..` (`DatabaseInfoScreen.tsx:16-17,54-89`)
- ข้อความท้ายจอระบุว่า **ตัวเลขมาจากชั้นข้อมูลจำลอง** เมื่อต่อ service จริงจะเป็นสถิติจาก PostgreSQL (ขนาดฐาน จำนวนแถว วันที่สำรองล่าสุด) (`:108-109`)

## Popups ที่จอกลุ่มนี้เรียก
- `Modal` ของ `@/components/ui` สำหรับฟอร์มเพิ่ม/แก้ (ผู้ใช้, Provider, ฐานข้อมูล, เปลี่ยนชื่อกลุ่ม)
- `BcDialog` ยืนยันการลบและแจ้ง "ลบไม่สำเร็จ" (`UsersTab.tsx:87-110`, `ProvidersTab.tsx:65-90`, `DatabasesTab.tsx:73-90`)

## ข้อควรระวังรวม
- ทุกจอเรียก API ภายใต้ `/api/admin/*` ซึ่งฝั่ง server ตรวจเป็นผู้ดูแลส่วนกลาง (`requireSystemAdmin`) ตามคอมเมนต์ใน layout ผู้ดูแล workspace ที่ล็อกอินด้วย Google โหมดผู้ใช้ **ไม่ใช่** ผู้ดูแลส่วนกลาง
- ชื่อฐานข้อมูล PostgreSQL ที่ผูกกับกิจการเก็บเป็นข้อความอิสระ จอไม่ตรวจว่ามีฐานจริงอยู่หรือไม่
- ไม่มีคีย์ลัดและไม่มีสถานะ "ยังไม่บันทึก" แบบจอ ERP: ปิด modal โดยไม่กดบันทึก ค่าที่แก้หายไปโดยไม่ถาม

## ที่มาในโค้ด
- `frontend/src/app/(admin)/layout.tsx:6-26` — เกณฑ์เข้าโซน admin, โหมดอ่านอย่างเดียวของผู้ใช้สาธิต
- `frontend/src/app/(admin)/admin/page.tsx:7-60` — หน้าเมนู `/admin`
- `frontend/src/config/adminMenu.ts:24-156` — รายการกลุ่มเมนูและสถานะ
- `frontend/account/admin/AdminScreenFrame.tsx:13`, `ProviderScopedScreen.tsx:17`, `ProviderPicker.tsx:11`, `MockResetButton.tsx:12-36`
- `frontend/account/admin/UsersTab.tsx:28-399`, `admin/screens/UsersScreen.tsx:6-15`
- `frontend/account/admin/ProvidersTab.tsx:53-229`, `admin/screens/ProvidersScreen.tsx:17`
- `frontend/account/admin/DatabasesTab.tsx:39-231`, `admin/screens/DatabasesScreen.tsx:13`
- `frontend/account/admin/screens/DataAccessScreen.tsx:26-221`, `DataGroupsScreen.tsx:23-195`, `DatabaseInfoScreen.tsx:16-123`
- ดูเพิ่ม: [[fe-screen-registry-menu]] · [[screens-overview]]
