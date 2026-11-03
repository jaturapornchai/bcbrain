---
title: "โครงสร้างแอปแคชเชียร์ BC Ai POS (Flutter) และหน้าจอขาย (sys-pos-app-structure)"
tags: [systems, pos, flutter, ui, cashier]
aliases: ["BcAiPosApp", "CashierScreen", "PosProvider", "แอป POS Flutter", "frontend/pos", "pos.exe", "จอแคชเชียร์"]
sources: ["frontend/pos/pubspec.yaml:1", "frontend/pos/pubspec.yaml:13", "frontend/pos/lib/main.dart:9", "frontend/pos/lib/main.dart:32", "frontend/pos/lib/ui/cashier_screen.dart:29", "frontend/pos/lib/ui/cashier_screen.dart:50", "frontend/pos/lib/ui/cashier_screen.dart:100", "frontend/pos/lib/ui/cashier_screen.dart:376", "frontend/pos/lib/ui/cashier_screen.dart:420", "frontend/pos/lib/providers/pos_provider.dart:26", "frontend/pos/lib/providers/pos_provider.dart:169", "frontend/pos/lib/ui/widgets/cart_panel.dart:1012", "frontend/pos/lib/ui/widgets/cart_panel.dart:1190", "frontend/pos/lib/services/pos_sound_service.dart:1", "frontend/pos/lib/services/image_cache_service.dart:9", "frontend/pos/run-pos.ps1:4", "frontend/pos/run-pos-windows.bat:3"]
---
# โครงสร้างแอปแคชเชียร์ BC Ai POS (Flutter)

แอปแคชเชียร์ของ BC Ai Account เขียนด้วย Flutter อยู่ในโฟลเดอร์ `frontend/pos/` ชื่อแพ็กเกจ `pos` รุ่น `1.0.0+1` (`pubspec.yaml:1-4`) ใช้โค้ดชุดเดียวรันได้ทั้งโปรแกรม Windows (`pos.exe`), มือถือ Android/iOS และ Flutter Web ที่ฝังในหน้า `/pos` ของเว็บ (ดู [[scr-pos-demo-workspace]]) ภาพรวมทั้งระบบอยู่ใน [[sys-pos-overview]]

## แพ็กเกจหลักที่ใช้ (`pubspec.yaml:13-21`)
| แพ็กเกจ | ใช้ทำอะไร |
|---|---|
| `provider` | จัดการสถานะแอปด้วย `ChangeNotifier` |
| `http` | เรียก API ของ BC Ai Account |
| `shared_preferences` | เก็บค่าตั้งค่า รหัสเชื่อมเครื่อง คิวส่งบิล เลขรันบิล |
| `objectbox` + `objectbox_flutter_libs` | ฐานข้อมูลในเครื่อง (สินค้า สมาชิก บิล พักบิล) ดู [[sys-pos-offline-storage]] |
| `qr_flutter` | วาด QR พร้อมเพย์ |
| `uuid` | สร้างรหัสบิล `bill_guid` |
| `path_provider` | หาโฟลเดอร์เก็บไฟล์รูปใบเสร็จและแคชรูป |

## จุดเริ่มต้นและสถานะกลาง
- `main()` เตรียม Flutter แล้วเรียก `runApp(BcAiPosApp)`; บน Android/iOS ตั้งสีแถบสถานะให้กลืนกับธีม (`main.dart:9-24`)
- `BcAiPosApp` สร้าง `PosProvider` ครั้งเดียวแล้วสั่ง `init()` จากนั้นแสดง `CashierScreen` ซึ่งเป็นจอเดียวของแอป ชื่อหน้าต่าง "BC Ai POS (แคชเชียร์)" (`main.dart:29-40`)
- `PosProvider` (`pos_provider.dart:26`) เป็นศูนย์กลางของทุกอย่าง: ตะกร้าบิลปัจจุบัน บิลพัก ลูกค้า ค่าตั้งค่า สถานะซิงก์ และตัวคำนวณโปรโมชั่น ส่วนงานซิงก์แยกอยู่ใน `SyncEngine` ([[sys-pos-sync-client]])
- ตอนเปิดแอป `init()` โหลดที่เก็บข้อมูล รูปแคช ค่าตั้งค่า สถานะกะ บิลพัก คิวส่ง แล้วสร้างบิลเปล่า จากนั้นตั้งตัวจับเวลาซิงก์ทุก 60 วินาทีและสั่งซิงก์ทันที (`pos_provider.dart:207-231`) ระหว่างโหลดจอแสดง "กำลังโหลดระบบ BC Ai POS..." (`cashier_screen.dart:29-44`)

## เค้าโครงหน้าจอ
- ความกว้างตั้งแต่ 820 พิกเซลขึ้นไปถือเป็นเดสก์ท็อป/แท็บเล็ต: แบ่งซ้าย 58% เป็นพื้นที่เลือกสินค้า (`ProductCatalogView`) ขวา 42% เป็นตะกร้า/ชำระเงิน (`CartPanel`) สลับฝั่งซ้าย-ขวาได้ (`cashier_screen.dart:50-60`, `:376-400`)
- ต่ำกว่า 820 (มือถือ) แสดงเป็นสองแท็บ "สินค้าหน้าร้าน" กับ "บิลขาย / ชำระเงิน" (มีตัวเลขจำนวนรายการ) (`cashier_screen.dart:420-466`)
- พื้นที่ฝั่งซ้ายมี 4 โหมด สลับด้วยปุ่มในตะกร้า: 0 หมวดสินค้า (กริด) 1 ค้นหาสินค้า (รายการ) 2 แป้นตัวเลข 3 ลูกค้า/สมาชิก (`pos_provider.dart:74` และ `:799-803`, `cart_panel.dart:1012-1033`)
- ปรับได้จากแถบบน: สลับฝั่ง ขนาดการ์ดสินค้า S/M/L ขนาดตัวอักษรรายการ แสดง/ซ่อนรายละเอียดภาษี (`pos_provider.dart:169-176`, `cashier_screen.dart:191-235`)

## แถบด้านบน
ป้ายสถานะสีเขียว "Online", สีส้ม "Offline", สีแดง "ยังไม่เชื่อมเครื่อง" กดแล้วซิงก์ทันที (ถ้าจอแคบจะแสดงเป็น ON/OFF/!) แสดงจำนวนบิลรอส่ง ถัดไปเป็นปุ่ม "คิวพิมพ์" (ประวัติบิล) "รับ/ส่งเงินกะ" เปิด/ปิดเสียงกด เสียงพูดไทย ปุ่มซิงก์ และปุ่มตั้งค่าเครื่อง (`cashier_screen.dart:100-300`)

## ปุ่มคำสั่งในตะกร้า (`cart_panel.dart:1160-1250`)
ช่องทางขาย · พักบิล · พนักงานขาย · เปิดลิ้นชัก (เปิดหน้าต่างรับเงินทอนของกะ ไม่ได้สั่งเครื่องลิ้นชักจริง) · พิมพ์ซ้ำ (เปิดประวัติบิล) · ใบกำกับภาษี (เปิดหน้าเลือกลูกค้า) · ยกเลิกบิลปัจจุบัน ดูขั้นตอนขายใน [[sys-pos-sale-flow]]

## เสียงและรูปประกอบ
- เสียงเอฟเฟกต์และเสียงพูดภาษาไทย (แจ้งยอดรวม พักบิลเรียบร้อย โปรโมชั่น) ทำงานเฉพาะเมื่อรันเป็น Flutter Web เพราะเรียกฟังก์ชัน `bcPosAudio` ของหน้าเว็บที่ครอบ; บน Windows/มือถือใช้ตัวแทนที่ไม่ทำอะไร (`pos_sound_service.dart:1-2`, `pos_sound_bridge_web.dart:3-10`, `pos_sound_bridge_stub.dart:1-5`) ฝั่งหน้าเว็บอธิบายไว้ใน [[scr-pos-demo-workspace]]
- รูปย่อสินค้า/สมาชิกถูกโหลดมาเก็บเป็นไฟล์เมื่อแสดงครั้งแรก เพดานเริ่มต้น 50 MB ลบอันที่ไม่ได้ใช้นานที่สุดก่อน ออฟไลน์แสดงรูปจากแคชหรือภาพแทน (`image_cache_service.dart:9-30`)

## วิธีเปิดโปรแกรม Windows
สคริปต์ `run-pos.ps1` และ `run-pos-windows.bat` เปิด `pos.exe` จากโฟลเดอร์ build แบบ Release ถ้าไม่มีให้ใช้แบบ Debug (`run-pos.ps1:2-8`, `run-pos-windows.bat:3-9`) ส่วนแบบเว็บเปิดผ่าน `/pos` ตามที่อธิบายใน [[scr-pos-demo-workspace]]

## ที่มาในโค้ด
- `frontend/pos/lib/main.dart:9-40` จุดเริ่มต้นและการสร้าง `PosProvider`
- `frontend/pos/lib/ui/cashier_screen.dart:29-60,100-300,376-466` จอหลัก แถบบน เค้าโครงสองแบบ
- `frontend/pos/lib/providers/pos_provider.dart:26,169-180,207-231` สถานะกลางและการเริ่มต้น
- `frontend/pos/lib/ui/widgets/cart_panel.dart:1012-1033,1160-1250` ปุ่มสลับโหมดและปุ่มคำสั่ง
- `frontend/pos/lib/services/pos_sound_service.dart:1-2` และ `image_cache_service.dart:9-30` เสียงและแคชรูป
- ดูเพิ่ม: [[sys-pos-overview]] · [[sys-pos-sale-flow]] · [[sys-pos-offline-storage]] · [[sys-pos-known-limits]] · [[fe-process-pos-screens]]
