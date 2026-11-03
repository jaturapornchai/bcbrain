---
title: "เครื่องมือกระบวนการระบบ ตรวจ ic_trans / คำนวณแต้มใหม่ / นำเข้าที่อยู่จัดส่ง (Sysproc Tools)"
tags: [process, sysproc, workflow, ic_trans, point, transport-label, data-check]
aliases: ["check-ic-trans", "IcTransCheck", "icTransChecks", "point-recal", "PointRecal", "pointsFor", "import-transport-label", "ImportTransportLabel", "menu_checking_ic_trans", "menu_ar_point_recal", "ตรวจสอบข้อมูลรายวันสินค้า", "คำนวณแต้มสมาชิกใหม่", "SystemProcessWorkbench"]
sources: ["backend/internal/application/process/sysproc_tools.go:3", "backend/internal/application/process/sysproc_tools.go:20", "backend/internal/application/process/sysproc_tools.go:47", "backend/internal/application/process/sysproc_tools.go:122", "backend/internal/application/process/sysproc_tools.go:136", "backend/internal/application/process/sysproc_tools.go:152", "backend/internal/application/process/sysproc_tools.go:219", "backend/internal/application/process/sysproc_ic_checks_data.go:6", "backend/internal/adapter/inbound/http/process/workflow_handler.go:94", "backend/internal/adapter/inbound/http/process/permission.go:96"]
---

# เครื่องมือกระบวนการระบบ (Sysproc Tools)

ไฟล์ `sysproc_tools.go` รวม 3 กระบวนการที่หน้าจอ `SystemProcessWorkbench` เคยประกอบ SQL ในเบราว์เซอร์ ตอนนี้ย้ายมาอยู่ฝั่งเซิร์ฟเวอร์: ตรวจ/ซ่อมข้อมูล `ic_trans`, คำนวณแต้มสมาชิก POS ใหม่ และนำเข้าที่อยู่จัดส่ง SQL เป็นค่าคงที่ ค่าจากลูกค้าเป็น parameter เท่านั้น (คอมเมนต์ `sysproc_tools.go:3-6`)

route ผ่าน `POST /process/workflow/{action}` ไม่ใช่กลุ่มของตัวเอง ดู [[proc-workflow]]

## ทำงานอย่างไร

### 1. `workflow/check-ic-trans` (เมนู `menu_checking_ic_trans`)
- รายการตรวจอยู่ใน `icTransChecks` (`sysproc_ic_checks_data.go:6`) รวม 29 รายการ แต่ละรายการมี `name`, `check` (SQL นับแถว), `update` (SQL ซ่อม), `auto`
- รายการที่ไม่มีคำสั่งซ่อม (`update: ""`) มี 3 รายการ: รายวันซื้อขายที่ไม่มีคลัง/ที่เก็บ (:19-21), รายวันซื้อขายไม่มีหน่วยนับ (:49-51), รายการสินค้าไม่พบ Serial (:67-69) -- ตอบ `repairable: false`
- ตัวอย่างหมวดที่ตรวจ: `ic_trans.is_pos` / `ic_trans_detail.is_pos` เป็น null, `last_status` เป็น null (ic_trans, ic_trans_detail, ap_ar_trans, รายละเอียด, รับ-จ่ายชำระ), ไม่มี `doc_date_calc`, สินค้าไม่มี `item_type`, ตัวตั้ง/ตัวหารหน่วยนับเป็น 0, ตาราง `ic_wh_shelf` / `ic_inventory_barcode` / `ar_dealer` / `ic_inventory_level` ที่ไม่พบรหัสสินค้า, เช็คจ่าย/เช็ครับไม่พบเอกสารอ้างอิง, อัตราส่วนตัวตั้ง/ตัวหารไม่ตรงกับ `ic_unit_use`, `is_doc_copy` เป็น null, สถานะใบสั่งซื้อที่อ้างไปค่าใช้จ่าย (ชื่อรายการเต็มอยู่ใน `name` ของแต่ละแถวใน `sysproc_ic_checks_data.go`)
- ธง `auto = true` มี 10 รายการ (สั่งซ่อมโดยไม่เลือกรายการ = ซ่อมชุดนี้, `sysproc_tools.go:30-31`): รายการ is_pos null สองรายการ, ไม่มีสถานะ (`last_status`) 5 รายการ (รายวันซื้อขาย, รายละเอียดซื้อขาย, รายวันลูกหนี้-เจ้าหนี้, รายละเอียดลูกหนี้-เจ้าหนี้, รายละเอียดรับ-จ่ายชำระ), ไม่มีวันที่คำนวณ, ไม่พบประเภทสินค้า, `is_doc_copy` null (บรรทัด 13, 16, 22, 25, 28, 31, 34, 37, 43, 88)

**ลำดับทำงาน `IcTransCheck` (:47)**
1. นับทุกรายการด้วย `check` ผ่าน pool หมดเวลา 120 วินาที; ถ้าคำสั่งใดพังเก็บข้อความใน `error` ของแถวนั้นแล้วทำต่อ
2. ถ้า `apply = false` คืนผลนับเท่านั้น (read)
3. ถ้า `apply = true`: `indexes[]` ที่ส่งมาต้องอยู่ในช่วง 0..28 (นอกช่วง = error "ลำดับรายการตรวจสอบไม่ถูกต้อง"); ถ้าไม่ส่ง `indexes` ใช้รายการที่ `auto = true`
4. ซ่อมใน transaction เดียว (`withTx`) แต่ละรายการอยู่ใน savepoint: พังแล้ว rollback เฉพาะรายการนั้น บันทึก `error` แล้วทำรายการถัดไป; ข้ามรายการที่ไม่มี `update`, ที่นับพัง, หรือนับได้ 0
5. เขียน log `menu_checking_ic_trans` จำนวนที่ซ่อม ผ่าน `writeProcessLog`

**ผลลัพธ์**: อาร์เรย์ของ `{index, name, auto, repairable, count, updated, error?}`

**สิทธิ์ (`permission.go:96-100`)**: `apply = false` ใช้ read, นอกนั้น Admin (คำสั่งซ่อมแก้ข้อมูลทั้งฐาน)

### 2. `workflow/point-recal` (เมนู `menu_ar_point_recal`)
- Input `dateFrom`, `dateTo` (`YYYY-MM-DD`, `to` ต้องไม่ก่อน `from`); คืน `{docs, updated}`
- เลือกเฉพาะใบขาย POS: `trans_flag = 44`, `is_pos = 1`, `last_status = 0` ในช่วงวันที่ เอกสาร flag 801/802 พิมพ์มือและไม่ถูกแตะ (คอมเมนต์ :149-151)
- ต่อใบขาย (`pointRecalSelect` :122) อ่านเป็นข้อความเพื่อไม่ให้ float แตะเงิน: ตัวหารจาก `pos_point_period` ที่ `doc_date` อยู่ระหว่าง `from_date`..`to_date` (ช่วงล่าสุดก่อน), ฐานคิดแต้ม = ผลรวม `ic_trans_detail.sum_amount`, ยอดชำระ = `cash_amount + card_amount + tranfer_amount + chq_amount` จาก `cb_trans` (flag 44)
- ตัวเลือกบริษัทจาก `erp_option`: `sum_point_all = 1` -> นับทุกสินค้า, ไม่เช่นนั้นนับเฉพาะสินค้าที่ `ic_inventory_detail.have_point = 1`; `calc_point_from_pay = 1` -> ใช้ยอดชำระแทนฐานสินค้า
- `pointsFor(base, divisor)` (:136) = floor(ฐาน / ตัวหาร) ด้วย `big.Rat`; ตัวหาร 0 ได้ 0 แต้ม; ค่าที่แปลงเป็นทศนิยมไม่ได้ = error
- ใบขายที่ไม่มีช่วงแต้ม (ตัวหาร null) หรือไม่มีฐาน ถูกข้าม ไม่แก้ (คอมเมนต์ :149-151)
- เขียน `UPDATE ic_trans SET sum_point` เฉพาะแถวที่ค่าต่าง (`IS DISTINCT FROM`) ตัวนับ `docs` คือจำนวนใบขายที่อ่านได้ `updated` คือจำนวนที่แก้จริง; บันทึก log `menu_ar_point_recal`
- สิทธิ์: write (`permission.go:51`)

### 3. `workflow/import-transport-label`
- Input `kind` = `ap` (จาก `ap_supplier`, `ar_ap_type = 0`) หรือ `ar` (จาก `ar_customer`, `ar_ap_type = 1`); ชนิดอื่น = error "ชนิดที่อยู่จัดส่งไม่ถูกต้อง"
- `INSERT INTO ap_ar_transport_label (cust_code, name_1, address, telephone, fax, email, ar_ap_type)` เฉพาะผู้ขาย/ลูกค้าที่ยังไม่มีแถวในตารางนี้ของชนิดเดียวกัน (NOT EXISTS) คืนจำนวนแถวที่เพิ่ม; log `menu_import_<kind>_transport_label`
- สิทธิ์: write (`permission.go:51`)

## ที่มาในโค้ด
- `backend/internal/application/process/sysproc_tools.go:20-104` - `icTransCheck`, `IcTransCheckInput/Row`, `IcTransCheck`
- `backend/internal/application/process/sysproc_ic_checks_data.go:6` - `icTransChecks` (29 รายการ)
- `backend/internal/application/process/sysproc_tools.go:106-208` - `PointRecalInput`, `pointRecalSelect` (:122), `pointsFor` (:136), `PointRecal` (:152)
- `backend/internal/application/process/sysproc_tools.go:210-240` - `ImportTransportLabel`
- `backend/internal/application/process/workflow.go:65` - `writeProcessLog` ที่ใช้เขียน log ทั้ง 3 กระบวนการ
- `backend/internal/adapter/inbound/http/process/workflow_handler.go:94-114` - 3 case ใน `Workflow`
- `backend/internal/adapter/inbound/http/process/permission.go:51,96-100` - สิทธิ์

## ดูเพิ่ม
- [[proc-workflow]]
- [[proc-permission-rights]]
- [[proc-dispatcher]]
- [[process-overview]]
