---
title: "ปรับปรุงสต็อกสินค้า/วัตถุดิบ (เพิ่ม) (Stock Adjustment In)"
tags: [doctypes, inventory]
aliases: ["trans_flag 66", "ปรับปรุงสต็อกเพิ่ม", "ปรับยอดเกิน", "IA", "menu_ic_stk_adjust"]
sources: ["frontend/account/tabs/transMenuMap.ts:1149", "frontend/account/transaction/transLayouts.ts:96", "frontend/account/transaction/transLayouts.ts:475", "backend/internal/application/process/transcalc.go:16", "backend/internal/application/process/stock_rebuild.go:19", "backend/internal/application/process/stock_rebuild.go:33", "backend/internal/application/process/service.go:1748", "backend/internal/application/process/service.go:2157", "backend/internal/application/process/service.go:2164", "backend/internal/application/process/service.go:1470", "backend/internal/application/process/stock_lot.go:617", "backend/internal/application/process/doc_flow_graph.go:198", "backend/internal/application/process/doc_cancel.go:53"]
---

# ปรับปรุงสต็อก (เพิ่ม) (trans_flag 66)

## ใช้เมื่อไร
ใช้ปรับยอดสต็อกเพิ่ม หรือรับผลนับเกินจากใบตรวจนับ 76 อยู่ที่เมนู `menu_ic_stk_adjust` "ปรับปรุงสต็อกสินค้า/วัตถุดิบ (เพิ่ม)" (IA, transMenuMap.ts:1149 เมนูใส่ transFlags 66/76)

## trans_flag/ตาราง
- trans_flag 66, calc_flag +1 (transcalc.go:16) เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: refDoc, inquiry, wh แท็บ gl (transLayouts.ts:96)
- ราคาชื่อ "ต้นทุน/หน่วย" (transLayouts.ts:475)

## ผลต่อสต็อก
- อยู่ในชุด flag ที่นับสต็อก (`stockRowsSQL` stock_rebuild.go:19) calc_flag +1 จึงเป็นสต็อกเข้า
- ในยอดตั้งต้นของการปรับอัตโนมัติ 66 ที่ qty > 0 นับเป็นรับเข้า และ qty < 0 นับเป็นจ่ายออก (`stockAdjustQtyPredicate` stock_rebuild.go:33)

## ผลต่อภาษี (VAT/WHT)
ไม่มี (ไม่อยู่ใน `transVatTabs` / `transWhtParty` trans_tax.go:37, :48)

## การลงบัญชี
standard GL `case 56, 58, 60, 66, 68` (service.go:2157-2168, อยู่ใน `glRebuildTransFlags` service.go:1748)
| Dr | Cr | จำนวน |
|---|---|---|
| สินค้า 1131 (สำรอง 1130, 1141) | ต้นทุน 5110 (สำรอง 5111) | ยอดรวม |
- ถ้า total_amount ของหัวเอกสารเป็น 0 ยอดรวมมาจากผลรวมบรรทัด (sum_of_cost → sum_amount → transfer_amount → qty × average_cost) (service.go:1470-1484)

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ตรวจนับ 76 ผ่าน `LotAutoRun` ซึ่งสร้างใบ 66 (เพิ่ม) และใบ 68 เลขที่ "-N" (ลด) (stock_lot.go:614-617)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 67 (doc_cancel.go:53)

## ข้อควรระวัง
- **Known gap ที่โค้ดระบุเอง** (service.go:2164-2166): บรรทัด 66 ที่ qty ≠ 0 และ inquiry_type ≠ 1 เข้าสต็อกด้วย qty × ราคาเฉลี่ย แต่ GL ลง Dr สินค้าด้วยยอดหัวเอกสารที่คีย์ ทำให้ GL ไม่เท่ามูลค่าสต็อก (comment ระบุว่ารอลุงจืดตัดสิน)
- doc_flow_graph.go:198 ให้ label 66 ว่า "สินค้าคงเหลือยกมา" ต่างจากชื่อเมนู

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1149` เมนู
- `frontend/account/transaction/transLayouts.ts:96` FLAG_SPEC 66
- `backend/internal/application/process/stock_rebuild.go:33` stockAdjustQtyPredicate
- `backend/internal/application/process/service.go:2157` / `:2164` GL และ known gap
- `backend/internal/application/process/doc_cancel.go:53` ยกเลิก 67

## ดูเพิ่ม
- [[doc-stock-count]] · [[doc-stock-adjust-decrease]] · [[acc-inventory-cost-moving-average]] · [[acc-gl-posting-standard]] · [[doctypes-overview]]
