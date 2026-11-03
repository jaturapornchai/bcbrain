---
title: "ค่าเครื่อง POS ที่ซิงก์มา และการตั้งค่าในเครื่อง (sys-pos-app-config)"
tags: [systems, pos, config, settings, permissions]
aliases: ["AppConfig", "applySync", "ค่าเครื่อง POS", "ตั้งค่า POS", "doc_format", "สิทธิ์แก้ราคา", "สิทธิ์แก้ส่วนลด", "ที่อยู่เซิร์ฟเวอร์", "ชื่อแคชเชียร์", "resolveBaseUrl"]
sources: ["frontend/pos/lib/models/app_config.dart:3", "frontend/pos/lib/models/app_config.dart:35", "frontend/pos/lib/models/app_config.dart:135", "frontend/pos/lib/models/app_config.dart:170", "frontend/pos/lib/providers/pos_provider.dart:301", "frontend/pos/lib/providers/pos_provider.dart:620", "frontend/pos/lib/providers/pos_provider.dart:685", "frontend/pos/lib/providers/pos_provider.dart:889", "frontend/pos/lib/providers/pos_provider.dart:972", "frontend/pos/lib/services/storage_service.dart:60", "frontend/pos/lib/services/api_service.dart:41", "frontend/pos/lib/ui/widgets/settings_dialog.dart:435", "frontend/pos/lib/ui/widgets/settings_dialog.dart:680", "frontend/pos/lib/services/receipt_service.dart:23"]
---
# ค่าเครื่อง POS ที่ซิงก์มา และการตั้งค่าในเครื่อง

ค่าทั้งหมดของแอปอยู่ในอ็อบเจ็กต์ `AppConfig` เก็บเป็น JSON ใน `SharedPreferences` คีย์ `bc_pos_config` ([[sys-pos-offline-storage]]) แบ่งเป็น 2 กลุ่ม: **ค่าที่ซิงก์มาจาก BC Ai Account** (เปลี่ยนที่หน้าจอกำหนดค่า POS ของผู้ดูแล, ดู [[scr-pos-setup-control]]) และ **ค่าที่แก้ในเครื่อง** ภาพรวม: [[sys-pos-overview]]

## ค่าที่ซิงก์มา (`applySync`)
ซิงก์ขาลง entity `config` ส่งกลับก้อนข้อมูลย่อย `shop`, `machine`, `qr`, `point` และ `last_doc_no` แอปนำมาทับค่าเดิมทีละฟิลด์ ฟิลด์ที่ไม่ได้ส่งมาคงค่าเดิม ฟิลด์ข้อความที่ว่างไม่ทับ (`app_config.dart:135-185`, `pos_provider.dart:301-307`, [[sys-pos-sync-client]])

| ก้อน | ฟิลด์จากเซิร์ฟเวอร์ → ใช้ทำอะไรในแอป |
|---|---|
| `machine` | `machinecode` → รหัสเครื่อง; `machine_name`; `branch_code` → รหัสสาขา; `pos_ic_wht` / `pos_ic_shelf` → คลัง/ที่เก็บ (แสดงในหน้าตั้งค่า); `price_number` → ระดับราคา (2 = ราคาส่ง); `doc_format` → รูปแบบเลขที่บิล ([[sys-pos-sale-flow]]); `slip_number`, `printer_name` (เก็บไว้ ยังไม่มีโค้ดพิมพ์ ดู [[sys-pos-receipt-printing]]) |
| `shop` | `shop_name`, `branch_name` (ที่อยู่หัวใบเสร็จ), `tax_id`, `pos_terminal_no`, `pos_config_number`, `pos_header`, `pos_footer`, `vat_type`, `vat_rate`, `pos_change_price_config`, `pos_change_discount_config`, `pos_cancel_bill` |
| `qr` | `promp_pay_telephone_number` หรือ `promp_pay_wallet_id` → เลขพร้อมเพย์ของร้านสำหรับ QR ([[sys-pos-payment-types]]) |
| `point` | `baht_per_point`, `points_per_baht_redeem` (แสดงในหน้าตั้งค่า) |
| ระดับบน | `last_doc_no` → เลขที่บิลล่าสุดที่เซิร์ฟเวอร์รู้ ใช้ต่อเลขรัน (ค่าว่างถ้าไม่ส่ง) |

เมื่อรับค่าแล้ว แอปบันทึกลงเครื่อง ปรับภาษีของบิลปัจจุบัน และคำนวณเลขที่บิลถัดไปใหม่ถ้าตะกร้ายังว่าง

## ค่าที่แอปนำไปใช้ตัดสินใจจริง
| ค่า | ผลในแอป |
|---|---|
| ประเภทภาษี `vat_type` (1 รวมใน, 2 แยกนอก, 0 ไม่มี) และอัตรา `vat_rate` | ใช้คำนวณยอดภาษีในบิล และพิมพ์บนใบเสร็จ (ป้าย "7%" บนใบเสร็จเป็นข้อความตายตัว) |
| `price_number` = 2 | ใช้ราคาส่งของสินค้าที่มี ไม่เช่นนั้นราคาปกติ หรือราคาสมาชิกเมื่อต่ำกว่า (`pos_provider.dart:685-689`) |
| `pos_change_price_config` = 0 | ห้ามแก้ราคาที่จอ (ปุ่มโหมดราคาและแก้ผ่านปุ่มตัวเลข) (`pos_provider.dart:889,1031,1087`) |
| `pos_change_discount_config` = 0 | ห้ามใส่หรือแก้ส่วนลดรายการ/ท้ายบิล (`pos_provider.dart:972,991,1036,1072,1089`) |
| `pos_cancel_bill` = 0 | ห้ามยกเลิกบิลจากแท็บประวัติ ([[sys-pos-shift-cash]]) |
| `doc_format`, `last_doc_no` | ใช้ออกเลขที่บิล ถ้า `doc_format` ว่างหรือไม่ถูกรูปแบบ ออกบิลไม่ได้ |
| `pos_terminal_no` | ส่งเป็น `pos_id` ในรายการรับ-ส่งเงิน |
| `shop_name`, `branch_name`, `tax_id`, เบอร์โทร | หัวใบเสร็จ ([[sys-pos-receipt-printing]]) |
| เลขพร้อมเพย์ | สร้าง QR |

ค่าที่ซิงก์มาแต่ **ไม่มีโค้ดอื่นนำไปใช้** นอกจากเก็บ/แสดง: `pos_header`, `pos_footer` (หัวและท้ายใบเสร็จข้อความเขียนตายตัวในแอป), `machine_name`, `pos_config_number`, `slip_number`, `printer_name`, `pos_ic_wht` / `pos_ic_shelf` (แสดงในหน้าตั้งค่าเท่านั้น), อัตราสะสม/แลกแต้ม (แสดงเท่านั้น ใบเสร็จคำนวณแต้มด้วยค่าคงที่ 25), ส่วนลดสมาชิก `memberDiscountPct` (ไม่มีที่ซิงก์ลงและไม่มีโค้ดใช้) (ค้นการใช้ฟิลด์ทั้งโฟลเดอร์ `lib/`) ดู [[sys-pos-known-limits]]

## ค่าที่แก้ในเครื่อง
หน้าตั้งค่าแท็บที่ 3 "เครื่อง POS & ค่าจาก BC Ai Account" (`settings_dialog.dart:435-640`):
1. **ค่าที่ซิงก์มา (อ่านอย่างเดียว)**: ชื่อกิจการ, เลขประจำตัวผู้เสียภาษี (สาขา), คลัง/ที่เก็บ, ประเภทและอัตราภาษี, บัญชีพร้อมเพย์, อัตราสะสมแต้ม
2. **เชื่อมเครื่อง**: ช่องวางรหัสเชื่อมเครื่อง (ซ่อนตัวอักษร) และปุ่ม "เชื่อมเครื่อง" ([[sys-pos-device-pairing]])
3. **ที่อยู่เซิร์ฟเวอร์ BC Ai Account**: เว้นว่างใช้ค่าเริ่มต้น — ถ้ารันบนเว็บใช้ต้นทางเดียวกับหน้าที่เปิดอยู่ ถ้ารันแอปเนทีฟใช้ที่อยู่ภายในเครื่องพอร์ต 3001 ค่าตั้งต้นรุ่นเก่า (loopback พอร์ต 8888) ถือว่าว่าง (`api_service.dart:41-50`) เครื่อง Windows ที่ต่อเซิร์ฟเวอร์จริงต้องกรอกช่องนี้
4. **ชื่อพนักงานแคชเชียร์ประจำกะ**: แก้ได้ เป็นข้อความที่พิมพ์บนใบเสร็จ
5. ปุ่ม "บันทึก" เก็บเฉพาะที่อยู่เซิร์ฟเวอร์และชื่อแคชเชียร์ แล้วซิงก์ใหม่ทันที (`settings_dialog.dart:680-688`, `pos_provider.dart:620-627`)
6. ปุ่ม "กู้คืนข้อมูลเครื่องจาก BC Ai Account" ([[sys-pos-shift-cash]]) และการ์ดวินิจฉัยฐานข้อมูล ([[sys-pos-offline-storage]]) พร้อมรายการ "ต้องตรวจสอบ" ของคิวส่ง ([[sys-pos-sync-client]])

**รหัสแคชเชียร์ (`cashier_code`) แก้ไม่ได้จากหน้าจอ**: มีเพียงชื่อที่แก้ได้ รหัสใช้ค่าตั้งต้น `EMP-001` และไม่มีฟิลด์ในการซิงก์มาทับ ค่านี้ถูกส่งในบิลและรายการรับ-ส่งเงินทุกครั้ง (`app_config.dart:38,104`, ค้นการกำหนดค่าฟิลด์ใน `lib/`) ดังนั้นรายงานที่ต้องแยกแคชเชียร์รายคนจะไม่ได้จากแอปนี้ในปัจจุบัน ([[sys-pos-known-limits]])

## ค่าตั้งต้นก่อนซิงก์ครั้งแรก
ก่อนได้รับค่าจากเซิร์ฟเวอร์ แอปใช้ค่าตั้งต้นในโค้ด (ชื่อกิจการตัวอย่าง ภาษีรวมใน 7% ระดับราคา 1 อนุญาตแก้ราคา/ส่วนลด/ยกเลิกบิล ไม่มีเลขพร้อมเพย์ ไม่มีรูปแบบเลขที่บิล) (`app_config.dart:35-66`) เมื่อยังไม่มีรูปแบบเลขที่บิล แอปไม่ออกบิล ([[sys-pos-sale-flow]])

## ที่มาในโค้ด
- `frontend/pos/lib/models/app_config.dart:3-185` โครงสร้างค่าและการแมปจากซิงก์
- `frontend/pos/lib/providers/pos_provider.dart:301-307,620-627` บันทึกค่า และรับค่าจากซิงก์
- `frontend/pos/lib/services/storage_service.dart:60-73` เก็บ/โหลดค่า
- `frontend/pos/lib/services/api_service.dart:41-50` เลือกที่อยู่เซิร์ฟเวอร์
- `frontend/pos/lib/ui/widgets/settings_dialog.dart:435-640,680-688` หน้าตั้งค่า
- ดูเพิ่ม: [[sys-pos-overview]] · [[sys-pos-device-pairing]] · [[sys-pos-sync-client]] · [[sys-pos-known-limits]] · [[scr-pos-setup-control]] · [[proc-pos-config-shift]] · [[api-pos]]
