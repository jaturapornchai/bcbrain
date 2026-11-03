---
title: "สมุดรายวัน รายการบัญชี และผ่านรายการ (GL journal / gl_journal / gl_journal_detail)"
tags: [glossary, gl, journal]
aliases: ["สมุดรายวัน", "ข้อมูลรายวัน", "บันทึกรายวัน", "รายการบัญชี", "ใบสำคัญ", "ใบสำคัญทั่วไป", "JV", "สมุดบัญชี", "กำหนดสมุดบัญชี", "ผ่านรายการ", "ยกเลิกผ่านรายการ", "ลงบัญชี", "โอน GL", "รวมบัญชี", "คอมปาว", "เดบิต", "เครดิต", "ประเภทรายวัน", "รายวัน", "ยกมางวด", "ปิดงวด", "ปรับปรุง", "ยอดยกมา", "gl_journal", "gl_journal_detail", "gl_journal_book", "book_code", "debit_or_credit", "journal_type", "trans_direct", "is_pass", "gl_trans_type", "period_number", "account_year", "menu_gl_journal", "menu_gl_journal_pass", "menu_setup_gl_journal_book", "deleteAutoGL", "RebuildGL"]
sources: ["frontend/account/tabs/transMenuMap.ts:2368", "frontend/src/config/bcMenu.json:1205", "frontend/src/config/bcMenu.json:9416", "frontend/src/config/bcMenu.json:9493", "backend/internal/application/process/docs.go:294", "backend/internal/application/process/docs.go:302", "backend/internal/application/process/gl_template.go:1044", "backend/internal/application/process/gl_template.go:1050", "backend/internal/application/process/gl_template.go:1066", "backend/internal/application/process/gl_template.go:1161", "backend/internal/application/process/gl_template.go:353", "backend/internal/application/process/gl_template.go:1160", "backend/internal/application/process/service.go:1305", "backend/internal/application/process/service.go:1442", "backend/internal/application/process/service.go:1759", "backend/internal/application/process/stock_beginning.go:112", "backend/internal/application/process/report_menu_gl_fa_tb.go:11", "backend/internal/application/process/report_menu_gl_fa_tb.go:15", "backend/internal/application/process/workflow.go:511", "backend/internal/application/process/workflow.go:554", "backend/internal/application/process/doc_cancel.go:585", "backend/internal/application/process/doc_cancel.go:597", "frontend/src/config/schemas/erpOption/tab2Gl.ts:39", "frontend/account/process/SystemProcessWorkbenchScreen.tsx:147"]
---

# สมุดรายวัน / รายการบัญชี

## ในระบบนี้คืออะไร
- หัวรายการบัญชีอยู่ใน `gl_journal` และบรรทัดเดบิต/เครดิตอยู่ใน `gl_journal_detail` โดยหัวกับบรรทัดจับคู่กันด้วย `doc_no` + `book_code` (สมุดบัญชี) + `trans_flag` (`deleteAutoGL`, `gl_template.go:1161-1163`; ตอนลงบัญชีเขียนหัวที่ `:1050-1053` และบรรทัดที่ `:1066-1071`)
- ที่มาของรายการมี 2 ทาง
  1. **บันทึกเอง**: จอ "ข้อมูลรายวัน" (`menu_gl_journal`, screenCode/prefix `JV`, `transMenuMap.ts:2368-2380`; bcMenu.json:9416) เก็บ `trans_direct = 1` และ `journal_type = 0` (`docs.go:294-302`)
  2. **ลงบัญชีอัตโนมัติ** จากเอกสารซื้อ ขาย คลัง และเงิน ตามรูปแบบ GL ของ `doc_format_code` ระบบจะไม่ยอมบันทึกถ้าเดบิตไม่เท่ากับเครดิต (`gl_template.go:1044-1047`) และเขียนด้วย `trans_direct = 0` (`:1050-1053`) ดู [[acc-gl-posting-standard]]
- สมุดบัญชี (`gl_journal_book`) ตั้งค่าที่จอ "กำหนดสมุดบัญชี" (`menu_setup_gl_journal_book`, bcMenu.json:1205)

## ค่าที่เป็นไปได้
| คอลัมน์ | ความหมายจากโค้ด |
|---|---|
| `debit_or_credit` | 0 เดบิต · 1 เครดิต (`debitOrCredit`, `service.go:1759-1764`; `gl_template.go:1070`) |
| `journal_type` | 0 รายวัน · 1 ยกมางวด · 2 ปิดงวด · 3 ปรับปรุง · 4 ยอดยกมา (`sbJournalTypes`, `stock_beginning.go:112`) |
| `trans_direct` | 1 บันทึกเอง ระบบไม่สร้างใหม่ · 0/อื่นๆ สร้างอัตโนมัติ ลบและสร้างใหม่ได้ (`deleteAutoGL`, `gl_template.go:1160-1166`; `doc_cancel.go:597`) |
| `is_pass` | 1 ผ่านรายการแล้ว · 0 ยังไม่ผ่าน / ยกเลิกผ่าน (`JournalPass`, `workflow.go:511`, `:517-519`) |
| `erp_option.gl_trans_type` "โอน GL" | 0 แบบแยกรายตัว · 1 แบบแยกรายตัว+คอมปาว (บัญชีและสาขาเดียวกันรวมเป็นบรรทัดเดียว) (`tab2Gl.ts:39-45`; `compound`, `gl_template.go:353-374`; อ่านค่าที่ `:731`, `:752`) |

## รายงานงบทดลองแยกยอดตาม `journal_type`
- ยอดยกมา = รายการก่อนวันเริ่ม + `journal_type 1` ภายในช่วง + `journal_type 4` ก่อนวันสุดท้าย (`glfaOpenCond`, `report_menu_gl_fa_tb.go:11`)
- ยอดประจำงวด = `journal_type 0` + ปิดงวด (2) และปรับปรุง (3) ซึ่งรายการของวันสุดท้ายจะนับเมื่อติ๊กเลือก และ `journal_type 4` ที่ลงวันสุดท้ายเมื่อติ๊กเลือก (`glfaPeriodCond`, `report_menu_gl_fa_tb.go:15-18`)

## จอที่เกี่ยวข้อง
"ผ่านรายการ" (`menu_gl_journal_pass`, bcMenu.json:9493) ใช้ตั้ง `is_pass` ส่วนเอกสารปิดงวดและปิดปี (flag 1998/1999) ดูที่ [[term-account-period]]
- ผู้ใช้เห็นอะไรบนจอผ่านรายการ: จอประมวลผลระบบโหมด `gl_journal_pass` ([[scr-system-process-workbench]]) แสดงใบสำคัญตามช่วงวันที่และเลขที่ใบสำคัญ พร้อมคอลัมน์ "หมายเหตุ" ใบที่ไม่พบผังบัญชี / รหัสบัญชีผิดประเภท / ยอดไม่ Balance ติ๊กไม่ได้ ใบที่ "ผ่านรายการแล้ว" ยังติ๊กได้ ผู้ใช้ติ๊กแล้วกด "ผ่านรายการ" (เมนู "ยกเลิกผ่านรายการ" ใช้จอเดียวกันแต่แสดงเฉพาะใบที่ผ่านแล้ว) ส่วนเมนู "ตรวจสอบความถูกต้อง" (`menu_gl_check_data`) เป็นปุ่มตรวจ 8 ข้อ ไม่ใช่การผ่านรายการ (`SystemProcessWorkbenchScreen.tsx:147-148`, `:425-446`, `:657-674`; รายการตรวจฝั่ง backend `GLCheck`, `workflow.go:554`, `:588-611`) กติกาฝั่ง backend ดู [[api-proc-actions-gl]]

## ข้อควรระวัง
- รายการที่บันทึกเอง (`trans_direct = 1`) จะไม่ถูกลบหรือสร้างใหม่ตอน rebuild GL (`RebuildGL`, `service.go:1442`, `:1451`, `:1493`, `:1507`) และตอนสร้างรายการกลับด้านของเอกสารยกเลิก (`reverseCancelledGL`, `doc_cancel.go:585`, `:597`, `:628`, `:632`)
- `period_number` และ `account_year` ของรายการที่บันทึกเองดึงมาจาก `erp_account_period` (`period_year`) ถ้าไม่พบงวดจะใช้เดือนและปี ค.ศ. ของวันที่เอกสาร (`docs.go:304-305`) ดังนั้นถ้ากรอก `period_year` เป็น พ.ศ. ค่า `account_year` ก็จะเป็น พ.ศ. ด้วย (อนุมานจากโค้ด ยังไม่ได้ตรวจข้อมูลจริง) ดู [[term-buddhist-year]]
- ตัวเลขเงินบันทึกเป็น `numeric` จากสตริงทศนิยม ไม่มี float ดู [[acc-rounding-decimal]]

## ลิงก์
[[acc-gl-posting-standard]] · [[tbl-gl-journal]] · [[tbl-gl-journal-detail]] · [[term-chart-of-account]] · [[term-account-period]] · [[term-trans-flag]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:2368-2380`
- `frontend/src/config/bcMenu.json:1205`, `:9416`, `:9493`
- `frontend/src/config/schemas/erpOption/tab2Gl.ts:39-45`
- `backend/internal/application/process/docs.go:294-307`
- `backend/internal/application/process/gl_template.go:353-374`, `:731`, `:752`, `:1044-1071`, `:1160-1170`
- `backend/internal/application/process/service.go:1305`, `:1442`, `:1451`, `:1493`, `:1507`, `:1759-1764`; `stock_beginning.go:112`
- `backend/internal/application/process/report_menu_gl_fa_tb.go:11`, `:15-18`
- `backend/internal/application/process/workflow.go:511`, `:517-519`, `:554`, `:588-611`; `doc_cancel.go:585`, `:597`, `:628`, `:632`
- `frontend/account/process/SystemProcessWorkbenchScreen.tsx:147-148`, `:425-446`, `:657-674`
