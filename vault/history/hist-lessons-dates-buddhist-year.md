---
title: "บทเรียนปี พ.ศ./ค.ศ. และวันที่ (Dates, Buddhist year and year_type)"
tags: [history, lesson, date, year-type, buddhist-era]
aliases: ["year_type lessons", "hardcoded +543", "todayLocal", "พ.ศ. ค.ศ. bug", "applyReportYearType", "glfaBucketKey"]
sources: ["backend/internal/application/process/report.go:163", "backend/internal/application/process/report.go:185", "backend/internal/application/process/report.go:353", "backend/internal/application/process/report.go:574", "backend/internal/application/process/report.go:650", "backend/internal/application/process/report_menu_gl_fa.go:1026", "backend/internal/application/process/report_menu_gl_fa.go:1320", "backend/internal/application/process/report_menu_gl_fa.go:1723", "backend/internal/application/process/report_menu_gl_fa.go:1758", "backend/internal/application/process/report_menu_so_po.go:789", "backend/internal/application/process/report_pdf.go:891", "backend/internal/application/process/gl_post.go:46", "backend/internal/application/process/gl_post.go:59", "backend/internal/application/process/doc_picture.go:205", "backend/internal/application/process/doc_picture.go:248", "backend/internal/application/process/journaltax.go:208", "backend/internal/application/process/stock_beginning.go:269", "backend/internal/application/process/report_menu_gl_fa_test.go:69", "backend/internal/application/process/report_menu_so_po_test.go:280", "backend/internal/application/process/doc_picture_test.go:13", "backend/internal/application/process/uat_s1_fixes_test.go:139", "frontend/src/lib/numeric.ts:137", "frontend/src/lib/numeric.ts:394", "frontend/src/lib/numeric.ts:422", "frontend/src/lib/numeric.ts:487", "frontend/src/lib/utils.ts:20", "frontend/shared/ui/DateBox.tsx:42", "frontend/account/transaction/JournalTaxTabs.tsx:124", "frontend/account/transaction/JournalTaxTabs.tsx:522", "frontend/shared/components/GlobalDocFormPrintModal.tsx:1625", "AGENTS.md:42", "AGENTS.md:58"]
---

# บทเรียนปี พ.ศ./ค.ศ. และวันที่

DB เก็บปี ค.ศ. (`YYYY-MM-DD`) ทั้งหมด ส่วนหน้าจอ รายงาน และ PDF แปลงตาม `erp_option.year_type` (`0`=ค.ศ., `1`=พ.ศ.) ตามกฎโปรเจกต์ (`AGENTS.md:42,58`) จุดที่พังซ้ำคือโค้ดที่บวก/ลบ 543 เอง ป้ายที่ไม่รับ year_type และ "วันนี้" ที่ได้เมื่อวาน

## อะไรพังได้
- **เก็บปีลง DB เป็น พ.ศ.**: ปีภาษี (`vat_effective_year`) หรือ `account_year` ของยอดยกมาปนกับปี ค.ศ. ของงวดบัญชี ทำให้เทียบช่วงเดือนผิด
- **รายงานตั้ง ค.ศ. แล้วยังเห็น พ.ศ.**: หัวเงื่อนไข ป้ายเดือน/ปีของคอลัมน์ เดือนภาษี
- **ลืมส่ง `yearType`**: ฟังก์ชันสร้างป้ายแบบ variadic มี default เป็น พ.ศ. จึงได้ พ.ศ. เสมอเมื่อผู้เรียกไม่ส่ง
- **"วันนี้" ได้เมื่อวาน**: `toISOString()` เป็น UTC และ `new Date("YYYY-MM-DD")` คือเที่ยงคืน UTC จึงคลาดวันบนเครื่องที่ timezone ต่างจาก UTC
- **ค่า default ของ year_type ไม่ตรงกัน**: อ่านไม่ได้/ไม่มีแถวแล้วฝั่งรายงานได้ ค.ศ. แต่ฝั่ง GL ได้ พ.ศ. (ดูตารางด้านล่าง)

## โค้ดป้องกันไว้อย่างไร
| ด่าน | ที่อยู่ | ทำอะไร |
|---|---|---|
| เก็บ ค.ศ. เสมอ | `backend/internal/application/process/journaltax.go:208`, `stock_beginning.go:269` | ปีภาษีตั้งต้นและ `accountYear` มาจาก `t.Year()`/`d.Year()` ไม่บวก 543 |
| แปลงค่าเก่าตอนโหลด | `frontend/account/transaction/JournalTaxTabs.tsx:124,522-527` | ปี >2400 ลบ 543 ตอนโหลด ช่องปีบวก 543 เฉพาะ `getBcYearType()===1` และแปลงกลับตอนพิมพ์ |
| รับ input หลายรูปแบบ | `report.go:163-182` (`normalizeDateInput`) | รับ `YYYY-MM-DD`/`DD/MM/YYYY` ปี >2400 ลบ 543 ก่อนใช้ |
| ตาข่ายสุดท้ายของรายงาน | `report.go:353-357,574-648,650` | `RunReport` ใส่ `res.YearType` แล้ว `applyReportYearType` แปลงวันที่ใน `ConditionText` และเซลล์สตริงที่เป็นวันที่เต็ม (ยาว 8-10 ตัว รูป `yyyy-mm-dd` หรือ `dd/mm/yyyy`) |
| ป้ายที่ตาข่ายจับไม่ได้ | `report_menu_gl_fa.go:1320` (`glfaBucketKey`), `report_menu_so_po.go:789` (`sopoMonthSpec`) | ป้ายอย่าง `ปี 2026`, `05/2026`, `เม.ย.25` ไม่ใช่วันที่เต็ม จึงรับ `yearType` เป็นพารามิเตอร์ (ผู้เรียกส่ง `readErpYearType` ที่ `report_menu_gl_fa.go:1385`, `report_menu_so_po.go:829`) ไม่ส่ง = พ.ศ. |
| SQL ภาษี | `report_menu_gl_fa.go:1026,1720-1723` | ปี >2400 ลบ 543 ก่อนเทียบช่วง ป้ายเดือนภาษีบวก 543 เมื่อ `erp_option.year_type=1` |
| หัวเงื่อนไข และวันที่พิมพ์ | `report_menu_gl_fa.go:1756-1760`, `report_pdf.go:891-895` | "ปี พ.ศ./ค.ศ." ตาม year_type และวันที่พิมพ์ใน PDF บวก 543 เมื่อ `res.YearType==1` |
| GL | `gl_post.go:46-54,59-69`, `doc_picture.go:205-210,248-256` | `&DOC_DATE&` และคีย์รูปแนบรับ `buddhist` จาก year_type (comment ใน `gl_post.go:58` ระบุให้ cast `::text` เพราะบาง schema เก็บเป็น varchar) |
| หน้าจอ | `frontend/src/lib/numeric.ts:137,394,422,487`, `frontend/src/lib/utils.ts:20-32`, `frontend/shared/ui/DateBox.tsx:42-46` | `todayLocal()` ใช้วันที่ local, `getBcYearType()` โหลดจาก `erp_option` แล้วแคชใน localStorage, `formatBcDate`/`formatThaiDate`/`DateBox` แปลงตอนแสดง (DateBox ส่งค่าออกเป็น ISO ค.ศ.), `formatThaiDate` แยก Y-M-D เอง |
| เทสต์ | `report_menu_gl_fa_test.go:69-77`, `report_menu_so_po_test.go:270-285`, `doc_picture_test.go:13-16`, `uat_s1_fixes_test.go:139` | ครอบ bucket key, ป้ายเดือน, คีย์รูปทั้งสองปี; เทสต์ SQL ภาษีเช็กแค่ว่าข้อความมี `2400` หรือ `543` |

ช่องว่างที่ตรวจพบในโค้ดวันนี้ (ยังไม่ถูกแก้):
- `applyReportYearType` และ `normalizeDateInput` ไม่มีเทสต์ตรง (ค้นในไฟล์ `*_test.go` ไม่พบ)
- `readErpYearType` (`report.go:185-197`) ไม่พบแถว/อ่านไม่ได้ = ค.ศ. แต่ `glYearBuddhist` (`gl_post.go:64-65`) และ `doc_picture.go:247-256` ไม่พบแถว = พ.ศ.
- ค่าเริ่มต้นวันที่แบบ UTC ยังเหลือใน `GlobalDocFormPrintModal.tsx:1625-1626` และ `lineoa/LineOaChatStudio.tsx:1010`

## กฎที่ต้องจำ
- DB เก็บ ค.ศ. เท่านั้น ทุกจุดที่บวก/ลบ 543 ต้องผูกกับ year_type หรือเป็นการรับค่าเก่า (>2400) ห้ามบวกเองลอยๆ
- ฟังก์ชันสร้างป้ายปี/เดือนต้องรับ `yearType` และผู้เรียกต้องส่งทุกครั้ง; ตาข่าย `applyReportYearType` จับเฉพาะวันที่เต็ม
- "วันนี้" ใช้ `todayLocal()` ห้าม `toISOString().slice(0,10)` กับค่าเริ่มต้นวันที่
- เกณฑ์ >2400 = พ.ศ. ใช้รับค่าเก่าเข้าเท่านั้น ไม่ใช่ที่เก็บ
- เพิ่มรายงานใหม่ต้องตรวจ 3 ชั้น: Go (default ของ `yearType`), SQL (grep `543`), หน้าจอ

## ที่มาในโค้ด
- `backend/internal/application/process/report.go:163-197,353-357,555-648,650`
- `backend/internal/application/process/report_menu_gl_fa.go:1026,1320,1385,1720-1723,1756-1760`, `report_menu_so_po.go:789,829`, `report_pdf.go:891-895`
- `backend/internal/application/process/gl_post.go:46-69`, `doc_picture.go:205-210,247-256`, `journaltax.go:208`, `stock_beginning.go:269`
- `frontend/src/lib/numeric.ts:137,354,394,399,422,473-493`, `frontend/src/lib/utils.ts:20-32`, `frontend/shared/ui/DateBox.tsx:42-46`
- `frontend/account/transaction/JournalTaxTabs.tsx:124,522`, `AGENTS.md:42,58`
- ดูเพิ่ม: [[hist-lessons-report-engine-rules]] · [[hist-lessons-thai-text-pdf]] · [[hist-lessons-numeric-input-blank-zero]] · [[std-ux-buddhist-year-bilingual]] · [[std-input-controls-and-labels]] · [[history-overview]]
