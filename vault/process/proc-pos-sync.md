---
title: "POS ซิงก์ข้อมูลเครื่องแคชเชียร์ ผูกเครื่อง/ดึงส่วนต่าง/กู้คืน/รูปภาพ (POS Device Sync)"
tags: [process, pos, sync, device, token, cursor, restore, media]
aliases: ["PosSyncPull", "PairPosDevice", "VerifyPosDevice", "bcpos1", "pos_sync_change", "pos_sync_machine", "posCursor", "xid8", "api/v1/pos/sync", "api/v1/pos/restore", "api/v1/pos/image", "api/v1/pos/media", "PosRestoreData", "ListPosDevices", "ผูกเครื่อง POS", "รหัสเชื่อมเครื่อง POS", "delta sync"]
sources: ["backend/internal/adapter/inbound/http/router.go:329", "backend/internal/adapter/inbound/http/pos/sync.go:24", "backend/internal/adapter/inbound/http/pos/sync.go:93", "backend/internal/adapter/inbound/http/pos/media.go:25", "backend/internal/application/process/pos_sync.go:30", "backend/internal/application/process/pos_sync.go:118", "backend/internal/application/process/pos_sync.go:149", "backend/internal/application/process/pos_sync.go:249", "backend/internal/application/process/pos_sync.go:310", "backend/internal/application/process/pos_sync.go:399", "backend/internal/application/process/pos_sync.go:474", "backend/internal/application/process/pos_sync.go:631", "backend/internal/application/process/pos_media.go:28", "backend/internal/application/process/pos_media.go:136"]
---

# POS ซิงก์ข้อมูลเครื่องแคชเชียร์ (POS Device Sync)

กลุ่ม route `/api/v1/pos` ให้เครื่อง POS (แอป Flutter) ดึงข้อมูลสินค้า/สมาชิก/โปรโมชัน/คูปอง/ตั้งค่าแบบ "ส่วนต่าง" (delta) จากฐานบริษัท โดยไม่ต้องเรียก API ทีละตาราง ฝั่ง back office ใช้ route คู่กันสำหรับผูกเครื่อง ดูสถานะ และสั่งประมวลผลบิลซ้ำ การรับบิลอยู่ที่ [[proc-pos-bill]] การตั้งค่า/กะขายอยู่ที่ [[proc-pos-config-shift]]

## ทำงานอย่างไร

### เส้นทางและผู้เรียก (`router.go:329-348`)
| route | กลุ่ม | หน้าที่ |
|---|---|---|
| `GET /api/v1/pos/sync` | DeviceOnly (บีบอัด Compress 5) | ดึงส่วนต่างหลัง cursor |
| `GET /api/v1/pos/restore` | DeviceOnly (Compress 5) | กู้กะ/บิลของเครื่องที่ล้างเครื่อง |
| `POST /api/v1/pos/bills`, `POST /api/v1/pos/media` | DeviceOnly | ส่งบิล / อัปโหลดรูปสลิป ดู [[proc-pos-bill]] |
| `GET /api/v1/pos/devices`, `POST /api/v1/pos/devices/{machine}/pair` | UserOnly | สถานะเครื่อง / ผูกเครื่อง |
| `POST /api/v1/pos/bills/reprocess` | UserOnly | ประมวลผลบิลซ้ำ ดู [[proc-pos-bill]] |
| `GET /api/v1/pos/image` | ต้องผ่าน Auth เท่านั้น | รูปย่อสินค้า/สมาชิก |

- `Auth` (`pos/sync.go:24`) รับได้ 2 แบบ: โทเคนเครื่อง POS (ขึ้นต้น `bcpos1.`) หรือ access token ผู้ใช้ปกติ เครื่องจะได้ claims ที่ `Username = "pos:" + MachineCode` และผูกกับฐานบริษัทของเครื่องเอง
- `UserOnly` (:81) ปฏิเสธเครื่อง POS จริง (403)
- มีประเด็นด้านความปลอดภัยที่ทีมพัฒนาต้องตรวจ (ไม่เผยแพร่รายละเอียดบนเว็บสาธารณะ)

### โทเคนเครื่องและการผูกเครื่อง
- รูปแบบ: `bcpos1.` + base64url ของ JSON `{p: provider, d: database, m: machine, s: secret}` (`posToken` :237, `posTokenPrefix` :228) ฝั่ง DB เก็บแค่ SHA-256 ของ secret (32 ไบต์สุ่ม) ใน `pos_sync_machine.token_hash` (`PairPosDevice` :249-283) ห้ามบันทึกค่าโทเคนจริงในเอกสารหรือ log
- `PairPosDevice`: รหัสเครื่องต้องตรง `^[A-Za-z0-9_.-]{1,50}$`; ต้องมีเครื่องในตาราง `pos_id` ก่อน (ไม่พบ = 404 "ไม่พบเครื่อง POS ... ในเมนูกำหนดเครื่อง POS"); ตรวจ `doc_format` ไม่ซ้ำเครื่องอื่น (`checkPosDocFormatUnique` :293) แล้ว upsert `pos_sync_machine` -- **ผูกซ้ำจะเปลี่ยนโทเคนและล้าง `last_cursor`** โทเคนเดิมใช้ไม่ได้ทันที โทเคนส่งกลับครั้งเดียว (`pos/sync.go:127-128`)
- `checkPosDocFormatUnique`: รูปแบบเลขที่บิลต้องมี `#` (ตัวเลขลำดับ) และห้ามซ้ำ (ไม่สนตัวพิมพ์) กับ `pos_id` เครื่องอื่น เพราะเครื่อง offline ออกเลขบิลเอง ถ้าซ้ำจะชน (คอมเมนต์ :283-284) ฟังก์ชันนี้ถูกเรียกตอนบันทึกเครื่องด้วย (`pos_config.go:593`)
- `VerifyPosDevice` (:310): แกะโทเคน ตรวจรูปแบบ `p/d/m` และ secret 32 ไบต์ แล้วเทียบแฮชด้วย `subtle.ConstantTimeCompare` ผิดทุกกรณีตอบข้อความเดียวกัน (401 "รหัสเชื่อมเครื่อง POS ไม่ถูกต้องหรือถูกยกเลิก")

### ระบบ "ส่วนต่าง" (`pos_sync.go:24-28`)
1. ตารางต้นทางมี trigger `pos_sync_log` (ฟังก์ชัน :77) ที่ INSERT/UPDATE/DELETE แล้วบันทึกว่า "คีย์นี้เปลี่ยน" ลง `pos_sync_change(entity, entity_key, xid xid8, changed_at)` หนึ่งแถวต่อคีย์ (upsert ตีตรา `xid` ใหม่ด้วย `pg_current_xact_id()`) -- การแก้จากโปรแกรม BC เดสก์ท็อปถูกจับด้วยวิธีเดียวกัน
2. ตารางต้นทาง -> entity (`posSyncSources` :118): `ic_inventory`/`ic_inventory_barcode`/`ic_unit_use`/`images` -> `product`; `ar_customer` -> `member`; `pos_promotions` -> `promotion`; `coupon_list` -> `coupon`; `posconfig`/`pos_id`/`erp_thai_qr_config`/`pos_point_condition` -> `config` (คีย์ `*`)
3. `ic_inventory`/`ar_customer` ผูก trigger เฉพาะ column ที่เครื่องใช้ (ไม่รวม `balance_qty`/`average_cost`) เพื่อให้การคำนวณสต็อกหลังขายไม่ทำให้ทุกเครื่องโหลดสินค้าซ้ำ (คอมเมนต์ :115-117)
4. `images`: ฟังก์ชัน `pos_sync_log_image` (:99) แยก `image_id` ขึ้นต้น `CONTRACT` = รูปสมาชิก (`member`) นอกนั้น = รูปสินค้า (`product`)
5. `ensurePosSync` (:149) ติดตั้ง schema + trigger ครั้งเดียวต่อฐานต่อโปรเซส (`s.posSchema`) และ backfill ทุกแถวเดิมเข้า `pos_sync_change` หนึ่งครั้ง (`posSyncBackfill` :139) เพื่อให้เครื่องใหม่ (cursor ว่าง) ได้แคตตาล็อกเต็มทางเส้นเดียวกัน ตารางที่ไม่มีในฐานถูกข้าม

### ดึงส่วนต่าง `PosSyncPull` (:399)
- Input จาก handler (`pos/sync.go:93-108`): query `cursor`, `limit`; header `X-Pos-Pending-Bills` (จำนวนบิลค้างในเครื่อง), `X-Pos-App-Version` (ตัดเหลือ 40 ตัวอักษร)
- `limit` <= 0 หรือ > 2000 = 500 (:404) อ่านเกินมา 1 แถวเพื่อรู้ `has_more`
- เงื่อนไขอ่าน: `(xid, entity, entity_key) > cursor` **และ** `xid < pg_snapshot_xmin(pg_current_snapshot())` -- คืนเฉพาะรายการจากทรานแซกชันที่เก่ากว่าทุกทรานแซกชันที่ยังรันอยู่ cursor จึงไม่ข้ามการเปลี่ยนที่ commit ทีหลัง ข้อแลกเปลี่ยนที่โค้ดระบุเอง: ทรานแซกชันที่เปิดค้างนานทำให้ซิงก์หยุดชั่วคราว (`ponytail` คอมเมนต์ :398)
- cursor เป็น base64url ของ `xid|entity|key` (`posCursor` :356-382) ผิดรูป = 400 "cursor ไม่ถูกต้อง"; cursor ว่าง = เริ่มต้นใหม่
- ผลลัพธ์ `{cursor, has_more, server_time, changes[]}` โดยแต่ละ change = `{entity, key, rows[]}` และ **rows ว่าง = ให้ลบในเครื่อง** ยกเว้นเครื่องใหม่ (cursor ว่าง) ไม่ส่งรายการลบ (:449)
- แต่ละ entity ถูก project เป็นแถวปัจจุบันด้วย `projectPosEntity` (:474): `product` (JOIN barcode/หน่วย/กลุ่มสินค้า, ราคา `retail/wholesale/member` เป็นข้อความทศนิยม), `member`, `promotion`, `coupon` (ส่งเฉพาะที่ใช้ได้: `last_status = 0` และยังไม่หมดอายุ ที่เหลือกลายเป็นรายการลบ), `config` (`posDeviceConfig` :567 = ก้อนเดียว `shop/machine/qr/point/last_doc_no`)
- เงินเป็นสตริงทศนิยมเสมอ (`::text`) ตามกฎ ACCOUNTING NUMBER รูปภาพส่งเป็น `image_url` = `/api/pos/image?e=&k=&v=` โดย `v` คือ `xmin` ของแถวรูป จึงเปลี่ยน URL ทุกครั้งที่รูปเปลี่ยน (:552-559)
- `config.last_doc_no` = `max(doc_no)` ใน `pos_bill_inbox` ของเครื่อง เพื่อให้เครื่องรันเลขบิลต่อได้หลังติดตั้งใหม่ (:601-604)
- ท้ายสุดบันทึก heartbeat ลง `pos_sync_machine` (`last_seen_at`, `pending_bills`, `app_version`, `last_cursor`; `last_sync_at` อัปเดตเมื่อ `has_more = false`)

### สถานะเครื่อง `ListPosDevices` (:631)
คืนทุกเครื่องจาก `pos_id` พร้อม `paired`, `paired_at`, `last_seen_at`, `last_sync_at`, `pending_bills`, `last_bill_at`, `app_version`, `bill_errors` (บิล `status = 2` ของเครื่องนั้น) และ `up_to_date` = ผูกแล้ว + เคยซิงก์ + cursor ไม่ต่ำกว่าการเปลี่ยนล่าสุดบนเซิร์ฟเวอร์ รวมกับ `stock_queue` (แถวใน `pos_stock_queue`), `bill_errors_total`, `latest_change_at`

### กู้คืนเครื่อง `GET /pos/restore` (`PosRestoreData` pos_media.go:136)
คืน `{shift, settlements[], bills[]}` ของเครื่อง: กะที่เปิดอยู่ (`pos_period.period_status = 0` ล่าสุด; ไม่มี = ตั้ง `shift = null`), รายการรับ/ส่งเงิน `poscashiersettle` ตั้งแต่วันเริ่มกะ (ไม่มีกะ = วันนี้ตามวันของเซิร์ฟเวอร์), และบิลดิบจาก `pos_bill_inbox` (สถานะ `pending|done|error|cancelled`, payload ตามที่เครื่องส่ง) สูงสุด 5000 บิล (`posRestoreMaxBills` :131) แคตตาล็อกและเลขบิลถัดไปกลับมาทางการซิงก์ปกติ (คอมเมนต์ :112-115)

### รูปภาพ (`pos_media.go`, `pos/media.go`)
- `GET /pos/image?e=product|member&k=<รหัส>&v=` คืน **รูปย่อ JPEG เสมอ** พร้อม `Cache-Control: private, max-age=31536000, immutable` (`pos/media.go:25-56`) ตัวต้นฉบับอยู่ใน MinIO (คีย์ต้องขึ้นต้น `<ฐาน>/` ของบริษัทตัวเอง -- ไม่ตามแถวที่ชี้ไปบริษัทอื่น, `PosImage` :28-65) หรือเป็น bytea ใน `images.image_file` ของ BC เดสก์ท็อป (ย่อต่อคำขอ ตามคอมเมนต์ `ponytail` ใน `pos/media.go`)
- `POST /pos/media?kind=slip&ref=<doc_no>` รับ PNG/JPEG ไม่เกิน 5 MB (`posMediaMaxBytes`) รองรับเฉพาะ `kind=slip` และต้องมีบิลนั้นของเครื่องนี้ใน `pos_bill_inbox` แล้ว (ยังไม่มี = 409 ให้ส่งบิลก่อน) เก็บที่ MinIO ด้วยคีย์ที่อิงแฮชเนื้อหา (ส่งซ้ำได้ผลเดิม) แล้ว `RecordPosMedia` ลง `bc_doc_images` ช่อง 0 แบบแทนที่แถวเดิม

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/router.go:329-348` - ผูกกลุ่ม `/api/v1/pos`
- `backend/internal/adapter/inbound/http/pos/sync.go:24-91,93-176` - `Auth`, `DeviceOnly`/`UserOnly`, `Sync`, `PairDevice`, `ListDevices`
- `backend/internal/adapter/inbound/http/pos/media.go:25-112` - `Image`, `PostMedia`, `Restore`
- `backend/internal/application/process/pos_sync.go:30-115` - schema ซิงก์ (`pos_sync_change`, `pos_sync_machine`, `pos_bill_inbox`, `pos_stock_queue`, ฟังก์ชัน trigger)
- `backend/internal/application/process/pos_sync.go:118-210` - `posSyncSources`, `posSyncBackfill`, `ensurePosSync`, `posEntityTable`
- `backend/internal/application/process/pos_sync.go:212-340` - `posPool`, โทเคน, `PairPosDevice`, `VerifyPosDevice`
- `backend/internal/application/process/pos_sync.go:342-565` - cursor, `PosSyncPull`, `projectPosEntity`
- `backend/internal/application/process/pos_sync.go:567-671` - `posDeviceConfig`, `ListPosDevices`
- `backend/internal/application/process/pos_media.go:28-194` - `PosImage`, `PosMediaImageID`, `RecordPosMedia`, `PosRestoreData`

## ดูเพิ่ม
- [[proc-pos-bill]]
- [[proc-pos-config-shift]]
- [[proc-dispatcher]]
- [[proc-doc-item-pictures]]
- [[backend-overview]]
- [[process-overview]]
