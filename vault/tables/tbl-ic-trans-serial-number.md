---
title: "เลขเครื่อง/Serial ตามรายการเอกสาร (ic_trans_serial_number)"
tags: [tables, ic]
aliases: ["ic_trans_serial_number", "Serial ในเอกสาร", "serial movement", "หมายเลขเครื่องรายบรรทัด"]
sources: ["backend/internal/application/process/trans.go:725", "backend/internal/application/process/trans.go:983", "backend/internal/application/process/trans.go:1135", "backend/internal/application/process/trans.go:1160", "backend/internal/application/process/stock_tools.go:454", "backend/internal/application/process/stock_tools.go:581", "backend/internal/application/process/stock_beginning.go:544", "backend/internal/application/process/doc_flow.go:261", "backend/internal/application/process/service.go:956", "backend/internal/application/process/report_menu_ic.go:1075", "backend/internal/application/process/report_menu_ic.go:1103", "backend/internal/application/process/report_menu_ic.go:1152", "scripts/sql/02_data_schema.sql:7115"]
---
# เลขเครื่อง/Serial ตามรายการเอกสาร (`ic_trans_serial_number`)

**หน้าที่:** เก็บ "การเคลื่อนไหวของ Serial Number ทีละเลข ทีละเอกสาร" — 1 แถวต่อ 1 Serial ต่อ 1 บรรทัดสินค้าใน [[tbl-ic-trans-detail]] ใช้เป็นข้อมูลดิบให้ระบบสร้างสถานะปัจจุบันของแต่ละ Serial ใน [[tbl-ic-serial]] (ตารางนี้คือ log, [[tbl-ic-serial]] คือสถานะ) บรรทัดที่ส่ง Serial มา (`TransLine.Serials`, `trans.go:89`) จะถูกตั้ง `is_serial_number = 1` (`trans.go:997-1000`) ส่วนธงของสินค้าคือ `ic_inventory.ic_serial_no` ([[tbl-ic-inventory]]) ซึ่งรายงาน Serial ใช้กรองสินค้า (`report_menu_ic.go:1057`)

## คอลัมน์ (จาก `insertTransSerialSQL`, `trans.go:725-733`)

DDL อยู่ที่ `scripts/sql/02_data_schema.sql:7115-7146` (30 คอลัมน์ รวมคอลัมน์ระบบ `ignore_sync`, `is_lock_record`, `roworder`, `create_date_time_now`) คอลัมน์ที่ Go เขียนหรืออ่านมีใน DDL ครบ (`serial_number` เป็น `varchar(50)` ตรงกับกฎยาวไม่เกิน 50 ตัวอักษรที่ `trans.go:983`) ส่วน `car_inventory`, `car_stockno`, `car_engineno`, `car_chassisno` อยู่ใน DDL แต่ไม่พบโค้ด Go อ่านหรือเขียน

| column | ความหมาย | หมายเหตุ |
|---|---|---|
| `doc_no`, `trans_flag` | เอกสารเจ้าของ (เชื่อม [[tbl-ic-trans]]) | key ร่วม |
| `doc_date`, `doc_time` | วัน-เวลาเอกสาร ใช้เรียงลำดับเหตุการณ์ | ดัชนี `service.go:956-957` |
| `line_number` | ลำดับ Serial ในเอกสาร (1..N) | `trans.go:1160-1165` |
| `doc_line_number` | `line_number` ของบรรทัดสินค้าใน [[tbl-ic-trans-detail]] ที่ Serial นี้สังกัด | `trans.go:1160-1165` |
| `ic_code` | รหัสสินค้า | ใช้คู่กับ `serial_number` |
| `unit_code` | หน่วยนับ | |
| `wh_code`, `shelf_code` | คลัง/ที่เก็บของการเคลื่อนไหว | |
| `wh_code_2`, `shelf_code_2` | คลัง/ที่เก็บปลายทาง (โอน) | |
| `calc_flag` | +1 รับเข้า / -1 จ่ายออก (เหมือนบรรทัดสินค้า) | `transcalc.go:14-27` |
| `serial_number` | หมายเลข Serial | |
| `description` | ชื่อสินค้า (ที่บรรทัด) | `trans.go:1164` |
| `price` | ราคาของบรรทัด (decimal) | |
| `inquiry_type` | ประเภทย่อยเอกสาร (คัดลอกจากหัว) | |
| `cust_code` | คู่ค้า (คัดลอกจาก [[tbl-ic-trans]]; rebuild ซิงก์ให้ตรงหัวอีกรอบ) | `stock_tools.go:597` |
| `last_status` | 0 ปกติ / 1 เอกสารถูกยกเลิก — ตามหัวเอกสารเสมอ | `doc_flow.go:261`, `stock_tools.go:582-585` |
| `void_date`, `product_year`, `product_week` | วันที่หมดประกัน/ปีและสัปดาห์ผลิตของ Serial (INSERT ของ SaveTrans ไม่ได้ใส่คอลัมน์นี้ — `trans.go:725-733`; ถูกอ่านตอน rebuild) | `stock_tools.go:591-596`, `:612-620` |
| `create_date_time_now` | เวลาสร้าง (เห็นเฉพาะตอน INSERT ยอดยกมา) | `stock_beginning.go:544-548` |

## ใครเขียน/ลบ

- **บันทึกเอกสาร** (`saveTransTx`): ลบ Serial ของเอกสารเดิมทั้งหมด (`trans.go:532`) แล้ว `buildTransArgs` INSERT ใหม่ตาม `TransLine.Serials` (`trans.go:1160-1165`); **ลบเอกสาร** (`deleteTransTx`) ลบแถวเหล่านี้ด้วย (`trans.go:421`)
- **โอนคลัง 72:** เขียน 2 แถวต่อ Serial — แถวออก (flag 72, `calc_flag -1`, `line_number` 1..N) และแถวเข้า (flag 70, `calc_flag +1`, `line_number = -1`) (`trans.go:1135-1149`) ดู [[tbl-ic-trans-detail]]
- **ตรวจนับ Serial (flag 76):** `SerialCountSave` ลบแล้วเขียนแถว flag 76 `calc_flag = 1` (`stock_tools.go:454-470`) โดย `line_number` เริ่มที่ 0 และ `doc_line_number` = ลำดับบรรทัดในใบ นับจาก 1 (`stock_tools.go:458-462`) ดู [[acc-stock-special-docs]]
- **ยอดยกมา:** `sbInsertSerial` (`stock_beginning.go:544-548`) INSERT แถว `calc_flag = 1`
- **ยกเลิก/คืนสถานะ:** `deriveLastStatus` (เรียกผ่าน `docFlowTx`) ตั้ง `last_status` ตามหัวเอกสาร (`doc_flow.go:261`)

## ใครอ่าน

- `rebuildSerialTx` รัน `serialRebuildSQL` สร้าง [[tbl-ic-serial]] ใหม่จากตารางนี้ (`stock_tools.go:581-631`)
- `SerialAnalyze` (อ่านอย่างเดียว) เล่นประวัติ Serial ของเอกสารที่ `last_status = 0` ข้าม flag 144 และ 76 (`stock_tools.go:225-230`)
- รายงานเคลื่อนไหว Serial: วันที่รับ/ต้นทุนล่าสุดหยิบจากแถว flag `12,54,58,60,310,48` (`icSerialInFlags` `report_menu_ic.go:1075`, ใช้ที่ `:1082`); รายละเอียดแสดงทุกเอกสารยกเว้น flag 76 (`report_menu_ic.go:1103`)
- รายงานตรวจสอบ Serial: รายละเอียดอ่านแถว flag 76 ที่ `last_status = 0` ของใบตรวจนับในช่วงวันที่ (`report_menu_ic.go:1152`)
- ตัวสแกน Serial อ่านที่ [[tbl-ic-serial]] ไม่ใช่ตารางนี้ (`serialLookupSQL` `stock_tools.go:270-277`)

## ข้อควรระวัง

- แถว `trans_flag = 76` (ตรวจนับ) และ 14/16 ที่ `inquiry_type <> 0` (แก้ราคาอย่างเดียว) **ไม่นับ** ว่าเป็นการเคลื่อนไหวที่ทำให้ Serial มีตัวตน (`stock_tools.go:586-588,593-594`)
- Serial ยาวเกิน 50 ตัวอักษร หรือซ้ำกันในเอกสารเดียวกัน (รหัสสินค้า + Serial ไม่สนตัวพิมพ์) ถูกปฏิเสธก่อนบันทึก (`trans.go:983-993`)
- ลำดับ "สถานะล่าสุด" ตัดสินจาก `doc_date DESC, doc_time DESC, roworder DESC` — เวลาเท่ากันแถวที่เพิ่มทีหลังชนะ
- เก็บ Serial เป็นตัวพิมพ์ใหญ่เมื่อค้น (`upper(serial_number)`) ใน `serialLookupSQL`

## ที่มาในโค้ด

- `scripts/sql/02_data_schema.sql:7115-7146` DDL ของ `ic_trans_serial_number`
- `backend/internal/application/process/trans.go:89`, `:421`, `:532`, `:725-733`, `:983-1000`, `:1135-1149`, `:1160-1165`
- `backend/internal/application/process/stock_tools.go:176`, `:225-230`, `:270-277`, `:454-470`, `:581-631`
- `backend/internal/application/process/stock_beginning.go:544-548`
- `backend/internal/application/process/doc_flow.go:261`
- `backend/internal/application/process/service.go:956-957`
- `backend/internal/application/process/report_menu_ic.go:1057`, `:1075`, `:1082`, `:1103`, `:1152`
- `backend/internal/application/process/workflow.go:119`, `:146` (เปลี่ยนรหัสสินค้า/ลูกหนี้ แก้ `ic_code`/`cust_code` ตาราง)
