---
title: "ทะเบียนภาษีขาย (gl_journal_vat_sale)"
tags: [tables, gl]
aliases: ["gl_journal_vat_sale", "ภาษีขาย", "รายงานภาษีขาย", "ใบกำกับภาษีขาย", "vat sale register", "ภ.พ.30 ภาษีขาย"]
sources: ["backend/internal/application/process/journaltax.go:160", "backend/internal/application/process/journaltax.go:178", "backend/internal/application/process/trans_tax.go:37", "backend/internal/application/process/trans_tax.go:99", "backend/internal/application/process/trans_tax.go:252", "backend/internal/application/process/trans_tax_doc_no.go:26", "backend/internal/application/process/fa_sale.go:645", "backend/internal/application/process/gl_template.go:789", "backend/internal/application/process/service.go:939", "backend/internal/application/process/report_menu_gl_fa.go:1042", "backend/internal/application/process/report_menu_gl_fa.go:1718", "scripts/sql/02_data_schema.sql:4566"]
---

# ทะเบียนภาษีขาย (`gl_journal_vat_sale`)

ทะเบียน/รายงานภาษีขาย (ใบกำกับภาษีที่เราออกให้ลูกค้า) 1 แถวต่อ 1 ใบกำกับของเอกสาร ใช้ทำรายงานภาษีขาย (ภ.พ.30) และเป็นแหล่งยอดภาษีขายที่ GL ดึงไปลงบัญชี ฝั่งซื้อคือ [[tbl-gl-journal-vat-buy]] ชื่อคอลัมน์ฝั่งขายต่างจากฝั่งซื้อ (ยอดภาษีคือ `amount` ไม่ใช่ `vat_amount`) ระวังอย่าเขียน SQL ตามกัน ภาพรวมอยู่ที่ [[acc-vat-register-wht]]

## คอลัมน์สำคัญ

โครงสร้างตารางมาจาก DDL `scripts/sql/02_data_schema.sql:4566-4605` (CREATE TABLE :4566-4602, ดัชนี :4603-4605) ชนิดข้อมูลที่ DDL กำหนด: ช่องเงินและอัตรา (`base_caltax_amount`, `tax_rate`, `amount`, `except_tax_amount`) เป็น numeric (ไม่ระบุความยาวและทศนิยม การปัดอยู่ที่โค้ด), `doc_no`, `book_code`, `vat_number`, `tax_group`, `ar_code`, `tax_no`, `branch_code`, `ref_vat_no`, `ref_doc_no` เป็น varchar(25), `description`, `ar_name` เป็น varchar(255), ช่องสถานะและลำดับ (`line_number`, `period_number`, `is_add`, `trans_type`, `trans_flag`, `vat_effective_period`, `vat_effective_year`, `vat_calc`, `branch_type`, `manual_add`, `is_doc_copy`, `vat_type`) เป็น smallint, ช่องวันที่ (`doc_date`, `vat_date`, `ref_vat_date`, `ref_doc_date`) เป็น date, `roworder` เป็น serial NOT NULL ไม่มี PRIMARY KEY/UNIQUE ใน DDL มีดัชนีธรรมดาสามตัวคือ (`doc_no`, `trans_flag`), (`doc_date`, `trans_flag`) และ (`ar_code`)

| คอลัมน์ | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `doc_no`, `doc_date`, `trans_flag` | เอกสารเจ้าของแถว | ลบ/สร้างใหม่ `trans_tax.go:99` |
| `book_code`, `line_number` | ว่าง / ลำดับแถวในแท็บภาษี เริ่ม 0 | `journaltax.go:164-166`, `journaltax.go:225` |
| `vat_calc` | เครื่องหมายคูณยอด 1 ปกติ, -1 ใบลดหนี้/รับคืน | `trans_tax.go:37`, `report_menu_gl_fa.go:1045` |
| `trans_type` | ประเภทรายการของเอกสาร | `journaltax.go:140` |
| `vat_date` | วันที่ใบกำกับภาษี | รายงาน |
| `vat_number` | เลขที่ใบกำกับภาษีขาย (ไม่ซ้ำข้ามทั้งระบบ เทียบแบบตัวใหญ่) | รายงาน, `trans_tax_doc_no.go:26` |
| `vat_effective_period`, `vat_effective_year` | เดือน/ปีภาษีที่ยื่น (ปี ค.ศ.) | `journaltax.go:160-161` |
| `description` | รายละเอียด | `journaltax.go:160-161` |
| `tax_group` | กลุ่มภาษี อ้าง `gl_tax_group.code` | `journaltax.go:160-161` |
| `base_caltax_amount`, `tax_rate`, `amount`, `except_tax_amount` | ฐานภาษี, อัตรา, ยอดภาษี, ยอดยกเว้น | รายงาน `report_menu_gl_fa.go:1043-1044`, `gl_template.go:789-839` |
| `vat_type` | 0 ปรกติ, 1 ไม่ถึงกำหนดชำระ (ฝั่งขายมีแค่ 0-1) | `journaltax.go:38`, `journaltax.go:179-181`, `journaltax.go:194` |
| `is_add` | 1 = ยื่นเพิ่มเติม | รายงาน |
| `ar_code`, `ar_name`, `tax_no`, `branch_type`, `branch_code` | ลูกหนี้ (รหัส/ชื่อ/เลขผู้เสียภาษี/สำนักงานใหญ่ 0 สาขา 1/รหัสสาขา) | รายงาน |
| `manual_add` | 1 = ผู้ใช้กรอกชื่อ/เลขผู้เสียภาษี/สาขาเอง ไม่ดึงจากทะเบียนลูกหนี้ | `journaltax.go:170-173` |
| `ref_vat_no`, `ref_vat_date`, `ref_doc_no`, `ref_doc_date` | ใบกำกับ/เอกสารอ้างอิง ใช้กับเอกสารรับชำระ 239 ที่ล้างภาษีไม่ถึงกำหนด | `gl_template.go:836-837` |
| `is_doc_copy` | 1 = แถวสำเนา รายงานตั้งเป็น 0 (ความหมายเต็ม: ไม่ชัดจากโค้ด) | `report_menu_gl_fa.go:1045`, `report_menu_gl_fa.go:1719` |
| `period_number` | smallint ค่าเริ่มต้น 0 มีใน DDL แต่โค้ด Go ไม่ได้ใช้กับตารางนี้ (ไม่ทราบความหมายแน่ชัด เดือนภาษีที่โค้ดเขียนคือ `vat_effective_period`) | - |
| `ignore_sync`, `is_lock_record` | integer ค่าเริ่มต้น 0 มีใน DDL แต่โค้ด Go ไม่ได้ใช้กับตารางนี้ (ไม่ทราบความหมายแน่ชัด) | - |
| `roworder`, `create_date_time_now` | serial NOT NULL / timestamp NOT NULL ค่าเริ่มต้น `now()` (เวลาที่แถวถูกสร้าง) INSERT ของโค้ดไม่ได้ระบุสองคอลัมน์นี้ | `journaltax.go:153` |

## คีย์และความสัมพันธ์
- เจ้าของแถว: [[tbl-ic-trans]] (ขาย 44,46,48,99,101,103,144,250,252,254 และมัดจำขาย 110,112), [[tbl-as-trans]] (ขายสินทรัพย์ 1802), [[tbl-ap-ar-trans]] (รับชำระ 239), หรือ JV ทำมือ ([[tbl-gl-journal]] flag 0/1999)
- ลูกหนี้: [[tbl-ar-customer]] (`ar_code`) ชื่อและเลขผู้เสียภาษีดึงจาก `ar_customer` และ `ar_customer_detail` ถ้าผู้ใช้ไม่กรอก
- ฝั่ง WHT ของเอกสารเดียวกัน: [[tbl-gl-wht-list]]
- ดัชนี `UPPER(vat_number)` ไม่อยู่ใน DDL ของตาราง (`scripts/sql/02_data_schema.sql:4566-4605`) สร้างเมื่อเปิดฐานข้อมูลของบริษัทถ้ามีคอลัมน์ `vat_number` (`service.go:938-944`) หรือสร้างล่วงหน้าด้วยสคริปต์ `scripts/sql/30_tax_doc_no_index.sql:6` ไว้ตรวจเลขใบกำกับซ้ำตอนบันทึก DDL ไม่มี PRIMARY KEY/UNIQUE บนตารางนี้ ตัวกันซ้ำที่พบจึงเป็นการตรวจในโค้ด (`trans_tax_doc_no.go:26`)

## ใครเขียน (writers)
- แท็บภาษีขายของ JV ทำมือ: `journalVatStmts` `journaltax.go:178` ผ่าน `vatSaleInsert` = `vatInsertSQL(true)` `journaltax.go:146`
- เอกสาร [[tbl-ic-trans]]: `transTaxStmts` `trans_tax.go:109` สร้างแถวเดียวจากหัวเอกสาร (`defaultTransVat` `trans_tax.go:74`) เว้น `vat_type = 3` ที่ไม่มีแถวภาษี
- ขายสินทรัพย์ 1802: `insertAssetSaleVat` `fa_sale.go:645` ใช้ `derivedVatStmts` สร้างแถวเดียวกับที่ rebuild จะได้
- เอกสารรับชำระหนี้ 239: `apArTaxTabs` `trans_tax.go:53`
- สร้างใหม่ทั้งชุด: `RebuildTransTax` `trans_tax.go:252` (ข้ามเอกสารที่ผู้ใช้คีย์ภาษีเอง `trans_tax.go:228-230`)

## ใครลบและใครอ่าน
- ลบ: JV `journaltax.go:89-90`, `journaltax.go:130-131`; ตามเอกสาร `trans_tax.go:199-203`; แถวกำพร้า `trans_tax.go:244`; ลบเอกสารขายสินทรัพย์ `fa_sale.go:488`
- อ่าน: รายงานภาษีขายและรายงานทางเลือก (2557/รวมภาษี) `glfaVatRun` `report_menu_gl_fa.go:1042`, `glfaVatStd` `report_menu_gl_fa.go:1095`; join กับ `ic_trans.last_status` `report_menu_gl_fa.go:1718`; ยอดภาษีขายที่ลง GL `gl_template.go:789-839`; ตรวจเลขใบกำกับซ้ำ `trans_tax_doc_no.go:26`

## ข้อควรระวัง
- เอกสารยกเลิก (`last_status = 1`) หรือแถวสำเนา (`is_doc_copy = 1`) **แถวยังอยู่** รายงานตั้งยอดเป็น 0 ผ่านเครื่องหมาย `calc` (`report_menu_gl_fa.go:1045`) ห้าม SUM ตรง ๆ
- ภาษีขายที่ `vat_type = 1` (ไม่ถึงกำหนดชำระ) ถูกแยกไปลงบัญชีพักภาษีตอน GL: ฝั่งขายเอกสาร `trans_type = 2` ดึง `SUM(amount)` ของ `vat_type = 1` (`gl_template.go:789`) ถ้าแก้ค่านี้ต้อง rebuild GL ของเอกสาร ([[acc-gl-rebuild]])
- ใบกำกับภาษีขายห้ามซ้ำทั้งระบบ (เทียบ `UPPER(vat_number)`) ต่างจากฝั่งซื้อที่ซ้ำได้ต่างเจ้าหนี้ ตรวจแบบ advisory lock ต่อเลขที่ในขณะบันทึก (`trans_tax_doc_no.go:26-32`)
- เอกสารขายสินทรัพย์ 1802 ใช้ตารางนี้ร่วมกับเอกสารสินค้า ต้องระบุ `trans_flag` ทุกครั้งที่ลบ/อ่านเพื่อไม่ชนกับ `ic_trans` เลขที่เดียวกัน
- เงินเป็น NUMERIC ส่งเป็น string ([[acc-rounding-decimal]])
- คำอธิบายตารางที่ให้ผู้ช่วย MCP (`gateway.go:992`, `gateway.go:1424`) ใช้ชื่อ `tax_doc_no`, `tax_doc_date`, `vat_base_amount`, `vat_total_amount`, `vat_rate` ซึ่งไม่มีใน DDL ของตารางนี้ (ฝั่งขายใช้ `vat_number`, `vat_date`, `base_caltax_amount`, `tax_rate`, `amount` และไม่มี `vat_total_amount`) ส่วนความหมายค่า `vat_type` ในคำอธิบายนั้น (0=แยกนอก, 1=รวมใน, 2=ยกเว้น) ยังไม่ได้เทียบกับค่าที่ GL ใช้กรองยอด (`gl_template.go:789`) เขียน SQL ให้ใช้ชื่อคอลัมน์ตาม DDL

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
- `backend/internal/application/process/service.go:939` ดัชนี vat_number
- `backend/internal/application/process/report_menu_gl_fa.go:1042` รายงานภาษีขาย
- `backend/internal/application/process/report_menu_gl_fa.go:1718` join last_status
- `scripts/sql/02_data_schema.sql:4566-4605` DDL ตาราง `gl_journal_vat_sale` (CREATE TABLE :4566-4602, ดัชนี :4603-4605)
- `scripts/sql/30_tax_doc_no_index.sql:6` สร้างดัชนี `UPPER(vat_number)` ล่วงหน้าด้วยมือ

## ดูเพิ่ม
- [[tbl-group-gl]]
- [[acc-vat-register-wht]]
- [[acc-gl-posting-standard]]
