---
title: "ขอโอนสินค้า/วัตถุดิบ (Transfer Request)"
tags: [doctypes, inventory]
aliases: ["trans_flag 124", "ขอโอนสินค้า", "ใบขอโอน", "RIM"]
sources: ["frontend/account/tabs/transMenuMap.ts:1058", "frontend/account/transaction/transLayouts.ts:114", "frontend/account/transaction/transLayouts.ts:306", "frontend/account/transaction/transLayouts.ts:474", "backend/internal/application/process/trans.go:22", "backend/internal/application/process/trans_ref_import.go:23", "backend/internal/application/process/doc_flow.go:89", "backend/internal/application/process/doc_cancel.go:53"]
---

# ขอโอนสินค้า/วัตถุดิบ (trans_flag 124)

## ใช้เมื่อไร
ใช้ขอโอนสินค้าระหว่างคลังก่อนโอนจริงด้วยใบ 72 อยู่ที่เมนู "ขอโอนสินค้า/วัตถุดิบ" (RIM, transMenuMap.ts:1058 มีค่า isTransfer)

## trans_flag/ตาราง
- trans_flag 124 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]
- grid บันทึกคอลัมน์คลัง/ที่เก็บปลายทางด้วย (comment trans.go:22)

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: refDoc, sale, wh, whTo ไม่มีแท็บ (transLayouts.ts:114)
- ช่อง sale แสดงชื่อ "ผู้ขอโอน:" (transLayouts.ts:306) และไม่แสดงราคา (transLayouts.ts:474)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี (`showsVatType` ไม่แสดงช่องภาษีให้ 124 transcalc.go:31)

## การลงบัญชี
ไม่ลง GL

## เอกสารต้นทาง-ปลายทาง
- ปลายทาง: โอนสินค้า 72 (คู่ {72,124} trans_ref_import.go:23)
- flow สถานะของ 124 ยังไม่ได้พอร์ต (doc_flow.go:89)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 125 (doc_cancel.go:53)

## ข้อควรระวัง
- เมนูยกเลิกใน transMenuMap ไม่พบคู่ของ 124 แต่ backend รองรับ 125 (doc_cancel.go:53)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1058` เมนู
- `frontend/account/transaction/transLayouts.ts:114` FLAG_SPEC 124
- `backend/internal/application/process/trans.go:22` คอลัมน์ปลายทาง
- `backend/internal/application/process/trans_ref_import.go:23` refImportSpecs
- `backend/internal/application/process/doc_cancel.go:53` ยกเลิก 125

## ดูเพิ่ม
- [[doc-stock-transfer]] · [[doctypes-overview]]
