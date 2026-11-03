---
title: "รับสินค้าสำเร็จรูป (Finished Goods Receipt)"
tags: [doctypes, inventory]
aliases: ["trans_flag 60", "รับสินค้าสำเร็จรูป", "IF", "menu_ic_finish_receive"]
sources: ["frontend/account/tabs/transMenuMap.ts:938", "frontend/account/transaction/transLayouts.ts:95", "frontend/account/transaction/transLayouts.ts:191", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/service.go:2146", "backend/internal/application/process/service.go:1459", "backend/internal/application/process/doc_flow_graph.go:196", "backend/internal/application/process/doc_cancel.go:53"]
---

# รับสินค้าสำเร็จรูป (trans_flag 60)

## ใช้เมื่อไร
ใช้รับสินค้าที่ผลิตเสร็จเข้าคลัง อยู่ที่เมนู `menu_ic_finish_receive` "รับสินค้าสำเร็จรูป" (IF, transMenuMap.ts:938) ฝั่งคู่ค้าเป็น ap

## trans_flag/ตาราง
- trans_flag 60, calc_flag +1 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, refDoc, wh แท็บ gl (transLayouts.ts:95)
- ราคาชื่อ "ต้นทุน/หน่วย" (transLayouts.ts:475) และมีช่องจำนวน QC (transLayouts.ts:191)

## ผลต่อสต็อก
รับเข้า (+1) (stock_rebuild.go:18)

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ใช้ standard GL (service.go:2146)
| Dr | Cr |
|---|---|
| สินค้า 1131/1130/1141 | ต้นทุน 5110/5111 |

ถ้ายอดหัวเอกสารเป็น 0 จะใช้ผลรวมต้นทุนรายบรรทัดแทน (service.go:1459)

## เอกสารต้นทาง-ปลายทาง
- ไม่พบคู่ใน `refImportSpecs` (trans_ref_import.go:23)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 61 (doc_cancel.go:53)

## ข้อควรระวัง
- doc_flow_graph.go:196 ให้ label flag 60 ว่า "โอนสินค้าออก" ซึ่งไม่ตรงกับเมนู

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:938` เมนู
- `frontend/account/transaction/transLayouts.ts:95` FLAG_SPEC 60
- `backend/internal/application/process/service.go:2146` GL เอกสารสต็อก
- `backend/internal/application/process/service.go:1459` ยอด 0 ใช้ต้นทุนบรรทัด
- `backend/internal/application/process/doc_cancel.go:53` ยกเลิก 61

## ดูเพิ่ม
- [[acc-inventory-cost-moving-average]] · [[acc-gl-posting-standard]] · [[doctypes-overview]]
