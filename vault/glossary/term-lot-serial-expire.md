---
title: "เลข LOT, Serial Number และวันหมดอายุ (lot_number_1 / serial_number / date_expire)"
tags: [glossary, ic, lot, serial, expire]
aliases: ["LOT", "ล็อต", "เลข LOT", "lot_number_1", "lotNumber1", "ic_trans_detail_lot", "ยอดคงเหลือตาม LOT", "Serial", "Serial Number", "เลขซีเรียล", "หมายเลข Serial", "ic_serial", "ic_serial_no", "สินค้ามี Serial", "ic_trans_serial_number", "isSerialNumber", "วันหมดอายุ", "date_expire", "dateExpire", "use_expire", "ใช้ระบบหมดอายุ", "วันที่ผลิต", "mfd_date", "ผู้ผลิต", "mfn_name", "วันที่หมดประกัน", "void_date", "FEFO", "find_lot_auto"]
sources: ["backend/internal/application/process/trans.go:64", "backend/internal/application/process/trans.go:66", "backend/internal/application/process/trans.go:88", "backend/internal/application/process/trans.go:90", "backend/internal/application/process/trans.go:725", "backend/internal/application/process/trans_lot_auto.go:32", "backend/internal/application/process/trans_lot_auto.go:50", "backend/internal/application/process/trans_save_rules.go:54", "backend/internal/application/process/report_menu_ic.go:1206", "backend/internal/application/process/stock_lot.go:224", "backend/internal/application/process/stock_beginning.go:550", "frontend/account/transaction/transLayouts.ts:171", "frontend/account/transaction/transLayouts.ts:313", "frontend/account/transaction/TransItemGrid.tsx:84", "frontend/account/transaction/TransItemGrid.tsx:332", "frontend/account/transaction/TransItemGrid.tsx:401", "frontend/account/transaction/TransItemGrid.tsx:421", "frontend/account/transaction/useExpireColumn.ts:22", "frontend/src/config/schemas/icInventory.ts:39", "frontend/src/config/schemas/icInventory.ts:193", "frontend/src/config/schemas/icMasterSchemas.ts:1199", "frontend/src/config/bcMenu.json:2005", "frontend/src/config/bcMenu.json:2660"]
---

# เลข LOT / Serial / วันหมดอายุ

## ในระบบนี้คืออะไร
มีสามกลไกที่ติดตามสินค้ารายชิ้นหรือรายชุดการผลิต ทั้งหมดผูกกับบรรทัด `ic_trans_detail`

### เลข LOT
- คอลัมน์ `ic_trans_detail.lot_number_1` ในกริดใช้ป้าย "เลข LOT" (`trans.go:64`, `TransItemGrid.tsx:332`)
- คอลัมน์ "เลข LOT" แสดงเฉพาะเอกสาร flag 54, 56, 58, 60, 66, 68, 70, 72, 76, 128, 276 (`transLayouts.ts:313`, `TransItemGrid.tsx:330-334`)
- เมนู "ยอดคงเหลือสินค้าตาม LOT" (`menu_ic_info_stk_balance_lot`, bcMenu.json:2660) อ่านจากตาราง `ic_trans_detail_lot` (`icLotBalanceSpec`, `report_menu_ic.go:1206-1238`) ตารางนี้ Go backend เขียนเฉพาะเอกสารปรับปรุงสต็อกแบบ LOT (flag 66/68, `stock_lot.go:224-233`) และหน้ายกยอดสต็อก (`stock_beginning.go:550-553`, `:609`) การบันทึกเอกสารทั่วไปไม่เขียนตารางนี้ (`trans_lot_auto.go:105-111`) ค่าที่มีอยู่แล้วในฐานข้อมูลถูกอ่านต่อ
- ขายใหม่ (44) เมื่อเปิด `erp_option.find_lot_auto` (`trans_lot_auto.go:50`) ถ้าสินค้าเป็น cost_type 2 แต่ยังไม่ระบุ lot ระบบจะเลือก lot แรก (เรียงตามเลข lot) ที่มียอดพอในคลัง/ที่เก็บนั้นให้ ถ้าไม่มี lot ไหนพอจะเอายอดของ lot แรกที่มีสต็อกทั้งหมดแล้วแตกส่วนที่เหลือเป็นบรรทัดใหม่ท้ายตาราง (`trans_lot_auto.go:32`, `splitLots` `:131`) ยอดคงเหลือต่อ lot คำนวณจาก `ic_trans_detail.lot_number_1` (`readLotBalances`, `:105`)
- เอกสารใน `lotFlags` (54, 60, 58, 68, 12, 310, 14, 316, 48, 56, 72, 66, 36, 44, 46, 16, 311) ที่มีสินค้า cost_type 2 แต่ไม่มีเลข LOT จะบันทึกไม่ได้ ตอบ "รหัสสินค้า ... ยังไม่บันทึกหมายเลข LOT แบบกำหนดเอง" (`trans_save_rules.go:54`, `:148`, `:180-188`)

### Serial Number
- ตั้งค่าที่สินค้า: "สินค้ามี Serial" `ic_inventory.ic_serial_no` (`icInventory.ts:39`)
- ทะเบียน serial: `ic_serial` จอ "ทะเบียน Serial Number" (`menu_ic_item_serial`, `icMasterSchemas.ts:1199`, bcMenu.json:2005) ช่องหลักคือ "หมายเลข Serial:" (`serial_number`) และ "รายละเอียด Serial:" (`description`) มีช่องเพิ่มเติม รหัสสินค้า, หน่วยนับ, รหัสคลัง, รหัสที่เก็บ, สถานะ, วันที่หมดประกัน (`void_date`), ปีที่ผลิต และสัปดาห์ที่ผลิต
- serial ในเอกสาร: `TransLine.isSerialNumber` และ `serials[]` (`trans.go:88-89`) บันทึกลง `ic_trans_serial_number` มีคอลัมน์ `doc_no`, `doc_date`, `doc_time`, `line_number`, `doc_line_number`, `trans_flag`, `ic_code`, `unit_code`, `wh_code`, `shelf_code`, `wh_code_2`, `shelf_code_2`, `calc_flag`, `description`, `serial_number`, `price`, `inquiry_type`, `cust_code`, `last_status` (`trans.go:725-734`) serial ที่ส่งมายาวเกิน 50 ตัวอักษร หรือซ้ำกันในเอกสารเดียวกัน (ต่อสินค้า) จะถูกปฏิเสธ (`trans.go:979-993`)

### วันหมดอายุ / วันที่ผลิต
- ตั้งค่าที่สินค้า: "ใช้ระบบหมดอายุ" `ic_inventory.use_expire` (`icInventory.ts:193`) ค่า 1 = ต้องระบุวันหมดอายุ (`TransItemGrid.tsx:84`)
- ในเอกสาร: "วันหมดอายุ" `date_expire` (YYYY-MM-DD ถ้าว่างเก็บเป็น NULL) (`trans.go:66`, คอลัมน์กริด `TransItemGrid.tsx:401`) คอลัมน์นี้แสดงเมื่อเปิด `erp_option.use_expire` (`useExpireColumn.ts:22`) และเป็นเอกสาร flag 12, 14, 310, 315, 316, 48, 54, 76, 66, 68, 60, 56, 58, 72, 501, 502, 503, 509 (`transLayouts.ts:171`, `TransItemGrid.tsx:192-194`)
- ถ้าสินค้าใช้วันหมดอายุแต่ยังไม่กรอก ทั้งแถวจะแสดงตัวอักษรสีม่วง `#8a2be2` (`TransItemGrid.tsx:421`) เฉพาะเมื่อเปิด `use_expire` และเป็น flag ที่มีคอลัมน์นี้ ซึ่งรวม flag 44/144 ที่ซ่อนคอลัมน์ไว้แต่ยังระบายสีแถว (`transLayouts.ts:173`)
- "วันที่ผลิต" `mfd_date` และ "ผู้ผลิต" `mfn_name` เป็นฟิลด์ของบรรทัดเอกสาร (`trans.go:90-91`) กริดเอกสารไม่มีคอลัมน์วันที่ผลิต ส่วนคอลัมน์ "ผู้ผลิต" (`TransItemGrid.tsx:403`) แสดงเฉพาะ flag 6 เมื่อเปิด `erp_option.use_quality_control_system` (`transLayouts.ts:370`, `TransItemGrid.tsx:234`)
- หน้ายกยอดสต็อกกรอก lot พร้อมวันที่ผลิต/วันหมดอายุ/ผู้ผลิตผ่าน `LotModal.tsx:99-106` แล้ว backend เขียนลง `ic_trans_detail_lot` (`stock_beginning.go:550-553`)

## ข้อควรระวัง
- คอลัมน์ในบรรทัดชื่อ `lot_number_1` มีเลข 1 ต่อท้าย ส่วนตาราง lot ใช้ชื่อ `lot_number`
- "ผู้ผลิต" ในบรรทัดเอกสาร (`mfn_name` เป็นข้อความ) ไม่ใช่ "ผู้ผลิต" ใน master สินค้า (`ic_inventory.manufacturer_code`, `icInventory.ts:177`)

## ลิงก์
[[term-cost-type]] · [[term-stock-balance]] · [[tbl-ic-trans-detail]] · [[std-inventory-costing-rules]] · [[glossary-overview]]

## ที่มาในโค้ด
- `backend/internal/application/process/trans.go:64`, `:66`, `:88-91`, `:725-734`, `:979-993`
- `backend/internal/application/process/trans_lot_auto.go:32`, `:50`, `:105`, `:131`
- `backend/internal/application/process/trans_save_rules.go:54`, `:148`, `:180-188`
- `backend/internal/application/process/report_menu_ic.go:1206-1238`
- `backend/internal/application/process/stock_lot.go:224-233`; `stock_beginning.go:550-553`, `:609`
- `frontend/account/transaction/transLayouts.ts:171`, `:173`, `:313`, `:370`
- `frontend/account/transaction/TransItemGrid.tsx:84`, `:192-194`, `:234`, `:330-334`, `:401`, `:403`, `:421`; `useExpireColumn.ts:22`; `LotModal.tsx:99-106`
- `frontend/src/config/schemas/icInventory.ts:39`, `:177`, `:193`
- `frontend/src/config/schemas/icMasterSchemas.ts:1198-1219`
- `frontend/src/config/bcMenu.json:2005`, `:2660`
