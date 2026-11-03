---
title: "รับคืน/ลดหนี้ (48) และส่งคืน/ลดหนี้ (16) ลงบัญชี GL กลับด้านยังไง"
tags: [faq, gl, credit-note, sale-return, purchase-return, vat]
aliases: ["ลดหนี้ลงบัญชียังไง", "รับคืนสินค้า GL", "credit note journal", "trans_flag 48", "trans_flag 16", "trans_flag 317", "menu_so_credit_note", "menu_po_credit_note", "คืนเงินสดลดหนี้"]
sources: ["backend/internal/application/process/service.go:2050", "backend/internal/application/process/service.go:2058", "backend/internal/application/process/service.go:1984", "backend/internal/application/process/service.go:1986", "backend/internal/application/process/pay_check.go:36", "backend/internal/application/process/trans_tax.go:37", "backend/internal/application/process/service.go:1863"]
---
# รับคืน/ลดหนี้ (48) และส่งคืน/ลดหนี้ (16) ลงบัญชี GL กลับด้านยังไง

**ตอบสั้น:** ลดหนี้ขาย 48 = Dr ขาย / Dr ภาษีขาย / Cr ลูกหนี้ (หรือ Cr เงินที่คืน ถ้าเป็นแบบเงินสด) ลดหนี้ซื้อ 16/317 = Dr เจ้าหนี้ (หรือ Dr เงินที่ได้คืน) / Cr ซื้อ / Cr ภาษีซื้อ

## รายละเอียด
ใช้การลงบัญชีมาตรฐาน ([[acc-gl-posting-standard]]) เมื่อไม่มีรูปแบบ GL (ST ใช้ glRule56, PT ใช้ glRule44, ดู [[faq-gl-template-doc-format]])

**ลดหนี้ขาย 48 (และ 252)**
- Dr ขาย = base, Dr ภาษีขาย = vat
- เป็นแบบเงินสดเมื่อ `payTabEnabled` จริง สำหรับ 48 คือ inquiry_type 1, 3 หรือ 5 → Cr ตามชุดรายการชำระเงิน (`payTenders(false)`)
- นอกนั้น → Cr ลูกหนี้ เต็ม total

**ลดหนี้ซื้อ 16/317 (และ 262, 91)**
- 16/317 ที่ inquiry_type ≥ 2 = ส่งคืน/ราคาผิดแบบเงินสด → Dr ตามชุดรายการชำระเงิน (`payTenders(true)`)
- นอกนั้น → Dr เจ้าหนี้ total
- Cr ซื้อ = base, Cr ภาษีซื้อ = vat

**ทะเบียนภาษี** ลดหนี้เก็บยอดเป็นบวกแล้วใช้ `vat_calc = -1` (48, 16, 317, 91, 262, 252, 103, 112, 25) รายงานภาษีจึงหักออกเอง ([[faq-vat-purchase-sale-report]])

## ข้อควรระวัง
- 252 (ลดหนี้รายได้อื่น) และ 262 (ลดหนี้ค่าใช้จ่ายอื่น) ลงเป็นเงินสดเสมอ ไม่ขึ้นกับ inquiry_type ([[faq-other-income-expense-gl]])
- บัญชีภาษีหัก ณ ที่จ่ายในชุดรายการชำระเงินเลือกตามทิศเงิน ไม่ใช่ตามคู่ค้า: 48 คืนเงินสดใช้ลิสต์ 2122/2123/2120 และ 16 รับเงินคืนใช้ลิสต์ 1153/1154/1152/2122
- เส้นมาตรฐานไม่กลับรายการต้นทุนสินค้า (ไม่มีบรรทัดสินค้าคงเหลือ/ต้นทุนขาย)

## ดูเพิ่ม
- [[doc-sale-return]]
- [[doc-purchase-return]]
- [[faq-sale-invoice-gl-posting]]
- [[faq-purchase-invoice-gl-posting]]
- [[term-inquiry-type]]

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:2050` case 48/252 Dr ขาย Dr ภาษีขาย
- `backend/internal/application/process/service.go:2058` เงื่อนไขเงินสด `payTabEnabled` หรือ 252
- `backend/internal/application/process/service.go:1984` case 16/317/262/91
- `backend/internal/application/process/service.go:1986` 16/317 inquiry ≥ 2 หรือ 262 = เงินสด
- `backend/internal/application/process/pay_check.go:36` `payTabEnabled` (48 = inquiry 1/3/5)
- `backend/internal/application/process/trans_tax.go:37` `transVatTabs` ค่า vat_calc −1 ของลดหนี้
- `backend/internal/application/process/service.go:1863` บัญชีภาษีหักเลือกตามทิศรับ/จ่าย
