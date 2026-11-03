---
title: "ใบรับวางบิล เจ้าหนี้ (AP Bill Receipt)"
tags: [doctypes, ap]
aliases: ["trans_flag 213", "ใบรับวางบิล", "รับวางบิล", "DD"]
sources: ["frontend/account/tabs/transMenuMap.ts:1345", "frontend/account/transaction/transLayouts.ts:117", "frontend/account/transaction/transLayouts.ts:161", "backend/internal/application/process/docs.go:119", "backend/internal/application/process/docs.go:457", "backend/internal/application/process/docs.go:532", "backend/internal/application/process/doc_flow.go:89", "backend/internal/application/process/doc_cancel.go:60"]
---

# ใบรับวางบิล ฝั่งเจ้าหนี้ (trans_flag 213)

## ใช้เมื่อไร
ใช้รวบรวมบิลที่ผู้ขายนำมาวางเพื่อเตรียมจ่าย อยู่ที่เมนู "ใบรับวางบิล (เจ้าหนี้)" (DD, transMenuMap.ts:1345)

## trans_flag/ตาราง
- หัวเอกสารอยู่ใน [[tbl-ap-ar-trans]] ส่วนรายการบิลอยู่ใน [[tbl-ap-ar-trans-detail]]
- บันทึกผ่าน `/process/doc/save` (`SaveDoc` docs.go:119) และเขียนรายการด้วย `billStmts` (docs.go:532)

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party ไม่มีแท็บ (transLayouts.ts:117)
- grid แบบตารางเอกสารหนี้ (`BILLS_FLAGS` transLayouts.ts:161)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ไม่ลง GL เพราะไม่อยู่ใน `glRebuildTransFlags` (service.go:1731)

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: เอกสารหนี้เจ้าหนี้ตาม `apDebtWhere`/`apCreditWhere` (docs.go:597) เช่น 12, 14, 16, 81–91, 260–264, 315–317
- ปลายทาง: จ่ายชำระ 19
- flow สถานะของ 213 ยังไม่ได้พอร์ต (doc_flow.go:89)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 214 ซึ่งเป็นเอกสาร ap_ar_trans (doc_cancel.go:60, `apArCancelFlags` :63)
- แก้ไขไม่ได้เมื่อถูกใช้แล้ว เสร็จแล้ว หรือถูกยกเลิก (`apArEditLocked` docs.go:457)

## ข้อควรระวัง
- เพราะ flow ยังไม่พอร์ต used_status_2 ของบิลต้นทางจึงไม่ถูกคำนวณจากใบรับวางบิลนี้

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1345` เมนู
- `frontend/account/transaction/transLayouts.ts:117` FLAG_SPEC 213
- `backend/internal/application/process/docs.go:119` SaveDoc / `:532` billStmts / `:457` apArEditLocked
- `backend/internal/application/process/doc_flow.go:89` flow ยังไม่พอร์ต
- `backend/internal/application/process/doc_cancel.go:60` ยกเลิก 214

## ดูเพิ่ม
- [[doc-ap-payment]] · [[doc-ar-billing]] · [[doctypes-overview]]
