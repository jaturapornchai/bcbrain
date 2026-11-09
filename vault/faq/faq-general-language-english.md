---
title: "เปลี่ยนหน้าจอเป็นภาษาอังกฤษได้ไหม พิมพ์เอกสารภาษาอังกฤษได้ไหม"
tags: [faq, general, language, english]
aliases: ["เปลี่ยนเป็นภาษาอังกฤษ", "หน้าจอภาษาอังกฤษ", "English version", "รายงานภาษาอังกฤษ", "พนักงานต่างชาติใช้ได้ไหม", "สลับภาษา ไทย English", "ชื่อบัญชีภาษาอังกฤษ"]
sources: ["frontend/src/config/i18n/bcI18n.tsx:48", "frontend/src/config/i18n/bcI18n.tsx:854", "frontend/shared/layout/AppearanceProvider.tsx:983", "frontend/shared/layout/AppearanceProvider.tsx:447", "frontend/account/report/GlobalReportPrintModal.tsx:844", "frontend/src/app/login/page.tsx:288"]
---
# เปลี่ยนหน้าจอเป็นภาษาอังกฤษได้ไหม?

**ตอบสั้น:** ได้ กดปุ่มธงภาษาบนแถบด้านบน (หรือที่หน้าเข้าสู่ระบบ) เลือกไทยหรือ English เมนู ปุ่ม ชื่อช่อง หัวตาราง และรายงานจะเปลี่ยนภาษาทันที ส่วนข้อมูลที่บันทึกไว้ เช่น ชื่อสินค้า ชื่อลูกค้า ยังเป็นตามที่คีย์ไว้

## รายละเอียด
- **ภาษาหน้าจอ:** ปุ่มธงบนแถบด้านบน สลับระหว่าง ไทย และ English จำไว้ตามเครื่องและเบราว์เซอร์ ดู [[start-screen-appearance]]
- **ภาษารายงาน:** ตอนสั่งพิมพ์รายงาน มีปุ่มธงเลือกภาษารายงานแยกจากภาษาหน้าจอ เช่น ใช้หน้าจอไทยแต่พิมพ์รายงานอังกฤษได้ ดู [[howto-common-print-document]]
- **ข้อมูลที่คีย์:** ระบบไม่แปลข้อมูลให้ ถ้าต้องการชื่อภาษาอังกฤษ ให้กรอกในช่องชื่อภาษาอังกฤษ เช่น ผังบัญชีมีช่อง "ชื่อบัญชี (อังกฤษ)"
- **แบบฟอร์มเอกสาร:** ถ้าต้องการใบกำกับหรือใบเสนอราคาภาษาอังกฤษ ปรับแบบฟอร์มได้ในหน้าจอออกแบบแบบฟอร์ม ดู [[howto-setup-form-designer]]
- ถ้าเจอคำที่ยังเป็นภาษาไทยในโหมด English แจ้งทีมงานพร้อมชื่อหน้าจอ

## ดูต่อ
- [[start-screen-appearance]]
- [[howto-common-print-document]]
- [[howto-setup-form-designer]]
- [[rpt-print-export]]
- [[sys-account-overview]]
