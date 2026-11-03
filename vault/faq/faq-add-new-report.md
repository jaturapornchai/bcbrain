---
title: "เพิ่มรายงานใหม่ (เมนูรายงาน) ต้องแก้ที่ไหนบ้าง และทำไมขึ้น \"ไม่พบรายงาน\""
tags: [faq, report, dev, backend, frontend, troubleshooting]
aliases: ["เพิ่มรายงานใหม่", "ไม่พบรายงาน", "registerMenuReport", "menuReports", "icSpec", "report menu registered twice", "ReportCondition", "UniversalReportScreen เมนูใหม่", "report/run menuKey", "เพิ่มเงื่อนไขรายงาน"]
sources: ["backend/internal/application/process/report_menu.go:32", "backend/internal/application/process/report_menu_ic.go:20", "backend/internal/application/process/report_conditions.go:10", "backend/internal/application/process/report.go:289", "backend/internal/application/process/report_menu_ic_test.go:103", "frontend/account/tabs/screenRegistry.tsx:1067", "frontend/src/app/api/process/report/run/route.ts:12"]
---
# เพิ่มรายงานใหม่ (เมนูรายงาน) ต้องแก้ที่ไหนบ้าง และทำไมขึ้น "ไม่พบรายงาน"

**ตอบสั้น:** 1 เมนู = 1 ตัวสร้างรายงานฝั่ง Go ที่ลงทะเบียนด้วย `registerMenuReport(fn, "menu_key")` ใน `init()` ของไฟล์ `report_menu_*.go` ส่วนหน้าจอไม่ต้องเขียนใหม่ เพราะเมนูใบทุกใบใน `bcMenu.json` ที่ยังไม่มีจอเฉพาะจะได้ `UniversalReportScreen` อัตโนมัติ (เลือกโหมดตามชื่อหมวดบนสุด) ถ้าเมนูมีในแผนผังแต่ฝั่ง Go ไม่ได้ลงทะเบียน `menuKey` จะได้ข้อความ "ไม่พบรายงาน <menuKey>"

## รายละเอียด
**ขั้นตอนเพิ่มรายงาน:**
1. **เมนู** — เพิ่มใบเมนู (`name`, `text`, `tag`) ใน `frontend/src/config/bcMenu.json`; `registerAllMenus` (`screenRegistry.tsx:1382`) เดินทุกใบแล้วเรียก `buildDynamicScreen` (`:1067`) ซึ่งเลือก `mode` ตามหมวดบนสุด (`menu_po`→`report_po`, `menu_ap`→`report_ap`, `menu_ar`→`report_ar`, `menu_wh`→`report_wh_pp` ฯลฯ ที่ `:1333-1358`) ถ้าไม่ตรงหมวดใดจะเป็น `report_ic` (ค่าเริ่มต้น `:1333`)
2. **ตัวสร้างรายงาน (Go)** — เขียนฟังก์ชัน `menuReportFunc` (`func(ctx, pool, reportParams) (RunReportResult, error)`, `report_menu.go:26`) แล้วลงทะเบียน key ตัวพิมพ์เล็กใน `init()` ของไฟล์หมวดนั้น (ตัวอย่าง `registerMenuReport(icRun(sum, det), m.key)` ใน `report_menu_ic.go:199`; หมวดบัญชี/สินทรัพย์ห่อด้วย `glfaReg` ที่ `report_menu_gl_fa.go:1594`) ลงทะเบียน key ซ้ำ = `panic("report menu registered twice")` ตอนโปรแกรมเริ่ม
3. **รายงานสินค้า/คลัง** ใช้แบบ `icSpec` (`report_menu_ic.go:23`) ผ่าน `icRun(summary, detail)` — กำหนด `code` (ต้องไม่ซ้ำ), `cols` (Key = alias ใน SQL), `sql` ที่ต่อท้าย CTE `prm` (`icPrm` `:20`) อ่านค่าเป็น `prm.d1/d2` (วันที่), `prm.fc/tc` (ช่วงรหัส), `prm.kw/kl` (คำค้น), `prm.o` (JSON ของเงื่อนไขเพิ่ม) แต่ละ `$1..$7` ต้องอ้างครั้งเดียว มิฉะนั้น pgx ปฏิเสธพารามิเตอร์ที่ไม่ได้ใช้
4. **เงื่อนไขเพิ่มเติม** — ประกาศใน `opts []ReportCondition` ด้วย `condCheck/condNumber/condText/condDate/condSelect` (และชนิด `ranges`, `multi`) `report_conditions.go:10` หน้าจอวาดช่องให้เองจากค่าที่ backend ตอบใน `conditions`; ฝั่ง Go อ่านด้วย `p.optBool/optInt/optStr` และ SQL อ่านผ่าน `prm.o->>'key'` ค่าที่ไม่ได้ประกาศถูกทิ้งโดย `normalizeReportOptions` (`report_options.go:23`)
5. **ชื่อ key เก่า** — ถ้าต้องรองรับชื่อเดิม ใส่ใน `reportCodeAliases` (`report.go:209`) และ/หรือ `REPORT_KEY_ALIASES` ของ proxy (`frontend/src/app/api/process/report/run/route.ts:12`)
6. **สิทธิ์** — `report/run` และ `report/pdf` อยู่ใน `routeRights` เป็น read แล้ว (`process/permission.go:25`) ไม่ต้องเพิ่ม; ถ้า body มี `customSql` ต้อง Admin ([[faq-menu-permission-denied]])
7. **ทดสอบ** — เพิ่ม key ในรายการที่คาดหวังของเทสต์ `Test*MenusRegistered` ของหมวด และรัน `TestICSpecsWellFormed` / `TestSOPOSpecsWellFormed` (ตรวจ `$1..$7` ครั้งเดียว, ไม่มี `LIMIT 50000`, key ไม่เกิน 63 bytes, key = label, ทุกคอลัมน์มี `AS "..."` ตรงกัน — `report_menu_ic_test.go:103`)

**ลำดับที่ `RunReport` เลือกตัวสร้าง** (`report.go:289`): หา `menuReports[lowerKey]` ก่อน ถ้าไม่มีและไม่ใช่เมนูตัวออกแบบ ไป `runLegacyReport` ซึ่งรองรับเฉพาะ `mode == "sql_utility"` นอกนั้นตอบ "ไม่พบรายงาน" (ตรวจโดย `TestRunLegacyReportRefusesUnknownMode`)

## ข้อควรระวัง
- ยอดเงินในผลรายงานเป็นสตริงทศนิยม รวมด้วย `big.Rat` ใน engine (`computeExactColumnTotals`) อย่าคืน float จาก SQL เป็นตัวเลขเอง ([[faq-rounding-decimal]])
- ห้ามต่อ key ของ option จากข้อมูลผู้ใช้ลง SQL — ใช้ฟังก์ชัน `opt*` กับ key คงที่เท่านั้น
- รายงานที่แสดงต้นทุนต้องตั้ง `cost` ใน `icSpec` ให้ตัดคอลัมน์เมื่อผู้ใช้ถูกซ่อนต้นทุน (`itemCostHidden`) และรายงานที่กรองตามสิทธิ์คลังตั้ง `perm` ([[faq-wh-shelf-permission]])
- วันที่ในรายงานแปลงเป็น พ.ศ./ค.ศ. ตาม `erp_option.year_type` โดย engine ([[faq-buddhist-year-date]])
- ชื่อเมนูใหม่ที่อยู่หมวดนอกตาราง `mode` จะตกไปเป็น `report_ic` ซึ่งอาจเลือกชุดปุ่มไม่ตรง ให้ตรวจ `buildDynamicScreen` ก่อน

## ดูเพิ่ม
- [[proc-report-engine]]
- [[proc-report-registry-conditions]]
- [[std-report-engine-standard]]
- [[fe-report-screens]]
- [[faq-run-report-conditions]]
- [[faq-menu-code-to-screen]]

## ที่มาในโค้ด
- `backend/internal/application/process/report_menu.go:32` `menuReports`, `:34` `registerMenuReport` (panic เมื่อ key ซ้ำ บรรทัด 38), `:26` `menuReportFunc`
- `backend/internal/application/process/report_menu_ic.go:20` `icPrm` และ `icSpec` (บรรทัด 23) / `icRun` ที่ลงทะเบียนเข้า `icAllSpecs`
- `backend/internal/application/process/report_conditions.go:10` `ReportCondition` และตัวสร้าง `cond*`
- `backend/internal/application/process/report.go:289` เลือก `menuReports[lowerKey]` ไม่เจอ → `runLegacyReport` / "ไม่พบรายงาน"
- `backend/internal/application/process/report_menu_ic_test.go:103` `TestICSpecsWellFormed`
- `frontend/account/tabs/screenRegistry.tsx:1067` `buildDynamicScreen` และ `registerAllMenus` (บรรทัด 1382)
- `frontend/src/app/api/process/report/run/route.ts:12` `REPORT_KEY_ALIASES`
