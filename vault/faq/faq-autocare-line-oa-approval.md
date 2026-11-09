---
title: "ส่งลิงก์ให้ลูกค้าอนุมัติซ่อมทาง LINE ได้จริงไหม"
tags: [faq, autocare, line]
aliases: ["LINE OA ใช้ได้จริงไหม", "ลูกค้ากดอนุมัติใน LINE", "ส่งข้อความหาลูกค้าอัตโนมัติ", "อนุมัติซ่อมผ่านไลน์", "ส่งใบเสนอราคา LINE", "ลิงก์อนุมัติซ่อม"]
sources: ["backend/internal/adapter/inbound/http/autocare/handler.go:1111", "backend/internal/adapter/inbound/http/autocare/handler.go:1167", "frontend/autocare/AutoCareScreenContent.tsx:2605"]
---
# ส่งลิงก์ให้ลูกค้าอนุมัติซ่อมทาง LINE ได้จริงไหม

**คำตอบสั้น:** ยังไม่ได้ ตอนนี้ปุ่มเป็นตัวจำลอง **ไม่มีข้อความถูกส่งหาลูกค้า**

- ปุ่ม "ส่งลิงก์อนุมัติซ่อมเข้า LINE ลูกค้า" แค่เพิ่มรายการเสนอซ่อม (ผ้าเบรกหน้าราคาตัวอย่าง) ในใบงาน
- ปุ่ม "ลูกค้าอนุมัติ LINE OA & ขึ้นฮอยท์" พนักงานเป็นคนกดแทนเมื่อลูกค้าตอบทางอื่น
- ต้องติดต่อลูกค้าเอง (โทร แชต หรือหน้าร้าน) แล้วค่อยกดอนุมัติ

วิธีทำ: [[howto-autocare-estimate-approve]] · ข้อจำกัดอื่น [[sys-autocare-demo-data-limits]]
