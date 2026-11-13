---
title: ตารางศูนย์บริการรถยนต์ AutoCare (autocare_vehicle, autocare_tire_dot_stock, autocare_service_bay, autocare_job_order)
tags:
  - schema
  - autocare
  - service
  - workshop
aliases:
  - autocare_vehicle
  - autocare_tire_dot_stock
  - autocare_service_bay
  - autocare_technician_wallet
  - autocare_job_order
  - autocare_job_item
  - autocare_tire_hotel
  - autocare_warranty_claim
  - autocare_blind_receiving
  - autocare_member_coupon
sources:
  - backend/internal/adapter/inbound/http/autocare/seed.go:31
  - backend/internal/adapter/inbound/http/autocare/seed.go:46
  - backend/internal/adapter/inbound/http/autocare/seed.go:75
  - backend/internal/adapter/inbound/http/autocare/seed.go:94
  - backend/internal/adapter/inbound/http/autocare/seed.go:109
  - backend/internal/adapter/inbound/http/autocare/seed.go:153
  - backend/internal/adapter/inbound/http/autocare/seed.go:172
  - backend/internal/adapter/inbound/http/autocare/seed.go:192
  - backend/internal/adapter/inbound/http/autocare/seed.go:213
  - backend/internal/adapter/inbound/http/autocare/seed.go:232
---

# ตารางศูนย์บริการรถยนต์ AutoCare (`autocare_*`)

กลุ่มตารางสำหรับระบบอู่ซ่อมรถ, ศูนย์ยาง Fast-Fit, ศูนย์ EV และ Car Care/ฟิล์มกรองแสง ทั้งหมด 10 ตาราง ถูกสร้างอัตโนมัติใน `ensureSchemaAndSeed` (`http/autocare/seed.go:29-265`) และเชื่อมโยงกับมาสเตอร์ ERP (`ar_customer`, `ic_warehouse`, `ic_shelf`, `ic_inventory`, `ic_trans`, `gl_journal`) ผ่านรหัสอ้างอิง `cust_code`, `item_code`, `bc_doc_no`, `bc_purchase_doc_no`

---

## 1. ตารางมาสเตอร์รถ ยาง DOT ช่องซ่อม และช่าง

### `autocare_vehicle` — ทะเบียนรถและประวัติบำรุงรักษา
- **Primary Key / Unique**: `roworder SERIAL PRIMARY KEY`, `plate_no VARCHAR(40) UNIQUE NOT NULL`
- **คอลัมน์สำคัญ**:
  - ข้อมูลรถ: `plate_no`, `province`, `vin_no`, `brand`, `model`, `model_year`, `powertrain` (`'ICE'` / EV), `color`, `odometer_km`
  - เจ้าของ & Fleet: `cust_code` (เชื่อม `ar_customer`), `cust_name`, `cust_phone`, `line_id`, `loyalty_tier`, `loyalty_points`, `is_fleet` (`BOOLEAN`), `fleet_company`, `fleet_credit_limit` (`NUMERIC(18,2)`)
  - ยาง & นัดหมาย: `tire_size_front`, `tire_size_rear`, `last_tire_dot`, `free_rotation_used`, `free_rotation_total`, `next_rotation_km`, `next_oil_km`, `next_oil_date`, `act_exp_date` (พ.ร.บ.), `tax_exp_date` (ภาษีรถ), `ins_exp_date` (ประกันภัย), `ins_company`

### `autocare_tire_dot_stock` — สต็อกยางแยกสัปดาห์/ปี DOT (FEFO)
- **Primary Key / Unique**: `roworder SERIAL PRIMARY KEY`, `sku_dot_id VARCHAR(60) UNIQUE NOT NULL`
- **คอลัมน์สำคัญ**: `item_code` (เชื่อม `ic_inventory`), `item_name`, `business_mode` (`'tire_fastfit'`), `brand`, `tire_size_display`, `quick_size_digits`, `dot_code`, `dot_week`, `dot_year`, `fefo_status` (`'FRESH'` ฯลฯ), `fefo_alert_label`, `part_grade`, `wh_code`, `shelf_code`, `qty_on_hand`, `unit_code`, `sale_price`, `promo_price`, `turn_in_credit`, `tech_commission`, `warranty_months`, `warranty_km`, `compatible_models`

### `autocare_service_bay` — สถานะช่องซ่อม / ฮอยท์ยก (Bay Board)
- **Primary Key / Unique**: `roworder SERIAL PRIMARY KEY`, `bay_code VARCHAR(30) UNIQUE NOT NULL`
- **คอลัมน์สำคัญ**: `bay_name`, `bay_type` (`'FAST_FIT_HOIST'`), `business_mode`, `status` (`'AVAILABLE'` ฯลฯ), `current_job_no`, `current_plate_no`, `current_vehicle_model`, `tech_code`, `tech_name`, `progress_pct`, `started_at`, `est_finish_at`, `jobs_today`, `revenue_today`, `profit_margin_pct`

### `autocare_technician_wallet` — กระเป๋าค่ามือและค่าคอมมิชชั่นช่าง
- **Primary Key / Unique**: `roworder SERIAL PRIMARY KEY`, `tech_code VARCHAR(40) UNIQUE NOT NULL`
- **คอลัมน์สำคัญ**: `tech_name`, `role_title`, `specialty`, `assigned_bay`, `active_job_no`, `jobs_completed_today`, `jobs_completed_month`, `labor_fee_today`, `commission_today`, `wallet_balance_month`, `rating_score` (`NUMERIC(4,2)`)

---

## 2. ใบงานซ่อม (Job Order) และรายการอะไหล่/ค่าแรง

### `autocare_job_order` — หัวใบเปิดงานซ่อม (Repair Order)
- **Primary Key / Unique**: `roworder SERIAL PRIMARY KEY`, `job_no VARCHAR(40) UNIQUE NOT NULL`
- **คอลัมน์สำคัญ**:
  - รถและลูกค้า: `job_date`, `job_time`, `business_mode`, `service_title`, `plate_no`, `vin_no`, `vehicle_brand_model`, `powertrain`, `odometer_km`, `fuel_level_pct`, `cust_code`, `cust_name`, `cust_phone`, `loyalty_tier`
  - การมอบหมายงาน: `bay_code`, `sa_name`, `tech_code`, `tech_name`, `status` (`'IN_BAY_REPAIR'` ฯลฯ), `progress_pct`
  - ตรวจสภาพดิจิทัล: `precheck_4rim_json`, `customer_signature_name`, `dvi_35point_json`, `upsell_items_json`, `carcare_spec_json`
  - การเงินและ Post เข้า ERP: `subtotal_parts`, `subtotal_labor`, `turn_in_discount`, `coupon_discount`, `owner_special_discount`, `discount_request_status`, `discount_approved_by`, `vat_amount`, `grand_total`, `tech_commission_amt`, `payment_method`, `accounting_posted` (`BOOLEAN`), `bc_doc_no` (`ic_trans.doc_no`), `bc_gl_posted` (`BOOLEAN`)

### `autocare_job_item` — บรรทัดอะไหล่และค่าแรงในใบงาน
- **Primary Key**: `roworder SERIAL PRIMARY KEY` (เชื่อม `autocare_job_order.job_no`)
- **คอลัมน์สำคัญ**: `job_no`, `line_no`, `item_code`, `item_name`, `item_category` (`'TIRE'` ฯลฯ), `part_grade`, `dot_code`, `qty`, `unit_code`, `unit_price`, `discount_amt`, `line_total`, `tech_fee_amt`, `is_upsell_approved` (`BOOLEAN`), `warranty_months`, `warranty_km`

---

## 3. ตารางบริการต่อเนื่อง: ฝากยาง เคลม รับของไม่เห็นทุน คูปองแพ็กเกจ

| ตาราง | Unique Key | วัตถุประสงค์และคอลัมน์สำคัญ |
| :--- | :--- | :--- |
| `autocare_tire_hotel` | `storage_no` | รับฝากยางลูกค้า (Tire Hotel): `cust_code`, `plate_no`, `storage_type` (`'CUSTOMER_DEPOSIT'`), `tire_brand_model`, `tire_size`, `dot_code`, `qty`, `tread_depth_mm`, `zone_bin_location`, `deposit_date`, `expire_date`, `status` (`'STORED'`) |
| `autocare_warranty_claim` | `claim_no` | เคลมประกันยาง/อะไหล่: `warranty_no`, `job_no`, `bc_doc_no`, `plate_no`, `claim_type` (`'TIRE_DAMAGE'`), `item_code`, `dot_or_serial`, `issue_detail`, `factory_vendor_code`, `status` (`'REGISTERED'`), `replacement_doc_no` |
| `autocare_blind_receiving` | `recv_no` | ตรวจรับสินค้าหน้าคลังแบบปิดราคาทุน (`cost_masked = TRUE`): `supplier_code`, `delivery_note_no`, `wh_code`, `shelf_code`, `total_items_qty`, `dot_batches`, `status` (`'PENDING_ACCOUNTING_COST'`), `bc_purchase_doc_no` (เชื่อมเอกสารซื้อ `ic_trans`) |
| `autocare_member_coupon` | `coupon_code` | คูปองแพ็กเกจล้างรถ/เคลือบแก้ว/ตั้งศูนย์: `cust_code`, `plate_no`, `package_name`, `business_mode`, `total_uses`, `used_count`, `remaining_uses`, `unit_value`, `expire_date`, `status` (`'ACTIVE'`) |

---

## 4. รูปแบบการ JOIN และตัวอย่าง SQL Query

- **ใบงานซ่อมครบชุด**: `autocare_job_order o JOIN autocare_job_item i ON i.job_no = o.job_no LEFT JOIN autocare_vehicle v ON v.plate_no = o.plate_no`
- **เชื่อมบิลขาย ERP**: เมื่อ `o.accounting_posted = TRUE` ใช้ `o.bc_doc_no` เชื่อม `ic_trans.doc_no` (ดู [[schema-overview]])

### ตัวอย่าง 1: ใบงานซ่อมที่ปิดยอดแล้วแต่ยังรอ Post บัญชี/GL และใบรับของรอฝ่ายบัญชีใส่ราคาทุน
```sql
SELECT
    o.job_no,
    o.job_date,
    o.plate_no,
    o.cust_name,
    o.status,
    o.grand_total::NUMERIC(18,2) AS grand_total,
    o.accounting_posted,
    o.bc_gl_posted,
    o.bc_doc_no
FROM autocare_job_order o
WHERE o.accounting_posted = FALSE
   OR o.bc_gl_posted = FALSE
ORDER BY o.job_date DESC, o.job_no;
```

### ตัวอย่าง 2: ตรวจสอบยางค้างสต็อกแยกตามปี DOT เพื่อเร่งระบาย (FEFO)
```sql
SELECT
    sku_dot_id,
    item_code,
    item_name,
    brand,
    tire_size_display,
    dot_code,
    dot_year,
    dot_week,
    fefo_status,
    wh_code,
    shelf_code,
    qty_on_hand::NUMERIC(18,2) AS qty_on_hand,
    promo_price::NUMERIC(18,2) AS promo_price
FROM autocare_tire_dot_stock
WHERE qty_on_hand > 0
ORDER BY dot_year ASC, dot_week ASC, item_code;
```
