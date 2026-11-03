---
title: "API ประตูเขียนข้อมูล /query/exec และ /query/execBatch (Query exec endpoints)"
tags: [api, query]
aliases: ["/query/exec","/query/execBatch","/api/query/exec","/api/query/execBatch","queryExec","queryExecBatch","ErrMoneyTableViaExec","ErrAdminOnlyWrite","queryWriteGuard"]
sources: ["backend/internal/adapter/inbound/http/router.go:95","backend/internal/adapter/inbound/http/query/handler.go:227","backend/internal/adapter/inbound/http/query/handler.go:281","backend/internal/application/query/service.go:95","backend/internal/application/query/service.go:137","backend/internal/domain/query/query.go:335","backend/internal/domain/query/query.go:363","backend/internal/domain/query/query.go:397","backend/internal/domain/query/write_policy.go:77","backend/internal/adapter/inbound/http/process/permission.go:138","frontend/src/app/api/query/exec/route.ts:12","frontend/src/app/api/query/execBatch/route.ts:12","frontend/src/lib/query-client.ts:44"]
---

# API /query/exec และ /query/execBatch

ประตูเขียนข้อมูลทั่วไป (INSERT/UPDATE/DELETE) สำหรับหน้าจอที่ยังไม่มี process endpoint ของตัวเอง. ผ่านสามชั้นตรวจ: (1) สิทธิ์ตามชนิดคำสั่งที่ router, (2) รูปแบบ SQL ที่ domain, (3) "write lockdown" ที่ห้ามแตะตารางเงิน/สต็อก/GL จากเบราว์เซอร์. เหตุผลอ่าน [[adr-0006-query-exec-dml-only-guardrails]], [[adr-0009-query-exec-batch-transactional]], [[adr-0011-query-exec-write-lockdown]]; ตารางเงินให้ใช้ [[api-process-run]] แทน; ฝั่งอ่านดู [[api-query-gateway]].

## ชั้นที่ 1: router และ right (router.go:85-102)

- `Auth` (Bearer access token) แล้วตามด้วย `queryWriteGuard = RequireRight(ex.Rights, processhttp.QueryRequiredRight)` (router.go:85-88 สร้าง guard นี้เฉพาะเมื่อ router ได้รับ `Rights`; ถ้าไม่มี `exec`/`execBatch` จะข้ามชั้นนี้ไปเหลือชั้นที่ 2 และ 3)
- `QueryRequiredRight` (process/permission.go:135-161) ตัดสิน right ตามชนิดคำสั่ง (path `/blob/insert` -> Write, `/query/exec` ดูคำสั่งเดียว, `/query/execBatch` ดูทั้งชุดผ่าน `sqlBatchRight`, บอดี้ที่อ่านไม่ได้ -> Write): `insert` -> Add, `update` -> Edit, `delete` -> Delete, อื่น ๆ -> Write. ผู้ใช้ที่มีสิทธิ์เมนูระดับ Admin (`rights.Admin`) ผ่านทุกชนิด; Write = Add หรือ Edit (`Allows`, middleware/permission.go:41-58) (ดู [[proc-permission-rights]], [[be-menu-rights-permission]])
- ไม่ผ่านสิทธิ์ = 403 พร้อมข้อความไทยจาก `deniedMessages` (middleware/permission.go:31); `peekJSON` อ่านบอดี้สูงสุด 1 MB เพื่อดูคำสั่งแล้วคืนบอดี้ให้ handler (permission.go:231)

## ชั้นที่ 2: รูปแบบ SQL (domain/query/query.go)

- `NewWriteStatement` (query.go:335): รับคำสั่งเดียวที่ขึ้นต้น `INSERT`/`UPDATE`/`DELETE` หรือ `WITH ... <DML>`; ปฏิเสธ DDL/คำสั่งผู้ดูแล (`ErrNotWriteOnly` = 400)
- `ValidateUserLevel` (query.go:363): level < 9 ห้ามเขียน `bc_user_list`, `bc_database_list*`, `erp_option` (`ErrForbiddenTable` -> 403)
- ชุด `execBatch`: `NewWriteBatchStatements` (query.go:397) ไม่เกิน 1000 คำสั่ง (`MaxExecBatchStatements`, query.go:77) และรวมไม่เกิน 2 MB (`MaxExecBatchBytes`, query.go:81)

## ชั้นที่ 3: write lockdown

`ValidateClientPolicy` (domain/query/write_policy.go:77-103):

1. SQL ที่หาตารางเป้าหมายไม่ได้ = `ErrAdminOnlyWrite`
2. ตารางเงิน/สต็อก/GL (ตระกูล `ic_trans*`, `ap_ar_trans*`, `as_trans*`, `cb_trans*`, `cb_chq_list`, `gl_journal*` และอื่น ๆ) หรือ `ic_inventory` ที่แก้คอลัมน์ยอดคงเหลือ (`balance_qty`, `average_cost` ฯลฯ) = `ErrMoneyTableViaExec` ข้อความ "…only be changed through /api/process"
3. level < 9 เขียนได้เฉพาะตารางใน allow-list เดิม (`write_policy_legacy.go:9`) นอกนั้น `ErrAdminOnlyWrite`
4. ทั้งสองกรณีแมปเป็น `KindForbidden` = 403 (service.go:102-109; ชุดคำสั่งที่ service.go:143-150)

## POST /query/exec

- Request: `{"sql":"UPDATE ic_inventory SET name_1 = '<ชื่อ>' WHERE code = '<itemCode>' RETURNING code"}` (handler.go:227)
- Response 200: `{"rowsAffected":1,"rows":[{...}]}` (`rows` คืนเมื่อมี `RETURNING`)
- Errors: 400 SQL ไม่ใช่ DML เดี่ยว/ว่าง, 401 token, 403 right/ตารางต้องห้าม
- timeout 30 วินาที (service.go:115); log เก็บแค่ keyword, ตาราง, hash ของ SQL (ไม่เก็บ SQL ดิบ) handler.go:243-260

## POST /query/execBatch

- Request: `{"sql":["INSERT ...","UPDATE ..."]}` (handler.go:281)
- Response 200: `[{"rowsAffected":n,"rows":[...]},...]` ตามลำดับ
- ทำใน transaction เดียว: คำสั่งไหนพัง ย้อน (rollback) ทั้งชุด ไม่มีผลบางส่วน (service.go:137-171, [[adr-0009-query-exec-batch-transactional]]); ข้อความ error ของ lockdown ระบุ `statement N`
- ตัวอย่าง:

```json
POST /query/execBatch
{"sql":["INSERT INTO ic_color (code, name_1) VALUES ('<code>','<name>')","DELETE FROM ic_color WHERE code = '<oldCode>'"]}
```

## ผู้เรียกฝั่งหน้าเว็บ

- `POST /api/query/exec` (`src/app/api/query/exec/route.ts:12`): ต้องมี `sql` เป็นสตริง ไม่งั้น 400 "กรุณาระบุคำสั่ง SQL"; ส่งต่อ `/query/exec` (route.ts:31) ผ่าน `fetchServiceWithAuthRetry`; ผลห่อ `{ok:true,data}`; ตัวช่วย `queryExec` ที่ `src/lib/query-client.ts:44`
- `POST /api/query/execBatch` (`execBatch/route.ts:12`): ต้องเป็น array ไม่ว่าง; `queryExecBatch` ที่ query-client.ts:63
- งานเงิน/สต็อก/GL ของหน้าจอไม่ใช้ route นี้ แต่ใช้ `saveTrans`, `saveDoc`, `rebuildStock` ฯลฯ ใน query-client.ts (ดู [[api-proc-actions-transaction]], [[fe-query-client-sql-builder]])

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/router.go:85-102`
- `backend/internal/adapter/inbound/http/process/permission.go:135-161,231`
- `backend/internal/adapter/inbound/http/query/handler.go:218-340`
- `backend/internal/application/query/service.go:95-171`
- `backend/internal/domain/query/query.go:61-81,335-425`, `write_policy.go:12-103`, `write_policy_legacy.go:5-41`
- `frontend/src/app/api/query/exec/route.ts`, `execBatch/route.ts`; `frontend/src/lib/query-client.ts:44,63`
