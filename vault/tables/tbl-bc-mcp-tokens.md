---
title: "bc_mcp_access_tokens / bc_mcp_token_databases / bc_mcp_token_audit — โทเคน MCP แบบอ่านอย่างเดียว"
tags: [tables, bc, mcp, token, security, created-by-code, main-db]
aliases: ["bc_mcp_access_tokens", "bc_mcp_token_databases", "bc_mcp_token_audit", "MCP token", "token_hash"]
sources: ["backend/internal/adapter/inbound/http/mcp/token.go:178", "backend/internal/adapter/inbound/http/mcp/token.go:197", "backend/internal/adapter/inbound/http/mcp/token.go:206", "backend/internal/adapter/inbound/http/mcp/token.go:218", "backend/internal/adapter/inbound/http/mcp/gateway.go:66", "backend/internal/adapter/inbound/http/mcp/gateway.go:83", "backend/internal/adapter/inbound/http/mcp/gateway.go:30"]
---

# ชุดตาราง MCP token (bc_mcp_*)

เก็บโทเคนของ MCP gateway (เชื่อม AI ภายนอกให้ **อ่านข้อมูลอย่างเดียว**) ทั้งสามตาราง **โค้ดสร้างเอง** ด้วย `mcpSchemaSQL` (token.go:176-215) ผ่าน `ensureMcpSchema` ครั้งเดียวต่อ provider (gateway.go:78-83) อยู่ใน Main Database ของ provider (`bcerpmain<code>` — gateway.go:66-72)

> **ห้ามเปิดเผยโทเคน** — ฐานเก็บเฉพาะค่าแฮช (`token_hash`) และ prefix; MCP gateway ห้ามอ่านตาราง `bc_mcp_*` เอง (gateway.go:30)

## bc_mcp_access_tokens
| คอลัมน์ | ชนิด / กฎ | ความหมาย |
|---|---|---|
| `id` | TEXT **PK** | รหัสโทเคน |
| `provider_code` | TEXT | ผู้ให้บริการ/Tenant |
| `name` | TEXT, ยาว 1-100 | ชื่อที่ผู้สร้างตั้ง |
| `mode` | TEXT, CHECK = `'readonly'` | มีโหมดเดียวคืออ่านอย่างเดียว |
| `token_prefix` | TEXT | prefix ไว้แสดง/ค้น |
| `token_hash` | BYTEA, CHECK ยาว 32 ไบต์ | แฮชของโทเคน (ตามความยาว 32 ไบต์) |
| `created_by_user`, `created_by_email` | TEXT | ผู้สร้าง |
| `is_demo` | BOOLEAN | โทเคนเดโม |
| `created_at`, `expires_at`, `revoked_at`, `last_used_at` | TIMESTAMPTZ | วงจรชีวิต (CHECK `expires_at > created_at`) |

ดัชนี `(provider_code, created_at DESC)`

## bc_mcp_token_databases — โทเคนเข้าฐานบริษัทไหนได้
`token_id` (FK → access_tokens, ON DELETE CASCADE), `provider_code`, `database_name` (ห้ามว่าง) · PK (`token_id`, `database_name`)

## bc_mcp_token_audit — บันทึกการใช้
`id` (identity PK), `token_id`, `provider_code`, `database_name`, `actor`, `action` (CHECK ∈ `create`/`revoke`/`use`), `tool_name`, `occurred_at`

## ลิงก์
[[std-security-authz-and-web-vulns]] · [[tbl-group-bc]]

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/mcp/token.go:178`
- `backend/internal/adapter/inbound/http/mcp/token.go:197`
- `backend/internal/adapter/inbound/http/mcp/token.go:206`
- `backend/internal/adapter/inbound/http/mcp/token.go:218`
- `backend/internal/adapter/inbound/http/mcp/gateway.go:66`
- `backend/internal/adapter/inbound/http/mcp/gateway.go:83`
- `backend/internal/adapter/inbound/http/mcp/gateway.go:30`
