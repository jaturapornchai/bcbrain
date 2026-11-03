---
title: "API ประตูอ่านข้อมูล /query — list, limit, batch (Query gateway read endpoints)"
tags: [api, query]
aliases: ["/query/list","/query/limit","/query/batch","/api/query/list","/api/query/limit","/api/query/batch","queryList","queryLimit","queryBatch"]
sources: ["backend/internal/adapter/inbound/http/router.go:90","backend/internal/adapter/inbound/http/query/handler.go:103","backend/internal/adapter/inbound/http/query/handler.go:163","backend/internal/adapter/inbound/http/query/handler.go:347","backend/internal/application/query/service.go:32","frontend/src/app/api/query/list/route.ts:12","frontend/src/app/api/query/limit/route.ts:12","frontend/src/app/api/query/batch/route.ts:12","frontend/src/lib/query-client.ts:16"]
---

# API /query (ฝั่งอ่าน): list, limit, batch

ประตู SQL สำหรับหน้าจอทั่วไปของ frontend: ส่ง SQL ข้อความมา Go ตรวจ แล้วรันบนฐานบริษัทของ token (provider/database มาจาก claims ไม่ใช่ body). แนวคิดและเหตุผลอ่านที่ [[adr-0005-query-gateway-read-only-first]] และ [[adr-0008-query-batch-endpoint]]; ฝั่งเขียนอยู่ที่ [[api-query-exec]]; ตัวประกอบ SQL ฝั่งหน้าเว็บอยู่ที่ [[fe-query-client-sql-builder]].

## สิทธิ์และ header

- ทุก route ใต้ `/query` ผ่าน `Auth` (router.go:90-102): `Authorization: Bearer <accessToken>`; ไม่มี/ผิด = 401 `missing or invalid access token`
- เวลาจำกัดต่อคำสั่ง `queryTimeout` = 30 วินาที (application/query/service.go:16) และ timeout รวมของ request 60 วินาที (router.go:64)

## กฎ SQL ที่ใช้กับทุก endpoint ฝั่งอ่าน

`NewStatement` (domain/query/query.go) รับเฉพาะ `SELECT` หรือ `WITH` เท่านั้น; ปฏิเสธ DML/DDL และ pattern ต้องห้ามใน SELECT. ข้อผิดพลาดตรวจ SQL = `KindValidation` = 400. ฝั่ง Next ตรวจซ้ำก่อนส่ง.

| ค่าคงที่ | ค่า | ที่มา |
|---|---|---|
| `MaxLimit` (แถวต่อหน้าของ `/query/limit`) | 1000 | domain/query/query.go:66 |
| `MaxListRows` (แถวสูงสุดของ `/query/list`) | 50000 | query.go:69 |
| `MaxBatchStatements` (คำสั่งต่อ `/query/batch`) | 20 | query.go:73 |

## POST /query/list

- Request: `{"sql":"SELECT ... "}` (handler.go:103)
- Response 200: อาร์เรย์ของแถว `[{"col":value,...}]` (ตรง ๆ ไม่มี envelope)
- เกิน 50000 แถว = `ErrTooManyRows` (400); คำสั่งช้ากว่า 1 วินาที (`slowQueryThreshold`, handler.go:28) ถูกบันทึก log โดยปิดค่า literal ด้วย `maskSQLLiterals`
- ตัวอย่าง: `POST /query/list {"sql":"SELECT code, name_1 FROM ic_inventory WHERE code = '<itemCode>'"}`

## POST /query/limit

- Request: `{"sql":"SELECT ...","offset":0,"limit":50,"includeTotal":true}` (handler.go:163)
- Response 200: `{"totalRecords":123,"rows":[...]}` โดย `totalRecords` มีเมื่อ `includeTotal=true` (นับด้วย `queryTotal`, service.go:219)
- `offset` < 0 ถูกบีบเป็น 0 และ `limit` <= 0 หรือ > 1000 ถูกบีบเป็น 1000 (`NewPagination`, query.go:454-460)
- ตัวอย่าง: `{"sql":"SELECT * FROM ar_customer ORDER BY code","offset":0,"limit":50,"includeTotal":true}`

## POST /query/batch

- Request: `{"sql":["SELECT ...","SELECT ..."]}` ไม่เกิน 20 คำสั่ง (handler.go:347; service.go:180)
- Response 200: อาร์เรย์ของอาร์เรย์แถว `[ [...rows ของคำสั่ง 1...], [...คำสั่ง 2...] ]` ตามลำดับ
- คำสั่งใดพังจะหยุดทั้งชุดและคืน error ของคำสั่งนั้น (service.go:176-215); ใช้ connection เดียวกัน (ถ้า gateway มี `QueryBatch` จะส่งทั้งชุดครั้งเดียว ไม่งั้นรันทีละคำสั่ง) ภายใต้ timeout 30 วินาทีรวมทั้งชุด; ข้อความ error ระบุลำดับ `statement N` ในโหมดรันทีละคำสั่ง (service.go:204-212)
- เกิน 20 คำสั่ง = `ErrTooManyStatements` (400)

## รูปแบบ error

`{"error":{"message":"..."}}` (response/response.go; ดู [[be-error-response-shape]]): validation 400, token 401, forbidden 403, อื่น ๆ 500 ข้อความกลาง `internal server error`.

## ผู้เรียกฝั่งหน้าเว็บ

Next route ห่อผลเป็น `{ok:true,data}` (ผิดพลาด `{ok:false,error,code}`) — ดู [[fe-api-proxy-routes]]:

- `POST /api/query/list` (`src/app/api/query/list/route.ts:12`): รับ `sql` หรือ `query`; ฟังก์ชัน `queryList` ใน `src/lib/query-client.ts:16`
- `POST /api/query/limit` (`limit/route.ts:12`): ค่าเริ่มต้น `limit=50`, `offset=0`, `includeTotal=true`; ถ้า `source="sql_utility"` ต้อง level >= 9 (403 `FORBIDDEN`); `queryLimit` ที่ query-client.ts:25
- `POST /api/query/batch` (`batch/route.ts:12`): ตรวจ array ไม่ว่าง และไม่เกิน 20 ก่อนส่ง; `queryBatch` ที่ query-client.ts:54
- ทั้งหมดใช้ `requireSession` -> `getValidAccessToken` -> `fetchServiceWithAuthRetry` (api-server.ts:248, 555, 388) ซึ่งลองซ้ำเมื่อ 502/503/504 สูงสุด 3 ครั้ง และต่ออายุ token เมื่อเจอ 401; ไม่มี token = 401 `NO_TOKEN`

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/router.go:90-103`
- `backend/internal/adapter/inbound/http/query/handler.go:28,103,163,347`
- `backend/internal/application/query/service.go:16,32,58,180,219`
- `backend/internal/domain/query/query.go:35-81,432,454`
- `frontend/src/app/api/query/list/route.ts`, `limit/route.ts`, `batch/route.ts`
- `frontend/src/lib/query-client.ts:16,25,54`, `frontend/src/lib/api-server.ts:248,388,555`
