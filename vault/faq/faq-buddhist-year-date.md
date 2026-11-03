---
title: "วันที่ในระบบเป็น พ.ศ. หรือ ค.ศ. ตั้งที่ไหน แล้วทำไมวันที่ในรายงานกับในบัญชีไม่ตรงกัน"
tags: [faq, date, buddhist-year, erp-option, report]
aliases: ["เปลี่ยนปี พ.ศ. เป็น ค.ศ.", "ตั้งปีพุทธศักราช", "ประเภทปี", "year_type", "erp_option.year_type", "วันที่เป็น 2569 หรือ 2026", "ปีไทย ปีฝรั่ง", "วันที่ขึ้นปี 2026 ทั้งที่ตั้ง พ.ศ.", "menu_option 1.1.2", "พิมพ์ปี 2 หลัก"]
sources: ["frontend/src/config/schemas/erpOption/tab1System.ts:22", "frontend/account/config/OptionsForm.tsx:297", "frontend/shared/ui/dateText.ts:8", "frontend/shared/ui/dateText.ts:51", "frontend/src/lib/numeric.ts:422", "backend/internal/application/process/gl_post.go:59", "backend/internal/application/process/doc_picture.go:242", "backend/internal/application/process/report.go:163", "backend/internal/application/process/report.go:185", "backend/internal/application/process/journaltax.go:208"]
---
# วันที่ในระบบเป็น พ.ศ. หรือ ค.ศ. ตั้งที่ไหน

**ตอบสั้น:** ตั้งที่หน้าจอ "กำหนดข้อเลือกพิเศษต่างๆ" (`menu_option`, รหัส 1002 / 1.1.2) ช่อง "ประเภทปี" เลือก คริสต์ศักราช (0) หรือ พุทธศักราช (1) ค่านี้เก็บใน `erp_option.year_type` และมีผลแค่ "การแสดงผล/การพิมพ์" เท่านั้น ฐานข้อมูลเก็บวันที่เป็น ค.ศ. เสมอ

## รายละเอียด
- ช่อง `year_type` เป็นปุ่มเลือก (radio) "ประเภทปี": 0 = คริสต์ศักราช, 1 = พุทธศักราช (`tab1System.ts:22-28`). เมื่อบันทึกหน้าจอนี้ ฝั่งหน้าเว็บอัปเดตค่าทันทีโดยไม่ต้องล็อกอินใหม่ (`OptionsForm.tsx:297`) และจำไว้ใน localStorage ชื่อ `bc_year_type` (`numeric.ts:394-408`); ตอนเปิดระบบจะโหลดจาก `erp_option` (`numeric.ts:473-493`)
- การแปลงตอนแสดง: ถ้า `year_type=1` ให้ปีที่เก็บ + 543 (`dateText.ts:8-26`, `numeric.ts:422-444`)
- การพิมพ์ปีเอง: ถ้าพิมพ์ปีเกิน 2400 ระบบถือว่าเป็น พ.ศ. แล้วลบ 543 ก่อนเก็บ (`dateText.ts:15,22`); ถ้าพิมพ์ปี 2 หลัก เช่น `15/03/69` จะเติมเป็น 2569 เมื่อตั้ง พ.ศ. และ 2069 เมื่อตั้ง ค.ศ. (`dateText.ts:51-66`)
- รายงาน: วันที่ที่กรอกในเงื่อนไขรายงานถ้าเกิน 2400 จะลบ 543 เช่นกัน (`report.go:163-180`) และหน้ารายงานอ่านค่า `year_type` มาแสดงผล (`report.go:185-197`, `frontend/account/report/UniversalReportScreen.tsx:412`)
- ข้อความรายการบัญชี (คำอธิบายที่ใช้ `&DOC_DATE&`/`&TAX_DATE&`) และรหัสรูปแนบเอกสาร (`bc_doc_images.image_id`) ใช้ปี พ.ศ. เมื่อ `year_type=1` (`gl_post.go:57-68`, `service.go:1570`, `doc_picture.go:200-206`, `:242-250`)
- ฐานข้อมูลใหม่ที่สร้างจากระบบ จะ seed `erp_option.year_type = 1` (พ.ศ.) ให้ (`workspace_google.go:505-507`)

## ข้อควรระวัง
- ถ้า `erp_option` ไม่มีแถวเลย: คำอธิบายรายการบัญชีและรหัสรูปแนบเป็น พ.ศ. (`gl_post.go:64-65`, `doc_picture.go:243`) แต่รายงานตกไปเป็น ค.ศ. (`report.go:196`) และหน้าเว็บเริ่มที่ 0 = ค.ศ. (`numeric.ts:354`) — ในระบบปกติมีแถว `erp_option` อยู่แล้วจึงไม่ค่อยเจอ
- เลขที่เอกสาร: `@YY`/`YYYY` ในรูปแบบเลขที่เอกสารเป็น ค.ศ. เสมอ ถ้าต้องการปี พ.ศ. ต้องใช้ตัวอักษรไทย `ปป`/`ปปปป` (ดู [[faq-doc-number-format]]) ข้อความช่วยเหลือบนจอกำหนดรูปแบบเขียนว่า "@YY = ปี ค.ศ. หรือ พ.ศ." ซึ่งไม่ตรงกับ backend
- เปลี่ยน `year_type` ไม่แก้วันที่ที่เก็บในฐานข้อมูล (ฐานเก็บ ค.ศ. เสมอ — comment ที่ `journaltax.go:208`) แค่เปลี่ยนวิธีแสดง

## ดูเพิ่ม
- [[term-buddhist-year]]
- [[std-ux-buddhist-year-bilingual]]
- [[hist-lessons-dates-buddhist-year]]
- [[term-doc-no-doc-date]]
- [[faq-doc-number-format]]
- [[faq-run-report-conditions]]

## ที่มาในโค้ด
- `frontend/src/config/schemas/erpOption/tab1System.ts:22-28` — ฟิลด์ `year_type` ประเภทปี
- `frontend/account/config/OptionsForm.tsx:297` — บันทึกแล้วเรียก `setBcYearType`
- `frontend/shared/ui/dateText.ts:8-26` (`isoToDmy`), `:51-66` (`completeDmy`)
- `frontend/src/lib/numeric.ts:394-408`, `:422-444`, `:473-493`
- `backend/internal/application/process/gl_post.go:57-68` — `glYearBuddhist`
- `backend/internal/application/process/doc_picture.go:200-206`, `:242-250`
- `backend/internal/application/process/report.go:163-180`, `:185-197`
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:505-507` — seed ฐานใหม่
