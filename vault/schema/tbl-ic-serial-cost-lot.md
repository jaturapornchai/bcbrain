---
title: "ทะเบียน Serial, ต้นทุนมาตรฐาน, Lot Expiry FEFO, RMA, QC และ Stock Build"
tags: [schema, inventory, serial, standard_cost, fefo, rma, qc, bcaiaccount]
aliases: [ic_serial, ic_standard_cost, ic_lot_expiry_register, ic_writeoff_petition, ic_warranty_rma_ticket, ic_qc_lab, ic_stk_build]
sources:
  - scripts/sql/02_data_schema.sql:4937-4947
  - scripts/sql/02_data_schema.sql:5851-5862
  - scripts/sql/02_data_schema.sql:6296-6341
  - scripts/sql/02_data_schema.sql:6389-6426
  - scripts/sql/02_data_schema.sql:6507-6569
  - scripts/sql/02_data_schema.sql:8926-8963
  - backend/internal/application/process/stock_expiry_fefo.go:75-124
  - backend/internal/application/process/serial_warranty_rma.go:43-72
  - backend/internal/application/process/item_master.go:20-23
  - backend/internal/application/process/workflow.go:146-149
---

# ทะเบียน Serial, ต้นทุนมาตรฐาน, Lot Expiry FEFO, RMA, QC และ Stock Build

กลุ่มตารางควบคุมคุณภาพ ต้นทุนมาตรฐาน สถานะปัจจุบันของ Serial Number, การบริหารวันหมดอายุ (FEFO) และการยื่นคำร้องตัดทำลายต่อสรรพากร, งานรับประกัน/ซ่อม RMA, QC Lab, และการประกอบย่อย `ic_stk_build` รวมถึงตารางพักรายงานวันหมดอายุ

> [!NOTE] แหล่งกำเนิด DDL แบบผสม (Legacy + Go Runtime)
> - ตาราง Legacy (`ic_serial`, `ic_standard_cost`, `ic_lot_manage`, `ic_qc_lab`, `ic_quality_control`, `ic_stk_build*`, `stock_expire_*`) อยู่ใน `02_data_schema.sql` (ไม่มี SQL `PRIMARY KEY`, ใช้ `roworder SERIAL`)
> - ตาราง Go Runtime ใหม่ (`ic_lot_expiry_register`, `ic_writeoff_petition`, `ic_warranty_rma_ticket`) ถูกสร้างด้วย `CREATE TABLE IF NOT EXISTS` ในโค้ด Go พร้อม **`PRIMARY KEY` จริง**

## 1. ทะเบียน Serial และมิติ Serial (`02_data_schema.sql:6389-6426`)

- **`ic_serial`** (`6389-6409`): ทะเบียนสถานะล่าสุดของ Serial Number (`ic_code`, `serial_number`, `description`, `guid_code`, `void_date`, `ic_unit`, `status`, `wh_code`, `shelf_code`, `product_year`, `product_week`, `car_inventory`, `car_stockno`, `car_engineno`, `car_chassisno`) — คู่กับประวัติการรับ-จ่ายใน [[tbl-ic-trans-serial-number]]
- **`ic_serial_dimension`** (`6411-6426`, Index `code`): มิติเสริมของ Serial (`code`, `name_1`, `name_2`, `remark`, `dimension_no`, `status`)

## 2. ต้นทุนมาตรฐาน & ต้นทุนตามวันที่ (`02_data_schema.sql:4937-4947`, `6507-6516`)

- **`ic_standard_cost`** (`6507-6516`): ต้นทุนมาตรฐานตามวันเริ่มต้นที่มีผลสำหรับสินค้า `cost_type = 4` (`ic_code`, `unit_code`, `date_start date`, `cost1 numeric`) แก้ไขร่วมในหน้าสินค้า (`item_master.go:21`)
- **`ic_cost_date`** (`4937-4947`): ตารางเก็บต้นทุนตามวันที่ (`doc_date`, `ic_code`, `price`, `remark`, `line_number`)

## 3. จัดการ Lot, FEFO Expiry และคำร้องตัดทำลายสรรพากร (`stock_expiry_fefo.go:75-124`)

- **`ic_lot_manage`** (`02_data_schema.sql:5851-5862`): จัดลำดับ/เลือก Lot ต่อคลัง (`ic_code`, `lot_number`, `sort_order`, `lot_select`, `wh_code`, `shelf_code`)
- **`ic_lot_expiry_register`** (`stock_expiry_fefo.go:75-92`): ทะเบียนคุม Lot หมดอายุที่ Go สร้างพร้อม **`lot_key TEXT PRIMARY KEY`**:
  - คอลัมน์: `lot_no`, `item_code`, `item_name`, `wh_code` (`DEFAULT 'WH1'`), `mfg_date DATE`, `expiry_date DATE NOT NULL`, `qty_balance NUMERIC(18,2)`, `unit_code`, `unit_cost NUMERIC(18,2)`, `fda_reg_no`, `created_by`
- **`ic_writeoff_petition`** (`stock_expiry_fefo.go:97-121`): ทะเบียนคำร้องแจ้งทำลายสินค้าเสื่อมสภาพต่อกรมสรรพากร (**`petition_doc_no TEXT PRIMARY KEY`**):
  - คอลัมน์: `notice_date`, `earliest_destroy_date`, `planned_destroy_date`, `is_perishable_immediate` (`boolean`), `meets_30day_rule` (`boolean`), `lot_no`, `item_code`, `destroy_qty NUMERIC(18,2)`, `unit_cost NUMERIC(18,2)`, `total_writeoff_cost NUMERIC(18,2)`, `vat_exempt_amount NUMERIC(18,2)`, `destroy_method` (`'CRUSH'`), `witness_committee`, `rd_area_office`, `status` (`'PENDING_RD_NOTICE'`), `remark`, `created_by`

## 4. งานรับประกันและซ่อม RMA (`ic_warranty_rma_ticket`, `serial_warranty_rma.go:43-69`)

- **`rma_doc_no TEXT PRIMARY KEY`**
- คอลัมน์สำคัญ: `doc_date DATE`, `serial_no TEXT`, `item_code`, `item_name`, `sale_invoice_no`, `sale_date DATE`, `warranty_months INTEGER DEFAULT 12`, `warranty_expire_date DATE`, `is_in_warranty BOOLEAN`, `cust_code`, `cust_name`, `cust_phone`, `symptom`, `resolution_type` (`'REPAIR'`), `replacement_sn`, `service_fee NUMERIC(18,2)`, `parts_cost NUMERIC(18,2)`, `status` (`'RECEIVED'`), `remark`

## 5. ตรวจสอบคุณภาพ QC, Stock Build และตาราง Temp วันหมดอายุ

- **`ic_qc_lab`** (`6296-6316`, Index `item_code`, `cust_code`): ผลตรวจ Lab (`lab_no`, `ref_lab_no`, `item_code`, `doc_ref`, `doc_ref_date`, `cust_code`, `lot_number`, `mfn_name`, `mfd_date`, `expire_date`, `retest_date`, `lab_status`, `ref_doc_type`)
- **`ic_quality_control`** (`6318-6341`, Index `(doc_no, trans_flag)`, `(doc_date, trans_flag)`): เอกสาร QC (`doc_no`, `doc_date`, `trans_flag`, `ic_qc_status`, `ic_code`, `lot_number`, `mfd_date`, `exp_date`, `lab_no`, `lab_retest`, `lab_retest_date`, `retest_date`, `doc_format_code`)
- **`ic_stk_build`** (`6533-6553`) & **`ic_stk_build_detail`** (`6555-6569`): เอกสารประกอบ/จัดชุดสต็อกแบบเดิม (`doc_no`, `doc_date`, `ic_code`, `wh_code`, `shelf_code`, `unit_code`, `wage`, `cost`, `qty`, `person_code`)
- **`ic_stk_adjust_reason`** (`6518-6531`, Index `code`): รหัสเหตุผลการปรับปรุงสต็อก (`code`, `name_1`, `name_2`, `status` เช่น `ADJ01`, `ADJ02`)
- **`stock_expire_temp`** (`8926-8943`, Index `cust_code`) & **`stock_expire_warehouse_temp`** (`8945-8963`, Index `cust_code`): ตารางพักรายงานสินค้าหมดอายุ (`doc_date`, `doc_no`, `ic_code`, `unit_code`, `cust_code`, `expire_qty`, `expire_date`, `balance_qty`, `balance_unit_code` และ `warehouse`)

## ตัวอย่าง SQL จริง: ตรวจรายการ Lot ใกล้หมดอายุพร้อมสถานะคำร้องตัดทำลาย

```sql
SELECT r.lot_key, r.lot_no, r.item_code, r.item_name, r.wh_code,
       r.expiry_date, r.qty_balance, r.unit_cost,
       w.petition_doc_no, w.status AS petition_status, w.planned_destroy_date
FROM ic_lot_expiry_register r
LEFT JOIN ic_writeoff_petition w
  ON w.lot_no = r.lot_no AND w.item_code = r.item_code
WHERE r.qty_balance > 0
ORDER BY r.expiry_date ASC, r.item_code;
```
