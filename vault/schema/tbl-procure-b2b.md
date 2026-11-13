---
title: ตารางจัดซื้ออัจฉริยะ B2B (procure_purchase_order, procure_supplier_matrix, procure_cart_item, procure_rfq_inquiry)
tags:
  - schema
  - procure
  - purchasing
  - rfq
aliases:
  - procure_purchase_order
  - procure_supplier_matrix
  - procure_cart_item
  - procure_rfq_inquiry
sources:
  - backend/internal/adapter/inbound/http/procure/handler.go:1797
  - backend/internal/adapter/inbound/http/procure/handler.go:1828
  - backend/internal/adapter/inbound/http/procure/handler.go:1847
  - backend/internal/adapter/inbound/http/procure/handler.go:1868
  - backend/internal/adapter/inbound/http/procure/handler.go:1897
---

# ตารางจัดซื้ออัจฉริยะ B2B (`procure_*`)

กลุ่มตารางในโมดูล Procurement Workbench (`http/procure/handler.go:1796-1900`) สำหรับจัดการตะกร้าขอซื้ออัตโนมัติจากจุด Reorder Point (`procure_cart_item`), ใบขอเสนอราคาและเจรจาต่อรองหลายรอบ (`procure_rfq_inquiry`), เมทริกซ์ผู้ขายเปรียบเทียบราคา/MOQ/Lead Time (`procure_supplier_matrix`) และใบสั่งซื้อ B2B พร้อมสถานะ Three-Way Matching เทียบกับรับของ WMS และใบแจ้งหนี้เจ้าหนี้ ERP (`procure_purchase_order`)

---

## 1. `procure_purchase_order` — ใบสั่งซื้อจัดซื้อ B2B และสถานะ 3-Way Match

- **วัตถุประสงค์**: ติดตามคำสั่งซื้อต่อรายการสินค้า เทียบจำนวนสั่ง (`order_qty`), จำนวนรับเข้าคลัง WMS (`received_wms_qty`) และจำนวนตั้งหนี้เจ้าหนี้ AP (`invoiced_ap_qty`)
- **Primary Key**: `roworder serial PRIMARY KEY`

### คอลัมน์สำคัญ

| คอลัมน์ | ชนิดข้อมูล (SQL) | ค่าเริ่มต้น | ความหมาย |
| :--- | :--- | :--- | :--- |
| `po_doc_no`, `pr_ref_no`, `doc_date` | `varchar(50)`, `varchar(30)` | `''` | เลขที่ใบสั่งซื้อ, เลขที่ใบขอซื้ออ้างอิง และวันที่เอกสาร |
| `ap_code`, `ap_name` | `varchar(50)`, `varchar(255)` | `''` | รหัสและชื่อผู้ขาย (`ap_supplier` ใน [[schema-overview]]) |
| `ic_code`, `ic_name`, `unit_code`, `target_bin` | `varchar` | `'A-01-01'` | รหัสสินค้า ชื่อสินค้า หน่วย และ Bin ปลายทาง ([[tbl-wms-modern]]) |
| `order_qty`, `received_wms_qty`, `invoiced_ap_qty` | `numeric(18,2)` | `0` | จำนวนที่สั่ง, จำนวนรับจริงใน WMS, จำนวนที่ออกบิล AP แล้ว |
| `unit_price`, `net_amount`, `vat_amount`, `total_amount` | `numeric(18,2)` | `0` | ราคาต่อหน่วย, มูลค่าก่อนภาษี, VAT และยอดรวมสุทธิ |
| `lead_time_days`, `po_stage` | `integer`, `varchar(40)` | `3`, `'APPROVED_PO'` | ระยะเวลาส่งมอบและขั้นตอน PO |
| `match_status` | `varchar(255)` | `'PENDING_GRN'` | สถานะ 3-Way Match *(ขยายเป็น `varchar(255)` ที่ L1897)* |
| `wms_grn_doc_no`, `ap_tax_inv_no` | `varchar(50)` | `''` | เลขที่ใบรับของ WMS และเลขที่ใบกำกับภาษีซื้อ AP |
| `buyer_name`, `remark`, `evidence_photos_json` | `varchar`/`text` | `''`, `'[]'` | ผู้จัดซื้อ, หมายเหตุ และรูปหลักฐาน |

---

## 2. `procure_supplier_matrix` — เมทริกซ์ผู้ขาย (Supplier Scorecard & Quotes)

- **Primary Key**: `roworder serial PRIMARY KEY`
- **คอลัมน์สำคัญ**: `ap_code`, `ap_name`, `tax_id`, `primary_ic_code`, `primary_ic_name`, `quoted_unit_price` (`numeric(18,2)`), `moq_qty` (`numeric(18,2)`), `lead_time_days`, `credit_days`, `on_time_rate_pct`, `quality_pass_pct`, `rating_tier` (`'A+ (Preferred)'`), `contact_phone`

---

## 3. `procure_cart_item` — ตะกร้าสินค้าขอซื้ออัตโนมัติ (Reorder Cart)

- **Primary Key**: `roworder serial PRIMARY KEY`
- **คอลัมน์สำคัญ**: `cart_item_no`, `ic_code`, `ic_name`, `unit_code`, `target_bin`, `current_avail_qty`, `reorder_point_qty`, `requested_qty`, `target_unit_price`, `estimated_total`, `preferred_suppliers_json`, `urgency_level`, `requested_by`, `spec_note`, `cart_status` (`'IN_CART'`), `rfq_doc_no`

---

## 4. `procure_rfq_inquiry` — ใบขอเสนอราคาและประวัติต่อรองราคา (RFQ)

- **Primary Key**: `roworder serial PRIMARY KEY`
- **คอลัมน์สำคัญ**:
  - `rfq_doc_no`, `cart_ref_no` (`text` — ขยายจาก `varchar(50)` ที่ L1899 เพื่อรวมหลาย `cart_item_no` คั่นด้วย comma), `doc_date`
  - `ic_code`, `ic_name`, `unit_code`, `target_bin`, `inquiry_qty`, `baseline_unit_price`, `best_quoted_price`, `savings_amount`, `savings_pct`
  - `current_round`, `rfq_stage` (`'INQUIRING_ROUND_1'`), `selected_ap_code`, `selected_ap_name`, `converted_po_doc_no` (`procure_purchase_order.po_doc_no`)
  - `vendor_quotes_json`, `round_history_json` (JSON เก็บใบเสนอราคาและรอบต่อรองทั้งหมด)

---

## 5. ตัวอย่าง SQL Query

```sql
-- ตรวจติดตาม PO ที่รับเข้า WMS แล้วแต่ยังมียอดค้างตั้งหนี้ AP หรือยังรับไม่ครบ
SELECT
    po_doc_no,
    doc_date,
    ap_code,
    ap_name,
    ic_code,
    order_qty::NUMERIC(18,2) AS order_qty,
    received_wms_qty::NUMERIC(18,2) AS received_wms_qty,
    invoiced_ap_qty::NUMERIC(18,2) AS invoiced_ap_qty,
    (order_qty - received_wms_qty)::NUMERIC(18,2) AS pending_receive_qty,
    match_status,
    wms_grn_doc_no,
    ap_tax_inv_no
FROM procure_purchase_order
WHERE received_wms_qty <> order_qty
   OR invoiced_ap_qty <> received_wms_qty
ORDER BY doc_date DESC, po_doc_no;
```
