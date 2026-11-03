---
title: "บทเรียนบั๊กสิทธิ์และการข้ามฐานข้อมูล (Auth Bypass, Cross-Tenant, Demo Read-Only, Screen Rights)"
tags: [standards, security, lessons, auth, multi-tenant, bugs]
aliases: ["demo อ่านอย่างเดียว", "DEMO_READ_ONLY", "requireSystemAdmin", "สิทธิ์จอแยกต่อฐานข้อมูล", "OAuth state", "NO_ADMIN_API_KEY", "IDOR"]
sources: ["docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md", "frontend/src/app/api/auth/google/route.ts", "frontend/src/app/api/workspace/[...path]/route.ts", "frontend/src/app/api/auth/change-password/route.ts", "backend/internal/adapter/inbound/http/blob/handler.go", "backend/internal/adapter/inbound/http/monitormap/handler.go", "backend/internal/adapter/inbound/http/admin/menu_permissions.go"]
---

# บทเรียนบั๊กสิทธิ์และการข้ามฐานข้อมูล

รวมบั๊กที่ตรวจพบและแก้แล้วในรอบ 2026-10-24 (branch `dev`) ด้านการยืนยันตัวตน การแบ่งสิทธิ์ และการแยกฐานข้อมูล พร้อมกฎที่ต้องจำ เช็กลิสต์ใช้งานจริงอยู่ที่ [[std-security-authz-and-web-vulns]]

## บั๊ก → วิธีแก้ → กฎที่ต้องจำ
| รหัส | อาการ | วิธีแก้ | กฎ |
|---|---|---|---|
| S1 | Google login เชื่อตัวตนจาก body (ไม่ตรวจ `idToken`) | บังคับ `idToken`, ตรวจ `aud` และ `email_verified` | ตัวตนต้องมาจากข้อมูลที่ตรวจแล้ว ห้ามเชื่อ body |
| S2 | route ที่เรียก backend ด้วยกุญแจ Admin ตรวจแค่มี session | `isWorkspaceAdmin()` ตรวจว่าเป็น Admin ของฐานนั้นจริง (Demo ถูกปฏิเสธ) | route ที่ใช้กุญแจ Admin ต้องตรวจ Admin ฝั่ง server |
| B1 | ทางเขียนจากเบราว์เซอร์บางทางไม่ผ่านนโยบาย write lockdown | ใช้ `ValidateClientInsert()` ตัวเดียวกับ `/query/exec` | ทุกทางเขียนจากเบราว์เซอร์ใช้นโยบายเดียวกัน |
| B2 | route ที่ไม่ต้อง login ให้ผู้เรียกเลือกฐานข้อมูลบริษัทเองได้ | ผู้ไม่ login ถูกตรึงที่ `bcdemo` | ห้ามให้ผู้เรียกเลือก tenant เองเมื่อไม่ยืนยันตัวตน |

## รอบที่ 2: เสริมเกราะ Auth/API
- `getAdminApiKey()` ไม่ส่งกุญแจ dev ใน production (ตอบ 503 `NO_ADMIN_API_KEY`)
- Google OAuth redirect มี `state` (cookie + `timingSafeEqual`) กัน login CSRF
- `/api/auth/databases` ตรวจว่าฐานข้อมูลอยู่ใน `availableCompanies` ของผู้ใช้
- `/api/admin/*` ใช้ `requireSystemAdmin()` (ต้อง `session.mode === "admin"`); `/api/fraudwarning|workmonitor` ต้องมี session; `/api/monitormap/tile` POST ต้อง login และ single-flight
- `POST /api/workspace/databases` ใช้ `session.email` เท่านั้น (ไม่รับอีเมลจาก client)

## รอบที่ 3 และการตัดสินใจของลุงจืด (2026-10-24)
- **สิทธิ์จอแยกต่อฐานข้อมูล**: เพิ่มคอลัมน์ `database_name` ใน `bc_permissions_user` / `bc_permissions_group`; Backend บังคับสิทธิ์ Add/Edit/Delete บน `/process/*` (`doc/save`, `stocktools/pointdocsave`, `stocktools/stockbeginningsave`), `/query/exec`, `/query/execBatch`, `/blob/insert`; ฝั่งหน้าจอผูก `useScreenRights()` ทุกจอ (เดิม `TabsContext.screenRights` บังคับแค่ฝั่งหน้าจอ backend ต้องตรวจซ้ำเสมอ) — ไฟล์ที่เกี่ยวข้อง `admin/menu_permissions.go`, `admin/workspace_google.go`
- **โหมดสาธิตดูระบบส่วนกลางได้แต่ห้ามเพิ่ม/แก้ไข/ลบ**: `isDemoCentralViewer()` (ปุ่ม Demo, โดเมนสาธิต, บัญชีสาธารณะของ `bcdemo`); GET ใช้ `requireSystemAdminView()` + ล็อก provider `bcdemo` + ตัดฟิลด์ลับ (`demoSafe`); เขียนทุกชนิดได้ 403 `DEMO_READ_ONLY`; โซน `/admin` มีแถบ "ดูอย่างเดียว"
- **Login ผู้ดูแลส่วนกลาง** (`mode: "admin"`) แยกจากปุ่ม Google และปฏิเสธบัญชีสาธิต (`DEMO_ADMIN_FORBIDDEN`); **เปลี่ยนรหัสผ่านตัวเอง** ผ่าน `/api/auth/change-password` ตรวจรหัสเดิมก่อน (บัญชี Google ให้ไปเปลี่ยนที่ Google)

## ที่มา
- `docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md` ตาราง S1–S2, B1–B2, รอบที่ 2–3, "การตัดสินใจของลุงจืด" ข้อ 1, 3
- ตรวจแล้วมีจริง: `frontend/src/app/api/workspace/[...path]`, `frontend/src/app/api/auth/change-password/route.ts`, `backend/.../admin/menu_permissions.go`, `blob/handler.go`

## ดูเพิ่ม
[[standards-overview]] · [[std-security-authz-and-web-vulns]] · [[std-platform-google-login-pdpa-hub]] · [[std-data-integrity-money-transactions]] · [[backend-overview]]
