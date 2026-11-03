---
title: "ทะเบียนภาษีซื้อ (gl_journal_vat_buy)"
tags: [tables, gl]
aliases: ["gl_journal_vat_buy", "ภาษีซื้อ", "รายงานภาษีซื้อ", "ใบกำกับภาษีซื้อ", "vat buy register", "ภ.พ.30 ภาษีซื้อ"]
sources: ["backend/internal/application/process/journaltax.go:154", "backend/internal/application/process/journaltax.go:178", "backend/internal/application/process/trans_tax.go:37", "backend/internal/application/process/trans_tax.go:74", "backend/internal/application/process/trans_tax.go:99", "backend/internal/application/process/trans_tax.go:199", "backend/internal/application/process/trans_tax.go:252", "backend/internal/application/process/trans_tax_doc_no.go:26", "backend/internal/application/process/gl_template.go:789", "backend/internal/application/process/report_menu_gl_fa.go:1040", "backend/internal/application/process/report_menu_gl_fa.go:1718"]
---

# ทะเบียนภาษีซื้อ (`gl_journal_vat_buy`)

ทะเบียน/รายงานภาษีซื้อ (ใบกำกับภาษีที่เราซื้อ) 1 แถวต่อ 1 ใบกำกับภาษีของเอกสาร ใช้ทำรายงานภาษีซื้อ (ภ.พ.30) และเป็นแหล่งยอดภาษีซื้อที่ระบบ GL ดึงไปลงบัญชี ฝั่งขายคือ [[tbl-gl-journal-vat-sale]] ภาพรวมการเก็บ/คำนวณอยู่ใน [[acc-vat-register-wht]]

## คอลัมน์สำคัญ

| คอลัมน์ | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `doc_no`, `doc_date`, `trans_flag` | เอกสารเจ้าของแถว (คีย์ร่วมกับ trans_flag) | ลบ/สร้างใหม่ `trans_tax.go:99` |
| `book_code` | เก็บว่างตอน insert | `journaltax.go:154` |
| `line_number` | ลำดับแถวในแท็บภาษี เริ่มจาก 0 | `journaltax.go:178` |
| `vat_calc` | เครื่องหมายคูณยอด: 1 ปกติ, -1 ใบลดหนี้/ส่งคืน (เก็บยอดบวกแล้วคูณเครื่องหมายตอนรายงาน) | `trans_tax.go:37`, `report_menu_gl_fa.go:1042-1046` |
| `trans_type` | ประเภทรายการของเอกสาร (ซื้อ/ขายฯ) | `journaltax.go:154` |
| `vat_date` | วันที่ใบกำกับภาษี | รายงาน |
| `vat_doc_no` | เลขที่ใบกำกับภาษี | รายงาน, `trans_tax_doc_no.go:29` |
| `vat_new_number` | เลขที่ใบกำกับใหม่ (ซื้อเท่านั้น) | `journaltax.go:27` |
| `vat_effective_period`, `vat_effective_year` | เดือน/ปีภาษีที่ยื่น (ปี ค.ศ.) | `journaltax.go:28-29` |
| `vat_description` | รายละเอียด | `journaltax.go:155` |
| `vat_group` | กลุ่มภาษี อ้าง `gl_tax_group.code` | `journaltax.go:155` |
| `vat_base_amount`, `vat_rate`, `vat_amount`, `vat_total_amount`, `vat_except_amount_1` | ฐานภาษี, อัตรา (ทศนิยม 4), ภาษี, ยอดรวม, ยอดยกเว้น | รายงาน, `gl_template.go:789-839` |
| `vat_type` | 0 ปรกติ, 1 ขอคืนไม่ได้, 2 ไม่ถึงกำหนดชำระ | `journaltax.go:38`, `gl_template.go:790-793` |
| `vat_average` | เฉลี่ยภาษี (ค่า int ซื้อเท่านั้น ความหมายละเอียด: ไม่ชัดจากโค้ด) | `journaltax.go:27` |
| `is_add` | 1 = ยื่นเพิ่มเติม | รายงาน |
| `ap_code`, `ap_name`, `tax_no`, `branch_type`, `branch_code` | เจ้าหนี้ (รหัส/ชื่อ/เลขผู้เสียภาษี/สำนักงานใหญ่ 0 สาขา 1/รหัสสาขา) | รายงาน |
| `manual_add` | 1 = ผู้ใช้กรอกชื่อ/เลขผู้เสียภาษี/สาขาเอง ไม่ดึงจากทะเบียนเจ้าหนี้ | `journaltax.go:154` |
| `ref_vat_no`, `ref_vat_date`, `ref_doc_no`, `ref_doc_date` | ใบกำกับ/เอกสารอ้างอิง ใช้กับเอกสารจ่ายชำระ 19 ที่ล้างภาษีที่ยังไม่ถึงกำหนด | `journaltax.go:46-49`, `gl_template.go:834-835` |

## คีย์และความสัมพันธ์
- เจ้าของแถว: เอกสาร [[tbl-ic-trans]] (ซื้อ/รับสินค้า/ตั้งหนี้ ตาม `transVatTabs` ฝั่ง buy) หรือ [[tbl-ap-ar-trans]] (จ่ายชำระ 19) หรือ JV ทำมือ ([[tbl-gl-journal]] `trans_flag` 0/1999)
- เจ้าหนี้: [[tbl-ap-supplier]] (`ap_code`) ชื่อ/เลขผู้เสียภาษีดึงจาก `ap_supplier` และ `ap_supplier_detail` ถ้าผู้ใช้ไม่กรอก
- กลุ่มภาษี: `gl_tax_group`
- ฝั่ง WHT ของเอกสารเดียวกัน: [[tbl-gl-wht-list]]
- ค่าเฉพาะ: ใบกำกับซ้ำต้องไม่เกิด คีย์ไม่ซ้ำ (`ap_code`, `vat_doc_no`, `vat_calc`) ตามคอมเมนต์ `journaltax.go:184` และข้อจำกัด `pk_ap_code_tax_no` ตามคอมเมนต์ `trans_tax_doc_no.go:20`

## ใครเขียน (writers)
- แท็บภาษีซื้อของ JV ทำมือ: `journalVatStmts` `journaltax.go:178` ผ่าน `vatInsertSQL(false)` `journaltax.go:154` (flag 0/1999)
- เอกสาร [[tbl-ic-trans]] ที่มีแท็บภาษีซื้อ (flag 12,14,16,87,89,91,260,262,264,315,316,317,461 และมัดจำ 11,25): `transTaxStmts` `trans_tax.go:109` สร้างแถวเดียวจากหัวเอกสารด้วย `defaultTransVat` `trans_tax.go:74` ยกเว้นติ๊กภาษีทำมือ (`is_manual_vat = 1`) จะเก็บตามที่ผู้ใช้คีย์
- เอกสารจ่ายชำระหนี้ 19: `apArTaxTabs` `trans_tax.go:53`
- ยกเลิก/คำนวณใหม่: `RebuildTransTax` `trans_tax.go:252` สร้างแถวของ `ic_trans`/`as_trans` ใหม่จากหัวเอกสาร โดยข้ามเอกสารที่เป็นภาษีทำมือหรือมีหลายแถว (ผู้ใช้คีย์เอง)

## ใครลบและใครอ่าน
- ลบ: ลบ JV `journaltax.go:89-90`, `journaltax.go:130-131`; ลบเอกสารตาม flag `trans_tax.go:199-203`; ล้างแถวกำพร้าที่เอกสารต้นทางหายไป `trans_tax.go:243`
- อ่าน: รายงานภาษีซื้อ (กรอง `vat_type in (0)`) `report_menu_gl_fa.go:1040-1135`; รายงานที่ join `ic_trans.last_status` `report_menu_gl_fa.go:1718`; ยอดภาษีซื้อที่ลง GL `gl_template.go:789-839`; ตรวจเลขใบกำกับซ้ำ `trans_tax_doc_no.go:29`

## ข้อควรระวัง
- เอกสารที่ถูกยกเลิก (`ic_trans.last_status = 1`) **แถวภาษียังอยู่** รายงานตั้งยอดเป็น 0 ผ่าน `calc` (`report_menu_gl_fa.go:1046`) ห้ามนับ SUM ตารางนี้ตรง ๆ โดยไม่ join สถานะเอกสาร
- เอกสารที่ `vat_type = 3` (ไม่กระทบภาษี) ไม่มีแถวภาษี (`trans_tax.go:74`)
- `vat_type` 1/2 ใช้แยกภาษีซื้อขอคืนไม่ได้และภาษีซื้อไม่ถึงกำหนดไปลงบัญชีพักตอน GL (`gl_template.go:790-793`) ถ้าแก้ค่านี้ต้อง rebuild GL ของเอกสารนั้น ([[acc-gl-rebuild]])
- ปีใน `vat_effective_year` เก็บเป็น ค.ศ. เสมอ หน้าจอแปลงตาม `erp_option.year_type` (`journaltax.go:29`)
- ตรวจเลขใบกำกับซ้ำที่ฝั่งซื้อใช้ (`ap_code`, `UPPER(vat_doc_no)`, `trans_flag`) ฝั่งขายใช้ `UPPER(vat_number)` ล้วน ๆ (`trans_tax_doc_no.go:26-29`)
- เงินเป็น NUMERIC ส่งเป็น string ([[acc-rounding-decimal]])

## ที่มาในโค้ด
- `backend/internal/application/process/journaltax.go:28` โครง `JournalVat`
- `backend/internal/application/process/journaltax.go:154` `vatInsertSQL`
- `backend/internal/application/process/journaltax.go:178` `journalVatStmts`
- `backend/internal/application/process/journaltax.go:89` ลบ JV
- `backend/internal/application/process/trans_tax.go:37` `transVatTabs`
- `backend/internal/application/process/trans_tax.go:74` `defaultTransVat`
- `backend/internal/application/process/trans_tax.go:99` `transVatStmts`
- `backend/internal/application/process/trans_tax.go:199` ลบตาม flag
- `backend/internal/application/process/trans_tax.go:252` `RebuildTransTax`
- `backend/internal/application/process/trans_tax_doc_no.go:26` ตรวจเลขซ้ำ
- `backend/internal/application/process/gl_template.go:789` ยอดภาษีซื้อลง GL
- `backend/internal/application/process/report_menu_gl_fa.go:1040` รายงานภาษีซื้อ/ขาย
- `backend/internal/application/process/report_menu_gl_fa.go:1718` join last_status

## ดูเพิ่ม
- [[tbl-group-gl]]
- [[acc-vat-register-wht]]
- [[acc-gl-posting-standard]]
