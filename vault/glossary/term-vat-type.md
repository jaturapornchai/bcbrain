---
title: "ประเภทภาษี แยกนอก/รวมใน และภาษีซื้อ-ขาย (VAT type / vat_type / gl_journal_vat_buy / gl_journal_vat_sale)"
tags: [glossary, tax, vat]
aliases: ["vat_type", "vatType", "ประเภทภาษี", "แยกนอก", "รวมใน", "ยกเว้นภาษี", "ไม่กระทบภาษี", "Exclude VAT", "Include VAT", "vat_rate", "อัตราภาษี", "ภาษีซื้อ", "ภาษีขาย", "ใบกำกับภาษี", "เลขที่ใบกำกับภาษี", "tax_doc_no", "tax_doc_date", "vat_calc", "is_manual_vat", "ขอคืนไม่ได้", "ไม่ถึงกำหนดชำระ", "เดือนภาษี", "ปีภาษี", "vat_effective_period", "vat_effective_year", "ภ.พ.30", "ฐานภาษี", "ยื่นเพิ่มเติม", "is_add", "gl_journal_vat_buy", "gl_journal_vat_sale", "VAT"]
sources: ["frontend/account/transaction/transLayouts.ts:1", "frontend/account/transaction/transLayouts.ts:10", "frontend/account/transaction/TransTopForm.tsx:310", "frontend/account/transaction/TransTopForm.tsx:330", "frontend/account/transaction/TransTopForm.tsx:373", "frontend/account/transaction/JournalTaxTabs.tsx:29", "frontend/account/transaction/JournalTaxTabs.tsx:225", "frontend/account/transaction/JournalTaxTabs.tsx:236", "frontend/account/transaction/JournalTaxTabs.tsx:333", "backend/internal/application/process/trans_tax.go:16", "backend/internal/application/process/trans_tax.go:39", "backend/internal/application/process/trans_tax.go:69", "backend/internal/application/process/journaltax.go:24", "backend/internal/application/process/journaltax.go:154", "backend/internal/application/process/journaltax.go:191", "frontend/src/config/bcMenu.json:9695"]
---

# ประเภทภาษี (vat_type) และทะเบียนภาษีซื้อ/ขาย

## ในระบบนี้คืออะไร
คำว่า "ประเภทภาษี" ใช้กับสองที่ที่ต่างกัน
1. **หัวเอกสาร** `ic_trans.vat_type` บอกว่าราคาในเอกสารคิด VAT แบบใด ตัวเลือกบนจอ (`VAT_TYPE_OPTIONS`, `transLayouts.ts:10-15`) อ้างอิง `_g.g._vatTypeEnum` ของ BCERP
2. **แถวภาษีในแท็บภาษีซื้อ/ภาษีขาย** `gl_journal_vat_buy.vat_type` หรือ `gl_journal_vat_sale.vat_type` บอกชนิดของภาษีในแถวนั้น

## ค่าที่เป็นไปได้
**หัวเอกสาร** (`transLayouts.ts:1-15`)
| ค่า | ป้าย | ความหมายตามคอมเมนต์ |
|---|---|---|
| 0 | แยกนอก | Exclude VAT |
| 1 | รวมใน | Include VAT |
| 2 | ยกเว้นภาษี | Zero / Exempt VAT |
| 3 | ไม่กระทบภาษี | No VAT ระบบไม่สร้างแถวภาษี (`trans_tax.go:69-72`) |

**แถวภาษีซื้อ/ขาย** (`journaltax.go:38`, `JournalTaxTabs.tsx:225`)
- ภาษีซื้อ: 0 ปรกติ, 1 ขอคืนไม่ได้, 2 ไม่ถึงกำหนดชำระ
- ภาษีขาย: 0 ปรกติ, 1 ไม่ถึงกำหนดชำระ
- `branch_type`: 0 สำนักงานใหญ่, 1 สาขา (`journaltax.go:42`, `JournalTaxTabs.tsx:226`)

**vat_calc**: 1 = ปกติ, −1 = ใบลดหนี้ ใบลดหนี้เก็บยอดเป็นบวกแล้วใช้ vat_calc −1 กลับเครื่องหมาย (`trans_tax.go:36-43`)

## identifier / ตาราง / คอลัมน์
| ป้ายบนจอ (`JournalTaxTabs.tsx:236-275`) | ภาษีซื้อ `gl_journal_vat_buy` | ภาษีขาย `gl_journal_vat_sale` |
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
คอลัมน์ร่วมได้แก่ `doc_no`, `doc_date`, `book_code`, `line_number`, `vat_calc`, `trans_type`, `trans_flag`, `vat_date`, `manual_add`, `ref_vat_no`, `ref_vat_date`, `ref_doc_no`, `ref_doc_date` (`journaltax.go:154-170`)

หัวเอกสาร: "อัตราภาษี" `vat_rate` (`TransTopForm.tsx:330`), "เลขที่ใบกำกับภาษี" `tax_doc_no`, "ลงวันที่" `tax_doc_date` (`:373`, `:383`)

## flag ที่มีแท็บภาษี (`trans_tax.go:39-44`)
- ภาษีซื้อ: 12, 14, 16, 87, 89, 91, 260, 262, 264, 315, 316, 317, 461, 11, 25
- ภาษีขาย: 44, 46, 48, 99, 101, 103, 144, 250, 252, 254, 1802, 110, 112
- เอกสารชำระหนี้ 19 (ภาษีซื้อ) และ 239 (ภาษีขาย) มีแท็บภาษีที่ผู้ใช้กรอกเอง (`trans_tax.go:55`, `JournalTaxTabs.tsx:37-40`)

## ข้อควรระวัง
- แถวภาษีของเอกสารปกติเป็น **ข้อมูล derived** ระบบสร้างใหม่จาก `ic_trans` ทุกครั้งที่บันทึก ยกเว้นเอกสารซื้อที่ `is_manual_vat = 1` และแถว WHT ซึ่งเป็นข้อมูลที่ผู้ใช้กรอก (raw) (`trans_tax.go:16-22`)
- เลขที่ใบกำกับภาษีซ้ำจะบันทึกไม่ได้ ระบบแจ้ง "เลขที่ใบกำกับภาษี … ซ้ำ" (`journaltax.go:191`) อัตราภาษีต้องอยู่ระหว่าง 0 ถึง 15 (`JournalTaxTabs.tsx:333`)
- คอมเมนต์อ้าง ม.78/1(1) และ ม.86 ประมวลรัษฎากรไว้เพื่ออธิบายภาษีที่ถึงกำหนดตอนชำระ (`trans_tax.go:24-26`) โน้ตนี้ไม่ได้ตีความกฎหมายเพิ่ม
- เอกสารยกเลิกยังเก็บแถวภาษีไว้ แต่รายงานแสดงเป็นศูนย์ ดู [[term-last-status-cancel-approve]]

## หน้าจอ
แท็บภาษีซื้อและภาษีขายใน `JournalTaxTabs.tsx` และรายงานภาษีมูลค่าเพิ่ม (ภ.พ.30) (`menu_gl_vat`, bcMenu.json:9695) ได้แก่ รายงานภาษีขาย (:9708) และรายงานภาษีซื้อ (:9786)

## ลิงก์
[[acc-vat-register-wht]] · [[term-wht]] · [[term-doc-totals]] · [[term-tax-id-branch]] · [[acc-rounding-decimal]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/account/transaction/transLayouts.ts:1-15`
- `frontend/account/transaction/TransTopForm.tsx:310`, `:330`, `:373`, `:383`
- `frontend/account/transaction/JournalTaxTabs.tsx:29-40`, `:225-226`, `:236-275`, `:333`
- `backend/internal/application/process/trans_tax.go:16-26`, `:36-44`, `:55`, `:69-72`
- `backend/internal/application/process/journaltax.go:24-49`, `:154-170`, `:191`
- `frontend/src/config/bcMenu.json:9695`, `:9708`, `:9786`
