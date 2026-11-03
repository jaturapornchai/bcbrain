---
title: "ประเภทภาษี แยกนอก/รวมใน และภาษีซื้อ-ขาย (VAT type / vat_type / gl_journal_vat_buy / gl_journal_vat_sale)"
tags: [glossary, tax, vat]
aliases: ["vat_type", "vatType", "ประเภทภาษี", "แยกนอก", "รวมใน", "ยกเว้นภาษี", "ไม่กระทบภาษี", "Exclude VAT", "Include VAT", "vat_rate", "อัตราภาษี", "ภาษีซื้อ", "ภาษีขาย", "ใบกำกับภาษี", "เลขที่ใบกำกับภาษี", "tax_doc_no", "tax_doc_date", "vat_calc", "is_manual_vat", "ขอคืนไม่ได้", "ไม่ถึงกำหนดชำระ", "เดือนภาษี", "ปีภาษี", "vat_effective_period", "vat_effective_year", "ภ.พ.30", "ฐานภาษี", "ยื่นเพิ่มเติม", "is_add", "gl_journal_vat_buy", "gl_journal_vat_sale", "VAT"]
sources: ["frontend/account/transaction/transLayouts.ts:1", "frontend/account/transaction/transLayouts.ts:10", "frontend/account/transaction/transLayouts.ts:319", "frontend/account/transaction/TransTopForm.tsx:310", "frontend/account/transaction/TransTopForm.tsx:326", "frontend/account/transaction/TransTopForm.tsx:331", "frontend/account/transaction/TransTopForm.tsx:375", "frontend/account/transaction/TransTopForm.tsx:385", "frontend/account/transaction/JournalTaxTabs.tsx:29", "frontend/account/transaction/JournalTaxTabs.tsx:225", "frontend/account/transaction/JournalTaxTabs.tsx:38", "frontend/account/transaction/JournalTaxTabs.tsx:235", "frontend/account/transaction/JournalTaxTabs.tsx:333", "frontend/account/transaction/JournalTaxTabs.tsx:557", "frontend/account/transaction/JournalTaxTabs.tsx:743", "backend/internal/application/process/trans_tax.go:37", "backend/internal/application/process/trans_tax.go:53", "backend/internal/application/process/trans_tax.go:74", "backend/internal/application/process/trans_tax.go:109", "backend/internal/application/process/trans_tax.go:224", "backend/internal/application/process/trans_tax.go:327", "backend/internal/application/process/journaltax.go:24", "backend/internal/application/process/journaltax.go:155", "backend/internal/application/process/journaltax.go:179", "backend/internal/application/process/journaltax.go:191", "frontend/src/config/bcMenu.json:9695", "backend/internal/application/process/transcalc.go:32", "backend/internal/application/process/transcalc.go:83", "backend/internal/application/process/transcalc.go:149", "backend/internal/application/process/report_menu_gl_fa.go:1045"]
---

# ประเภทภาษี (vat_type) และทะเบียนภาษีซื้อ/ขาย

## ในระบบนี้คืออะไร
คำว่า "ประเภทภาษี" ใช้กับสองที่ที่ต่างกัน
1. **หัวเอกสาร** `ic_trans.vat_type` บอกว่าราคาในเอกสารคิด VAT แบบใด ตัวเลือกบนจอ (`VAT_TYPE_OPTIONS`, `transLayouts.ts:10-15`) มี 4 ค่า ช่อง "ภาษี" นี้ไม่แสดงในเอกสารเคลื่อนไหวสต็อกและจอเงินสด/ธนาคารส่วนใหญ่ (`showVatType`, `transLayouts.ts:319-321`, `transcalc.go:32-43`)
2. **แถวภาษีในแท็บภาษีซื้อ/ภาษีขาย** `gl_journal_vat_buy.vat_type` หรือ `gl_journal_vat_sale.vat_type` บอกชนิดของภาษีในแถวนั้น

## ค่าที่เป็นไปได้
**หัวเอกสาร** (`transLayouts.ts:10-15`, ชนิดข้อมูล `VatTypeEnum` `:1`)
| ค่า | ป้าย | ผลต่อยอดเอกสาร |
|---|---|---|
| 0 | แยกนอก | คิด VAT บวกเพิ่มจากฐาน (`transcalc.go:150`) |
| 1 | รวมใน | ราคารวม VAT แล้ว ระบบถอดภาษีออกจากยอด (`transcalc.go:175-200`) |
| 2 | ยกเว้นภาษี | ไม่คิด VAT ทุกบรรทัดนับเป็นยอดไม่มีภาษี และช่องอัตราภาษีบนจอถูกปิด (`transcalc.go:83`, `:201`, `TransTopForm.tsx:331`) |
| 3 | ไม่กระทบภาษี | คิดเหมือนค่า 2 และระบบไม่สร้างแถวภาษี (`trans_tax.go:74-77`) |

**แถวภาษีซื้อ/ขาย** (`journaltax.go:38`, `JournalTaxTabs.tsx:225`; backend รับภาษีซื้อ 0-2 และภาษีขาย 0-1 ที่ `journaltax.go:179-181`, `:194`)
- ภาษีซื้อ: 0 ปรกติ, 1 ขอคืนไม่ได้, 2 ไม่ถึงกำหนดชำระ
- ภาษีขาย: 0 ปรกติ, 1 ไม่ถึงกำหนดชำระ
- `branch_type`: 0 สำนักงานใหญ่, 1 สาขา (`journaltax.go:42`, `JournalTaxTabs.tsx:226`)

**vat_calc**: 1 = ปกติ, −1 = ใบลดหนี้ ค่าของแต่ละ flag ตั้งไว้ใน `transVatTabs` (`trans_tax.go:37-43` เช่น 16 และ 48 ได้ −1) และรายงานภาษีคูณยอดด้วย `vat_calc` (`report_menu_gl_fa.go:1045`)

## identifier / ตาราง / คอลัมน์
| ป้ายบนจอภาษีซื้อ (`JournalTaxTabs.tsx:235-275`) | ภาษีซื้อ `gl_journal_vat_buy` | ภาษีขาย `gl_journal_vat_sale` |
|---|---|---|
| เลขที่ใบกำกับ | `vat_doc_no` | `vat_number` |
| เลขที่ออกใหม่ | `vat_new_number` | — |
| เดือนภาษี / ปีภาษี | `vat_effective_period` / `vat_effective_year` (ค.ศ.) | เหมือนกัน |
| รายละเอียด | `vat_description` | `description` |
| กลุ่มภาษี | `vat_group` | `tax_group` |
| ฐานภาษี | `vat_base_amount` | `base_caltax_amount` |
| อัตราภาษี | `vat_rate` | `tax_rate` |
| เงินภาษี / ยอดภาษี | `vat_amount` | `amount` |
| ยอดยกเว้น | `vat_except_amount_1` | `except_tax_amount` |
| ยอดรวม / เฉลี่ยภาษี | `vat_total_amount` / `vat_average` | — |
| ยื่นเพิ่มเติม | `is_add` | `is_add` |
| ชื่อผู้ขายสินค้า/ผู้ให้บริการ | `ap_name` | `ar_name` |
| เลขประจำตัวผู้เสียภาษี | `tax_no` | `tax_no` |
| สถานประกอบการ / เลขที่สาขา | `branch_type` / `branch_code` | เหมือนกัน |
คอลัมน์ร่วมได้แก่ `doc_no`, `doc_date`, `book_code`, `line_number`, `vat_calc`, `trans_type`, `trans_flag`, `vat_date`, `manual_add`, `ref_vat_no`, `ref_vat_date`, `ref_doc_no`, `ref_doc_date` (`journaltax.go:155-165`)
ป้ายของภาษีขายต่างจากตารางนี้ 5 จุด คือ "เลขที่ใบกำกับภาษี", "ยอดภาษี", "ยอดยกเว้นภาษี", "ชื่อผู้ซื้อสินค้า/ผู้รับบริการ" และ "ลำดับที่สาขา" (`JournalTaxTabs.tsx:259-275`)

หัวเอกสาร: "อัตราภาษี" `vat_rate` (`TransTopForm.tsx:326-334`), "เลขที่ใบกำกับภาษี" `tax_doc_no`, "ลงวันที่" `tax_doc_date` (`:375`, `:385`) สองช่องหลังแสดงเฉพาะบาง flag (`showTaxDoc`, `transLayouts.ts:322-325`)

## flag ที่มีแท็บภาษี (`transVatTabs`, `trans_tax.go:37-43`)
- ภาษีซื้อ: 12, 14, 16, 87, 89, 91, 260, 262, 264, 315, 316, 317, 461, 11, 25
- ภาษีขาย: 44, 46, 48, 99, 101, 103, 144, 250, 252, 254, 1802, 110, 112
- เอกสารชำระหนี้ 19 (ภาษีซื้อ) และ 239 (ภาษีขาย) มีแท็บภาษีที่ผู้ใช้กรอกเอง (`apArTaxTabs`, `trans_tax.go:53`, `JournalTaxTabs.tsx:38-41`) และมีปุ่ม "ค้นหาใบกำกับภาษีไม่ถึงกำหนดชำระ" ที่ใช้ได้เมื่อใส่รหัสลูกหนี้/เจ้าหนี้แล้ว (`JournalTaxTabs.tsx:735-743`)

## ข้อควรระวัง
- แถวภาษีของเอกสารปกติเป็น **ข้อมูล derived** ระบบสร้างใหม่จาก `ic_trans` ทุกครั้งที่บันทึก (`transTaxStmts`, `trans_tax.go:115-122`) ยกเว้นเมื่อผู้ใช้ส่งแถวภาษีเอง (`ManualVat` หรือมีมากกว่า 1 แถว) ซึ่งเก็บตามที่ส่งและตั้ง `ic_trans.is_manual_vat = 1` (`:115`, `:128-130`) งานสร้างภาษีใหม่ (`RebuildTransTax`) ข้ามเอกสารกลุ่มนี้ (`:224-234`, `:327-330`) ส่วนแถว WHT เป็นข้อมูลที่ผู้ใช้กรอก (raw) เก็บตามที่ส่ง (`:132-142`)
- เลขที่ใบกำกับภาษีซ้ำจะบันทึกไม่ได้ ระบบแจ้ง "เลขที่ใบกำกับภาษี … ซ้ำ" (`journaltax.go:191`) อัตราภาษีในแท็บภาษีที่อยู่นอกช่วง 0 ถึง 15 ขึ้นคำเตือนบนจอ (`JournalTaxTabs.tsx:333`, `:557`)
- เอกสารยกเลิกยังเก็บแถวภาษีไว้ แต่รายงานแสดงเป็นศูนย์ (`report_menu_gl_fa.go:1045`) ดู [[term-last-status-cancel-approve]]

## หน้าจอ
แท็บภาษีซื้อและภาษีขายใน `JournalTaxTabs.tsx` และรายงานภาษีมูลค่าเพิ่ม (ภ.พ.30) (`menu_gl_vat`, bcMenu.json:9695) ได้แก่ รายงานภาษีขาย (:9708) และรายงานภาษีซื้อ (:9786)

## ลิงก์
[[acc-vat-register-wht]] · [[term-wht]] · [[term-doc-totals]] · [[term-tax-id-branch]] · [[acc-rounding-decimal]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/account/transaction/transLayouts.ts:1`, `:10-15`, `:319-325`
- `frontend/account/transaction/TransTopForm.tsx:310-334`, `:372-388`
- `frontend/account/transaction/JournalTaxTabs.tsx:29-41`, `:225-226`, `:235-275`, `:333`, `:557`, `:735-743`
- `backend/internal/application/process/trans_tax.go:37-43`, `:53`, `:74-77`, `:109-144`, `:224-234`, `:327-331`
- `backend/internal/application/process/transcalc.go:32-43`, `:83`, `:149-201`; `report_menu_gl_fa.go:1045`, `:1049`
- `backend/internal/application/process/journaltax.go:24-49`, `:155-165`, `:179-181`, `:191`, `:194`
- `frontend/src/config/bcMenu.json:9695`, `:9708`, `:9786`
