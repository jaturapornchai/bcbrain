---
title: "สเปก Core REST APIs: Auth, Admin, Workspace, Public Bill Pay & AI"
audience: dev
tags: [api, auth, admin, workspace, public-bill, ai]
aliases: ["Auth API BC", "Admin API", "Public Bill Pay API", "Workspace API", "AI Chat SSE API"]
sources: ["backend/internal/adapter/inbound/http/router.go:65-175", "backend/internal/adapter/inbound/http/router.go:217-331", "backend/internal/adapter/inbound/http/identity/handler.go:1-259", "backend/internal/adapter/inbound/http/admin/handler.go:30-728", "backend/internal/adapter/inbound/http/language/handler.go:1-120", "backend/internal/adapter/inbound/http/tenant/handler.go:25-126", "backend/internal/adapter/inbound/http/process/public_bill_handler.go:1-45", "backend/internal/adapter/inbound/http/ai/handler.go:1-800", "backend/internal/adapter/inbound/http/companybrain/handler.go:1-318"]
---

เอกสารนี้สรุป Core Infrastructure Endpoints ที่ใช้ร่วมกันทั้ง Web App, Mobile, POS Backoffice และการเชื่อมต่อภายนอก

---

## 1. Authentication (`/auth/*`, `identity/handler.go`)

| Method & Path | Auth | หน้าที่ |
| :--- | :--- | :--- |
| `POST /auth/login` | Public | ตรวจสอบตัวตนผู้ใช้งานกับ Provider และคืน token ชั่วคราว + รายการฐานข้อมูล |
| `POST /auth/select-company` | Login Token | เลือกบริษัท (`databaseName`) เพื่อรับ Access JWT + Rotating Refresh Token |
| `POST /auth/refresh` | Refresh Token | หมุน Token ชุดใหม่ (Token เก่าจะถูก Revoke ทันที) |
| `POST /auth/logout` | Refresh/Bearer | เพิกถอน Refresh Token ใน File-backed Revocation Store |
| `GET /auth/me` | User JWT | อ่าน Profile และ Claims ของเซสชันปัจจุบัน (`provider`, `database`, `username`, `userLevel`) |

---

## 2. Admin & Multi-Tenant Management (`/admin/*`, `/api/v1/admin/*`)

ทุก Endpoint กลุ่มนี้บังคับผ่าน `AdminAuth` (`X-Admin-API-Key` หรือ Admin Token) (`router.go:116-123, 217-255`):

### Provider & Tenant Lifecycle (`tenant/handler.go`, `admin/handler.go`)
- `GET /admin/providers`, `POST /admin/providers` (รวม alias ใต้ `/api/v1/admin/providers` `GET`, `POST`, `PATCH`, `DELETE`) — จัดการ Provider Connection ของ Tenant
- `GET / POST / PATCH / DELETE /api/v1/admin/users` — จัดการผู้ใช้และสิทธิ์เข้าถึงฐานข้อมูลของกิจการ
- `GET / POST / PATCH / DELETE /api/v1/admin/databases` — จัดการทะเบียนฐานข้อมูลบริษัท
- `GET /api/v1/admin/database-info` — อ่านข้อมูลสรุปของฐานข้อมูล (`erp_company_profile`, `erp_option`, จำนวนพนักงาน)
- `POST /api/v1/admin/main-query` — คิวรีระดับการจัดการกลาง (Admin Only)
- `GET / PUT /api/v1/admin/menu-permissions` — อ่านและบันทึกสิทธิ์การเข้าถึงเมนูรายกลุ่ม/รายผู้ใช้

### Workspace & LINE OA Binding (`/api/v1/admin/workspace/*`)
- `POST /api/v1/admin/workspace/google-login` — เชื่อมสิทธิ์เข้าใช้งานผ่าน Google OAuth ใน Workspace
- `GET /api/v1/admin/workspace/databases`, `GET /check-db-name`, `POST /databases`, `POST /select-db` — จัดการฐานบริษัทใน Workspace
- `GET / POST / DELETE /api/v1/admin/workspace/members` — จัดการสมาชิกใน Workspace
- `GET /api/v1/admin/workspace/my-screen-rights` — ดึงสิทธิ์ระดับหน้าจอของเซสชัน
- `GET / POST /api/v1/admin/workspace/line-binding` — ผูก/ตรวจสอบบัญชี LINE OA ของสมาชิกกับผู้ใช้งาน BC

---

## 3. Public Online Billing & Slip Submission (`public_bill_handler.go`, `public_bill_pay.go`)

เปิดให้ลูกค้าภายนอกดูใบวางบิลออนไลน์ สแกน PromptPay QR และแนบสลิปโอนเงินได้โดย **ไม่ต้องล็อกอินเข้า BC** (`router.go:129-132`):

| Method & Path | หน้าที่ | กลไกความปลอดภัย |
| :--- | :--- | :--- |
| `GET /public/bill-pay/{token}` (และ `/api/v1/public/bill-pay/{token}`) | โหลดข้อมูลใบวางบิล ยอดที่ต้องชำระสุทธิ (หัก WHT ที่คาด) และ PromptPay QR | Token เซ็นด้วย **HMAC-SHA256** ผูก `provider\|database\|docNo\|expUnix` และเช็ก SHA-256 `token_hash` กับ `ar_public_bill_link` ป้องกันการสลับ Tenant |
| `POST /public/bill-pay/{token}` (และ `/api/v1/public/bill-pay/{token}`) | ลูกค้าส่งยอดโอน, ยอด WHT, เลขอ้างอิง และรูปสลิป (`slipDataBase64`) | จำกัดรูปภาพเฉพาะ `image/png`, `image/jpeg`, `image/webp` + ตรวจ Magic Bytes จริงไม่เกิน `2.5 MB` (บล็อก SVG/HTML) |

> [!TIP]
> หลังลูกค้าส่งสลิป สถานะลิงก์จะเป็น `SLIP_SUBMITTED` และไปโผล่แจ้งเตือนใน [[arch-morning-briefing-analytics]] เมื่อนักบัญชีกดอนุมัติ (`POST /process/workflow/public-bill-link` ด้วย `op: "confirm-slip"`) ระบบจะสร้างใบรับชำระหนี้ใน `ap_ar_trans` (`trans_flag = 239`) และตัดหนี้ทุกบิลในใบวางบิลด้วย `*big.Rat`

---

## 4. Hybrid AI & Company Brain Proxy (`/ai/*`, `/company-brain/*`)

1. **AI Assistant (`ai/handler.go`, mount ที่ `/ai/*` และ `/api/v1/ai/*`)**:
   - `GET /ai/context` — ดึงบริบทสดของบริษัท (ERP, WMS, TMS, CRM, Procure, e-Tax + Knowledge)
   - `GET /ai/gateway-status` — ดูสถานะ Local GPU Circuit Breaker และ Cloud Fallback
   - `POST /ai/chat` — สนทนา/ถามข้อมูลบัญชี สนับสนุนทั้ง JSON และ SSE Streaming (`outputMode`: `pdf`, `html`, `table`)
2. **Company Brain Proxy (`companybrain/handler.go`, mount ที่ `/company-brain/*` และ `/api/v1/company-brain/*`)**:
   - ทำหน้าที่ Trusted Reverse Proxy ต่อไปยัง Sidecar (`127.0.0.1:18095`), ล้าง Header ปลอมจาก Client แล้วฉีด `X-BC-Tenant-DB`, `X-BC-Provider`, `X-BC-User` จาก JWT ที่ยืนยันแล้วเท่านั้น — รายละเอียดดู [[arch-company-brain-ai]]

---

## 5. Multi-Language Dictionary & Pack API (`/language/*`, `/api/v1/language/*`, `language/handler.go`)

จัดการพจนานุกรมคำแปลกลางจาก `language.json` ร่วมกันทุกแพลตฟอร์ม (`th`, `en`, `lo`):
- `GET /language` (`GET /api/v1/language`, `/api/v1/admin/language`) — ค้นหา/กรองรายการคำศัพท์ (`q`, `group`, `incomplete`, `customized`) พร้อม `ETag`
- `GET /language/pack?lang=th|en|lo` (`GET /api/v1/language/pack`) — ดึง Language Pack แบบบีบอัด (รองรับ `gzip` และ `304 Not Modified` ตาม `ETag` revision) เพื่อใช้ในตัวแปล DOM และ PDF รายงาน
- `PUT /language`, `POST /language`, `DELETE /language/{code}` (ต้องผ่าน Admin `RightAdmin` ทั้ง `/language*`, `/api/v1/language*`, `/api/v1/admin/language*`) — เพิ่ม/แก้ไข/ลบรายการคำแปลและนำเข้าสูงสุด `2 MB` (เชื่อมหน้าจอเมนู `1005`)
