---
title: "ขายสินค้า (ใบกำกับ 44) แล้วลงบัญชี GL อะไรบ้าง"
tags: [faq, gl, sale, ar, vat]
aliases: ["ขายเชื่อลงบัญชียังไง", "ขายสด GL", "sale invoice journal", "trans_flag 44", "trans_flag 144", "menu_so_invoice", "Dr ลูกหนี้ Cr ขาย", "ภาษีขาย 2134"]
sources: ["backend/internal/application/process/service.go:1574", "backend/internal/application/process/service.go:1785", "backend/internal/application/process/service.go:1998", "backend/internal/application/process/service.go:2001", "backend/internal/application/process/service.go:1755", "backend/internal/application/process/gl_template_defaults.go:86"]
---
# ขายสินค้า (ใบกำกับ 44) แล้วลงบัญชี GL อะไรบ้าง

**ตอบสั้น:** ขายเชื่อ = Dr ลูกหนี้ / Cr ขาย (ก่อน VAT) / Cr ภาษีขาย ขายสด = Dr เงินสด-ธนาคาร-บัตรตามแท็บชำระเงินแทนลูกหนี้ ถ้ารหัสเอกสารมีรูปแบบ GL ระบบใช้รูปแบบนั้นก่อน

## รายละเอียด
บันทึกใบขายทุกครั้ง ระบบลบ GL อัตโนมัติเดิมแล้วสร้างใหม่ ([[acc-gl-rebuild]]) โดยลองรูปแบบ GL ก่อน (SI/SIP = glRule55, ดู [[faq-gl-template-doc-format]]) ไม่มีจึงใช้เส้นมาตรฐาน ([[acc-gl-posting-standard]])

เส้นมาตรฐานของ 44/144 (กลุ่มเดียวกับ 46, 50, 250, 254):
- total, vat ปัด HALF_UP 2 ตำแหน่ง, base = total − vat
- **ขายสด** = 44/144 ที่ `inquiry_type` 1 หรือ 3 ([[term-inquiry-type]]) อ่าน `cb_trans` แยก Dr เงินสด / ธนาคาร (โอน+wallet) / บัตร เมื่อยอดรวมตรงยอดเงิน ไม่ตรงใช้ชุดรายการชำระเงินแทน ([[acc-payment-tab]])
- **ขายเชื่อ** = Dr ลูกหนี้ เต็ม total
- **มัดจำที่ตัดใช้** = Dr มัดจำขาย 214220 (ยอดก่อน VAT) และบวกเข้า Cr ขาย ([[acc-deposit-advance]])
- Cr ขาย = base + มัดจำ, Cr ภาษีขาย = vat

บัญชีตั้งต้น (ใช้รหัสแรกที่มีในผัง): เงินสด 1111/1110/1100, ธนาคาร 1112/1113/1111 หรือ `erp_pass_book` ของสมุดบัญชี, ลูกหนี้ 1121/1131/1130/1120, ขาย 4111/4110/4100, ภาษีขาย 2134/2121/2135/2190

## ข้อควรระวัง
- เส้นมาตรฐานไม่มีบรรทัด **ต้นทุนขาย** ต้นทุนขายมาจากรูปแบบ GL action 101/103 (`sum_of_cost`) เท่านั้น และตอนดึงค่าเริ่มต้นรูปแบบ ถ้า `erp_option.inventory_gl_post` = 0 ระบบตัดแถว 101/103 ทิ้ง
- ถ้าไม่พบรหัสใดในผังเลย `resolveChartAccount` คืนรหัสแรกของลิสต์ ทั้งที่ไม่มีในผัง (ไม่ได้ตกบัญชีพัก 9999)
- ลิสต์ลูกหนี้มี 1131/1130 ซึ่งซ้ำกับลิสต์บัญชีสินค้าคงเหลือ และยอดบัตรของขายสดลง Dr บัญชีลูกหนี้

## ดูเพิ่ม
- [[doc-sale-invoice]]
- [[faq-sale-return-credit-note-gl]]
- [[faq-ar-receipt-ap-payment-gl]]
- [[faq-gl-not-balanced]]
- [[flow-order-to-cash]]

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:1574` ลองรูปแบบ GL (`tpl.post`) ก่อน
- `backend/internal/application/process/service.go:1785` รหัสบัญชีตั้งต้น
- `backend/internal/application/process/service.go:1998` case ขาย 44/46/50/144/250/254
- `backend/internal/application/process/service.go:2001` ขายสด inquiry 1/3 และแยก cb_trans
- `backend/internal/application/process/service.go:1755` `resolveChartAccount`
- `backend/internal/application/process/gl_template_defaults.go:86` ตัด action 101/103
