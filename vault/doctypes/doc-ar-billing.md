---
title: "ใบวางบิล ลูกหนี้ (AR Billing Note)"
tags: [doctypes, ar]
aliases: ["trans_flag 235", "ใบวางบิล", "ใบแจ้งหนี้", "ED"]
sources: ["frontend/account/tabs/transMenuMap.ts:1544", "frontend/account/transaction/transLayouts.ts:118", "frontend/account/transaction/transLayouts.ts:161", "backend/internal/application/process/docs.go:119", "backend/internal/application/process/docs.go:342", "backend/internal/application/process/docs.go:389", "backend/internal/application/process/docs.go:457", "backend/internal/application/process/docs.go:526", "backend/internal/application/process/docs.go:532", "backend/internal/application/process/docs.go:600", "backend/internal/application/process/docs.go:621", "backend/internal/application/process/docs.go:647", "backend/internal/application/process/pay_check.go:228", "backend/internal/application/process/doc_flow.go:69", "backend/internal/application/process/doc_flow.go:89", "backend/internal/application/process/period.go:109", "backend/internal/application/process/doc_cancel.go:60"]
---

# ใบวางบิล ฝั่งลูกหนี้ (trans_flag 235)

## ใช้เมื่อไร
ใช้รวมบิลที่ค้างชำระเพื่อส่งให้ลูกค้า อยู่ที่เมนู "ใบวางบิล (ลูกหนี้)" (ED, transMenuMap.ts:1544)

## trans_flag/ตาราง
- หัวเอกสารอยู่ใน [[tbl-ap-ar-trans]] และรายการบิลอยู่ใน [[tbl-ap-ar-trans-detail]] บันทึกผ่าน `SaveDoc` (docs.go:119, `billStmts` :532)
- ยอดรวมหัวเอกสาร = ผลรวม sum_pay_money ของรายการ ภาษีเป็น 0 (docs.go:342)

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party ไม่มีแท็บ (transLayouts.ts:118)
- grid แบบตารางเอกสารหนี้ (`BILLS_FLAGS` transLayouts.ts:161)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี: แท็บ VAT/WHT ของ ap_ar_trans มีเฉพาะ 19/239 (`apArTaxTabs` trans_tax.go:53)

## การลงบัญชี
ไม่ลง GL: `SaveDoc` สั่งลง GL เฉพาะ 19/239 (`plan.glFlag` docs.go:389) และ 235 ไม่อยู่ใน `glRebuildTransFlags` (service.go:1742)

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: เอกสารหนี้ลูกหนี้ตาม `arDebtWhere` (docs.go:600) = 44/250/254/1802 (inquiry 0/2), 46, 93, 95, 99, 101, 418 และเครดิตตาม `arCreditWhere` (docs.go:602) = 48 (inquiry 0/2/4), 97, 103, 252 (inquiry 0/2)
- เมื่อ erp_option.filter_pay_bill = 1 บิลที่อยู่ในใบวางบิลใบอื่นแล้วจะไม่แสดงให้เลือก (docs.go:647)
- ใบวางบิลไม่ลดยอดคงเหลือของบิล: ยอดที่ชำระแล้วนับจากเอกสาร 239 เท่านั้น (`arBills` docs.go:526, `billPaidSQL` :621)
- used_status_2 ของบิลต้นทางมาจากการมีแถว ap_ar_trans_detail ที่ยังไม่ยกเลิกอ้างบิลนั้น ซึ่งรวมแถวของใบวางบิลนี้ด้วย (`billed` doc_flow.go:69)
- ปลายทาง: รับชำระ 239 อ้างเลขใบวางบิลในช่อง doc_ref ของรายการ (บังคับเมื่อเปิด ar_pay_from_bill_note, pay_check.go:243)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 236 ซึ่งเป็นเอกสาร ap_ar_trans (doc_cancel.go:60, `apArCancelFlags` :63)
- แก้ไข/ลบไม่ได้เมื่อถูกใช้แล้ว เสร็จแล้ว หรือถูกยกเลิก (`apArEditLocked` docs.go:457)
- บันทึก/ลบต้องอยู่ในงวดบัญชีที่เปิด (`checkSaveDocPeriod` period.go:109, `checkDeleteDocPeriod` :116)
- เมื่อเปิด ar_bill_inform บิลที่เคยวางแล้วนำมาวางซ้ำไม่ได้ ("ห้ามวางบิลซ้ำ" pay_check.go:228)
- ยอดในรายการเกินยอดคงเหลือไม่ได้ ยกเว้นเปิด pay_bill_over (pay_check.go:232)

## ข้อควรระวัง
- flow สถานะของตัวเอกสาร 235 เอง (used_status/doc_success) ยังไม่มีใน `flowRules` (doc_flow.go:89)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1544` เมนู
- `frontend/account/transaction/transLayouts.ts:118` FLAG_SPEC 235
- `backend/internal/application/process/docs.go:119` SaveDoc / `:532` billStmts / `:457` apArEditLocked / `:600` arDebtWhere
- `backend/internal/application/process/pay_check.go:221` checkBills
- `backend/internal/application/process/doc_flow.go:69` billed / `:89` 235 ยังไม่มี flow ของตัวเอง
- `backend/internal/application/process/doc_cancel.go:60` ยกเลิก 236

## ดูเพิ่ม
- [[doc-ar-receipt]] · [[doc-ap-billing-receive]] · [[doctypes-overview]]
