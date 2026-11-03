---
title: "แทรกแถวพร้อมรูปภาพ: POST /blob/insert + MinIO (Blob insert)"
tags: [backend, blob, minio, image, upload]
aliases: ["/blob/insert", "blob insert", "minio", "thumbnail", "multipart insert", "image upload", "S3 SigV4", "อัปโหลดรูป"]
sources: ["backend/internal/adapter/inbound/http/blob/handler.go:60", "backend/internal/adapter/inbound/http/blob/handler.go:137", "backend/internal/domain/blob/blob.go:56", "backend/internal/domain/blob/blob.go:86", "backend/internal/adapter/outbound/blobsql/gateway.go:37", "backend/internal/adapter/inbound/http/crm/minio.go:109"]
---

# แทรกแถวพร้อมรูปภาพ (`POST /blob/insert`)

endpoint สำหรับ INSERT 1 แถวที่บางคอลัมน์เป็นรูป: client ส่ง multipart (ชื่อตาราง ชื่อคอลัมน์ ค่าธรรมดา ไฟล์รูป); backend เก็บรูปลง MinIO (S3) แล้วเขียน **URL ของรูป** ลงคอลัมน์ ไม่ใช่ไบต์รูป. ตัดสินใจไว้ใน [[adr-0010-blob-insert-storage]] (ADR เดิมพูดถึง bytea — โค้ดปัจจุบันใช้ MinIO).

## ทำงานอย่างไร

1. route: `POST /blob/insert` ต้อง `Auth` + `queryWriteGuard` (สิทธิ์เมนู `Write`) (`router.go:105-111`) ([[be-menu-rights-permission]]).
2. `Handler.Insert` (`blob/handler.go:60`): จำกัดขนาด body 20MB (`maxRequestBytes`, `:32`) และ `ParseMultipartForm` ใช้หน่วยความจำ 10MB (`:33,68`).
3. field ของฟอร์ม: `table`, `fieldlist` (JSON array ชื่อคอลัมน์), `valuelist` (JSON array ค่า — ข้ามคอลัมน์ที่เป็นไฟล์), `returning` (ชื่อคอลัมน์ที่ต้องการคืนค่า, ต้องระบุ) และไฟล์ที่ **ชื่อ part = ชื่อคอลัมน์**.
4. ตรวจชื่อ: `NewIdentifier` — ขึ้นต้นด้วยตัวอักษร/`_` ตามด้วยตัวอักษร ตัวเลข `_` เท่านั้น (`domain/blob/blob.go:58-66`); แล้ว `ValidateClientInsert(table, fieldlist, level)` กันตารางเงิน/ระบบ (403) ([[be-query-write-policy]]).
5. `zipValuesToMinIO` (`handler.go:137`) วนตาม `fieldlist`:
   - คอลัมน์ที่มีไฟล์ → `readImagePart` อ่านไม่เกิน 5MB (`MaxImageBytes`, `blob.go:56`) และ `NewImageValue` ตรวจ **magic bytes** จริง ว่าเป็น JPEG/PNG/WEBP (ไม่เชื่อ Content-Type ที่ client ส่ง) (`blob.go:125-148`).
   - ตั้ง key `"<dbname>/<table>/<yyyymmdd_hhmmss>_<sha256 16 ตัวแรก>.<ext>"` (พิมพ์เล็ก; db ว่าง → `bcdemo`, table ว่าง → `images`) แล้ว `PutObject` ลง MinIO และสร้าง thumbnail JPEG (ด้านยาวสุด 320px, `crm/minio.go:329`) เก็บเป็น `<key>.thumb.jpg` (ล้มเหลวได้ ไม่ทำให้ insert ล้ม) (`handler.go:155-175`).
   - ค่าที่เขียนลงคอลัมน์ = `"/api/crm/image?key=<key>"` (`handler.go:177`).
   - คอลัมน์ที่ไม่มีไฟล์ → หยิบจาก `valuelist` ตามลำดับ; จำนวนไม่ตรง → error.
6. `appblob.Service.Insert` (`application/blob/service.go:32`): `NewInsert` ตรวจ table/fields (ไม่ว่าง, จำนวนตรง, ไม่ซ้ำ, ชื่อถูกต้อง, `returning` ถูกต้อง) → timeout 30 วินาที → `ResolveConnection` → `blobsql.Gateway.Insert`.
7. `blobsql.Gateway.Insert` (`outbound/blobsql/gateway.go:37`): ประกอบ `INSERT INTO t (cols) VALUES ($1..) RETURNING col` โดยครอบทุก identifier ด้วย `pgx.Identifier.Sanitize()` (`:79-92`) และส่งค่าเป็น **parameter** จริง → คืนค่าคอลัมน์ `returning` แถวแรก; ตอบ `{"id": <ค่า>}` (`insertResponse`).

## การตั้งค่า MinIO

ตัวแปร env `S3_ENDPOINT`, `S3_BUCKET_NAME` (default `bcaiaccount`), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` (default `us-east-1`) หรือชื่อ `R2_*` ที่เทียบเท่า (`crm/minio.go:41-60`) — ตั้งผ่าน env เท่านั้น ([[be-config-env]]). ไคลเอนต์เซ็น AWS SigV4 เองด้วย stdlib (`signedRequest`, `:207`) และ `NewHandler` เรียก `EnsureBucket` ตอนเริ่ม (`blob/handler.go:44-48`).

## ข้อควรระวัง

- URL ที่เก็บคือ `/api/crm/image?...` แต่ route จริงที่ลงทะเบียนคือ `/api/v1/crm/image` (`router.go:262`) — น่าจะมี proxy/rewrite คั่น (ยังไม่ยืนยัน).
- ถ้า INSERT ล้มหลังอัปโหลดรูปแล้ว ไฟล์ใน MinIO ค้าง (ไม่มีขั้นตอนลบ — ไม่พบในโค้ด).
- `CONTEXT.md` ยังเขียนว่าเก็บรูปเป็น `bytea`; โค้ดจริงเปลี่ยนเป็น MinIO แล้ว ให้ยึดโค้ด.

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/blob/handler.go:32-135` — ขีดจำกัด, ฟอร์ม, ตรวจชื่อ/นโยบาย.
- `backend/internal/adapter/inbound/http/blob/handler.go:137-205` — รูป → MinIO → URL.
- `backend/internal/domain/blob/blob.go:22-148` — identifier, `NewInsert`, `NewImageValue`.
- `backend/internal/application/blob/service.go:13-50` — use case + timeout.
- `backend/internal/adapter/outbound/blobsql/gateway.go:37-95` — INSERT parameterized.
- `backend/internal/adapter/inbound/http/crm/minio.go:41-130,317-345` — ไคลเอนต์ S3 และ thumbnail.

## ดูเพิ่ม

[[backend-overview]] · [[be-query-write-policy]] · [[be-config-env]] · [[be-db-pool-manager]] · [[adr-0010-blob-insert-storage]] · [[adr-index]]
