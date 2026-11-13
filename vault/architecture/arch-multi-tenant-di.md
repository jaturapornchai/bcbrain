---
title: "สถาปัตยกรรม Multi-Tenant Database, Connection Pool & Dependency Injection"
audience: dev
tags: [architecture, multi-tenant, postgresql, di, security]
aliases: ["Multi-Tenant BC", "PoolManager", "DI Container BC", "แยกฐานข้อมูลบริษัท"]
sources: ["backend/internal/di/container.go:40-197", "backend/internal/platform/db/pool.go:150-240", "backend/internal/platform/db/dsn.go:13-34", "backend/internal/adapter/inbound/http/identity/handler.go:1-259", "backend/internal/adapter/inbound/http/companybrain/handler.go:80-220", "backend/internal/adapter/inbound/http/mcp/gateway.go:1185-1338"]
---

**BC Ai Account** ใช้สถาปัตยกรรม **Database-per-Tenant** (หนึ่งบริษัท = หนึ่งฐานข้อมูล PostgreSQL บนแต่ละ Provider Server) เพื่อป้องกันข้อมูลปนเปื้อนข้ามกิจการในระดับฐานข้อมูล

---

## 1. Multi-Tenant DB & `PoolManager` (`platform/db/pool.go`)

- **Provider Configuration**: ข้อมูลการเชื่อมต่อของแต่ละ Server Provider จัดการผ่าน `tenant.Service` (สร้าง/ดู/แก้ไขได้ที่ `/api/v1/admin/providers`)
- **Pool Key Isolation (`PoolKey` ใน `pool.go:150-165`)**:
  - `PoolManager` สร้างและแคช `*pgxpool.Pool` แยกตามคีย์ผสม **`(host, port, user, databaseName)`**
  - ข้อดี: แม้สอง Provider จะตั้งชื่อฐานข้อมูลบริษัทเหมือนกัน (เช่น `demo_co`) ก็ไม่เกิด Pool collision ข้ามเครื่องกันเด็ดขาด
- **DSN Builder (`dsn.go:13-34`)**: ใช้ `BuildDSN` พร้อม `quoteConnValue` ป้องกันปัญหาอักขระพิเศษใน Connection Parameters
- **Shutdown Hook**: มี `CloseAll()` (`pool.go:232`) เพื่อปิด Pool ทั้งหมดอย่างสะอาดตอนหยุด Server

---

## 2. รูปแบบ Authentication & Tenant Binding 4 ช่องทาง

| ช่องทาง | กลไกยืนยันตัวตน | แหล่งที่อยู่ของ `ProviderCode` & `DatabaseName` |
| :--- | :--- | :--- |
| **Web / Mobile User** | JWT Access Token (`Authorization: Bearer <jwt>`) | ออกเมื่อเรียก `POST /auth/select-company` — Tenant context ฝังใน Claims ของ JWT จึงไม่สามารถปลอมชื่อ DB จาก Request Body ข้ามสิทธิ์ได้ |
| **MCP AI Client** | Read-Only Bearer Token (`bcmcp_ro_*`) | ผูก `ProviderCode` และ `AllowedDatabases` (`1..20` DBs ตอนคิวรี) ไว้กับ Metadata ของโทเค็นที่ Admin อนุญาต; ปฏิเสธฐานระบบกลางอัตโนมัติ |
| **POS Terminal** | Device Bearer Token (`posTokenPrefix`) | จับคู่เครื่องต่อฐานบริษัทผ่าน `/api/v1/pos/devices/{machine}/pair` และตรวจ Hash ก่อนเข้ากลุ่ม `DeviceOnly` |
| **Public Bill Pay** | Signed URL Token (HMAC-SHA256) | ผูก `provider\|database\|docNo\|expUnix` แล้วเซ็นด้วย HMAC + เช็ก SHA-256 hash ใน `ar_public_bill_link` ป้องกันการเปลี่ยนชื่อ DB บน URL |

---

## 3. Zero-Trust Internal Sidecar & Parallel Multi-DB Execution

1. **Company Brain Reverse Proxy (`companybrain/handler.go`)**:
   - เมื่อ Frontend เรียก `/company-brain/*` Go Backend จะ **ลบ Header `X-BC-*`, `Authorization` และ `Cookie` ทั้งหมดที่ Client ส่งมา** ออกก่อน
   - จากนั้น Go จะฉีดเฉพาะ `X-BC-Tenant-DB`, `X-BC-Provider`, `X-BC-User` ที่ถอดรหัสจาก JWT ที่ตรวจสอบแล้ว พร้อม Shared Internal Header ลับ เพื่อส่งต่อให้ Sidecar (`127.0.0.1:18095`)
2. **Parallel Multi-DB MCP Query (`mcp/gateway.go`)**:
   - เครื่องมือ MCP (`bc_company_overview`, `bc_list_tables`, `bc_describe_table`, `bc_query_readonly`, `bc_batch_readonly`, `bc_document_lookup`, `bc_financial_summary`, `bc_run_report`) สามารถรับอาร์เรย์ `databases` สูงสุด **20 ฐาน**
   - Gateway รันคำสั่งข้ามฐานข้อมูลแบบ Parallel ด้วย worker concurrency จำกัดที่ **4** และรวมผลลัพธ์ติดป้าย `database` กลับให้ AI เปรียบเทียบหลายบริษัทในบริษัทในเครือได้ในครั้งเดียว
