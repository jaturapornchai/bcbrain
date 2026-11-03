---
title: "เปลี่ยนรหัสผ่าน (ChangePasswordScreen)"
tags: [screens, admin]
aliases: ["ChangePasswordScreen", "SelfChangePasswordScreen", "ChangePasswordForm", "1095", "menu_change_password", "menu_saletools_change_password", "เปลี่ยนรหัสผ่านของฉัน", "/admin/change-password"]
sources: ["frontend/account/tabs/screenRegistry.tsx:426", "frontend/account/tabs/screenRegistry.tsx:434", "frontend/account/admin/screens/ChangePasswordScreen.tsx:20", "frontend/account/admin/screens/ChangePasswordScreen.tsx:160", "frontend/account/admin/screens/ChangePasswordScreen.tsx:406", "frontend/src/app/(admin)/admin/change-password/page.tsx:2"]
---
# เปลี่ยนรหัสผ่าน (ChangePasswordScreen)

คอมโพเนนต์เดียวที่ทำงานเป็น 2 จอ ขึ้นกับว่ามี `menuCode` ส่งเข้ามาหรือไม่ (`ChangePasswordScreen.tsx:406-433`)
- **มี `menuCode`** (เปิดจากเมนู ERP) = จอ "เปลี่ยนรหัสผ่านของฉัน" `SelfChangePasswordScreen` ผู้ใช้เปลี่ยนรหัสของตัวเอง
- **ไม่มี `menuCode`** (เปิดจาก `/admin/change-password`) = จอผู้ดูแลระบบ `ChangePasswordForm` ตั้งรหัสใหม่ให้ผู้ใช้คนอื่น ห่อด้วย `ProviderScopedScreen` (เลือก Provider ก่อน, หมายเหตุ "ตั้งรหัสผ่านใหม่ให้ผู้ใช้ในระบบ" `:429`) ดู [[scr-admin-console]]

## วิธีเปิด
- เมนู ERP **ตั้งค่า > จัดการฐานข้อมูลและสิทธิ์ผู้ใช้ > เปลี่ยนรหัสผ่าน** รหัส `1095` (`menu_change_password`) ผูกที่ `screenRegistry.tsx:426-433`
- มีรายการที่สองใน registry `menu_saletools_change_password` ชื่อ "Change Password" (`screenRegistry.tsx:434-441`) ใช้คอมโพเนนต์เดียวกัน ชื่อนี้ไม่มีใน `bcMenu.json` แต่ `LEGACY_MENU_ALIASES` ให้ชี้ไป `menu_change_password` (`bcMenu.ts:247`) จึงเป็นทางเข้าสำรองของเมนูเดียวกัน
- หน้า `/admin/change-password` เป็นเพจ Next.js ที่เรียก `ChangePasswordScreen` ตรง ๆ (`src/app/(admin)/admin/change-password/page.tsx`)
- กลไกเมนู/รหัสดู [[fe-screen-registry-menu]]

## จอ "เปลี่ยนรหัสผ่านของฉัน" (SelfChangePasswordScreen, `:160-402`)
หัวจอมีรหัสเมนู + ชื่อเมนูสีเขียว และแถบปุ่ม **บันทึก** กับ **ปิดหน้าจอ** (`:243-277`) ป้าย "โหมดแก้ไข" ใช้รูปแบบเดียวกับจอตั้งค่า ERP แต่ **ไม่มีคีย์ลัด Ctrl+S / Esc** (ไฟล์นี้ไม่ใช้ `ScreenHeader`)
- ตอนเปิดเรียก `GET /api/auth/change-password` ได้ข้อมูล `{provider, userCode, userName, email, isGoogleUser, isDemo}` (`:10-19,182`) แสดง "บัญชีผู้ใช้งานปัจจุบัน: <รหัส> — <ชื่อ>"
- **บัญชีที่เข้าด้วย Google** (`isGoogleUser`): ซ่อนฟอร์มรหัสผ่านและปุ่มบันทึก (`showPasswordForm`, `:196,253`) แสดงข้อความว่าบัญชีนี้ยืนยันตัวตนผ่าน Google โดยตรง และปุ่ม "เปิดหน้าความปลอดภัยของบัญชี Google" ให้ไปเปลี่ยนรหัส/ตั้ง 2 ขั้นตอนที่ Google (`:311-324`)
- **ช่องกรอก**: รหัสผ่านเดิม, รหัสผ่านใหม่, ยืนยันรหัสผ่านใหม่ (ช่อง password ทั้งหมด `:332-366`)
- **ตรวจก่อนส่ง** (`handleSubmit`, `:198-240`) ตามลำดับ
  1. โหมดสาธิต (`isDemo`): ขึ้นข้อความว่าไม่อนุญาตให้เปลี่ยนรหัสผ่านของบัญชีสาธิต (`:201-202`)
  2. ไม่กรอกรหัสเดิม: "กรุณากรอกรหัสผ่านเดิม"
  3. รหัสใหม่กับยืนยันไม่ตรงกัน: "รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน"
  4. รหัสใหม่ซ้ำกับรหัสเดิม: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม"
- ผ่านแล้วส่ง `POST /api/auth/change-password` (`:224`) สำเร็จขึ้น "เปลี่ยนรหัสผ่านของคุณเรียบร้อยแล้ว"

## จอผู้ดูแล (ChangePasswordForm, `:20-158`)
- ฟอร์ม "เปลี่ยนรหัสผ่านผู้ใช้": ผู้ใช้ (dropdown `รหัส — ชื่อ`, ต่อท้าย "(ผู้ดูแลระบบ)" ถ้าสิทธิ์ >= 9), รหัสผ่านใหม่, ยืนยันรหัสผ่านใหม่ (`:93-132`) ปุ่ม **เปลี่ยนรหัสผ่าน**
- โหลดรายชื่อจาก `GET /api/admin/users?provider=..` (`:39-40`) และบันทึกด้วย `PATCH /api/admin/users` (`:66`)
- ตรวจ: ไม่เลือกผู้ใช้ "กรุณาเลือกผู้ใช้" / สองช่องไม่ตรง "รหัสผ่านทั้งสองช่องไม่ตรงกัน" (`:59-61`) สำเร็จ `เปลี่ยนรหัสผ่านของ "<รหัส>" เรียบร้อยแล้ว` (`:79`)
- จอนี้ **ไม่ถามรหัสเดิม** ผู้ดูแลตั้งทับได้เลย
- ตารางผู้ใช้อ้างอิง `bc_user_list` ของ auth database ([[tbl-bc-user-list]])

## ข้อควรระวัง
- ข้อความ error จาก API ถูกแสดงเหนือฟอร์มตรง ๆ (`setError(result.error)`) ข้อความที่ผู้ใช้เห็นขึ้นกับฝั่ง server
- บัญชี Google ไม่มีรหัสผ่านในระบบนี้ จึงไม่ควรไปหาปุ่มบันทึกในจอของตัวเอง

## ที่มาในโค้ด
- `frontend/account/tabs/screenRegistry.tsx:426-441` — สองรายการเมนูที่ผูกกับจอนี้
- `frontend/account/admin/screens/ChangePasswordScreen.tsx:20-158` (จอผู้ดูแล), `:160-402` (จอของฉัน), `:406-435` (ตัวเลือกจอ)
- `frontend/src/app/(admin)/admin/change-password/page.tsx` — เส้นทาง `/admin/change-password`
- ดูเพิ่ม: [[scr-admin-console]] · [[scr-mcp-token]] · [[fe-screen-registry-menu]] · [[screens-overview]]
