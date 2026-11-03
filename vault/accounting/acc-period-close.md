---
title: "งวดบัญชีและด่านตรวจงวดปิด (Accounting Period Guard)"
tags: [accounting, period, period-close, validation, gl]
aliases: ["งวดบัญชี", "ปิดงวด", "งวดปิด", "erp_account_period", "ได้ถูกปิดงวดไปแล้ว", "ยังไม่ได้กำหนดงวดบัญชี", "checkOpenPeriod", "period_number"]
sources: ["backend/internal/application/process/period.go:17", "backend/internal/application/process/period.go:27", "backend/internal/application/process/period.go:35", "backend/internal/application/process/period.go:53", "backend/internal/application/process/period.go:68", "backend/internal/application/process/period.go:95", "backend/internal/application/process/period.go:107", "backend/internal/application/process/period.go:128", "backend/internal/application/process/period.go:131", "backend/internal/application/process/trans_validate.go:44", "backend/internal/application/process/trans_validate.go:106", "backend/internal/application/process/docs.go:149", "backend/internal/application/process/docs.go:172", "backend/internal/application/process/doc_cancel.go:143", "backend/internal/application/process/fa_sale.go:422", "backend/internal/application/process/fa_depreciation.go:793", "backend/internal/application/process/fa_depreciation.go:877", "backend/internal/application/process/gl_template.go:1027", "backend/internal/application/process/service.go:1588"]
---

# งวดบัญชีและด่านตรวจงวดปิด

งวดบัญชีอยู่ในตาราง `erp_account_period` (ช่วง `date_start`..`date_end`, `status` 0 = เปิด) ด่านตรวจงวดอยู่ที่ period.go เดียว และถูกเรียกจากการบันทึก/ลบ/ยกเลิกเอกสารแต่ละชนิด แต่ไม่ครบทุกเส้นทาง การลง GL เองก็มีพฤติกรรมต่างกันระหว่าง template กับ standard

## ทำงานอย่างไร

### หางวดของวันที่ (`readPeriodStatus` period.go:35)
- `SELECT status FROM erp_account_period WHERE <วันที่> BETWEEN date_start AND date_end ORDER BY period_number, roworder LIMIT 1`
- วันที่ว่าง = `CURRENT_DATE`; รูปแบบวันที่ผิด = "รูปแบบวันที่ไม่ถูกต้อง"

### ด่านสองแบบ
- `checkOpenPeriod` (:17, port จาก C# `_checkOpenPeriod`): ต้อง**พบงวด**และ status = 0 มิฉะนั้น error
- `checkPeriodNotClosed` (:27): ไม่พบงวดผ่านได้ ปฏิเสธเฉพาะงวดที่ปิด (ใช้กับการลบค่าเสื่อม)
- ข้อความเดียวทั้งสองกรณี (`periodError` :53): "วันที่เอกสาร dd/mm/yyyy ได้ถูกปิดงวดไปแล้ว หรือยังไม่ได้กำหนดงวดบัญชี ..." (วันที่ว่างใช้คำว่า "วันที่ปัจจุบัน")
- `checkStoredDocPeriod` (:68): ตรวจด้วย `doc_date` ที่เก็บในตาราง (ตอนลบ); ไม่พบเอกสารผ่านได้ ให้ผู้เรียกแจ้ง not-found

### ใครเรียก
| เส้นทาง | บันทึก | ลบ |
|---|---|---|
| SaveTrans / DeleteTrans (`ic_trans`) | `checkTransScreenSave` trans_validate.go:44 ตรวจวันที่ใหม่ | `checkTransScreenDelete` :106 ตรวจวันที่ที่เก็บ |
| SaveDoc / DeleteDoc สมุดรายวัน (flag 0, 1999) และ `ap_ar_trans` | `checkSaveDocPeriod` docs.go:149 | `checkDeleteDocPeriod` docs.go:172 |
| ยกเลิกเอกสาร (doc/cancel) | `checkCancelPeriod` doc_cancel.go:143 ตรวจทั้งวันที่ต้นฉบับและวันที่ใบยกเลิก; undo ตรวจวันที่ใบยกเลิกที่เก็บ | |
| ขายสินทรัพย์ 1802 | fa_sale.go:431 วันที่ใหม่ และ :448 วันที่เดิมเมื่อแก้ไข | fa_sale.go:422 |
| ค่าเสื่อม 1801 | **ไม่ตรวจ** (comment fa_depreciation.go:793 ตาม C#) | `checkPeriodNotClosed` :877 |

### ข้อยกเว้น
- `periodExemptFlags` (:128) = 521, 522, 523 (คลังรับฝาก ฝาก/เบิก/รับคืนจากเบิก) บันทึกโดยไม่ตรวจงวด แต่การลบยังตรวจ (comment :126-127)
- `checkSaveDocPeriod` ตรวจเฉพาะ kind สมุดรายวันและ ap_ar ส่วนทะเบียนเช็คไม่มีด่าน (comment :107-108) ดู [[acc-cheque-transfer]]
- เอกสาร 54 สต็อกยกมาบันทึกผ่านเส้นทางของตัวเอง ไม่พบการเรียกด่านงวดใน stock_beginning.go ดู [[acc-stock-special-docs]]

### งวดในการลง GL
- template (gl_template.go:1027): หางวดด้วย `ORDER BY roworder` ถ้าไม่พบหรือ status ≠ 0 จะไม่ลง GL ของเอกสารนั้น (handled แต่ 0 บรรทัด) และคืนคำเตือน "ไม่พบงวดบัญชีที่เปิดอยู่..." ดู [[acc-gl-template-engine]]
- standard (service.go:1588): หา `period_number` / `period_year` โดย**ไม่ดู status** ไม่พบงวดได้ 0 (comment ตาม C#) จึงลง GL ในงวดปิดได้ ดู [[acc-gl-posting-standard]]

## จุดเสี่ยง
- **ค่าเสื่อม 1801 และ 54 บันทึกลงงวดที่ปิดแล้วได้**
- **rebuild GL แบบ standard ไม่ดูสถานะงวด** ขณะที่ template ข้ามเอกสารในงวดปิด ผล rebuild จึงต่างกันตามชนิดการลง GL
- ลำดับหางวดต่างกัน: ด่านตรวจใช้ `period_number, roworder` แต่การลง GL ใช้ `roworder` ถ้ามีงวดซ้อนทับกันอาจได้คนละงวด
- SaveTrans ตรวจเฉพาะวันที่ใหม่ ไม่พบการตรวจวันที่เดิมของเอกสารที่แก้ไขใน `checkTransScreenSave` (เส้นทางอื่นยังไม่ยืนยัน) ต่างจาก 1802 ที่ตรวจทั้งสองวัน

## ที่มาในโค้ด
- `backend/internal/application/process/period.go:17` checkOpenPeriod
- `backend/internal/application/process/period.go:27` checkPeriodNotClosed
- `backend/internal/application/process/period.go:35` readPeriodStatus
- `backend/internal/application/process/period.go:95` checkCancelPeriod
- `backend/internal/application/process/period.go:109` checkSaveDocPeriod
- `backend/internal/application/process/period.go:128` periodExemptFlags
- `backend/internal/application/process/trans_validate.go:44` ด่านตอนบันทึก ic_trans
- `backend/internal/application/process/gl_template.go:1027` template ข้ามงวดปิด
- `backend/internal/application/process/service.go:1588` standard GL หางวดไม่ดู status

## ดูเพิ่ม
- [[acc-transaction-save-flow]]
- [[acc-transaction-delete-edit]]
- [[acc-gl-rebuild]]
- [[acc-fixed-asset-depreciation]]
- [[acc-fixed-asset-sale]]
- [[accounting-overview]]
