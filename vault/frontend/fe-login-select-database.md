---
title: "หน้าเข้าสู่ระบบและเลือกฐานข้อมูล (Login & select database)"
tags: [frontend, login, google, demo, select-database, workspace]
aliases: ["login", "หน้า login", "เลือกฐานข้อมูล", "select-database", "returnTo", "safeReturnPath", "สร้างฐานข้อมูลใหม่", "Google login", "demo login", "สมาชิกฐานข้อมูล"]
sources: ["frontend/src/app/login/page.tsx:69", "frontend/src/app/login/page.tsx:90", "frontend/src/app/login/page.tsx:107", "frontend/src/lib/safe-return.ts:6", "frontend/src/app/select-database/page.tsx:141", "frontend/src/app/select-database/page.tsx:224", "frontend/src/app/select-database/page.tsx:286", "frontend/src/app/api/workspace/[...path]/route.ts"]
---

# หน้าเข้าสู่ระบบและเลือกฐานข้อมูล (Login & select database)

ผู้ใช้เข้าระบบสองขั้น: (1) `/login` ยืนยันตัวตน (2) `/select-database` เลือก/สร้าง "ฐานข้อมูล" (workspace) ที่จะทำงานด้วย แล้วจึงเข้า `/home`
ปุ่มที่หน้า `/login` มีแค่ 2 ทางคือ "ทดลองใช้งานทันที (Demo)" และ "ดำเนินการต่อด้วย Google" (ไม่มีช่องกรอกรหัสผ่านใน UI ที่อ่าน)

## ทำงานอย่างไร

**หน้า `/login`** (`src/app/login/page.tsx`)
- Demo: ปุ่ม `handleDemoLogin` (บรรทัด 90-105) เรียก `apiPost("/api/auth/demo")` แล้ว `router.replace(safeReturnTo)` + `router.refresh()`. ใช้ฐาน `bcdemo` (ข้อความบนปุ่ม บรรทัด 414).
- Google: ปุ่ม `handleTriggerGoogleSignIn` (บรรทัด 136-165) โหลดสคริปต์ Google Identity Services แล้วได้ `credential` (idToken) ส่งให้ `handleGoogleCredential` (บรรทัด 107-128) -> `apiPost("/api/auth/google", {...})`. สำเร็จแล้วไป `/select-database?returnTo=...` (บรรทัด 124) เพราะต้องเลือกฐานก่อน. ถ้ายังไม่ตั้ง Client ID จะแสดงข้อความ error (บรรทัด 139). มี route แบบ redirect (`GET ?action=redirect` + cookie `bc_google_oauth_state`) ด้วย - ดู [[fe-auth-session]].
- สถานะ `demoBusy` / `googleBusy` กันกดซ้ำและ disable ปุ่มอีกฝั่ง (บรรทัด 69-70, 401).
- จุดสังเกต: โหมด admin ของ `/api/auth/login` (รหัสผู้ใช้ + รหัสผ่าน) มีใน API แต่ไม่พบปุ่มเรียกใน `login/page.tsx` (ยังไม่ยืนยันว่ามีทางเข้า UI อื่น).

**`returnTo` และกัน open redirect**
- `safeReturnPath(raw, fallback="/home")` (`src/lib/safe-return.ts:6-13`) ยอมรับเฉพาะ path ภายในที่ขึ้นต้นด้วย `/` และไม่ใช่ `//`, `/\`, ไม่มี `\` หรือ control char; ไม่ผ่านใช้ `/home`.
- login อ่าน `?returnTo=` ก่อน แล้ว fallback เป็น `sessionStorage["bc_return_to"]` (`login/page.tsx:82-87`); ค่านี้ถูกตั้งโดย host ตอน session หมดอายุ ([[fe-app-shell-routing]]) และถูกลบหลัง login สำเร็จ (บรรทัด 101).

**หน้า `/select-database`** (`src/app/select-database/page.tsx`)
| งาน | endpoint ที่เรียก | บรรทัด |
|---|---|---|
| โหลด session + รายการฐานข้อมูลของฉัน | `GET /api/auth/session`, `GET /api/auth/databases` | 141-142 |
| ตรวจชื่อฐานซ้ำแบบ real-time (debounce 220 ms) | `GET /api/workspace/check-db-name?name=` | 189-216 |
| เลือกฐาน | `POST /api/workspace/select-db` (สำรอง `POST /api/auth/databases`) | 224-231 |
| ลองใช้ Demo | `POST /api/auth/demo` | 261 |
| สร้างฐานใหม่ (`database_code`, `database_name`, `company_name`) | `POST /api/workspace/databases` | 286 |
| สมาชิกของฐาน (ดู/เชิญ/เปลี่ยนบทบาท/ลบ) | `GET/POST/DELETE /api/workspace/members` | 325, 362, 395, 417 |
| สิทธิ์จอรายผู้ใช้ | `GET/POST /api/workspace/screen-rights` | 433, 551 |
| ออกจากระบบ | `POST /api/auth/logout` | 570 |
- บทบาทต่อฐานมี 2 แบบ `ADMIN | MEMBER` (บรรทัด 39, 122). ผู้ถูกเชิญเป็น MEMBER ต้องมีการผูกกับรหัสผู้ใช้ BC (`mappedUserCode`) และตั้งสิทธิ์จอ (บรรทัด 335-401).
- เมื่อเลือกฐานเสร็จ ใช้ `safeReturnPath` เดิม แล้ว `router.replace` + `router.refresh()` (บรรทัด 245-255).
- พาธ `/api/workspace/*` ทั้งหมดผ่าน catch-all `src/app/api/workspace/[...path]/route.ts` ไปยัง backend ([[fe-api-proxy-routes]]).

**ข้อควรระวัง**
- ถ้า session ไม่มี `database` layout ของ `(app)` จะ redirect กลับ `/select-database` ทุกครั้ง ([[fe-app-shell-routing]]).
- ชื่อฐานข้อมูลต้องเป็นอังกฤษตัวพิมพ์เล็ก/ตัวเลข (ข้อความ error บรรทัด ~276) และห้ามซ้ำ (ตรวจผ่าน `check-db-name`).

## ที่มาในโค้ด
- `frontend/src/app/login/page.tsx:90-128,136-165` - demo/Google login
- `frontend/src/lib/safe-return.ts:6-13` - กัน open redirect
- `frontend/src/app/select-database/page.tsx:141-142,189-231,286,325-434` - เลือก/สร้างฐาน/สมาชิก/สิทธิ์
- `frontend/src/app/api/auth/demo/route.ts:11-15` - mint session demo

## ดูเพิ่ม
[[frontend-overview]] · [[fe-auth-session]] · [[fe-app-shell-routing]] · [[fe-api-proxy-routes]] · [[fe-admin-console]]
