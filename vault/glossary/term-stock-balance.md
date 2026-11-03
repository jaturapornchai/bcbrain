---
title: "ยอดคงเหลือสินค้า และต้นทุนเฉลี่ย (stock balance / balance_qty / average_cost / sum_of_cost)"
tags: [glossary, ic, stock, cost]
aliases: ["ยอดคงเหลือ", "ยอดคงเหลือสินค้า", "สต็อก", "สต๊อก", "สินค้าคงเหลือ", "จำนวนคงเหลือ", "คงเหลือตามคลัง", "คงเหลือตามที่เก็บ", "คงเหลือตาม LOT", "คำนวณยอดสต๊อกใหม่", "คำนวณสต็อกใหม่", "ต้นทุนเฉลี่ย", "ต้นทุนถัวเฉลี่ย", "ต้นทุนเฉลี่ยเคลื่อนที่", "Moving Average", "ต้นทุนขาย", "มูลค่าต้นทุน", "ค้างส่ง", "ค้างรับ", "balance_qty", "balance_qty_2", "average_cost", "sum_of_cost", "sum_of_cost_fix", "ic_inventory", "RebuildStock", "rebuildStockTx", "stockRowsSQL", "stockBalancePredicate", "CalculateMovingAverage", "menu_ic_recalc", "menu_ic_info_stk_balance", "ic_recalc"]
sources: ["backend/internal/application/process/service.go:149", "backend/internal/application/process/service.go:189", "backend/internal/application/process/service.go:1078", "backend/internal/application/process/service.go:1099", "backend/internal/application/process/service.go:1168", "backend/internal/application/process/service.go:1263", "backend/internal/application/process/service.go:1288", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/stock_rebuild.go:26", "backend/internal/application/process/stock_rebuild.go:29", "backend/internal/application/process/trans.go:593", "backend/internal/adapter/inbound/http/router.go:171", "frontend/account/tabs/screenRegistry.tsx:1121", "frontend/account/process/SystemProcessWorkbenchScreen.tsx:624", "frontend/src/app/api/process/stock/rebuild/route.ts:22", "frontend/account/transaction/TransItemGrid.tsx:71", "frontend/src/config/bcMenu.json:2581", "frontend/src/config/bcMenu.json:2621", "frontend/src/config/bcMenu.json:2634", "frontend/src/config/bcMenu.json:2647", "frontend/src/config/bcMenu.json:2660", "frontend/src/config/bcMenu.json:3393", "frontend/src/config/bcMenu.json:3406"]
---

# ยอดคงเหลือสินค้า / ต้นทุนเฉลี่ย

## ในระบบนี้คืออะไร
- **ยอดคงเหลือและต้นทุนเป็นข้อมูล derived** ระบบคำนวณใหม่ทุกครั้งจากแถวดิบใน `ic_trans_detail` ด้วย `big.Rat` ไม่มี float (`CalculateMovingAverage`, `service.go:189`; ปัดด้วย `RoundHalfUp` `:149`)
- ทุกครั้งที่บันทึกเอกสาร ระบบ rebuild เฉพาะสินค้าที่เอกสารนั้นแตะ (`rebuildTransDerived`, `trans.go:593-602`) และมีเมนู "คำนวณยอดสต๊อกใหม่" (`menu_ic_recalc`, bcMenu.json:2581, `screenRegistry.tsx:1121-1128`) เรียก `POST /api/process/stock/rebuild` (`SystemProcessWorkbenchScreen.tsx:624`) ซึ่งส่งต่อไปที่ backend `/api/v1/process/stock/rebuild` (`route.ts:22`, `router.go:171`)

## คอลัมน์
| คอลัมน์ | ความหมายจากโค้ด |
|---|---|
| `ic_inventory.balance_qty` | Σ `qty × calc_flag × (stand_value/divide_value)` คือยอดในหน่วยนับหลัก (`service.go:1078-1083`) |
| `ic_inventory.balance_qty_2` | Σ `qty_2 × calc_flag` (`:1081`) ดู [[term-unit-ratio]] |
| `ic_trans_detail.average_cost`, `sum_of_cost` | ต้นทุนต่อหน่วยและต้นทุนรวมของบรรทัด คำนวณแบบต้นทุนเฉลี่ยเคลื่อนที่ ปัดเศษ HALF_UP (`CalculateMovingAverage`, `service.go:186-189` เขียนกลับที่ `:1263-1267`) |
| `ic_inventory.average_cost` | ต้นทุนเฉลี่ยล่าสุดของสินค้า (`service.go:1288-1292`) |
| `sum_of_cost_fix` | ต้นทุนที่ล็อกไว้ (Ctrl+F9 lock cost, `TransItemGrid.tsx:71`; rebuild อ่านที่ `service.go:1168-1169`) ดู [[term-cost-type]] |

## แถวที่นับเป็นสต็อก (`stockRowsSQL`, `stock_rebuild.go:18-22`)
- เฉพาะแถวที่ `last_status = 0` ไม่ใช่สำเนาเอกสาร (`is_doc_copy`) และมี `item_type` 0, 4 หรือ 6
- flag: 12, 310, 14, 311, 16, 44, 46, 48, 54-73, 521, 522, 523
- ไม่นับ 46 เมื่อ inquiry ≠ 0, ไม่นับ 48 เมื่อ inquiry > 1 และไม่นับ 44 ที่มาจาก POS แล้วมี `doc_ref`
- **กระทบเฉพาะมูลค่า ไม่กระทบจำนวน**: 14, 16, 311 ที่ inquiry 1 หรือ 3 (ลดหนี้หรือเพิ่มหนี้ราคา) (`stockValueOnlySQL`, `:26`) จึงถูกตัดออกจากยอดจำนวน (`stockBalancePredicate`, `:29`) ดู [[term-inquiry-type]]
- ยอดคงเหลือไม่คำนวณให้สินค้า `item_type 5` (`service.go:1099`, `:1123`) ดู [[term-item-type]]

## หน้าจอสอบถามและรายงาน (bcMenu.json)
ยอดคงเหลือสินค้า (:2621) · ยอดคงเหลือสินค้าตามคลัง (:2634) · ยอดคงเหลือสินค้าตามที่เก็บ (:2647) · ยอดคงเหลือสินค้าตาม LOT (:2660) · รายงานสรุปยอดสินค้าค้างส่ง `menu_ic_report_sale_remain` (:3393) · รายงานสรุปยอดสินค้าค้างรับ `menu_report_accrued_in_qty` (:3406)

## ข้อควรระวัง
- ห้ามแก้ `balance_qty` หรือ `average_cost` ตรงๆ เพราะ rebuild ครั้งถัดไปจะเขียนทับ ถ้าตัวเลขผิดให้แก้ที่เอกสาร
- ยอดตามคลังและที่เก็บมาจากรายงาน ไม่ได้เก็บไว้ใน `ic_inventory` ดู [[term-wh-shelf]]
- `calc_flag` ไม่ใช่ตัวกรองเพียงอย่างเดียว ดู [[term-trans-flag]]

## ลิงก์
[[acc-inventory-stock-rebuild]] · [[tbl-ic-inventory]] · [[tbl-ic-trans-detail]] · [[term-cost-type]] · [[term-lot-serial-expire]] · [[glossary-overview]]

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:149`, `:186-189`, `:1078-1083`, `:1099`, `:1123`, `:1168-1169`, `:1263-1267`, `:1288-1292`
- `backend/internal/application/process/stock_rebuild.go:18-29`
- `backend/internal/application/process/trans.go:593-602`
- `backend/internal/adapter/inbound/http/router.go:171`
- `frontend/account/tabs/screenRegistry.tsx:1121-1128`; `frontend/account/process/SystemProcessWorkbenchScreen.tsx:624`; `frontend/src/app/api/process/stock/rebuild/route.ts:22`; `frontend/account/transaction/TransItemGrid.tsx:71`
- `frontend/src/config/bcMenu.json:2581`, `:2621`, `:2634`, `:2647`, `:2660`, `:3393`, `:3406`
