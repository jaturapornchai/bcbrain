---
title: "ผังบัญชี และประเภทบัญชี (chart of account / gl_chart_of_account)"
tags: [glossary, gl, master]
aliases: ["ผังบัญชี", "รหัสบัญชี", "เลขที่บัญชี", "ชื่อบัญชี", "บัญชีหลัก", "บัญชีย่อย", "ระดับบัญชี", "ประเภทบัญชี", "สินทรัพย์", "หนี้สิน", "ทุน", "รายได้", "ค่าใช้จ่าย", "ด้านบัญชี", "เดบิต", "เครดิต", "ปิดเข้าบัญชี", "กลุ่มบัญชี", "กระแสเงินสด", "ผลกระทบต่องบการเงิน", "เกี่ยวข้องกับภาษี", "gl_chart_of_account", "account_code", "account_type", "account_level", "main_code", "account_close", "account_group", "cash_flow_group", "balance_mode", "balance_sheet_status", "chart of account", "COA", "menu_chart_of_account"]
sources: ["frontend/src/config/schemas/masterDetailSchemas.ts:249", "frontend/src/config/schemas/masterDetailSchemas.ts:250", "frontend/src/config/schemas/masterDetailSchemas.ts:251", "frontend/src/config/schemas/masterDetailSchemas.ts:252", "frontend/src/config/schemas/masterDetailSchemas.ts:253", "frontend/src/config/schemas/masterDetailSchemas.ts:254", "frontend/src/config/schemas/masterDetailSchemas.ts:259", "frontend/src/config/schemas/masterDetailSchemas.ts:691", "frontend/src/config/schemas/masterDetailSchemas.ts:703", "backend/internal/application/process/report_menu_gl_fa.go:951", "backend/internal/application/process/gl_template.go:1063"]
---

# ผังบัญชี

## ในระบบนี้คืออะไร
- ผังบัญชีเก็บใน `gl_chart_of_account` โดย `code` เป็นรหัสบัญชี จอ "รายละเอียดผังบัญชี" (`menu_chart_of_account`, เมนู 9.1.1, `masterDetailSchemas.ts:691-697`)
- บรรทัดรายการบัญชีอ้างรหัสนี้ใน `gl_journal_detail.account_code` (`gl_template.go:1063-1066`) และรายงานจะ JOIN กลับมาเอาชื่อบัญชีจาก `name_1` (`report_menu_gl_fa.go:953-954`)

## ช่องบนจอ (`masterDetailSchemas.ts:703-718`)
| ป้าย | คอลัมน์ | ค่า (เลข = value) |
|---|---|---|
| รหัสบัญชี | `code` | ตัวพิมพ์ใหญ่ ยาวไม่เกิน 25 ตัว |
| ระดับบัญชี | `account_level` | 0 บัญชีหลัก, 1-7 ระดับที่ 1-7 (`:249`) |
| ชื่อบัญชี / ชื่อบัญชี (ภาษาอังกฤษ) | `name_1` / `name_2` | |
| ผังบัญชีหลัก | `main_code` | lookup ผังบัญชี |
| ปิดเข้าบัญชี | `account_close` | lookup ผังบัญชี |
| กลุ่มบัญชี | `account_group` | `gl_account_group` |
| รหัสบัญชีกระแสเงินสด | `cash_flow_group` | `gl_cash_flow_group` |
| ประเภทบัญชี | `account_type` | 0 สินทรัพย์ · 1 หนี้สิน · 2 ทุน · 3 รายได้ · 4 ค่าใช้จ่าย (`:250`) |
| เกี่ยวข้องกับภาษี | `tax_type` | 0 ไม่เกี่ยวข้อง · 1 ภาษีขาย · 2 ภาษีซื้อ · 3 หัก ณ ที่จ่าย · 4 ถูกหัก ณ ที่จ่าย (`:251`) |
| ผลกระทบต่องบการเงิน | `balance_sheet_status` | 0 ทั่วไป · 1 ต้นทุนขาย · 2 การผลิต · 3 ค่าใช้จ่าย · 4 กำไรสะสม · 5 ค่าใช้จ่ายต้องห้าม (`:252`) |
| สถานะบัญชี | `status` | 0 บัญชีทั่วไป · 1 บัญชีหลัก (`:253`) |
| ด้านบัญชี | `balance_mode` | 0 เดบิต · 1 เครดิต (`:254`) |
| ช่องติ๊ก | `side_status` แยกหน่วยงาน, `department_status` แยกแผนก, `allocate_status` แยกการจัดสรร, `project_status` แยกโครงการ, `job_status` แยกงาน, `work_in_process_status` งานระหว่างทำ (JOB) (`:259-265`) | |
| ใช้งาน | `active_status` | ค่าเริ่มต้น 1 |

## การใช้ในรายงาน
- "ประมวลผลสิ้นงวด" ใช้เฉพาะ `account_type` 3 และ 4 (`report_menu_gl_fa.go:955`) ดู [[term-account-period]]

## ข้อควรระวัง
- ค่า select บนจอแสดงแบบ "เลข.ชื่อ" โดยเริ่มที่ 0 (`yesNoSteps`, `masterDetailSchemas.ts:247`)
- `tax_type` ของผังบัญชีเป็นคนละ enum กับ `tax_type` ของสินค้า (0 ภาษีมูลค่าเพิ่ม / 1 ยกเว้นภาษี) ดู [[term-item-type]]
- ช่องติ๊ก แยกโครงการ/แผนก/งาน เกี่ยวกับ dimension ของบรรทัดบัญชี ดู [[term-dimension-project-side-job]]

## ลิงก์
[[tbl-gl-chart-of-account]] · [[term-gl-journal]] · [[acc-gl-posting-standard]] · [[glossary-overview]]

## ที่มาในโค้ด
- `frontend/src/config/schemas/masterDetailSchemas.ts:247-265`, `:691-718`
- `backend/internal/application/process/report_menu_gl_fa.go:951-956`
- `backend/internal/application/process/gl_template.go:1063-1066`
