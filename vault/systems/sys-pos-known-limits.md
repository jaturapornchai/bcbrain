---
title: "ข้อจำกัดของแอป POS ที่ควรรู้ก่อนใช้งานหน้าร้าน (sys-pos-known-limits)"
tags: [systems, pos, limits, faq, troubleshooting]
aliases: ["ข้อจำกัด POS", "POS ทำอะไรไม่ได้", "ปุ่มพิมพ์ไม่พิมพ์", "เครื่องพิมพ์ใบเสร็จ POS", "ลิ้นชักเก็บเงิน", "รหัสแคชเชียร์ EMP-001", "ช่องทางขาย พนักงานขาย", "known limits"]
sources: ["frontend/pos/lib/ui/widgets/receipt_dialog.dart:143", "frontend/pos/lib/ui/widgets/cart_panel.dart:1196", "frontend/pos/lib/ui/widgets/payment_dialog.dart:410", "frontend/pos/lib/providers/pos_provider.dart:81", "frontend/pos/lib/providers/pos_provider.dart:1172", "frontend/pos/lib/services/receipt_service.dart:97", "frontend/pos/lib/services/receipt_service.dart:69", "frontend/pos/lib/services/promotion_engine.dart:522", "frontend/pos/lib/services/promotion_engine.dart:390", "frontend/pos/lib/core/objectbox_native.dart:87", "frontend/pos/lib/core/num_parse.dart:20", "frontend/pos/lib/ui/widgets/settings_dialog.dart:62", "frontend/pos/lib/models/app_config.dart:38", "frontend/pos/lib/ui/widgets/cart_panel.dart:1398"]
---
# ข้อจำกัดของแอป POS ที่ควรรู้ก่อนใช้งานหน้าร้าน

รวมสิ่งที่แอปแคชเชียร์ (`frontend/pos`) **ยังทำไม่ได้หรือทำต่างจากที่ชื่อปุ่มบอก** ตามโค้ดปัจจุบัน แต่ละข้อมีที่มาในโค้ดและวิธีรับมือ ภาพรวมระบบ: [[sys-pos-overview]]

## ฮาร์ดแวร์
| เรื่อง | ความจริงในโค้ด | วิธีรับมือ |
|---|---|---|
| ปุ่ม "พิมพ์ใบเสร็จ (Print)" | แสดงแถบข้อความว่าส่งคำสั่งพิมพ์แล้ว แต่ไม่มีโค้ดส่งงานไปเครื่องพิมพ์ ค่า `printer_name` / `slip_number` ที่ซิงก์มาไม่ถูกใช้ (`receipt_dialog.dart:143-150`) | ใบเสร็จแสดงบนจอและมีรูปสลิปอัปโหลดเก็บบนเซิร์ฟเวอร์ ส่วนการพิมพ์กระดาษแอปยังไม่ทำให้ ([[sys-pos-receipt-printing]]) |
| ปุ่ม "เปิดลิ้นชัก" | แค่เปิดหน้าต่างรับ-ส่งเงินกะ ไม่ได้สั่งลิ้นชักเก็บเงิน (`cart_panel.dart:1196`) | ลิ้นชักต้องเปิดด้วยวิธีของเครื่องเอง แอปไม่ได้ควบคุมลิ้นชัก ใช้ปุ่มนี้เพื่อบันทึกรับ-ส่งเงินเท่านั้น ([[sys-pos-shift-cash]]) |
| เครื่องรูดบัตร | ไม่มีการเชื่อมต่อ แคชเชียร์เลือก "บัตรเครดิต" แล้วใส่เลขอนุมัติเอง | บันทึกเลขจากสลิปเครื่องรูดบัตร ([[sys-pos-payment-types]]) |

## การชำระเงิน
- **พร้อมเพย์ QR ไม่มีการตรวจยอดเข้า** แอปสร้างรหัส QR ให้ลูกค้าสแกน แล้วแคชเชียร์ต้องกดยืนยันเองหลังเห็นเงินเข้า (`payment_dialog.dart:410`)
- **หนึ่งบิลชำระได้วิธีเดียว** ไม่มีแบ่งจ่ายเงินสดครึ่งโอนครึ่ง (`pos_provider.dart:1186`)
- แต้มสมาชิกที่ **ใช้แลกในบิล ส่งเป็น 0 เสมอ** (`points_redeemed`, `pos_provider.dart:1172`)
- แต้มที่พิมพ์ในใบเสร็จคิดจากค่าคงที่ "ทุก 25 บาท ได้ 1 แต้ม" (`receipt_service.dart:97,103`) ไม่ใช่อัตราที่ผู้ดูแลตั้ง ข้อความภาษีบนใบเสร็จเขียนตายตัวว่า "7%" (`receipt_service.dart:69-74`) ถ้าร้านใช้อัตราอื่น ตัวเลขภาษีคำนวณตามอัตราที่ตั้ง แต่ป้ายข้อความยังเป็น 7%

## ข้อมูลที่เป็นรายการตายตัวในแอป
- **ช่องทางขาย (5 ช่องทาง) และพนักงานขาย (4 รหัส) เป็นรายการตายตัวในโค้ด** เลือกแล้วแสดงบนจอ แต่ไม่ถูกส่งไปกับบิล (`pos_provider.dart:81-83`, `cart_panel.dart:1398,1440`) รายงานฝั่งบัญชีจึงแยกช่องทางหรือพนักงานขายจากแอปนี้ไม่ได้
- **รหัสแคชเชียร์ (`cashier_code`) แก้ไม่ได้จากหน้าจอ** แก้ได้เฉพาะชื่อที่พิมพ์บนใบเสร็จ รหัสใช้ค่าตั้งต้น `EMP-001` ในทุกบิลและรายการรับ-ส่งเงิน (`app_config.dart:38`, [[sys-pos-app-config]])
- ค่าที่ผู้ดูแลตั้งแล้วซิงก์มา แต่แอปยังไม่นำไปใช้: ข้อความหัว/ท้ายใบเสร็จ (`pos_header`, `pos_footer`), ส่วนลดสมาชิกเป็นเปอร์เซ็นต์, อัตราสะสมและแลกแต้ม (แสดงเท่านั้น) ([[sys-pos-app-config]])

## กะและเงิน
- ปุ่ม "นำส่งเงินสดปิดกะ" บันทึกเป็นรายการส่งเงินเท่านั้น ไม่เปลี่ยนสถานะกะเป็นปิด และส่งเฉพาะยอดเงินสด (ยอดโอนและบัตรเป็น 0) แอปรองรับคำสั่งปิดกะในโค้ดแต่หน้าจอยังไม่เรียกใช้ (`settings_dialog.dart:62-66`)
- ข้อมูลกะที่เปิดอยู่ไม่ถูกแสดงบนจอใด และการขายไม่ต้องเปิดกะก่อน ([[sys-pos-shift-cash]])
- ปุ่ม "ยกเลิกบิล" ไม่มีหน้าต่างยืนยัน และใช้เหตุผลตายตัว ต้องออนไลน์และบิลต้องขึ้นเซิร์ฟเวอร์แล้ว (`settings_dialog.dart:407-415`)
- ปุ่ม "พิมพ์" ในตะกร้า (ก่อนชำระเงิน) เปิดใบเสร็จตัวอย่าง ถ้าปิดหน้าต่างนั้น แอปเริ่มบิลใหม่และตะกร้าที่ยังไม่ชำระหายไป ควรพักบิลก่อน (`cart_panel.dart:949`, `receipt_dialog.dart:48-57`, [[sys-pos-receipt-printing]])

## โปรโมชั่น
- ไม่ตรวจ **ช่วงเวลาของวัน** (เช่น Happy Hour 17:00-20:00) ตรวจแค่ช่วงวันที่และตัวกรองวัน (`promotion_engine.dart:522-535`)
- ของแถมและคูปองแสดงเป็นข้อความแจ้งเท่านั้น แคชเชียร์ต้องเพิ่มของแถมเข้าตะกร้าเอง (`auto_add_free_item` ยังไม่มีผลต่อการทำงาน) ([[sys-pos-promotion-engine]])
- โปรโมชั่นตัวอย่าง (`initDefaultPromotions`) ใช้เฉพาะชุดทดสอบ ไม่ปรากฏในการใช้งานจริง (`promotion_engine.dart:390`)

## ข้อมูลในเครื่องและตัวเลขเงิน
- เปิดฐานข้อมูลเนทีฟไม่สำเร็จครั้งแรก โค้ดลบโฟลเดอร์ฐานข้อมูลแล้วสร้างใหม่ (`objectbox_native.dart:87-92`) ข้อมูลที่ยังไม่เคยขึ้นเซิร์ฟเวอร์ในฐานนั้นอาจหาย คิวส่งบิลเก็บแยกในที่เก็บค่า จึงไม่ถูกลบตามไปด้วย ([[sys-pos-offline-storage]])
- ตัวเลขเงินคำนวณในเครื่องด้วยเลขทศนิยมแบบ `double` แล้วปัดเป็นข้อความ 2 ตำแหน่งตอนส่ง (`num_parse.dart:20`) ส่งขึ้นเป็นข้อความทศนิยมเสมอ ไม่ใช่ตัวเลข JSON ส่วนการบันทึกบัญชีฝั่งเซิร์ฟเวอร์ดู [[proc-pos-bill]]

## ที่มาในโค้ด
- `frontend/pos/lib/ui/widgets/receipt_dialog.dart:48-57,143-150` ปุ่มพิมพ์
- `frontend/pos/lib/ui/widgets/cart_panel.dart:949,1196,1398,1440` พรีวิว/เปิดลิ้นชัก/รายการตายตัว
- `frontend/pos/lib/providers/pos_provider.dart:81-83,1172,1186` ค่าตายตัวและการชำระ
- `frontend/pos/lib/services/receipt_service.dart:69-74,97-103` ข้อความภาษี และคิดแต้ม
- `frontend/pos/lib/core/objectbox_native.dart:84-92` สร้างฐานใหม่เมื่อเปิดไม่ได้
- ดูเพิ่ม: [[sys-pos-overview]] · [[sys-pos-receipt-printing]] · [[sys-pos-payment-types]] · [[sys-pos-shift-cash]] · [[sys-pos-promotion-engine]] · [[sys-pos-app-config]] · [[sys-pos-offline-storage]] · [[faq-pos-bill-to-account]]
