---
title: "ic_hidden_cost_process — ประมวลผลต้นทุนแฝง / นำเข้า และต้นทุนตามน้ำหนัก"
tags: [schema, inventory, hidden_cost, landed_cost, customs, import, bcaiaccount]
aliases: [ic_hidden_cost_process, ic_hidden_cost_process_ref, ic_hidden_cost_process_item, ic_weight_cost, ic_import_duty, ต้นทุนแฝง]
sources:
  - scripts/sql/02_data_schema.sql:5184-5197
  - scripts/sql/02_data_schema.sql:7322-7354
  - scripts/sql/04_seed_data.sql:328-332
  - backend/internal/application/process/hidden_cost.go:15-100
  - backend/internal/application/process/hidden_cost.go:649-710
  - backend/internal/application/process/hidden_cost.go:809-875
  - backend/internal/application/process/doc_no_next.go:12-44
---

# `ic_hidden_cost_process` — ประมวลผลต้นทุนแฝง / นำเข้า และต้นทุนตามน้ำหนัก

กลุ่มตารางประมวลผล **ต้นทุนแฝง / ต้นทุนนำเข้าต่างประเทศ (Landed Cost ตามมาตรฐาน TAS 2)** สำหรับเมนู `2.22` (`hidden_cost.go:15-21`) ทำหน้าที่รวบรวมเอกสารค่าใช้จ่าย (`87`, `260`) และต้นทุนนำเข้า (ค่าระวาง, ประกันภัย, อากรขาเข้า, ค่าชิปปิ้ง) มาปันส่วนลงบนรายการสินค้าของเอกสารซื้อ/รับเข้า (`12`, `310`, `60`) แล้วสร้าง **เอกสารปรับมูลค่าสต็อก (`ic_trans` `trans_flag = 66` พร้อม `is_lock_cost = 1`)** เพื่อให้ Replay ต้นทุนนำไปเพิ่มใน `average_cost` ของสินค้า

> [!WARNING] แหล่งกำเนิดสคีมาของ `ic_hidden_cost_process*`
> ตาราง `ic_hidden_cost_process`, `ic_hidden_cost_process_ref`, และ `ic_hidden_cost_process_item` **ไม่ได้ถูก `CREATE TABLE` ใน `02_data_schema.sql`** (เป็นตารางฐานข้อมูลเดิมจากระบบ C#), แต่ Go Backend ใน `ensureHiddenCostImportCols` (`hidden_cost.go:674-706`) จะ `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` สำหรับฟิลด์นำเข้าต่างประเทศ, FX, และศุลกากรให้โดยอัตโนมัติ

## 1. ตารางชุดต้นทุนแฝง `ic_hidden_cost_process*` (`hidden_cost.go:674-706,809-870`)

### 1.1 `ic_hidden_cost_process` (หัวเอกสารต้นทุนแฝง AFC)
- **Logical Key**: `doc_no` (ไม่มีคอลัมน์ `trans_flag` — endpoint `docnonext` ใน `doc_no_next.go:12,33-40` จึงรันเลขโดยไม่กรอง `trans_flag` เช่นเดียวกับ `gl_journal`)
- **คอลัมน์หลักและคอลัมน์นำเข้าต่างประเทศ**:
  - `doc_no`, `doc_date`, `doc_time`, `doc_format_code`, `branch_code`, `remark`
  - `doc_no_adjust`, `doc_format_code_adjust`: เลขที่เอกสารปรับปรุงมูลค่า (`ic_trans` `trans_flag = 66`) ที่สร้างคู่กัน
  - `cal_hidden_cost_from`: ฐานคำนวณค่าใช้จ่าย (`0` = มูลค่าสุทธิ, `1` = มูลค่าก่อนภาษี)
  - `cal_hidden_cost_follow`: เกณฑ์การปันส่วน (`0` = ตามมูลค่าสินค้า, `1` = ตามจำนวน, `2` = ตามน้ำหนักจริง/หน่วยขนาน `qty_2`, `3` = เฉลี่ยเท่ากันทุกรายการ)
  - `total_amount`, `hidden_cost_amount` (`numeric(18,2)`): ยอดฐานซื้อรวมและยอดต้นทุนแฝงรวมที่ปันส่วน
  - ฟิลด์ศุลกากรและ FX (`ensureHiddenCostImportCols`): `customs_entry_no`, `vessel_container_no`, `incoterms`, `currency_code`, `exchange_rate`, `transport_value`, `insurance_amount`, `import_duty_amount`, `excise_tax_amount`, `clearance_port_amount`, `transport_value_fx`, `insurance_amount_fx`, `customs_vat_base`, `customs_vat_rate`, `customs_vat_amount`, `customs_tax_doc_no`, `customs_tax_doc_date`, `customs_ap_code`

### 1.2 `ic_hidden_cost_process_ref` (เอกสารอ้างอิงฝั่งค่าใช้จ่ายและฝั่งซื้อ)
- **คอลัมน์ที่บันทึก (`hidden_cost.go:844-846`)**: `doc_no`, `ref_type` (`trans_flag` เช่น `87`/`260` หรือ `12`/`310`/`60`), `doc_ref_type` (`0..2`), `doc_ref_no`, `doc_ref_date`, `doc_ref_amount`, `amount_before_vat`

### 1.3 `ic_hidden_cost_process_item` (ผลลัพธ์การปันส่วนรายบรรทัดสินค้า)
- **คอลัมน์ที่บันทึก (`hidden_cost.go:696-704,861-866`)**:
  - อ้างอิงบิลซื้อและสินค้า: `doc_no`, `billing_no`, `billing_date`, `item_code`, `wh_code`, `shelf_code`, `unit_code`, `line_number`, `remark`
  - ตัวเลขปันส่วน: `qty`, `weight`, `qty_2`, `stand_value`, `divide_value`, `item_value`, `item_amount`, `sum_amount`, `adjust_amount`, `hidden_cost_amount`, `ratio` (`%` สัดส่วนปันส่วน), `sum_total_amount`, `average_cost`

### กลไกความปลอดภัยตอนแก้ไข/ลบ (`hidden_cost.go:649-672`)
เมื่อแก้ไขหรือลบเอกสารใน `ic_hidden_cost_process` ระบบจะค้นหา `ic_trans` ที่ `trans_flag = 66 AND doc_ref = doc_no` ไปลบผ่าน `deleteTransTx` แล้วลบข้อมูลใน `_item` -> `_ref` -> หัวเอกสาร และสั่ง Rebuild ต้นทุนของสินค้าที่เกี่ยวข้องใหม่

## 2. ตารางปันส่วนต้นทุนตามน้ำหนักเดิม และพิกัดศุลกากร (`02_data_schema.sql`)

- **`ic_weight_cost`** (`7322-7339`) & **`ic_weight_cost_detail`** (`7341-7354`): ตารางปันส่วนต้นทุนตามน้ำหนักในสคีมาดั้งเดิม (`doc_no`, `doc_date`, `weight_by`, `bill_start`, `bill_stop`, `weight_method`, `amount`, และรายละเอียด `bill_date`, `bill_no`, `amount`, `line_number`)
- **`ic_import_duty`** (`5184-5197`, Index `code`): ตารางรหัสพิกัดอากรนำเข้า (`code` เช่น `8471.60`, `name_1`, `name_2`, `status` ใน `04_seed_data.sql:329-331`)

## ตัวอย่าง SQL จริง: ตรวจสอบเอกสารต้นทุนแฝงคู่กับเอกสารปรับมูลค่า `ic_trans` (`trans_flag = 66`)

```sql
SELECT h.doc_no, h.doc_date, h.doc_no_adjust,
       h.cal_hidden_cost_from, h.cal_hidden_cost_follow,
       h.hidden_cost_amount, h.customs_entry_no, h.incoterms,
       i.billing_no, i.item_code, i.qty, i.item_amount,
       i.adjust_amount, i.sum_total_amount, i.average_cost
FROM ic_hidden_cost_process h
JOIN ic_hidden_cost_process_item i ON i.doc_no = h.doc_no
LEFT JOIN ic_trans adj
  ON adj.doc_no = h.doc_no_adjust
 AND adj.trans_flag = 66
 AND COALESCE(adj.last_status, 0) = 0
WHERE h.doc_no = $1
ORDER BY i.line_number;
```
