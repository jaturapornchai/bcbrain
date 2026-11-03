---
title: "งวดบัญชี ปิดงวด และสิ้นปี (account period / erp_account_period / checkOpenPeriod)"
tags: [glossary, gl, period]
aliases: ["งวดบัญชี", "งวด", "กำหนดงวดบัญชี", "ปิดงวด", "ปิดงวดบัญชี", "เปิดงวด", "ปีบัญชี", "งวดที่", "ประมวลผลสิ้นงวด", "ประมวลผลสิ้นปี", "สิ้นงวด", "สิ้นปี", "ปิดบัญชี", "erp_account_period", "period_number", "period_year", "date_start", "date_end", "account_year", "checkOpenPeriod", "checkPeriodNotClosed", "checkCancelPeriod", "menu_account_period", "menu_gl_end_of_period", "menu_gl_end_of_year", "1998", "1999"]
sources: ["backend/internal/application/process/period.go:17", "backend/internal/application/process/period.go:40", "backend/internal/application/process/period.go:53", "backend/internal/application/process/period.go:95", "backend/internal/application/process/period.go:109", "backend/internal/application/process/trans_validate.go:45", "backend/internal/application/process/fa_sale.go:431", "frontend/src/config/schemas/masterDetailSchemas.ts:1570", "frontend/src/config/schemas/masterDetailSchemas.ts:1580", "frontend/src/config/bcMenu.json:1191", "frontend/src/config/bcMenu.json:9638", "frontend/src/config/bcMenu.json:9652", "backend/internal/application/process/workflow.go:678", "backend/internal/application/process/report_menu_gl_fa.go:954"]
---

# งวดบัญชี / ปิดงวด

## ในระบบนี้คืออะไร
- งวดบัญชีเก็บในตาราง `erp_account_period` หนึ่งแถวต่อหนึ่งงวด ตั้งค่าที่จอ "กำหนดงวดบัญชี" (`menu_account_period`, เมนู 1.8.1, `masterDetailSchemas.ts:1570`, bcMenu.json:1191)
- ทุกครั้งที่บันทึก ลบ หรือยกเลิกเอกสาร ระบบหางวดแรก (เรียงตาม `period_number`) ที่ `date_start..date_end` ครอบวันที่เอกสาร งวดนั้นต้องมีอยู่และมี `status = 0` ไม่อย่างนั้นจะไม่ยอมบันทึก (`checkOpenPeriod`, `period.go:17-23`, SQL `:40-42`)
- ถ้าไม่ส่งวันที่มา ระบบใช้วันที่ปัจจุบัน (`period.go:41`)

## คอลัมน์บนจอ (`masterDetailSchemas.ts:1580-1604`)
| ป้าย | คอลัมน์ | ค่า |
|---|---|---|
| งวดที่ | `period_number` | เลขงวด |
| วันที่เริ่มต้นงวด / วันที่สิ้นสุดงวด | `date_start` / `date_end` | วันที่ |
| ปีบัญชี (พ.ศ./ค.ศ.) | `period_year` | ปี |
| สถานะงวดบัญชี | `status` | 0 เปิดใช้งาน (Open) · 1 ปิดงวดบัญชี (Closed) |
- ปุ่ม "คำนวณงวดบัญชีอัตโนมัติ (12 งวด)" สร้าง 12 งวดของปีปัจจุบัน (`fillAllLabel`/`fillAllSql`, `:1583-1585`)

## ข้อความผิดพลาด
"วันที่เอกสาร dd/mm/yyyy ได้ถูกปิดงวดไปแล้ว หรือยังไม่ได้กำหนดงวดบัญชี กรุณาตรวจสอบ" ใช้ข้อความเดียวกันทั้งกรณีงวดปิดและกรณีไม่พบงวด (`periodError`, `period.go:53-62`)

## จุดที่ตรวจงวด
- เอกสารซื้อ ขาย และคลัง (`trans_validate.go:45`), ยกเลิกเอกสาร (ตรวจทั้งวันที่ของเอกสารต้นทางและเอกสารยกเลิก, `checkCancelPeriod`, `period.go:95-105`), รายวันและ ap_ar (`checkSaveDocPeriod`, `:109-114`), ขายสินทรัพย์ (`fa_sale.go:422-448`)
- เช็คไม่มีการตรวจงวด (`period.go:113`)
- ลบค่าเสื่อมใช้ `checkPeriodNotClosed` ที่ผ่อนกว่า: บล็อกเฉพาะงวดที่ปิดแล้ว วันที่ที่ไม่มีงวดยังผ่าน (`period.go:27-33`)

## ประมวลผลสิ้นงวด / สิ้นปี
- เมนู "ประมวลผลสิ้นงวด" (`menu_gl_end_of_period`, bcMenu.json:9638) และ "ประมวลผลสิ้นปี" (`menu_gl_end_of_year`, :9652)
- เอกสารปิดบัญชีใช้ `trans_flag` 1998 (สิ้นงวด) และ 1999 (สิ้นปี) บันทึกเป็น `gl_journal` ที่มี `journal_type 2` (`workflow.go:678`, `:818`, `:912`) ดู [[term-gl-journal]]
- รายงานของเมนูสิ้นงวดดึงยอดบัญชี `account_type` 3 (รายได้) และ 4 (ค่าใช้จ่าย) ของช่วงวันที่ที่เลือก (`glfaEndOfPeriod`, `report_menu_gl_fa.go:954-958`) ดู [[term-chart-of-account]]

## ข้อควรระวัง
- ปุ่มคำนวณอัตโนมัติใส่ `period_year` เป็น ปี ค.ศ. + 543 (`masterDetailSchemas.ts:1585`) แต่ `date_start` และ `date_end` เป็น ค.ศ. ระบบตรวจงวดจากช่วงวันที่เท่านั้น ไม่ได้ใช้ `period_year` (`period.go:40-42`) ดู [[term-buddhist-year]]
- `gl_journal.period_number` และ `account_year` เป็นคนละคอลัมน์กับ `erp_account_period` ระบบเขียนลงตอนลงบัญชีอัตโนมัติ (`gl_template.go:1050-1053`)

## ลิงก์
[[acc-period-close]] · [[tbl-erp-account-period]] · [[term-gl-journal]] · [[term-buddhist-year]] · [[term-last-status-cancel-approve]] · [[glossary-overview]]

## ที่มาในโค้ด
- `backend/internal/application/process/period.go:17-62`, `:95-114`
- `backend/internal/application/process/trans_validate.go:45`; `fa_sale.go:422-448`
- `backend/internal/application/process/workflow.go:678`, `:818`, `:912`
- `backend/internal/application/process/report_menu_gl_fa.go:954-958`
- `backend/internal/application/process/gl_template.go:1050-1053`
- `frontend/src/config/schemas/masterDetailSchemas.ts:1570-1604`
- `frontend/src/config/bcMenu.json:1191`, `:9638`, `:9652`
