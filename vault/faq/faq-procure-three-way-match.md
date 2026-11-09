---
title: "3-Way Match คืออะไร ระบบตรวจอะไรบ้าง?"
tags: [faq, procure]
aliases: ["3-Way Matching คืออะไร", "ตรวจสามฝั่ง", "PO ตรงกับของที่รับและใบกำกับภาษี", "2-Way Match"]
sources: ["backend/internal/adapter/inbound/http/procure/handler.go:1320", "backend/internal/adapter/inbound/http/procure/handler.go:1327", "frontend/procure/ProcureDashboard.tsx:269"]
---
# 3-Way Match คืออะไร?

**ตอบสั้น:** คือการตรวจให้ 3 อย่างตรงกัน: ใบสั่งซื้อ (PO) = ของที่รับเข้าคลัง = ใบกำกับภาษีซื้อของผู้ขาย ก่อนจ่ายเงินผู้ขาย

## รายละเอียด
- 2-Way Match: PO ตรงกับของที่รับเข้าคลัง (รอใบกำกับภาษี)
- 3-Way Match: ครบทั้ง 3 ฝั่ง
- สถานะบนจอ: "อนุมัติ PO แล้ว · รอซัพพลายเออร์ส่งของเข้าคลัง" → "2-Way Match · รับเข้าคลัง WMS แล้ว รอตรวจบิลภาษี" → "3-Way Match ครบ 100% (PO = WMS = e-Tax)"
- ในระบบนี้ การกดสถานะแต่ละขั้นเป็นการยืนยันด้วยมือ ระบบไม่ได้เทียบตัวเลขจากเอกสารจริงให้เอง และถือว่าจำนวนรับและจำนวนในใบกำกับเท่ากับจำนวนที่สั่งเสมอ
- ไม่มีช่องให้กรอกเลขใบกำกับภาษีซื้อของผู้ขาย ระบบสร้างเลขอ้างอิงเองจึงไม่ได้เทียบกับเลขในใบจริง
- ผู้ใช้ต้องตรวจเอกสารจริงเอง ([[howto-procure-receive-and-match]])

## ดูต่อ
[[faq-procure-links-wms-etax]] · [[sys-procure-overview]]
