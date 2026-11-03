---
title: "ข้อมูลการจัดส่งของเอกสาร (ic_trans_shipment)"
tags: [tables, ic]
aliases: ["ic_trans_shipment", "ข้อมูลจัดส่ง", "ใบปะหน้าพัสดุ", "shipment"]
sources: ["backend/internal/application/process/trans.go:175", "backend/internal/application/process/trans.go:1181", "backend/internal/application/process/trans.go:1187", "backend/internal/application/process/trans.go:422", "backend/internal/application/process/trans.go:535", "backend/internal/application/process/workflow.go:120", "frontend/account/transaction/UniversalTransScreen.tsx:1427", "frontend/account/transaction/TransExtraTabs.tsx:480", "scripts/sql/02_data_schema.sql:7151"]
---
# ข้อมูลการจัดส่งของเอกสาร (`ic_trans_shipment`)

**หน้าที่:** เก็บชื่อ ที่อยู่ เบอร์โทร ผู้ขนส่ง เลขพัสดุ และพิกัดของการจัดส่งสินค้าของเอกสาร 1 ใบ ([[tbl-ic-trans]]) คู่กับ `ic_trans.send_type` (0 รับเอง / 1 ส่งให้ — `trans.go:1175-1180`) รับค่าจากช่อง `shipName`…`shipLongitude` ของ `SaveTransInput` (`trans.go:175-181`) ไม่เกี่ยวกับสต๊อกหรือ GL

## คอลัมน์ (INSERT ที่ `trans.go:1187-1189`)

| column | ความหมาย | ขีดจำกัดที่โค้ดตรวจ |
|---|---|---|
| `doc_no`, `trans_flag` | เอกสารเจ้าของ (key ร่วมกับ [[tbl-ic-trans]]) | — |
| `doc_date` | วันที่เอกสาร | — |
| `cust_code` | รหัสลูกค้า (คัดลอกจากหัว; เปลี่ยนรหัสลูกหนี้แล้วแก้ตาม `workflow.go:120`) | — |
| `transport_name` | ชื่อผู้รับ/ชื่อที่จัดส่ง | ≤ 255 ตัวอักษร |
| `transport_address` | ที่อยู่จัดส่ง | ≤ 1000 |
| `transport_telephone` | โทรศัพท์ | ≤ 100 |
| `transport_code` | รหัส/ชื่อผู้ขนส่ง | ≤ 25 |
| `ship_code` | เลขพัสดุ/เลขติดตาม (`shipTrackingNo`) | ≤ 50 |
| `latitude`, `longitude` | พิกัด (`numeric`; ช่องว่างเก็บเป็น 0 และหน้าจอแสดง 0 เป็นว่าง) | ต้องเป็นตัวเลข ทศนิยมเกิน 10 ตำแหน่งปัดให้ (`decimalParser.arg` `trans.go:1214`) |
| `roworder` | ลำดับแถว (หน้าจออ่านแถวล่าสุด `ORDER BY roworder DESC LIMIT 1` — `UniversalTransScreen.tsx:1427`) | — |

## กระบวนการ

- **เขียน:** `saveTransTx` ลบแถวเดิมของเอกสาร (`trans.go:535`) แล้ว `buildTransArgs` สั่ง INSERT 1 แถวเฉพาะเมื่อผู้ใช้กรอกข้อมูลจัดส่งอย่างน้อยหนึ่งช่อง (`trans.go:1181-1190`) ดู [[acc-transaction-save-flow]]
- **อ่าน:** หน้า `UniversalTransScreen` ดึงแถวล่าสุดของเอกสารตาม `trans_flag` แล้วเติมแท็บ "ข้อมูลการจัดส่ง / ใบปะหน้าพัสดุ" (`UniversalTransScreen.tsx:1419-1427`, `TransExtraTabs.tsx:480-481`)
- **ลบ:** ถูกลบพร้อมเอกสารใน `deleteTransTx` (`trans.go:422`)

## ข้อควรระวัง

- DDL อยู่ที่ `scripts/sql/02_data_schema.sql:7151-7176` (24 คอลัมน์ รวมคอลัมน์ระบบ `ignore_sync`, `is_lock_record`, `roworder`, `create_date_time_now`) Go เขียน 11 คอลัมน์ข้างบน และขีดจำกัดความยาวที่โค้ดตรวจตรงกับขนาด `varchar` ใน DDL (255 / 1000 / 100 / 25 / 50; `latitude`, `longitude` เป็น `numeric`) ส่วน `transport_fax`, `transport_tambon`, `transport_amper`, `transport_province`, `transport_country`, `destination`, `remark`, `remark_2`, `logistic_area` อยู่ใน DDL แต่ไม่พบโค้ด Go หรือหน้าจออ่านหรือเขียน
- ความยาวเกินขีดจำกัดจะถูกปฏิเสธด้วยข้อความ "ข้อมูลการจัดส่งยาวเกินขนาดที่กำหนด" (`trans.go:1183-1185`)
- ข้อมูลที่อยู่/เบอร์โทรเป็นข้อมูลส่วนบุคคลของลูกค้า — อย่านำค่าจริงไปใส่ในเอกสาร/ล็อก

## ที่มาในโค้ด

- `scripts/sql/02_data_schema.sql:7151-7176` DDL ของ `ic_trans_shipment`
- `backend/internal/application/process/trans.go:175-181` (ช่องรับค่าใน `SaveTransInput`), `:422` (ลบใน `deleteTransTx`), `:535` (ลบใน `saveTransTx`), `:1175-1190` (`buildTransArgs`)
- `backend/internal/application/process/workflow.go:120`
- `frontend/account/transaction/UniversalTransScreen.tsx:1419-1427`
- `frontend/account/transaction/TransExtraTabs.tsx:480-481` (ส่วน `shipment-control-section`)
