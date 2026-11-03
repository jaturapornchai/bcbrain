---
title: "งวดบัญชี ปิดงวด/ปิดปี และประมวลผล GL ใหม่ (Period & Year Close, GL Rebuild)"
tags: [flows, close]
aliases: ["ปิดงวด", "ปิดบัญชีสิ้นปี", "งวดบัญชี", "ประมวลผล GL ใหม่", "period close"]
sources: ["backend/internal/application/process/period.go:17", "backend/internal/application/process/workflow.go:817", "backend/internal/application/process/service.go:1297", "backend/internal/application/process/master_detail_specs.go:473", "frontend/account/process/SystemProcessWorkbenchScreen.tsx:530"]
---
# งวดบัญชี ปิดงวด/ปิดปี และประมวลผล GL ใหม่ (Period & Year Close, GL Rebuild)

ในโค้ดมี 3 เรื่องที่คนบัญชีเรียกรวมว่า "ปิดงวด" ซึ่งแยกกันจริง:
1. สถานะงวดใน `erp_account_period` ใช้กันบันทึก/ลบ/ยกเลิกย้อนหลัง
2. รายการปิดบัญชีรายได้-ค่าใช้จ่าย (`GLClose`, flag 1998/1999)
3. ประมวลผล GL ใหม่ (`RebuildGL`)

ดู [[acc-period-close]] และ [[acc-gl-rebuild]]

## ภาพรวม

```mermaid
flowchart TD
  P["กำหนดงวด menu_account_period → erp_account_period (status 0 = เปิด)"] --> G{"checkOpenPeriod ทุกครั้งที่บันทึก/ลบ/ยกเลิก"}
  G -->|"เปิด"| SAVE["บันทึกเอกสาร → GL อัตโนมัติ"]
  G -->|"ปิด/ไม่พบงวด"| ERR["ปฏิเสธ: ได้ถูกปิดงวดไปแล้ว หรือยังไม่ได้กำหนดงวดบัญชี"]
  SAVE --> PASS["ผ่านรายการ (journal-pass) is_pass"]
  SAVE --> CHK["ตรวจความถูกต้อง GL (gl-check)"]
  CHK --> CLOSE["ปิดรายได้/ค่าใช้จ่าย gl-close: period=1998 / year=1999"]
  SAVE --> RB["ประมวลผล GL ใหม่ /gl/rebuild"]
  P -.->|"เปลี่ยน status เป็นปิดด้วยมือ (ไม่มีฟังก์ชันปิดงวดอัตโนมัติ)"| P
```

## ขั้นตอน

| ขั้น | เอกสาร/หน้าจอ | ตารางที่เขียน | ผลบัญชี | path:line |
|---|---|---|---|---|
| 1 | กำหนดงวดบัญชี `menu_account_period` | [[tbl-erp-account-period]] (`date_start`, `date_end`, `period_number`, `status`) | ไม่มีผลบัญชี · status 0 = เปิด ค่าอื่น = ปิด | `backend/internal/application/process/master_detail_specs.go:473-480`, `backend/internal/application/process/period.go:35-49` |
| 2 | ทุกการบันทึก/ลบ/ยกเลิก | — | ต้องพบงวดแรกที่ครอบวันที่และ status 0 | `backend/internal/application/process/period.go:17`, `:68`, `:95`, `:109`, `:116` |
| 3 | ผ่านรายการบัญชี (workflow `journal-pass`) หน้าจอประมวลผลระบบโหมด `gl_journal_pass` เมนู 9009 ผ่านรายการ / 9022 ยกเลิกผ่านรายการ: ดึงรายการด้วย `journal-list` แล้วติ๊กรายใบ [[scr-system-process-workbench]] | [[tbl-gl-journal]] `is_pass` | ทำเครื่องหมายผ่านรายการ (ใบที่ไม่พบผังบัญชี / ผังผิดประเภท / ยอดไม่ Balance ผ่านรายการไม่ได้) | `backend/internal/application/process/workflow.go:442`, `:480`, `backend/internal/adapter/inbound/http/process/workflow_handler.go:52`, `frontend/account/process/SystemProcessWorkbenchScreen.tsx:425-446`, `:666-674` |
| 4 | ตรวจสอบ GL (workflow `gl-check`) หน้าจอประมวลผลระบบโหมด `gl_journal_pass` เมนู 9008 ปุ่ม "เริ่มตรวจสอบ" [[scr-system-process-workbench]] | อ่านอย่างเดียว (ซิงก์เฉพาะ `journal_type` ของรายละเอียด) | ตรวจความถูกต้อง 8 ข้อ | `backend/internal/application/process/workflow.go:554`, `backend/internal/adapter/inbound/http/process/workflow_handler.go:59`, `frontend/account/process/SystemProcessWorkbenchScreen.tsx:657-665` |
| 5 | ปิดรายได้-ค่าใช้จ่าย (workflow `gl-close`) โหมด `period` → 1998 / `year` → 1999 (หน้าจอประมวลผลระบบ `gl_close_period`) | `gl_trans`, `gl_trans_detail`, [[tbl-gl-journal]], [[tbl-gl-journal-detail]] (journal_type 2) | กลับยอดบัญชี account_type 3,4 ทุกตัวในช่วงวันที่ แล้วลงผลต่าง (กำไร = Cr − Dr) เข้าบัญชีที่ผู้ใช้เลือก (`close_to_account`) · ไม่มีรหัสกำไรสะสมตายตัว | `backend/internal/application/process/workflow.go:766-771`, `:791-812`, `:817-818`, `:891`, `frontend/account/process/SystemProcessWorkbenchScreen.tsx:530-563` |
| 6 | บันทึกปิดซ้ำเลขเดิม | ตารางเดียวกับขั้น 5 | ลบเอกสารปิดเลขเดิม (doc_no + flag) ใน 4 ตารางก่อน แล้วคำนวณใหม่ใน transaction เดียว | `backend/internal/application/process/workflow.go:846`, `:855` |
| 7 | ประมวลผล GL ใหม่ `/api/v1/process/gl/rebuild` (หน้าจอประมวลผลระบบ) | [[tbl-gl-journal]], [[tbl-gl-journal-detail]] | ลบ GL อัตโนมัติ (`trans_direct<>1`) แล้วสร้างใหม่จากเอกสารที่ `is_cancel=0` (template ก่อน ไม่มีจึงใช้สูตรมาตรฐาน) แล้วสร้างรายการกลับของเอกสารยกเลิก | `backend/internal/application/process/service.go:1297`, `:1378`, `:1413-1440`, `:1480-1496`, `:1678`, `backend/internal/adapter/inbound/http/router.go:172`, `frontend/account/process/SystemProcessWorkbenchScreen.tsx:652` |

ระหว่าง rebuild ระบบล็อก `gl_journal:rebuild` และเอกสารที่ลง GL ด้วยมือ (`trans_direct=1`) จะไม่ถูกสร้างใหม่เลย (`service.go:1481-1482`, `:1496`) เช่น สมุดรายวันทั่วไป, ค่าเสื่อม 1801, ขายสินทรัพย์ 1802 ดู [[flow-fixed-asset-lifecycle]]

## จุดตรวจสอบ/validation

- `checkOpenPeriod` (`period.go:17`): ไม่พบงวดหรือ status ≠ 0 จะปฏิเสธ วันที่ว่าง = วันนี้
- `checkPeriodNotClosed` (`period.go:27`): ผ่อนปรน ใช้กับการลบค่าเสื่อม ไม่พบงวดก็ผ่าน
- ข้อยกเว้น:
  - คลังฝากขาย 521/522/523 บันทึกได้โดยไม่ตรวจงวด แต่การลบยังตรวจ (`period.go:126-128`)
  - สมุดรายวันมือใช้ flag 0/1999 (`period.go:130-131`)
- `GLClose` ตรวจว่า (`workflow.go:818-821`, `:834-835`, `:868-884`):
  - mode ต้องเป็น period หรือ year
  - ต้องมีเลขที่เอกสาร ≤25 ตัว สมุดรายวัน และบัญชีที่ปิดเข้า
  - บัญชีที่ปิดเข้าต้องเป็นบัญชีย่อย
  - เลขที่เอกสารต้องไม่ถูกใช้กับเอกสารอื่น
- `RebuildGL` มาตรฐานอ่าน `period_number` จากงวด (ไม่พบ = 0) แต่ไม่ตรวจว่างวดปิดแล้ว (`service.go:1585-1598`)
- template ที่ Dr ≠ Cr จะถูกข้ามพร้อมคำเตือน ไม่ทำให้ทั้ง rebuild ล้ม (`gl_template.go:1003`, `:1140`) ดู [[acc-gl-template-engine]]

## ข้อผิดพลาดที่พบบ่อยตามโค้ด

| ข้อความ/อาการ | สาเหตุ | path:line |
|---|---|---|
| "วันที่เอกสาร dd/mm/yyyy ได้ถูกปิดงวดไปแล้ว หรือยังไม่ได้กำหนดงวดบัญชี กรุณาตรวจสอบ" | งวดปิดหรือยังไม่สร้างงวดของปีนั้น | `backend/internal/application/process/period.go:53-61` |
| "ไม่พบงวดบัญชีของปี ..." | ปิดปีโดยยังไม่มีงวดของปี | `backend/internal/application/process/workflow.go:741` |
| "ไม่มียอดรายได้/ค่าใช้จ่ายในช่วงวันที่ ..." | ช่วงวันที่ไม่มียอด account_type 3,4 | `backend/internal/application/process/workflow.go:855` |
| "ไม่พบบัญชีที่ปิดเข้า ... (ต้องเป็นบัญชีย่อย)" | เลือกบัญชีคุมหรือรหัสไม่มี | `backend/internal/application/process/workflow.go:882` |

- ไม่มีฟังก์ชันปิดงวดที่เปลี่ยน status ให้อัตโนมัติ ต้องแก้ status ในจอกำหนดงวดเอง (ไม่พบในโค้ด)
- `GLClose` ไม่ตรวจงวดเปิด จึงบันทึกรายการปิดในงวดที่ปิดแล้วได้ (ไม่พบการเรียก `checkOpenPeriod` ใน `workflow.go:817-866`)
- flag 1999 ชนกัน 3 ความหมาย จึงควรระวังเวลา query ด้วย trans_flag:
  - รายการปิดสิ้นปี (`workflow.go:818`)
  - `flagJournalVat` = 1999 "บัญชี_ข้อมูลรายวัน" (`journaltax.go:17`)
  - อยู่ใน `journalFlags` ของสมุดรายวันมือ (`period.go:131`)
- `RebuildGL` สร้าง GL ใหม่ในงวดที่ปิดไปแล้วได้ ตัวเลขงบในงวดปิดจึงเปลี่ยนได้หลัง rebuild
- ยกเลิกเอกสารลงรายการกลับในวันที่ยกเลิก ดู [[flow-cancel-edit-reversal]]

## ที่มาในโค้ด

- `backend/internal/application/process/period.go:17-61`, `:68`, `:95`, `:109`, `:116`, `:126-131` — ตรวจงวด
- `backend/internal/application/process/master_detail_specs.go:473-480` — master งวดบัญชี
- `backend/internal/application/process/workflow.go:442`, `:480`, `:554`, `:741-749`, `:766-866`, `:868-891` — ผ่านรายการ ตรวจ GL ปิดงวด/ปี
- `backend/internal/application/process/service.go:1297`, `:1378`, `:1413-1496`, `:1585-1598`, `:1678` — ประมวลผล GL ใหม่
- `backend/internal/application/process/gl_template.go:1003`, `:1140` — template ไม่สมดุล
- `backend/internal/adapter/inbound/http/process/workflow_handler.go:52`, `:59`, `:66` — action `journal-pass`, `gl-check`, `gl-close`
- `frontend/account/process/SystemProcessWorkbenchScreen.tsx:530-563`, `:652` — จอปิดงวดและประมวลผล GL
