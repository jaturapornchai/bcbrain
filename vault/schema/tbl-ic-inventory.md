---
title: "ic_inventory — ทะเบียนมาสเตอร์สินค้า วิธีต้นทุน ยอดสะสม และกลุ่มบัญชี"
tags: [schema, inventory, master, costing, gl, bcaiaccount]
aliases: [ic_inventory, ทะเบียนสินค้า, ic_account_group, ข้อมูลหลักสินค้า]
sources:
  - scripts/sql/02_data_schema.sql:4787-4803
  - scripts/sql/02_data_schema.sql:4983-4990
  - scripts/sql/02_data_schema.sql:5199-5309
  - scripts/sql/02_data_schema.sql:5604-5615
  - scripts/sql/02_data_schema.sql:5703-5710
  - scripts/sql/02_data_schema.sql:5790-5822
  - scripts/sql/02_data_schema.sql:5879-5933
  - scripts/sql/02_data_schema.sql:6382-6387
  - scripts/sql/04_seed_data.sql:324-364
  - backend/internal/platform/db/pool.go:30
  - backend/internal/application/process/service.go:837
  - backend/internal/application/process/service.go:1100-1166
  - backend/internal/application/process/service.go:1310-1333
  - backend/internal/application/process/item_master.go:18-71
  - backend/internal/application/process/report_menu_ic.go:903-918
  - backend/internal/application/process/workflow.go:135-151
---

# `ic_inventory` — ทะเบียนมาสเตอร์สินค้า วิธีต้นทุน ยอดสะสม และกลุ่มบัญชี

`ic_inventory` คือตารางมาสเตอร์หลักของสินค้า บริการ สินค้าชุด และสูตรผลิตทั้งระบบ เชื่อมตรงกับ [[tbl-ic-trans-detail]] (ผ่าน `item_code`), [[tbl-ic-inventory-detail]] (1:1 ค่าควบคุมขั้นสูง), [[tbl-ic-unit]] (`ic_unit_use`), [[tbl-ic-inventory-barcode]], และ [[tbl-ic-warehouse-shelf]] (`ic_wh_shelf`) โดยระบบ Go (`workflow.go:136-151`) บันทึกความสัมพันธ์การเปลี่ยนรหัส (`changeCodeSpecs["item"]`) ข้ามกว่า 35 ตาราง

## Primary Key / Unique Key และ Indexes

- **ไม่มี SQL `PRIMARY KEY`** ใน `02_data_schema.sql` — ใช้ `roworder SERIAL NOT NULL` และ `idx_ic_inventory_code` ON `ic_inventory (code)` (non-unique ใน DDL; ฝั่ง Go บังคับเอกลักษณ์แบบ case-insensitive `UPPER(code)`)
- **ข้อควรระวังเมื่อสินค้าเดินรายการแล้ว (`item_master.go:34-40`)**: เมื่อสินค้ามีรายการใน `ic_trans_detail` แล้ว คอลัมน์ `unit_type`, `unit_cost`, `unit_standard`, `cost_type` จะถูกล็อกไม่ให้แก้ไขจากหน้าจอสินค้า

## คอลัมน์สำคัญและการใช้งาน

| คอลัมน์ | ชนิดข้อมูล SQL | ความหมาย / ค่า Enum ที่สำคัญ |
|---|---|---|
| `code`, `code_old` | `varchar(25)` | รหัสสินค้าหลัก และรหัสอ้างอิงเดิม |
| `name_1`, `name_2`, `name_eng_1`, `name_eng_2`, `short_name`, `name_market`, `name_for_bill`, `name_for_pos`, `name_for_search` | `varchar(255)` | ชื่อสินค้าหลัก (ไทย), ชื่อรอง, ภาษาอังกฤษ, ชื่อย่อ, ชื่อบนบิล/POS/ค้นหา |
| `item_type` | `smallint` | ประเภทสินค้า (`report_menu_ic.go:912`): `0` = สินค้าทั่วไป, `1` = สินค้าบริการ (ไม่ทำสต๊อก), `2` = สินค้าให้เช่า, `3` = สินค้าชุด (ไม่ทำสต๊อก — แตกบรรทัดลูก `ic_inventory_set_detail`), `4` = สินค้าฝากขาย, `5` = สูตรการผลิต, `6` = สีผสม *(หมายเหตุ: `service.go:1052,1171` ซิงก์ `item_type` ไปยัง `ic_trans_detail` และข้าม `item_type = 5` ตอน Rebuild ต้นทุน)* |
| `cost_type` | `smallint` | วิธีคำนวณต้นทุน (`report_menu_ic.go:913`): `0` = ต้นทุนเฉลี่ย (Moving Average), `1` = ต้นทุน LOT FIFO, `2` = ต้นทุน LOT กำหนดเอง (บังคับระบุ Lot ตอนบันทึก), `3` = ต้นทุน FEFO (วันหมดอายุ), `4` = ต้นทุนมาตรฐาน (`ic_standard_cost`), `5` = ต้นทุนแบบพิเศษ 1 |
| `unit_type` | `smallint` | รูปแบบหน่วยนับ (`report_menu_ic.go:914`): `0` = หน่วยนับเดี่ยว, `1` = หลายหน่วยนับ, `2` = หน่วยนับขนาน, `3` = หลายหน่วยนับ+หน่วยนับขนาน |
| `unit_standard`, `unit_cost`, `unit_standard_name` | `varchar(25)`, `varchar(100)` | หน่วยยอดคงเหลือ (หน่วยมาตรฐานฐาน `stand=1/divide=1`), หน่วยต้นทุน, และชื่อหน่วยฐาน |
| `tax_type` | `smallint` | `0` = สินค้ามี VAT, `1` = สินค้ายกเว้น VAT (ใช้แยกฐานคำนวณใน `ic_trans_detail.tax_type`) |
| `ic_serial_no`, `use_expire`, `qc_product`, `qc_product_retest_day` | `smallint` | `1` = คุม Serial Number (`ic_trans_serial_number`), `1` = คุมวันหมดอายุ (`use_expire`), และคุม QC |
| `balance_qty`, `average_cost`, `average_cost_1`, `fixed_cost`, `item_in_stock` | `numeric` | ยอดคงเหลือสะสมและต้นทุนเฉลี่ยล่าสุด — อัปเดตจาก `rebuildStockTx` (`service.go:1132,1322-1332`) เท่านั้น |
| `balance_qty_2` | `numeric(18,4)` | ยอดคงเหลือตามหน่วยนับขนาน (`pool.go:30`, `service.go:837`) สำหรับสินค้า `unit_type IN (2, 3)` |
| `accrued_in_qty`, `accrued_out_qty`, `book_out_qty` | `numeric` | ยอดค้างรับ (PO ค้างรับ), ค้างส่ง (SO ค้างส่ง), และยอดจอง (`doc_ref_type = 2`) |
| `group_main`, `group_sub`, `group_sub2`, `item_category`, `item_brand`, `item_model`, `item_pattern`, `item_design`, `item_grade`, `item_class`, `item_size`, `item_color`, `item_character`, `ic_discount_group` | `varchar(25)` / `varchar(50)` | คุณลักษณะการจัดหมวดหมู่สินค้า (JOIN ตารางใน [[tbl-ic-promotion-master]] และ [[tbl-ic-unit]]) |
| `account_code_1..4`, `income_type` | `varchar(25)` | รหัสกลุ่มบัญชี (`ic_account_group.code`), ผังบัญชีเฉพาะสินค้า, และประเภทรายได้ |
| `supplier_code`, `manufacturer_code`, `sign_code` | `varchar(25)` | รหัสผู้จำหน่ายหลัก ([[tbl-ap-supplier]]), ผู้ผลิต, และรหัสเครื่องหมาย |
| `medicine_register_number`, `medicine_standard_code`, `tpu_code`, `gpu_code` | `varchar` | ข้อมูลทะเบียนยา / รหัสมาตรฐานยา (สำหรับธุรกิจยา/โรงพยาบาล) |
| `have_point`, `no_discount`, `status`, `item_status`, `update_price`, `update_detail` | `smallint` | เปิดสะสมแต้ม (`1`), ห้ามลดราคา, สถานะใช้งาน (`0` ปกติ), อนุญาตแก้ราคา/รายละเอียด |

## ตารางเสริมในกลุ่ม `ic_inventory` Master

- **`ic_account_group`** (`4787-4803`): กลุ่มบัญชีสินค้า (`code`, `name_1`, `income_acc_code`, `item_acc_code`, `cost_acc_code`, `status`) ใช้ผูกคู่ผังบัญชีรายได้-สินค้าคงเหลือ-ต้นทุนขายอัตโนมัติ (เช่น `AG01`, `AG02` ใน `04_seed_data.sql:324-326`)
- **`ic_description`** (`4983-4990`): คำอธิบายสินค้าแบบยาว (`ic_code`, `description varchar(5000)`)
- **ตารางชื่อเฉพาะทาง (`ic_code`, `name_1`, `name_2`, `remark`, `status`)**:
  - `ic_name_billing` (`5879-5889`) — ชื่อสำหรับพิมพ์บิล
  - `ic_name_merket` (`5893-5903`) — ชื่อการตลาด *(หมายเหตุชื่อตารางสะกด `merket` ใน DDL จริง)*
  - `ic_name_pos` (`5907-5917`) — ชื่อแสดงหน้าขาย POS
  - `ic_name_short` (`5921-5931`) — ชื่อย่อสินค้า
- **`ic_inventory_pictures`** (`5604-5615`): รูปภาพสินค้า (`ic_code`, `guid_code`, `picture_name`, `sort_list`, `date_save`)
- **`ic_inventory_remark`** (`5703-5710`): มาสเตอร์ข้อความหมายเหตุสินค้า (`remark_code`, `remark_desc`)
- **`ic_inventory_thai7`** (`5790-5822`): ตารางซิงก์สินค้าแพลตฟอร์มภายนอก (`code`, `item_detail bytea`, `item_wide/long/high/weight`, `affiliate_item`, `import_item`, `price_out_qty`)
- **`ic_resource`** (`6382-6387`): โครงสร้างตารางฐาน (`roworder`, `ignore_sync`, `is_lock_record`, `create_date_time_now`)

## ตัวอย่าง SQL จริงจากระบบ

### รายงานทะเบียนสินค้าหลัก พร้อมหน่วยคงเหลือ หน่วยต้นทุน หน่วยขนาน และชื่อกลุ่มบัญชี (`report_menu_ic.go:909-917`)

```sql
SELECT i.code,
       COALESCE(i.name_1, '') AS item_name,
       COALESCE(NULLIF(u1.name_1, ''), i.unit_standard, '') AS unit_standard_name,
       COALESCE(NULLIF(u2.name_1, ''), i.unit_cost, '') AS unit_cost_name,
       i.item_type,
       i.cost_type,
       i.unit_type,
       COALESCE(i.balance_qty, 0) AS balance_qty,
       COALESCE(i.average_cost, 0) AS average_cost,
       ag.income_acc_code,
       ag.item_acc_code,
       ag.cost_acc_code
FROM ic_inventory i
LEFT JOIN ic_unit u1 ON u1.code = i.unit_standard
LEFT JOIN ic_unit u2 ON u2.code = i.unit_cost
LEFT JOIN ic_account_group ag ON ag.code = i.account_code_1
WHERE COALESCE(i.status, 0) = 0
ORDER BY i.code;
```
