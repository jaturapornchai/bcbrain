---
title: "ใบรับวางบิล เจ้าหนี้ (AP Bill Receipt)"
tags: [doctypes, ap]
aliases: ["trans_flag 213", "ใบรับวางบิล", "รับวางบิล", "DD"]
sources: ["frontend/account/tabs/transMenuMap.ts:1345", "frontend/account/transaction/transLayouts.ts:117", "frontend/account/transaction/transLayouts.ts:161", "backend/internal/application/process/docs.go:119", "backend/internal/application/process/docs.go:342", "backend/internal/application/process/docs.go:389", "backend/internal/application/process/docs.go:457", "backend/internal/application/process/docs.go:532", "backend/internal/application/process/docs.go:604", "backend/internal/application/process/docs.go:647", "backend/internal/application/process/pay_check.go:226", "backend/internal/application/process/doc_flow.go:69", "backend/internal/application/process/doc_flow.go:89", "backend/internal/application/process/period.go:109", "backend/internal/application/process/doc_cancel.go:60"]
---

# ใบรับวางบิล ฝั่งเจ้าหนี้ (trans_flag 213)

## ใช้เมื่อไร
ใช้รวบรวมบิลที่ผู้ขายนำมาวางเพื่อเตรียมจ่าย อยู่ที่เมนู "ใบรับวางบิล (เจ้าหนี้)" (DD, transMenuMap.ts:1345)

## trans_flag/ตาราง
- หัวเอกสารอยู่ใน [[tbl-ap-ar-trans]] ส่วนรายการบิลอยู่ใน [[tbl-ap-ar-trans-detail]]
- บันทึกผ่าน `/process/doc/save` (`SaveDoc` docs.go:119) และเขียนรายการด้วย `billStmts` (docs.go:532)
- ยอดรวมหัวเอกสาร = ผลรวม sum_pay_money ของรายการ ภาษีเป็น 0 (docs.go:342)

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party ไม่มีแท็บ (transLayouts.ts:117)
- grid แบบตารางเอกสารหนี้ (`BILLS_FLAGS` transLayouts.ts:161)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี: แท็บ VAT/WHT ของ ap_ar_trans มีเฉพาะ 19/239 (`apArTaxTabs` trans_tax.go:53)

## การลงบัญชี
ไม่ลง GL: `SaveDoc` สั่งลง GL เฉพาะ 19/239 (`plan.glFlag` docs.go:389) และ 213 ไม่อยู่ใน `glRebuildTransFlags` (service.go:1742)

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: เอกสารหนี้เจ้าหนี้ตาม `apDebtWhere` (docs.go:604) = 12/315/260/264 (inquiry 0/2), 14, 316, 81, 83, 87, 89 และเครดิตตาม `apCreditWhere` (docs.go:607) = 16/317 (inquiry 0/1), 85, 91, 262 (inquiry 0/2)
- เมื่อ erp_option.filter_pay_bill = 1 บิลที่อยู่ในใบรับวางบิลใบอื่นแล้วจะไม่แสดงให้เลือก (docs.go:647)
- ใบรับวางบิลไม่ลดยอดคงเหลือของบิล: ยอดที่จ่ายแล้วนับจากเอกสาร 19 เท่านั้น (`billPaidSQL` docs.go:621)
- used_status_2 ของบิลต้นทางมาจากการมีแถว ap_ar_trans_detail ที่ยังไม่ยกเลิกอ้างบิลนั้น ซึ่งรวมแถวของใบรับวางบิลนี้ด้วย (`billed` doc_flow.go:69)
- ปลายทาง: จ่ายชำระ 19 อ้างเลขใบรับวางบิลในช่อง doc_ref ของรายการ (บังคับเมื่อเปิด ap_pay_from_bill_note, pay_check.go:241)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 214 ซึ่งเป็นเอกสาร ap_ar_trans (doc_cancel.go:60, `apArCancelFlags` :63)
- แก้ไข/ลบไม่ได้เมื่อถูกใช้แล้ว เสร็จแล้ว หรือถูกยกเลิก (`apArEditLocked` docs.go:457)
- บันทึก/ลบต้องอยู่ในงวดบัญชีที่เปิด (`checkSaveDocPeriod` period.go:109, `checkDeleteDocPeriod` :116)
- เมื่อเปิด ap_bill_inform บิลที่เคยรับวางแล้วนำมารับวางซ้ำไม่ได้ ("ห้ามรับวางบิลซ้ำ" pay_check.go:226)
- ยอดในรายการเกินยอดคงเหลือไม่ได้ ยกเว้นเปิด pay_bill_over (pay_check.go:232)

## ข้อควรระวัง
- flow สถานะของตัวเอกสาร 213 เอง (used_status/doc_success) ยังไม่มีใน `flowRules` (doc_flow.go:89)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1345` เมนู
- `frontend/account/transaction/transLayouts.ts:117` FLAG_SPEC 213
- `backend/internal/application/process/docs.go:119` SaveDoc / `:532` billStmts / `:457` apArEditLocked / `:604` apDebtWhere
- `backend/internal/application/process/pay_check.go:221` checkBills
- `backend/internal/application/process/doc_flow.go:69` billed / `:89` 213 ยังไม่มี flow ของตัวเอง
- `backend/internal/application/process/doc_cancel.go:60` ยกเลิก 214

## ดูเพิ่ม
- [[doc-ap-payment]] · [[doc-ar-billing]] · [[doctypes-overview]]
