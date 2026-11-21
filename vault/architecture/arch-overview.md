---
title: "ภาพรวมสถาปัตยกรรมระบบ BC Ai Account (System Architecture)"
audience: dev
tags: [architecture, overview, golang, nextjs, sidecar, postgresql]
aliases: ["สถาปัตยกรรม BC", "System Architecture", "โครงสร้างระบบ BC Ai Account", "Clean Architecture Go"]
sources: ["backend/internal/di/container.go:40-197", "backend/internal/adapter/inbound/http/router.go:55-385", "services/company-brain/src/server.ts:46-220", "backend/internal/platform/hybridllm/gateway.go:1-160", "AGENTS.md:1-66"]
---

**BC Ai Account** ออกแบบสถาปัตยกรรมแบบ **100% Backend-First** เพื่อรองรับการใช้งานร่วมกันทุกอุปกรณ์ (Desktop Web, Tablet, Mobile, POS Terminal และ External MCP Clients) โดยยึด Go API Server เป็นแกนกลางคำนวณบัญชี สต็อก และภาษีทั้งหมด

---

## 1. ภาพรวมโครงสร้าง 4 ชั้น (4-Layer Architecture)

| ชั้น (Layer) | เทคโนโลยี & ตำแหน่งใน Repo | หน้าที่รับผิดชอบ |
| :--- | :--- | :--- |
| **1. Presentation / Client** | Next.js + Tailwind v4 (`frontend/account/`, `frontend/shared/`, `frontend/<module>/`) | แสดงผลหน้าจอ 2-Row Toolbar, MDI Tabs, Smart 100%-Width Resizable Grid (`useResizableColumns`), BFF Route Proxy (`/api/*`) และจัดการ `year_type` พ.ศ./ค.ศ. + Blank Zero |
| **2. Inbound API & Gateway** | Go + Chi Router (`backend/internal/adapter/inbound/http/`) | รองรับ REST (`/auth`, `/process`, `/query`, `/blob`, `/api/v1/*`), MCP Streamable HTTP JSON-RPC (`/mcp`), AI SSE (`/ai/chat`) และ Public Bill Pay (`/public/bill-pay/{token}`) |
| **3. Application & Process Engine** | Go Services (`backend/internal/application/process/`, `domain/query/`) | คำนวณเงินและต้นทุนด้วย `*big.Rat`, คุม `DocFlow`, Rebuild Stock/GL, Central Report & PDF Engine (`%PDF-1.4`), Feature Switchboard, SME Thai Pack และ `WritePolicy` |
| **4. Storage & AI Sidecars** | PostgreSQL (Multi-Tenant DBs), MinIO Object Store, Node.js Company Brain Sidecar (`127.0.0.1:18095`), Hybrid LLM Gateway | แยกฐานข้อมูลรายบริษัทเด็ดขาด, เก็บรูปภาพสลิป/POD/สินค้าใน MinIO, ประมวลผล Graph @relate/relate ใน `.rl` ต่อบริษัท และสลับ Local GPU <-> Cloud Fallback |

---

## 2. Dependency Injection & Wiring Flow (`backend/internal/di/container.go`)

เมื่อ Go Backend เริ่มทำงาน `container.go:40-197` จะประกอบระบบตามลำดับ:
1. **Multi-Tenant Infrastructure**: สร้าง `PoolManager` (`platform/db`) สำหรับแยก Connection Pool รายบริษัท + `JSONProviderRepo` และ Credential Codec
2. **Identity & Security**: สร้าง JWT Token Service พร้อม File-backed Revocation Store และ `MenuRightsLoader` สำหรับตรวจสิทธิ์รายเมนู
3. **Core Gateways & Process Service**:
   - `dynamicsql.Gateway` (`/query/*`) + `blobsql.Gateway` (`/blob/insert`)
   - `hybridllm.Gateway` (Local GPU + Cloud Fallback)
   - `appprocess.Service` พร้อมฉีด MinIO Object Store และ Hybrid LLM Gateway
4. **AI Sidecar Integration & Realtime Nudge**:
   - สร้าง `CompanyBrain` proxy handler และผูก `NudgeSync` เข้ากับ `processHandler` และ `queryHandler` เพื่อให้การแก้ไข Master Data บนเว็บหรือ API อัปเดตกราฟ Company Brain ทันที
5. **Cross-Module Operational Seeding**:
   - เชื่อม `EnsureSeeded` ระหว่าง POS, AutoCare, WMS, TMS, CRM, MonitorMap, e-Tax, Procure และ Market B2B
6. **Router Composition (`NewRouter`)**:
   - ติดตั้ง Middleware พื้นฐาน (`RequestID`, `Recoverer`, `Timeout(60s)`, `SecurityHeaders`, `RequestLogger`) และ mount ทุกโมดูลตาม [[api-overview]]

---

## 3. แผนที่เจาะลึกสถาปัตยกรรมแต่ละส่วน

| หัวข้อ | อ่านต่อ |
| :--- | :--- |
| Multi-Tenant Connection Pool, JWT, AdminAuth & Isolation | [[arch-multi-tenant-di]] |
| Feature Switchboard (32 ระบบ) & 6 Business Presets | [[arch-feature-switchboard]] |
| Company Brain Sidecar (`.rl` Graph) & Hybrid AI Gateway | [[arch-company-brain-ai]] |
| Morning Briefing 6 หมวด, `ResolveDoc` 2-Hop & MonitorMap Cache | [[arch-morning-briefing-analytics]] |
| มาตรฐาน UI, Design System, Resizable Columns & PDF Engine | [[arch-ui-grid-report-standard]] |
| คู่มือต่อยอดแอปภายนอก POS Sync, LINE Webhook & Public Link | [[arch-external-apps-webhooks]] |
- [[part_of_arch::arch-pos-flutter-objectbox-sync]] — สถาปัตยกรรม Flutter POS Offline-First (`ObjectBox` 13 structs, `SyncEngine`, `ThermalPrinterService` TIS-620)
- [[part_of_arch::arch-company-brain-fusion-pipeline]] — สถาปัตยกรรมเชิงลึก Company Brain (`TwoStageBrainExecutor`, `.rl` graph, 5-Channel RRF Fusion)
- [[part_of_arch::arch-i18n-field-help-schema-forms]] — สถาปัตยกรรม Schema-Driven Forms (`erpOption` 9 tabs), Field Help, ระบบสองภาษา DOM และ Report Hierarchy
- [[part_of_arch::arch-process-jobs-queue]] — สถาปัตยกรรมคิวประมวลผลแบบกระจาย (`JobEngine`, `bc_process_job` / `bc_process_outbox`, Redis Streams, `AutoScaler` AIMD)
