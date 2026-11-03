---
title: "ตรวจนับสินค้า (Stock Count)"
tags: [doctypes, inventory]
aliases: ["trans_flag 76", "ตรวจนับสินค้า", "นับสต็อก", "CO", "LotAutoRun"]
sources: ["frontend/account/tabs/transMenuMap.ts:1133", "frontend/account/transaction/transLayouts.ts:100", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/stock_lot.go:617", "backend/internal/application/process/doc_cancel.go:49"]
---

# ตรวจนับสินค้า (trans_flag 76)

## ใช้เมื่อไร
ใช้บันทึกจำนวนที่นับได้จริง อ้างใบขอตรวจนับ 276/128 ได้ อยู่ที่เมนู "ตรวจนับสินค้า" (CO, transMenuMap.ts:1133)

## trans_flag/ตาราง
- trans_flag 76 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: refDoc, wh, recheck ไม่มีแท็บ (transLayouts.ts:100)
- มีช่องนับซ้ำ (`showRecheckCount`)

## ผลต่อสต็อก
- ใบ 76 เองไม่ขยับสต็อก เพราะไม่อยู่ใน `stockRowsSQL` (stock_rebuild.go:18)
- ผลต่างของการนับจะถูกแปลงเป็นเอกสาร 66 (นับได้เกิน) และเอกสาร 68 เลขที่ลงท้าย "-N" (นับได้ขาด) โดย `LotAutoRun` (stock_lot.go:617) ใบนับที่ปรับปรุงไปแล้วจะปรับซ้ำไม่ได้

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ใบ 76 ไม่ลง GL ส่วนใบ 66/68 ที่สร้างขึ้นลง GL ตามการ์ดของ flag นั้น

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ขอตรวจนับ 276/128
- ปลายทาง: ปรับปรุงเพิ่ม 66 (เมนู 66 ใส่ transFlags 66/76 transMenuMap.ts:1149) และปรับปรุงลด 68

## ยกเลิก/แก้ไข
- ไม่มีคู่ยกเลิกของ 76 ใน `cancelOrigFlags` (doc_cancel.go:49) (ไม่พบในโค้ด)

## ข้อควรระวัง
- ต้องสั่งปรับปรุงสต็อกจากผลนับ ถ้าไม่สั่ง สต็อกจะไม่เปลี่ยน

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1133` เมนู
- `frontend/account/transaction/transLayouts.ts:100` FLAG_SPEC 76
- `backend/internal/application/process/stock_lot.go:617` LotAutoRun
- `backend/internal/application/process/stock_rebuild.go:18` stockRowsSQL

## ดูเพิ่ม
- [[doc-stock-count-request]] · [[doc-stock-adjust-increase]] · [[doc-stock-adjust-decrease]] · [[acc-stock-special-docs]] · [[doctypes-overview]]
