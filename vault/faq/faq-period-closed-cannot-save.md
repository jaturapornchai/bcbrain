---
title: "บันทึก/แก้/ลบเอกสารไม่ได้ ขึ้นว่า \"ได้ถูกปิดงวดไปแล้ว หรือยังไม่ได้กำหนดงวดบัญชี\" แก้อย่างไร"
tags: [faq, period, validation, gl]
aliases: ["ปิดงวดแล้วบันทึกไม่ได้", "ยังไม่ได้กำหนดงวดบัญชี", "period closed", "erp_account_period", "checkOpenPeriod", "กำหนดงวดบัญชี 1.8.1", "menu_account_period", "status 1 ปิดงวด"]
sources: ["backend/internal/application/process/period.go:17", "backend/internal/application/process/period.go:35", "backend/internal/application/process/period.go:53", "backend/internal/application/process/period.go:109", "backend/internal/application/process/trans_validate.go:44", "backend/internal/application/process/gl_template.go:1027", "frontend/src/config/schemas/masterDetailSchemas.ts:1563"]
---
# บันทึก/แก้/ลบเอกสารไม่ได้ ขึ้นว่า "ได้ถูกปิดงวดไปแล้ว หรือยังไม่ได้กำหนดงวดบัญชี" แก้อย่างไร

**ตอบสั้น:** วันที่เอกสารต้องอยู่ในงวดของ `erp_account_period` และงวดนั้นต้องมี `status` = 0 (เปิด) ถ้าไม่พบงวดหรืองวดปิด (1) ระบบปฏิเสธด้วยข้อความเดียวกัน แก้โดยเพิ่มงวด หรือเปลี่ยนสถานะงวดเป็นเปิดที่เมนู 1.8.1 กำหนดงวดบัญชี

## รายละเอียด
ข้อความเต็ม: "วันที่เอกสาร dd/mm/yyyy ได้ถูกปิดงวดไปแล้ว หรือยังไม่ได้กำหนดงวดบัญชี กรุณาตรวจสอบ" ถ้าไม่ส่งวันที่ ระบบใช้วันนี้และขึ้นว่า "วันที่ปัจจุบัน" แทน ดู [[acc-period-close]] และ [[term-account-period]]

**วิธีหางวด (`readPeriodStatus`)** เลือกแถวแรกที่ `date_start` ≤ วันที่ ≤ `date_end` เรียงตาม `period_number`, `roworder` ([[tbl-erp-account-period]]) วันที่รูปแบบผิด → "รูปแบบวันที่ไม่ถูกต้อง"

**จุดที่ตรวจ**

| งาน | ตรวจวันที่ไหน | ฟังก์ชัน |
|---|---|---|
| บันทึกเอกสารซื้อ/ขาย/คลัง | วันที่ใหม่ (ยกเว้น 521/522/523) | `checkOpenPeriod` |
| ลบเอกสาร | วันที่ที่เก็บไว้ในเอกสารเดิม | `checkStoredDocPeriod` |
| ยกเลิกเอกสาร | วันที่เอกสารเดิม + วันที่ยกเลิก (ยกเลิกการยกเลิก = วันที่ของใบยกเลิก) | `checkCancelPeriod` |
| JV / เอกสารเจ้าหนี้-ลูกหนี้ | บันทึก/ลบ | `checkSaveDocPeriod`, `checkDeleteDocPeriod` |
| ขายสินทรัพย์ 1802 | วันที่ใหม่, วันที่เดิมตอนแก้, วันที่ตอนลบ | `fa_sale.go` |
| ค่าเสื่อม 1801 | บันทึกไม่ตรวจ, ลบตรวจแบบผ่อน (ไม่พบงวด = ผ่าน) | `checkPeriodNotClosed` |

**วิธีแก้**
1. เปิดเมนู 1.8.1 กำหนดงวดบัญชี (`menu_account_period`) ตรวจว่ามีงวดครอบวันที่เอกสาร ใช้ปุ่ม "คำนวณงวดบัญชีอัตโนมัติ (12 งวด)" ได้
2. ถ้างวดเป็น "1. ปิดงวดบัญชี (Closed)" และต้องการแก้จริง ให้เปลี่ยนเป็น "0. เปิดใช้งาน (Open)" ชั่วคราว แล้วปิดกลับ
3. งวดซ้อนกัน: ระบบใช้แถวที่ `period_number` น้อยสุด ตรวจให้ไม่มีช่วงวันที่ทับกัน

## ข้อควรระวัง
- การปิดงวดคือแก้ `status` ด้วยมือที่หน้าจอนี้ ไม่มีงาน "ปิดงวด" แยก งานประมวลผลสิ้นงวด/สิ้นปีไม่ได้เปลี่ยน status ([[faq-year-end-close]])
- เช็ค (`cb_chq_list`) ไม่มีการตรวจงวด (คอมเมนต์ `period.go:107-108`)
- GL เส้นมาตรฐานหางวดโดยไม่ดู status ถ้าไม่พบงวดใส่ `period_number` = 0 (`service.go:1586-1598`)
- GL ตามรูปแบบ: ถ้าไม่พบงวดหรืองวดปิด จะไม่ลงบัญชีตามรูปแบบเลย (0 บรรทัด) และขึ้นคำเตือน "ไม่พบงวดบัญชีที่เปิดอยู่ของวันที่ ..." เรื่องนี้เกิดได้ตอน rebuild GL ย้อนหลัง ([[faq-gl-rebuild-when]])
- หน้าจอเอกสารทั่วไปตรวจเฉพาะวันที่ใหม่ตอนบันทึก (`trans_validate.go:44`)

## ดูเพิ่ม
- [[acc-period-close]]
- [[flow-period-year-close]]
- [[faq-year-end-close]]
- [[faq-cancel-vs-edit-vs-delete]]
- [[faq-cannot-delete-document]]

## ที่มาในโค้ด
- `backend/internal/application/process/period.go:17` `checkOpenPeriod`; `:27` `checkPeriodNotClosed`
- `backend/internal/application/process/period.go:35` `readPeriodStatus` (SQL `:40-42`)
- `backend/internal/application/process/period.go:53` `periodError` ข้อความ `:61`
- `backend/internal/application/process/period.go:68` `checkStoredDocPeriod`; `:95` `checkCancelPeriod`
- `backend/internal/application/process/period.go:109` `checkSaveDocPeriod`; `:116` `checkDeleteDocPeriod`; `:128` `periodExemptFlags`
- `backend/internal/application/process/trans_validate.go:44` บันทึก; `:106` ลบ
- `backend/internal/application/process/fa_sale.go:422` ลบ; `:431` วันที่ใหม่; `:448` วันที่เดิม
- `backend/internal/application/process/fa_depreciation.go:877` ลบค่าเสื่อม
- `backend/internal/application/process/gl_template.go:1027` GL ตามรูปแบบ ข้ามงวดปิด
- `frontend/src/config/schemas/masterDetailSchemas.ts:1563` `menu_account_period` (status `:1591-1592`)
