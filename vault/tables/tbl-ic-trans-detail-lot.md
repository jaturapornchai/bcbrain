---
title: "ยอดสินค้าตามล็อต (ic_trans_detail_lot)"
tags: [tables, ic]
aliases: ["ic_trans_detail_lot", "LOT", "ล็อตสินค้า", "lot_number", "ยอดคงเหลือตามล็อต"]
sources: ["backend/internal/application/process/stock_lot.go:200", "backend/internal/application/process/stock_lot.go:224", "backend/internal/application/process/stock_lot.go:387", "backend/internal/application/process/stock_lot.go:617", "backend/internal/application/process/stock_beginning.go:551", "backend/internal/application/process/report_menu_ic.go:1206", "backend/internal/application/process/report_menu_ic.go:1242", "backend/internal/application/process/report_menu_so_po.go:838", "backend/internal/application/process/trans_lot_auto.go:105", "backend/internal/application/process/service.go:948", "backend/internal/adapter/inbound/http/process/stocktools_handler.go:86", "scripts/sql/02_data_schema.sql:6969"]
---
# ยอดสินค้าตามล็อต (`ic_trans_detail_lot`)

**หน้าที่:** บันทึกการเคลื่อนไหว "ตามเลข LOT" ของสินค้า (จำนวน, ราคา, มูลค่า, วันผลิต/หมดอายุ) ใช้ออกรายงานยอดคงเหลือตามล็อตและรายงานยาควบคุม ต้นทางของแถวคือบรรทัดใน [[tbl-ic-trans-detail]] ที่ระบุ `lot_number_1` ใช้กับสินค้าที่ตั้งวิธีคิดต้นทุนเป็น LOT (`ic_inventory.cost_type` 1 LOT FIFO, 2 LOT กำหนดเอง, 3 FEFO — enum ใน [[tbl-ic-inventory]])

## คอลัมน์ (จาก INSERT ที่ `stock_lot.go:229-234` และ `stock_beginning.go:551-555`)

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

DDL อยู่ที่ `scripts/sql/02_data_schema.sql:6969-6993` (23 คอลัมน์ รวมคอลัมน์ระบบ `ignore_sync`, `is_lock_record`, `roworder`, `create_date_time_now`) คอลัมน์ที่ Go เขียนและอ่านมีใน DDL ครบ ส่วน `product_year`, `product_week` อยู่ใน DDL แต่ไม่พบโค้ด Go อ่านหรือเขียน

## ใครเขียน — ข้อสำคัญ

บันทึกเอกสารปกติ (`saveTransTx`) **ไม่เขียนตารางนี้** เขียนแค่ `ic_trans_detail.lot_number_1` ส่วน `ic_trans_detail_lot` Go backend เขียนเองเฉพาะสองทางด้านล่าง (แถวที่มีอยู่แล้วในฐานข้อมูลถูกอ่านต่อ) ดังนั้นแถวที่ Go สร้างมาจากสองทางเท่านั้น:

1. **เอกสารยอดยกมา:** `sbInsertLot` เขียนแถว `calc_flag = 1` (`stock_beginning.go:550-555`; ลบก่อนเขียนใหม่ใน `sbDeleteRaw` ที่ `:489`) — ดู [[acc-stock-special-docs]]
2. **เอกสารปรับสต๊อกล็อต** (flag 66 ปรับเพิ่ม / 68 ปรับลด — `stock_lot.go:29-30` จากเมนู `menu_ic_adjust_stock_lot_amount` ผ่าน `LotAmountSave` `stock_lot.go:387` และ `menu_ic_stk_adjust_lot_auto` ผ่าน `LotAutoRun` `stock_lot.go:617`, ตารางเส้นทางที่ `stocktools_handler.go:86-88`): `saveAdjustDoc` ลบแล้ว INSERT จากบรรทัดที่มี `lot_number_1` (`stock_lot.go:200-237`)

## ใครอ่าน

- ยอดคงเหลือตามล็อต / รายงานล็อต: `icLotBalanceSpec` (`report_menu_ic.go:1206-1238`), `icLotInventorySpec` รายงาน Lot สินค้า (`report_menu_ic.go:1242-1262`), รายงานยาควบคุมในหมวดขาย `sopoDrugReports` (`report_menu_so_po.go:838-862`)
- ปรับล็อตตามมูลค่า: หาล็อตที่จำนวนเป็น 0 แต่มูลค่าไม่เป็น 0 ด้วย `HAVING SUM(calc_flag*qty)=0 AND ROUND(SUM(calc_flag*amount),2)<>0` (`stock_lot.go:316-321`)
- ปรับล็อตอัตโนมัติจากใบตรวจนับ 76: `LotAutoRun` อ่านยอดตามล็อตที่ `stock_lot.go:716-721`
- เลือกล็อตอัตโนมัติตอนขาย (flag 44) **ไม่อ่านตารางนี้** แต่อ่านยอดจาก `ic_trans_detail.lot_number_1` เพราะบันทึกเว็บไม่ได้เขียนตารางนี้ (`readLotBalances` `trans_lot_auto.go:105-109`)
- เปลี่ยนรหัสสินค้าแก้ `item_code` ของตารางนี้ (`workflow.go:145`)

## ข้อควรระวัง

- **ยอดของสองแหล่งอาจไม่ตรงกัน:** รายงานล็อตอ่านตารางนี้ แต่บันทึกเอกสารเว็บเขียนเฉพาะ `ic_trans_detail.lot_number_1` (ดัชนี `idx_ic_trans_detail_lot_balance` ที่ `service.go:948-950` สร้างบน `ic_trans_detail`) ควรเทียบทั้งสองก่อนเชื่อรายงานล็อต
- ตารางนี้ไม่ได้ถูกสร้างใหม่โดย `rebuildStockTx` ([[acc-inventory-stock-rebuild]])
- มูลค่าทุกช่องเป็น decimal (`::numeric`) ห้ามใช้ float

## ที่มาในโค้ด

- `scripts/sql/02_data_schema.sql:6969-6993` DDL ของ `ic_trans_detail_lot`
- `backend/internal/application/process/stock_lot.go:29-30`, `:200-237`, `:316-321`, `:387`, `:617`, `:716-721`
- `backend/internal/application/process/stock_beginning.go:489`, `:550-555`
- `backend/internal/application/process/report_menu_ic.go:1206-1238`, `:1242-1262`
- `backend/internal/application/process/report_menu_so_po.go:838-862`
- `backend/internal/application/process/trans_lot_auto.go:105-109`
- `backend/internal/application/process/service.go:948-950`
- `backend/internal/application/process/workflow.go:145`
- `backend/internal/adapter/inbound/http/process/stocktools_handler.go:86-88`
