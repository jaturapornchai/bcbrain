---
title: "จอรายงานกลาง (Universal Report Screen)"
tags: [frontend, report, nextjs, process-api]
aliases: ["หน้ารายงาน", "UniversalReportScreen", "รายงานทำงานยังไง", "report/run", "เงื่อนไขรายงาน", "รูปแบบรายงาน template", "ส่งออก CSV รายงาน", "AI วิเคราะห์รายงาน", "รายละเอียดการซื้อ การขาย"]
sources: ["frontend/account/report/UniversalReportScreen.tsx:79", "frontend/account/report/UniversalReportScreen.tsx:268", "frontend/account/report/UniversalReportScreen.tsx:401", "frontend/src/lib/query-client.ts:940", "frontend/src/app/api/process/report/run/route.ts:12", "frontend/account/tabs/screenRegistry.tsx:1262", "frontend/account/report/BuySaleInformationScreen.tsx:27"]
---

# จอรายงานกลาง (Universal Report Screen)

รายงานเกือบทุกเมนูใช้ component เดียวคือ `UniversalReportScreen` ที่เป็น thin client: หน้าจอส่งเงื่อนไขไป `POST /api/process/report/run` แล้ว backend คืนคอลัมน์ แถว ยอดรวม และ SQL ที่รันกลับมา หน้าจอไม่คำนวณยอดเอง
เมนูที่ไม่ใช่รายงานมาตรฐานมีแค่ไม่กี่จอ (ตารางด้านล่าง)

## ทำงานอย่างไร

1. `screenRegistry.tsx` แยกเมนูรายงานเป็น `mode` (11 โหมดรายงาน + `check_price` + `barcode_print` + `sql_utility`) ตามกลุ่มเมนูบนสุด (`topBranchName`) แล้วห่อด้วย `createReportScreen` (`screenRegistry.tsx:173`) -> `UniversalReportScreen config={menuKey,menuCode,title,mode}` (type `WorkbenchMode` ที่ `UniversalReportScreen.tsx:79-92`)
2. ตอนเปิดจอ (หรือ `menuKey`/`mode` เปลี่ยน) `useEffect` ที่ `UniversalReportScreen.tsx:568-585` ล้างเงื่อนไขเดิมแล้วเรียก `runReport` ทันทีรอบแรก ไม่ต้องกดปุ่ม ถ้า backend ตอบ `detailDefault` (เมนูที่ต้นฉบับ C# ติ๊ก "แสดงรายละเอียด" ไว้) จะรันซ้ำแบบ `viewDetail: true` อัตโนมัติ
3. `buildCurrentPayload` (`:268`) ประกอบ `ReportRunPayload` (`query-client.ts:940`) จากค่าบนหน้าจอทั้งหมด: `menuKey`, `mode`, `dateFrom/dateTo`, `fromCode/toCode`, `orderBy`, `keyword`, `viewDetail`, `options` (ค่าเงื่อนไขเพิ่มเติม), ค่าตั้งหน้ากระดาษ (`paperSize`, `orientation`, `printTheme`, `reportLang` ฯลฯ), `groupByColumn/subGroupByColumn`, `customSql`, `customColumns` และฟิลด์ `template*`
4. `executeReportRequest` (`:401`) เรียก `runBackendReport` (`query-client.ts:1020` -> `apiPost("/api/process/report/run")`) แล้วเอาผลใส่ state: `columns`, `rows`, `totals`, `summaryCards`, `orderByOptions`, `conditions`, `hierarchyLevels/groupNodes`, `defaultSql/executedSql/executionMs`, `templates`
5. เบราว์เซอร์แสดงแถวทีละ 80 แถว (`INITIAL_VISIBLE_ROWS`, `:200`) แล้วเลื่อนใกล้ท้ายตาราง (เหลือ <= 320px) จึงเพิ่มทีละ 150 แถว (`handleTableScroll` `:1067-1079`); โหมดจัดกลุ่มหลายระดับเริ่ม 40 กลุ่ม เพิ่มทีละ 60

### เงื่อนไขรายงาน

- เงื่อนไขหลักบนหน้าจอ: ช่วงวันที่, จากรหัส-ถึงรหัส (ป้ายชื่อ `codeRangeLabel` มาจาก backend), เรียงตาม (`orderByOptions`), คำค้น, สลับสรุป/รายละเอียด (ปุ่มแสดงเมื่อ `supportsDetail`)
- เงื่อนไขเพิ่มเติม backend เป็นคนประกาศมาใน `conditions` (`ReportCondition`, `query-client.ts:922-930`) ชนิด `checkbox | number | text | date | select | ranges | multi`; `ReportConditionFields.tsx` เรนเดอร์แต่ละชนิด (`:121-196`) และส่งค่ากลับใน `options` (map key -> string)
- ชนิด `ranges` เก็บเป็นสตริง `"A..B,C"` (หลายแถวจากรหัส-ถึงรหัส) แปลงด้วย `parseRanges/joinRanges` และ `cleanCode` ตัด `..`, `,`, `:` ออกจากรหัสเพราะเป็นตัวคั่น (`ReportConditionFields.tsx:20-30`)
- กด Enter ในช่องเงื่อนไขใดก็รันรายงานใหม่ (`onKeyDown ... runReport()`, `:1242`, `:1259`)

### รูปแบบรายงาน (template) และแผงออกแบบ

- เปิดจาก toolbar: คอลัมน์, SQL, รูปแบบรายงาน (`handleOpenStudioTab`, `:589`) ผ่าน `GlobalReportStudioPanel` (`:1389`) ซึ่งเป็น component ใน `GlobalReportPrintModal.tsx` (ดู [[fe-report-print-designer]])
- แก้ความกว้าง/ซ่อนคอลัมน์ได้ (`columnOverrides`) แล้ว "ใช้" ด้วยการรันรายงานใหม่พร้อม `customColumns`
- Template เก็บใน DB ผ่านการรัน `report/run` อีกรอบพร้อม `templateAction: "save" | "delete" | "set_default"` (`:779`, `:796`, `:805`) ไม่มี endpoint แยก; backend ส่งรายการ template กลับมาใน `data.templates` และ `savedTemplateId`
- ถ้าเลือก "รูปแบบมาตรฐานระบบ" (template = null) จะส่ง `customSql: ""` และ `customColumns: []` (`:748-757`)
- ชุดคอลัมน์ "สรุป" กับ "รายละเอียด" แยกกัน เก็บใน `colsBySetRef` (`:196`, `:551-557`) สลับโหมดแล้วการปรับของแต่ละชุดไม่ปนกัน
- โหมด `sql_utility`: เปิดแผงออกแบบ tab `sql` ทันที (ยกเว้น menuKey ที่มี `database_struct`) (`:186-193`) ผู้ใช้แก้ SQL แล้วกด "ทดสอบ" -> `handleTestQueryOnTheFly` (`:598`) ส่ง SQL เป็น `customSql` ไปให้ backend รัน

### ส่งออก / พิมพ์ / วิเคราะห์

| ปุ่ม | ทำอะไร | ที่มา |
|---|---|---|
| ส่งออก CSV | สร้างไฟล์ในเบราว์เซอร์จาก `rows` ของคอลัมน์ที่เห็น ใส่ BOM `﻿` ชื่อไฟล์ `<menuKey>_<วันนี้>.csv` | `UniversalReportScreen.tsx:1042-1060` |
| พิมพ์ / PDF | เปิด `GlobalReportPrintModal` พร้อม `basePayload` ที่รวมคอลัมน์ล่าสุด; PDF เรียก `fetchBackendReportPdf` -> `POST /api/process/report/pdf` | `:812-815`, `:2355`, `query-client.ts:1029` |
| วิเคราะห์รายงานด้วย AI | `POST /api/process/workflow/ai-report-analyze` ส่ง `menuKey, title, rows, totals, summaryCards` ได้ `headline, highlights, anomalies, metrics` มาแสดงเป็นแผง `ai-report-insight-panel` | `:229-250`, `:1158`, `:1482` |

## ฝั่ง proxy (Next.js)

- `src/app/api/process/report/run/route.ts` มีทั้ง `POST` (ใช้จากหน้าจอ) และ `GET` (รับ query string หลายชื่อ เช่น `menuKey/menu_key/reportKey/report_code`, `dateFrom/date_from/doc_date_from` แล้วที่เหลือยัดใส่ `options`)
- `REPORT_KEY_ALIASES` (`route.ts:12-30`) แปลงชื่อ key เก่า/ชื่อสำรองเป็น key จริงของ backend ก่อนส่ง เช่น `rp_so_quotation` -> `menu_so_report_quotation`, `menu_ap_detail` -> `menu_ap_report_detail_ap`, `menu_ic_report_stock_balance` -> `menu_ic_info_stk_balance`
- หลังได้ผล ถ้า `data.total_vat_amount` / `total_base_amount` ไม่มี จะเติมจาก `totals` ตามชื่อคอลัมน์ไทย (`จำนวนเงินภาษี`, `ยอดภาษี`, `ภาษีมูลค่าเพิ่ม` / `มูลค่าสินค้า/บริการ`, `ฐานภาษี`) หรือ `"0.00"` (`route.ts:60-76`)
- `report/pdf/route.ts` ส่งต่อ `POST /api/v1/process/report/pdf` และคืน `Content-Disposition` ของ backend (ค่าสำรอง `inline; filename="bc_report.pdf"`, `:77`)
- ภาพรวม proxy ทั้งหมดดู [[fe-api-proxy-routes]]

## ตารางโหมด: เมนูไหนไปจอไหน

กฎคัดแยกอยู่ใน `buildDynamicScreen` (`screenRegistry.tsx:1262-1380`):

| เงื่อนไข (เรียงตามลำดับ) | จอ/โหมด | ที่มา |
|---|---|---|
| ชื่อเมนูมี `query`, `qeury`, `database_struct`, `verify_database` | `UniversalReportScreen` mode `sql_utility` | `screenRegistry.tsx:1265-1280` |
| `client_design`, `menu_pos_design_screen` | `PosSetupAndControlScreen` tab `machines` (ดู [[fe-process-pos-screens]]) | `:1285-1292` |
| ไม่มี `report` แต่มี `check_price`, `price_formula`, `price_list`, `saleprice`, `purchase_price`, `all_price` | mode `check_price` | `:1297-1314` |
| มี `barcode` และ `print` | mode `barcode_print` | `:1318-1328` |
| `topBranchName = menu_po` | `report_po` | `:1334` |
| `menu_so`, `menu_so_pos` | `report_so` | `:1335-1336` |
| `menu_ap` / `menu_ar` | `report_ap` / `report_ar` | `:1337-1338` |
| `menu_cash_and_bank` (ชื่อมี `chq`, `cheque`, `credit_card` -> `report_chq` ที่เหลือ `report_cb`) | `report_chq` / `report_cb` | `:1339-1345` |
| `menu_asset` | `report_fa` | `:1346` |
| `menu_general_ledger_main` | `report_gl` | `:1347` |
| `menu_wh`, `menu_singha_warehouse` | `report_wh_pp` | `:1348-1352` |
| `menu_singha_report` (เดาจากชื่อ: `_gl_`/`tax` -> gl, `_cb_`/`bank` -> cb, `_ar_`/`debt` -> ar, `_so_`/`sale` -> so, อื่น ๆ -> ic) | `report_gl/cb/ar/so/ic` | `:1353-1358` |
| `menu_setup` | `SystemProcessWorkbenchScreen` mode `system_tool` | `:1359-1365` |
| อื่น ๆ (ค่าเริ่มต้น) | `report_ic` | `:1333, :1371-1379` |

หมายเหตุ: `mode` ใช้เป็นแค่ตัวส่งให้ backend (`payload.mode`) กับตัดสินใจ tab เริ่มต้นของแผงออกแบบ; ฝั่งหน้าจอไม่มีโค้ดแยกพฤติกรรมของ `check_price` / `barcode_print` (ค้นแล้วพบ `config.mode` ใช้แค่ `:188`, `:192`, `:283`, `:337`, `:585`) ดังนั้นผลลัพธ์ของสองโหมดนี้ขึ้นกับ backend ทั้งหมด

## จอที่ลงทะเบียนมือ (ไม่ใช่ mode ข้างบน)

| ชื่อจอ (ไทย) | ไฟล์/component | endpoint ที่เรียก |
|---|---|---|
| รายงานพนักงานเรียงตามกลุ่ม (`menu_report_employee_group`, 1.1.8) | `UniversalReportScreen` mode `report_ic` ผ่าน `createReportScreen` | `POST /api/process/report/run` (`screenRegistry.tsx:415-424`) |
| รายละเอียดการซื้อ (`menu_po_buy_information`, 3.8.7) | `account/report/BuySaleInformationScreen.tsx` `mode="buy"` | `/api/query/list` (`queryList`) (`screenRegistry.tsx:741-752`) |
| รายละเอียดการขาย (`menu_so_sale_information`, 4.10.22) | `BuySaleInformationScreen` `mode="sale"` | `/api/query/list` (`screenRegistry.tsx:754-765`) |
| ตรวจสอบราคาสินค้า (`check_price`, 2.1.21) | `CheckPriceScreen` ใน `account/master/IcExtraScreens.tsx:573` | (ยังไม่ได้อ่านข้างใน) (`screenRegistry.tsx:767-778`) |

### BuySaleInformationScreen (ข้อมูลซื้อ/ขายรายคู่ค้า)

- จอเดียวสองโหมด: `isSale` ใช้ตาราง `ar_customer` และ `trans_flag` 44, 46, 36; โหมดซื้อใช้ `ap_supplier` และ 12, 14, 310 (`BuySaleInformationScreen.tsx:38-40`)
- คิวรีผ่าน `queryList` จาก `ic_trans`, `ic_trans_detail` (JOIN `ic_trans` ด้วย `doc_no`+`trans_flag`, LEFT JOIN `ic_inventory`), `cb_chq_list` และสรุปรายเดือนด้วย `SUM(CASE WHEN EXTRACT(MONTH FROM doc_date)=n ...)` ต่อปี (`:71-150`, `:189-190`)
- โครงจอ: ตารางคู่ค้าซ้าย (กรอง "เฉพาะที่มีหนี้" + คำค้น), ตารางสินค้า/เอกสารขวา, สรุปหนี้, ตารางรายเดือน (`:42-61`, `:264-349`)
- เป็นข้อยกเว้นของกฎ "รายงานต้องผ่าน backend" เพราะเขียน SQL ในหน้าจอเอง ถ้าแก้สูตรต้องแก้ที่ไฟล์นี้ ไม่ใช่ backend

## ข้อควรระวัง

- รายงานใหม่ไม่ต้องเขียนหน้าจอ: เมนูที่ชื่ออยู่ใน `bcMenu` จะถูกลงทะเบียนเองโดย `registerAllMenus`/`buildDynamicScreen`; ที่ต้องทำคือให้ backend รู้จัก `menuKey` (และเพิ่ม alias ใน `REPORT_KEY_ALIASES` ถ้าชื่อใน menu ต่างจากฝั่ง backend)
- ลำดับกฎใน `buildDynamicScreen` สำคัญ: เมนู `check_price` ที่มีคำว่า `report` ในชื่อจะไม่เข้าโหมด `check_price` (`:1297-1306`) และไปตกกฎ `topBranchName`
- `report_chq` ตัดสินจาก substring ของชื่อเมนูเท่านั้น (`chq`, `cheque`, `credit_card`) เมนูใหม่ที่ตั้งชื่อต่างไปจะไปเป็น `report_cb`
- ตัวเลขจำนวนเงินในผลรายงานเป็น string จาก backend (`totals: Record<string,string>`) จึงจัดรูปแบบผ่าน `formatMoneyDisplay` ไม่แปลงเป็น number ดู [[fe-numeric-money]]

## ที่มาในโค้ด

- `frontend/account/report/UniversalReportScreen.tsx:79-107` type `WorkbenchMode`, `UniversalWorkbenchConfig`, ชื่อคอมโพเนนต์
- `frontend/account/report/UniversalReportScreen.tsx:268-340` `buildCurrentPayload`; `:401-545` `executeReportRequest`; `:548-565` `runReport`
- `frontend/account/report/UniversalReportScreen.tsx:568-585` รันอัตโนมัติตอนเปิดจอ; `:1042-1060` ส่งออก CSV; `:229-262` AI วิเคราะห์
- `frontend/account/report/ReportConditionFields.tsx:20-30, 121-196` ชนิดเงื่อนไข `ranges`/`multi`/`select`/`date`/`number`/`text`/`checkbox`
- `frontend/src/lib/query-client.ts:922-1050` type `ReportCondition`, `ReportRunPayload`, `ReportRunResult`, `runBackendReport`, `fetchBackendReportPdf`
- `frontend/src/app/api/process/report/run/route.ts:12-148` alias และ proxy; `report/pdf/route.ts:28-87`
- `frontend/account/tabs/screenRegistry.tsx:173-181` `createReportScreen`; `:1262-1380` คัดแยก mode
- `frontend/account/report/BuySaleInformationScreen.tsx:27-150` จอรายละเอียดซื้อ/ขาย

## ดูเพิ่ม

[[fe-report-print-designer]] | [[fe-screen-registry-menu]] | [[fe-api-proxy-routes]] | [[fe-query-client-sql-builder]] | [[fe-numeric-money]] | [[fe-process-pos-screens]] | [[frontend-overview]] | [[process-overview]] | [[accounting-overview]]
