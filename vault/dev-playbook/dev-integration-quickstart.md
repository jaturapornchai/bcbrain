---
title: "คู่มือเริ่มต้นเชื่อมต่อและพัฒนาระบบต่อยอด BC Ai Account"
audience: dev
tags: [dev-playbook, quickstart, integration, auth, mcp, api]
aliases: ["เริ่มต้นเชื่อม API BC", "Quickstart Dev BC", "วิธีเชื่อมต่อ BC Ai Account", "สร้าง Token MCP", "การ Auth BC API"]
sources: ["backend/internal/adapter/inbound/http/router.go:60-385", "backend/internal/adapter/inbound/http/identity/handler.go:1-259", "backend/internal/adapter/inbound/http/mcp/token.go:1-281", "backend/internal/adapter/inbound/http/mcp/gateway.go:520-660", "backend/internal/adapter/inbound/http/pos/sync.go:24-175"]
---

เอกสารนี้สรุปขั้นตอนตั้งต้นสำหรับนักพัฒนาที่ต้องการเชื่อม **BC Ai Account** จาก AI Client, ระบบ BI/Dashboard, แอปหน้าร้าน/มือถือ หรือ Webhook ภายนอก

---

## 1. เลือกช่องทางเชื่อมต่อที่เหมาะกับงาน

| กรณีใช้งาน | ช่องทางแนะนำ | ประเภทสิทธิ์ | รายละเอียด |
| :--- | :--- | :--- | :--- |
| **AI Copilot / Claude / Cursor / ChatGPT MCP** | **MCP Gateway** (`/mcp`, `/api/v1/mcp`) | Read-Only Bearer (`bcmcp_ro_*`) | [[api-mcp-gateway]] |
| **ดึงข้อมูลทำ BI Dashboard / SQL Select เฉพาะทาง** | **Query Gateway** (`/query/limit`, `/query/list`, `/query/batch`) | User JWT Bearer | [[api-query-gateway]] |
| **สร้าง/อนุมัติ/ยกเลิกเอกสารบัญชี สต็อก รันรายงาน PDF** | **Process Engine** (`/process/*`, `/api/v1/process/*`) | User JWT Bearer + `X-BC-Edition` | [[api-process-engine]] |
| **เชื่อมระบบปฏิบัติการ POS / WMS / TMS / AutoCare / CRM / e-Tax** | **Module REST APIs** (`/api/v1/<module>/*`) | User JWT หรือ POS Device Token | [[api-rest-ops-ext]] |
| **LINE OA Inbox Webhook & ลิงก์วางบิลสาธารณะ** | Webhook `/process/workflow/line-expense-inbox` & `/public/bill-pay/{token}` | HMAC Signature / Signed Token | [[arch-external-apps-webhooks]] |

---

## 2. ขั้นตอน Authentication ตามประเภท Client

### แบบ A: User JWT Session (สำหรับ Web App, Backend-to-Backend, Query & Process)

Flow การล็อกอินมาตรฐานอยู่ใน `identity/handler.go:1-259` และ `router.go:74-90`:

1. **เข้าสู่ระบบ**: `POST /auth/login` ด้วย `providerCode`, `username`, `password` (หรือ `provider` context) -> ได้ Token + รายการฐานข้อมูลที่มีสิทธิ์
2. **เลือกกิจการ (Tenant DB)**:
   - เรียก `GET /auth/databases` เพื่อดูรายการบริษัทที่ผู้ใช้เข้าถึงได้
   - เรียก `POST /auth/select-company` เพื่อออก Access Token & Rotating Refresh Token ที่ผูก `providerCode` + `databaseName` ของบริษัทนั้นไว้ใน JWT Claims
3. **แนบ Header ทุก Request**:
   ```http
   Authorization: Bearer <access-token>
   Content-Type: application/json
   X-BC-Edition: pro
   ```
   - หากใช้แพ็กเกจเริ่มต้นที่จำกัดฟีเจอร์ Pro ให้ส่ง `X-BC-Edition` ตามระดับแพ็กเกจ (Backend ตรวจใน `edition_guard.go`: ค่า `starter`, `merchant`, `startup`, `express`, `sales_express`, `account` จะถูกกันจากฟีเจอร์เฉพาะ Pro)
4. **ต่ออายุ Token**: เมื่อ Access Token หมดอายุ เรียก `POST /auth/refresh` (Rotating Refresh Token แบบใช้ครั้งเดียวแล้วหมุนใหม่) และ `POST /auth/logout` เพื่อเพิกถอนเซสชัน

### แบบ B: MCP Read-Only Token (สำหรับ AI Agent & Read-Only Analytics)

1. **สร้าง Token โดยผู้ดูแลระบบ**: Admin เรียก `POST /api/v1/mcp/tokens` (ต้องผ่าน `AdminAuth` ด้วย Admin Key ภายใน `X-Admin-API-Key` หรือ Bearer Admin Token — ดู `router.go:389-394`) พร้อมระบุ:
   - `name`: ชื่อโทเค็น (1–100 ตัวอักษร)
   - `databases`: รายชื่อฐานข้อมูลบริษัทที่อนุญาต (`1–50` รายการตอนสร้าง, query ต่อครั้งได้สูงสุด `20` DB; ระบบปฏิเสธฐานระบบกลางอัตโนมัติ ตาม `token.go:150-165`)
   - `expireDays`: อายุใช้งาน (ค่าเริ่มต้น `90` วัน สูงสุด `365` วัน)
2. **เก็บโทเค็นไว้ใน `.env` / Secret Manager**:
   - Token ที่ได้มีรูปแบบขึ้นต้นด้วย `bcmcp_ro_...` (`token.go:27`) และแสดงให้ดูเพียง **ครั้งเดียวตอนสร้าง** (Backend เก็บเป็น SHA-256 hash เท่านั้น)
3. **ยิง JSON-RPC 2.0 เข้า `/mcp` หรือ `/api/v1/mcp`**:
   ```http
   POST /api/v1/mcp
   Authorization: Bearer <bcmcp_ro_token>
   Content-Type: application/json

   {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "tools/call",
     "params": {
       "name": "bc_company_overview",
       "arguments": {}
     }
   }
   ```

### แบบ C: POS Device Pairing Token (สำหรับเครื่อง POS หน้าร้าน Offline-First)

1. ผู้จัดการร้านที่ล็อกอินด้วย User JWT เรียก `POST /api/v1/pos/devices/{machine}/pair` -> ได้ Device Bearer Token (`posTokenPrefix`)
2. เครื่อง POS ใช้ Device Token นี้เรียก Endpoint เฉพาะกลุ่ม `DeviceOnly` ได้เลย (`router.go:356-362`):
   - `GET /api/v1/pos/sync` (ดึงข้อมูล Master แบบ Incremental ผ่าน Cursor)
   - `POST /api/v1/pos/bills` (ส่งบิลขาย JSON เข้า Inbox แบบ Idempotent ด้วย `bill_guid`)

---

## 3. แนวทางทดสอบบนฐานข้อมูลจำลอง (UAT) ก่อนใช้งานจริง

1. แยกฐานข้อมูลทดสอบ (เช่น `uat_<project>`) ออกจากฐานข้อมูลบัญชีจริง (`smldemo` หรือฐานบริษัทลูกค้า) เสมอ
2. เวลาสร้าง MCP Token ให้ผูกสิทธิ์ `databases` เฉพาะฐานทดสอบในระหว่างพัฒนา
3. ทุกขั้นตอนที่เขียนข้อมูลเอกสารบัญชี/สต็อก ต้องตรวจผลลัพธ์ 3 จุดหลังยิง API:
   - **ยอดสต็อก & ต้นทุน**: เช็กผ่าน `POST /process/stock/rebuild` หรือคิวรี `ic_trans_detail`
   - **Document Flow**: เช็ก `doc_success`, `used_status`, `last_status` ผ่าน `POST /process/doc/flow`
   - **ความสมดุล GL**: เช็ก `gl_journal_detail` ว่าผลรวม `debit = credit` เสมอ (`ValidateAndBalanceJournal`)

---

## 4. ขั้นตอนถัดไปที่แนะนำ

- อ่าน [[dev-rules-accounting-sql]] เพื่อทำความเข้าใจธงเอกสารและ SQL ป้องกันข้อผิดพลาดทางบัญชี
- ดูรายละเอียดเครื่องมือทั้ง 11 ตัวใน [[api-mcp-gateway]]
- ดูโครงสร้าง Endpoint ทั้งหมดใน [[api-overview]] และวิธีเขียน Webhook/แอปเสริมใน [[arch-external-apps-webhooks]]
