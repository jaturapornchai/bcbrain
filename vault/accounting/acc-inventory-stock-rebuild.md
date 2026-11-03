---
title: "การคำนวณยอดสต็อกคงเหลือใหม่ (Stock Balance Rebuild)"
tags: [accounting, inventory, stock, rebuild, postgres]
aliases: ["คำนวณสต็อกใหม่", "ยอดคงเหลือสินค้า", "RebuildStock", "balance_qty", "balance_qty_2", "หน่วยนับขนาน", "stockRowsSQL", "ประมวลผลสต็อก"]
sources: ["backend/internal/application/process/service.go:545", "backend/internal/application/process/service.go:610", "backend/internal/application/process/service.go:623", "backend/internal/application/process/service.go:715", "backend/internal/application/process/service.go:810", "backend/internal/application/process/service.go:962", "backend/internal/application/process/service.go:971", "backend/internal/application/process/service.go:990", "backend/internal/application/process/service.go:1007", "backend/internal/application/process/service.go:1066", "backend/internal/application/process/service.go:1143", "backend/internal/application/process/service.go:1244", "backend/internal/application/process/service.go:1264", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/stock_rebuild.go:26", "backend/internal/application/process/stock_rebuild.go:179", "backend/internal/application/process/trans.go:597"]
---

# การคำนวณยอดสต็อกคงเหลือใหม่ (`rebuildStockTx`)

ยอดคงเหลือ (`ic_inventory.balance_qty`, `balance_qty_2`) และต้นทุน (`ic_trans_detail.sum_of_cost`, `average_cost`, `ic_inventory.average_cost`) เป็นค่า derived ที่คำนวณใหม่จาก `ic_trans_detail` ทุกครั้ง ไม่บวกลบทีละเอกสาร ทำทั้งตอนบันทึก/ลบเอกสาร (เฉพาะสินค้าที่แตะ) และตอนสั่ง `RebuildStock` (ทั้งฐาน หรือรายสินค้า)

## ทำงานอย่างไร

### ผู้เรียก
- บันทึก/ลบเอกสารซื้อขาย (trans.go:597), บิล POS (pos_bill.go:725), เครื่องมือสต็อก (stock_tools.go:565)
- `RebuildStock` (service.go:548) timeout 60 วินาที; ก่อนคำนวณตั้ง `stand_value` / `divide_value` = 1 ให้สินค้า unit_type 0/2 แล้วดึงอัตราจาก `ic_unit_use` (:623-626)

### การล็อก (service.go:990)
- รายสินค้า: shared lock "ic_inventory:rebuild" + exclusive lock ต่อรหัสสินค้า ("ic_stock:" + code) เรียงรหัสก่อนเพื่อกัน deadlock
- ทั้งฐาน: exclusive lock "ic_inventory:rebuild"

### แถวที่นับเข้าสต็อก (`stockRowsSQL` stock_rebuild.go:18)
- `last_status` = 0, ไม่ใช่สำเนา (`is_doc_copy` = 0), `item_type` 0/4/6
- flag: 12, 310, 14, 311, 16, 44, 46, 48, 54-73, 521-523
- ยกเว้น: 46 ที่ inquiry_type <> 0, 48 ที่ inquiry_type > 1, ขาย 44 ที่มี doc_ref และ `is_pos` = 1
- `stockValueOnlySQL` (:26): 14/16/311 ที่ inquiry_type 1/3 เปลี่ยนแค่มูลค่า ไม่นับ qty

### ขั้นตอน (service.go:1007)
1. sync `ic_trans_detail.item_type` จาก `ic_inventory`
2. backfill `sum_of_cost` ของ 58 ที่ไม่มีราคา = ROUND(qty x average_cost, 2) (:1049-1056)
3. `balance_qty` = SUM(qty x calc_flag x stand/divide) และ `balance_qty_2` = SUM(qty_2 x calc_flag) เฉพาะแถวที่นับ qty; ไม่รวมสินค้าบริการ item_type 5 (:1066)
4. ดึงความเคลื่อนไหวทุกสินค้าใน query เดียว เรียงตาม: รหัส, `doc_date_calc`/`doc_date`, `doc_time_calc`/`doc_time`, calc_flag มากก่อน (70 ถูกบังคับไว้ท้าย), trans_flag, doc_no, line_number, roworder (:1143-1170)
5. ส่งเข้า `CalculateMovingAverage` ทีละสินค้า ดู [[acc-inventory-cost-moving-average]]
6. bulk UPDATE ด้วย UNNEST เฉพาะแถวที่เปลี่ยน (:1244) แล้วตั้ง `ic_inventory.average_cost` = ต้นทุนเฉลี่ยตัวสุดท้าย (:1264)

### ทศนิยม (`stockScales` service.go:971)
- `item_price_decimal` (ต้นทุนเฉลี่ย) และ `item_amount_decimal` (มูลค่า) ช่วง 1-6 ค่าอื่นหรือ 0 ใช้ 2

### หน่วยนับขนาน
- unit_type 2 หรือ 3 = หน่วยขนาน; `unit_code_2` / `qty_2` เก็บเฉพาะหน่วยขนาน หรือเอกสารใน `compareUnitFlags` {30, 34, 36, 44, 144, 46, 48} ที่เปิดใช้หน่วยเปรียบเทียบ (trans_line_extra.go)

### ตรวจสถานะเอกสาร (`recheckDocFlowTx` service.go:715)
- เอกสารยกเลิก (`is_cancel` = 1) ถูกตั้ง `last_status` = 1 ทั้งหัว บรรทัด และ cb_trans จึงหลุดจากสต็อก

## จุดเสี่ยง
- **เปลี่ยน schema ตอน runtime**: `erpSchemaSQL` (service.go:796) มี `ALTER TABLE ic_inventory ADD COLUMN IF NOT EXISTS balance_qty_2` (:810) และถูกรันครั้งแรกที่เปิด pool ของแต่ละฐาน (:962) error ถูกเงียบ
- **ปุ่ม "Update ic_trans_detail" (`recalcDetailLine`) hardcode VAT 7%** (stock_rebuild.go:179-180) ดู [[acc-rounding-decimal]]
- backfill 58 ใช้ทศนิยม 2 ตายตัว ไม่ตาม `stockScales`
- บรรทัดที่ `last_status` <> 0 หรือ flag ไม่อยู่ในรายการ ไม่มีผลกับสต็อกเลย เช่น ใบสั่งซื้อ/ใบสั่งขาย ดู [[acc-trans-flag-map]]

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:548` RebuildStock
- `backend/internal/application/process/service.go:990` stockRebuildLock / lockStockItems
- `backend/internal/application/process/service.go:1007` rebuildStockTx
- `backend/internal/application/process/service.go:1066` balance_qty
- `backend/internal/application/process/service.go:1143` ลำดับความเคลื่อนไหว
- `backend/internal/application/process/service.go:1244` bulk update ต้นทุน
- `backend/internal/application/process/stock_rebuild.go:18` stockRowsSQL
- `backend/internal/application/process/stock_rebuild.go:26` stockValueOnlySQL
- `backend/internal/application/process/service.go:810` ALTER TABLE runtime

## ดูเพิ่ม
- [[acc-inventory-cost-moving-average]]
- [[acc-stock-special-docs]]
- [[acc-transaction-save-flow]]
- [[process-overview]]
