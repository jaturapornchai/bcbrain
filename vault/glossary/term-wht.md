---
title: "ภาษีหัก ณ ที่จ่าย / ภาษีถูกหัก (withholding tax / gl_wht_list)"
tags: [glossary, tax, wht]
aliases: ["WHT", "ภาษีหัก ณ ที่จ่าย", "ภาษีหัก ณ. ที่จ่าย", "ภาษีถูกหัก ณ ที่จ่าย", "ภาษีถูกหัก ณ. ที่จ่าย", "หัก ณ ที่จ่าย", "ถูกหัก", "ภ.ง.ด.3", "ภ.ง.ด.53", "ภงด3", "ภงด53", "gl_wht_list", "gl_wht_list_detail", "tax_doc_no", "income_type", "ประเภทเงินได้", "cust_tax_type", "whtIn", "whtOut", "JournalWht", "หนังสือรับรองการหักภาษี"]
sources: ["frontend/account/transaction/JournalTaxTabs.tsx:29", "frontend/account/transaction/JournalTaxTabs.tsx:37", "frontend/account/transaction/JournalTaxTabs.tsx:964", "backend/internal/application/process/trans_tax.go:47", "backend/internal/application/process/journaltax.go:52", "backend/internal/application/process/journaltax.go:108", "backend/internal/application/process/journaltax.go:247", "backend/internal/application/process/journaltax.go:257", "backend/internal/application/process/report_menu_gl_fa.go:1134", "backend/internal/application/process/report_menu_gl_fa.go:1219", "frontend/src/config/bcMenu.json:9892"]
---

# ภาษีหัก ณ ที่จ่าย (WHT)

## ในระบบนี้คืออะไร
แท็บภาษีของเอกสารมีสองแท็บ WHT (`JournalTaxTabs.tsx:29-35`)
- `whtIn` ป้าย "ภาษีหัก ณ. ที่จ่าย" ใช้ฝั่งซื้อ/เจ้าหนี้ (`"ap"`) เมื่อเราเป็นผู้หักภาษีของผู้ขาย
- `whtOut` ป้าย "ภาษีถูกหัก ณ. ที่จ่าย" ใช้ฝั่งขาย/ลูกหนี้ (`"ar"`) เมื่อลูกค้าหักภาษีเรา
backend ใช้ map `transWhtParty` เพื่อบอกว่า flag ใดมีแท็บ WHT ฝั่งไหน (`trans_tax.go:47-51`)

## identifier / ตาราง / คอลัมน์
- หัว `gl_wht_list` มีคอลัมน์ `doc_no`, `doc_date`, `tax_doc_no`, `due_date`, `amount`, `tax_value`, `cust_code`, `trans_flag`, `cust_name`, `cust_address`, `cust_tax_type`, `card_number`, `tax_number` (`journaltax.go:247-248`)
- รายการ `gl_wht_list_detail` มีคอลัมน์ `line_number`, `doc_no`, `tax_doc_no`, `trans_flag`, `income_type`, `amount`, `tax_rate`, `tax_value`, `due_date`, `cust_code` (`journaltax.go:257`)
- JSON: `JournalWht{taxDocNo, dueDate, custCode, lines[]}` และ `JournalWhtLine{incomeType, amount, taxRate, taxValue}` (`journaltax.go:52-68`) ชื่อ ที่อยู่ และเลขภาษีดึงจาก master ผู้จำหน่าย/ลูกค้า ผู้ใช้แก้บนจอไม่ได้ (`:53-54`)
- คอลัมน์บนจอ: เอกสารเลขที่, รหัสลูกหนี้/เจ้าหนี้, ชื่อ, วันที่หัก ณ ที่จ่าย, จำนวนเงิน (`JournalTaxTabs.tsx:964-968`)

## ค่าที่เป็นไปได้
- flag ฝั่ง "ap" ได้แก่ 12, 16, 260, 262, 264, 315, 11, 25 และฝั่ง "ar" ได้แก่ 44, 48, 144, 250, 252, 1802, 110, 112 (`trans_tax.go:50-51`) เอกสารชำระหนี้ 19 ใช้แท็บ whtIn และ 239 ใช้ whtOut (`JournalTaxTabs.tsx:37-40`)
- รายงาน: ภ.ง.ด.53 คือ cust_tax_type 1 (นิติบุคคล) และ ภ.ง.ด.3 คือ cust_tax_type 0 (บุคคลธรรมดา) ฝั่งถูกหักใช้ flag ขาย รายงานจัดตาม `gl_wht_list_detail.due_date` (`report_menu_gl_fa.go:1134-1135`) ค่า cust_tax_type มาจาก `ap_status`/`ar_status` ของ master ดู [[term-party-ap-ar]]

## ข้อควรระวัง
- แถว WHT เป็นข้อมูลที่ผู้ใช้กรอก (raw) ระบบไม่สร้างใหม่ตอนบันทึก ต่างจากแถว VAT (`trans_tax.go:19-21`)
- `gl_wht_list.tax_doc_no` ห้ามซ้ำทั้งระบบ (`journaltax.go:108`) ถ้าซ้ำจะแจ้ง "เลขที่เอกสาร … ซ้ำ" (`:278`)
- ป้ายบนจอเขียน "ณ." มีจุด แต่ชื่อเมนูรายงานเขียน "ณ" ไม่มีจุด ควรค้นทั้งสองแบบ
- ความหมายทางกฎหมายของ ภ.ง.ด.3/53 (ความหมายทั่วไป ไม่ได้มาจากโค้ด): แบบยื่นภาษีหัก ณ ที่จ่ายของผู้รับเงินที่เป็นบุคคลธรรมดาและนิติบุคคลตามลำดับ ให้ตรวจกับประกาศกรมสรรพากรก่อนใช้

## หน้าจอ
แท็บ WHT ในเอกสารซื้อ ขาย และชำระหนี้ เมนู "รายงานภาษีหัก ณ ที่จ่าย (ภ.ง.ด.3 / 53)" (bcMenu.json:9892) มี ภ.ง.ด.53 (:9905), ภ.ง.ด.3 (:9917), ภาษีถูกหัก ณ. ที่จ่าย (:9929), ส่งออกไฟล์ (:9941, `report_menu_gl_fa.go:1219`)

## ลิงก์
[[acc-vat-register-wht]] · [[term-vat-type]] · [[term-party-ap-ar]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/account/transaction/JournalTaxTabs.tsx:29-40`, `:964-968`
- `backend/internal/application/process/trans_tax.go:19-21`, `:47-51`
- `backend/internal/application/process/journaltax.go:52-68`, `:108`, `:247-257`, `:278`
- `backend/internal/application/process/report_menu_gl_fa.go:1134-1135`, `:1219`
- `frontend/src/config/bcMenu.json:9892`, `:9905`, `:9917`, `:9929`, `:9941`
