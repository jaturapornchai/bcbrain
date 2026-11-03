---
title: "เลขเครื่อง/Serial ตามรายการเอกสาร (ic_trans_serial_number)"
tags: [tables, ic]
aliases: ["ic_trans_serial_number", "Serial ในเอกสาร", "serial movement", "หมายเลขเครื่องรายบรรทัด"]
sources: ["backend/internal/application/process/trans.go:725", "backend/internal/application/process/trans.go:1160", "backend/internal/application/process/stock_tools.go:454", "backend/internal/application/process/stock_tools.go:568", "backend/internal/application/process/stock_beginning.go:545", "backend/internal/application/process/doc_flow.go:261", "backend/internal/application/process/service.go:945", "backend/internal/application/process/report_menu_ic.go:1044"]
---
# เลขเครื่อง/Serial ตามรายการเอกสาร (`ic_trans_serial_number`)

**หน้าที่:** เก็บ "การเคลื่อนไหวของ Serial Number ทีละเลข ทีละเอกสาร" — 1 แถวต่อ 1 Serial ต่อ 1 บรรทัดสินค้าใน [[tbl-ic-trans-detail]] ใช้เป็นข้อมูลดิบให้ระบบสร้างสถานะปัจจุบันของแต่ละ Serial ใน [[tbl-ic-serial]] (ตารางนี้คือ log, [[tbl-ic-serial]] คือสถานะ) เฉพาะสินค้าที่ตั้ง `ic_inventory.ic_serial_no = 1` ([[tbl-ic-inventory]])

## คอลัมน์ (จาก `insertTransSerialSQL`, `trans.go:725-733`)

| column | ความหมาย | หมายเหตุ |
|---|---|---|
| `doc_no`, `trans_flag` | เอกสารเจ้าของ (เชื่อม [[tbl-ic-trans]]) | key ร่วม |
| `doc_date`, `doc_time` | วัน-เวลาเอกสาร ใช้เรียงลำดับเหตุการณ์ | ดัชนี `service.go:945-946` |
| `line_number` | ลำดับ Serial ในเอกสาร (1..N) | `trans.go:1160-1165` |
| `doc_line_number` | `line_number` ของบรรทัดสินค้าใน [[tbl-ic-trans-detail]] ที่ Serial นี้สังกัด | `trans.go:1160-1165` |
| `ic_code` | รหัสสินค้า | ใช้คู่กับ `serial_number` |
| `unit_code` | หน่วยนับ | |
| `wh_code`, `shelf_code` | คลัง/ที่เก็บของการเคลื่อนไหว | |
| `wh_code_2`, `shelf_code_2` | คลัง/ที่เก็บปลายทาง (โอน) | |
| `calc_flag` | +1 รับเข้า / -1 จ่ายออก (เหมือนบรรทัดสินค้า) | `transcalc.go:12-27` |
| `serial_number` | หมายเลข Serial | |
| `description` | ชื่อสินค้า (ที่บรรทัด) | `trans.go:1164` |
| `price` | ราคาของบรรทัด (decimal) | |
| `inquiry_type` | ประเภทย่อยเอกสาร (คัดลอกจากหัว) | |
| `cust_code` | คู่ค้า (คัดลอกจาก [[tbl-ic-trans]]; rebuild ซิงก์ให้ตรงหัวอีกรอบ) | `stock_tools.go:597` |
| `last_status` | 0 ปกติ / 1 เอกสารถูกยกเลิก — ตามหัวเอกสารเสมอ | `doc_flow.go:261`, `stock_tools.go:582-585` |
| `void_date`, `product_year`, `product_week` | วันหมดประกัน/ปีและสัปดาห์ผลิตของ Serial (ไม่เห็นว่า SaveTrans กรอกเอง; ถูกอ่านตอน rebuild) | `stock_tools.go:591-617` |
| `create_date_time_now` | เวลาสร้าง (เห็นเฉพาะตอน INSERT ยอดยกมา) | `stock_beginning.go:545-547` |

## ใครเขียน/ลบ

- **บันทึกเอกสาร** (`saveTransTx`): ลบ Serial ของเอกสารเดิมทั้งหมด (`trans.go:421,532`) แล้ว INSERT ใหม่ตาม `TransLine.Serials` (`trans.go:1160-1165`)
- **โอนคลัง 72:** เขียน 2 แถวต่อ Serial — แถวออก (flag 72, `calc_flag -1`, `line_number` 1..N) และแถวเข้า (flag 70, `calc_flag +1`, `line_number = -1`) ตามพฤติกรรม C# `_icTransControl.cs:15862-15928` (`trans.go:1135-1149`) ดู [[tbl-ic-trans-detail]]
- **ตรวจนับ Serial (flag 76):** `SerialCountSave` ลบแล้วเขียนแถว flag 76 `calc_flag = 1` (`stock_tools.go:454-466`) ดู [[acc-stock-special-docs]]
- **ยอดยกมา:** `stock_beginning.go:545-548` INSERT แถว `calc_flag = 1`
- **ยกเลิก/คืนสถานะ:** `docFlowTx` ตั้ง `last_status` ตามหัวเอกสาร (`doc_flow.go:261`)

## ใครอ่าน

- `rebuildSerialTx` สร้าง [[tbl-ic-serial]] ใหม่จากตารางนี้ (`stock_tools.go:568-622`)
- รายงาน: Serial เข้า (flag "12,54,58,60,310,48") และตรวจนับ (`report_menu_ic.go:1044,1051,1072,1121`)
- ตัวสแกน Serial อ่านที่ [[tbl-ic-serial]] ไม่ใช่ตารางนี้ (`stock_tools.go:269-275`)

## ข้อควรระวัง

- แถว `trans_flag = 76` (ตรวจนับ) และ 14/16 ที่ `inquiry_type <> 0` (แก้ราคาอย่างเดียว) **ไม่นับ** ว่าเป็นการเคลื่อนไหวที่ทำให้ Serial มีตัวตน (`stock_tools.go:586-588,593-594`)
- ลำดับ "สถานะล่าสุด" ตัดสินจาก `doc_date DESC, doc_time DESC, roworder DESC` — เวลาเท่ากันแถวที่เพิ่มทีหลังชนะ
- เก็บ Serial เป็นตัวพิมพ์ใหญ่เมื่อค้น (`upper(serial_number)`) ใน `serialLookupSQL`

## ที่มาในโค้ด

- `backend/internal/application/process/trans.go:421`, `:532`, `:725-733`, `:1135-1149`, `:1160-1165`
- `backend/internal/application/process/stock_tools.go:176`, `:269-275`, `:454-466`, `:568-622`
- `backend/internal/application/process/stock_beginning.go:545-548`
- `backend/internal/application/process/doc_flow.go:261`
- `backend/internal/application/process/service.go:945-946`
- `backend/internal/application/process/report_menu_ic.go:1044`, `:1051`, `:1072`, `:1121`
- `backend/internal/application/process/workflow.go:119`, `:146` (เปลี่ยนรหัสสินค้า/ลูกหนี้ แก้ `ic_code`/`cust_code` ตาราง)
