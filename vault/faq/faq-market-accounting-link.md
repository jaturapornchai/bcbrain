---
title: "สั่งซื้อใน Market แล้วลงบัญชีหรือตัดสต็อกไหม?"
tags: [faq, market, accounting]
aliases: ["Market ลงบัญชีไหม", "Market ตัดสต็อกไหม", "เลข INV ใน Market", "ใบกำกับภาษี Market", "Market กับระบบบัญชี", "ใบสั่งขาย Market อยู่ไหน"]
sources: ["backend/internal/adapter/inbound/http/market/handler.go:648", "backend/internal/adapter/inbound/http/market/handler.go:665", "backend/internal/adapter/inbound/http/market/handler.go:852"]
---
# สั่งซื้อใน Market แล้วลงบัญชีหรือตัดสต็อกไหม?

**ตอบสั้น:** ยังไม่ลงบัญชี และยังไม่ตัดสต็อกในระบบบัญชี การสั่งซื้อสร้างเฉพาะข้อมูลในระบบ Market คลัง ขนส่ง CRM และรายการ e-Tax

## รายละเอียด
- เลขขึ้นต้นด้วย INV ในออเดอร์เป็นเลขอ้างอิง ไม่ได้ทำให้เกิดใบกำกับภาษีขายหรือยอดลูกหนี้ในเมนูขายของระบบบัญชี
- ถ้าต้องการให้เกิดรายการขายจริงในบัญชี ต้องเปิดบิลขายในเมนูขายเองตามออเดอร์ ดู [[howto-sale-overview]]
- รายการใบกำกับภาษีอิเล็กทรอนิกส์ที่สร้างอัตโนมัติไปแสดงที่หน้า e-Tax ดู [[sys-etax-overview]]
- สินค้าที่ขายมาจากรายการสินค้าในระบบบัญชี แต่การเปลี่ยนแปลงในหน้า Market ไม่กลับไปแก้ราคาในระบบบัญชี
- เรื่องการลงบัญชีและภาษีเฉพาะกรณี ให้ปรึกษาผู้สอบบัญชี

## ดูต่อ
[[sys-market-overview]] · [[howto-market-order-products]]
