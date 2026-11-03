---
title: "เครื่องมือกลาง platform: docno, sqllit, search, security (Platform utilities)"
tags: [backend, platform, utilities, search, thai, sql]
aliases: ["docno.Stamp", "sqllit.Literal", "sqllit.Insert", "SegmentSearchTokens", "BuildAndILikeWhere", "ScoreSearchMatch", "SetSecureHeaders", "ตัดคำไทย", "เลขเอกสารตามเวลา", "internal/platform"]
sources: ["backend/internal/platform/docno/docno.go:23", "backend/internal/platform/sqllit/sqllit.go:20", "backend/internal/platform/sqllit/sqllit.go:49", "backend/internal/platform/search/tokenizer.go:290", "backend/internal/platform/search/tokenizer.go:349", "backend/internal/platform/search/tokenizer.go:451", "backend/internal/platform/security/headers.go:9", "backend/internal/adapter/inbound/http/middleware/middleware.go:17"]
---

# เครื่องมือกลางใน `internal/platform`

แพ็กเกจเล็ก ๆ ที่ handler ของโมดูล (market, tms, wms, procure, autocare, etax) ใช้ร่วมกัน: สร้างเลขที่เอกสารตามเวลา, แปลงค่า Go เป็น literal ของ PostgreSQL, ตัดคำไทยเพื่อค้นหาแบบ `ILIKE`, และตั้ง header ความปลอดภัย. ส่วนอื่นของ `platform` อยู่ในโน้ตเฉพาะ: `apperr` → [[be-error-response-shape]], `config` → [[be-config-env]], `db` → [[be-db-pool-manager]], `httpserver`/`logger` → [[be-service-lifecycle]].

## ทำงานอย่างไร

### `docno` — เลขที่เอกสารตามเวลา (`docno/docno.go`)
- `Stamp(layout)` (`:23`) = เวลาปัจจุบันตาม layout + มิลลิวินาที 3 หลัก + `-` + แท็กสุ่ม 4 ฐานสิบหกตัวพิมพ์ใหญ่ (จาก `crypto/rand`), เช่น layout `150405` → `153045123-9F2C`.
- เหตุผลที่เขียนไว้ในแพ็กเกจ: `time.Now().Format("150405")` ซ้ำกันทุกคำขอในวินาทีเดียว ทำให้สองออเดอร์ได้ `order_no`/`trip_no`/`move_doc_no` เดียวกัน (`docno.go:1-9`).
- ใช้ใน handler ของ `autocare`, `etax`, `market`, `procure`, `tms`, `wms` (เช่น `docno.Stamp("0405")` ที่ `autocare/handler.go:999`). **เป็นเลขของโมดูล dashboard ไม่ใช่เลขเอกสารบัญชี** — เลขเอกสารหลัก (`ic_trans` ฯลฯ) มาจากรูปแบบ `doc_format` ในชั้น `process` ([[process-overview]]).

### `sqllit` — literal ของ PostgreSQL (`sqllit/sqllit.go`)
- มีไว้ให้ handler ที่ส่งหลายคำสั่งเข้า `ExecBatchUseCase` (ทำใน transaction เดียว — [[be-query-gateway]]).
- `Escape` (`:14`) ซ้ำเครื่องหมาย `'`; `Literal` (`:20`): `nil`→`NULL`, `string`→ใส่ `'…'` พร้อม escape, `bool`→`TRUE/FALSE`, `int`/`int64`→ตัวเลขเปล่า, `float64`→ตัวเลขเปล่า (`NaN`/`Inf` → `NULL`), ชนิดอื่นทั้งหมด→ `fmt.Sprint` แล้วครอบเป็นสตริง.
- `Insert(table, columns, values)` (`:49`) ประกอบ `INSERT INTO t (cols) VALUES (…)` รูปแบบเดียวกับ `appblob.InsertInput`.
- ผู้ใช้: `autocare`, `market`, `procure`, `tms`, `wms` (ประมาณ 100 จุดเรียกใน `adapter/inbound/http`).

### `search` — ค้นหาไทย/อังกฤษแบบ AND `ILIKE` (`search/tokenizer.go`)
- `SegmentSearchTokens` (`:290`): แบ่งข้อความเป็นช่วงตามชนิดอักษร THAI / LATIN / DIGIT (`classifyRune`, `:275`) — **อักขระอื่นทั้งหมดเป็นตัวคั่น** ไม่ถูกส่งต่อ; ช่วงไทยตัดเป็นพยางค์ด้วย `SegmentThaiChunk` (`:164`) โดยเทียบรายการพยางค์/รากคำเรียงยาวไปสั้น (`thaiAtomicSyllables`, `:12`) เช่น `ลังกระดาษ` → `ลัง`, `กระ`, `ดาษ`; token ซ้ำ (ไม่สนตัวพิมพ์) ถูกตัดทิ้ง.
- `ExpandTokenAliases` (`:96`) ขยาย token เป็นคำพ้อง B2B จาก `thaiB2BSynonymMap` (`:59-87`: หน่วย/บรรจุภัณฑ์ เช่น ลัง/กล่อง/พาเลท, กก/กิโล, ขวด/แกลลอน และคำพ้องสินค้ายอดนิยมบางคำ) ส่วน `compoundExclusions` (`:90`) กันคำสั้น `นม`/`ชา` ไปจับกลางคำอื่น (เช่น `ขนม`, `วิชา`).
- ฝั่ง SQL: `BuildAndILikeWhere(raw, exprs)` (`:349`) = `((e ILIKE '%t1%' OR e ILIKE '%alias%') AND (...))` — ทุก token ต้องเจอ; `BuildPartialOrILikeWhere` (`:376`) = OR ทุก token/alias ใช้ดึงผู้สมัครเมื่อ AND ไม่ได้ผล. เพราะ token มีแค่ตัวอักษรไทย/ละติน/ตัวเลข ตัว `'`, `%`, `_` จึงไม่เข้ามาในคำค้น.
- ฝั่งหน่วยความจำ (กรอง/จัดอันดับหลังดึงข้อมูล): `MatchAndLike` (`:402`), `CountMatchedTokens` (`:418`), `MinPartialThreshold` (`:434`; token 1 → 1, 2-3 → N-1, ≥4 → น้อยกว่าระหว่าง N-1 กับ 65%), `ScoreSearchMatch` (`:451`) ให้คะแนน: รหัสสินค้าตรงทั้งหมด 2000 / ขึ้นต้น 1200, ชื่อขึ้นต้นด้วยคำค้นทั้งประโยค 1000 / มีอยู่ 650, ขึ้นต้นด้วย token แรก 350, ต่อ token ในชื่อ 150 (ตรงคำเดิม) หรือ 95 (ตรงคำพ้อง), ต่อ token ในช่องอื่น 70/45, ครบทุก token +500.
- ผู้ใช้เดียวที่พบ: `market/handler.go` (`:856,867,1035-1054`).

### `security` — header ความปลอดภัย (`security/headers.go`)
- `SetSecureHeaders` (`:9`) ตั้ง `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`; ถูกเรียกจาก middleware `SecurityHeaders` (`middleware/middleware.go:17-22`) ที่ router ใส่ทุกคำขอ (`router.go:65`) ([[be-http-router-routes]]).

## ข้อควรระวัง

- **`sqllit.Literal` กับเงิน**: เคส `float64` พิมพ์ด้วย `strconv.FormatFloat(v,'f',-1,64)` ซึ่งเป็นทศนิยมฐานสอง — ขัดกฎ ACCOUNTING NUMBER ถ้าใช้กับยอดเงิน; ควรส่งเป็นสตริงทศนิยม (จะถูกใส่เป็น `'125.50'` แล้ว PostgreSQL แปลงเป็น NUMERIC ตอน INSERT). ชนิดอย่าง `int32`/`uint`/decimal ตกเข้ากรณี default กลายเป็นสตริงเสมอ.
- `ILIKE '%…%'` แบบ leading wildcard ใช้ index ปกติไม่ได้ — รูปแบบนี้เหมาะกับตารางไม่ใหญ่ (ยังไม่ได้ตรวจ index ของตารางสินค้า).
- รายการคำพ้องเป็นข้อมูลที่คนคัดเอง และบางรายการกว้าง (เช่นให้ `น้ำ` จับ `ซอส`/`เหลว`) ทำให้ผลค้นหากว้างกว่าที่ผู้ใช้พิมพ์ — แก้ที่ `thaiB2BSynonymMap`.
- `docno.Stamp` ลดโอกาสชนแต่ **ไม่รับประกันความไม่ซ้ำ** (มิลลิวินาที + 16 บิตสุ่ม) และไม่ต่อเนื่อง — ห้ามใช้เป็นเลขที่เอกสารที่กฎหมายกำหนดให้รันต่อเนื่อง.

## ที่มาในโค้ด

- `backend/internal/platform/docno/docno.go:1-33` — `Stamp`, `stampAt`.
- `backend/internal/platform/sqllit/sqllit.go:1-55` — `Escape`, `Literal`, `Insert`.
- `backend/internal/platform/search/tokenizer.go:12-130` — พยางค์, คำพ้อง, ข้อยกเว้น, alias.
- `backend/internal/platform/search/tokenizer.go:164-345` — ตัดคำไทยและ token.
- `backend/internal/platform/search/tokenizer.go:343-509` — SQL builder, จับคู่, คะแนน.
- `backend/internal/platform/security/headers.go:1-13` — header.
- `backend/internal/adapter/inbound/http/middleware/middleware.go:17-22` — `SecurityHeaders`.

## ดูเพิ่ม

[[backend-overview]] · [[be-query-gateway]] · [[be-error-response-shape]] · [[be-http-router-routes]] · [[be-hexagonal-architecture]] · [[adr-index]]
