---
title: "โครงการ การจัดสรร งาน ฝ่าย แผนก และพนักงานขาย (project / allocate / job / side / department / sale_code)"
tags: [glossary, dimension, master]
aliases: ["โครงการ", "การจัดสรร", "จัดสรร", "งาน", "ฝ่าย", "หน่วยงาน", "แผนก", "แผนก/สาขา", "พนักงานขาย", "พนักงาน", "เข้าสาขา", "เข้าฝ่าย", "เข้าแผนก", "เข้าโครงการ", "ปลายทาง", "สาขาปลายทาง", "ฝ่ายปลายทาง", "dimension", "cost center", "project_code", "allocate_code", "job_code", "side_code", "department_code", "sale_code", "projectCode", "allocateCode", "jobCode", "sideCode", "departmentCode", "saleCode", "side_code_to", "department_code_to", "allocate_code_to", "project_code_to", "job_code_to", "branch_code_to", "erp_project_list", "erp_allocate_list", "erp_job_list", "erp_side_list", "erp_department_list", "erp_user", "doc_group"]
sources: ["backend/internal/application/process/trans.go:112", "backend/internal/application/process/trans.go:113", "backend/internal/application/process/trans.go:136", "backend/internal/application/process/trans.go:166", "backend/internal/application/process/trans.go:668", "backend/internal/application/process/trans.go:1171", "frontend/account/transaction/TransTopForm.tsx:566", "frontend/account/transaction/TransTopForm.tsx:576", "frontend/account/transaction/TransTopForm.tsx:586", "frontend/account/transaction/TransTopForm.tsx:596", "frontend/account/transaction/TransTopForm.tsx:606", "frontend/account/transaction/TransTopForm.tsx:636", "frontend/account/transaction/TransTopForm.tsx:694", "frontend/account/transaction/TransExtraTabs.tsx:204", "frontend/account/transaction/TransExtraTabs.tsx:414", "frontend/account/transaction/UniversalTransScreen.tsx:3251", "frontend/account/transaction/UniversalTransScreen.tsx:3265", "frontend/account/transaction/UniversalTransScreen.tsx:3275", "frontend/src/config/schemas/icMasterSchemas.ts:491", "frontend/src/config/schemas/icMasterSchemas.ts:807", "frontend/src/config/schemas/masterDetailSchemas.ts:260", "frontend/src/config/bcMenu.json:1283", "frontend/src/config/bcMenu.json:1349"]
---

# โครงการ / การจัดสรร / งาน / ฝ่าย / แผนก

## ในระบบนี้คืออะไร
รหัสที่ใช้แยกยอดเอกสาร (dimension) อยู่บนหัว `ic_trans` (`SaveTransInput`, `trans.go:136-139`) บนจอกรอกได้สองที่ คือแท็บรายละเอียดเพิ่มเติมของเอกสารทั่วไป ซึ่งแสดงเฉพาะรุ่นที่เปิด `hasAdvancedProFeatures` ("รหัสโครงการ (Project):", "รหัสงาน (Job):", "รหัสหน่วยงาน (Side):", "รหัสการจัดสรร (Allocate):", `TransExtraTabs.tsx:204-252`) และช่องที่หัวเอกสารของเอกสารที่ใช้ยอดเงินที่หัวเอกสารแทนตารางรายการ (`showHeaderAmount`, `TransTopForm.tsx:563`) ตามตารางด้านล่าง

| ป้ายบนจอ (`TransTopForm.tsx`) | ตัวแปร → คอลัมน์ | master (ตาราง / จอ) |
|---|---|---|
| โครงการ: (`:566`) | `projectCode` → `project_code` | `erp_project_list` "กำหนดโครงการ" `menu_setup_project` 1.8.10 (`icMasterSchemas.ts:819`) |
| การจัดสรร: (`:576`) | `allocateCode` → `allocate_code` | `erp_allocate_list` "กำหนดการจัดสรร" `menu_setup_allocate` 1.8.9 (`:813`) |
| งาน: (`:586`) | `jobCode` → `job_code` | `erp_job_list` "กำหนดงาน" `menu_setup_job` 1.8.11 (`:825`) |
| ฝ่าย: (`:596`) | `sideCode` → `side_code` | `erp_side_list` "กำหนดหน่วยงาน" `menu_setup_side` 1.8.8 (`:807`) |
| แผนก: (`:606`) และ แผนก/สาขา: (`:691`, `:731`) | `departmentCode` → `department_code` (`trans.go:112`) | `erp_department_list` "กำหนดรายละเอียดแผนก" 1.1.4 (`icMasterSchemas.ts:491-495`; lookup `UniversalTransScreen.tsx:3275`) |
| พนักงานขาย: (`:636`) | `saleCode` → `sale_code` (`trans.go:113`) | `erp_user` (lookup "ค้นหาพนักงาน", `UniversalTransScreen.tsx:3250-3251`) |
- คอลัมน์ที่บันทึกลงหัวเอกสาร: `project_code, allocate_code, side_code, job_code` (`trans.go:668`)

## ปลายทาง ("...To")
แท็บรายละเอียดเพิ่มเติม (`TransExtraTabs.tsx`) มีช่อง "เข้าสาขา / ฝ่าย:" (`:414`), "เข้าแผนก / จัดสรร:" (`:435`), "เข้าโครงการ / งาน:" (`:456`) ซึ่งบันทึกลง `branch_code_to, side_code_to, department_code_to, allocate_code_to, project_code_to, job_code_to` (`trans.go:166-171`, UPDATE `:1171`) ระบบเขียนคอลัมน์เหล่านี้พร้อม `doc_group`, `remark_4`, `remark_5`, `recheck_count` ในคำสั่ง UPDATE เดียวกัน เฉพาะเมื่อมีค่าอย่างน้อยหนึ่งช่องในกลุ่มนี้ (`trans.go:1169`)

## ผังบัญชี
ผังบัญชีมีช่องติ๊ก "แยกหน่วยงาน", "แยกแผนก", "แยกการจัดสรร", "แยกโครงการ", "แยกงาน" (`side_status` … `job_status`, `masterDetailSchemas.ts:260-265` สร้างช่องติ๊กที่ `:724`) ดู [[term-chart-of-account]]

## ข้อควรระวัง
- ป้ายเรียกไม่ตรงกัน: บนเอกสารเรียก `side` ว่า "ฝ่าย" แต่จอ master และผังบัญชีเรียกว่า "หน่วยงาน" ทั้งสองคำหมายถึง `side_code` / `erp_side_list` เดียวกัน
- ช่อง "แผนก/สาขา:" มีสองกล่องในแถวเดียว กล่องแรก (placeholder "แผนก") ผูกกับ `departmentCode` → `department_code` ค้นหาจาก `erp_department_list` กล่องที่สอง (placeholder "สาขา") ผูกกับ `branchCode` → `branch_code` ค้นหาจาก `erp_branch_list` (`TransTopForm.tsx:694`, `:711`, `:734`, `:751`; `UniversalTransScreen.tsx:3265`, `:3275`) แสดงเมื่อรุ่นที่ใช้เปิด `hasDepartmentAndBranch` (`TransTopForm.tsx:689`, `:729`) ส่วนช่อง "แผนก:" ของเอกสารยอดเงินที่หัวเอกสารมีเฉพาะ `departmentCode` (`:609`) เรื่องสาขาดู [[term-tax-id-branch]]
- bcMenu.json มีเมนู "กำหนดการจัดสรร" สองรายการ คือ `menu_setup_allocate` (:1321-1322) และ `menu_setup_Allocate` (ตัว A ใหญ่, :1348-1349)

## ลิงก์
[[proc-master-data]] · [[term-chart-of-account]] · [[term-tax-id-branch]] · [[glossary-overview]]

## ที่มาในโค้ด
- `backend/internal/application/process/trans.go:112-113`, `:136-139`, `:166-171`, `:668`, `:1169-1171`
- `frontend/account/transaction/TransTopForm.tsx:563`, `:566`, `:576`, `:586`, `:596`, `:606`, `:609`, `:636`, `:689`, `:691`, `:694`, `:711`, `:729`, `:731`, `:734`, `:751`
- `frontend/account/transaction/TransExtraTabs.tsx:204-252`, `:414`, `:435`, `:456`
- `frontend/account/transaction/UniversalTransScreen.tsx:3250-3251`, `:3265`, `:3275`
- `frontend/src/config/schemas/icMasterSchemas.ts:491-495`, `:807-830`
- `frontend/src/config/schemas/masterDetailSchemas.ts:260-265`, `:724`
- `frontend/src/config/bcMenu.json:1282-1283`, `:1295-1296`, `:1308-1309`, `:1321-1322`, `:1348-1349`
