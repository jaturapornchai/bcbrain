---
title: "หน้าจอข้อมูลหลัก + ตารางย่อย (MasterDetailScreen)"
tags: [screens, master]
aliases: ["MasterDetailScreen", "MASTER_DETAIL_CONFIGS", "master-detail", "หัวตาราง+รายการย่อย", "1008", "1009", "1081", "1096", "2007", "2015", "2016", "2025", "2026", "2029", "2030", "2031", "2032", "6009", "8001", "8004", "9001", "9002"]
sources: ["frontend/account/tabs/screenRegistry.tsx:152", "frontend/src/config/schemas/masterDetailSchemas.ts:6", "frontend/src/config/schemas/masterDetailSchemas.ts:335", "frontend/account/master/MasterDetailScreen.tsx:523", "frontend/account/master/MasterDetailScreen.tsx:552", "frontend/account/master/MasterDetailScreen.tsx:599", "frontend/account/master/MasterDetailScreen.tsx:629", "frontend/account/master/MasterDetailScreen.tsx:836", "backend/internal/application/process/master_detail.go:135", "backend/internal/application/process/master_detail.go:675", "backend/internal/application/process/master_detail_specs.go:144"]
---
# หน้าจอข้อมูลหลัก + ตารางย่อย (MasterDetailScreen)

จอสำหรับข้อมูลหลักที่มี "หัว + ตารางรายการย่อย" เช่น กลุ่มผู้ใช้กับสมาชิก สินค้ากับราคาซื้อ ผังบัญชีกับหน่วยงาน/แผนก
ผู้ใช้เลือกรายการทางซ้าย แก้ช่องหัวและตารางย่อยทางขวา แล้วกดบันทึกครั้งเดียว ระบบเขียนหัวและตารางย่อยในธุรกรรมเดียวผ่าน Go
จอเดียวรองรับหลายเมนู ต่างกันที่ config ใน `MASTER_DETAIL_CONFIGS` (จอ master ตารางเดียวดู [[scr-standard-master]]; ผังบัญชีดู [[scr-chart-of-accounts]])

## วิธีเปิด
`createMasterScreen(menuKey)` เลือก MasterDetailScreen เมื่อ config มี `detail` (`frontend/account/tabs/screenRegistry.tsx:152-166`); `MASTER_DETAIL_CONFIGS` ถูก spread รวมเข้า `IC_MASTER_CONFIGS` (`icMasterSchemas.ts:1416`)
เมนูที่อยู่ในต้นไม้เมนูและใช้จอนี้ 18 รายการ:

| รหัส | menu_key | โหมด | ตารางหัว | ตารางย่อย / หมายเหตุ | config |
|---|---|---|---|---|---|
| 1008 | `menu_setup_user_group` | header | `erp_user_group` | สมาชิก `erp_user_group_detail`; ผู้อนุมัติ po/ss/sr `erp_user_group_approve` | masterDetailSchemas.ts:1138 |
| 1009 | `menu_setup_user_group_warehouse_shelf` | header | `erp_user_group` | คลัง/ที่เก็บต่อหน้าจอ `erp_user_group_wh_shelf` | :1298 |
| 1081 | `menu_account_period` | table | `erp_account_period` | ตารางงวดบัญชี [[tbl-erp-account-period]] | :1570 |
| 1096 | `menu_view_manager_custom` | header | `erp_view_table_custom` | คอลัมน์ `erp_view_column_custom`; key = `screen_code` | :1609 |
| 2007 | `menu_ic_item_set` | item | `ic_inventory` (item_type=3) | ชุดสินค้า `ic_inventory_set_detail` | :337 |
| 2015 | `pos_promotion_formula` | header | `ic_promotion_formula` | เงื่อนไข, group_qty, ส่วนลด, action | :1669 |
| 2016 | `menu_setup_pos_slip_campaign` | header | `pos_slip_campaign` | รายการ/ยี่ห้อ/หมวด/กลุ่ม `pos_slip_campaign_*` | :1779 |
| 2025 | `menu_ic_purchase_price` | item | `ic_inventory` | ราคาซื้อทั่วไป+ตามเจ้าหนี้ `ic_inventory_purchase_price` | :394 |
| 2026 | `menu_ic_purchase_premium` | header | `ic_purchase_permium` | เงื่อนไข/ของแถม `ic_purchase_permium_condition` `_list` | :937 |
| 2029 | `menu_ic_discount` | item | `ic_inventory` | ส่วนลด 3 แท็บ `ic_inventory_discount` (ล้างส่วนลดของสินค้านี้) | :450 |
| 2030 | `menu_ic_item_formula_template` | table | `ic_price_formula_template` | แม่แบบสูตรราคา | :470 |
| 2031 | `menu_ic_item_saleprice_formula` | item | `ic_inventory` | สูตรราคา `ic_inventory_price_formula` | :503 |
| 2032 | `menu_ic_all_price` | item | `ic_inventory` | std_*, สูตร, บาร์โค้ด `ic_inventory_barcode` | :836 |
| 6009 | `menu_ar_point` | item | `ar_customer` | อ่านอย่างเดียว: ประวัติแต้มสะสม (SQL + ยอดสะสม) | :1079 |
| 8001 | `menu_asset_lists` | header | `as_asset` | ขาย + บำรุงรักษา [[tbl-as-asset]] | :532 |
| 8004 | `menu_asset_maintenance` | header | `as_asset_maintenance` | `as_asset_maintenance_detail`; key = `doc_no` | :616 |
| 9001 | `menu_chart_of_account` | header | `gl_chart_of_account` | 5 กริดเลือก — [[scr-chart-of-accounts]]; แถบเครื่องมือ [[scr-chart-of-accounts-tools]] | :688 |
| 9002 | `menu_chart_of_account_fast` | table | `gl_chart_of_account` | กริดบัญชี 20 คอลัมน์ — [[scr-chart-of-accounts]]; แถบเครื่องมือ [[scr-chart-of-accounts-tools]] | :747 |

คีย์อื่นที่เปิดเป็นจอนี้แต่ไม่อยู่ใน 18 รายการ: 2021 `menu_ic_warehouse_locaton` (item, `ic_inventory` + `ic_wh_shelf`, :1382) และ 2022 `ic_warehouse_and_location_group` (header, `ic_warehouse_location_group` scope `wh_code`, :790) ซึ่งลงทะเบียนใน `BASE_SCREENS` ด้วย `createMasterScreen` (ดู `frontend/account/tabs/screenRegistry.tsx:310-313,348-351`); config ที่ไม่มีโหนดในต้นไม้เมนู: `menu_ic_report_sort` (masterDetailSchemas.ts:900), `menu_sale_plan` (masterDetailSchemas.ts:1485)

## ช่องข้อมูลสำคัญและ validation
ชนิดช่อง `MdKind`: text, upper, number, int, date, lookup, select, check, display (`masterDetailSchemas.ts:6`); โครง config คือ `MasterDetailConfig` (`mode`, `list`, `keyKey`, `scopeKey`, `top`, `tabs`, `grids`, `stacked`, `canDelete`, `deleteLabel`, `autoRunningNo` — :55-75)
| ช่อง / ส่วน | ที่มา | ชนิด | กติกา | path:line |
|---|---|---|---|---|
| รหัสหลัก (`keyKey`) | หัวตาราง | text/upper | บังคับกรอก "กรุณาระบุรหัส" (ยกเว้นโหมด table); ยาวเกิน 25 ตัว → "รหัสยาวเกิน 25 ตัวอักษร"; แก้ได้เฉพาะตอนเพิ่มใหม่ (`keyField`) | MasterDetailScreen.tsx:561-564,657; master_detail.go:237-254 |
| ช่องหัวทั่วไป | `top` / `tabs[].blocks` | MdField | ชนิด `display` ไม่ถูกส่งไปบันทึก; `maxLength` ต่อช่อง | MasterDetailScreen.tsx:526,747 |
| ช่วงค่าตัวเลข/เลือก | หัวตาราง | select/check | นอกช่วงที่ spec กำหนด → "ค่า <ช่อง> ไม่ถูกต้อง" | master_detail.go:398-412 |
| ช่อง lookup | หัวและกริด | lookup | ตรวจว่ารหัสมีอยู่ในตารางที่อ้างด้วย `ref.msg` (หนึ่ง query ต่อคอลัมน์) | master_detail.go:535-605 |
| ตารางย่อย (`MdGrid`) | `grids` | กริดแถว | ไม่เกิน 500 แถวต่อกริด (`mdMaxRows`, spec กำหนด `maxRows` ทับได้) → "จำนวนแถวเกินกำหนด"; แถวว่างไม่ถูกส่ง | master_detail.go:25,338-345; MasterDetailScreen.tsx:547 |
| คอลัมน์บังคับในกริด | spec `required` | — | แถวไม่ครบ → "แถวที่ N: กรุณาระบุ<ชื่อ>" | master_detail.go:355-359 |
| กริดชนิดเลือก (`pick`) | `grids[].pick` | check-list | ส่งเฉพาะรหัสที่ติ๊ก | MasterDetailScreen.tsx:534-535,1072 |
| กริด `updateOnly` | `grids[].updateOnly` + `pkKey` | แก้เฉพาะแถวเดิม | ส่งเฉพาะแถวที่ `_dirty`; ถ้าไม่พบแถว → "ไม่พบรายการ" | MasterDetailScreen.tsx:388,545; master_detail.go:807-853 |
| เลขที่เอกสารอัตโนมัติ | `autoRunningNo` | checkbox | ใช้ในโหมด header ตอนเพิ่มใหม่ หลังบันทึกเลื่อนเลขถัดไป | MasterDetailScreen.tsx:582-588,1139-1141 |
| ตัวเลขเงิน/ปริมาณ | NumberBox | number | ใช้ `@/lib/numeric` (`addDec` `mulDec` `divDec` `cmpDec` `roundBc` `formatMoneyDisplay`); ยอดรวมใช้ `sumRound2` — ดู [[fe-numeric-money]] | MasterDetailScreen.tsx:98-137,649,664,775,1000 |

โหมด `item`: รหัสหลักคือ `ic_inventory.code` ของสินค้า; Go ตรวจก่อนเขียนว่า "ไม่พบสินค้า", ชนิดสินค้าตรงกับเมนู (2007 ต้อง item_type=3 — "สินค้า ... ไม่ใช่สินค้าชนิดที่เมนูนี้รองรับ") และสินค้าอนุญาตแก้ (`update_price` หรือ `update_detail` = 1) — master_detail.go:512-533
Go ตรวจรหัสหัวตาราง: โหมด `new` + รหัสมีอยู่ → "รหัส ... มีอยู่แล้ว", โหมด `edit` + ไม่พบ → "ไม่พบรายการ ..." — master_detail.go:298-336

## ปุ่ม / คีย์ลัด
- โหมดอ่าน: แก้ไข (ต้องเลือกรายการ + `canEdit`), เพิ่มใหม่ (เฉพาะโหมด header + `canAdd`), ลบ (เฉพาะ config `canDelete` + `canDelete`), ปิดหน้าจอ (เมื่อมี `onClose`) — MasterDetailScreen.tsx:1166-1187
- โหมดแก้ไข: บันทึก (กดได้เมื่อแก้ไขแล้วหรือเป็นรายการใหม่) และ "ปิดหน้าจอ" ซึ่งคือยกเลิกการแก้ไข (ถามยืนยันถ้ามีข้อมูลค้าง) — MasterDetailScreen.tsx:511-515,1155-1162
- Ctrl+S (หรือ Cmd+S) = บันทึก เมื่ออยู่ในโหมดแก้ไข ไม่กำลังบันทึก มีสิทธิ์ — MasterDetailScreen.tsx:626-635
- ไม่พบตัวดัก Esc และ F12 ในไฟล์นี้ (ความเห็นที่ :625 เอ่ยถึง F12 แต่ไม่มี handler รองรับ)
- เพิ่มแถวย่อย: จอเติมแถวว่างท้ายตารางให้เอง พิมพ์ในแถวสุดท้ายแล้วแถวใหม่จะเกิดต่อ หรือกด "+ เพิ่มแถว" — MasterDetailScreen.tsx:374-383,1008-1020; กริด `updateOnly` ไม่เติมแถวว่าง ยกเว้นกริดของ `menu_chart_of_account_fast` (9002) ที่เติม (:378,466)
- ลบแถวย่อย: ปุ่ม X ชื่อ "ลบแถว" ท้ายแถว; ปุ่มลูกศรย้ายแถวขึ้น/ลง (`RowMoveButtons`) — MasterDetailScreen.tsx:969-974
- กริดที่มี `fillAllSql`: ปุ่มดึงรายการทั้งหมด (ป้าย "All WareHouse and Shelf") และ "Clear" พร้อมยืนยัน — MasterDetailScreen.tsx:851-880
- แถบ "ข้ามไปยังส่วน:" เมื่อ config มีหลายแท็บ — MasterDetailScreen.tsx:1233
- เมนู 9001 และ 9002 แสดงแถบเครื่องมือผังบัญชี `ChartOfAccountToolsBar` เหนือเนื้อหา (นำเข้า/ส่งออก CSV, ชุดผังบัญชีสำเร็จรูป) — MasterDetailScreen.tsx:1198-1207; รายละเอียด [[scr-chart-of-accounts-tools]]
- รายการซ้ายคือ BcDataList (ค้นหา, ตัวกรองขั้นสูง, Insert เพิ่มใหม่เฉพาะโหมด header) — [[scr-data-list-and-lookup]]

## popup / modal ที่เรียกได้
- BcLookupModal: เปิดจากช่อง lookup ทั้งในหัวและกริด — MasterDetailScreen.tsx:1340
- BcDialog: ยืนยันลบ "ยืนยันการลบ" (`{deleteLabel ?? "ลบรายการ"}: <รหัส> ใช่หรือไม่?`), แจ้งเตือน "ลบไม่สำเร็จ" — MasterDetailScreen.tsx:604,610-621,1351
- ไม่มี modal เฉพาะนอกจากนี้

## API / process actions
- อ่านข้อมูล: ผ่าน `queryLimit` / `queryList` (รายการซ้าย 500 แถว, กริด `limit 2000`) — MasterDetailScreen.tsx:142-157,246-262
- บันทึก: `POST /api/process/master-detail/save` ส่ง `{menuKey,key,scope,mode,header,grids}` — MasterDetailScreen.tsx:567
- ลบ: `POST /api/process/master-detail/delete` ส่ง `{menuKey,key,scope}` ทีละรายการ — MasterDetailScreen.tsx:599-608
- Go ยอมรับเฉพาะเมนูใน whitelist `mdSpecs` (เมนูอื่น → "ไม่รู้จักเมนู ..."), มี timeout 30 วินาที, เป็นธุรกรรมเดียว — master_detail.go:135-175; master_detail_specs.go:144
- ลำดับเขียน (`write()`): หัวตาราง → ล้างตารางที่กำหนดใน `clear` (semantics แทนที่) → แต่ละกริด: `updatePK` ไม่ว่าง = UPDATE ตามคีย์, มิฉะนั้นเขียนแถวใหม่เรียงลำดับ line 1..n — master_detail.go:675-705
- ลบ: ตรวจ `uses` ตามลำดับ → "ไม่อนุญาตให้ลบ <รหัส>: <ข้อความ>" แล้วลบตารางย่อยและหัวตาราง; โหมด item ล้างเฉพาะแถวย่อยของสินค้านั้น ไม่ลบ `ic_inventory` — master_detail.go:177-235
- route/สิทธิ์: `backend/internal/adapter/inbound/http/process/master_detail_handler.go`, `backend/internal/adapter/inbound/http/process/permission.go:42,47`, `backend/internal/adapter/inbound/http/router.go:154,195`

## ตารางที่ข้อมูลลงไป
ตามคอลัมน์ "ตารางหัว" และ "ตารางย่อย" ด้านบน ตัวอย่างที่มีโน้ตตาราง: [[tbl-gl-chart-of-account]], [[tbl-erp-account-period]], [[tbl-as-asset]]
ตารางที่ Go เขียนต้องอยู่ใน `mdSpecs` เท่านั้น (ชื่อตาราง/คอลัมน์ไม่รับจากหน้าเว็บ)

## ข้อควรระวัง
- ปุ่ม "ปิดหน้าจอ" ในโหมดแก้ไขคือยกเลิกการแก้ไข ไม่ได้ปิดแท็บ — MasterDetailScreen.tsx:511-515,1159-1162
- รายการซ้ายโหลดสูงสุด 500 แถว (`queryLimit(sql, 500, 0, true)`) และกริดโหลดสูงสุด 2000 แถว — MasterDetailScreen.tsx:252,142-157
- ปุ่ม "เพิ่มใหม่" มีเฉพาะโหมด header; โหมด item ต้องเลือกสินค้าที่มีอยู่แล้วแล้วกดแก้ไข (รหัสคือสินค้า) ส่วนโหมด table (เช่น 9002, 1081) เลือกรายการ `*` ไว้ให้ และโหลดตารางทั้งชุดทันทีตอนเปิดจอ — MasterDetailScreen.tsx:181,262-285,347-349,1170
- กริดชนิดแทนที่ (replace) จะล้างแล้วเขียนใหม่ทั้งชุดเมื่อบันทึก; แถวที่ไม่ได้ส่งจะหายไป — master_detail.go:675-705
- Go whitelist มี `menu_ic_item_saleprice` และ `menu_ic_item_saleprice_2` ที่ไม่พบ config ใน `masterDetailSchemas.ts`; ส่วน 6009 `menu_ar_point` มี config แต่ไม่มี spec ใน Go (เป็นจออ่านอย่างเดียว) — master_detail_specs.go:168-169; masterDetailSchemas.ts:1079
- ข้อความ "บันทึกล่าสุด <เวลา>" และสถานะ "มีการแก้ไขข้อมูล" แสดงในแถบหัวจอ ใช้ตรวจว่าบันทึกสำเร็จ — MasterDetailScreen.tsx:1137-1138
- หน้าต่างช่วยเหลือคีย์ลัดของรายการซ้าย (`BcShortcutsModal`, เปิดจาก `BcDataList`) อ้างว่า Escape ยกเลิกโหมดแก้ไข แต่ `MasterDetailScreen` ไม่มีตัวดัก Esc — BcShortcutsModal.tsx:25

## ที่มาในโค้ด
- `frontend/account/tabs/screenRegistry.tsx:152-166` — เลือกจอตาม `config.detail`
- `frontend/src/config/schemas/masterDetailSchemas.ts:6-126` — ชนิดและโครง config; `:335` เริ่ม `MASTER_DETAIL_CONFIGS`
- `frontend/account/master/MasterDetailScreen.tsx:523-621` — buildPayload, handleSave, ลบ
- `frontend/account/master/MasterDetailScreen.tsx:626-635,836-1100` — Ctrl+S, renderGrid, renderPick
- `frontend/account/master/MasterDetailScreen.tsx:1286-1360` — ResizableSplit + BcDataList + modal
- `backend/internal/application/process/master_detail.go:135-254,298-363,512-605,675-853` — engine
- `backend/internal/application/process/master_detail_specs.go:144-531` — whitelist `mdSpecs`
- `frontend/account/master/BcShortcutsModal.tsx:25` — ข้อความช่วยเหลือ Escape
- ลิงก์ดูเพิ่ม: [[scr-standard-master]] [[scr-chart-of-accounts]] [[scr-chart-of-accounts-tools]] [[scr-data-list-and-lookup]] [[fe-master-screens]] [[fe-numeric-money]] [[screens-overview]]
