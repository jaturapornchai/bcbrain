---
title: "บันทึกเอกสารซื้อไม่ได้ ระบบให้กรอกช่องที่ยังว่าง"
tags: [troubleshoot, buy]
aliases: ["กรุณาเลือก เลขที่เอกสาร", "กรุณาป้อน สาขา", "กรุณาป้อน แผนก", "กรุณาป้อน วันที่รับ/ส่งสินค้า", "ไม่พบจำนวนสินค้า", "บันทึกไม่ได้ ช่องว่าง", "ไม่ได้เลือกรหัสเอกสาร"]
sources: ["backend/internal/application/process/trans_validate.go:170", "backend/internal/application/process/trans_validate.go:173", "backend/internal/application/process/trans_validate.go:176", "backend/internal/application/process/trans_validate.go:179", "backend/internal/application/process/trans_validate.go:189", "backend/internal/application/process/trans_validate.go:30", "backend/internal/application/process/trans_validate.go:163", "frontend/account/transaction/TransTopForm.tsx:217", "frontend/account/transaction/UniversalTransScreen.tsx:1910", "frontend/src/config/schemas/erpOption/tab4Sale.ts:303", "frontend/src/config/schemas/erpOption/tab1System.ts:102", "frontend/src/config/schemas/erpOption/tab3Item.ts:323"]
---
# บันทึกเอกสารซื้อไม่ได้ ระบบให้กรอกช่องที่ยังว่าง

**ข้อความที่เห็น:**
- "กรุณาเลือก เลขที่เอกสาร"
- "กรุณาป้อน วันที่รับ/ส่งสินค้า"
- "กรุณาป้อน สาขา"
- "กรุณาป้อน แผนก"
- "รหัส : ... ไม่พบจำนวนสินค้า"

**เกิดตอน:** กด "บันทึก" ในเอกสารซื้อ

**สาเหตุและวิธีแก้ (บอกลูกค้าได้เลย):**
1. "กรุณาเลือก เลขที่เอกสาร" เอกสารนี้ยังไม่มีรหัสเอกสาร (ปกติจะเห็นช่อง "รหัสเอกสาร:" ที่หัวเอกสาร) ให้กดปุ่ม "Auto" ข้างช่องเลขที่เอกสาร ให้ระบบรันเลขที่ตามรูปแบบเอกสาร ถ้ากดแล้วยังไม่มี แปลว่าเมนูนี้ยังไม่ได้ตั้งรูปแบบเลขที่เอกสาร ต้องให้ผู้ดูแลระบบตั้งก่อน
2. "กรุณาป้อน วันที่รับ/ส่งสินค้า" เกิดกับใบเสนอซื้อและใบสั่งซื้อเท่านั้น เมื่อเปิดข้อเลือก "ใส่วัน รับ/ส่ง สินค้าทุกครั้ง" ให้กรอกวันที่รับสินค้า
3. "กรุณาป้อน สาขา" กิจการใช้ระบบสาขาและเปิด "เตือนเมื่อไม่กำหนดสาขา" ให้เลือกสาขาของเอกสาร
4. "กรุณาป้อน แผนก" เปิด "ใช้ระบบแยกแผนก" และ "เตือนไม่บันทึกแผนก" ให้เลือกแผนก
5. "รหัส : ... ไม่พบจำนวนสินค้า" เปิด "ใส่จำนวนสินค้าทุกครั้ง" แต่มีบรรทัดที่มีรหัสสินค้าแต่จำนวนเป็น 0 ให้ใส่จำนวน หรือลบบรรทัดนั้น

**ถ้ากิจการไม่ต้องการให้บังคับ:** ผู้ดูแลระบบปิดข้อเลือกที่เกี่ยวข้องได้ ([[howto-buy-options]])

**ส่งต่อเจ้าหน้าที่เมื่อ:** กรอกครบทุกช่องแล้วแต่ยังแจ้งข้อความเดิม หรือกด "Auto" แล้วยังไม่มีรหัสเอกสาร และลูกค้าไม่มีสิทธิ์ตั้งรูปแบบเลขที่เอกสาร

## ดูต่อ
- [[howto-buy-options]]
- [[start-first-day]]
- [[howto-buy-overview]]
