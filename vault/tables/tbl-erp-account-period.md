---
title: "erp_account_period — งวดบัญชี (เปิด/ปิดงวด)"
tags: [tables, erp, gl, period, company-db]
aliases: ["erp_account_period", "งวดบัญชี", "ปิดงวด", "period_number", "account period"]
sources: ["backend/internal/application/process/period.go:17", "backend/internal/application/process/period.go:40", "backend/internal/application/process/period.go:128", "backend/internal/application/process/master_detail_specs.go:473", "backend/internal/application/process/master_detail.go:683", "backend/internal/application/process/docs.go:278", "backend/internal/application/process/gl_template.go:1025", "backend/internal/application/process/service.go:1599", "backend/internal/application/process/workflow.go:727", "backend/internal/application/process/trans_validate.go:44", "backend/internal/application/process/stock_beginning.go:268", "backend/internal/application/process/fa_sale.go:422", "backend/internal/application/process/fa_depreciation.go:877", "backend/internal/domain/query/write_policy_legacy.go:17", "frontend/src/config/schemas/icMasterSchemas.ts:1051", "scripts/sql/02_data_schema.sql:2473"]
---

# erp_account_period — งวดบัญชี

กำหนดช่วงวันที่ของแต่ละงวดบัญชี + สถานะเปิด/ปิด ใช้กั้นไม่ให้บันทึก/แก้/ลบ/ยกเลิกเอกสารที่วันที่อยู่ในงวดที่ปิดแล้ว หรือวันที่ที่ยังไม่มีงวดครอบ และใช้หาเลขงวด/ปีบัญชีที่ใส่ลงสมุดรายวัน นิยามตาราง (DDL) อยู่ใน `scripts/sql/02_data_schema.sql:2473-2483` โค้ด Go ไม่ได้สร้างตารางนี้

## คอลัมน์
| คอลัมน์ | ความหมาย | ที่มา |
|---|---|---|
| `period_number` | integer — ลำดับงวด ใช้เรียงเพื่อหางวดแรกที่ครอบวันที่ | period.go:40-43; 02_data_schema.sql:2477 |
| `date_start`, `date_end` | date — วันเริ่ม/สิ้นสุดงวด (รวมทั้งสองวัน: `BETWEEN`) | period.go:41-42; 02_data_schema.sql:2478-2479 |
| `period_year` | smallint — ปีของงวด เก็บเป็น ค.ศ. ในฐาน (ตอนบันทึกสต็อกยกมา ปีบัญชีใน GL ตั้งเป็น ค.ศ. ให้ตรงกับค่านี้) | stock_beginning.go:268-269; 02_data_schema.sql:2481 |
| `status` | integer — 0 = เปิด, 1 = ปิด (สเปกหน้าจอรับเฉพาะ 0 หรือ 1); ค่าว่าง (NULL) ถือเป็น 0 ตอนตรวจ | master_detail_specs.go:477; period.go:40; 02_data_schema.sql:2480 |
| `roworder` | serial — ตัวตัดสินเมื่อมีหลายงวดครอบวันเดียวกัน (หลายจุดเรียง `ORDER BY roworder`) | docs.go:278; gl_template.go:1028; 02_data_schema.sql:2476 |

DDL ยังมีคอลัมน์ระบบ `ignore_sync`, `is_lock_record`, `create_date_time_now` (02_data_schema.sql:2474-2475, 2482) ซึ่งไม่พบว่าโค้ดที่อ้างถึงตารางนี้อ่านหรือเขียน

## กฎ `checkOpenPeriod` (period.go:17-23, 35-62)
- หางวดแรก (เรียง `period_number`, `roworder`) ที่วันที่เอกสารอยู่ในช่วง `date_start..date_end` — **ต้องมีงวด และ `status = 0`** ไม่เช่นนั้น error "…ได้ถูกปิดงวดไปแล้ว หรือยังไม่ได้กำหนดงวดบัญชี กรุณาตรวจสอบ" วันที่ว่างถือเป็นวันนี้ (period.go:40-43, 53-62)
- เอกสาร `trans_flag` 521 / 522 / 523 ได้รับการยกเว้นตอน **บันทึก** (`periodExemptFlags`, period.go:128; ใช้ที่ trans_validate.go:43-47) แต่ตอน **ลบ** ยังตรวจ (`checkTransScreenDelete`, trans_validate.go:95-106)
- ตอนลบ/ยกเลิก ตรวจงวดของ `doc_date` ที่เก็บอยู่ในเอกสารเดิม (`checkStoredDocPeriod`/`checkStoredPeriods`, period.go:68-90); การยกเลิกตรวจทั้งวันที่เดิมและวันที่เอกสารยกเลิก (`checkCancelPeriod`, period.go:95-106)
- ใบสมุดรายวัน และใบเจ้าหนี้/ลูกหนี้ ตรวจตอนบันทึกและลบ (period.go:109-124) ส่วนเช็ค (cheque) ไม่ตรวจ
- ขายสินทรัพย์ ตรวจทั้งบันทึก แก้ไข (วันที่เดิม) และลบ (fa_sale.go:422, 431, 448)
- ค่าเสื่อมราคาสินทรัพย์ **ไม่ตรวจ** ตอนบันทึก (ไม่มีการเรียก `checkOpenPeriod` ใน `FADepreciation`, fa_depreciation.go:792-795); ตอนลบใช้ตัวตรวจแบบหลวม `checkPeriodNotClosed` ที่ปฏิเสธเฉพาะงวดที่ปิด วันที่ที่ไม่มีงวดผ่านได้ (period.go:27-34; fa_depreciation.go:877)

## ตัวอื่นที่อ่านตารางนี้
- ลงบัญชีตามรูปแบบ GL: ถ้าไม่พบงวด หรืองวดนั้น `status <> 0` จะไม่ลงบัญชีและคืนคำเตือน "ไม่พบงวดบัญชีที่เปิดอยู่…" (gl_template.go:1025-1032)
- ใส่ `period_number` / `account_year` ลงสมุดรายวัน: ใช้งวดแรกที่ครอบวันที่ ถ้าไม่พบใช้เดือน/ปีของวันที่ (docs.go:278-279, 304-305) หรือ 0 (service.go:1599-1608 ในการสร้าง GL ใหม่; fa_depreciation.go:993-995, fa_sale.go:574-576, workflow.go:893-895 ไม่กรอง `status`); การเติมค่าที่เป็น 0/ว่าง ย้อนหลังอยู่ที่ service.go:1695-1704; การยกเลิกเอกสารหางวดของวันที่เอกสาร (doc_cancel.go:615-616)
- ตั้งช่วงวันที่ของรายการปิดบัญชี GL: เลือกงวด (หรือทั้งปี) แล้วอ่าน `date_start/date_end/period_year` มาเป็นช่วงวันที่ — ไม่ได้เปลี่ยน `status` ของงวด (workflow.go:727-738)

## หน้าจอตั้งค่าและสิทธิ์เขียน
- หน้าจอ `menu_account_period` (กำหนดงวดบัญชี เมนู 1.8.1 — ฟิลด์งวดที่/ปีบัญชี/วันเริ่ม/วันสิ้นสุด/สถานะ: frontend/src/config/schemas/icMasterSchemas.ts:1051-1064) บันทึกผ่าน master-detail spec ([[proc-master-data]]) <!-- pragma: allowlist secret -->
- สเปกรับคอลัมน์ `period_number, date_start, date_end, period_year, status` ข้ามแถวที่เลขงวดและวันเริ่มว่างทั้งคู่ (master_detail_specs.go:473-481)
- ตอนบันทึก **ลบแถวงวดทั้งตาราง** (ไม่มี `keyCol` → `DELETE FROM erp_account_period` ไม่มีเงื่อนไข) แล้วใส่ใหม่ตามแถวที่ส่งมา (master_detail_specs.go:480; master_detail.go:607-611, 683-700) — แถวที่ไม่ได้ส่งมาจึงหายไป
- `erp_account_period` อยู่ใน legacy write allow-list ของเกตเวย์ (domain/query/write_policy_legacy.go:17)

## ลิงก์
[[acc-gl-posting-standard]] · [[acc-transaction-save-flow]] · [[acc-gl-rebuild]] · [[tbl-group-erp]]

## ที่มาในโค้ด

- `backend/internal/application/process/period.go:17` `checkOpenPeriod`
- `backend/internal/application/process/period.go:40` คิวรีหางวดและสถานะ
- `backend/internal/application/process/period.go:128` `periodExemptFlags`
- `backend/internal/application/process/master_detail_specs.go:473` สเปกหน้าจอกำหนดงวด
- `backend/internal/application/process/master_detail.go:683` ลูปลบแล้วใส่ใหม่ของ master-detail
- `backend/internal/application/process/docs.go:278` งวด/ปีของสมุดรายวัน
- `backend/internal/application/process/gl_template.go:1025` ข้ามการลงบัญชีเมื่อไม่มีงวดเปิด
- `backend/internal/application/process/service.go:1599` งวด/ปีตอนสร้าง GL ใหม่
- `backend/internal/application/process/workflow.go:727` ช่วงวันที่ของงวด/ปีในรายการปิดบัญชี
- `backend/internal/application/process/trans_validate.go:44` ตรวจงวดตอนบันทึกเอกสาร
- `backend/internal/application/process/stock_beginning.go:268` ปีบัญชีเป็น ค.ศ.
- `backend/internal/application/process/fa_sale.go:422` ขายสินทรัพย์ตรวจงวด
- `backend/internal/application/process/fa_depreciation.go:877` ลบค่าเสื่อมตรวจแบบหลวม
- `backend/internal/domain/query/write_policy_legacy.go:17` allow-list การเขียน
- `frontend/src/config/schemas/icMasterSchemas.ts:1051` สคีมาหน้าจอ
- `scripts/sql/02_data_schema.sql:2473` นิยามตาราง `erp_account_period`
