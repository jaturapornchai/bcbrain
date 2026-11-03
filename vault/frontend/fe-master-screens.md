---
title: "รายการจอข้อมูลหลักแบบตารางเดียว (IC_MASTER_CONFIGS)"
tags: [frontend, master, config, schema, setup]
aliases: ["IC_MASTER_CONFIGS", "MasterScreenConfig", "จอ master", "กำหนดกลุ่มสินค้า", "กำหนดสกุลเงิน", "กำหนดธนาคาร", "ข้อมูลหลัก", "fkChecks", "parentFilter", "createMasterScreen", "ตั้งค่าข้อมูลหลัก"]
sources: ["frontend/src/config/schemas/icMasterSchemas.ts:4", "frontend/src/config/schemas/icMasterSchemas.ts:18", "frontend/src/config/schemas/icMasterSchemas.ts:99", "frontend/src/config/schemas/icMasterSchemas.ts:118", "frontend/src/config/schemas/icMasterSchemas.ts:1416", "frontend/account/tabs/screenRegistry.tsx:152", "frontend/account/tabs/screenRegistry.tsx:1012", "frontend/account/master/StandardMasterScreen.tsx:698", "frontend/src/config/bcMenu.ts:276"]
---

# รายการจอข้อมูลหลักแบบตารางเดียว (`IC_MASTER_CONFIGS`)

จอข้อมูลหลักเกือบทั้งหมดในเมนู "ตั้งค่า" ไม่มีไฟล์ component ของตัวเอง - เป็นแค่ object config 1 ก้อนต่อ 1 จอใน `src/config/schemas/icMasterSchemas.ts` แล้ว `StandardMasterScreen` วาดให้ทุกจอเหมือนกัน
เพิ่มจอใหม่ = เพิ่ม config 1 รายการ (ตาราง + ชื่อ + ช่องเสริม) ไม่ต้องเขียน UI

## ทำงานอย่างไร

**ที่มาของ config**: `IC_MASTER_CONFIGS: Record<string, MasterScreenConfig>` (บรรทัด 118) มี 99 รายการเขียนเอง (รวม `menu_ap_transport_label` / `menu_ar_transport_label` ที่สร้างจาก `transportLabelConfig` บรรทัด 99, 1220, 1312) แล้ว spread `...MASTER_DETAIL_CONFIGS` ท้ายสุด (บรรทัด 1416) อีก 24 รายการ รวมไม่ซ้ำ 120 key (ซ้ำกัน 3 key: `menu_sale_plan`, `menu_account_period`, `menu_view_manager_custom` - ตัวหลัง spread ชนะ จึงเป็นจอ master-detail). ดูรายการ master-detail ที่ [[fe-standard-master-screen]].

**เข้าทะเบียนจอ**: `screenRegistry.tsx:1012-1023` วนทุก key ใน `IC_MASTER_CONFIGS` แล้ว `createMasterScreen(key)` (บรรทัด 152) - ถ้า config มี `detail` ใช้ `MasterDetailScreen` ไม่งั้นใช้ `StandardMasterScreen`; `createMasterScreen` ทับ `menuCode`/`title` ของ config ด้วยโหนดเมนูใน `bcMenu` ผ่าน `getMenuCodeByName`/`getMenuTextByName` ([[fe-screen-registry-menu]]). **ข้อยกเว้น**: key ที่ `BASE_SCREENS` ลงทะเบียนไว้ก่อนแล้วจะไม่ถูกสร้างซ้ำ (เงื่อนไข `if (!BASE_SCREENS[key])` บรรทัด 1014) - ใช้จอเฉพาะแทน: `menu_setup_ic_unit` (`UnitScreen`, :297), `menu_ic_description` (:639) / `menu_ic_description_fast` (:651), `menu_ic_item_barcode` (:316), `menu_ic_item_add_barcode_fast` (:324), `menu_ic_item_level` (:690), `menu_ic_multi_item_level` (:702) และ `menu_setup_province` / `menu_setup_ampher` / `menu_setup_tambon` (`ProvinceTreeScreen` ผ่าน `buildProvinceTreeEntry` บรรทัด 987-1010 ซึ่งผูกอีก 2 key คือ `menu_setup_province_auto`, `menu_province_auto`). `ic_warehouse_and_location_group` (:348) และ `menu_ic_warehouse_locaton` (:310) ลงทะเบียนมือเช่นกันแต่ยังเรียก `createMasterScreen(key)` จึงได้จอ master-detail ตาม config ปกติ. ท้ายสุดมีรอบซิงค์ `code`/`title` ทุก entry ของ `BASE_SCREENS` กับเมนูอีกครั้ง (:1057-1061).

**ฟิลด์ของ `MasterScreenConfig`** (`icMasterSchemas.ts:18-62`)
| ฟิลด์ | ความหมาย |
|---|---|
| `menuKey, menuCode, title, tableName` | ผูกเมนู และตารางใน DB ที่อ่าน/เขียนตรงๆ ด้วย SQL |
| `idKey` (default `code`), `nameKey` (default `name_1`), `idLabel/nameLabel/name2Label` | คอลัมน์รหัส/ชื่อและป้ายกำกับ |
| `hideStatus` / `showStatus` | ซ่อน/แสดงช่อง "ยกเลิกการใช้งาน" (ค่าเริ่ม = ซ่อนถ้าไม่ตั้ง `showStatus`; `StandardMasterScreen.tsx:74`) |
| `noName2` | ตารางไม่มีคอลัมน์ `name_2` - ไม่แสดงและไม่บันทึก |
| `extraFields: MasterFieldDef[]` | ช่องเสริมนอกจาก รหัส/ชื่อ (type: text, textarea, number, lookup, calc, date, select, radio, checkbox; `colSpan` 6 หรือ 12) |
| `parentFilter` (+`dependentFilter`) | ต้องเลือกกลุ่มแม่ก่อนจึงแสดง/บันทึก (เช่น กลุ่มย่อย ต้องเลือกกลุ่มหลัก; `required: true` = ปิดรายการจนกว่าจะเลือก) |
| `fixedValues` | ตารางใช้ร่วม เช่น `ar_ap_type` 0=เจ้าหนี้ 1=ลูกหนี้ - ใส่เป็นเงื่อนไขทุก SELECT/UPDATE/DELETE และเขียนค่านี้ตอนเพิ่ม |
| `rowKey` | คอลัมน์ surrogate (เช่น `roworder`) เมื่อรหัสซ้ำได้ |
| `idLookupTable` | ช่องรหัสเป็นกล่องค้นหา (เช่น `cust_code` -> `ap_supplier`/`ar_customer`) |
| `fkChecks[]` | ก่อนลบ นับแถวใน `table.field` ที่ใช้รหัสนี้ (จำกัดด้วย `scopeField` ถ้ามี) ถ้ามี -> เตือน "ไม่อนุญาตให้ลบ" ด้วย `message` (`findFkUse` `StandardMasterScreen.tsx:698-722`, `handleDelete` :724) |
| `detail` | มี = เป็นจอ master + ตารางย่อย ([[fe-standard-master-screen]]) |

**ตัวอย่างจริง**: `menu_setup_ic_group_sub` (บรรทัด 132) ใช้ `parentFilter` (`main_group` -> `ic_group`, required) + `extraFields` `sub_no`; `menu_setup_ic_group_sub2` (158) ซ้อน `dependentFilter` (`ic_group_sub_code` -> `ic_group_sub`); ทั้งคู่มี `fkChecks` ไปที่ `ic_inventory` กันลบกลุ่มที่ถูกใช้.

**รายการจอ** (คอลัมน์ "รหัส" = `code` ของโหนดเมนูใน `bcMenu` ตามที่ `getMenuCodeByName` ให้ (`bcMenu.ts:276`); "ชื่อจอ" = ข้อความเมนูตาม `getMenuTextByName` (`bcMenu.ts:280`). แถว "ไม่มีโหนดเมนู" = key ที่ไม่มีใน `bcMenu` จึงใช้ชื่อใน config และ `menuCode` ของ config แปลงเป็นรหัส 4 หลักด้วย `normalizeFallbackMenuCode` (`bcMenu.ts:267-274`); คอลัมน์ "บรรทัด" = จุดเริ่ม config ใน `icMasterSchemas.ts`; ตารางไม่รวม `menu_ap_transport_label` 1220 และ `menu_ar_transport_label` 1312 "ที่อยู่จัดส่งสินค้า" ตาราง `ap_ar_transport_label` ที่สร้างจากฟังก์ชัน; จอที่ถูก `BASE_SCREENS` ทับดูข้างบน)

**ตั้งค่าองค์กร/ทั่วไป** (11)
| menu key | รหัส | ชื่อจอ | ตาราง | บรรทัด |
|---|---|---|---|---|
| `menu_setup_branch` | `1004` | กำหนดรายละเอียดสาขา | `erp_branch_list` | 458 |
| `menu_setup_department_list` | `1005` | กำหนดรายละเอียดแผนก | `erp_department_list` | 491 |
| `menu_setup_doc_group` | `1011` | กำหนดกลุ่มเอกสาร | `erp_doc_group` | 511 |
| `menu_setup_ar_logistic_area` | `1014` | กำหนดเขตการขนส่ง | `ar_logistic_area` | 517 |
| `menu_setup_currency` | `1003` | กำหนดสกุลเงิน | `erp_currency` | 523 |
| `menu_setup_province` | `1015` | กำหนดรหัสจังหวัด / อำเภอ / ตำบล | `erp_province` | 533 |
| `menu_setup_ampher` | `1015` | กำหนดรหัสจังหวัด / อำเภอ / ตำบล | `erp_amper` | 543 |
| `menu_setup_tambon` | `1015` | กำหนดรหัสจังหวัด / อำเภอ / ตำบล | `erp_tambon` | 562 |
| `menu_setup_staff_mis` | `1010` | กำหนดผู้ใช้ระบบ MIS | `mis_user` | 833 |
| `menu_setup_qr_payment` | `1022` | กำหนดค่า QR Code Payment | `erp_qr_payment` | 855 |
| `menu_setup_transport` | `1013` | กำหนดประเภทการขนส่ง | `transport_type` | 896 |

**สินค้า** (22)
| menu key | รหัส | ชื่อจอ | ตาราง | บรรทัด |
|---|---|---|---|---|
| `menu_setup_ic_group_main` | `1028` | กำหนดกลุ่มสินค้าหลัก | `ic_group` | 120 |
| `menu_setup_ic_group_sub` | `1029` | กำหนดกลุ่มสินค้าย่อย | `ic_group_sub` | 132 |
| `menu_setup_ic_group_sub2` | `1030` | กำหนดกลุ่มสินค้าย่อย2 | `ic_group_sub2` | 158 |
| `menu_setup_ic_brand` | `1032` | กำหนดยี่ห้อสินค้า | `ic_brand` | 192 |
| `menu_setup_ic_model` | `1033` | กำหนดรุ่นสินค้า | `ic_model` | 203 |
| `menu_setup_ic_color` | `1034` | กำหนดสีสินค้า | `ic_color` | 214 |
| `menu_setup_ic_size` | `1035` | กำหนดขนาดสินค้า | `ic_size` | 225 |
| `menu_setup_ic_pattern` | `1036` | กำหนดรูปแบบสินค้า | `ic_pattern` | 240 |
| `menu_setup_ic_grade` | `1037` | กำหนดเกรดสินค้า | `ic_grade` | 251 |
| `menu_setup_ic_category` | `1031` | กำหนดหมวดสินค้า | `ic_category` | 262 |
| `menu_setup_ic_design` | `1038` | กำหนดรูปทรงสินค้า | `ic_design` | 273 |
| `menu_setup_ic_dimension_name` | `1040` | กำหนดชื่อมิติสินค้า | `ic_dimension_name` | 284 |
| `menu_setup_ic_dimension` | `1041` | กำหนดมิติสินค้า | `ic_dimension` | 297 |
| `menu_setup_ic_class` | `1039` | กำหนดระดับสินค้า | `ic_class` | 339 |
| `menu_setup_ic_unit` | `1027` | กำหนดหน่วยนับสินค้า | `ic_unit` | 350 |
| `menu_setup_ic_shelf` | `1025` | กำหนดพื้นที่เก็บสินค้า | `ic_shelf` | 365 |
| `menu_setup_ic_account_group` | `1043` | กำหนดกลุ่มบัญชีสินค้า | `ic_account_group` | 392 |
| `menu_setup_ic_import_duty_point` | `1047` | กำหนดพิกัดศุลกากร | `ic_import_duty` | 426 |
| `menu_setup_ic_issue_type` | `1044` | กำหนดประเภทการเบิก | `ic_issue_type` | 434 |
| `menu_setup_stk_adjust` | `1045` | กำหนดสาเหตุการปรับปรุง | `ic_stk_adjust_reason` | 442 |
| `menu_setup_ic_close_reason` | `1046` | กำหนดเหตุผลการปิดสินค้า | `ic_close_reason` | 450 |
| `menu_manufacturer_list` | `1042` | กำหนดผู้ผลิต | `manufacturer_list` | 1313 |

**ขาย/เครดิต** (3)
| menu key | รหัส | ชื่อจอ | ตาราง | บรรทัด |
|---|---|---|---|---|
| `menu_setup_ar_sale_area` | `1048` | กำหนดเขตการขาย | `ar_sale_area` | 593 |
| `menu_approve_credit_level` | `1049` | กำหนดกลุ่มอนุมัติวงเงิน | `erp_credit_approve_level` | 902 |
| `menu_setup_other_income` | `1049` | กำหนดรายได้อื่นๆ | `erp_income_list` | 1303 |

**เจ้าหนี้** (4)
| menu key | รหัส | ชื่อจอ | ตาราง | บรรทัด |
|---|---|---|---|---|
| `menu_setup_ap_type` | `1052` | กำหนดประเภทเจ้าหนี้ | `ap_type` | 604 |
| `menu_setup_ap_group_main` | `1053` | กำหนดกลุ่มเจ้าหนี้หลัก | `ap_group` | 613 |
| `menu_setup_ap_group_sub` | `1054` | กำหนดกลุ่มเจ้าหนี้ย่อย | `ap_group_sub` | 623 |
| `menu_setup_ap_dimension` | `1055` | กำหนดมิติเจ้าหนี้ | `ap_dimension` | 642 |

**ลูกหนี้** (12)
| menu key | รหัส | ชื่อจอ | ตาราง | บรรทัด |
|---|---|---|---|---|
| `menu_setup_ar_type` | `1056` | กำหนดประเภทลูกหนี้ | `ar_type` | 655 |
| `menu_setup_ar_group_main` | `1057` | กำหนดกลุ่มลูกหนี้หลัก | `ar_group` | 664 |
| `menu_setup_ar_group_sub` | `1058` | กำหนดกลุ่มลูกหนี้ย่อย | `ar_group_sub` | 674 |
| `menu_setup_ar_dimension` | `1059` | กำหนดมิติลูกหนี้ | `ar_dimension` | 693 |
| `menu_setup_ar_credit_approve` | `1061` | กำหนดเหตุผลอนุมัติวงเงิน | `ar_credit_approve` | 921 |
| `menu_setup_ar_pay_bill_reason` | `1062` | กำหนดเงื่อนไขการวางบิล | `ar_pay_bill_condition` | 927 |
| `menu_setup_ar_keep_chq_reason` | `1063` | กำหนดเงื่อนไขการรับเช็ค | `ar_keep_chq_condition` | 933 |
| `menu_setup_ar_keep_money` | `1064` | กำหนดเงือนไขการชำระเงิน | `ar_keep_money_condition` | 939 |
| `menu_ar_credit_pay_bill` | `1065` | กำหนดวันครบกำหนดชำระเงิน | `ar_credit_pay_bill` | 945 |
| `menu_ar_contact_group` | `1060` | กำหนดกลุ่มผู้ติดต่อ | `ar_contact_group` | 966 |
| `menu_sale_plan` | ไม่มีโหนดเมนู (fallback `1064`) | กำหนดแผนการขาย | `erp_sale_plan` | 972 |
| `menu_ar_setup_paybill_area` | ไม่มีโหนดเมนู (fallback `1065`) | กำหนดเขตเก็บเงิน | `ar_paybill_area` | 983 |

**การเงิน/ธนาคาร** (11)
| menu key | รหัส | ชื่อจอ | ตาราง | บรรทัด |
|---|---|---|---|---|
| `menu_income_list` | `1071` | กำหนดประเภทรายได้ | `erp_income_list` | 318 |
| `menu_setup_bank` | `1066` | กำหนดธนาคาร | `erp_bank` | 706 |
| `menu_setup_bank_branch` | `1067` | กำหนดสาขาธนาคาร | `erp_bank_branch` | 727 |
| `menu_expenses_list` | `1072` | กำหนดประเภทค่าใช้จ่าย | `erp_expenses_list` | 742 |
| `menu_petty_cash` | `1070` | กำหนดวงเงินสดย่อย | `cb_petty_cash` | 758 |
| `menu_book_bank_type` | `1068` | ประเภทสมุดเงินฝาก | `erp_pass_book_type` | 989 |
| `menu_book_bank_trans_type` | `1069` | ตัวย่อในสมุดเงินฝาก | `erp_book_bank_trans_type` | 998 |
| `menu_setup_credit_type` | `1073` | ประเภทบัตรเครดิต | `erp_credit_type` | 1004 |
| `menu_setup_banknotes` | `1075` | กำหนดธนบัตร | `banknotes` | 1015 |
| `menu_setup_income_list` | ไม่มีโหนดเมนู (fallback `1065`) | กำหนดประเภทรายได้ | `erp_income_list` | 1378 |
| `menu_setup_expenses_list` | ไม่มีโหนดเมนู (fallback `1066`) | กำหนดประเภทค่าใช้จ่าย | `erp_expenses_list` | 1394 |

**สินทรัพย์** (7)
| menu key | รหัส | ชื่อจอ | ตาราง | บรรทัด |
|---|---|---|---|---|
| `menu_asset_setup_type` | `1076` | กำหนดประเภทสินทรัพย์ | `as_asset_type` | 787 |
| `menu_asset_setup_location` | `1077` | กำหนดตำแหน่งที่ตั้งสินทรัพย์ | `as_asset_location` | 1027 |
| `menu_asset_setup_maintain` | `1078` | กำหนดการบำรุงรักษาสินทรัพย์ | `as_asset_maintain` | 1033 |
| `menu_asset_setup_maintain_unit` | `1079` | กำหนดหน่วยการบำรุงรักษาสินทรัพย์ | `as_asset_maintain_unit` | 1039 |
| `menu_asset_setup_retire` | `1080` | กำหนดประเภทการตัดจำหน่าย | `as_asset_retire` | 1045 |
| `menu_setup_as_type` | ไม่มีโหนดเมนู (fallback `1071`) | กำหนดประเภทสินทรัพย์ | `as_asset_type` | 1366 |
| `menu_setup_as_unit` | ไม่มีโหนดเมนู (fallback `1074`) | กำหนดหน่วยการบำรุงรักษาสินทรัพย์ | `as_asset_maintain_unit` | 1372 |

**บัญชี** (12)
| menu key | รหัส | ชื่อจอ | ตาราง | บรรทัด |
|---|---|---|---|---|
| `menu_setup_gl_journal_book` | `1082` | กำหนดสมุดบัญชี | `gl_journal_book` | 795 |
| `menu_setup_side` | `1088` | กำหนดหน่วยงาน | `erp_side_list` | 807 |
| `menu_setup_allocate` | `1091` | กำหนดการจัดสรร | `erp_allocate_list` | 813 |
| `menu_setup_project` | `1089` | กำหนดโครงการ | `erp_project_list` | 819 |
| `menu_setup_job` | `1090` | กำหนดงาน | `erp_job_list` | 825 |
| `menu_account_period` | `1081` | กำหนดงวดบัญชี | `erp_account_period` | 1051 |
| `menu_setup_gl_account_type` | `1083` | กำหนดประเภทบัญชี | `gl_account_type` | 1067 |
| `menu_setup_gl_account_group` | `1084` | กำหนดกลุ่มบัญชี | `gl_account_group` | 1073 |
| `menu_setup_gl_group_for_cash_flow` | `1085` | กำหนดกลุ่มบัญชีกระแสเงินสด | `gl_cash_flow_group` | 1079 |
| `menu_tax_group` | `1086` | กำหนดกลุ่มภาษี | `gl_tax_group` | 1085 |
| `menu_tax_type` | `1087` | กำหนดประเภทภาษี | `gl_tax_type` | 1095 |
| `menu_setup_Allocate` | ไม่มีโหนดเมนู (fallback `1089`) | กำหนดการจัดสรร | `erp_allocate_list` | 1410 |

**หมวดอื่น (สินค้าเพิ่มเติม, คู่ค้า, แต้มลูกหนี้, สมุดเงินฝาก, รูปแบบค้นหา)** (15)
| menu key | รหัส | ชื่อจอ | ตาราง | บรรทัด |
|---|---|---|---|---|
| `menu_view_manager_custom` | `1096` | กำหนดรูปแบบการค้นหาข้อมูล | `erp_view_table_custom` | 1105 |
| `menu_ic_description` | `2003` | รายละเอียดสินค้า | `ic_inventory` | 1120 |
| `menu_ic_description_fast` | `2004` | แก้ไขรายละเอียด(เร็ว) | `ic_inventory` | 1133 |
| `menu_ic_item_barcode` | `2009` | กำหนดบาร์โค้ดสินค้า | `ic_inventory_barcode` | 1144 |
| `menu_ic_item_add_barcode_fast` | `2010` | เพิ่มบาร์โค๊ดสินค้าแบบเร็ว | `ic_inventory_barcode` | 1162 |
| `menu_ic_item_level` | `2023` | กำหนดลำดับการค้นหา | `ic_inventory` | 1178 |
| `menu_ic_multi_item_level` | `2024` | กำหนดลำดับการค้นหา (เร็ว) | `ic_inventory` | 1188 |
| `menu_ic_item_serial` | `2006` | ทะเบียน Serial Number | `ic_serial` | 1198 |
| `menu_ap_partner_detail` | `5003` | ข้อมูลคู่ค้า | `ap_supplier_connected` | 1221 |
| `menu_ar_credit_group` | ไม่มีโหนดเมนู (fallback `6014`) | กำหนดกลุ่มวงเงินลูกหนี้ | `ar_credit_group` | 1240 |
| `menu_ar_point_balance` | `6008` | กำหนดแต้มคงเหลือยกมา | `ic_trans` | 1250 |
| `menu_ar_cut_point` | `6010` | บันทึกตัดแต้ม | `ic_trans` | 1268 |
| `menu_ar_customer_connected` | `6004` | ข้อมูลคู่ค้า(ลูกหนี้) | `ar_customer_connected` | 1286 |
| `menu_book_bank` | `7010` | กำหนดสมุดเงินฝาก | `erp_pass_book` | 1320 |
| `menu_pass_book` | ไม่มีโหนดเมนู (fallback `7101`) | กำหนดสมุดเงินฝาก | `erp_pass_book` | 1343 | <!-- pragma: allowlist secret -->


**ข้อควรระวัง**
- `menu_book_bank` กับ `menu_pass_book` ใช้ตาราง `erp_pass_book` เหมือนกัน; `menu_income_list`/`menu_setup_other_income`/`menu_setup_income_list` ใช้ `erp_income_list` และ `menu_expenses_list`/`menu_setup_expenses_list` ใช้ `erp_expenses_list` (หลายเมนูชี้ตารางเดียวกัน).
- `menu_ar_point_balance` (1250) และ `menu_ar_cut_point` (1268) ใช้ตาราง `ic_trans` โดยตั้ง `fixedValues` `trans_flag` 801 / 802 และ `last_status: 0` (บรรทัด 1260, 1278) - ไม่ใช่ master ธรรมดา แต่ใช้โครงจอเดียวกัน.

## ที่มาในโค้ด
- `frontend/src/config/schemas/icMasterSchemas.ts:4-62` - `MasterFieldDef`, `MasterScreenConfig`
- `frontend/src/config/schemas/icMasterSchemas.ts:99-117,1220,1312` - `transportLabelConfig`
- `frontend/src/config/schemas/icMasterSchemas.ts:118-1416` - รายการ config + `...MASTER_DETAIL_CONFIGS`
- `frontend/account/tabs/screenRegistry.tsx:152-165,987-1010,1012-1023,1057-1061` - เลือก component, จอจังหวัด/อำเภอ/ตำบล, ลงทะเบียน และซิงค์รหัส/ชื่อกับเมนู
- `frontend/src/config/bcMenu.ts:267-282` - `normalizeFallbackMenuCode`, `getMenuCodeByName`, `getMenuTextByName`
- `frontend/account/master/StandardMasterScreen.tsx:74,174-182,698-722` - ใช้ `hideStatus`, `fixedValues`/`parentFilter` (เงื่อนไข SQL), `fkChecks`

## ดูเพิ่ม
[[frontend-overview]] · [[fe-standard-master-screen]] · [[fe-screen-registry-menu]] · [[fe-grid-component]] · [[fe-form-engine]]
