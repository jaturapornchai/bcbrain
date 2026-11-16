---
title: "สเปก MCP Gateway 11 Read-Only Tools & Token Workflow"
audience: dev
tags: [api, mcp, ai, readonly, jsonrpc]
aliases: ["MCP Gateway", "11 MCP Tools", "bc_query_readonly", "bc_run_report", "bc_financial_summary", "bcmcp_ro", "MCP Server BC"]
sources: ["backend/internal/adapter/inbound/http/mcp/gateway.go:1-2267", "backend/internal/adapter/inbound/http/mcp/token.go:1-281", "backend/internal/adapter/inbound/http/mcp/compact.go:1-254", "backend/internal/adapter/inbound/http/router.go:370-385"]
---

**BC Ai Account MCP Gateway** เปิดให้บริการโปรโตคอล Model Context Protocol แบบ **Read-Only 100%** ผ่าน Streamable HTTP JSON-RPC 2.0 เพื่อให้ AI Assistant ภายนอก (เช่น Claude Desktop, Cursor, ChatGPT, LangChain หรือ Agent ภายใน) ค้นคว้าโครงสร้างฐานข้อมูล คิวรี SQL ตรวจสอบเอกสาร 360° และรันงบการเงิน/รายงานได้โดยไม่กระทบข้อมูลจริง

---

## 1. Transport, Endpoints & Limits

- **MCP JSON-RPC Endpoints**: `GET / POST` ที่ `/mcp` และ `/api/v1/mcp` (`router.go:383-388`)
  - `GET`: คืน Metadata ของ Server (Protocol version, Capabilities, Endpoints)
  - `POST`: รับคำสั่ง JSON-RPC 2.0 ทั้งแบบ Single Request และ Batch Array
- **Transport Limits (`gateway.go`)**:
  - ขนาด Request Body สูงสุด: **2 MiB**
  - จำนวนคำสั่งใน 1 Batch: สูงสุด **20 requests**
  - Request Timeout: **35 วินาที** ต่อ 1 MCP Request
  - Parallel Multi-DB Query: ค้นพร้อมกันได้สูงสุด **20 ฐานข้อมูล** ในคำสั่งเดียว ด้วย worker concurrency **4**
- **JSON-RPC Methods ที่รองรับ**:
  - `initialize`, `ping`
  - `resources/list`, `resources/read`
  - `tools/list`, `tools/call`

---

## 2. Token Lifecycle & Security Model (Read-Only Guarantee)

> [!IMPORTANT]
> **กลไกป้องกันข้อมูลสำคัญอัตโนมัติ (`token.go` & `gateway.go`):**
> - MCP Gateway อนุญาตเฉพาะโทเค็นโหมด **Read-Only** เท่านั้น (`TokenModeReadOnly = "readonly"`, คำนำหน้า `bcmcp_ro_`)
> - ตารางระบบผู้ใช้งาน ตารางจัดเก็บโทเค็น MCP บัญชีเชื่อมโยงภายนอก และตารางระบบรหัสผ่าน/สิทธิ์ของฐานข้อมูล **ถูกบล็อกไม่ให้คิวรีและซ่อนคอลัมน์รหัสผ่านโดยอัตโนมัติ** (`WithoutPasswords()`)
> - รายการฐานข้อมูลที่เลือกเข้าถึงได้ถูกจำกัดไว้เฉพาะฐานบริษัทของลูกค้า และปฏิเสธฐานระบบกลางโดยอัตโนมัติ

### Token Management Endpoints (`AdminAuth` Required)
 mount อยู่ใต้ `/api/v1/mcp/tokens` (`router.go:389-395`):
1. `POST /api/v1/mcp/tokens` — สร้างโทเค็นใหม่
   - `name`: ชื่อโทเค็นความยาว `1–100` ตัวอักษร (`token.go:ValidateCreateInput`)
   - `databases`: รายชื่อฐานข้อมูลที่อนุญาต (`1–50` DB ตอนสร้าง)
   - `expireDays`: อายุโทเค็นเป็นวัน (ค่าเริ่มต้น `90` วัน สูงสุด `365` วัน ใน `gateway.go:561`)
   - ระบบคืน Plaintext Token **ครั้งเดียวใน Response** เท่านั้น และจัดเก็บเฉพาะค่า Hash ด้วย SHA-256 (ตรวจสอบแบบ constant-time + Auth Cache 30 วินาที)
2. `GET /api/v1/mcp/tokens` — ดูรายการโทเค็น (ไม่คืนค่า Plaintext Secret)
3. `POST /api/v1/mcp/tokens/{id}/revoke` — เพิกถอนโทเค็นทันที

### ระดับความปลอดภัยตอนประมวลผล SQL
- บังคับ SQL Parser ให้ผ่านเฉพาะคำสั่ง `SELECT` หรือ `WITH` เดี่ยว
- รันบน PostgreSQL Transaction Options: `AccessMode: pgx.ReadOnly`, `IsoLevel: pgx.RepeatableRead` และครอบ `statement_timeout = '15s'` ในโหมด Batch (`gateway.go`)

---

## 3. ตารางอ้างอิง MCP Tools ทั้ง 11 ตัว

อ้างอิงรายการ Tool ที่ลงทะเบียนใน `gateway.go:1151-1338`:

| # | ชื่อ Tool | หน้าที่หลัก | พารามิเตอร์สำคัญ | Limits / Output |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `bc_system_workflow_guide` | คู่มือสถาปัตยกรรม Workflow, `trans_flag` และการบันทึกบัญชี Dr/Cr ของ BC | *(ไม่ต้องส่งพารามิเตอร์)* | Text Guide |
| 2 | `bc_ui_workflow_spec` | คู่มือหน้าจอ UI, เมนู, ช่องกรอก และ Workflow ฝั่งผู้ใช้ | `screen?` (ชื่อหน้าจอ/คีย์เมนู) | Text / JSON |
| 3 | `bc_list_databases` | แสดงรายชื่อฐานข้อมูลบริษัทที่โทเค็นนี้มีสิทธิ์เข้าถึง | *(ไม่ต้องส่งพารามิเตอร์)* | List of DBs |
| 4 | `bc_company_overview` | สรุปข้อมูลบริษัทจาก `erp_company_profile`, `erp_option` และสถิติหลัก | `database?`, `databases?` | รองรับ Multi-DB |
| 5 | `bc_list_tables` | ค้นหารายชื่อตารางในฐานข้อมูลพร้อมจำนวนแถวโดยประมาณ | `database?`, `databases?`, `keyword?`, `limit?`, `offset?`, `format?` | `limit` def `100`, max `300` |
| 6 | `bc_describe_table` | อ่านโครงสร้างคอลัมน์ ชนิดข้อมูล PK/Comment และข้อมูลตัวอย่าง | `database?`, `databases?`, `table?`, `tables?`, `includeSamples?` | สูงสุด **10 ตาราง**/ครั้ง |
| 7 | `bc_query_readonly` | รัน SQL `SELECT` / `WITH` แบบ Read-Only | `database?`, `databases?`, `sql` *(required)*, `limit?`, `offset?`, `format?`, `omitEmpty?` | `limit` def `100`, max `500` |
| 8 | `bc_batch_readonly` | รันหลายคำสั่ง `SELECT` พร้อมกันใน Transaction เดียว (`timeout 15s`) | `database?`, `databases?`, `queries` *(array, required)*, `format?` | สูงสุด **5 queries**/ครั้ง; ต่อ query def `50`, max `200` |
| 9 | `bc_document_lookup` | ค้นหาเอกสารแบบ 360° (Header, Detail, AR/AP, VAT, GL, การชำระเงิน) | `database?`, `databases?`, `docNo?`, `keyword?`, `custCode?`, `transFlag?`, `dateFrom?`, `dateTo?`, `limit?`, `format?` | `limit` def `50`, max `200` |
| 10 | `bc_financial_summary` | สรุปรายงานการเงิน/บัญชี/ภาษี/สต็อกสำเร็จรูป 10 ประเภท | `database?`, `databases?`, `summaryType` *(required)*, `dateFrom?`, `dateTo?`, `limit?`, `offset?`, `format?` | ดูตาราง `summaryType` ด้านล่าง |
| 11 | `bc_run_report` | รันรายงานทางการเงินและสต็อกเต็มรูปแบบของ BC ตาม `menuKey` | `database?`, `databases?`, `menuKey` *(required)*, `mode?`, `dateFrom?`, `dateTo?`, `fromCode?`, `toCode?`, `keyword?`, `format?` | ดูรายชื่อคีย์ใน [[api-report-catalog]] |

---

## 4. รายละเอียด `summaryType` ทั้ง 10 แบบของ `bc_financial_summary`

อ้างอิง enum ใน `gateway.go:1286-1315`:
1. `trial_balance` — งบทดลอง (ยอดยกมา เดบิต เครดิต ยอดคงเหลือ)
2. `profit_loss` — งบกำไรขาดทุน
3. `balance_sheet` — งบดุล / งบแสดงฐานะการเงิน
4. `ar_aging` — รายงานอายุหนี้ลูกหนี้
5. `ap_aging` — รายงานอายุหนี้เจ้าหนี้
6. `vat_summary` — สรุปภาษีซื้อ / ภาษีขาย
7. `stock_balance` — ยอดสินค้าคงเหลือและมูลค่าสต็อก
8. `top_products` — สินค้าขายดีจัดอันดับตามยอดขาย/จำนวน
9. `cash_bank_flow` — ความเคลื่อนไหวเงินสดและสมุดบัญชีธนาคาร
10. `autocare_summary` — สรุปคิวงานซ่อม ศูนย์บริการ และรายได้ AutoCare

---

## 5. การประหยัด Token ด้วย `format` และ `omitEmpty` (`compact.go`)

`backend/internal/adapter/inbound/http/mcp/compact.go:1-254` ออกแบบรูปแบบผลลัพธ์ 3 แบบเพื่อลดขนาด Payload เข้า LLM:
- **`compact`** *(ค่าเริ่มต้นสำหรับตารางผลลัพธ์)*: ส่งคอลัมน์เป็น array `columns` และแต่ละแถวเป็น tuple array `rows` ช่วยลด Token ได้ **55–75%** เมื่อเทียบกับ JSON Object ซ้ำๆ
- **`records`**: ส่งเป็น Array of sparse JSON objects (เหมาะกับข้อมูลที่มีฟิลด์ไม่สม่ำเสมอ)
- **`markdown`**: ส่งเป็นตาราง Markdown อ่านง่ายสำหรับแสดงผลตรงให้ผู้ใช้
- **`omitEmpty` (`true` โดยปริยายใน query หลายจุด)**: เมื่อผลลัพธ์มีมากกว่า `4` คอลัมน์ ระบบจะตัดคอลัมน์ที่เป็นค่าว่างหรือ `0` ทุกแถวออกให้โดยอัตโนมัติ แต่ยังคงรักษาคอลัมน์หลัก (`isCoreIdentifierColumn` เช่น `doc_no`, `doc_date`, `code`, `name_1`, `item_code`, `cust_code`) ไว้เสมอ
