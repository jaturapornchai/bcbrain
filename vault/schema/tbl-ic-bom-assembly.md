---
title: "ic_bom_header, ic_bom_detail & ic_assembly_order — สูตรผลิต BOM และใบสั่งประกอบ"
tags: [schema, inventory, bom, assembly, production, bcaiaccount]
aliases: [ic_bom_header, ic_bom_detail, ic_assembly_order, ic_formular, ic_production_formula, สูตรผลิต]
sources:
  - scripts/sql/02_data_schema.sql:5087-5116
  - scripts/sql/02_data_schema.sql:6043-6084
  - backend/internal/application/process/bom_assembly.go:131-445
  - backend/internal/application/process/bom_assembly.go:806-1038
  - backend/internal/application/process/bom_assembly.go:1365-1700
  - backend/internal/application/process/bom_assembly.go:1805-1866
  - backend/internal/application/process/service.go:2385-2394
  - backend/internal/application/process/service.go:3235-3274
  - scripts/sql/33_seed_bcdemo_bom_assembly.sql:1-81
---

# `ic_bom_header`, `ic_bom_detail` & `ic_assembly_order` — สูตรผลิต BOM และใบสั่งประกอบ

ระบบสูตรการผลิตและใบสั่งประกอบ/ผลิตสินค้าใช้ชุดตาราง **`ic_bom_*` + `ic_assembly_order`** ที่สร้างโดย Go Backend (`bom_assembly.go:186-252` พร้อม `PRIMARY KEY` จริง; สำหรับฐานข้อมูลตัวอย่าง `bcdemo` มี `ensureDemoBomSeedTx` และ `33_seed_bcdemo_bom_assembly.sql` เติมสูตรตัวอย่าง `BOM-DEMO-01`, `BOM-DEMO-02` อัตโนมัติเมื่อยังไม่มีข้อมูล และ `listBomAssembly` ดึงรายการ `Components` จาก `ic_bom_detail` กลับมาครบทุกสูตร) และรองรับการทำงานแบบ Atomic Transaction โดยสร้างเอกสาร **เบิกวัตถุดิบ (`trans_flag = 56`)** คู่กับ **รับสินค้าสำเร็จรูป (`trans_flag = 54`)** ใน [[tbl-ic-trans]] / [[tbl-ic-trans-detail]] พร้อมซิงก์ `fg_total_cost` (หากขั้นตอนนี้ล้มเหลวจะทำชดเชยลบเอกสารทั้ง `54` และ `56` ทันที) และสั่ง `rebuildGLTx` โพสต์บัญชี `trans_flag = 54` เฉพาะใบรับที่ผูกใน `ic_assembly_order.receipt_doc_no` (`bom_assembly.go:1641-1692`, `service.go:2385-2394, 3235-3274`) นอกจากนี้ `normalizeBomAssemblyInput` (`bom_assembly.go:408-441`) รองรับทั้ง Payload แบบแบนและแบบซ้อน `bom` (พร้อม `rmQtyPerYield`), `prepareBomOptionalUpsertParams` (`bom_assembly.go:808-833`) จัดการฟิลด์เสริม (`fg_unit_code_2`, `fg_yield_qty_2`, `active_status`, `remark`) แบบ nullable เพื่อคงค่าเดิมใน DB เมื่อไม่ส่งมาอัปเดต, `saveBomFormula` ตรวจจับสูตรวนลูปหลายทอด (`checkBomCycle` ป้องกัน A → B → A ที่ `bom_assembly.go:975, 1809-1866`), `produceBomAssembly` ตรวจสถานะเปิดใช้งานผ่าน `validateBomActiveForProduction` และล็อกอ่านซ้ำใน Transaction ด้วย `SELECT COALESCE(active_status, 1)::int FROM ic_bom_header WHERE bom_code = $1 FOR SHARE` (`bom_assembly.go:1371-1376, 1419-1445`) เพื่อบล็อกการสั่งผลิตสูตรที่ `active_status = 0` และรองรับโครงสร้าง `ic_formular*` กับ `ic_production_formula*` เดิมใน `02_data_schema.sql` อยู่ด้วย

## 1. ตารางสูตรผลิตและใบสั่งประกอบ (`bom_assembly.go:186-252`)

### 1.1 `ic_bom_header` (หัวสูตรผลิต BOM)
- **SQL Primary Key**: `PRIMARY KEY (bom_code)`
- **คอลัมน์สำคัญ**:
  - `bom_code` (`varchar(30)`), `bom_name` (`varchar(200)`), `active_status` (`smallint DEFAULT 1`)
  - สินค้าสำเร็จรูป (Finished Goods): `fg_item_code` (`varchar(50)`), `fg_unit_code` (`varchar(30)`), `fg_yield_qty` (`NUMERIC(18,4) DEFAULT 1`) และหน่วยขนาน `fg_unit_code_2`, `fg_yield_qty_2`
  - ต้นทุนมาตรฐานต่อรอบผลิต: `labor_cost NUMERIC(18,2)`, `overhead_cost NUMERIC(18,2)`
  - คลังเริ่มต้น: `default_wh_code`, `default_shelf_code`

### 1.2 `ic_bom_detail` (รายการวัตถุดิบในสูตร BOM)
- **SQL Primary Key**: `PRIMARY KEY (bom_code, line_number)`
- **คอลัมน์สำคัญ**: `bom_code`, `line_number` (`INT`), `rm_item_code` (`varchar(50)`), `rm_unit_code`, `rm_qty` (`NUMERIC(18,4)`), `rm_unit_code_2`, `rm_qty_2`, `scrap_pct` (`NUMERIC(9,4)` — เปอร์เซ็นต์สูญเสีย), `remark`

### 1.3 `ic_assembly_order` (ใบสั่งประกอบ / บันทึกผลิตจริง)
- **SQL Primary Key**: `PRIMARY KEY (order_doc_no)`
- **Index**: `idx_ic_assembly_order_bom` ON `ic_assembly_order (bom_code, doc_date DESC)`
- **คอลัมน์สำคัญ**:
  - `order_doc_no` (`varchar(30)`), `doc_date DATE`, `bom_code`, `fg_item_code`
  - `batch_count NUMERIC(18,4)`, `produced_fg_qty NUMERIC(18,4)`
  - **เอกสารสต็อกคู่ที่สร้างใน `ic_trans`**: `issue_doc_no` (เอกสารเบิกวัตถุดิบ `trans_flag = 56`) และ `receipt_doc_no` (เอกสารรับสินค้าสำเร็จรูป `trans_flag = 54`)
  - สรุปต้นทุนผลิต: `rm_total_cost`, `labor_cost`, `overhead_cost`, `fg_total_cost` (`NUMERIC(18,2)`), `fg_unit_cost` (`NUMERIC(18,4)`), `wh_code`, `shelf_code`

## 2. ตารางสูตรผลิตเดิมใน `02_data_schema.sql`

- **`ic_formular`** (`5087-5102`, Index `code`) & **`ic_formular_detail`** (`5104-5116`): สูตรสินค้าแบบเดิมของ C# *(สะกด `formular` ตาม DDL จริง)* มี `code`, `name_1`, `wage`, `cost` และรายการ `formular_code`, `ic_code`, `unit_code`, `qty`
- **`ic_production_formula`** (`6043-6058`, Index `code`): หัวสูตรผลิตพร้อมช่วงวันที่ (`date_from`, `date_to`)
- **`ic_production_formula_material`** (`6060-6071`, Index `item_code`) & **`ic_production_formula_product`** (`6073-6084`, Index `item_code`): รายการวัตถุดิบเข้า (`formula_code`, `item_code`, `unit_code`, `qty`, `line_number`) และสินค้าผลผลิตออก

## ตัวอย่าง SQL จริง: คำนวณต้นทุนวัตถุดิบตาม BOM และตรวจสอบใบสั่งประกอบคู่เอกสาร `ic_trans`

```sql
SELECT h.bom_code, h.bom_name, h.fg_item_code, h.fg_yield_qty,
       h.labor_cost, h.overhead_cost,
       d.line_number, d.rm_item_code, i.name_1 AS rm_name,
       d.rm_qty, d.scrap_pct,
       ROUND(d.rm_qty * (1 + COALESCE(d.scrap_pct, 0) / 100.0) * COALESCE(i.average_cost, 0), 4) AS est_rm_cost
FROM ic_bom_header h
JOIN ic_bom_detail d ON d.bom_code = h.bom_code
LEFT JOIN ic_inventory i ON i.code = d.rm_item_code
WHERE h.bom_code = $1
ORDER BY d.line_number;
```
