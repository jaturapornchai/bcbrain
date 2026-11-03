---
title: "ระบบ POS ขายหน้าร้าน ภาพรวม การเปิดใช้ และแผนที่บันทึก (sys-pos-overview)"
tags: [systems, pos, overview, retail, offline-first]
aliases: ["POS", "BC Ai POS", "ระบบขายหน้าร้าน", "จุดขายแคชเชียร์", "แอปแคชเชียร์", "Flutter POS", "pos.exe", "เปิดหน้า /pos", "หน้าร้าน"]
sources: ["frontend/pos/pubspec.yaml:1", "frontend/pos/pubspec.yaml:4", "frontend/pos/lib/main.dart:24", "frontend/pos/lib/main.dart:38", "frontend/pos/run-pos-windows.bat:4", "frontend/pos/run-pos.ps1:5", "frontend/src/app/pos/page.tsx:11", "frontend/src/app/api/pos/[...path]/route.ts:13", "backend/internal/adapter/inbound/http/router.go:329", "frontend/pos/lib/services/storage_service.dart:155"]
---
# ระบบ POS ขายหน้าร้าน (BC Ai POS)

POS คือระบบขายหน้าร้านของ BC Ai Account: แคชเชียร์ยิงบาร์โค้ดหรือเลือกสินค้า รับเงิน ออกใบเสร็จ และบิลขายจะถูกส่งเข้าระบบบัญชีและสต็อกอัตโนมัติ จุดเด่นคือ **ขายต่อได้แม้อินเทอร์เน็ตหลุด** เพราะแอปเก็บสินค้า สมาชิก โปรโมชั่น และบิลไว้ในเครื่อง แล้วค่อยซิงก์ ([[sys-pos-offline-storage]])

## ระบบนี้ประกอบด้วยอะไร
| ส่วน | ที่อยู่ในโค้ด | หน้าที่ | บันทึก |
|---|---|---|---|
| แอปแคชเชียร์ (Flutter) | `frontend/pos` (แพ็กเกจ `pos` 1.0.0+1) | จอขาย ชำระเงิน ใบเสร็จ กะ ซิงก์ ทำงานออฟไลน์ | หน้านี้และ `sys-pos-*` |
| เปลือกเว็บ `/pos` | `frontend/src/app/pos/page.tsx` | ตรวจล็อกอิน/ฐานข้อมูล แล้วฝังแอปแคชเชียร์ (Flutter Web) ใน iframe พร้อมแถบสลับไปหน้าตั้งค่า | [[scr-pos-demo-workspace]] |
| หน้าตั้งค่า POS บนเว็บ | หน้าจอตั้งค่าและควบคุม POS | กำหนดค่าเริ่มต้น เครื่อง POS โปรโมชั่น ออกรหัสเชื่อมเครื่อง | [[scr-pos-setup-control]] [[fe-process-pos-screens]] |
| พร็อกซี API ของเว็บ | `frontend/src/app/api/pos/[...path]/route.ts` | รับ `/api/pos/*` จากแอป แล้วส่งต่อไปหลังบ้าน `/api/v1/pos/*` | [[sys-pos-device-pairing]] |
| หลังบ้าน (Go) | `backend/internal/adapter/inbound/http/pos`, `backend/internal/application/process/pos_sync.go` | รับบิล ดึง-ส่งส่วนต่าง กู้คืน รูปใบเสร็จ ลงบัญชี/สต็อก | [[api-pos]] [[be-pos-sync-api]] [[proc-pos-bill]] [[proc-pos-sync]] [[proc-pos-config-shift]] |

เส้นทางหลังบ้านแบ่งสองกลุ่ม: กลุ่มที่เครื่อง POS เรียก (ดึงข้อมูล กู้คืน ส่งบิล ส่งรูป) และกลุ่มที่ผู้ใช้เว็บเรียก (ข้อมูลตั้งต้น บันทึกค่า รายชื่อเครื่อง ผูกเครื่อง ประมวลผลบิลค้างซ้ำ) ส่วนรับ-ส่งเงินกะและรูปสินค้ารับได้ทั้งสองแบบ (`router.go:329-345`)

## เปิดใช้อย่างไร
1. **บนเว็บ**: ไปที่ `/pos` ระบบพาไปล็อกอินและเลือกฐานข้อมูลก่อน จากนั้นแสดงจอแคชเชียร์ (`page.tsx:11-15`) แอปเว็บเชื่อมระบบด้วยเซสชันที่ล็อกอินอยู่ ไม่ต้องวางรหัสเครื่อง
2. **บน Windows**: เรียกไฟล์ `frontend/pos/run-pos-windows.bat` หรือ `run-pos.ps1` ซึ่งเปิด `pos.exe` จากโฟลเดอร์ build แบบ Release ถ้าไม่มีใช้แบบ Debug (`run-pos-windows.bat:4-8`, `run-pos.ps1:2-5`) ต้องสร้าง (build) แอปไว้ก่อน
3. **บนมือถือ**: โปรเจกต์มีโฟลเดอร์ Android และ iOS แอปปรับสีแถบระบบเมื่อรันบนสองแพลตฟอร์มนี้ (`main.dart:13-21`)
4. แอป Windows/มือถือไม่มีหน้าล็อกอิน ต้องวาง "รหัสเชื่อมเครื่อง" ที่ผู้ดูแลออกให้ และกรอกที่อยู่เว็บ BC Ai Account ([[sys-pos-device-pairing]], [[sys-pos-app-config]])

## วงจรการขายหนึ่งบิล
1. ยิงบาร์โค้ด/ค้นหา/แตะสินค้า → ใส่ตะกร้า ระบบคำนวณราคาตามระดับราคาและสมาชิก และโปรโมชั่น ([[sys-pos-sale-flow]], [[sys-pos-promotion-engine]])
2. ชำระเงิน: เงินสด พร้อมเพย์ QR โอน หรือบัตร ([[sys-pos-payment-types]])
3. แอปออกเลขที่บิลในเครื่อง เก็บบิลลงคิว แล้วแสดงใบเสร็จ ([[sys-pos-receipt-printing]])
4. ซิงก์ส่งบิลขึ้นเซิร์ฟเวอร์ตามลำดับ ส่งซ้ำได้โดยไม่เกิดบิลซ้ำ ([[sys-pos-sync-client]])
5. หลังบ้านรับบิล ตัดสต็อกและลงบัญชี ([[proc-pos-bill]], [[faq-pos-bill-to-account]])
6. ต้นกะ/ท้ายกะ บันทึกรับเงินทอนและนำส่งเงิน ดูประวัติ พิมพ์ซ้ำ และยกเลิกบิล ([[sys-pos-shift-cash]])

## แผนที่บันทึกของระบบ POS
**ฝั่งแอปแคชเชียร์** (หมวดนี้)
- [[sys-pos-app-structure]] โครงสร้างแอป จอ และปุ่มคำสั่ง
- [[sys-pos-sale-flow]] ขั้นตอนขาย ลูกค้า ส่วนลด พักบิล ปิดบิล
- [[sys-pos-payment-types]] ชนิดการชำระเงินและพร้อมเพย์ QR
- [[sys-pos-receipt-printing]] ใบเสร็จ รูปสลิป และปุ่มพิมพ์
- [[sys-pos-promotion-engine]] โปรโมชั่น 10 ประเภทที่คำนวณในเครื่อง
- [[sys-pos-shift-cash]] กะ รับ-ส่งเงิน ยกเลิกบิล กู้คืนข้อมูล
- [[sys-pos-sync-client]] การซิงก์ ส่งบิล ลองใหม่
- [[sys-pos-offline-storage]] ที่เก็บข้อมูลในเครื่อง
- [[sys-pos-device-pairing]] การเชื่อมเครื่องแทนการล็อกอิน
- [[sys-pos-app-config]] ค่าเครื่องที่ซิงก์มาและค่าที่แก้ในเครื่อง
- [[sys-pos-known-limits]] ข้อจำกัดที่ต้องรู้ก่อนใช้จริง

**ฝั่งเว็บและหลังบ้าน** (บันทึกเดิม): [[scr-pos-demo-workspace]] · [[scr-pos-setup-control]] · [[fe-process-pos-screens]] · [[api-pos]] · [[be-pos-sync-api]] · [[proc-pos-bill]] · [[proc-pos-config-shift]] · [[proc-pos-sync]] · [[faq-pos-bill-to-account]]
**ภาพรวมกว้าง**: [[screens-overview]] · [[fe-app-shell-routing]] · [[api-overview]]

## ตอบเร็วเรื่องที่ถามบ่อย
- ขายตอนเน็ตหลุดได้ไหม: ได้ บิลสะสมในเครื่องและส่งเองเมื่อกลับมาออนไลน์ ([[sys-pos-sync-client]])
- ปุ่มพิมพ์ใบเสร็จสั่งเครื่องพิมพ์ไหม: ยังไม่สั่ง ดู [[sys-pos-known-limits]]
- พร้อมเพย์ตรวจเงินเข้าอัตโนมัติไหม: ไม่ แคชเชียร์ยืนยันเอง ([[sys-pos-payment-types]])
- ยกเลิกบิลได้เมื่อไร: บิลต้องส่งขึ้นระบบแล้วและค่าร้านอนุญาต ([[sys-pos-shift-cash]])
- เครื่องใหม่หรือติดตั้งใหม่ เอาข้อมูลเดิมคืนอย่างไร: เชื่อมเครื่องด้วยรหัสเชื่อมเครื่อง ระบบกู้คืนให้อัตโนมัติเมื่อเครื่องว่าง หรือกดปุ่มกู้คืนเอง ([[sys-pos-shift-cash]])

## ที่มาในโค้ด
- `frontend/pos/pubspec.yaml:1-22` ชื่อแพ็กเกจ เวอร์ชัน และไลบรารีที่ใช้ (provider, http, shared_preferences, qr_flutter, uuid, objectbox, path_provider)
- `frontend/pos/lib/main.dart:8-39` จุดเริ่มต้นแอปและจอแรก
- `frontend/pos/run-pos-windows.bat`, `frontend/pos/run-pos.ps1` ตัวเปิดบน Windows
- `frontend/src/app/pos/page.tsx:11-15` เพจ `/pos` ฝั่งเว็บ
- `backend/internal/adapter/inbound/http/router.go:329-345` กลุ่มเส้นทาง POS ของหลังบ้าน
- ดูเพิ่ม: [[sys-pos-app-structure]] · [[sys-pos-sale-flow]] · [[sys-pos-known-limits]] · [[scr-pos-demo-workspace]] · [[api-pos]]
