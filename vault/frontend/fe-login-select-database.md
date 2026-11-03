---
title: "หน้าเข้าสู่ระบบและเลือกฐานข้อมูล (Login & select database)"
tags: [frontend, login, google, demo, select-database, workspace]
aliases: ["login", "หน้า login", "เลือกฐานข้อมูล", "select-database", "returnTo", "safeReturnPath", "สร้างฐานข้อมูลใหม่", "Google login", "demo login", "สมาชิกฐานข้อมูล"]
sources: ["frontend/src/app/login/page.tsx:142", "frontend/src/app/login/page.tsx:171", "frontend/src/app/login/page.tsx:188", "frontend/src/lib/safe-return.ts:6", "frontend/src/app/select-database/page.tsx:137", "frontend/src/app/select-database/page.tsx:220", "frontend/src/app/select-database/page.tsx:271", "frontend/src/app/api/workspace/[...path]/route.ts:67", "frontend/src/app/api/auth/google/route.ts:210", "frontend/src/app/api/auth/demo/route.ts:9"]
---

# หน้าเข้าสู่ระบบและเลือกฐานข้อมูล (Login & select database)

ผู้ใช้เข้าระบบสองขั้น: (1) `/login` ยืนยันตัวตน (2) `/select-database` เลือก/สร้าง "ฐานข้อมูล" (workspace) ที่จะทำงานด้วย แล้วจึงเข้า `/home` (ปุ่ม Demo ข้ามขั้นเลือกฐานไปที่ returnTo หรือ `/home` ทันที)
ปุ่มยืนยันตัวตนที่หน้า `/login` มีแค่ 2 ทาง คือ "ทดลองใช้งานทันที (Demo — ฐานข้อมูล bcdemo)" (`login/page.tsx:658-676`) และ "ดำเนินการต่อด้วย Google" (748-774); ไม่มีช่องกรอกรหัสผ่านในหน้านี้.

## ทำงานอย่างไร

**หน้า `/login`** (`src/app/login/page.tsx`, 857 บรรทัด, `LoginPage` 142)
- หน้าจอ: ชื่อระบบ "BC AI Account" (`h1` 410, 599), การ์ดฟีเจอร์ 4 ใบที่กดดูรายละเอียดได้ (`HERO_FEATURES` 75-116, `activeFeatureId` 151, `onClick` 439) พร้อมกราฟตกแต่ง (`HERO_BARS` 140 เป็นภาพประกอบเท่านั้น) และการ์ดเข้าสู่ระบบ (613-842) ที่ปิดท้ายด้วยข้อความความเชื่อมั่น 3 ข้อ (`TRUST_BADGES` 118-137, วาด 816-822). มุมขวาบนมีปุ่มสลับภาษา ไทย/English (`LanguageFlagSwitcher` 288, 647), ปุ่มเปิด/ปิดคำอธิบายบอลลูน (`toggleBalloonHelp` 297) และปุ่มโหมดมืด/สว่าง (`toggleColorMode` 342) จาก `useAppearance` (144); ข้อความตามค่า `settings.language` (145).
- Demo: `handleDemoLogin` (171-186) เรียก `apiPost("/api/auth/demo")` แล้ว `router.replace(returnTo)` + `router.refresh()` และลบ `bc_return_to` ออกจาก `sessionStorage` (182). ฝั่ง route (`api/auth/demo/route.ts:9-39`) เรียก `getOrMintBcDemoSession(true)` แล้วตั้ง session `isDemo: true, role: "ADMIN"` (15-20) บนฐาน `bcdemo`.
- Google: `handleTriggerGoogleSignIn` (217-269) ถ้ายังไม่ตั้ง env `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (31) แสดง "ยังไม่ได้ตั้งค่า Google OAuth Client ID สำหรับโดเมนนี้" (219-224) ไม่งั้นโหลดสคริปต์ Google Identity Services (227, 258-268) แล้ว `initialize` แบบ popup (232-240) + `prompt()` (241-243). เมื่อได้ `credential` (idToken) เรียก `handleGoogleCredential` (188-209) -> `apiPost("/api/auth/google", {idToken, provider: "bcdemo"})` สำเร็จแล้วไป `/select-database` (แนบ `?returnTo=` เมื่อ returnTo ไม่ใช่ `/home`, 203-206) เพราะต้องเลือกฐานก่อน.
- ฝั่ง route Google (`api/auth/google/route.ts`): `POST` (210-295) ตอบ `NO_ID_TOKEN` ถ้าไม่มี idToken (229-231), ตรวจ idToken กับ `oauth2.googleapis.com/tokeninfo` (233-238), ต้องมี `aud` ตรงกับ Client ID ของเว็บ (248-254) และอีเมลยืนยันแล้ว (255-257) จึงเรียก `completeGoogleWorkspaceSession` (268). มีทาง `GET ?action=redirect` (109-123) สำหรับ OAuth แบบ redirect พร้อม cookie state กัน CSRF (47-58) แต่ปุ่มบนหน้า `/login` ไม่ได้เรียกทางนี้ - ดู [[fe-auth-session]].
- สถานะ `demoBusy` / `googleBusy` (149-150): ปุ่ม Demo ปิดเมื่อฝั่งใดฝั่งหนึ่งกำลังทำงาน (659), ปุ่ม Google ปิดเมื่อ `googleBusy` (749); ข้อผิดพลาดแสดงใน `<p role="alert">` (795-806).
- จุดสังเกต: โหมด admin ของ `/api/auth/login` (`mode: "admin"`, `api/auth/login/route.ts:18`) มีใน API แต่ไม่พบปุ่มเรียกใน `login/page.tsx` และไม่พบโค้ด UI อื่นใน `frontend/` ที่เรียก path นี้ (พบเพียงการยกเว้น path นี้ใน `api-client.ts:114,135` และ `PersistentWorkspaceHost.tsx:351`).

**`returnTo` และกัน open redirect**
- `safeReturnPath(raw, fallback="/home")` (`src/lib/safe-return.ts:6-13`) ยอมรับเฉพาะ path ภายในที่ขึ้นต้นด้วย `/` และไม่ใช่ `//`, `/\`, ไม่มี `\` หรือ control char; ไม่ผ่านใช้ `/home`.
- login อ่าน `?returnTo=` ก่อน แล้ว fallback เป็น `sessionStorage["bc_return_to"]` (`resolveReturnTo`, `login/page.tsx:157-169`); ค่านี้ถูกตั้งโดย host ตอน session หมดอายุ (`PersistentWorkspaceHost.tsx:287-296,306-312`; [[fe-app-shell-routing]]) และถูกลบหลัง Demo สำเร็จ (`login/page.tsx:182`) หรือหลังเลือกฐานสำเร็จ (`select-database/page.tsx:251-253`) - ทาง Google ค่านี้ยังค้างอยู่จนถึงหน้าเลือกฐาน.

**หน้า `/select-database`** (`src/app/select-database/page.tsx`, 1440 บรรทัด, `SelectDatabasePage` 88)
| งาน | endpoint ที่เรียก | บรรทัด |
|---|---|---|
| โหลด session + รายการฐานข้อมูลที่ฉันเข้าถึงได้ (ทั้ง Admin และ Member) | `GET /api/auth/session`, `GET /api/auth/databases` | 137-182 (`NO_SESSION` กลับ `/login`, 176-178) |
| ตรวจชื่อฐานซ้ำแบบ real-time (หน่วง 220 ms) | `GET /api/workspace/check-db-name?name=` | 189-218 |
| เลือกฐาน | `POST /api/workspace/select-db` (สำรอง `POST /api/auth/databases`) | 220-256 |
| ลองใช้ Demo | `POST /api/auth/demo` แล้วไป `/home` | 258-269 |
| สร้างฐานใหม่ (`database_code`, `database_name`, `company_name`) | `POST /api/workspace/databases` | 271-306 |
| สมาชิกของฐาน (ดู/เชิญ/เปลี่ยนบทบาท/ลบ) | `GET` / `POST` / `DELETE /api/workspace/members` | 323-344, 346-386, 388-410, 412-426 |
| สิทธิ์จอรายผู้ใช้ | `GET` / `PUT /api/workspace/screen-rights` | 429-451, 542-567 |
| ออกจากระบบ | `POST /api/auth/logout` แล้วไป `/login` | 569-572 |
- บทบาทต่อฐานมี 2 แบบ `ADMIN | MEMBER` (`WorkspaceMember` 36-43; ค่าเริ่ม `MEMBER` 170). การ์ดฐานแสดงป้าย Admin/Member (841-857) กับรหัสผู้ใช้ BC ที่ผูก (`mapped_user_code`, 862-866); ปุ่ม "เข้าใช้งานฐานข้อมูล" (880-891) มีทุกบทบาท ส่วนปุ่ม "สมาชิก & สิทธิ์จอ" (893-903) เฉพาะ Admin.
- แถบหัวหน้า: ป้ายบัญชีที่ล็อกอิน + จำนวนฐาน (Admin/Member, 603-617), ปุ่มบอลลูนช่วยเหลือ (632-633), ปุ่ม MCP Token ไป `/mcp-tokens` (657-663), ปุ่ม Demo (668-678), "สร้างข้อมูลใหม่" (683-694), "ออกจากระบบ" (699-704).
- สร้างฐานใหม่ (modal 917-1032): ชื่อฐานเป็นตัวพิมพ์เล็ก (273) `a-z, 0-9, _` (placeholder 942; ข้อความเตือน 276), ถ้าชื่อซ้ำจะไม่ส่ง (279-282); ไม่กรอกชื่อกิจการ ใช้ "กิจการ <CODE>" (274); สำเร็จแล้วโหลดรายการใหม่ (305).
- modal จัดการสมาชิก (1037-1437) มี 2 แท็บ `members` / `permissions` (1053, 1067). แท็บสมาชิก: ฟอร์มเชิญด้วยอีเมล + บทบาท + รหัสผู้ใช้ BC (1110-1163; อีเมลต้องมี `@`, 354) และตารางสมาชิกที่เปลี่ยนบทบาท/ลบได้ (1185-1246); เชิญเป็น MEMBER แล้วตั้งผู้ใช้เป้าหมายของแท็บสิทธิ์เป็นรหัสที่ผูก (382-384). แท็บสิทธิ์: เลือกผู้ใช้ BC, หมวดเมนู, ค้นหา (1280-1312), ปุ่มให้ทั้งหมด/อ่านอย่างเดียว/ล้าง (`applyBulkRights` 498-540) และตารางอ่าน/เพิ่ม/แก้ไข/ลบต่อจอ (1367-1430; แสดงสูงสุด 250 แถว, 1378).
- รายการจอมาจากใบเมนูทั้งหมดใน `bcMenu` (`ALL_MENU_LEAVES` 86, `collectAllLeaves` 67-84 แสดงรหัสเมนูจริง `n.code`); สิทธิ์เก็บเป็นแผนที่ตาม "ชื่อเมนู" `menu_*` (472-494, 547-557) ไม่ใช่ตามรหัสตัวเลข. จอที่ `isAdminOnlyMenu` (470, 502, 1380) ล็อกเป็น "เฉพาะ Admin" ติ๊กไม่ได้ (1399-1405). เปิดเพิ่ม/แก้ไข/ลบจะเปิด "อ่าน" ให้อัตโนมัติ และปิด "อ่าน" จะปิดอีก 3 สิทธิ์ (484-493).
- เมื่อเลือกฐานเสร็จ อ่าน `returnTo` แบบเดียวกับหน้า login แล้ว `safeReturnPath` -> `router.replace` + `router.refresh()` (240-255).
- พาธ `/api/workspace/*` ผ่าน catch-all `src/app/api/workspace/[...path]/route.ts` ไปยัง backend `/api/v1/admin/workspace/*` ([[fe-api-proxy-routes]]): GET `databases` (85), `check-db-name` (102), `members` (116), `screen-rights` (134, ส่งต่อ `/api/v1/admin/menu-permissions`), `my-screen-rights` (156); POST `databases` (208), `select-db` (246), `members` (336); PUT `screen-rights` (384); DELETE `members` (424).

**ข้อควรระวัง**
- ถ้า session ไม่มี `database` layout ของ `(app)` จะ redirect กลับ `/select-database` ทุกครั้ง (`(app)/layout.tsx:15-18`; ไม่มี session -> `/login`, โหมด admin -> `/admin`; [[fe-app-shell-routing]]).
- ชื่อฐานข้อมูลต้องเป็นอังกฤษตัวพิมพ์เล็ก/ตัวเลข (ข้อความเตือน `select-database/page.tsx:276`) และห้ามซ้ำ (ตรวจผ่าน `check-db-name`).
- ค่า Client ID ของ Google อยู่ใน env `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (ฝั่งหน้า) และ `GOOGLE_CLIENT_ID` (ฝั่ง route); ไม่มีค่าใดฝังในโค้ดหน้า login.

## ที่มาในโค้ด
- `frontend/src/app/login/page.tsx:31,142-269,613-842` - Demo/Google login, หน้าจอ
- `frontend/src/app/api/auth/google/route.ts:40-125,210-295` - ตรวจ idToken, redirect OAuth
- `frontend/src/app/api/auth/demo/route.ts:9-39` - mint session demo
- `frontend/src/lib/safe-return.ts:6-13` - กัน open redirect
- `frontend/src/app/select-database/page.tsx:36-86,137-306,308-572,576-905,917-1437` - เลือก/สร้างฐาน/สมาชิก/สิทธิ์
- `frontend/src/app/api/workspace/[...path]/route.ts:67-448` - proxy `/api/workspace/*`
- `frontend/src/app/(app)/layout.tsx:15-18` - บังคับเลือกฐานก่อนเข้า `(app)`

## ดูเพิ่ม
[[frontend-overview]] · [[fe-auth-session]] · [[fe-app-shell-routing]] · [[fe-api-proxy-routes]] · [[fe-admin-console]]
