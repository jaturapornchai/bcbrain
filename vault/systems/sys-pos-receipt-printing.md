---
title: "ใบเสร็จ POS การพิมพ์ซ้ำ และการอัปโหลดรูปสลิป (sys-pos-receipt-printing)"
tags: [systems, pos, receipt, printing, slip]
aliases: ["ReceiptDialog", "ReceiptService", "renderSlipPng", "ใบเสร็จรับเงิน POS", "พิมพ์ใบเสร็จ", "พิมพ์ซ้ำ", "รูปสลิป", "slip_outbox", "ใบกำกับภาษีอย่างย่อ"]
sources: ["frontend/pos/lib/services/receipt_service.dart:10", "frontend/pos/lib/services/receipt_service.dart:27", "frontend/pos/lib/services/receipt_service.dart:68", "frontend/pos/lib/services/receipt_service.dart:97", "frontend/pos/lib/services/slip_renderer.dart:9", "frontend/pos/lib/services/slip_renderer.dart:17", "frontend/pos/lib/services/slip_renderer.dart:20", "frontend/pos/lib/ui/widgets/receipt_dialog.dart:22", "frontend/pos/lib/ui/widgets/receipt_dialog.dart:138", "frontend/pos/lib/ui/widgets/receipt_dialog.dart:143", "frontend/pos/lib/services/sync_engine.dart:27", "frontend/pos/lib/services/sync_engine.dart:267", "frontend/pos/lib/services/sync_engine.dart:283", "frontend/pos/lib/services/api_service.dart:111", "frontend/pos/lib/services/storage_service.dart:240", "frontend/pos/lib/ui/widgets/settings_dialog.dart:665", "frontend/pos/lib/models/app_config.dart:30"]
---
# ใบเสร็จ POS การพิมพ์ซ้ำ และการอัปโหลดรูปสลิป

ภาพรวมระบบ: [[sys-pos-overview]] ใบเสร็จของแอปแคชเชียร์มี 2 ส่วนที่ต้องแยกให้ออก: (1) ใบเสร็จข้อความที่ **แสดงบนจอ** และ (2) **รูปภาพใบเสร็จ (PNG)** ที่แอปวาดเก็บไว้เป็นหลักฐานแล้วอัปโหลดขึ้นเซิร์ฟเวอร์ แอปในโค้ดปัจจุบัน **ยังไม่ได้สั่งเครื่องพิมพ์จริง** (ดูหัวข้อ "ปุ่มพิมพ์")

## 1) ใบเสร็จข้อความ (`ReceiptService`)
ฟังก์ชัน `generateTextSlip` ประกอบข้อความความกว้าง 32 ตัวอักษร (กระดาษ 58 มม.) หรือกว้างกว่านั้นตามพารามิเตอร์ ตามลำดับ (`receipt_service.dart:10-125`):
1. หัวใบเสร็จ: ชื่อกิจการ ที่อยู่ เลขประจำตัวผู้เสียภาษี เบอร์โทร จากค่าเครื่องที่ซิงก์มา
2. ชื่อเอกสาร "ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ (TAX INVOICE - ABB)" เลขที่ วันที่ เครื่อง แคชเชียร์ ลูกค้า (ถ้ามีกลุ่มสมาชิก แสดงกลุ่มและระดับ)
3. รายการสินค้า: ชื่อ จำนวน หน่วย ราคา รวมต่อบรรทัด ส่วนลดรายการ (ถ้ามี)
4. สรุป: รวมรายการ (จำนวนชิ้น) ส่วนลดท้ายบิล ภาษี — ถ้าราคารวมภาษี (`vatType` 1) แสดงมูลค่าสินค้าและ VAT แยก ถ้าแยกนอก (2) แสดงมูลค่าก่อนภาษีและ VAT; ข้อความบนใบเสร็จเขียนตายตัวว่า "7%" (`receipt_service.dart:68-76`)
5. ยอดรวมสุทธิ วิธีชำระ จำนวนที่รับ เงินทอน
6. ถ้าลูกค้าไม่ใช่เงินสดทั่วไป (รวมลูกค้าชั่วคราว) แสดงแต้มที่ได้รับในบิลนี้และแต้มคงเหลือ โดยคิด "1 แต้ม ต่อทุก 25 บาท" จากค่าคงที่ในโค้ดแอป (`/ 25`) ไม่ได้อ่านจากอัตราสะสมแต้มที่ผู้ดูแลตั้ง (`receipt_service.dart:92-110`) — แต้มจริงให้ถือตามระบบหลังบ้าน
7. ท้ายใบเสร็จ "ขอบคุณที่ใช้บริการ / THANK YOU"

## 2) หน้าต่างใบเสร็จ (`ReceiptDialog`)
- เปิดอัตโนมัติหลังชำระเงินสำเร็จ ([[sys-pos-payment-types]]) เปิดเป็น "พรีวิวสลิป" จากปุ่ม "พิมพ์" ในตะกร้า (ใช้ได้เมื่อมีรายการ) และเปิดเป็นโหมด "พิมพ์ซ้ำ" จากประวัติบิลในหน้าตั้งค่า (`receipt_dialog.dart:11-22`, `cart_panel.dart:936-952`, `settings_dialog.dart:665-677`)
- แสดงข้อความใบเสร็จด้วยฟอนต์ monospace; ปุ่มท้าย: "พิมพ์ใบเสร็จ (Print)" และ "ขายบิลถัดไป" (หรือ "ปิดหน้าต่าง" เมื่อเป็นพิมพ์ซ้ำ) ทั้งปุ่มปิด (กากบาท) และปุ่มท้าย เมื่อไม่ใช่โหมดพิมพ์ซ้ำ จะเรียก `completeSaleAndNewBill` เริ่มบิลใหม่ (`receipt_dialog.dart:48-57,168-176`, `pos_provider.dart:1199`)
- **ข้อควรระวัง**: พรีวิวที่เปิดจากปุ่ม "พิมพ์" ในตะกร้า (ก่อนชำระเงิน) ใช้โหมดเดียวกับใบเสร็จหลังขาย ไม่ใช่โหมดพิมพ์ซ้ำ (`cart_panel.dart:949`) ดังนั้นปิดหน้าต่างพรีวิวแล้วแอปจะเริ่มบิลใหม่ ตะกร้าเดิมที่ยังไม่ชำระหายไป (ไม่ถูกพักบิล) แคชเชียร์ควรพักบิลก่อนถ้ายังต้องใช้

## 3) ปุ่มพิมพ์ (ข้อจำกัดสำคัญ)
ปุ่ม "พิมพ์ใบเสร็จ (Print)" แค่แสดงข้อความ "ส่งคำสั่งพิมพ์ไปยังเครื่องพิมพ์ใบเสร็จเรียบร้อยแล้ว" (SnackBar) **ไม่มีโค้ดส่งงานไปเครื่องพิมพ์** ค่า `printerName` และ `slipFormat` ถูกซิงก์/เก็บไว้ในค่าเครื่อง (`app_config.dart:30-31`) แต่ไม่มีส่วนใดของแอปนำไปใช้พิมพ์ (`receipt_dialog.dart:143-150`) ด้วยเหตุนี้ปุ่ม "เปิดลิ้นชัก" ก็ไม่ได้สั่งลิ้นชักเงินสดเช่นกัน ([[sys-pos-known-limits]])

## 4) รูปใบเสร็จ PNG และการอัปโหลด
1. เมื่อบิลถูกส่งขึ้นเซิร์ฟเวอร์สำเร็จ แอปวาดข้อความใบเสร็จนอกจอเป็นภาพ PNG ขนาดเต็ม (อัตราขยาย 3 เท่า พื้นขาว ฟอนต์ monospace ขนาด 12) แล้วเก็บเป็นไฟล์ชื่อตามเลขที่บิลในโฟลเดอร์ `pos_slips` ของแอป (บนเว็บเก็บในหน่วยความจำ) และใส่คิวรออัปโหลด (`slip_renderer.dart:9-39`, `sync_engine.dart:267-280`, `storage_service.dart:240-252`)
2. รอบซิงก์ถัดไปอัปโหลดด้วย `POST /api/pos/media?kind=slip&ref=<เลขที่บิล>` ใช้ไบต์เดิมส่งซ้ำได้ ขนาดต้องไม่เกิน 5 MB (เกิน → ขึ้นสถานะต้องตรวจสอบ) (`api_service.dart:111-116`, `sync_engine.dart:27,283-327`)
3. ผลตอบกลับ: สำเร็จ → ลบไฟล์ในเครื่อง; 409 (บิลยังไม่ขึ้นเซิร์ฟเวอร์) หรือ 5xx → ลองใหม่ภายหลัง; 400 และอื่นๆ → ต้องตรวจสอบ (แคชเชียร์กด "รับทราบ" ในหน้าตั้งค่า); ไฟล์หาย → ตัดออกจากคิว
4. ถ้าวาด/เขียนรูปไม่สำเร็จ บิลไม่ได้รับผลกระทบ แค่แจ้ง "สร้างรูปใบเสร็จ ... ไม่สำเร็จ (บิลส่งขึ้นระบบแล้ว)" เพราะรูปเป็นหลักฐานเสริม (`sync_engine.dart:276-279`)

ฝั่งเซิร์ฟเวอร์รับรูปและผูกกับบิลอย่างไรอยู่ใน [[api-pos]] (ส่วน `POST /media`) และ [[proc-pos-bill]]

## ที่มาในโค้ด
- `frontend/pos/lib/services/receipt_service.dart:10-125` ประกอบข้อความใบเสร็จ
- `frontend/pos/lib/services/slip_renderer.dart:9-39` วาด PNG
- `frontend/pos/lib/ui/widgets/receipt_dialog.dart:11-180` หน้าต่างใบเสร็จและปุ่มพิมพ์
- `frontend/pos/lib/services/sync_engine.dart:267-327` คิวและการอัปโหลดรูป
- ดูเพิ่ม: [[sys-pos-overview]] · [[sys-pos-payment-types]] · [[sys-pos-sync-client]] · [[sys-pos-offline-storage]] · [[api-pos]]
