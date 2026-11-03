---
title: "ภาษีหัก ณ ที่จ่าย บันทึกตรงไหน ออก ภ.ง.ด.3 / ภ.ง.ด.53 / 50 ทวิ ได้จากเมนูไหน"
tags: [faq, wht, tax, report, pnd]
aliases: ["ภาษีหัก ณ ที่จ่าย", "ภาษีถูกหัก ณ ที่จ่าย", "withholding tax", "gl_wht_list", "gl_wht_list_detail", "trans_flag 1501", "trans_flag 1502", "menu_gl_wht_report_in_53", "menu_gl_wht_report_in_3", "WHT-50TAWI"]
sources: ["backend/internal/application/process/trans_tax.go:48", "backend/internal/application/process/journaltax.go:17", "backend/internal/application/process/journaltax.go:260", "backend/internal/application/process/report_menu_gl_fa.go:1130", "backend/internal/application/process/report_menu_gl_fa.go:1137", "backend/internal/application/process/report_menu_gl_fa.go:1729", "backend/internal/application/process/service.go:1873", "frontend/account/report/formDesignerPresets.ts:1538"]
---
# ภาษีหัก ณ ที่จ่าย บันทึกตรงไหน ออก ภ.ง.ด.3 / ภ.ง.ด.53 / 50 ทวิ ได้จากเมนูไหน

**ตอบสั้น:** กรอกที่แท็บภาษีหัก ณ ที่จ่ายของเอกสาร เก็บใน `gl_wht_list` (หัว ต่อเลขที่หนังสือรับรอง) + `gl_wht_list_detail` (บรรทัดประเภทเงินได้) รายงานอยู่ที่ `menu_gl_wht_report_in_3` (ภ.ง.ด.3), `menu_gl_wht_report_in_53` (ภ.ง.ด.53) และ `menu_gl_wht_report_sum` (ภาษีถูกหัก) ส่วน 50 ทวิ มีแค่ฟอร์มพิมพ์ใน form designer

## รายละเอียด
**เอกสารที่มีแท็บ** ([[acc-vat-register-wht]], [[term-wht]])
- ฝั่งเราหัก (ap): 12, 16, 260, 262, 264, 315, มัดจำ 11/25 และจ่ายชำระ 19
- ฝั่งถูกหัก (ar): 44, 48, 144, 250, 252, 1802, มัดจำ 110/112 และรับชำระ 239
- JV: 1502 = เราหักจากผู้ขาย, 1501 = ลูกค้าหักเรา ([[faq-journal-voucher-jv]])

**กติกาตอนบันทึก (JV)**: ต้องมีเลขที่เอกสารหัก ณ ที่จ่าย ห้ามเลขซ้ำ ยอดหัว = ผลรวมบรรทัด วันครบกำหนด (`due_date`) ว่างใช้วันที่เอกสาร ชื่อ ที่อยู่ เลขผู้เสียภาษี และ `cust_tax_type` เติมจากทะเบียนผู้ขาย/ลูกค้า

**รายงาน** ([[flow-tax-vat-wht-reports]])
- เรียงและกรองตาม `due_date`
- ภ.ง.ด.53 / ภ.ง.ด.3 อ่าน flag ฝั่งซื้อ {12, 14, 16, 19, 260, 1502, 11, 262, 264, 48} แยกด้วย `cust_tax_type` (ว่างใช้ `ap_status`): ค่า 1 → ภ.ง.ด.53, ค่า 0 → ภ.ง.ด.3
- ภาษีถูกหัก อ่าน {44, 46, 239, 112, 110, 250, 1501} ทุกสถานะ
- เอกสารยกเลิกแสดงยอด 0 และคำว่า "ยกเลิก" มีส่งออกข้อมูล (`glfaWhtExport`)

**GL**: บรรทัดภาษีหักเกิดเฉพาะเมื่อเอกสารลงผ่านชุดรายการชำระเงิน (เงินสด, 19, 239) ยอดจาก `cb_trans.total_tax_at_pay` หรือผลรวม `gl_wht_list.tax_value` ([[faq-ar-receipt-ap-payment-gl]])

## ข้อควรระวัง
- ลิสต์ flag ของรายงานไม่ตรงกับลิสต์แท็บ: ฝั่งซื้อไม่มี 315 และ 25 แต่มี 14 และ 48, ฝั่งถูกหักไม่มี 48, 144, 252, 1802 แต่มี 46 ไม่มีคอมเมนต์อธิบาย
- JV ที่หัวเอกสารเป็น flag 1999 เก็บแถวภาษีหักไว้ใต้ 1999 รายงานซึ่งอ่าน 1501/1502 จะไม่เห็น
- ฟอร์ม `WHT-50TAWI` ผูกแค่ชื่อบริษัท รหัสคู่ค้า และยอดรวม จะดึงจาก `gl_wht_list` หรือไม่ ไม่ชัดจากโค้ด ไม่พบรายงาน 50 ทวิ ฝั่ง backend
- ใบซื้อเงินเชื่อที่กรอกแท็บภาษีหัก ไม่มีบรรทัดภาษีหักใน GL

## ดูเพิ่ม
- [[tbl-gl-wht-list]]
- [[tbl-gl-wht-list-detail]]
- [[faq-print-document-form]]
- [[hist-lessons-vat-tax-mistakes]]

## ที่มาในโค้ด
- `backend/internal/application/process/trans_tax.go:48` `transWhtParty` flag ที่มีแท็บ ap/ar
- `backend/internal/application/process/journaltax.go:17` flag 1999/1502/1501
- `backend/internal/application/process/journaltax.go:260` `journalWhtStmts` กติกาเลขที่/ยอด/due_date
- `backend/internal/application/process/report_menu_gl_fa.go:1130` ลิสต์ flag ของรายงาน
- `backend/internal/application/process/report_menu_gl_fa.go:1137` `glfaWht` แยกด้วย cust_tax_type
- `backend/internal/application/process/report_menu_gl_fa.go:1729` ผูกเมนู ภ.ง.ด.53/3/ถูกหัก
- `backend/internal/application/process/service.go:1873` ยอดภาษีหักใน GL
- `frontend/account/report/formDesignerPresets.ts:1538` ฟอร์ม WHT-50TAWI
