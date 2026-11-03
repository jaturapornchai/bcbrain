---
title: "ผังบัญชี (Chart of Accounts: MasterDetailScreen 9001 / 9002)"
tags: [screens, master]
aliases: ["ผังบัญชี", "Chart of Accounts", "menu_chart_of_account", "menu_chart_of_account_fast", "menu_chart_of_account_flow", "menu_chart_of_account_main", "9001", "9002", "9003", "gl_chart_of_account", "แก้ไขผังบัญชีแบบเร็ว", "ตรวจสอบโครงสร้างผังบัญชี"]
sources: ["frontend/src/config/schemas/masterDetailSchemas.ts:260", "frontend/src/config/schemas/masterDetailSchemas.ts:688", "frontend/src/config/schemas/masterDetailSchemas.ts:747", "frontend/account/master/MasterDetailScreen.tsx:378", "frontend/account/master/MasterDetailScreen.tsx:1198", "frontend/account/master/ChartOfAccountToolsBar.tsx:172", "backend/internal/application/process/master_detail_specs.go:90", "backend/internal/application/process/master_detail_specs.go:113", "backend/internal/application/process/master_detail_specs.go:245", "backend/internal/application/process/master_detail_specs.go:710", "backend/internal/application/process/master_detail.go:807", "frontend/account/tabs/screenRegistry.tsx:1222", "frontend/account/process/SystemProcessWorkbenchScreen.tsx:1856"]
---
# ผังบัญชี (Chart of Accounts)

กลุ่มเมนู "ผังบัญชี (Chart of Accounts)" (`menu_chart_of_account_main`, 9001-9003) ดูแลตาราง `gl_chart_of_account`
9001 เป็นจอแก้ไขทีละบัญชี พร้อมเลือกหน่วยงาน/แผนก/การจัดสรร/งาน/โครงการที่บัญชีนั้นใช้ได้; 9002 เป็นตารางแก้หลายบัญชีพร้อมกัน; 9003 เป็นจอตรวจสอบแบบอ่านอย่างเดียว
ทั้ง 9001 และ 9002 ใช้จอกลาง [[scr-master-detail]] แล้วเขียนผ่าน Go `master-detail/save` ตัวเดียวกัน และมีแถบเครื่องมือ "แม่แบบผังบัญชี TFRS / ส่งออก CSV / นำเข้า CSV" อยู่ด้านบน ([[scr-chart-of-accounts-tools]])

## วิธีเปิด
| รหัส | menu_key | ชื่อ | จอ |
|---|---|---|---|
| 9001 | `menu_chart_of_account` | รายละเอียดผังบัญชี | MasterDetailScreen โหมด header (masterDetailSchemas.ts:688-744) |
| 9002 | `menu_chart_of_account_fast` | ปรับปรุงผังบัญชีแบบเร็ว | MasterDetailScreen โหมด table (masterDetailSchemas.ts:747-787) |
| 9003 | `menu_chart_of_account_flow` | ตรวจสอบโครงสร้างผังบัญชี | SystemProcessWorkbenchScreen โหมด `system_tool` (`createProcessScreen`, screenRegistry.tsx:82-97; เงื่อนไข :1222; คืนจอ :1254-1260) |

รายงานผังบัญชี 9041 `menu_report_chart_of_account` ("รายงานรายละเอียดผังบัญชี") ไม่ใช่จอนี้ เมนูนี้ไม่มีจอเฉพาะ จึงถูกสร้างเป็นจอรายงานอัตโนมัติโหมด `report_gl` เพราะอยู่ใต้หมวด `menu_general_ledger_main` (`buildDynamicScreen`, screenRegistry.tsx:1067,1347,1367-1377)
เมนูตั้งค่าที่เกี่ยวข้อง (จอ [[scr-standard-master]] ตารางเดียว): 1082 `menu_setup_gl_journal_book` กำหนดสมุดบัญชี ([[tbl-gl-journal-book]]), 1083 `menu_setup_gl_account_type` กำหนดประเภทบัญชี (`gl_account_type`), 1084 `menu_setup_gl_account_group` กำหนดกลุ่มบัญชี (`gl_account_group`), 1085 `menu_setup_gl_group_for_cash_flow` กำหนดกลุ่มบัญชีกระแสเงินสด (`gl_cash_flow_group`) — config อยู่ที่ icMasterSchemas.ts:795,1067,1073,1079

## ช่องข้อมูลสำคัญและ validation
ช่องหัว 9001 (masterDetailSchemas.ts:711-725; ทุกแถวด้านล่างมีช่วงค่า/อ้างอิงที่ Go ตรวจ — master_detail_specs.go:90-97,113-121)
| ช่อง | คอลัมน์ `gl_chart_of_account` | ชนิด | กติกา | path:line |
|---|---|---|---|---|
| รหัสบัญชี | `code` | upper, ยาว 25 | บังคับ "กรุณาระบุรหัส"; ยาวเกิน 25 → "รหัสยาวเกิน 25 ตัวอักษร"; แก้ได้เฉพาะตอนเพิ่มใหม่; รหัสซ้ำตอนเพิ่ม → "รหัส ... มีอยู่แล้ว" | masterDetailSchemas.ts:711; MasterDetailScreen.tsx:559-563,657; master_detail.go:237-254,329-331 |
| ระดับบัญชี | `account_level` | select | บัญชีหลัก, ระดับที่ 1-7 = 0-7 (ค่าเริ่มต้น 0) | masterDetailSchemas.ts:251,712; master_detail_specs.go:95 |
| ชื่อบัญชี | `name_1` | text 255 | บังคับ "กรุณาระบุชื่อบัญชี" | masterDetailSchemas.ts:713; master_detail_specs.go:711-713 |
| ชื่อบัญชี (ภาษาอังกฤษ) | `name_2` | text 255 | ไม่บังคับ | masterDetailSchemas.ts:714 |
| ผังบัญชีหลัก | `main_code` | lookup บัญชี | ต้องมีอยู่จริง "ไม่พบบัญชีหลัก"; ห้ามเป็นรหัสตัวเอง "บัญชีหลักต้องไม่ใช่บัญชีเดียวกับตัวเอง"; แปลงเป็นตัวพิมพ์ใหญ่ | masterDetailSchemas.ts:715; master_detail_specs.go:116-117,714-716 |
| ปิดเข้าบัญชี | `account_close` | lookup บัญชี | ต้องมีอยู่จริง "ไม่พบบัญชีปิด"; แปลงเป็นตัวพิมพ์ใหญ่ | masterDetailSchemas.ts:716; master_detail_specs.go:116,118 |
| กลุ่มบัญชี | `account_group` | lookup `gl_account_group` | ต้องมีอยู่จริง "ไม่พบกลุ่มบัญชี" | masterDetailSchemas.ts:717; master_detail_specs.go:119 |
| รหัสบัญชีกระแสเงินสด | `cash_flow_group` | lookup `gl_cash_flow_group` | ต้องมีอยู่จริง "ไม่พบกลุ่มกระแสเงินสด" | masterDetailSchemas.ts:718; master_detail_specs.go:120 |
| ประเภทบัญชี | `account_type` | radio | สินทรัพย์ / หนี้สิน / ทุน / รายได้ / ค่าใช้จ่าย = 0-4 | masterDetailSchemas.ts:252,719; master_detail_specs.go:95 |
| เกี่ยวข้องกับภาษี | `tax_type` | radio | ไม่เกี่ยวข้อง / ภาษีขาย / ภาษีซื้อ / หัก ณ ที่จ่าย / ถูกหัก ณ ที่จ่าย = 0-4 | masterDetailSchemas.ts:253,720; master_detail_specs.go:95 |
| ผลกระทบต่องบการเงิน | `balance_sheet_status` | radio | ทั่วไป / ต้นทุนขาย / การผลิต / ค่าใช้จ่าย / กำไรสะสม / ค่าใช้จ่ายต้องห้าม = 0-5 | masterDetailSchemas.ts:254,721; master_detail_specs.go:95 |
| สถานะบัญชี | `status` | radio | บัญชีทั่วไป / บัญชีหลัก = 0-1 | masterDetailSchemas.ts:255,722; master_detail_specs.go:96 |
| ด้านบัญชี | `balance_mode` | radio | เดบิต / เครดิต = 0-1 | masterDetailSchemas.ts:256,723; master_detail_specs.go:96 |
| แยกหน่วยงาน / แผนก / การจัดสรร / โครงการ / งาน | `side_status` `department_status` `allocate_status` `project_status` `job_status` | check | 0-1 | masterDetailSchemas.ts:260-267,724; master_detail_specs.go:96-97 |
| งานระหว่างทำ (JOB) | `work_in_process_status` | check | 0-1 | masterDetailSchemas.ts:266,724; master_detail_specs.go:97 |
| ใช้งาน | `active_status` | check | 0-1 (ค่าเริ่มต้น 1) | masterDetailSchemas.ts:725; master_detail_specs.go:97 |

ตารางย่อยของ 9001 เป็นกริดแบบติ๊กเลือก (ช่องติ๊กที่หัวตารางใช้เลือก/ไม่เลือกทั้งหมด คอลัมน์ รหัส / ชื่อ, ดึงตัวเลือก `limit 2000` เรียงตามรหัส) — masterDetailSchemas.ts:269-275,729-742; MasterDetailScreen.tsx:353-364,1072-1100
| แท็บ | ตารางลิงก์ (เก็บ `account_code` + รหัสที่เลือก) | ตารางตัวเลือก |
|---|---|---|
| หน่วยงาน | `gl_chart_of_account_side_list` | `erp_side_list` |
| แผนก | `gl_chart_of_account_depart_list` | `erp_department_list` |
| การจัดสรร | `gl_chart_of_account_allocate_list` | `erp_allocate_list` |
| งาน | `gl_chart_of_account_job_list` | `erp_job_list` |
| โครงการ | `gl_chart_of_account_project_list` | `erp_project_list` |

กติกากริดเลือก: รหัสที่เลือกต้องมีในตารางตัวเลือก ("ไม่พบรหัสที่เลือก"), เลือกซ้ำในแท็บเดียว → "เลือกรหัสซ้ำ: <รหัส>", แถวว่างข้าม — master_detail_specs.go:99-103 (ไม่พบรหัสที่เลือก/แถวว่าง), 710-728 (เลือกซ้ำ)
9002 (แก้แบบตาราง): กริด `accounts` 20 คอลัมน์ = `code`, `name_1`, `name_2`, `main_code`, `status`, `account_level`, `account_type`, `tax_type`, `account_group`, `cash_flow_group`, `account_close`, `balance_mode`, `balance_sheet_status`, flags 6 ช่อง, `active_status`; ส่งเฉพาะแถวที่แก้ (`_dirty`) — masterDetailSchemas.ts:757-782; MasterDetailScreen.tsx:388,545
กติกา 9002: แถวที่แก้ต้องมีรหัส "แถวที่แก้ไขต้องมีรหัสบัญชี"; ถ้าส่ง `name_1` ว่าง → "บัญชี <รหัส>: กรุณาระบุชื่อบัญชี"; ค่าช่วงเดียวกับ 9001 (`chartRanges`) — master_detail_specs.go:245-251,731-740
ตัวเลขเงินไม่มีในจอนี้ (ผังบัญชีเป็นข้อมูลหลักไม่มียอดเงิน) — หากจอใดแสดงยอดเงินใช้ `@/lib/numeric` ตาม [[fe-numeric-money]]

## ปุ่ม / คีย์ลัด
- 9001: รายการซ้าย (ค้นหา `code`, `name_1`, `name_2`, เรียงตามรหัส โหลดสูงสุด 500 แถว — MasterDetailScreen.tsx:250-252) ปุ่มแก้ไข / เพิ่มใหม่ / ลบ / บันทึก / ปิดหน้าจอ และ Ctrl+S ตามจอกลาง (9001 ตั้ง `canDelete: true` ที่ masterDetailSchemas.ts:707) [[scr-master-detail]] — masterDetailSchemas.ts:695-707; MasterDetailScreen.tsx:629-635,1155-1185
- 9001 และ 9002: แถบ `ChartOfAccountToolsBar` ด้านบนของเนื้อหา (ปุ่ม "แม่แบบผังบัญชี TFRS", "ส่งออก CSV / Excel", "นำเข้า CSV") ส่งรหัสบัญชีที่มีอยู่ในหน้าจอไปให้ตรวจซ้ำ และรีโหลดข้อมูลหลังเพิ่ม/นำเข้า — MasterDetailScreen.tsx:1198-1207; รายละเอียดดู [[scr-chart-of-accounts-tools]]
- 9002: ปกติกริดแบบ `updateOnly` เพิ่มแถวไม่ได้ แต่โค้ดยกเว้นให้ `menu_chart_of_account_fast` เพิ่มแถวว่างและกด "+ เพิ่มแถว" ได้ — MasterDetailScreen.tsx:378,466,848,1008-1020
- 9002 ไม่มีรายการซ้าย (ไม่มี `list`) เปิดมาโหลดบัญชีทั้งตารางทันที สูงสุด 2000 แถว — MasterDetailScreen.tsx:142-157,179,348
- ไม่พบตัวดัก Esc/F12 ในจอกลาง (มีเฉพาะ Ctrl+S / Cmd+S — MasterDetailScreen.tsx:629)

## popup / modal ที่เรียกได้
- BcLookupModal: ช่อง ผังบัญชีหลัก / ปิดเข้าบัญชี (ตาราง `gl_chart_of_account`), กลุ่มบัญชี (`gl_account_group`), รหัสบัญชีกระแสเงินสด (`gl_cash_flow_group`) — [[scr-data-list-and-lookup]]
- BcDialog: ยืนยันลบ "ยืนยันการลบ", แจ้ง "ลบไม่สำเร็จ" เมื่อ Go ปฏิเสธ — MasterDetailScreen.tsx:600-620; [[scr-data-list-and-lookup]]
- โมดัลของแถบเครื่องมือ (แม่แบบ TFRS / นำเข้า CSV) — [[scr-chart-of-accounts-tools]]

## API / process actions
- `POST /api/process/master-detail/save` `{menuKey, key, scope, mode, header, grids}` และ `.../delete` `{menuKey, key, scope}` (key = รหัสบัญชี) — MasterDetailScreen.tsx:567-575,602
- 9001 บันทึก: เขียนหัว `gl_chart_of_account` แล้วล้าง 5 ตารางลิงก์ของบัญชีนั้นและเขียนตามที่ติ๊กใหม่ทั้งหมด — master_detail_specs.go:113-142; master_detail.go:675-704
- ลบ 9001: Go ตรวจว่ามีรหัสนี้อยู่ ("ไม่พบรายการ <รหัส>") แล้วบล็อกถ้ารหัสถูกใช้ จึงลบ 5 ตารางลิงก์และหัว ข้อความ "ไม่อนุญาตให้ลบ <รหัส>: <เหตุผล>" โดยลำดับตรวจดังนี้ (จับคู่แบบไม่สนตัวพิมพ์เล็กใหญ่) — master_detail_specs.go:124,126-141; master_detail.go:177-234
| ตารางที่อ้างรหัส | คอลัมน์ | ข้อความ |
|---|---|---|
| `gl_journal_detail` | `account_code` | ถูกใช้ในสมุดรายวัน |
| `gl_trans_detail` | `account_code` | ถูกใช้ในรายการบัญชี |
| `gl_account_close_detail` | `account_code` | ถูกใช้ในการตั้งค่าปิดบัญชี |
| `gl_chart_of_account` | `main_code` | เป็นบัญชีหลักของบัญชีอื่น |
| `gl_chart_of_account` | `account_close` | ถูกใช้เป็นบัญชีปิดของบัญชีอื่น |
| `as_asset` | `account_code` / `depreciation_account_code` / `depreciation_sum_account_code` | ถูกใช้ในทะเบียนสินทรัพย์ (+ค่าเสื่อม / ค่าเสื่อมสะสม) |
| `ar_customer_detail` | `account_code` | ถูกใช้ในข้อมูลลูกหนี้ |
| `erp_credit_type` | `account_code` | ถูกใช้ในประเภทบัตรเครดิต |
| `erp_wallet_list` | `account_code` | ถูกใช้ในกระเป๋าเงิน |

- 9002 ไม่มี `hdrTable` จึงไม่มีรายการ `refs` ตรวจการมีอยู่ของ `main_code` / `account_group` / `cash_flow_group` / `account_close` ฝั่ง Go (มีเพียงแปลงเป็นตัวพิมพ์ใหญ่และตรวจช่วงค่า) และ 9002 ไม่มีปุ่มลบ — master_detail_specs.go:245-251; masterDetailSchemas.ts:747-787
- 9003: ปุ่มค้นหารันคำสั่งอ่านอย่างเดียว `SELECT code, name_1, account_type, account_level, main_code, status FROM gl_chart_of_account [WHERE code ILIKE '%คำค้น%' OR name_1 ILIKE '%คำค้น%'] ORDER BY code LIMIT 250` แล้วสรุป "ผังบัญชีที่ตรวจสอบ N บัญชี" — SystemProcessWorkbenchScreen.tsx:1856-1867
- แถบเครื่องมือเขียน `gl_chart_of_account` ด้วยคำสั่ง SQL ผ่าน `POST /api/query/execBatch` โดยตรง ไม่ผ่าน `master-detail/save` — กติกาด้านบน (ช่วงค่า, การมีอยู่ของบัญชีหลัก/กลุ่ม) จึงไม่ถูกบังคับกับการเพิ่ม/นำเข้าจากแถบนี้ — ChartOfAccountToolsBar.tsx:238-262,325-361; query-client.ts:63-67

## ตารางที่ข้อมูลลงไป
- [[tbl-gl-chart-of-account]] (หัวบัญชี) + ตารางลิงก์ 5 ตารางตามตารางด้านบน
- ตารางที่ตรวจก่อนลบ: [[tbl-gl-journal-detail]], `gl_trans_detail`, `gl_account_close_detail`, [[tbl-as-asset]], [[tbl-ar-customer-detail]], `erp_credit_type`, `erp_wallet_list`
- รายละเอียดการลงบัญชีที่ใช้ผังนี้ ดู [[acc-gl-posting-standard]]; ลำดับ workflow/ยกเลิก/lookup ดู [[std-menu-workflow-cancel-lookup]]

## ข้อควรระวัง
- `account_type` ในจอเป็นตัวเลือกคงที่ 0-4 ตามที่กำหนดใน config ไม่ได้ดึงจากตาราง `gl_account_type`; ไม่พบการอ้างอิง `gl_account_type` ใน config ผังบัญชีและ spec ของ Go (เมนู 1083 จึงไม่เชื่อมกับช่องนี้ในโค้ดที่อ่าน)
- 9001 กดบันทึกแล้วลิงก์หน่วยงาน/แผนก/การจัดสรร/งาน/โครงการถูกล้างแล้วเขียนใหม่ตามที่ติ๊กไว้ในจอ (semantics แทนที่) — master_detail_specs.go:122-125; master_detail.go:683-687
- 9002 ตอนแก้บัญชีเดิม จอส่งรหัสในช่อง `code` ของแถวเป็นคีย์ UPDATE; ถ้า UPDATE ไม่พบแถว (`RowsAffected != 1`) และตารางคือ `gl_chart_of_account` ระบบ INSERT แถวใหม่แทนที่จะแจ้ง "ไม่พบรายการ" — master_detail.go:839-851. เมื่อผู้ใช้เปลี่ยนรหัสในแถวเดิม น่าจะได้บัญชีใหม่แทนการเปลี่ยนรหัส (อนุมานจากโค้ด ยังไม่ได้ทดสอบ)
- 9002 โหลดสูงสุด 2000 แถวต่อครั้ง ถ้าผังบัญชีใหญ่กว่านี้ แถวที่เกินไม่ปรากฏ — MasterDetailScreen.tsx:142-157
- ตรวจก่อนลบมี 11 รายการอ้างอิงตามตารางด้านบน ตารางอื่นที่อ้างรหัสบัญชีไม่พบการตรวจในโค้ดที่อ่าน (master_detail_specs.go:126-141)

## ที่มาในโค้ด
- `frontend/src/config/schemas/masterDetailSchemas.ts:248-256,260-275,688-787` — ตัวเลือกคงที่, CHART_CHECKS, chartPick, config 9001/9002
- `frontend/account/master/MasterDetailScreen.tsx:142-157,348,353-364,378,466,545,559-575,602,629-635,848,1072-1100,1198-1208` — โหลด/ส่งข้อมูล, ข้อยกเว้นของ 9002, กริดติ๊กเลือก, ที่ติดตั้งแถบเครื่องมือ
- `backend/internal/application/process/master_detail_specs.go:90-142,245-251,710-740` — chartHdrCols, chartRanges, chartLinkGrid, chartSpec, spec ของ 9002, prepChart/prepChartFast
- `backend/internal/application/process/master_detail.go:177-254,329-331,398-413,675-704,807-853` — ลบ, คีย์, ตรวจช่วงค่า, เขียน, updateRow
- `frontend/account/tabs/screenRegistry.tsx:82-97,1067,1222,1254-1260,1347,1367-1377` — 9003 (จอ `system_tool`) และ 9041 (จอรายงานอัตโนมัติ)
- `frontend/account/process/SystemProcessWorkbenchScreen.tsx:1856-1867` — 9003
- `frontend/account/master/ChartOfAccountToolsBar.tsx:154-170,172-262,325-361`, `frontend/src/lib/query-client.ts:63-67` — แถบเครื่องมือและช่องทางเขียน SQL
- ดูเพิ่ม: [[scr-master-detail]] [[scr-chart-of-accounts-tools]] [[scr-standard-master]] [[acc-gl-posting-standard]] [[std-menu-workflow-cancel-lookup]] [[fe-numeric-money]] [[screens-overview]]
