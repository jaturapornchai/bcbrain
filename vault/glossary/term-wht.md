---
title: "ภาษีหัก ณ ที่จ่าย / ภาษีถูกหัก (withholding tax / gl_wht_list)"
tags: [glossary, tax, wht]
aliases: ["WHT", "ภาษีหัก ณ ที่จ่าย", "ภาษีหัก ณ. ที่จ่าย", "ภาษีถูกหัก ณ ที่จ่าย", "ภาษีถูกหัก ณ. ที่จ่าย", "หัก ณ ที่จ่าย", "ถูกหัก", "ภ.ง.ด.3", "ภ.ง.ด.53", "ภงด3", "ภงด53", "gl_wht_list", "gl_wht_list_detail", "tax_doc_no", "income_type", "ประเภทเงินได้", "cust_tax_type", "whtIn", "whtOut", "JournalWht", "หนังสือรับรองการหักภาษี"]
sources: ["frontend/account/transaction/JournalTaxTabs.tsx:29", "frontend/account/transaction/JournalTaxTabs.tsx:38", "frontend/account/transaction/JournalTaxTabs.tsx:65", "frontend/account/transaction/JournalTaxTabs.tsx:77", "frontend/account/transaction/JournalTaxTabs.tsx:911", "frontend/account/transaction/JournalTaxTabs.tsx:921", "frontend/account/transaction/JournalTaxTabs.tsx:964", "backend/internal/application/process/trans_tax.go:48", "backend/internal/application/process/trans_tax.go:53", "backend/internal/application/process/trans_tax.go:59", "backend/internal/application/process/trans_tax.go:115", "backend/internal/application/process/trans_tax.go:132", "backend/internal/application/process/trans_tax.go:148", "backend/internal/application/process/journaltax.go:55", "backend/internal/application/process/journaltax.go:63", "backend/internal/application/process/journaltax.go:108", "backend/internal/application/process/journaltax.go:247", "backend/internal/application/process/journaltax.go:241", "backend/internal/application/process/journaltax.go:257", "backend/internal/application/process/journaltax.go:277", "backend/internal/application/process/journaltax.go:287", "backend/internal/application/process/journaltax.go:303", "backend/internal/application/process/journaltax.go:317", "backend/internal/application/process/report_menu_gl_fa.go:1133", "backend/internal/application/process/report_menu_gl_fa.go:1140", "backend/internal/application/process/report_menu_gl_fa.go:1162", "backend/internal/application/process/report_menu_gl_fa.go:1732", "backend/internal/application/process/report_menu_gl_fa.go:1733", "backend/internal/application/process/report_menu_gl_fa.go:1734", "backend/internal/application/process/report_menu_gl_fa.go:1181", "backend/internal/application/process/report_menu_gl_fa.go:1735", "frontend/src/config/bcMenu.json:9892", "frontend/account/master/CustomerDetailScreen.tsx:1814"]
---

# ภาษีหัก ณ ที่จ่าย (WHT)

## ในระบบนี้คืออะไร
แท็บภาษีของเอกสารมีสองแท็บ WHT (`JournalTaxTabs.tsx:29-35`)
- `whtIn` ป้าย "ภาษีหัก ณ. ที่จ่าย" ใช้ฝั่งซื้อ/เจ้าหนี้ (`"ap"`) เมื่อเราเป็นผู้หักภาษีของผู้ขาย
- `whtOut` ป้าย "ภาษีถูกหัก ณ. ที่จ่าย" ใช้ฝั่งขาย/ลูกหนี้ (`"ar"`) เมื่อลูกค้าหักภาษีเรา
backend ใช้ map `transWhtParty` เพื่อบอกว่า flag ใดมีแท็บ WHT ฝั่งไหน (`trans_tax.go:48-49`) ฝั่งซื้อ (`whtIn`) ดึง master จาก `ap_supplier` ฝั่งขาย (`whtOut`) ดึงจาก `ar_customer` (`JournalTaxTabs.tsx:911-914`)

## identifier / ตาราง / คอลัมน์
- หัว `gl_wht_list` มีคอลัมน์ `doc_no`, `doc_date`, `tax_doc_no`, `due_date`, `amount`, `tax_value`, `cust_code`, `trans_flag`, `cust_name`, `cust_address`, `cust_tax_type`, `card_number`, `tax_number` (`journaltax.go:247-248`) ชื่อ ที่อยู่ ประเภท (`cust_tax_type` จาก `ap_status`/`ar_status`) เลขบัตร และเลขภาษี ระบบเติมจาก master และตาราง `_detail` ของผู้จำหน่าย/ลูกค้าตอนบันทึก (`whtInsert`, `:241-253`) ส่วน `amount` / `tax_value` ของหัวคือผลรวมของบรรทัด (`:287-296`)
- รายการ `gl_wht_list_detail` มีคอลัมน์ `line_number`, `doc_no`, `tax_doc_no`, `trans_flag`, `income_type`, `amount`, `tax_rate`, `tax_value`, `due_date`, `cust_code` (`journaltax.go:257`)
- JSON: `JournalWht{taxDocNo, dueDate, custCode, lines[]}` และ `JournalWhtLine{incomeType, amount, taxRate, taxValue}` (`journaltax.go:55-60`, `:63-68`) หน้าจอส่งเฉพาะ `taxDocNo`, `dueDate`, `custCode`, `lines` (`JournalTaxTabs.tsx:65-66`) จึงไม่มีช่องแก้ชื่อ ที่อยู่ หรือเลขภาษี หน้าจอแสดงค่าเหล่านี้จาก master เพื่อดูอย่างเดียว (`loadCust`, `:921-940`)
- คอลัมน์บนจอ: เอกสารเลขที่, รหัสลูกหนี้/เจ้าหนี้, ชื่อ, วันที่หัก ณ ที่จ่าย, จำนวนเงิน, มูลค่าภาษีหัก ณ ที่จ่าย (`JournalTaxTabs.tsx:964-969`)

## ค่าที่เป็นไปได้
- flag ฝั่ง "ap" ได้แก่ 12, 16, 260, 262, 264, 315, 11, 25 และฝั่ง "ar" ได้แก่ 44, 48, 144, 250, 252, 1802, 110, 112 (`trans_tax.go:48-49`) เอกสารชำระหนี้ 19 ใช้แท็บ whtIn และ 239 ใช้ whtOut (`apArTaxTabs`, `trans_tax.go:53`, `JournalTaxTabs.tsx:38-40`) หน้าจอมีรายการ flag ของตัวเอง `WHT_IN_FLAGS` / `WHT_OUT_FLAGS` (`JournalTaxTabs.tsx:77-78`) และรายงานมี `glfaWhtBuyFlags` / `glfaWhtSaleFlags` (`report_menu_gl_fa.go:1133-1134`) สามรายการนี้ไม่เท่ากัน เช่น รายงานฝั่งซื้อรวม 48 ซึ่ง `transWhtParty` ตั้งเป็น `"ar"` และรายงานฝั่งขายไม่มี 144, 252, 1802
- รายงาน: เมนู ภ.ง.ด.53 เรียก `glfaWht` ด้วยสถานะ 1 (นิติบุคคล) และ ภ.ง.ด.3 ด้วยสถานะ 0 (บุคคลธรรมดา) รายงานภาษีถูกหักใช้ flag ฝั่งขายและไม่กรองสถานะ (`report_menu_gl_fa.go:1732-1734`) รายงานกรองตามวันที่ `gl_wht_list_detail.due_date` และเทียบสถานะกับ `cust_tax_type` ของหัว ถ้าไม่มีใช้ `ap_status`/`ar_status` ของ master (`:1162`) จอ master ใช้ป้าย "บุคคลธรรมดา" (0) และ "นิติบุคคล" (1) (`CustomerDetailScreen.tsx:1814`) ดู [[term-party-ap-ar]]

## ข้อควรระวัง
- แถว WHT เป็นข้อมูลที่ผู้ใช้กรอก (raw) ตอนบันทึกระบบลบแล้วเขียนแถวใหม่ตามที่แท็บส่งมา ไม่คำนวณจากเอกสาร (`docWhtStmts`, `trans_tax.go:148-164`, เรียกที่ `:132-142`) ถ้าไม่ส่งแท็บ WHT มา (`wht` เป็น nil) แถวเดิมไม่ถูกแตะ (`:59`, `:132`) ต่างจากแถว VAT ที่ระบบสร้างใหม่จาก `ic_trans` (`:115-122`)
- `gl_wht_list.tax_doc_no` ต้องไม่ซ้ำข้ามเอกสาร (`journaltax.go:108`) ในคำขอเดียวกันถ้าเลขซ้ำแจ้ง "เลขที่เอกสาร … ซ้ำ" (`:277-278`) ถ้าชน unique index `gl_wht_list_gl_wht_list_doc_no` ในฐานข้อมูลแจ้ง "เลขที่เอกสารหัก ณ ที่จ่าย … ซ้ำกับเอกสารอื่น" (`:303-306`, `:317`) ตาราง `gl_wht_list` อยู่ในฐานข้อมูลบริษัท ไม่มี DDL ใน repo (คอลัมน์อนุมานจาก INSERT/SELECT/struct ในโค้ด)
- ป้ายแท็บบนจอ (`JournalTaxTabs.tsx:31-32`) และชื่อรายงานย่อย (bcMenu.json:9905, :9917, :9929) เขียน "ณ." มีจุด แต่ชื่อเมนูหลัก (:9892) เขียน "ณ" ไม่มีจุด และเมนูส่งออก (:9941) สะกด "ทีจ่าย" ไม่มีไม้เอก ควรค้นหลายแบบ

## หน้าจอ
แท็บ WHT ในเอกสารซื้อ ขาย และชำระหนี้ เมนู "รายงานภาษีหัก ณ ที่จ่าย (ภ.ง.ด.3 / 53)" (bcMenu.json:9892) มี ภ.ง.ด.53 (:9905), ภ.ง.ด.3 (:9917), ภาษีถูกหัก ณ. ที่จ่าย (:9929), ส่งออกไฟล์ (:9941, `glfaWhtExport`, `report_menu_gl_fa.go:1181`, `:1735`)

## ลิงก์
[[acc-vat-register-wht]] · [[term-vat-type]] · [[term-party-ap-ar]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/account/transaction/JournalTaxTabs.tsx:29-40`, `:65-66`, `:77-78`, `:911-914`, `:921-940`, `:964-969`
- `backend/internal/application/process/trans_tax.go:48-49`, `:53`, `:59`, `:115-122`, `:132-142`, `:148-164`
- `backend/internal/application/process/journaltax.go:55-60`, `:63-68`, `:108`, `:241-257`, `:277-278`, `:287-296`, `:303-306`, `:317`
- `backend/internal/application/process/report_menu_gl_fa.go:1133-1134`, `:1140`, `:1162`, `:1181`, `:1732-1735`
- `frontend/src/config/bcMenu.json:9892`, `:9905`, `:9917`, `:9929`, `:9941`
- `frontend/account/master/CustomerDetailScreen.tsx:1814`
