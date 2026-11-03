---
title: "ผังบัญชี (gl_chart_of_account)"
tags: [tables, gl]
aliases: ["gl_chart_of_account", "ผังบัญชี", "chart of account", "COA", "รหัสบัญชี", "ทะเบียนผังบัญชี"]
sources: ["backend/internal/application/process/master_detail_specs.go:90", "backend/internal/application/process/master_detail_specs.go:113", "backend/internal/application/process/master_detail_specs.go:710", "backend/internal/application/process/service.go:842", "backend/internal/application/process/service.go:1755", "backend/internal/application/process/gl_template.go:192", "backend/internal/application/process/workflow.go:160", "backend/internal/application/process/workflow.go:592", "backend/internal/application/process/report_menu_gl_fa.go:49", "backend/internal/application/process/report_menu_gl_fa.go:209", "backend/internal/application/process/report_menu_gl_fa.go:1657", "backend/internal/adapter/inbound/http/mcp/gateway.go:1410"]
---

# ผังบัญชี (`gl_chart_of_account`)

ทะเบียนบัญชีแยกประเภท 1 แถวต่อ 1 รหัสบัญชี เป็นตารางที่ทุกการลงบัญชีอ้างถึง (`account_code` ใน [[tbl-gl-journal-detail]]) และแหล่งที่ระบบหาชื่อบัญชีและบัญชีหลักสำหรับการปิดบัญชี แก้ไขผ่านหน้า master `menu_chart_of_account` (spec `chartSpec`) ในหมวด [[proc-master-data]]

## คอลัมน์สำคัญ

| คอลัมน์ | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `code` | รหัสบัญชี (คีย์) ตัวอักษรใหญ่ | ทุกที่ |
| `name_1`, `name_2` | ชื่อบัญชี ไทย/อังกฤษ-อื่น (name_1 จำเป็น) | `master_detail_specs.go:710` |
| `main_code` | บัญชีหลัก/บัญชีแม่ของบัญชีนี้ (ต้องมีในผัง และไม่ใช่ตัวเอง) ใช้สร้างต้นไม้ผังบัญชี | `master_detail_specs.go:710`, `report_menu_gl_fa.go:209` |
| `account_level` | ระดับชั้นบัญชี 0-7 | `master_detail_specs.go:95` |
| `account_type` | 0 สินทรัพย์, 1 หนี้สิน, 2 ทุน, 3 รายได้, 4 ค่าใช้จ่าย | `report_menu_gl_fa.go:49` |
| `status` | 0-1: 1 = บัญชีหลัก/บัญชีรวม ห้ามลงรายการ (GLCheck รายงานบรรทัดที่ใช้ผัง status=1) ส่วนปิดบัญชีรับเฉพาะบัญชีปลายทาง `status = 0` | `workflow.go:597`, `workflow.go:872` |
| `account_group` | กลุ่มบัญชี อ้าง `gl_account_group.code` | `master_detail_specs.go:119` |
| `cash_flow_group` | กลุ่มกระแสเงินสด อ้าง `gl_cash_flow_group.code` | `master_detail_specs.go:120` |
| `account_close` | บัญชีที่ใช้ปิดบัญชีนี้ (ต้องมีในผัง) | `master_detail_specs.go:117-118` |
| `tax_type` | ชนิดภาษีของบัญชี 0-4 จาก MCP: 1 = ภาษีขาย, 2 = ภาษีซื้อ ค่าอื่น (ไม่ชัดจากโค้ด) | `gateway.go:1410`, `service.go:842` |
| `balance_mode` | 0-1 (ความหมาย: ไม่ชัดจากโค้ด) | `master_detail_specs.go:90` |
| `balance_sheet_status` | 0-5 (ความหมายแต่ละค่า: ไม่ชัดจากโค้ด) | `master_detail_specs.go:95` |
| `side_status`, `department_status`, `allocate_status`, `project_status`, `job_status` | 0-1 เปิดให้แยกมิติ ฝ่าย/แผนก/จัดสรร/โครงการ/งาน | `master_detail_specs.go:90-97` |
| `active_status`, `work_in_process_status` | 0-1 (สถานะใช้งาน / งานระหว่างทำ ความหมายละเอียด: ไม่ชัดจากโค้ด) | `master_detail_specs.go:90-97` |

คอลัมน์ `tax_type`, `account_close`, `cash_flow_group` ถูกเพิ่มด้วย `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` ตอนเริ่มระบบ (`service.go:842-844`) แสดงว่าฐานเก่าของ BC อาจยังไม่มีคอลัมน์เหล่านี้

## คีย์และความสัมพันธ์
- ตัวเอง: `main_code` และ `account_close` → `gl_chart_of_account.code`
- ลูกตารางกำหนดมิติต่อบัญชี (ผูก `account_code`): `gl_chart_of_account_side_list` (`side_code`→`erp_side_list`), `..._depart_list` (`department_code`→`erp_department_list`), `..._allocate_list` (`allocate_code`→`erp_allocate_list`), `..._job_list` (`job_code`→`erp_job_list`), `..._project_list` (`project_code`→`erp_project_list`) `master_detail_specs.go:105-111`
- ผู้ใช้บัญชี: [[tbl-gl-journal-detail]].`account_code`, `gl_trans_detail`, `gl_account_close_detail`, [[tbl-as-asset]] (`account_code`, `depreciation_account_code`, `depreciation_sum_account_code`), `ar_customer_detail.account_code`, `erp_credit_type.account_code`, `erp_wallet_list.account_code` เป็นรายการที่ใช้กันลบ `master_detail_specs.go:127-137`
- ตารางแม่แบบ GL ในเอกสาร ([[tbl-erp-doc-format-gl]]) และ master อื่นเก็บ `account_code` ที่อ้างตารางนี้

## ใครเขียน และใครอ่าน
- เขียน: หน้า master ผังบัญชี `chartSpec` (`master_detail_specs.go:113`, ตัวตรวจ `prepChart` :710, หน้ากริดแก้เร็ว `menu_chart_of_account_fast` :245), เปลี่ยนรหัสผังบัญชี `workflow.go:160-168` (แก้ `code`, `main_code`, `account_close` และตารางที่อ้างทั้งหมดพร้อมกัน)
- อ่าน: ทุก writer ของ GL (หาชื่อบัญชีที่ `gl_template.go:192`, ตัวแก้บัญชีมาตรฐานที่ `service.go:1755`), ตรวจรายวัน `workflow.go:592-597`, รายงานผังบัญชีและต้นไม้ `report_menu_gl_fa.go:209`, `report_menu_gl_fa.go:1657`, งบทดลองทุกรายงาน, ตรวจบัญชีก่อนบันทึก `fa_depreciation.go:762`, `stock_beginning.go:633`, ผู้ช่วย AI `ai_copilot.go:1115`
- อยู่ใน legacy write allow-list ของ `/query/exec` (ADR-0011) (ไม่ใช่ตารางเงินตาม `moneyTablePattern`)

## ข้อควรระวัง
- `resolveChartAccount` ลองรหัสแบบ `code` ตรง หรือ `code-%` (เช่น `1122-01`) ถ้าไม่เจอเลยคืนรหัสแรกที่ขอพร้อมชื่อเป็นรหัสเดียวกัน หรือ `9999` บัญชีพัก ทำให้ผังที่ไม่มีบัญชีมาตรฐานยังลงบัญชีได้แต่เป็นรหัสที่ไม่มีในผัง (`service.go:1755-1773`) GLCheck จะรายงานเป็น "บรรทัดไม่มีผังบัญชี"
- ลบบัญชีที่ถูกอ้างอยู่ไม่ได้ ระบบตรวจ `uses` ก่อน (`master_detail_specs.go:127-137`)
- ลบ/แก้ `code` ต้องผ่านเมนูเปลี่ยนรหัสเท่านั้น เพื่อให้ตารางลูก (รายวัน มิติ ทะเบียนสินทรัพย์) เปลี่ยนตามกัน
- ค่า enum ที่ UI ตรวจช่วง: `account_level` 0-7, `account_type` 0-4, `tax_type` 0-4, `balance_sheet_status` 0-5, ที่เหลือ 0-1 (`master_detail_specs.go:95-97`)

## ที่มาในโค้ด
- `backend/internal/application/process/master_detail_specs.go:90` คอลัมน์หัวผังบัญชี
- `backend/internal/application/process/master_detail_specs.go:95` ช่วงค่า enum
- `backend/internal/application/process/master_detail_specs.go:105` ตารางลิงก์มิติ
- `backend/internal/application/process/master_detail_specs.go:113` chartSpec และตัวกันลบ
- `backend/internal/application/process/master_detail_specs.go:710` prepChart
- `backend/internal/application/process/service.go:842` ALTER เพิ่มคอลัมน์
- `backend/internal/application/process/service.go:1755` resolveChartAccount
- `backend/internal/application/process/gl_template.go:192` glSQLChart
- `backend/internal/application/process/workflow.go:160` เปลี่ยนรหัสผังบัญชี
- `backend/internal/application/process/workflow.go:592` GLCheck ผังบัญชี
- `backend/internal/application/process/workflow.go:872` ปิดบัญชีตรวจ status
- `backend/internal/application/process/report_menu_gl_fa.go:49` ชื่อประเภทบัญชี
- `backend/internal/application/process/report_menu_gl_fa.go:209` ต้นไม้ผังบัญชี
- `backend/internal/application/process/report_menu_gl_fa.go:1657` รายงานผังบัญชี
- `backend/internal/adapter/inbound/http/mcp/gateway.go:1410` คำอธิบาย tax_type

## ดูเพิ่ม
- [[tbl-group-gl]]
- [[tbl-gl-journal-detail]]
- [[acc-gl-posting-standard]]
