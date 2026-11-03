---
title: "ต้องกดประมวลผลลงบัญชี (Rebuild GL) ใหม่เมื่อไร มันลบอะไรทิ้งบ้าง"
tags: [faq, gl, rebuild, process, workbench]
aliases: ["ประมวลผลจากข้อมูลรายวัน", "สร้าง GL ใหม่", "rebuild GL", "menu_gl_process", "เมนู 9010", "gl_process", "/api/process/gl/rebuild", "trans_direct", "ลงบัญชีใหม่ทั้งช่วง"]
sources: ["backend/internal/application/process/trans.go:609", "backend/internal/application/process/docs.go:220", "backend/internal/application/process/service.go:1297", "backend/internal/application/process/service.go:1427", "backend/internal/application/process/service.go:1482", "backend/internal/application/process/service.go:1591", "backend/internal/application/process/service.go:1677", "frontend/account/process/SystemProcessWorkbenchScreen.tsx:652"]
---
# ต้องกดประมวลผลลงบัญชี (Rebuild GL) ใหม่เมื่อไร มันลบอะไรทิ้งบ้าง

**ตอบสั้น:** ปกติไม่ต้อง เพราะบันทึกเอกสารทุกครั้งระบบสร้าง GL ของเอกสารนั้นใหม่เอง ให้สั่ง "ประมวลผลจากข้อมูลรายวัน" (9010 `menu_gl_process`) ตามช่วงวันที่ เมื่อแก้รูปแบบ GL ผังบัญชี หรือข้อมูลที่กระทบเอกสารเก่า ระบบลบเฉพาะ GL อัตโนมัติ (`trans_direct` ≠ 1) แล้วสร้างใหม่

## รายละเอียด
**อัตโนมัติ**: บันทึกเอกสารซื้อขาย/รับจ่าย เรียก `rebuildGLTx` ด้วยเลขเอกสารเดียวใน transaction เดียวกับการบันทึก ([[acc-transaction-save-flow]])

**สั่งเอง** ที่จอประมวลผลระบบ ([[scr-system-process-workbench]]) ส่ง `dateFrom/dateTo` ไป `/api/process/gl/rebuild`
- ต้องระบุเลขเอกสารหรือช่วงวันที่ ปีต้องไม่ใช่ 0000
- ทำงานได้ไม่เกิน 60 วินาที และล็อก (advisory lock) ไม่ให้ซ้อนกับการบันทึกเอกสาร

**ขั้นตอน** ([[acc-gl-rebuild]])
1. ลบหัว GL ที่ไม่มีบรรทัดรายละเอียดเลย (หัวค้าง แม้ trans_direct = 1)
2. ลบ `gl_journal_detail` / `gl_journal` ที่ `trans_direct <> 1` ในช่วงนั้น
3. ดึง `ic_trans` ที่ `is_cancel = 0` และ `ap_ar_trans` 19/239 แล้วลงบัญชีใหม่: รูปแบบ GL ก่อน เส้นมาตรฐานทีหลัง ([[faq-gl-template-doc-format]])
4. ลงเอกสารที่ใช้รูปแบบ GL อย่างเดียว (72, 418) และกลับรายการเอกสารที่ถูกยกเลิก ณ วันที่ยกเลิก

ผลที่หน้าจอแสดง: "ประมวลผลลงบัญชีเรียบร้อย: เอกสาร N ใบ, สร้างใบสำคัญ N ใบ"

## ข้อควรระวัง
- เอกสารที่มี GL บันทึกตรง (`trans_direct = 1`) เลขเดียวกันจะถูกข้าม ถ้า JV ใช้เลขซ้ำกับใบขาย ใบขายนั้นจะไม่ได้ GL อัตโนมัติอีก
- **งวดปิด**: รูปแบบ GL ข้ามเอกสาร (ไม่มี GL) แต่เส้นมาตรฐานไม่ตรวจสถานะงวด จะสร้าง GL ใหม่ทับได้แม้งวดปิด ถ้าไม่พบงวด period_number = 0 ([[faq-period-closed-cannot-save]])
- คำเตือน (`Warnings`) ไม่แสดงบนหน้าจอ
- ทะเบียนภาษีซื้อ/ขายไม่ได้สร้างใหม่ในขั้นนี้ มี endpoint `/tax/rebuild` แยก แต่ไม่พบหน้าจอเรียกใช้

## ดูเพิ่ม
- [[faq-gl-not-balanced]]
- [[faq-journal-voucher-jv]]
- [[faq-stock-rebuild]]
- [[flow-period-year-close]]

## ที่มาในโค้ด
- `backend/internal/application/process/trans.go:609` บันทึกเอกสาร → rebuildGLTx
- `backend/internal/application/process/docs.go:220` บันทึกเอกสารรับจ่าย → rebuildGLTx
- `backend/internal/application/process/service.go:1297` `RebuildGL` เงื่อนไข เวลา ล็อก
- `backend/internal/application/process/service.go:1427` ลบ GL ที่ trans_direct <> 1
- `backend/internal/application/process/service.go:1482` ข้ามเลขที่มี GL บันทึกตรง
- `backend/internal/application/process/service.go:1591` หางวดโดยไม่ดูสถานะปิด
- `backend/internal/application/process/service.go:1677` กลับรายการเอกสารยกเลิก
- `frontend/account/process/SystemProcessWorkbenchScreen.tsx:652` ปุ่มประมวลผลลงบัญชี
