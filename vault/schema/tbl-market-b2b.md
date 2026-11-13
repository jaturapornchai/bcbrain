---
title: ตารางตลาดส่ง B2B และการสั่งซื้อตัวแทน (market_product_catalog, market_subdealer_profile, market_cart_item, market_b2b_order)
tags:
  - schema
  - market
  - b2b
  - wholesale
aliases:
  - market_product_catalog
  - market_subdealer_profile
  - market_cart_item
  - market_b2b_order
sources:
  - backend/internal/adapter/inbound/http/market/handler.go:1306
  - backend/internal/adapter/inbound/http/market/handler.go:1334
  - backend/internal/adapter/inbound/http/market/handler.go:1351
  - backend/internal/adapter/inbound/http/market/handler.go:1353
  - backend/internal/adapter/inbound/http/market/handler.go:1374
---

# ตารางตลาดส่ง B2B และการสั่งซื้อตัวแทน (`market_*`)

กลุ่มตารางสำหรับระบบ B2B Wholesale Marketplace (`http/market/handler.go:1306-1403`) ที่เชื่อมตัวแทนจำหน่ายย่อย (Sub-dealer) เข้ากับการสั่งซื้อสินค้าราคาส่งแบบขั้นบันได (Tier Pricing), วงเงินเครดิตและรีเบตสะสม (`market_subdealer_profile`), ตะกร้าสินค้า (`market_cart_item`) และคำสั่งซื้อ B2B ที่เชื่อมโยงต่อไปยัง SO ของ ERP, คลัง [[tbl-wms-modern]], รถขนส่ง [[tbl-tms-fleet]] และเอกสาร [[tbl-etax-log]]

---

## 1. `market_product_catalog` — แค็ตตาล็อกสินค้า B2B และราคาขั้นบันได

- **Primary Key**: `roworder serial PRIMARY KEY`
- **คอลัมน์สำคัญ**:
  - `sku_code`, `product_name`, `category_name`, `brand_name`, `unit_code` (`'ลัง'`), `pack_size_desc`
  - ราคาตามจำนวน (Tiered Pricing `numeric(18,2)`): `retail_price`, `tier1_price`, `tier2_min_qty`, `tier2_price`, `tier3_min_qty`, `tier3_price`, `discount_pct`
  - คลังและเรตติ้ง: `stock_qty`, `wms_bin_code` (เชื่อม [[tbl-wms-modern]]), `sold_count`, `rating_score`, `review_count`, `is_flash_deal`, `is_mall_official`, `badge_text`, `image_key`, `image_thumb_key`, `evidence_photos_json`

---

## 2. `market_subdealer_profile` — โปรไฟล์ตัวแทนจำหน่ายและวงเงินเครดิต B2B

- **Primary Key**: `roworder serial PRIMARY KEY`
- **คอลัมน์สำคัญ**:
  - `dealer_code`, `dealer_name`, `dealer_tier` (เชื่อมรหัสลูกค้า `ar_customer.code`)
  - วงเงินและรีเบต (`numeric(18,2)`): `credit_limit`, `credit_used`, `credit_available`, `credit_term_days`, `rebate_accumulated`, `credit_used_opening` *(เพิ่มแบบ `NULL` ที่ L1351)*, `rebate_opening` *(เพิ่มแบบ `NULL` ที่ L1352)*
  - การจัดส่ง: `delivery_zone`, `delivery_address`, `contact_phone`

---

## 3. `market_cart_item` — ตะกร้าสั่งซื้อ B2B

- **Primary Key**: `roworder serial PRIMARY KEY`
- **คอลัมน์สำคัญ**: `cart_id`, `dealer_code` (`'AR-0001'`), `sku_code`, `product_name`, `unit_code`, `pack_size_desc`, `order_qty`, `retail_price`, `applied_unit_price`, `applied_tier_label`, `line_total`, `line_savings`, `wms_bin_code`

---

## 4. `market_b2b_order` — คำสั่งซื้อ B2B ที่เชื่อมต่อครบ Loop (ERP / WMS / TMS / e-Tax)

- **Primary Key**: `roworder serial PRIMARY KEY`
- **คอลัมน์สำคัญ**:
  - คำสั่งซื้อและยอดเงิน: `order_no`, `order_date`, `dealer_code`, `dealer_name`, `dealer_tier`, `order_type`, `item_summary`, `total_sku_count`, `total_qty`, `gross_amount`, `tier_discount_amount`, `voucher_code`, `voucher_discount_amount`, `vat_amount`, `net_order_amount`
  - สถานะและการเชื่อมโมดูลปลายทาง: `order_status` (`'WMS_PACKING'` ฯลฯ), `erp_so_doc_no` (SO ใน ERP), `wms_doc_no` (ใบงานคลัง [[tbl-wms-modern]]), `tms_trip_no` (ทริปจัดส่ง [[tbl-tms-fleet]]), `etax_doc_no` (ใบกำกับ [[tbl-etax-log]])

---

## 5. ตัวอย่าง SQL Query

```sql
-- สรุปสถานะคำสั่งซื้อ B2B พร้อมวงเงินเครดิตคงเหลือของตัวแทนและเอกสารปลายทาง
SELECT
    o.order_no,
    o.order_date,
    o.dealer_code,
    o.dealer_name,
    o.order_status,
    o.net_order_amount::NUMERIC(18,2) AS net_order_amount,
    p.credit_limit::NUMERIC(18,2) AS credit_limit,
    p.credit_available::NUMERIC(18,2) AS credit_available,
    o.erp_so_doc_no,
    o.wms_doc_no,
    o.tms_trip_no,
    o.etax_doc_no
FROM market_b2b_order o
LEFT JOIN market_subdealer_profile p
  ON p.dealer_code = o.dealer_code
ORDER BY o.roworder DESC;
```
