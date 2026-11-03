---
title: "API เวิร์กโฟลว์ระบบ (Process workflow actions: change-code, audit-list, import-transport-label, province-*, ai-audit-copilot และดัชนี 19 action)"
tags: [api, process, workflow]
aliases: ["/api/v1/process/workflow/{action}","/process/workflow/{action}","workflow","change-code","audit-list","import-transport-label","province-list","province-load","ai-audit-copilot"]
sources: ["backend/internal/adapter/inbound/http/router.go:164","backend/internal/adapter/inbound/http/process/workflow_handler.go:18","backend/internal/adapter/inbound/http/process/workflow_handler.go:38","backend/internal/adapter/inbound/http/process/workflow_handler.go:87","backend/internal/adapter/inbound/http/process/workflow_handler.go:108","backend/internal/adapter/inbound/http/process/workflow_handler.go:145","backend/internal/adapter/inbound/http/process/permission.go:24","backend/internal/application/process/workflow.go:230","backend/internal/application/process/workflow.go:976","backend/internal/application/process/sysproc_tools.go:219","backend/internal/application/process/province_load.go:176","backend/internal/application/process/ai_copilot.go:764","frontend/src/app/api/process/workflow/[action]/route.ts:12"]
---

# API เวิร์กโฟลว์ระบบ (`workflow/{action}`)

ประตูเดียว `POST /api/v1/process/workflow/{action}` (และ `/process/workflow/{action}`, router.go:164, 205) ของเมนู "ประมวลผล" แบบ BC: เปลี่ยนรหัส ผ่านรายการ ตรวจ GL ปิดงวด ค่าเสื่อม ประวัติการใช้งาน ฯลฯ รวม 19 action ใน `switch` เดียว (workflow_handler.go:37-166). ภาพรวมที่ [[api-process-run]]; แนวคิดที่ [[proc-workflow]], [[proc-sysproc-tools]], [[proc-change-code]], [[proc-province-load]], [[proc-ai-copilot]].

กติการ่วมของ handler (workflow_handler.go:18-36):
- ต้องมี claims ใน token มิฉะนั้น 401 "missing or invalid access token"
- บอดี้ถอดด้วย `MaxBytesReader` 1 MB (`1<<20`); เกิน/ผิดรูปแบบ = 400 "invalid request body"
- `ProviderCode`, `DatabaseName`, `UserCode`/`Username` เติมจาก claims ไม่รับจากบอดี้
- action ที่ไม่รู้จัก = 404 "unknown workflow action" (บรรทัด 162)
- สำเร็จ `{"ok":true,"data":...}` (บรรทัด 172-173 ท้ายฟังก์ชัน); ล้มเหลวเรียก `response.Error` (400/403/404/409/500 ตามชนิด error) และ log เตือนพร้อมชื่อ action
- Next: `src/app/api/process/workflow/[action]/route.ts:12-32` มี whitelist 19 ชื่อ (ไม่อยู่ใน list = 404 `NOT_FOUND` "ไม่พบคำสั่ง"); ผู้เรียกส่วนใหญ่ใช้ helper `workflow()` ใน `account/process/SystemProcessWorkbenchScreen.tsx:34-38`

## ดัชนี 19 action

| # | action | หน้าที่ย่อ | สิทธิ์ (permission.go) | บอดี้ | เอกสารละเอียด |
|---|---|---|---|---|---|
| 1 | `change-code` | เปลี่ยนรหัสหลัก (สินค้า/ลูกหนี้/เจ้าหนี้/ผังบัญชี) พร้อมที่อ้างอิง | Admin | 1 MB | เอกสารนี้ |
| 2 | `journal-list` | รายการใบสำคัญที่จะผ่านรายการ | Read | 1 MB | [[api-proc-actions-gl]] |
| 3 | `journal-pass` | ผ่านรายการ / ยกเลิกผ่านรายการ | Write | 1 MB | [[api-proc-actions-gl]] |
| 4 | `gl-check` | ตรวจ GL 8 ข้อ | Read | 1 MB | [[api-proc-actions-gl]] |
| 5 | `gl-close` | ปิดบัญชีสิ้นงวด/สิ้นปี | Admin | 1 MB | [[api-proc-actions-gl]] |
| 6 | `fa-depreciation` | โอนค่าเสื่อมสินทรัพย์ | Write; `delete:true` = Delete | 1 MB | [[api-proc-actions-gl]] |
| 7 | `asset-sale` | ขายสินทรัพย์ | preview=Read, delete=Delete, อื่น=Write | 1 MB | [[api-proc-actions-gl]] |
| 8 | `audit-list` | ประวัติการใช้งาน 5 แบบ | Admin | 1 MB | เอกสารนี้ |
| 9 | `check-ic-trans` | ตรวจ/ซ่อม ic_trans | `apply:false`=Read, `apply:true`=Admin | 1 MB | [[api-proc-actions-stock]] |
| 10 | `point-recal` | คำนวณคะแนนสะสมใหม่ | Write | 1 MB | [[api-proc-actions-stock]] |
| 11 | `import-transport-label` | สร้างแถวป้ายขนส่งของผู้ขาย/ลูกค้า | Write | 1 MB | เอกสารนี้ |
| 12 | `province-list` | รายการจังหวัดมาตรฐาน | Read | 1 MB | เอกสารนี้ |
| 13 | `province-load` | โหลดจังหวัด/อำเภอ/ตำบลลงฐาน | Write | 1 MB | เอกสารนี้ |
| 14 | `ai-report-sql` | คำสั่งภาษาไทย → SELECT อ่านอย่างเดียว | Admin (ไม่อยู่ใน routeRights) | 1 MB | [[api-proc-actions-report]] |
| 15 | `ai-report-analyze` | วิเคราะห์ผลรายงาน | Admin (ไม่อยู่ใน routeRights) | 1 MB | [[api-proc-actions-report]] |
| 16 | `ai-bank-reconcile` | จับคู่ statement ธนาคาร | Admin (ไม่อยู่ใน routeRights) | 1 MB | [[api-proc-actions-gl]] |
| 17 | `ai-audit-copilot` | ตรวจสอบก่อนปิดบัญชีแบบอ่านอย่างเดียว | Admin (ไม่อยู่ใน routeRights) | 1 MB | เอกสารนี้ |
| 18 | `ai-smart-reorder` | แนะนำสั่งซื้อซ้ำ | Admin (ไม่อยู่ใน routeRights) | 1 MB | [[api-proc-actions-stock]] |
| 19 | `ai-auto-gl` | เสนอรายการบัญชีจากคำอธิบาย | Admin (ไม่อยู่ใน routeRights) | 1 MB | [[api-proc-actions-gl]] |

ที่มาของสิทธิ์: `routeRights` ที่ permission.go:24-52 (`workflow/audit-list` admin :36, `workflow/gl-close` และ `workflow/change-code` admin :50, `workflow/point-recal`/`import-transport-label`/`province-load` write :51) และ `case` ที่ขึ้นกับบอดี้ที่ :96-127; route ที่ไม่อยู่ในตารางตกเป็น Admin (permission.go ท้าย `RequiredRight`) — จึงทำให้ 5 action `ai-*` ต้อง Admin.

## action ที่ document ที่นี่

| action | หน้าที่ | input สำคัญ | ตาราง | path:line |
|---|---|---|---|---|
| `workflow/change-code` | เปลี่ยนรหัสหลัก 1-500 คู่ในหนึ่ง transaction (A→B แล้ว B→C ทำตามลำดับเหมือนชุดคำสั่ง C#) และแก้ทุกตารางที่อ้างอิงรหัสนั้น | `kind` (item/customer/supplier/gl_account), `menuName`, `pairs[]:{oldCode,newCode}` | ตารางหลักตามชนิด + ตารางอ้างอิงที่ค้นจาก pg_constraint/pg_attribute; เขียน master_logs | workflow_handler.go:38 → workflow.go:230 |
| `workflow/audit-list` | ประวัติการใช้งาน 1 หน้าจอ อ่านอย่างเดียว ใหม่สุดก่อน ไม่เกิน 5000 แถว | `kind` (login/menu/trans/master/full), `dateFrom`, `dateTo`, `search` | logs, master_logs, erp_logs | :87 → workflow.go:976 |
| `workflow/import-transport-label` | คัดลอกผู้ขาย (`ap`) หรือลูกค้า (`ar`) ที่ยังไม่มีแถวป้ายขนส่งเข้าตาราง | `kind` (ap/ar) | ap_ar_transport_label | :108 → sysproc_tools.go:219 |
| `workflow/province-list` | รายการจังหวัดมาตรฐานสำหรับตารางติ๊ก (อ่านจากข้อมูลที่ฝังในไบนารี ไม่ใช้ DB) | `{}` | (ไม่มี) | :115 → province_load.go:68 |
| `workflow/province-load` | ต่อจังหวัดที่ติ๊ก: ลบแล้วใส่จังหวัด + อำเภอ + ตำบลใหม่ (รันซ้ำได้ผลเดิม) ในหนึ่ง transaction | `codes[]` | erp_province, erp_amper, erp_tambon | :117 → province_load.go:176 |
| `workflow/ai-audit-copilot` | ตรวจก่อนปิดบัญชีแบบอ่านอย่างเดียว ข้ามหน่วยขนาน สต็อก GL และ VAT (ไม่เรียก LLM) | `dateFrom`, `dateTo` | ic_opposite_unit, ic_inventory, gl_journal_detail | :145 → ai_copilot.go:764 |

## รายละเอียดรายตัว

### change-code

- **Request**: `{"kind":"item","menuName":"<menuKey>","pairs":[{"oldCode":"<oldCode>","newCode":"<newCode>"}]}`
- **Response 200**: `{"ok":true,"data":{"rows":[{"oldCode","newCode","name","tables":{"<table>":<rowsChanged>}}],"skippedTables":[...]}}` (workflow.go ChangeCodeResult)
- **Errors (400)** ข้อความไทยต่อแถว: ต้องระบุ 1-500 คู่ (workflow.go:206); แถวขาดรหัสเดิมหรือใหม่ (:214); รหัสยาวเกิน 50 ตัว (:216); รหัสใหม่เหมือนเดิม (:218); รหัสใหม่ซ้ำกันในรายการ (:220); `kind` ผิด (:233); ไม่พบรหัสเดิม (:258). **409**: รหัสใหม่มีอยู่แล้ว (:267) หรือเปลี่ยนในตารางหนึ่งไม่สำเร็จ (:280, :339)
- **ผู้เรียก**: `SystemProcessWorkbenchScreen.tsx:679` (ยืนยันด้วย `window.confirm` ก่อนส่ง)

### audit-list

- **Request**: `{"kind":"login","dateFrom":"2026-01-01","dateTo":"2026-01-31","search":"<text>"}`; `search` ใช้ `ILIKE` กับผู้ใช้/เครื่อง/เลขเอกสารตามชนิด (workflow.go:951-972)
- **Response 200**: `{"ok":true,"data":{"columns":[...],"rows":[{"<column>":"<text>"}],"note":"..."}}` — คอลัมน์เรียงตาม C#; ทุกค่าเป็นสตริง
- **ผู้เรียก**: `SystemProcessWorkbenchScreen.tsx:454` (`mode === "audit_log"`)

### import-transport-label และ province-*

- import-transport-label: ผลเป็นจำนวนแถวที่เพิ่ม; `kind` นอก ap/ar = 400. ผู้เรียก `SystemProcessWorkbenchScreen.tsx:714,716`
- province-list: คืน `[{"code","name","lat","lng"}]` เรียงตามรหัสจังหวัด; ผู้เรียก `account/master/ProvinceTreeScreen.tsx:900`
- province-load: ไม่เลือกจังหวัดเลย = 400 "กรุณาเลือกจังหวัดอย่างน้อย 1 ..." (province_load.go:116); รหัสที่ไม่พบในข้อมูลมาตรฐาน = 400 (:126); ผลเป็น `{"provinces":<n>,"amphurs":<n>,"tambons":<n>}`; ผู้เรียก `ProvinceTreeScreen.tsx:926`
- ตัวอย่าง:

```json
POST /api/v1/process/workflow/province-load     (Authorization: Bearer <token>)
{"codes":["<provinceCode1>","<provinceCode2>"]}
```

### ai-audit-copilot

- **Request**: `{"dateFrom":"2026-01-01","dateTo":"2026-12-31"}` (ทั้งสองฟิลด์ไม่บังคับ)
- **Response 200**: `{"ok":true,"data":{"scannedAt","healthScore","criticalCount","warningCount","passCount","findings":[{"severity":"CRITICAL|WARNING|PASS","category":"PARALLEL_UNIT|STOCK_COST|GL_BALANCE|TAX_VAT","code","title","detail","recommendation"}]}}` (ai_copilot.go:735-762)
- **ผู้เรียก**: `SystemProcessWorkbenchScreen.tsx:322`; ผู้ใช้ที่ไม่ใช่ Admin ได้ 403 (ดูดัชนี)

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/router.go:164,205` (route ทั้งสอง prefix)
- `backend/internal/adapter/inbound/http/process/workflow_handler.go:18-36` (decode ≤ 1 MB, scope), `37-166` (switch 19 action), `162` (default 404)
- `backend/internal/adapter/inbound/http/process/permission.go:24-52,96-127`
- `backend/internal/application/process/workflow.go:180-294` (ChangeCode), `939-1017` (AuditList และ auditQueries)
- `backend/internal/application/process/sysproc_tools.go:210-240`; `province_load.go:68-78,80-92,116,126,176-209`; `ai_copilot.go:735-762,764-902`
- `frontend/src/app/api/process/workflow/[action]/route.ts:10-34`
- `frontend/account/process/SystemProcessWorkbenchScreen.tsx:34-38,322,454,679,714,716`; `frontend/account/master/ProvinceTreeScreen.tsx:900,926`
