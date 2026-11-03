---
title: "ราคาขายสินค้าตามเงื่อนไข (ic_inventory_price)"
tags: [tables, ic]
aliases: ["ic_inventory_price", "ราคาขายมาตรฐาน", "ราคาขายทั่วไป", "ราคาตามกลุ่มลูกค้า"]
sources: ["scripts/sql/02_data_schema.sql:5617", "backend/internal/application/process/master_detail_specs.go:28", "backend/internal/application/process/master_detail_specs.go:34", "backend/internal/application/process/master_detail_specs.go:38", "backend/internal/application/process/master_detail_specs.go:41", "backend/internal/application/process/master_detail_specs.go:49", "backend/internal/application/process/master_detail_specs.go:168", "backend/internal/application/process/master_detail_specs.go:264", "backend/internal/application/process/master_detail.go:512", "backend/internal/application/process/modify_price.go:24", "backend/internal/application/process/modify_price.go:38", "backend/internal/application/process/price_engine.go:49", "backend/internal/application/process/price_engine.go:67", "backend/internal/application/process/price_engine.go:88", "backend/internal/application/process/price_engine.go:103", "backend/internal/application/process/price_center.go:81", "backend/internal/application/process/price_info.go:50", "backend/internal/application/process/price_info.go:66", "backend/internal/application/process/item_master.go:70", "backend/internal/application/process/item_master.go:812", "backend/internal/application/process/workflow.go:137", "backend/internal/application/process/workflow.go:152", "backend/internal/application/process/report_menu_ic.go:952", "frontend/src/config/schemas/masterDetailSchemas.ts:128", "frontend/src/config/schemas/masterDetailSchemas.ts:176", "frontend/src/config/schemas/masterDetailSchemas.ts:227"]
---
# ราคาขายสินค้าตามเงื่อนไข (`ic_inventory_price`)

**หน้าที่:** ตารางราคาขายของสินค้าหนึ่งตัวตามเงื่อนไข (หน่วย/ช่วงจำนวน/ช่วงวันที่/ประเภทการขาย) แบ่งตามผู้ซื้อด้วย `price_type` และแบ่งชุดราคาด้วย `price_mode` เป็นแหล่งราคาที่กริดเอกสารขายใช้หาราคาของบรรทัด คนละชุดกับราคาบาร์โค้ดใน [[tbl-ic-inventory-barcode]]

## คอลัมน์ (DDL `scripts/sql/02_data_schema.sql:5617-5641`, คอลัมน์ที่จอกำหนดราคาบันทึก `master_detail_specs.go:28`)

| column | ความหมาย | ที่มา |
|---|---|---|
| `ic_code` | รหัสสินค้า ([[tbl-ic-inventory]]) | `master_detail_specs.go:43` |
| `price_type` | 1 = ราคาของสินค้า (ทุกคน), 2 = ตามกลุ่มลูกหนี้, 3 = ตามลูกหนี้รายตัว | `master_detail_specs.go:40-41`, `modify_price.go:26` |
| `price_mode` | 0 = ราคามาตรฐาน (จอ `menu_ic_item_saleprice` 2.4), 1 = ราคาทั่วไป (จอ `menu_ic_item_saleprice_2` 2.5) | `modify_price.go:27`, `master_detail_specs.go:168-169` |
| `cust_group_1`, `cust_group_2` | กลุ่มลูกหนี้หลัก/ย่อย (เฉพาะ `price_type = 2`; ต้องมีใน `ar_group` / `ar_group_sub`) | `master_detail_specs.go:53-54` |
| `cust_code` | รหัสลูกหนี้ (เฉพาะ `price_type = 3`; อ้าง [[tbl-ar-customer]]) | `master_detail_specs.go:55-56` |
| `unit_code` | หน่วยนับของราคา (ต้องเป็นหน่วยของสินค้านั้นใน [[tbl-ic-unit-use]]) | `master_detail_specs.go:18,42` |
| `sale_price1`, `sale_price2` | ป้ายหน้าจอ "ราคาแยกภาษี" / "ราคารวมภาษี"; ตอนหาราคาเอกสารใช้ `sale_price1` เมื่อประเภทภาษีของเอกสารเป็นแยกนอก (`VatType == 0`) นอกนั้นใช้ `sale_price2` ถ้าทั้งสองเป็น 0 บรรทัดนั้นถูกข้ามตอนบันทึก | `masterDetailSchemas.ts:176-179`, `price_engine.go:121-123`, `master_detail_specs.go:34-36` |
| `from_qty`, `to_qty` | ช่วงจำนวน (ตอนหาราคา จำนวนในบรรทัดต้องอยู่ในช่วงนี้) | `price_engine.go:49-50` |
| `from_date`, `to_date` | ช่วงวันที่ (ตอนหาราคา วันที่เอกสารต้องอยู่ในช่วงนี้) | `price_engine.go:49` |
| `sale_type` | ประเภทการขาย 0 = ไม่เลือก (ใช้ได้ทั้งสองแบบ), 1 = ขายเงินสด, 2 = ขายเงินเชื่อ; ตัวกรองคือ `sale_type IN (0, $5)` โดย `$5` = 2 เมื่อประเภทของบรรทัดเป็น 0 หรือ 2 นอกนั้น 1 | `masterDetailSchemas.ts:128-132`, `price_info.go:32`, `price_engine.go:49-50,88-93` |
| `transport_type` | เงื่อนไขการส่ง 0-2 ใช้เรียงลำดับเลือกแถวราคา (`ORDER BY ... transport_type DESC`) จอกำหนดราคาไม่มีช่องกรอกคอลัมน์นี้ (ใช้ชุดคอลัมน์เงื่อนไขแบบไม่มีการส่ง) | `price_engine.go:72-75`, `masterDetailSchemas.ts:222` |
| `status` | ป้ายหน้าจอ "ไม่ใช้งาน" (1 = ไม่ใช้งาน) ช่วง 0-1; คำสั่งหาราคาของเอกสารไม่มีเงื่อนไขกรอง `status` | `masterDetailSchemas.ts:173`, `price_info.go:33`, `price_engine.go:49-64` |
| `line_number` | ลำดับบรรทัดในกริด ใช้เรียงเลือกแถวของราคามาตรฐาน (`line_number DESC`) | `master_detail_specs.go:44`, `price_engine.go:75` |
| `roworder` | เลขแถวอัตโนมัติ (serial) หน้าต่างราคาในกริดเอกสารใช้ไฮไลต์แถวราคาที่ถูกเลือก | `price_info.go:38,61`, `price_engine.go:63` |
| `price_currency`, `currency_code` | สกุลเงินของราคา ใช้กรองเมื่อเปิดหลายสกุลเงิน (`price_currency = 0` หรือ `currency_code` ตรงและ `price_currency = 1`) จอกำหนดราคาไม่บันทึกสองคอลัมน์นี้ | `price_engine.go:61` |

- `olddate`, `ignore_sync`, `is_lock_record`, `create_date_time_now` มีใน DDL แต่ไม่พบตัวอ่าน/เขียนใน backend ที่ค้น (`02_data_schema.sql:5617-5641`)

## กระบวนการ

- **เขียนจากจอกำหนดราคา:** `salePriceSpec(mode)` สร้าง 3 กริด (normal / group / customer) ด้วย `priceGrid` เขียนด้วยชุด `price_mode` เดียวกัน และล้างเฉพาะแถว `price_mode` ของจอนั้นก่อนบันทึก (`master_detail_specs.go:41-59`) ตรวจช่วงค่า `sale_type`, `status` และ `transport_type` 0-2 (`saleRanges` `:38`) ส่วน `cust_group_1` (กลุ่มลูกหนี้) และ `cust_code` (ลูกค้า) เป็นช่องบังคับของกริดกลุ่ม/ลูกค้า (`:52-56`)
- **สวิตช์ `update_price` ของสินค้า:** จอนี้บันทึกได้เมื่อ `ic_inventory.update_price` ของสินค้าไม่เป็น 0 (ค่าตั้งต้น 1) ถ้าเป็น 0 ตอบ "ไม่อนุญาตให้แก้ไขข้อมูลนี้" (`gate: "update_price"` `master_detail_specs.go:50`, `checkItem` `master_detail.go:512-532`, ค่าตั้งต้น `item_master.go:70`)
- **จอ 2.9 "ราคาขายสินค้า":** เขียนตารางนี้ครบ 6 กริด (มาตรฐาน x3 และทั่วไป x3) พร้อม `ic_inventory_price_formula` และราคาบาร์โค้ด ล้างแถวทั้งสอง `price_mode` ก่อนบันทึก (`master_detail_specs.go:264-291`, `masterDetailSchemas.ts:836`)
- **แก้ราคาทีละชุด:** `modifyPriceKinds` มีชนิด `standard_1..3` (mode 0) และ `general_1..3` (mode 1) ชี้มาที่ตารางนี้ (`modify_price.go:38-43`) ตรวจรูปแบบวันที่ `ปปปป-ดด-วว` (`:222-231`) กรองแถวด้วย `price_type`/`price_mode` (`:274-276`) และใส่ค่าทั้งสองตอนเพิ่มแถว (`:363-365`)
- **ลบ/เปลี่ยนรหัส:** ลบพร้อมสินค้าที่ยังไม่ถูกใช้ในเอกสาร (`itemChildTables` `item_master.go:812-814`, ลูป `:847-849`); เปลี่ยนรหัสสินค้าแก้ `ic_code` และเปลี่ยนรหัสลูกหนี้แก้ `cust_code` (`workflow.go:137,152`)
- **อ่านเพื่อหาราคาในเอกสาร:** `findSalePrice` ลองตามลำดับ (1) ลูกหนี้รายตัว `price_type = 3` (2) กลุ่มลูกหนี้ของลูกค้าในเอกสาร `price_type = 2` (3) ราคาทั่วไป `price_type = 1, price_mode = 1` (4) ราคามาตรฐาน `price_type = 1, price_mode = 0` แล้วใช้แถวแรกที่พบ ถ้าไม่พบจึงใช้ราคาสูตรหรือราคาบาร์โค้ด (`salePriceSteps` `price_engine.go:67-76`, `findSalePrice` `:103-126`)
- **ศูนย์ราคา:** เมื่อ `erp_option.use_price_center = 1` กริดเอกสารขอราคาจากบริการศูนย์ราคาภายนอกแทนการอ่านตารางนี้ (`salePrice` `price_center.go:81-91`, `loadPriceCenter` `:71-78`)
- **หน้าต่างราคาในกริดเอกสาร:** แสดงแถวของสินค้า 3 ชุด คือราคาทั่วไป (type 1, mode 1), ราคาของกลุ่มลูกหนี้หลักของลูกค้าในเอกสาร (type 2, mode 1) และราคามาตรฐาน (type 1, mode 0) พร้อมชื่อหน่วยจาก [[tbl-ic-unit]] (`priceInfoSQL` `price_info.go:50-64`, `TransGridPriceInfo` `:66-112`)
- **รายงานราคาขายสินค้า:** รายงานมาตรฐาน (`price_mode = 0`) และทั่วไป (`price_mode = 1`) อ่านตารางนี้ (`icPriceSpec` `report_menu_ic.go:952-976`, ลงทะเบียน `:984-985`)

## ข้อควรระวัง

- ราคา 0 ทั้งคู่จะไม่ถูกบันทึก ไม่ใช่แถวราคา 0
- ตารางที่เกี่ยวข้องแต่แยกกัน: `ic_inventory_discount` (ส่วนลดตามเงื่อนไข, `master_detail_specs.go:62-70`), `ic_inventory_purchase_price` (ราคาซื้อ, `:72-79`), `ic_inventory_price_formula` (ราคาสูตร `price_0..price_9`, `modify_price.go:45`) — ดู [[tbl-group-ic]]

## ที่มาในโค้ด

- `scripts/sql/02_data_schema.sql:5617-5641`
- `backend/internal/application/process/master_detail_specs.go:18`, `:28-59`, `:62-70`, `:72-79`, `:168-169`, `:264-291`
- `backend/internal/application/process/master_detail.go:512-532`
- `backend/internal/application/process/modify_price.go:26-27`, `:38-43`, `:45`, `:222-231`, `:274-276`, `:363-365`
- `backend/internal/application/process/price_engine.go:49-64`, `:67-76`, `:88-93`, `:103-126`
- `backend/internal/application/process/price_center.go:71-78`, `:81-91`
- `backend/internal/application/process/price_info.go:32-33`, `:38`, `:50-64`, `:66-112`
- `backend/internal/application/process/item_master.go:70`, `:812-814`, `:847-849`
- `backend/internal/application/process/workflow.go:137`, `:152`
- `backend/internal/application/process/report_menu_ic.go:952-976`, `:984-985`
- `frontend/src/config/schemas/masterDetailSchemas.ts:128-132`, `:173`, `:176-179`, `:222`, `:227-246`, `:836`
