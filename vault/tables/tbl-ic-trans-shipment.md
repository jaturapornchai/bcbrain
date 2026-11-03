---
title: "ข้อมูลการจัดส่งของเอกสาร (ic_trans_shipment)"
tags: [tables, ic]
aliases: ["ic_trans_shipment", "ข้อมูลจัดส่ง", "ใบปะหน้าพัสดุ", "shipment"]
sources: ["backend/internal/application/process/trans.go:174", "backend/internal/application/process/trans.go:1175", "backend/internal/application/process/trans.go:1187", "backend/internal/application/process/trans.go:422", "backend/internal/application/process/workflow.go:120", "frontend/account/transaction/UniversalTransScreen.tsx:1418", "frontend/account/transaction/TransExtraTabs.tsx:479"]
---
# ข้อมูลการจัดส่งของเอกสาร (`ic_trans_shipment`)

**หน้าที่:** เก็บชื่อ ที่อยู่ เบอร์โทร ผู้ขนส่ง เลขพัสดุ และพิกัดของการจัดส่งสินค้าของเอกสาร 1 ใบ ([[tbl-ic-trans]]) คู่กับ `ic_trans.send_type` (0 รับเอง / 1 ส่งให้) พอร์ตจาก C# `_shipmentControl` (`trans.go:174`) ไม่เกี่ยวกับสต๊อกหรือ GL

## คอลัมน์ (INSERT ที่ `trans.go:1187-1188`)

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
| `latitude`, `longitude` | พิกัด (`numeric`, ทศนิยมตามที่ validate; 0 = ว่าง) | ตรวจเป็นเลข scale 10 |
| `roworder` | ลำดับแถวจริง (หน้าจออ่านแถวล่าสุด `ORDER BY roworder DESC LIMIT 1`) | — |

## กระบวนการ

- **เขียน:** `saveTransTx` ลบแถวเดิมของเอกสาร (`trans.go:422,535`) แล้ว INSERT 1 แถวเฉพาะเมื่อผู้ใช้กรอกข้อมูลจัดส่งอย่างน้อยหนึ่งช่อง (`trans.go:1181-1190`) ดู [[acc-transaction-save-flow]]
- **อ่าน:** หน้า `UniversalTransScreen` ดึงแถวล่าสุดของเอกสารตาม `trans_flag` แล้วเติมแท็บ "ข้อมูลการจัดส่ง / ใบปะหน้าพัสดุ" (`UniversalTransScreen.tsx:1418-1422`, `TransExtraTabs.tsx:479`)
- **ลบ:** ถูกลบพร้อมเอกสาร (`trans.go:422`)

## ข้อควรระวัง

- ไม่มี DDL ใน repo จึงยืนยันได้เฉพาะคอลัมน์ที่ INSERT/SELECT เห็น (11 ตัวข้างบน)
- ความยาวเกินขีดจำกัดจะถูกปฏิเสธด้วยข้อความ "ข้อมูลการจัดส่งยาวเกินขนาดที่กำหนด" (`trans.go:1183-1185`)
- ข้อมูลที่อยู่/เบอร์โทรเป็นข้อมูลส่วนบุคคลของลูกค้า — อย่านำค่าจริงไปใส่ในเอกสาร/ล็อก

## ที่มาในโค้ด

- `backend/internal/application/process/trans.go:174-181`, `:422`, `:535`, `:1175-1190`
- `backend/internal/application/process/workflow.go:120`
- `frontend/account/transaction/UniversalTransScreen.tsx:1418-1422`
- `frontend/account/transaction/TransExtraTabs.tsx:479`
