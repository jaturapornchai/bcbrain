---
title: "ภาพรวม API และ Gateways ของ BC Ai Account"
audience: dev
tags: [api, overview, router, rest, mcp]
aliases: ["API Overview BC", "เส้นทาง API ทั้งหมด", "Router BC Ai Account", "Endpoints BC", "REST API BC", "REST API Process Actions menuKey"]
sources: ["backend/internal/adapter/inbound/http/router.go:55-385", "backend/internal/adapter/inbound/http/process/edition_guard.go:1-42", "backend/internal/adapter/inbound/http/identity/handler.go:1-259", "backend/internal/di/container.go:40-197"]
---

Backend ของ **BC Ai Account** พัฒนาด้วยภาษา Go ใช้ `chi` Router (`backend/internal/adapter/inbound/http/router.go`) โดยตั้ง Request Timeout มาตรฐานไว้ที่ `60s` พร้อม `RequestID`, `Recoverer`, `SecurityHeaders` และ `RequestLogger`

---

## 1. แผนผังกลุ่ม Endpoints หลัก

| กลุ่ม Endpoint | Mount Path (Go Backend) | Next.js BFF Proxy | กลไก Auth & สิทธิ์ | อ่านต่อ |
| :--- | :--- | :--- | :--- | :--- |
| **Health & Docs** | `/health`, `/swagger/*` (dev) | - | Public | - |
| **Authentication** | `/auth/*` (`login`, `select-company`, `refresh`, `logout`, `me`) | `/api/auth/*` | Public + Bearer JWT (`/auth/me`) | [[api-rest-core]] |
| **MCP Gateway (AI)** | `/mcp`, `/api/v1/mcp`, `/api/v1/mcp/tokens/*` | `/api/mcp`, `/api/mcp/tokens` | Read-Only `bcmcp_ro_*` (MCP) / `AdminAuth` (Tokens) | [[api-mcp-gateway]] |
| **Dynamic Query & Blob** | `/query/*`, `/blob/insert` | `/api/query/*` | User JWT + `queryWriteGuard` (เฉพาะเขียน) | [[api-query-gateway]] |
| **Process Engine** | `/process/*`, `/api/v1/process/*` | `/api/process/*` | User JWT + Menu `RequireRight` + `X-BC-Edition` | [[api-process-engine]] |
| **Report & PDF Engine** | `/process/report/run`, `/process/report/pdf` (+ `/api/v1/...`) | `/api/process/report/*` | User JWT + Menu `RequireRight` | [[api-report-catalog]] |
| **Public Bill Pay** | `/public/bill-pay/{token}`, `/api/v1/public/bill-pay/{token}` | `/api/public/bill-pay/{token}` | HMAC-SHA256 Token บน URL | [[api-rest-core]] |
| **Admin & Workspace** | `/admin/providers`, `/api/v1/admin/*` | `/api/workspace/*` | `AdminAuth` (`X-Admin-API-Key` / Admin JWT) | [[api-rest-core]] |
| **AI & Company Brain** | `/ai/*`, `/api/v1/ai/*`, `/company-brain/*`, `/api/v1/company-brain/*` | `/api/company-brain/*` | User JWT + Trusted `X-BC-*` Headers | [[arch-company-brain-ai]] |
| **POS Terminal & Backoffice** | `/api/v1/pos/*` | `/api/pos/*` | `Pos.Auth` (`DeviceOnly` vs `UserOnly`) | [[api-rest-ops-ext]] |
| **Ops & SME Modules** | `/api/v1/{dashboard,crm,wms,tms,procure,etax,market,autocare,monitormap}/*` | `/api/<module>/*` | User JWT (`monitormap/tile` GET เปิดโหลดแผนที่) | [[api-rest-ops-ext]] |

> [!NOTE]
> สังเกตความแตกต่างของ Base Path: ใน Go Router เส้นทาง `/query/*`, `/blob/*`, `/auth/*` อยู่ใต้ root ตรงๆ ส่วน Frontend Next.js มี BFF Route Handlers อยู่ใต้ `/api/query/*`, `/api/auth/*`, `/api/process/*` เพื่อจัดการ cookie session และส่งต่อไปยัง Go Backend

---

## 2. รูปแบบ Response มาตรฐาน และ Edition Gate

### JSON Response Envelope
แทบทุก Endpoint ตอบกลับด้วยโครงสร้างเดียวกัน:
- **สำเร็จ (`200 OK`)**:
  ```json
  { "ok": true, "data": { ... } }
  ```
- **ผิดพลาด (`4xx`/`5xx`)**:
  ```json
  { "ok": false, "error": "ข้อความอธิบายภาษาไทย", "code": "ERROR_CODE" }
  ```
  (ยกเว้น `/mcp` ที่ใช้มาตรฐาน JSON-RPC 2.0 `{"jsonrpc":"2.0","id":...,"result":...}` และ `/ai/chat` ที่รองรับ Server-Sent Events `text/event-stream`)

### Pro Edition Header (`X-BC-Edition`)
ใน `backend/internal/adapter/inbound/http/process/edition_guard.go:17-37` Endpoint ในกลุ่ม Process จะตรวจ Header `X-BC-Edition`:
- หากส่งค่าเป็น `starter`, `merchant`, `startup`, `express`, `sales_express`, หรือ `account` ระบบจะจำกัดสิทธิ์เฉพาะชุดมาตรฐานและปฏิเสธฟีเจอร์ระดับ Pro ด้วย `403 Forbidden` (เช่น สกุลเงินต่างประเทศใน `/trans/save`, รายงาน VAT ระหว่างประเทศ 3 รายการใน `strictProReportMenuKeys`, และ action ระดับ Pro บน `/process/workflow/{action}`)
- ค่าอื่นหรือค่าว่างจะถูกปฏิบัติเป็นระดับ `Pro` ตามค่าเริ่มต้นของ API

---

## 3. สิทธิ์และ Guard ที่สำคัญในระดับ Middleware

1. **Menu Rights Enforcement (`RequireRight`)**: `/process/*` และ `/api/v1/process/*` ทุกตัวตรวจสิทธิ์ตามเมทริกซ์เมนูของผู้ใช้ (`process/permission.go`) และ `/query/exec`, `/query/execBatch`, `/blob/insert` ตรวจ `QueryRequiredRight` เพิ่มเติม (`router.go:88-112`)
2. **Client Write Policy (`WritePolicy`)**: ห้ามเขียนตรงเข้าตารางการเงิน/สต็อก/บัญชีผ่าน Query Gateway ต้องผ่าน Process Engine เท่านั้น — ดู [[dev-rules-accounting-sql]]
3. **Company Brain Automatic Sync**: การบันทึกข้อมูลหลักผ่าน `/process/master*` และ `/query/exec` ใน 12 ตาราง Master (`brainMasterTables`) จะส่งสัญญาณ `NudgeSync` แบบ non-blocking เพื่ออัปเดตกราฟความสัมพันธ์ของ Company Brain ทันที (`container.go`, `query/handler.go:123`)
- [[exposes_api::api-inbound-handlers-workflows]] — แผนผัง HTTP Inbound Endpoints ทั้งหมดและ 57 Workflow Actions (`/process/workflow/*`, `/stocktools/*`, `/print-audit/*`)
