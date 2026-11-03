---
title: "ผังบัญชี (Chart of Accounts: MasterDetailScreen 9001 / 9002)"
tags: [screens, master]
aliases: ["ผังบัญชี", "Chart of Accounts", "menu_chart_of_account", "menu_chart_of_account_fast", "menu_chart_of_account_flow", "menu_chart_of_account_main", "9001", "9002", "9003", "gl_chart_of_account", "แก้ไขผังบัญชีแบบเร็ว", "ตรวจสอบโครงสร้างผังบัญชี"]
sources: ["frontend/src/config/schemas/masterDetailSchemas.ts:259", "frontend/src/config/schemas/masterDetailSchemas.ts:691", "frontend/src/config/schemas/masterDetailSchemas.ts:740", "frontend/account/master/MasterDetailScreen.tsx:376", "backend/internal/application/process/master_detail_specs.go:85", "backend/internal/application/process/master_detail_specs.go:113", "backend/internal/application/process/master_detail_specs.go:245", "backend/internal/application/process/master_detail_specs.go:710", "backend/internal/application/process/master_detail.go:807", "frontend/account/tabs/screenRegistry.tsx:1222", "frontend/account/process/SystemProcessWorkbenchScreen.tsx:1856"]
---
# ผังบัญชี (Chart of Accounts)

กลุ่มเมนู "ผังบัญชี (Chart of Accounts)" (`menu_chart_of_account_main`, 9001-9003) ดูแลตาราง `gl_chart_of_account`
9001 เป็นจอแก้ไขทีละบัญชี พร้อมเลือกหน่วยงาน/แผนก/การจัดสรร/งาน/โครงการที่บัญชีนั้นใช้ได้; 9002 เป็นตารางแก้หลายบัญชีพร้อมกัน; 9003 เป็นจอตรวจสอบแบบอ่านอย่างเดียว
ทั้ง 9001 และ 9002 ใช้จอกลาง [[scr-master-detail]] แล้วเขียนผ่าน Go `master-detail/save` ตัวเดียวกัน

## วิธีเปิด
| รหัส | menu_key | ชื่อ | จอ |
|---|---|---|---|
| 9001 | `menu_chart_of_account` | รายละเอียดผังบัญชี | MasterDetailScreen โหมด header (masterDetailSchemas.ts:691) |
| 9002 | `menu_chart_of_account_fast` | ปรับปรุงผังบัญชีแบบเร็ว | MasterDetailScreen โหมด table (masterDetailSchemas.ts:740) |
| 9003 | `menu_chart_of_account_flow` | ตรวจสอบโครงสร้างผังบัญชี | SystemProcessWorkbenchScreen (ชนิด `PROC:system_tool`, screenRegistry.tsx:1222) |

รายงานผังบัญชี 9041 `menu_report_chart_of_account` เป็นรายงาน (`RPT:report_gl`) ไม่ใช่จอนี้
เมนูตั้งค่าที่เกี่ยวข้อง (จอ [[scr-standard-master]] ตารางเดียว): 1082 `menu_setup_gl_journal_book` กำหนดสมุดบัญชี ([[tbl-gl-journal-book]]), 1083 `menu_setup_gl_account_type` กำหนดประเภทบัญชี (`gl_account_type`), 1084 `menu_setup_gl_account_group` กำหนดกลุ่มบัญชี (`gl_account_group`), 1085 `menu_setup_gl_group_for_cash_flow` กำหนดกลุ่มบัญชีกระแสเงินสด (`gl_cash_flow_group`) — config อยู่ที่ icMasterSchemas.ts:795,1067,1073,1079

## ช่องข้อมูลสำคัญและ validation
ช่องหัว 9001 (masterDetailSchemas.ts:691-738; ทุกแถวด้านล่างมีช่วงค่า/อ้างอิงที่ Go ตรวจ — master_detail_specs.go:85-98,113-142)
| ช่อง | คอลัมน์ `gl_chart_of_account` | ชนิด | กติกา | path:line |
|---|---|---|---|---|
| รหัสบัญชี | `code` | upper, ยาว 25 | บังคับ; แก้ได้เฉพาะตอนเพิ่มใหม่; รหัสซ้ำ → "รหัส ... มีอยู่แล้ว" | masterDetailSchemas.ts:691; master_detail.go:237-335 |
| ระดับบัญชี | `account_level` | select | บัญชีหลัก, ระดับที่ 1-7 = 0-7 (ค่าเริ่มต้น 0) | master_detail_specs.go:95 |
| ชื่อบัญชี | `name_1` | text 255 | บังคับ "กรุณาระบุชื่อบัญชี" | master_detail_specs.go:710 |
| ชื่อบัญชี (ภาษาอังกฤษ) | `name_2` | text 255 | ไม่บังคับ | masterDetailSchemas.ts:691 |
| ผังบัญชีหลัก | `main_code` | lookup บัญชี | ต้องมีอยู่จริง "ไม่พบบัญชีหลัก"; ห้ามเป็นรหัสตัวเอง "บัญชีหลักต้องไม่ใช่บัญชีเดียวกับตัวเอง"; แปลงเป็นตัวพิมพ์ใหญ่ | master_detail_specs.go:113-125,712 |
| ปิดเข้าบัญชี | `account_close` | lookup บัญชี | ต้องมีอยู่จริง "ไม่พบบัญชีปิด" | master_detail_specs.go:126 |
| กลุ่มบัญชี | `account_group` | lookup `gl_account_group` | ต้องมีอยู่จริง "ไม่พบกลุ่มบัญชี" | master_detail_specs.go:127 |
| รหัสบัญชีกระแสเงินสด | `cash_flow_group` | lookup `gl_cash_flow_group` | ต้องมีอยู่จริง "ไม่พบกลุ่มกระแสเงินสด" | master_detail_specs.go:128 |
| ประเภทบัญชี | `account_type` | radio | สินทรัพย์ / หนี้สิน / ทุน / รายได้ / ค่าใช้จ่าย = 0-4 | master_detail_specs.go:95 |
| เกี่ยวข้องกับภาษี | `tax_type` | select | ไม่เกี่ยวข้อง / ภาษีขาย / ภาษีซื้อ / หัก ณ ที่จ่าย / ถูกหัก ณ ที่จ่าย = 0-4 | master_detail_specs.go:95 |
| ผลกระทบต่องบการเงิน | `balance_sheet_status` | select | ทั่วไป / ต้นทุนขาย / การผลิต / ค่าใช้จ่าย / กำไรสะสม / ค่าใช้จ่ายต้องห้าม = 0-5 | master_detail_specs.go:95 |
| สถานะบัญชี | `status` | select | บัญชีทั่วไป / บัญชีหลัก = 0-1 | master_detail_specs.go:96 |
| ด้านบัญชี | `balance_mode` | select | เดบิต / เครดิต = 0-1 | master_detail_specs.go:96 |
| แยกหน่วยงาน / แผนก / การจัดสรร / โครงการ / งาน | `side_status` `department_status` `allocate_status` `project_status` `job_status` | check | 0-1 | master_detail_specs.go:96-97 |
| งานระหว่างทำ (JOB) | `work_in_process_status` | check | 0-1 | master_detail_specs.go:97 |
| ใช้งาน | `active_status` | check | 0-1 (ค่าเริ่มต้น 1) | master_detail_specs.go:97 |

ตารางย่อยของ 9001 เป็นกริดแบบติ๊กเลือก (มีช่อง "เลือกทั้งหมด" คอลัมน์ รหัส / ชื่อ, ดึงตัวเลือก `limit 2000`) — masterDetailSchemas.ts:268,691-738
| แท็บ | ตารางลิงก์ (เก็บ `account_code` + รหัสที่เลือก) | ตารางตัวเลือก |
|---|---|---|
| หน่วยงาน | `gl_chart_of_account_side_list` | `erp_side_list` |
| แผนก | `gl_chart_of_account_depart_list` | `erp_department_list` |
| การจัดสรร | `gl_chart_of_account_allocate_list` | `erp_allocate_list` |
| งาน | `gl_chart_of_account_job_list` | `erp_job_list` |
| โครงการ | `gl_chart_of_account_project_list` | `erp_project_list` |

กติกากริดเลือก: รหัสที่เลือกต้องมีในตารางตัวเลือก ("ไม่พบรหัสที่เลือก"), เลือกซ้ำในแท็บเดียว → "เลือกรหัสซ้ำ: <รหัส>", แถวว่างข้าม — master_detail_specs.go:100-117,710-728
9002 (แก้แบบตาราง): กริด `accounts` 20 คอลัมน์ = `code`, `name_1`, `name_2`, `main_code`, `status`, `account_level`, `account_type`, `tax_type`, `account_group`, `cash_flow_group`, `account_close`, `balance_mode`, `balance_sheet_status`, flags 6 ช่อง, `active_status`; ส่งเฉพาะแถวที่แก้ (`_dirty`) — masterDetailSchemas.ts:740-781; MasterDetailScreen.tsx:543
กติกา 9002: แถวที่แก้ต้องมีรหัส "แถวที่แก้ไขต้องมีรหัสบัญชี"; ถ้าส่ง `name_1` ว่าง → "บัญชี <รหัส>: กรุณาระบุชื่อบัญชี"; ค่าช่วงเดียวกับ 9001 (`chartRanges`) — master_detail_specs.go:245-251,731-740
ตัวเลขเงินไม่มีในจอนี้ (ผังบัญชีเป็นข้อมูลหลักไม่มียอดเงิน) — หากจอใดแสดงยอดเงินใช้ `@/lib/numeric` ตาม [[fe-numeric-money]]

## ปุ่ม / คีย์ลัด
- 9001: รายการซ้าย (ค้นหา `code`, `name_1`, `name_2`, เรียงตามรหัส) ปุ่มแก้ไข / เพิ่มใหม่ / ลบ / บันทึก / ปิดหน้าจอ และ Ctrl+S ตามจอกลาง (9001 ตั้ง `canDelete: true` ที่ masterDetailSchemas.ts:700) [[scr-master-detail]] — masterDetailSchemas.ts:691; MasterDetailScreen.tsx:627
- 9002: ปกติกริดแบบ `updateOnly` เพิ่มแถวไม่ได้ แต่โค้ดยกเว้นให้ `menu_chart_of_account_fast` เพิ่มแถวว่างและกด "+ เพิ่มแถว" ได้ — MasterDetailScreen.tsx:376,464,846
- 9002 ไม่มีรายการซ้าย (ไม่มี `list`) เปิดมาโหลดบัญชีทั้งตารางทันที สูงสุด 2000 แถว — MasterDetailScreen.tsx:140-155,179
- ไม่พบตัวดัก Esc/F12 ในจอกลาง

## popup / modal ที่เรียกได้
- BcLookupModal: ช่อง ผังบัญชีหลัก / ปิดเข้าบัญชี (ตาราง `gl_chart_of_account`), กลุ่มบัญชี (`gl_account_group`), รหัสบัญชีกระแสเงินสด (`gl_cash_flow_group`) — [[scr-data-list-and-lookup]]
- BcDialog: ยืนยันลบ "ยืนยันการลบ", แจ้ง "ลบไม่สำเร็จ" เมื่อ Go ปฏิเสธ — [[scr-data-list-and-lookup]]

## API / process actions
- `POST /api/process/master-detail/save` `{menuKey, key, scope, mode, header, grids}` และ `.../delete` `{menuKey, key, scope}` (key = รหัสบัญชี) — MasterDetailScreen.tsx:565,600
- 9001 บันทึก: เขียนหัว `gl_chart_of_account` แล้วล้าง 5 ตารางลิงก์ของบัญชีนั้นและเขียนตามที่ติ๊กใหม่ทั้งหมด — master_detail_specs.go:113-142; master_detail.go:675-705
- ลบ 9001: Go บล็อกถ้ารหัสถูกใช้ แล้วจึงลบ 5 ตารางลิงก์และหัว ข้อความ "ไม่อนุญาตให้ลบ <รหัส>: <เหตุผล>" โดยลำดับตรวจดังนี้ — master_detail_specs.go:129-141; master_detail.go:177-235
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

- 9002 ไม่มี `hdrTable` จึงไม่มีรายการ `refs` ตรวจการมีอยู่ของ `main_code` / `account_group` / `cash_flow_group` / `account_close` ฝั่ง Go (มีเพียงแปลงเป็นตัวพิมพ์ใหญ่และตรวจช่วงค่า) และ 9002 ไม่มีปุ่มลบ — master_detail_specs.go:245-251
- 9003: ปุ่มค้นหารันคำสั่งอ่านอย่างเดียว `SELECT code, name_1, account_type, account_level, main_code, status FROM gl_chart_of_account [WHERE code ILIKE '%คำค้น%' OR name_1 ILIKE '%คำค้น%'] ORDER BY code LIMIT 250` แล้วสรุป "ผังบัญชีที่ตรวจสอบ N บัญชี" — SystemProcessWorkbenchScreen.tsx:1856-1868

## ตารางที่ข้อมูลลงไป
- [[tbl-gl-chart-of-account]] (หัวบัญชี) + ตารางลิงก์ 5 ตารางตามตารางด้านบน
- ตารางที่ตรวจก่อนลบ: [[tbl-gl-journal-detail]], `gl_trans_detail`, `gl_account_close_detail`, [[tbl-as-asset]], [[tbl-ar-customer-detail]], `erp_credit_type`, `erp_wallet_list`
- รายละเอียดการลงบัญชีที่ใช้ผังนี้ ดู [[acc-gl-posting-standard]]; ลำดับ workflow/ยกเลิก/lookup ดู [[std-menu-workflow-cancel-lookup]]

## ข้อควรระวัง
- `account_type` ในจอเป็นตัวเลือกคงที่ 0-4 ตามที่กำหนดใน config ไม่ได้ดึงจากตาราง `gl_account_type`; ไม่พบการอ้างอิง `gl_account_type` ใน config ผังบัญชีและ spec ของ Go (เมนู 1083 จึงไม่เชื่อมกับช่องนี้ในโค้ดที่อ่าน)
- 9001 กดบันทึกแล้วลิงก์หน่วยงาน/แผนก/การจัดสรร/งาน/โครงการถูกล้างแล้วเขียนใหม่ตามที่ติ๊กไว้ในจอ (semantics แทนที่) — master_detail_specs.go:139-141
- 9002 ตอนแก้บัญชีเดิม จอส่งรหัสในช่อง `code` ของแถวเป็นคีย์ UPDATE; ถ้า UPDATE ไม่พบแถว (`RowsAffected != 1`) และตารางคือ `gl_chart_of_account` ระบบ INSERT แถวใหม่แทนที่จะแจ้ง "ไม่พบรายการ" — master_detail.go:839-851. เมื่อผู้ใช้เปลี่ยนรหัสในแถวเดิม น่าจะได้บัญชีใหม่แทนการเปลี่ยนรหัส (อนุมานจากโค้ด ยังไม่ได้ทดสอบ)
- 9002 โหลดสูงสุด 2000 แถวต่อครั้ง ถ้าผังบัญชีใหญ่กว่านี้ แถวที่เกินไม่ปรากฏ — MasterDetailScreen.tsx:140-155
- ตรวจก่อนลบมี 11 รายการอ้างอิงตามตารางด้านบน ตารางอื่นที่อ้างรหัสบัญชีไม่พบการตรวจในโค้ดที่อ่าน (master_detail_specs.go:129-141)

## ที่มาในโค้ด
- `frontend/src/config/schemas/masterDetailSchemas.ts:259-266,268,691-781` — CHART_CHECKS, chartPick, config 9001/9002
- `frontend/account/master/MasterDetailScreen.tsx:376,464,543,846` — ข้อยกเว้นของ 9002 และการส่งเฉพาะแถวที่แก้
- `backend/internal/application/process/master_detail_specs.go:85-142,245-251,710-740` — chartHdrCols, chartRanges, chartLinkGrid, chartSpec, fast spec, prepChart/prepChartFast
- `backend/internal/application/process/master_detail.go:177-235,675-705,807-854` — ลบ, เขียน, updateRow
- `frontend/account/tabs/screenRegistry.tsx:1222`, `frontend/account/process/SystemProcessWorkbenchScreen.tsx:1856-1868` — 9003
- ลิงก์ดูเพิ่ม: [[scr-master-detail]] [[scr-standard-master]] [[acc-gl-posting-standard]] [[std-menu-workflow-cancel-lookup]] [[fe-numeric-money]] [[screens-overview]]
