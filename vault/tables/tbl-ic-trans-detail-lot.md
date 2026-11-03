---
title: "ยอดสินค้าตามล็อต (ic_trans_detail_lot)"
tags: [tables, ic]
aliases: ["ic_trans_detail_lot", "LOT", "ล็อตสินค้า", "lot_number", "ยอดคงเหลือตามล็อต"]
sources: ["backend/internal/application/process/stock_lot.go:25", "backend/internal/application/process/stock_lot.go:224", "backend/internal/application/process/stock_beginning.go:551", "backend/internal/application/process/report_menu_ic.go:1172", "backend/internal/application/process/report_menu_so_po.go:836", "backend/internal/application/process/trans_lot_auto.go:21", "backend/internal/application/process/service.go:937"]
---
# ยอดสินค้าตามล็อต (`ic_trans_detail_lot`)

**หน้าที่:** บันทึกการเคลื่อนไหว "ตามเลข LOT" ของสินค้า (จำนวน, ราคา, มูลค่า, วันผลิต/หมดอายุ) ใช้ออกรายงานยอดคงเหลือตามล็อตและรายงานยาควบคุม ต้นทางของแถวคือบรรทัดใน [[tbl-ic-trans-detail]] ที่ระบุ `lot_number_1` ใช้กับสินค้าที่ตั้งวิธีคิดต้นทุนเป็น LOT (`ic_inventory.cost_type` 1 LOT FIFO, 2 LOT กำหนดเอง, 3 FEFO — enum ใน [[tbl-ic-inventory]])

## คอลัมน์ (จาก INSERT ที่ `stock_lot.go:229-231` และ `stock_beginning.go:551-555`)

| column | ความหมาย |
|---|---|
| `trans_flag`, `doc_no` | เอกสารเจ้าของ ([[tbl-ic-trans]]) |
| `doc_date`, `doc_time` | วัน-เวลาเอกสาร (รายงานตัดยอดด้วย `doc_date <= วันที่สิ้นสุด`) |
| `line_number`, `doc_line_number` | ลำดับแถว และบรรทัดสินค้าที่ตรงกันใน [[tbl-ic-trans-detail]] |
| `item_code` | รหัสสินค้า |
| `wh_code`, `shelf_code` | คลัง/ที่เก็บของล็อต |
| `lot_number` | เลข LOT |
| `calc_flag` | +1 รับ / -1 จ่าย (ยอดล็อต = ผลรวม `calc_flag × qty`) |
| `qty`, `price`, `amount` | จำนวน, ราคา, มูลค่า (`amount` = `sum_of_cost` ของบรรทัดหลัง rebuild ต้นทุน) |
| `mfd_date`, `expire_date`, `mfn_name` | วันผลิต, วันหมดอายุ, ผู้ผลิต (เฉพาะแถวยอดยกมา) |
| `create_date_time_now` | เวลาสร้างแถว (เฉพาะยอดยกมา) |

## ใครเขียน — ข้อสำคัญ

บันทึกเอกสารปกติ (`saveTransTx`) **ไม่เขียนตารางนี้** เขียนแค่ `ic_trans_detail.lot_number_1` ส่วน `ic_trans_detail_lot` ในระบบเดิมถูกเติมโดย cost engine ฝั่ง Java ซึ่งไม่ได้รันใน backend Go (คอมเมนต์ `stock_lot.go:25-26`, `trans_lot_auto.go:21-24`) ดังนั้นแถวในตารางนี้มาจากสามทางเท่านั้น:

1. **เอกสารยอดยกมา:** `sbInsertLot` เขียนแถว `calc_flag = 1` (`stock_beginning.go:551-555`; ลบก่อนเขียนใหม่ที่ `:489`) — ดู [[acc-stock-special-docs]]
2. **เอกสารปรับสต๊อกล็อต** (flag 66 ปรับเพิ่ม / 68 ปรับลด จากเมนู `menu_ic_adjust_stock_lot_amount` และ `menu_ic_stk_adjust_lot_auto`, `stock_lot.go:19-23`): `saveAdjustDoc` ลบแล้ว INSERT จากบรรทัดที่มี `lot_number_1` (`stock_lot.go:199-237`)
3. **ข้อมูลที่ระบบ Java เคยเติมไว้** (migrate มา) — อ่านได้แต่ Go ไม่สร้างเอง

## ใครอ่าน

- ยอดคงเหลือตามล็อต / รายงานล็อต: `icLotBalanceSpec` (`report_menu_ic.go:1172-1230`), รายงานยาควบคุมในหมวดขาย (`report_menu_so_po.go:836-860`)
- ปรับล็อตตามมูลค่า: หาล็อตที่จำนวนเป็น 0 แต่มูลค่าไม่เป็น 0 ด้วย `HAVING SUM(calc_flag*qty)=0 AND ROUND(SUM(calc_flag*amount),2)<>0` (`stock_lot.go:316-321`)
- ปรับล็อตอัตโนมัติจากใบตรวจนับ 76: ยอดตามล็อต (`stock_lot.go:696-722`)
- เลือกล็อตอัตโนมัติ **ไม่อ่านตารางนี้** แต่อ่าน `ic_trans_detail.lot_number_1` เพราะบันทึกเว็บไม่ได้เขียนตารางนี้ (`trans_lot_auto.go:21-23`)
- เปลี่ยนรหัสสินค้าแก้ `item_code` ของตารางนี้ (`workflow.go:145`)

## ข้อควรระวัง

- **ยอดของสองแหล่งอาจไม่ตรงกัน:** รายงานล็อตอ่านตารางนี้ แต่บันทึกเอกสารเว็บเขียนเฉพาะ `ic_trans_detail.lot_number_1` (ดัชนี `idx_ic_trans_detail_lot_balance` ที่ `service.go:937-939` สร้างบน `ic_trans_detail`) ควรเทียบทั้งสองก่อนเชื่อรายงานล็อต
- ตารางนี้ไม่ได้ถูกสร้างใหม่โดย `rebuildStockTx` ([[acc-inventory-stock-rebuild]])
- มูลค่าทุกช่องเป็น decimal (`::numeric`) ห้ามใช้ float

## ที่มาในโค้ด

- `backend/internal/application/process/stock_lot.go:25-26`, `:199-237`, `:316-321`, `:696-722`
- `backend/internal/application/process/stock_beginning.go:489`, `:551-555`
- `backend/internal/application/process/report_menu_ic.go:1172-1230`
- `backend/internal/application/process/report_menu_so_po.go:836-860`
- `backend/internal/application/process/trans_lot_auto.go:21-24`
- `backend/internal/application/process/service.go:937-939`
- `backend/internal/application/process/workflow.go:145`
