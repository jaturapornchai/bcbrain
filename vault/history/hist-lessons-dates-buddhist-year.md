---
title: "บทเรียน ปี พ.ศ./ค.ศ. และวันที่ (Dates, Buddhist year and year_type)"
tags: [history, date, year-type, buddhist-era]
aliases: ["year_type lessons", "hardcoded +543", "todayLocal", "พ.ศ. ค.ศ. bug"]
sources: ["git:5fa7e098", "git:678fc5fc", "git:7dc1b3a6", "git:68f5a4d4", "git:ceda88d1", "git:1ea23586", "git:faa6e6d0", "AGENTS.md:41,57", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md (M8)"]
---

## ภาพรวม
มติเจ้าของ (24 ต.ค. 2026): DB เก็บปี ค.ศ. ทั้งหมด หน้าจอ/รายงาน/PDF แปลงตาม `erp_option.year_type` (`0`=ค.ศ., `1`=พ.ศ.) แต่โค้ดที่พอร์ตจาก C# ติด `+543` ตายตัวหลายจุด เลยเจอ 4 กลุ่ม: ปีที่ "เก็บ" ลง DB เป็น พ.ศ., รายงาน/ป้ายคอลัมน์ฝัง `+543`, หน้าจอที่ไม่ตาม year_type, และ "วันนี้" ที่ได้เมื่อวานเพราะ UTC

## อาการ
- A) `account_year` ของ stock_beginning และ `vat_effective_year` ของ journaltax เก็บ พ.ศ. ขณะที่ `erp_account_period.period_year` เป็น ค.ศ. (ตามข้อความ commit `68f5a4d4`)
- B) ตั้ง year_type=0 แล้วรายงานยังขึ้นปี พ.ศ. ในหัวเงื่อนไข ป้ายคอลัมน์ค่าเสื่อมรายปี/เดือน และเดือนภาษีใน VAT summary
- C) หน้าจอ GL/บิล/เช็ค/ประวัติ/ยกเลิก ใช้ `<input type="date">` หรือแสดงปีเอง ไม่ตาม year_type; FormDesigner แสดงวันที่เป็น ISO
- D) ค่าเริ่มต้น "วันนี้" ก่อน 07:00 ได้วันที่เมื่อวาน (M8) และ `formatThaiDate` ของ `YYYY-MM-DD` ถอยหนึ่งวันบนเครื่องที่ timezone ช้ากว่า UTC (N6)

## สาเหตุ (root cause)
- A) default `d.Year() + 543` ตามโค้ด C# `_year_add` (diff `68f5a4d4` ตรวจแล้ว)
- B) `formatThaiDateShort` ฝัง `+543`, `glfaBucketKey` ใช้ `t.Year()+543`, SQL VAT summary มี `/100+543` (diff `ceda88d1` ตรวจแล้ว)
- C) แต่ละหน้าจอแปลงปีเอง ไม่มี store กลาง (`5fa7e098` เพิ่ม `setBcYearType`/`getBcYearType` + `subscribeBcSettings`; `678fc5fc`/`7dc1b3a6` ตามไปแก้หน้าจอ ตามข้อความ commit ไม่ได้ตรวจ diff ทุกหน้า)
- D) `new Date().toISOString().slice(0,10)` คือ UTC; `new Date("YYYY-MM-DD")` คือเที่ยงคืน UTC (ตรวจแล้วจาก diff `7dc1b3a6` และคอมเมนต์ใน `utils.ts`)

## วิธีแก้
- A) `68f5a4d4`: default เป็น `d.Year()`/`t.Year()`; `JournalTaxTabs` แสดง/รับปีตาม year_type แต่เก็บ ค.ศ. และแปลงค่าเก่าที่ >2400 กลับตอนโหลด; แก้ Go test ให้คาดปี ค.ศ.
- B) `5fa7e098` เพิ่ม `readErpYearType`, ฟิลด์ `yearType` ในผลรายงาน และ `applyReportYearType` เป็นตาข่ายสุดท้ายที่แปลงวันที่ใน `ConditionText` และเซลล์สตริง; วันที่พิมพ์ใน PDF ตาม `res.YearType`. `ceda88d1` ส่ง `yearType` เข้า `glfaBucketKey`/`glfaBuckets`/`sopoMonthSpec`, ทำหัวเงื่อนไขเป็น "ปี ค.ศ./พ.ศ.", และให้ SQL VAT อ่าน `erp_option.year_type`
- C) `678fc5fc`/`7dc1b3a6`: แสดงด้วย `formatBcDate(.., yearType)` และเปลี่ยน input date ธรรมดาเป็น `DateBox`; `1ea23586` แปลง ISO เป็น DD/MM/YYYY ใน FormDesigner (diff แสดงเฉพาะสลับลำดับ ยังเป็นปี ค.ศ. ไม่ได้แปลงตาม year_type)
- D) `7dc1b3a6`: `todayLocal()` แทน `toISOString()` ทุกจอ; `faa6e6d0`: `formatThaiDate` แยก Y-M-D เอง

## commit ที่เกี่ยวข้อง
`5fa7e098` (23 ต.ค., year_type ไดนามิก), `678fc5fc` + `7dc1b3a6` (24 ต.ค., หน้าจอ + todayLocal), `68f5a4d4` (DB เก็บ ค.ศ.), `ceda88d1` (รายงานไม่ฝัง +543), `1ea23586` (FormDesigner), `faa6e6d0` (N6)

## โค้ดปัจจุบันที่ป้องกัน
- `backend/internal/application/process/report.go:185,559,574,650` (`readErpYearType`, `formatDateShortByYearType`, `formatDateByYearType`, `applyReportYearType`; เรียกที่ `:357` ทาง `RunReport` ครอบทุก menu report)
- `backend/internal/application/process/report_menu_gl_fa.go:1317` (`glfaBucketKey`), `:1720` (SQL VAT ตาม year_type); เทสต์ `report_menu_gl_fa_test.go:69`, `report_menu_so_po_test.go:282`
- `backend/internal/application/process/journaltax.go:208`, `stock_beginning.go:269` (เก็บ ค.ศ.); `frontend/account/transaction/JournalTaxTabs.tsx:124,527` (แปลงค่า >2400)
- `frontend/src/lib/numeric.ts:137,394,422` (`todayLocal`, `getBcYearType`, `formatBcDate`); `frontend/src/lib/utils.ts:20` (`formatThaiDate`); `AGENTS.md:41,57`

## บทเรียน / กฎที่ได้
1. DB เก็บ ค.ศ. เท่านั้น แปลงเฉพาะตอนแสดง/รับ input ผ่าน `year_type` ห้ามบวก/ลบ 543 ในโค้ดธุรกิจ
2. ฟังก์ชันจัดรูปวันที่ต้องรับ `yearType` เป็นพารามิเตอร์ ห้ามมี default ที่ฝัง พ.ศ. (ตอนนี้ `formatThaiDateShort` ยังเรียก `ByYearType(iso, 1)` และอาศัย `applyReportYearType` แก้ปลายทาง, จุดเรียก `report.go:499` `report_menu_gl_fa.go:156,866,927,1365,1371`)
3. ใช้ `todayLocal()` เสมอ ห้าม `toISOString().slice(0,10)` ที่ `GlobalDocFormPrintModal.tsx:1625-1626` ยังเหลือแบบ UTC (`frontend/shared/components`, ตรวจเจอตอนเขียนโน้ตนี้ ยังไม่ได้แก้)
4. heuristic `>2400 = พ.ศ.` (ใน `formatDateByYearType`, `formatBcDate`) ใช้รับค่าเก่าได้ แต่ไม่ใช่ที่เก็บ — ปี DB ที่เป็น 2400+ จริงจะถูกลบ 543
5. ตรวจสอบ 3 ชั้นพร้อมกัน: Go (default/รายงาน), SQL (`+543` ในสตริง SQL), หน้าจอ (grep `543`)

## ดูเพิ่ม
[[hist-lessons-numeric-input-blank-zero]] · [[hist-lessons-report-engine-parity]] · [[hist-lessons-thai-text-pdf]] · [[std-ux-buddhist-year-bilingual]] · [[std-input-controls-and-labels]] · [[history-overview]]

## ที่มาในโค้ด
repo `bcaiaccount` (อ่านอย่างเดียว): `backend/internal/application/process/{report.go,report_menu_gl_fa.go,journaltax.go,stock_beginning.go}`, `frontend/src/lib/{numeric.ts,utils.ts}`, `frontend/account/transaction/JournalTaxTabs.tsx`, `AGENTS.md:41,57`, `docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md` (M8, มติเจ้าของ), diff ของ `68f5a4d4`, `ceda88d1`, `1ea23586`, `5fa7e098`, `7dc1b3a6`
