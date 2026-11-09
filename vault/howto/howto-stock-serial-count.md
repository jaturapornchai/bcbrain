---
title: "ตรวจนับสินค้าด้วย Serial Number และตรวจหา Serial มีปัญหา"
tags: [howto, stock]
aliases: ["นับสต็อกด้วยการยิงซีเรียล", "ตรวจนับ Serial", "ยิง Serial นับของ", "ซีเรียลผิดปกติ", "ตรวจสอบ Serial มีปัญหา", "หาซีเรียลที่ออกก่อนรับ", "ตรวจสอบสินค้า Serial Number"]
sources: ["frontend/account/master/SerialStockCountScreen.tsx:277", "backend/internal/application/process/stock_tools.go:354", "backend/internal/application/process/stock_tools.go:411", "backend/internal/application/process/stock_tools.go:187", "frontend/account/master/StockCheckScreens.tsx:31", "frontend/account/master/SerialStockCountScreen.tsx:98", "frontend/account/master/SerialStockCountScreen.tsx:253", "frontend/account/master/SerialStockCountScreen.tsx:281"]
---
# ตรวจนับสินค้าด้วย Serial Number และตรวจหา Serial มีปัญหา

**ใช้เมื่อ:** สินค้ามี Serial Number (มือถือ เครื่องใช้ไฟฟ้า) อยากนับด้วยการยิงบาร์โค้ด Serial หรือหา Serial ที่ประวัติผิดปกติ
**เมนู:** สินค้า › ตรวจนับสต็อกและปรับปรุงจากการตรวจนับ › ตรวจสอบสินค้า Serial Number / สินค้า › สอบถามและวิเคราะห์ข้อมูลสินค้า (บนหน้าจอ) › ตรวจสอบ Serial มีปัญหา
**ต้องมีก่อน:** Serial อยู่ในทะเบียน Serial Number แล้ว ([[howto-stock-serial]])

## ขั้นตอน (ตรวจนับด้วย Serial)
1. กด เพิ่มใหม่ เลือก คลัง และ ที่เก็บ ที่กำลังนับ
2. ยิงหรือพิมพ์ Serial ในช่อง Serial Number : แล้วกด Enter หรือปุ่ม เพิ่ม Serial ทีละตัว (ติ๊ก Auto Focus ให้เคอร์เซอร์กลับช่องเดิมเอง) ยิงผิดกด ลบรายการล่าสุด
3. ตรวจรายการในตาราง แล้วกด บันทึก
4. ไปปรับยอดต่อที่ [[howto-stock-count-auto-adjust]]

## ขั้นตอน (ตรวจสอบ Serial มีปัญหา)
1. ใส่รหัสสินค้า (เว้นว่าง = ทุกสินค้า) แล้วกด วิเคราะห์
2. ระบบแสดง Serial ที่มีปัญหา พร้อม ปัญหาที่พบ และ เลขที่เอกสารที่ผิด

## ช่องสำคัญที่ต้องกรอก
| ช่อง | กรอกอะไร | หมายเหตุ |
|---|---|---|
| คลัง / ที่เก็บ | จุดที่นับ | ต้องเลือก |
| Serial Number | ยิงทีละตัว | ห้ามซ้ำ สูงสุด 5000 ตัวต่อใบ |
| เลขที่เอกสาร | กรอกเองไม่ได้ | ระบบออกเลขให้เมื่อบันทึก |

## บันทึกแล้วระบบทำอะไรให้
- สร้าง ใบตรวจนับสินค้า 1 ใบ รวม Serial เป็น 1 แถวต่อสินค้า จำนวน = จำนวน Serial ที่ยิง
- ใบตรวจนับไม่เปลี่ยนยอดสต็อก ต้องประมวลผลปรับปรุงต่อ ([[faq-stock-count-change-stock]])
- หน้าจอตรวจ Serial มีปัญหา อ่านอย่างเดียว ไม่แก้ข้อมูล หาปัญหา 2 แบบ:
  - "ออกก่อนรับเข้า (ไม่มีรายการรับเข้ามาก่อน)" = ขายหรือเบิก Serial นี้โดยไม่เคยรับเข้า
  - "รายการออกจากคลัง/ที่เก็บ .../... ไม่ตรงกับรายการรับเข้าล่าสุด .../..." = ตัดออกผิดคลังหรือผิดที่เก็บ

## แก้ไข ยกเลิก พิมพ์
- ใบตรวจนับที่ได้ แก้ไขหรือลบได้ที่เมนู ตรวจนับสินค้า ([[howto-stock-count]])
- Serial ที่มีปัญหา ให้เปิดเอกสารตามเลขที่ที่ระบบแจ้งแล้วแก้คลัง/ที่เก็บหรือ Serial ให้ถูก

## ปัญหาที่พบบ่อย
- "ไม่พบ Serial Number ... ในทะเบียน Serial" → ([[ts-stock-serial-errors]])
- "มีการป้อน Serial Number ... ไปแล้ว" หรือ "มีการป้อน Serial Number ... ซ้ำ" → ([[ts-stock-serial-errors]])
- "กรุณาเลือกคลังและที่เก็บ" → เลือกคลังและที่เก็บก่อน
- "ยังไม่มี Serial Number ในรายการ" → ยิง Serial อย่างน้อย 1 ตัว

## ดูต่อ
- [[howto-stock-serial]] · [[howto-stock-count-auto-adjust]] · [[howto-stock-overview]]
