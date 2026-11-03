---
title: "ทะเบียน Serial Number สินค้า (ic_serial)"
tags: [tables, ic]
aliases: ["ic_serial", "ทะเบียน Serial", "หมายเลขเครื่อง", "serial status"]
sources: ["backend/internal/application/process/stock_tools.go:581", "backend/internal/application/process/stock_tools.go:270", "backend/internal/application/process/stock_tools.go:625", "backend/internal/application/process/report_menu_ic.go:1056", "backend/internal/application/process/report_menu_ic.go:1084", "backend/internal/application/process/workflow.go:143", "backend/internal/application/process/sysproc_ic_checks_data.go:68", "backend/internal/domain/query/write_policy_legacy.go:27", "frontend/src/config/schemas/icMasterSchemas.ts:1198", "frontend/account/transaction/SerialNumberModal.tsx:65", "scripts/sql/02_data_schema.sql:6389"]
---
# ทะเบียน Serial Number สินค้า (`ic_serial`)

**หน้าที่:** 1 แถวต่อ 1 หมายเลข Serial ของสินค้าที่ควบคุมด้วย Serial (ธง `ic_inventory.ic_serial_no = 1`, [[tbl-ic-inventory]] — `report_menu_ic.go:1057`) เก็บ "สถานะปัจจุบัน" ว่าอยู่ในสต๊อกหรือออกไปแล้ว อยู่คลัง/ที่เก็บไหน และข้อมูลผลิต/ประกัน ตารางนี้ **เป็นค่า derive** จาก [[tbl-ic-trans-serial-number]] (log การเคลื่อนไหว) — ระบบสร้างใหม่ให้เองทุกครั้งที่บันทึกเอกสาร จึงไม่ควรแก้ตรง (แม้มีหน้าจอทะเบียนให้แก้ได้ ดู "ใครเขียน")

## คอลัมน์ที่เห็นในโค้ด

| column | ความหมาย | ที่มา |
|---|---|---|
| `ic_code` | รหัสสินค้า ([[tbl-ic-inventory]].code) | `stock_tools.go:591` |
| `serial_number` | หมายเลข Serial; (`ic_code`, `serial_number`) ต้องไม่ซ้ำ — คอมเมนต์ในโค้ดระบุว่ามี unique index แต่ DDL ใน repo ไม่ได้สร้างไว้ (ไม่พบ `CREATE INDEX` บน `ic_serial` ใน `scripts/` และ `backend/`) โค้ดกันซ้ำเองด้วย `DISTINCT ON` + `NOT EXISTS` | `stock_tools.go:591` |
| `ic_unit` | หน่วยนับของสินค้า ([[tbl-ic-unit-use]].code) | `stock_tools.go:591,271` |
| `status` | 0 = ในสต๊อก, 1 = ออกจากสต๊อก (derive จากบรรทัดเคลื่อนไหวล่าสุด: `calc_flag = 1` รับ = 0, อย่างอื่น = 1) | `stock_tools.go:599-604`, `report_menu_ic.go:1068` |
| `wh_code`, `shelf_code` | คลัง/ที่เก็บของบรรทัดรับล่าสุด | `stock_tools.go:605-610` |
| `void_date`, `product_year`, `product_week` | วันที่หมดประกัน/ปีและสัปดาห์ที่ผลิต (ดึงจากบรรทัดรับแรกสุด; ไม่มีบรรทัดรับ = เคลียร์) | `stock_tools.go:612-621`, `report_menu_ic.go:1069` |
| `description` | รายละเอียด/ชื่อ (รายงาน Serial และหน้าจอทะเบียนอ่านคอลัมน์นี้) | `report_menu_ic.go:1084`, `icMasterSchemas.ts:1205` |
| `roworder` | ลำดับแถว ใช้เป็น tie-breaker | `stock_tools.go:277`, `:620` |

## วิธีที่ระบบสร้าง/ปรับ (`serialRebuildSQL`, `stock_tools.go:581-622`)

เรียกผ่าน `rebuildSerialTx` (`stock_tools.go:625-631`) ต่อสินค้าที่มี Serial หลังบันทึกเอกสาร (`trans.go:584`) ลบเอกสาร (`trans.go:439`) บันทึกยอดยกมา (`stock_beginning.go:477`) และบันทึกข้อมูลสินค้า (`stock_tools.go:562`) ดู [[acc-transaction-save-flow]] ลำดับ:

1. ตั้ง `last_status` ของ [[tbl-ic-trans-serial-number]] ให้ตามหัวเอกสาร [[tbl-ic-trans]]
2. ลบแถว `ic_serial` ที่ไม่มีบรรทัดเคลื่อนไหวที่ยังมีผลเหลือ (ไม่นับ flag 76 ตรวจนับ และ 14/16 ที่ `inquiry_type <> 0`)
3. เพิ่มแถวที่ยังไม่มี (เลือกบรรทัดแรกสุดต่อ Serial)
4. ซิงก์ `cust_code` ของบรรทัด Serial ให้ตรงหัว
5. ตั้ง `status` จากบรรทัดเคลื่อนไหวล่าสุด โดยนับเฉพาะ `serialMoveFlags`: flag 54, 60, 56, 58, 70, 72, 66, 68, 12, 310, 44; 14/16 ที่ `inquiry_type = 0`; 48 ที่ `inquiry_type` 0 หรือ 1; 46 ที่ `inquiry_type = 0`
6. ตั้ง `wh_code`/`shelf_code` จากบรรทัดรับล่าสุด; ตั้ง `void_date`/`product_year`/`product_week` จากบรรทัดรับแรกสุด

เรียกซ้ำกี่รอบผลเท่าเดิม (`stock_tools.go:624`)

## ใครอ่าน

- **สแกน/ตรวจนับ Serial:** `serialLookupSQL` ค้น Serial (ไม่สนตัวพิมพ์) แล้ว join สินค้าและอัตราแปลงหน่วยเพื่อเติมบรรทัดเอกสาร 76 (`stock_tools.go:270-277`, `SerialScan` `:280`) ดู [[acc-stock-special-docs]]; หน้าต่างเลือก Serial ในเอกสารอ่านเฉพาะ `status = 0` ของสินค้านั้น (`SerialNumberModal.tsx:62-70`)
- **รายงาน:** Item_by_serial, Serial_number และยอดคงเหลือแบบ Serial (เฉพาะ `status = 0` ที่ยอดสินค้าไม่เป็นศูนย์) (`report_menu_ic.go:1056-1131`)
- **ตรวจข้อมูลระบบ:** เครื่องมือเช็คบรรทัดที่ `is_serial_number <> 1` ทั้งที่สินค้ามี `ic_serial_no = 1` (`sysproc_ic_checks_data.go:68`)

## ใครเขียน

- `rebuildSerialTx` ตามด้านบน (เส้นทางหลักของข้อมูลเอกสาร)
- หน้าจอ "ทะเบียน Serial Number" (`menu_ic_item_serial`, ตาราง `ic_serial`) แก้ไขตรงได้ผ่าน `/query/exec` เพราะ `ic_serial` อยู่ใน legacy write allow-list (`write_policy_legacy.go:27`, `icMasterSchemas.ts:1198-1220`)
- เปลี่ยนรหัสสินค้าแก้ `ic_code` ของตารางนี้ (`workflow.go:143`)

## ข้อควรระวัง

- Serial เดียวกันแต่เอกสารขัดแย้งกัน (เช่น หน่วยต่างกัน) → เก็บบรรทัดแรกสุดเท่านั้น (`stock_tools.go:591-596`)
- DDL อยู่ที่ `scripts/sql/02_data_schema.sql:6389-6409` (19 คอลัมน์ รวมคอลัมน์ระบบ `ignore_sync`, `is_lock_record`, `roworder`, `create_date_time_now`) คอลัมน์ที่ Go และหน้าจอทะเบียนใช้มีใน DDL ครบ ส่วน `guid_code`, `car_inventory`, `car_stockno`, `car_engineno`, `car_chassisno` อยู่ใน DDL แต่ไม่พบโค้ด Go หรือหน้าจออ่านหรือเขียน
- ตารางนี้ **ไม่ใช่ยอดคงเหลือ**: ยอดสินค้ามาจาก [[tbl-ic-trans-detail]] ส่วน `ic_serial` ใช้ระบุตัวตนรายเลข ดู [[acc-inventory-stock-rebuild]]
- รายงาน Serial แสดงสถานะ 0 = "ในสต๊อค" / อื่น = "ออกจากสต๊อค" (`report_menu_ic.go:1085`) ส่วนรายงาน Item_by_serial แสดง IN / OUT (`report_menu_ic.go:1068`)

## ที่มาในโค้ด

- `scripts/sql/02_data_schema.sql:6389-6409` DDL ของ `ic_serial`
- `backend/internal/application/process/stock_tools.go:270-280`, `:562`, `:581-631`
- `backend/internal/application/process/report_menu_ic.go:1056-1131`
- `backend/internal/application/process/sysproc_ic_checks_data.go:68`
- `backend/internal/application/process/workflow.go:143`
- `backend/internal/domain/query/write_policy_legacy.go:27`
- `frontend/src/config/schemas/icMasterSchemas.ts:1198-1220`
- `frontend/account/transaction/SerialNumberModal.tsx:62-70`
