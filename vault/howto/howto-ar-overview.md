---
title: "ระบบลูกหนี้ ใช้ทำอะไรได้บ้าง (แผนที่เมนูลูกหนี้ และคู่มือทั้งหมด)"
tags: [howto, ar, hub]
aliases: ["เมนูลูกหนี้", "ระบบลูกหนี้", "ภาพรวมระบบลูกหนี้", "คู่มือลูกหนี้", "เก็บเงินลูกค้า", "ขั้นตอนเก็บหนี้"]
sources: ["backend/internal/application/process/bcMenu.json:6771", "backend/internal/application/process/bcMenu.json:7058", "backend/internal/application/process/bcMenu.json:7133", "backend/internal/application/process/bcMenu.json:813", "frontend/account/transaction/transLayouts.ts:118", "frontend/account/transaction/transLayouts.ts:119", "backend/internal/application/process/docs.go:600", "backend/internal/application/process/doc_cancel.go:60"]
---

# ระบบลูกหนี้ ใช้ทำอะไรได้บ้าง

**ใช้เมื่อ:** ลูกค้าถามเรื่องทะเบียนลูกค้า หนี้ค้าง วางบิล รับชำระ หรือไม่รู้ว่าเรื่องที่ถามอยู่คู่มือไหน (ลูกหนี้ = ลูกค้าที่ยังค้างจ่ายเงินร้าน)
**เมนู:** ลูกหนี้ (และ เริ่มต้น › ตั้งค่าระบบลูกหนี้)
**ต้องมีก่อน:** ตั้งค่าระบบลูกหนี้ ([[howto-ar-setup]]) ถ้าต้องการจัดกลุ่มลูกค้า

## ขั้นตอนเก็บเงินที่พบบ่อย
1. หนี้เกิดจาก ใบขายเงินเชื่อ ([[howto-sale-invoice]]) ตั้งหนี้อื่นๆ ([[howto-ar-other-debt]]) หรือตั้งหนี้ยกมา ([[howto-ar-opening-balance]])
2. ใบวางบิล (ถ้าร้านใช้) → [[howto-ar-billing]]
3. รับชำระหนี้/ออกใบเสร็จรับเงิน → [[howto-ar-receipt]]

## แผนที่เมนูลูกหนี้
| เมนู | คู่มือ |
|---|---|
| ทะเบียนลูกหนี้ สมาชิก และแต้มสะสม › กำหนดลูกหนี้ / รายละเอียดลูกหนี้ | [[howto-ar-customer-register]] |
| › รายละเอียดสมาชิก / กำหนดแต้มคงเหลือยกมา / แต้มสะสม / บันทึกตัดแต้ม | [[howto-ar-member-points]] |
| › ที่อยู่จัดส่งสินค้า / พิมพ์ที่อยู่จัดส่งสินค้า / นำเข้าที่อยู่จัดส่งลูกหนี้ | [[howto-ar-shipping-address]] |
| ตั้งหนี้ยกมา / เพิ่มหนี้ยกมา / ลดหนี้ยกมา (ลูกหนี้) | [[howto-ar-opening-balance]] |
| ตั้งหนี้อื่นๆ / เพิ่มหนี้อื่นๆ / ลดหนี้อื่นๆ (ลูกหนี้) | [[howto-ar-other-debt]] |
| ใบวางบิล (ลูกหนี้) | [[howto-ar-billing]] |
| รับชำระหนี้/ออกใบเสร็จรับเงิน | [[howto-ar-receipt]] |
| บันทึกรูปภาพและไฟล์แนบเอกสารลูกหนี้ | [[howto-sale-attach-file]] |
| ยกเลิกเอกสารลูกหนี้ (ตั้งหนี้อื่น/วางบิล/รับชำระ) | [[howto-ar-cancel-docs]] |
| รายงานทะเบียนลูกหนี้ ยอดยกมา และตั้งหนี้อื่นๆ | [[rpt-ar-master-opening]] |
| รายงานใบวางบิลและการรับชำระหนี้ | [[rpt-ar-bill-receipt]] |
| รายงานสรุปยอดค้างชำระและวงเงินลูกหนี้ | [[rpt-ar-outstanding-credit]] |
| รายงานวิเคราะห์อายุหนี้และเคลื่อนไหวลูกหนี้ | [[rpt-ar-aging]] |
| รายงานเอกสารยกเลิก (ระบบลูกหนี้) | [[rpt-ar-cancel-docs]] |
| รายงานอื่น ๆ และภาพรวมรายงานทั้งหมด | [[rpt-overview]] |
| เริ่มต้น › ตั้งค่าระบบลูกหนี้ | [[howto-ar-setup]] |

## คู่มือที่เกี่ยวข้องจากระบบขาย
- ตั้งวงเงินเครดิตลูกค้า → [[howto-sale-credit-limit]]
- ขายสดรับเงินในบิล → [[howto-sale-cash-payment]]
- รับเงินล่วงหน้า / เงินมัดจำ → [[howto-sale-advance-receipt]], [[howto-sale-deposit-receipt]]
- รับเงินเข้าธนาคาร เช็ครับ → [[howto-cash-bank-overview]]

## ปัญหาที่พบบ่อย
- บันทึกหรือลบลูกหนี้ไม่ได้ → [[ts-ar-customer-save-error]]
- ดึงเอกสารค้างชำระแล้วไม่มีบิล → [[ts-ar-no-outstanding]]
- ห้ามวางบิลซ้ำ → [[ts-ar-billing-duplicate]]
- ป้อนยอดชำระเกิน → [[ts-ar-pay-over-balance]]
- ยอดรับเงินไม่ครบ → [[ts-sale-payment-incomplete]]
- เกินวงเงินเครดิต → [[ts-sale-credit-over]]
- ลูกค้าถูกปิดสถานะเครดิต → [[ts-sale-credit-closed]]
- ลูกค้าปิดการใช้งาน → [[ts-sale-customer-inactive]]
- ยกเลิกไม่ได้เพราะมีเอกสารอ้างอิง → [[ts-sale-cannot-cancel]]
- งวดบัญชีปิดแล้ว → [[ts-common-period-closed]]
- ไม่มีสิทธิ์ → [[ts-common-no-permission]]

## คำถามที่พบบ่อย
- ต้องวางบิลก่อนรับเงินไหม → [[faq-ar-billing-needed]]
- ลูกค้าจ่ายไม่ครบ หรือจ่ายเกิน → [[faq-ar-partial-payment]]
- วันครบกำหนดชำระคิดอย่างไร → [[faq-ar-credit-days]]
- ห้ามขายลูกค้าที่ค้างเกินกำหนดได้ไหม → [[faq-sale-overdue-check]]
- รับชำระหนี้แล้วลงบัญชีอะไร → [[faq-sale-gl-posting]]

## ดูต่อ
- [[howto-sale-overview]]
- [[howto-doc-edit-cancel-delete]]
- [[sys-account-overview]]
- [[index]]
