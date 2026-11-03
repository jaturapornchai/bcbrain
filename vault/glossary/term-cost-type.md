---
title: "ประเภทต้นทุน ต้นทุนเฉลี่ย/LOT/FIFO (cost type / cost_type / average_cost)"
tags: [glossary, ic, costing]
aliases: ["cost_type", "ประเภทต้นทุน", "ต้นทุนเฉลี่ย", "ถัวเฉลี่ย", "moving average", "ต้นทุน LOT", "FIFO", "ต้นทุน LOT FIFO", "ต้นทุน LOT กำหนดเอง", "FEFO", "ต้นทุนมาตรฐาน", "ต้นทุนแบบพิเศษ", "average_cost", "ต้นทุนต่อหน่วย", "sum_of_cost", "มูลค่าต้นทุน", "is_lock_cost", "sum_of_cost_fix", "ล็อกต้นทุน", "Ctrl+F9", "unit_cost", "หน่วยต้นทุน"]
sources: ["frontend/account/master/ItemScreen.tsx:2446", "frontend/src/config/schemas/icInventory.ts:88", "frontend/src/config/schemas/icInventory.ts:102", "backend/internal/application/process/report_menu_ic.go:885", "backend/internal/application/process/trans_lot_auto.go:14", "backend/internal/application/process/trans.go:49", "backend/internal/application/process/trans.go:69", "frontend/account/transaction/TransItemGrid.tsx:71", "frontend/account/transaction/transLayouts.ts:365", "docs/kms/KMS_INVENTORY_COSTING_SERIAL_PARALLEL_UNIT.md:12"]
---

# ประเภทต้นทุน (cost_type)

## ในระบบนี้คืออะไร
`ic_inventory.cost_type` บอกวิธีคิดต้นทุนของสินค้าแต่ละตัว บนจอสินค้าใช้ป้าย "ประเภทต้นทุน:" (`icInventory.ts:102`) และมีช่องคู่กันคือ "หน่วยต้นทุน:" (`unit_cost`, `:88`)
ต้นทุนต่อบรรทัดเอกสารเก็บที่ `ic_trans_detail.average_cost` และ `sum_of_cost`

## ค่าที่เป็นไปได้ (จากโค้ด)
| ค่า | dropdown (`ItemScreen.tsx:2446-2451`) | รายงาน (`report_menu_ic.go:885`) |
|---|---|---|
| 0 | 1.ต้นทุนเฉลี่ย | ต้นทุนเฉลี่ย |
| 1 | 2.ต้นทุน LOT FIFO | ต้นทุน LOT FIFO |
| 2 | 3.ต้นทุน LOT กำหนดเอง | ต้นทุน LOT กำหนดเอง |
| 3 | 4.ต้นทุน FEFO (วันหมดอายุ) | ต้นทุน FEFO (วันหมดอายุ) |
| 4 | 5.ต้นทุนมาตรฐาน | ต้นทุนมาตรฐาน |
| 5 | 6.ต้นทุนแบบพิเศษ 1 | ต้นทุนแบบพิเศษ 1 |

## คอลัมน์ที่เกี่ยวข้อง
- `averageCost` ในบรรทัดเอกสาร ถ้าว่างจะใช้ราคาแทน (`trans.go:49`)
- `isLockCost` / `sumOfCostFix` (`trans.go:69-70`) ใช้ล็อกต้นทุนรายบรรทัด กด Ctrl+F9 ในกริด (`TransItemGrid.tsx:71`)
- เอกสารสต็อกแสดงหัวคอลัมน์ราคาว่า "ต้นทุน/หน่วย" แทน "ราคา/หน่วย" (`transLayouts.ts:365`)
- เมื่อบันทึกขาย (44) ใหม่ บรรทัดที่สินค้าเป็น cost_type 2 (LOT) แต่ยังไม่ระบุ lot ระบบจะเลือก lot ให้อัตโนมัติ ถ้าหาไม่ได้จะบันทึกไม่ได้ (`trans_lot_auto.go:14-18`)

## ข้อควรระวัง
- KMS `docs/kms/KMS_INVENTORY_COSTING_SERIAL_PARALLEL_UNIT.md:12` เขียนว่า cost_type 0=Avg, 1=FIFO, 2=Lot/Expire, 3=Serial ซึ่ง **ไม่ตรงกับโค้ด** ให้ยึดตามตารางด้านบนที่มาจาก dropdown และรายงาน
- dropdown แสดงเลข 1-based (value 0 แสดงเป็น "1.") เหมือนประเภทสินค้า
- วิธีคำนวณต้นทุนเฉลี่ยเคลื่อนที่ดูได้ที่ [[acc-inventory-cost-moving-average]] และ [[std-inventory-costing-rules]]

## ลิงก์
[[term-item-type]] · [[term-lot-serial-expire]] · [[term-stock-balance]] · [[acc-inventory-stock-rebuild]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/account/master/ItemScreen.tsx:2446-2451`
- `frontend/src/config/schemas/icInventory.ts:88`, `:102`
- `backend/internal/application/process/report_menu_ic.go:885`
- `backend/internal/application/process/trans_lot_auto.go:14-18`
- `backend/internal/application/process/trans.go:49`, `:69-70`
- `frontend/account/transaction/TransItemGrid.tsx:71`; `frontend/account/transaction/transLayouts.ts:365`
- `docs/kms/KMS_INVENTORY_COSTING_SERIAL_PARALLEL_UNIT.md:12` (ค่าที่ไม่ตรงกับโค้ด)
