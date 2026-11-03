---
title: "เลขประจำตัวผู้เสียภาษี และสาขา (tax_id / tax_no / branch_type / branch_code)"
tags: [glossary, tax, branch, master]
aliases: ["เลขประจำตัวผู้เสียภาษี", "เลขผู้เสียภาษี", "เลขที่ผู้เสียภาษี", "tax_id", "tax_no", "tax_number", "เลขที่บัตรประชาชน", "card_id", "card_number", "สถานประกอบการ", "สำนักงานใหญ่", "สาขา", "เลขที่สาขา", "ลำดับที่สาขา", "สาขาลำดับที่", "branch_type", "branch_code", "branch_status", "ใช้ระบบสาขา", "erp_branch_list", "branchCode", "แผนก/สาขา", "erp_company_profile"]
sources: ["frontend/src/config/schemas/arCustomer.ts:174", "frontend/src/config/schemas/arCustomer.ts:180", "frontend/src/config/schemas/arCustomer.ts:186", "frontend/src/config/schemas/arCustomer.ts:191", "frontend/src/config/schemas/apSupplierDetail.ts:155", "frontend/src/config/schemas/companyProfile.ts:83", "frontend/src/config/schemas/companyProfile.ts:90", "frontend/src/config/schemas/companyProfile.ts:99", "frontend/src/config/schemas/companyProfile.ts:105", "frontend/account/transaction/JournalTaxTabs.tsx:226", "backend/internal/application/process/journaltax.go:42", "backend/internal/application/process/journaltax.go:247", "backend/internal/application/process/trans.go:111", "frontend/src/config/bcMenu.json:70", "frontend/src/config/schemas/icMasterSchemas.ts:459"]
---

# เลขผู้เสียภาษี และสาขา

## ในระบบนี้คืออะไร
คำว่า "สาขา" ในระบบใช้ใน **สองความหมาย**
1. **สถานประกอบการตามภาษี** ระบุว่าเป็นสำนักงานใหญ่หรือสาขาที่เท่าไร ใช้พิมพ์ในใบกำกับและรายงานภาษี เก็บใน `branch_type` และ `branch_code` ของคู่ค้า บริษัท และแถว VAT
2. **สาขาภายในบริษัท** (`erp_branch_list`, จอ "กำหนดรายละเอียดสาขา" bcMenu.json:70, `icMasterSchemas.ts:459`) ใช้แยกข้อมูลเอกสาร เก็บใน `ic_trans.branch_code` (`trans.go:111`)

## คอลัมน์
| ป้ายบนจอ | ลูกหนี้ `ar_customer` | เจ้าหนี้ | บริษัท `erp_company_profile` | แถว VAT/WHT |
|---|---|---|---|---|
| เลขประจำตัวผู้เสียภาษี | `tax_id` (`arCustomer.ts:174`) | `tax_id` (`apSupplierDetail.ts:155`) | `tax_number` "เลขที่ผู้เสียภาษี" (`companyProfile.ts:83`) | VAT: `tax_no`, WHT: `tax_number` |
| เลขที่บัตรประชาชน | `card_id` (:180) | `card_id` (:161) | — | WHT: `card_number` |
| สถานประกอบการ | `branch_type` 0 สำนักงานใหญ่ / 1 สาขา (:186) | `branch_type` (:167) | `branch_type` (:90) | `branch_type` (`journaltax.go:42`) |
| เลขที่สาขา | `branch_code` (:191) | `branch_code` (:176) | `branch_code` "สาขาลำดับที่" (:99) | `branch_code` |
- บริษัทมีสวิตช์ "ใช้ระบบสาขา" `branch_status` (`companyProfile.ts:105`)
- แท็บภาษีบนจอมีตัวเลือก `BRANCH_TYPES` = สำนักงานใหญ่ / สาขา (`JournalTaxTabs.tsx:226`)
- ชื่อ ที่อยู่ และเลขภาษีในแถว WHT ดึงจาก master ผู้ใช้แก้ไม่ได้ (`journaltax.go:53-54`)

## ข้อควรระวัง
- ชื่อคอลัมน์เลขภาษีไม่เหมือนกันในแต่ละตาราง (`tax_id`, `tax_no`, `tax_number`) ควรค้นทั้งสามชื่อ
- `branch_code` ของคู่ค้า (เลขสาขาตามภาษี) กับ `ic_trans.branch_code` (สาขาภายใน) เป็นคนละความหมาย แม้ชื่อคอลัมน์จะเหมือนกัน

## ลิงก์
[[term-party-ap-ar]] · [[term-vat-type]] · [[term-wht]] · [[tbl-erp-branch-list]] · [[tbl-erp-company-profile]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/src/config/schemas/arCustomer.ts:174-191`
- `frontend/src/config/schemas/apSupplierDetail.ts:155`, `:161`, `:167`, `:176`
- `frontend/src/config/schemas/companyProfile.ts:83`, `:90`, `:99`, `:105`
- `frontend/account/transaction/JournalTaxTabs.tsx:226`
- `backend/internal/application/process/journaltax.go:42`, `:53-54`, `:247-248`
- `backend/internal/application/process/trans.go:111`
- `frontend/src/config/bcMenu.json:70`; `frontend/src/config/schemas/icMasterSchemas.ts:459`
