---
title: "MCP ของ BC Ai Account ใช้ทำอะไร และใช้ token อย่างไร"
tags: [faq, mcp, token, security, admin]
aliases: ["MCP server", "bcmcp_ro", "bc_mcp_tokens", "bc_mcp_access_tokens", "MCP token อ่านอย่างเดียว", "เชื่อม Claude Desktop กับ ERP", "X-MCP-Token", "/api/v1/mcp/tokens", "McpTokenScreen", "bc_query_readonly"]
sources: ["backend/internal/adapter/inbound/http/router.go:360", "backend/internal/adapter/inbound/http/mcp/token.go:27", "backend/internal/adapter/inbound/http/mcp/token.go:177", "backend/internal/adapter/inbound/http/mcp/token.go:224", "backend/internal/adapter/inbound/http/mcp/gateway.go:254", "backend/internal/adapter/inbound/http/mcp/gateway.go:835", "backend/internal/adapter/inbound/http/mcp/gateway.go:1110", "backend/internal/adapter/inbound/http/mcp/gateway.go:30", "frontend/account/admin/screens/McpTokenScreen.tsx:216"]
---
# MCP ของ BC Ai Account ใช้ทำอะไร และใช้ token อย่างไร

**ตอบสั้น:** เป็นช่องทางให้โปรแกรม AI ภายนอก (Claude, Cursor ฯลฯ) **อ่านข้อมูลบัญชีอย่างเดียว** ผ่านโปรโตคอล MCP (JSON-RPC 2.0) ที่ `/mcp` โดยใช้ token เฉพาะรูปแบบ `bcmcp_ro_...` ที่ผู้ดูแลออกให้จากหน้า "จัดการ MCP Token" — เขียน/แก้ข้อมูลไม่ได้เลย (โหมดเดียวในโค้ดคือ `readonly`)

## รายละเอียด
**ออก token:** เมนู 1023 (`McpTokenScreen`) ส่งไป `POST /api/v1/mcp/tokens/` (ต้องมี admin API key) กฎใน `ValidateCreateInput` (`token.go:224`): ชื่อ 1-100 ตัวอักษร, โหมด `readonly`, เลือกฐานข้อมูลบริษัท 1-50 ฐานไม่ซ้ำ (ห้ามเป็นฐานหลักของระบบที่ขึ้นต้น `bcerpmain`), วันหมดอายุอยู่ในอนาคตและไม่เกินประมาณ 1 ปี ค่าเริ่มต้น 90 วัน สูงสุด 365 วัน (`gateway.go:548-553`) ค่า token เต็มแสดง **ครั้งเดียว** หลังสร้าง ฐานข้อมูลเก็บเฉพาะค่าแฮช SHA-256 ([[scr-mcp-token]])

**ตาราง** (โค้ดสร้างเองด้วย `mcpSchemaSQL` ใน Main Database ของ provider): `bc_mcp_access_tokens` (ตัว token: แฮช, วันหมดอายุ, `revoked_at`, `last_used_at`), `bc_mcp_token_databases` (token เข้าฐานบริษัทไหนได้), `bc_mcp_token_audit` (create/revoke/use) — ดู [[tbl-bc-mcp-tokens]] (ไม่มีตารางชื่อ `bc_mcp_tokens` ในโค้ด)

**ใช้ token:** ส่ง `Authorization: Bearer <token>` หรือ header `X-MCP-Token` ไปที่ `POST /mcp` (หรือ `/api/v1/mcp`) — `Authenticate` (`gateway.go:254`) ตรวจแฮชแบบ constant-time, ไม่ถูกเพิกถอน, ยังไม่หมดอายุ, มีฐานข้อมูลที่อนุญาต และตรวจซ้ำว่าผู้ออก token ยังมีสิทธิ์ฐานนั้น ล้มเหลวตอบ 401 (ผล auth ถูก cache 30 วินาที)

**เครื่องมือ (tools) 11 ตัว** ใน `readOnlyToolsCatalog` (`gateway.go:1110`) เช่น `bc_system_workflow_guide`, `bc_ui_workflow_spec`, `bc_list_databases`, `bc_company_overview`, `bc_list_tables`, `bc_describe_table`, `bc_query_readonly` (SELECT/WITH เดียว), `bc_batch_readonly`, `bc_document_lookup`, `bc_financial_summary`, `bc_run_report`

**เพิกถอน:** `POST /api/v1/mcp/tokens/{id}/revoke` หรือปุ่มเพิกถอนในหน้าจอ → token ใช้ไม่ได้ทันที (ล้าง cache)

## ข้อควรระวัง
- SQL ผ่าน `domainquery.NewStatement` (SELECT/WITH เท่านั้น) และบล็อกการอ่าน `bc_user_list`, ตาราง `bc_mcp_*`, `bc_google_account`, `pg_shadow`, `pg_authid` (`forbiddenReadTables` `gateway.go:30`); query รันใน transaction read-only + `statement_timeout` 15 วินาที (`gateway.go:1566`)
- body สูงสุด 2 MB, ทั้งคำขอ timeout 35 วินาที
- ห้ามแปะ token จริงลงแชท/โค้ด/git — เป็นความลับระดับรหัสผ่าน; รั่วให้เพิกถอนทันทีแล้วออกใหม่
- ข้อความ error ระดับ JSON-RPC ตอบ HTTP 200 (ดูรายละเอียดที่ [[api-mcp]])

## ดูเพิ่ม
- [[api-mcp]]
- [[scr-mcp-token]]
- [[tbl-bc-mcp-tokens]]
- [[std-security-authz-and-web-vulns]]
- [[faq-session-logout-expired]]

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/router.go:360` route `/mcp`, `/api/v1/mcp` (`:361-364`) และกลุ่ม `/api/v1/mcp/tokens` (AdminAuth `:366-371`)
- `backend/internal/adapter/inbound/http/mcp/token.go:27` prefix `bcmcp_ro_` (โหมด `readonly` บรรทัด 25)
- `backend/internal/adapter/inbound/http/mcp/token.go:177` `mcpSchemaSQL` สร้าง 3 ตาราง
- `backend/internal/adapter/inbound/http/mcp/token.go:224` `ValidateCreateInput`
- `backend/internal/adapter/inbound/http/mcp/gateway.go:254` `Authenticate` (แฮช, revoked, expiry, cache 30 วินาทีบรรทัด 354)
- `backend/internal/adapter/inbound/http/mcp/gateway.go:835` `ServeMCP` (timeout 35 วินาที บรรทัด 880, body 2 MB บรรทัด 890)
- `backend/internal/adapter/inbound/http/mcp/gateway.go:30` `forbiddenReadTables`
- `backend/internal/adapter/inbound/http/mcp/gateway.go:1110` `readOnlyToolsCatalog`
- `frontend/account/admin/screens/McpTokenScreen.tsx:216` `handleCreateToken`
