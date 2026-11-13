---
title: "SQL Operations: e-Tax, จัดซื้อ Procure, ตลาด B2B Market และ CRM"
audience: dev
tags:
  - sql
  - etax
  - procure
  - b2b-market
  - crm
  - 3way-match
  - dev
aliases:
  - sql-etax
  - sql-procure
  - sql-market
  - sql-crm
  - query-ext-etax-procure-market-crm
sources:
  - backend/internal/adapter/inbound/http/etax/handler.go:592-622
  - backend/internal/adapter/inbound/http/procure/handler.go:1797-1900
  - backend/internal/adapter/inbound/http/market/handler.go:1306-1404
  - backend/internal/adapter/inbound/http/crm/handler.go:1694-1790
---

# SQL Operations: e-Tax, จัดซื้อ Procure, ตลาด B2B Market และ CRM

> กติกาหลัก: ใช้ `[[dev-rules-accounting-sql]]` เสมอ — ตาราง Extension หลายตัวเก็บ `doc_date` เป็น `varchar` เพื่อรองรับรูปแบบไทยและ ISO จึงไม่ควร cast `::date` โดยตรงหากไม่ได้ Validate รูปแบบก่อน; คำนวณค่าเงินทุกชนิดด้วย `NUMERIC` เท่านั้น — ดู REST endpoints ของโมดูลเหล่านี้ที่ [[api-rest-ops-ext]]

---

## 1. ประวัติเอกสาร e-Tax Invoice / e-Receipt และ ETDA Timestamp (`etax_document_log`)

เชื่อมโยงเอกสาร e-Tax กับ `ic_trans` ของระบบบัญชี ERP (`erp_ref_doc_no`), คลัง (`wms_ref_doc_no`), ขนส่ง (`tms_ref_trip_no`) และจัดซื้อ (`procure_ref_po_no`):

```sql
SELECT e.etax_doc_no,
       e.doc_type,
       e.doc_date,
       e.erp_ref_doc_no,
       e.wms_ref_doc_no,
       e.tms_ref_trip_no,
       e.procure_ref_po_no,
       e.party_code,
       e.party_name,
       e.party_tax_id,
       e.branch_code,
       e.base_amount::numeric(18, 2) AS base_amount,
       e.vat_rate::numeric(10, 2) AS vat_rate,
       e.vat_amount::numeric(18, 2) AS vat_amount,
       e.wht_rate::numeric(10, 2) AS wht_rate,
       e.wht_amount::numeric(18, 2) AS wht_amount,
       e.total_amount::numeric(18, 2) AS total_amount,
       e.etda_status,
       e.etda_timestamp_token,
       e.xml_standard,
       e.ocr_confidence_pct::numeric(10, 2) AS ocr_confidence_pct,
       e.slip_verify_status,
       COALESCE(t.total_amount, 0)::numeric(18, 2) AS erp_doc_total_amount,
       COALESCE(t.last_status, 0) AS erp_last_status,
       e.updated_at
FROM etax_document_log e
LEFT JOIN ic_trans t ON t.doc_no = e.erp_ref_doc_no
WHERE ($1 = '' OR e.etda_status = $1)
  AND ($2 = '' OR e.doc_type = $2)
ORDER BY e.roworder DESC
LIMIT 200;
```

---

## 2. จัดซื้อ 3-Way Matching และเจรจาราคา RFQ (`procure_*`)

### 2.1 ตรวจจับ PO กับรับเข้าคลัง WMS และใบกำกับภาษีเจ้าหนี้ AP (`procure_purchase_order`)

```sql
SELECT po_doc_no,
       pr_ref_no,
       doc_date,
       ap_code,
       ap_name,
       ic_code,
       ic_name,
       unit_code,
       target_bin,
       order_qty::numeric(18, 2) AS order_qty,
       received_wms_qty::numeric(18, 2) AS received_wms_qty,
       invoiced_ap_qty::numeric(18, 2) AS invoiced_ap_qty,
       (order_qty - received_wms_qty)::numeric(18, 2) AS pending_receive_qty,
       (received_wms_qty - invoiced_ap_qty)::numeric(18, 2) AS pending_invoice_qty,
       unit_price::numeric(18, 2) AS unit_price,
       net_amount::numeric(18, 2) AS net_amount,
       vat_amount::numeric(18, 2) AS vat_amount,
       total_amount::numeric(18, 2) AS total_amount,
       lead_time_days,
       po_stage,
       match_status,
       wms_grn_doc_no,
       ap_tax_inv_no,
       buyer_name
FROM procure_purchase_order
WHERE ($1 = '' OR match_status = $1)
ORDER BY roworder DESC
LIMIT 200;
```

### 2.2 การสืบราคา RFQ หลายรอบ, ประหยัดต้นทุน และตารางคะแนนผู้ขาย (`procure_rfq_inquiry`, `procure_cart_item`, `procure_supplier_matrix`)

```sql
SELECT rfq_doc_no,
       cart_ref_no,
       doc_date,
       ic_code,
       ic_name,
       inquiry_qty::numeric(18, 2) AS inquiry_qty,
       baseline_unit_price::numeric(18, 2) AS baseline_unit_price,
       best_quoted_price::numeric(18, 2) AS best_quoted_price,
       savings_amount::numeric(18, 2) AS savings_amount,
       savings_pct::numeric(10, 2) AS savings_pct,
       current_round,
       rfq_stage,
       selected_ap_code,
       selected_ap_name,
       converted_po_doc_no,
       buyer_name
FROM procure_rfq_inquiry
WHERE ($1 = '' OR rfq_stage = $1)
ORDER BY roworder DESC
LIMIT 200;
```

ตรวจสอบรายการรอสืบราคาในตะกร้าจัดซื้อและประสิทธิภาพซัพพลายเออร์:

```sql
SELECT c.cart_item_no,
       c.ic_code,
       c.ic_name,
       c.current_avail_qty::numeric(18, 2) AS current_avail_qty,
       c.reorder_point_qty::numeric(18, 2) AS reorder_point_qty,
       c.requested_qty::numeric(18, 2) AS requested_qty,
       c.target_unit_price::numeric(18, 2) AS target_unit_price,
       c.estimated_total::numeric(18, 2) AS estimated_total,
       c.urgency_level,
       c.cart_status,
       c.rfq_doc_no,
       s.ap_code AS preferred_ap_code,
       s.ap_name AS preferred_ap_name,
       s.quoted_unit_price::numeric(18, 2) AS quoted_unit_price,
       s.lead_time_days,
       s.on_time_rate_pct::numeric(10, 2) AS on_time_rate_pct,
       s.quality_pass_pct::numeric(10, 2) AS quality_pass_pct,
       s.rating_tier
FROM procure_cart_item c
LEFT JOIN procure_supplier_matrix s ON s.primary_ic_code = c.ic_code
WHERE c.cart_status <> 'CONVERTED_PO'
ORDER BY c.roworder DESC, s.quoted_unit_price ASC NULLS LAST;
```

---

## 3. ตลาดค้าส่ง B2B Sub-Dealer Marketplace (`market_*`)

> หมายเหตุจากโค้ด (`market/handler.go:1349-1352`): `market_subdealer_profile` มีคอลัมน์ `credit_used_opening` และ `rebate_opening` (เป็น `NULL` จนกว่าดีลเลอร์จะ Checkout ครั้งแรก) สำหรับคำนวณยอดสะสมเทียบกับ `market_b2b_order`

```sql
SELECT o.order_no,
       o.order_date,
       o.dealer_code,
       o.dealer_name,
       o.dealer_tier,
       o.order_type,
       o.total_sku_count,
       o.total_qty::numeric(18, 2) AS total_qty,
       o.gross_amount::numeric(18, 2) AS gross_amount,
       o.tier_discount_amount::numeric(18, 2) AS tier_discount_amount,
       o.voucher_discount_amount::numeric(18, 2) AS voucher_discount_amount,
       o.vat_amount::numeric(18, 2) AS vat_amount,
       o.net_order_amount::numeric(18, 2) AS net_order_amount,
       o.order_status,
       o.erp_so_doc_no,
       o.wms_doc_no,
       o.tms_trip_no,
       o.etax_doc_no,
       p.credit_limit::numeric(18, 2) AS credit_limit,
       p.credit_used::numeric(18, 2) AS credit_used,
       p.credit_available::numeric(18, 2) AS credit_available,
       p.credit_term_days,
       p.rebate_accumulated::numeric(18, 2) AS rebate_accumulated
FROM market_b2b_order o
LEFT JOIN market_subdealer_profile p ON p.dealer_code = o.dealer_code
WHERE ($1 = '' OR o.order_status = $1)
ORDER BY o.roworder DESC
LIMIT 200;
```

ดูราคาขายส่งแบบ Tiered MOQ และ Flash Deal ในแค็ตตาล็อก B2B:

```sql
SELECT sku_code,
       product_name,
       category_name,
       brand_name,
       unit_code,
       pack_size_desc,
       retail_price::numeric(18, 2) AS retail_price,
       tier1_price::numeric(18, 2) AS tier1_price,
       tier2_min_qty::numeric(18, 2) AS tier2_min_qty,
       tier2_price::numeric(18, 2) AS tier2_price,
       tier3_min_qty::numeric(18, 2) AS tier3_min_qty,
       tier3_price::numeric(18, 2) AS tier3_price,
       stock_qty::numeric(18, 2) AS stock_qty,
       wms_bin_code,
       is_flash_deal,
       is_mall_official
FROM market_product_catalog
ORDER BY sold_count DESC, sku_code;
```

---

## 4. CRM: Sales Pipeline, ทวงหนี้ AR & 50 ทวิ, Omnichannel และ ROI แคมเปญ (`crm_*`)

### 4.1 Sales Pipeline & Weighted Forecast (`crm_pipeline_deal`)

```sql
SELECT stage,
       COUNT(*) AS deal_count,
       SUM(total_amount)::numeric(18, 2) AS pipeline_gross_amount,
       SUM(ROUND(total_amount * probability_pct / 100.0, 2))::numeric(18, 2) AS weighted_forecast_amount
FROM crm_pipeline_deal
GROUP BY stage
ORDER BY pipeline_gross_amount DESC;
```

### 4.2 ติดตามทวงหนี้ AR, คำสัญญาจ่ายเงิน (PTP) และใบหัก 50 ทวิ (`crm_ar_collection_log`)

```sql
SELECT collection_no,
       inv_doc_no,
       inv_date,
       due_date,
       cust_code,
       cust_name,
       invoice_amount::numeric(18, 2) AS invoice_amount,
       paid_amount::numeric(18, 2) AS paid_amount,
       balance_amount::numeric(18, 2) AS balance_amount,
       wht_rate_pct::numeric(6, 2) AS wht_rate_pct,
       expected_wht::numeric(18, 2) AS expected_wht,
       wht_cert_status,
       overdue_days,
       aging_bucket,
       dunning_stage,
       promise_date,
       promise_amount::numeric(18, 2) AS promise_amount,
       collector_name
FROM crm_ar_collection_log
WHERE balance_amount > 0
ORDER BY overdue_days DESC, balance_amount DESC;
```

### 4.3 คิวแชท Omnichannel & ROI แคมเปญ (`crm_omnichannel_thread`, `crm_campaign_broadcast`, `crm_customer_activity`)

```sql
SELECT thread_id,
       channel_type,
       cust_code,
       cust_name,
       intent_tag,
       status,
       unread_count,
       estimated_deal::numeric(18, 2) AS estimated_deal,
       assigned_rep,
       linked_deal_no,
       last_message_at
FROM crm_omnichannel_thread
WHERE status = 'OPEN'
ORDER BY unread_count DESC, roworder DESC;
```

```sql
SELECT campaign_code,
       campaign_name,
       channel,
       target_segment,
       target_count,
       sent_count,
       open_rate_pct::numeric(6, 2) AS open_rate_pct,
       click_rate_pct::numeric(6, 2) AS click_rate_pct,
       converted_deals,
       revenue_generated::numeric(18, 2) AS revenue_generated,
       budget_amount::numeric(18, 2) AS budget_amount,
       roi_multiple::numeric(8, 2) AS roi_multiple,
       campaign_status
FROM crm_campaign_broadcast
ORDER BY roworder DESC;
```

หมายเหตุ: แต่ละ query ใช้พารามิเตอร์ `$1`, `$2` เป็น string ว่าง `''` เพื่อดูทั้งหมดหรือระบุสถานะ/ประเภทเอกสารเฉพาะได้ทันที — ดูตารางระบบ SME Thai Pack และ Morning Briefing ต่อได้ที่ [[sql-ext-sme-briefing-automation]]
