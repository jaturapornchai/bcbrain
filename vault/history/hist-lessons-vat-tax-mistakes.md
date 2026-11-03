---
title: "บทเรียนบั๊กภาษีมูลค่าเพิ่มและภาษีหัก ณ ที่จ่าย (VAT, WHT & e-Tax Mistakes)"
tags: [history, vat, tax, wht, etax]
aliases: ["ภาษีขาด รายงาน ภ.พ.30", "vat_effective_year", "tax_doc_no ซ้ำ", "WHT นับเอกสารยกเลิก"]
sources: ["git:6983d7ea", "git:65dc0666", "git:68f5a4d4", "git:7ff7d659", "git:a3809aba", "git:13f953cc", "git:5f188fc3", "backend/internal/application/process/report_menu_gl_fa.go:1023"]
---

## ภาพรวม
ปัญหาภาษีส่วนใหญ่ไม่ใช่สูตร แต่เป็นแถวภาษีที่ไม่ถูกลงทะเบียน, ปีภาษีเก็บคนละระบบ (พ.ศ./ค.ศ.), เลขใบกำกับซ้ำ และรายงานนับเอกสารที่ยกเลิก ช่วง 2026-10-19 .. 2026-10-29 เนื้อหามาจากโค้ดและ commit ยังไม่ได้ตรวจกับต้นทางสรรพากร (ข้อ 17) ดู [[acc-vat-register-wht]]

## อาการ
- **V1 ปีภาษี (68f5a4d4, 13f953cc):** รายงานภาษีขาย/ซื้อ/ภ.พ.30 ไม่นับรายการที่บันทึกตั้งแต่ 24/10 (UAT S1 #16) เพราะเก็บ `vat_effective_year` เป็น ค.ศ. แต่รายงานลบ 543 เสมอ
- **V2 แถวภาษีหาย (6983d7ea, 65dc0666, 13f953cc):** ใบจ่าย/รับชำระหนี้ 19/239 และขายสินทรัพย์ 1802 ไม่มีแท็บ/แถวภาษี; เงินมัดจำ VAT (11/25/110/112) ไม่ลงทะเบียนภาษี ทั้งที่ GL ลงแล้ว (#17); รายงานภาษีหัก ณ ที่จ่ายนับใบที่ยกเลิก (#8, #18)
- **V3 อัตรา VAT เป็น 0 (a3809aba):** ตามชื่อ commit แถวภาษีหัวบิลมีฐานและภาษีแต่อัตราว่าง
- **V4 เลขใบกำกับซ้ำ (7ff7d659):** `tax_doc_no` ไม่ตามเลขที่เอกสารที่พิมพ์และไม่ตรวจซ้ำ
- **V5 กฎภาษีซื้อตอนบันทึก (5f188fc3):** ตามชื่อ commit เพิ่มกฎตรวจ input VAT ตาม C#
- **V6 อื่นๆ:** e-Tax ปัดสตางค์ (a47413ec, ดู [[hist-lessons-rounding-decimal]]); ภาษีหลายใบกำกับ (6e9ae03e) และ e-VRT (d6bfe1b5) เป็นฟีเจอร์

## สาเหตุ (root cause)
- **V1:** เดิมโค้ดเก็บ +543; ลุงจืดตัดสินวันที่ 2026-10-24 ว่าฐานข้อมูลเก็บ ค.ศ. เท่านั้น จอแปลงตาม `year_type` แต่ SQL รายงาน `glfaPeriodSQL` ยังลบ 543 ทุกแถว
- **V2:** backend ยังไม่เขียนแถว VAT/WHT ของ 19/239 และ WHT ของ 1802 (ตามข้อความ 6983d7ea); `transVatTabs` ไม่มี flag มัดจำ; รายงาน WHT หา `last_status` จาก `ic_trans` อย่างเดียว ทั้งที่ 19/239 อยู่ใน `ap_ar_trans` (diff 13f953cc)
- **V3:** `trans_tax.go` ใช้ `h.vatRate` ตรง ๆ
- **V4:** ไม่มีการตรวจเลขใบกำกับซ้ำเลยก่อน 7ff7d659

## วิธีแก้
- **V1:** ค่าเริ่ม `vat_effective_year` = ปีของวันที่ภาษี (ค.ศ.); `JournalTaxTabs` แสดงตาม `year_type` และแปลงค่า > 2400 กลับ ค.ศ.; SQL รายงานลบ 543 เฉพาะค่า > 2400
- **V2:** backend ยังไม่เขียนแถว VAT/WHT ของ 19/239 และ WHT ของ 1802 (ตามข้อความ 6983d7ea); `transVatTabs` ไม่มี flag มัดจำ; รายงาน WHT หา `last_status` จาก `ic_trans` อย่างเดียว ทั้งที่ 19/239 อยู่ใน `ap_ar_trans` (diff 13f953cc)
- **V3:** ถ้าอัตราเป็น 0 แต่ฐานและภาษีมีค่า ให้คำนวณอัตราจากภาษี x 100 / ฐาน ปัดสองตำแหน่ง
- **V4:** ไม่มีการตรวจเลขใบกำกับซ้ำเลยก่อน 7ff7d659
- **V5:** ตัวเลือก `erp_option.check_input_vat` ตรวจเฉพาะ flag ใน `inputVatFlags` และ vat_type 0/1

## commit ที่เกี่ยวข้อง
- `6983d7ea` / `65dc0666` — VAT/WHT ของ 19/239/1802 และแท็บหน้าจอ
- `68f5a4d4` — เก็บปีภาษีเป็น ค.ศ.
- `13f953cc` — รายงานปี > 2400, flag มัดจำ, สถานะยกเลิก
- `a3809aba` — อัตรา VAT เป็น 0
- `7ff7d659` — `tax_doc_no` ตามเลขเอกสาร + ตรวจซ้ำ
- `5f188fc3` — กฎภาษีซื้อ; `a47413ec`, `4d6cb8de` (ดูบันทึกปัดเศษ)
- `6e9ae03e` / `d6bfe1b5` — ภาษีหลายใบกำกับ / e-VRT (ตามข้อความ commit; backend ของ d6bfe1b5 แก้แค่ป้ายรูปแนบ `etax/handler.go:902`; ประกาศสรรพากรที่ commit อ้างยังไม่ verify)

## โค้ดปัจจุบันที่ป้องกัน
- `backend/internal/application/process/report_menu_gl_fa.go:1023` `glfaPeriodSQL`; เทส `uat_s1_fixes_test.go:139`
- `backend/internal/application/process/trans_tax.go:37` `transVatTabs` (เทส `uat_s1_fixes_test.go:146`); `:80` คำนวณอัตราย้อนกลับ
- `backend/internal/application/process/journaltax.go:29` ปีเป็น ค.ศ.; `:153` `vatInsertSQL`
- `backend/internal/application/process/trans_tax_doc_no.go:18` `checkTaxDocNo`; เทส `trans_tax_doc_no_test.go:16`
- `backend/internal/application/process/trans_save_rules.go:53` `inputVatFlags`, `:140` ตรวจ `checkInputVat`

## บทเรียน / กฎที่ได้
- เก็บปีเป็น ค.ศ. ที่เดียว แปลงเฉพาะที่จอ และ SQL ที่อ่านปีต้องรองรับค่าเก่า (> 2400) ต่อไป
- ทุกชนิดเอกสารที่ GL ลงภาษีต้องมีแถวทะเบียนภาษีคู่กันเสมอ เทสด้วยตาราง flag
- สถานะยกเลิกอยู่คนละตารางตามชนิดเอกสาร รายงานต้องเลือกตารางตาม `trans_flag`
- การตรวจเลขใบกำกับซ้ำต้องล็อก ไม่งั้นสองคำขอผ่านพร้อมกัน

## ดูเพิ่ม
[[acc-vat-register-wht]] · [[hist-lessons-rounding-decimal]] · [[hist-lessons-dates-buddhist-year]] · [[hist-lessons-payment-cheque-tenders]] · [[history-overview]]

## ที่มาในโค้ด
- git: `6983d7ea`, `65dc0666`, `68f5a4d4`, `7ff7d659`, `a3809aba`, `13f953cc`, `5f188fc3`, `6e9ae03e`, `d6bfe1b5`
- `tests/uat/out/20261028/summary.md` (#8, #16-#18), `docs/HANDOFF_BCCM_PARITY_2026-10-22.md` (TAXDOC-OVERRIDE)
