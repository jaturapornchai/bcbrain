---
title: "สารบัญหน้าจอทั้งหมดของ BC Ai Account (ต้นไม้เมนู → หน้าจอ → โน้ต)"
tags: [screens]
aliases: ["สารบัญหน้าจอ", "ต้นไม้เมนู", "screens overview", "screen catalog", "รายการหน้าจอทั้งหมด", "เมนูทั้งหมด"]
sources: ["frontend/src/config/bcMenu.ts:101", "frontend/src/config/bcMenu.ts:140", "frontend/src/config/bcMenu.ts:178", "frontend/src/config/bcMenu.ts:201", "frontend/account/tabs/screenRegistry.tsx:191", "frontend/account/tabs/screenRegistry.tsx:1025", "frontend/account/tabs/screenRegistry.tsx:1059", "frontend/account/tabs/screenRegistry.tsx:1382", "frontend/account/tabs/transMenuMap.ts:37", "frontend/account/tabs/transMenuMap.ts:52", "frontend/account/tabs/transMenuMap.ts:2353", "frontend/src/config/adminMenu.ts:41"]
---
# สารบัญหน้าจอ BC Ai Account

หน้านี้เป็นแผนที่ของโน้ตหมวด `screens/` ทั้งหมด: เมนูทุกใบของแอป ERP (700 ใบ) เปิดแล้วได้หน้าจอไหน (ชื่อคอมโพเนนต์) และโน้ตไหนอธิบายหน้าจอนั้นจากมุมผู้ใช้ (ช่องกรอก ปุ่ม คีย์ลัด ป๊อปอัป ตารางที่เขียน ข้อควรระวัง) ส่วนกลไกว่าชื่อเมนูถูกผูกกับหน้าจอได้อย่างไรอยู่ที่ [[fe-screen-registry-menu]] ไม่ซ้ำที่นี่ กลไกแท็บอยู่ที่ [[fe-tabs-workspace]] หน้าจอข้อมูลหลักที่ [[fe-master-screens]] การจัดการตัวเลขเงินที่ [[fe-numeric-money]]

ทุกอย่างในหน้านี้มาจากการอ่านโค้ด ไม่ได้รันแอป ต้นไม้เมนูได้จากสคริปต์อ่านอย่างเดียวที่จำลองขั้นตอนใน `bcMenu.ts` (กรองรุ่น, ซ่อนใบ `&hide&`, ใส่รหัส) แล้วจับคู่ชื่อเมนูกับ `screenRegistry.tsx` และ `transMenuMap.ts`

## เริ่มอ่านจากตรงไหน

| อยากรู้เรื่อง | เริ่มที่ |
|---|---|
| หน้าจอบันทึกเอกสาร (ซื้อ ขาย สต็อก ลูกหนี้ เจ้าหนี้ เงินสด เช็ค สมุดรายวัน) | [[scr-universal-trans]] แล้วไล่ต่อ [[scr-trans-header-and-tabs]], [[scr-trans-item-grid]] |
| ยกเลิก/อนุมัติเอกสาร | [[scr-cancel-confirm]] |
| หน้าจอข้อมูลหลักตารางเดียว / หัว+รายการย่อย | [[scr-standard-master]], [[scr-master-detail]] |
| รายงานทุกใบ | [[scr-universal-report]], พิมพ์/ส่งออก [[scr-report-print-modal]], ออกแบบ [[scr-report-designer]] |
| ประมวลผล ตรวจสอบ สำรองข้อมูล ประวัติการใช้งาน | [[scr-system-process-workbench]] |
| กล่องป๊อปอัปที่เรียกจากตารางสินค้า | [[scr-modal-serial-lot-stock]], [[scr-modal-price-credit]], [[scr-modal-document-item]], [[scr-data-list-and-lookup]] |
| ผู้ดูแลระบบ (`/admin`) และ POS (`/pos`) | หัวข้อ "หน้าจอที่อยู่นอกต้นไม้เมนู" ด้านล่าง |

## อ่านตารางต้นไม้เมนูอย่างไร

- **รหัส** คือรหัสเมนู 4 หลักที่ระบบสร้างตอนโหลด: เลขหมวดบนสุด (1-9) ตามด้วยตัวนับใบ 3 หลักที่นับต่อเนื่องในหมวด (`bcMenu.ts:101-120`, สูตร `catNum + padStart(leafCounter, 3)` ที่ `:111`) แถวหนาที่มีช่วงเลข (เช่น 1001-1023) คือโฟลเดอร์ (`:119`) รหัสแบบจุด (เช่น 2.4.1) เก็บแยกไว้ในฟิลด์ `legacyCode` (`:108`) **รหัสผูกกับลำดับในไฟล์ `bcMenu.json`** ถ้าเพิ่ม/ลบ/ย้ายเมนูหรือเปลี่ยนการซ่อน เลขของใบที่อยู่ถัดไปจะเลื่อนตาม ใช้ชื่อเมนู (`menu_...`) เป็นตัวยึดที่มั่นคงกว่า ตารางด้านล่างจึงแสดงทั้งสองอย่าง
- **เมนู** คือชื่อไทยบนเมนู ตามด้วยชื่อเมนูในโค้ด (`menu_...`) ซึ่งเป็นกุญแจของทะเบียนหน้าจอ (`SCREENS`, `screenRegistry.tsx:1423`)
- **หน้าจอ** คือคอมโพเนนต์ที่เปิดจริง หลายเมนูใช้คอมโพเนนต์เดียวกันแต่ต่างค่าตั้ง (เช่น `UniversalTransScreen` เลือกชนิดเอกสารจากชื่อเมนูใน `TRANS_MENU_MAP`, `transMenuMap.ts:52`; เมนูที่ตั้ง `mode` เป็น cancel/approve ไปที่ `UniversalCancelConfirmScreen` 66 ใบ, `transMenuMap.ts:82,96`)
- **รายงาน** เรียงต่อกันในโฟลเดอร์เดียวกันและโหมดเดียวกัน ถูกยุบเป็นแถวเดียว ("รายงาน/สอบถาม N ใบ") ทุกใบเปิดด้วยจอรายงานกลางเดียวกัน ชื่อรายงานรายใบและโหมดอยู่ที่ [[scr-universal-report]] และ [[fe-report-screens]]
- ใบที่ไม่ได้อยู่ใน `BASE_SCREENS` ถูกสร้างอัตโนมัติจาก `registerAllMenus` (`screenRegistry.tsx:1382`) ตาม `buildDynamicScreen` (`:1067`) เมนูที่ชื่อเก่าในโค้ดเดิมชี้ไปชื่อใหม่ผ่าน `LEGACY_MENU_ALIASES` 15 รายการ (`bcMenu.ts:201-216`)

## ตัวเลขภาพรวม

ต้นไม้ที่ผู้ใช้เห็น (หลังกรองรุ่น `&13&` และซ่อนใบ `&hide&`, `bcMenu.ts:36,140-165`) มี **700 ใบ** ใน 9 หมวด ต่างจากตัวเลขดิบของไฟล์เมนูที่บันทึกไว้ใน [[fe-screen-registry-menu]] เฉพาะหมวดเริ่มต้น (130 เหลือ 126) และหมวดขาย (80 เหลือ 74) ขั้นกรองที่ข้ามใบ `menu_so_pos` (`bcMenu.ts:146`) และใบ `&hide&` น่าจะเป็นสาเหตุ แต่ยังไม่ได้ไล่นับว่าใบไหนหายพอดี


แยกตามชนิดหน้าจอและหมวด (นับจากต้นไม้ด้านล่าง):

| หมวด | ใบทั้งหมด | รายงาน | บันทึกเอกสาร | ยกเลิก/อนุมัติ | ข้อมูลหลัก | หน้าจอเฉพาะ | ประมวลผล |
|---|---|---|---|---|---|---|---|
| 1 เริ่มต้น | 126 | 4 | 0 | 0 | 73 | 27 | 22 |
| 2 สินค้า | 136 | 80 | 10 | 7 | 10 | 28 | 1 |
| 3 ซื้อ | 77 | 44 | 16 | 16 | 0 | 1 | 0 |
| 4 ขาย | 74 | 47 | 12 | 13 | 0 | 1 | 1 |
| 5 เจ้าหนี้ | 50 | 31 | 8 | 5 | 1 | 4 | 1 |
| 6 ลูกหนี้ | 50 | 26 | 8 | 5 | 4 | 5 | 2 |
| 7 เงินสด/ธนาคาร | 114 | 61 | 31 | 20 | 1 | 1 | 0 |
| 8 ค่าเสื่อม | 12 | 7 | 0 | 0 | 2 | 2 | 1 |
| 9 บัญชี | 61 | 45 | 2 | 0 | 2 | 1 | 11 |
| **รวม** | **700** | **345** | **87** | **66** | **93** | **70** | **39** |


- **ข้อมูลหลัก** 93 ใบ = `StandardMasterScreen` ตารางเดียว 75 ([[scr-standard-master]]) + `MasterDetailScreen` หัวกับรายการย่อย 18 ([[scr-master-detail]])
- **บันทึกเอกสาร** 87 ใบ + **ยกเลิก/อนุมัติ** 66 ใบ = 153 ใบ ชนิดข้อมูลของ `UniversalTransScreen`: `ic_trans` 140 (รวมใบยกเลิก/อนุมัติ), `ap_ar_trans` 8, `cb_chq_list` 3, `gl_journal` 2 แผนที่ธง `trans_flag` ของแต่ละเมนูอยู่ที่ [[acc-trans-flag-map]]
- **หน้าจอเฉพาะ** 70 ใบ (68 `BASE` + 1 `POS` + 1 `AssetSaleScreen`) มีโน้ตรายหน้าจอเกือบทั้งหมด
- **ประมวลผล** 39 ใบ แยกโหมด: `system_tool` 17, `audit_log` 7, `gl_close_period` 5, `change_code` 4, `gl_journal_pass` 3, `ic_recalc` 1, `fa_depreciation` 1, `gl_process` 1 ทั้งหมดเปิดด้วย `SystemProcessWorkbenchScreen` ([[scr-system-process-workbench]])
- **รายงาน** 345 ใบ แยกโหมดของจอรายงานกลาง: `report_ic` 78, `report_so` 47, `report_gl` 45, `report_po` 44, `report_ap` 31, `report_cb` 31, `report_chq` 30, `report_ar` 26, `report_fa` 7, `check_price` 2 (2027, 2028), `sql_utility` 4 (1100, 1103, 1104, 1105) ใน 4 ใบหลังสุดเป็นเครื่องมือฐานข้อมูล ไม่ใช่รายงานธุรกิจ

## ต้นไม้เมนูเต็ม (เมนู → หน้าจอ → โน้ต)

### 1. เริ่มต้น (ตั้งค่า) (`menu_setup`) รหัส 1001-1126

มีเมนูใบ 126 ใบ (เป็นรายงานผ่านจอรายงานกลาง 4 ใบ)

| รหัส | เมนู | หน้าจอ | โน้ต |
|---|---|---|---|
| **1001-1023** | **ตั้งค่าองค์กร พนักงาน และเอกสาร** (โฟลเดอร์ `menu_setup_erp`) | | |
| 1001 | กำหนดรายละเอียดบริษัท (`menu_company_profile`) | `CompanyProfileForm` | [[scr-company-profile]] |
| 1002 | กำหนดข้อเลือกพิเศษต่างๆ (`menu_option`) | `OptionsForm` | [[scr-options]] |
| 1003 | กำหนดสกุลเงิน (`menu_setup_currency`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1004 | กำหนดรายละเอียดสาขา (`menu_setup_branch`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1005 | กำหนดรายละเอียดแผนก (`menu_setup_department_list`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1006 | กำหนดพนักงาน (`menu_setup_staff`) | `EmployeeScreen` | [[scr-employee]] |
| 1007 | กำหนดรูปภาพพนักงาน (`menu_setup_staff_pic`) | `ItemPictureScreen` | [[scr-item-pictures]] · [[scr-employee]] |
| 1008 | กำหนดกลุ่มพนักงาน (`menu_setup_user_group`) | `MasterDetailScreen` | [[scr-master-detail]] |
| 1009 | กำหนดการใช้คลังและที่เก็บ (`menu_setup_user_group_warehouse_shelf`) | `MasterDetailScreen` | [[scr-master-detail]] |
| 1010 | กำหนดผู้ใช้ระบบ MIS (`menu_setup_staff_mis`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1011 | กำหนดกลุ่มเอกสาร (`menu_setup_doc_group`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1012 | กำหนดรูปแบบเลขที่เอกสาร (`menu_setup_doc_format`) | `DocFormatScreen` | [[scr-doc-format]] |
| 1013 | กำหนดประเภทการขนส่ง (`menu_setup_transport`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1014 | กำหนดเขตการขนส่ง (`menu_setup_ar_logistic_area`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1015 | กำหนดรหัสจังหวัด / อำเภอ / ตำบล (`menu_setup_province`) | `ProvinceTreeScreen` | [[scr-province-tree]] |
| 1016 | กำหนดค่าเริ่มต้น POS (`menu_config_pos_startup`) | `createPosSetupScreen` | [[scr-pos-setup-control]] |
| 1017 | กำหนดรหัสเครื่อง POS (`menu_config_pos_machine`) | `createPosSetupScreen` | [[scr-pos-setup-control]] |
| 1018 | กำหนดคุณสมบัติของเครื่อง POS (`menu_config_pos_screen`) | `createPosSetupScreen` | [[scr-pos-setup-control]] |
| 1019 | กำหนดเงื่อนไขสะสมแต้ม (`menu_pos_point_rate`) | `createPosSetupScreen` | [[scr-pos-setup-control]] |
| 1020 | กำหนดค่าเครื่องรูดบัตรเครดิต (`menu_edc_config`) | `createPosSetupScreen` | [[scr-pos-setup-control]] |
| 1021 | กำหนดค่าจอแสดงผล QR Code (`menu_usb_qr_display_config`) | `createPosSetupScreen` | [[scr-pos-setup-control]] |
| 1022 | กำหนดค่า QR Code Payment (`menu_setup_qr_payment`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1023 | จัดการ MCP Token เชื่อมต่อ AI (Read-Only) (`menu_mcp_tokens`) | `McpTokenScreen` | [[scr-mcp-token]] |
| **1024-1047** | **ตั้งค่าระบบสินค้าคงคลัง** (โฟลเดอร์ `menu_setup_ic`) | | |
| 1024 | กำหนดคลังสินค้า (`menu_setup_ic_wh`) | `WarehouseScreen` | [[scr-warehouse]] |
| 1025 | กำหนดพื้นที่เก็บสินค้า (`menu_setup_ic_shelf`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1026 | เพิ่มคลังและพื้นที่เก็บอัตโนมัติ (`ic_auto_add_warehouse_and_location`) | `SystemProcessWorkbenchScreen` (โหมด system_tool) | [[scr-system-process-workbench]] |
| 1027 | กำหนดหน่วยนับสินค้า (`menu_setup_ic_unit`) | `UnitScreen` | [[scr-unit]] |
| 1028 | กำหนดกลุ่มสินค้าหลัก (`menu_setup_ic_group_main`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1029 | กำหนดกลุ่มสินค้าย่อย (`menu_setup_ic_group_sub`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1030 | กำหนดกลุ่มสินค้าย่อย2 (`menu_setup_ic_group_sub2`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1031 | กำหนดหมวดสินค้า (`menu_setup_ic_category`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1032 | กำหนดยี่ห้อสินค้า (`menu_setup_ic_brand`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1033 | กำหนดรุ่นสินค้า (`menu_setup_ic_model`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1034 | กำหนดสีสินค้า (`menu_setup_ic_color`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1035 | กำหนดขนาดสินค้า (`menu_setup_ic_size`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1036 | กำหนดรูปแบบสินค้า (`menu_setup_ic_pattern`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1037 | กำหนดเกรดสินค้า (`menu_setup_ic_grade`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1038 | กำหนดรูปทรงสินค้า (`menu_setup_ic_design`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1039 | กำหนดระดับสินค้า (`menu_setup_ic_class`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1040 | กำหนดชื่อมิติสินค้า (`menu_setup_ic_dimension_name`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1041 | กำหนดมิติสินค้า (`menu_setup_ic_dimension`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1042 | กำหนดผู้ผลิต (`menu_manufacturer_list`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1043 | กำหนดกลุ่มบัญชีสินค้า (`menu_setup_ic_account_group`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1044 | กำหนดประเภทการเบิก (`menu_setup_ic_issue_type`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1045 | กำหนดสาเหตุการปรับปรุง (`menu_setup_stk_adjust`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1046 | กำหนดเหตุผลการปิดสินค้า (`menu_setup_ic_close_reason`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1047 | กำหนดพิกัดศุลกากร (`menu_setup_ic_import_duty_point`) | `StandardMasterScreen` | [[scr-standard-master]] |
| **1048-1051** | **ตั้งค่าระบบขายและ POS** (โฟลเดอร์ `Node1111`) | | |
| 1048 | กำหนดเขตการขาย (`menu_setup_ar_sale_area`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1049 | กำหนดกลุ่มอนุมัติวงเงิน (`menu_approve_credit_level`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1050 | ออกแบบหน้าจอขาย POS (`client_design`) | `PosSetupAndControlScreen` (แท็บ machines) | [[scr-pos-setup-control]] |
| 1051 | Download ระบบเสียงพูด (`menu_pos_sound_download_install`) | `createPosSetupScreen` | [[scr-pos-setup-control]] |
| **1052-1055** | **ตั้งค่าระบบเจ้าหนี้** (โฟลเดอร์ `menu_setup_ap`) | | |
| 1052 | กำหนดประเภทเจ้าหนี้ (`menu_setup_ap_type`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1053 | กำหนดกลุ่มเจ้าหนี้หลัก (`menu_setup_ap_group_main`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1054 | กำหนดกลุ่มเจ้าหนี้ย่อย (`menu_setup_ap_group_sub`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1055 | กำหนดมิติเจ้าหนี้ (`menu_setup_ap_dimension`) | `StandardMasterScreen` | [[scr-standard-master]] |
| **1056-1065** | **ตั้งค่าระบบลูกหนี้** (โฟลเดอร์ `menu_setup_ar`) | | |
| 1056 | กำหนดประเภทลูกหนี้ (`menu_setup_ar_type`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1057 | กำหนดกลุ่มลูกหนี้หลัก (`menu_setup_ar_group_main`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1058 | กำหนดกลุ่มลูกหนี้ย่อย (`menu_setup_ar_group_sub`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1059 | กำหนดมิติลูกหนี้ (`menu_setup_ar_dimension`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1060 | กำหนดกลุ่มผู้ติดต่อ (`menu_ar_contact_group`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1061 | กำหนดเหตุผลอนุมัติวงเงิน (`menu_setup_ar_credit_approve`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1062 | กำหนดเงื่อนไขการวางบิล (`menu_setup_ar_pay_bill_reason`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1063 | กำหนดเงื่อนไขการรับเช็ค (`menu_setup_ar_keep_chq_reason`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1064 | กำหนดเงือนไขการชำระเงิน (`menu_setup_ar_keep_money`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1065 | กำหนดวันครบกำหนดชำระเงิน (`menu_ar_credit_pay_bill`) | `StandardMasterScreen` | [[scr-standard-master]] |
| **1066-1075** | **ตั้งค่าระบบการเงินและธนาคาร** (โฟลเดอร์ `menu_cash_bank`) | | |
| 1066 | กำหนดธนาคาร (`menu_setup_bank`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1067 | กำหนดสาขาธนาคาร (`menu_setup_bank_branch`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1068 | ประเภทสมุดเงินฝาก (`menu_book_bank_type`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1069 | ตัวย่อในสมุดเงินฝาก (`menu_book_bank_trans_type`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1070 | กำหนดวงเงินสดย่อย (`menu_petty_cash`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1071 | กำหนดประเภทรายได้ (`menu_income_list`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1072 | กำหนดประเภทค่าใช้จ่าย (`menu_expenses_list`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1073 | ประเภทบัตรเครดิต (`menu_setup_credit_type`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1074 | รายละเอียดคูปอง (`menu_coupon_list`) | `createPosSetupScreen` | [[scr-pos-setup-control]] |
| 1075 | กำหนดธนบัตร (`menu_setup_banknotes`) | `StandardMasterScreen` | [[scr-standard-master]] |
| **1076-1080** | **ตั้งค่าระบบสินทรัพย์ถาวร** (โฟลเดอร์ `menu_setup_asset`) | | |
| 1076 | กำหนดประเภทสินทรัพย์ (`menu_asset_setup_type`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1077 | กำหนดตำแหน่งที่ตั้งสินทรัพย์ (`menu_asset_setup_location`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1078 | กำหนดการบำรุงรักษาสินทรัพย์ (`menu_asset_setup_maintain`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1079 | กำหนดหน่วยการบำรุงรักษาสินทรัพย์ (`menu_asset_setup_maintain_unit`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1080 | กำหนดประเภทการตัดจำหน่าย (`menu_asset_setup_retire`) | `StandardMasterScreen` | [[scr-standard-master]] |
| **1081-1092** | **ตั้งค่าระบบบัญชีและภาษี** (โฟลเดอร์ `menu_setup_gl`) | | |
| 1081 | กำหนดงวดบัญชี (`menu_account_period`) | `MasterDetailScreen` | [[scr-master-detail]] |
| 1082 | กำหนดสมุดบัญชี (`menu_setup_gl_journal_book`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1083 | กำหนดประเภทบัญชี (`menu_setup_gl_account_type`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1084 | กำหนดกลุ่มบัญชี (`menu_setup_gl_account_group`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1085 | กำหนดกลุ่มบัญชีกระแสเงินสด (`menu_setup_gl_group_for_cash_flow`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1086 | กำหนดกลุ่มภาษี (`menu_tax_group`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1087 | กำหนดประเภทภาษี (`menu_tax_type`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1088 | กำหนดหน่วยงาน (`menu_setup_side`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1089 | กำหนดโครงการ (`menu_setup_project`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1090 | กำหนดงาน (`menu_setup_job`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1091 | กำหนดการจัดสรร (`menu_setup_allocate`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 1092 | ออกแบบงบการเงิน (`menu_gl_report_design`) | `createReportDesignerScreen` | [[scr-report-designer]] |
| 1093 | สร้าง/แก้ไขแบบฟอร์ม (`menu_form_edit`) | `createReportDesignerScreen` | [[scr-report-designer]] |
| 1094 | ออกแบบรายงาน (`fast_report_designer`) | `createReportDesignerScreen` | [[scr-report-designer]] |
| **1095-1105** | **จัดการฐานข้อมูลและสิทธิ์ผู้ใช้** (โฟลเดอร์ `menu_database`) | | |
| 1095 | เปลี่ยนรหัสผ่าน (`menu_change_password`) | `ChangePasswordScreen` | [[scr-change-password]] |
| 1096 | กำหนดรูปแบบการค้นหาข้อมูล (`menu_view_manager_custom`) | `MasterDetailScreen` | [[scr-master-detail]] |
| 1097 | ผังการทำงานระบบ (`menu_system_flow`) | `SystemProcessWorkbenchScreen` (โหมด system_tool) | [[scr-system-process-workbench]] |
| 1098 | สำรองข้อมูล (`data_backup`) | `SystemProcessWorkbenchScreen` (โหมด system_tool) | [[scr-system-process-workbench]] |
| 1099 | นำข้อมูลสำรองกลับมาใช้ (`data_restore`) | `SystemProcessWorkbenchScreen` (โหมด system_tool) | [[scr-system-process-workbench]] |
| 1100 | ตรวจสอบโครงสร้างฐานข้อมูล (`menu_verify_database`) | `UniversalReportScreen` (โหมด sql_utility) | [[scr-universal-report]] |
| 1101 | ตรวจสอบและปรับปรุงข้อมูล (`menu_checking_ic_trans`) | `SystemProcessWorkbenchScreen` (โหมด system_tool) | [[scr-system-process-workbench]] |
| 1102 | ลดขนาดข้อมูล (`menu_shink_database`) | `SystemProcessWorkbenchScreen` (โหมด system_tool) | [[scr-system-process-workbench]] |
| 1103 | แสดงโครงสร้างฐานข้อมูลทั้งหมด (`menu_database_struct`) | `UniversalReportScreen` (โหมด sql_utility) | [[scr-universal-report]] |
| 1104 | ใช้คำสั่ง Query (`menu_query`) | `UniversalReportScreen` (โหมด sql_utility) | [[scr-universal-report]] |
| 1105 | สร้างคำสั่ง Query (`menu_gen_qeury`) | `UniversalReportScreen` (โหมด sql_utility) | [[scr-universal-report]] |
| **1106-1109** | **เปลี่ยนรหัสหลัก (สินค้า/เจ้าหนี้/ลูกหนี้/บัญชี)** (โฟลเดอร์ `menu_change_code`) | | |
| 1106 | เปลี่ยนรหัสสินค้า (`menu_change_code_item`) | `SystemProcessWorkbenchScreen` (โหมด change_code) | [[scr-system-process-workbench]] |
| 1107 | เปลี่ยนรหัสเจ้าหนี้ (`menu_change_code_supplier`) | `SystemProcessWorkbenchScreen` (โหมด change_code) | [[scr-system-process-workbench]] |
| 1108 | เปลี่ยนรหัสลูกหนี้ (`menu_change_code_customer`) | `SystemProcessWorkbenchScreen` (โหมด change_code) | [[scr-system-process-workbench]] |
| 1109 | เปลี่ยนรหัสผังบัญชี (`menu_change_gl_account_code`) | `SystemProcessWorkbenchScreen` (โหมด change_code) | [[scr-system-process-workbench]] |
| **1110-1118** | **นำเข้าข้อมูล แบบฟอร์ม และรูปภาพ** (โฟลเดอร์ `menu_tools`) | | |
| 1110 | หน้าจอเริ่มต้น (`menu_welcome_page`) | `SystemProcessWorkbenchScreen` (โหมด system_tool) | [[scr-system-process-workbench]] |
| 1111 | นำเข้ารูปภาพสินค้า (`menu_import_ic_picture`) | `ItemPictureScreen` | [[scr-item-pictures]] |
| 1112 | นำเข้าข้อมูลหลัก (`menu_import_data_master`) | `SystemProcessWorkbenchScreen` (โหมด system_tool) | [[scr-system-process-workbench]] |
| 1113 | นำเข้าแบบฟอร์ม (`menu_import_formdesign`) | `createReportDesignerScreen` | [[scr-report-designer]] |
| 1114 | นำเข้ารายงาน (`menu_import_report`) | `createReportDesignerScreen` | [[scr-report-designer]] |
| 1115 | นำเข้ารายงานสาขา (`menu_import_report_branch`) | `createReportDesignerScreen` | [[scr-report-designer]] |
| 1116 | นำเข้าข้อมูลจากรูปภาพ (`menu_import_from_image`) | `SystemProcessWorkbenchScreen` (โหมด system_tool) | [[scr-system-process-workbench]] |
| 1117 | ย้ายรูปภาพสินค้า (`menu_tools_image_transfer`) | `SystemProcessWorkbenchScreen` (โหมด system_tool) | [[scr-system-process-workbench]] |
| 1118 | แสดง Resource Language (`menu_resource_view`) | `SystemProcessWorkbenchScreen` (โหมด system_tool) | [[scr-system-process-workbench]] |
| **1119-1126** | **ประวัติการใช้งานและตรวจสอบระบบ (Audit Log)** (โฟลเดอร์ `menu_audit`) | | |
| 1119 | เข้าใช้ฐานข้อมูล (`menu_audit_login`) | `SystemProcessWorkbenchScreen` (โหมด audit_log) | [[scr-system-process-workbench]] |
| 1120 | เข้าออกระบบ (`menu_audit_menu`) | `SystemProcessWorkbenchScreen` (โหมด audit_log) | [[scr-system-process-workbench]] |
| 1121 | ข้อมูลรายวัน (`menu_audit_trans`) | `SystemProcessWorkbenchScreen` (โหมด audit_log) | [[scr-system-process-workbench]] |
| 1122 | ข้อมูลหลัก (`menu_audit_master`) | `SystemProcessWorkbenchScreen` (โหมด audit_log) | [[scr-system-process-workbench]] |
| 1123 | ประวัติการแก้ไขรายวัน (`menu_trans_full_logs`) | `SystemProcessWorkbenchScreen` (โหมด audit_log) | [[scr-system-process-workbench]] |
| 1124 | แสดงหน้าจอการใช้งาน (`menu_view_capture_screen_realtime`) | `SystemProcessWorkbenchScreen` (โหมด audit_log) | [[scr-system-process-workbench]] |
| 1125 | แสดงหน้าจอการใช้งาน (ย้อนหลัง) (`menu_view_capture_screen`) | `SystemProcessWorkbenchScreen` (โหมด audit_log) | [[scr-system-process-workbench]] |
| 1126 | รายงานพนักงานเรียงตามกลุ่ม (`menu_report_employee_group`) | `createReportScreen` | [[scr-universal-report]] |

### 2. สินค้า (คลัง) (`menu_ic`) รหัส 2001-2136

มีเมนูใบ 136 ใบ (เป็นรายงานผ่านจอรายงานกลาง 80 ใบ)

| รหัส | เมนู | หน้าจอ | โน้ต |
|---|---|---|---|
| **2001-2024** | **ทะเบียนข้อมูลสินค้าและคลังที่เก็บ** (โฟลเดอร์ `menu_ic_item_menu`) | | |
| 2001 | ข้อมูลสินค้า (`menu_ic_item_detail`) | `ItemScreen` | [[scr-item-master]] |
| 2002 | ข้อมูลสินค้าเพิ่มเติม (`menu_ic_item_detail_2`) | `ItemDetail2Screen` | [[scr-item-detail-2]] |
| 2003 | รายละเอียดสินค้า (`menu_ic_description`) | `ItemDescriptionScreen` | [[scr-item-description]] |
| 2004 | แก้ไขรายละเอียด(เร็ว) (`menu_ic_description_fast`) | `ItemDescriptionFastScreen` | [[scr-item-description]] |
| 2005 | กำหนดรูปภาพ (`menu_ic_item_picture`) | `ItemPictureScreen` | [[scr-item-pictures]] |
| 2006 | ทะเบียน Serial Number (`menu_ic_item_serial`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 2007 | สินค้าชุด (`menu_ic_item_set`) | `MasterDetailScreen` | [[scr-master-detail]] |
| 2008 | กำหนดสินค้า (`menu_ic_item_for_sync`) | `ItemScreen` | [[scr-item-master]] |
| 2009 | กำหนดบาร์โค้ดสินค้า (`menu_ic_item_barcode`) | `BarcodeSetupScreen` | [[scr-barcode-setup]] |
| 2010 | เพิ่มบาร์โค๊ดสินค้าแบบเร็ว (`menu_ic_item_add_barcode_fast`) | `BarcodeFastAddScreen` | [[scr-barcode-setup]] |
| 2011 | กำหนดรูปภาพตามบาร์โค้ด (`menu_ic_item_barcode_picture`) | `ItemPictureScreen` | [[scr-item-pictures]] |
| 2012 | กำหนดส่วนลดตามบาร์โค๊ด (`menu_ic_item_barcode_discount`) | `BarcodeDiscountScreen` | [[scr-barcode-discount]] |
| 2013 | กำหนดส่วนลดตามบาร์โค๊ด (เร็ว) (`menu_ic_item_multibarcode_discount`) | `MultiBarcodeDiscountScreen` | [[scr-barcode-discount]] |
| 2014 | ปรับราคาสินค้า (`menu_ic_modify_price`) | `ModifyPriceScreen` | [[scr-modify-price]] |
| 2015 | กำหนดสูตรโปรโมชั่น (`pos_promotion_formula`) | `MasterDetailScreen` | [[scr-master-detail]] |
| 2016 | กำหนดแคมเปญท้ายใบเสร็จ (`menu_setup_pos_slip_campaign`) | `MasterDetailScreen` | [[scr-master-detail]] |
| 2017 | ตรวจสอบราคาสินค้า (`check_price`) | `CheckPriceScreen` | [[scr-stock-check-tools]] |
| 2018 | ตรวจสอบบาร์โค๊ดจาก Text File (`menu_ic_item_barcode_checker`) | `BarcodeCheckerScreen` | [[scr-stock-check-tools]] |
| 2019 | ตรวจสอบบาร์โค๊ดตามมาตรฐาน EAN13 (`menu_ic_item_barcode_checker_ean13`) | `Ean13CheckerScreen` | [[scr-barcode-setup]] |
| 2020 | พิมพ์บาร์โค๊ดด้วยเครื่องพิมพ์ทั่วไป (`menu_ic_item_barcode_laser_print`) | `BarcodePrintScreen` | [[scr-barcode-print]] |
| 2021 | คลังที่เก็บสินค้า (`menu_ic_warehouse_locaton`) | `createMasterScreen` | [[scr-warehouse]] |
| 2022 | กำหนดกลุ่มที่เก็บ (`ic_warehouse_and_location_group`) | `createMasterScreen` | [[scr-warehouse]] |
| 2023 | กำหนดลำดับการค้นหา (`menu_ic_item_level`) | `ItemLevelScreen` | [[scr-item-description]] |
| 2024 | กำหนดลำดับการค้นหา (เร็ว) (`menu_ic_multi_item_level`) | `ItemLevelScreen` | [[scr-item-description]] |
| 2025 | กำหนดราคาซื้อ (`menu_ic_purchase_price`) | `MasterDetailScreen` | [[scr-master-detail]] |
| 2026 | ของแถมซื้อ (`menu_ic_purchase_premium`) | `MasterDetailScreen` | [[scr-master-detail]] |
| 2027 | กำหนดราคาขายมาตรฐาน (`menu_ic_item_saleprice`) | `UniversalReportScreen` (โหมด check_price) | [[scr-universal-report]] |
| 2028 | กำหนดราคาขายทั่วไป (`menu_ic_item_saleprice_2`) | `UniversalReportScreen` (โหมด check_price) | [[scr-universal-report]] |
| 2029 | กำหนดส่วนลดสินค้า (`menu_ic_discount`) | `MasterDetailScreen` | [[scr-master-detail]] |
| 2030 | กำหนดรูปแบบสูตรราคาขาย (`menu_ic_item_formula_template`) | `MasterDetailScreen` | [[scr-master-detail]] |
| 2031 | กำหนดสูตรราคาขาย (`menu_ic_item_saleprice_formula`) | `MasterDetailScreen` | [[scr-master-detail]] |
| 2032 | ราคาขายสินค้า (`menu_ic_all_price`) | `MasterDetailScreen` | [[scr-master-detail]] |
| 2033 | สินค้า/วัตถุดิบ คงเหลือยกมา (`menu_ic_stk_balance`) | `StockBeginningBalanceScreen` | [[scr-stock-beginning-balance]] |
| 2034 | รับสินค้าสำเร็จรูป (`menu_ic_finish_receive`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 2035 | ขอเบิกสินค้า/วัตถุดิบ (`menu_ic_request_issue`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 2036 | เบิกสินค้า/วัตถุดิบ (`menu_ic_issue`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 2037 | รับคืนสินค้า/วัตถุดิบ จากการเบิก (`menu_ic_return_receive`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 2038 | ขอโอนสินค้า/วัตถุดิบ (`menu_ic_request_transfer`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 2039 | โอนสินค้า/วัตถุดิบ (`menu_ic_transfer_wh_out`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 2040 | ปรับปรุงสต็อกสินค้า/วัตถุดิบ (เพิ่ม) (`menu_ic_stk_adjust`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 2041 | ปรับปรุงสต็อกสินค้า/วัตถุดิบ (ลด) (`menu_ic_stk_adjust_subtract`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| **2042-2047** | **ตรวจนับสต็อกและปรับปรุงจากการตรวจนับ** (โฟลเดอร์ `menu_ic_stk_count_main`) | | |
| 2042 | ขอตรวจนับสินค้า (`menu_ic_request_stk_count`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 2043 | ตรวจนับสินค้า (`menu_ic_stk_count`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 2044 | ตรวจสอบสินค้า Serial Number (`menu_ic_serialnumber_checker`) | `SerialStockCountScreen` | [[scr-stock-check-tools]] |
| 2045 | ปรับปรุงสต็อกสินค้า/วัตถุดิบอัตโนมัติ (`menu_ic_stk_adjust_auto`) | `StockAutoAdjustLotScreen` | [[scr-lot-adjust]] |
| 2046 | ปรับปรุงสต็อกสินค้า/วัตถุดิบอัตโนมัติ (สินค้า Lot) (`menu_ic_stk_adjust_lot_auto`) | `StockAutoAdjustLotScreen` | [[scr-lot-adjust]] |
| 2047 | ปรับปรุงมูลค่าสินค้า Lot คงค้าง (`menu_ic_adjust_stock_lot_amount`) | `LotAmountAdjustScreen` | [[scr-lot-adjust]] |
| 2048 | บันทึกรูปภาพเอกสาร (`menu_ic_document_picture`) | `DocumentPictureScreen` | [[scr-item-pictures]] |
| 2049 | คำนวณยอดสต๊อกใหม่ (`menu_ic_recalc`) | `SystemProcessWorkbenchScreen` (โหมด ic_recalc) | [[scr-system-process-workbench]] |
| 2050 | ประมวลผลเฉลี่ยต้นทุนแฝง (`menu_ic_hidden_cost_process`) | `HiddenCostScreen` | [[scr-hidden-cost]] |
| **2051-2070** | **สอบถามและวิเคราะห์ข้อมูลสินค้า (บนหน้าจอ)** (โฟลเดอร์ `menu_ic_info`) | | |
| 2051-2065 | รายงาน/สอบถาม 15 ใบ | `UniversalReportScreen` (โหมด report_ic) | [[scr-universal-report]] |
| 2066 | ตรวจสอบ Serial มีปัญหา (`menu_ic_serial_analyze`) | `SerialAnalyzeScreen` | [[scr-stock-check-tools]] |
| 2067-2070 | รายงาน/สอบถาม 4 ใบ | `UniversalReportScreen` (โหมด report_ic) | [[scr-universal-report]] |
| **2071-2077** | **ยกเลิกเอกสารคลังสินค้า (รับ/เบิก/โอน/ปรับปรุง)** (โฟลเดอร์ `menu_ic_report_4`) | | |
| 2071 | ยกเลิกรับสินค้าสำเร็จรูป (`menu_ic_finish_receive_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 2072 | ยกเลิกขอเบิกสินค้า/วัตถุดิบ (`menu_ic_request_issue_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 2073 | ยกเลิกใบเบิกสินค้า/วัตถุดิบ (`menu_ic_issue_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 2074 | ยกเลิกรับคืนสินค้า/วัตถุดิบ จากการเบิก (`menu_ic_return_receive_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 2075 | ยกเลิกโอนสินค้า/วัตถุดิบ (`menu_ic_transfer_wh_out_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 2076 | ยกเลิกปรับปรุงสต๊อกสินค้า/วัตถุดิบ (เกิน) (`menu_ic_stk_adjust_over_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 2077 | ยกเลิกปรับปรุงสต๊อกสินค้า/วัตถุดิบ (ขาด) (`menu_ic_stk_adjust_lost_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| **2078-2085** | **รายงานข้อมูลสินค้าและราคา** (โฟลเดอร์ `menu_ic_report_cancel_1`) | | |
| 2078-2085 | รายงาน/สอบถาม 8 ใบ | `UniversalReportScreen` (โหมด report_ic) | [[scr-universal-report]] |
| **2086-2096** | **รายงานรับ-เบิก-โอน-ตรวจนับ-ปรับปรุงสต็อก** (โฟลเดอร์ `menu_ic_report_5`) | | |
| 2086-2096 | รายงาน/สอบถาม 11 ใบ | `UniversalReportScreen` (โหมด report_ic) | [[scr-universal-report]] |
| **2097-2101** | **รายงานสรุปสถานะและบัญชีคุมสินค้า** (โฟลเดอร์ `menu_report_ic`) | | |
| 2097-2101 | รายงาน/สอบถาม 5 ใบ | `UniversalReportScreen` (โหมด report_ic) | [[scr-universal-report]] |
| **2102-2117** | **รายงานวิเคราะห์เคลื่อนไหวและจุดสั่งซื้อ** (โฟลเดอร์ `menu_ic_report_absolute_1`) | | |
| 2102-2117 | รายงาน/สอบถาม 16 ใบ | `UniversalReportScreen` (โหมด report_ic) | [[scr-universal-report]] |
| **2118-2129** | **รายงานวิเคราะห์กำไรขั้นต้น** (โฟลเดอร์ `menu_ic_report_info_stk_profit_root`) | | |
| 2118-2129 | รายงาน/สอบถาม 12 ใบ | `UniversalReportScreen` (โหมด report_ic) | [[scr-universal-report]] |
| **2130-2135** | **รายงานเอกสารยกเลิก (คลังสินค้า)** (โฟลเดอร์ `menu_ic_report_cancel_2`) | | |
| 2130-2135 | รายงาน/สอบถาม 6 ใบ | `UniversalReportScreen` (โหมด report_ic) | [[scr-universal-report]] |
| 2136 | รายงาน/สอบถาม 1 ใบ | `UniversalReportScreen` (โหมด report_ic) | [[scr-universal-report]] |

### 3. ซื้อ (`menu_po`) รหัส 3001-3077

มีเมนูใบ 77 ใบ (เป็นรายงานผ่านจอรายงานกลาง 44 ใบ)

| รหัส | เมนู | หน้าจอ | โน้ต |
|---|---|---|---|
| 3001 | ใบเสนอซื้อสินค้า (PR) (`menu_purchase_requisition`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 3002 | อนุมัติใบเสนอซื้อสินค้า (`menu_purchase_requisition_approval`) | `UniversalCancelConfirmScreen` (โหมด อนุมัติ) | [[scr-cancel-confirm]] |
| 3003 | ใบสั่งซื้อสินค้า (PO) (`menu_po_purchase_order`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 3004 | อนุมัติใบสั่งซื้อสินค้า (`menu_po_purchase_order_approve`) | `UniversalCancelConfirmScreen` (โหมด อนุมัติ) | [[scr-cancel-confirm]] |
| 3005 | จ่ายเงินล่วงหน้ายกมา (`menu_po_advance_payment_balance`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 3006 | จ่ายเงินล่วงหน้า (`menu_po_deposit_payment_1`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 3007 | รับคืนจ่ายเงินล่วงหน้า (`menu_po_deposit_return_1`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 3008 | จ่ายเงินมัดจำยกมา (`menu_po_deposit_money_balance`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 3009 | จ่ายเงินมัดจำ (`menu_po_deposit_payment_2`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 3010 | รับคืนจ่ายเงินมัดจำ (`menu_po_deposit_return_2`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 3011 | ซื้อสินค้า/ตั้งหนี้ซื้อ (`menu_po_purchase_billing`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 3012 | ส่งคืนสินค้า/ลดหนี้ซื้อ (`menu_po_credit_note`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 3013 | เพิ่มหนี้ซื้อ/ราคาผิด (`menu_po_addition_debt`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| **3014-3018** | **ซื้อสินค้าแบบทะยอยรับ (รับของก่อนตั้งหนี้)** (โฟลเดอร์ `menu_po_purchase_partial`) | | |
| 3014 | รับสินค้าตามใบสั่งซื้อ (ทะยอยรับ) (`menu_po_purchase_partial_item`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 3015 | ส่งคืนสินค้าจากการรับ (ทะยอยรับ) (`menu_po_purchase_partial_item_debit`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 3016 | ตั้งหนี้ซื้อจากการรับสินค้า (`menu_po_purchase_partial_1`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 3017 | เพิ่มหนี้ซื้อจากใบตั้งหนี้ (`menu_po_purchase_partial_3`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 3018 | ลดหนี้ซื้อจากใบตั้งหนี้ (`menu_po_purchase_partial_2`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 3019 | บันทึกรูปภาพเอกสารซื้อ (`menu_po_doc_picture`) | `DocumentPictureScreen` | [[scr-item-pictures]] |
| **3020-3033** | **ยกเลิกเอกสารซื้อ มัดจำ และทะยอยรับ** (โฟลเดอร์ `menu_purchase_request_report`) | | |
| 3020 | ยกเลิกใบเสนอซื้อสินค้า (`menu_cancel_purchase_requisition`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 3021 | ยกเลิกใบสั่งซื้อสินค้า (`menu_po_purchase_order_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 3022 | ยกเลิกจ่ายเงินล่วงหน้า (`menu_po_deposit_payment_1_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 3023 | ยกเลิกรับคืนจ่ายเงินล่วงหน้า (`menu_po_deposit_return_1_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 3024 | ยกเลิกจ่ายเงินมัดจำ (`menu_po_deposit_payment_2_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 3025 | ยกเลิกรับคืนจ่ายเงินมัดจำ (`menu_po_deposit_return_2_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 3026 | ยกเลิกซื้อสินค้า/ตั้งหนี้ซื้อ (`menu_po_purchase_billing_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 3027 | ยกเลิกส่งคืนสินค้า/ลดหนี้ซื้อ (`menu_po_credit_note_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 3028 | ยกเลิกเพิ่มหนี้ซื้อ/ราคาผิด (`menu_po_addition_debt_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 3029 | ยกเลิกรับสินค้าตามใบสั่งซื้อ (`menu_po_purchase_partial_item_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 3030 | ยกเลิกส่งคืนสินค้าจากการรับ (`menu_po_purchase_partial_item_debit_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 3031 | ยกเลิกตั้งหนี้จากการรับสินค้า (`menu_po_purchase_partial_1_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 3032 | ยกเลิกเพิ่มหนี้จากใบตั้งหนี้ (`menu_po_purchase_partial_3_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 3033 | ยกเลิกลดหนี้จากใบตั้งหนี้ (`menu_po_purchase_partial_2_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| **3034-3040** | **รายงานใบเสนอซื้อและใบสั่งซื้อ (PR / PO)** (โฟลเดอร์ `menu_po_purchase_order_report`) | | |
| 3034-3040 | รายงาน/สอบถาม 7 ใบ | `UniversalReportScreen` (โหมด report_po) | [[scr-universal-report]] |
| **3041-3048** | **รายงานเงินล่วงหน้าและเงินมัดจำจ่าย** (โฟลเดอร์ `menu_po_deposit_payment_1_report`) | | |
| 3041-3048 | รายงาน/สอบถาม 8 ใบ | `UniversalReportScreen` (โหมด report_po) | [[scr-universal-report]] |
| **3049-3056** | **รายงานการซื้อ ทะยอยรับ และเพิ่ม/ลดหนี้** (โฟลเดอร์ `menu_po_purchase_report`) | | |
| 3049-3056 | รายงาน/สอบถาม 8 ใบ | `UniversalReportScreen` (โหมด report_po) | [[scr-universal-report]] |
| **3057-3064** | **รายงานสรุปยอดซื้อ** (โฟลเดอร์ `menu_po_report_absolute`) | | |
| 3057-3064 | รายงาน/สอบถาม 8 ใบ | `UniversalReportScreen` (โหมด report_po) | [[scr-universal-report]] |
| **3065-3067** | **รายงานวิเคราะห์การซื้อ** (โฟลเดอร์ `menu_po_report_analysist`) | | |
| 3065-3067 | รายงาน/สอบถาม 3 ใบ | `UniversalReportScreen` (โหมด report_po) | [[scr-universal-report]] |
| **3068-3076** | **รายงานเอกสารยกเลิก (ระบบซื้อ)** (โฟลเดอร์ `menu_po_deposit_payment_2_report`) | | |
| 3068-3076 | รายงาน/สอบถาม 9 ใบ | `UniversalReportScreen` (โหมด report_po) | [[scr-universal-report]] |
| 3077 | รายงาน/สอบถาม 1 ใบ | `UniversalReportScreen` (โหมด report_po) | [[scr-universal-report]] |

### 4. ขาย (`menu_so`) รหัส 4001-4074

มีเมนูใบ 74 ใบ (เป็นรายงานผ่านจอรายงานกลาง 47 ใบ)

| รหัส | เมนู | หน้าจอ | โน้ต |
|---|---|---|---|
| 4001 | ใบเสนอราคาขาย (`menu_so_quotation_order`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 4002 | อนุมัติใบเสนอราคาขาย (`menu_so_quotation_approve`) | `UniversalCancelConfirmScreen` (โหมด อนุมัติ) | [[scr-cancel-confirm]] |
| 4003 | ใบสั่งจองสินค้า (`menu_so_inquiry_order`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 4004 | อนุมัติใบสั่งจองสินค้า (`menu_so_inquiry_order_approve`) | `UniversalCancelConfirmScreen` (โหมด อนุมัติ) | [[scr-cancel-confirm]] |
| 4005 | ใบสั่งขายสินค้า (`menu_so_sale_order`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 4006 | อนุมัติใบสั่งขายสินค้า (`menu_so_sale_order_approve`) | `UniversalCancelConfirmScreen` (โหมด อนุมัติ) | [[scr-cancel-confirm]] |
| 4007 | รับเงินล่วงหน้ายกมา (`menu_so_advance_money_balance`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 4008 | รับเงินล่วงหน้า (`menu_so_deposit_receive_1`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 4009 | คืนเงินรับล่วงหน้า (`menu_so_deposit_return_1`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 4010 | รับเงินมัดจำยกมา (`menu_so_deposit_money_balance`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 4011 | รับเงินมัดจำ (`menu_so_deposit_receive_2`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 4012 | คืนเงินมัดจำ (`menu_so_deposit_return_2`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 4013 | ขายสินค้า/บริการ (`menu_so_invoice`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 4014 | รับคืนสินค้า/ลดหนี้ขาย (`menu_so_credit_note`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 4015 | เพิ่มหนี้ขาย/ราคาผิด (`menu_so_invoice_add`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 4016 | ส่งข้อมูล e-Tax (`menu_so_send_etax`) | `SystemProcessWorkbenchScreen` (โหมด system_tool) | [[scr-system-process-workbench]] |
| 4017 | บันทึกรูปภาพเอกสารขาย (`menu_so_doc_picture`) | `DocumentPictureScreen` | [[scr-item-pictures]] |
| **4018-4027** | **ยกเลิกเอกสารขายและเงินมัดจำรับ** (โฟลเดอร์ `menu_so_quotation_report`) | | |
| 4018 | ยกเลิกใบเสนอราคาขาย (`menu_so_quotation_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 4019 | ยกเลิกใบสั่งจองสินค้า (`menu_so_inquiry_order_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 4020 | ยกเลิกใบสั่งขายสินค้า (`menu_so_sale_order_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 4021 | ยกเลิกรับเงินล่วงหน้า (`menu_so_deposit_receive_1_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 4022 | ยกเลิกคืนเงินรับล่วงหน้า (`menu_so_deposit_return_1_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 4023 | ยกเลิกรับเงินมัดจำ (`menu_so_deposit_receive_2_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 4024 | ยกเลิกคืนเงินมัดจำ (`menu_so_deposit_return_2_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 4025 | ยกเลิกขายสินค้า/บริการ (`menu_so_invoice_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 4026 | ยกเลิกรับคืนสินค้า/ลดหนี้ขาย (`menu_so_credit_note_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 4027 | ยกเลิกเพิ่มหนี้ขาย/ราคาผิด (`menu_so_invoice_add_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| **4028-4036** | **รายงานใบเสนอราคา สั่งจอง และสั่งขาย** (โฟลเดอร์ `menu_so_sale_order_report`) | | |
| 4028-4036 | รายงาน/สอบถาม 9 ใบ | `UniversalReportScreen` (โหมด report_so) | [[scr-universal-report]] |
| **4037-4044** | **รายงานเงินล่วงหน้าและเงินมัดจำรับ** (โฟลเดอร์ `menu_so_deposit_report`) | | |
| 4037-4044 | รายงาน/สอบถาม 8 ใบ | `UniversalReportScreen` (โหมด report_so) | [[scr-universal-report]] |
| **4045-4048** | **รายงานการขาย เพิ่มหนี้ และรับคืน/ลดหนี้** (โฟลเดอร์ `menu_so_report`) | | |
| 4045-4048 | รายงาน/สอบถาม 4 ใบ | `UniversalReportScreen` (โหมด report_so) | [[scr-universal-report]] |
| **4049-4056** | **รายงานสรุปยอดขายและรายงาน อย. (ขย.)** (โฟลเดอร์ `menu_so_report_absolute`) | | |
| 4049-4056 | รายงาน/สอบถาม 8 ใบ | `UniversalReportScreen` (โหมด report_so) | [[scr-universal-report]] |
| **4057-4063** | **รายงานวิเคราะห์การขายและกำไร** (โฟลเดอร์ `menu_so_report_analysist`) | | |
| 4057-4063 | รายงาน/สอบถาม 7 ใบ | `UniversalReportScreen` (โหมด report_so) | [[scr-universal-report]] |
| **4064-4073** | **รายงานเอกสารยกเลิก (ระบบขาย)** (โฟลเดอร์ `menu_so_inquiry_order_report`) | | |
| 4064-4073 | รายงาน/สอบถาม 10 ใบ | `UniversalReportScreen` (โหมด report_so) | [[scr-universal-report]] |
| 4074 | รายงาน/สอบถาม 1 ใบ | `UniversalReportScreen` (โหมด report_so) | [[scr-universal-report]] |

### 5. เจ้าหนี้ (`menu_ap`) รหัส 5001-5050

มีเมนูใบ 50 ใบ (เป็นรายงานผ่านจอรายงานกลาง 31 ใบ)

| รหัส | เมนู | หน้าจอ | โน้ต |
|---|---|---|---|
| **5001-5006** | **ทะเบียนเจ้าหนี้ คู่ค้า และที่อยู่จัดส่ง** (โฟลเดอร์ `menu_ap_main`) | | |
| 5001 | กำหนดเจ้าหนี้ (`menu_ap_detail`) | `SupplierScreen` | [[scr-supplier]] |
| 5002 | รายละเอียดเจ้าหนี้ (`menu_ap_detail_2`) | `SupplierDetailScreen` | [[scr-supplier]] |
| 5003 | ข้อมูลคู่ค้า (`menu_ap_partner_detail`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 5004 | รายงาน/สอบถาม 1 ใบ | `UniversalReportScreen` (โหมด report_ap) | [[scr-universal-report]] |
| 5005 | พิมพ์ที่อยู่จัดส่งสินค้า (`menu_ap_transport_label_print`) | `TransportLabelPrintScreen` | [[scr-transport-label-print]] |
| 5006 | นำเข้าที่อยู่จัดส่งเจ้าหนี้ (`menu_import_ap_transport_label`) | `SystemProcessWorkbenchScreen` (โหมด system_tool) | [[scr-system-process-workbench]] |
| 5007 | ตั้งหนี้ยกมา (เจ้าหนี้) (`menu_ap_debt_balance`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 5008 | เพิ่มหนี้ยกมา (เจ้าหนี้) (`menu_ap_increase_debt`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 5009 | ลดหนี้ยกมา (เจ้าหนี้) (`menu_ap_cn_balance`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 5010 | ตั้งหนี้อื่นๆ (เจ้าหนี้) (`menu_ap_debt_other`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 5011 | เพิ่มหนี้อื่นๆ (เจ้าหนี้) (`menu_ap_increase_debt_other`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 5012 | ลดหนี้อื่นๆ (เจ้าหนี้) (`menu_ap_cn_debt_other`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 5013 | ใบรับวางบิล (เจ้าหนี้) (`menu_ap_pay_bill`) | `UniversalTransScreen` (ap_ar_trans) | [[scr-universal-trans]] |
| 5014 | จ่ายชำระหนี้ (เจ้าหนี้) (`menu_ap_debt_billing`) | `UniversalTransScreen` (ap_ar_trans) | [[scr-universal-trans]] |
| 5015 | บันทึกรูปภาพเอกสารเจ้าหนี้ (`menu_ap_doc_picture`) | `DocumentPictureScreen` | [[scr-item-pictures]] |
| **5016-5020** | **ยกเลิกเอกสารเจ้าหนี้ (ตั้งหนี้อื่น/วางบิล/จ่ายชำระ)** (โฟลเดอร์ `menu_ap_other`) | | |
| 5016 | ยกเลิกตั้งหนี้อื่นๆ (เจ้าหนี้) (`menu_ap_cancel_debt_balance_other`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 5017 | ยกเลิกเพิ่มหนี้อื่นๆ (เจ้าหนี้) (`menu_ap_cancel_increase_debt_other`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 5018 | ยกเลิกลดหนี้อื่นๆ (เจ้าหนี้) (`menu_ap_cancel_cn_debt_other`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 5019 | ยกเลิกใบรับวางบิล (เจ้าหนี้) (`menu_ap_cancel_pay_bill`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 5020 | ยกเลิกจ่ายชำระหนี้ (เจ้าหนี้) (`menu_ap_cancel_debt_billing`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| **5021-5027** | **รายงานทะเบียนเจ้าหนี้ ยอดยกมา และตั้งหนี้อื่นๆ** (โฟลเดอร์ `menu_ap_balance_report`) | | |
| 5021-5027 | รายงาน/สอบถาม 7 ใบ | `UniversalReportScreen` (โหมด report_ap) | [[scr-universal-report]] |
| **5028-5031** | **รายงานใบรับวางบิลและการจ่ายชำระหนี้** (โฟลเดอร์ `menu_ap_report_cancel`) | | |
| 5028-5031 | รายงาน/สอบถาม 4 ใบ | `UniversalReportScreen` (โหมด report_ap) | [[scr-universal-report]] |
| **5032-5038** | **รายงานสรุปยอดค้างชำระและการจ่ายเงิน** (โฟลเดอร์ `menu_ap_report_absolute`) | | |
| 5032-5038 | รายงาน/สอบถาม 7 ใบ | `UniversalReportScreen` (โหมด report_ap) | [[scr-universal-report]] |
| **5039-5044** | **รายงานวิเคราะห์อายุหนี้และเคลื่อนไหวเจ้าหนี้** (โฟลเดอร์ `menu_ap_analytics`) | | |
| 5039-5044 | รายงาน/สอบถาม 6 ใบ | `UniversalReportScreen` (โหมด report_ap) | [[scr-universal-report]] |
| **5045-5049** | **รายงานเอกสารยกเลิก (ระบบเจ้าหนี้)** (โฟลเดอร์ `menu_ap_partner`) | | |
| 5045-5049 | รายงาน/สอบถาม 5 ใบ | `UniversalReportScreen` (โหมด report_ap) | [[scr-universal-report]] |
| 5050 | รายงาน/สอบถาม 1 ใบ | `UniversalReportScreen` (โหมด report_ap) | [[scr-universal-report]] |

### 6. ลูกหนี้ (`menu_ar`) รหัส 6001-6050

มีเมนูใบ 50 ใบ (เป็นรายงานผ่านจอรายงานกลาง 26 ใบ)

| รหัส | เมนู | หน้าจอ | โน้ต |
|---|---|---|---|
| **6001-6011** | **ทะเบียนลูกหนี้ สมาชิก และแต้มสะสม** (โฟลเดอร์ `menu_ar_main`) | | |
| 6001 | กำหนดลูกหนี้ (`menu_ar_detail`) | `CustomerScreen` | [[scr-customer]] |
| 6002 | รายละเอียดลูกหนี้ (`menu_ar_detail_2`) | `CustomerDetailScreen` | [[scr-customer-detail]] |
| 6003 | รายละเอียดสมาชิก (`menu_ar_dealer`) | `DealerScreen` | [[scr-customer]] |
| 6004 | ข้อมูลคู่ค้า(ลูกหนี้) (`menu_ar_customer_connected`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 6005 | รายงาน/สอบถาม 1 ใบ | `UniversalReportScreen` (โหมด report_ar) | [[scr-universal-report]] |
| 6006 | พิมพ์ที่อยู่จัดส่งสินค้า (`menu_ar_transport_label_print`) | `TransportLabelPrintScreen` | [[scr-transport-label-print]] |
| 6007 | นำเข้าที่อยู่จัดส่งลูกหนี้ (`menu_import_ar_transport_label`) | `SystemProcessWorkbenchScreen` (โหมด system_tool) | [[scr-system-process-workbench]] |
| 6008 | กำหนดแต้มคงเหลือยกมา (`menu_ar_point_balance`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 6009 | แต้มสะสม (`menu_ar_point`) | `MasterDetailScreen` | [[scr-master-detail]] |
| 6010 | บันทึกตัดแต้ม (`menu_ar_cut_point`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 6011 | คำณวนแต้มสะสม (`menu_ar_point_recal`) | `SystemProcessWorkbenchScreen` (โหมด system_tool) | [[scr-system-process-workbench]] |
| 6012 | ตั้งหนี้ยกมา (ลูกหนี้) (`menu_ar_debt_balance`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 6013 | เพิ่มหนี้ยกมา (ลูกหนี้) (`menu_ar_increase_debt`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 6014 | ลดหนี้ยกมา (ลูกหนี้) (`menu_ar_cn_balance`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 6015 | ตั้งหนี้อื่นๆ (ลูกหนี้) (`menu_ar_debt_other`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 6016 | เพิ่มหนี้อื่นๆ (ลูกหนี้) (`menu_ar_increase_debt_other`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 6017 | ลดหนี้อื่นๆ (ลูกหนี้) (`menu_ar_cn_debt_other`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 6018 | ใบวางบิล (ลูกหนี้) (`menu_ar_pay_bill`) | `UniversalTransScreen` (ap_ar_trans) | [[scr-universal-trans]] |
| 6019 | รับชำระหนี้/ออกใบเสร็จรับเงิน (`menu_ar_debt_billing`) | `UniversalTransScreen` (ap_ar_trans) | [[scr-universal-trans]] |
| 6020 | บันทึกรูปภาพเอกสารลูกหนี้ (`menu_ar_doc_picture`) | `DocumentPictureScreen` | [[scr-item-pictures]] |
| **6021-6025** | **ยกเลิกเอกสารลูกหนี้ (ตั้งหนี้อื่น/วางบิล/รับชำระ)** (โฟลเดอร์ `menu_ar_other`) | | |
| 6021 | ยกเลิกตั้งหนี้อื่นๆ (ลูกหนี้) (`menu_ar_cancel_debt_balance_other`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 6022 | ยกเลิกเพิ่มหนี้อื่นๆ (ลูกหนี้) (`menu_ar_cancel_increase_debt_other`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 6023 | ยกเลิกลดหนี้อื่นๆ (ลูกหนี้) (`menu_ar_cancel_cn_debt_other`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 6024 | ยกเลิกใบวางบิล (ลูกหนี้) (`menu_ar_cancel_pay_bill`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 6025 | ยกเลิกชำระหนี้/ยกเลิกใบเสร็จรับเงิน (`menu_ar_cancel_debt_billing`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| **6026-6033** | **รายงานทะเบียนลูกหนี้ ยอดยกมา และตั้งหนี้อื่นๆ** (โฟลเดอร์ `menu_ar_balance_report`) | | |
| 6026-6033 | รายงาน/สอบถาม 8 ใบ | `UniversalReportScreen` (โหมด report_ar) | [[scr-universal-report]] |
| **6034-6037** | **รายงานใบวางบิลและการรับชำระหนี้** (โฟลเดอร์ `menu_ar_cancel`) | | |
| 6034-6037 | รายงาน/สอบถาม 4 ใบ | `UniversalReportScreen` (โหมด report_ar) | [[scr-universal-report]] |
| **6038-6040** | **รายงานสรุปยอดค้างชำระและวงเงินลูกหนี้** (โฟลเดอร์ `menu_ar_report_absolute`) | | |
| 6038-6040 | รายงาน/สอบถาม 3 ใบ | `UniversalReportScreen` (โหมด report_ar) | [[scr-universal-report]] |
| **6041-6044** | **รายงานวิเคราะห์อายุหนี้และเคลื่อนไหวลูกหนี้** (โฟลเดอร์ `menu_ar_analytics`) | | |
| 6041-6044 | รายงาน/สอบถาม 4 ใบ | `UniversalReportScreen` (โหมด report_ar) | [[scr-universal-report]] |
| **6045-6049** | **รายงานเอกสารยกเลิก (ระบบลูกหนี้)** (โฟลเดอร์ `menu_ar_report`) | | |
| 6045-6049 | รายงาน/สอบถาม 5 ใบ | `UniversalReportScreen` (โหมด report_ar) | [[scr-universal-report]] |
| 6050 | รายงาน/สอบถาม 1 ใบ | `UniversalReportScreen` (โหมด report_ar) | [[scr-universal-report]] |

### 7. เงินสด/ธนาคาร (`menu_cash_and_bank`) รหัส 7001-7114

มีเมนูใบ 114 ใบ (เป็นรายงานผ่านจอรายงานกลาง 61 ใบ)

| รหัส | เมนู | หน้าจอ | โน้ต |
|---|---|---|---|
| **7001-7003** | **เงินสดและวงเงินสดย่อย** (โฟลเดอร์ `menu_petty_cash_m`) | | |
| 7001 | ยกมาเงินสด (`menu_cb_cash_balance`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 7002 | รับ/เพิ่ม วงเงินสดย่อย (`menu_cb_petty_return`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 7003 | คืน/ลด วงเงินสดย่อย (`menu_cb_petty_cash_receive`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 7004 | รายได้อื่นๆ (`menu_cash_income_other`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 7005 | เพิ่มหนี้รายได้อื่นๆ (`menu_cash_income_other_debit`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 7006 | ลดหนี้รายได้อื่นๆ (`menu_cash_income_other_credit`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 7007 | ค่าใช้จ่ายอื่นๆ (`menu_cash_expense_other`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 7008 | เพิ่มหนี้ค่าใช้จ่ายอื่นๆ (`menu_cash_expense_other_debit`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 7009 | ลดหนี้ค่าใช้จ่ายอื่นๆ (`menu_cash_expense_other_credit`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| **7010-7015** | **สมุดเงินฝากธนาคาร (ฝาก / ถอน / โอน)** (โฟลเดอร์ `menu_bank_withdraw_payin`) | | |
| 7010 | กำหนดสมุดเงินฝาก (`menu_book_bank`) | `StandardMasterScreen` | [[scr-standard-master]] |
| 7011 | เงินฝากธนาคารยกมา (`menu_cb_bank_balance`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 7012 | บันทึกฝากเงิน (`menu_cb_cash_payin`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 7013 | บันทึกถอนเงิน (`menu_cb_cash_withdraw`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 7014 | บันทึกโอนเงินระหว่างธนาคาร (`menu_cash_transfer`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 7015 | บันทึกขึ้นเงินwallet (`menu_cb_wallet_pass`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| **7016-7023** | **ทะเบียนเช็ครับและจัดการเช็ครับ** (โฟลเดอร์ `menu_cb_chq_in`) | | |
| 7016 | เช็ครับยกมา (`menu_cb_chq_in_receive_balance`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 7017 | ทะเบียนเช็ครับ (`menu_cb_chq_in_receive_master`) | `UniversalTransScreen` (cb_chq_list) | [[scr-universal-trans]] |
| 7018 | บันทึกนำฝาก (เช็ครับ) (`menu_cb_chq_in_payin`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 7019 | บันทึกเช็คผ่าน (เช็ครับ) (`menu_cb_chq_in_pass`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 7020 | บันทึกเช็คคืน (เช็ครับ) (`menu_cb_chq_in_return`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 7021 | บันทึกการเปลี่ยนเช็ค (เช็ครับ) (`menu_cb_chq_renew`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 7022 | บันทึกคืนเช็ค/ตั้งหนี้ใหม่ (`menu_cb_return_chq_new_debt`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 7023 | บันทึกเช็คขาดสิทธิ์ (เช็ครับ) (`menu_cb_chq_in_cancel`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| **7024-7029** | **ทะเบียนเช็คจ่ายและจัดการเช็คจ่าย** (โฟลเดอร์ `menu_cb_chq_out`) | | |
| 7024 | เช็คจ่ายยกมา (`menu_cb_chq_out_payment_balance`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 7025 | ทะเบียนเช็คจ่าย (`menu_cb_chq_out_payment_master`) | `UniversalTransScreen` (cb_chq_list) | [[scr-universal-trans]] |
| 7026 | บันทึกเช็คผ่าน (เช็คจ่าย) (`menu_cb_chq_out_pass`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 7027 | บันทึกเช็คคืน (เช็คจ่าย) (`menu_cb_chq_out_return`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 7028 | บันทึกการเปลี่ยนเช็ค (เช็คจ่าย) (`menu_cb_chq_out_renew`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 7029 | บันทึกเช็คขาดสิทธิ์ (เช็คจ่าย) (`menu_cb_chq_out_cancel`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| **7030-7031** | **ทะเบียนบัตรเครดิตรับและขึ้นเงิน** (โฟลเดอร์ `menu_cb_credit_card`) | | |
| 7030 | ทะเบียนบัตรเครดิต (`menu_cb_credit_card_receive`) | `UniversalTransScreen` (cb_chq_list) | [[scr-universal-trans]] |
| 7031 | บันทึกขึ้นเงินบัตรเครดิต (`menu_cb_credit_card_pass`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 7032 | บันทึกรูปภาพเอกสาร (`menu_cb_doc_picture`) | `DocumentPictureScreen` | [[scr-item-pictures]] |
| **7033-7040** | **ยกเลิกเอกสารเงินสดย่อย รายได้อื่น และค่าใช้จ่ายอื่น** (โฟลเดอร์ `menu_money_report_cancel`) | | |
| 7033 | ยกเลิกรับ/เพิ่ม วงเงินสดย่อย (`menu_cb_petty_return_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 7034 | ยกเลิกคืน/ลด วงเงินสดย่อย (`menu_cb_petty_cash_receive_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 7035 | ยกเลิกรายได้อื่นๆ (`menu_cash_income_other_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 7036 | ยกเลิกเพิ่มหนี้รายได้อื่นๆ (`menu_cash_income_other_debit_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 7037 | ยกเลิกลดหนี้รายได้อื่นๆ (`menu_cash_income_other_credit_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 7038 | ยกเลิกค่าใช้จ่ายอื่นๆ (`menu_cash_expense_other_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 7039 | ยกเลิกเพิ่มหนี้ค่าใช้จ่ายอื่นๆ (`menu_cash_expense_other_debit_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 7040 | ยกเลิกลดหนี้ค่าใช้จ่ายอื่นๆ (`menu_cash_expense_other_credit_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| **7041-7053** | **ยกเลิกเอกสารธนาคาร เช็ครับ เช็คจ่าย และบัตรเครดิต** (โฟลเดอร์ `menu_report_cancel_withdraw_payin`) | | |
| 7041 | บันทึกยกเลิกฝากเงิน (`menu_cb_cash_payin_cancle`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 7042 | บันทึกยกเลิกถอนเงิน (`menu_cb_cash_withdraw_cancle`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 7043 | บันทึกยกเลิกโอนเงินระหว่างธนาคาร (`menu_cash_transfer_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 7044 | บันทึกยกเลิกบัตรเครดิต (`menu_cb_credit_card_cancel`) | `UniversalTransScreen` (ic_trans) | [[scr-universal-trans]] |
| 7045 | บันทึกยกเลิกนำฝากเช็ค (`menu_cb_chq_in_payin_cancle`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 7046 | บันทึกยกเลิกเช็คผ่าน (`menu_cb_chq_in_pass_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 7047 | บันทึกยกเลิกเช็ครับคืน (`menu_cb_chq_in_return_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 7048 | บันทึกยกเลิกเช็คขาดสิทธิ์ (`menu_cb_chq_in_cancel_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 7049 | บันทึกยกเลิกเปลี่ยนเช็ค (`menu_cb_chq_renew_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 7050 | บันทึกยกเลิกเช็คจ่ายผ่าน (`menu_cb_chq_out_pass_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 7051 | บันทึกยกเลิกเช็คคืน (`menu_cb_chq_out_return_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 7052 | บันทึกยกเลิกเช็คขาดสิทธิ์ (`menu_cb_chq_out_cancel_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| 7053 | บันทึกยกเลิกเปลี่ยนเช็คจ่าย (`menu_cb_chq_out_renew_cancel`) | `UniversalCancelConfirmScreen` (โหมด ยกเลิก) | [[scr-cancel-confirm]] |
| **7054-7066** | **รายงานเงินสด เงินสดย่อย และรายได้/ค่าใช้จ่ายอื่น** (โฟลเดอร์ `menu_pettycash_total`) | | |
| 7054-7066 | รายงาน/สอบถาม 13 ใบ | `UniversalReportScreen` (โหมด report_cb) | [[scr-universal-report]] |
| **7067-7075** | **รายงานสมุดเงินฝากธนาคารและบัตรเครดิต** (โฟลเดอร์ `menu_cb_report_absolute`) | | |
| 7067-7072 | รายงาน/สอบถาม 6 ใบ | `UniversalReportScreen` (โหมด report_cb) | [[scr-universal-report]] |
| 7073-7075 | รายงาน/สอบถาม 3 ใบ | `UniversalReportScreen` (โหมด report_chq) | [[scr-universal-report]] |
| **7076-7084** | **รายงานทะเบียนเช็ครับ** (โฟลเดอร์ `menu_cb_chq_report_cancel`) | | |
| 7076-7084 | รายงาน/สอบถาม 9 ใบ | `UniversalReportScreen` (โหมด report_chq) | [[scr-universal-report]] |
| **7085-7092** | **รายงานทะเบียนเช็คจ่าย** (โฟลเดอร์ `menu_cb_chq_out_report_cancel`) | | |
| 7085-7092 | รายงาน/สอบถาม 8 ใบ | `UniversalReportScreen` (โหมด report_chq) | [[scr-universal-report]] |
| **7093-7113** | **รายงานเอกสารยกเลิก (การเงิน/ธนาคาร/เช็ค)** (โฟลเดอร์ `menu_cash_income_report`) | | |
| 7093-7103 | รายงาน/สอบถาม 11 ใบ | `UniversalReportScreen` (โหมด report_cb) | [[scr-universal-report]] |
| 7104-7113 | รายงาน/สอบถาม 10 ใบ | `UniversalReportScreen` (โหมด report_chq) | [[scr-universal-report]] |
| 7114 | รายงาน/สอบถาม 1 ใบ | `UniversalReportScreen` (โหมด report_cb) | [[scr-universal-report]] |

### 8. ค่าเสื่อม (สินทรัพย์ถาวร) (`menu_asset`) รหัส 8001-8012

มีเมนูใบ 12 ใบ (เป็นรายงานผ่านจอรายงานกลาง 7 ใบ)

| รหัส | เมนู | หน้าจอ | โน้ต |
|---|---|---|---|
| **8001-8002** | **รายละเอียดสินทรัพย์** (โฟลเดอร์ `menu_as_asset_detail`) | | |
| 8001 | ข้อมูลสินทรัพย์ (`menu_asset_lists`) | `MasterDetailScreen` | [[scr-master-detail]] |
| 8002 | กำหนดรูปภาพ (`menu_asset_picture`) | `ItemPictureScreen` | [[scr-item-pictures]] |
| 8003 | โอนข้อมูลเข้าระบบบัญชี (`menu_asset_transfers`) | `SystemProcessWorkbenchScreen` (โหมด fa_depreciation) | [[scr-system-process-workbench]] |
| 8004 | บันทึกการซ่อมบำรุงสินทรัพย์ (`menu_asset_maintenance`) | `MasterDetailScreen` | [[scr-master-detail]] |
| 8005 | บันทึกการขายสินทรัพย์ (`menu_asset_sale`) | `AssetSaleScreen` | [[scr-asset-sale]] |
| 8006-8008 | รายงาน/สอบถาม 3 ใบ | `UniversalReportScreen` (โหมด report_fa) | [[scr-universal-report]] |
| **8009-8011** | **รายงานสินทรัพย์และค่าเสื่อมราคา** (โฟลเดอร์ `menu_asset_reports`) | | |
| 8009-8011 | รายงาน/สอบถาม 3 ใบ | `UniversalReportScreen` (โหมด report_fa) | [[scr-universal-report]] |
| 8012 | รายงาน/สอบถาม 1 ใบ | `UniversalReportScreen` (โหมด report_fa) | [[scr-universal-report]] |

### 9. บัญชี (GL) (`menu_general_ledger_main`) รหัส 9001-9061

มีเมนูใบ 61 ใบ (เป็นรายงานผ่านจอรายงานกลาง 45 ใบ)

| รหัส | เมนู | หน้าจอ | โน้ต |
|---|---|---|---|
| **9001-9003** | **ผังบัญชี (Chart of Accounts)** (โฟลเดอร์ `menu_chart_of_account_main`) | | |
| 9001 | รายละเอียดผังบัญชี (`menu_chart_of_account`) | `MasterDetailScreen` | [[scr-chart-of-accounts]] |
| 9002 | ปรับปรุงผังบัญชีแบบเร็ว (`menu_chart_of_account_fast`) | `MasterDetailScreen` | [[scr-chart-of-accounts]] |
| 9003 | ตรวจสอบโครงสร้างผังบัญชี (`menu_chart_of_account_flow`) | `SystemProcessWorkbenchScreen` | [[scr-chart-of-accounts]] |
| 9004 | ข้อมูลรายวัน (`menu_gl_journal`) | `UniversalTransScreen` (gl_journal) | [[scr-universal-trans]] |
| 9005 | บันทึกข้อมูลรายวันแบบเร็ว (`menu_gl_journal_fast`) | `UniversalTransScreen` (gl_journal) | [[scr-universal-trans]] |
| 9006 | รายงาน/สอบถาม 1 ใบ | `UniversalReportScreen` (โหมด report_gl) | [[scr-universal-report]] |
| 9007 | บันทึกรูปภาพ (`menu_gl_picture`) | `DocumentPictureScreen` | [[scr-item-pictures]] |
| **9008-9011** | **ตรวจสอบ ผ่านรายการ และประมวลผลบัญชี** (โฟลเดอร์ `menu_gl_main`) | | |
| 9008 | ตรวจสอบความถูกต้อง (`menu_gl_check_data`) | `SystemProcessWorkbenchScreen` (โหมด gl_journal_pass) | [[scr-system-process-workbench]] |
| 9009 | ผ่านรายการ (`menu_gl_journal_pass`) | `SystemProcessWorkbenchScreen` (โหมด gl_journal_pass) | [[scr-system-process-workbench]] |
| 9010 | ประมวลผลจากข้อมูลรายวัน (`menu_gl_process`) | `SystemProcessWorkbenchScreen` (โหมด gl_process) | [[scr-system-process-workbench]] |
| 9011 | สรุปบัญชีสินค้าและต้นทุนขาย (`menu_product_sale_cost_close`) | `SystemProcessWorkbenchScreen` (โหมด gl_close_period) | [[scr-system-process-workbench]] |
| **9012-9018** | **สอบถามบัญชีแยกประเภทและงบการเงิน (บนหน้าจอ)** (โฟลเดอร์ `gl_menu_allocate`) | | |
| 9012 | สรุปยอดบัญชี (`menu_journal_summary`) | `SystemProcessWorkbenchScreen` (โหมด gl_close_period) | [[scr-system-process-workbench]] |
| 9013-9018 | รายงาน/สอบถาม 6 ใบ | `UniversalReportScreen` (โหมด report_gl) | [[scr-universal-report]] |
| 9019 | ประมวลผลสิ้นงวด (`menu_gl_end_of_period`) | `SystemProcessWorkbenchScreen` (โหมด gl_close_period) | [[scr-system-process-workbench]] |
| 9020 | ประมวลผลสิ้นปี (`menu_gl_end_of_year`) | `SystemProcessWorkbenchScreen` (โหมด gl_close_period) | [[scr-system-process-workbench]] |
| 9021 | ประมวลผลกำไร/ขาดทุน และต้นทุนขาย (`menu_close_account_process`) | `SystemProcessWorkbenchScreen` (โหมด gl_close_period) | [[scr-system-process-workbench]] |
| 9022 | ยกเลิกผ่านรายการ (`menu_gl_journal_pass_cancel`) | `SystemProcessWorkbenchScreen` (โหมด gl_journal_pass) | [[scr-system-process-workbench]] |
| **9023-9036** | **รายงานภาษีมูลค่าเพิ่ม (ภ.พ.30)** (โฟลเดอร์ `menu_gl_vat`) | | |
| 9023-9036 | รายงาน/สอบถาม 14 ใบ | `UniversalReportScreen` (โหมด report_gl) | [[scr-universal-report]] |
| **9037-9040** | **รายงานภาษีหัก ณ ที่จ่าย (ภ.ง.ด.3 / 53)** (โฟลเดอร์ `menu_gl_wht`) | | |
| 9037-9039 | รายงาน/สอบถาม 3 ใบ | `UniversalReportScreen` (โหมด report_gl) | [[scr-universal-report]] |
| 9040 | ส่งออกข้อมูลภาษีหัก ณ ทีจ่าย (`menu_export_wht`) | `SystemProcessWorkbenchScreen` (โหมด system_tool) | [[scr-system-process-workbench]] |
| **9041-9046** | **รายงานผังบัญชี สมุดรายวัน และบัญชีแยกประเภท** (โฟลเดอร์ `menu_gl_report_other`) | | |
| 9041-9046 | รายงาน/สอบถาม 6 ใบ | `UniversalReportScreen` (โหมด report_gl) | [[scr-universal-report]] |
| **9047-9059** | **รายงานงบทดลอง กระดาษทำการ และงบการเงิน** (โฟลเดอร์ `menu_financial_statement`) | | |
| 9047-9059 | รายงาน/สอบถาม 13 ใบ | `UniversalReportScreen` (โหมด report_gl) | [[scr-universal-report]] |
| 9060-9061 | รายงาน/สอบถาม 2 ใบ | `UniversalReportScreen` (โหมด report_gl) | [[scr-universal-report]] |

หมายเหตุอ่านต้นไม้: ใบ 2017 "ตรวจสอบราคาสินค้า" ใช้จอเฉพาะ `CheckPriceScreen` ส่วน 2027/2028 เป็นโหมด `check_price` ของจอรายงานกลาง (ดู [[scr-stock-check-tools]] สำหรับชุดเครื่องมือตรวจสินค้า/บาร์โค้ด/ซีเรียล) ใบ 7044 "บันทึกยกเลิกบัตรเครดิต" ชื่อมีคำว่ายกเลิกแต่เป็นเอกสารปกติ (`mode: "doc"`, `transFlag: 462`, `transMenuMap.ts:2353-2365`) จึงเปิดจอบันทึกเอกสาร ไม่ผ่านจอยกเลิก/อนุมัติ ใบ 1111 "นำเข้ารูปภาพสินค้า" เปิด `ItemPictureScreen` แบบเดียวกับ 2005 ไม่ใช่ตัวนำเข้าเป็นชุด ([[scr-item-pictures]])

## หน้าจอที่อยู่นอกต้นไม้เมนู

### พื้นที่ผู้ดูแลระบบ `/admin` (15 หน้า ใน 3 กลุ่มบน `adminMenuGroups`, `adminMenu.ts:39-160`)

แยกจากเมนู ERP ปกติ เข้าได้เฉพาะ session โหมด admin รายละเอียดการเข้าถึงและกรอบหน้าจออยู่ที่ [[scr-admin-console]] (ระบบเบื้องหลังที่ [[fe-admin-console]] และ [[api-admin-console]])

| กลุ่ม | เส้นทาง | ชื่อบนเมนู | โน้ต |
|---|---|---|---|
| User Manage (Provider) | `/admin/users` | กำหนดผู้ใช้และกลุ่มผู้ใช้ | [[scr-admin-console]] |
| | `/admin/user-groups` | จัดกลุ่มผู้ใช้ | [[scr-admin-permissions]] |
| | `/admin/system-text` | เปลี่ยนข้อความในระบบ | [[scr-admin-permissions]] |
| | `/admin/change-password` | เปลี่ยนรหัสผ่าน | [[scr-change-password]] |
| | `/admin/group-permission` | กำหนดสิทธิ์กลุ่มใช้งาน | [[scr-admin-permissions]] |
| | `/admin/data-access` | กำหนดผู้มีสิทธิ์เข้าใช้ข้อมูล | [[scr-admin-console]] |
| Database Manage (Provider) | `/admin/data-groups` | กำหนดกลุ่มข้อมูล | [[scr-admin-console]] |
| | `/admin/create-database` | สร้างฐานข้อมูลใหม่ | [[scr-admin-database-tools]] |
| | `/admin/databases` | เชื่อมฐานข้อมูล | [[scr-admin-console]] |
| | `/admin/data-permission` | กำหนดการเข้าถึงข้อมูล | [[scr-admin-permissions]] |
| | `/admin/check-database` | ตรวจสอบฐานข้อมูล | [[scr-admin-database-tools]] |
| | `/admin/database-info` | Database Information | [[scr-admin-console]] |
| | `/admin/transfer` | โอนข้อมูล | [[scr-admin-database-tools]] |
| ระบบและการเชื่อมต่อ AI ภายนอก (เฉพาะเว็บ) | `/admin/providers` | จัดการ Provider | [[scr-admin-console]] |
| | `/admin/mcp-tokens` | จัดการ MCP Token (AI Read-Only) | [[scr-mcp-token]] |

### จุดขายแคชเชียร์ `/pos`

เส้นทาง `/pos` เปิด `PosDemoWorkspace` เปลือกที่ฝังแอปแคชเชียร์ Flutter Web ไว้ใน `iframe` พร้อมแถบสลับไปหน้าตั้งค่า POS แยกจากเมนู ERP: [[scr-pos-demo-workspace]] ส่วนการตั้งค่า POS (ค่าเริ่มต้น เครื่อง โปรโมชัน คะแนน QR คูปอง กะ บิล) เปิดจากเมนูหมวดเริ่มต้นผ่าน `PosSetupAndControlScreen` ตามแถว 1016-1021, 1050, 1051 และ 1074 ในต้นไม้ ([[scr-pos-setup-control]])

### หน้าจอที่ลงทะเบียนแล้วแต่ไม่มีใบเมนู

`BuySaleInformationScreen` (รายละเอียดการซื้อ/การขาย 4 ช่อง) อยู่ใน registry แต่ไม่มีใบเมนูชี้มา ชื่อเมนูเก่า `menu_po_buy_information` และ `menu_so_sale_information` ถูก alias ไปรายงานซื้อ/ขายแทน (`bcMenu.ts:212-213`) จึงเปิดจากเมนูไม่ได้: [[scr-buy-sale-information]]

### ส่วนประกอบที่ใช้ร่วม (ไม่ใช่เมนู)

หน้าต่างและส่วนย่อยที่หลายจอเรียกใช้ มีโน้ตแยก: หัวเอกสารและแท็บเสริม [[scr-trans-header-and-tabs]]; ตารางรายการสินค้า/จำนวนเงิน [[scr-trans-item-grid]]; ป๊อปอัปซีเรียล ล็อต ยอดคงเหลือ ประวัติ [[scr-modal-serial-lot-stock]]; ป๊อปอัปสูตรราคา ต้นทุน อนุมัติวงเงิน [[scr-modal-price-credit]]; ป๊อปอัปค้นหาเช็ค ผังเส้นทางเอกสาร ชื่อ/หมายเหตุรายการ [[scr-modal-document-item]]; รายการข้อมูล ค้นหา lookup dialog กลาง [[scr-data-list-and-lookup]]; หน้าต่างพิมพ์รายงาน/แบบฟอร์ม [[scr-report-print-modal]]

## โน้ตทั้งหมดในหมวดนี้

**ธุรกรรมและป๊อปอัปที่เรียกจากเอกสาร**

- [[scr-universal-trans]] จอบันทึกเอกสารธุรกรรม มุมมองผู้ใช้ (UniversalTransScreen)
- [[scr-trans-header-and-tabs]] หัวเอกสาร แผงล่าง และแท็บเสริมของจอเอกสาร (TransTopForm / TransBottomPanel / TransExtraTabs)
- [[scr-trans-item-grid]] ตารางรายการสินค้า/จำนวนเงินในเอกสาร (TransItemGrid)
- [[scr-cancel-confirm]] จอยกเลิก/อนุมัติเอกสาร (UniversalCancelConfirmScreen)
- [[scr-stock-beginning-balance]] สินค้า/วัตถุดิบคงเหลือยกมา (StockBeginningBalanceScreen)
- [[scr-asset-sale]] บันทึกการขายสินทรัพย์ (AssetSaleScreen)
- [[scr-modal-serial-lot-stock]] ป๊อปอัปซีเรียล ล็อต ยอดคงเหลือ ประวัติ สินค้าทดแทน (SerialNumberModal / LotModal / StockBalanceModal / ItemHistoryModal / ItemReplacementModal)
- [[scr-modal-price-credit]] ป๊อปอัปราคาขาย ต้นทุน และอนุมัติวงเงินเครดิต (PriceFormulaModal / PriceInfoModal / CostLockModal / CreditApproveModal)
- [[scr-modal-document-item]] ป๊อปอัปเอกสารและรายการสินค้า (ChequePickerModal / DocumentFlowModal / ItemNameModal / ItemRemarkModal / ItemGridContextMenu)

**ข้อมูลหลักและตั้งค่าระบบ**

- [[scr-standard-master]] หน้าจอข้อมูลหลักมาตรฐาน (StandardMasterScreen)
- [[scr-master-detail]] หน้าจอข้อมูลหลัก + ตารางย่อย (MasterDetailScreen)
- [[scr-data-list-and-lookup]] รายการข้อมูล ค้นหา lookup และ dialog กลาง (BcDataList / BcLookupModal / BcDialog)
- [[scr-chart-of-accounts]] ผังบัญชี (Chart of Accounts: MasterDetailScreen 9001 / 9002)
- [[scr-company-profile]] กำหนดรายละเอียดบริษัท (CompanyProfileForm)
- [[scr-options]] กำหนดข้อเลือกพิเศษต่างๆ (OptionsForm)
- [[scr-employee]] กำหนดพนักงาน (EmployeeScreen)
- [[scr-doc-format]] กำหนดรูปแบบเลขที่เอกสาร (DocFormatScreen)
- [[scr-province-tree]] กำหนดรหัสจังหวัด / อำเภอ / ตำบล (ProvinceTreeScreen)
- [[scr-unit]] กำหนดหน่วยนับสินค้า (UnitScreen)
- [[scr-warehouse]] กำหนดคลังสินค้า และจอคลังที่เก็บสินค้า (WarehouseScreen)
- [[scr-change-password]] เปลี่ยนรหัสผ่าน (ChangePasswordScreen)
- [[scr-mcp-token]] จัดการ MCP Token เชื่อมต่อ AI ภายนอก แบบอ่านอย่างเดียว (McpTokenScreen)

**สินค้าและสต็อก**

- [[scr-item-master]] ข้อมูลสินค้า (ItemScreen)
- [[scr-item-detail-2]] ข้อมูลสินค้าเพิ่มเติม 15 แท็บ (ItemDetail2Screen)
- [[scr-item-description]] รายละเอียดสินค้า แก้ด่วนแบบกลุ่ม และกำหนดระดับสินค้า (ItemDescriptionScreen, ItemDescriptionFastScreen, ItemLevelScreen)
- [[scr-item-pictures]] กำหนดรูปภาพสินค้า/พนักงาน/สินทรัพย์ และบันทึกรูปภาพเอกสาร (ItemPictureScreen, DocumentPictureScreen)
- [[scr-barcode-setup]] กำหนดบาร์โค้ด เพิ่มบาร์โค้ดแบบเร็ว และตรวจบาร์โค้ด EAN13 (BarcodeSetupScreen, BarcodeFastAddScreen, Ean13CheckerScreen)
- [[scr-barcode-discount]] กำหนดส่วนลดตามบาร์โค้ด รายตัวและแบบเร็ว (BarcodeDiscountScreen, MultiBarcodeDiscountScreen)
- [[scr-barcode-print]] พิมพ์บาร์โค้ดด้วยเครื่องพิมพ์ทั่วไป (BarcodePrintScreen)
- [[scr-modify-price]] ปรับราคาสินค้า นำเข้าไฟล์ราคาทั้งชุด (ModifyPriceScreen)
- [[scr-stock-check-tools]] เครื่องมือตรวจสอบสินค้า ราคา บาร์โค้ด และ Serial (CheckPriceScreen, BarcodeCheckerScreen, SerialStockCountScreen, SerialAnalyzeScreen)
- [[scr-lot-adjust]] ปรับปรุงสต็อกอัตโนมัติจากใบตรวจนับ และปรับมูลค่า Lot คงค้าง (StockAutoAdjustLotScreen, LotAmountAdjustScreen)
- [[scr-hidden-cost]] ประมวลผลเฉลี่ยต้นทุนแฝง และต้นทุนนำเข้าสินค้าจากต่างประเทศ (HiddenCostScreen)

**ลูกหนี้ เจ้าหนี้ และคู่ค้า**

- [[scr-customer]] กำหนดลูกหนี้ และรายละเอียดสมาชิก (CustomerScreen, DealerScreen)
- [[scr-customer-detail]] รายละเอียดลูกหนี้ สินเชื่อ ผู้ติดต่อ รูปภาพ (CustomerDetailScreen)
- [[scr-supplier]] กำหนดเจ้าหนี้ และรายละเอียดเจ้าหนี้ (SupplierScreen, SupplierDetailScreen)
- [[scr-transport-label-print]] พิมพ์ป้ายชื่อ/ที่อยู่จัดส่งสินค้า (TransportLabelPrintScreen)

**รายงานและแบบฟอร์ม**

- [[scr-universal-report]] จอรายงานกลาง (UniversalReportScreen)
- [[scr-report-print-modal]] หน้าต่างพิมพ์รายงานและพิมพ์แบบฟอร์มเอกสาร (GlobalReportPrintModal / GlobalDocFormPrintModal)
- [[scr-report-designer]] ตัวออกแบบรายงานและแบบฟอร์ม (FastReportDesignerScreen / FormDesignerScreen)
- [[scr-buy-sale-information]] รายละเอียดการซื้อ/การขาย 4 ช่อง (BuySaleInformationScreen)

**ประมวลผลระบบ**

- [[scr-system-process-workbench]] จอประมวลผลระบบ: คำนวณสต๊อก ผ่านรายการ ปิดงวด ค่าเสื่อม เปลี่ยนรหัส (SystemProcessWorkbenchScreen)

**POS และผู้ดูแลระบบ**

- [[scr-pos-demo-workspace]] พื้นที่ทำงาน POS จอขายแคชเชียร์ (PosDemoWorkspace, เส้นทาง /pos)
- [[scr-pos-setup-control]] ตั้งค่าและควบคุมระบบขายหน้าร้าน POS (PosSetupAndControlScreen)
- [[scr-admin-console]] ศูนย์จัดการระบบ Admin: ผู้ใช้ ผู้ให้บริการ ฐานข้อมูล สิทธิ์เข้าฐาน (UsersScreen, ProvidersScreen, DatabasesScreen, DataAccessScreen, DataGroupsScreen, DatabaseInfoScreen)
- [[scr-admin-permissions]] จัดกลุ่มผู้ใช้ ข้อความระบบ และสิทธิ์รายเมนู (UserGroupsScreen, SystemTextScreen, GroupPermissionScreen, DataPermissionScreen)
- [[scr-admin-database-tools]] สร้าง ตรวจสอบ และโอนข้อมูลฐานข้อมูล (CreateDatabaseScreen, CheckDatabaseScreen, TransferDataScreen)

## ข้อสังเกตและจุดที่ไม่ตรงกันที่พบระหว่างอ่านโค้ด

รายการนี้รวมจากโน้ตรายหน้าจอ แต่ละข้อมีหลักฐานเลขบรรทัดอยู่ในโน้ตที่ลิงก์ไว้ (ไม่ซ้ำที่นี่) ข้อที่เป็นของหน้านี้เองอ้างบรรทัดโดยตรง

### เมนู รหัส และทะเบียนหน้าจอ
- [[fe-screen-registry-menu]] ยกตัวอย่างรหัสเมนูเป็นแบบจุด "1.1.1" แต่รหัสที่ทะเบียนหน้าจอใช้จริงเป็น 4 หลัก: `def.code = getMenuCodeByName(...)` (`screenRegistry.tsx:1059`) ส่วนรหัสแบบจุดเก็บใน `legacyCode` (`bcMenu.ts:108`)
- โค้ดบางจุดยังอ้างรหัสแบบจุดรุ่นเก่า: OptionsForm เรียกตัวเองว่า "จอ 1.1.2" ซึ่งคือเมนู 1002 ([[scr-options]]); `PosDemoWorkspace` ส่งรหัส "2.1.14", "1.1.21", "1.1.20" ที่ไม่ตรงรหัส 4 หลักปัจจุบัน ([[scr-pos-demo-workspace]])
- มีคีย์เมนูซ้ำที่เปิดจอเดียวกัน: `menu_ic_stk_adjust_auto_2` (เหมือน 2045, [[scr-lot-adjust]]) และ `menu_ic_weight_cost` (เหมือน 2050, [[scr-hidden-cost]]) ทั้งสองชื่อยังอยู่ในรายการ alias เก่าด้วย (`bcMenu.ts:203,210`)
- รหัสสกีมา 2021/2022 ในจอคลังที่เก็บเป็นรหัสรุ่นเก่า ([[scr-warehouse]])
- เมนู 1115 "นำเข้ารายงานสาขา" ทำงานเหมือน 1114 ทุกอย่าง ต่างแค่หัวหน้าต่าง ([[scr-report-designer]]); เมนู 1111 ใช้ `ItemPictureScreen` แบบสินค้าเหมือน 2005 ([[scr-item-pictures]])
- `BuySaleInformationScreen` ไม่มีใบเมนูชี้มา (ดูหัวข้อด้านบน) และรันคำสั่ง SQL ฝั่งหน้าจอเอง ผลสรุปเช็คไม่จำกัดชนิดเช็ค ([[scr-buy-sale-information]])

### คีย์ลัดและปุ่ม
- คอมเมนต์ในโค้ดพูดถึงคีย์ F12 แต่ที่ผูกจริงมีเพียง Ctrl+S (และ Esc/คีย์อื่นเฉพาะจอ) ใน [[scr-universal-trans]], [[scr-cancel-confirm]], [[scr-stock-beginning-balance]], [[scr-province-tree]] และ [[scr-report-designer]]
- ปุ่ม "ปิดหน้าจอ" ในโหมดแก้ไขของหลายจอที่ใช้กรอบหน้าจอเดียวกันคือ "ยกเลิกการแก้ไข" ไม่ได้ปิดแท็บ: [[scr-asset-sale]], [[scr-province-tree]], [[scr-report-designer]], [[scr-universal-trans]]
- ปุ่มช่วยใต้ตารางสินค้าทำกับแถวแรกที่มีรหัสสินค้า ไม่ใช่แถวที่เลือก ([[scr-trans-item-grid]]); หัวป๊อปอัปสูตรราคาโชว์ (Ctrl+3 / Ctrl+4) ทั้งที่คีย์นี้มีเฉพาะจอยกยอดสินค้า ([[scr-modal-price-credit]])
- ปุ่ม "พิมพ์" ของจอพิมพ์ป้ายขนส่งยังไม่ส่งงานพิมพ์จริง ขึ้นแต่ข้อความสำเร็จ ([[scr-transport-label-print]])
- ช่องติ๊ก "ไม่อนุมัติ" ในจอยกเลิก/อนุมัติมีเฉพาะใบอนุมัติใบเสนอซื้อ (flag 4) และใบสั่งซื้อ (flag 8) ส่วนอนุมัติฝั่งขาย (flag 32, 38, 52) ไม่มี ([[scr-cancel-confirm]]); ยอดสินค้ายกมา (flag 54) ไม่มีเมนูยกเลิก ([[scr-stock-beginning-balance]])

### กฎข้อมูลและความถูกต้อง
- กฎเลขผู้เสียภาษีไม่เหมือนกัน: ลูกหนี้ 6001 และเจ้าหนี้ 5001/5002 ตรวจ 13 หลักและกันซ้ำคนละแบบ (5001 นับประเภทสถานประกอบการด้วย, 5002 ซ้ำเฉพาะเลขภาษี) ส่วนลูกหนี้ 6002 ไม่ตรวจเลย ([[scr-customer]], [[scr-supplier]], [[scr-customer-detail]])
- ลบจังหวัด/อำเภอลบต่อเนื่องทั้งสาย โดยไม่ตรวจว่ามีลูกค้า/เจ้าหนี้ใช้รหัสนั้นอยู่ ([[scr-province-tree]])
- จอสินค้าคงเหลือยกมาใส่แถว GL ให้เอง เดบิต 1131-00 / เครดิต 3110-00 ขัดกับ [[doc-stock-beginning-balance]] ที่เขียนว่าไม่มี GL อัตโนมัติ และเก็บ qty/price เป็น JS number ในจอ แม้ payload ส่งเป็นสตริงทศนิยม ([[scr-stock-beginning-balance]], [[fe-numeric-money]])
- ขายสินทรัพย์ 8005: ช่องลูกหนี้ไม่มี `*` แต่ backend บังคับ และไม่มีแท็บรับชำระ ([[scr-asset-sale]])
- ป๊อปอัปซีเรียลมีข้อความ "ตัดจ่ายแล้ว" แต่ query ดึงเฉพาะสถานะพร้อมใช้ จึงไม่เคยเห็น; ประวัติสินค้าไม่กรองเอกสารที่ยกเลิกและไม่โชว์ชนิดเอกสาร ([[scr-modal-serial-lot-stock]]); ตัวนับ "/255" ของหมายเหตุรายการไม่ถูกบังคับ และผังเส้นทางเอกสารจำกัด 6 ชั้น 80 เอกสารโดยไม่เตือน ([[scr-modal-document-item]])
- เอกสารเช็ค (`cb_chq_list`) ไม่ใช้ช่วงวันที่ในรายการเอกสาร แม้ช่องวันที่อยู่บนจอ ([[scr-universal-trans]])

### รายงานและแบบฟอร์ม
- จอรายงานกลางไม่มี drill-down; การวิเคราะห์ด้วย AI ส่งทุกแถวไป; หัวคอลัมน์ CSV ไม่ใส่เครื่องหมายคำพูด ([[scr-universal-report]])
- หน้าต่างพิมพ์สร้าง PDF ใหม่จาก backend ทุกครั้งที่ตั้งค่าเปลี่ยน; ตารางคืน VAT นักท่องเที่ยวเขียนค่าคงที่ในโค้ดด้วย JS Number (ตัวเลขชั้นยังไม่ได้ตรวจกับต้นทาง); การส่ง e-Tax ของแบบฟอร์ม ภ.พ.10 กลืนข้อผิดพลาด ([[scr-report-print-modal]])
- ตาราง `formdesign` ที่ตัวออกแบบฟอร์มเขียน ไม่ถูกอ่านโดยเส้นทางพิมพ์เอกสารใดในโค้ดที่ค้น; รหัสฟอร์มถูกตัดเหลือ 25 ตัวอักษรโดย backend; "สแกนฟอร์มด้วย AI" ของตัวออกแบบเป็นการวิเคราะห์ภาพบน canvas ในเครื่อง ไม่ได้เรียก AI ภายนอก ส่วนช่อง AI Chat สั่งจัดฟอร์มเรียกเส้นทาง `/api/ai/chat` ([[scr-report-designer]], [[scr-report-print-modal]])

## ที่มาในโค้ด

- `frontend/src/config/bcMenu.ts:36` รหัสรุ่น `&13&`; `:101-131` `assignMenuCodes` (รหัส 4 หลัก + `legacyCode`); `:140-165` `filterVisibleMenuBar` (ข้าม `menu_singha_warehouse`/`menu_so_pos` ที่ `:146`, ซ่อน `&hide&` ที่ `:150`); `:178-184` ต้นไม้ที่ใช้จริง; `:201-216` `LEGACY_MENU_ALIASES` 15 รายการ; `:238` `getMenuCodeByName`
- `frontend/src/config/bcMenu.json` ต้นไม้เมนูดิบ 9 หมวดบนสุด (`menu_setup` ที่บรรทัด 3, `menu_ic` 1914, `menu_po` 3824, `menu_so` 4934, `menu_ap` 6039, `menu_ar` 6775, `menu_cash_and_bank` 7523, `menu_asset` 9157, `menu_general_ledger_main` 9352)
- `frontend/account/tabs/screenRegistry.tsx:101` `createReportDesignerScreen`; `:152` `createMasterScreen`; `:173` `createReportScreen`; `:191` `BASE_SCREENS`; `:1025` ลงทะเบียนเมนูธุรกรรมจาก `TRANS_MENU_MAP`; `:1057-1061` ซิงก์ `code`/`title` จากเมนู; `:1067` `buildDynamicScreen`; `:1382` `registerAllMenus`; `:1423` `SCREENS`
- `frontend/account/tabs/transMenuMap.ts:37` `NON_TRANS_MENUS`; `:52` `TRANS_MENU_MAP`; ตัวอย่างเมนูโหมดอนุมัติ/ยกเลิก `:82`, `:96` (รวม 66 เมนู)
- `frontend/src/config/adminMenu.ts:39-160` กลุ่มเมนู `/admin` 15 หน้า; `frontend/src/app/pos/page.tsx` เส้นทาง `/pos`
- ตัวเลขชนิดหน้าจอ/โหมดรายงาน/ตารางต้นไม้ในหน้านี้ ได้จากสคริปต์อ่านอย่างเดียวที่จำลอง `bcMenu.ts` แล้วจับคู่กับ `screenRegistry.tsx` และ `transMenuMap.ts` (ไม่ได้รันแอป)
