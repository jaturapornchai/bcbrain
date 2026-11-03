---
title: "ADR-0005 Query Gateway เริ่มแบบอ่านอย่างเดียว + สัญญา wire ใหม่"
tags: [backend, adr, query-gateway, api]
aliases: ["ADR 0005", "query read-only first", "query/list", "query/limit", "_query_count", "includeTotal"]
sources: ["backend/docs/adr/0005-query-gateway-read-only-first.md:7", "backend/internal/domain/query/query.go:23", "backend/internal/domain/query/query.go:318", "backend/internal/adapter/inbound/http/router.go:90"]
---

# ADR-0005 Query Gateway เริ่มแบบอ่านอย่างเดียว

สถานะ: **accepted** (ส่วนสัญญา read ยังตรงกับโค้ด) แต่ข้อความ "`/query/exec` ยังใช้ไม่ได้" **ล้าสมัยแล้ว** — ปัจจุบัน `/query/exec` และ `/query/execBatch` มีใช้งาน (ดู [[adr-0009-query-exec-batch-transactional]] และ [[adr-0011-query-exec-write-lockdown]]; เส้นทางอยู่ที่ `router.go:90-103`).

## ทำงานอย่างไร

1. ตัดสินใจทำฝั่งอ่านก่อน: `POST /query/list` และ `POST /query/limit` รับเฉพาะ SELECT/WITH ข้อเดียว (`ErrNotSelectOnly`, `domain/query/query.go:23`).
2. เส้นทางแบน ไม่มี prefix `/rest/v1` (เหมือน `/auth`, `/admin`) และเปลี่ยนชื่อพารามิเตอร์แบ่งหน้าเป็น `offset` / `limit` / `includeTotal` (แทน `startRecord`/`maxRecords`/`countTotalRecord` ของระบบเดิม) — `...0005...md:7`.
3. จำนวนรวมของ `/query/limit` ให้เซิร์ฟเวอร์ห่อ query เอง: `SELECT count(*) FROM (<query>) AS _query_count` (`domain/query/query.go:318-319`) — ใน ADR เขียน alias `_cnt` แต่ **โค้ดใช้ `_query_count`** (เอกสารคลาดเคลื่อนเล็กน้อย; ยึดโค้ด).
4. ไม่มี wire-level compatibility shim กับ SOAP/REST เดิม (`_query`, `_queryList`, `_queryListGetData`, `_queryLimit`, `/select`, `/selectgroup`) — client เก่าต้องเขียนใหม่ (`...0005...md:17`).

## ตัวเลือกที่ไม่เลือก / เลื่อนไว้

- คงสัญญา `_queryLimit` แบบสอง query (data + count): เสี่ยง query สองตัวเพี้ยนกันและเพิ่มพื้นที่ที่ต้อง validate.
- batch endpoint: เลื่อน แล้วภายหลังทำใน [[adr-0008-query-batch-endpoint]].
- ฟีเจอร์ replace/Thai word-break (ICU) ของ `/select` เดิม: เลื่อน เป็นฟีเจอร์แยก.

## ข้อควรระวัง

มีประเด็นด้านความปลอดภัยที่ทีมพัฒนาต้องตรวจ (ไม่เผยแพร่รายละเอียดบนเว็บสาธารณะ)

## ที่มาในโค้ด

- `backend/docs/adr/0005-query-gateway-read-only-first.md:7` — การตัดสินใจและ rename ของพารามิเตอร์.
- `backend/internal/domain/query/query.go:23` — `ErrNotSelectOnly`.
- `backend/internal/domain/query/query.go:318` — `CountQuery()` ห่อด้วย `_query_count`.
- `backend/internal/adapter/inbound/http/router.go:90` — กลุ่มเส้นทาง `/query`.

## ดูเพิ่ม

[[be-query-gateway]] · [[adr-0008-query-batch-endpoint]] · [[adr-0006-query-exec-dml-only-guardrails]] · [[adr-index]]
