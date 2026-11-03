---
title: "รายงานภาษีซื้อ/ภาษีขาย ดึงข้อมูลจากไหน ทำไมเอกสารบางใบไม่ขึ้นรายงาน"
tags: [faq, vat, report, tax, register]
aliases: ["รายงานภาษีซื้อ", "รายงานภาษีขาย", "VAT report", "gl_journal_vat_buy", "gl_journal_vat_sale", "menu_report_vat_sale", "menu_report_vat_buy", "GLFA_VAT_SUMMARY", "เดือนภาษี", "vat_calc"]
sources: ["backend/internal/application/process/trans_tax.go:37", "backend/internal/application/process/trans_tax.go:74", "backend/internal/application/process/report_menu_gl_fa.go:1023", "backend/internal/application/process/report_menu_gl_fa.go:1039", "backend/internal/application/process/report_menu_gl_fa.go:1084", "backend/internal/application/process/report_menu_gl_fa.go:1701", "backend/internal/application/process/trans_save_rules.go:140"]
---
# รายงานภาษีซื้อ/ภาษีขาย ดึงข้อมูลจากไหน ทำไมเอกสารบางใบไม่ขึ้นรายงาน

**ตอบสั้น:** รายงานอ่านทะเบียน `gl_journal_vat_buy` / `gl_journal_vat_sale` ซึ่งระบบสร้างใหม่ทุกครั้งที่บันทึกเอกสาร กรองตามเดือนภาษี (`vat_effective_year/period`) ไม่ใช่วันที่เอกสาร เอกสารไม่ขึ้นเพราะ flag ไม่มีแท็บภาษี, vat_type = 3, เดือนภาษีอยู่นอกช่วง หรือ (ภาษีซื้อ) แถวไม่ใช่ประเภทปรกติ

## รายละเอียด
**การเกิดแถวภาษี** ([[acc-vat-register-wht]])
- เฉพาะ flag ใน `transVatTabs` เช่น ซื้อ 12, 16, 260, 262, 264, 315, 317 / ขาย 44, 46, 48, 99, 144, 250, 252, 254 และมัดจำ 11, 25, 110, 112 ส่วน 19/239 อยู่ใน `apArTaxTabs`
- ลดหนี้เก็บยอดบวกแต่ `vat_calc = -1` รายงานจึงหักออกเอง
- ไม่กรอกแท็บภาษีเอง → ระบบสร้าง 1 แถวจากหัวเอกสาร เลขที่/วันที่ใบกำกับว่างใช้ของเอกสาร อัตรา 0 คำนวณย้อนจาก VAT/ฐาน
- กรอกเองหรือมีหลายแถว → `is_manual_vat = 1`
- เปิด `check_input_vat` → ต้องกรอกเลขที่และวันที่ใบกำกับ สำหรับ vat_type 0/1

**รายงาน** ([[flow-tax-vat-wht-reports]])
- ภาษีขาย `menu_report_vat_sale`, ภาษีซื้อ `menu_report_vat_buy` (มีรุ่น _2557 และ _STD) และสรุป GLFA_VAT_SUMMARY
- ช่วงวันที่ที่ป้อนถูกแปลงเป็นเดือนภาษี yyyymm ถ้าปีในแถว > 2400 ระบบลบ 543 ก่อนเทียบ ([[faq-buddhist-year-date]])
- ภาษีขาย: ยอดเป็น 0 เมื่อเอกสารยกเลิก (`last_status = 1`) หรือเป็นสำเนา (`is_doc_copy = 1`)
- ภาษีซื้อ: ยอดเป็น 0 เมื่อยกเลิก และแสดงเฉพาะแถว `vat_type = 0` (ปรกติ) แถวขอคืนไม่ได้/ไม่ถึงกำหนดชำระไม่ขึ้น ([[term-vat-type]])

## ข้อควรระวัง
- สถานะยกเลิกอ่านจาก `ic_trans` ด้วย `doc_no` อย่างเดียว (ไม่ดู trans_flag) แถวภาษีของ 19/239 ที่ยกเลิกใน `ap_ar_trans` จึงไม่ถูกทำเป็น 0 และเลขซ้ำต่าง flag อาจอ่านสถานะผิดใบ
- แถวภาษีของ JV ใช้ flag 1999 ([[faq-journal-voucher-jv]])
- ประมวลผล GL ใหม่ไม่ได้สร้างทะเบียนภาษีใหม่ ([[faq-gl-rebuild-when]])

## ดูเพิ่ม
- [[tbl-gl-journal-vat-buy]]
- [[tbl-gl-journal-vat-sale]]
- [[faq-vat-exclude-include-calc]]
- [[hist-lessons-vat-tax-mistakes]]

## ที่มาในโค้ด
- `backend/internal/application/process/trans_tax.go:37` `transVatTabs` และ vat_calc
- `backend/internal/application/process/trans_tax.go:74` `defaultTransVat` สร้างแถวจากหัวเอกสาร
- `backend/internal/application/process/report_menu_gl_fa.go:1023` กรองเดือนภาษี −543
- `backend/internal/application/process/report_menu_gl_fa.go:1039` `glfaVatRun` เงื่อนไขยกเลิก/สำเนา/vat_type
- `backend/internal/application/process/report_menu_gl_fa.go:1084` join ic_trans ด้วย doc_no
- `backend/internal/application/process/report_menu_gl_fa.go:1701` ผูกเมนูรายงานภาษี
- `backend/internal/application/process/trans_save_rules.go:140` บังคับเลขที่/วันที่ใบกำกับ
