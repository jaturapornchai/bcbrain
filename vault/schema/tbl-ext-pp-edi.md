---
title: ตารางเชื่อมต่อ EDI, PP Plan/Shipment และ SAP/Singha Online
tags: [schema, edi, logistics, integration, legacy]
aliases: [edi_external, edi_ar_list, edi_product_list, edi_barcode_list, edi_unit_list, edi_status, edi_so_alert_config, pp_config, pp_plan, pp_plan_detail, pp_shipment, pp_shipment_detail, pp_trans, pp_trans_detail, sap_invoice_imported, singha_online_billing_status, singha_online_unit_maping]
sources:
  - scripts/sql/02_data_schema.sql:2357-2470
  - scripts/sql/02_data_schema.sql:8486-8615
  - scripts/sql/02_data_schema.sql:8746-8790
---

ชุดตารางเชื่อมต่อแลกเปลี่ยนข้อมูลทางอิเล็กทรอนิกส์ (EDI), ระบบวางแผนและจัดส่งสินค้า (`pp_*`) และตารางเชื่อมคู่ค้าระดับองค์กร (`sap_invoice_imported`, `singha_online_*`) จากสคีมาฐานข้อมูลกลาง รวม 17 ตาราง สำหรับตารางข้อมูลหลักลูกค้า/สินค้า (`ar_customer`, `ic_inventory`, `ic_trans`) ดู [[schema-overview]] และระบบขนส่งยุคใหม่ดู [[tbl-tms-fleet]]

> [!NOTE] คอลัมน์ระบบประจำตาราง
> ทุกตารางในชุดนี้มีคอลัมน์มาตรฐานของสคีมาดั้งเดิมครบ ได้แก่ `ignore_sync integer DEFAULT 0`, `is_lock_record integer DEFAULT 0`, `roworder serial NOT NULL`, `create_date_time_now timestamp without time zone NOT NULL DEFAULT now()`

---

## 1. ระบบเชื่อมต่อ EDI (`edi_*` — 7 ตาราง)

| ตาราง | จุดอ้างอิง | หน้าที่ | คอลัมน์สำคัญ | ดัชนี (`02_data_schema.sql`) |
| :--- | :--- | :--- | :--- | :--- |
| `edi_external` | `L2384` | ทะเบียนคู่ค้า EDI ภายนอก | `code`, `name_1`, `name_2` (`L2403`), `status` (`L2404`), `trading_partner_id` (`varchar(50)`), `supplier_ean_code` (`varchar(50)`), `ar_code`, `dc_code`, `export_format` (`smallint`), `guid_code`, `wh_code`, `shelf_code`, `use_price` (`smallint`) | `idx_edi_external_code`, `idx_edi_external_ar_code` (`L2405-2406`) |
| `edi_ar_list` | `L2357` | แมปรหัสลูกค้า/จุดส่งสินค้ากับรหัส EDI | `edi_code`, `ar_code`, `line_number`, `ship_code`, `wh_code`, `shelf_code` | `idx_edi_ar_list_ar_code` (`L2369`) |
| `edi_product_list` | `L2408` | แมปรหัสสินค้าและขนาดบรรจุ (`item_packsize`) ของ EDI | `edi_code`, `item_code`, `item_name`, `ic_code`, `line_number`, `item_packsize` (`numeric`) | `idx_edi_product_list_item_code` (`L2420`) |
| `edi_barcode_list` | `L2371` | แมปบาร์โค้ดและราคาขายคู่ค้า EDI | `edi_code`, `edi_barcode`, `barcode`, `line_number`, `price` (`numeric`) | `idx_edi_barcode_list_barcode` (`L2382`) |
| `edi_unit_list` | `L2461` | แมปหน่วยนับฝั่ง EDI กับหน่วยนับภายใน | `edi_code`, `edi_unit_code`, `edi_unit_name`, `unit_code`, `line_number` | — |
| `edi_so_alert_config` | `L2422` | ตั้งค่าแจ้งเตือนใบสั่งขายจาก EDI ตามลูกค้า | `ar_code`, `ar_name`, `start_date` (`date`) | `idx_edi_so_alert_config_ar_code` (`L2431`) |
| `edi_status` | `L2433` | ติดตามสถานะการจัดส่งและรับสินค้า (ASN/POD) | `ar_code`, `order_date`, `order_no`, `order_type`, `address`, `invoice_date`, `invoice_no`, `good_recieipt_id` *(สะกด `recieipt` ตามสคีมาจริง)* พร้อมชุดเวลา+ผู้ยืนยัน (`*_date_time`, `confirm_*_user`) ของ 5 ขั้น: `packing`, `in_transit`, `delivered`, `cancel`, `receive` | `idx_edi_status_ar_code` (`L2459`) |

---

## 2. ระบบวางแผนจัดส่ง (`pp_*` — 7 ตาราง)

| ตาราง | จุดอ้างอิง | หน้าที่ | คอลัมน์สำคัญ | ดัชนี (`02_data_schema.sql`) |
| :--- | :--- | :--- | :--- | :--- |
| `pp_config` | `L8486` | ตั้งค่าระบบจัดส่งตามคลังและพื้นที่ | `serial_id` (`varchar(50)`), `wh_code`, `location_list` (`varchar(500)`), `auto_mode` (`smallint`) | — |
| `pp_plan` | `L8497` | หัวแผนจัดเตรียม/จัดส่งสินค้า | `doc_no`, `doc_date`, `doc_time`, `ref_doc_no`, `status`, `remark`, `cust_code`, `transport_destination_code`, `priority` | `idx_pp_plan_cust_code` (`L8512`) |
| `pp_plan_detail` | `L8514` | รายการสินค้าในแผนจัดส่ง | `row_number`, `doc_no`, `ic_code`, `wh_code`, `shelf_code`, `unit_code`, `qty`, `transport_type`, `transport_date`, `transport_time`, `priority` | — |
| `pp_shipment` | `L8532` | หัวใบส่งของ (`Shipment`) | `doc_date`, `doc_no`, `doc_time`, `trans_flag`, `doc_format_code`, `doc_ref`, `doc_ref_date`, `transport_type`, `remark` (`varchar(500)`), `cust_code`, `guid_code`, `is_cancel`, `cancel_code`, `cancel_datetime`, `last_status`, `status` | `idx_pp_shipment_doc_no_trans_flag`, `idx_pp_shipment_doc_date_trans_flag`, `idx_pp_shipment_cust_code` (`L8554-8556`) |
| `pp_shipment_detail` | `L8558` | รายการเอกสาร/สินค้าอ้างอิงในใบส่งของ | `doc_no`, `doc_date`, `trans_flag`, `line_number`, `doc_ref_type`, `item_code`, `remark`, `cust_code`, `ref_doc_no`, `ref_doc_date` | `idx_pp_shipment_detail_doc_no_trans_flag`, `idx_pp_shipment_detail_doc_date_trans_flag`, `idx_pp_shipment_detail_item_code`, `idx_pp_shipment_detail_cust_code` (`L8574-8577`) |
| `pp_trans` | `L8579` | หัวรายการดำเนินการจัดส่งและความคืบหน้า (%) | `doc_no`, `doc_date`, `ref_code`, `ref_date`, `due_date`, `cust_code`, `sale_code`, `status`, `persent` (`numeric` — *สะกด `persent` ตามสคีมาจริง*), `remark`, `row_number`, `is_cancel`, `cancel_code` | `idx_pp_trans_cust_code` (`L8598`) |
| `pp_trans_detail` | `L8600` | รายละเอียดสินค้าและจำนวนที่ดำเนินการส่ง | `row_number`, `doc_no`, `ic_code`, `wh_code`, `shelf_code`, `unit_code`, `qty`, `event_qty`, `event_date_time` (`date`) | — |

---

## 3. เชื่อมต่อ SAP และ Singha Online (`sap_*`, `singha_online_*` — 3 ตาราง)

| ตาราง | จุดอ้างอิง | หน้าที่ | คอลัมน์สำคัญ | ดัชนี (`02_data_schema.sql`) |
| :--- | :--- | :--- | :--- | :--- |
| `sap_invoice_imported` | `L8746` | บันทึกประวัติใบกำกับ/เอกสารที่นำเข้าจาก SAP | `doc_no`, `sap_doc_no`, `imported_date` (`date`), `computer_name` | — |
| `singha_online_billing_status` | `L8757` | ติดตามสถานะบิล/จัดส่งฝั่ง Singha Online | `ar_code`, `order_date`, `order_no`, `order_type`, `address` (`varchar(255)`), `invoice_date`, `invoice_no`, พร้อมคอลัมน์ timestamp และ `confirm_*_user` สำหรับ `packing`, `in_transit`, `delivered`, `cancel`, `receive` | `idx_singha_online_billing_status_ar_code` (`L8780`) |
| `singha_online_unit_maping` | `L8782` | ตารางแปลงหน่วยขายของ Singha Online *(สะกด `maping` ตามสคีมาจริง)* | `ic_code`, `unit_sale`, `unit_code`, `qty_per_unit` (`numeric`), `line_number` | — |

---

## รูปแบบการ JOIN และตัวอย่าง SQL

1. **ค้นหารายการสินค้าและบาร์โค้ดคู่ค้า EDI พร้อมหน่วยนับภายใน**
```sql
SELECT
  e.code AS edi_code,
  e.name_1 AS partner_name,
  e.trading_partner_id,
  p.ic_code,
  p.item_code AS partner_item_code,
  p.item_packsize::numeric AS item_packsize,
  b.edi_barcode,
  b.barcode AS internal_barcode,
  b.price::numeric AS partner_price,
  u.edi_unit_code,
  u.unit_code AS internal_unit_code
FROM edi_external e
JOIN edi_product_list p
  ON p.edi_code = e.code
LEFT JOIN edi_barcode_list b
  ON b.edi_code = e.code AND b.line_number = p.line_number
LEFT JOIN edi_unit_list u
  ON u.edi_code = e.code AND u.line_number = p.line_number
WHERE COALESCE(e.status, 1) = 1
ORDER BY e.code, p.line_number;
```

2. **ตรวจสอบใบส่งของ `pp_shipment` ที่ยังไม่ถูกยกเลิก**
```sql
SELECT
  s.doc_no,
  s.doc_date,
  s.cust_code,
  s.transport_type,
  d.line_number,
  d.item_code,
  d.ref_doc_no,
  d.ref_doc_date
FROM pp_shipment s
JOIN pp_shipment_detail d
  ON d.doc_no = s.doc_no
 AND d.trans_flag = s.trans_flag
WHERE COALESCE(s.last_status, 0) = 0
  AND COALESCE(s.is_cancel, 0) = 0
ORDER BY s.doc_date DESC, s.doc_no, d.line_number;
```
