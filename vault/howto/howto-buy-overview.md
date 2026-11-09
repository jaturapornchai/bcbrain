---
title: "ระบบซื้อ ทำอะไรได้บ้าง รวมทุกเรื่อง"
tags: [howto, buy]
aliases: ["ระบบซื้อทำอะไรได้บ้าง", "เมนูซื้อ", "คู่มือระบบซื้อ", "ขั้นตอนการซื้อสินค้า", "ใบสั่งซื้อ ซื้อสินค้า ส่งคืน", "งานจัดซื้อ", "PR PO"]
sources: ["backend/internal/application/process/bcMenu.json:3820", "backend/internal/application/process/bcMenu.json:3858", "backend/internal/application/process/bcMenu.json:3962", "frontend/account/transaction/transLayouts.ts:85"]
---
# ระบบซื้อ ทำอะไรได้บ้าง รวมทุกเรื่อง

**ใช้เมื่อ:** ลูกค้าถามเรื่องขอซื้อ สั่งซื้อ รับสินค้า ตั้งหนี้ซื้อ ส่งคืน เพิ่มหนี้ หรือจ่ายเงินมัดจำให้ผู้ขาย
**เมนู:** ซื้อ (ตั้งเจ้าหนี้ที่ เจ้าหนี้ › ทะเบียนเจ้าหนี้ คู่ค้า และที่อยู่จัดส่ง)
**ต้องมีก่อน:** มีรหัสเจ้าหนี้ (ผู้ขายที่เราซื้อของด้วย) และรหัสสินค้า ดู [[howto-ap-supplier]]

## ลำดับการใช้งาน
1. ขอซื้อ → [[howto-buy-purchase-requisition]]
2. สั่งซื้อและอนุมัติ → [[howto-buy-purchase-order]]
3. จ่ายเงินมัดจำหรือเงินล่วงหน้าก่อนรับของ (ถ้ามี) → [[howto-buy-advance-deposit]]
4. รับของพร้อมใบกำกับภาษี บันทึกซื้อสินค้า/ตั้งหนี้ซื้อ → [[howto-buy-purchase-invoice]]
   - หักเงินมัดจำออกจากใบซื้อ → [[howto-buy-use-deposit]]
   - กรอกภาษีซื้อและเลขที่ใบกำกับ → [[howto-buy-purchase-vat]]
5. รับของก่อน ใบกำกับมาทีหลัง (ทะยอยรับ) → [[howto-buy-partial-receive]] แล้ว [[howto-buy-partial-invoice]]
6. คืนของหรือขอลดราคา → [[howto-buy-return-credit-note]]
7. ผู้ขายคิดเพิ่ม → [[howto-buy-debit-note]]
8. จ่ายเงินผู้ขาย → ไปที่ระบบเจ้าหนี้ [[howto-ap-overview]]

## เรื่องที่ใช้ร่วมกันทุกเอกสารซื้อ
- ดึงรายการจากเอกสารก่อนหน้า → [[howto-buy-reference-doc]]
- เอกสารลงบัญชีอะไรให้ → [[howto-buy-gl-posting]]
- ข้อเลือกพิเศษที่มีผลกับงานซื้อ → [[howto-buy-options]]
- แนบรูปภาพและไฟล์ → [[howto-buy-attach-files]]
- ยกเลิกเอกสาร → [[howto-buy-cancel-docs]] · หลักการทั่วไป [[howto-doc-edit-cancel-delete]]
- พิมพ์และส่งออกรายงาน → [[rpt-overview]] · [[rpt-print-export]]

## ปัญหาที่พบบ่อย
| ปัญหาที่ลูกค้าเจอ | ดูโน้ต |
|---|---|
| บันทึกไม่ได้ ไม่ใส่หรือไม่พบเจ้าหนี้ | [[ts-buy-supplier-required]] |
| บันทึกไม่ได้ ให้กรอกช่องที่ยังว่าง | [[ts-buy-required-fields]] |
| จำนวนเกินใบสั่งซื้อ | [[ts-buy-qty-over-po]] |
| ส่งคืนเกินจำนวนหรือมูลค่าที่ซื้อ | [[ts-buy-return-over]] |
| เรื่องเลขที่ใบกำกับภาษี | [[ts-buy-tax-invoice]] |
| ดึงเอกสารแล้วไม่เจอใบที่ต้องการ | [[ts-buy-ref-doc-not-listed]] |
| แก้ไขหรือลบเอกสารไม่ได้ | [[ts-buy-cannot-edit]] |
| ตัดเงินมัดจำไม่ได้ | [[ts-buy-deposit-errors]] |
| ลบใบจ่ายเงินมัดจำไม่ได้ | [[ts-buy-deposit-cannot-delete]] |
| ยกเลิกหรืออนุมัติไม่ได้ | [[ts-buy-cancel-refused]] |
| ขึ้นว่าปิดงวดแล้ว | [[ts-common-period-closed]] |
| ไม่มีสิทธิ์ใช้เมนู | [[ts-common-no-permission]] |

## คำถามที่พบบ่อย
- ซื้อเงินสดกับซื้อเงินเชื่อต่างกันอย่างไร → [[faq-buy-cash-vs-credit]]
- ซื้อปกติกับทะยอยรับ ใช้แบบไหน → [[faq-buy-partial-vs-normal]]
- ใบไหนทำให้สต๊อกเพิ่มหรือลด → [[faq-buy-when-stock-changes]]
- รับของเกินใบสั่งซื้อได้ไหม → [[faq-buy-receive-more-than-po]]
- เงินล่วงหน้ากับเงินมัดจำต่างกันอย่างไร → [[faq-buy-advance-vs-deposit]]

## ดูต่อ
- [[howto-ap-overview]]
- [[howto-stock-overview]]
- [[howto-tax-overview]]
- [[index]]
