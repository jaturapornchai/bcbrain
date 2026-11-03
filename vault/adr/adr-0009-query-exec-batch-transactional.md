---
title: "ADR-0009 /query/execBatch เขียนหลาย statement ใน transaction เดียว (atomic)"
tags: [backend, adr, query-gateway, transaction]
aliases: ["ADR 0009", "execBatch", "MaxExecBatchStatements", "MaxExecBatchBytes", "atomic write batch"]
sources: ["backend/docs/adr/0009-query-exec-batch-transactional.md:7", "backend/internal/domain/query/query.go:77", "backend/internal/domain/query/query.go:81", "backend/internal/domain/query/query.go:397", "backend/internal/adapter/outbound/dynamicsql/gateway.go:197"]
---

# ADR-0009 write batch commit แบบ atomic

สถานะ: **accepted** (ตรงกับโค้ด) แต่ตัวเลข "ใช้เพดานเท่าอ่านที่ 20" ใน ADR **ล้าสมัย** — โค้ดปัจจุบันแยกเพดานฝั่งเขียนเป็น `MaxExecBatchStatements = 1000` และ `MaxExecBatchBytes = 2 << 20` (2 MB) (`domain/query/query.go:77,81`).

## ทำงานอย่างไร

1. `POST /query/execBatch` ตรวจทุก statement ล่วงหน้าด้วย `NewWriteBatchStatements` (`query.go:397`) — ได้ `ErrNoStatements` / `ErrTooManyExecStatements` / `ErrExecBatchTooLarge`.
2. `Gateway.ExecBatch` เปิด `pool.Begin` แล้วรันตามลำดับด้วย `QueryExecModeSimpleProtocol` เก็บ `RowsAffected` ต่อ statement จากนั้น `Commit` (`dynamicsql/gateway.go:197-235`).
3. statement ใดพัง (validation หรือ execution) → rollback ทั้งชุดและ error ระบุ index ของ statement (`gateway.go:192-196`).
4. การเริ่ม/จบ transaction อยู่ใน `dynamicsql.Gateway` ทั้งหมด ไม่ส่ง tx handle ขึ้นไปยัง `application/query.Service` (`...0009...md:7,12`) ใช้ timeout 30 วินาทีรวมทั้งชุด (`application/query/service.go:153`).

## ตัวเลือกที่ไม่เลือก

- ใช้โมเดลเดียวกับ read batch (หยุดที่ตัวที่พัง ไม่ rollback): เขียนครึ่ง ๆ กลาง ๆ จะค้างใน DB บริษัท.
- เปิด `Begin/Commit/Rollback` บน `QueryGateway`: รั่ว tx ของ pgx ขึ้น application layer และ test double.
- ใช้ค่าเดียวกับ `MaxBatchStatements`: สองเพดานคุมคนละเรื่อง (พื้นที่ validate vs ระยะเวลา lock).

## ข้อควรระวัง

- write batch ถือ row lock ตลอด transaction — ชุดใหญ่/ช้าเสี่ยง lock contention กับ session อื่น (`...0009...md:16`).
- ตอนนี้ทุก statement ยังต้องผ่านนโยบายเขียนของ browser ([[adr-0011-query-exec-write-lockdown]]).

## ที่มาในโค้ด

- `backend/internal/domain/query/query.go:77` — `MaxExecBatchStatements`; `:81` — `MaxExecBatchBytes`; `:397` — `NewWriteBatchStatements`.
- `backend/internal/adapter/outbound/dynamicsql/gateway.go:197` — `ExecBatch`.
- `backend/internal/application/query/service.go:153` — timeout ครอบทั้งชุด.
- `backend/docs/adr/0009-query-exec-batch-transactional.md:7` — เหตุผลการตัดสินใจ.

## ดูเพิ่ม

[[be-query-gateway]] · [[adr-0008-query-batch-endpoint]] · [[adr-0011-query-exec-write-lockdown]] · [[adr-index]]
