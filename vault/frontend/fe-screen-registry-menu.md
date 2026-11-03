---
title: "ทะเบียนหน้าจอและโครงเมนู (Screen registry & bcMenu)"
tags: [frontend, menu, registry, screens, edition]
aliases: ["screenRegistry", "SCREENS", "BASE_SCREENS", "bcMenu.json", "buildDynamicScreen", "ScreenDef", "เมนูไปหน้าจอ", "menu key", "adminOnly", "รุ่นผลิตภัณฑ์", "starter account pro", "hasScreen"]
sources: ["frontend/account/tabs/screenRegistry.tsx:184", "frontend/account/tabs/screenRegistry.tsx:191", "frontend/account/tabs/screenRegistry.tsx:1012", "frontend/account/tabs/screenRegistry.tsx:1067", "frontend/account/tabs/screenRegistry.tsx:1382", "frontend/account/tabs/screenRegistry.tsx:1423", "frontend/src/config/bcMenu.ts:38", "frontend/src/config/bcMenu.ts:276", "frontend/src/config/bcMenu.ts:479", "frontend/src/config/editionConfig.ts:13"]
---

# ทะเบียนหน้าจอและโครงเมนู (Screen registry & bcMenu)

ทุกเมนูมี "ชื่อเมนู" (menu key เช่น `menu_ic_item_detail`) และ `screenRegistry.tsx` ผูกชื่อนั้นกับ React component ที่เปิดเป็นแท็บ
เมนูมาจาก `src/config/bcMenu.json` ส่วนหน้าจอที่ไม่ได้ลงทะเบียนมือจะถูกสร้างอัตโนมัติจากกฎ `buildDynamicScreen`

## ทำงานอย่างไร

**รูปแบบ** `ScreenDef = { title, code?, component, mode?: "tab"|"popup" }` (`screenRegistry.tsx:184-189`). ผลสุดท้ายคือ `export const SCREENS: Record<string, ScreenDef>` (1423) และ `hasScreen(menuName)` (1425) ที่ `TabWorkspace` ใช้ ([[fe-tabs-workspace]]).

**ลำดับการสร้าง `SCREENS`** (ไฟล์ 1,427 บรรทัด)
1. `BASE_SCREENS` ลงทะเบียนมือ 84 รายการ (เริ่มบรรทัด 191) - ตารางด้านล่าง.
2. ลูป `IC_MASTER_CONFIGS` -> `createMasterScreen` (บรรทัด 1012-1022) ดู [[fe-master-screens]].
3. ลูป `TRANS_MENU_MAP` ข้ามชื่อใน `NON_TRANS_MENUS` -> `createTransScreen` (1024-1055) ดู [[fe-transaction-screens]].
4. ซิงก์ `code` และ `title` ของทุกจอให้ตรง `bcMenu` ด้วย `getMenuTextByName` (1057-1061).
5. `registerAllMenus` (1382) เดินทุกใบของ `bcMenu` + `rawBcMenu` + `homeShortcutGroups` แล้วเรียก `buildDynamicScreen` กับใบที่ยังไม่มีจอ (เรียกที่ 1421).

**ตัวสร้างจอ (helper)**: `createProcessScreen` (82), `createReportDesignerScreen` (101), `createPosSetupScreen` (133), `createMasterScreen` (152; เลือก `StandardMasterScreen` หรือ `MasterDetailScreen`), `createTransScreen` (167), `createReportScreen` (173).

**`buildDynamicScreen` (1067-1380)** - จัดชนิดใบเมนูที่เหลือ:
| เงื่อนไข | เป็นจอ |
|---|---|
| ชื่อใน `TRANS_MENU_MAP` | `UniversalTransScreen` |
| เมนูประมวลผล/system tool (1105-1261: ค่าเสื่อม/ขายสินทรัพย์, `ic_recalc`, `gl_process`, `gl_journal_pass`, `gl_close_period`, `change_code`, `audit_log`, `system_tool`) | `SystemProcessWorkbenchScreen` ([[fe-process-pos-screens]]) |
| `query` / `database_struct` / `verify_database` | โหมด `sql_utility` ของ `UniversalReportScreen` (ใช้ `createReportScreen` ที่ 1273) |
| `check_price`, `barcode_print` | โหมด `check_price` / `barcode_print` (1308 / 1322) |
| ที่เหลือ = รายงาน เลือก `WorkbenchMode` จากหมวดบนสุด (`topBranchName`) | `menu_po` -> `report_po`; `menu_so`/`menu_so_pos` -> `report_so`; `menu_ap` -> `report_ap`; `menu_ar` -> `report_ar`; `menu_cash_and_bank` -> `report_chq` (ชื่อมี chq/cheque/credit_card) หรือ `report_cb`; `menu_asset` -> `report_fa`; `menu_general_ledger_main` -> `report_gl`; `menu_wh`/`menu_singha_warehouse` -> `report_wh_pp`; `menu_setup` -> `system_tool`; อื่นๆ -> `report_ic` (ค่าเริ่ม 1333; `menu_singha_report` แยกตามชื่อเมนู 1353-1358; สร้างจอ 1368-1378) |
รายละเอียดโหมดรายงานดู [[fe-report-screens]].

**ตัวอย่างจอที่ลงทะเบียนมือ (BASE_SCREENS)** - บรรทัดคือจุดเริ่มรายการใน `screenRegistry.tsx`
| กลุ่ม | menu key -> ชื่อไทย | component (ใต้ `account/`) |
|---|---|---|
| ออกแบบรายงาน/แบบฟอร์ม | `fast_report_designer` ออกแบบรายงาน (192); `menu_form_edit` สร้าง/แก้ไขแบบฟอร์ม (203); `menu_gl_report_design` ออกแบบงบการเงิน (214); `menu_import_report`, `menu_import_report_branch`, `menu_import_formdesign` (225-249) | `report/FastReportDesignerScreen` ([[fe-report-print-designer]]) |
| ตั้งค่าระบบ | `menu_company_profile` กำหนดรายละเอียดบริษัท (261); `menu_option` กำหนดข้อเลือกพิเศษ (267) | `config/CompanyProfileForm`, `config/OptionsForm` ([[fe-form-engine]]) |
| ผู้ดูแล | `menu_mcp_tokens`; `menu_change_password`, `menu_saletools_change_password` | `admin/screens/McpTokenScreen`, `ChangePasswordScreen` ([[fe-admin-console]]) |
| พนักงาน/เอกสาร/หน่วย/คลัง | `menu_setup_staff`, `menu_setup_doc_format`, `menu_setup_ic_unit`, `menu_setup_ic_wh` | `master/EmployeeScreen`, `DocFormatScreen`, `UnitScreen`, `WarehouseScreen` |
| ลูกหนี้/เจ้าหนี้ | `menu_ar_detail`, `menu_ar_detail_2`, `menu_ar_dealer`; `menu_ap_detail`, `menu_ap_detail_2` | `master/CustomerScreen`, `CustomerDetailScreen`, `DealerScreen`, `SupplierScreen`, `SupplierDetailScreen` |
| สินค้า | `menu_ic_item_detail`/`menu_ic_inventory` ข้อมูลสินค้า; `menu_ic_item_detail_2`(+`_barcode`); `menu_ic_item_detail_barcode`; `menu_ic_item_for_sync`; `menu_ic_modify_price` | `master/ItemScreen`, `ItemDetail2Screen`, `ItemBarcodeScreen`, `ModifyPriceScreen` |
| สินค้า (เสริม) | `menu_ic_description`(+`_fast`), `menu_ic_item_level`, `menu_ic_multi_item_level`, `check_price` ตรวจสอบราคาสินค้า | `master/IcExtraScreens` |
| บาร์โค้ด | `menu_ic_item_barcode`, `menu_ic_item_add_barcode_fast`, `menu_ic_item_barcode_checker_ean13`; `menu_ic_item_barcode_laser_print`; `menu_ic_item_barcode_discount`, `menu_ic_item_multibarcode_discount`; `menu_ic_item_barcode_checker` | `master/BarcodeScreens`, `BarcodePrintScreen`, `BarcodeDiscountScreens`, `StockCheckScreens` |
| สต็อก | `menu_ic_serialnumber_checker`; `menu_ic_serial_analyze`; `menu_ic_stk_adjust_auto`(`_2`), `menu_ic_stk_adjust_lot_auto`, `menu_ic_adjust_stock_lot_amount`; `menu_ic_hidden_cost_process`, `menu_ic_weight_cost`; `menu_ic_stk_balance` | `master/SerialStockCountScreen`, `StockCheckScreens`, `LotAdjustScreens`, `HiddenCostScreen`; `transaction/StockBeginningBalanceScreen` |
| รูปภาพ | `menu_ic_item_picture`, `menu_ic_item_barcode_picture`, `menu_setup_staff_pic`, `menu_asset_picture`, `menu_import_ic_picture` | `master/ItemPictureScreen` (variant item/barcode/staff/asset) |
| รูปเอกสาร | `menu_ic_document_picture`, `menu_po_doc_picture`, `menu_so_doc_picture`, `menu_ap_doc_picture`, `menu_ar_doc_picture`, `menu_cb_doc_picture`, `menu_gl_picture`, `menu_gl_doc_picture` | `master/DocumentPictureScreen` |
| ป้าย/ข้อมูลซื้อขาย | `menu_ap_transport_label_print`, `menu_ar_transport_label_print`; `menu_po_buy_information`, `menu_so_sale_information` (ไม่มีใบเมนูชี้มา เปิดได้ทาง `/home?open=` เท่านั้น) | `master/TransportLabelPrintScreen`; `report/BuySaleInformationScreen` |
| จังหวัด/อำเภอ/ตำบล | `menu_setup_province`, `_province_auto`, `menu_province_auto`, `menu_setup_ampher`, `menu_setup_tambon` | `master/ProvinceTreeScreen` |
| คลัง/ที่เก็บ | `menu_ic_warehouse_locaton`, `ic_warehouse_and_location_group` | `createMasterScreen` |
| POS | `menu_config_pos_startup/_machine/_screen`, `menu_pos_point_rate`, `menu_edc_config`, `menu_usb_qr_display_config`, `menu_pos_sound_download_install`, `menu_coupon_list`, `menu_coupon_generate`, `menu_save_pos_receive_money`, `menu_save_send_money_pos`, `pos_invoice_list_pos`, `pos_full_invoide_list_pos`, `pos_invoice_cancel_pos` | `pos/PosSetupAndControlScreen` ([[fe-process-pos-screens]]) |
| ประมวลผล | `menu_ic_change_code` เปลี่ยนรหัสสินค้า (mode `change_code`); `menu_log_view` ตรวจสอบประวัติการทำงาน (mode `audit_log`) | `process/SystemProcessWorkbenchScreen` |
| อื่นๆ | `menu_report_employee_group` (รายงาน `report_ic`); ขายสินทรัพย์ | `AssetSaleScreen` (`transaction/`) |

**โครงเมนู `bcMenu.json`**: 9 หมวดบนสุด รวม 700 ใบหลังกรองรุ่น `&13&` และตัดกิ่งซ่อน (`countMenuItems` `bcMenu.ts:299-309`; ไฟล์ดิบมี 710 ใบ): `menu_setup` เริ่มต้น 126, `menu_ic` สินค้า 136, `menu_po` ซื้อ 77, `menu_so` ขาย 74, `menu_ap` เจ้าหนี้ 50, `menu_ar` ลูกหนี้ 50, `menu_cash_and_bank` เงินสด/ธนาคาร 114, `menu_asset` ค่าเสื่อม 12, `menu_general_ledger_main` บัญชี 61. แต่ละ node มี `name, text, icon, tag, children` + `code, legacyCode, section, adminOnly` (`bcMenu.ts:12-31`).
- `bcMenu.ts` กรองตามรหัสรุ่น `MENU_VERSION_TAG = "&13&"` (บรรทัด 36; `removeByVersion` 44-74 เก็บโหนดที่ไม่มี tag, `&hide&` หรือ tag มี `&13&`) แล้ว `assignMenuCodes` (101-134) ใส่ `code`: ใบเมนูได้เลข 4 หลัก = เลขหมวด (1-9) ต่อด้วยลำดับใบ 3 หลักในหมวด (เช่น `1001`, `2005`), โฟลเดอร์ได้ช่วง `ใบแรก-ใบสุดท้าย` (118); `legacyCode` คือตำแหน่งแบบจุดในผัง (`1.1.1` ฯลฯ, 108) ที่ใช้ค้นย้อนได้.
- ซ่อน `menu_singha_warehouse` และ `menu_so_pos` ทั้งกิ่งตอนกรองรุ่น (`bcMenu.ts:58,146`).
- `getMenuCodeByName(name, fallback)` (`bcMenu.ts:276-278`) คืน `code` จากผังเมนู ถ้าไม่พบชื่อจึงใช้ค่าสำรอง (`normalizeFallbackMenuCode` 267-274 แปลงค่าแบบจุดเป็นเลข 4 หลัก) - ค่าแบบจุดที่เขียนคู่กับชื่อใน `screenRegistry.tsx` (เช่น `"1.13"`) จึงเป็นแค่ค่าสำรอง. `LEGACY_MENU_ALIASES` (239-261) แมปชื่อเมนูที่ยังถูกเรียกอยู่ไปยังชื่อปัจจุบัน เช่น `menu_ic_inventory` -> `menu_ic_item_detail`, `menu_setup_ampher` -> `menu_setup_province`.

**รุ่นผลิตภัณฑ์ (edition)**: `BcEdition = "starter"|"account"|"pro"` (`editionConfig.ts:13`). `getBcMenuByEdition(edition, businessTypes?)` (`bcMenu.ts:479-493`) คืนเมนูเต็มสำหรับ `pro`; `account`/`starter` ผ่าน `filterMenuTreeForEdition` (406-471): ตัดคีย์ใน `PRO_ONLY_MENU_KEYS` (`editionConfig.ts:131`) ทั้งสองรุ่น, ใบที่มี tag ไม่ว่าง/ไม่ใช่ `&hide&`/ไม่มี `&2&` ถูกตัด (437-443), และ `starter` ตัด GL/สินทรัพย์ตามชุด `STARTER_EXCLUDED_MENU_KEYS` (`editionConfig.ts:192`) กับคีย์ขึ้นต้น `menu_gl_`, `gl_menu_`, `menu_as_`, `menu_asset` (424-435); ประเภทธุรกิจหลายแบบปลดล็อกเมนูเพิ่มด้วย `getUnlockedMenuKeysForBusinessTypes` (`editionConfig.ts:1761`, ใช้ที่ `bcMenu.ts:491-492`).
- `TabWorkspace` สร้าง `editionAllowedMenuSet` จากใบของเมนูตามรุ่น และสำหรับ `pro` เพิ่มทุก key ใน `SCREENS` (`TabWorkspace.tsx:186-196`).

**เมนูเฉพาะผู้ดูแล**: `ADMIN_ONLY_MENU_SET` (`bcMenu.ts:315-390`) เช่น `menu_company_profile`, `menu_option`, `menu_setup_branch`, `menu_setup_staff`, `menu_setup_user_group`, `menu_setup_doc_format`, `menu_config_pos_*`, `menu_close_account_process`, `menu_gl_journal_pass_cancel`; `isAdminOnlyMenu(name)` (392-397) ตรวจชุดนี้หรือ `node.adminOnly`.

**ข้อควรระวัง**
- เพิ่มเมนูใหม่: ถ้าเป็นเอกสารต้องเพิ่มใน `TRANS_MENU_MAP`; ถ้าเป็นข้อมูลหลักเพิ่มใน `IC_MASTER_CONFIGS`; ไม่เช่นนั้นจะตกเป็นจอรายงานตามกฎ `topBranchName`.
- ชื่อไทยของจอมาจาก `bcMenu.json` (`getMenuTextByName`, `bcMenu.ts:280-282`) ทับ `title` ที่ตั้งในทะเบียนเมื่อชื่อเมนูนั้นมีในผัง (ซิงก์ที่ `screenRegistry.tsx:1057-1061`).

## ที่มาในโค้ด
- `frontend/account/tabs/screenRegistry.tsx:82-190` - ตัวสร้างจอและ `ScreenDef`
- `frontend/account/tabs/screenRegistry.tsx:191-1010` - `BASE_SCREENS` ลงมือ
- `frontend/account/tabs/screenRegistry.tsx:987-1061` - จังหวัด/อำเภอ/ตำบล, ลงทะเบียน master / trans และซิงก์ชื่อ
- `frontend/account/tabs/screenRegistry.tsx:1067-1423` - `buildDynamicScreen`, `registerAllMenus`, `SCREENS`
- `frontend/src/config/bcMenu.ts:12-38,44-134,239-297,299-309,315-397,406-493` - โครงเมนู, รหัสเมนู, adminOnly, กรองตามรุ่น
- `frontend/src/config/editionConfig.ts:13,131,192,1761` - รุ่นผลิตภัณฑ์
- `frontend/account/tabs/TabWorkspace.tsx:186-196` - เมนูที่อนุญาตตามรุ่น

## ดูเพิ่ม
[[frontend-overview]] · [[fe-tabs-workspace]] · [[fe-master-screens]] · [[fe-transaction-screens]] · [[fe-report-screens]] · [[fe-process-pos-screens]] · [[fe-admin-console]]
