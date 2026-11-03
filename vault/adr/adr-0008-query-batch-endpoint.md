---
title: "ADR-0008 /query/batch รัน SELECT หลายตัวในคำขอเดียว"
tags: [backend, adr, query-gateway]
aliases: ["ADR 0008", "query batch", "MaxBatchStatements"]
sources: ["backend/docs/adr/0008-query-batch-endpoint.md:7", "backend/internal/domain/query/query.go:73", "backend/internal/domain/query/query.go:428", "backend/internal/adapter/outbound/dynamicsql/gateway.go:129"]
---

# ADR-0008 `/query/batch` (อ่านหลาย statement)

สถานะ: **accepted** (ตรงกับโค้ด) ยกเลิกการเลื่อนจาก [[adr-0005-query-gateway-read-only-first]]. เหตุผล: ยังมี client ที่ต้องรันหลาย SELECT ในคำขอเดียว และไม่มีทางถอยไปใช้ชั้นเข้ากันได้ (`backend/docs/adr/0008-query-batch-endpoint.md:7`).

## ทำงานอย่างไร

1. `POST /query/batch` รับ SELECT/WITH ได้สูงสุด `MaxBatchStatements = 20` (`domain/query/query.go:73`) ถ้าเกินคืน `ErrTooManyStatements` (`query.go:36`).
2. แต่ละ statement ผ่าน `domainquery.NewStatement` เหมือน `/query/list` (`NewBatchStatements`, `query.go:428`) — guardrail ต่อ statement ไม่ลดลง.
3. ทุก statement ใช้ connection เดียวและ timeout 30 วินาทีรวม; **หยุดที่ statement แรกที่พัง** ไม่คืนผลบางส่วน และ error บอก index ของ statement นั้น (`...0008...md:7`).
4. ADR เรียกโมเดลนี้ว่า non-transactional แต่โค้ดจริง `QueryBatch` ห่อทั้งชุดใน transaction `ReadOnly` + `RepeatableRead` เพื่อให้ได้ snapshot เดียวกัน และใช้ `QueryExecModeSimpleProtocol` (`dynamicsql/gateway.go:128-148`). ไม่มี commit เพราะเป็นอ่านอย่างเดียว.

## ตัวเลือกที่ไม่เลือก

- รูปแบบ XML (เอกสารแท็ก `<query>`): ไม่เลือก เพราะทุก route อื่นของ Query Gateway เป็น JSON แล้ว (`...0008...md:11`).
- คืนผลบางส่วน + รายการ error ต่อ statement: ไม่มี route อื่นใช้รูปแบบนั้น.
- ไม่จำกัดจำนวน: ทำให้พื้นที่ enforcement โตไม่จำกัด.

## ข้อควรระวัง

- ต้องการมากกว่า 20 statement หรืออยากเก็บผลของตัวที่สำเร็จเมื่อตัวอื่นพัง → client ต้องแบ่งเอง (`...0008...md:17`).
- ฝั่งเขียนใช้ `/query/execBatch` ซึ่งเป็น transaction เดียวและเพดานต่างกัน (1000 statement / 2MB) — ดู [[adr-0009-query-exec-batch-transactional]].

## ที่มาในโค้ด

- `backend/internal/domain/query/query.go:73` — `MaxBatchStatements`.
- `backend/internal/domain/query/query.go:428` — `NewBatchStatements`.
- `backend/internal/adapter/outbound/dynamicsql/gateway.go:129` — `QueryBatch` เริ่ม tx read-only RepeatableRead (`:137-139`).
- `backend/docs/adr/0008-query-batch-endpoint.md:17` — ผลที่ตามมา.

## ดูเพิ่ม

[[be-query-gateway]] · [[adr-0009-query-exec-batch-transactional]] · [[adr-index]]
