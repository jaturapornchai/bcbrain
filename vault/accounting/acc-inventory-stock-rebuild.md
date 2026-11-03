---
title: "การคำนวณยอดสต็อกคงเหลือใหม่ (Stock Balance Rebuild)"
tags: [accounting, inventory, stock, rebuild, postgres]
aliases: ["คำนวณสต็อกใหม่", "ยอดคงเหลือสินค้า", "RebuildStock", "balance_qty", "balance_qty_2", "หน่วยนับขนาน", "stockRowsSQL", "ประมวลผลสต็อก"]
sources: ["backend/internal/application/process/service.go:559", "backend/internal/application/process/service.go:588", "backend/internal/application/process/service.go:605", "backend/internal/application/process/service.go:634", "backend/internal/application/process/service.go:727", "backend/internal/application/process/service.go:821", "backend/internal/application/process/service.go:972", "backend/internal/application/process/service.go:982", "backend/internal/application/process/service.go:1001", "backend/internal/application/process/service.go:1003", "backend/internal/application/process/service.go:1018", "backend/internal/application/process/service.go:1060", "backend/internal/application/process/service.go:1078", "backend/internal/application/process/service.go:1099", "backend/internal/application/process/service.go:1173", "backend/internal/application/process/service.go:1204", "backend/internal/application/process/service.go:1255", "backend/internal/application/process/service.go:1276", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/stock_rebuild.go:26", "backend/internal/application/process/stock_rebuild.go:179", "backend/internal/application/process/stock_rebuild.go:193", "backend/internal/application/process/trans_line_extra.go:16", "backend/internal/application/process/trans_line_extra.go:34", "backend/internal/application/process/trans.go:597"]
---

# การคำนวณยอดสต็อกคงเหลือใหม่ (`rebuildStockTx`)

ยอดคงเหลือ (`ic_inventory.balance_qty`, `balance_qty_2`) และต้นทุน (`ic_trans_detail.sum_of_cost`, `average_cost`, `ic_inventory.average_cost`) เป็นค่า derived ที่คำนวณใหม่จาก `ic_trans_detail` ทุกครั้ง ไม่บวกลบทีละเอกสาร ทำทั้งตอนบันทึก/ลบเอกสาร (เฉพาะสินค้าที่แตะ) และตอนสั่ง `RebuildStock` (ทั้งฐาน หรือรายสินค้า)

## ทำงานอย่างไร

### ผู้เรียก
- บันทึก/ลบเอกสารซื้อขาย (trans.go:597), บิล POS (pos_bill.go:725), เครื่องมือสต็อก (stock_tools.go:565)
- `RebuildStock` (service.go:559) timeout 60 วินาที แล้วเข้า `rebuildStockWithOptionsTx` (:588); ถ้าไม่ได้สั่ง action พิเศษ และ `UpdateUnitRatio` ไม่ได้ปิด (:605) จะปรับอัตราหน่วยก่อน: สินค้า unit_type 0/2 ตั้ง `stand_value` / `divide_value` = 1, สินค้า unit_type 1/3 ดึงอัตราจาก `ic_unit_use` (:634-637) แล้วจึงเรียก `rebuildStockTx` (:621)

### การล็อก (service.go:1001-1016, :1020-1028)
- รายสินค้า: shared lock "ic_inventory:rebuild" + exclusive lock ต่อรหัสสินค้า ("ic_stock:" + code) เรียงรหัสก่อนเพื่อกัน deadlock
- ทั้งฐาน: exclusive lock "ic_inventory:rebuild"

### แถวที่นับเข้าสต็อก (`stockRowsSQL` stock_rebuild.go:18)
- `last_status` = 0, ไม่ใช่สำเนา (`is_doc_copy` = 0), `item_type` 0/4/6
- flag: 12, 310, 14, 311, 16, 44, 46, 48, 54-73, 521-523
- ยกเว้น: 46 ที่ inquiry_type <> 0, 48 ที่ inquiry_type > 1, ขาย 44 ที่มี doc_ref และ `is_pos` = 1
- `stockValueOnlySQL` (:26): 14/16/311 ที่ inquiry_type 1/3 เปลี่ยนแค่มูลค่า ไม่นับ qty

### ขั้นตอน (service.go:1018)
1. sync `ic_trans_detail.item_type` จาก `ic_inventory`
2. backfill `sum_of_cost` ของ 58 ที่ยังเป็น 0 (qty > 0 และมี average_cost) = ROUND(qty x average_cost, 2) (:1060-1075)
3. `balance_qty` = SUM(qty x calc_flag x stand/divide) และ `balance_qty_2` = SUM(qty_2 x calc_flag) เฉพาะแถวที่นับ qty (:1078-1083); ไม่รวมสินค้าบริการ item_type 5 (:1099)
4. ดึงความเคลื่อนไหวทุกสินค้าใน query เดียว เรียงตาม: รหัส, `doc_date_calc`/`doc_date`, `doc_time_calc`/`doc_time`, calc_flag มากก่อน (70 ถูกบังคับไว้ท้าย), trans_flag, doc_no, line_number, roworder (:1173-1180)
5. ส่งเข้า `CalculateMovingAverage` ทีละสินค้า (:1198) ดู [[acc-inventory-cost-moving-average]]; ผลถูกปัดแบบ HALF_UP: `sum_of_cost` ตามทศนิยมมูลค่า, `average_cost` ตามทศนิยมราคา (:1204-1205)
6. bulk UPDATE ด้วย UNNEST เฉพาะแถวที่เปลี่ยน (:1255-1273) แล้วตั้ง `ic_inventory.average_cost` = ต้นทุนเฉลี่ยตัวสุดท้าย สินค้าที่ไม่มีความเคลื่อนไหวได้ 0 (:1276-1293)

### ทศนิยม (`stockScales` service.go:982)
- `item_price_decimal` (ต้นทุนเฉลี่ย) และ `item_amount_decimal` (มูลค่า) ช่วง 1-6 ค่าอื่นหรือ 0 ใช้ 2

### หน่วยนับขนาน
- unit_type 2 หรือ 3 = หน่วยขนาน; `unit_code_2` / `qty_2` เก็บเฉพาะหน่วยขนาน หรือเอกสารใน `compareUnitFlags` {30, 34, 36, 44, 144, 46, 48} ที่เปิดใช้หน่วยเปรียบเทียบ (trans_line_extra.go:16, :34-35)

### ตรวจสถานะเอกสาร (`recheckDocFlowTx` service.go:727)
- รันเมื่อสั่ง action ตรวจสถานะเอกสาร: เอกสารยกเลิก (`is_cancel` = 1) ถูกตั้ง `last_status` = 1 ทั้งหัว บรรทัด และ cb_trans จึงหลุดจากสต็อก (:730-733)

## จุดเสี่ยง
- **เปลี่ยน schema ตอน runtime**: `erpSchemaSQL` (service.go:807) มี `ALTER TABLE ic_inventory ADD COLUMN IF NOT EXISTS balance_qty_2` (:821) และถูกรันครั้งแรกที่เปิด pool ของแต่ละฐาน (:972-976) ถ้า error จะไม่หยุดงาน แต่จะลองใหม่ครั้งหน้า
- **ปุ่ม "Update ic_trans_detail" (`recalcDetailLine`) hardcode VAT 7%** (stock_rebuild.go:179-180, :193-209) ดู [[acc-rounding-decimal]]
- backfill 58 ใช้ทศนิยม 2 ตายตัว ไม่ตาม `stockScales`
- บรรทัดที่ `last_status` <> 0 หรือ flag ไม่อยู่ในรายการ ไม่มีผลกับสต็อกเลย เช่น ใบสั่งซื้อ/ใบสั่งขาย ดู [[acc-trans-flag-map]]

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:559` RebuildStock
- `backend/internal/application/process/service.go:588` rebuildStockWithOptionsTx / `:634-637` ปรับอัตราหน่วย
- `backend/internal/application/process/service.go:1001` stockRebuildLock / `:1003` lockStockItems
- `backend/internal/application/process/service.go:1018` rebuildStockTx
- `backend/internal/application/process/service.go:1078` balance_qty
- `backend/internal/application/process/service.go:1173` ลำดับความเคลื่อนไหว
- `backend/internal/application/process/service.go:1255` bulk update ต้นทุน
- `backend/internal/application/process/stock_rebuild.go:18` stockRowsSQL
- `backend/internal/application/process/stock_rebuild.go:26` stockValueOnlySQL
- `backend/internal/application/process/service.go:821` ALTER TABLE runtime

## ดูเพิ่ม
- [[acc-inventory-cost-moving-average]]
- [[acc-stock-special-docs]]
- [[acc-transaction-save-flow]]
- [[process-overview]]
