---
title: "คลังสินค้าและที่เก็บ (warehouse / shelf / wh_code / shelf_code)"
tags: [glossary, ic, warehouse]
aliases: ["คลัง", "คลังสินค้า", "wh", "wh_code", "whCode", "ic_warehouse", "ที่เก็บ", "พื้นที่เก็บ", "พื้นที่เก็บสินค้า", "shelf", "shelf_code", "shelfCode", "ic_shelf", "ic_wh_shelf", "location", "จากคลัง", "จากที่เก็บ", "เข้าคลัง", "เข้าที่เก็บ", "wh_from", "location_from", "wh_to", "location_to", "wh_code_2", "shelf_code_2", "toWhCode", "โอนคลัง", "ผู้จัดการคลัง", "perm_wh_shelf", "สิทธิ์คลัง"]
sources: ["frontend/src/config/bcMenu.json:360", "frontend/src/config/bcMenu.json:373", "frontend/src/config/bcMenu.json:138", "frontend/src/config/bcMenu.json:2199", "frontend/src/config/bcMenu.json:2200", "frontend/src/config/schemas/icWarehouse.ts:31", "frontend/src/config/schemas/icWarehouse.ts:75", "frontend/src/config/schemas/icMasterSchemas.ts:366", "frontend/src/config/schemas/icMasterSchemas.ts:372", "frontend/src/config/schemas/icMasterSchemas.ts:386", "frontend/src/config/schemas/icMasterSchemas.ts:387", "frontend/src/config/schemas/masterDetailSchemas.ts:1385", "frontend/src/config/schemas/masterDetailSchemas.ts:1406", "frontend/account/master/StandardMasterScreen.tsx:698", "frontend/account/transaction/transLayouts.ts:331", "frontend/account/transaction/TransTopForm.tsx:799", "frontend/account/transaction/TransTopForm.tsx:846", "backend/internal/application/process/trans.go:37", "backend/internal/application/process/trans.go:123", "backend/internal/application/process/trans.go:20", "backend/internal/application/process/trans.go:663", "backend/internal/application/process/trans.go:696", "backend/internal/application/process/trans.go:1092", "backend/internal/application/process/trans.go:1198", "backend/internal/application/process/stock_rebuild.go:57", "backend/internal/application/process/trans_lines_check.go:247", "backend/internal/application/process/perm_wh_shelf.go:16", "backend/internal/application/process/lookup_trans.go:46"]
---

# คลังสินค้า / ที่เก็บ

## ในระบบนี้คืออะไร
สต็อกนับแยกตาม **คลัง** (`ic_warehouse`, จอ "กำหนดคลังสินค้า" bcMenu.json:360) และ **ที่เก็บ/พื้นที่เก็บ** (`ic_shelf`, จอ "กำหนดพื้นที่เก็บสินค้า" :373) ที่เก็บแต่ละแห่งสังกัดคลังด้วยคอลัมน์ `whcode` ของ `ic_shelf` (`icMasterSchemas.ts:371-379`) ส่วน `ic_wh_shelf` (`wh_code`, `shelf_code`) ผูก **สินค้า** (`ic_code`) กับคลังและที่เก็บ แก้ไขรายสินค้าที่จอ "คลังที่เก็บสินค้า" (`masterDetailSchemas.ts:1385`, `:1406`) ถ้าที่เก็บถูกใช้ใน `ic_wh_shelf` หรือ `ic_trans_detail` แล้วจะลบไม่ได้ ระบบแจ้ง "มีการใช้งานในสินค้าและพื้นที่เก็บแล้ว" หรือ "มีการใช้งานในเอกสารสินค้าแล้ว" (`icMasterSchemas.ts:385-388`, ตรวจที่ `StandardMasterScreen.tsx:698-720`)

## identifier / ตาราง / คอลัมน์
| ป้ายบนจอ | identifier | ที่อยู่ |
|---|---|---|
| คลังสินค้า: / จากคลัง: | `whFrom` → `wh_from` | หัว `ic_trans` |
| พื้นที่เก็บ: / จากที่เก็บ: | `locationFrom` → `location_from` | หัว `ic_trans` |
| เข้าคลัง: / เข้าที่เก็บ: | `whTo` / `locationTo` → `wh_to` / `location_to` | หัว `ic_trans` (`trans.go:123-126`, `:663`) |
| คลัง/ที่เก็บ (กริด) | `whCode` / `shelfCode` → `wh_code` / `shelf_code` | `ic_trans_detail` (`trans.go:37-38`, `:696`) |
| เข้าคลัง/เข้าที่เก็บ (กริด) | `toWhCode` / `toShelfCode` → `wh_code_2` / `shelf_code_2` (เอกสารขอโอน 124 บันทึกจากเซลล์กริด ถ้าเซลล์ว่างใช้ปลายทางของหัวเอกสาร `trans.go:1088-1092` ส่วนโอนออก 72 / โอนเข้า 70 ระบบตั้งสองคอลัมน์นี้เป็นคลัง/ที่เก็บของบรรทัดคู่อีกฝั่งหลังบันทึก `stock_rebuild.go:57-65`, `trans.go:1198`) | `ic_trans_detail` (`trans.go:39-40`, `:705`) |
- ป้ายบนหัวเอกสารเปลี่ยนตามชนิดเอกสาร เอกสารโอน (70/72/73) ใช้ "จากคลัง:" และ "จากที่เก็บ:" เอกสารอื่นใช้ "คลังสินค้า:" และ "พื้นที่เก็บ:" (`transLayouts.ts:331-335`) ช่องคลัง/ที่เก็บต้นทางอยู่ที่ `TransTopForm.tsx:799` ช่อง "เข้าคลัง/เข้าที่เก็บ" อยู่ที่ `:846` สองกลุ่มนี้แสดงตามชุดช่องหัวเอกสารของแต่ละ flag (`h.has("wh")` / `h.has("whTo")`, `transLayouts.ts:449-450`)
- master คลัง (`icWarehouse.ts`): รหัส (`code`, :31), ชื่อ, ผู้จัดการคลัง (`wh_manager`, :75), สาขา (`branch_code`, :81), สาขาที่ใช้งาน (`branch_use`, :87)
- flag ที่เกี่ยวกับการโอน: 72 โอนออก, 70 โอนเข้า, 124 ขอโอน (`trans.go:20-27`)

## ข้อควรระวัง
- ถ้า `erp_option.perm_wh_shelf = 1` ระบบกรองรายการค้นหาคลัง/ที่เก็บและค่าตั้งต้นในกริดให้เหลือเฉพาะที่กลุ่มของผู้ใช้ได้รับสิทธิ์ใน `erp_user_group_wh_shelf` เฉพาะ flag ที่อยู่ใน `permScreenGrid` / `permScreenTop` (`perm_wh_shelf.go:16`, `:20`, `:26-37`, `:49-58`, อ่านค่าที่ `lookup_trans.go:46`, `:77`) (จอ "กำหนดการใช้คลังและที่เก็บ" bcMenu.json:138) ดู [[proc-wh-shelf-permission]]
- เอกสารที่กริดมีคอลัมน์คลัง (ยกเว้น flag ใน `gridNoWhFlags`) ต้องมีคลังและที่เก็บ ถ้าบรรทัดว่างใช้ `wh_from` / `location_from` ของหัวเอกสาร ถ้ายังว่างแจ้ง "ป้อนข้อมูลคลังสินค้าไม่ครบ" หรือ "ป้อนข้อมูลที่เก็บสินค้าไม่ครบ" และโอนออก 72 / ขอโอน 124 ต้องมีปลายทาง (`wh_to` / `location_to` ของหัวเอกสารหรือ `toWhCode` / `toShelfCode` ของบรรทัด) ด้วย (`trans_lines_check.go:242-262`)
- คำว่า "location" ในคอลัมน์หัวเอกสารหมายถึงที่เก็บ (shelf) ไม่ใช่สาขาหรือที่อยู่
- เมนู "คลังที่เก็บสินค้า" (`menu_ic_warehouse_locaton`, bcMenu.json:2199) สะกดผิดในชื่อ key จริง ถ้าค้นด้วยคำว่า location จะไม่เจอ

## ลิงก์
[[proc-wh-shelf-permission]] · [[term-stock-balance]] · [[term-unit-ratio]] · [[tbl-ic-trans-detail]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/src/config/bcMenu.json:138`, `:360`, `:373`, `:2199-2200`
- `frontend/src/config/schemas/icWarehouse.ts:31`, `:75`, `:81`, `:87`
- `frontend/src/config/schemas/icMasterSchemas.ts:366-369`, `:371-379`, `:385-388`
- `frontend/src/config/schemas/masterDetailSchemas.ts:1385`, `:1406`
- `frontend/account/master/StandardMasterScreen.tsx:698-720`
- `frontend/account/transaction/transLayouts.ts:331-335`
- `frontend/account/transaction/TransTopForm.tsx:799`, `:846`; `transLayouts.ts:449-450`
- `backend/internal/application/process/trans.go:20-27`, `:37-40`, `:123-126`, `:663`, `:696`, `:705`, `:1088-1092`, `:1198`
- `backend/internal/application/process/stock_rebuild.go:57-65`; `trans_lines_check.go:242-262`; `perm_wh_shelf.go:16`, `:20`, `:26-37`, `:49-58`; `lookup_trans.go:46`, `:77`
