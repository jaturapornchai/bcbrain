---
title: "ตรวจนับสินค้า (Stock Count)"
tags: [doctypes, inventory]
aliases: ["trans_flag 76", "ตรวจนับสินค้า", "นับสต็อก", "CO", "LotAutoRun"]
sources: ["frontend/account/tabs/transMenuMap.ts:1133", "frontend/account/tabs/transMenuMap.ts:1147", "frontend/account/tabs/transMenuMap.ts:1149", "frontend/account/transaction/transLayouts.ts:100", "frontend/account/transaction/transLayouts.ts:350", "backend/internal/application/process/transcalc.go:16", "backend/internal/application/process/stock_rebuild.go:19", "backend/internal/application/process/stock_lot.go:617", "backend/internal/application/process/stock_lot.go:901", "backend/internal/application/process/service.go:1742", "backend/internal/application/process/doc_cancel.go:49"]
---

# ตรวจนับสินค้า (trans_flag 76)

## ใช้เมื่อไร
ใช้บันทึกจำนวนที่นับได้จริง อ้างใบขอตรวจนับ 276/128 ได้ (`refTransFlags` transMenuMap.ts:1147) อยู่ที่เมนู "ตรวจนับสินค้า" (CO, `menu_ic_stk_count` transMenuMap.ts:1133)

## trans_flag/ตาราง
- trans_flag 76, calc_flag +1 (transcalc.go:16) เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: refDoc, wh, recheck ไม่มีแท็บ (transLayouts.ts:100)
- มีช่องนับซ้ำ (`showRecheckCount` เฉพาะ 76, transLayouts.ts:350)

## ผลต่อสต็อก
- ใบ 76 เองไม่ขยับสต็อก เพราะไม่อยู่ในชุด flag ของ `stockRowsSQL` (stock_rebuild.go:19)
- ผลต่างของการนับจะถูกแปลงเป็นเอกสาร 66 (นับได้เกิน) และเอกสาร 68 เลขที่ "-N" (นับได้ขาด) โดย `LotAutoRun` (stock_lot.go:614-617) ใบนับที่มีใบปรับปรุงที่ยังใช้งานอยู่แล้วจะถูกปฏิเสธ จึงปรับซ้ำไม่ได้
- สินค้าที่ไม่ได้นับในใบที่เลือก ปรับยอดเป็นศูนย์ได้ด้วย `StockNotCountedRun` ซึ่งสร้างใบ 66/68 เช่นกัน (stock_lot.go:900-901)

## ผลต่อภาษี (VAT/WHT)
ไม่มี (ไม่อยู่ใน `transVatTabs` / `transWhtParty` trans_tax.go:37, :48)

## การลงบัญชี
ใบ 76 ไม่ลง GL (ไม่อยู่ใน `glRebuildTransFlags` service.go:1742) ส่วนใบ 66/68 ที่สร้างขึ้นลง GL ตามโน้ตของ flag นั้น ดู [[doc-stock-adjust-increase]] / [[doc-stock-adjust-decrease]]

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ขอตรวจนับ 276/128
- ปลายทาง: ปรับปรุงเพิ่ม 66 (เมนู 66 ใส่ transFlags 66/76 transMenuMap.ts:1149) และปรับปรุงลด 68

## ยกเลิก/แก้ไข
- ไม่มีคู่ยกเลิกของ 76 ใน `cancelOrigFlags` (doc_cancel.go:49)

## ข้อควรระวัง
- ต้องสั่งปรับปรุงสต็อกจากผลนับ ถ้าไม่สั่ง สต็อกจะไม่เปลี่ยน

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1133` เมนู
- `frontend/account/transaction/transLayouts.ts:100` FLAG_SPEC 76
- `backend/internal/application/process/stock_lot.go:617` LotAutoRun / `:901` StockNotCountedRun
- `backend/internal/application/process/stock_rebuild.go:19` stockRowsSQL

## ดูเพิ่ม
- [[doc-stock-count-request]] · [[doc-stock-adjust-increase]] · [[doc-stock-adjust-decrease]] · [[acc-stock-special-docs]] · [[doctypes-overview]]
