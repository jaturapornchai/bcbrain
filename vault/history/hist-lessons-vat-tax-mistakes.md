---
title: "บทเรียนภาษีมูลค่าเพิ่ม ภาษีหัก ณ ที่จ่าย และใบกำกับภาษี (VAT, WHT & Tax Invoice)"
tags: [history, lesson, vat, tax, wht]
aliases: ["ภาษีขาด รายงาน ภ.พ.30", "vat_effective_year", "tax_doc_no ซ้ำ", "WHT นับเอกสารยกเลิก", "transVatTabs"]
sources: ["backend/internal/application/process/report_menu_gl_fa.go:1026", "backend/internal/application/process/report_menu_gl_fa.go:1160", "backend/internal/application/process/uat_s1_fixes_test.go:139", "backend/internal/application/process/uat_s1_fixes_test.go:146", "backend/internal/application/process/trans_tax.go:37", "backend/internal/application/process/trans_tax.go:81", "backend/internal/application/process/journaltax.go:201", "frontend/account/transaction/JournalTaxTabs.tsx:124", "backend/internal/application/process/trans_tax_doc_no.go:18", "backend/internal/application/process/trans_tax_doc_no_test.go:16", "backend/internal/application/process/trans_save_rules.go:53", "backend/internal/application/process/trans_save_rules.go:140", "AGENTS.md:58"]
---

# บทเรียนภาษีมูลค่าเพิ่ม ภาษีหัก ณ ที่จ่าย และใบกำกับภาษี

ปัญหาภาษีส่วนใหญ่ไม่ใช่สูตรคำนวณ แต่เป็นแถวภาษีที่ไม่ถูกลงทะเบียน ปีภาษีที่เก็บคนละระบบ (พ.ศ./ค.ศ.) เลขใบกำกับซ้ำ และรายงานที่นับเอกสารยกเลิก หน้านี้บันทึกกลไกกันพลาดในโค้ด ไม่ได้อ้างข้อกฎหมายภาษี (ตัวเลข/มาตราต้องตรวจกับแหล่งทางการของกรมสรรพากรแยกต่างหาก)

## อะไรพังได้
- **ปีภาษีผิดระบบ**: `vat_effective_year` เก็บเป็น ค.ศ. แต่ SQL รายงานลบ 543 ทุกแถว รายงานภาษีขาย/ซื้อ/ภ.พ.30 จึงไม่เห็นรายการใหม่ (หรือกลับกันถ้ามีค่าเก่าที่เป็น พ.ศ. ปนอยู่)
- **เอกสารที่ลง GL ภาษีแล้วแต่ไม่มีแถวทะเบียนภาษี**: ใบจ่าย/รับชำระหนี้, ขายสินทรัพย์ และเงินมัดจำที่มี VAT ถ้าไม่ถูกลงทะเบียนในตารางภาษี รายงานภาษีจะไม่ตรงกับ GL
- **รายงานภาษีหัก ณ ที่จ่ายนับเอกสารยกเลิก**: สถานะยกเลิกอยู่คนละตารางตามชนิดเอกสาร (ใบชำระหนี้อยู่ใน `ap_ar_trans` ส่วนใบอื่นอยู่ใน `ic_trans`) ถ้าอ่านจากตารางเดียวจะพลาด
- **อัตรา VAT ในแถวภาษีว่างหรือเป็น 0** ทั้งที่มีฐานและภาษี
- **เลขที่ใบกำกับภาษีซ้ำ**: สองคำขอที่บันทึกพร้อมกันผ่านการตรวจได้ทั้งคู่ ถ้าไม่ล็อก
- **ใบกำกับภาษีซื้อว่าง**: บริษัทที่เปิดตัวเลือกตรวจ input VAT ต้องห้ามบันทึกเมื่อไม่ได้กรอกเลขที่/วันที่ใบกำกับ

## โค้ดป้องกันไว้อย่างไร
| ด่าน | ที่อยู่ | ทำอะไร |
|---|---|---|
| เก็บปี ค.ศ. ที่เดียว | `backend/internal/application/process/journaltax.go:201-208` | ถ้าไม่ระบุปี ใช้ปีของวันที่ภาษี (ค.ศ.); หน้าจอ `frontend/account/transaction/JournalTaxTabs.tsx:124` แปลงค่าเก่าที่ > 2400 กลับเป็น ค.ศ. ตอนโหลด และแสดงตาม `year_type` ที่บรรทัด 522 |
| SQL รายงานรับทั้งสองระบบ | `report_menu_gl_fa.go:1026` `glfaPeriodSQL` | ลบ 543 เฉพาะค่าที่ > 2400; เทส `uat_s1_fixes_test.go:139` |
| ทุกชนิดเอกสารที่มีภาษีต้องลงทะเบียน | `trans_tax.go:37` `transVatTabs` | ตาราง flag -> ภาษีซื้อ/ขาย (รวมมัดจำ 11, 25, 110, 112 และขายสินทรัพย์ 1802); เทส `uat_s1_fixes_test.go:146` ตรวจว่ามัดจำอยู่ในตาราง |
| อัตราว่างแต่มีฐานและภาษี | `trans_tax.go:81` | คำนวณอัตราจาก ภาษี x 100 / ฐาน ปัดสองตำแหน่ง |
| รายงานภาษีหัก ณ ที่จ่ายเลือกตารางสถานะยกเลิกตามชนิดเอกสาร | `report_menu_gl_fa.go:1160` | `trans_flag` 19/239 อ่าน `ap_ar_trans.last_status` ที่เหลืออ่าน `ic_trans.last_status`; แถวยกเลิกถูกตัดยอดและแสดง "ยกเลิก" |
| ห้ามเลขใบกำกับซ้ำ | `trans_tax_doc_no.go:18` `checkTaxDocNo` | ตรวจในธุรกรรมเดียวกับการบันทึกภายใต้ `pg_advisory_xact_lock`; ภาษีขายเทียบเลขทั้งทะเบียน ภาษีซื้อเทียบเฉพาะผู้ขายรายเดิมใน flag เดียวกัน; เอกสารที่บันทึกซ้ำด้วยเลขเดิมของตัวเองไม่ถูกบล็อก |
| เทสเลขใบกำกับซ้ำ | `trans_tax_doc_no_test.go:16` | เป็นเทส integration ข้ามอัตโนมัติถ้าไม่ตั้ง `TAXDOC_IT_DB`; ทำงานใน transaction ที่ rollback |
| ตรวจ input VAT ตอนบันทึก | `trans_save_rules.go:53` `inputVatFlags`, `:140` | ถ้า `erp_option.check_input_vat` เปิด และ vat_type เป็น 0/1 ต้องมีเลขที่และวันที่ใบกำกับ |

## กฎที่ต้องจำ
- เก็บปีเป็น ค.ศ. ที่เดียว แปลงเฉพาะตอนแสดง/รับ input (`AGENTS.md:58`) และ SQL ที่อ่านปีต้องรองรับค่าเก่าที่ > 2400 ต่อไป
- เพิ่มชนิดเอกสารใหม่ที่ GL ลงภาษี = ต้องเพิ่มแถวใน `transVatTabs` ด้วยเสมอ (และเพิ่มเทสตาม flag)
- สถานะยกเลิกอยู่คนละตารางตามชนิดเอกสาร รายงานต้องเลือกตารางตาม `trans_flag`
- การตรวจเลขซ้ำที่ไม่ล็อกไม่ป้องกันคำขอพร้อมกัน

## ที่มาในโค้ด
- `backend/internal/application/process/trans_tax.go:37-45, 74-90` ทะเบียนแถวภาษีและอัตราย้อนกลับ
- `backend/internal/application/process/trans_tax_doc_no.go:18-60` ตรวจเลขซ้ำ
- `backend/internal/application/process/report_menu_gl_fa.go:1026, 1160` ปีและสถานะยกเลิกในรายงาน
- ดูเพิ่ม: [[acc-vat-register-wht]] · [[hist-lessons-rounding-decimal]] · [[hist-lessons-dates-buddhist-year]] · [[hist-lessons-payment-cheque-tenders]] · [[history-overview]]
