---
title: "การชำระเงินที่จอ POS: เงินสด พร้อมเพย์ QR โอน บัตร (sys-pos-payment-types)"
tags: [systems, pos, payment, promptpay, cash]
aliases: ["PaymentDialog", "PromptPayService", "พร้อมเพย์ QR POS", "ปุ่มลัดธนบัตร", "CASH PROMPTPAY TRANSFER CARD", "เงินทอน POS"]
sources: ["frontend/pos/lib/ui/widgets/payment_dialog.dart:22", "frontend/pos/lib/ui/widgets/payment_dialog.dart:70", "frontend/pos/lib/ui/widgets/payment_dialog.dart:92", "frontend/pos/lib/ui/widgets/payment_dialog.dart:217", "frontend/pos/lib/ui/widgets/payment_dialog.dart:335", "frontend/pos/lib/ui/widgets/payment_dialog.dart:370", "frontend/pos/lib/ui/widgets/payment_dialog.dart:419", "frontend/pos/lib/services/promptpay_service.dart:6", "frontend/pos/lib/services/promptpay_service.dart:29", "frontend/pos/lib/services/promptpay_service.dart:50", "frontend/pos/lib/providers/pos_provider.dart:1097", "frontend/pos/lib/providers/pos_provider.dart:1186", "frontend/pos/lib/providers/pos_provider.dart:1192", "frontend/pos/lib/models/pos_bill.dart:4", "frontend/pos/lib/models/app_config.dart:172"]
---
# การชำระเงินที่จอ POS

หน้าต่างชำระเงิน (`PaymentDialog`) มี 3 แท็บ: "เงินสด (Cash)" · "พร้อมเพย์ QR" · "โอน/บัตรเครดิต" (`payment_dialog.dart:217-219`) ปุ่มใหญ่ "ชำระเงิน" เปิดแท็บเงินสด ปุ่มด่วน QR และบัตรเปิดแท็บของตัวเอง (`cart_panel.dart:804-835,890-952`) เมื่อเปิดหน้าต่างระบบจะพูดแจ้งยอดรวมทั้งสิ้น (เฉพาะรัน Flutter Web, ดู [[sys-pos-app-structure]]) ใน [[sys-pos-overview]] มีภาพรวมทั้งระบบ

## ชนิดการชำระเงิน
แอปรองรับ 4 ชนิดตามค่า `PaymentType` และแปลงเป็นรหัสที่ส่งไปเซิร์ฟเวอร์ (`pos_bill.dart:4`, `pos_provider.dart:1192-1197`):

| ชนิดในแอป | ป้ายบนใบเสร็จ | รหัสที่ส่ง (`payments[].method`) |
|---|---|---|
| `cash` | เงินสด | `CASH` |
| `promptPay` | พร้อมเพย์ QR | `PROMPTPAY` |
| `bankTransfer` | โอนเงิน | `TRANSFER` |
| `creditCard` | บัตรเครดิต | `CARD` |

**หนึ่งบิลมีการชำระได้รายการเดียว** (รายการ `payments` มีแถวเดียวเสมอ, `pos_provider.dart:1186-1188`) ไม่มีการแบ่งจ่ายหลายวิธี การบันทึกฝั่งเซิร์ฟเวอร์ดู [[proc-pos-bill]]

## แท็บเงินสด
- ช่อง "รับเงินมา (Tendered)" เริ่มต้นเท่ากับยอดสุทธิ แสดง "เงินทอน (Change)" ทันที (สีเขียวเมื่อรับพอ สีแดงเมื่อรับไม่พอ) (`payment_dialog.dart:30-33,246-300`)
- ปุ่มลัด: "พอดี" (เท่ายอดสุทธิ) 1,000 / 500 / 100 / 50 / 20 บาท (ตั้งยอดรับเงินเท่าค่านั้น) และ +100 / +500 (บวกเพิ่มจากยอดที่มี) (`payment_dialog.dart:335-348`)
- ถ้าเงินที่รับน้อยกว่ายอดสุทธิ แจ้ง "จำนวนเงินที่รับมาน้อยกว่ายอดชำระ" และไม่บันทึกบิล (`payment_dialog.dart:76-85`)
- เงินทอนคำนวณในแอป (`รับ - ยอดสุทธิ`) เก็บในข้อมูลการชำระของบิลและพิมพ์บนใบเสร็จ (`pos_provider.dart:1119-1130`)

## แท็บพร้อมเพย์ QR
- สร้าง QR มาตรฐาน EMVCo ของพร้อมเพย์จาก "เลขพร้อมเพย์ร้านค้า" ในค่าเครื่อง (ซิงก์มาจากตั้งค่า QR ของ BC Ai Account; เบอร์มือถือ 10 หลักหรือเลข 13 หลัก) และยอดสุทธิของบิล (`app_config.dart:172`, `promptpay_service.dart:6-35`)
- เมื่อยอดมากกว่าศูนย์เป็น QR แบบกำหนดยอด (Dynamic) ฝังยอด 2 ทศนิยม สกุลบาท ประเทศ TH และคำนวณ CRC16 (CCITT) ปิดท้าย (`promptpay_service.dart:29-48,50-66`) วาดภาพด้วยแพ็กเกจ `qr_flutter` (`payment_dialog.dart:396`)
- **แอปไม่ตรวจว่าลูกค้าโอนแล้วจริง** ไม่มีการเชื่อมกับธนาคารหรือผู้ให้บริการชำระเงิน แคชเชียร์ดูสลิป/เงินเข้าเองแล้วกดปุ่มยืนยัน (`payment_dialog.dart:410`)
- ค่าเริ่มต้นของเลขพร้อมเพย์ในแอปคือว่าง (`app_config.dart:46`) จึงต้องตั้งในหน้าตั้งค่า QR ให้ซิงก์ลงเครื่อง ([[scr-pos-setup-control]])

## แท็บโอน/บัตรเครดิต
มีช่อง "เลขที่อ้างอิงสลิป / สลิปโอนเงิน / เลขอนุมัติบัตร" (ไม่บังคับ) และสองปุ่ม "โอนเงินผ่านธนาคาร" กับ "บัตรเครดิต/เดบิต" (`payment_dialog.dart:419-470`) ยอดที่บันทึกเท่ากับยอดสุทธิพอดี เลขอ้างอิงถูกต่อท้ายหมายเหตุบิลเป็น "อ้างอิงชำระ ..." (`pos_provider.dart:1160-1166`) แอปไม่ได้สั่งเครื่องรูดบัตรหรือรับผลจากเครื่องรูดบัตร (ในโค้ดแอปไม่มีการเชื่อมต่อกับเครื่องรูดบัตร)

## หลังกดยืนยัน
1. `processPayment` ตั้งเลขที่บิล เวลา ข้อมูลการชำระ แล้วบันทึกเข้าคิวรอส่ง (ดู [[sys-pos-sale-flow]] ขั้นตอนปิดบิล และ [[sys-pos-sync-client]])
2. ถ้าออกบิลไม่ได้ (ยังไม่เชื่อมเครื่อง หรือยังไม่ได้รูปแบบเลขที่บิล) หน้าต่างไม่ปิด และแสดงข้อความสาเหตุสีแดง (`payment_dialog.dart:103-111`, `pos_provider.dart:1105-1115`)
3. สำเร็จ → ปิดหน้าต่างชำระ → เปิดใบเสร็จรับเงิน ([[sys-pos-receipt-printing]]) พร้อมประกาศเสียง (รับเงิน เงินทอน) บนเว็บ

## ที่มาในโค้ด
- `frontend/pos/lib/ui/widgets/payment_dialog.dart:22-125,217-236,246-470` หน้าต่างชำระเงินทั้งสามแท็บ
- `frontend/pos/lib/services/promptpay_service.dart:6-66` สร้าง QR และ CRC16
- `frontend/pos/lib/providers/pos_provider.dart:1097-1197` บันทึกการชำระและรหัสวิธีชำระ
- ดูเพิ่ม: [[sys-pos-overview]] · [[sys-pos-sale-flow]] · [[sys-pos-receipt-printing]] · [[sys-pos-shift-cash]] · [[proc-pos-bill]] · [[api-pos]]
