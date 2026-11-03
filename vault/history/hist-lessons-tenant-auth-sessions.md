---
title: "บทเรียนตัวตนผู้เช่า การล็อกอิน และ session (Tenant, Auth & Sessions)"
tags: [history, lesson, auth, tenant, session, security]
aliases: ["refresh token rotation", "session expired", "Google ID token", "OAuth state", "requireSystemAdmin", "ADMIN_API_KEY fail-closed", "DB_FORBIDDEN"]
sources: ["frontend/src/lib/api-server.ts:74", "frontend/src/lib/api-server.ts:103", "frontend/src/lib/api-server.ts:277", "frontend/src/lib/api-server.ts:373", "frontend/src/app/api/auth/google/route.ts:52", "frontend/src/app/api/auth/google/route.ts:230", "frontend/src/app/api/auth/google/route.ts:252", "frontend/src/app/api/auth/google/oauth-state.ts:7", "frontend/src/app/api/auth/google/oauth-state.test.ts:12", "frontend/src/app/api/auth/databases/route.ts:289", "frontend/src/app/api/workspace/[...path]/route.ts:28", "frontend/src/app/api/workmonitor/route.ts:27", "frontend/src/app/api/auth/change-password/route.ts:36", "frontend/src/lib/api-client.ts:77", "frontend/shared/layout/PersistentWorkspaceHost.tsx:279", "backend/internal/application/identity/service.go:194", "backend/internal/application/identity/service.go:254", "backend/internal/domain/identity/identity.go:50", "backend/internal/domain/identity/identity.go:64", "backend/internal/adapter/inbound/http/admin/handler.go:283", "backend/internal/adapter/inbound/http/monitormap/handler.go:114"]
---

# ตัวตนผู้เช่า การล็อกอิน และ session

ระบบนี้แยกผู้เช่า (provider) และฐานข้อมูลบริษัทต่อ session ผู้ใช้ทุกคนถือ token ที่ผูกกับ provider/ฐานข้อมูลหนึ่งชุด ตัวตนต้องมาจากผลตรวจ token ฝั่ง server ไม่ใช่ข้อมูลที่ browser ส่งมาเอง บันทึกนี้เก็บด่านที่ยังเห็นในโค้ดวันนี้

## อะไรพังได้
- **token หมดอายุกลางงาน:** ผู้ใช้เด้งออกจากหน้าที่กำลังทำโดยไม่รู้ตัว
- **คำขอขนานแย่งหมุน refresh token:** refresh token ใช้ได้ครั้งเดียว ถ้าสองคำขอหมุนพร้อมกัน ตัวที่สองล้มและผู้ใช้หลุด
- **token ยังใช้ได้หลังผู้ใช้ถูกปิดหรือถอดสิทธิ์:** ถ้า refresh ต่ออายุโดยไม่ตรวจซ้ำ
- **ล็อกอิน Google ที่เชื่อข้อมูลจาก client:** อีเมลที่ไม่ผ่านการตรวจ, token ที่ออกให้ client อื่น, callback ที่ไม่มี `state` (login CSRF)
- **กุญแจผู้ดูแลมีค่า default ใน production:** ไม่ตั้ง `ADMIN_API_KEY` แล้วเงียบๆ ใช้ค่าสำรอง
- **"Admin" ปนกันสองความหมาย:** ผู้ดูแล workspace กับผู้ดูแลส่วนกลาง ถ้าใช้ตัวตรวจเดียวกันจะเข้าส่วนกลางได้
- **ผู้เรียกเลือกผู้เช่าเอง:** route ที่ไม่มี Auth หรือ endpoint สลับฐานที่รับชื่อฐานจาก body โดยไม่เทียบรายชื่อที่เข้าได้
- **รหัสผ่านเก็บตามที่กรอก:** ไม่มี hash ตอนเขียน

## โค้ดป้องกันไว้อย่างไร
| ด่าน | ที่อยู่ | ทำอะไร |
|---|---|---|
| refresh แบบ single-flight | `frontend/src/lib/api-server.ts:103` `rotateRefreshToken` (map `inFlightRefresh` `:93`, แคชผลล่าสุด `RECENT_REFRESH_TTL_MS` 60 วินาที `:101`) | คำขอที่มี refresh token เดียวกันรอผลของคำขอแรก ไม่หมุนซ้ำ |
| backend หมุนและตรวจซ้ำ | `backend/internal/application/identity/service.go:254` `Refresh`, `:194` `verifySession` | ผู้ใช้ต้องยัง active และยังมีสิทธิ์เข้าบริษัทนั้น; refresh token ที่ใช้แล้วถูกเพิกถอน เล่นซ้ำไม่ได้ |
| 401 แล้วกลับหน้าเดิม | `frontend/src/lib/api-client.ts:77` `notifySessionExpired` (เรียกที่ `:115,138`); `frontend/shared/layout/PersistentWorkspaceHost.tsx:279-300,369,456` | เก็บหน้าปัจจุบันใน `sessionStorage` (`bc_return_to`), ยิงเหตุการณ์ `bc:session-expired`, แสดง modal ให้ล็อกอินใหม่แล้ว `returnTo` กลับหน้าเดิม |
| `state` ของ Google OAuth | `frontend/src/app/api/auth/google/route.ts:24-29,111-115`, `:52-58`; `oauth-state.ts:7-24` | cookie `httpOnly` sameSite=lax อายุ 10 นาที, ลบทันทีที่ callback อ่านไม่ว่าผลเป็นอย่างไร, เทียบแบบ constant-time (`timingSafeEqual`) |
| ตรวจ Google ID token | `google/route.ts:230` (`NO_ID_TOKEN`), `:252` (`aud` ต้องเป็น Client ID ของเว็บนี้), `:255` (`email_verified`); callback `:89` | อีเมลมาจาก token ที่ตรวจแล้วเท่านั้น ไม่รับอีเมลจาก body |
| กุญแจผู้ดูแล fail-closed | `frontend/src/lib/api-server.ts:74-86` `getAdminApiKey`, `adminApiKeyMissing` | production ไม่ตั้ง `ADMIN_API_KEY` → คืน `null` และตอบ 503 `NO_ADMIN_API_KEY` (ใช้ที่ `google/route.ts:212`, `workspace/[...path]/route.ts:83`, `frontend/src/app/api/auth/databases/route.ts:34,120`) |
| ผู้ดูแลส่วนกลางแยกจากผู้ดูแล workspace | `api-server.ts:373` `requireSystemAdmin` (`session.mode === "admin"`, สาธิต = `DEMO_READ_ONLY` `:380`, ไม่ใช่ = `NOT_SYSTEM_ADMIN` `:387`), `:277` `requireAdmin` (user_level ≥ 9 หรือ role ADMIN) | route ใน `frontend/src/app/api/admin/` เรียก `requireSystemAdmin`; route workspace ใช้ `isWorkspaceAdmin` (`workspace/[...path]/route.ts:28`, ใช้ที่ `:118,136,386`) เพราะ backend ตรวจแค่กุญแจ |
| สลับฐานต้องอยู่ในรายชื่อที่เข้าได้ | `frontend/src/app/api/auth/databases/route.ts:289-297,327` | ไม่อยู่ใน `availableCompanies` และไม่ใช่ฐานปัจจุบัน → 403 `DB_FORBIDDEN` |
| route แผนที่ไม่ให้เลือกผู้เช่า | `backend/internal/adapter/inbound/http/monitormap/handler.go:114-124` `resolveClaims` | ไม่มี claims → ใช้ฐานสาธิตร่วมเสมอ ไม่รับ `?db=`/`?provider=` |
| telemetry ต้องมี session | `frontend/src/app/api/workmonitor/route.ts:27-31`, `fraudwarning/route.ts:24-28`, `workmonitor/stream/route.ts:21-25` | ไม่มี `session.database` → 401 |
| รหัสผ่านเป็น bcrypt | `backend/internal/domain/identity/identity.go:50` `HashPassword`, `:64-72` `Authenticate`; `backend/internal/adapter/inbound/http/admin/handler.go:283,340` | admin สร้าง/แก้ผู้ใช้แล้ว hash ก่อนเก็บ; ล็อกอินเทียบ bcrypt (ยังรองรับรหัสเดิมแบบไม่ hash ด้วย constant-time compare) |
| เปลี่ยนรหัสผ่านต้องยืนยันรหัสเดิม | `frontend/src/app/api/auth/change-password/route.ts:36-90` | ยืนยันรหัสเดิมผ่าน `/auth/login`; โหมดสาธิตและบัญชี Google ถูกปฏิเสธ (`DEMO_READ_ONLY`, `GOOGLE_ACCOUNT_PASSWORD`) |
| เทสต์ | `google/oauth-state.test.ts:12,19` | จับคู่ `state` ต้องตรงเป๊ะ ขาดค่าใดค่าหนึ่งถูกปฏิเสธ |

## กฎที่ต้องจำ
1. ผู้เช่ามาจาก session เท่านั้น ห้ามรับจาก query string, body หรือ default ที่หละหลวม ถ้าจำเป็นต้องมี default (route แผนที่) ให้ล็อกเป็นฐานสาธิต
2. ตัวตนต้องมาจากผลตรวจ token (`aud`, `email_verified`) ไม่ใช่ข้อมูลที่ client ส่ง
3. กุญแจระบบไม่มี fallback ใน production ให้ fail-closed (503)
4. ผู้ดูแลส่วนกลางกับผู้ดูแล workspace ใช้ตัวตรวจคนละตัว (`requireSystemAdmin` vs `isWorkspaceAdmin`)
5. refresh token ใช้ครั้งเดียว: ฝั่ง Next ต้อง single-flight ฝั่ง backend ต้องตรวจผู้ใช้/สิทธิ์ซ้ำก่อนออก token ใหม่
6. 401 ต้องจำหน้าที่ทำอยู่แล้วพากลับหลังล็อกอินใหม่ (ดู [[hist-lessons-web-vulns-xss-redirect]] เรื่องการตรวจ `returnTo`)

## ที่มาในโค้ด
- `frontend/src/lib/api-server.ts:74-86,93-101,103,277,373-390` กุญแจ, refresh, ผู้ดูแล
- `frontend/src/app/api/auth/google/route.ts:24-29,52-58,89,111-115,212,230,252-255` และ `oauth-state.ts:7-24`
- `frontend/src/app/api/auth/databases/route.ts:289-297,327`, `frontend/src/app/api/workspace/[...path]/route.ts:28,83,118,136,386`
- `backend/internal/application/identity/service.go:194-231,254` ตรวจ session และหมุน token
- `backend/internal/adapter/inbound/http/monitormap/handler.go:114-124`, `backend/internal/domain/identity/identity.go:50-72`
- ดูเพิ่ม: [[adr-0003-per-tenant-identity]] · [[fe-auth-session]] · [[std-platform-google-login-pdpa-hub]] · [[hist-lessons-permission-rights]] · [[hist-lessons-web-vulns-xss-redirect]]
