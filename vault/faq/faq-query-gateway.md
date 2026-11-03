---
title: "Query Gateway (/query/list, /query/limit, /query/batch, /query/exec) ทำงานอย่างไร"
tags: [faq, query-gateway, backend, sql, dev]
aliases: ["query gateway", "/query/list", "/query/limit", "/query/batch", "/query/exec", "/query/execBatch", "queryList queryLimit queryExec", "หน้าเว็บอ่าน DB ยังไง", "NewStatement", "MaxListRows"]
sources: ["backend/internal/adapter/inbound/http/router.go:90", "backend/internal/domain/query/query.go:290", "backend/internal/domain/query/query.go:455", "backend/internal/adapter/outbound/dynamicsql/gateway.go:92", "backend/internal/application/query/service.go:95", "backend/internal/adapter/inbound/http/query/handler.go:245", "frontend/src/lib/query-client.ts:16"]
---
# Query Gateway (/query/list, /query/limit, /query/batch, /query/exec) ทำงานอย่างไร

**ตอบสั้น:** เป็นประตูที่หน้าเว็บส่ง SQL ข้อความมา backend ตรวจรูปแบบแล้วรันบนฐานข้อมูลบริษัทที่อยู่ใน token (ไม่รับชื่อฐานจาก body) ฝั่งอ่านรับเฉพาะ `SELECT`/`WITH` ฝั่งเขียนรับเฉพาะ `INSERT`/`UPDATE`/`DELETE` และถูกล็อกไม่ให้แตะตารางเงิน/สต็อก/GL ([[faq-query-exec-write-blocked]])

## รายละเอียด
ทุก route อยู่ใต้ `/query` ต้องมี `Authorization: Bearer` (`router.go:90-110`) หน้าเว็บเรียกผ่านฟังก์ชันใน `frontend/src/lib/query-client.ts` ซึ่งยิง `/api/query/...` ของ Next แล้วส่งต่อมา backend ([[fe-query-client-sql-builder]])

| Endpoint | body | ผล | ข้อจำกัดในโค้ด |
|---|---|---|---|
| `/query/list` | `{sql}` | คืนทุกแถว | ไม่เกิน `MaxListRows` = 50,000 แถว |
| `/query/limit` | `{sql, offset, limit, includeTotal}` | คืน `{totalRecords, rows}` | `limit` บีบอยู่ใน (0, 1000], `offset` < 0 เป็น 0 (`NewPagination`) |
| `/query/batch` | `{sql: [...]}` | SELECT หลายคำสั่งใน read-only tx เดียว | ไม่เกิน 20 คำสั่ง |
| `/query/exec` | `{sql}` | DML เดียว (มี `RETURNING` ได้) → `rowsAffected`, `rows` | ผ่านสิทธิ์เมนู + write policy |
| `/query/execBatch` | `{sql: [...]}` | DML หลายคำสั่งใน transaction เดียว ล้มคำสั่งไหน rollback ทั้งชุด | ไม่เกิน 1000 คำสั่ง และรวมไม่เกิน 2 MB |

ขั้นตอนฝั่งอ่าน:
1. `NewStatement` (`query.go:290`) ตัดคอมเมนต์/ตรวจ string literal ด้วย `scanSQL` ต้องขึ้นต้นด้วย `SELECT` หรือ `WITH` มิฉะนั้นได้ `ErrNotSelectOnly` (400)
2. `/query/limit` ห่อ SQL เป็น `SELECT * FROM (...) AS _q OFFSET n LIMIT m` และนับรวมด้วย `SELECT count(*) FROM (...) AS _query_count` ผู้เรียกไม่ต้องเขียน count เอง
3. `Gateway.Query` (`gateway.go:92`) เปิด transaction แบบ `ReadOnly` + `RepeatableRead`
4. ทุก use case มี timeout 30 วินาที (`service.go:16`) และทั้ง request มี timeout 60 วินาที (`router.go:64`)

ฝั่งเขียน: `Service.Exec` (`service.go:95`) ตรวจ DML-only → `ValidateUserLevel` (ตาราง `bc_user_list`, `bc_database_list*`, `erp_option` ต้อง level >= 9) → ถ้า `ClientRequest` (ตั้งเป็น true เฉพาะ handler ของ `/query/exec` และ `/query/execBatch` ที่ `handler.go:245,299`) ผ่าน `ValidateClientPolicy` อีกชั้น

## ข้อควรระวัง
- งานที่มีกฎบัญชี (บันทึกเอกสาร คำนวณยอด รายงาน) ไม่ผ่านประตูนี้ แต่ผ่าน `/process` ([[faq-process-engine-dispatcher]])

## ดูเพิ่ม
- [[be-query-gateway]]
- [[api-query-gateway]]
- [[api-query-exec]]
- [[faq-query-exec-write-blocked]]
- [[adr-0005-query-gateway-read-only-first]]
- [[adr-0008-query-batch-endpoint]]

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/router.go:90` route `/query/*` และ `queryWriteGuard` (บรรทัด 85-87)
- `backend/internal/domain/query/query.go:290` `NewStatement` (SELECT/WITH only) และค่าคงที่ `MaxListRows`/`MaxBatchStatements`/`MaxExecBatchStatements` (บรรทัด 69-81)
- `backend/internal/domain/query/query.go:455` `NewPagination`
- `backend/internal/adapter/outbound/dynamicsql/gateway.go:92` read-only + RepeatableRead
- `backend/internal/application/query/service.go:95` `Exec` (ขั้นตรวจ DML, level, client policy)
- `backend/internal/adapter/inbound/http/query/handler.go:245` `ClientRequest: true`
- `frontend/src/lib/query-client.ts:16` `queryList` (และ `queryLimit` 25, `queryExec` 44, `queryBatch` 54, `queryExecBatch` 63)
