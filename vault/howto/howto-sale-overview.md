---
title: "ระบบขาย ใช้ทำอะไรได้บ้าง (แผนที่เมนูขาย และคู่มือทั้งหมด)"
tags: [howto, sale, hub]
aliases: ["เมนูขาย", "ระบบขาย", "ภาพรวมระบบขาย", "ขายของในระบบ", "คู่มือระบบขาย", "ขั้นตอนการขาย"]
sources: ["frontend/src/config/bcMenu.json:4934", "frontend/account/transaction/transLayouts.ts:25", "backend/internal/application/process/doc_flow.go:104", "backend/internal/application/process/service.go:2033"]
---

# ระบบขาย ใช้ทำอะไรได้บ้าง

**ใช้เมื่อ:** ลูกค้าถามว่าเมนูขายมีอะไร หรือไม่รู้ว่าเรื่องที่ถามอยู่คู่มือไหน
**เมนู:** ขาย (และ เริ่มต้น › ตั้งค่าระบบขายและ POS)
**ต้องมีก่อน:** ทะเบียนลูกค้า ([[howto-ar-customer-register]]) และสินค้า ([[howto-stock-overview]])

## ขั้นตอนการขายที่พบบ่อย
1. ใบเสนอราคาขาย (ถ้ามี) → [[howto-sale-quotation]]
2. ใบสั่งจองสินค้า / ใบสั่งขายสินค้า (ถ้ามี) → [[howto-sale-order]]
3. ขายสินค้า/บริการ (เปิดบิล ออกใบกำกับภาษี) → [[howto-sale-invoice]] ดึงใบก่อนหน้ามาต่อได้ → [[howto-sale-pull-ref-doc]]
4. ขายสดรับเงินในบิล → [[howto-sale-cash-payment]] / ขายเชื่อ → ไปวางบิลและรับชำระที่ระบบลูกหนี้ ([[howto-ar-overview]])

## แผนที่เมนูขาย
| เมนู | คู่มือ |
|---|---|
| ใบเสนอราคาขาย / อนุมัติใบเสนอราคาขาย | [[howto-sale-quotation]] |
| ใบสั่งจองสินค้า / ใบสั่งขายสินค้า และอนุมัติ | [[howto-sale-order]] |
| รับเงินล่วงหน้ายกมา / รับเงินล่วงหน้า / คืนเงินรับล่วงหน้า | [[howto-sale-advance-receipt]] |
| รับเงินมัดจำยกมา / รับเงินมัดจำ / คืนเงินมัดจำ | [[howto-sale-deposit-receipt]] |
| ขายสินค้า/บริการ | [[howto-sale-invoice]] |
| รับคืนสินค้า/ลดหนี้ขาย | [[howto-sale-credit-note]] |
| เพิ่มหนี้ขาย/ราคาผิด | [[howto-sale-debit-note]] |
| บันทึกรูปภาพและไฟล์แนบเอกสารขาย | [[howto-sale-attach-file]] |
| ยกเลิกเอกสารขายและเงินมัดจำรับ | [[howto-sale-cancel-docs]] |
| ระบบขายหน้าร้าน POS | [[sys-pos-overview]] |
| ส่งข้อมูล e-Tax | [[sys-etax-overview]] |
| รายงานขาย | [[rpt-overview]] |
| เริ่มต้น › ตั้งค่าระบบขายและ POS (เขตการขาย รายได้อื่นๆ) และข้อเลือกแท็บ "4.ระบบขาย" | [[howto-sale-settings]] |

## คู่มือการทำงานในบิล
- ส่วนลดต่อรายการและท้ายบิล → [[howto-sale-discount]]
- หักเงินมัดจำในใบขาย → [[howto-sale-deduct-deposit]]
- ตั้งวงเงินเครดิตลูกค้า → [[howto-sale-credit-limit]]
- แก้ไขหรือลบเอกสารที่บันทึกแล้ว → [[howto-sale-edit-delete]]

## ปัญหาที่พบบ่อย
- บันทึกไม่ได้ ขาดข้อมูล → [[ts-sale-required-fields]]
- ไม่พบสินค้า / สินค้าเลิกขาย → [[ts-sale-item-not-found]]
- ไม่พบราคา → [[ts-sale-price-not-found]]
- ราคาต่ำกว่าทุน → [[ts-sale-low-cost]]
- สต็อกไม่พอ ห้ามติดลบ → [[ts-sale-stock-negative]]
- ลูกค้าปิดการใช้งาน → [[ts-sale-customer-inactive]]
- เกินวงเงินเครดิต (ใบขาย) → [[ts-sale-credit-over]]
- เกินวงเงินเครดิต (ใบสั่งจอง/ใบสั่งขาย) → [[ts-sale-order-credit-over]]
- ลูกค้าถูกปิดสถานะเครดิต → [[ts-sale-credit-closed]]
- ยอดรับเงินไม่ครบ → [[ts-sale-payment-incomplete]]
- หักมัดจำเกิน → [[ts-sale-deposit-over]]
- ดึงเอกสารไม่เจอ → [[ts-sale-ref-doc-not-found]]
- จำนวนเกินเอกสารอ้างอิง → [[ts-sale-qty-over-ref]]
- รับคืนเกินจำนวน/มูลค่า → [[ts-sale-return-over]]
- แก้หรือลบไม่ได้ → [[ts-sale-cannot-edit]]
- ยกเลิกไม่ได้ → [[ts-sale-cannot-cancel]]
- งวดบัญชีปิดแล้ว → [[ts-common-period-closed]]
- ไม่มีสิทธิ์ → [[ts-common-no-permission]]

## คำถามที่พบบ่อย
- ขายสดกับขายเชื่อต่างกันอย่างไร → [[faq-sale-cash-vs-credit]]
- ประเภทภาษีในบิล → [[faq-sale-vat-types]]
- เงินมัดจำกับเงินรับล่วงหน้า → [[faq-sale-deposit-vs-advance]]
- ส่งของบางส่วน เปิดบิลทีละรอบ → [[faq-sale-partial-delivery]]
- ห้ามขายลูกค้าที่ค้างเกินกำหนดได้ไหม → [[faq-sale-overdue-check]]
- ลบหรือยกเลิกดี → [[faq-sale-cancel-vs-delete]]
- ระบบลงบัญชีอะไรให้ → [[faq-sale-gl-posting]]

## ดูต่อ
- [[howto-ar-overview]]
- [[howto-doc-edit-cancel-delete]]
- [[sys-account-overview]]
- [[index]]
