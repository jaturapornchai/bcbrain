---
title: "ที่เก็บข้อมูลในเครื่อง POS ออฟไลน์ ObjectBox และ SharedPreferences (sys-pos-offline-storage)"
tags: [systems, pos, offline, objectbox, storage]
aliases: ["ObjectBox POS", "StorageService", "PosObjectBoxDatabase", "ออฟไลน์ POS", "outbox", "pos_outbox_v1", "แคชรูปสินค้า", "ImageCacheService"]
sources: ["frontend/pos/lib/core/objectbox.dart:2", "frontend/pos/lib/core/objectbox_native.dart:64", "frontend/pos/lib/core/objectbox_native.dart:77", "frontend/pos/lib/core/objectbox_native.dart:84", "frontend/pos/lib/core/objectbox_native.dart:119", "frontend/pos/lib/core/objectbox_native.dart:195", "frontend/pos/lib/core/objectbox_web.dart:13", "frontend/pos/lib/core/objectbox_web.dart:25", "frontend/pos/lib/services/storage_service.dart:15", "frontend/pos/lib/services/storage_service.dart:37", "frontend/pos/lib/services/storage_service.dart:75", "frontend/pos/lib/services/storage_service.dart:196", "frontend/pos/lib/services/storage_service.dart:214", "frontend/pos/lib/services/storage_service.dart:299", "frontend/pos/lib/services/storage_service.dart:349", "frontend/pos/lib/services/image_cache_service.dart:9", "frontend/pos/lib/models/outbox_entry.dart:3", "frontend/pos/lib/ui/widgets/settings_dialog.dart:694"]
---
# ที่เก็บข้อมูลในเครื่อง POS (ทำงานออฟไลน์ได้)

แอปแคชเชียร์เก็บทุกอย่างที่ต้องใช้ขายไว้ในเครื่อง เพื่อให้ขายต่อได้เมื่ออินเทอร์เน็ตหลุด แล้วค่อยส่งขึ้นเซิร์ฟเวอร์ทีหลัง ([[sys-pos-sync-client]]) ภาพรวม: [[sys-pos-overview]] ตัวกลางคือ `StorageService` ซึ่งใช้ที่เก็บสองแบบ

## 1) ObjectBox (ฐานข้อมูลหลัก)
`StorageService.init()` เปิดฐานข้อมูลผ่าน `objectBoxInit()` (`storage_service.dart:37-40`) มีสองเครื่องยนต์เลือกตามแพลตฟอร์มด้วย conditional import (`objectbox.dart:2-3`):
- **เครื่องยนต์เนทีฟ** (Windows / Android / iOS): ObjectBox เวอร์ชัน 5 เก็บเป็นโฟลเดอร์ในโฟลเดอร์เอกสารของแอป (ถ้าหาไม่ได้ใช้โฟลเดอร์ชั่วคราวของระบบ) (`objectbox_native.dart:64-98`)
- **เครื่องยนต์เว็บ / ตัวสำรอง**: เก็บข้อมูลชุดเดียวกันใน `SharedPreferences` ของเบราว์เซอร์ และใช้เป็นตัวสำรองถ้าเปิดไลบรารีเนทีฟไม่ได้ (`objectbox_web.dart:13-35`, `objectbox_native.dart:119-127`) หน้า "เครื่อง POS" ในตั้งค่ามีการ์ดวินิจฉัยแสดงเครื่องยนต์ที่ใช้อยู่และจำนวนแถวในแต่ละกล่อง (`objectbox_native.dart:239-262`, `settings_dialog.dart:493,694`)

ตารางข้อมูล (entity) ที่ประกาศไว้: สินค้า/บาร์โค้ดหลายหน่วย, หมวดสินค้า, หัวบิลและรายการบิล (รวมบิลรอซิงก์และซิงก์แล้ว แยกด้วยธง `is_sync`), บิลพัก, โปรโมชั่น, สมาชิกและลูกค้าชั่วคราว, คูปอง, กะแคชเชียร์/รายการรับ-ส่งเงิน, บันทึกการทำงาน (audit log), พนักงาน, ธนาคาร, กระเป๋า (`frontend/pos/lib/model/objectbox/*.dart`) ที่ใช้งานผ่าน `StorageService` ได้แก่:

| ข้อมูล | ที่เก็บ | ใช้ตอนไหน |
|---|---|---|
| สินค้า หมวด สมาชิก โปรโมชั่น คูปอง | ObjectBox (รับจากการซิงก์ขาลง) | ค้นหา/ยิงบาร์โค้ด/คำนวณโปรโมชั่น (`storage_service.dart:81-88,316-337`) |
| บิลที่ขายแล้ว | ObjectBox: ยังไม่ซิงก์ / ซิงก์แล้ว | ประวัติบิล 50 รายการล่าสุด (`storage_service.dart:299-314`, `pos_provider.dart:362-384`) |
| บิลพัก | ObjectBox | พักบิล/เรียกกลับ (`storage_service.dart:75-79`) |
| ลูกค้าชั่วคราว (Temp) | ObjectBox | ขายสมาชิกชั่วคราวตอนออฟไลน์ (`storage_service.dart:321-328`) |
| รายการรับ-ส่งเงินที่ยังไม่ส่ง | ObjectBox | ส่งซ้ำรอบซิงก์ถัดไป (`storage_service.dart:339-347`) |
| บันทึกการทำงานแคชเชียร์ | ObjectBox | เพิ่มทุกครั้งที่ใส่สินค้าเข้าตะกร้า (`storage_service.dart:349-376`, `pos_provider.dart:710-720`) |

การรับข้อมูลซิงก์ลงฐาน: หนึ่งหน้าข้อมูลเขียนใน **หนึ่งทรานแซกชัน** (เขียนไม่ครบ = ไม่เขียนเลย) และแต่ละ entity+key ใช้วิธี "ลบแถวเดิมของ key นั้นแล้วใส่ชุดใหม่" แถวว่างหมายถึงลบ (`objectbox_native.dart:195-225`)

> ข้อควรระวัง: ถ้าเปิดฐาน ObjectBox เนทีฟครั้งแรกไม่สำเร็จ โค้ดจะลบโฟลเดอร์ฐานข้อมูลแล้วสร้างใหม่ (`objectbox_native.dart:87-92`) ข้อมูลที่ไม่เคยขึ้นเซิร์ฟเวอร์ในฐานนั้นอาจหาย แต่คิวส่งบิลเก็บใน `SharedPreferences` แยกจากฐานนี้ (หัวข้อถัดไป)

## 2) SharedPreferences (ค่าและคิวเล็กๆ)
คีย์ที่ใช้ (`storage_service.dart:15-26`):
| คีย์ | เก็บอะไร |
|---|---|
| `bc_pos_config` | ค่าเครื่อง (ชื่อร้าน ภาษี พร้อมเพย์ รูปแบบเลขที่บิล ฯลฯ) ดู [[sys-pos-app-config]] |
| `pos_device_token_v2_enc` / `..._key` | รหัสเชื่อมเครื่องแบบแปลงค่า และคีย์สุ่ม (ดู [[sys-pos-device-pairing]]) |
| `pos_sync_cursor`, `pos_last_sync_ms` | ตำแหน่งดึงข้อมูลล่าสุด และเวลาซิงก์ล่าสุด |
| `pos_outbox_v1` | คิวส่งบิล: สถานะ `pending` / `attention` / `sent` ต่อ `bill_guid` พร้อมเนื้อหาบิลที่ freeze ไว้ (`outbox_entry.dart:3`) |
| `pos_slip_outbox_v1` | คิวอัปโหลดรูปใบเสร็จ ([[sys-pos-receipt-printing]]) |
| `pos_doc_seq_v2` | เลขรันล่าสุดที่เครื่องใช้ ต่อ prefix ของรูปแบบเลขที่บิล (`storage_service.dart:184-199`) |
| `pos_shift_state_v1` | กะที่เปิดอยู่ และรายการรับ-ส่งเงิน ([[sys-pos-shift-cash]]) |
| `pos_temp_members_uploaded` | รหัสลูกค้าชั่วคราวที่อัปโหลดแล้ว |
| `pos_restore_done` | เคยกู้คืนข้อมูลเครื่องจากเซิร์ฟเวอร์แล้วหรือไม่ |
| `pos_img_urls_v1` | รายการรูปที่แคชไว้ (ของ `ImageCacheService`) |

## 3) ไฟล์ในเครื่อง
- รูปใบเสร็จ PNG ที่รออัปโหลด: โฟลเดอร์ `pos_slips` ในโฟลเดอร์ข้อมูลแอป (เว็บเก็บในหน่วยความจำ) (`storage_service.dart:41-48,240-258`)
- แคชรูปย่อสินค้า/สมาชิก: ตั้งชื่อไฟล์ด้วยแฮชของ URL รูป โหลดทีละรูปเมื่อแสดงครั้งแรก ไม่ดึงทั้งแคตตาล็อก เกินเพดาน 50 MB ลบอันที่ไม่ได้ใช้นานที่สุดก่อน เปลี่ยนรหัสเชื่อมเครื่องแล้วล้างแคชทั้งหมด เพราะเป็นคนละเครื่อง/คนละบริษัท (`image_cache_service.dart:9-35,92`, `pos_provider.dart:325`)

## เมื่อไรข้อมูลถึงถูกลบ
- รหัสเชื่อมเครื่องเปลี่ยน: ล้างรูปแบบเลขที่บิลและแคชรูป แต่ **ไม่ล้างคิวส่งบิล** และถูกบล็อกหากยังมีของค้างส่ง ([[sys-pos-device-pairing]])
- บิลที่ส่งสำเร็จ: เนื้อหา freeze ในคิวถูกลบ เหลือแต่สถานะ และบิลย้ายไปกลุ่ม "ซิงก์แล้ว" (`sync_engine.dart:233-240`)

## ที่มาในโค้ด
- `frontend/pos/lib/core/objectbox.dart`, `objectbox_native.dart`, `objectbox_web.dart` เครื่องยนต์ฐานข้อมูล
- `frontend/pos/lib/services/storage_service.dart:15-376` รวมทุกการเก็บ
- `frontend/pos/lib/services/image_cache_service.dart` แคชรูป
- `frontend/pos/lib/models/outbox_entry.dart` สถานะคิวส่ง
- ดูเพิ่ม: [[sys-pos-overview]] · [[sys-pos-sync-client]] · [[sys-pos-known-limits]] · [[be-pos-sync-api]]
