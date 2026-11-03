---
title: "VAT แยกนอก กับ รวมใน คำนวณต่างกันยังไง ส่วนลดท้ายบิลหักก่อนหรือหลังภาษี"
tags: [faq, vat, calc, discount, transcalc]
aliases: ["ภาษีแยกนอก", "ภาษีรวมใน", "exclude include VAT", "vat_type", "vatCalc", "discout_type", "discount_vat_type", "ส่วนลดก่อนภาษี", "ถอด VAT"]
sources: ["backend/internal/application/process/transcalc.go:137", "backend/internal/application/process/transcalc.go:150", "backend/internal/application/process/transcalc.go:175", "backend/internal/application/process/transcalc.go:201", "backend/internal/application/process/grid_calc.go:92", "backend/internal/application/process/grid_calc.go:96"]
---
# VAT แยกนอก กับ รวมใน คำนวณต่างกันยังไง ส่วนลดท้ายบิลหักก่อนหรือหลังภาษี

**ตอบสั้น:** แยกนอก (vat_type 0) = VAT = ฐาน × อัตรา/100 แล้วบวกเพิ่ม รวมใน (vat_type 1) = ถอดฐานจากยอดด้วย ยอด × 100/(100 + อัตรา) แล้ว VAT = ยอด − ฐาน ส่วนลดท้ายบิลกระทบฐานภาษีหรือไม่ขึ้นกับ `erp_option.discout_type`

## รายละเอียด
ยอดหัวเอกสารคำนวณใน `vatCalc` (พอร์ตจาก C# `_icTransProcess._vatCalc`, ดู [[acc-transcalc-totals]]) แยกยอดสินค้ามีภาษี (vat) กับยกเว้นภาษี (except), ส่วนลดท้ายบิล (disc) และมัดจำที่ตัดใช้ (adv)

**แยกนอก (0)**
- `discout_type` ≠ 1 (คิด VAT ก่อนหักส่วนลด): ฐาน = vat − adv, VAT = ปัด(ฐาน × อัตรา/100), ยอดสุทธิ = ฐาน + except + VAT − disc ส่วนลดไม่ลดฐานภาษี
- `discout_type` = 1 (หลังหักส่วนลด) ใช้ `discount_vat_type`
  - 0 = หักส่วนลดจากสินค้ามีภาษีก่อน ส่วนเกินไปหักจากยกเว้นภาษี
  - 1 = เฉลี่ยตามสัดส่วนสินค้ามีภาษีต่อยอดรวม
  - ฐาน = vat − ส่วนลดฝั่งมีภาษี − adv

**รวมใน (1)**: ยอดสุทธิ = รวม − disc − adv, ยอดมีภาษี net = vat − adv (หรือหักส่วนลดตาม `discount_vat_type` เมื่อ `discout_type` = 1), ฐาน = ปัด(net × 100/(100 + อัตรา)), VAT = net − ฐาน

**ค่าอื่น (ยกเว้น / ไม่กระทบภาษี)**: ไม่มี VAT ยอดสุทธิ = รวม − disc − adv ([[term-vat-type]])

ตัวอย่าง (อัตรา 7 ไม่มีส่วนลด): แยกนอก ฐาน 1,000 → VAT 70 สุทธิ 1,070; รวมใน 1,070 → ฐาน 1,000 VAT 70

## ข้อควรระวัง
- `discount_vat_type` = 2 ถูกถือเป็น 0 (C# เป็น case ว่าง รอลุงจืดกำหนด) และ `round_type` ที่ไม่ใช่ 1 ถือเป็น 0
- แยกนอก + หักส่วนลดก่อน (`discount_vat_type` 0): ถ้าส่วนลด + มัดจำ มากกว่ายอดสินค้ามีภาษี ฐานและ VAT เป็น 0 ทั้งหมด
- ทศนิยมผลลัพธ์ = max(ทศนิยมจำนวนเงินของระบบ, 2) ([[faq-rounding-decimal]]) อัตรา VAT มาจากเอกสาร ไม่ได้ฝังในฟังก์ชัน

## ดูเพิ่ม
- [[term-erp-option]]
- [[scr-options]]
- [[faq-vat-purchase-sale-report]]
- [[hist-lessons-vat-tax-mistakes]]
- [[faq-deposit-vs-advance]]

## ที่มาในโค้ด
- `backend/internal/application/process/transcalc.go:137` `vatCalc`
- `backend/internal/application/process/transcalc.go:150` แยกนอก ก่อน/หลังหักส่วนลด
- `backend/internal/application/process/transcalc.go:175` รวมใน ถอดฐาน × 100/(100 + อัตรา)
- `backend/internal/application/process/transcalc.go:201` ประเภทอื่น ไม่มี VAT
- `backend/internal/application/process/grid_calc.go:92` อ่าน discout_type / discount_vat_type
- `backend/internal/application/process/grid_calc.go:96` ค่า 2 ถือเป็น 0
