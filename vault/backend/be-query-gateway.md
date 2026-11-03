---
title: "Query Gateway: /query/list, limit, batch, exec, execBatch"
tags: [backend, query, sql, postgres, gateway]
aliases: ["query gateway", "/query/list", "/query/limit", "/query/batch", "/query/exec", "/query/execBatch", "dynamicsql", "scanSQL", "SELECT-only"]
sources: ["backend/internal/application/query/service.go:32", "backend/internal/domain/query/query.go:66", "backend/internal/domain/query/query.go:290", "backend/internal/adapter/outbound/dynamicsql/gateway.go:92", "backend/internal/adapter/inbound/http/query/handler.go:103", "backend/internal/adapter/inbound/http/query/handler.go:227"]
---

# Query Gateway

เส้นทางหลักที่หน้าเว็บใช้อ่าน/เขียนฐานข้อมูลบริษัทด้วย SQL ตรง ๆ: client ส่ง SQL ดิบ, backend ตรวจรูปแบบ แล้วรันกับ Company Database ใน token ภายใต้ transaction/timeout ที่ควบคุมไว้. ADR: [[adr-0005-query-gateway-read-only-first]], [[adr-0006-query-exec-dml-only-guardrails]], [[adr-0008-query-batch-endpoint]], [[adr-0009-query-exec-batch-transactional]], [[adr-0011-query-exec-write-lockdown]].

## Endpoint (ทุกตัวต้อง `Authorization: Bearer` — `router.go:90-102`)

| Endpoint | body | ทำอะไร |
|---|---|---|
| `POST /query/list` | `{"sql"}` | SELECT/WITH เดียว คืนทุกแถว (ไม่เกิน 50,000) |
| `POST /query/limit` | `{"sql","offset","limit","includeTotal"}` | แบ่งหน้า + นับรวมถ้า `includeTotal` → `{"totalRecords","rows"}` |
| `POST /query/batch` | `{"sql":[...]}` | SELECT หลายคำสั่งใน read-only tx เดียว (ไม่เกิน 20) คืนอาร์เรย์ของ rows ต่อคำสั่ง |
| `POST /query/exec` | `{"sql"}` | INSERT/UPDATE/DELETE เดียว (รองรับ `RETURNING`) → `{"rowsAffected","rows"}`; ต้องผ่านสิทธิ์เมนู |
| `POST /query/execBatch` | `{"sql":[...]}` | DML หลายคำสั่งใน transaction เดียว (≤1000 คำสั่ง, ≤2MB) |

ชื่อฐานข้อมูลมาจาก claim `databaseName` ของ token เสมอ (ไม่รับจาก body) — `handler.go:119,179,242` ([[be-jwt-session-tokens]]).

## ทำงานอย่างไร (อ่าน)

1. handler ดึง claims แล้วเรียก use case (`handler.go:103`).
2. `domainquery.NewStatement` (`domain/query/query.go:290`) — ผ่าน `scanSQL` (ตัวสแกน lexer ที่ข้าม string literal, `"identifier"`, dollar-quote, คอมเมนต์; ตัด `;` ท้ายได้ 1 ตัว; ปฏิเสธ quote ไม่ปิดหรือมีคำสั่งหลัง `;`) แล้วต้องขึ้นต้นด้วย `SELECT` หรือ `WITH` และไม่มีคำสั่งเขียน/DDL หรือคำต้องห้าม (`dmlKeyword`, `ddlOrAdminKeyword`, `forbiddenSelectPattern` ใน `query.go:50-59`). ผิด → 400 ข้อความ `ErrNotSelectOnly`.
3. `Limit`: `NewPagination` บีบ `offset>=0`, `limit` อยู่ใน (0, 1000] (`query.go:454-466`), ห่อเป็น `SELECT * FROM (<sql>) AS _q OFFSET n LIMIT m` (`:468`); นับรวมด้วย `SELECT count(*) FROM (<sql>) AS _query_count` (`:318`) — ไม่ต้องเขียน count เอง.
4. `dynamicsql.Gateway.Query` (`outbound/dynamicsql/gateway.go:92`): เปิด tx แบบ `ReadOnly` + `RepeatableRead` ใช้ `QueryExecModeSimpleProtocol`, สแกนไม่เกิน `MaxListRows` = 50,000 (เกิน → error), ค่า `NUMERIC` แปลงเป็นสตริงทศนิยมตรงตัว (`NormalizeValue`, `:26`) กันเพี้ยนแบบ float ([[be-db-pool-manager]]).
5. ทุก use case ครอบด้วย timeout 30 วินาที (`service.go:16`) และ `ResolveConnection(provider)` ก่อนเรียก gateway ([[be-provider-registry]]).

## ทำงานอย่างไร (เขียน)

- `Exec` (`service.go:95`): `NewWriteStatement` ตรวจเป็น DML เดียว (หรือ `WITH` ที่มี DML) → `ValidateUserLevel` (ตาราง `bc_user_list`, `bc_database_list*`, `erp_option` ต้อง level ≥ 9, ไม่งั้น 403) → ถ้า `ClientRequest` ต่อด้วย `ValidateClientPolicy` ([[be-query-write-policy]]) → รันด้วย `pool.Query` (ไม่มี tx ครอบ ต่างจาก batch; `gateway.go:170-190`).
- `ExecBatch` (`service.go:137`): `NewWriteBatchStatements` (≤1000 คำสั่งและรวม ≤ 2MB, `query.go:75-81,397-426`) → ตรวจนโยบายทีละคำสั่ง (ข้อความ error ระบุ `statement i`) → `tx.Begin` รันตามลำดับ ล้มคำสั่งใดก็ rollback ทั้งหมด (`gateway.go:197-240`).
- ผู้เรียกภายใน (handler ของโมดูล) ใช้ `ExecInput.AllowDDL=true` ข้ามตัวตรวจ DML-only ทั้งหมด และ `ClientRequest=false` ข้ามนโยบายล็อก; **เฉพาะ `query/handler.go:245,299` ที่ตั้ง `ClientRequest: true`** ([[be-hexagonal-architecture]]).

## Logging / ข้อควรระวัง

- handler log SQL แบบ mask string literal (`maskSQLLiterals`), hash SHA-256, คำกริยาแรก และตารางเป้าหมาย; ถ้าเกิน 1 วินาทีจะ log เป็น slow query (`handler.go:28-82,135,200`) — ตัว log ไม่เก็บค่าใน literal.
- error จาก DB ทุกชนิดถูกห่อเป็น 400 ([[be-error-response-shape]]).
- เอกสาร ADR-0005 บอกว่ายังไม่มี exec — โค้ดปัจจุบันมี exec/execBatch แล้ว และชื่อ alias นับรวมคือ `_query_count` ให้ยึดโค้ด.

## ที่มาในโค้ด

- `backend/internal/application/query/service.go:16,32-217` — use case ทั้งหมด.
- `backend/internal/domain/query/query.go:50-81,284-326,397-470` — regex, limit/caps, `Statement`, batch, pagination.
- `backend/internal/adapter/outbound/dynamicsql/gateway.go:26-234` — pool, tx, สแกนแถว.
- `backend/internal/adapter/inbound/http/query/handler.go:98-380` — DTO และ handler.
- `backend/internal/adapter/inbound/http/router.go:90-103` — route.

## ดูเพิ่ม

[[backend-overview]] · [[be-query-write-policy]] · [[be-menu-rights-permission]] · [[be-db-pool-manager]] · [[adr-0005-query-gateway-read-only-first]] · [[adr-index]]
