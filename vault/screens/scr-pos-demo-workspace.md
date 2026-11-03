---
title: "พื้นที่ทำงาน POS จอขายแคชเชียร์ (PosDemoWorkspace, เส้นทาง /pos)"
tags: [screens, pos]
aliases: ["PosDemoWorkspace", "/pos", "จุดขายแคชเชียร์ (Flutter POS)", "BC Ai POS", "pos-app", "BC_POS_AUDIO", "bcPosAudio"]
sources: ["frontend/account/pos/PosDemoWorkspace.tsx:21", "frontend/account/pos/PosDemoWorkspace.tsx:31", "frontend/account/pos/PosDemoWorkspace.tsx:116", "frontend/account/pos/PosDemoWorkspace.tsx:262", "frontend/src/app/pos/page.tsx:1", "frontend/shared/layout/PersistentWorkspaceHost.tsx:154", "frontend/shared/layout/PersistentWorkspaceHost.tsx:552"]
---
# พื้นที่ทำงาน POS: จอขายแคชเชียร์ (PosDemoWorkspace)

หน้า "ขายหน้าร้าน" ที่เปิดจาก URL `/pos` ภายในเว็บ BC Ai Account ตัวจอเป็นเปลือก (shell) ที่ฝังแอปแคชเชียร์ Flutter Web ไว้ใน `iframe` และมีแถบสลับไปหน้าตั้งค่า POS ของระบบบัญชี หน้านี้อยู่คนละกลุ่มกับเมนู ERP ไม่มีรหัสเมนู 4 หลักและไม่ผ่าน `screenRegistry` ([[fe-screen-registry-menu]])

## วิธีเปิด
- ไปที่ `/pos` หรือ `/pos/...` โดยตรง หรือจากลิงก์ "เปิดจอขายแคชเชียร์ POS (/pos)" ในจอตั้งค่า ([[scr-pos-setup-control]])
- เพจ `src/app/pos/page.tsx` ตรวจ session: ยังไม่ล็อกอิน -> ไป `/login`, ยังไม่เลือกฐานข้อมูล -> ไป `/select-database` แล้วจึงเรนเดอร์ `WorkspaceRouteSync`
- `PersistentWorkspaceHost` แปลง path ที่ขึ้นต้นด้วย `/pos` เป็นโมดูล `pos` (`PersistentWorkspaceHost.tsx:154`) และแสดง `<PosDemoWorkspace />` (`:552`) ตัวโมดูลถูกคงสถานะไว้เมื่อสลับระบบอื่น (ดู [[fe-app-shell-routing]])

## แถบควบคุมด้านบน (`:116-262`)
| ปุ่ม | ทำอะไร |
|---|---|
| กลับหน้าหลัก BC Account | ลิงก์ไป `/home` |
| จุดขายแคชเชียร์ (Flutter POS) | แสดงแอปแคชเชียร์ (`viewMode = cashier`) |
| สูตรโปรโมชั่น POS (Dede 10 รูปแบบ) | แสดงหน้าตั้งค่า แท็บ `promotions` |
| กำหนดค่าเริ่มต้น POS | แสดงหน้าตั้งค่า แท็บ `startup` |
| รหัสเครื่อง POS | แสดงหน้าตั้งค่า แท็บ `machines` |
| แถบสถานะเสียง | คลิกเพื่อทดสอบเสียงเอฟเฟกต์และเสียงพูดไทย |
| Desktop (เต็มจอ) / Tablet (1024x768) / Mobile (412x840) | เปลี่ยนขนาดกรอบแอปแคชเชียร์เพื่อดูตัวอย่างหลายอุปกรณ์ |

เมื่ออยู่โหมดตั้งค่า ปุ่มมุมขวาแสดงข้อความ "เชื่อมฐานข้อมูล BC Ai Account (PostgreSQL ↔ ObjectBox POS)" แทนตัวเลือกขนาดจอ (`:262`)

## โหมดแคชเชียร์
- โหลดแอป Flutter Web จากไฟล์สถิตใน `public/pos-app/index.html` ด้วย `iframe` (`:279-312`) โหมด Desktop เต็มพื้นที่ ส่วน Tablet/Mobile วางในกรอบอุปกรณ์ขนาดคงที่ (`max-h` 86vh)
- แอปนี้เป็นโค้ดแยก (build ของ Flutter ใต้ `pos-app/`) ไม่ใช่โค้ดของ `frontend/account` รายละเอียดหน้าจอขายจึงอยู่นอกบันทึกนี้ ตรรกะบิลและการซิงก์ฝั่งหลังบ้านดู [[proc-pos-bill]], [[proc-pos-sync]]

## โหมดตั้งค่า
ฝังจอ [[scr-pos-setup-control]] (`PosSetupAndControlScreen`) ใน `main` โดยส่ง `menuKey`, `menuCode`, `title` เองตามแท็บที่กด (`:271-300`)
- `promotions` -> `pos_promotion_formula`, `machines` -> `menu_config_pos_machine`, นอกนั้น -> `menu_config_pos_startup`
- รหัสเมนูที่ส่งเป็นรหัสแบบจุดรุ่นเก่า ("2.1.14", "1.1.21", "1.1.20") ซึ่งไม่ตรงรหัส 4 หลักในเมนูปัจจุบัน (เช่น เครื่อง POS คือ 1017) เป็นแค่ป้ายแสดงมุมจอ ไม่กระทบสิทธิ์
- ปุ่ม **ปิดหน้าจอ** ในจอตั้งค่าสลับกลับโหมดแคชเชียร์ (`onClose`, `:293`)
- ใช้ `key={configTab}` จอตั้งค่าจึงรีเซ็ตทุกครั้งที่สลับแท็บ
- แท็บโปรโมชั่นเปิดได้เฉพาะทางนี้ เพราะเมนูรหัส 2015 ใน ERP ใช้จอ master-detail ([[scr-master-detail]])

## ระบบเสียง (`:31-115`)
- หน้าต่างหลักฟังข้อความ `postMessage` ที่มี `source = "BC_POS_AUDIO"` จากแอป POS: ชนิด `speak`/`speech` แสดง "พูดไทย: ..." ส่วนเสียงกดแสดง "เสียงกด (<ชนิด>): ..." และกะพริบ 1.4 วินาที
- ปุ่มทดสอบ เรียก `bcPosAudio.play("promo","test")` กับ `speak("ระบบขายหน้าร้าน บีซี เอไอ พีโอเอส พร้อมใช้งาน", true)` ในแอป ถ้าเข้าไม่ถึง iframe จะใช้ `speechSynthesis` ของเบราว์เซอร์ (ภาษา `th-TH`) แทน
- ไฟล์เสียงที่ตั้งได้อยู่ที่เมนู 1051 ใน [[scr-pos-setup-control]]

## ข้อควรระวัง
- จอนี้ไม่ได้เรียก API เอง การขายจริงทั้งหมดอยู่ในแอป Flutter ภายใน iframe
- ชื่อไฟล์/คอมโพเนนต์ใช้คำว่า Demo แต่ผูกเป็นหน้า `/pos` จริงของระบบ
- ข้อความเสียงที่ทดสอบกำหนดตายตัวในโค้ด

## ที่มาในโค้ด
- `frontend/account/pos/PosDemoWorkspace.tsx:21-22` ชนิดมุมมอง; `:31-115` สถานะ เสียง; `:116-262` แถบควบคุม; `:265-320` พื้นที่แสดงผล
- `frontend/src/app/pos/page.tsx` — เพจ `/pos`
- `frontend/shared/layout/PersistentWorkspaceHost.tsx:23-26,154,552` — โหมดโมดูล pos
- ดูเพิ่ม: [[scr-pos-setup-control]] · [[fe-process-pos-screens]] · [[screens-overview]]
