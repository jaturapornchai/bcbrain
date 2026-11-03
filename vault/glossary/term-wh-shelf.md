---
title: "คลังสินค้าและที่เก็บ (warehouse / shelf / wh_code / shelf_code)"
tags: [glossary, ic, warehouse]
aliases: ["คลัง", "คลังสินค้า", "wh", "wh_code", "whCode", "ic_warehouse", "ที่เก็บ", "พื้นที่เก็บ", "พื้นที่เก็บสินค้า", "shelf", "shelf_code", "shelfCode", "ic_shelf", "ic_wh_shelf", "location", "จากคลัง", "จากที่เก็บ", "เข้าคลัง", "เข้าที่เก็บ", "wh_from", "location_from", "wh_to", "location_to", "wh_code_2", "shelf_code_2", "toWhCode", "โอนคลัง", "ผู้จัดการคลัง", "perm_wh_shelf", "สิทธิ์คลัง"]
sources: ["frontend/src/config/bcMenu.json:360", "frontend/src/config/bcMenu.json:373", "frontend/src/config/bcMenu.json:138", "frontend/src/config/bcMenu.json:2200", "frontend/src/config/schemas/icWarehouse.ts:31", "frontend/src/config/schemas/icWarehouse.ts:75", "frontend/src/config/schemas/icMasterSchemas.ts:366", "frontend/src/config/schemas/icMasterSchemas.ts:386", "frontend/account/transaction/transLayouts.ts:331", "frontend/account/transaction/TransTopForm.tsx:795", "backend/internal/application/process/trans.go:37", "backend/internal/application/process/trans.go:123", "backend/internal/application/process/trans.go:18"]
---

# คลังสินค้า / ที่เก็บ

## ในระบบนี้คืออะไร
สต็อกนับแยกตาม **คลัง** (`ic_warehouse`, จอ "กำหนดคลังสินค้า" bcMenu.json:360) และ **ที่เก็บ/พื้นที่เก็บ** (`ic_shelf`, จอ "กำหนดพื้นที่เก็บสินค้า" :373) การผูกว่าที่เก็บใดอยู่ในคลังไหนเก็บใน `ic_wh_shelf` (`wh_code`, `shelf_code`) (`icMasterSchemas.ts:386`) ถ้าที่เก็บถูกใช้แล้วจะลบไม่ได้ ระบบแจ้ง "มีการใช้งานในสินค้าและพื้นที่เก็บแล้ว"

## identifier / ตาราง / คอลัมน์
| ป้ายบนจอ | identifier | ที่อยู่ |
|---|---|---|
| คลังสินค้า: / จากคลัง: | `whFrom` → `wh_from` | หัว `ic_trans` |
| พื้นที่เก็บ: / จากที่เก็บ: | `locationFrom` → `location_from` | หัว `ic_trans` |
| เข้าคลัง: / เข้าที่เก็บ: | `whTo` / `locationTo` → `wh_to` / `location_to` | หัว `ic_trans` (`trans.go:123-126`) |
| คลัง/ที่เก็บ (กริด) | `whCode` / `shelfCode` → `wh_code` / `shelf_code` | `ic_trans_detail` (`trans.go:37-38`) |
| เข้าคลัง/เข้าที่เก็บ (กริด) | `toWhCode` / `toShelfCode` → `wh_code_2` / `shelf_code_2` (ว่าง = ใช้คลัง/ที่เก็บปลายทางของหัวเอกสาร, `trans.go:1092`) | `ic_trans_detail` (`trans.go:39-40`, `:705`) |
- ป้ายบนหัวเอกสารเปลี่ยนตามชนิดเอกสาร เอกสารโอน (70/72/73) ใช้ "จากคลัง:" และ "จากที่เก็บ:" เอกสารอื่นใช้ "คลังสินค้า:" และ "พื้นที่เก็บ:" (`transLayouts.ts:331-335`) ช่องคลังต้นทางและปลายทางของการโอนอยู่ที่ `TransTopForm.tsx:795`
- master คลัง (`icWarehouse.ts`): รหัส (`code`, :31), ชื่อ, ผู้จัดการคลัง (`wh_manager`, :75), สาขา (`branch_code`, :81), สาขาที่ใช้งาน (`branch_use`, :87)
- flag ที่เกี่ยวกับการโอน: 72 โอนออก, 70 โอนเข้า, 124 ขอโอน (`trans.go:18-27`)

## ข้อควรระวัง
- ถ้า `erp_option.perm_wh_shelf = 1` ผู้ใช้จะเลือกได้เฉพาะคลังและที่เก็บที่กลุ่มของตนได้รับสิทธิ์ (จอ "กำหนดการใช้คลังและที่เก็บ" bcMenu.json:138) ดู [[proc-wh-shelf-permission]]
- คำว่า "location" ในคอลัมน์หัวเอกสารหมายถึงที่เก็บ (shelf) ไม่ใช่สาขาหรือที่อยู่
- เมนู "คลังที่เก็บสินค้า" (`menu_ic_warehouse_locaton`, :2200) สะกดผิดในชื่อ key จริง ถ้าค้นด้วยคำว่า location จะไม่เจอ

## ลิงก์
[[proc-wh-shelf-permission]] · [[term-stock-balance]] · [[term-unit-ratio]] · [[tbl-ic-trans-detail]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/src/config/bcMenu.json:138`, `:360`, `:373`, `:2200`
- `frontend/src/config/schemas/icWarehouse.ts:31`, `:75`, `:81`, `:87`
- `frontend/src/config/schemas/icMasterSchemas.ts:366-369`, `:386`
- `frontend/account/transaction/transLayouts.ts:331-335`
- `frontend/account/transaction/TransTopForm.tsx:795`
- `backend/internal/application/process/trans.go:18-27`, `:37-40`, `:123-126`, `:705`, `:1092`
