---
title: "POS Sync API: เครื่อง POS เชื่อมกับ Account (POS device sync)"
tags: [backend, pos, sync, device, retail]
aliases: ["/api/v1/pos", "bcpos1", "POS device token", "DeviceOnly", "UserOnly", "pos/sync", "pos/bills", "pos/restore", "pos/media", "pos/bootstrap", "pos_bill_inbox", "จับคู่เครื่อง POS"]
sources: ["backend/internal/adapter/inbound/http/router.go:328", "backend/internal/adapter/inbound/http/pos/sync.go:20", "backend/internal/adapter/inbound/http/pos/sync.go:93", "backend/internal/adapter/inbound/http/pos/handler.go:60", "backend/internal/adapter/inbound/http/pos/media.go:25", "backend/internal/application/process/pos_sync.go:228", "backend/docs/POS_SYNC_API.md:1"]
---

# POS Sync API (`/api/v1/pos/*`)

ชั้น HTTP ที่ให้ BC Ai POS (Flutter ขายแบบออฟไลน์ มีฐาน ObjectBox ของตัวเอง) ดึงข้อมูลหลักแบบ delta จาก Account, ส่งบิลขึ้นมาให้ Go สร้างเอกสารบัญชี, อัปโหลดรูปสลิป และกู้เครื่องที่ล้างแล้ว; และให้หน้า Account (back office) ตั้งค่า/จับคู่เครื่อง. แพ็กเกจ `http/pos` เป็นแค่ตัวรับ-ส่ง HTTP — กฎเงิน/ภาษี/สต็อก/GL และ cursor อยู่ใน `application/process` (`pos_sync.go`, `pos_bill.go`, `pos_media.go`, `pos_config.go`) ซึ่งอธิบายใน [[process-overview]].

## ทำงานอย่างไร

1. **Route** (`router.go:328-351`, ลงทะเบียนเมื่อ `ex.Pos != nil`): ทั้งกลุ่มใช้ middleware `ex.Pos.Auth` ของตัวเอง; มี 2 กลุ่มย่อย:

| กลุ่ม | Method + path | หน้าที่ |
|---|---|---|
| (ทุกผู้เรียก) | `POST /shift`, `GET /image` | เปิด/ปิดกะ ส่งเงิน ยกเลิกบิล; รูปย่อ JPEG |
| `DeviceOnly` | `GET /sync` , `GET /restore` (gzip), `POST /bills`, `POST /media` | ฝั่งเครื่อง POS |
| `UserOnly` | `GET /bootstrap`, `POST /config`, `GET /devices`, `POST /devices/{machine}/pair`, `POST /bills/reprocess` | ฝั่ง back office |

2. **ยืนยันตัวตน** (`Auth`, `pos/sync.go:24-52`): อ่าน `Authorization: Bearer`; ถ้าโทเค็นขึ้นต้น `bcpos1.` (`posTokenPrefix`, `process/pos_sync.go:228`) → `process.VerifyPosDevice` (เทียบ SHA-256 ของส่วนลับกับ `pos_sync_machine.token_hash` ด้วย constant-time, `pos_sync.go:310-333`) แล้วสร้าง claims `Username = "pos:<machine>"` ผูก Provider + Company DB ของเครื่อง (ไม่มี level); ไม่ใช่ → ตรวจ JWT ผู้ใช้ตามปกติ ([[be-jwt-session-tokens]]). ฐานข้อมูลมาจาก token เสมอ ไม่มี `?db=` (`handler.go:46-51`).
3. **เครื่องจริง vs session เว็บ**: `UserOnly` (`:81-89`) บล็อกเครื่องจริงที่ใช้ device token → 403; `DeviceOnly` ตอบ 403 ถ้าไม่มี device/claims.
4. **Pull (`GET /sync?cursor=&limit=`)**: อ่าน header `X-Pos-Pending-Bills` (จำนวนบิลค้างส่ง) และ `X-Pos-App-Version` (ตัดเหลือ 40 ตัวอักษร) แล้ว `PosSyncPull` คืน `{"ok":true,"data":{changes,cursor,has_more}}`; cursor ว่าง = ส่งทั้งหมด (รายละเอียด entity `product|member|promotion|coupon|config` อยู่ใน `docs/POS_SYNC_API.md`). cursor อาศัย `pg_snapshot_xmin` จึงธุรกรรมที่เปิดค้างใน Postgres ทำให้ delta ของทุกเครื่องหยุดรอ (ตามเอกสาร).
5. **ส่งบิล (`POST /bills`)** (`sync.go:111-127`): body จำกัด 1MB → `ReceivePosBill` (บันทึก JSON ดิบลง `pos_bill_inbox` ก่อน แล้วสร้าง `ic_trans`/`ic_trans_detail` trans_flag 44 พร้อม GL และคิวสต็อก `pos_stock_queue`). ส่ง `bill_guid` ซ้ำไม่สร้างขายซ้ำ. ตามสัญญา: 200 ใช้ได้ (status `done|cancelled|error`; `error` ก็เก็บไว้เพื่อแก้แล้ว reprocess), 409 ชน doc_no/bill_guid, 400 payload ผิด, 401 token ถูกเพิกถอน. เงินส่งเป็นสตริงทศนิยม ([[be-error-response-shape]] — ใช้ `apperr` ตามปกติ).
6. **จับคู่เครื่อง (`POST /devices/{machine}/pair`)** (`sync.go:129-138`): `PairPosDevice` สร้าง token `bcpos1.…` คืน `{"data":{"token":...}}` **ครั้งเดียว** (เก็บเฉพาะแฮช `pos_sync.go:273-277`); จับคู่ใหม่ = เพิกถอนของเดิมและล้าง `last_cursor`. `GET /devices` แสดงสถานะ sync/บิลค้าง/บิล error/คิวสต็อกต่อเครื่อง; `POST /bills/reprocess {"all":false}` รันบิลจาก inbox ซ้ำหลังแก้บั๊ก และ log จำนวนที่ล้ม (`sync.go:152-176`).
7. **ตั้งค่า / Bootstrap**: `GET /bootstrap` (`handler.go:60`) เรียก `EnsurePosTables` แล้วยิง SELECT 11 คำสั่งผ่าน `BatchUseCase` ([[be-query-gateway]]) ได้ `posconfig`, `pos_id` (เครื่อง), `erp_thai_qr_config`, `pos_point_condition`, `pos_promotions`, `coupon_list` (100 แถว), `pos_member_groups`, ตัวอย่างสินค้า **60 รายการ**, `poscashiersettle` (50), บิลล่าสุด trans_flag 44 (50), `pos_temp_members` (50) — เป็นข้อมูลหน้าตั้งค่า ไม่ใช่แคตตาล็อกเต็ม (แคตตาล็อกเต็มมาทาง `/sync`). ถ้าตารางว่างจะใส่ค่า default ของเงื่อนไขแต้มจากโค้ด (`handler.go:175-186`). `POST /config` → `SavePosConfig` (body ≤ 1MB, `UseNumber` กัน float) คืน `{"ok":true,"section":...}`.
8. **กะ (`POST /shift`)** → `PosShiftAction` (เปิด/ปิดกะ ส่งเงิน `cancel_bill` สมาชิกชั่วคราว); ส่ง `devMachine` จาก device ที่ยืนยันแล้ว. เอกสารระบุว่าส่วนนี้ยังสร้าง SQL ใน handler/ใช้ float (รอย้ายเข้า `process`) — ขัดกับกฎเงิน ([[be-platform-utilities]]).
9. **รูป**: `GET /image?e=product|member&k=&v=` (`media.go:25-59`) คืน JPEG ย่อ ≤320px พร้อม `Cache-Control: private, max-age=31536000, immutable` (URL มีเลขเวอร์ชัน `v` จึงเปลี่ยนเมื่อรูปเปลี่ยน). ต้นทางเป็นไฟล์ใน MinIO (ผ่าน thumbnail) หรือรูป inline ใน `images.image_file` (ย่อทุกคำขอ); ถ้าไฟล์ใน MinIO ล้มหรือเป็นสินค้า seed จะ **ใช้รูปสินค้าตัวอย่างจากแพ็กเกจ `market`** แทน (`:33-44`) ([[be-blob-insert]]). `POST /media?kind=slip&ref=<doc_no>` (`:61-101`): body ≤ 5MB, ตรวจชนิดด้วย `http.DetectContentType` (รับเฉพาะ PNG/JPEG), key = `<db>/pos-<kind>/<sha256 16 hex>.<ext>` (retry ปลอดภัย), เก็บรูปเต็มและรูปย่อลง MinIO (`PutImageWithThumbnail`) แล้ว `RecordPosMedia` ลง `bc_doc_images`; บิลยังไม่มีบนเซิร์ฟเวอร์ = 409 (จาก `PosMediaImageID`); `kind` รับแค่ `slip`.
10. **กู้เครื่อง**: `GET /restore` (`media.go:103-112`) คืนกะที่เปิดอยู่ (หรือวันนี้) + รายการส่งเงินสด + บิลพร้อม payload ดิบ (สูงสุด 5,000 บิลตามเอกสาร); เครื่องสร้างบิลกลับเป็น "ส่งแล้ว" และเลขบิลต่อจาก `config.last_doc_no`.

## ข้อควรระวัง

- มีประเด็นด้านความปลอดภัยที่ทีมพัฒนาต้องตรวจ (ไม่เผยแพร่รายละเอียดบนเว็บสาธารณะ)
- เอกสาร `POS_SYNC_API.md` เขียน URL รูปว่า `/api/pos/image` (ผ่าน Next proxy) แต่ route จริงใน backend คือ `/api/v1/pos/image`; URL ที่เก็บของ `/media` ขึ้นต้น `/api/crm/image` ส่วน route จริงคือ `/api/v1/crm/image` (`router.go:262`) — ต้องมี proxy คั่น (ยังไม่ยืนยัน).
- GL ของบิล POS ลงบัญชีเงินสดทั้งหมด ยังไม่แยกตามวิธีจ่าย; แต้มสะสมเก็บที่ `pos_bill_inbox.earned_points` ยังไม่ลง `ar_customer` (ตามเอกสาร Limitation).
- ตาราง POS (`pos_sync_change`, `pos_sync_machine`, `pos_bill_inbox`, `pos_stock_queue` + trigger `pos_sync_log`) ถูกสร้างอัตโนมัติ "ครั้งแรกที่ใช้ฐานบริษัท" ในชั้น `process` ไม่ใช่ migration ([[be-audit-migrations]]).
- timeout รวมของ router คือ 60 วินาที (`router.go:64`) — `/sync` ที่ใช้ limit ใหญ่ต้องจบในเวลานี้.

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/router.go:328-351` — route และ middleware ของ POS.
- `backend/internal/adapter/inbound/http/pos/sync.go:20-176` — `Auth`, `DeviceOnly`/`UserOnly`, `Sync`, `PostBill`, `PairDevice`, `ListDevices`, `ReprocessBills`.
- `backend/internal/adapter/inbound/http/pos/handler.go:21-296` — `Bootstrap`, `SaveConfig`, `ShiftAction`.
- `backend/internal/adapter/inbound/http/pos/media.go:20-112` — `Image`, `PostMedia`, `Restore`.
- `backend/internal/application/process/pos_sync.go:228-333` — prefix, `PairPosDevice`, `VerifyPosDevice`.
- `backend/docs/POS_SYNC_API.md`, `backend/docs/POS_SYNC_KMS.md` — สัญญา API และกติกาที่ตกลงไว้ (ตรงกับโค้ดที่อ่าน ยกเว้น path รูปข้างต้น).

## ดูเพิ่ม

[[backend-overview]] · [[process-overview]] · [[be-http-router-routes]] · [[be-menu-rights-permission]] · [[be-blob-insert]] · [[be-query-gateway]] · [[adr-index]]
