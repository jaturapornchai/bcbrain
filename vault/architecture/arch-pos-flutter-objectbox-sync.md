---
title: สถาปัตยกรรม Flutter POS Offline-First (ObjectBox 13 Entities, SyncEngine, PromotionEngine, ThermalPrinter TIS-620 & Dual Display)
tags: [architecture, pos, flutter, objectbox, offline-sync, thermal-printer, promotion-engine]
aliases: [PosObjectBoxDatabase, SyncEngine, ThermalPrinterService, PromotionEngine, CustomerDisplaySyncService, RestoreMerge, TIS-620]
sources:
  - frontend/pos/lib/core/objectbox_interface.dart:1-110
  - frontend/pos/lib/core/objectbox_native.dart:1-833
  - frontend/pos/lib/core/objectbox_web.dart:1-652
  - frontend/pos/lib/services/sync_engine.dart:1-469
  - frontend/pos/lib/services/restore_merge.dart:1-205
  - frontend/pos/lib/services/promotion_engine.dart:1-807
  - frontend/pos/lib/services/thermal_printer_service.dart:1-434
  - frontend/pos/lib/services/customer_display_sync.dart:1-64
  - frontend/account/pos/PosSetupAndControlScreen.tsx:1-5234
---

# สถาปัตยกรรม Flutter POS Offline-First (`frontend/pos/lib/**`)

ระบบหน้าร้าน `frontend/pos` พัฒนาด้วย Dart/Flutter แบบ Dual-Target (Native Desktop/Mobile + Web) โดยเก็บฐานข้อมูลท้องถิ่นใน `ObjectBox` เพื่อให้แคชเชียร์เปิดบิล คิดโปรโมชัน สะสมแต้ม และพิมพ์ใบเสร็จได้แม้ไม่มีอินเทอร์เน็ต

---

## 1. โครงสร้างฐานข้อมูลท้องถิ่น (`PosObjectBoxDatabase` & 13 Entities)

อินเทอร์เฟซ `objectbox_interface.dart` แยกอิมพลีเมนเทชันเป็น `NativeObjectBoxDatabase` (`objectbox_native.dart`) และ `WebObjectBoxDatabase` (`objectbox_web.dart`) ครอบคลุม **13 `@Entity` structs** ใน `model/objectbox/`:
- **เอกสารและกะขาย**: `BillObjectBoxStruct`, `BillDetailObjectBoxStruct`, `HoldBillObjectBoxStruct`, `ShiftObjectBoxStruct`, `PosLogObjectBoxStruct`
- **สินค้า ราคา โปรโมชัน และคู่ค้า**: `ProductBarcodeObjectBoxStruct`, `ProductCategoryObjectBoxStruct`, `PromotionObjectBoxStruct`, `CouponItemObjectBoxStruct`, `CustomerObjectBoxStruct`, `EmployeeObjectBoxStruct`
- **ช่องทางรับเงิน**: `BankObjectBoxStruct`, `WalletObjectBoxStruct`

การแปลงตัวเลขทั้งหมดผ่าน `core/num_parse.dart` เพื่อหลีกเลี่ยงความคลาดเคลื่อนของทศนิยมเมื่อคำนวณยอดรวมบิลและเงินทอน

---

## 2. กลไกคิวซิงก์ (`SyncEngine`) และการกู้คืนข้อมูล (`RestoreMerge`)

- **`SyncEngine` (`sync_engine.dart`)**: บันทึกรายการรอส่งลง `OutboxEntry` (`outbox_entry.dart`) และสลิปภาพใน `SlipEntry` ส่งขึ้น `POST /api/v1/pos/bills`, `/shift`, `/media` พร้อม Exponential Backoff Retry และแยกสถานะบิลที่ต้องตรวจสอบซ้ำ
- **`RestoreMerge` (`restore_merge.dart`)**: ดึงข้อมูลจาก `GET /api/v1/pos/restore` แล้วผสานเข้าฐานข้อมูลท้องถิ่นโดย**ไม่เขียนทับบิลออฟไลน์ที่ยังรอซิงก์** คืนสรุป `RestoreReport` (จำนวนบิลเพิ่มใหม่/อัปเดต และจำนวนกะ)

---

## 3. เครื่องคำนวณโปรโมชัน พิมพ์ความร้อน TIS-620 และจอที่สอง

- **`PromotionEngine` (`promotion_engine.dart`)**: ประมวลผลกฎโปรโมชัน Type `1..8` และ `101..102` ตรวจสอบอัตราส่วนหน่วยนับ (`unitRatio`), เงื่อนไขเฉพาะสมาชิก (`customerOnly`) และตารางเวลาเปิดโปรโมชัน (`_isWithinSchedule`)
- **`ThermalPrinterService` (`thermal_printer_service.dart`)**:
  - เข้ารหัสภาษาไทยเป็น `TIS-620` (`encodeTis620`) และคำนวณความกว้างตัวอักษรจริงโดยไม่นับสระบน–ล่าง/วรรณยุกต์ (`_isThaiZeroWidthMark`) เพื่อให้ตารางใบเสร็จ 32 คอลัมน์ (58mm) และ 48 คอลัมน์ (80mm) ตรงแนวเป๊ะ
  - เชื่อมฮาร์ดแวร์ผ่าน `thermal_printer_bridge_io.dart` (LAN TCP `:9100`, COM Serial, OS Spooler) และ `thermal_printer_bridge_web.dart` (WebSerial API / Print Window / `.bin`) พร้อมคำสั่ง ESC/POS เตะลิ้นชัก `RJ11`
- **`CustomerDisplaySyncService` (`customer_display_sync.dart`)**: ซิงก์สถานะตะกร้าสินค้าและ Dynamic EMVCo PromptPay QR (`promptpay_service.dart`) ข้ามหน้าต่างไปยัง `customer_display_screen.dart` แบบเรียลไทม์

---

## ดูต่อที่เกี่ยวข้อง
- [[uses_table::tbl-pos-config]] · [[uses_table::tbl-pos-loyalty-promo]] · [[uses_table::tbl-pos-sync-restaurant]]
- [[has_query::sql-pos-operations]]
- [[exposes_api::api-inbound-handlers-workflows]]
