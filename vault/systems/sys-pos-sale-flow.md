---
title: "ขั้นตอนขายสินค้าที่จอแคชเชียร์ ตั้งแต่ยิงบาร์โค้ดถึงปิดบิล (sys-pos-sale-flow)"
tags: [systems, pos, sale, cart, barcode, hold-bill]
aliases: ["ขายหน้าร้าน", "ตะกร้า POS", "ยิงบาร์โค้ด", "พักบิล", "เรียกบิลพัก", "ส่วนลดท้ายบิล", "คูปอง POS", "ลูกค้าชั่วคราว", "เลขที่บิล POS", "doc_format"]
sources: ["frontend/pos/lib/providers/pos_provider.dart:586", "frontend/pos/lib/providers/pos_provider.dart:676", "frontend/pos/lib/providers/pos_provider.dart:739", "frontend/pos/lib/providers/pos_provider.dart:578", "frontend/pos/lib/providers/pos_provider.dart:956", "frontend/pos/lib/providers/pos_provider.dart:1005", "frontend/pos/lib/providers/pos_provider.dart:971", "frontend/pos/lib/providers/pos_provider.dart:1030", "frontend/pos/lib/providers/pos_provider.dart:404", "frontend/pos/lib/providers/pos_provider.dart:639", "frontend/pos/lib/providers/pos_provider.dart:1097", "frontend/pos/lib/services/doc_number.dart:10", "frontend/pos/lib/services/doc_number.dart:31", "frontend/pos/lib/models/pos_bill.dart:98", "frontend/pos/lib/models/customer.dart:81", "frontend/pos/lib/ui/widgets/cart_panel.dart:1396", "frontend/pos/lib/ui/widgets/discount_dialog.dart:155", "frontend/pos/lib/ui/widgets/customer_selector_dialog.dart:123", "frontend/pos/lib/ui/widgets/hold_bills_dialog.dart:122"]
---
# ขั้นตอนขายสินค้าที่จอแคชเชียร์

อธิบายสิ่งที่แคชเชียร์ทำบนแอป Flutter ตั้งแต่เริ่มบิลใหม่จนปิดบิล ส่วนการชำระเงินอยู่ใน [[sys-pos-payment-types]] ใบเสร็จใน [[sys-pos-receipt-printing]] และสิ่งที่เซิร์ฟเวอร์ทำกับบิลหลังรับ อยู่ใน [[proc-pos-bill]] ภาพรวมดู [[sys-pos-overview]]

## 1) บิลใหม่
ทุกครั้งที่เริ่มบิลใหม่ แอปสร้าง `bill_guid` (uuid) ให้บิล กำหนดลูกค้าเป็นเงินสดทั่วไป (`CASH`) ใช้ประเภท/อัตราภาษีจากค่าเครื่อง และ "ดูเลขที่บิลถัดไป" ล่วงหน้าแสดงบนหัวบิล (`pos_provider.dart:586-601`)

**เลขที่บิล** มาจากรูปแบบ `doc_format` ที่เซิร์ฟเวอร์ส่งมากับค่าเครื่อง เช่น `ABB1-@YY@MM-#####`: `@YY` `@MM` `@DD` แทนปี (2 หลัก) เดือน วัน ส่วน `#` ติดท้ายสุดคือเลขรัน เลขถัดไป = ค่ามากสุดระหว่างเลขล่าสุดที่เครื่องนี้เคยใช้ กับเลขล่าสุดที่เซิร์ฟเวอร์รู้ (`last_doc_no`) บวกหนึ่ง ถ้ารูปแบบว่างหรือไม่มี `#` ท้ายสุด จะ **ออกบิลไม่ได้** (`doc_number.dart:10-35`, `pos_provider.dart:578-584`)

## 2) ใส่สินค้า
| วิธี | พฤติกรรม |
|---|---|
| ยิง/พิมพ์บาร์โค้ด | ตัดช่องว่าง ถ้ามี `*` หรือ `x` เช่น `3*8851234` ถือว่าจำนวน 3 ชิ้น ค้นหาจากฐานข้อมูลในเครื่องก่อน ไม่พบค่อยหาในรายการที่โหลดไว้ทั้งจากบาร์โค้ดและรหัสสินค้า ไม่พบแจ้ง "ไม่พบสินค้าบาร์โค้ด" (`pos_provider.dart:739-782`) |
| แตะการ์ดสินค้า / ค้นหาชื่อ-รหัส-บาร์โค้ด | เลือกจากหมวดหรือรายการค้นหาแล้วเพิ่มเข้าตะกร้า (`pos_provider.dart:194-204`, `product_catalog_view.dart:12`) |
| แป้นตัวเลข | โหมด จำนวน / ราคา / ส่วนลด / บาร์โค้ด ใช้กับรายการที่เลือกในตะกร้า (`pos_provider.dart:1030-1095`) |

เมื่อเพิ่มสินค้า: ถ้ามีรหัส+หน่วยเดียวกันในตะกร้าแล้ว จะบวกจำนวนเพิ่ม ไม่เช่นนั้นเพิ่มบรรทัดใหม่ **ราคาที่ใช้**: ถ้าเครื่องตั้งระดับราคา 2 และสินค้ามีราคาส่ง → ราคาส่ง; ถ้าลูกค้าเป็นสมาชิกและมีราคาสมาชิกที่ต่ำกว่าราคาปกติ → ราคาสมาชิก; นอกนั้นราคาปกติ (`pos_provider.dart:676-700`) แต่ละครั้งที่เพิ่มจะบันทึกลงบันทึกการทำงานในเครื่อง คำนวณโปรโมชั่นใหม่ และมีเสียงยิงสแกน (`:701-737`)

แก้ไขบรรทัด: เปลี่ยนจำนวน ราคา หมายเหตุ ส่วนลดรายการ หรือลบ — การแก้ราคาและส่วนลดทำได้เฉพาะเมื่อค่าเครื่องอนุญาต (`allowChangePrice`, `allowChangeDiscount`) ถ้าไม่ได้แจ้ง "ไม่อนุญาตให้..." (`pos_provider.dart:874-947,971-1003,1030-1045`)

## 3) ลูกค้า/สมาชิก
- เปิดหน้าเลือกลูกค้า ค้นด้วยชื่อ เบอร์โทร หรือรหัส จากสมาชิกที่ซิงก์มาในเครื่อง (`customer_selector_dialog.dart:189,383`)
- ถ้าไม่พบ ใช้ "ลูกค้าชั่วคราว (Temp)" ได้ทันที: กรอกเบอร์โทร (จำเป็น) ชื่อไม่บังคับ แอปสร้างรหัสรูปแบบ `TEMP-<เบอร์>` เก็บในเครื่อง และขายต่อได้ทันทีแม้ออฟไลน์ (`customer_selector_dialog.dart:123-170`, `customer.dart:81-102`, `pos_provider.dart:639-663`)
- ลูกค้าชั่วคราวไม่ถูกส่งเป็นรหัสลูกค้าในบิล (ส่งว่าง) แต่เบอร์โทรถูกใส่ในหมายเหตุบิล และรายชื่อถูกอัปโหลดให้เซิร์ฟเวอร์ลงทะเบียนครั้งเดียวต่อรหัส (`pos_provider.dart:1155-1170`, `sync_engine.dart:383-397`)
- การเลือกลูกค้าทำให้คำนวณโปรโมชั่นใหม่ เพราะบางโปรโมชั่นจำกัดเฉพาะสมาชิก ดู [[sys-pos-promotion-engine]]

## 4) ส่วนลด
หน้าต่างส่วนลดมี 3 แท็บ: ส่วนลดท้ายบิล ส่วนลดเฉพาะรายการ และคูปอง (`discount_dialog.dart:155-157`)
- ส่วนลดใส่เป็นจำนวนเงิน หรือเปอร์เซ็นต์ (ลงท้ายด้วย `%`) ส่วนลดท้ายบิลไม่เกินยอดรวมรายการ (`pos_bill.dart:98-120`)
- **คูปอง**: พิมพ์หรือสแกนรหัส แอปค้นในคูปองที่ซิงก์ไว้ ต้องยังไม่ถูกใช้ ยอดคงเหลือมากกว่าศูนย์ และไม่หมดอายุ แล้วตั้งยอดคูปองเป็นส่วนลดท้ายบิลทันที (`pos_provider.dart:404-427`)

## 5) พักบิลและเรียกกลับ
- ปุ่ม "พักบิล": ถ้าบิลมีรายการ จะถามเหตุผล/ชื่อลูกค้า/หมายเหตุ แล้วเก็บบิลลงฐานข้อมูลในเครื่อง เริ่มบิลใหม่ทันที (`pos_provider.dart:956-969`, `hold_bills_dialog.dart:122`)
- ถ้าบิลว่างแต่มีบิลพัก ปุ่มเดิมเปิดรายการบิลพักให้เรียกกลับหรือลบ; ถ้าเรียกกลับขณะบิลปัจจุบันมีรายการ บิลปัจจุบันจะถูกพักไว้แทนอัตโนมัติ (`pos_provider.dart:1005-1028`, `cart_panel.dart:1160-1172`)
- บิลพักอยู่ในเครื่อง ไม่ถูกส่งขึ้นเซิร์ฟเวอร์ ([[sys-pos-offline-storage]])

## 6) ปิดบิล
ปุ่มใหญ่สีเขียว "ชำระเงิน" เปิดหน้าต่างชำระเงินแท็บเงินสด (ปุ่มด่วน QR และบัตร เปิดแท็บของตัวเอง; ปุ่มกดไม่ได้ถ้าบิลไม่มีรายการ, `cart_panel.dart:804-835,890-952`) ดู [[sys-pos-payment-types]] เมื่อกดยืนยัน `processPayment`: กันกดซ้ำ → ตรวจว่ามีเลขที่บิล → ตั้งเลขที่ วันที่ การชำระ → บันทึกบิลลงคิวรอส่งในเครื่อง พร้อมเก็บเนื้อหาที่จะส่ง (freeze) → สั่งซิงก์เบื้องหลัง แคชเชียร์ขายบิลถัดไปได้ทันทีแม้ออฟไลน์ (`pos_provider.dart:1097-1153`) รายละเอียดการส่งอยู่ใน [[sys-pos-sync-client]]

เนื้อหาบิลที่ส่ง (`POST /api/pos/bills`): `bill_guid`, `doc_no`, `doc_date`, `doc_time`, `cashier_code`, `cust_code`, `bill_discount`, `coupon_code`, `coupon_amount`, `points_redeemed` (ส่ง 0 เสมอ), `remark`, รายการสินค้า (`lines`) และการชำระ (`payments`) ตัวเลขเงินเป็นข้อความทศนิยม 2 ตำแหน่ง จำนวนเป็นข้อความ (`pos_provider.dart:1155-1197`)

## ข้อจำกัดที่ควรรู้
- "ช่องทางขาย" และ "พนักงานขาย" ที่เลือกในจอเป็นรายการตายตัวในแอป (5 ช่องทาง และพนักงาน 4 รหัสรูปแบบ `EMP01-04`) และ **ไม่ถูกส่งไปกับบิล** ใช้แสดงในจอเท่านั้น (`cart_panel.dart:1396-1403,1438-1444`, ไม่มีฟิลด์นี้ใน `pos_provider.dart:1155-1190`) รหัสแคชเชียร์ที่ส่งจริงคือ `cashierCode` ในค่าเครื่อง (ค่าเริ่มต้น `EMP-001`, `app_config.dart:38,104`) ซึ่งไม่ได้มาจากรายการพนักงานขายในจอ
- การคำนวณยอดในแอปใช้ตัวเลขทศนิยมแบบ `double` ส่วนที่ส่งเป็นข้อความ 2 ตำแหน่ง ดู [[sys-pos-known-limits]]

## ที่มาในโค้ด
- `frontend/pos/lib/providers/pos_provider.dart:578-601,676-782,956-1028,1097-1197` ขั้นตอนหลักของการขาย
- `frontend/pos/lib/services/doc_number.dart:10-37` รูปแบบเลขที่บิล
- `frontend/pos/lib/models/pos_bill.dart:98-127` ส่วนลดท้ายบิล, `customer.dart:81-102` ลูกค้าชั่วคราว
- `frontend/pos/lib/ui/widgets/discount_dialog.dart`, `customer_selector_dialog.dart`, `hold_bills_dialog.dart` หน้าต่างย่อย
- ดูเพิ่ม: [[sys-pos-overview]] · [[sys-pos-app-structure]] · [[proc-pos-bill]] · [[faq-pos-bill-to-account]] · [[api-pos]]
