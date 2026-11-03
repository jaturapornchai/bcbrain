---
title: "ปรับปรุงสต็อกสินค้า/วัตถุดิบ (เพิ่ม) (Stock Adjustment In)"
tags: [doctypes, inventory]
aliases: ["trans_flag 66", "ปรับปรุงสต็อกเพิ่ม", "ปรับยอดเกิน", "IA", "menu_ic_stk_adjust"]
sources: ["frontend/account/tabs/transMenuMap.ts:1149", "frontend/account/transaction/transLayouts.ts:96", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/stock_rebuild.go:33", "backend/internal/application/process/service.go:2146", "backend/internal/application/process/service.go:2150", "backend/internal/application/process/stock_lot.go:617", "backend/internal/application/process/doc_cancel.go:53"]
---

# ปรับปรุงสต็อก (เพิ่ม) (trans_flag 66)

## ใช้เมื่อไร
ใช้ปรับยอดสต็อกเพิ่ม หรือรับผลนับเกินจากใบตรวจนับ 76 อยู่ที่เมนู `menu_ic_stk_adjust` "ปรับปรุงสต็อกสินค้า/วัตถุดิบ (เพิ่ม)" (IA, transMenuMap.ts:1149 เมนูใส่ transFlags 66/76)

## trans_flag/ตาราง
- trans_flag 66, calc_flag +1 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: refDoc, inquiry, wh แท็บ gl (transLayouts.ts:96)
- ราคาชื่อ "ต้นทุน/หน่วย" (transLayouts.ts:475)

## ผลต่อสต็อก
- อยู่ใน `stockRowsSQL` (stock_rebuild.go:18)
- ในยอดตั้งต้นของการปรับอัตโนมัติ 66 ที่ qty > 0 นับเป็นรับเข้า และ qty < 0 นับเป็นจ่ายออก (`stockAdjustQtyPredicate` stock_rebuild.go:33)

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ใช้ standard GL (service.go:2146)
| Dr | Cr |
|---|---|
| สินค้า 1131/1130/1141 | ต้นทุน 5110/5111 |

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ตรวจนับ 76 ผ่าน `LotAutoRun` (stock_lot.go:617)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 67 (doc_cancel.go:53)

## ข้อควรระวัง
- **Known gap ที่โค้ดระบุเอง** (service.go:2150): 66 ที่มี qty และ inquiry_type ≠ 1 เข้าสต็อกด้วย qty × ราคาเฉลี่ย แต่ GL ลง Dr สินค้าด้วยยอดหัวเอกสารที่คีย์ ทำให้ GL ไม่เท่ามูลค่าสต็อก (comment ระบุว่ารอตัดสิน)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1149` เมนู
- `frontend/account/transaction/transLayouts.ts:96` FLAG_SPEC 66
- `backend/internal/application/process/stock_rebuild.go:33` stockAdjustQtyPredicate
- `backend/internal/application/process/service.go:2146` / `:2150` GL และ known gap
- `backend/internal/application/process/doc_cancel.go:53` ยกเลิก 67

## ดูเพิ่ม
- [[doc-stock-count]] · [[doc-stock-adjust-decrease]] · [[acc-inventory-cost-moving-average]] · [[acc-gl-posting-standard]] · [[doctypes-overview]]
