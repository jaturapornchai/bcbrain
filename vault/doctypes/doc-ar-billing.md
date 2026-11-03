---
title: "ใบวางบิล ลูกหนี้ (AR Billing Note)"
tags: [doctypes, ar]
aliases: ["trans_flag 235", "ใบวางบิล", "ใบแจ้งหนี้", "ED"]
sources: ["frontend/account/tabs/transMenuMap.ts:1544", "frontend/account/transaction/transLayouts.ts:118", "frontend/account/transaction/transLayouts.ts:161", "backend/internal/application/process/docs.go:119", "backend/internal/application/process/docs.go:457", "backend/internal/application/process/docs.go:532", "backend/internal/application/process/doc_flow.go:89", "backend/internal/application/process/doc_cancel.go:60"]
---

# ใบวางบิล ฝั่งลูกหนี้ (trans_flag 235)

## ใช้เมื่อไร
ใช้รวมบิลที่ค้างชำระเพื่อส่งให้ลูกค้า อยู่ที่เมนู "ใบวางบิล (ลูกหนี้)" (ED, transMenuMap.ts:1544)

## trans_flag/ตาราง
- หัวเอกสารอยู่ใน [[tbl-ap-ar-trans]] และรายการบิลอยู่ใน [[tbl-ap-ar-trans-detail]] บันทึกผ่าน `SaveDoc` (docs.go:119, `billStmts` :532)

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party ไม่มีแท็บ (transLayouts.ts:118)
- grid แบบตารางเอกสารหนี้ (`BILLS_FLAGS` transLayouts.ts:161)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ไม่ลง GL

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: เอกสารหนี้ลูกหนี้ตาม `arDebtWhere`/`arCreditWhere` (docs.go:597) เช่น 44, 46, 48, 93–103, 250–254, 418, 1802
- ปลายทาง: รับชำระ 239
- flow สถานะของ 235 ยังไม่ได้พอร์ต (doc_flow.go:89)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 236 (doc_cancel.go:60)
- แก้ไขไม่ได้เมื่อถูกใช้แล้ว เสร็จแล้ว หรือถูกยกเลิก (`apArEditLocked` docs.go:457)

## ข้อควรระวัง
- เพราะ flow ยังไม่พอร์ต สถานะ "วางบิลแล้ว" ของบิลต้นทางจึงไม่ได้มาจากใบนี้

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1544` เมนู
- `frontend/account/transaction/transLayouts.ts:118` FLAG_SPEC 235
- `backend/internal/application/process/docs.go:119` SaveDoc / `:597` เงื่อนไขหนี้
- `backend/internal/application/process/doc_flow.go:89` flow ยังไม่พอร์ต
- `backend/internal/application/process/doc_cancel.go:60` ยกเลิก 236

## ดูเพิ่ม
- [[doc-ar-receipt]] · [[doc-ap-billing-receive]] · [[doctypes-overview]]
