---
title: "จอประมวลผลระบบและ POS (System Process Workbench & POS Setup)"
tags: [frontend, process, workflow, pos, gl, fixed-asset]
aliases: ["จอประมวลผล", "SystemProcessWorkbenchScreen", "คำนวณสต๊อกใหม่", "ปิดงวดบัญชี", "ผ่านรายการ", "เปลี่ยนรหัส", "ค่าเสื่อมราคา", "audit log", "PosSetupAndControlScreen", "ตั้งค่า POS", "workflow action", "AI Copilot", "ตรวจสอบประวัติการทำงาน"]
sources: ["frontend/account/process/SystemProcessWorkbenchScreen.tsx:34", "frontend/account/process/SystemProcessWorkbenchScreen.tsx:42", "frontend/account/tabs/screenRegistry.tsx:1107", "frontend/src/app/api/process/workflow/[action]/route.ts:12", "frontend/account/pos/PosSetupAndControlScreen.tsx:37", "frontend/account/pos/PosSetupAndControlScreen.tsx:177"]
---

# จอประมวลผลระบบและ POS

เมนูกลุ่ม "ประมวลผล" (คำนวณสต๊อก, ผ่านรายการบัญชี, ปิดงวด, ค่าเสื่อมราคา, เปลี่ยนรหัส, ดู audit log, เครื่องมือระบบ) ใช้ component เดียวคือ `SystemProcessWorkbenchScreen` สลับพฤติกรรมด้วย `mode`
จอตั้งค่า POS ทั้งหมดใช้ `PosSetupAndControlScreen` สลับด้วย tab ทั้งสองกลุ่มเป็น thin client: หน้าจอส่งคำสั่ง ให้ Go backend ประมวลผล

## ทำงานอย่างไร

### จอประมวลผล (`SystemProcessWorkbenchScreen`, 2,151 บรรทัด)

- กฎของไฟล์ (comment `:27`): อ่านข้อมูลดูอย่างเดียวให้เบราว์เซอร์ `queryList` ผ่าน `querySQL()`; การเขียนทุกอย่างต้องผ่าน `/api/process/*`
- `workflow(action, body)` (`:34-38`) = `POST /api/process/workflow/<action>` แล้วโยน Error ถ้าไม่ ok; `ACTIONS` whitelist ของ proxy (`src/app/api/process/workflow/[action]/route.ts:12-32`) มี 19 คำสั่ง: `change-code, journal-list, journal-pass, gl-check, gl-close, audit-list, fa-depreciation, asset-sale, province-list, province-load, check-ic-trans, point-recal, import-transport-label, ai-report-sql, ai-report-analyze, ai-bank-reconcile, ai-audit-copilot, ai-smart-reorder, ai-auto-gl` (ไม่อยู่ในรายการ = 404 `NOT_FOUND`) แล้ว proxy ไป `/api/v1/process/workflow/<action>` (`route.ts:50-58`)
- `SystemProcessMode` มี 9 ค่า (`:42-51`): `ic_recalc, gl_process, gl_journal_pass, gl_close_period, fa_depreciation, change_code, audit_log, system_tool, not_ported`
- สิทธิ์: `canWrite = rights.canAdd || rights.canEdit` (`:143`); ปุ่มบันทึกปิดงวด/ค่าเสื่อมถูก disable ถ้าไม่มีสิทธิ์ และปุ่มลบเอกสารค่าเสื่อมต้อง `rights.canDelete` (`:818-828`)
- โหลดข้อมูลตอนเปิดจอครั้งเดียว (`useEffect` `:510-514`, `loadData` `:374`) รอบถัดไปมาจากปุ่มค้นหา/Refresh

#### พฤติกรรมแต่ละ mode

| mode | โหลดแสดง (อ่านจากเบราว์เซอร์) | ปุ่มประมวลผลเรียก | ที่มา |
|---|---|---|---|
| `ic_recalc` | ตาราง `ic_inventory` (กรองรหัส/ชื่อ ILIKE) | `POST /api/process/stock/rebuild` ส่ง `action` = `stock_recalc`, `update_trans_detail`, `recheck_trans_flow`, `check_so_doc_success`, `recheck_doc_flow` พร้อม `itemCodes`, `processCommand`, `updateUnitRatio`, `flowCommand` | `:400-411`, `:616-644`, `:1467-1604` |
| `gl_process` | `gl_journal` ตามช่วงวันที่ | `POST /api/process/gl/rebuild` `{dateFrom,dateTo}` | `:412-424`, `:651-656` |
| `gl_journal_pass` (ผ่านรายการ / ยกเลิกผ่านรายการ) | workflow `journal-list` | `journal-pass` ส่ง `docNos` + `undo` (ยกเลิก = `menu_gl_journal_pass_cancel`); ต้องติ๊กใบสำคัญอย่างน้อย 1 ใบและยืนยัน `window.confirm` | `:425-446`, `:666-674` |
| `gl_journal_pass` แบบ `check` (`menu_gl_check_data`) | - | `gl-check` ส่งช่วงวันที่ + ตัวเลือก (`showAll`, `onlyBookSelect`, `skipCancelDoc`) แสดงตารางรายการตรวจสอบ | `:147-148`, `:657-665` |
| `gl_close_period` (ปิดงวด/ปิดปี/โอนกำไรขาดทุน/ปิดต้นทุนขาย) | - | `gl-close` ส่ง `mode` (`year` สำหรับ `menu_gl_end_of_year`/`menu_close_account_process`, อื่น ๆ `period`), `periodNumber`, `accountYear`, ช่วงวันที่, `docNo`, `bookCode`, `closeToAccount`, `save` | `:149`, `:530-563` |
| `fa_depreciation` (`menu_asset_transfers`, `menu_asset_depreciation_Undo`) | `as_trans` ที่ `trans_flag = 1801` | `fa-depreciation` ส่งตัวกรองสินทรัพย์ + `save`; ลบเอกสารด้วย `delete: true` | `:380-399`, `:567-614` |
| `change_code` | ตารางหลักตามชนิด (`CHANGE_CODE_KIND`) จำกัด 200 แถว | `change-code` ส่ง `kind`, `menuName`, `pairs` (รหัสเดิม -> รหัสใหม่) | `:56-65`, `:447-452`, `:675-689` |
| `audit_log` | workflow `audit-list` ส่ง `kind`, ช่วงวันที่, `search` | - (ดูอย่างเดียว) | `:67-76`, `:453-465` |
| `system_tool` | แยกตาม `menuKey` ใน `loadSystemToolData` (SQL ดูข้อมูล) | `province-load`, `check-ic-trans` (apply), `point-recal`, `import-transport-label`, หรือสร้างไฟล์ส่งออก WHT ในเบราว์เซอร์ | `:466-499`, `:690-738`, `:1808-2087` |
| `not_ported` | แสดงข้อความตรง ๆ แทนปุ่มปลอม (ตาราง `NOT_PORTED_PROCESS_MENUS` ตอนนี้ว่าง) | - | `:51-54`, `:153-156` |

- ปิดงวด/ค่าเสื่อมเป็นแบบ 2 ขั้น: "ประมวลผล" (preview, `save: false`) แล้ว "บันทึก" (`save: true`, ต้องยืนยัน `window.confirm`) ปุ่มบันทึกใช้ได้เมื่อมีผล preview แล้วเท่านั้น (`previewSave` `:189`, `:812-830`); ค่าเสื่อมสร้างเอกสารซ้ำชุดเดิมได้ backend เป็นคนแทนเอกสารเดิม และปฏิเสธการลบถ้ามีการขายสินทรัพย์หลังเอกสารนั้น (comment `:565-566`, ฝั่ง backend ยังไม่ยืนยัน)
- ตาราง `CHANGE_CODE_KIND` จับคู่ menuKey -> ชนิด/ตารางหลัก/ป้าย: สินค้า `ic_inventory`, เจ้าหนี้ `ap_supplier`, ลูกหนี้ `ar_customer`, ผังบัญชี `gl_chart_of_account` (เมนูคู่ `menu_change_code_*` และ `menu_*_change_code`)
- `AUDIT_KIND` แปลง menuKey เป็นชนิด log: `login`, `menu`, `trans`, `master`, `full` (`:67-76`)
- AI Copilot Suite: ปุ่มเปิดแผงที่ toolbar (`aiCopilotOpen` `:209`, `:841-851`) แผง (`:875-1281`) มีการ์ด 4 ใบ (แท็บ 5 อัน รวม "แสดงครบทั้ง 4 ระบบ") เรียก workflow `ai-bank-reconcile`, `ai-audit-copilot` (ตรวจผิดปกติก่อนปิดงวด), `ai-smart-reorder` (จุดสั่งซื้อ 2 หน่วยนับ), `ai-auto-gl` (แนะนำผังบัญชี/แยกภาษี) (`:301-367`); ผลที่ได้แสดงอย่างเดียว handler แค่เก็บผลลง state ไม่เขียนข้อมูลและไม่แตะตารางหลักของจอ ดู [[scr-system-process-workbench]] และ [[proc-ai-copilot]]

#### เมนูไหนไปจอประมวลผลโหมดไหน (`buildDynamicScreen`, `screenRegistry.tsx:1105-1260`)

| กลุ่มเมนู (menuKey) | mode | ที่มา |
|---|---|---|
| `menu_asset_transfers`, `menu_asset_depreciation_Undo` | `fa_depreciation` | `:1107-1109` |
| `menu_ic_recalc`, `menu_ic_stk_adjust_process`, `menu_ic_cost_ap` | `ic_recalc` | `:1120-1130` |
| `menu_gl_process`, `menu_asset_transfer_gl`, `menu_gl_create_data_from_branch`, `menu_gl_copy_journal_book`, `menu_gl_transfer`, `menu_gl_recurring` | `gl_process` (ทั้งหกเมนูเรียก `gl/rebuild` ตัวเดียวกัน ใน `handleRunProcess` ไม่มีโค้ดแยกตาม `menuKey`) | `:1133-1146`, `:651-656` |
| `menu_gl_journal_pass`, `menu_gl_journal_pass_cancel`, `menu_gl_check_data` | `gl_journal_pass` | `:1149-1159` |
| `menu_gl_close_period`, `menu_gl_end_of_period`, `menu_gl_end_of_year`, `menu_gl_profit_lost_process`, `menu_close_account_process`, `menu_gl_Summary_Inventory_Cost_of_good_sold`, `menu_product_sale_cost_close`, `menu_gl_summary`, `menu_journal_summary` | `gl_close_period` | `:1162-1178` |
| `menu_ic_change_code`, `menu_ap_change_code`, `menu_ar_change_code`, `menu_gl_change_code`, `menu_change_code_item`, `menu_change_code_supplier`, `menu_change_code_customer`, `menu_change_gl_account_code` | `change_code` | `:1181-1196` |
| `menu_log_view`, `menu_trans_full_logs`, `menu_view_capture_screen(_realtime)`, ชื่อขึ้นต้น `menu_audit_` | `audit_log` | `:1199-1210` |
| `menu_province_auto`, `menu_warehouse_location_auto`, `menu_ic_barcode_dup`, `menu_ic_barcode_check_13`, `menu_gl_chart_check`, `menu_gl_wht_export`/`menu_export_wht`, `menu_flow_chart`, `menu_backup_data`/`data_backup`, `menu_restore_data`, `menu_import_master`, `menu_so_send_etax`, `menu_ar_point_recal`, `menu_checking_ic_trans`, `menu_welcome_page`, `menu_resource_view` ฯลฯ (รายการเต็มที่ `:1214-1256`) และเมนูใต้ `menu_setup` ที่ไม่เข้ากฎอื่น | `system_tool` | `:1214-1260`, `:1359-1365` |
| `menu_asset_sale` | ไม่ใช่ workbench แต่เป็น `AssetSaleScreen` ใน `account/transaction/AssetSaleScreen.tsx` เรียก `/api/process/workflow/asset-sale` (`API` `:30`) | `screenRegistry.tsx:1110-1113` |

เมนู `menu_ic_change_code` และ `menu_log_view` ยังลงทะเบียนมือใน `BASE_SCREENS` ด้วย (2.25 และ 1.10.14, `screenRegistry.tsx:952-984`) ผลเหมือนกัน

### จอตั้งค่า POS (`PosSetupAndControlScreen`, 4,948 บรรทัด)

- `PosSetupTabKey` มี 8 tab (`:37-45`): `startup, machines, promotions, loyalty, qr, coupons, shifts, bills`; tab เริ่มต้นเลือกจากชื่อเมนูโดย `resolveTabFromMenuKey` (`:134-145`): ชื่อมี `pos_machine`/`pos_screen`+`config` -> machines, `promotion`/`slip_campaign` -> promotions, `point_rate` -> loyalty, `qr_payment`/`edc`/`usb_qr` -> qr, `coupon` -> coupons, `receive_money`/`send_money` -> shifts, `invoice` -> bills, อื่น ๆ -> startup
- ตารางจอที่ลงทะเบียน (`createPosSetupScreen`, `screenRegistry.tsx:133`):

| ชื่อจอ (ไทย) | menuKey (รหัส) | tab เริ่มต้น |
|---|---|---|
| กำหนดค่าเริ่มต้น POS | `menu_config_pos_startup` (1.1.23) | startup |
| กำหนดรหัสเครื่อง POS | `menu_config_pos_machine` (1.1.24) | machines |
| กำหนดเงื่อนไขการสะสมแต้มและโปรโมชั่น POS | `menu_pos_point_rate` (1.1.25) | loyalty |
| กำหนดคุณสมบัติของเครื่อง POS | `menu_config_pos_screen` (1.1.26) | machines |
| กำหนดค่าเครื่องรูดบัตรเครดิต | `menu_edc_config` (1.1.16) | qr |
| กำหนดค่าจอแสดงผล QR Code | `menu_usb_qr_display_config` (1.1.17) | qr |
| Download ระบบเสียงพูด | `menu_pos_sound_download_install` (1.3.3) | startup |
| รายละเอียดคูปองส่วนลด POS | `menu_coupon_list` (1.5.9) | coupons |
| สร้างคูปองแบบเร็ว | `menu_coupon_generate` (5.3) | coupons |
| บันทึกรับเงิน (เงินทอนเข้าลิ้นชัก POS) | `menu_save_pos_receive_money` (5.4) | shifts |
| บันทึกนำส่งเงินสดปิดกะ POS | `menu_save_send_money_pos` (5.5) | shifts |
| รายการใบกำกับภาษีอย่างย่อ (POS Bills) | `pos_invoice_list_pos` (5.6) | bills |
| รายการใบกำกับภาษีเต็มรูป (POS) | `pos_full_invoide_list_pos` (5.7) | bills |
| ยกเลิกใบกำกับภาษีอย่างย่อ (POS) | `pos_invoice_cancel_pos` (5.8) | bills |
| ออกแบบจอขาย POS | `client_design`, `menu_pos_design_screen` (กฎใน `buildDynamicScreen`) | machines |

(ที่มา: `screenRegistry.tsx` ตามรายการลงทะเบียน `createPosSetupScreen(...)` และ `:1285-1292`)

- endpoint ที่จอเรียก (`fetch` ตรงไป `/api/pos/*` ไม่ใช่ `/api/process/*`; โค้ดของ route `/api/pos` อยู่นอกขอบเขตที่อ่าน ยังไม่ยืนยันภายใน):

| การกระทำ | endpoint | ที่มา |
|---|---|---|
| โหลดค่าตั้งทั้งหมด | `GET /api/pos/bootstrap?holding_code=DATA&branch_code=00000` (ค่ารหัส fix ในโค้ด) | `PosSetupAndControlScreen.tsx:491` |
| ตัวช่วย GET/POST | `callPos(path, body?)` ไม่ throw คืน `{ok,json,error}` | `:177-197` |
| บันทึก startup/machine/point/qr/coupon | `POST /api/pos/config` `{section, ...ฟอร์ม}` โดย `section` = `startup`/`machine`/`point`/`qr`/`coupon` | `:772-801` |
| โปรโมชัน บันทึก/เปิดปิด/ลบ, คูปองเป็นชุด | `POST /api/pos/config` section `promotion_toggle`, `promotion_delete`, `coupon_batch` | `:865`, `:896`, `:921`, `:949` |
| รับเงิน/นำส่งเงิน, ยกเลิกบิล, จับคู่สมาชิกชั่วคราว | `POST /api/pos/shift` (`action: "cancel_bill"`, `"reconcile_temp_member"`) | `:787`, `:978`, `:1062` |
| รายการเครื่อง POS + จับคู่เครื่อง | `GET /api/pos/devices`, `POST /api/pos/devices/<machine>/pair` | `:542`, `:1011` |
| ประมวลผลบิลย้อนหลัง | `POST /api/pos/bills/reprocess` | `:1043` |
| ลบเครื่อง / ลบคูปอง | `queryExec` | `:832`, `:842` |

- กฎการแก้ไข: ถ้า `rights.readOnly` ห้ามบันทึก, ลบต้อง `rights.canDelete` และถามยืนยันก่อนลบเสมอ (`:758-760`, `:816-830`); ข้อความ error จาก backend (เช่น doc_format ซ้ำ) แสดงตามที่ได้ (`:803-806`)
- หลังบันทึกจะซิงก์ไปเครื่อง POS และโหลด bootstrap ใหม่ (`loadBootstrap`) เสมอ; ใน tab machines แสดงสถานะซิงก์ต่อเครื่องจาก `formatSyncTime` (`:200`)
- `PosDemoWorkspace.tsx` (322 บรรทัด) เป็นหน้าเดโมที่ห่อ `PosSetupAndControlScreen` ไว้ใน viewport desktop/tablet/mobile + โหมด `cashier|config`; ค้น `account/` และ `src/` แล้วไม่พบว่าถูก import ที่ไหน (นอกขอบเขตที่อ่านอาจมี ยังไม่ยืนยัน)

## ข้อควรระวัง

- เพิ่มเมนูประมวลผลใหม่: ต้องเพิ่มชื่อ menuKey ใน `buildDynamicScreen` ให้เข้า mode ที่ถูก และถ้าเป็น `change_code`/`audit_log` ต้องเพิ่มลง `CHANGE_CODE_KIND` / `AUDIT_KIND` ด้วย ไม่งั้นจอจะเข้าสถานะ `notPorted` (`:153-156`)
- ถ้าจะเรียก workflow action ใหม่ต้องเพิ่มลง `ACTIONS` ของ proxy ก่อน ไม่งั้นได้ 404
- รหัส holding/branch ของ POS (`DATA` / `00000`) ถูกใส่ตายตัวตอนเรียก bootstrap ถ้าหลายสาขาต้องแก้ตรงนี้
- เมนูส่งออก WHT (`menu_gl_wht_export`/`menu_export_wht`) สร้างไฟล์ข้อความคั่น `|` จากแถวในจอเอง (ไม่ผ่าน backend) ถ้าสูตรภาษีเปลี่ยนต้องแก้ใน `SystemProcessWorkbenchScreen.tsx` (ดู `:717-735`, โค้ดสร้างไฟล์อยู่แถว `:731`) (ตรวจสูตรกับกรมสรรพากรก่อนแก้)

## ที่มาในโค้ด

- `frontend/account/process/SystemProcessWorkbenchScreen.tsx:27-76` helper, mode, `CHANGE_CODE_KIND`, `AUDIT_KIND`
- `frontend/account/process/SystemProcessWorkbenchScreen.tsx:374-508` โหลดข้อมูลตาม mode; `:516-738` ประมวลผล; `:301-367` AI Copilot; `:1808-2087` `loadSystemToolData`
- `frontend/src/app/api/process/workflow/[action]/route.ts:12-58` whitelist และ proxy
- `frontend/account/tabs/screenRegistry.tsx:82-95` `createProcessScreen`; `:1105-1260` คัดแยกเมนูประมวลผล
- `frontend/account/pos/PosSetupAndControlScreen.tsx:37-145` tab; `:177-197` `callPos`; `:488-546` โหลด; `:757-870` บันทึก/ลบ
- `frontend/account/transaction/AssetSaleScreen.tsx:30` endpoint `asset-sale`

## ดูเพิ่ม

[[fe-screen-registry-menu]] | [[fe-api-proxy-routes]] | [[fe-tabs-workspace]] | [[fe-report-screens]] | [[fe-transaction-screens]] | [[process-overview]] | [[accounting-overview]] | [[frontend-overview]]
