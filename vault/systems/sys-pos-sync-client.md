---
title: "การซิงก์ฝั่งแอป POS ส่งบิลขึ้น ดึงข้อมูลลง และลองใหม่ (sys-pos-sync-client)"
tags: [systems, pos, sync, outbox, offline, retry]
aliases: ["SyncEngine", "outbox POS", "ซิงก์ POS", "delta sync", "cursor", "backoff", "bill_guid", "X-Pos-Pending-Bills", "รอส่ง", "ต้องตรวจสอบ"]
sources: ["frontend/pos/lib/services/sync_engine.dart:21", "frontend/pos/lib/services/sync_engine.dart:25", "frontend/pos/lib/services/sync_engine.dart:55", "frontend/pos/lib/services/sync_engine.dart:158", "frontend/pos/lib/services/sync_engine.dart:185", "frontend/pos/lib/services/sync_engine.dart:194", "frontend/pos/lib/services/sync_engine.dart:213", "frontend/pos/lib/services/sync_engine.dart:255", "frontend/pos/lib/services/sync_engine.dart:358", "frontend/pos/lib/services/sync_engine.dart:383", "frontend/pos/lib/services/sync_engine.dart:401", "frontend/pos/lib/services/sync_engine.dart:450", "frontend/pos/lib/services/api_service.dart:15", "frontend/pos/lib/services/api_service.dart:75", "frontend/pos/lib/providers/pos_provider.dart:207", "frontend/pos/lib/providers/pos_provider.dart:228", "frontend/pos/lib/providers/pos_provider.dart:233", "frontend/pos/lib/providers/pos_provider.dart:250", "frontend/pos/lib/models/outbox_entry.dart:3", "frontend/pos/lib/models/outbox_entry.dart:31", "frontend/pos/lib/ui/widgets/settings_dialog.dart:620"]
---
# การซิงก์ฝั่งแอป POS

`SyncEngine` ดูแลการคุยกับ BC Ai Account ทั้งหมดของแอปแคชเชียร์: **ส่งบิล/รูปใบเสร็จ/รายการเงินขึ้น** และ **ดึงสินค้า สมาชิก โปรโมชั่น คูปอง ค่าเครื่องลง** ฝั่งเซิร์ฟเวอร์อธิบายใน [[proc-pos-sync]] [[be-pos-sync-api]] และ [[api-pos]] หน้านี้อธิบายเฉพาะพฤติกรรมของแอป ภาพรวม: [[sys-pos-overview]]

## ซิงก์เมื่อไร
| จังหวะ | พฤติกรรม |
|---|---|
| เปิดแอป | ซิงก์ทันทีแบบข้ามเวลารอ (`force`) (`pos_provider.dart:228-229`) |
| กลับเข้าแอป (resume) | ซิงก์แบบ `force` (`pos_provider.dart:233-235`) |
| ตัวจับเวลา | ทุก 60 วินาที (`pos_provider.dart:228`) |
| หลังขายสำเร็จ | สั่งซิงก์เบื้องหลัง ไม่ต้องรอ (`pos_provider.dart:1146`) |
| กดป้ายสถานะ Online/Offline บนแถบบน หรือปุ่มซิงก์ | ซิงก์ทันที (`cashier_screen.dart:104,278`, `pos_provider.dart:290-298`) |

ล็อกเดียวต่อแอป (`_running`): ถ้ามีรอบซิงก์ทำงานอยู่ จะตั้งธง `_again` ให้วนอีกรอบหลังจบ แทนการเริ่มซ้อน (`sync_engine.dart:21,55-56,158-183`) ถ้ายังไม่เชื่อมเครื่อง หรือสถานะ 401 จะไม่ซิงก์เลย

## ลำดับในหนึ่งรอบ (`sync_engine.dart:185-195`)
1. **ส่งบิลที่รออยู่** เรียงตามเวลาที่ขาย
2. **ส่งรูปใบเสร็จ** ([[sys-pos-receipt-printing]])
3. **ส่งรายการรับ/ส่งเงินและยกเลิกบิลที่ค้างคิว** ([[sys-pos-shift-cash]])
4. **ส่งลูกค้าชั่วคราว** (ครั้งเดียวต่อรหัส)
5. **ดึงข้อมูลลงเครื่อง** (delta)
6. **กู้คืนอัตโนมัติ** ครั้งเดียวถ้าเครื่องว่างจริง ([[sys-pos-device-pairing]])

ขั้นไหนพบว่าเครือข่ายขัดข้องหรือ 401 จะหยุดทั้งรอบ ขั้นที่เหลือไม่ถูกลองต่อ (`sync_engine.dart:196-211`)

## ส่งบิลขึ้น (`POST /api/pos/bills`)
- เนื้อหาบิลถูก "freeze" ตั้งแต่ตอนขายและเก็บในคิว `outbox` พร้อมสถานะ `pending` → `sent` หรือ `attention` ต่อ `bill_guid` (`outbox_entry.dart:3`, `pos_provider.dart:1137-1142`)
- ส่งซ้ำด้วย `bill_guid` เดิมได้เสมอ เซิร์ฟเวอร์ไม่สร้างบิลซ้ำ (`api_service.dart:95`) จึงปลอดภัยเมื่อเครือข่ายหลุดระหว่างตอบกลับ
- ผลตอบกลับ (`sync_engine.dart:213-253`, `api_service.dart:15-19`):
  - สำเร็จ → สถานะ `sent` เก็บสถานะที่เซิร์ฟเวอร์ตอบ ล้างเนื้อหาที่ freeze วาดรูปใบเสร็จเข้าคิว ย้ายบิลไปกลุ่มซิงก์แล้ว
  - 400 / 409 / 422 (เซิร์ฟเวอร์ปฏิเสธ) → สถานะ `attention` ส่งซ้ำก็ไม่ช่วย ต้องให้คนดู
  - 5xx หรือเครือข่ายขัดข้อง → รอแล้วลองใหม่
  - 401 → หยุดและแจ้งรหัสถูกยกเลิก
- **ระยะรอก่อนลองใหม่** (backoff): 15 วินาที แล้วทวีคูณ 30, 60 ... สูงสุด 300 วินาที (5 นาที) ต่อบิล; ตัวจับเวลา 60 วินาทีจะหยิบบิลที่ถึงเวลาแล้วเอง; การกดซิงก์/เปิดแอป/กลับเข้าแอป (`force`) ข้ามการรอ (`sync_engine.dart:255-265`)
- บิลที่เซิร์ฟเวอร์รับแล้วแต่ประมวลผลผิดพลาด (`sent` ที่สถานะเป็น `error`) ก็นับเป็น "ต้องตรวจสอบ" (`outbox_entry.dart:31-32`)

## หน้าจอแสดงสถานะ
- ป้ายบนแถบบน: Online / Offline / ยังไม่เชื่อมเครื่อง พร้อมข้อความ "รอส่ง N" บนจอแคบ ([[sys-pos-app-structure]])
- แท็บ "เครื่อง POS & ค่าจาก BC Ai Account" แสดงข้อความล่าสุด และรายการ "ต้องตรวจสอบ" (บิลและรูปใบเสร็จ) พร้อมสาเหตุ และปุ่ม "รับทราบ" เพื่อเอาออกจากรายการ (`settings_dialog.dart:520-526,612-640`, `pos_provider.dart:386-403`)
- ประวัติบิลในเครื่องแสดงป้าย "รอส่ง" / "ต้องตรวจสอบ" ต่อบิล (`pos_provider.dart:362-384`)

## ดึงข้อมูลลง (`GET /api/pos/sync`)
- ส่ง `cursor` ที่เก็บไว้ (ว่าง = ดึงทั้งหมด) จำนวนสูงสุดหน้าละ 500 แถว พร้อมหัว `X-Pos-Pending-Bills` (จำนวนบิลรอส่ง) และ `X-Pos-App-Version` (`sync_engine.dart:25,401-411`, `api_service.dart:75-92`)
- ผลตอบกลับเป็นรายการเปลี่ยนแปลงต่อ entity: `product`, `member`, `promotion`, `coupon`, `config`; แถวที่ว่างของ key หนึ่ง = ลบรายการนั้น (`sync_engine.dart:438-467`, `objectbox_native.dart:195-225`)
- `config` ถูกนำไปอัปเดตค่าเครื่อง ([[sys-pos-app-config]]) ส่วนอื่นเขียนลงฐานข้อมูลหนึ่งหน้า = หนึ่งทรานแซกชัน และลบไฟล์แคชรูปของรายการที่เปลี่ยน/ถูกลบ
- ดึงต่อจนเซิร์ฟเวอร์บอก `has_more` เป็นเท็จ แล้วจึง **บันทึก cursor ครั้งเดียวตอนจบ** ถ้าหลุดกลางทาง cursor เดิมยังอยู่ รอบหน้าดึงซ้ำได้อย่างปลอดภัย (ถ้า cursor ที่ได้กลับมาซ้ำหรือว่างขณะยังมีหน้าถัดไป ถือว่าข้อมูลผิดปกติและหยุดรอบนั้น) (`sync_engine.dart:420-436`)
- เมื่อแค็ตตาล็อกเปลี่ยน แอปโหลดสินค้า/สมาชิก/โปรโมชั่นเข้าหน่วยความจำใหม่และคำนวณโปรโมชั่นของบิลปัจจุบันซ้ำ (`pos_provider.dart:250-260`)

## ข้อควรรู้
- เวลาออฟไลน์ ขายต่อได้ตามปกติ บิลสะสมในคิว พอกลับมาออนไลน์จะถูกส่งตามลำดับเวลา
- ล้างเครื่อง/เปลี่ยนรหัสเชื่อมเครื่องไม่ได้ตราบที่มีบิลหรือรูปค้างส่ง เพื่อไม่ให้ข้อมูลขายหาย ([[sys-pos-device-pairing]])
- ไม่มีการซิงก์บิลพัก ค่าเครื่องแบบสองทาง หรือรายการสต็อกกลับมาที่แอป: ขาลงมีเพียงห้า entity ข้างต้น

## ที่มาในโค้ด
- `frontend/pos/lib/services/sync_engine.dart:21-467` ตัวซิงก์ทั้งหมด
- `frontend/pos/lib/services/api_service.dart:7-124` ผลตอบกลับและเส้นทาง API
- `frontend/pos/lib/providers/pos_provider.dart:207-260,290-298,362-403` trigger และสถานะ
- ดูเพิ่ม: [[sys-pos-overview]] · [[sys-pos-offline-storage]] · [[proc-pos-sync]] · [[proc-pos-bill]] · [[be-pos-sync-api]] · [[api-pos]]
