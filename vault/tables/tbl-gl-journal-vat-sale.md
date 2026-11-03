---
title: "ทะเบียนภาษีขาย (gl_journal_vat_sale)"
tags: [tables, gl]
aliases: ["gl_journal_vat_sale", "ภาษีขาย", "รายงานภาษีขาย", "ใบกำกับภาษีขาย", "vat sale register", "ภ.พ.30 ภาษีขาย"]
sources: ["backend/internal/application/process/journaltax.go:160", "backend/internal/application/process/journaltax.go:178", "backend/internal/application/process/trans_tax.go:37", "backend/internal/application/process/trans_tax.go:99", "backend/internal/application/process/trans_tax.go:252", "backend/internal/application/process/trans_tax_doc_no.go:26", "backend/internal/application/process/fa_sale.go:645", "backend/internal/application/process/gl_template.go:789", "backend/internal/application/process/service.go:928", "backend/internal/application/process/report_menu_gl_fa.go:1040", "backend/internal/application/process/report_menu_gl_fa.go:1715"]
---

# ทะเบียนภาษีขาย (`gl_journal_vat_sale`)

ทะเบียน/รายงานภาษีขาย (ใบกำกับภาษีที่เราออกให้ลูกค้า) 1 แถวต่อ 1 ใบกำกับของเอกสาร ใช้ทำรายงานภาษีขาย (ภ.พ.30) และเป็นแหล่งยอดภาษีขายที่ GL ดึงไปลงบัญชี ฝั่งซื้อคือ [[tbl-gl-journal-vat-buy]] ชื่อคอลัมน์ฝั่งขายต่างจากฝั่งซื้อ (ยอดภาษีคือ `amount` ไม่ใช่ `vat_amount`) ระวังอย่าเขียน SQL ตามกัน ภาพรวมอยู่ที่ [[acc-vat-register-wht]]

## คอลัมน์สำคัญ

| คอลัมน์ | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `doc_no`, `doc_date`, `trans_flag` | เอกสารเจ้าของแถว | ลบ/สร้างใหม่ `trans_tax.go:99` |
| `book_code`, `line_number` | ว่าง / ลำดับแถวในแท็บภาษี เริ่ม 0 | `journaltax.go:160`, `journaltax.go:178` |
| `vat_calc` | เครื่องหมายคูณยอด 1 ปกติ, -1 ใบลดหนี้/รับคืน | `trans_tax.go:37`, `report_menu_gl_fa.go:1042` |
| `trans_type` | ประเภทรายการของเอกสาร | `journaltax.go:160` |
| `vat_date` | วันที่ใบกำกับภาษี | รายงาน |
| `vat_number` | เลขที่ใบกำกับภาษีขาย (ไม่ซ้ำข้ามทั้งระบบ เทียบแบบตัวใหญ่) | รายงาน, `trans_tax_doc_no.go:26` |
| `vat_effective_period`, `vat_effective_year` | เดือน/ปีภาษีที่ยื่น (ปี ค.ศ.) | `journaltax.go:160` |
| `description` | รายละเอียด | `journaltax.go:160` |
| `tax_group` | กลุ่มภาษี อ้าง `gl_tax_group.code` | `journaltax.go:160` |
| `base_caltax_amount`, `tax_rate`, `amount`, `except_tax_amount` | ฐานภาษี, อัตรา, ยอดภาษี, ยอดยกเว้น | รายงาน `report_menu_gl_fa.go:1040`, `gl_template.go:789-839` |
| `vat_type` | 0 ปรกติ, 1 ไม่ถึงกำหนดชำระ (ฝั่งขายมีแค่ 0-1) | `journaltax.go:38`, `journaltax.go:179-181` |
| `is_add` | 1 = ยื่นเพิ่มเติม | รายงาน |
| `ar_code`, `ar_name`, `tax_no`, `branch_type`, `branch_code` | ลูกหนี้ (รหัส/ชื่อ/เลขผู้เสียภาษี/สำนักงานใหญ่ 0 สาขา 1/รหัสสาขา) | รายงาน |
| `manual_add` | 1 = ผู้ใช้กรอกชื่อ/เลขผู้เสียภาษี/สาขาเอง ไม่ดึงจากทะเบียนลูกหนี้ | `journaltax.go:160` |
| `ref_vat_no`, `ref_vat_date`, `ref_doc_no`, `ref_doc_date` | ใบกำกับ/เอกสารอ้างอิง ใช้กับเอกสารรับชำระ 239 ที่ล้างภาษีไม่ถึงกำหนด | `gl_template.go:836-837` |
| `is_doc_copy` | 1 = แถวสำเนา รายงานตั้งเป็น 0 (ความหมายเต็ม: ไม่ชัดจากโค้ด) | `report_menu_gl_fa.go:1042`, `:1716` |

## คีย์และความสัมพันธ์
- เจ้าของแถว: [[tbl-ic-trans]] (ขาย 44,46,48,99,101,103,144,250,252,254 และมัดจำขาย 110,112), [[tbl-as-trans]] (ขายสินทรัพย์ 1802), [[tbl-ap-ar-trans]] (รับชำระ 239), หรือ JV ทำมือ ([[tbl-gl-journal]] flag 0/1999)
- ลูกหนี้: [[tbl-ar-customer]] (`ar_code`) ชื่อและเลขผู้เสียภาษีดึงจาก `ar_customer` และ `ar_customer_detail` ถ้าผู้ใช้ไม่กรอก
- ฝั่ง WHT ของเอกสารเดียวกัน: [[tbl-gl-wht-list]]
- มีดัชนี `UPPER(vat_number)` สร้างเมื่อคอลัมน์ `vat_number` มี (`service.go:928-931`) ไว้ตรวจเลขใบกำกับซ้ำตอนบันทึก

## ใครเขียน (writers)
- แท็บภาษีขายของ JV ทำมือ: `journalVatStmts` `journaltax.go:178` ผ่าน `vatInsertSQL(true)` `journaltax.go:160`
- เอกสาร [[tbl-ic-trans]]: `transTaxStmts` `trans_tax.go:109` สร้างแถวเดียวจากหัวเอกสาร (`defaultTransVat` `trans_tax.go:74`) เว้น `vat_type = 3` ที่ไม่มีแถวภาษี
- ขายสินทรัพย์ 1802: `insertAssetSaleVat` `fa_sale.go:645` ใช้ `derivedVatStmts` สร้างแถวเดียวกับที่ rebuild จะได้
- เอกสารรับชำระหนี้ 239: `apArTaxTabs` `trans_tax.go:53`
- สร้างใหม่ทั้งชุด: `RebuildTransTax` `trans_tax.go:252` (ข้ามเอกสารที่ผู้ใช้คีย์ภาษีเอง)

## ใครลบและใครอ่าน
- ลบ: JV `journaltax.go:89-90`, `journaltax.go:130-131`; ตามเอกสาร `trans_tax.go:199-203`; แถวกำพร้า `trans_tax.go:243`; ลบเอกสารขายสินทรัพย์ `fa_sale.go:488`
- อ่าน: รายงานภาษีขายและรายงานทางเลือก (2557/รวมภาษี) `report_menu_gl_fa.go:1040-1135`; join กับ `ic_trans.last_status` `report_menu_gl_fa.go:1715`; ยอดภาษีขายที่ลง GL `gl_template.go:789-839`; ตรวจเลขใบกำกับซ้ำ `trans_tax_doc_no.go:26`

## ข้อควรระวัง
- เอกสารยกเลิก (`last_status = 1`) หรือแถวสำเนา (`is_doc_copy = 1`) **แถวยังอยู่** รายงานตั้งยอดเป็น 0 ผ่านเครื่องหมาย `calc` (`report_menu_gl_fa.go:1042`) ห้าม SUM ตรง ๆ
- ภาษีขายที่ `vat_type = 1` (ไม่ถึงกำหนดชำระ) ถูกแยกไปลงบัญชีพักภาษีตอน GL: ฝั่งขายเอกสาร `trans_type = 2` ดึง `SUM(amount)` ของ `vat_type = 1` (`gl_template.go:789`) ถ้าแก้ค่านี้ต้อง rebuild GL ของเอกสาร ([[acc-gl-rebuild]])
- ใบกำกับภาษีขายห้ามซ้ำทั้งระบบ (เทียบ `UPPER(vat_number)`) ต่างจากฝั่งซื้อที่ซ้ำได้ต่างเจ้าหนี้ ตรวจแบบ advisory lock ต่อเลขที่ในขณะบันทึก (`trans_tax_doc_no.go:26-32`)
- เอกสารขายสินทรัพย์ 1802 ใช้ตารางนี้ร่วมกับเอกสารสินค้า ต้องระบุ `trans_flag` ทุกครั้งที่ลบ/อ่านเพื่อไม่ชนกับ `ic_trans` เลขที่เดียวกัน
- เงินเป็น NUMERIC ส่งเป็น string ([[acc-rounding-decimal]])

## ที่มาในโค้ด
- `backend/internal/application/process/journaltax.go:160` `vatInsertSQL(true)` ชื่อคอลัมน์ฝั่งขาย
- `backend/internal/application/process/journaltax.go:178` `journalVatStmts`
- `backend/internal/application/process/trans_tax.go:37` `transVatTabs`
- `backend/internal/application/process/trans_tax.go:99` `transVatStmts`
- `backend/internal/application/process/trans_tax.go:252` `RebuildTransTax`
- `backend/internal/application/process/trans_tax_doc_no.go:26` ตรวจเลขใบกำกับซ้ำ
- `backend/internal/application/process/fa_sale.go:645` `insertAssetSaleVat`
- `backend/internal/application/process/fa_sale.go:488` ลบแถวตอนลบเอกสาร 1802
- `backend/internal/application/process/gl_template.go:789` ยอดภาษีขายลง GL
- `backend/internal/application/process/service.go:928` ดัชนี vat_number
- `backend/internal/application/process/report_menu_gl_fa.go:1040` รายงานภาษีขาย
- `backend/internal/application/process/report_menu_gl_fa.go:1715` join last_status

## ดูเพิ่ม
- [[tbl-group-gl]]
- [[acc-vat-register-wht]]
- [[acc-gl-posting-standard]]
