---
title: "API เซิร์ฟเวอร์ MCP แบบอ่านอย่างเดียว (MCP read-only gateway และการจัดการ token)"
tags: [api, mcp]
aliases: ["/mcp","/api/v1/mcp","/api/v1/mcp/tokens","/api/mcp","/api/mcp/tokens","tools/call","tools/list","initialize","bc_query_readonly","bc_batch_readonly","bc_document_lookup","bc_financial_summary","bc_run_report","bcmcp_ro_"]
sources: ["backend/internal/adapter/inbound/http/router.go:360","backend/internal/adapter/inbound/http/mcp/gateway.go:835","backend/internal/adapter/inbound/http/mcp/gateway.go:943","backend/internal/adapter/inbound/http/mcp/gateway.go:254","backend/internal/adapter/inbound/http/mcp/gateway.go:394","backend/internal/adapter/inbound/http/mcp/gateway.go:490","backend/internal/adapter/inbound/http/mcp/gateway.go:682","backend/internal/adapter/inbound/http/mcp/token.go:25","frontend/src/app/api/mcp/route.ts:1","frontend/src/app/api/mcp/tokens/route.ts:1"]
---

# API เซิร์ฟเวอร์ MCP (Model Context Protocol) แบบอ่านอย่างเดียว

ให้ AI ภายนอก (เช่น ผู้ช่วยเขียนโค้ด/แชท) อ่านข้อมูลบัญชีของบริษัทผ่านโปรโตคอล MCP แบบ Streamable HTTP + JSON-RPC 2.0 โดยใช้ token เฉพาะ (`bcmcp_ro_...`) ที่ผู้ดูแลออกให้ ไม่ใช้ JWT เข้าระบบปกติ. โครงสร้างตาราง token อยู่ที่ [[tbl-bc-mcp-tokens]]; หน้าจอจัดการ token อยู่ที่ [[fe-admin-console]]; ภาพรวมที่ [[api-overview]].

## เส้นทาง

| method path | auth | handler |
|---|---|---|
| GET, POST `/mcp` | Bearer token MCP (ไม่มี AdminAuth) | `ServeMCP` gateway.go:835 |
| GET, POST `/api/v1/mcp` | เหมือนข้างบน (ชื่อทางเลือก ผ่าน Next ใช้เส้นนี้) | `ServeMCP` |
| GET `/api/v1/mcp/tokens/` | `X-Admin-Api-Key` | `ListTokens` gateway.go:394 |
| POST `/api/v1/mcp/tokens/` | `X-Admin-Api-Key` | `CreateToken` gateway.go:490 |
| POST `/api/v1/mcp/tokens/{id}/revoke` | `X-Admin-Api-Key` | `RevokeToken` gateway.go:682 |

ลงทะเบียนที่ router.go:360-371 (กลุ่ม tokens ใช้ `AdminAuth(adminAPIKey)`; กลุ่ม `/mcp` ไม่มี middleware auth ของ router — gateway ตรวจ Bearer เองในตัว handler). Middleware global ที่ครอบทุกเส้น: ดู [[api-overview]].

## 1. รูปแบบ token และการยืนยัน

- รูปแบบ: `bcmcp_ro_<base64url(provider)>.<id 32 hex>.<base64url(secret)>` (token.go:101); `ParseToken` จำกัดความยาว 220 และบังคับ prefix `bcmcp_ro_` (token.go:27,112-117). โหมดเดียวที่มีคือ `readonly` (token.go:25).
- รับ token จาก `Authorization: Bearer <token>` หรือ header `X-MCP-Token` (`extractBearerOrHeaderToken` gateway.go:822).
- `Authenticate` (gateway.go:254): แยก provider + id จาก token → ตรวจ cache ในหน่วยความจำ `authCache` (30 วินาที) ที่ผูกกับ hash+วันหมดอายุ → ถ้าไม่มีใน cache อ่าน `bc_mcp_access_tokens` + `bc_mcp_token_databases` เทียบ SHA-256 hash แบบ constant-time (`verifyTokenHash`). ทุกความล้มเหลวคืน `ErrDenied` (ไม่บอกเหตุ). ถูกเพิกถอนแล้ว evict cache ทันที.
- ชื่อฐานข้อมูลที่ token ใช้ได้ต้องตรง `^[a-z0-9_]{1,63}$` (token.go:37); ฐานข้อมูลที่ขึ้นต้นด้วย prefix ของฐานระบบหลัก (ไม่ใช่ฐานบริษัท) ถูกปฏิเสธเสมอทั้งตอนใช้งานและตอนสร้าง token (gateway.go:136, token.go:170, token.go:241; `DatabaseSelection` token.go:133).

## 2. POST /mcp — JSON-RPC

- Headers: `Authorization: Bearer <mcpToken>` (หรือ `X-MCP-Token`), `Content-Type: application/json`.
- Body: JSON-RPC 2.0 เดี่ยว หรืออาร์เรย์ batch 1..20 รายการ. ขนาดสูงสุด 2 MB (`MaxBytesReader` gateway.go:890). เวลารวมสูงสุด 35 วินาที (context timeout gateway.go:880). ตั้ง `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`.
- Notification (เมธอด `notifications/*` ไม่มี `id`) → 202 ไม่มี body; batch ที่ไม่มี response เลย → 202.
- ข้อผิดพลาดระดับ HTTP (ก่อนเข้า JSON-RPC):

| status | เหตุ | หมายเหตุ |
|---|---|---|
| 401 | ไม่ส่ง token / token ผิด หมดอายุ ถูกเพิกถอน / โหมดไม่ใช่ readonly | header `WWW-Authenticate: Bearer realm=...` + `{"error":"invalid_token","message":"..."}` (ข้อความไทย) |
| 405 | GET พร้อม `Accept: text/event-stream` (ไม่มี text/html), หรือ method อื่นที่ไม่ใช่ GET/POST | `Allow: POST` หรือ `Allow: POST, GET` |

- ข้อผิดพลาดระดับ JSON-RPC (ตอบ HTTP **200** พร้อมอ็อบเจ็กต์ `error`): `-32700` body อ่านไม่ได้/ว่าง/JSON ผิด, `-32600` request ไม่ถูกต้อง หรือ batch ว่าง/เกิน 20 หรือมีข้อความต่อท้ายอีกก้อน, `-32602` พารามิเตอร์ผิด (เช่น ไม่มี `uri`, ไม่มี `name` ของ tool), `-32601` เมธอดไม่รู้จัก, `-32603` ข้อผิดพลาดภายใน.

### เมธอดที่รองรับ (`dispatchRPCRequest` gateway.go:943)

| method | ผล | ที่มา |
|---|---|---|
| `initialize` | คืน `protocolVersion` (สะท้อนค่าที่ client ขอ), `capabilities` (tools/resources, `listChanged=false`), `serverInfo`, และ `instructions` ภาษาไทยอธิบายฐานข้อมูลที่ token เข้าถึงได้พร้อมตารางสำคัญ | gateway.go:955 |
| `ping` | ตอบว่างเปล่า | :999 |
| `resources/list` | ทรัพยากร `bc://<db>/overview` ต่อฐานข้อมูลที่ได้รับอนุญาต | :1006 |
| `resources/read` | พารามิเตอร์ `uri`; เรียก `execCompanyOverview` ของฐานนั้น | :1022 |
| `tools/list` | รายการ tool + `inputSchema` + annotations (readOnlyHint ฯลฯ) | :1055 |
| `tools/call` | `params: {name, arguments}` → ผลเป็น `content:[{type:"text",text:"<JSON บีบอัดบรรทัดเดียว>"}]`, `isError:false`; ถ้า tool ล้มเหลวคืน `isError:true` พร้อมข้อความ error (ไม่ใช่ error ระดับ JSON-RPC) | :1064-1103 |

ตัวอย่าง:

```
POST /mcp
Authorization: Bearer <mcpToken>
Content-Type: application/json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"bc_query_readonly","arguments":{"database":"<dbName>","sql":"SELECT code, name_1 FROM ic_inventory","limit":20}}}
```

GET `/mcp` (ที่ไม่ได้ขอ SSE) คืน JSON อธิบายตัวเอง: ชื่อ `bc-ai-account-mcp`, เวอร์ชัน `1.1.0`, `protocolVersion` `2025-03-26`, โหมด `readonly`, วิธียืนยันตัวตน, รายการ optimizations และ tool catalog (gateway.go:845-863).

## 3. Tools (11 ตัว)

catalog ที่ `readOnlyToolsCatalog` (gateway.go:1110-1328), การส่งต่อที่ `executeReadOnlyTool` (gateway.go:1336; case ของ 8 tool ที่ใช้ฐานข้อมูลอยู่ที่ :1484-1498 ส่วน `bc_ui_workflow_spec`, `bc_system_workflow_guide`, `bc_list_databases` ตอบก่อนเลือกฐาน).

| tool | input สำคัญ | ขีดจำกัด/พฤติกรรม |
|---|---|---|
| `bc_system_workflow_guide` | ไม่มี | คู่มือโครงสร้างตาราง, พจนานุกรม `trans_flag`, กติกาลง GL, คอลัมน์สถานะเอกสาร, มาตรฐาน UI |
| `bc_ui_workflow_spec` | `screen` (ไม่บังคับ) | สเปก workflow หน้าจอ |
| `bc_list_databases` | ไม่มี | `{mode, providerCode, authorizedDatabases}` |
| `bc_company_overview` | `database`/`databases` | ข้อมูลกิจการ (`erp_company_profile`), ค่าเริ่มต้นระบบ/ทศนิยม/ปีปฏิทิน (`erp_option`) และ KPI ภาพรวม |
| `bc_list_tables` | `keyword`, `limit` (100, สูงสุด 300), `offset`, `format` | ค้นตารางพร้อมจำนวนคอลัมน์และจำนวนแถวโดยประมาณ |
| `bc_describe_table` | `table` หรือ `tables` (สูงสุด 10 ตาราง, gateway.go:1729), `includeSamples` | โครงสร้างคอลัมน์ (และแถวตัวอย่าง 3 แถว; ค่าเริ่มต้น true เมื่อดูตารางเดียว) |
| `bc_query_readonly` | `sql`, `limit` (100, สูงสุด 500), `offset`, `format`, `omitEmpty` | SELECT/WITH เดียว; ห่อด้วย `LIMIT n+1 OFFSET m` เพื่อรู้ `has_more` |
| `bc_batch_readonly` | `queries[]` (สูงสุด 5, แต่ละอัน `{key, sql, limit}` limit 50 สูงสุด 200) | รันใน snapshot read-only transaction เดียว |
| `bc_document_lookup` | `docNo`, `keyword`, `custCode`, `transFlag`, `dateFrom`, `dateTo`, `limit` (50, สูงสุด 200) | ค้นเอกสารพร้อมรายละเอียด |
| `bc_financial_summary` | `summaryType` ∈ `trial_balance`, `profit_loss`, `balance_sheet`, `ar_aging`, `ap_aging`, `vat_summary`, `stock_balance`, `top_products`, `cash_bank_flow`, `autocare_summary`; `dateFrom`, `dateTo`, `limit` (100, สูงสุด 500) | งบ/สรุปสำเร็จรูป |
| `bc_run_report` | `menuKey` (บังคับ), `mode`, `dateFrom`, `dateTo`, `fromCode`, `toCode`, `keyword` | รันรายงานตามเมนู |

พารามิเตอร์ร่วม:
- `database` (ฐานเดียว) หรือ `databases` (หลายฐาน) — **ห้ามส่งพร้อมกัน** (token.go:136); สูงสุด 20 ฐานต่อครั้ง (token.go:149); ซ้ำ/ว่าง/นอก allow-list = error (token.go:154,170); ไม่ระบุใช้ฐานแรกที่ token อนุญาต (`DatabaseSelection` token.go:133). หลายฐานรันขนานจำกัดพร้อมกัน 4 (gateway.go:1509-1515).
- `format` ∈ `compact` (ค่าเริ่มต้น, ตารางแบบ columns+rows), `records`, `markdown` (compact.go:9-30).
- `omitEmpty` (ค่าเริ่มต้น true) ตัดคอลัมน์ที่ว่าง/ศูนย์ทั้งคอลัมน์.

### กติกาความปลอดภัยของ SQL

- `validateReadOnlySQL` (gateway.go:1801) ใช้ `domainquery.NewStatement` (domain/query/query.go:290): อนุญาต SELECT/WITH คำสั่งเดียว ห้าม DML/DDL และ pattern ต้องห้าม; ห้ามอ่านคอลัมน์รหัสผ่านของ `erp_user` (SQL ที่อ้าง `erp_user` พร้อม `password`/`pass`/`*` ถูกปฏิเสธ, :1808-1810).
- `forbiddenReadTables` (gateway.go:30) บล็อกการอ่านตารางที่อ่อนไหว (บัญชีผู้ใช้/รหัสผ่าน, ตารางโทเค็น MCP, บัญชี Google และตารางรหัสผ่านของระบบ PostgreSQL).
- `runReadOnlyQueryWithCols` (gateway.go:1552): transaction `ReadOnly` + RepeatableRead + `SET LOCAL statement_timeout='15s'`.
- ผลทั้งหมดถูก cache/ตัดแบบ compact เพื่อประหยัด token ของ AI (compact.go).

## 4. API จัดการ token (ใช้โดยหน้า Admin เท่านั้น)

ทุกเส้นต้องมี `X-Admin-Api-Key: <adminKey>` ([[api-admin-console]] อธิบาย AdminAuth) และเรียกผ่านชั้น Next ที่สร้างตัวตนผู้ใช้จาก session.

### GET /api/v1/mcp/tokens/

- Response 200: `{"ok":true,"data":{"tokens":[...],"databases":[...],"tools":[...],"mode":"readonly"}}` (gateway.go:394-). อ่านสูงสุด 200 token ที่ยังไม่ถูกเพิกถอน กรองตามผู้สร้างหรือขอบเขตฐานข้อมูลของผู้เรียก.

### POST /api/v1/mcp/tokens/

- Body (จำกัด 32,768 ไบต์): `{provider, user_code|userCode, email, role, user_level, is_demo, name, mode, databaseCodes|database_codes[], days, expiresAt|expires_at}`.
- กฎ (`ValidateCreateInput` token.go:224): `name` 1-100 ตัวอักษร, `mode` ต้องเป็น `readonly` (ค่าเริ่มต้น), ฐานข้อมูล 1..50 รายการไม่ซ้ำ, วันหมดอายุต้องอยู่ในอนาคตและไม่เกิน 1 ปี + 1 วัน; `days` ค่าเริ่มต้น 90 สูงสุด 365; หรือส่ง `expiresAt` เป็น RFC3339.
- Response 200: `{"ok":true,"data":{"token":"<แสดงครั้งเดียว>","metadata":{...}}}`. บันทึก `bc_mcp_access_tokens` + `bc_mcp_token_databases` + `bc_mcp_token_audit` ใน transaction เดียว (เก็บเฉพาะ hash ของ secret).
- Errors: 400 `READONLY_ONLY` (mode ไม่ใช่ readonly), 400 `DB_OUTSIDE_SCOPE` (ขอฐานนอกขอบเขตของผู้ออก), 400 validation, 403 (`ErrDenied`), 503 (DB ใช้ไม่ได้).

### POST /api/v1/mcp/tokens/{id}/revoke

- `{id}` ต้องตรง `^[0-9a-f]{32}$` (ไม่ตรง/ไม่พบ = 404). Body จำกัด 8,192 ไบต์.
- เพิกถอนได้เมื่อเป็นผู้สร้าง, `SUPERADMIN`, หรือ level >= 9 (ผู้ใช้ demo แตะได้เฉพาะ token demo) มิฉะนั้น 403.
- Response 200: `{"ok":true,"data":{"id":"<id>","revoked":true}}`; บันทึก audit action `revoke` และ evict cache.

ตัวอย่างสร้าง token (ผ่าน Go โดยตรง):

```
POST /api/v1/mcp/tokens/
X-Admin-Api-Key: <adminKey>
Content-Type: application/json
{"provider":"<provider>","user_code":"<userCode>","name":"<tokenName>","mode":"readonly","databaseCodes":["<dbName>"],"days":90}
```

## 5. ชั้น Next (BFF)

- `frontend/src/app/api/mcp/route.ts` (GET/POST): ส่งผ่านไป `/api/v1/mcp` โดยส่งต่อเฉพาะ header `authorization`, `x-mcp-token`, `content-type`, `accept`, `origin`, `mcp-protocol-version` — **ไม่ส่งต่อ cookie session**. POST เกิน 2 MB = 413 `request_too_large`; หมดเวลาต้นทาง 40 วินาที; ต้นทางล้ม = 503 `mcp_unavailable`.
- `frontend/src/app/api/mcp/tokens/route.ts`: ตรวจ session (`getSession()`, ไม่มี = 401 `NO_SESSION`) สร้างตัวตนจาก session แล้วเติม `X-Admin-Api-Key` ด้วย `getAdminHeaders()`. GET = รายการ; POST `{action:"revoke", id}` = เพิกถอน, POST อื่น = สร้าง (ยอมรับเฉพาะ `readonly`, `name` 1-100, `databaseCodes`, `days` ค่าเริ่มต้น 90).

## ผู้เรียกฝั่งหน้าเว็บ

`frontend/account/admin/screens/McpTokenScreen.tsx` — รายการ :141, สร้าง :238, เพิกถอน :271, ทดสอบเชื่อมต่อด้วย `fetch("/api/mcp")` :370. ผู้เรียกจริงของ `/mcp` คือไคลเอนต์ AI ภายนอกที่ถือ token.

## ข้อสังเกต

1. `GET|POST /mcp` ไม่มี AdminAuth/JWT — ป้องกันด้วย token Bearer (ตั้งใจ).
2. ข้อผิดพลาด JSON-RPC ตอบ HTTP 200 — เครื่องมือเฝ้าระวังที่ดูเฉพาะ status code จะมองไม่เห็น.
3. คำอธิบาย `trans_flag` ใน `bc_system_workflow_guide` ระบุ 32 เป็นใบสั่งขาย แต่ dashboard นับ 12 และ 32 เป็นยอดซื้อ ([[api-business-modules]]) — ควรตรวจก่อนใช้ตัวเลขร่วมกัน.

## ที่มาในโค้ด

- backend/internal/adapter/inbound/http/router.go:360-371 (เส้นทาง MCP และ tokens)
- backend/internal/adapter/inbound/http/mcp/gateway.go:30 (forbiddenReadTables), :170 (ตัดฐานระบบหลัก), :845-863 (descriptor), :880 (timeout 35s), :890 (2 MB), :254 (Authenticate), :394 (ListTokens), :490 (CreateToken), :682 (RevokeToken), :822 (extractBearerOrHeaderToken), :835-940 (ServeMCP), :943-1105 (dispatchRPCRequest), :1142-1308 (readOnlyToolsCatalog), :1484-1498 (tool dispatch), :1509-1515 (concurrency 4), :1552 (runReadOnlyQueryWithCols), :1801 (validateReadOnlySQL)
- backend/internal/adapter/inbound/http/mcp/token.go:25-37 (mode, prefix, patterns), :101 (รูปแบบ token), :112 (ParseToken), :133 (DatabaseSelection), :224 (ValidateCreateInput)
- backend/internal/adapter/inbound/http/mcp/compact.go:9-30 (format)
- backend/internal/domain/query/query.go:290 (NewStatement)
- frontend/src/app/api/mcp/route.ts; frontend/src/app/api/mcp/tokens/route.ts; frontend/account/admin/screens/McpTokenScreen.tsx:141,238,271,370
