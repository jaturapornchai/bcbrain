---
title: "ต้นทุนมาตรฐานสินค้า (ic_standard_cost)"
tags: [tables, ic]
aliases: ["ic_standard_cost", "ต้นทุนมาตรฐาน", "cost1"]
sources: ["scripts/sql/02_data_schema.sql:6507", "backend/internal/application/process/item_master.go:466", "backend/internal/application/process/item_master.go:755", "backend/internal/application/process/item_master.go:812", "backend/internal/application/process/report_menu_ic.go:914", "frontend/account/master/ItemScreen.tsx:777"]
---
# ต้นทุนมาตรฐานสินค้า (`ic_standard_cost`)

**หน้าที่:** ตารางลูกของ [[tbl-ic-inventory]] เก็บต้นทุนมาตรฐานของสินค้าตามวันที่เริ่มใช้และหน่วยนับ ในโค้ดที่อ่านเห็นเฉพาะการบันทึกและการอ่านกลับมาแสดงที่หน้าสินค้า (`ItemScreen.tsx:770-780`) ไม่พบจุดที่ดึงตารางนี้ไปคิดต้นทุนในบรรทัดเอกสาร (`ic_inventory.cost_type` 4 = ต้นทุนมาตรฐาน ตามป้ายรายงาน `report_menu_ic.go:914` แต่ความเชื่อมระหว่างสองอย่างนี้ไม่ชัดจากโค้ด)

## คอลัมน์ (DDL `scripts/sql/02_data_schema.sql:6507-6516`, เขียนจาก INSERT ที่ `item_master.go:756-758` และกริดที่หน้าสินค้าอ่านกลับ `ItemScreen.tsx:770-780`)

| column | ความหมาย |
|---|---|
| `ic_code` | รหัสสินค้า |
| `date_start` | วันที่เริ่มใช้ต้นทุน (ว่าง = วันนี้; ห้ามซ้ำวันในกริดเดียวกัน) |
| `unit_code` | หน่วยของต้นทุน (แปลงเป็นตัวพิมพ์ใหญ่) |
| `cost1` | ต้นทุนมาตรฐาน (decimal) |

## กระบวนการ

- เขียน: ทุกครั้งที่บันทึกสินค้า DELETE ทุกแถวของสินค้าแล้ว INSERT ใหม่จากกริดต้นทุนมาตรฐาน (`item_master.go:755-758`) โดยกริดตรวจก่อนบันทึก: จำนวนแถวไม่เกินกำหนด, วันที่ถูกต้อง, ไม่ซ้ำวัน, ต้นทุนเป็นเลขทศนิยมที่ถูกต้อง (`item_master.go:466-498`)
- ลบพร้อมสินค้าที่ยังไม่ถูกใช้ในเอกสาร (`itemChildTables`, `item_master.go:812-814`)
- ข้อความตรวจใช้คำว่า "ต้นทุนมาตรฐาน" (`item_master.go:468,474,484,488,495`)

## ที่มาในโค้ด

- `scripts/sql/02_data_schema.sql:6507-6516`
- `backend/internal/application/process/item_master.go:466-498`, `:755-758`, `:812-814`
- `backend/internal/application/process/report_menu_ic.go:914`
- `frontend/account/master/ItemScreen.tsx:770-780`
