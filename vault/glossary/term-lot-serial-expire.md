---
title: "เลข LOT, Serial Number และวันหมดอายุ (lot_number_1 / serial_number / date_expire)"
tags: [glossary, ic, lot, serial, expire]
aliases: ["LOT", "ล็อต", "เลข LOT", "lot_number_1", "lotNumber1", "ic_trans_detail_lot", "ยอดคงเหลือตาม LOT", "Serial", "Serial Number", "เลขซีเรียล", "หมายเลข Serial", "ic_serial", "ic_serial_no", "สินค้ามี Serial", "ic_trans_serial_number", "isSerialNumber", "วันหมดอายุ", "date_expire", "dateExpire", "use_expire", "ใช้ระบบหมดอายุ", "วันที่ผลิต", "mfd_date", "ผู้ผลิต", "mfn_name", "วันที่หมดประกัน", "void_date", "FEFO", "find_lot_auto"]
sources: ["backend/internal/application/process/trans.go:64", "backend/internal/application/process/trans.go:66", "backend/internal/application/process/trans.go:88", "backend/internal/application/process/trans.go:90", "backend/internal/application/process/trans.go:725", "backend/internal/application/process/trans_lot_auto.go:14", "backend/internal/application/process/report_menu_ic.go:1172", "frontend/account/transaction/transLayouts.ts:313", "frontend/account/transaction/TransItemGrid.tsx:84", "frontend/account/transaction/TransItemGrid.tsx:332", "frontend/account/transaction/TransItemGrid.tsx:401", "frontend/account/transaction/TransItemGrid.tsx:420", "frontend/src/config/schemas/icInventory.ts:39", "frontend/src/config/schemas/icInventory.ts:193", "frontend/src/config/schemas/icMasterSchemas.ts:1199", "frontend/src/config/bcMenu.json:2005", "frontend/src/config/bcMenu.json:2660"]
---

# เลข LOT / Serial / วันหมดอายุ

## ในระบบนี้คืออะไร
มีสามกลไกที่ติดตามสินค้ารายชิ้นหรือรายชุดการผลิต ทั้งหมดผูกกับบรรทัด `ic_trans_detail`

### เลข LOT
- คอลัมน์ `ic_trans_detail.lot_number_1` ในกริดใช้ป้าย "เลข LOT" (`trans.go:64`, `TransItemGrid.tsx:332`)
- คอลัมน์ "เลข LOT" แสดงเฉพาะเอกสาร flag 54, 56, 58, 60, 66, 68, 70, 72, 76, 128, 276 (`transLayouts.ts:313`)
- ยอดคงเหลือตาม LOT อ่านจาก `ic_trans_detail_lot` (`report_menu_ic.go:1172`, เมนู bcMenu.json:2660)
- ขายใหม่ (44) ถ้าสินค้าเป็น cost_type 2 แต่ยังไม่ระบุ lot ระบบจะเลือก lot ที่มียอดพอในคลัง/ที่เก็บนั้นให้ ถ้าไม่พอจะแตกบรรทัดใหม่ ถ้าหาไม่ได้เลยจะบันทึกไม่ได้ (`trans_lot_auto.go:14-18`)

### Serial Number
- ตั้งค่าที่สินค้า: "สินค้ามี Serial" `ic_inventory.ic_serial_no` (`icInventory.ts:39`)
- ทะเบียน serial: `ic_serial` จอ "ทะเบียน Serial Number" (`menu_ic_item_serial`, `icMasterSchemas.ts:1199`, bcMenu.json:2005) ช่องหลักคือ "หมายเลข Serial:" (`serial_number`) และ "รายละเอียด Serial:" (`description`) มีช่องเพิ่มเติม รหัสสินค้า, หน่วยนับ, รหัสคลัง, รหัสที่เก็บ, สถานะ และวันที่หมดประกัน (`void_date`)
- serial ในเอกสาร: `TransLine.isSerialNumber` และ `serials[]` (`trans.go:88-89`) บันทึกลง `ic_trans_serial_number` มีคอลัมน์ `doc_no`, `line_number`, `doc_line_number`, `trans_flag`, `ic_code`, `wh_code`, `shelf_code`, `calc_flag`, `serial_number`, `price`, `cust_code`, `last_status` (`trans.go:725-733`)

### วันหมดอายุ / วันที่ผลิต
- ตั้งค่าที่สินค้า: "ใช้ระบบหมดอายุ" `ic_inventory.use_expire` (`icInventory.ts:193`) ค่า 1 = ต้องระบุวันหมดอายุ (`TransItemGrid.tsx:84`)
- ในเอกสาร: "วันหมดอายุ" `date_expire` (YYYY-MM-DD ถ้าว่างเก็บเป็น NULL) (`trans.go:66`, คอลัมน์กริด `TransItemGrid.tsx:401`)
- ถ้าสินค้าใช้วันหมดอายุแต่ยังไม่กรอก ทั้งแถวจะแสดงตัวอักษรสีม่วง (BlueViolet) (`TransItemGrid.tsx:420-421`)
- "วันที่ผลิต" `mfd_date` และ "ผู้ผลิต" `mfn_name` (`trans.go:90-91`, กริด `:403`)

## ข้อควรระวัง
- คอลัมน์ในบรรทัดชื่อ `lot_number_1` มีเลข 1 ต่อท้าย ส่วนตาราง lot ใช้ชื่อ `lot_number`
- "ผู้ผลิต" ในบรรทัดเอกสาร (`mfn_name` เป็นข้อความ) ไม่ใช่ "ผู้ผลิต" ใน master สินค้า (`ic_inventory.manufacturer_code`, `icInventory.ts:177`)

## ลิงก์
[[term-cost-type]] · [[term-stock-balance]] · [[tbl-ic-trans-detail]] · [[std-inventory-costing-rules]] · [[glossary-overview]]

## ที่มาในโค้ด
- `backend/internal/application/process/trans.go:64`, `:66`, `:88-91`, `:725-733`
- `backend/internal/application/process/trans_lot_auto.go:14-18`
- `backend/internal/application/process/report_menu_ic.go:1172`
- `frontend/account/transaction/transLayouts.ts:313`
- `frontend/account/transaction/TransItemGrid.tsx:84`, `:332`, `:401`, `:403`, `:420-421`
- `frontend/src/config/schemas/icInventory.ts:39`, `:177`, `:193`
- `frontend/src/config/schemas/icMasterSchemas.ts:1199-1218`
- `frontend/src/config/bcMenu.json:2005`, `:2660`
