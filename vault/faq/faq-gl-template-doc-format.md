---
title: "ตั้งรูปแบบการลงบัญชี (GL) ในรูปแบบเอกสารยังไง และระบบใช้เมื่อไร"
tags: [faq, gl, template, doc-format, setup]
aliases: ["รูปแบบ GL", "ผูกบัญชีกับเอกสาร", "GL template", "erp_doc_format_gl", "menu_setup_doc_format", "เมนู 1012", "Get Format", "condition_number", "action 90 ปัดเศษ"]
sources: ["backend/internal/application/process/gl_template.go:961", "backend/internal/application/process/gl_template.go:966", "backend/internal/application/process/gl_template.go:1008", "backend/internal/application/process/gl_template.go:378", "backend/internal/application/process/gl_template_rules.go:20", "backend/internal/application/process/gl_template_defaults.go:58", "frontend/account/master/DocFormatScreen.tsx:856"]
---
# ตั้งรูปแบบการลงบัญชี (GL) ในรูปแบบเอกสารยังไง และระบบใช้เมื่อไร

**ตอบสั้น:** ตั้งที่แท็บ GL ของจอรูปแบบเอกสาร (เมนู 1012 `menu_setup_doc_format`) เก็บใน `erp_doc_format_gl` ทุกครั้งที่ลงบัญชี ระบบลองรูปแบบนี้ก่อน ถ้าใช้ไม่ได้จึงตกไปการลงบัญชีมาตรฐาน

## รายละเอียด
**การตั้งค่า** ([[scr-doc-format]])
- แต่ละแถวมีรหัสบัญชีด้านเดียว (เดบิตหรือเครดิต) พร้อมเลขเงื่อนไข (`condition_number` = action) ที่บอกว่าใช้ยอดไหน เช่นยอดขาย ยอด VAT ยอดต้นทุน
- ปุ่มดึงค่าเริ่มต้นเรียก `/api/process/gl/template-defaults` ด้วยรหัสจอ แล้วถามว่าจะล้างของเก่าหรือไม่
- บันทึกจอ = ลบแถว GL ของรหัสเอกสารนั้นแล้วใส่ใหม่ทั้งชุด
- รุ่น Starter ซ่อนแท็บ GL

**ตอนลงบัญชี** ([[acc-gl-template-engine]])
1. หา `erp_doc_format` ด้วยรหัสรูปแบบของเอกสาร อ่าน `screen_code`, `gl_book`, `gl_description`
2. `screen_code` ต้องอยู่ใน `glRuleByScreen` (เช่น SI/SIP 44, ST 48, PU 12, PT 16, OI 250, EPO 260, DE 19, EE 239) และต้องมีแถวที่ `condition_number > 0` ไม่งั้นใช้เส้นมาตรฐาน ([[acc-gl-posting-standard]])
3. คำนวณทุกแถว แล้วชดเชยเศษสตางค์ด้วย action 90 (กำหนดบัญชีส่วนต่าง) เมื่อส่วนต่างไม่เกิน 0.1 × จำนวนบรรทัดรายการ
4. Dr = Cr → บันทึก `gl_journal` (`trans_direct = 0`) ไม่สมดุล → ตกไปเส้นมาตรฐาน ไม่มีบรรทัด → เส้นมาตรฐานตัดสิน

## ข้อควรระวัง
- ถ้าวันที่เอกสารอยู่ในงวดที่ปิดแล้วหรือไม่พบงวด รูปแบบ GL **ข้ามเอกสารนั้นทั้งใบ** (ไม่ตกไปเส้นมาตรฐาน) เอกสารจึงไม่มี GL ข้อความเตือนเก็บใน `Warnings` แต่หน้าจอไม่แสดง ([[faq-period-closed-cannot-save]])
- แก้รูปแบบแล้ว GL เก่าไม่เปลี่ยนเอง ต้องประมวลผลใหม่ ([[faq-gl-rebuild-when]])
- `inventory_gl_post` = 0 มีผลแค่ตอนดึงค่าเริ่มต้น (ตัด action 101/103) ไม่ได้มีผลตอนลงบัญชี

## ดูเพิ่ม
- [[tbl-erp-doc-format-gl]]
- [[faq-gl-not-balanced]]
- [[faq-sale-invoice-gl-posting]]
- [[faq-doc-number-format]]

## ที่มาในโค้ด
- `backend/internal/application/process/gl_template.go:961` SQL อ่านแถว `condition_number > 0`
- `backend/internal/application/process/gl_template.go:966` `format` หา screen_code/gl_book
- `backend/internal/application/process/gl_template.go:1008` `post` งวดปิด / ไม่สมดุล / ไม่มีบรรทัด
- `backend/internal/application/process/gl_template.go:378` `addDiff` ชดเชยเศษ 0.1 × บรรทัด
- `backend/internal/application/process/gl_template_rules.go:20` `glRuleByScreen`
- `backend/internal/application/process/gl_template_defaults.go:58` `GLTemplateDefaults`
- `frontend/account/master/DocFormatScreen.tsx:856` ปุ่มดึงค่าเริ่มต้น
