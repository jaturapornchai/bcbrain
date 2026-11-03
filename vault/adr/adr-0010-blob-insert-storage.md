---
title: "ADR-0010 /blob/insert เก็บรูปเป็น bytea (ล้าสมัย: โค้ดใช้ MinIO แล้ว)"
tags: [backend, adr, blob, minio, outdated]
aliases: ["ADR 0010", "blob insert bytea", "blob object storage", "MinIO image"]
sources: ["backend/docs/adr/0010-blob-insert-bytea-not-object-storage.md:7", "backend/internal/adapter/inbound/http/blob/handler.go:2", "backend/internal/adapter/inbound/http/blob/handler.go:137", "backend/internal/domain/blob/blob.go:7"]
---

# ADR-0010 Blob Insert: bytea vs object storage

สถานะ: **accepted ในเอกสาร แต่ล้าสมัยเมื่อเทียบโค้ด** — ADR ตัดสินใจเก็บรูปเป็น `bytea` ใน Postgres (`backend/docs/adr/0010-blob-insert-bytea-not-object-storage.md:7`) แต่ handler ปัจจุบันอัปโหลดรูปไป **MinIO (S3)** พร้อมสร้าง thumbnail แล้วเก็บเฉพาะ URL สั้น ๆ ในคอลัมน์ ("zero bytea in PostgreSQL" — `blob/handler.go:2-4`). ถ้าเจอคอมเมนต์ใน `domain/blob/blob.go:7,49` ที่ชี้มา ADR นี้ ให้ยึดโค้ด.

## ทำงานอย่างไร (ตามโค้ดปัจจุบัน)

1. `POST /blob/insert` (multipart): `table` / `fieldlist` / `valuelist` + ไฟล์ — ดูรายละเอียดที่ [[be-blob-insert]].
2. `zipValuesToMinIO` ส่งไฟล์รูปเข้า MinIO ด้วย `PutObject` และ thumbnail `<key>.thumb.jpg` (best effort) แล้วแทนค่าในคอลัมน์ด้วย URL `/api/crm/image?key=...` (`blob/handler.go:137-191`). หมายเหตุ: route ที่ลงทะเบียนจริงคือ `/api/v1/crm/image` (`router.go:262`) ส่วน prefix `/api/crm/image` น่าจะถูก proxy ฝั่งหน้าเว็บแปลงให้ (ยังไม่ยืนยัน) — ดู [[be-blob-insert]].
3. ไคลเอนต์ MinIO เป็นการ sign SigV4 ด้วย stdlib เอง (`adapter/inbound/http/crm/minio.go`).

## ตัวเลือกที่ ADR ไม่เลือก

- รอสร้าง context `media`/`ObjectStorage` ก่อน และเขียนไฟล์ลงดิสก์เอง — ทั้งสองถูกปฏิเสธใน ADR; สุดท้ายทีมใช้ MinIO ผ่านโมดูล CRM ที่มีอยู่แล้ว (ยังไม่ยืนยันลำดับเหตุการณ์).

## ข้อควรระวัง

- ข้อมูลเก่าที่เคยอยู่ใน `bytea` (ถ้ามี) ไม่ถูก migrate อัตโนมัติ (ยังไม่ยืนยันว่ามี). ADR เองระบุว่าเมื่อ object storage มาแล้วควรมาร์ก ADR นี้ superseded (`...0010...md:16`).
- ต้องตั้ง env ของ MinIO (ชื่อตัวแปรดู [[be-config-env]]) ไม่งั้นการอัปโหลดล้มเหลว.

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/blob/handler.go:2` — คอมเมนต์หัวไฟล์: ส่งรูปเข้า MinIO เก็บแค่ URL.
- `backend/internal/adapter/inbound/http/blob/handler.go:137` — `zipValuesToMinIO`.
- `backend/internal/domain/blob/blob.go:7` — คอมเมนต์เก่าที่ยังอ้าง ADR-0010.
- `backend/docs/adr/0010-blob-insert-bytea-not-object-storage.md:7` — ข้อความใน ADR.

## ดูเพิ่ม

[[be-blob-insert]] · [[be-config-env]] · [[adr-index]]
