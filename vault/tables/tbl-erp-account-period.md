---
title: "erp_account_period — งวดบัญชี (เปิด/ปิดงวด)"
tags: [tables, erp, gl, period, company-db]
aliases: ["erp_account_period", "งวดบัญชี", "ปิดงวด", "period_number", "account period"]
sources: ["backend/internal/application/process/period.go:14", "backend/internal/application/process/period.go:126", "backend/internal/application/process/master_detail_specs.go:475", "backend/internal/application/process/docs.go:278", "backend/internal/application/process/gl_template.go:1028", "backend/internal/application/process/workflow.go:727", "backend/internal/application/process/trans_validate.go:44", "backend/internal/application/process/stock_beginning.go:268"]
---

# erp_account_period — งวดบัญชี

กำหนดช่วงวันที่ของแต่ละงวดบัญชี + สถานะเปิด/ปิด ใช้กั้นไม่ให้บันทึก/แก้/ลงบัญชีเอกสารในงวดที่ปิดแล้ว ตารางเดิม (legacy) ไม่มี DDL ในโค้ด

## คอลัมน์
| คอลัมน์ | ความหมาย | ที่มา |
|---|---|---|
| `period_number` | ลำดับงวด (ใช้เรียงเพื่อหางวดแรกที่ครอบวันที่) | period.go:14-62 |
| `date_start`, `date_end` | วันเริ่ม/สิ้นสุดงวด | period.go |
| `period_year` | ปีของงวด (เก็บเป็น ค.ศ. ในฐาน) | stock_beginning.go:268 |
| `status` | 0 = เปิด, 1 = ปิด (ค่าที่ยอมรับ {0,1}) | master_detail_specs.go:475-480 (เมนู 1.8.1) |
| `roworder` | ลำดับแถว | (ไม่ชัดจากโค้ด) |

## กฎ `checkOpenPeriod` (period.go:14-62)
- หางวดแรก (เรียง `period_number`) ที่วันที่เอกสารอยู่ในช่วง — **ต้องมีงวด และ `status = 0`** ไม่เช่นนั้น error
- เอกสารบางประเภทได้รับการยกเว้น (`periodExemptFlags`, period.go:126)

## ใครใช้
- ตรวจก่อนลง GL: docs.go:278-305, gl_template.go:1028, service.go:1591/1688, fa_depreciation.go:993, fa_sale.go:574, workflow.go:893
- ปิดงวด/ปิดปีบัญชี GL: workflow.go:727-738
- ตรวจตอนบันทึกเอกสาร: trans_validate.go:44
- หน้าจอตั้งค่า: master-detail spec เมนู 1.8.1 ([[proc-master-data]])

## ลิงก์
[[acc-gl-posting-standard]] · [[acc-transaction-save-flow]] · [[acc-gl-rebuild]] · [[tbl-group-erp]]

## ที่มาในโค้ด

- `backend/internal/application/process/period.go:14`
- `backend/internal/application/process/period.go:126`
- `backend/internal/application/process/master_detail_specs.go:475`
- `backend/internal/application/process/docs.go:278`
- `backend/internal/application/process/gl_template.go:1028`
- `backend/internal/application/process/workflow.go:727`
- `backend/internal/application/process/trans_validate.go:44`
- `backend/internal/application/process/stock_beginning.go:268`
