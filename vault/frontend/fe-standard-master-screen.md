---
title: "จอข้อมูลหลักมาตรฐานและจอ master-detail (StandardMasterScreen / MasterDetailScreen)"
tags: [frontend, master, crud, master-detail, screen]
aliases: ["StandardMasterScreen", "MasterDetailScreen", "จอบันทึกแก้ไขข้อมูลหลัก", "master detail", "MASTER_DETAIL_CONFIGS", "ScreenFrame", "masterAutoCode", "รันรหัสลูกหนี้อัตโนมัติ", "useMasterCodeLeave", "ResizableSplit รายการซ้าย"]
sources: ["frontend/account/master/StandardMasterScreen.tsx:63", "frontend/account/master/StandardMasterScreen.tsx:513", "frontend/account/master/StandardMasterScreen.tsx:724", "frontend/account/master/MasterDetailScreen.tsx:157", "frontend/account/master/MasterDetailScreen.tsx:554", "frontend/account/master/masterAutoCode.ts:5", "frontend/account/master/ScreenFrame.tsx:5", "frontend/src/config/schemas/masterDetailSchemas.ts:81", "frontend/src/config/schemas/masterDetailSchemas.ts:334"]
---

# จอข้อมูลหลักมาตรฐานและจอ master-detail

จอ "ข้อมูลหลัก" แบ่งเป็น 3 แบบ: (1) `StandardMasterScreen` ตารางเดียว รหัส+ชื่อ+ช่องเสริม วาดจาก config ([[fe-master-screens]]); (2) `MasterDetailScreen` หัว+ตารางย่อยหลายตาราง วาดจาก `MASTER_DETAIL_CONFIGS`; (3) จอเขียนมือเฉพาะเรื่อง (ลูกหนี้ เจ้าหนี้ สินค้า ฯลฯ) ในโฟลเดอร์ `account/master/`
ทั้งสามแบบหน้าตาเดียวกัน: รายการซ้าย (`ResizableSplit` + `BcDataList` [[fe-grid-component]]) และฟอร์มขวา

## ทำงานอย่างไร

**`StandardMasterScreen`** (`StandardMasterScreen.tsx`, 1,806 บรรทัด; prop `config: MasterScreenConfig`)
- **โหลดรายการ** (บรรทัด 268-348): ประกอบ `select * from <tableName> where <ค้นหา> and <fixedValues> and <parentFilter> order by <idKey>` แล้ว `queryLimit(sql, 500, 0, true)`; ค้นหาด้วย `buildBcSearchWhere` บน `idKey, nameKey, name_2` ([[fe-query-client-sql-builder]]). ถ้า `parentFilter.required` และยังไม่เลือกกลุ่มแม่ รายการว่างและปิดการแก้ไข. โหลดเสร็จเลือกแถวแรกอัตโนมัติ (ยกเว้นผู้ใช้กด "เพิ่มใหม่" ระหว่างรอ - กันด้วย `newSeq`/`loadSeq`).
- **บันทึก** `handleSave` (513-695): ตรวจ `canSaveWithRights` ([[fe-tabs-workspace]]) -> ต้องมีรหัสและชื่อ -> (ใหม่) ตรวจรหัสซ้ำด้วย `select count(*)` ตาม `fixedValues`/`parentFilter` (ข้ามเมื่อมี `rowKey`) -> `insert` หรือ `update ... where <keyCol> = ...` ผ่าน `queryExec`. ค่าช่องเสริมแปลงด้วย `extraFieldSql` (บรรทัด 185: number/calc -> `sqlDecimal`, date ว่าง -> `null`, select/radio/checkbox -> เลข, lookup ตัดส่วนหลัง `~`).
- **ลบ** `handleDelete` (724): `findFkUse` ไล่ `config.fkChecks` นับการใช้งานก่อน ถ้ามีใช้ -> dialog "ไม่อนุญาตให้ลบ"; ผ่านแล้วจึงถามยืนยัน ([[fe-master-screens]]).
- **ลัด**: `Ctrl+S` บันทึก เฉพาะแท็บที่มองเห็น (`rootRef.offsetParent`, บรรทัด 898-909). ปิดจอที่มีข้อมูลค้างจะถามก่อน (`isDirty`, บรรทัด 775).
- **กรณีพิเศษที่ฝังในไฟล์ตาม `menuKey`/ตาราง**: `menu_setup_bank` มี "นำเข้าธนาคารไทย" ผ่าน `ThaiBankDirectoryModal` / `handleImportThaiBanks` (826-880, `queryExecBatch`); `menu_setup_qr_payment` (1615); `menu_ic_item_serial` แสดงประวัติ serial จาก `ic_trans_serial_number` (106-135, 1669); ตาราง `ic_trans` (เอกสารแต้ม) บันทึกผ่าน `POST /api/process/stocktools/pointdocsave` (`isPointDoc`, 510-560) และลบผ่าน `pointdocdelete`; ที่อยู่จัดส่ง (1183-1195) มีปุ่มพิเศษ.

**`MasterDetailScreen`** (`MasterDetailScreen.tsx`, 1,301 บรรทัด; ต้องมี `config.detail` ไม่งั้น throw, บรรทัด 157-158)
- รูปแบบกำหนดใน `MasterDetailConfig` (`masterDetailSchemas.ts:81-105`): `mode` = `item` (เลือกสินค้าจากรายการแล้วแก้รายละเอียด), `header` (หัวเอกสาร + ตารางย่อย มีรหัสหลัก/`scopeKey`/`autoRunningNo`), `table` (ตารางเดียวไม่มีรายการ); `list`, `top[]` (บล็อกช่องด้านบน), `tabs[]` (ป้ายแท็บ -> บล็อก/ตาราง), `grids[]` (`MdGrid`; คอลัมน์ `MdCol` ชนิด text/upper/number/int/date/lookup/select/check/display; มี `readOnly`, `updateOnly`, `single`, `pick`, `newRow`), `stacked`, `canDelete`.
- **อ่าน** ผ่าน `queryList` (SELECT ตาม config ต่อ grid `limit 2000`, บรรทัด 150-155) และรายการ `queryLimit(sql,500,...)` (250).
- **เขียน/ลบผ่าน backend**: `POST /api/process/master-detail/save` ส่ง `{menuKey, key, scope, mode:"new"|"edit", header, grids}` (บรรทัด 565-572) และ `/master-detail/delete` `{menuKey,key,scope}` (600); ชื่อ key/คอลัมน์ใน config ต้องตรง whitelist ฝั่ง Go (คอมเมนต์หัว `masterDetailSchemas.ts:2`). ไฟล์หัวระบุว่าบันทึก/ลบ atomic ผ่าน Go (`MasterDetailScreen.tsx:4`). บันทึกใหม่กับ `autoRunningNo` แล้วขึ้นเลขถัดไปให้ทันที (580-587). ค่าเริ่มต้นค่าเสื่อมราคาเรียก `/api/process/master/assetdepdefaults`.
- เงินที่แสดงในจอนี้คำนวณด้วย bigint (`toScaled`, `mulRound2`, `sumRound2`, `masterDetailSchemas.ts:108-126`) - ตัวเลขจริง backend คำนวณ ([[fe-numeric-money]]).

**รายการจอ master-detail (`MASTER_DETAIL_CONFIGS`, 24 รายการ)**
| menu key | ชื่อจอ | ตารางหลัก | บรรทัด |
|---|---|---|---|
| `menu_ic_item_set` | สินค้าชุด | `ic_inventory` | 336 |
| `menu_ic_purchase_price` | กำหนดราคาซื้อ | `ic_inventory` | 393 |
| `menu_ic_item_saleprice` | กำหนดราคาขายมาตรฐาน | `ic_inventory` | 445 |
| `menu_ic_item_saleprice_2` | กำหนดราคาขายทั่วไป | `ic_inventory` | 446 |
| `menu_ic_discount` | กำหนดส่วนลดสินค้า | `ic_inventory` | 449 |
| `menu_ic_item_formula_template` | กำหนดรูปแบบสูตรราคาขาย | `ic_price_formula_template` | 469 |
| `menu_ic_item_saleprice_formula` | กำหนดสูตรราคาขาย | `ic_inventory` | 506 |
| `menu_asset_lists` | ข้อมูลสินทรัพย์ | `as_asset` | 535 |
| `menu_asset_maintenance` | บันทึกการซ่อมบำรุงสินทรัพย์ | `as_asset_maintenance` | 619 |
| `menu_chart_of_account` | รายละเอียดผังบัญชี | `gl_chart_of_account` | 691 |
| `menu_chart_of_account_fast` | ปรับปรุงผังบัญชีแบบเร็ว | `gl_chart_of_account` | 740 |
| `ic_warehouse_and_location_group` | กำหนดกลุ่มที่เก็บ | `ic_warehouse_location_group` | 783 |
| `menu_ic_all_price` | ราคาขายสินค้า | `ic_inventory` | 829 |
| `menu_ic_report_sort` | กำหนดการเรียงข้อมูลรายงาน | `ic_report_sort_item` | 893 |
| `menu_ic_purchase_premium` | ของแถมซื้อ | `ic_purchase_permium` | 930 |
| `menu_ar_point` | แต้มสะสม | `ar_customer` | 1072 |
| `menu_setup_user_group` | กำหนดกลุ่มพนักงาน | `erp_user_group` | 1131 |
| `menu_setup_user_group_warehouse_shelf` | กำหนดการใช้คลังและที่เก็บ | `erp_user_group` | 1291 |
| `menu_ic_warehouse_locaton` | คลังที่เก็บสินค้า | `ic_inventory` | 1375 |
| `menu_sale_plan` | กำหนดแผนการขาย | `erp_sale_plan` | 1478 |
| `menu_account_period` | กำหนดงวดบัญชี | `erp_account_period` | 1563 |
| `menu_view_manager_custom` | กำหนดรูปแบบการค้นหาข้อมูล | `erp_view_table_custom` | 1602 |
| `pos_promotion_formula` | กำหนดสูตรโปรโมชั่น | `ic_promotion_formula` | 1660 |
| `menu_setup_pos_slip_campaign` | กำหนดแคมเปญท้ายใบเสร็จ | `pos_slip_campaign` | 1772 |

**จอเขียนมือใน `account/master/`** - endpoint ที่แต่ละไฟล์เรียกจริง (ได้จาก grep)
| ไฟล์ | เรียก |
|---|---|
| `CustomerScreen`, `SupplierScreen`, `DealerScreen` | `queryList/queryLimit/queryExecBatch`; ลูกหนี้/เจ้าหนี้ใช้ `masterAutoCode` |
| `CustomerDetailScreen`, `SupplierDetailScreen` | + `queryExec`, `POST /api/crm/upload` (อัปโหลดไฟล์; ระบบ crm อยู่นอกขอบเขตโน้ตนี้ ยังไม่ได้อ่าน) |
| `ItemScreen` | `/api/process/itemmaster/save`, `/barcode/ean`, `itemMasterDelete`, `itemNextCode`, `/api/crm/upload` |
| `ItemDetail2Screen` | `/api/process/itemdetail/get\|save`, `itempicture/get\|image` |
| `ItemPictureScreen`, `DocumentPictureScreen` | `itempicture/list\|get\|save\|image`, `docpicture/formats\|docs\|get\|save\|image` |
| `BarcodeScreens`, `BarcodePrintScreen`, `BarcodeDiscountScreens` | `/api/process/barcode/item\|save\|ean\|format\|print-items\|discount-load\|discount-save` |
| `LotAdjustScreens`, `HiddenCostScreen`, `SerialStockCountScreen`, `StockCheckScreens`, `StockToolBits` | `/api/process/stocktools/*` (lotautolist/run/check, lotamountload/save, hiddencostcalc/save/delete, serialscan/countsave, barcodecheck, serialanalyze, formats) |
| `ModifyPriceScreen` | `/api/process/modifyprice/*` |
| `DocFormatScreen` | `/api/process/gl/template-defaults` + `queryExecBatch` (มี `fkChecks` ของตัวเอง บรรทัด 735) |
| `ProvinceTreeScreen` | `/api/process/workflow/province-list\|province-load` + `queryExecBatch` |
| `EmployeeScreen`, `UnitScreen`, `WarehouseScreen`, `TransportLabelPrintScreen` | `queryList/queryLimit/queryExec` ตรงๆ |

**`masterAutoCode.ts`**: `masterNextCode(kind)` (บรรทัด 33) เรียก `POST /api/process/master/nextcode` ได้รหัส "สูงสุด+1" ของ `customer`/`supplier` (ตามคอมเมนต์ C# `_getAutoRun`); `useMasterCodeLeave` (51) เรียก `codeleave` เมื่อออกจากช่องรหัสเพื่อตรวจ/เติมรหัสที่พิมพ์เอง; `duplicateCodeDialog` (109) แสดง dialog รหัสซ้ำ. ใช้ใน 4 จอลูกหนี้/เจ้าหนี้. error ประเภท `NETWORK|UNAUTHORIZED|SESSION_EXPIRED|FORBIDDEN` ไม่แสดง (บรรทัด 15).

**`ScreenFrame.tsx`**: กรอบจอมาตรฐาน "หัว 2 แถว" (แถบชื่อ + toolbar ซ้าย / เลขเมนู + ชื่อจอขวา) และ `useShortcuts(onSave,onCancel,enabled)` (F12/Ctrl+S = บันทึก, Escape = ยกเลิก; ประกาศบรรทัด 37). ใช้โดย `BarcodeDiscountScreens, DocumentPictureScreen, HiddenCostScreen, ItemDetail2Screen, ItemPictureScreen, LotAdjustScreens, ModifyPriceScreen, SerialStockCountScreen, StockCheckScreens` และ `transaction/AssetSaleScreen`.

**ข้อควรระวัง**
- `StandardMasterScreen` เขียนด้วย SQL ที่เบราว์เซอร์ประกอบ (`insert/update/delete`) ไม่ผ่าน process endpoint; `MasterDetailScreen` ต่างกันตรงเขียนผ่าน backend.
- รหัสซ้ำตรวจก่อน insert ด้วย SELECT แยก - สองผู้ใช้อาจชนกันได้ (ยังไม่ยืนยันว่ามี unique constraint ที่ DB).
- แท็บที่ซ่อนยัง mount อยู่ จึงต้องเช็ก `offsetParent` ก่อนรับ `Ctrl+S` ([[fe-tabs-workspace]]).

## ที่มาในโค้ด
- `frontend/account/master/StandardMasterScreen.tsx:63-200,268-348` - สถานะ, SQL ตัวกรอง, โหลดรายการ
- `frontend/account/master/StandardMasterScreen.tsx:513-695,699-770` - บันทึก, `findFkUse`, ลบ
- `frontend/account/master/MasterDetailScreen.tsx:150-215,554-620` - SELECT ต่อ grid, บันทึก/ลบผ่าน `/master-detail/*`
- `frontend/src/config/schemas/masterDetailSchemas.ts:6-105,334-1918` - ชนิด `Md*` และ config
- `frontend/account/master/masterAutoCode.ts:5-129` - รันรหัสอัตโนมัติ
- `frontend/account/master/ScreenFrame.tsx:5-59` - กรอบจอ + ช็อตคัต

## ดูเพิ่ม
[[frontend-overview]] · [[fe-master-screens]] · [[fe-grid-component]] · [[fe-form-engine]] · [[fe-screen-registry-menu]] · [[fe-tabs-workspace]] · [[fe-api-proxy-routes]]
