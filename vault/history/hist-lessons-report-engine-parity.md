---
title: "บทเรียน เครื่องมือรายงานให้ตรง C# (Report engine parity)"
tags: [history, report, sql, parity]
aliases: ["report parity", "menuReports registry", "legacy report runners", "custom SQL column type", "report template scope"]
sources: ["git:c9fb6f51", "git:a0b12158", "git:d51fcdd4", "git:09bed48b", "git:20dd8f27", "git:5e33f5c2", "git:3ca3b07b", "git:7dc1b3a6", "docs/HANDOFF_CLAUDE_CODE_AUDIT.md §2 ข้อ 4", "docs/HANDOFF_BCCM_PARITY_2026-10-22.md R3g"]
---

## ภาพรวม
รายงานเริ่มจาก runner ทั่วไป (`runICReport`, `runGLReport` ฯลฯ) แล้วเปลี่ยนเป็น registry ต่อเมนู `menuReports` ที่พอร์ตเงื่อนไข+SQL ของ C# ทีละรายงาน (20-22 ต.ค. 2026) บั๊กชนิดเดียวกันคือรายงานตอบแบบ "ใกล้เคียง" ไม่ใช่ตามที่ C# ทำจริง (เงื่อนไขหาย, ด้านกำไรสลับ, ชนิดคอลัมน์เดา, template ข้ามรายงาน) แก้โดยพอร์ตตรงตัวพร้อมเทสต์

## อาการ
- A) เมนูที่ไม่มีรายงานเฉพาะได้รายงานสต็อกที่ไม่เกี่ยวกัน; `trans_flag` ใน runner หลายตัวไม่ตรง `_transFlagGlobal` ของ C# (ตาม handoff ข้อ 4)
- B) เลือกสมุดรายวันครบทุกเล่มแล้วผลหาย; งบทดลองแสดงกำไรผิดด้าน; เงื่อนไขช่วงรหัสหลายแถวของ C# ไม่มีบนเว็บ
- C) Custom SQL: คอลัมน์ `to_char()` ถูกรวมยอดเหมือนตัวเลข, ค่า `numeric`/`interval` โชว์เป็น struct, alias เกิน 63 ไบต์ทำ override จับคู่ไม่เจอ (OBS-REPORT-TEXT-YEAR)
- D) บันทึก/ลบ template ด้วย `template_id` ของรายงานอื่นได้; หน้า BuySaleInformation "เฉพาะมียอด" ไม่ครบเมื่อรายการเกิน 100 (M9)

## สาเหตุ (root cause)
- A) runner ทั่วไปเดาแทนการพอร์ตทีละเมนู: คอมเมนต์ `report.go:426` ห้ามตอบเมนูอื่นด้วย "unrelated stock report" บ่งว่าเดิมเป็นเช่นนั้น (อนุมานจากคอมเมนต์+diff `20dd8f27` -3548 บรรทัด; ไม่ได้รันโค้ดเก่า)
- B) ฟิลเตอร์สมุดไม่ตรงกติกา C# `__allBook`; profit ใช้ `glfaNeg(x)` ผิดด้านเทียบ C# `_glProcess.cs:918-950` (diff `d51fcdd4` ตรวจแล้ว)
- C) ชนิดคอลัมน์ถูก "โหวต" จากหน้าตาของค่า ไม่ใช่ชนิดจริง (diff `09bed48b` ตรวจแล้ว)
- D) SQL `WHERE`/`DELETE` ของ template ไม่ผูก `menu_key` (diff `5e33f5c2` ตรวจแล้ว); M9 กรองฝั่ง client หลัง `LIMIT 100` (ตามข้อความ `7dc1b3a6`)

## วิธีแก้
- A) `c9fb6f51` (IC/SO/PO) และ `a0b12158` (AP/AR/CB/GL/FA) พอร์ตเงื่อนไข+SQL ตามรหัสงาน REPORT-IC-xx / SOPO-xx / APAR-xxx / CB-GL-FA-xx (ตามข้อความ commit; ยังไม่ได้ตรวจ diff ละเอียด); `20dd8f27` ลบ runner เก่า เหลือ `runLegacyReport` ให้เฉพาะ `sql_utility`
- B) `d51fcdd4`: เงื่อนไขชนิด `ranges`/`multi`, `glfaProfitCells` ตาม C#; `20dd8f27`: `glfaBookCond` ผ่านเมื่อเลือกครบทุกเล่ม (ไม่กรอง)
- C) `09bed48b`: ชนิดมาจากคอลัมน์ของรายงานเดิมก่อน ไม่มีค่อยใช้ pg OID (`isPostgresNumericOID`), เซลล์ที่เป็น `driver.Valuer` ใช้ข้อความ PostgreSQL, ผูก alias 63 ไบต์กลับกับ key เต็ม, summary/detail เก็บ override แยก
- D) `5e33f5c2`: save/delete/set_default ผูก `menu_key`, 0 แถว = not found; `7dc1b3a6` ย้ายตัวกรองเข้า SQL; `3ca3b07b` เพิ่ม `reportCodeAliases` + `normalizeRunReportInput`

## commit ที่เกี่ยวข้อง
`c9fb6f51`, `a0b12158` (พอร์ต), `d51fcdd4` (หลายช่วงรหัส/เล่ม, ด้านกำไร), `09bed48b` (ชนิดคอลัมน์), `20dd8f27` (ลบ runner เก่า), `5e33f5c2` (template scope, `runSQLUtilityReport` ไม่ตัดแถวเงียบ), `3ca3b07b` (alias), `7dc1b3a6` (M9)

## โค้ดปัจจุบันที่ป้องกัน
- `backend/internal/application/process/report.go:289,427` (`menuReports`, `runLegacyReport`), `:209,225` (`reportCodeAliases`, `normalizeRunReportInput`), `:804-810` (`formatAnyValue`)
- `backend/internal/application/process/report_conditions.go:12`; `report_code_ranges.go:24,28,48,103` (`condRanges`, `condMulti`, `parseCodeRanges`, `glfaBookCond`)
- `backend/internal/application/process/report_menu_gl_fa.go:392` (`glfaProfitCells`)
- `backend/internal/application/process/report_template.go:334-335,438,708,766` (SQL ผูก `menu_key`, ชนิดจาก OID)
- เทสต์ `report_engine_test.go:188` (`TestRunCustomSQLReportColumnTypes`, ต้องมี `BC_TEST_PG_DSN`), `report_code_ranges_test.go`
- `frontend/account/report/BuySaleInformationScreen.tsx:80-82`, `ReportConditionFields.tsx`

## บทเรียน / กฎที่ได้
1. ห้ามให้ engine กลางเดาชนิด/ความหมาย: ชนิดมาจากนิยามรายงานหรือ OID ของฐานข้อมูล ไม่ใช่หน้าตาของค่า
2. พอร์ตรายงานทีละเมนูตามรหัสงาน C# และเขียนเทสต์ต่อกติกา (เช่น "เลือกครบ = ไม่กรอง")
3. ทุก SQL ที่รับ id จาก client ต้องผูกขอบเขตเจ้าของ (`menu_key`) และ 0 แถว = ไม่พบ
4. ตัวกรองต้องอยู่ใน SQL ก่อน `LIMIT` ไม่ใช่กรองหลังตัด
5. ไม่ตัดแถวเงียบ (`runSQLUtilityReport`, RD-2)
6. ยังไม่ได้ตรวจ diff `c9fb6f51` และ `a0b12158` ลงรายงานทีละตัว; แก้ `trans_flag` ใน runner เดิมอ้างตาม handoff ไม่ได้ตรวจเป็น commit เดียว (runner ถูกลบแล้ว)

## ดูเพิ่ม
[[hist-lessons-dates-buddhist-year]] · [[hist-lessons-thai-text-pdf]] · [[hist-lessons-performance-and-load]] · [[hist-lessons-query-gateway-write-lockdown]] · [[proc-report-engine]] · [[proc-report-registry-conditions]] · [[proc-report-custom-sql-template]] · [[std-report-engine-standard]] · [[history-overview]]

## ที่มาในโค้ด
repo `bcaiaccount` (อ่านอย่างเดียว): `backend/internal/application/process/report*.go`, `frontend/account/report/`, handoff audit §2 ข้อ 4, diff ของ `d51fcdd4`, `09bed48b`, `20dd8f27`, `5e33f5c2`, `3ca3b07b`
