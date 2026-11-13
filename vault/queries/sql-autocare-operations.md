---
title: "SQL Operations: ระบบศูนย์บริการรถยนต์และยาง AutoCare (Job Order, ฮอยท์, ยาง DOT FEFO, ช่าง, เคลม และ Tire Hotel)"
audience: dev
tags:
  - sql
  - autocare
  - job-order
  - tire-dot
  - fefo
  - warranty
  - technician
  - dev
aliases:
  - sql-autocare
  - query-autocare-operations
  - query-tire-dot-fefo
sources:
  - backend/internal/adapter/inbound/http/autocare/seed.go:31-271
  - backend/internal/adapter/inbound/http/autocare/handler.go:350-2350
  - backend/internal/application/process/report_menu_autocare.go:10-454
---

# SQL Operations: ศูนย์บริการรถยนต์และยาง AutoCare

> กติกาหลัก: ใช้ `[[dev-rules-accounting-sql]]` เสมอ — คอลัมน์วันที่ของ `autocare_job_order.job_date`, `autocare_tire_hotel.expire_date`, `autocare_warranty_claim.claim_date` เป็นชนิด `DATE` ตรงตาม `seed.go` — ดูรายการรายงาน AutoCare 5 เมนู (`ac_res_*`) ที่ [[api-report-catalog]] และ API ที่ [[api-rest-ops-ext]]

---

## 1. คิวงานซ่อม Job Order และรายละเอียดรายการอะไหล่/ค่าแรง (`autocare_job_order`, `autocare_job_item`)

สถานะมาตรฐานของ `autocare_job_order.status`: `INTAKE_PRECHECK`, `ESTIMATE_PENDING`, `IN_BAY_REPAIR`, `QC_READY`, `BILLED_POSTED`.

```sql
SELECT j.job_no,
       j.job_date,
       j.job_time,
       j.business_mode,
       j.plate_no,
       j.vin_no,
       j.vehicle_brand_model,
       j.powertrain,
       j.odometer_km,
       j.cust_code,
       j.cust_name,
       j.loyalty_tier,
       j.bay_code,
       j.sa_name,
       j.tech_code,
       j.tech_name,
       j.status,
       j.progress_pct,
       j.subtotal_parts::numeric(18, 2) AS subtotal_parts,
       j.subtotal_labor::numeric(18, 2) AS subtotal_labor,
       (j.turn_in_discount + j.coupon_discount + j.owner_special_discount)::numeric(18, 2) AS total_discounts,
       j.discount_request_status,
       j.vat_amount::numeric(18, 2) AS vat_amount,
       j.grand_total::numeric(18, 2) AS grand_total,
       j.tech_commission_amt::numeric(18, 2) AS tech_commission_amt,
       j.payment_method,
       j.accounting_posted,
       j.bc_doc_no,
       j.bc_gl_posted
FROM autocare_job_order j
WHERE j.job_date BETWEEN $1::date AND $2::date
  AND ($3 = '' OR j.status = $3)
ORDER BY j.job_date DESC, j.roworder DESC;
```

### 1.1 รายการอะไหล่ ยาง DOT และค่าแรงราย Job (`autocare_job_item` + Cross-check Ledger `ic_trans`)

```sql
SELECT ji.job_no,
       j.job_date,
       j.bc_doc_no,
       j.plate_no,
       ji.line_no,
       ji.item_code,
       ji.item_name,
       ji.item_category,
       ji.part_grade,
       ji.dot_code,
       ji.qty::numeric(18, 2) AS qty,
       ji.unit_code,
       ji.unit_price::numeric(18, 2) AS unit_price,
       ji.discount_amt::numeric(18, 2) AS discount_amt,
       ji.line_total::numeric(18, 2) AS line_total,
       ji.tech_fee_amt::numeric(18, 2) AS tech_fee_amt,
       ji.is_upsell_approved,
       ji.warranty_months,
       ji.warranty_km,
       COALESCE(t.total_amount, 0)::numeric(18, 2) AS posted_erp_total_amount
FROM autocare_job_item ji
JOIN autocare_job_order j ON j.job_no = ji.job_no
LEFT JOIN ic_trans t
       ON t.doc_no = j.bc_doc_no
      AND t.trans_flag = 44
      AND COALESCE(t.last_status, 0) = 0
WHERE j.job_date BETWEEN $1::date AND $2::date
ORDER BY j.job_date DESC, ji.job_no, ji.line_no;
```

---

## 2. สต็อกยางแยก DOT และเรียงจ่าย FEFO (`autocare_tire_dot_stock`)

เปรียบเทียบกับล็อตสินค้าทั่วไปใน [[sql-ic-lot-fefo-expiry]] — ตารางเฉพาะของ AutoCare เก็บ `dot_code`, `dot_week`, `dot_year` และ `fefo_status`:

```sql
SELECT s.sku_dot_id,
       s.item_code,
       s.item_name,
       s.brand,
       s.tire_size_display,
       s.quick_size_digits,
       s.dot_code,
       s.dot_year,
       s.dot_week,
       s.fefo_status,
       s.fefo_alert_label,
       s.part_grade,
       s.wh_code,
       s.shelf_code,
       s.qty_on_hand::numeric(18, 2) AS qty_on_hand,
       s.unit_code,
       s.sale_price::numeric(18, 2) AS sale_price,
       s.promo_price::numeric(18, 2) AS promo_price,
       s.turn_in_credit::numeric(18, 2) AS turn_in_credit,
       s.tech_commission::numeric(18, 2) AS tech_commission,
       s.warranty_months,
       s.warranty_km
FROM autocare_tire_dot_stock s
WHERE s.qty_on_hand > 0
  AND ($1 = '' OR s.quick_size_digits = $1 OR s.tire_size_display ILIKE '%' || $1 || '%')
ORDER BY s.dot_year ASC, s.dot_week ASC, s.item_code;
```

---

## 3. กระดานช่องซ่อม (Hoist/Bay) และกระเป๋าค่าแรง/คอมมิชชันช่าง (`autocare_service_bay`, `autocare_technician_wallet`)

```sql
SELECT b.bay_code,
       b.bay_name,
       b.bay_type,
       b.business_mode,
       b.status AS bay_status,
       b.current_job_no,
       b.current_plate_no,
       b.current_vehicle_model,
       b.progress_pct,
       b.started_at,
       b.est_finish_at,
       b.jobs_today,
       b.revenue_today::numeric(18, 2) AS revenue_today,
       b.profit_margin_pct::numeric(8, 2) AS profit_margin_pct,
       w.tech_code,
       w.tech_name,
       w.role_title,
       w.specialty,
       w.jobs_completed_today,
       w.jobs_completed_month,
       w.labor_fee_today::numeric(18, 2) AS labor_fee_today,
       w.commission_today::numeric(18, 2) AS commission_today,
       w.wallet_balance_month::numeric(18, 2) AS wallet_balance_month,
       w.rating_score::numeric(4, 2) AS rating_score
FROM autocare_service_bay b
LEFT JOIN autocare_technician_wallet w ON w.tech_code = b.tech_code
ORDER BY b.bay_code;
```

---

## 4. ทะเบียนรถ เตือน พ.ร.บ./ภาษี/เช็คระยะ, Tire Hotel, เคลมยาง และคูปองแพ็กเกจ

### 4.1 รถลูกค้าที่ใกล้ครบกำหนดสลับยาง เปลี่ยนถ่ายน้ำมันเครื่อง พ.ร.บ. หรือประกัน (`autocare_vehicle`)

```sql
SELECT v.plate_no,
       v.province,
       v.brand,
       v.model,
       v.model_year,
       v.powertrain,
       v.odometer_km,
       v.cust_code,
       v.cust_name,
       v.loyalty_tier,
       v.loyalty_points,
       v.last_tire_dot,
       (v.free_rotation_total - v.free_rotation_used) AS free_rotation_remaining,
       v.next_rotation_km,
       v.next_oil_km,
       v.next_oil_date,
       v.act_exp_date,
       v.tax_exp_date,
       v.ins_exp_date,
       v.ins_company
FROM autocare_vehicle v
WHERE v.next_oil_date <= CURRENT_DATE + INTERVAL '30 days'
   OR v.act_exp_date <= CURRENT_DATE + INTERVAL '30 days'
   OR v.tax_exp_date <= CURRENT_DATE + INTERVAL '30 days'
   OR v.ins_exp_date <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY LEAST(v.next_oil_date, v.act_exp_date, v.tax_exp_date, v.ins_exp_date) ASC;
```

### 4.2 Tire Hotel, เคลมประกันโรงงาน, Blind Receiving และคูปองแพ็กเกจ

```sql
SELECT storage_no,
       cust_code,
       cust_name,
       plate_no,
       tire_brand_model,
       tire_size,
       dot_code,
       qty,
       tread_depth_mm,
       zone_bin_location,
       deposit_date,
       expire_date,
       status
FROM autocare_tire_hotel
WHERE status = 'STORED'
ORDER BY expire_date ASC, storage_no;
```

ตรวจงานเคลมรับประกันและงานรับของเข้าคลังแบบปิดบังราคาทุน (`cost_masked = TRUE` รอบัญชีลงต้นทุน):

```sql
SELECT claim_no,
       warranty_no,
       job_no,
       bc_doc_no,
       plate_no,
       claim_type,
       item_code,
       item_name,
       dot_or_serial,
       factory_vendor_code,
       factory_vendor_name,
       claim_date,
       status,
       replacement_doc_no
FROM autocare_warranty_claim
WHERE status <> 'CLOSED'
ORDER BY claim_date DESC, claim_no;
```

```sql
SELECT recv_no,
       recv_date,
       recv_time,
       supplier_code,
       supplier_name,
       delivery_note_no,
       wh_code,
       shelf_code,
       total_items_qty,
       dot_batches,
       cost_masked,
       status,
       bc_purchase_doc_no
FROM autocare_blind_receiving
WHERE status = 'PENDING_ACCOUNTING_COST'
ORDER BY recv_date DESC, recv_no;
```

```sql
SELECT coupon_code,
       cust_code,
       cust_name,
       plate_no,
       package_name,
       business_mode,
       total_uses,
       used_count,
       remaining_uses,
       unit_value::numeric(18, 2) AS unit_value,
       expire_date,
       status
FROM autocare_member_coupon
WHERE status = 'ACTIVE'
  AND remaining_uses > 0
ORDER BY expire_date ASC, coupon_code;
```

หมายเหตุ: พารามิเตอร์ใน §1 ใช้ `$1::date`, `$2::date`, `$3` (สถานะ Job หรือ `''` เพื่อดูทั้งหมด) และ §2 ใช้ `$1` (ตัวเลขขนาดยาง เช่น `'2055516'` หรือ `''`) — ดูรายละเอียดโครงสร้างเอกสาร GL ที่สร้างหลังปิดบิล AutoCare ได้ที่ [[sql-overview]]
