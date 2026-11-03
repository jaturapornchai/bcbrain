---
title: "ต้องกดประมวลผลลงบัญชี (Rebuild GL) ใหม่เมื่อไร มันลบอะไรทิ้งบ้าง"
tags: [faq, gl, rebuild, process, workbench]
aliases: ["ประมวลผลจากข้อมูลรายวัน", "สร้าง GL ใหม่", "rebuild GL", "menu_gl_process", "เมนู 9010", "gl_process", "/api/process/gl/rebuild", "trans_direct", "ลงบัญชีใหม่ทั้งช่วง"]
sources: ["backend/internal/application/process/trans.go:609", "backend/internal/application/process/docs.go:220", "backend/internal/application/process/service.go:1308", "backend/internal/application/process/service.go:1437", "backend/internal/application/process/service.go:1493", "backend/internal/application/process/service.go:1601", "backend/internal/application/process/service.go:1669", "backend/internal/application/process/doc_cancel.go:585", "backend/internal/application/process/gl_template.go:1096", "frontend/account/process/SystemProcessWorkbenchScreen.tsx:652"]
---
# ต้องกดประมวลผลลงบัญชี (Rebuild GL) ใหม่เมื่อไร มันลบอะไรทิ้งบ้าง

**ตอบสั้น:** ปกติไม่ต้อง เพราะบันทึกเอกสารทุกครั้งระบบสร้าง GL ของเอกสารนั้นใหม่เอง ให้สั่ง "ประมวลผลจากข้อมูลรายวัน" (9010 `menu_gl_process`) ตามช่วงวันที่ เมื่อแก้รูปแบบ GL ผังบัญชี หรือข้อมูลที่กระทบเอกสารเก่า ระบบลบเฉพาะ GL อัตโนมัติ (`trans_direct` ≠ 1) ของเอกสารที่ลงบัญชีได้ (flag ใน `glRebuildTransFlags`) แล้วสร้างใหม่

## รายละเอียด
**อัตโนมัติ**: บันทึกเอกสารซื้อขาย/รับจ่าย เรียก `rebuildGLTx` ด้วยเลขเอกสารเดียวใน transaction เดียวกับการบันทึก ([[acc-transaction-save-flow]])

**สั่งเอง** ที่จอประมวลผลระบบ ([[scr-system-process-workbench]]) ส่ง `dateFrom/dateTo` ไป `/api/process/gl/rebuild`
- ต้องระบุเลขเอกสารหรือช่วงวันที่ ปีต้องไม่ใช่ 0000
- ทำงานได้ไม่เกิน 60 วินาที (`service.go:1321`) และขอ advisory lock แบบเด็ดขาด `glRebuildLock` (`:1331`) ส่วนการบันทึกเอกสารขอล็อกเดียวกันแบบร่วม (`lockGLShared` `:1381`) จึงบันทึกพร้อมกันได้ แต่บันทึกต้องรอระหว่างที่ประมวลผลช่วงวันที่กำลังรันอยู่

**ขั้นตอน** ([[acc-gl-rebuild]])
1. ลบหัว GL ที่ไม่มีบรรทัดรายละเอียดเลย (หัวค้าง แม้ trans_direct = 1)
2. ลบ `gl_journal_detail` / `gl_journal` ที่ `trans_direct <> 1` ในช่วงนั้น เฉพาะ `trans_flag` ที่อยู่ใน `glRebuildTransFlags` (`service.go:1437-1455`) ใบสำคัญของ flag อื่นจึงไม่ถูกลบ
3. ดึง `ic_trans` ที่ `is_cancel = 0` และ `ap_ar_trans` 19/239 แล้วลงบัญชีใหม่: รูปแบบ GL ก่อน เส้นมาตรฐานทีหลัง ([[faq-gl-template-doc-format]])
4. ลงเอกสารที่ใช้รูปแบบ GL อย่างเดียว (72, 418 — `glTemplateOnlyFlags` `gl_template.go:1096`) และกลับรายการเอกสารที่ถูกยกเลิก ณ วันที่ยกเลิก (`reverseCancelledGL` `doc_cancel.go:585`)
5. ท้ายสุดจัดค่า `period_number`/`account_year`/`book_code` ที่ว่างหรือเป็น 0 ในหัวใบสำคัญ และซิงก์ค่าเหล่านี้ไปยังรายการย่อย

ผลที่หน้าจอแสดง: "ประมวลผลลงบัญชีเรียบร้อย: เอกสาร N ใบ, สร้างใบสำคัญ N ใบ"

## ข้อควรระวัง
- เอกสารที่มี GL บันทึกตรง (`trans_direct = 1`) เลขเดียวกันจะถูกข้าม ถ้า JV ใช้เลขซ้ำกับใบขาย ใบขายนั้นจะไม่ได้ GL อัตโนมัติอีก
- **งวดปิด**: รูปแบบ GL ข้ามเอกสาร (ไม่มี GL) แต่เส้นมาตรฐานไม่ตรวจสถานะงวด จะสร้าง GL ใหม่ทับได้แม้งวดปิด ถ้าไม่พบงวด period_number = 0 ([[faq-period-closed-cannot-save]])
- ขั้นประมวลผลจะเพิ่มบัญชี `212015` (เจ้าหนี้ไม่ถึงกำหนดตั้งหนี้) และ `1122-01` (เช็ครับระหว่างเรียกเก็บ) เข้า `gl_chart_of_account` ถ้ายังไม่มี (`service.go:1668-1676`)
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
- `backend/internal/application/process/service.go:1308` `RebuildGL` เงื่อนไข เวลา ล็อก (`:1389` `rebuildGLTx`)
- `backend/internal/application/process/service.go:1437` ลบรายการย่อยและหัว GL ที่ trans_direct <> 1 (`:1449` ลบหัว)
- `backend/internal/application/process/service.go:1493` ข้ามเลขที่มี GL บันทึกตรง
- `backend/internal/application/process/service.go:1601` หางวดโดยไม่ดูสถานะปิด
- `backend/internal/application/process/service.go:1689` เรียกกลับรายการเอกสารยกเลิก (`doc_cancel.go:585`)
- `backend/internal/application/process/service.go:1669` เพิ่มบัญชี 212015 / 1122-01 ถ้ายังไม่มี
- `frontend/account/process/SystemProcessWorkbenchScreen.tsx:652` ปุ่มประมวลผลลงบัญชี
