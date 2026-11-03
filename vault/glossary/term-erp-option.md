---
title: "ข้อเลือกพิเศษ / ค่าตั้งระบบ (erp_option)"
tags: [glossary, option, config]
aliases: ["กำหนดข้อเลือกพิเศษต่างๆ", "ข้อเลือกพิเศษ", "ตั้งค่าระบบ", "ค่าตั้งระบบ", "option", "erp_option", "menu_option", "erpOptionSchema", "จุดทศนิยม", "ทศนิยมจำนวน", "ทศนิยมราคา", "ทศนิยมมูลค่า", "การปัดเศษ", "round_type", "item_qty_decimal", "item_price_decimal", "item_amount_decimal", "อัตราภาษีมูลค่าเพิ่ม", "vat_rate", "ใช้คลังที่เก็บตามสิทธิ์พนักงาน", "perm_wh_shelf", "แสดงเอกสารเฉพาะสาขา", "show_branch_doc_only", "ห้ามใส่จำนวนเกินเอกสารอ้างอิง", "check_qty_over_doc_ref", "sr_ss_credit_check", "year_type", "multi_currency", "gl_trans_type", "discout_type", "get_last_price_type", "use_price_center"]
sources: ["frontend/src/config/bcMenu.json:42", "frontend/src/config/schemas/erpOption/index.ts:30", "frontend/src/config/schemas/erpOption/index.ts:46", "frontend/src/config/schemas/erpOption/tab1System.ts:15", "frontend/src/config/schemas/erpOption/tab1System.ts:54", "frontend/src/config/schemas/erpOption/tab2Gl.ts:57", "frontend/src/config/schemas/erpOption/tab2Gl.ts:67", "frontend/src/config/schemas/erpOption/tab3Item.ts:30", "frontend/src/config/schemas/erpOption/tab3Item.ts:37", "frontend/src/config/schemas/erpOption/tab3Item.ts:45", "frontend/src/config/schemas/erpOption/tab3Item.ts:97", "frontend/src/config/schemas/erpOption/tab4Sale.ts:226", "frontend/src/config/schemas/erpOption/tab4Sale.ts:391", "backend/internal/application/process/docs.go:87", "backend/internal/application/process/grid_calc.go:127", "backend/internal/application/process/lookup_trans.go:43", "backend/internal/application/process/lookup_trans.go:46", "backend/internal/application/process/fa_sale.go:56", "backend/internal/application/process/trans_qty_over_ref.go:13"]
---

# ข้อเลือกพิเศษ (erp_option)

## ในระบบนี้คืออะไร
- `erp_option` เก็บค่าตั้งระบบของบริษัท (`OPTION_MAIN_TABLE`, `index.ts:30`) จอ "กำหนดข้อเลือกพิเศษต่างๆ" (`menu_option`, bcMenu.json:42; `erpOptionSchema`, `index.ts:46-59`)
- แบ่งเป็น 9 แท็บ: 1.ตั้งค่าระบบ · 2.บัญชีแยกประเภท · 3.สินค้าคงคลัง · 4.ระบบขาย · 5.แลกเปลี่ยนข้อมูล · 6.MIS · 7.e-Wallet · 8.e-Tax INET · 9.Mobillyst (`tab*.ts` บรรทัด `label`)
- backend อ่านค่าจากตารางนี้ตอนคำนวณ ไม่ได้เชื่อค่าที่หน้าจอส่งมา

## ค่าที่ใช้บ่อย
| ป้ายบนจอ | คอลัมน์ | ค่า / ผล | ที่ backend ใช้ |
|---|---|---|---|
| ประเภทปี | `year_type` | 0 คริสต์ศักราช · 1 พุทธศักราช | ดู [[term-buddhist-year]] |
| จุดทศนิยม (จำนวนสินค้า) | `item_qty_decimal` | จำนวนหลัก (`tab3Item.ts:30`) | `report_menu_ic_opts.go:70` |
| จุดทศนิยม (ราคาสินค้า) | `item_price_decimal` | (`tab3Item.ts:37`) | |
| จุดทศนิยม (มูลค่าสินค้า) | `item_amount_decimal` | (`tab3Item.ts:45`) | `docs.go:87` |
| การปัดเศษ | `round_type` | 0 ปัดจากตำแหน่งสุดท้าย · 1 ปัดตามจำนวนทศนิยม (`tab2Gl.ts:57-63`) | `grid_calc.go:127` ดู [[acc-rounding-decimal]] |
| อัตราภาษีมูลค่าเพิ่ม | `vat_rate` | (`tab2Gl.ts:67`) | `fa_sale.go:56` ดู [[term-vat-type]] |
| ใช้คลังที่เก็บตามสิทธิ์พนักงาน | `perm_wh_shelf` | (`tab3Item.ts:97`) | `lookup_trans.go:46` ดู [[proc-wh-shelf-permission]] |
| แสดงเอกสารเฉพาะสาขา | `show_branch_doc_only` | (`tab1System.ts:54`) | `lookup_trans.go:43` |
| ห้ามใส่จำนวนเกินเอกสารอ้างอิง | `check_qty_over_doc_ref` | (`tab4Sale.ts:391`) | `trans_qty_over_ref.go:13` ดู [[term-doc-ref]] |
| ตรวจสอบวงเงินรวมรายการสั่งขาย/สั่งจอง | `sr_ss_credit_check` | (`tab4Sale.ts:226`) | ดู [[term-credit-due]] |
| ใช้ระบบหลายสกุลเงิน / สกุลเงินหลัก | `multi_currency` / `home_currency` | | ดู [[term-currency-fx]] |
| โอน GL | `gl_trans_type` | 0 แยกรายตัว · 1 แยกรายตัว+คอมปาว | ดู [[term-gl-journal]] |
| การคำนวณภาษีกรณีมีส่วนลดท้ายรายการ / เงื่อนไขการคำนวณ VAT กรณีมีส่วนลด / ระบบเรียกราคาขายล่าสุด / ใช้ระบบราคาจากส่วนกลาง | `discount_vat_type` / `discout_type` / `get_last_price_type` / `use_price_center` | | ดู [[term-price-discount]] |

## ข้อควรระวัง
- ชื่อคอลัมน์ `discout_type` สะกดผิดตั้งแต่ต้นทาง แต่เป็นชื่อจริงในฐานข้อมูล
- ถ้า `erp_option` ไม่มีแถว บางจุดจะใช้ค่าเริ่มต้นของโปรแกรม desktop เช่นถือว่าเป็นปี พ.ศ. (`doc_picture.go:242-249`) และสกุลเงินหลักเป็นค่าว่าง (`fx.go:36`)

## ลิงก์
[[tbl-erp-option]] · [[term-buddhist-year]] · [[term-price-discount]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/src/config/bcMenu.json:42`
- `frontend/src/config/schemas/erpOption/index.ts:30`, `:46-59`
- `frontend/src/config/schemas/erpOption/tab1System.ts:15`, `:22-36`, `:54`; `tab2Gl.ts:39-67`; `tab3Item.ts:30`, `:37`, `:45`, `:97`; `tab4Sale.ts:148`, `:226`, `:391`
- `backend/internal/application/process/docs.go:87`; `grid_calc.go:127`; `lookup_trans.go:43`, `:46`; `fa_sale.go:56`; `trans_qty_over_ref.go:13`; `report_menu_ic_opts.go:70`; `doc_picture.go:242-249`; `fx.go:36`
