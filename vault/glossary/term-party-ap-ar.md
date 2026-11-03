---
title: "ลูกหนี้/ลูกค้า และเจ้าหนี้/ผู้จำหน่าย (party / cust_code / ar_customer / ap_supplier)"
tags: [glossary, ap, ar, master]
aliases: ["ลูกหนี้", "ลูกค้า", "เจ้าหนี้", "ผู้จำหน่าย", "ผู้ขาย", "ซัพพลายเออร์", "supplier", "customer", "คู่ค้า", "cust_code", "custCode", "ap_ar_code", "ar_customer", "ar_customer_detail", "ap_supplier", "ap_supplier_detail", "ar_status", "ap_status", "สถานะลูกหนี้", "สถานะผู้จำหน่าย", "บุคคลธรรมดา", "นิติบุคคล", "ประเภทลูกหนี้", "ar_type", "ap_type", "ระดับราคาสินค้า", "price_level", "partyType", "partyLabel", "ผู้ติดต่อ", "contactor", "สมาชิก", "ar_dealer"]
sources: ["frontend/src/config/schemas/arCustomer.ts:3", "frontend/src/config/schemas/arCustomer.ts:119", "frontend/src/config/schemas/arCustomer.ts:131", "frontend/src/config/schemas/arCustomer.ts:136", "frontend/src/config/schemas/arCustomer.ts:147", "frontend/src/config/schemas/apSupplierDetail.ts:43", "frontend/src/config/schemas/apSupplierDetail.ts:50", "frontend/account/transaction/transLayouts.ts:299", "frontend/account/tabs/transMenuMap.ts:11", "backend/internal/application/process/trans.go:110", "backend/internal/application/process/journaltax.go:247", "frontend/src/config/bcMenu.json:6065", "frontend/src/config/bcMenu.json:6801", "frontend/src/config/bcMenu.json:6827"]
---

# ลูกหนี้ / เจ้าหนี้ (คู่ค้า)

## ในระบบนี้คืออะไร
- หัวเอกสาร `ic_trans` เก็บรหัสคู่ค้าในคอลัมน์ `cust_code` เพียงคอลัมน์เดียว (`trans.go:110`) ใช้ทั้งเอกสารซื้อและขาย ต้องดู `trans_type` หรือ `partyType` (`ap`/`ar`/`none` ใน `TransMenuConfig`) เพื่อรู้ว่าเป็นเจ้าหนี้หรือลูกหนี้
- ป้ายบนหัวเอกสาร: "เจ้าหนี้/ผู้จำหน่าย:", "ลูกหนี้/ลูกค้า:" หรือ "ผู้เกี่ยวข้อง:" (`transLayouts.ts:299`)
- `cb_trans` ใช้ชื่อคอลัมน์ `ap_ar_code` แทน ดู [[term-pay-tenders]]

## master
| | ลูกหนี้ | เจ้าหนี้ |
|---|---|---|
| ตาราง | `ar_customer`, `ar_customer_detail` (`arCustomer.ts:3`) | `ap_supplier`, `ap_supplier_detail` |
| จอ | "กำหนดลูกหนี้" (`menu_ar_detail`, bcMenu.json:6801) | "กำหนดเจ้าหนี้" (`menu_ap_detail`, :6065) |
| รหัส | `code` "รหัส" (`arCustomer.ts:37`) | `code` "รหัสผู้จำหน่าย" (`apSupplierDetail.ts:43`) |
| สถานะบุคคล | `ar_status` "สถานะลูกหนี้" 0 บุคคลธรรมดา / 1 นิติบุคคล (`arCustomer.ts:131`, คอมเมนต์ :20) | `ap_status` "สถานะผู้จำหน่าย" (`apSupplierDetail.ts:50`) |
| ใช้งาน | `status` 0 ใช้งาน / 1 ไม่ใช้งาน (`arCustomer.ts:136`) | — |
| ประเภท | `ar_type` "ประเภทลูกหนี้" (:119) | `ap_type` (:143) |
| ระดับราคา | `price_level` "ระดับราคาสินค้า" 0-9 (:147) | — |
- สมาชิก (`menu_ar_dealer` "รายละเอียดสมาชิก", bcMenu.json:6827) เป็น master แยกต่างหาก
- เลขภาษีและสาขาของคู่ค้าดูได้ที่ [[term-tax-id-branch]] ส่วนเครดิตและวงเงินดูได้ที่ [[term-credit-due]]

## ข้อควรระวัง
- รายงาน WHT ใช้ `ap_status`/`ar_status` เป็น `cust_tax_type` เพื่อแยก ภ.ง.ด.3 และ ภ.ง.ด.53 (`journaltax.go:247-248`) ดู [[term-wht]]
- ช่อง "ผู้ติดต่อ" (`contactor`, `TransTopForm.tsx:261`) เป็นข้อความอิสระ ไม่ใช่รหัสคู่ค้า

## ลิงก์
[[proc-master-data]] · [[fe-master-screens]] · [[term-ap-ar-balance]] · [[term-tax-id-branch]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/src/config/schemas/arCustomer.ts:3-25`, `:37`, `:119`, `:131`, `:136`, `:147`
- `frontend/src/config/schemas/apSupplierDetail.ts:43`, `:50`, `:143`
- `frontend/account/transaction/transLayouts.ts:299`; `frontend/account/transaction/TransTopForm.tsx:261`
- `frontend/account/tabs/transMenuMap.ts:11-30`
- `backend/internal/application/process/trans.go:110`; `journaltax.go:247-248`
- `frontend/src/config/bcMenu.json:6065`, `:6801`, `:6827`
