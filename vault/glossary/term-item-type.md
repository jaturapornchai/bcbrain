---
title: "ประเภทสินค้า และประเภทภาษีของสินค้า (item type / item_type / tax_type)"
tags: [glossary, ic, item-master]
aliases: ["item_type", "itemType", "ประเภทสินค้า", "สินค้าทั่วไป", "สินค้าบริการ", "บริการ", "ไม่ทำสต๊อก", "สินค้าให้เช่า", "สินค้าชุด", "สินค้าจัดชุด", "สินค้าฝากขาย", "สูตรการผลิต", "สูตรสี", "สีผสม", "ผสมสี", "tax_type", "ประเภทภาษีสินค้า", "ภาษีมูลค่าเพิ่ม", "ยกเว้นภาษี", "ic_inventory_set_detail", "set item", "BOM", "isSetItem"]
sources: ["frontend/account/master/ItemScreen.tsx:2222", "frontend/account/master/ItemScreen.tsx:2241", "frontend/src/config/schemas/icInventory.ts:44", "frontend/src/config/schemas/icInventory.ts:49", "backend/internal/application/process/report_menu_ic.go:913", "backend/internal/application/process/trans_set_item.go:71", "backend/internal/application/process/trans_set_item.go:22", "backend/internal/application/process/transcalc.go:112", "backend/internal/application/process/service.go:1136", "frontend/src/config/bcMenu.json:2018", "frontend/src/config/i18n/bcThaiWordDict.ts:1643"]
---

# ประเภทสินค้า (item_type)

## ในระบบนี้คืออะไร
`ic_inventory.item_type` เป็นตัวเลขที่บอกชนิดสินค้า ระบบใช้ค่านี้ตัดสินว่าสินค้าทำสต็อกหรือไม่ และเป็นสินค้าชุดหรือไม่ ในจอข้อมูลสินค้าจะอยู่คู่กับช่อง "ประเภทภาษี" (`ic_inventory.tax_type`) (`ItemScreen.tsx:2208-2222`)

## ค่าที่เป็นไปได้
| ค่า | dropdown จอสินค้า (`ItemScreen.tsx:2241-2247`) | ชื่อในรายงานรายละเอียดสินค้า (`report_menu_ic.go:913`) |
|---|---|---|
| 0 | 1.สินค้าทั่วไป | สินค้าทั่วไป |
| 1 | 2.บริการ | สินค้าบริการ (ไม่ทำสต๊อก) |
| 2 | 3.สินค้าให้เช่า | สินค้าให้เช่า |
| 3 | 4.สินค้าชุด | สินค้าชุด (ไม่ทำสต๊อก) |
| 4 | 5.สินค้าฝากขาย | สินค้าฝากขาย |
| 5 | 6.สูตรสี | สูตรการผลิต |
| 6 | 7.ผสมสี | สีผสม |

`tax_type` ของสินค้า: 0 = "1.ภาษีมูลค่าเพิ่ม", 1 = "2.ยกเว้นภาษี" (`ItemScreen.tsx:2213-2222`)

## ใช้ทำอะไรในโค้ด
- item_type 3 (สินค้าจัดชุด) และ 5 (สูตรสี) เป็น **สินค้าชุด** (`isSetItem`, `trans_set_item.go:22`) เมื่อเลือกในเอกสาร ระบบจะแตกแถวจาก `ic_inventory_set_detail` ลงใต้บรรทัดชุด บรรทัดชุดเก็บ `ref_guid` แถวลูกเก็บ `set_ref_line` สต็อกเก็บที่แถวลูกเท่านั้น (`trans_set_item.go:71-91`)
- ยอดรวมท้ายบิลไม่รวมบรรทัดชุดของ item_type 3/5 นับเฉพาะแถวลูก (`setTotalLines`, `transcalc.go:112-125`) ส่วนงานที่ไม่มีค่ากำหนดบริษัท (POS, เครื่องมือสต็อก) จะตัดบรรทัดชุดเมื่อมีแถวลูกของมันอยู่ในเอกสาร
- การคำนวณต้นทุนไม่รวม item_type 5 (`service.go:1135-1136`) และการอัปเดตยอดคงเหลือ `balance_qty` ก็ข้าม item_type 5 (`service.go:1123`)
- เมนู "สินค้าชุด" (`menu_ic_item_set`, bcMenu.json:2018) และพจนานุกรมแปล "สินค้าชุด" เป็น "Item Set (BOM)" (`bcThaiWordDict.ts:1643`)

## ข้อควรระวัง
- **dropdown แสดงเลข 1-based** (`value={0}` แสดงเป็น "1.สินค้าทั่วไป") ถ้าผู้ใช้พูดว่า "ประเภท 4" อาจหมายถึง item_type 3 ต้องถามหรือเทียบชื่อก่อน
- ชื่อของค่า 5 และ 6 ไม่ตรงกันในโค้ด จอสินค้าเรียก 5 ว่า "สูตรสี" และ 6 ว่า "ผสมสี" รายงานเรียก 5 ว่า "สูตรการผลิต" และ 6 ว่า "สีผสม" ส่วนคอมเมนต์ใน `service.go:1135` เรียก item_type 5 ว่า "Service items" ซึ่งขัดกับทั้งสองแบบ ให้ตรวจโค้ดตรงจุดก่อนสรุป
- คำว่า "ประเภทภาษี" ของสินค้าเป็นคนละเรื่องกับ `vat_type` ของเอกสาร ดู [[term-vat-type]]

## ลิงก์
[[term-cost-type]] · [[term-unit-ratio]] · [[proc-item-master-detail]] · [[tbl-ic-inventory]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/account/master/ItemScreen.tsx:2208-2222`, `:2213-2222`, `:2241-2247`
- `frontend/src/config/schemas/icInventory.ts:44`, `:49`
- `backend/internal/application/process/report_menu_ic.go:913` (`icMasterSpec`)
- `backend/internal/application/process/trans_set_item.go:71-91`, `:22`
- `backend/internal/application/process/transcalc.go:112-125`
- `backend/internal/application/process/service.go:1123`, `:1135-1136`
- `frontend/src/config/bcMenu.json:2018`; `frontend/src/config/i18n/bcThaiWordDict.ts:1643`
