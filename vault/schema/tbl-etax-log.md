---
title: ตารางเอกสาร e-Tax Invoice และ e-Withholding Tax (etax_document_log)
tags:
  - schema
  - etax
  - ewht
  - vat
  - tax
aliases:
  - etax_document_log
  - erp_doc_format_etax
  - erp_etax_ewht_batch
sources:
  - backend/internal/adapter/inbound/http/etax/handler.go:592
  - scripts/sql/02b_sync_existing_db.sql:9746
  - backend/migrations/0001_audit_schema.sql:74
  - scripts/sql/03_audit_r1_migrations.sql:80
  - backend/internal/application/process/etax_ewht_export.go:87
---

# ตารางเอกสาร e-Tax Invoice และ e-Withholding Tax (`etax_document_log`)

ตารางหลักสำหรับศูนย์กลาง Smart e-Tax Invoice by Time-Stamp (มาตรฐาน ETDA ขมธอ. 3-2560 PDF/A-3 + XML), AI Bill/Slip OCR และการติดตามรายการใบกำกับภาษีขาย-ซื้อและหัก ณ ที่จ่ายข้ามระบบ (`/etax`) เชื่อมต่อเอกสาร ERP (`ic_trans`), ใบเบิกคลัง (`wms_fulfillment_order`), เที่ยวรถขนส่ง (`tms_trip_manifest`) และใบสั่งซื้อ (`procure_purchase_order`) รวมถึงเชื่อมโยงการตั้งค่าและชุดส่งออกธนาคารใน `erp_doc_format_etax` และ `erp_etax_ewht_batch` (ดูตารางกลุ่ม `erp_*` ผ่าน [[schema-overview]])

---

## 1. โครงสร้างตาราง `etax_document_log`

ตารางนี้มี 2 ชุดสคีมาในซอร์สโค้ด โดยเมื่อใช้งานจริง `http/etax/handler.go:623-636` จะทำการ `ALTER TABLE` ปรับโครงสร้างจาก `0001_audit_schema.sql` ให้ตรงกับโมเดล runtime ล่าสุดของ `02b_sync_existing_db.sql:9746` และ **ยกเลิก Unique Constraint `etax_document_log_etax_doc_no_key`** ที่บรรทัด `handler.go:636`

### คอลัมน์ทั้งหมดของ `etax_document_log`

| คอลัมน์ | ชนิดข้อมูล (`http/etax` / `02b`) | ชนิดข้อมูล (`0001_audit_schema.sql:74`) | ความหมายและค่าเริ่มต้น |
| :--- | :--- | :--- | :--- |
| `roworder` | `SERIAL PRIMARY KEY` | `SERIAL PRIMARY KEY` | ลำดับแถวอัตโนมัติ (PK) |
| `etax_doc_no` | `VARCHAR(50) NOT NULL DEFAULT ''` | `VARCHAR(60) UNIQUE NOT NULL` | เลขที่เอกสาร e-Tax *(runtime ยกเลิก `UNIQUE` แล้ว)* |
| `doc_type` | `VARCHAR(40)` / `VARCHAR(60)` | `VARCHAR(40)` (`'TAX_INVOICE'`) | ประเภทเอกสาร เช่น `'ETAX_SALES_INVOICE'` |
| `doc_date` | `VARCHAR(30) DEFAULT ''` | `VARCHAR(20) DEFAULT ''` | วันที่เอกสาร (ข้อความ) |
| `erp_ref_doc_no` | `VARCHAR(50) NOT NULL DEFAULT ''` | `VARCHAR(60) NOT NULL DEFAULT ''` | เลขที่บิลขาย/ซื้ออ้างอิงใน `ic_trans.doc_no` |
| `wms_ref_doc_no` | `VARCHAR(50) DEFAULT ''` | `VARCHAR(60) DEFAULT ''` | เลขที่งานคลัง WMS (`wms_fulfillment_order.wms_doc_no`) |
| `tms_ref_trip_no` | `VARCHAR(50) DEFAULT ''` | `VARCHAR(60) DEFAULT ''` | เลขที่เที่ยวรถขนส่ง (`tms_trip_manifest.trip_no`) |
| `procure_ref_po_no` | `VARCHAR(50) DEFAULT ''` | `VARCHAR(60) DEFAULT ''` | เลขที่ใบสั่งซื้อ (`procure_purchase_order.po_doc_no`) |
| `party_code`, `party_name`, `party_tax_id`, `branch_code` | `VARCHAR` (`branch_code` `'00000'`) | `VARCHAR` | รหัส ชื่อ เลขประจำตัวผู้เสียภาษี 13 หลัก และรหัสสาขาของคู่ค้า/ลูกค้า |
| `base_amount`, `vat_rate`, `vat_amount` | `NUMERIC(18,2)`, `NUMERIC(10,2) DEFAULT 7.00`, `NUMERIC(18,2)` | `NUMERIC(18,2)` | มูลค่าฐานภาษี อัตรา VAT และจำนวนภาษีมูลค่าเพิ่ม |
| `wht_rate`, `wht_amount` | `NUMERIC(10,2)`, `NUMERIC(18,2)` | `NUMERIC(18,2)` | อัตราและจำนวนภาษีหัก ณ ที่จ่าย |
| `total_amount` / `net_amount` | `total_amount NUMERIC(18,2)` (`handler.go:610`) | `net_amount NUMERIC(18,2)` (`0001_audit:92`) | ยอดเงินสุทธิรวม *(runtime ใช้ `total_amount`)* |
| `etda_status` | `VARCHAR(40)` / `VARCHAR(80)` DEFAULT `'TIMESTAMP_VERIFIED'` | *(ชื่อเดิม `time_stamp_status` `'STAMPED'`)* | สถานะการลงเวลา ETDA Time-Stamp |
| `etda_timestamp_token` | `VARCHAR(100) DEFAULT ''` | - | รหัสอ้างอิง Time-Stamp Token ที่ได้รับจากระบบประทับเวลา ETDA |
| `xml_standard` | `VARCHAR(50)` / `VARCHAR(255)` | *(ชื่อเดิม `etda_xml_Standard` `'ETDA-3-2560'`)* | มาตรฐาน XML (ค่าเริ่มต้น `'ETDA ขมธอ. 3-2560 (PDF/A-3 + XML)'`) |
| `ocr_confidence_pct` | `NUMERIC(10,2) DEFAULT 99.4` | `NUMERIC(18,2) DEFAULT 99.0` | คะแนนความมั่นใจของการอ่านบิล/สลิปด้วย AI OCR (%) |
| `slip_verify_status` | `VARCHAR(40)` / `VARCHAR(80)` DEFAULT `'VERIFIED_PROMPTPAY'` | - | สถานะตรวจสลิป/QR ชำระเงิน |
| `remark` | `TEXT DEFAULT ''` | - | หมายเหตุ |
| `image_key`, `image_thumb_key` | `TEXT DEFAULT ''` | - | คีย์ไฟล์ภาพ/PDF ใน MinIO |
| `evidence_photos_json` / `evidence_json` | `evidence_photos_json TEXT DEFAULT '[]'` | `evidence_json TEXT DEFAULT '[]'` | รายการไฟล์หลักฐาน JSON Array *(และ `0001_audit:97` มี `gl_journal_doc_no`)* |
| `updated_at`, `create_date_time_now` | `VARCHAR(40) DEFAULT ''`, `TIMESTAMP NOT NULL DEFAULT now()` | `updated_at TIMESTAMP` *(ถูก alter เป็น `VARCHAR(40)`)* | เวลาปรับปรุงและเวลาสร้างแถว |

---

## 2. ตารางร่วมระบบ e-Tax และ e-WHT (`erp_*`)

ตารางตั้งค่าและชุดข้อมูลส่งออกธนาคารในกลุ่ม `erp_*` (ดูภาพรวมหมวดตารางหลักที่ [[schema-overview]]):

* **`erp_doc_format_etax`** (`scripts/sql/03_audit_r1_migrations.sql:80-86`):
  * **Primary Key**: `code VARCHAR(50) PRIMARY KEY` (ผูกกับรหัส Format เอกสารใน `erp_doc_format`)
  * **คอลัมน์**: `enable_etax SMALLINT NOT NULL DEFAULT 0`, `etax_doc_type_code VARCHAR(20) NOT NULL DEFAULT '388'` (เช่น `'388'` ใบกำกับภาษี, `'T02'` ใบแจ้งหนี้/ใบกำกับภาษี, `'T04'` ใบเสร็จรับเงิน/ใบกำกับภาษี ตาม `etax_ewht_export.go:65`), `etax_sign_mode VARCHAR(30) NOT NULL DEFAULT 'TIMESTAMP'`, `updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`
* **`erp_etax_ewht_batch`** (`backend/internal/application/process/etax_ewht_export.go:87-106`):
  * **Primary Key**: `batch_doc_no TEXT PRIMARY KEY` (พร้อม `roworder SERIAL`)
  * **คอลัมน์สำคัญ**: `pay_date DATE NOT NULL`, `bank_code TEXT NOT NULL DEFAULT 'KBANK'` (`KBANK`/`SCB`/`BBL`/`KTB`), `payee_count INTEGER`, `total_base_amount NUMERIC(18,2)`, `total_normal_wht NUMERIC(18,2)`, `total_ewht_1pct NUMERIC(18,2)`, `total_cashflow_saved NUMERIC(18,2)`, `total_net_transfer NUMERIC(18,2)`, `system_service_fee NUMERIC(18,2)`, `double_deduction_benefit NUMERIC(18,2)`, `payload_json JSONB DEFAULT '[]'::jsonb`, `remark TEXT`, `created_by TEXT`

---

## 3. รูปแบบการ JOIN และคำสั่ง SELECT พร้อมใช้งาน

* `etax_document_log.erp_ref_doc_no = ic_trans.doc_no` (กรอง `COALESCE(ic_trans.last_status, 0) = 0` เสมอ — [[schema-overview]])
* `etax_document_log.wms_ref_doc_no = wms_fulfillment_order.wms_doc_no` ([[tbl-wms-modern]])
* `etax_document_log.tms_ref_trip_no = tms_trip_manifest.trip_no` ([[tbl-tms-fleet]])
* `etax_document_log.procure_ref_po_no = procure_purchase_order.po_doc_no` ([[tbl-procure-b2b]])

```sql
-- ตรวจสอบเอกสาร e-Tax ที่ประทับเวลา ETDA และเชื่อมกับเอกสาร ERP / WMS / TMS
SELECT
    e.etax_doc_no,
    e.doc_type,
    e.doc_date,
    e.erp_ref_doc_no,
    e.wms_ref_doc_no,
    e.tms_ref_trip_no,
    e.party_code,
    e.party_name,
    e.party_tax_id,
    e.base_amount::NUMERIC(18,2) AS base_amount,
    e.vat_amount::NUMERIC(18,2) AS vat_amount,
    e.wht_amount::NUMERIC(18,2) AS wht_amount,
    e.total_amount::NUMERIC(18,2) AS total_amount,
    e.etda_status,
    e.slip_verify_status,
    t.doc_date AS erp_doc_date
FROM etax_document_log e
LEFT JOIN ic_trans t
    ON t.doc_no = e.erp_ref_doc_no
   AND COALESCE(t.last_status, 0) = 0
ORDER BY e.roworder DESC;
```

```sql
-- สรุปยอดภาษี e-WHT 1% เปรียบเทียบอัตราปกติและยอดประหยัดกระแสเงินสดราย Batch
SELECT
    batch_doc_no,
    pay_date,
    bank_code,
    payee_count,
    total_base_amount::NUMERIC(18,2) AS total_base_amount,
    total_normal_wht::NUMERIC(18,2) AS total_normal_wht,
    total_ewht_1pct::NUMERIC(18,2) AS total_ewht_1pct,
    total_cashflow_saved::NUMERIC(18,2) AS cashflow_saved,
    total_net_transfer::NUMERIC(18,2) AS total_net_transfer,
    double_deduction_benefit::NUMERIC(18,2) AS double_deduction_benefit
FROM erp_etax_ewht_batch
ORDER BY pay_date DESC, roworder DESC;
```
