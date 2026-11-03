---
title: "ปรับปรุงสต็อกสินค้า/วัตถุดิบ (ลด) (Stock Adjustment Out)"
tags: [doctypes, inventory]
aliases: ["trans_flag 68", "ปรับปรุงสต็อกลด", "ปรับยอดขาด", "IS"]
sources: ["frontend/account/tabs/transMenuMap.ts:1163", "frontend/account/transaction/transLayouts.ts:97", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/service.go:2146", "backend/internal/application/process/stock_lot.go:617", "backend/internal/application/process/doc_flow_graph.go:199", "backend/internal/application/process/doc_cancel.go:53"]
---

# ปรับปรุงสต็อก (ลด) (trans_flag 68)

## ใช้เมื่อไร
ใช้ปรับยอดสต็อกลด หรือรับผลนับขาดจากใบตรวจนับ 76 อยู่ที่เมนู "ปรับปรุงสต็อก (ลด)" (IS, transMenuMap.ts:1163)

## trans_flag/ตาราง
- trans_flag 68, calc_flag −1 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: refDoc, wh แท็บ gl (transLayouts.ts:97)
- ราคาชื่อ "ต้นทุน/หน่วย" (transLayouts.ts:475)

## ผลต่อสต็อก
ตัดออก (−1) (stock_rebuild.go:18)

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ใช้ standard GL (service.go:2146)
| Dr | Cr |
|---|---|
| ต้นทุน 5110/5111 (ยอดรวม) | สินค้า 1131/1130/1141 |

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ตรวจนับ 76 ผ่าน `LotAutoRun` ซึ่งสร้างใบ 68 เลขที่ลงท้าย "-N" (stock_lot.go:617)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 69 (doc_cancel.go:53)

## ข้อควรระวัง
- doc_flow_graph.go:199 ให้ label 68 ว่า "ปรับปรุงสต๊อกเกิน/ขาด" ต่างจากชื่อเมนู

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1163` เมนู
- `frontend/account/transaction/transLayouts.ts:97` FLAG_SPEC 68
- `backend/internal/application/process/service.go:2146` GL
- `backend/internal/application/process/stock_lot.go:617` LotAutoRun
- `backend/internal/application/process/doc_cancel.go:53` ยกเลิก 69

## ดูเพิ่ม
- [[doc-stock-adjust-increase]] · [[doc-stock-count]] · [[doctypes-overview]]
