---
title: "กะแคชเชียร์ รับ-ส่งเงิน ยกเลิกบิล และกู้คืนข้อมูลเครื่อง POS (sys-pos-shift-cash)"
tags: [systems, pos, shift, cash, cancel-bill, restore]
aliases: ["รับเงินทอน", "ส่งเงินปิดกะ", "รับ/ส่งเงินกะ", "เปิดลิ้นชัก", "RCV", "SND", "receive_money", "send_money", "close_shift", "cancel_bill", "กู้คืนข้อมูลเครื่อง", "RestoreMerge", "ประวัติบิล ยกเลิกบิล"]
sources: ["frontend/pos/lib/providers/pos_provider.dart:429", "frontend/pos/lib/providers/pos_provider.dart:457", "frontend/pos/lib/providers/pos_provider.dart:464", "frontend/pos/lib/providers/pos_provider.dart:500", "frontend/pos/lib/providers/pos_provider.dart:511", "frontend/pos/lib/providers/pos_provider.dart:534", "frontend/pos/lib/providers/pos_provider.dart:281", "frontend/pos/lib/ui/widgets/settings_dialog.dart:25", "frontend/pos/lib/ui/widgets/settings_dialog.dart:50", "frontend/pos/lib/ui/widgets/settings_dialog.dart:165", "frontend/pos/lib/ui/widgets/settings_dialog.dart:324", "frontend/pos/lib/ui/widgets/settings_dialog.dart:590", "frontend/pos/lib/ui/cashier_screen.dart:244", "frontend/pos/lib/ui/widgets/cart_panel.dart:1196", "frontend/pos/lib/services/sync_engine.dart:105", "frontend/pos/lib/services/sync_engine.dart:149", "frontend/pos/lib/services/sync_engine.dart:358", "frontend/pos/lib/services/restore_merge.dart:108", "frontend/pos/lib/services/storage_service.dart:276", "frontend/pos/lib/services/api_service.dart:103", "frontend/pos/lib/models/app_config.dart:170"]
---
# กะแคชเชียร์ รับ-ส่งเงิน ยกเลิกบิล และกู้คืนข้อมูลเครื่อง

แอปแคชเชียร์มีหน้าต่าง "ตั้งค่า" (`SettingsDialog`) 3 แท็บ สองแท็บแรกใช้บ่อยหน้าร้าน ส่วนแท็บที่สามอยู่ใน [[sys-pos-app-config]]

| แท็บ | ชื่อบนจอ | ใช้ทำอะไร |
|---|---|---|
| 0 | รับเงินทอน / ส่งเงินปิดกะ | บันทึกเงินเข้า-ออกลิ้นชัก (หัวข้อนี้) |
| 1 | ประวัติบิลขาย / ยกเลิกบิล | พิมพ์ซ้ำ และยกเลิกบิลที่ส่งขึ้นระบบแล้ว |
| 2 | เครื่อง POS & ค่าจาก BC Ai Account | เชื่อมเครื่อง ค่าเครื่อง กู้คืน ([[sys-pos-device-pairing]]) |

(`settings_dialog.dart:33,141-143`) เปิดแท็บ 0 ได้จากปุ่มบนแถบบน "รับ/ส่งเงินกะ" และปุ่มคำสั่ง "เปิดลิ้นชัก" ในตะกร้า แท็บ 1 จากปุ่ม "คิวพิมพ์ (N)" และ "พิมพ์ซ้ำ" (`cashier_screen.dart:185,244`, `cart_panel.dart:1196,1206`) ภาพรวมระบบ: [[sys-pos-overview]]

## รับเงินทอน และนำส่งเงิน (แท็บ 0)
เลือกชิป 1 ใน 2 แบบ กรอกจำนวนเงินสดและหมายเหตุ แล้วกดปุ่มบันทึก (`settings_dialog.dart:165-215`):

| ชิป | ชนิดรายการ | เลขที่เอกสาร | `action` ที่ส่ง | ค่าตั้งต้นในช่องจำนวนเงิน |
|---|---|---|---|---|
| 1. รับเงินทอนเข้าลิ้นชัก | `trans_type` 1 | `RCV-` + รหัสสุ่ม 12 ตัว | `receive_money` | 2000 |
| 2. นำส่งเงินสดปิดกะ | `trans_type` 2 | `SND-` + รหัสสุ่ม 12 ตัว | `send_money` | 5000 |

- จำนวนเงินต้องมากกว่าศูนย์ มิฉะนั้นขึ้น "กรุณาระบุจำนวนเงินให้ถูกต้อง" (`settings_dialog.dart:50-58`)
- ค่าตั้งต้น 2000 / 5000 เป็นเพียงตัวเลขที่เติมในช่องให้แก้ ไม่ได้อ่านจากค่าเครื่อง (`settings_dialog.dart:22,189,209`)
- แต่ละรายการแนบ `docno`, `docdate`, `doc_time`, `cashiercode` (รหัสแคชเชียร์ในค่าเครื่อง), `pos_id` (หมายเลขเครื่อง), `remark` แล้วส่ง `POST /api/pos/shift` (`pos_provider.dart:429-457`, `api_service.dart:103-109`)
- **เลขที่เอกสารสร้างที่เครื่อง** จึงส่งซ้ำได้โดยไม่เกิดรายการซ้ำ: ถ้าเครือข่ายหลุดหรือเซิร์ฟเวอร์ 5xx รายการเข้าคิวในเครื่อง (ติดป้าย "(รอซิงก์)" ในรายการ) และถูกส่งใหม่รอบซิงก์ถัดไปตามลำดับเดิม ([[sys-pos-sync-client]]) ถ้าเซิร์ฟเวอร์ปฏิเสธ (400/409/422) ไม่เก็บคิวและขึ้นข้อความผิดพลาด ไม่บันทึกในเครื่อง; 401 แจ้งรหัสถูกยกเลิก (`pos_provider.dart:457-466`, `sync_engine.dart:358-380`)
- ยังไม่ได้เชื่อมเครื่อง → ไม่บันทึกและขึ้นข้อความให้วางรหัสเชื่อมเครื่อง ([[sys-pos-device-pairing]])
- ด้านล่างแสดงประวัติรายการรับ-ส่งเงินของเครื่องนี้ (รับเงินเป็น +, ส่งเงินเป็น −) เก็บในเครื่องไม่เกิน 100 รายการ (`settings_dialog.dart:269-322`, `storage_service.dart:290-291`)
- การบันทึกลงบัญชี/สมุดรายวันฝั่งเซิร์ฟเวอร์ของรายการเหล่านี้ดู [[proc-pos-config-shift]]

### สิ่งที่แอปทำและไม่ทำเกี่ยวกับ "กะ"
- รับเงินทอน (`trans_type` 1) จะสร้างข้อมูลกะในเครื่อง (วันที่-เวลาเริ่ม เงินทอนตั้งต้น สถานะเปิด) ส่วนส่งเงินจะบันทึกรายการเท่านั้น (`pos_provider.dart:468-488`)
- ปุ่มบนจอ "นำส่งเงินสดปิดกะ" เรียก `recordSendMoney` โดยไม่ส่งธง `closeShift` และส่งยอดโอน/บัตรเป็น 0 เสมอ จึงส่ง `action` เป็น `send_money` ไม่ใช่ `close_shift` และสถานะกะในเครื่องไม่ถูกเปลี่ยนเป็นปิด (`settings_dialog.dart:62-66`, `pos_provider.dart:511-531`) โค้ดฝั่งแอปรองรับ `close_shift` แต่หน้าจอยังไม่มีทางเรียกใช้
- ข้อมูลกะที่เปิดอยู่ (`activeShift`) ถูกเก็บและกู้คืนได้ แต่ไม่มีหน้าจอไหนอ่านมาแสดง และการขายไม่ต้องรอเปิดกะ (ค้นทั้งโฟลเดอร์ `lib/` พบการใช้เฉพาะใน `pos_provider.dart`) ([[sys-pos-known-limits]])

## ประวัติบิลและยกเลิกบิล (แท็บ 1)
- แสดงบิลล่าสุดของเครื่องนี้ไม่เกิน 50 บิล เลขที่บิล ยอดรวม ชื่อลูกค้า วิธีชำระ วันเวลา ป้าย "ปกติ" / "ยกเลิกแล้ว" และป้าย "รอส่ง" / "ต้องตรวจสอบ" ตามสถานะคิว (`settings_dialog.dart:324-400`, `pos_provider.dart:362-384`)
- ปุ่มไอคอนเครื่องพิมพ์ "พิมพ์ซ้ำ" เปิดใบเสร็จจากบิลในเครื่อง (รวมบิลที่กู้คืนจากเซิร์ฟเวอร์) ในโหมดพิมพ์ซ้ำ ([[sys-pos-receipt-printing]]) (`settings_dialog.dart:668-677`)
- ปุ่ม "ยกเลิกบิล" (แสดงเมื่อบิลยังไม่ถูกยกเลิก) ทำงานทันทีเมื่อกด **ไม่มีหน้าต่างให้ยืนยัน** และใช้เหตุผลตายตัวว่า "ลูกค้าขอยกเลิกบิลที่จุดแคชเชียร์" (`settings_dialog.dart:407-415`)
- เงื่อนไขก่อนยกเลิก (`pos_provider.dart:534-565`):
  1. ค่าเครื่อง `allowCancelBill` ต้องเป็นจริง — ได้จากค่าร้านฝั่ง BC Ai Account (`shop.pos_cancel_bill` = 1) ถ้าปิดจะขึ้น "ไม่อนุญาตให้ยกเลิกบิล" (`app_config.dart:170`)
  2. ต้องเชื่อมเครื่องแล้ว
  3. บิลต้อง **ส่งขึ้นเซิร์ฟเวอร์สำเร็จแล้ว** (สถานะคิว `sent`) ถ้ายังรอส่ง แจ้งให้รอซิงก์ก่อน
- แอปส่ง `action: cancel_bill` พร้อม `doc_no` และ `reason` ไปที่ `POST /api/pos/shift` ไม่มีคิวส่งซ้ำ (ต้องออนไลน์ขณะกด) สำเร็จแล้วจึงทำเครื่องหมาย "ยกเลิกแล้ว" ในเครื่อง ส่วนการกลับรายการสต็อกและบัญชีเป็นหน้าที่เซิร์ฟเวอร์ ([[proc-pos-bill]], [[be-pos-sync-api]])

## กู้คืนข้อมูลเครื่อง (restore)
- ปุ่ม "กู้คืนข้อมูลเครื่องจาก BC Ai Account" ในแท็บ 2 เรียก `GET /api/pos/restore` ได้กะที่เปิดอยู่ รายการรับ-ส่งเงิน และบิลของเครื่องนี้ (เนื้อหาเดิมที่เคยส่ง) แล้วรวมเข้าเครื่อง (`settings_dialog.dart:590`, `pos_provider.dart:281`, `api_service.dart:118-122`)
- รวมแบบทำซ้ำได้ผลเท่าเดิม: บิลรวมตาม `bill_guid` / เลขที่บิล ไม่แตะบิลที่ยังไม่ส่งในเครื่อง ไม่ส่งบิลที่กู้คืนซ้ำขึ้นเซิร์ฟเวอร์ รายการรับ-ส่งเงินรวมตาม `docno` โดยแถวในเครื่องมาก่อน กะที่เปิดอยู่ฝั่งเซิร์ฟเวอร์ใช้แทนเฉพาะเมื่อเครื่องไม่มีกะเปิดอยู่ และปรับเลขรันเลขที่บิลให้ไม่ต่ำกว่าที่กู้ (`restore_merge.dart:30-45,108-132`)
- กู้คืนอัตโนมัติครั้งเดียวหลังเชื่อมเครื่อง เมื่อเครื่องว่างจริง (ไม่มีคิวส่ง ไม่มีกะ ไม่มีรายการเงิน) และยังไม่เคยกู้คืนสำเร็จ (`sync_engine.dart:104-108`) เหมาะกับกรณีเปลี่ยนเครื่อง/ลงแอปใหม่ด้วยรหัสเชื่อมเดิม

## ที่มาในโค้ด
- `frontend/pos/lib/providers/pos_provider.dart:429-565` บันทึกรับ-ส่งเงิน ยกเลิกบิล
- `frontend/pos/lib/ui/widgets/settings_dialog.dart:50-322,324-434` แท็บรับ-ส่งเงิน และแท็บประวัติบิล
- `frontend/pos/lib/services/sync_engine.dart:104-108,149-154,358-380` คิวรับ-ส่งเงิน และกู้คืนอัตโนมัติ
- `frontend/pos/lib/services/restore_merge.dart:30-132` รวมข้อมูลที่กู้คืน
- ดูเพิ่ม: [[sys-pos-overview]] · [[sys-pos-sync-client]] · [[sys-pos-device-pairing]] · [[sys-pos-app-config]] · [[proc-pos-config-shift]] · [[proc-pos-bill]] · [[be-pos-sync-api]]
