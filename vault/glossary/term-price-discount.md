---
title: "ราคา ส่วนลด และของแถม (price / discount word / price_type / is_permium)"
tags: [glossary, price, discount, ic]
aliases: ["ราคา", "ราคาขาย", "ราคาซื้อ", "ราคาขายมาตรฐาน", "ราคาขายทั่วไป", "ราคาตามลูกค้า", "ราคาตามกลุ่มลูกค้า", "สูตรราคาขาย", "ระดับราคา", "ราคาขายล่าสุด", "ราคาขายเฉลี่ย", "ราคาจากส่วนกลาง", "price center", "ส่วนลด", "ส่วนลดสินค้า", "ส่วนลดท้ายบิล", "ส่วนลดท้ายรายการ", "สูตรส่วนลด", "ของแถม", "ของแถมซื้อ", "premium", "price", "price_2", "discount", "discount_word", "discount_amount", "price_type", "price_mode", "set_ref_price", "price_level", "is_permium", "ic_inventory_price", "ic_inventory_discount", "ic_inventory_price_formula", "sale_price1", "sale_price2", "get_last_price_type", "use_price_center", "discount_vat_type", "discout_type", "calcDiscountOnly", "findSalePrice"]
sources: ["backend/internal/application/process/trans.go:45", "backend/internal/application/process/trans.go:46", "backend/internal/application/process/trans.go:72", "backend/internal/application/process/trans.go:85", "backend/internal/application/process/price_engine.go:72", "backend/internal/application/process/price_engine.go:79", "backend/internal/application/process/price_engine.go:103", "backend/internal/application/process/price_engine.go:133", "backend/internal/application/process/price_engine.go:157", "backend/internal/application/process/price_info.go:101", "backend/internal/application/process/price_center.go:81", "backend/internal/application/process/price_center.go:223", "backend/internal/application/process/stock_rebuild.go:144", "backend/internal/application/process/fx.go:201", "frontend/account/transaction/TransItemGrid.tsx:202", "frontend/account/transaction/TransItemGrid.tsx:933", "frontend/account/transaction/GridShortcutPopover.tsx:20", "frontend/src/config/bcMenu.json:2254", "frontend/src/config/bcMenu.json:2267", "frontend/src/config/bcMenu.json:2280", "frontend/src/config/bcMenu.json:2293", "frontend/src/config/bcMenu.json:2306", "frontend/src/config/bcMenu.json:2332", "frontend/src/config/schemas/erpOption/tab1System.ts:31", "frontend/src/config/schemas/erpOption/tab2Gl.ts:48", "frontend/src/config/schemas/erpOption/tab4Sale.ts:148", "frontend/src/config/schemas/erpOption/tab5Sync.ts:101"]
---

# ราคา / ส่วนลด / ของแถม

## คอลัมน์ในบรรทัดสินค้า (`ic_trans_detail`)
| คอลัมน์ | ความหมายในระบบ |
|---|---|
| `price` | ราคาต่อหน่วย (`trans.go:45`) ส่วน `price_2` คือราคาในสกุลเงินของเอกสาร (`fx.go:201`) ดู [[term-currency-fx]] |
| `discount` | **ข้อความส่วนลด** (discount word) เช่น "5%" หรือ "10" (`trans.go:46`) |
| `discount_amount` | จำนวนเงินส่วนลดที่คำนวณได้ (`:47`) |
| `price_type` / `price_mode` | ที่มาของราคา: -1 ไม่มี, 1-7 ค้นจากฐานข้อมูลในเครื่อง, 99 ราคาจากส่วนกลาง; `set_ref_price` = ราคาที่ค้นเจอ (`:72-75`) |
| `is_permium` | 1 = บรรทัดของแถมหรือแจกฟรี (`:85`, ชื่อคอลัมน์สะกดตามจริง) |

## รูปแบบข้อความส่วนลด (`calcDiscountOnly`, `stock_rebuild.go:144-168`)
- คั่นแต่ละตัวด้วย "," ระบบตัดช่องว่างและ "-" ทิ้ง
- `x%` ลด x% จากยอดที่เหลืออยู่ (ลดต่อกันเป็นทอด) · `@x` ทำให้ยอดเป็น จำนวน×(ราคา−x) · `x` ลด x บาท · ข้อความที่ไม่ใช่ตัวเลขนับเป็น 0
- ช่องส่วนลด (หัวคอลัมน์ "ส่วนลด" `TransItemGrid.tsx:392-395`) มีปุ่ม "สูตร" (`GridShortcutPopover.tsx:27`) แสดงเมื่ออยู่ในโหมดแก้ไขและบรรทัดมีรหัสสินค้า (`TransItemGrid.tsx:945`) ให้พิมพ์สูตรคำนวณได้ เช่น `=100*2+50` ใช้ + - * / และวงเล็บได้ (`TransItemGrid.tsx:202`, `GridShortcutPopover.tsx:20-24`)

## ลำดับการหาราคาขาย (`findSalePrice`, `price_engine.go:103-201`)
| `price_type` ของบรรทัด | แหล่ง |
|---|---|
| 1 | `ic_inventory_price` ราคาตามลูกค้า (`price_type = 3`, `price_engine.go:72`) |
| 2 | ราคาตามกลุ่มลูกค้า (`price_type = 2`, `:73`) |
| 3 | ราคาทั่วไป (`price_type 1, price_mode 1`) แล้วตามด้วยราคามาตรฐาน (`price_type 1, price_mode 0`) (`:74-75`; หน้าต่างดูราคา 3 ตารางใช้เงื่อนไขชุดเดียวกัน `price_info.go:101-109`) |
| 6 | สูตรราคาขาย `ic_inventory_price_formula` โดยใช้คอลัมน์ `price_0..price_9` ตาม `ar_customer.price_level` 1-9 (`price_engine.go:133-144`) |
| 5 | ราคาในบาร์โค้ด `ic_inventory_barcode.price` (`price_engine.go:146-155`) ดู [[term-barcode]] |
| 7 | ราคาขายล่าสุดหรือราคาเฉลี่ยจากใบขาย 44 ตาม `erp_option.get_last_price_type` (0 ไม่ใช้, 1 ราคาขายล่าสุด, 2 ดึงราคาขายเฉลี่ย; `price_engine.go:157-178`, `tab4Sale.ts:148-154`) |
| 99 | ราคาจากส่วนกลาง เมื่อเปิด `use_price_center` "ใช้ระบบราคาจากส่วนกลาง" เมื่อเปิดแล้วกริดไม่ค้นราคาจากฐานข้อมูลในเครื่องเลย (`salePrice`, `price_center.go:81-93`, ตั้ง 99 ที่ `:223`; `tab5Sync.ts:101`) |
- ถ้าเอกสารเป็นภาษีแยกนอก (`vat_type 0`) ระบบใช้ `sale_price1` ไม่อย่างนั้นใช้ `sale_price2` (`price_engine.go:122`) ดู [[term-vat-type]]
- ส่วนลดตั้งต้นมาจาก `ic_inventory_discount` เรียงจาก `discount_type` 2 ลูกค้า → 1 กลุ่มลูกค้า → 0 ทั่วไป (`price_engine.go:79-86`, ใช้ที่ `:184-199`)

## ส่วนลดท้ายบิล
- หัวเอกสารเก็บข้อความส่วนลดท้ายบิลใน `discount_word` และยอดใน `total_discount` ดู [[term-doc-totals]]
- `erp_option.discount_vat_type` "การคำนวณภาษีกรณีมีส่วนลดท้ายรายการ": 0 สินค้ามีภาษีก่อน, 1 เฉลี่ย (`tab1System.ts:31-36`)
- `erp_option.discout_type` "เงื่อนไขการคำนวณ VAT กรณีมีส่วนลด": 0 คำนวณ VAT ก่อนหักส่วนลด, 1 คำนวณ VAT หลังหักส่วนลด (`tab2Gl.ts:48-53`, ชื่อคอลัมน์สะกดตามจริง)

## หน้าจอ master (bcMenu.json)
กำหนดราคาซื้อ `menu_ic_purchase_price` (:2254) · ของแถมซื้อ `menu_ic_purchase_premium` (:2267) · กำหนดราคาขายมาตรฐาน `menu_ic_item_saleprice` (:2280) · กำหนดราคาขายทั่วไป `menu_ic_item_saleprice_2` (:2293) · กำหนดส่วนลดสินค้า `menu_ic_discount` (:2306) · กำหนดรูปแบบสูตรราคาขาย (:2319) · กำหนดสูตรราคาขาย `menu_ic_item_saleprice_formula` (:2332)

## ข้อควรระวัง
- `price_type` ของบรรทัดเอกสาร (1-7, 99) และ `price_type` ของตาราง `ic_inventory_price` (1 ทั่วไป, 2 กลุ่ม, 3 ลูกค้า) เป็นคนละ enum กัน
- ศูนย์ราคาถูกเรียกจากกริดรายการเอกสารเท่านั้น (`price_center.go:81-93`) ส่ง `sale_type` เฉพาะ flag 30/34/36/44 (`:32-33`, `centerSaleType` `:95-103`) ไม่มีการเรียกศูนย์ราคาจากหน้า POS

## ลิงก์
[[proc-price-engine]] · [[term-doc-totals]] · [[term-party-ap-ar]] · [[acc-rounding-decimal]] · [[glossary-overview]]

## ที่มาในโค้ด
- `backend/internal/application/process/trans.go:45-47`, `:72-75`, `:85`
- `backend/internal/application/process/price_engine.go:72-75`, `:79-86`, `:103-201`
- `backend/internal/application/process/price_info.go:101-109`; `price_center.go:32-33`, `:81-103`, `:223`; `fx.go:201`
- `backend/internal/application/process/stock_rebuild.go:144-168`
- `frontend/account/transaction/TransItemGrid.tsx:202`, `:392-395`, `:933-945`; `GridShortcutPopover.tsx:20-24`, `:27`
- `frontend/src/config/bcMenu.json:2254-2332`
- `frontend/src/config/schemas/erpOption/tab1System.ts:31-36`; `tab2Gl.ts:48-53`; `tab4Sale.ts:148-154`; `tab5Sync.ts:101`
