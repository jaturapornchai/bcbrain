---
title: "พื้นที่ทำงาน POS จอขายแคชเชียร์ (PosDemoWorkspace, เส้นทาง /pos)"
tags: [screens, pos]
aliases: ["PosDemoWorkspace", "/pos", "จุดขายแคชเชียร์ (Flutter POS)", "BC Ai POS", "pos-app", "BC_POS_AUDIO", "bcPosAudio", "POS Standard"]
sources: ["frontend/account/pos/PosDemoWorkspace.tsx:32", "frontend/account/pos/PosDemoWorkspace.tsx:41-67", "frontend/account/pos/PosDemoWorkspace.tsx:116-284", "frontend/account/pos/PosDemoWorkspace.tsx:288-339", "frontend/src/app/pos/page.tsx:9-15", "frontend/shared/layout/PersistentWorkspaceHost.tsx:154", "frontend/shared/layout/PersistentWorkspaceHost.tsx:552", "frontend/src/config/schemas/masterDetailSchemas.ts:1669"]
---
# พื้นที่ทำงาน POS: จอขายแคชเชียร์ (PosDemoWorkspace)

หน้า "ขายหน้าร้าน" ที่เปิดจาก URL `/pos` ภายในเว็บ BC Ai Account ตัวจอเป็นเปลือก (shell) ที่ฝังแอปแคชเชียร์ Flutter Web ไว้ใน `iframe` และมีแถบสลับไปหน้าตั้งค่า POS ของระบบบัญชี หน้านี้อยู่คนละกลุ่มกับเมนู ERP ไม่มีรหัสเมนู 4 หลักและไม่ผ่าน `screenRegistry` ([[fe-screen-registry-menu]]) เลขบรรทัดที่ไม่ระบุไฟล์เป็นของ `frontend/account/pos/PosDemoWorkspace.tsx`

## วิธีเปิด
- ไปที่ `/pos` หรือ `/pos/...` โดยตรง จากการ์ด "POS Standard" ในพอร์ทัลเลือกระบบ (`frontend/shared/layout/SystemPortalScreen.tsx:111-114`) จากป้ายระบบ "ระบบ ขาย POS" ที่ส่วนหัวเว็บ (`frontend/shared/layout/Header.tsx:105-106`) หรือจากลิงก์ "เปิดจอขายแคชเชียร์ POS (/pos)" ในจอตั้งค่า ([[scr-pos-setup-control]], `frontend/account/pos/PosSetupAndControlScreen.tsx:1099-1106`)
- เพจ `frontend/src/app/pos/page.tsx` ตรวจ session: ยังไม่ล็อกอิน -> ไป `/login`, ยังไม่เลือกฐานข้อมูล -> ไป `/select-database` แล้วจึงเรนเดอร์ `WorkspaceRouteSync` (`page.tsx:9-15`)
- `PersistentWorkspaceHost` แปลง path ที่เป็น `/pos` หรือขึ้นต้นด้วย `/pos/` เป็นโมดูล `pos` (`PersistentWorkspaceHost.tsx:154`) และแสดง `<PosDemoWorkspace />` (`:552`) คอมโพเนนต์โหลดแบบ `dynamic` ไม่เรนเดอร์ฝั่งเซิร์ฟเวอร์ (`:23-27`) โมดูลถูกคงสถานะไว้เมื่อสลับระบบอื่น (ดู [[fe-app-shell-routing]])

## แถบควบคุมด้านบน (`:116-284`)
| ส่วน | ทำอะไร |
|---|---|
| กลับหน้าหลัก BC Account | ลิงก์ไป `/home` (`:120-127`) |
| ป้าย "POS Standard (ค้าปลีก-ส่ง / ซูเปอร์มาร์เก็ต)" | ป้ายบอกระบบ กดไม่ได้ (`:131-138`) |
| จุดขายแคชเชียร์ (Flutter POS) | แสดงแอปแคชเชียร์ (`viewMode = cashier`, `:147-159`) |
| สูตรโปรโมชั่น POS (Dede 10 รูปแบบ) | แสดงหน้าตั้งค่า แท็บ `promotions` (`:160-175`) |
| กำหนดค่าเริ่มต้น POS | แสดงหน้าตั้งค่า แท็บ `startup` (`:176-191`) |
| รหัสเครื่อง POS | แสดงหน้าตั้งค่า แท็บ `machines` (`:192-207`) |
| แถบสถานะเสียง | คลิกเพื่อทดสอบเสียงเอฟเฟกต์และเสียงพูดไทย (`:213-235`) |
| Desktop (เต็มจอ) / Tablet (1024x768) / Mobile (412x840) | เปลี่ยนขนาดกรอบแอปแคชเชียร์เพื่อดูตัวอย่างหลายอุปกรณ์ (`:240-277`) |

ปุ่มที่อยู่ในแท็บที่เปิดอยู่จะเป็นสีเหลือง ค่าเริ่มต้นเมื่อเข้าจอคือโหมดแคชเชียร์ ขนาด Desktop และแท็บตั้งค่าตั้งต้นคือ `promotions` (`:33-35`) เมื่ออยู่โหมดตั้งค่า ปุ่มขนาดจอและแถบเสียงหายไป เหลือข้อความ "เชื่อมฐานข้อมูล BC Ai Account (PostgreSQL ↔ ObjectBox POS)" ที่มุมขวา (`:279-283`)

## โหมดแคชเชียร์
- โหลดแอป Flutter Web จากไฟล์สถิต `/pos-app/index.html` (ใต้ `frontend/public/pos-app/`) ด้วย `iframe` (`:317-339`) โหมด Desktop เต็มพื้นที่ ส่วน Tablet/Mobile วางในกรอบอุปกรณ์ขนาดคงที่ (1024x768 หรือ 412x840 จำกัดสูงไม่เกิน 86vh, `:325-331`)
- แอปนี้เป็นโค้ดแยก (build ของ Flutter ใต้ `pos-app/`) ไม่ใช่โค้ดของ `frontend/account` รายละเอียดหน้าจอขายจึงอยู่นอกบันทึกนี้ ตรรกะบิลและการซิงก์ฝั่งหลังบ้านดู [[proc-pos-bill]], [[proc-pos-sync]]

## โหมดตั้งค่า
ฝังจอ [[scr-pos-setup-control]] (`PosSetupAndControlScreen`) ใน `main` โดยส่ง `menuKey`, `menuCode`, `title`, `initialTab` เองตามแท็บที่กด (`:288-315`)
- `promotions` -> `pos_promotion_formula`, `machines` -> `menu_config_pos_machine`, นอกนั้น -> `menu_config_pos_startup` (`:292-298`)
- รหัสเมนูที่ส่งเป็นค่าตายตัวในโค้ด `"2.1.14"` (โปรโมชั่น) `"1.1.21"` (เครื่อง POS) `"1.1.20"` (ค่าเริ่มต้น) (`:299-305`) ซึ่งเป็นรูปแบบจุด ไม่ตรงรหัส 4 หลักของเมนูปัจจุบัน (โปรโมชั่น 2015, เครื่อง POS 1017, ค่าเริ่มต้น 1016) จอตั้งค่านำไปแสดงเป็นป้ายรหัสที่หัวจอเท่านั้น (`PosSetupAndControlScreen.tsx:1181-1183`) ไม่ใช้ตัดสินสิทธิ์
- ปุ่ม **ปิดหน้าจอ** ในจอตั้งค่าสลับกลับโหมดแคชเชียร์ (`onClose`, `:314`)
- ใช้ `key={configTab}` จอตั้งค่าจึงรีเซ็ตทุกครั้งที่สลับแท็บ (`:291`)
- แท็บโปรโมชั่นเปิดได้เฉพาะทางนี้ เพราะเมนูรหัส 2015 (`pos_promotion_formula`) ใน ERP ใช้จอ master-detail ที่นิยามใน `masterDetailSchemas.ts:1669` ([[scr-master-detail]])

## ระบบเสียง (`:41-113`)
- หน้าต่างหลักฟังข้อความ `postMessage` ที่มี `source = "BC_POS_AUDIO"` จากแอป POS (`:41-67`): ถ้า `event = "speak"` หรือ `kind = "speech"` แสดง "พูดไทย: ..." ถ้าเป็น `event = "sound"` หรือมี `kind` แสดง "เสียงกด (<ชนิด>): ..." (ข้อความนำหน้ามีสัญลักษณ์) และแถบกะพริบ 1.4 วินาที (`:229-233`)
- ปุ่มทดสอบ (`handleTestAudioAndVoice` `:69-113`) เรียก `bcPosAudio.play("promo","test")` กับ `speak("ระบบขายหน้าร้าน บีซี เอไอ พีโอเอส พร้อมใช้งานค่ะ", true)` ในแอป (หรือ `playSound` / `speakThai` ถ้าแอปใช้ชื่อนั้น) ถ้าเข้าไม่ถึง `iframe` จะใช้ `speechSynthesis` ของเบราว์เซอร์ (ภาษา `th-TH`) แทน แล้วแสดงข้อความเดียวกันในแถบสถานะ
- ไฟล์เสียงที่ตั้งได้อยู่ที่เมนู 1051 ใน [[scr-pos-setup-control]]

## ข้อควรระวัง
- จอนี้ไม่ได้เรียก API เอง การขายจริงทั้งหมดอยู่ในแอป Flutter ภายใน `iframe`
- ชื่อไฟล์/คอมโพเนนต์ใช้คำว่า Demo แต่ผูกเป็นหน้า `/pos` จริงของระบบ
- ข้อความเสียงที่ทดสอบกำหนดตายตัวในโค้ด (`:89`, `:100`)
- ป้ายสถานะเสียงอ่านได้เฉพาะเมื่อแอปใน `iframe` ส่ง `postMessage` ออกมา (ตัวรับไม่ตรวจ `event.origin` `:42-44`)

## ที่มาในโค้ด
- `frontend/account/pos/PosDemoWorkspace.tsx:22-23` ชนิดมุมมอง; `:32-39` สถานะ; `:41-113` เสียง; `:116-284` แถบควบคุม; `:286-340` พื้นที่แสดงผล
- `frontend/src/app/pos/page.tsx:9-15` — เพจ `/pos`
- `frontend/shared/layout/PersistentWorkspaceHost.tsx:23-27,154,552` — โหมดโมดูล pos
- `frontend/shared/layout/SystemPortalScreen.tsx:111-114`, `frontend/shared/layout/Header.tsx:105-106` — ทางเข้า
- `frontend/src/config/schemas/masterDetailSchemas.ts:1669` — นิยามจอ `pos_promotion_formula`
- ดูเพิ่ม: [[scr-pos-setup-control]] · [[fe-process-pos-screens]] · [[screens-overview]]
