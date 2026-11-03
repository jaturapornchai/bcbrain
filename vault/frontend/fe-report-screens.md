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

1. `screenRegistry.tsx` แยกเมนูรายงานเป็น `mode` (10 โหมดรายงาน `report_ic/po/so/ap/ar/cb/chq/fa/gl/wh_pp` + `check_price` + `barcode_print` + `sql_utility`) ตามกลุ่มเมนูบนสุด (`topBranchName`) แล้วห่อด้วย `createReportScreen` (`screenRegistry.tsx:173`) -> `UniversalReportScreen config={menuKey,menuCode,title,mode}` (type `WorkbenchMode` ที่ `UniversalReportScreen.tsx:79-92`)
2. ตอนเปิดจอ (หรือ `menuKey`/`mode` เปลี่ยน) `useEffect` ที่ `UniversalReportScreen.tsx:568-585` ล้างเงื่อนไขเดิมแล้วเรียก `runReport` ทันทีรอบแรก ไม่ต้องกดปุ่ม ถ้า backend ตอบ `detailDefault` (เมนูที่ตั้งให้แสดงรายละเอียดตั้งแต่เปิดจอ) จะรันซ้ำแบบ `viewDetail: true` อัตโนมัติ
3. `buildCurrentPayload` (`:268`) ประกอบ `ReportRunPayload` (`query-client.ts:940`) จากค่าบนหน้าจอทั้งหมด: `menuKey`, `mode`, `dateFrom/dateTo`, `fromCode/toCode`, `orderBy`, `keyword`, `viewDetail`, `options` (ค่าเงื่อนไขเพิ่มเติม), ค่าตั้งหน้ากระดาษ (`paperSize`, `orientation`, `printTheme`, `reportLang` ฯลฯ), `groupByColumn/subGroupByColumn`, `customSql`, `customColumns` และฟิลด์ `template*`
4. `executeReportRequest` (`:401`) เรียก `runBackendReport` (`query-client.ts:1020` -> `apiPost("/api/process/report/run")`) แล้วเอาผลใส่ state: `columns`, `rows`, `totals`, `summaryCards`, `orderByOptions`, `conditions`, `hierarchyLevels/groupNodes`, `defaultSql/executedSql/executionMs`, `templates`
5. เบราว์เซอร์แสดงแถวทีละ 80 แถว (`INITIAL_VISIBLE_ROWS`, `:200`) แล้วเลื่อนใกล้ท้ายตาราง (เหลือ <= 320px) จึงเพิ่มทีละ 150 แถว (`handleTableScroll` `:1077-1092`); โหมดจัดกลุ่มหลายระดับเริ่ม 40 กลุ่ม เพิ่มทีละ 60

### เงื่อนไขรายงาน

- เงื่อนไขหลักบนหน้าจอ: ช่วงวันที่, จากรหัส-ถึงรหัส (ป้ายชื่อ `codeRangeLabel` มาจาก backend), เรียงตาม (`orderByOptions`), คำค้น, สลับสรุป/รายละเอียด (ปุ่มแสดงเมื่อ `supportsDetail`)
- เงื่อนไขเพิ่มเติม backend เป็นคนประกาศมาใน `conditions` (`ReportCondition`, `query-client.ts:923-931`) ชนิด `checkbox | number | text | date | select | ranges | multi`; `ReportConditionFields.tsx` เรนเดอร์แต่ละชนิด (`:121-207`) และส่งค่ากลับใน `options` (map key -> string)
- ชนิด `ranges` เก็บเป็นสตริง `"A..B,C"` (หลายแถวจากรหัส-ถึงรหัส) แปลงด้วย `parseRanges/joinRanges` และ `cleanCode` ตัด `..`, `,`, `:` ออกจากรหัสเพราะเป็นตัวคั่น (`ReportConditionFields.tsx:21-29`)
- กด Enter ในช่องจากรหัส/ถึงรหัส/คำค้น (`UniversalReportScreen.tsx:1252`, `:1269`, `:1314`) หรือในช่องเงื่อนไขเพิ่มเติม (`ReportConditionFields.tsx:55`, `:63`, `:181`, `:203` เรียก `onSubmit` ซึ่งต่อกับ `runReport` ที่ `UniversalReportScreen.tsx:1376`) จะรันรายงานใหม่

### รูปแบบรายงาน (template) และแผงออกแบบ

- เปิดจาก toolbar: คอลัมน์, SQL, รูปแบบรายงาน (`handleOpenStudioTab`, `:589`) ผ่าน `GlobalReportStudioPanel` (`:1399`) ซึ่งเป็น component ใน `GlobalReportPrintModal.tsx` (ดู [[fe-report-print-designer]])
- แก้ความกว้าง/ซ่อนคอลัมน์ได้ (`columnOverrides`) แล้ว "ใช้" ด้วยการรันรายงานใหม่พร้อม `customColumns`
- Template เก็บใน DB ผ่านการรัน `report/run` อีกรอบพร้อม `templateAction: "save" | "delete" | "set_default"` (`:779`, `:796`, `:805`) ไม่มี endpoint แยก; backend ส่งรายการ template กลับมาใน `data.templates` และ `savedTemplateId`
- ถ้าเลือก "★ มาตรฐานระบบ (System Default)" (`GlobalReportPrintModal.tsx:770`, template = null) จะส่ง `customSql: ""` และ `customColumns: []` (`:748-757`)
- ชุดคอลัมน์ "สรุป" กับ "รายละเอียด" แยกกัน เก็บใน `colsBySetRef` (`:196`, `:551-557`) สลับโหมดแล้วการปรับของแต่ละชุดไม่ปนกัน
- โหมด `sql_utility`: เปิดแผงออกแบบ tab `sql` ทันที (ยกเว้น menuKey ที่มี `database_struct`) (`:186-193`) ผู้ใช้แก้ SQL แล้วกด "ทดสอบ" -> `handleTestQueryOnTheFly` (`:598`) ส่ง SQL เป็น `customSql` ไปให้ backend รัน

### ส่งออก / พิมพ์ / วิเคราะห์

| ปุ่ม | ทำอะไร | ที่มา |
|---|---|---|
| ส่งออก CSV | สร้างไฟล์ในเบราว์เซอร์จาก `rows` ของคอลัมน์ที่เห็น ใส่ BOM `﻿` ชื่อไฟล์ `<menuKey>_<วันนี้>.csv` | `UniversalReportScreen.tsx:1052-1071` |
| พิมพ์ / PDF | เปิด `GlobalReportPrintModal` พร้อม `basePayload` ที่รวมคอลัมน์ล่าสุด; PDF เรียก `fetchBackendReportPdf` -> `POST /api/process/report/pdf` | `:812-814`, `:2422`, `query-client.ts:1029` |
| วิเคราะห์รายงานด้วย AI | `POST /api/process/workflow/ai-report-analyze` ส่ง `menuKey, title, rows, totals, summaryCards` ได้ `headline, highlights, anomalies, metrics` มาแสดงเป็นแผง `ai-report-insight-panel` | `:229-256`, `:1168`, `:1492` |

## ฝั่ง proxy (Next.js)

- `src/app/api/process/report/run/route.ts` มีทั้ง `POST` (ใช้จากหน้าจอ) และ `GET` (รับ query string หลายชื่อ เช่น `menuKey/menu_key/reportKey/report_code`, `dateFrom/date_from/doc_date_from` แล้วที่เหลือยัดใส่ `options`)
- `REPORT_KEY_ALIASES` (`route.ts:12-30`) แปลงชื่อ key เก่า/ชื่อสำรองเป็น key จริงของ backend ก่อนส่ง เช่น `rp_so_quotation` -> `menu_so_report_quotation`, `menu_ap_detail` -> `menu_ap_report_detail_ap`, `menu_ic_report_stock_balance` -> `menu_ic_info_stk_balance`
- หลังได้ผล ถ้า `data.total_vat_amount` / `total_base_amount` ไม่มี จะเติมจาก `totals` ตามชื่อคอลัมน์ไทย (`จำนวนเงินภาษี`, `ยอดภาษี`, `ภาษีมูลค่าเพิ่ม` / `มูลค่าสินค้า/บริการ`, `ฐานภาษี`) หรือ `"0.00"` (`route.ts:60-76`)
- `report/pdf/route.ts` ส่งต่อ `POST /api/v1/process/report/pdf` และคืน `Content-Disposition` ของ backend (ค่าสำรอง `inline; filename="bc_report.pdf"`, `pdf/route.ts:85`)
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
| รายงานพนักงานเรียงตามกลุ่ม (`menu_report_employee_group`, รหัสเมนู 1126) | `UniversalReportScreen` mode `report_ic` ผ่าน `createReportScreen` | `POST /api/process/report/run` (`screenRegistry.tsx:415-425`) |
| รายละเอียดการซื้อ (`menu_po_buy_information`; ไม่มีใบเมนูชี้มา เปิดได้ทาง `/home?open=` เท่านั้น ดู [[scr-buy-sale-information]]) | `account/report/BuySaleInformationScreen.tsx` `mode="buy"` | `/api/query/list` (`queryList`) (`screenRegistry.tsx:741-753`) |
| รายละเอียดการขาย (`menu_so_sale_information`; เช่นเดียวกัน) | `BuySaleInformationScreen` `mode="sale"` | `/api/query/list` (`screenRegistry.tsx:754-766`) |
| ตรวจสอบราคาสินค้า (`check_price`, รหัสเมนู 2017) | `CheckPriceScreen` ใน `account/master/IcExtraScreens.tsx:573` | ค้นบาร์โค้ด/รหัส/ชื่อสินค้าจากตาราง `ic_inventory_barcode` ด้วย `queryList` (`IcExtraScreens.tsx:598-611`) และบันทึกราคาใหม่ด้วย `POST /api/process/stocktools/checkpricesave` (`:647`) (`screenRegistry.tsx:767-778`) |

### BuySaleInformationScreen (ข้อมูลซื้อ/ขายรายคู่ค้า)

- เมนู 3049 "รายงานการซื้อสินค้า/ตั้งหนี้" และ 4045 "รายงานการขายสินค้าและบริการ" เปิด `UniversalReportScreen` ตามปกติ (`screenRegistry.tsx:1382-1395`) ชื่อ `menu_po_buy_information` / `menu_so_sale_information` เป็น alias ของสองเมนูนี้ในตารางค้นชื่อเท่านั้น (`bcMenu.ts:250-251`) ไม่ได้ทำให้คลิกเมนูแล้วมาเปิดจอนี้
- จอเดียวสองโหมด: `isSale` ใช้ตาราง `ar_customer` และ `trans_flag` 44, 46, 36; โหมดซื้อใช้ `ap_supplier` และ 12, 14, 310 (`BuySaleInformationScreen.tsx:38-40`)
- คิวรีผ่าน `queryList` จาก `ic_trans`, `ic_trans_detail` (JOIN `ic_trans` ด้วย `doc_no`+`trans_flag`, LEFT JOIN `ic_inventory`), `cb_chq_list` และสรุปรายเดือนด้วย `SUM(CASE WHEN EXTRACT(MONTH FROM doc_date)=n ...)` ต่อปี (รายชื่อคู่ค้าพร้อมยอดรวมจาก `ic_trans` `:63-99`; รายละเอียดรายคู่ค้า `:105-171`; ประวัติบิลรายสินค้า `:182-199`)
- โครงจอ: ตารางคู่ค้าซ้าย (ติ๊ก "เฉพาะมียอดซื้อ/ขาย" `:259` กรองรายที่ยอดรวมจาก `ic_trans` > 0 ใน SQL ก่อน `LIMIT 100` `:74-82` + คำค้น), สรุปสถานะวงเงินและเอกสาร, ตารางรายการสินค้า, ตารางประวัติบิลของสินค้า, ตารางสรุปยอดรายเดือน (state `:42-61`; ตารางคู่ค้า `:263`, สรุป `:301`, สินค้า `:343`, ประวัติบิล `:384`, รายเดือน `:423-426`)
- ต่างจากรายงานอื่นที่ให้ backend ประกอบ SQL เพราะจอนี้เขียน SQL ในหน้าจอเอง ถ้าแก้สูตรต้องแก้ที่ไฟล์นี้ ไม่ใช่ backend

## ข้อควรระวัง

- รายงานใหม่ไม่ต้องเขียนหน้าจอ: เมนูที่ชื่ออยู่ใน `bcMenu` จะถูกลงทะเบียนเองโดย `registerAllMenus`/`buildDynamicScreen`; ที่ต้องทำคือให้ backend รู้จัก `menuKey` (และเพิ่ม alias ใน `REPORT_KEY_ALIASES` ถ้าชื่อใน menu ต่างจากฝั่ง backend)
- ลำดับกฎใน `buildDynamicScreen` สำคัญ: เมนู `check_price` ที่มีคำว่า `report` ในชื่อจะไม่เข้าโหมด `check_price` (`:1297-1306`) และไปตกกฎ `topBranchName`
- `report_chq` ตัดสินจาก substring ของชื่อเมนูเท่านั้น (`chq`, `cheque`, `credit_card`) เมนูใหม่ที่ตั้งชื่อต่างไปจะไปเป็น `report_cb`
- ตัวเลขจำนวนเงินในผลรายงานเป็น string จาก backend (`totals: Record<string,string>`) จึงจัดรูปแบบผ่าน `formatMoneyDisplay` ไม่แปลงเป็น number ดู [[fe-numeric-money]]

## ที่มาในโค้ด

- `frontend/account/report/UniversalReportScreen.tsx:79-99` type `WorkbenchMode` และ `UniversalWorkbenchConfig`
- `frontend/account/report/UniversalReportScreen.tsx:268-340` `buildCurrentPayload`; `:401-545` `executeReportRequest`; `:548-565` `runReport`
- `frontend/account/report/UniversalReportScreen.tsx:568-585` รันอัตโนมัติตอนเปิดจอ; `:1052-1071` ส่งออก CSV; `:229-256` AI วิเคราะห์
- `frontend/account/report/ReportConditionFields.tsx:21-29, 121-207` ชนิดเงื่อนไข `ranges`/`multi`/`select`/`date`/`number`/`text`/`checkbox`
- `frontend/src/lib/query-client.ts:923-1056` type `ReportCondition`, `ReportRunPayload`, `ReportRunResult`, `runBackendReport`, `fetchBackendReportPdf`
- `frontend/src/app/api/process/report/run/route.ts:12-162` alias และ proxy; `report/pdf/route.ts:28-95`
- `frontend/account/tabs/screenRegistry.tsx:173-181` `createReportScreen`; `:1262-1380` คัดแยก mode
- `frontend/account/report/BuySaleInformationScreen.tsx:27-199` จอรายละเอียดซื้อ/ขาย; `frontend/account/master/IcExtraScreens.tsx:573` `CheckPriceScreen`

## ดูเพิ่ม

[[fe-report-print-designer]] | [[fe-screen-registry-menu]] | [[fe-api-proxy-routes]] | [[fe-query-client-sql-builder]] | [[fe-numeric-money]] | [[fe-process-pos-screens]] | [[frontend-overview]] | [[process-overview]] | [[accounting-overview]]
