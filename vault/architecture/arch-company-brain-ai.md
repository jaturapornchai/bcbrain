---
title: "สถาปัตยกรรม Company Brain Sidecar & Hybrid AI Gateway"
audience: dev
tags: [architecture, company-brain, ai, llm, relate, hybrid-gateway]
aliases: ["Company Brain Sidecar", "Hybrid AI Gateway", "Local GPU vs Cloud Fallback", "@relate/relate", ".rl graph"]
sources: ["backend/internal/adapter/inbound/http/companybrain/handler.go:1-318", "backend/internal/platform/hybridllm/gateway.go:1-800", "backend/internal/adapter/inbound/http/ai/handler.go:1-800", "services/company-brain/src/server.ts:31-465", "services/company-brain/src/brainManager.ts:36-150", "services/company-brain/src/config.ts:50-170", "services/company-brain/src/hybridLlmClient.ts:17-260", "services/company-brain/src/pgPoolManager.ts:24-258", "services/company-brain/src/schemaIntrospector.ts:13-157", "services/company-brain/src/executor.ts:1-250", "services/company-brain/src/thaiEnglishResolver.ts:133-973"]
---

ระบบ AI ของ **BC Ai Account** ประกอบด้วยสององค์ประกอบหลักที่ทำงานประสานกัน: **Company Brain Sidecar** (สมองกราฟความสัมพันธ์ข้อมูลระดับบริษัท) และ **Hybrid AI Gateway** (ตัวจัดเส้นทางระหว่าง Local GPU และ Cloud LLM Fallback)

---

## 1. Company Brain Sidecar (`services/company-brain/`)

เป็น Node.js HTTP/SSE Sidecar รันที่พอร์ตภายใน `127.0.0.1:18095` ใช้เอนจินกราฟ `@relate/relate` และรับ Proxy จาก Go Backend ผ่าน `/company-brain/*` และ `/api/v1/company-brain/*` (`companybrain/handler.go`):

### Endpoints ของ Sidecar (`server.ts`)
- `GET /health`, `GET /v1/status`, `GET /v1/audit-log`
- `POST /v1/sync-nudge` — รับสัญญาณอัปเดตกราฟแบบ Real-time จาก Go Backend (`Process` และ `Query` handlers ส่ง non-blocking timeout `2s`)
- `GET / POST /v1/context-suggestions` — สร้างคำถามแนะนำอัตโนมัติตามบริบทหน้าจอปัจจุบัน (`bom`, `ic_`, `ar_/so_`, `ap_/po_`, `vat/gl_`, `pos`)
- `POST /v1/learn-alias` — จดจำคำพ้อง/รหัสเรียกแทนของบริษัท (`AliasEnricherQueue`)
- `POST /v1/ask` — ถามตอบผ่าน SSE Stream แบ่ง Event: `stage`, `tool`, `delta`, `final`, `error`

### กลไกทำงานภายใน Sidecar
1. **Per-Tenant `.rl` Brain Files (`brainManager.ts`)**:
   - `BRAIN_SCHEMA_VERSION = 2` สร้างไฟล์กราฟ `<tenantDb>.rl` แยกตามบริษัท พร้อม LRU Idle Eviction (เปิดค้างสูงสุด `maxActiveBrains = 40`, idle eviction `600,000 ms` ใน `config.ts`)
   - Node หลัก 6 ชนิด (`EntityKind`): `Item`, `Customer`, `Supplier`, `Account`, `BOM`, `Document`
2. **Auto-Schema Discovery (`schemaIntrospector.ts`)**:
   - สแกน `information_schema.tables`, `columns`, comments และ Foreign Keys ในกลุ่มตารางแกนกลาง (`ic_`, `ar_`, `ap_`, `gl_`, `cb_`, `as_`, `erp_`, `bc_`, `pos_`) คำนวณ `schemaHash` SHA-256 เพื่อรีเฟรชโหนด `:SchemaTable` อัตโนมัติเมื่อโครงสร้างเปลี่ยน
3. **Thai-English Fuzzy & Multi-Hypothesis Search (`thaiEnglishResolver.ts`, `executor.ts`)**:
   - แก้คำพิมพ์ผิดแป้นพิมพ์เกษมณี-QWERTY (`swapKedmaneeToQwerty`/`swapQwertyToKedmanee`), แยกคำภาษาไทย และจับคู่โครงกระดูกพยัญชนะ (`toConsonantSkeleton`) ก่อนยิง Multi-Hypothesis Search + Evidence Fusion
4. **Read-Only Bounded SQL Execution (`pgPoolManager.ts`)**:
   - เปิด PG Pool สูงสุด `pgPoolMax = 2` ต่อ DB ด้วย session บังคับ `default_transaction_read_only=on` และ `statement_timeout = 1500 ms`
   - ครอบ `enforceReadOnlyBoundedSql` จำกัดผลลัพธ์สูงสุด `50` แถวต่อคำสั่ง

---

## 2. Hybrid AI Gateway (Local GPU First + Cloud Fallback)

ทั้ง Go Backend (`platform/hybridllm/gateway.go`) และ Company Brain Sidecar (`services/company-brain/src/hybridLlmClient.ts`) ใช้สถาปัตยกรรม Hybrid Routing เหมือนกัน:

| พารามิเตอร์ | ค่าในระบบจริง | เหตุผลทางสถาปัตยกรรม |
| :--- | :--- | :--- |
| **Primary Route (`LOCAL_GPU`)** | Model ค่าเริ่มต้น `qwen3:8b` (รัน Local Ollama GPU เช่น RTX 5060 8GB) | ประหยัดต้นทุน และตอบคำถามมาตรฐานได้เร็วและรักษาข้อมูลในองค์กร |
| **Concurrency Semaphore** | `MaxConcurrency = 2` พร้อม `QueueWait = 1,500 ms` | ป้องกัน GPU คิวค้างเมื่อหลาย User ถามพร้อมกัน หากคิวเต็มนานกว่า 1.5s ให้สลับไป Cloud ทันที |
| **Context Token Guard** | `MaxContextTokens = 6,000` tokens (Thai-aware estimate ~`1.6` ตัวอักษรไทย/token) | หาก Prompt เกิน `6,000` tokens ข้าม Local GPU ไป Cloud ทันที เพื่อไม่ให้ VRAM เต็ม |
| **Timeouts & CF Access** | `ConnectTimeout = 2,500 ms`, `ReadTimeout = 45,000 ms` (รองรับ Cloudflare Access headers) | ตรวจจับเซิร์ฟเวอร์ Local หลุดภายใน 2.5 วินาที |
| **Circuit Breaker** | `CLOSED` -> ล้มเหลวติดกัน `2` ครั้งเปิด `OPEN` นาน `60s` -> `HALF_OPEN` (ยิง Probe 1 ครั้ง) | ตัด Local ชั่วคราวเมื่อการ์ดจอไม่ตอบสนอง แล้วลองฟื้นกลับอัตโนมัติ |
| **Cloud Fallback (`CLOUD_FALLBACK`)** | Base URL `https://ollama.com/v1` (`gemma4:31b` / light `mimo-v2.6-flash`), Timeout `60s` | รองรับงาน Context ใหญ่หรืองานที่ซับซ้อนเมื่อ Local ติด Guard/Circuit Open |

### `/ai/chat` ใน Go (`ai/handler.go`)
- รวบรวมบริบทสดข้ามโมดูล (ERP, WMS, TMS, CRM, Procure, e-Tax + Knowledge) เข้า Prompt
- รองรับ `outputMode` เป็น `html`, `table` หรือสร้างไฟล์ `pdf` สรุปผลตอบกลับจาก AI ได้โดยตรง
