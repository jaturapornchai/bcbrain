---
title: "บทเรียนเครื่องมือรายงานกลาง (Report engine rules)"
tags: [history, lesson, report, sql]
aliases: ["menuReports registry", "runLegacyReport", "custom SQL column type", "report template scope", "glfaBookCond", "alias 63 bytes", "LIMIT truncates report"]
sources: ["backend/internal/application/process/report.go:289", "backend/internal/application/process/report.go:426", "backend/internal/application/process/report.go:752", "backend/internal/application/process/report_code_ranges.go:101", "backend/internal/application/process/report_template.go:307", "backend/internal/application/process/report_template.go:706", "backend/internal/application/process/report_template.go:766", "backend/internal/application/process/report_template.go:859", "backend/internal/application/process/report_engine_test.go:31", "backend/internal/application/process/report_code_ranges_test.go:130", "backend/internal/application/process/report_menu_so_po_test.go:154", "frontend/account/report/BuySaleInformationScreen.tsx:74", "AGENTS.md:53"]
---

# บทเรียนเครื่องมือรายงานกลาง

รายงานทุกเมนูวิ่งผ่าน `RunReport` ตัวเดียว ถ้า engine กลางเดาแทนที่จะตอบตามนิยามของแต่ละรายงาน จะได้รายงานที่ "ใกล้เคียง" แต่ผิด: ตอบเมนูที่ไม่มีรายงานด้วยรายงานอื่น, ชนิดคอลัมน์เพี้ยน, เทมเพลตข้ามรายงาน, หรือแถวหายเงียบ

## อะไรพังได้
- **เมนูที่ไม่มีรายงานของตัวเองถูกตอบด้วยรายงานสต็อกที่ไม่เกี่ยวกัน** (runner กลางเดาจากคำในชื่อเมนู)
- **กรองสมุดรายวัน**: เลือกครบทุกเล่มแล้วผลหายหรือส่ง `NULL` เข้า SQL
- **Custom SQL เดาชนิดจากหน้าตาของค่า**: `to_char()` ที่ดูเป็นตัวเลขถูกรวมยอด, ค่า `numeric`/`interval`/`time` โชว์เป็น struct
- **alias ภาษาไทยยาวเกิน 63 ไบต์**: PostgreSQL ตัดชื่อ แล้ว override ของคอลัมน์จับคู่ไม่เจอ
- **เทมเพลตข้ามรายงาน**: บันทึก/ลบ/ตั้งค่าเริ่มต้นด้วย `template_id` ของรายงานอื่นได้
- **กรองหลัง `LIMIT`**: รายการที่มียอดแต่เรียงเกินแถวที่ 100 ไม่แสดง
- **ตัดแถวเงียบ**: ใส่ `LIMIT` ใน SQL รายงานเพื่อกันช้า ทำให้ข้อมูลไม่ครบโดยไม่บอก

## โค้ดป้องกันไว้อย่างไร
| ด่าน | ที่อยู่ | ทำอะไร |
|---|---|---|
| registry ต่อเมนู | `backend/internal/application/process/report.go:289` (`menuReports[lowerKey]`) | เมนูที่ลงทะเบียนแล้วเรียกฟังก์ชันของตัวเอง |
| ปฏิเสธเมนูที่ไม่รู้จัก | `report.go:426-432`, `:292-298`; เทสต์ `report_engine_test.go:31` | `runLegacyReport` ตอบเฉพาะโหมด `sql_utility` นอกนั้นคืน `errNoLegacyReport` ("ไม่พบรายงาน ...") ไม่ตอบรายงานอื่นแทน |
| เลือกครบทุกเล่ม = ไม่กรอง | `backend/internal/application/process/report_code_ranges.go:101-113` (`glfaBookCond`, `glfaBooks`); เทสต์ `report_code_ranges_test.go:130` | รายการที่ติ๊กว่างหรือเต็มทั้งรายการไม่กรอง และ slice ที่ bind ต้องไม่เป็น `nil` |
| ชนิดคอลัมน์ไม่เดา | `backend/internal/application/process/report_template.go:706-722,766-772` | ชนิดมาจากคอลัมน์ของรายงานเดิมก่อน ไม่มีจึงใช้ OID ของ PostgreSQL (`isPostgresNumericOID`) ทำให้ `to_char()` เป็นข้อความและไม่ถูกรวมยอด |
| ค่าที่ driver ให้เป็น struct | `report_template.go:859-865` (`case driver.Valuer`) | แปลง `numeric`/`interval`/`time` เป็นข้อความของ PostgreSQL |
| alias 63 ไบต์ | `backend/internal/application/process/report.go:752-790`; `report_template.go:692`; เทสต์ `report_engine_test.go:15-40` | `pgIdent` คำนวณชื่อที่ PostgreSQL ตัดไว้ แล้วผูกกลับกับ key เต็มของคอลัมน์ |
| ขอบเขตเทมเพลต | `report_template.go:307-335,398-399,442-443,462-463` | upsert/delete/set-default ใส่ `menu_key` ใน WHERE; 0 แถว = `KindNotFound` ("จึงไม่ได้บันทึกทับ/ลบ/ตั้งเป็นค่าเริ่มต้น") |
| กรองก่อน LIMIT | `frontend/account/report/BuySaleInformationScreen.tsx:74-82` | เงื่อนไข "เฉพาะมียอด" อยู่ใน SQL ก่อน `LIMIT 100` (คอมเมนต์ที่ `:74`) |
| ห้ามตัดแถวเงียบ | `report_menu_so_po_test.go:154-155`, `report_menu_ic_test.go:102-117`; `AGENTS.md:53` | เทสต์ล้มถ้า SQL รายงานมี `LIMIT 50000`/`LIMIT 100000`; กฎโปรเจกต์ห้ามตัดข้อมูลรายงาน |

## กฎที่ต้องจำ
- ห้ามให้ engine กลางเดา: เมนูที่ไม่มีรายงานต้องปฏิเสธ; ชนิดคอลัมน์มาจากนิยามรายงานหรือ OID ไม่ใช่หน้าตาของค่า
- ทุก SQL ที่รับ id จาก client ต้องผูกขอบเขตเจ้าของ (`menu_key`) และ 0 แถวคือ "ไม่พบ"
- ตัวกรองต้องอยู่ใน SQL ก่อน `LIMIT` ไม่ใช่กรองหลังตัด และรายงานห้ามตัดแถวเงียบ
- ชื่อคอลัมน์ภาษาไทยที่ยาวให้ตรวจ 63 ไบต์ในเทสต์ (`report_menu_ic_test.go:125`)

## ที่มาในโค้ด
- `backend/internal/application/process/report.go:289-298,426-432,752-790`
- `backend/internal/application/process/report_code_ranges.go:101-113`, `report_template.go:307-335,692,706-722,766,859`
- `backend/internal/application/process/report_engine_test.go:15-40,190`, `report_code_ranges_test.go:130`
- `frontend/account/report/BuySaleInformationScreen.tsx:74-82`
- ดูเพิ่ม: [[hist-lessons-thai-text-pdf]] · [[hist-lessons-dates-buddhist-year]] · [[hist-lessons-performance-and-load]] · [[hist-lessons-query-gateway-write-lockdown]] · [[proc-report-engine]] · [[proc-report-registry-conditions]] · [[proc-report-custom-sql-template]] · [[std-report-engine-standard]] · [[history-overview]]
