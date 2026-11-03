---
title: "API อัปโหลดรูปพร้อมแทรกแถว /blob/insert (Blob insert endpoint)"
tags: [api, blob]
aliases: ["/blob/insert","blobHandler.Insert","zipValuesToMinIO","ValidateClientInsert","MaxImageBytes"]
sources: ["backend/internal/adapter/inbound/http/router.go:105","backend/internal/adapter/inbound/http/blob/handler.go:32","backend/internal/adapter/inbound/http/blob/handler.go:60","backend/internal/adapter/inbound/http/blob/handler.go:137","backend/internal/domain/blob/blob.go:56","backend/internal/domain/query/write_policy.go:64","backend/internal/adapter/inbound/http/process/permission.go:135"]
---

# API POST /blob/insert

แทรกหนึ่งแถวลงตารางที่ระบุ โดยสามารถแนบไฟล์รูปในคอลัมน์ที่เลือก: รูปถูกอัปโหลดขึ้น MinIO (S3) พร้อมสร้าง thumbnail JPEG ส่วน PostgreSQL เก็บเพียงสตริง URL ของ proxy รูป (ไม่เก็บ bytea). ภาพรวมสถาปัตยกรรมอยู่ที่ [[adr-0010-blob-insert-storage]] — หมายเหตุ: ADR 0010 ยังเล่าแบบเก็บ bytea ใน DB และคอมเมนต์ระดับ package ใน `domain/blob` ก็ยังอ้างแนวเดิม แต่โค้ด handler จริงปัจจุบันอัปโหลดขึ้น MinIO (handler.go:1-4, 137-176) ให้ยึดโค้ดเป็นหลัก.

## สิทธิ์

- `Auth` + `queryWriteGuard` ตัวเดียวกับ `/query/exec` (router.go:105-111) — right ที่ต้องมีคือ Write (Add หรือ Edit) ตาม `QueryRequiredRight` (process/permission.go:135-161)
- ตารางเป้าหมายต้องผ่าน `domainblob.NewIdentifier` (ชื่อไม่ถูกรูปแบบ = 400) และ `ValidateClientInsert` (write_policy.go:64-73): ตารางเงิน/สต็อก/GL หรือคอลัมน์ยอดคงเหลือของ `ic_inventory` = 403 `ErrMoneyTableViaExec`; level < 9 เขียนได้เฉพาะตารางใน allow-list = ไม่ผ่านคือ 403 `ErrAdminOnlyWrite` (ดู [[api-query-exec]], [[adr-0011-query-exec-write-lockdown]])

## Request (multipart/form-data)

| field | ความหมาย |
|---|---|
| `table` | ชื่อตารางที่จะแทรก |
| `fieldlist` | JSON array ของชื่อคอลัมน์ เช่น `["code","name_1","image_url"]` |
| `valuelist` | JSON array ของค่า ตามลำดับเฉพาะคอลัมน์ที่ไม่ใช่รูป (ไม่ใส่ก็ได้เมื่อทุกคอลัมน์เป็นรูป) |
| `returning` | ชื่อคอลัมน์ที่ต้องการคืนค่า (id) |
| ไฟล์รูป | part ที่ชื่อ = ชื่อคอลัมน์ใน `fieldlist` (ใช้ไฟล์แรกของ part) |

กฎจับคู่ (handler.go:137-176): คอลัมน์ที่มี file part -> แทนค่าด้วย URL รูป; ที่เหลือหยิบค่าจาก `valuelist` ตามลำดับ; ขาด/เกินจำนวน = 400 (`no value or image file part supplied` / `valuelist has N value(s) more...`).

ตัวอย่าง (ค่าสมมติ):

```
POST /blob/insert   (Authorization: Bearer <token>)
table=<table>
fieldlist=["code","image_url"]
valuelist=["<code>"]
returning=<column>
image_url=@<file.png>
```

## Response

- 200: `{"id": <ค่าจาก returning หรือรหัสแถวที่แทรก>}` (`insertResponse`, handler.go:50; `response.JSON` handler.go:134)
- ค่าที่เก็บในคอลัมน์รูปคือ `"/api/crm/image?key=<objectKey>"` โดย objectKey = `<ฐานข้อมูลบริษัท>/<ตาราง>/<timestamp>_<sha256 16 ตัวแรก><นามสกุล>` และ thumbnail เก็บเป็น `<objectKey>.thumb.jpg` (สร้างไม่สำเร็จก็ข้าม ไม่ทำให้คำขอล้ม)
- ดึงรูปกลับด้วย `GET /api/v1/crm/image?key=...&variant=thumbnail` ([[api-business-modules]]) ซึ่งตรวจว่า key ขึ้นต้นด้วยชื่อฐานของผู้ใช้ก่อนเสมอ

## Errors

| status | เหตุ |
|---|---|
| 400 | multipart ผิดรูป, `fieldlist`/`valuelist` ไม่ใช่ JSON array, ชื่อตารางผิดรูปแบบ, รูปไม่ใช่ jpeg/png/webp หรือเกิน 5 MB (`ErrImageTooLarge`), จำนวนค่าไม่ตรง, อัปโหลด MinIO ล้มเหลว (ถูกห่อเป็น validation) |
| 401 | ไม่มี/ผิด access token |
| 403 | right ไม่พอ หรือติด write lockdown |

## ขีดจำกัด

- ทั้ง request ไม่เกิน 20 MB (`maxRequestBytes`, handler.go:32); multipart เก็บในหน่วยความจำ 10 MB (`maxMultipartMemory`, handler.go:33)
- รูปแต่ละไฟล์ไม่เกิน 5 MB (`domainblob.MaxImageBytes`, domain/blob/blob.go:56); ชนิดที่รับ jpeg/png/webp ตรวจจากเนื้อไฟล์ไม่ใช่นามสกุล (blob.go:122-)
- timeout รวมของ request 60 วินาที (router.go:64)

## ผู้เรียกฝั่งหน้าเว็บ

ไม่พบ Next route `/api/blob/*` และไม่พบโค้ดใน `frontend/src` หรือ `frontend/account` ที่เรียก `/blob/insert` (grep แล้ว) — endpoint นี้มีไว้ให้ client ภายนอก/สคริปต์ที่ถือ Bearer token เรียกตรง; หน้าจอปัจจุบันอัปโหลดรูปผ่านกลุ่มอื่น เช่น `/api/crm/upload` ([[api-business-modules]]), `itempicture/save` และ `docpicture/save` ([[api-proc-actions-master]]).

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/router.go:105-112`
- `backend/internal/adapter/inbound/http/blob/handler.go:1-4,32-33,60-135,137-176,180-195`
- `backend/internal/domain/blob/blob.go:39-56,120-135`
- `backend/internal/domain/query/write_policy.go:60-73`
