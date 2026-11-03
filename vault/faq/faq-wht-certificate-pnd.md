---
title: "ภาษีหัก ณ ที่จ่าย บันทึกตรงไหน ออก ภ.ง.ด.3 / ภ.ง.ด.53 / 50 ทวิ ได้จากเมนูไหน"
tags: [faq, wht, tax, report, pnd]
aliases: ["ภาษีหัก ณ ที่จ่าย", "ภาษีถูกหัก ณ ที่จ่าย", "withholding tax", "gl_wht_list", "gl_wht_list_detail", "trans_flag 1501", "trans_flag 1502", "menu_gl_wht_report_in_53", "menu_gl_wht_report_in_3", "WHT-50TAWI"]
sources: ["backend/internal/application/process/trans_tax.go:48", "backend/internal/application/process/journaltax.go:17", "backend/internal/application/process/journaltax.go:74", "backend/internal/application/process/journaltax.go:241", "backend/internal/application/process/journaltax.go:260", "backend/internal/application/process/report_menu_gl_fa.go:1133", "backend/internal/application/process/report_menu_gl_fa.go:1140", "backend/internal/application/process/report_menu_gl_fa.go:1181", "backend/internal/application/process/report_menu_gl_fa.go:1732", "backend/internal/application/process/service.go:1871", "backend/internal/application/process/service.go:1884", "frontend/account/report/formDesignerPresets.ts:457", "frontend/account/report/formDesignerPresets.ts:1538"]
---
# ภาษีหัก ณ ที่จ่าย บันทึกตรงไหน ออก ภ.ง.ด.3 / ภ.ง.ด.53 / 50 ทวิ ได้จากเมนูไหน

**ตอบสั้น:** กรอกที่แท็บภาษีหัก ณ ที่จ่ายของเอกสาร เก็บใน `gl_wht_list` (หัว ต่อเลขที่หนังสือรับรอง) + `gl_wht_list_detail` (บรรทัดประเภทเงินได้) รายงานอยู่ที่ `menu_gl_wht_report_in_3` (ภ.ง.ด.3), `menu_gl_wht_report_in_53` (ภ.ง.ด.53) และ `menu_gl_wht_report_sum` (ภาษีถูกหัก) ส่วน 50 ทวิ มีแค่ฟอร์มพิมพ์ใน form designer และมีเมนูส่งออกข้อมูลภาษีหัก `menu_export_wht`

## รายละเอียด
**เอกสารที่มีแท็บ** ([[acc-vat-register-wht]], [[term-wht]])
- ฝั่งเราหัก (ap): 12, 16, 260, 262, 264, 315, มัดจำ 11/25 และจ่ายชำระ 19
- ฝั่งถูกหัก (ar): 44, 48, 144, 250, 252, 1802, มัดจำ 110/112 และรับชำระ 239
- JV: 1502 = เราหักจากผู้ขาย, 1501 = ลูกค้าหักเรา ([[faq-journal-voucher-jv]])

**กติกาตอนบันทึก (JV)** (`journalWhtStmts` `journaltax.go:260-300`): ต้องมีเลขที่เอกสารหัก ณ ที่จ่ายถ้ามีบรรทัดหรือรหัสคู่ค้า ห้ามเลขซ้ำ ยอดหัว = ผลรวมบรรทัด วันครบกำหนด (`due_date`) ว่างใช้วันที่เอกสาร ชื่อ ที่อยู่ เลขผู้เสียภาษี และ `cust_tax_type` เติมจากทะเบียนผู้ขาย/ลูกค้า โดย `cust_tax_type` เอามาจาก `ap_status` หรือ `ar_status` ของทะเบียน (`whtInsert` `journaltax.go:241-253`)

**รายงาน** ([[flow-tax-vat-wht-reports]])
- เรียงและกรองตาม `due_date`
- ภ.ง.ด.53 / ภ.ง.ด.3 อ่าน flag ฝั่งซื้อ {12, 14, 16, 19, 260, 1502, 11, 262, 264, 48} (`glfaWhtBuyFlags` `:1133`) แยกด้วย `cust_tax_type` (ว่างใช้ `ap_status`): ค่า 1 → ภ.ง.ด.53, ค่า 0 → ภ.ง.ด.3 (`glfaWht` `:1140`, ผูกเมนูที่ `:1732-1733`)
- ภาษีถูกหัก อ่าน {44, 46, 239, 112, 110, 250, 1501} ทุกสถานะ (`glfaWhtSaleFlags` `:1134`, เมนู `menu_gl_wht_report_sum` `:1734`)
- เอกสารยกเลิกแสดงยอด 0 และคำว่า "ยกเลิก"
- มีส่งออกข้อมูล `menu_export_wht` (`glfaWhtExport` `report_menu_gl_fa.go:1181`, `:1735`) อ่าน flag ฝั่งซื้อ {12, 14, 16, 19, 260, 1502, 11, 262, 264} ไม่มี 48 และแยกผู้ขายตาม `ap_status`: ถ้าส่ง `ViewDetail` ได้เฉพาะ `ap_status` = 1 (ชุด ภ.ง.ด.53) ถ้าไม่ส่งได้เฉพาะ 0 (ชุด ภ.ง.ด.3)

**GL**: บรรทัดภาษีหักเกิดเฉพาะเมื่อเอกสารลงผ่านชุดรายการชำระเงิน (`payTenders` `service.go:1871`) ซึ่งใช้กับบิลซื้อ/ขายแบบเงินสด ใบรับ/จ่ายชำระ 19/239 มัดจำและล่วงหน้า และเงินสดย่อย 300/301 ยอดจาก `cb_trans.total_tax_at_pay` ถ้าไม่มีใช้ผลรวม `gl_wht_list.tax_value` (`service.go:1884-1888`) ([[faq-ar-receipt-ap-payment-gl]])

## ข้อควรระวัง
- ลิสต์ flag ของรายงานไม่ตรงกับลิสต์แท็บ: ฝั่งซื้อไม่มี 315 และ 25 แต่มี 14 และ 48, ฝั่งถูกหักไม่มี 48, 144, 252, 1802 แต่มี 46 โค้ดไม่ได้อธิบายเหตุผลของความต่างนี้
- JV ที่หัวเอกสารเป็น flag 1999 เก็บแถวภาษีหักไว้ใต้ 1999 (`taxFlag` `journaltax.go:74-79`) รายงานซึ่งอ่าน 1501/1502 จะไม่เห็น
- ฟอร์ม `WHT-50TAWI` มี 4 ช่อง คือ ชื่อบริษัทกับเลขผู้เสียภาษี (`[company_name_1]`, `[tax_id]`) รหัสและชื่อคู่ค้า (`[cust_code] - [name_1]`) ข้อความประเภทเงินได้แบบตายตัว และยอด `[total_value]` (`formDesignerPresets.ts:1586-1726`) ฟอร์มใช้ชุดคิวรีมาตรฐานของ form designer (บริษัท, `ic_trans`, `ic_trans_detail`, `ar_customer` ฯลฯ — `createDefaultFormQueries` `:457`) ไม่มีคิวรีไหนอ่าน `gl_wht_list` หรือ `gl_wht_list_detail` ไฟล์นี้ไม่มีรายงาน 50 ทวิ ฝั่ง backend
- ใบซื้อเงินเชื่อที่กรอกแท็บภาษีหัก ไม่มีบรรทัดภาษีหักใน GL (สำหรับใบซื้อ 12 ชุดรายการชำระเงินถูกเรียกเมื่อประเภทสอบถามเป็น 1 หรือ 3 — `service.go:1988`)

## ดูเพิ่ม
- [[tbl-gl-wht-list]]
- [[tbl-gl-wht-list-detail]]
- [[faq-print-document-form]]
- [[hist-lessons-vat-tax-mistakes]]

## ที่มาในโค้ด
- `backend/internal/application/process/trans_tax.go:48` `transWhtParty` flag ที่มีแท็บ ap/ar
- `backend/internal/application/process/journaltax.go:17` flag 1999/1502/1501; `:74-79` `taxFlag`
- `backend/internal/application/process/journaltax.go:241` `whtInsert` เติมชื่อ/ที่อยู่/`cust_tax_type` จากทะเบียน
- `backend/internal/application/process/journaltax.go:260` `journalWhtStmts` กติกาเลขที่/ยอด/due_date
- `backend/internal/application/process/report_menu_gl_fa.go:1133-1134` ลิสต์ flag ของรายงาน
- `backend/internal/application/process/report_menu_gl_fa.go:1140` `glfaWht` แยกด้วย cust_tax_type; `:1181` `glfaWhtExport`
- `backend/internal/application/process/report_menu_gl_fa.go:1732-1735` ผูกเมนู ภ.ง.ด.53/3/ถูกหัก/ส่งออก
- `backend/internal/application/process/service.go:1871` `payTenders`; `:1884-1888` ยอดภาษีหักใน GL; `:1911` บรรทัดภาษีหักในชุดรายการชำระเงิน; `:1988` เงื่อนไขซื้อเงินสด
- `frontend/account/report/formDesignerPresets.ts:1538` ฟอร์ม WHT-50TAWI; `:457` `createDefaultFormQueries`
