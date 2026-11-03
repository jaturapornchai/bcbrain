---
title: "API จุดขาย POS (POS endpoints /api/v1/pos)"
tags: [api, pos]
aliases: ["/api/v1/pos","/api/v1/pos/sync","/api/v1/pos/bills","/api/v1/pos/bootstrap","/api/v1/pos/config","/api/v1/pos/shift","/api/v1/pos/media","/api/v1/pos/restore","/api/v1/pos/image","/api/v1/pos/devices","/api/v1/pos/bills/reprocess","bcpos1.","PosSyncPage"]
sources: ["backend/internal/adapter/inbound/http/router.go:329","backend/internal/adapter/inbound/http/pos/sync.go:24","backend/internal/adapter/inbound/http/pos/handler.go:60","backend/internal/adapter/inbound/http/pos/media.go:25","backend/internal/application/process/pos_sync.go:399","backend/internal/application/process/pos_bill.go:123","frontend/src/app/api/pos/[...path]/route.ts:1"]
---

# API จุดขาย POS (`/api/v1/pos`)

กลุ่ม endpoint ของระบบขายหน้าร้าน (Flutter POS บนเครื่องแคชเชียร์ + หน้าตั้งค่า POS บนเว็บ) ลงทะเบียนที่ `router.go:329-349` ใต้ `r.Route("/api/v1/pos")` พร้อม `r.Use(ex.Pos.Auth(accessTokenVerifier))` ตัวเดียวกันทั้งกลุ่ม แล้วแยกสองกลุ่มย่อยด้วย `DeviceOnly` / `UserOnly`. ภาพรวมการทำงานเชิงเอกสาร/ซิงก์อยู่ที่ [[be-pos-sync-api]], [[proc-pos-sync]], [[proc-pos-bill]], [[proc-pos-config-shift]]; ภาพรวม API ทั้งระบบที่ [[api-overview]].

## ตารางเส้นทาง (11 คำสั่ง)

| method path | กลุ่ม | handler | ใช้ทำอะไร |
|---|---|---|---|
| POST `/shift` | ทั้งสองแบบ | `ShiftAction` handler.go:264 | คำสั่งกะขาย (รับเงินทอน เปิด/ปิดกะ ยกเลิกบิล สมาชิกชั่วคราว) |
| GET `/image?e=&k=&v=` | ทั้งสองแบบ | `Image` media.go:25 | รูปย่อสินค้า/สมาชิก |
| GET `/sync` | DeviceOnly + gzip | `Sync` sync.go:93 | ดึงข้อมูลเปลี่ยนแปลงลงเครื่อง (สินค้า สมาชิก โปรโมชัน คูปอง) |
| GET `/restore` | DeviceOnly + gzip | `Restore` media.go:103 | กู้สถานะเครื่อง (กะที่เปิดอยู่ เงินเข้า-ออก บิล) |
| POST `/bills` | DeviceOnly | `PostBill` sync.go:111 | ส่งบิลขายจากเครื่องขึ้นเซิร์ฟเวอร์ (idempotent) |
| POST `/media?kind=slip&ref=` | DeviceOnly | `PostMedia` media.go:61 | ส่งภาพสลิปของบิล |
| GET `/bootstrap` | UserOnly | `Bootstrap` handler.go:60 | โหลดข้อมูลหน้าตั้งค่า POS ทั้งหมดในครั้งเดียว |
| POST `/config` | UserOnly | `SaveConfig` handler.go:244 | บันทึกการตั้งค่าตามหมวด |
| GET `/devices` | UserOnly | `ListDevices` sync.go:140 | รายการเครื่อง POS ที่เชื่อมแล้ว |
| POST `/devices/{machine}/pair` | UserOnly | `PairDevice` sync.go:129 | ออก token ให้เครื่อง POS (เห็นครั้งเดียว) |
| POST `/bills/reprocess` | UserOnly | `ReprocessBills` sync.go:152 | ประมวลผลบิลที่ค้าง/พลาดใหม่ |

## สิทธิ์ (Auth)

`Auth` (sync.go:24-) รับ `Authorization: Bearer <token>` ได้สองชนิด:

| ชนิด token | รูปแบบ | ผลต่อ context |
|---|---|---|
| token เครื่อง POS ที่เชื่อมแล้ว | ขึ้นต้น `bcpos1.` (`posTokenPrefix` process/pos_sync.go:228) | สร้าง claims ระดับ 0 ชื่อผู้ใช้ `pos:<machine>` และเก็บ `PosDevice` (provider, ฐานข้อมูล, รหัสเครื่อง) ใน context |
| access token ผู้ใช้ปกติ | JWT หลังเลือกบริษัท | - |

- `DeviceOnly` (sync.go:71): ไม่ใช่เครื่อง/ไม่มี device ใน context = 403 "ใช้ได้เฉพาะเครื่อง POS ที่เชื่อมแล้ว".
- `UserOnly` (sync.go:81): ถ้าเป็นเครื่อง POS จริงจะ 403 (หน้าตั้งค่าเป็นของ back office เท่านั้น).
- มีประเด็นด้านความปลอดภัยที่ทีมพัฒนาต้องตรวจ (ไม่เผยแพร่รายละเอียดบนเว็บสาธารณะ)
- header เสริมจากเครื่อง: `X-Pos-Pending-Bills` (จำนวนบิลค้างส่ง), `X-Pos-App-Version` (ตัดที่ 40 ตัวอักษร) ใช้บันทึกสถานะเครื่องตอน sync (sync.go:96-102).

## 1. GET /sync — ดึงข้อมูลลงเครื่อง

- Query: `cursor` (ว่าง = เริ่มใหม่), `limit` (ค่าเริ่มต้น 500, ถ้า <=0 หรือ >2000 ถูกปรับ; process/pos_sync.go:404).
- Response 200: `{"ok":true,"data":{"cursor":"<opaque>","has_more":true,"server_time":"<UTC>","changes":[{"entity":"product","key":"<code>","rows":[...]}]}}` (`PosSyncPage`).
- `entity` ที่ส่ง: `product`, `member`, `promotion`, `coupon` (pos_sync.go:484-528). cursor เป็น base64url ของ `xid|entity|key` ให้ client เรียกซ้ำจน `has_more=false`.
- ตัวอย่าง:

```
GET /api/v1/pos/sync?cursor=<cursor>&limit=500
Authorization: Bearer <posDeviceToken>
X-Pos-Pending-Bills: 0
X-Pos-App-Version: <appVersion>
```

## 2. POST /bills — ส่งบิลขึ้นเซิร์ฟเวอร์

- Body JSON (จำกัด 1 MB `MaxBytesReader` sync.go:113): บิลมี `bill_guid` (UUID), `doc_no` (1-25 ตัวอักษร), รายการสินค้าอย่างน้อย 1 บรรทัด, การชำระเงิน ฯลฯ (`parsePosBill` pos_bill.go:105). ตัวเงินแปลงด้วยทศนิยมตรง ไม่ใช้ float.
- Response 200: `{"ok":true,"data":{"bill_guid":"...","doc_no":"...","status":"done|cancelled|error","error":"","duplicate":false,"total_amount":"...","earned_points":...}}` (`ReceivePosBill` pos_bill.go:123).
- idempotent ด้วย `bill_guid` ผ่านตาราง `pos_bill_inbox` — ส่งซ้ำได้ ผลจะมี `duplicate:true`.
- Errors: 400 body/บิลผิดรูป (doc_no ว่าง/ยาวเกิน, ไม่มีรายการ); 409 `doc_no` ซ้ำกับบิลอื่น หรือ `bill_guid` เป็นของเครื่องอื่น; 403 ถ้าไม่ใช่เครื่อง.
- ตัวอย่าง:

```
POST /api/v1/pos/bills
Authorization: Bearer <posDeviceToken>
{"bill_guid":"<uuid>","doc_no":"<docNo>","lines":[{"ic_code":"<itemCode>","qty":"1","price":"0.00"}]}
```

## 3. POST /media — ส่งภาพสลิป

- Query: `kind=slip` (ชนิดอื่นถูกปฏิเสธโดย `PosMediaImageID`), `ref=<doc_no>`. Body = ไบต์ดิบ PNG หรือ JPEG ไม่เกิน 5 MB (`posMediaMaxBytes` media.go:20; อ่านด้วย `MaxBytesReader` media.go:71); ชนิดไฟล์ตรวจจากเนื้อไฟล์ด้วย `http.DetectContentType` (media.go:76).
- เก็บใน MinIO ที่ key `<ชื่อฐานข้อมูล>/pos-<kind>/<hash>.<ext>` (content-addressed จึงส่งซ้ำได้) พร้อม thumbnail แล้วบันทึก URL ที่ชี้ไป `/api/crm/image?key=...` (ให้ [[api-business-modules]] ส่วน CRM `ServeImage` เป็นผู้ให้บริการรูป).
- Response 200: `{"ok":true,"data":{"image_url":"/api/crm/image?key=..."}}`.
- Errors: บิลต้องอยู่ใน `pos_bill_inbox` ของเครื่องนี้มาก่อน มิฉะนั้น 409; ไม่มีรูป/เกิน 5 MB = 400 "ไม่มีรูป หรือรูปใหญ่เกิน 5 MB"; ไม่ใช่ PNG/JPEG = 400 "รองรับเฉพาะรูป PNG/JPEG"; เก็บ MinIO ไม่สำเร็จ = 500.

## 4. GET /image — รูปย่อ

- Query: `e=product|member`, `k=<code>` (ยาวไม่เกิน 100 ตัวอักษร), `v=<version>` สำหรับ cache-bust. entity/key ผิด = 400.
- Response: ไบต์ JPEG รูปย่อ พร้อม `Cache-Control: private, max-age=31536000, immutable` (media.go:25-).

## 5. GET /restore — กู้สถานะเครื่อง

- Response 200: `{"ok":true,"data":PosRestore}` — กะที่ยังเปิดอยู่จาก `pos_period`, รายการเงินเข้า-ออก, บิลของเครื่อง (media.go:103-). บีบอัด gzip ระดับ 5 ที่ router.

## 6. GET /bootstrap — โหลดหน้าตั้งค่า

- เรียก `EnsurePosTables` (สร้างตาราง POS ถ้ายังไม่มี handler.go:54) แล้วรัน SELECT 11 คำสั่งเป็น batch เดียว.
- Response 200: `{"ok":true,"pos_config":...,"pos_machines":...,"qr_config":...,"point_condition":...,"promotions":...,"coupons":...,"member_groups":...,"products":[ล่าสุด 60],"settlements":[50],"recent_bills":[50],"temp_members":[50]}`.
- Errors: ถ้า batch ล้มเหลวตอบ 500 `{"ok":false,"error":"<ข้อความ>"}`.
- ค่าเริ่มต้นของการตั้งค่า (เมื่อยังไม่เคยบันทึก) ฝังอยู่ในโค้ดของ handler นี้ ไม่คัดลอกมาที่นี่.

## 7. POST /config — บันทึกตั้งค่า

- Body JSON เป็น map (จำกัด 1 MB `decodeJSONMapUseNumber` handler.go:289; ตัวเลขอ่านเป็น `json.Number` ไม่ผ่าน float).
- ฟิลด์ `section` เลือกหมวด (process/pos_config.go:506-954): `startup`, `machine`/`machines`, `qr`, `point`, `coupon`, `coupon_batch`, `promotion`, `promotion_toggle`, `promotion_delete`. หมวดอื่น = 400 "ไม่รู้จักหมวดตั้งค่า POS". ค่าเงินผ่าน `posDec` (ทศนิยมตรง).
- Response 200: `{"ok":true,"section":"<section>"}`.

```
POST /api/v1/pos/config
Authorization: Bearer <userAccessToken>
{"section":"promotion_toggle","id":"<promotionId>","active":true}
```

## 8. POST /shift — คำสั่งกะขาย

- Body JSON map (จำกัด 1 MB). ฟิลด์ `action` (ค่าเริ่มต้นเมื่อไม่ส่ง = `receive_money`; `PosShiftAction` process/pos_config.go:974-983): `receive_money` / `open_shift` (:1010), `send_money` / `close_shift` (:1059), `cancel_bill` (ต้องมี `doc_no` → `CancelPosBill`), `upload_temp_members` (:1127), `reconcile_temp_member` (:1175). ไม่รู้จัก = 400 "ไม่รู้จักคำสั่งกะขาย".
- รหัสเครื่อง: ถ้าเรียกด้วย token เครื่อง ระบบใช้รหัสเครื่องจาก token เสมอ. `cancel_bill` ต้องมี `doc_no`/`docno` (ว่าง = 400 "กรุณาระบุเลขที่บิล") และ `reason` เป็นทางเลือก.
- Response 200: ผลลัพธ์ของคำสั่งนั้น (map) — รูปแบบขึ้นกับ action.

## 9. จัดการเครื่อง

- `GET /devices` → `{"ok":true,"data":[...]}` (sync.go:140).
- `POST /devices/{machine}/pair` → `{"ok":true,"data":{"token":"bcpos1...."}}` — แสดง token **ครั้งเดียว**; เชื่อมซ้ำจะเพิกถอน token เดิม; รหัสเครื่องต้องตรง `^[A-Za-z0-9_.-]{1,50}$` และมีใน `pos_id` (ไม่พบ = 404). <!-- pragma: allowlist secret -->
- `POST /bills/reprocess` body `{"all":false}` (ไม่มี body ก็ได้). ประมวลผลบิลสถานะไม่สำเร็จ (หรือทั้งหมดเมื่อ `all=true`) สูงสุด 5000 บิล (`LIMIT 5000` pos_bill.go:180). Response `{"ok":true,"data":{"processed":N,"failed":M,"bills":[...]}}`.

## Errors ที่พบบ่อย

| status | เหตุ |
|---|---|
| 400 | JSON/body ผิดรูป, section/action ไม่รู้จัก, entity/key รูปผิด, ไฟล์ภาพเกิน 5 MB |
| 401 | ไม่มี token หรือ token หมดอายุ/ถูกเพิกถอน |
| 403 | เรียกเส้น DeviceOnly ด้วย token ที่ไม่ใช่เครื่อง หรือเส้น UserOnly ด้วย token เครื่อง |
| 404 | เครื่องไม่มีใน `pos_id` (pair), รูปไม่พบ |
| 409 | doc_no ซ้ำ, bill_guid ของเครื่องอื่น, บิลของ media ยังไม่อยู่ใน inbox |
| 500 | ข้อผิดพลาดภายใน |

## ชั้น Next (BFF) — `frontend/src/app/api/pos/[...path]/route.ts`

- `GET`/`POST` ส่งต่อไป `/api/v1/pos/<path>`; ปฏิเสธส่วนของ path ที่เป็น `""`, `.`, `..` ด้วย 404.
- ส่งต่อเฉพาะ header `content-type`, `x-pos-pending-bills`, `x-pos-app-version`.
- ตอบ JSON เกิน 1 KB จะ gzip เมื่อ client ส่ง `accept-encoding`; ล้มเหลวตอบ `fail(...,502)`.
- ดู [[fe-api-proxy-routes]] สำหรับกติกา proxy ทั่วไป.

## ผู้เรียกฝั่งหน้าเว็บ/แอป

- เว็บ: `frontend/account/pos/PosSetupAndControlScreen.tsx` ผ่านฟังก์ชัน `callPos` (:182) — bootstrap :491, config :865/896/921/949, shift :1062, devices :542, pair :1011, reprocess :1043.
- แอป Flutter: `frontend/pos/lib/services/api_service.dart` — sync :84, bills :97, shift :105, media ~:111, restore :121.

## ข้อสังเกต

มีประเด็นด้านความปลอดภัยที่ทีมพัฒนาต้องตรวจ (ไม่เผยแพร่รายละเอียดบนเว็บสาธารณะ)

## ที่มาในโค้ด

- backend/internal/adapter/inbound/http/router.go:329-349 (เส้นทาง + Compress(5))
- backend/internal/adapter/inbound/http/pos/sync.go:24 (Auth), :71 (DeviceOnly), :81 (UserOnly), :93 (Sync), :111-113 (PostBill, 1 MB), :129 (PairDevice), :140 (ListDevices), :152 (ReprocessBills)
- backend/internal/adapter/inbound/http/pos/handler.go:49-58 (resolveClaims, EnsurePosTables), :60 (Bootstrap), :244 (SaveConfig), :264 (ShiftAction), :289 (decodeJSONMapUseNumber 1 MB)
- backend/internal/adapter/inbound/http/pos/media.go:20 (posMediaMaxBytes), :25 (Image), :61 (PostMedia), :71 (MaxBytesReader), :76 (DetectContentType), :103 (Restore)
- backend/internal/application/process/pos_sync.go:228 (posTokenPrefix), :399-404 (PosSyncPull, limit), :484-528 (entities)
- backend/internal/application/process/pos_bill.go:105 (parsePosBill), :123 (ReceivePosBill), :175-180 (ReprocessPosBills, LIMIT 5000)
- backend/internal/application/process/pos_config.go:506-954 (SavePosConfig), :974 (PosShiftAction), :1010, :1059, :1127, :1175 (แต่ละ action)
- frontend/src/app/api/pos/[...path]/route.ts; frontend/account/pos/PosSetupAndControlScreen.tsx:182,491,542,865,896,921,949,1011,1043,1062; frontend/pos/lib/services/api_service.dart:84,97,105,121
