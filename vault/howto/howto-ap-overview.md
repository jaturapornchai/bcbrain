---
title: "ระบบเจ้าหนี้ ทำอะไรได้บ้าง รวมทุกเรื่อง"
tags: [howto, ap]
aliases: ["ระบบเจ้าหนี้ทำอะไรได้บ้าง", "เมนูเจ้าหนี้", "คู่มือระบบเจ้าหนี้", "จ่ายเงินผู้ขาย", "วางบิล จ่ายชำระ", "ตั้งหนี้เจ้าหนี้", "AP"]
sources: ["backend/internal/application/process/bcMenu.json:6034", "backend/internal/application/process/bcMenu.json:6212", "backend/internal/application/process/bcMenu.json:6225", "backend/internal/application/process/bcMenu.json:750", "frontend/account/transaction/transLayouts.ts:117"]
---
# ระบบเจ้าหนี้ ทำอะไรได้บ้าง รวมทุกเรื่อง

**ใช้เมื่อ:** ลูกค้าถามเรื่องทะเบียนผู้ขาย ยอดหนี้ยกมา ตั้งหนี้ค่าใช้จ่าย รับวางบิล จ่ายเงิน หรือภาษีหัก ณ ที่จ่าย (เจ้าหนี้ = ผู้ที่เราค้างจ่ายเงิน)
**เมนู:** เจ้าหนี้ (ตั้งรหัสพื้นฐานที่ เริ่มต้น › ตั้งค่าระบบเจ้าหนี้)
**ต้องมีก่อน:** ตั้งงวดบัญชีแล้ว ([[howto-gl-overview]])

## ลำดับการใช้งาน
1. ตั้งรหัสประเภท กลุ่ม มิติ → [[howto-ap-setup-codes]]
2. เพิ่มเจ้าหนี้ → [[howto-ap-supplier]] · เงื่อนไขการซื้อ เครดิต ส่วนลด [[howto-ap-supplier-detail]]
3. ที่อยู่จัดส่ง ป้ายชื่อ และข้อมูลคู่ค้า → [[howto-ap-transport-partner]]
4. เริ่มใช้ระบบ บันทึกหนี้ค้างจ่ายยกมา → [[howto-ap-opening-balance]]
5. ตั้งหนี้ค่าใช้จ่ายที่ไม่ใช่ซื้อสินค้า และเพิ่ม/ลดหนี้ → [[howto-ap-other-debt]]
6. ผู้ขายมาวางบิล → [[howto-ap-billing-receive]]
7. จ่ายเงิน → [[howto-ap-payment]] · ช่องทางจ่าย [[howto-ap-payment-methods]] · ภาษีหัก ณ ที่จ่าย [[howto-ap-withholding-tax]]
8. ยกเลิกเอกสาร → [[howto-ap-cancel-docs]]
9. แนบไฟล์กับเอกสารเจ้าหนี้ → [[howto-buy-attach-files]]

หนี้จากการซื้อสินค้า เกิดจากระบบซื้อ ดู [[howto-buy-overview]]

## ปัญหาที่พบบ่อย
| ปัญหาที่ลูกค้าเจอ | ดูโน้ต |
|---|---|
| บันทึกเจ้าหนี้ไม่ได้ | [[ts-ap-supplier-save-error]] |
| ลบเจ้าหนี้ไม่ได้ | [[ts-ap-supplier-cannot-delete]] |
| ลบประเภทหรือกลุ่มเจ้าหนี้ไม่ได้ | [[ts-ap-setup-cannot-delete]] |
| ดึงเอกสารค้างชำระแล้วบิลไม่ขึ้น | [[ts-ap-no-bills]] |
| ห้ามรับวางบิลซ้ำ | [[ts-ap-billing-duplicate]] |
| ต้องอ้างอิงใบรับวางบิล | [[ts-ap-must-ref-billing]] |
| ป้อนยอดชำระเกิน | [[ts-ap-pay-over]] |
| ยอดการจ่ายเงินไม่สมบูรณ์ | [[ts-ap-pay-incomplete]] |
| แก้ไขเอกสารที่จ่ายแล้วไม่ได้ | [[ts-buy-cannot-edit]] |
| ขึ้นว่าปิดงวดแล้ว | [[ts-common-period-closed]] |
| ไม่มีสิทธิ์ใช้เมนู | [[ts-common-no-permission]] |

## คำถามที่พบบ่อย
- ดูยอดค้างจ่ายแต่ละรายได้ที่ไหน → [[faq-ap-outstanding-balance]]
- วางบิลแล้วหนี้ลดหรือยัง → [[faq-ap-billing-reduce-debt]]
- จ่ายบางส่วนได้ไหม → [[faq-ap-partial-payment]]

## ดูต่อ
- [[howto-buy-overview]]
- [[howto-cash-bank-overview]]
- [[howto-tax-overview]]
- [[rpt-overview]]
- [[index]]
