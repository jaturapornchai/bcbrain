---
title: "พิมพ์เอกสารออกมาเป็นฟอร์มยังไง แล้วปรับแบบฟอร์มพิมพ์ได้ที่ไหน"
tags: [faq, print, form, report]
aliases: ["พิมพ์ใบกำกับภาษี", "พิมพ์ฟอร์ม / เลือกรูปแบบ", "ปุ่มพิมพ์เอกสาร", "ทำไมพิมพ์แล้วมีลายน้ำตัวอย่าง", "PREVIEW ลายน้ำ", "ปรับแบบฟอร์มพิมพ์", "สร้าง/แก้ไขแบบฟอร์ม", "menu_form_edit", "form_code", "ออกแบบรายงาน", "พิมพ์รายงาน"]
sources: ["frontend/account/transaction/UniversalTransScreen.tsx:3109", "frontend/account/transaction/UniversalTransScreen.tsx:4315", "frontend/account/transaction/UniversalTransScreen.tsx:4353", "frontend/account/transaction/UniversalTransScreen.tsx:4357", "frontend/shared/components/GlobalDocFormPrintModal.tsx:2640", "frontend/shared/components/GlobalDocFormPrintModal.tsx:4295", "frontend/shared/components/GlobalDocFormPrintModal.tsx:4172", "frontend/account/report/UniversalReportScreen.tsx:1133", "backend/internal/adapter/inbound/http/process/handler.go:270", "backend/internal/adapter/inbound/http/process/permission.go:25", "backend/internal/adapter/inbound/http/router.go:166", "frontend/src/config/bcMenu.json:1355"]
---
# พิมพ์เอกสารออกมาเป็นฟอร์มยังไง แล้วปรับแบบฟอร์มพิมพ์ได้ที่ไหน

**ตอบสั้น:** ในหน้าจอเอกสาร (ขาย/ซื้อ ฯลฯ) กดปุ่ม "พิมพ์ฟอร์ม / เลือกรูปแบบ" เพื่อเปิดหน้าต่างเลือกแบบฟอร์มและสั่งพิมพ์ ส่วนการปรับ/สร้างแบบฟอร์มทำที่เมนู "สร้าง/แก้ไขแบบฟอร์ม" (`menu_form_edit`) ซึ่งเป็นเมนูเฉพาะผู้ดูแล (admin)

## รายละเอียด
- ปุ่ม "พิมพ์ฟอร์ม / เลือกรูปแบบ" อยู่บนแถบปุ่มของหน้าจอเอกสาร ทั้งโหมดดูเอกสาร (`UniversalTransScreen.tsx:3109-3117`) และโหมดแก้ไข (`:3138-3145`) เปิดหน้าต่าง `GlobalDocFormPrintModal` (`:4315`) ซึ่งใช้ร่วมกันทุกประเภทเอกสาร
- หลังกดบันทึกเอกสารสำเร็จ ระบบถามด้วยกล่อง "บันทึกเอกสารเรียบร้อยแล้ว" ว่าจะ "พิมพ์แบบฟอร์ม" เลยหรือ "ยังไม่พิมพ์" (`UniversalTransScreen.tsx:4357-4367`)
- เอกสารที่ยังไม่บันทึก (หรืออ่านจากฐานข้อมูลไม่ได้) จะแสดงลายน้ำ "ตัวอย่าง (PREVIEW)" บนฟอร์ม (`GlobalDocFormPrintModal.tsx:2640`, `:7327`, `:7493`) ถ้าสั่งพิมพ์ทั้งที่ยังเป็นตัวอย่าง ระบบนับเป็น "พยายามพิมพ์ก่อนบันทึก" แยกต่างหาก (`:2645-2670`); เอกสารที่บันทึกแล้วจะนับจำนวนครั้งและเวลาพิมพ์ล่าสุดเก็บไว้ใน `erp_business_ext` (`entity_type='doc_print_audit'`) (`:4294-4325`)
- สั่งพิมพ์ใช้ `window.print()` ของเบราว์เซอร์ (`GlobalDocFormPrintModal.tsx:4323`) ผู้ใช้เลือกเครื่องพิมพ์หรือบันทึกเป็น PDF ในหน้าต่างของเบราว์เซอร์เอง
- ปุ่ม "บันทึก Layout" ในหน้าต่างเก็บ Layout เป็นของแต่ละเมนูลง `erp_business_ext` (`:4144`, `:4161`) และถ้าเอกสารมีรหัสรูปแบบเลขที่ (`erp_doc_format`) จะจำแบบฟอร์มที่เลือกใน `erp_doc_format.form_code` ด้วย (`:4168-4175`)
- ในหน้าต่างพิมพ์มีปุ่มเปิดหน้าจอออกแบบ "Form Designer" (`GlobalDocFormPrintModal.tsx:5100-5113`) ที่เปิดเมนู `menu_form_edit` (`UniversalTransScreen.tsx:4353`) — เมนูนี้ชื่อ "สร้าง/แก้ไขแบบฟอร์ม" และกำหนดเป็น `adminOnly` (`bcMenu.json:1355-1366`)
- รายงาน (ไม่ใช่เอกสาร): ปุ่ม "พิมพ์รายงาน" ในหน้ารายงาน (`UniversalReportScreen.tsx:1133-1140`, `handlePrintPdf` `:812` เปิดหน้าต่างพิมพ์) ใช้หน้าต่าง `GlobalReportPrintModal` (`:2422`) และออก PDF จาก backend ที่ `POST /process/report/pdf` (`process/handler.go:268-312`, route `router.go:166` และ `:207`, สิทธิ์ read ใน `process/permission.go:25`; รายงานแบบ `customSql` ต้องเป็น admin `permission.go:60`); ออกแบบรายงานที่เมนู `fast_report_designer` ("ออกแบบรายงาน", รหัส 1094, `adminOnly` — `bcMenu.json:1369-1380`)

## ข้อควรระวัง
- ป้ายบนปุ่มและคำแนะนำในหน้าต่างพิมพ์เขียนว่า "1.12 Form Designer" / "หน้าจอ 1.12" (`GlobalDocFormPrintModal.tsx:5108-5111`) แต่เมนู `menu_form_edit` ที่เปิดจริงคำนวณเป็นรหัส 1093 (legacy 1.9) — ป้าย "1.12" ไม่ตรงกับเมนูที่เปิด (ดู [[faq-menu-code-to-screen]])

## ดูเพิ่ม
- [[scr-doc-format]]
- [[scr-report-print-modal]]
- [[fe-report-print-designer]]
- [[faq-doc-number-format]]
- [[faq-menu-code-to-screen]]
- [[faq-run-report-conditions]]

## ที่มาในโค้ด
- `frontend/account/transaction/UniversalTransScreen.tsx:3109-3117` (ปุ่ม), `:4315` (modal), `:4353` (เปิด designer), `:4357-4367` (ถามพิมพ์หลังบันทึก)
- `frontend/shared/components/GlobalDocFormPrintModal.tsx:2640` (`isActualSavedMode`), `:2645-2670` (นับครั้งที่พิมพ์ก่อนบันทึก), `:4294-4325` (นับครั้งพิมพ์ + `window.print`), `:4168-4175` (`erp_doc_format.form_code`), `:5100-5113` (ปุ่ม Form Designer)
- `frontend/account/report/UniversalReportScreen.tsx:812`, `:1133-1140`, `:2422`
- `backend/internal/adapter/inbound/http/process/handler.go:268-312`, `backend/internal/adapter/inbound/http/process/permission.go:25`, `:60`, `backend/internal/adapter/inbound/http/router.go:166`
- `frontend/src/config/bcMenu.json:1355-1380` (`menu_form_edit`, `fast_report_designer`)
