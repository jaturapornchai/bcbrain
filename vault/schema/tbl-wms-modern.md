---
title: ตารางคลังสินค้าสมัยใหม่ WMS (wms_stock_bin, wms_fulfillment_order, wms_movement_log)
tags:
  - schema
  - wms
  - warehouse
  - fulfillment
aliases:
  - wms_stock_bin
  - wms_fulfillment_order
  - wms_movement_log
sources:
  - backend/internal/adapter/inbound/http/wms/handler.go:1207
  - backend/internal/adapter/inbound/http/wms/handler.go:1209
  - backend/internal/adapter/inbound/http/wms/handler.go:1229
  - backend/internal/adapter/inbound/http/wms/handler.go:1255
---

# ตารางคลังสินค้าสมัยใหม่ WMS (`wms_*`)

กลุ่มตารางปฏิบัติการคลังสินค้าระดับ Bin Location (จัดการสต็อกจริงตามชั้นวาง, คิวหยิบ-แพ็คสินค้า, และประวัติการย้าย Bin) ที่ถูกสร้างอัตโนมัติใน `http/wms/handler.go:1207-1275` *(สำหรับตาราง WMS ดั้งเดิมใน `02_data_schema.sql` ดู [[tbl-wms-legacy]])*

---

## 1. `wms_stock_bin` — สต็อกสินค้าคงเหลือแยกตาม Bin / Lot / วันหมดอายุ

- **วัตถุประสงค์**: เก็บยอดคงเหลือเชิงกายภาพ (`physical_qty`), ยอดจองรอหยิบ (`reserved_pick_qty`) และยอดรอจัดเก็บ (`inbound_putaway_qty`) แยกตามรหัสคลัง โซน Bin และ Lot/EXP
- **Primary Key**: `roworder SERIAL PRIMARY KEY`

### คอลัมน์สำคัญ

| คอลัมน์ | ชนิดข้อมูล (SQL) | ค่าเริ่มต้น | ความหมาย |
| :--- | :--- | :--- | :--- |
| `ic_code`, `ic_name`, `unit_code` | `varchar(50)` / `varchar(255)` | `''` | รหัสสินค้า ชื่อสินค้า และหน่วยนับ (เชื่อม `ic_inventory` ใน [[schema-overview]]) |
| `wh_code`, `zone_code`, `bin_code` | `varchar(80)` / `varchar(40)` | `'ZONE-A'`, `'A-01-01'` | รหัสคลัง, โซน และตำแหน่งช่องวาง Bin |
| `velocity_class` | `varchar(60)` | `'A (Fast-Moving)'` | ระดับความเร็วหมุนเวียนสินค้า (ABC Analysis) |
| `lot_no`, `exp_date` | `varchar(60)`, `varchar(40)` | `''` | เลข Lot และวันหมดอายุ (FEFO) |
| `physical_qty` | `numeric(18,2)` | `0` | จำนวนสินค้าจริงบน Bin |
| `reserved_pick_qty` | `numeric(18,2)` | `0` | จำนวนที่ถูกจองรอหยิบให้ใบสั่งขาย |
| `inbound_putaway_qty` | `numeric(18,2)` | `0` | จำนวนรับเข้าที่รอ Put-away ขึ้นชั้น |
| `min_safety_qty`, `max_bin_capacity` | `numeric(18,2)` | `50`, `500` | จุดสั่งเติมต่ำสุด และความจุสูงสุดของ Bin |
| `last_counted_at`, `image_url` | `varchar(40)`, `text` | `''` | วันที่ตรวจนับล่าสุด และรูปอ้างอิง |

---

## 2. `wms_fulfillment_order` — คิวงานหยิบ แพ็ค และเตรียมจัดส่ง (Pick / Pack)

- **วัตถุประสงค์**: ติดตามสถานะการเบิกจ่ายสินค้าตามใบขาย/ใบส่งของจาก ERP (`erp_inv_doc_no`) ตั้งแต่รอหยิบ แพ็คกล่อง ชั่งน้ำหนัก จนส่งต่อให้โมดูล [[tbl-tms-fleet]]
- **Primary Key**: `roworder SERIAL PRIMARY KEY`

### คอลัมน์สำคัญ

| คอลัมน์ | ชนิดข้อมูล (SQL) | ค่าเริ่มต้น | ความหมาย |
| :--- | :--- | :--- | :--- |
| `wms_doc_no` | `varchar(50)` | `''` | เลขที่ใบงานคลัง WMS |
| `erp_inv_doc_no`, `erp_doc_date` | `varchar(50)`, `varchar(30)` | `''` | เลขที่และวันที่เอกสารขาย/เบิกต้นทางใน ERP (`ic_trans.doc_no`) |
| `cust_code`, `cust_name` | `varchar(50)`, `varchar(255)` | `''` | รหัสและชื่อลูกค้า |
| `ic_code`, `ic_name`, `unit_code`, `bin_code`, `qty` | `varchar` / `numeric(18,2)` | - | สินค้า, ตำแหน่ง Bin ที่ไปหยิบ และจำนวนที่ต้องจัดส่ง |
| `stage` | `varchar(40)` | `'WAITING_PICK'` | ขั้นตอนงานคลัง (เช่น `'WAITING_PICK'`, กำลังหยิบ, แพ็คแล้ว, ส่งมอบขนส่ง) |
| `priority`, `picker_name` | `varchar(60)`, `varchar(150)` | - | ระดับความเร่งด่วน และชื่อพนักงานหยิบสินค้า |
| `carrier_name`, `tracking_no` | `varchar(150)`, `varchar(80)` | `''` | ชื่อผู้ขนส่งและเลข Tracking |
| `box_count`, `weight_kg` | `integer`, `numeric(12,2)` | `1`, `0` | จำนวนกล่องและน้ำหนักรวม (กก.) |
| `pack_image_key`, `pack_image_thumb_key`, `evidence_photos_json` | `text` | `''`, `'[]'` | คีย์ภาพถ่ายหลักฐานตอนแพ็คกล่อง |

---

## 3. `wms_movement_log` — ประวัติเคลื่อนไหวและตรวจนับเทียบยอดบัญชี

- **วัตถุประสงค์**: บันทึก Audit Trail ทุกการย้าย Bin (`INBOUND_PUTAWAY`, เบิกหยิบ, โอนย้าย, ปรับนับ) พร้อมบันทึกยอดก่อน-หลังและยอดคงเหลือทางบัญชี (`erp_accounting_qty`) เพื่อเทียบกระทบยอด
- **Primary Key**: `roworder SERIAL PRIMARY KEY`
- **คอลัมน์สำคัญ**: `move_doc_no`, `move_type` (`'INBOUND_PUTAWAY'` ฯลฯ), `ref_erp_doc`, `ic_code`, `ic_name`, `unit_code`, `from_bin`, `to_bin`, `qty`, `before_physical_qty`, `after_physical_qty`, `erp_accounting_qty`, `staff_name`, `note_text`, `image_key`, `image_thumb_key`, `evidence_photos_json`, `created_at`

---

## 4. รูปแบบการ JOIN และตัวอย่าง SQL Query

- **เชื่อมคำสั่งจัดส่งกับคลังและ TMS**: `wms_fulfillment_order.wms_doc_no` และ `erp_inv_doc_no` ใช้เชื่อมต่อไปยัง `tms_delivery_stop` ใน [[tbl-tms-fleet]]
- **เช็กยอดพร้อมหยิบราย Bin**: `physical_qty - reserved_pick_qty` จาก `wms_stock_bin`

### ตัวอย่าง: ค้นหา Bin ที่มีสินค้าพร้อมหยิบ และรายการใกล้ถึงจุด Min Safety
```sql
SELECT
    ic_code,
    ic_name,
    wh_code,
    zone_code,
    bin_code,
    lot_no,
    exp_date,
    physical_qty::NUMERIC(18,2) AS physical_qty,
    reserved_pick_qty::NUMERIC(18,2) AS reserved_pick_qty,
    (physical_qty - reserved_pick_qty)::NUMERIC(18,2) AS available_to_pick,
    min_safety_qty::NUMERIC(18,2) AS min_safety_qty
FROM wms_stock_bin
WHERE (physical_qty - reserved_pick_qty) <= min_safety_qty
   OR reserved_pick_qty > 0
ORDER BY (physical_qty - reserved_pick_qty) ASC, ic_code, bin_code;
```
