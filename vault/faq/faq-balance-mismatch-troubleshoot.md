---
title: "ยอดในรายงานไม่ตรงกับงบทดลอง (สต็อก ลูกหนี้ เจ้าหนี้) ต้องเช็กอะไรบ้าง"
tags: [faq, troubleshooting, stock, ar, ap, gl, reconcile]
aliases: ["ยอดไม่ตรง", "กระทบยอด", "reconcile", "สต็อกไม่ตรง GL", "ลูกหนี้ไม่ตรงงบทดลอง", "มูลค่าสินค้าคงเหลือไม่ตรง", "menu_ic_recalc", "menu_gl_process", "ประมวลผลจากข้อมูลรายวัน"]
sources: ["frontend/src/config/bcMenu.json:2580", "frontend/src/config/bcMenu.json:9504", "backend/internal/application/process/trans.go:593", "backend/internal/application/process/service.go:1459", "backend/internal/application/process/service.go:2153", "backend/internal/application/process/service.go:1414", "backend/internal/application/process/report_menu_ap_ar.go:1084", "backend/internal/application/process/gl_template.go:1096"]
---
# ยอดในรายงานไม่ตรงกับงบทดลอง (สต็อก ลูกหนี้ เจ้าหนี้) ต้องเช็กอะไรบ้าง

**ตอบสั้น:** ส่วนใหญ่เกิดจาก 3 สาเหตุ (1) GL ของเอกสารเก่ายังไม่ได้คำนวณใหม่หลังจากต้นทุนเปลี่ยน (2) เอกสารบางประเภทไม่ลง GL ตามที่ออกแบบไว้ (3) รายงานแต่ละตัวใช้ชุดเอกสารไม่เหมือนกัน ให้รัน "คำนวณยอดสต๊อกใหม่" ก่อน แล้วตามด้วย "ประมวลผลจากข้อมูลรายวัน" จากนั้นเช็กรายการด้านล่างทีละข้อ

## รายละเอียด
**ขั้นที่ 1: คำนวณใหม่ตามลำดับ**
1. "คำนวณยอดสต๊อกใหม่" (`menu_ic_recalc`) คำนวณจำนวนและต้นทุนถัวเฉลี่ยใหม่ แต่ไม่ได้สร้าง GL ใหม่ (ดู [[faq-stock-rebuild]])
2. "ประมวลผลจากข้อมูลรายวัน" (`menu_gl_process`) สร้าง GL อัตโนมัติใหม่ตามช่วงวันที่ ไม่แตะ GL ที่คีย์มือ และลบหัว GL ที่ไม่มีบรรทัด (ดู [[faq-gl-rebuild-when]])

ถ้ารันสลับลำดับ GL จะยังใช้ต้นทุนเดิม

**ขั้นที่ 2: มูลค่าสินค้าคงเหลือ (รายงานสต็อก เทียบกับบัญชีสินค้า)**
- เวลาบันทึกเอกสารที่ลงวันที่ย้อนหลัง ระบบคำนวณต้นทุนใหม่ให้ทุกเอกสารของสินค้านั้น แต่สร้าง GL ใหม่ให้เฉพาะเอกสารที่บันทึก เอกสารสต็อก 56, 58, 60, 66, 68 ที่ยอดหัวเอกสารเป็น 0 ใช้ต้นทุนของบรรทัดเป็นยอด GL ยอดจึงค้างค่าเดิมจนกว่าจะรันขั้นที่ 1 ข้อ 2 (ดู [[faq-why-stock-cost-changed]])
- ปรับปรุงเพิ่ม 66 ที่กรอกราคา: สต็อกรับเข้าที่ต้นทุนเฉลี่ย แต่ GL ลงตามยอดหัวเอกสาร ส่วนต่างนี้เป็นจุดที่โค้ดเขียนไว้ว่ายังรอตัดสินใจ ([[faq-stock-count-adjust]])
- โอนย้าย 72 ลง GL เฉพาะเมื่อรูปแบบเอกสารมีแม่แบบ GL ([[faq-stock-transfer-warehouse]])
- ยอดยกมาสินค้า 54 ใช้ GL จากแท็บของหน้าจอยอดยกมา ([[faq-stock-opening-balance]])
- ต้นทุนแฝงเปลี่ยนมูลค่าสต็อกผ่านบรรทัดมูลค่า ([[faq-hidden-cost-landed]])
- ถ้าเคยมีสต็อกติดลบ ต้นทุนจะเริ่มนับใหม่ตอนที่ยอดกลับเป็นบวก ([[faq-negative-stock]])

**ขั้นที่ 3: ลูกหนี้/เจ้าหนี้ (รายงานสถานะ เทียบกับบัญชีคุม)**
- รายงานลูกหนี้/เจ้าหนี้คำนวณจากเอกสาร ไม่ได้อ่านจาก GL ถ้าคีย์ JV เข้าบัญชีคุมลูกหนี้โดยตรง ยอดใน GL จะเปลี่ยนแต่รายงานลูกหนี้จะไม่เปลี่ยน
- ยอดยกมา 93/81 (และ 95/97, 83/85) ไม่ลง GL ต้องมี JV ยอดยกมาที่ตรงกัน ([[faq-ap-ar-opening-balance]])
- รายงานสถานะลูกหนี้ไม่นับ 254 แต่หน้าจอเลือกบิลและรายงานเคลื่อนไหวนับ ([[faq-ap-ar-balance-where]])
- "รายงานตรวจสอบยอดวงเงิน" (`menu_ar_report_check_balance`) แสดงวงเงินลบยอดคงค้างตามสูตรสถานะเท่านั้น ไม่รวมเช็คในมือและเงินมัดจำ ตัวเลขจึงอาจไม่ตรงกับที่ระบบใช้ตรวจวงเงินตอนบันทึกขาย ([[faq-credit-limit-approval]])
- ใบวางบิลไม่ลดยอดหนี้และไม่ลง GL ([[faq-billing-ar-ap]])

**ขั้นที่ 4: อื่นๆ**
- งบทดลองไม่ balance: ดู [[faq-gl-not-balanced]]
- Serial ผิดปกติ: เมนู "ตรวจสอบ Serial มีปัญหา" ส่วนรายงานยอดคงเหลือตาม LOT อาจไม่ครบ ([[faq-serial-lot-expire]])

## ข้อควรระวัง
- "คำนวณยอดสต๊อกใหม่" ผ่านเมนูมีเวลาจำกัด 60 วินาที ถ้าฐานข้อมูลใหญ่ให้แบ่งรันเป็นช่วงรหัสสินค้า
- ถ้าติ๊ก "ตรวจสอบและปรับปรุง อัตราส่วนหน่วยนับ" ไว้ตอนคำนวณสต็อกใหม่ ระบบจะเขียนตัวตั้ง/ตัวหารใหม่ทับเอกสารเก่า ยอดย้อนหลังอาจเปลี่ยน ([[faq-unit-conversion]])
- เครื่องมือสต็อกบางตัว (ปรับปรุง LOT, ต้นทุนแฝง) สร้างเอกสารโดยไม่ตรวจงวดบัญชี จึงอาจมีเอกสารเกิดขึ้นในงวดที่ปิดไปแล้ว

## ดูเพิ่ม
- [[faq-stock-rebuild]]
- [[faq-gl-rebuild-when]]
- [[faq-gl-not-balanced]]
- [[proc-stock-tools]]
- [[hist-lessons-gl-posting-balance]]

## ที่มาในโค้ด
- `frontend/src/config/bcMenu.json:2580` เมนู `menu_ic_recalc` "คำนวณยอดสต๊อกใหม่"
- `frontend/src/config/bcMenu.json:9504` เมนู `menu_gl_process` "ประมวลผลจากข้อมูลรายวัน"
- `backend/internal/application/process/trans.go:593` `rebuildTransDerived` ทำ GL ใหม่ให้เฉพาะเอกสารที่บันทึก
- `backend/internal/application/process/service.go:1459` เอกสารสต็อกยอด 0 ใช้ต้นทุนของบรรทัดเป็นยอด GL
- `backend/internal/application/process/service.go:2153` คอมเมนต์ Known gap ของ GL ใบปรับปรุงเพิ่ม 66
- `backend/internal/application/process/service.go:1414` ลบหัว GL ที่ไม่มีบรรทัดก่อนสร้างใหม่
- `backend/internal/application/process/report_menu_ap_ar.go:1084` `arCheckBalanceReport` วงเงินลบยอดคงค้างตามสูตรสถานะ
- `backend/internal/application/process/gl_template.go:1096` `glTemplateOnlyFlags` 72 ลง GL เฉพาะเมื่อมีแม่แบบ
