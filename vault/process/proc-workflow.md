---
title: "กลุ่ม route workflow เมนูกระบวนการระบบ (Workflow Menus)"
tags: [process, workflow, handler, audit, log, helper]
aliases: ["workflow/{action}", "Workflow handler", "withTx", "writeProcessLog", "columnExists", "audit-list", "AuditList", "menu_audit_trans", "กระบวนการระบบ", "ตรวจสอบ log", "logs", "master_logs"]
sources: ["backend/internal/adapter/inbound/http/process/workflow_handler.go:18", "backend/internal/adapter/inbound/http/process/workflow_handler.go:38", "backend/internal/adapter/inbound/http/process/workflow_handler.go:159", "backend/internal/adapter/inbound/http/process/permission.go:36", "backend/internal/adapter/inbound/http/process/permission.go:96", "backend/internal/adapter/inbound/http/process/permission.go:130", "backend/internal/application/process/workflow.go:28", "backend/internal/application/process/workflow.go:65", "backend/internal/application/process/workflow.go:77", "backend/internal/application/process/workflow.go:936", "backend/internal/application/process/workflow.go:976", "backend/internal/adapter/inbound/http/router.go:164"]
---

# กลุ่ม route workflow เมนูกระบวนการระบบ (Workflow Menus)

`POST /process/workflow/{action}` (และ `/api/v1/process/workflow/{action}`) เป็น route รวมของ "เมนูกระบวนการ" ที่พอร์ตมาจาก BC Account (C#): เปลี่ยนรหัส, ผ่านรายการบัญชี, ตรวจข้อมูล, ปิดงวด/ปิดปี, ดู log ตรวจสอบ, ตัดค่าเสื่อมสินทรัพย์, เครื่องมือระบบ, โหลดจังหวัด และผู้ช่วย AI handler ตัวเดียวคือ `Handler.Workflow` ใช้ `switch` ตาม `{action}` (ไม่ใช้ helper `serve` แบบกลุ่มอื่น) ดู [[proc-dispatcher]]

## ทำงานอย่างไร

### รูปแบบของ handler (`workflow_handler.go:18-37,165-175`)
- ต้องมี token ที่ผ่าน middleware (ไม่มี = 401) และอ่าน `ProviderCode`, `DatabaseName`, `Username` จาก claims เสมอ (ใส่ใน input ฟิลด์ `json:"-"` ไม่รับจาก body)
- อ่าน body เป็น JSON จำกัด 1 MiB (`MaxBytesReader 1<<20`); action `province-list` ไม่ต้องมี body
- สำเร็จ: ตอบ `{"ok": true, "data": ...}`; พลาด: log เตือน (`process/workflow failed` พร้อม action และ user) แล้วตอบ error; action ที่ไม่รู้จัก = 404 "unknown workflow action"

### ตาราง action ทั้งหมด (สิทธิ์จาก `permission.go`)
| action | สิทธิ์ | อยู่ใน | โน้ต |
|---|---|---|---|
| `change-code` | Admin | `workflow.go:230` | [[proc-change-code]] |
| `audit-list` | Admin | `workflow.go:976` | หัวข้อ "หน้าจอตรวจสอบ log" ด้านล่าง |
| `check-ic-trans` | read ถ้า `apply=false` นอกนั้น Admin | `sysproc_tools.go:47` | [[proc-sysproc-tools]] |
| `point-recal` | write | `sysproc_tools.go:152` | [[proc-sysproc-tools]] |
| `import-transport-label` | write | `sysproc_tools.go:219` | [[proc-sysproc-tools]] |
| `province-list` | read | `province_load.go:68` | [[proc-province-load]] |
| `province-load` | write | `province_load.go:176` | [[proc-province-load]] |
| `ai-report-sql`, `ai-report-analyze`, `ai-bank-reconcile`, `ai-audit-copilot`, `ai-smart-reorder`, `ai-auto-gl` | Admin (`permission.go:132`) | `ai_copilot.go` | [[proc-ai-copilot]] |
| `journal-list` (read), `journal-pass` (write), `gl-check` (read), `gl-close` (Admin) | ตามวงเล็บ | `workflow.go:442,480,554,817` | กลุ่มบัญชีแยกประเภท (นอกขอบเขตโน้ตชุดนี้ ดู [[accounting-overview]]) รายละเอียด request/response อยู่ที่ [[api-proc-actions-gl]] ฝั่งหน้าจอ (เมนูผ่านรายการ/ยกเลิกผ่านรายการ/ตรวจสอบความถูกต้อง) อยู่ที่ [[scr-system-process-workbench]] |
| `fa-depreciation`, `asset-sale` | write หรือ del ตาม body (`delete`/`op`) | `fa_depreciation.go:794`, `fa_sale.go:382` | กลุ่มสินทรัพย์ถาวร (นอกขอบเขตโน้ตชุดนี้) |

สิทธิ์ทั้งหมดอธิบายที่ [[proc-permission-rights]]

### ตัวช่วยร่วมใน `workflow.go` (ใช้ซ้ำทั่วทั้งกลุ่ม process)
- `withTx` (:28): เปิด transaction บนฐานข้อมูลบริษัท (`companyPool`) หมดเวลา 120 วินาที commit เมื่อ `fn` สำเร็จ ไม่เช่นนั้น rollback
- `writeProcessLog` (:65): INSERT ลงตาราง `logs` ตามแบบ C# `_createLog`: `function_type = 2`, `function_code = 2` (Update), `computer_name = 'WEB'`, `guid` สุ่ม 32 ตัวอักษร, ตัดความยาว `menu_name` 100, `user_code` 35, `doc_no` 100, `data1` (JSON รายละเอียด) 5000 เพื่อให้เมนูตรวจสอบรายการ (`menu_audit_trans`) เห็นว่าใครรันกระบวนการ ใช้โดย [[proc-hidden-cost]], [[proc-sysproc-tools]], [[proc-province-load]] ฯลฯ
- `writeMasterLog` (:350): ลง `master_logs` สำหรับการเปลี่ยนรหัส ดู [[proc-change-code]]
- `columnExists` (:77): เช็ก `information_schema.columns` ใน schema ปัจจุบัน -- ใช้ข้ามตารางที่ฐานลูกค้าไม่มี
- `validDate` (:86) ตรวจ `YYYY-MM-DD`; `clip` ตัดตามจำนวนตัวอักษร (rune); `newGUID` สร้างรหัส hex 32 ตัวอักษร (เทียบ `Guid.ToString("N")`)

### หน้าจอตรวจสอบ log (`audit-list`, `AuditList` :976)
- Input: `kind` (`login` | `menu` | `trans` | `master` | `full`), `dateFrom`, `dateTo` (`YYYY-MM-DD` บังคับ), `search` (ไม่เกิน 100 ตัวอักษร)
- แต่ละ `kind` มี SELECT คงที่ใน `auditQueries` (`workflow.go:957-973`):
  - `login`: ตาราง `logs` ที่ `function_type = 0`
  - `menu`: `logs` ที่ `function_type = 1`
  - `trans`: `logs` ที่ `function_type = 2` (ได้ log จากกระบวนการต่าง ๆ รวมเอกสาร)
  - `master`: `master_logs` (แปลง `data2`/`data1` เป็นข้อความ UTF-8 เป็นข้อมูลเก่า/ใหม่)
  - `full`: ตาราง `erp_logs`; ถ้าฐานนี้ไม่มี `erp_logs.doc_no` ตอบ `note` ว่า BC เก็บไว้ในฐานข้อมูล logs แยก ไม่มีแถว
- ค้นหา `search` เป็น `ILIKE %คำ%` (escape `\ % _` ก่อน) บนคอลัมน์ที่กำหนดต่อ kind (ผู้ใช้, เครื่อง, เมนู, เลขเอกสาร, รหัส)
- เรียง `date_time DESC` จำกัด 5000 แถว; ผลเป็น `columns[]` ตามลำดับ SELECT และ `rows[]` แผนที่คอลัมน์ -> ข้อความ (`scanStringRows`)
- สิทธิ์ Admin เพราะ log มีข้อมูลทุกผู้ใช้

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/process/workflow_handler.go:18-176` - `Workflow` (case ละ action: `:38` change-code ... `:159` ai-auto-gl)
- `backend/internal/adapter/inbound/http/router.go:164,205` - ผูก `/workflow/{action}` ในกลุ่ม route ของ `/process` และ `/api/v1/process`
- `backend/internal/adapter/inbound/http/process/permission.go:36,45,50,51,96-122,130` - สิทธิ์ต่อ action
- `backend/internal/application/process/workflow.go:25-89` - ตัวช่วยร่วม
- `backend/internal/application/process/workflow.go:936-1017` - `AuditList` และ `auditQueries`

## ดูเพิ่ม
- [[proc-change-code]]
- [[proc-sysproc-tools]]
- [[proc-province-load]]
- [[proc-ai-copilot]]
- [[proc-hidden-cost]]
- [[proc-dispatcher]]
- [[proc-permission-rights]]
- [[process-overview]]
