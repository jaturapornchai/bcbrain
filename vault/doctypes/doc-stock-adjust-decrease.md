---
title: "ปรับปรุงสต็อกสินค้า/วัตถุดิบ (ลด) (Stock Adjustment Out)"
tags: [doctypes, inventory]
aliases: ["trans_flag 68", "ปรับปรุงสต็อกลด", "ปรับยอดขาด", "IS"]
sources: ["frontend/account/tabs/transMenuMap.ts:1163", "frontend/account/transaction/transLayouts.ts:97", "frontend/account/transaction/transLayouts.ts:475", "backend/internal/application/process/transcalc.go:21", "backend/internal/application/process/stock_rebuild.go:19", "backend/internal/application/process/service.go:1748", "backend/internal/application/process/service.go:2157", "backend/internal/application/process/service.go:1470", "backend/internal/application/process/stock_lot.go:617", "backend/internal/application/process/doc_flow_graph.go:199", "backend/internal/application/process/doc_cancel.go:53"]
---

# ปรับปรุงสต็อก (ลด) (trans_flag 68)

## ใช้เมื่อไร
ใช้ปรับยอดสต็อกลด หรือรับผลนับขาดจากใบตรวจนับ 76 อยู่ที่เมนู `menu_ic_stk_adjust_subtract` "ปรับปรุงสต็อกสินค้า/วัตถุดิบ (ลด)" (IS, transMenuMap.ts:1163)

## trans_flag/ตาราง
- trans_flag 68, calc_flag −1 (transcalc.go:21) เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: refDoc, wh แท็บ gl (transLayouts.ts:97)
- ราคาชื่อ "ต้นทุน/หน่วย" (transLayouts.ts:475)

## ผลต่อสต็อก
อยู่ในชุด flag ที่นับสต็อก (`stockRowsSQL` stock_rebuild.go:19) calc_flag −1 จึงเป็นสต็อกออก

## ผลต่อภาษี (VAT/WHT)
ไม่มี (ไม่อยู่ใน `transVatTabs` / `transWhtParty` trans_tax.go:37, :48)

## การลงบัญชี
standard GL `case 56, 58, 60, 66, 68` (service.go:2157-2168, อยู่ใน `glRebuildTransFlags` service.go:1748)
| Dr | Cr | จำนวน |
|---|---|---|
| ต้นทุน 5110 (สำรอง 5111) | สินค้า 1131 (สำรอง 1130, 1141) | ยอดรวม |
- ถ้า total_amount ของหัวเอกสารเป็น 0 ยอดรวมมาจากผลรวมบรรทัด (sum_of_cost → sum_amount → transfer_amount → qty × average_cost) (service.go:1470-1484)

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ตรวจนับ 76 ผ่าน `LotAutoRun` ซึ่งสร้างใบ 66 (เพิ่ม) และใบ 68 เลขที่ "-N" (ลด) (stock_lot.go:614-617)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 69 (doc_cancel.go:53)

## ข้อควรระวัง
- doc_flow_graph.go:199 ให้ label 68 ว่า "ปรับปรุงสต๊อกเกิน/ขาด" ต่างจากชื่อเมนู

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1163` เมนู
- `frontend/account/transaction/transLayouts.ts:97` FLAG_SPEC 68
- `backend/internal/application/process/service.go:2157` GL
- `backend/internal/application/process/stock_lot.go:617` LotAutoRun
- `backend/internal/application/process/doc_cancel.go:53` ยกเลิก 69

## ดูเพิ่ม
- [[doc-stock-adjust-increase]] · [[doc-stock-count]] · [[doctypes-overview]]
