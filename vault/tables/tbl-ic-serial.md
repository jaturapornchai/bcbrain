---
title: "ทะเบียน Serial Number สินค้า (ic_serial)"
tags: [tables, ic]
aliases: ["ic_serial", "ทะเบียน Serial", "หมายเลขเครื่อง", "serial status"]
sources: ["backend/internal/application/process/stock_tools.go:568", "backend/internal/application/process/stock_tools.go:269", "backend/internal/application/process/stock_tools.go:624", "backend/internal/application/process/report_menu_ic.go:1024", "backend/internal/application/process/report_menu_ic.go:1079", "backend/internal/application/process/workflow.go:143", "backend/internal/application/process/sysproc_ic_checks_data.go:68"]
---
# ทะเบียน Serial Number สินค้า (`ic_serial`)

**หน้าที่:** 1 แถวต่อ 1 หมายเลข Serial ของสินค้าที่ควบคุมด้วย Serial (`ic_inventory.ic_serial_no = 1`, [[tbl-ic-inventory]]) เก็บ "สถานะปัจจุบัน" ว่าอยู่ในสต๊อกหรือออกไปแล้ว อยู่คลัง/ที่เก็บไหน และข้อมูลผลิต/ประกัน ตารางนี้ **เป็นค่า derive** จาก [[tbl-ic-trans-serial-number]] (log การเคลื่อนไหว) — ไม่ควรแก้ตรง

## คอลัมน์ที่เห็นในโค้ด

| column | ความหมาย | ที่มา |
|---|---|---|
| `ic_code` | รหัสสินค้า ([[tbl-ic-inventory]].code) | `stock_tools.go:591` |
| `serial_number` | หมายเลข Serial; (`ic_code`, `serial_number`) เป็น unique index ตามคอมเมนต์ | `stock_tools.go:589-590` |
| `ic_unit` | หน่วยนับของสินค้า ([[tbl-ic-unit-use]].code) | `stock_tools.go:591,271` |
| `status` | 0 = ในสต๊อก, 1 = ออกจากสต๊อก (derive จากบรรทัดเคลื่อนไหวล่าสุด: `calc_flag = 1` รับ = 0, อย่างอื่น = 1) | `stock_tools.go:599-604`, `report_menu_ic.go:1054` |
| `wh_code`, `shelf_code` | คลัง/ที่เก็บของบรรทัดรับล่าสุด | `stock_tools.go:606-611` |
| `void_date`, `product_year`, `product_week` | วันหมดประกัน/ปีและสัปดาห์ที่ผลิต (ดึงจากบรรทัดรับแรกสุด; ไม่มีบรรทัดรับ = เคลียร์) | `stock_tools.go:612-621` |
| `description` | รายละเอียด/ชื่อ (รายงาน Serial อ่านคอลัมน์นี้) | `report_menu_ic.go:1053` |
| `roworder` | ลำดับแถวจริง ใช้เป็น tie-breaker | `stock_tools.go:273-274` |

## วิธีที่ระบบสร้าง/ปรับ (`serialRebuildSQL`, `stock_tools.go:580-622`)

เรียกผ่าน `rebuildSerialTx` (`stock_tools.go:624`) หลังบันทึก/ลบ/ยกเลิกเอกสารทุกครั้งที่แตะสินค้านั้น ดู [[acc-transaction-save-flow]] ลำดับ:

1. ตั้ง `last_status` ของ [[tbl-ic-trans-serial-number]] ให้ตามหัวเอกสาร [[tbl-ic-trans]]
2. ลบแถว `ic_serial` ที่ไม่มีบรรทัดเคลื่อนไหวที่ยังมีผลเหลือ (ไม่นับ flag 76 ตรวจนับ และ 14/16 ที่ `inquiry_type <> 0`)
3. เพิ่มแถวที่ยังไม่มี (เลือกบรรทัดแรกสุดต่อ Serial)
4. ซิงก์ `cust_code` ของบรรทัด Serial ให้ตรงหัว
5. ตั้ง `status` จากบรรทัดเคลื่อนไหวล่าสุด โดยนับเฉพาะ `serialMoveFlags`: flag 54, 60, 56, 58, 70, 72, 66, 68, 12, 310, 44; 14/16 ที่ `inquiry_type = 0`; 48 ที่ `inquiry_type` 0 หรือ 1; 46 ที่ `inquiry_type = 0`
6. ตั้ง `wh_code`/`shelf_code` จากบรรทัดรับล่าสุด; ตั้ง `void_date`/`product_year`/`product_week` จากบรรทัดรับแรกสุด

พอร์ตจาก C# `_docFlowThread.cs _serialNumberQueryList` (คอมเมนต์ `stock_tools.go:569-573`) เรียกซ้ำกี่รอบผลเท่าเดิม

## ใครอ่าน

- **สแกน/ตรวจนับ Serial:** `serialLookupSQL` ค้น Serial (ไม่สนตัวพิมพ์) แล้ว join สินค้าและอัตราแปลงหน่วยเพื่อเติมบรรทัดเอกสาร 76 (`stock_tools.go:269-275`) ดู [[acc-stock-special-docs]]
- **รายงาน:** Item_by_serial, Serial_number และยอดคงเหลือแบบ Serial (เฉพาะ `status = 0` ที่ยอดสินค้าไม่เป็นศูนย์) (`report_menu_ic.go:1024-1098`)
- **ตรวจข้อมูลระบบ:** เครื่องมือเช็คบรรทัดที่ `is_serial_number <> 1` ทั้งที่สินค้ามี `ic_serial_no = 1` (`sysproc_ic_checks_data.go:68`)

## ใครเขียน

- เฉพาะ `rebuildSerialTx` ตามด้านบน
- เปลี่ยนรหัสสินค้าแก้ `ic_code` ของตารางนี้ (`workflow.go:143`) และตารางนี้ถูกลบพร้อมสินค้า

## ข้อควรระวัง

- Serial เดียวกันแต่เอกสารขัดแย้งกัน (เช่น หน่วยต่างกัน) → unique index บังคับให้เก็บบรรทัดแรกสุดเท่านั้น (`stock_tools.go:589-590`)
- ตารางนี้ **ไม่ใช่ยอดคงเหลือ**: ยอดสินค้ามาจาก [[tbl-ic-trans-detail]] ส่วน `ic_serial` ใช้ระบุตัวตนรายเลข ดู [[acc-inventory-stock-rebuild]]
- หน้าจอรายงานเขียนคอมเมนต์ว่าเอกสาร C# พิมพ์สถานะ "ในสต๊อค" ทั้งสองค่า ที่นี่แก้เป็น 0 = ในสต๊อค / อื่น = ออกจากสต๊อก (`report_menu_ic.go:1046-1048`)

## ที่มาในโค้ด

- `backend/internal/application/process/stock_tools.go:176-275`, `:568-640`
- `backend/internal/application/process/report_menu_ic.go:1024-1098`
- `backend/internal/application/process/sysproc_ic_checks_data.go:68`
- `backend/internal/application/process/workflow.go:143`
