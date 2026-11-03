---
title: "ทะเบียนรายงานรายเมนูและเงื่อนไขกรอง (Menu report registry & conditions)"
tags: [process, report, registry, conditions, sql-parameters]
aliases: ["menuReports", "registerMenuReport", "ReportCondition", "prm CTE", "icRun", "optBool", "code ranges", "ช่วงรหัส"]
sources: ["backend/internal/application/process/report_menu.go:28", "backend/internal/application/process/report_conditions.go:12", "backend/internal/application/process/report_options.go:23", "backend/internal/application/process/report_options.go:91", "backend/internal/application/process/report_code_ranges.go:22", "backend/internal/application/process/report_menu_ic.go:20", "backend/internal/application/process/report_menu_ic.go:41"]
---

# ทะเบียนรายงานรายเมนูและเงื่อนไขกรอง (Menu report registry & conditions)

รายงานแต่ละเมนูของ BC คือฟังก์ชัน `menuReportFunc` ที่ลงทะเบียนไว้ใน map `menuReports` ด้วย key เป็น `menuKey` ตัวพิมพ์เล็ก ให้ 1 เมนู = 1 รายงาน หน้าจอกรองเงื่อนไขไม่ได้ฮาร์ดโค้ด แต่ backend เป็นผู้ประกาศรายการ `ReportCondition` กลับไปให้ frontend วาด

## ทำงานอย่างไร

### การลงทะเบียน
- `registerMenuReport(fn, keys...)` ทำ `strings.ToLower(TrimSpace)` ที่ key แล้วใส่ map; **ถ้า key ซ้ำจะ `panic("report menu registered twice: ...")`** ตอนเริ่มโปรแกรม (ลงทะเบียนใน `init()` ของแต่ละไฟล์)
- ไฟล์ที่ลงทะเบียน (ดู `init()`): `report_menu_ic.go` (สินค้า/คลัง), `report_menu_ap_ar.go`, `report_menu_cb.go`, `report_menu_gl_fa.go`, `report_menu_employee.go`, `report_menu_autocare.go`, `report_menu_singha.go`, `report_menu_so_po.go`
- ผู้เรียก `RunReport` ตรวจ `menuReports[lowerKey]` ก่อนเสมอ ([[proc-report-engine]])
- `reportParams` ส่งให้ตัวสร้าง: `MenuKey`, `Title`, `DateFrom/DateTo` (YYYY-MM-DD), `FromCode/ToCode`, `OrderBy`, `Keyword`, `KwLike` (`%คำ%`), `ViewDetail`, `Username`, `Opt` (ค่า options ดิบ)

### รูปแบบของรายงานกลุ่มสินค้า (`icRun`)
- แต่ละรายงานเป็น `icSpec` (`code`, `category` (ส่งออกเป็น `ReportCategory` ของผลรายงาน, `report_menu_ic.go:71`), `subtitle`, `codeLabel`, `cols`, `sql`, `opts`, `cost`, `optCol`, `rangeInSQL`, `perm`)
- SQL ทุกตัวขึ้นต้นด้วย CTE `prm` (`icPrm`): `$1`=`d1` วันเริ่ม, `$2`=`d2` วันสิ้นสุด, `$3`=`fc` จากรหัส, `$4`=`tc` ถึงรหัส, `$5`=`kw`, `$6`=`kl`, `$7`=`o` (JSON ของ options) -- แต่ละ `$n` ต้องถูกอ้างครั้งเดียว (คอมเมนต์: pgx ปฏิเสธ param ที่ไม่ได้ใช้) ส่วน SQL ที่เหลืออ่านจาก `prm.d1`, `prm.fc` ฯลฯ
- `icRun` รองรับรายงานสรุป + รายงานรายละเอียด (`ViewDetail` สลับไป spec ที่ 2 ถ้ามี; ผลบอก `SupportsDetail`/`ViewDetailActive`)
- ฟังก์ชันช่วย SQL: `icCodeRange(col)` (ช่วงรหัสไม่สนตัวพิมพ์), `icKw(...)` (ILIKE `prm.kl`)
- ถ้า `cost != icCostNone` และ `itemCostHidden` เป็นจริง จะตัดคอลัมน์ต้นทุนผ่าน `icHideCosts`; ถ้า spec ใช้ `perm` ตั้ง `permGuarded` (ตัวรายงานกรองคลัง/ที่เก็บตามสิทธิ์ ดู [[proc-wh-shelf-permission]])
- `icAllSpecs` เก็บทุก spec ไว้ให้ unit test ตรวจ SQL/คอลัมน์โดยไม่ต้องใช้ DB

### ชนิดเงื่อนไข (`ReportCondition.Type`)
| Type | ความหมาย | ตัวสร้าง |
|---|---|---|
| `checkbox` | default "1"/"0" | `condCheck` |
| `number` | จำนวนเต็ม | `condNumber` |
| `text` | ข้อความ (มี `Hint`) | `condText` |
| `date` | YYYY-MM-DD | `condDate` |
| `select` | เลือกจาก `Options` | `condSelect` |
| `ranges` | แถว [จากรหัส][ถึงรหัส] รูป `"A..B,C"` | `condRanges` |
| `multi` | รายการรหัสที่ติ๊ก (ว่าง = ทั้งหมด) | `condMulti` |

- ฝั่ง Go อ่านค่าผ่าน `p.optStr/optList/optBool/optInt/optDate/optSelect` (ค่าผิดรูปแบบ = ค่า default; `optInt` ถูกหนีบด้วย lo..hi; `optStr` ตัดความยาว `optMaxLen=100`, รายการรหัสตัด `optListMaxLen=1000` ที่ขอบ token)
- ฝั่ง SQL ใช้ `optOn(key)`, `optInt(key)`, `optHas(key)`, `optInList`, `optCodeSet`, `optCodeFilter` -- key เป็นค่าคงที่ในโค้ดเท่านั้น (ตรวจด้วย `optKeyRe = ^[a-z][a-z0-9_]*$` ใน unit test ตามคอมเมนต์)
- `normalizeReportOptions(defs, in)` เก็บเฉพาะ key ที่ประกาศ แล้วบังคับชนิด (checkbox: 1/true/on/y/yes -> "1"; number ตรง `^-?[0-9]{1,6}$`; date ต้อง parse ได้; select ต้องอยู่ใน options; ข้อความตัด control char และยาวสุด 500 rune) -- ป้องกันการยัด key/ค่าแปลกเข้า SQL
- `reportOptionsJSON` สร้างค่า `$7`: ทุก key ที่ประกาศมีอยู่เสมอ และรวมค่าฝั่ง server (เช่นทศนิยมของบริษัท) ที่ไม่ใช่ข้อมูลจากคำขอ

### ช่วงรหัสหลายแถว (`ranges` / `multi`)
- `parseCodeRanges("A..B,C")`: สูงสุด `maxCodeRangeRows = 50` แถว, ต้องมีค่า "จาก" ไม่ว่าง, "ถึง" ว่าง = เท่ากับค่า "จาก" พอดี; `cleanCode` ตัด control char, `,`, `:`, `..` และจำกัด `maxCodeLen = 40` rune
- `codeRange.sql(col, bind)`: `upper(col) = upper($n)` หรือ `BETWEEN` แบบไม่สนตัวพิมพ์ (bind แทน placeholder)
- `parseCodeMulti`: ตัวพิมพ์ใหญ่ ไม่ซ้ำ จำกัด `maxCodeRangeRows*4`; ทุกแถวถูกติ๊กหรือไม่ติ๊กเลย = ไม่กรอง
- สมุดรายวัน GL: `glfaBooks` ผูกเป็น `$8::text[]` (`glfaBookPrm`/`glfaBookCond`)

## จุดที่ต้องระวัง
- ลงทะเบียน key ซ้ำ = โปรแกรมไม่เริ่ม (panic)
- ถ้า SQL ของ spec ไม่อ้าง `prm.d` เลย `UsesDateRange` จะเป็นเท็จ (คำนวณจาก `strings.Contains(s.sql, "prm.d")` ที่ `report_menu_ic.go`)
- ห้ามต่อ key ของ option จากข้อมูลผู้ใช้ลงใน SQL: ฟังก์ชัน `opt*` รับ key คงที่เท่านั้น

## ที่มาในโค้ด
- `backend/internal/application/process/report_menu.go:10-42` - `reportParams`, `menuReportFunc`, `menuReports`, `registerMenuReport`
- `backend/internal/application/process/report_conditions.go:12-48` - `ReportCondition` และตัวสร้าง `cond*`
- `backend/internal/application/process/report_conditions.go:51-120` - ตัวอ่าน option ฝั่ง Go
- `backend/internal/application/process/report_options.go:23-90` - `normalizeReportOptions`, `reportOptionsJSON`
- `backend/internal/application/process/report_options.go:91-122` - ฟังก์ชันสร้างชิ้น SQL `opt*`
- `backend/internal/application/process/report_code_ranges.go:22-107` - `codeRange`, `parseCodeRanges`, `parseCodeMulti`
- `backend/internal/application/process/report_menu_ic.go:20` - `icPrm`
- `backend/internal/application/process/report_menu_ic.go:23-35` - `icSpec`
- `backend/internal/application/process/report_menu_ic.go:41-77` - `icRun`

## ดูเพิ่ม
- [[proc-report-engine]]
- [[proc-report-custom-sql-template]]
- [[proc-wh-shelf-permission]]
- [[process-overview]]
