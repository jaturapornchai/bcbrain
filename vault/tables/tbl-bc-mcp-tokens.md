---
title: "bc_mcp_access_tokens / bc_mcp_token_databases / bc_mcp_token_audit — โทเคน MCP แบบอ่านอย่างเดียว"
tags: [tables, bc, mcp, token, security, created-by-code, main-db]
aliases: ["bc_mcp_access_tokens", "bc_mcp_token_databases", "bc_mcp_token_audit", "MCP token", "token_hash"]
sources: ["backend/internal/adapter/inbound/http/mcp/token.go:178", "backend/internal/adapter/inbound/http/mcp/token.go:197", "backend/internal/adapter/inbound/http/mcp/token.go:206", "backend/internal/adapter/inbound/http/mcp/token.go:212", "backend/internal/adapter/inbound/http/mcp/token.go:218", "backend/internal/adapter/inbound/http/mcp/token.go:106", "backend/internal/adapter/inbound/http/mcp/token.go:246", "backend/internal/adapter/inbound/http/mcp/gateway.go:70", "backend/internal/adapter/inbound/http/mcp/gateway.go:83", "backend/internal/adapter/inbound/http/mcp/gateway.go:303", "backend/internal/adapter/inbound/http/mcp/gateway.go:336", "backend/internal/adapter/inbound/http/mcp/gateway.go:624", "backend/internal/adapter/inbound/http/mcp/gateway.go:766", "backend/internal/adapter/inbound/http/mcp/gateway.go:30"]
---

# ชุดตาราง MCP token (bc_mcp_*)

เก็บโทเคนของ MCP gateway (เชื่อม AI ภายนอกให้ **อ่านข้อมูลอย่างเดียว**) ทั้งสามตาราง **โค้ดสร้างเอง** ด้วย `mcpSchemaSQL` (`token.go:177-216`) ผ่าน `ensureMcpSchema` (`token.go:218-221`) ซึ่งถูกเรียกจาก `ensureProviderSchemasOnce` ครั้งเดียวต่อ provider ต่อรอบการทำงานของโปรเซส (`gateway.go:78-83`) อยู่ใน Main Database ของ provider (`bcerpmain<code>` — `gateway.go:59-72`, ชื่อฐานต่อจาก `bcerpmain` ด้วยรหัส provider ตัวพิมพ์เล็ก — `gateway.go:70`)

> **ห้ามเปิดเผยโทเคน** — ฐานเก็บเฉพาะค่าแฮช SHA-256 (`token_hash`) และ prefix (`token.go:101-107`); SQL ที่ AI ส่งผ่าน MCP อ่านตาราง `bc_mcp_*` ไม่ได้ (`forbiddenReadTables` — `gateway.go:30`, บังคับที่ `gateway.go:1806` และซ่อนจากรายการตารางที่ `gateway.go:1696`)

## bc_mcp_access_tokens
| คอลัมน์ | ชนิด / กฎ | ความหมาย |
|---|---|---|
| `id` | TEXT **PK** | รหัสโทเคน (hex 32 ตัวอักษร) |
| `provider_code` | TEXT | ผู้ให้บริการ/Tenant |
| `name` | TEXT, CHECK ยาว 1-100 | ชื่อที่ผู้สร้างตั้ง |
| `mode` | TEXT, CHECK = `'readonly'` | มีโหมดเดียวคืออ่านอย่างเดียว |
| `token_prefix` | TEXT | 22 ตัวแรกของโทเคนต่อด้วย `...` ไว้แสดงในรายการ (`token.go:102-105`) |
| `token_hash` | BYTEA, CHECK ยาว 32 ไบต์ | SHA-256 ของโทเคนเต็ม (`token.go:106`); ตรวจด้วยการเทียบแบบ constant-time (`token.go:253-256`) |
| `created_by_user`, `created_by_email` | TEXT | ผู้สร้าง |
| `is_demo` | BOOLEAN | โทเคนเดโม |
| `created_at`, `expires_at`, `revoked_at`, `last_used_at` | TIMESTAMPTZ | วงจรชีวิต (CHECK `expires_at > created_at`) |

ดัชนี `(provider_code, created_at DESC)` (`token.go:194-195`)

## bc_mcp_token_databases — โทเคนเข้าฐานบริษัทไหนได้
`token_id` (FK → access_tokens, ON DELETE CASCADE), `provider_code`, `database_name` (ห้ามว่าง) · PK (`token_id`, `database_name`) · ดัชนี `(provider_code, token_id)`

## bc_mcp_token_audit — บันทึกการใช้
`id` (identity PK), `token_id`, `provider_code`, `database_name`, `actor`, `action` (CHECK ∈ `create`/`revoke`/`use`), `tool_name`, `occurred_at`
- โค้ดเขียนแถวเฉพาะ `create` (ตอนออกโทเคน — `gateway.go:649-651`, `tool_name` ว่าง) และ `revoke` (ตอนเพิกถอน — `gateway.go:775-777`); ค่า `use` อนุญาตใน CHECK แต่ไม่พบโค้ดที่เขียน — การใช้งานจริงบันทึกเป็น `last_used_at` ในตารางโทเคนแทน

## วงจรโทเคน (อ้างจากโค้ด)
1. **ออก** (`CreateToken` `gateway.go:490-679`): ตรวจ `ValidateCreateInput` — ชื่อ 1-100 ตัวอักษร, ฐาน 1-50 รายการไม่ซ้ำและไม่ขึ้นต้น `bcerpmain`, วันหมดอายุต้องอยู่ในอนาคตและไม่เกิน 1 ปี 1 วัน (`token.go:224-250`) แล้วเช็กว่าฐานที่ขอทั้งหมดอยู่ในขอบเขตสิทธิ์ของผู้ออก (`resolveAuthorizedDatabases` — `gateway.go:115-250`) ก่อน INSERT ทั้งสามตารางในทรานแซกชันเดียว (`gateway.go:624-651`); โทเคนเต็มส่งกลับครั้งเดียวในคำตอบ
2. **ใช้** (`Authenticate` `gateway.go:254-358`): แคชผลในหน่วยความจำ 30 วินาที (`gateway.go:354`); เมื่อตรวจใหม่ต้องไม่ถูกเพิกถอน ไม่หมดอายุ โหมด `readonly` มีฐานอย่างน้อย 1 รายการ (`gateway.go:303`) และผู้ออกโทเคนยังมีสิทธิ์ในฐานนั้นอยู่ — ฐานที่ผู้ออกหมดสิทธิ์แล้วจะถูกตัดออก (`gateway.go:308-332`); อัปเดต `last_used_at` (`gateway.go:336`)
3. **เพิกถอน** (`RevokeToken` `gateway.go:682-795`): ทำได้เฉพาะผู้สร้างเอง, `SUPERADMIN` หรือ `userLevel >= 9`; ผู้ใช้เดโมเพิกถอนได้เฉพาะโทเคนเดโม (`gateway.go:750-761`); ตั้ง `revoked_at` + เขียน audit `revoke` ในทรานแซกชันเดียว แล้วล้างแคชทันที (`gateway.go:766-777`, `:789`)
4. **ดูรายการ** (`ListTokens` `gateway.go:394-487`): แสดงเฉพาะโทเคนที่ยังไม่ถูกเพิกถอน สูงสุด 200 รายการ (`gateway.go:415-430`) เฉพาะที่ผู้ดูสร้างเอง หรือที่ฐานทั้งหมดอยู่ในขอบเขตสิทธิ์ของผู้ดู (`gateway.go:457-475`)

## ลิงก์
[[std-security-authz-and-web-vulns]] · [[tbl-group-bc]] · [[tbl-bc-google-workspace]]

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/mcp/token.go:177-221` DDL ทั้งสามตาราง + `ensureMcpSchema`
- `backend/internal/adapter/inbound/http/mcp/token.go:87-107` สร้างโทเคน/prefix/แฮช
- `backend/internal/adapter/inbound/http/mcp/token.go:224-250` กติกาตอนออกโทเคน
- `backend/internal/adapter/inbound/http/mcp/gateway.go:59-72` เปิด Main Database ของ provider
- `backend/internal/adapter/inbound/http/mcp/gateway.go:78-83` เตรียมตารางครั้งเดียวต่อ provider
- `backend/internal/adapter/inbound/http/mcp/gateway.go:254-358` ตรวจโทเคนตอนใช้งาน
- `backend/internal/adapter/inbound/http/mcp/gateway.go:624-651` INSERT ตอนออกโทเคน
- `backend/internal/adapter/inbound/http/mcp/gateway.go:750-777` เพิกถอนโทเคน
- `backend/internal/adapter/inbound/http/mcp/gateway.go:30` ตารางที่ SQL ผ่าน MCP อ่านไม่ได้
