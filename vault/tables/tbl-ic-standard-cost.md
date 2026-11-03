---
title: "ต้นทุนมาตรฐานสินค้า (ic_standard_cost)"
tags: [tables, ic]
aliases: ["ic_standard_cost", "ต้นทุนมาตรฐาน", "cost1"]
sources: ["backend/internal/application/process/item_master.go:455", "backend/internal/application/process/item_master.go:755", "backend/internal/application/process/item_master.go:812"]
---
# ต้นทุนมาตรฐานสินค้า (`ic_standard_cost`)

**หน้าที่:** ตารางลูกของ [[tbl-ic-inventory]] เก็บต้นทุนมาตรฐานของสินค้าตามวันที่เริ่มใช้และหน่วยนับ ในโค้ดที่อ่านเห็นเฉพาะการบันทึกจากหน้าสินค้า ไม่พบจุดที่ดึงตารางนี้ไปคิดต้นทุนในบรรทัดเอกสาร (`ic_inventory.cost_type` 4 = ต้นทุนมาตรฐาน ตามป้ายรายงาน แต่ความเชื่อมระหว่างสองอย่างนี้ไม่ชัดจากโค้ด)

## คอลัมน์ (จาก INSERT ที่ `item_master.go:756-758`)

| column | ความหมาย |
|---|---|
| `ic_code` | รหัสสินค้า |
| `date_start` | วันที่เริ่มใช้ต้นทุน (ว่าง = วันนี้; ห้ามซ้ำวันในกริดเดียวกัน) |
| `unit_code` | หน่วยของต้นทุน (แปลงเป็นตัวพิมพ์ใหญ่) |
| `cost1` | ต้นทุนมาตรฐาน (decimal) |

## กระบวนการ

- เขียน: ทุกครั้งที่บันทึกสินค้า DELETE ทุกแถวของสินค้าแล้ว INSERT ใหม่จากกริดต้นทุนมาตรฐาน (`item_master.go:755-758`) โดยกริดตรวจก่อนบันทึก: จำนวนแถวไม่เกินกำหนด, วันที่ถูกต้อง, ไม่ซ้ำวัน, ต้นทุนเป็นเลขทศนิยมที่ถูกต้อง (`item_master.go:468-495`)
- ลบพร้อมสินค้า (`itemChildTables`, `item_master.go:812`)
- ข้อความตรวจใช้คำว่า "ต้นทุนมาตรฐาน" (`item_master.go:468,474,484,488,495`)

## ที่มาในโค้ด

- `backend/internal/application/process/item_master.go:468-495`, `:755-758`, `:812`
