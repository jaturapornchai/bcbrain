---
title: "บันทึกการติดต่อลูกค้าและรูปใน MinIO (sys-crm-activity-images)"
tags: [systems, crm, minio, upload, security]
aliases: ["crm_customer_activity", "CreateActivity", "บันทึกติดตามลูกค้า", "ServeImage", "รูปกิจกรรม CRM", "MinIO CRM"]
sources: ["backend/internal/adapter/inbound/http/crm/handler.go:426-436", "backend/internal/adapter/inbound/http/crm/handler.go:442-531", "backend/internal/adapter/inbound/http/crm/handler.go:533-600", "backend/internal/adapter/inbound/http/crm/handler.go:605-668", "backend/internal/adapter/inbound/http/crm/handler.go:673-690", "backend/internal/adapter/inbound/http/crm/handler.go:738-790", "backend/internal/adapter/inbound/http/crm/handler.go:797-820", "backend/internal/adapter/inbound/http/crm/handler.go:878-892", "backend/internal/adapter/inbound/http/crm/handler.go:1007-1017", "backend/internal/adapter/inbound/http/crm/minio.go:41-58", "backend/internal/adapter/inbound/http/crm/minio.go:163", "backend/internal/adapter/inbound/http/etax/handler.go:41", "backend/internal/adapter/inbound/http/procure/handler.go:44", "backend/internal/adapter/inbound/http/market/handler.go:44", "frontend/crm/CrmDashboard.tsx:704-730", "frontend/src/app/api/crm/image/route.ts:62-68", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:18", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:29"]
---
# บันทึกการติดต่อลูกค้าและรูปใน MinIO (sys-crm-activity-images)

ในโมดูลโทรติดตามของ `/crm` ผู้ใช้บันทึกการคุยกับลูกค้าพร้อมแนบรูปได้ ข้อมูลเก็บในตาราง `crm_customer_activity` ส่วนรูปเก็บใน MinIO/S3 โดยตารางเก็บไว้เพียง key ของรูป

## ตาราง `crm_customer_activity`

สร้างที่ `handler.go:878-892` คอลัมน์ ได้แก่ `cust_code`, `cust_name`, `channel`, `subject`, `note_text`, `contact_person`, `contact_result`, `next_followup_date` (`varchar(40)`), `created_by`, `image_key`, `image_thumb_key` และ `create_date_time_now`

- `GET /api/v1/crm/activities` อ่าน 100 แถวล่าสุด (`:797-820`)
- ก่อนอ่าน ระบบเรียก `ensureSeedActivities` ซึ่งใส่ข้อมูลตัวอย่างให้เฉพาะฐาน `bcdemo` (`:426-436`, `:1007-1017`)

## บันทึกกิจกรรม (`POST /api/v1/crm/activities`)

1. รับได้ทั้ง multipart และ JSON โดย multipart จำกัด body ที่ 12 MB และ form ที่ 10 MB รูปส่งในฟิลด์ `file` หรือ `image` (`handler.go:442-483`)
2. ฟิลด์ที่รับ: `cust_code`, `cust_name`, `channel`, `subject`, `note`, `contact_person`, `contact_result`, `next_followup_date`, `by` (`:495-505`)
3. ค่าตั้งต้น: รหัสลูกค้าตัวอย่าง ช่องทาง "โทรติดตาม" หัวข้อ "ติดตามการสั่งซื้อและดูแลลูกค้า" ผลการติดต่อ "สนใจ / ติดตามผลต่อ" และผู้บันทึกเป็น "พนักงานฝ่ายขาย (<username>)" (`:520-538`)
4. `note` ต้องมีค่า ถ้าว่างจะตอบ `KindValidation` (`:529-531`)
5. ถ้ามีรูปจะอัปโหลดเข้า MinIO แล้ว insert แถวผ่าน `insertUseCase` ถ้า insert ไม่สำเร็จจะคืน error (`:533-600`)

ฝั่งหน้าจอ `handleAddCustomerNote` ส่ง FormData ที่มีฟิลด์ตามข้อ 2 และแนบรูปในฟิลด์ `file` (`CrmDashboard.tsx:704-730`)

## กติกาไฟล์รูป (`uploadActivityImageToMinIO`, `:738-790`)

- ไฟล์ว่างหรือเกิน 10 MB จะถูกปฏิเสธ
- ตรวจชนิดจากเนื้อไฟล์ด้วย `http.DetectContentType` รับ JPEG และ PNG ส่วนไฟล์อื่นต้องขึ้นต้นด้วย `RIFF` จึงจะถือเป็น WEBP
- key = `<ฐานข้อมูล>/crm/<วันเวลา>_<sha256 ย่อ><นามสกุล>` และภาพย่อ JPEG ที่ `<key>.thumb.jpg` ถ้าสร้างภาพย่อไม่สำเร็จจะใช้ key ของรูปหลักแทน
- `POST /api/v1/crm/upload` (`UploadImage`) ใช้กติกาเดียวกันสำหรับอัปโหลดรูปอย่างเดียว (`:673-690`)

## ส่งรูป (`GET /api/v1/crm/image`, `:605-668`)

- key ต้องขึ้นต้นด้วย `<ฐานข้อมูลใน session>/` และห้ามมี `..` ไม่เช่นนั้นจะตอบ not found
- `variant=thumbnail` จะอ่านภาพย่อ ซึ่ง `GetThumbnail` สร้างใหม่ให้เมื่อยังไม่มี (`minio.go:163`)
- ถ้าอ่านจาก MinIO ไม่ได้จะส่งรูป placeholder กลับไป แต่ไม่เขียนทับรูปจริงใน MinIO
- Next API proxy กรองชนิดไฟล์ด้วย `safeMediaContentType` และใส่ `X-Content-Type-Options: nosniff` (`api/crm/image/route.ts:62-68`)

บทเรียนที่บันทึกไว้: เดิม proxy ส่ง `Content-Type` ของไฟล์อัปโหลดต่อตรง ๆ (S5) และเดิม `ServeImage` เขียน placeholder ทับรูปหลักฐานจริงเมื่อ MinIO ล่ม (B7) (`KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:18`, `:29`)

## การตั้งค่า MinIO

`NewMinIOClientFromEnv` อ่านค่าจาก env โดยลองชื่อแบบ S3 ก่อนแล้วจึงแบบ R2 (`minio.go:41-58`)

| ค่า | env |
|---|---|
| endpoint | `S3_ENDPOINT` หรือ `R2_ENDPOINT` |
| bucket | `S3_BUCKET_NAME` หรือ `R2_BUCKET_NAME` |
| access key | `S3_ACCESS_KEY_ID` หรือ `R2_ACCESS_KEY_ID` |
| secret key | `S3_SECRET_ACCESS_KEY` หรือ `R2_SECRET_ACCESS_KEY` |
| region | `S3_REGION` |

HTTP client ตั้ง timeout 25 วินาที handler ของ e-Tax, Procure และ Market ก็ใช้ชนิด `*crmhttp.MinIOClient` นี้เก็บรูปหลักฐาน (`etax/handler.go:41`, `procure/handler.go:44`, `market/handler.go:44`) ดู [[sys-etax-document-stamp]]

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/crm/handler.go:426-436` `ListActivities`, `:797-820` SQL อ่านกิจกรรม
- `backend/internal/adapter/inbound/http/crm/handler.go:442-531` รับคำขอ ค่าตั้งต้น และตรวจ `note`
- `backend/internal/adapter/inbound/http/crm/handler.go:533-600` อัปโหลดรูปและ insert
- `backend/internal/adapter/inbound/http/crm/handler.go:605-668` `ServeImage`
- `backend/internal/adapter/inbound/http/crm/handler.go:673-690` `UploadImage`
- `backend/internal/adapter/inbound/http/crm/handler.go:738-790` กติกาไฟล์และ key
- `backend/internal/adapter/inbound/http/crm/handler.go:878-892` DDL, `:1007-1017` seed เฉพาะ `bcdemo`
- `backend/internal/adapter/inbound/http/crm/minio.go:41-58` env ของ MinIO, `:163` `GetThumbnail`
- `frontend/crm/CrmDashboard.tsx:704-730` ฟอร์มบันทึกกิจกรรม
- `frontend/src/app/api/crm/image/route.ts:62-68` proxy รูป
- ดูเพิ่ม: [[sys-crm-overview]] · [[api-blob]] · [[sys-lineoa-chat-ai]]
