---
title: "ตัวจัดการ connection pool ต่อฐานข้อมูล (PoolManager)"
tags: [backend, postgres, pool, platform]
aliases: ["PoolManager", "pgxpool", "PoolKey", "singleflight", "companySchemaSQL", "BuildDSN", "connection pool"]
sources: ["backend/internal/platform/db/pool.go:150", "backend/internal/platform/db/pool.go:176", "backend/internal/platform/db/pool.go:190", "backend/internal/platform/db/pool.go:16", "backend/internal/platform/db/dsn.go:13", "backend/internal/adapter/outbound/dynamicsql/gateway.go:26"]
---

# ตัวจัดการ connection pool (`PoolManager`)

ทุกส่วนที่ต้องคุยกับ PostgreSQL ของ Tenant (identity, query, blob, process, โมดูล) ขอ pool จาก `PoolManager` ตัวเดียวที่ `di` สร้างและส่งต่อ ([[be-hexagonal-architecture]]). pool ถูกเก็บไว้ตามกุญแจ `host|port|user|db` และสร้างตอนใช้ครั้งแรก.

## ทำงานอย่างไร

1. ผู้เรียกประกอบ DSN ด้วย `db.BuildDSN(host, port, database, user, password, sslMode)` (`dsn.go:13`): รูปแบบ key-value ที่ครอบทุกค่าด้วย `'...'` และ escape `\` กับ `'` (`quoteConnValue`, `:29`) จึงใส่อักขระพิเศษในรหัสผ่านได้โดยไม่ต้อง URL-encode; `sslmode` ว่าง = `disable`.
2. เรียก `pools.Get(ctx, databaseName, dsn)` (`pool.go:190`):
   - แยก config ด้วย `pgxpool.ParseConfig`; กุญแจ = `PoolKey(host, port, user, db)` โดย host และ db เป็นพิมพ์เล็ก ตัดช่องว่าง (`pool.go:150-172`) — Tenant ที่อยู่คนละเซิร์ฟเวอร์แต่ชื่อฐานเหมือนกันจึงไม่ชนกัน; ถ้า `databaseName` ว่างใช้ชื่อใน DSN.
   - ถ้ามี pool แล้วคืนทันที (อ่านด้วย `RWMutex`).
   - ถ้ายังไม่มี ใช้ `singleflight` ให้คำขอพร้อมกันของกุญแจเดียวกัน dial ครั้งเดียว (`:176-228`).
3. หลังเปิด pool ใหม่ ถ้าชื่อฐานข้อมูลไม่ใช่ `postgres`/`bcmain` (และไม่ว่าง) จะรัน `companySchemaSQL` (`pool.go:16`, เรียกที่ `:216-218`) ด้วย SimpleProtocol ผลถูกทิ้ง (`_, _ =`): สร้างตาราง `ic_opposite_unit`, `erp_initial` (ใส่คำนำหน้าชื่อ 9 แถวแบบ `ON CONFLICT DO NOTHING`) และตารางช่วยอื่น ๆ + `ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS ...` เพิ่มคอลัมน์ที่โค้ดรุ่นใหม่ต้องใช้ในตารางเดิม (เช่น `ic_trans_detail`, `ap_ar_transport_label`) — เป็นกลไก "migrate เบา ๆ ตอนเปิด pool" แทนระบบ migration ([[be-audit-migrations]]).
4. `CloseAll()` (`:232`) ปิดและล้างทุก pool ตอนปิดเซอร์วิส (`Container.Close`, [[be-service-lifecycle]]).

## ผู้ใช้ pool

| ผู้ใช้ | ฐานที่เปิด | หมายเหตุ |
|---|---|---|
| `outbound/identity` | Main DB `bcerpmain<code>` | ผู้ใช้/บริษัท/สิทธิ์ ([[be-multi-tenant]]) |
| `dynamicsql.Gateway` | Company DB จาก claim | ชื่อฐานถูก `ToLower` ก่อน (`gateway.go:171`) ([[be-query-gateway]]) |
| `blobsql.Gateway` | Company DB จาก claim | [[be-blob-insert]] |
| handler ของโมดูล / process | ตามที่ต้องใช้ | ดู [[process-overview]] |

## ค่าที่ทำให้ผลลัพธ์ปลอดภัยต่อเงิน

`dynamicsql.NormalizeValue` (`gateway.go:26`) แปลง `pgtype.Numeric` เป็นสตริงทศนิยมตรงตัว (หรือ `"NaN"`, `NULL` → nil) ก่อน encode JSON เพื่อไม่ให้ตัวเลขเงินผ่าน `float64` (สอดคล้องกฎ ACCOUNTING NUMBER).

## ข้อควรระวัง

- **ไม่มีการปล่อย pool ที่ไม่ใช้**: จำนวน pool โตตามจำนวน (Tenant × ฐานข้อมูล) ที่ถูกเรียก จนกว่าจะรีสตาร์ต; ใน `pool.go` ไม่พบการตั้ง `MaxConns`/อายุ connection จึงใช้ค่า default ของ pgx (ยังไม่ยืนยันค่าตัวเลข).
- `companySchemaSQL` ถูกรันกับ **ทุกฐานที่ชื่อไม่ใช่ `postgres`/`bcmain`** รวม Main DB ของ Tenant (`bcerpmain<code>`) ด้วย — มันสร้างตาราง/แถวตั้งต้นใน Main DB ด้วย (อนุมานจากเงื่อนไข `pool.go:216`).
- ความล้มเหลวของสคริปต์ถูกกลืนเงียบ ๆ: pool ใช้งานได้แม้ schema ยังไม่ครบ.
- การรัน DDL ในจุดเปิด pool ขัดกับหลัก "ไม่มี migration runner" — โมดูลก็สร้างตารางเองตอนรันด้วย `AllowDDL` เช่นกัน ([[be-hexagonal-architecture]]).
- รหัสผ่านอยู่ใน DSN ในหน่วยความจำเท่านั้น; ห้าม log DSN.

## ที่มาในโค้ด

- `backend/internal/platform/db/pool.go:16-148` — `companySchemaSQL`.
- `backend/internal/platform/db/pool.go:150-239` — `PoolKey`, `PoolManager`, `Get`, `CloseAll`.
- `backend/internal/platform/db/dsn.go:13-34` — `BuildDSN`.
- `backend/internal/adapter/outbound/dynamicsql/gateway.go:26-51` — `NormalizeValue`.
- `backend/internal/di/container.go:65` — สร้าง `PoolManager`.

## ดูเพิ่ม

[[backend-overview]] · [[be-query-gateway]] · [[be-multi-tenant]] · [[be-audit-migrations]] · [[adr-index]]
