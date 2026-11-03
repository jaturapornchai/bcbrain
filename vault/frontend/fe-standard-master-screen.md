---
title: "จอข้อมูลหลักมาตรฐานและจอ master-detail (StandardMasterScreen / MasterDetailScreen)"
tags: [frontend, master, crud, master-detail, screen]
aliases: ["StandardMasterScreen", "MasterDetailScreen", "จอบันทึกแก้ไขข้อมูลหลัก", "master detail", "MASTER_DETAIL_CONFIGS", "ScreenFrame", "masterAutoCode", "รันรหัสลูกหนี้อัตโนมัติ", "useMasterCodeLeave", "ResizableSplit รายการซ้าย"]
sources: ["frontend/account/master/StandardMasterScreen.tsx:63", "frontend/account/master/StandardMasterScreen.tsx:513", "frontend/account/master/StandardMasterScreen.tsx:724", "frontend/account/master/MasterDetailScreen.tsx:160", "frontend/account/master/MasterDetailScreen.tsx:552", "frontend/account/master/masterAutoCode.ts:5", "frontend/account/master/ScreenFrame.tsx:6", "frontend/src/config/schemas/masterDetailSchemas.ts:81", "frontend/src/config/schemas/masterDetailSchemas.ts:335"]
---

# จอข้อมูลหลักมาตรฐานและจอ master-detail

จอ "ข้อมูลหลัก" แบ่งเป็น 3 แบบ: (1) `StandardMasterScreen` ตารางเดียว รหัส+ชื่อ+ช่องเสริม วาดจาก config ([[fe-master-screens]]); (2) `MasterDetailScreen` หัว+ตารางย่อยหลายตาราง วาดจาก `MASTER_DETAIL_CONFIGS`; (3) จอเขียนมือเฉพาะเรื่อง (ลูกหนี้ เจ้าหนี้ สินค้า ฯลฯ) ในโฟลเดอร์ `account/master/`
ทั้งสามแบบหน้าตาเดียวกัน: รายการซ้าย (`ResizableSplit` + `BcDataList` [[fe-grid-component]]) และฟอร์มขวา

## ทำงานอย่างไร

**`StandardMasterScreen`** (`StandardMasterScreen.tsx:63`, 1,806 บรรทัด; prop `config: MasterScreenConfig`)
- **โหลดรายการ** (บรรทัด 268-348): ประกอบ `select * from <tableName> where <ค้นหา> and <fixedValues> and <parentFilter> order by <idKey>` แล้ว `queryLimit(sql, 500, 0, true)`; ค้นหาด้วย `buildBcSearchWhere` บน `idKey, nameKey, name_2` ([[fe-query-client-sql-builder]]). ถ้า `parentFilter.required` และยังไม่เลือกกลุ่มแม่ รายการว่างและปิดการแก้ไข. โหลดเสร็จเลือกแถวแรกอัตโนมัติ (ยกเว้นผู้ใช้กด "เพิ่มใหม่" ระหว่างรอ - กันด้วย `newSeq`/`loadSeq`).
- **บันทึก** `handleSave` (513-696): ตรวจ `canSaveWithRights` ([[fe-tabs-workspace]]) -> ต้องมีรหัสและชื่อ -> (ใหม่) ตรวจรหัสซ้ำด้วย `select count(*)` ตาม `fixedValues`/`parentFilter` (591-602; ข้ามเมื่อมี `rowKey`) -> `insert` หรือ `update ... where <keyCol> = ...` ผ่าน `queryExec`. ค่าช่องเสริมแปลงด้วย `extraFieldSql` (บรรทัด 185: number/calc -> `sqlDecimal`, date ว่าง -> `null`, select/radio/checkbox -> เลข, lookup ตัดส่วนหลัง `~`).
- **ลบ** `handleDelete` (724): `findFkUse` (698-722) ไล่ `config.fkChecks` นับการใช้งานก่อน ถ้ามีใช้ -> dialog "ไม่อนุญาตให้ลบ"; ผ่านแล้วจึงถามยืนยัน ([[fe-master-screens]]).
- **ลัด**: `Ctrl+S` บันทึก เฉพาะแท็บที่มองเห็น (`rootRef.offsetParent`, บรรทัด 898-909). ปิดจอที่มีข้อมูลค้างจะถามก่อน (`isDirty`, บรรทัด 775).
- **กรณีพิเศษที่ฝังในไฟล์ตาม `menuKey`/ตาราง**: `menu_setup_bank` มีปุ่ม "ดึงธนาคาร" (`btn-pull-thai-banks`, 1125-1135) เปิด `ThaiBankDirectoryModal` (1794-1802) เพื่อนำเข้าธนาคารไทยด้วย `handleImportThaiBanks` (826-880, `queryExecBatch` 856); `menu_setup_qr_payment` มีแท็บ "QR Display" ลองสร้าง QR ทดสอบจากยอดที่กรอก (1615-1665); `menu_ic_item_serial` แสดงประวัติ serial จาก `ic_trans_serial_number` (105-136, 1669); ตาราง `ic_trans` (เอกสารแต้ม) บันทึกผ่าน `POST /api/process/stocktools/pointdocsave` (`isPointDoc`, 510-511, 549-560) และลบผ่าน `pointdocdelete` (757-758); `menu_ap_transport_label` / `menu_ar_transport_label` มีปุ่ม "พิมพ์ป้ายชื่อ" เปิดจอ `..._print` ของตัวเอง (1183-1198); จอที่มีคอลัมน์ `latitude`/`lat` แสดงแผนที่พิกัด (1557-).

**`MasterDetailScreen`** (`MasterDetailScreen.tsx`, 1,364 บรรทัด; ต้องมี `config.detail` ไม่งั้น throw, บรรทัด 159-160)
- รูปแบบกำหนดใน `MasterDetailConfig` (`masterDetailSchemas.ts:81-103`): `mode` = `item` (เลือกสินค้าจากรายการแล้วแก้รายละเอียด), `header` (หัวเอกสาร + ตารางย่อย มีรหัสหลัก/`scopeKey`/`autoRunningNo`), `table` (ตารางเดียวไม่มีรายการ); `list`, `top[]` (บล็อกช่องด้านบน), `tabs[]` (ป้ายแท็บ -> บล็อก/ตาราง), `grids[]` (`MdGrid`; คอลัมน์ `MdCol` ชนิด text/upper/number/int/date/lookup/select/check/display; มี `readOnly`, `updateOnly`, `single`, `pick`, `newRow`), `stacked`, `canDelete`.
- **อ่าน** ผ่าน `queryList` (SELECT ตาม config ต่อ grid `limit 2000`, `gridSql` ใน `MasterDetailScreen.tsx:142-157`) และรายการ `queryLimit(sql,500,...)` (252).
- **เขียน/ลบผ่าน backend**: `POST /api/process/master-detail/save` ส่ง `{menuKey, key, scope, mode:"new"|"edit", header, grids}` (บรรทัด 567-574) และ `/master-detail/delete` `{menuKey,key,scope}` (602); ชื่อ key/คอลัมน์ใน config ต้องตรง whitelist ฝั่ง Go (คอมเมนต์ `masterDetailSchemas.ts:2` ชี้ไป `backend/internal/application/process/master_detail_specs.go`). ไฟล์หัวระบุว่าบันทึก/ลบ atomic ผ่าน Go (`MasterDetailScreen.tsx:4`). บันทึกใหม่กับ `autoRunningNo` แล้วขึ้นเลขถัดไปให้ทันที (582-588). ค่าเริ่มต้นค่าเสื่อมราคาเรียก `/api/process/master/assetdepdefaults` (406).
- เงินที่แสดงในจอนี้คำนวณด้วย bigint (`toScaled`, `mulRound2`, `sumRound2`, `masterDetailSchemas.ts:108-126`) - ตัวเลขจริง backend คำนวณ ([[fe-numeric-money]]).

**รายการจอ master-detail (`MASTER_DETAIL_CONFIGS`, 24 รายการ)**
| menu key | ชื่อจอ | ตารางหลัก | บรรทัด |
|---|---|---|---|
| `menu_ic_item_set` | สินค้าชุด | `ic_inventory` | 337 |
| `menu_ic_purchase_price` | กำหนดราคาซื้อ | `ic_inventory` | 394 |
| `menu_ic_item_saleprice` | กำหนดราคาขายมาตรฐาน | `ic_inventory` | 446 |
| `menu_ic_item_saleprice_2` | กำหนดราคาขายทั่วไป | `ic_inventory` | 447 |
| `menu_ic_discount` | กำหนดส่วนลดสินค้า | `ic_inventory` | 450 |
| `menu_ic_item_formula_template` | กำหนดรูปแบบสูตรราคาขาย | `ic_price_formula_template` | 470 |
| `menu_ic_item_saleprice_formula` | กำหนดสูตรราคาขาย | `ic_inventory` | 503 |
| `menu_asset_lists` | ข้อมูลสินทรัพย์ | `as_asset` | 532 |
| `menu_asset_maintenance` | บันทึกการซ่อมบำรุงสินทรัพย์ | `as_asset_maintenance` | 616 |
| `menu_chart_of_account` | รายละเอียดผังบัญชี | `gl_chart_of_account` | 688 |
| `menu_chart_of_account_fast` | ปรับปรุงผังบัญชีแบบเร็ว | `gl_chart_of_account` | 747 |
| `ic_warehouse_and_location_group` | กำหนดกลุ่มที่เก็บ | `ic_warehouse_location_group` | 790 |
| `menu_ic_all_price` | ราคาขายสินค้า | `ic_inventory` | 836 |
| `menu_ic_report_sort` | กำหนดการเรียงข้อมูลรายงาน | `ic_report_sort_item` | 900 |
| `menu_ic_purchase_premium` | ของแถมซื้อ | `ic_purchase_permium` | 937 |
| `menu_ar_point` | แต้มสะสม | `ar_customer` | 1079 |
| `menu_setup_user_group` | กำหนดกลุ่มพนักงาน | `erp_user_group` | 1138 |
| `menu_setup_user_group_warehouse_shelf` | กำหนดการใช้คลังและที่เก็บ | `erp_user_group` | 1298 |
| `menu_ic_warehouse_locaton` | คลังที่เก็บสินค้า | `ic_inventory` | 1382 |
| `menu_sale_plan` | กำหนดแผนการขาย | `erp_sale_plan` | 1485 |
| `menu_account_period` | กำหนดงวดบัญชี | `erp_account_period` | 1570 |
| `menu_view_manager_custom` | กำหนดรูปแบบการค้นหาข้อมูล | `erp_view_table_custom` | 1609 |
| `pos_promotion_formula` | กำหนดสูตรโปรโมชั่น | `ic_promotion_formula` | 1669 |
| `menu_setup_pos_slip_campaign` | กำหนดแคมเปญท้ายใบเสร็จ | `pos_slip_campaign` | 1779 |

**จอเขียนมือใน `account/master/`** - endpoint ที่แต่ละไฟล์เรียกจริง (ได้จาก grep)
| ไฟล์ | เรียก |
|---|---|
| `CustomerScreen`, `SupplierScreen`, `DealerScreen` | `queryList/queryLimit/queryExecBatch`; ลูกหนี้/เจ้าหนี้ใช้ `masterAutoCode` |
| `CustomerDetailScreen`, `SupplierDetailScreen` | + `queryExec`, `POST /api/crm/upload` (อัปโหลดไฟล์; ระบบ crm อยู่นอกขอบเขตโน้ตนี้ ยังไม่ได้อ่าน) |
| `ItemScreen` | `itemMasterSave` (`/api/process/itemmaster/save`), `/api/process/barcode/ean13-generate`, `itemMasterDelete`, `itemNextCode`, `/api/crm/upload` |
| `ItemDetail2Screen` | `/api/process/itemdetail/get\|save`, `itempicture/get\|image` |
| `ItemPictureScreen`, `DocumentPictureScreen` | `itempicture/list\|get\|save\|image`, `docpicture/formats\|docs\|get\|save\|image` |
| `BarcodeScreens` | `/api/process/barcode/item\|save\|ean13-generate\|ean13-check\|ean13-apply` |
| `BarcodePrintScreen` | `/api/process/barcode/format\|print-items` |
| `BarcodeDiscountScreens` | `/api/process/barcode/discount-load\|discount-save` |
| `LotAdjustScreens`, `HiddenCostScreen`, `SerialStockCountScreen`, `StockCheckScreens`, `StockToolBits` | `/api/process/stocktools/*` (lotautolist/lotautorun/lotautocheck, lotamountload/lotamountsave, notcountedlist/notcountedrun, hiddencostcalc/hiddencostsave/hiddencostdelete, serialscan/serialcountsave, barcodecheck, serialanalyze, formats) |
| `ModifyPriceScreen` | `/api/process/modifyprice/*` |
| `DocFormatScreen` | `/api/process/gl/template-defaults` + `queryExecBatch` (มี `fkChecks` ของตัวเอง บรรทัด 735 ใน `DocFormatScreen.tsx`) |
| `ProvinceTreeScreen` | `/api/process/workflow/province-list\|province-load` + `queryExecBatch` |
| `EmployeeScreen`, `UnitScreen`, `WarehouseScreen` | `queryList/queryLimit/queryExec` ตรงๆ |
| `TransportLabelPrintScreen` | `queryList/queryLimit` (อ่านอย่างเดียว) |

**`masterAutoCode.ts`**: `masterNextCode(kind)` (บรรทัด 33) เรียก `POST /api/process/master/nextcode` ได้รหัสสูงสุด (เรียง `code` มากไปน้อย) + 1 ของ `customer` (`ar_customer`) / `supplier` (`ap_supplier`) (`backend/internal/application/process/master_autorun.go:64-80`); `useMasterCodeLeave` (51) เรียก `codeleave` เมื่อออกจากช่องรหัสเพื่อตรวจ/เติมรหัสที่พิมพ์เอง; `duplicateCodeDialog` (109) แสดง dialog รหัสซ้ำ. ใช้ใน 4 จอลูกหนี้/เจ้าหนี้. error ประเภท `NETWORK|UNAUTHORIZED|SESSION_EXPIRED|FORBIDDEN` ไม่แสดง (`SILENT_ERRORS` บรรทัด 18).

**`ScreenFrame.tsx`**: กรอบจอมาตรฐานหัว 2 แถว (แถบ `header.card-head` บรรทัด 18-21; แถวที่สอง toolbar ซ้าย / เลขเมนู + ชื่อจอขวา บรรทัด 22-30) และ `useShortcuts(onSave,onCancel,enabled)` (บรรทัด 37-59; โค้ดจับ `Ctrl+S` = บันทึก และ `Escape` = ยกเลิก บรรทัด 47-53 เฉพาะแท็บที่มองเห็น). ใช้โดย `BarcodeDiscountScreens, DocumentPictureScreen, HiddenCostScreen, ItemDetail2Screen, ItemPictureScreen, LotAdjustScreens, ModifyPriceScreen, SerialStockCountScreen, StockCheckScreens` และ `transaction/AssetSaleScreen`.

**ข้อควรระวัง**
- `StandardMasterScreen` เขียนด้วย SQL ที่เบราว์เซอร์ประกอบ (`insert/update/delete`) ไม่ผ่าน process endpoint; `MasterDetailScreen` ต่างกันตรงเขียนผ่าน backend.
- รหัสซ้ำตรวจก่อน insert ด้วย SELECT แยก - สองผู้ใช้อาจชนกันได้ (ยังไม่ยืนยันว่ามี unique constraint ที่ DB).
- แท็บที่ซ่อนยัง mount อยู่ จึงต้องเช็ก `offsetParent` ก่อนรับ `Ctrl+S` ([[fe-tabs-workspace]]).

## ที่มาในโค้ด
- `frontend/account/master/StandardMasterScreen.tsx:63-200,268-348` - สถานะ, SQL ตัวกรอง, โหลดรายการ
- `frontend/account/master/StandardMasterScreen.tsx:513-696,698-770,826-880,898-909` - บันทึก, `findFkUse`, ลบ, นำเข้าธนาคาร, Ctrl+S
- `frontend/account/master/MasterDetailScreen.tsx:142-160,246-253,552-609` - SELECT ต่อ grid, รายการ, บันทึก/ลบผ่าน `/master-detail/*`
- `frontend/src/config/schemas/masterDetailSchemas.ts:6-126,335-1925` - ชนิด `Md*`, ตัวเลขแบบ bigint และ config
- `frontend/account/master/masterAutoCode.ts:5-129` - รันรหัสอัตโนมัติ
- `frontend/account/master/ScreenFrame.tsx:6-59` - กรอบจอ + ช็อตคัต
- `backend/internal/application/process/master_autorun.go:64-80` - รหัสถัดไปของลูกหนี้/เจ้าหนี้

## ดูเพิ่ม
[[frontend-overview]] · [[fe-master-screens]] · [[fe-grid-component]] · [[fe-form-engine]] · [[fe-screen-registry-menu]] · [[fe-tabs-workspace]] · [[fe-api-proxy-routes]]
