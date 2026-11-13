---
title: ตารางระบบ CRM และ Omnichannel (crm_*, customer_type)
tags:
  - schema
  - crm
  - line-oa
  - sales-pipeline
  - ar-collection
aliases:
  - crm_customer_activity
  - crm_pipeline_deal
  - crm_ar_collection_log
  - crm_omnichannel_thread
  - crm_campaign_broadcast
  - customer_type
sources:
  - backend/internal/adapter/inbound/http/crm/handler.go:1694
  - backend/internal/adapter/inbound/http/crm/handler.go:1713
  - backend/internal/adapter/inbound/http/crm/handler.go:1730
  - backend/internal/adapter/inbound/http/crm/handler.go:1754
  - backend/internal/adapter/inbound/http/crm/handler.go:1773
  - scripts/sql/02_data_schema.sql:2323
---

# ตารางระบบ CRM และ Omnichannel (`crm_*`, `customer_type`)

กลุ่มตารางงานลูกค้าสัมพันธ์ (CRM), ไปป์ไลน์การขาย (Sales Pipeline), ติดตามทวงหนี้ลูกหนี้การค้า (AR Collection), แชทลูกค้าหลายช่องทาง (Omnichannel / LINE OA) และแคมเปญสื่อสารการตลาด รวมถึงตารางประเภทลูกค้าหลัก `customer_type` เพื่อเชื่อมข้อมูลลูกหนี้ `ar_customer` และเอกสารขาย/ใบเสนอราคา `ic_trans` ในระบบหลัก (ดูโครงสร้างตารางแกนหลักได้ที่ [[schema-overview]])

> สำหรับตารางแผนที่ปฏิบัติการและมอนิเตอร์โต๊ะพนักงาน (`monitormap_*`, `workmonitor_*`) ที่เริ่มต้นในโมดูลเดียวกัน ดูเพิ่มเติมที่ [[tbl-crm-monitormap-work]]

---

## 1. ภาพรวมตารางในกลุ่ม CRM

| ตาราง | Primary Key / Unique Key | วัตถุประสงค์หลัก | ที่มา DDL |
| :--- | :--- | :--- | :--- |
| `crm_customer_activity` | `roworder` (`SERIAL PRIMARY KEY`) | บันทึกประวัติการติดต่อลูกค้า โทร/นัดหมาย และ GPS Check-in | `http/crm/handler.go:1694` |
| `crm_pipeline_deal` | `roworder` (`SERIAL PRIMARY KEY`) | ดีลการขาย เชื่อมใบเสนอราคา (`trans_flag = 40`) สู่ปิดการขาย | `http/crm/handler.go:1713` |
| `crm_ar_collection_log` | `roworder` (`SERIAL PRIMARY KEY`) | บันทึกติดตามหนี้ค้างชำระ Aging, วันนัดจ่าย และสถานะใบ 50 ทวิ | `http/crm/handler.go:1730` |
| `crm_omnichannel_thread` | `roworder` (`SERIAL PRIMARY KEY`) | กระทู้แชทลูกค้ารวมศูนย์ (เช่น `LINE_OA`) ผูกกับดีลการขาย | `http/crm/handler.go:1754` |
| `crm_campaign_broadcast` | `roworder` (`SERIAL PRIMARY KEY`) | แคมเปญบรอดแคสต์และวัดผล ROI (`converted_deals`, `revenue_generated`) | `http/crm/handler.go:1773` |
| `customer_type` | `roworder` (`SERIAL NOT NULL`), Index บน `code` | ตารางรหัสประเภทลูกค้าในฐานข้อมูล ERP | `02_data_schema.sql:2323` |

---

## 2. โครงสร้างตารางละเอียด

### `crm_customer_activity` — ประวัติกิจกรรมและการเข้าพบลูกค้า
* `roworder` (`SERIAL PRIMARY KEY`) — ลำดับแถวอัตโนมัติ
* `cust_code` (`VARCHAR(50) NOT NULL DEFAULT ''`) — รหัสลูกค้า อ้างอิง `ar_customer.code`
* `cust_name` (`VARCHAR(255) NOT NULL DEFAULT ''`) — ชื่อลูกค้า (Denormalized Snapshot)
* `channel` (`VARCHAR(60) NOT NULL DEFAULT 'โทรติดตาม'`) — ช่องทางการติดต่อ เช่น โทรติดตาม, LINE OA, เข้าพบหน้างาน
* `subject` (`VARCHAR(255) NOT NULL DEFAULT ''`) — หัวข้อการติดต่อ
* `note_text` (`TEXT NOT NULL DEFAULT ''`) — รายละเอียดการสนทนาหรือบันทึกการเข้าพบ
* `contact_person` (`VARCHAR(150) NOT NULL DEFAULT ''`) — ชื่อผู้ติดต่อฝั่งลูกค้า
* `contact_result` (`VARCHAR(150) NOT NULL DEFAULT ''`) — ผลลัพธ์การติดต่อ
* `next_followup_date` (`VARCHAR(40) NOT NULL DEFAULT ''`) — วันที่นัดติดตามครั้งถัดไป
* `gps_coords` (`VARCHAR(80) NOT NULL DEFAULT ''`), `checkin_place` (`VARCHAR(255) NOT NULL DEFAULT ''`) — พิกัด GPS และชื่อสถานที่ Check-in ของพนักงานขาย (เพิ่มคอลัมน์ผ่าน `ALTER TABLE` ที่ `handler.go:1711-1712`)
* `created_by` (`VARCHAR(150) NOT NULL DEFAULT ''`) — ผู้บันทึกกิจกรรม
* `image_key` (`TEXT`), `image_thumb_key` (`TEXT`) — คีย์รูปภาพแนบใน MinIO
* `create_date_time_now` (`TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()`) — เวลาที่สร้างรายการ

---

### `crm_pipeline_deal` — ไปป์ไลน์การขาย (Sales Pipeline)
* `roworder` (`SERIAL PRIMARY KEY`) — ลำดับแถวอัตโนมัติ
* `deal_id` (`VARCHAR(80) NOT NULL DEFAULT ''`) — รหัสดีลอ้างอิงภายในระบบ CRM
* `doc_date` (`VARCHAR(32) NOT NULL DEFAULT ''`), `doc_no` (`VARCHAR(64) NOT NULL DEFAULT ''`) — วันที่และเลขที่เอกสาร ERP ที่ผูกกับดีล (เช่น ใบเสนอราคา)
* `trans_flag` (`INTEGER NOT NULL DEFAULT 40`) — ประเภทเอกสาร ERP ต้นทาง (ค่าเริ่มต้น `40` = ใบเสนอราคา)
* `stage` (`VARCHAR(32) NOT NULL DEFAULT 'qt'`) — ขั้นตอนดีลในไปป์ไลน์ เช่น `'qt'` (เสนอราคา)
* `cust_code` (`VARCHAR(50)`), `cust_name` (`VARCHAR(255)`) — รหัสและชื่อลูกค้า
* `total_amount` (`NUMERIC(18,2) NOT NULL DEFAULT 0.00`) — มูลค่าดีลรวม (Decimal แม่นยำ)
* `probability_pct` (`INTEGER NOT NULL DEFAULT 55`) — โอกาสปิดการขาย (%)
* `quote_rev` (`INTEGER NOT NULL DEFAULT 1`) — ครั้งที่แก้ไขใบเสนอราคา (Revision)
* `channel_source` (`VARCHAR(80) NOT NULL DEFAULT 'LINE OA (@bcaccount)'`) — แหล่งที่มาของโอกาสการขาย
* `owner_name` (`VARCHAR(150)`), `remark` (`TEXT`), `updated_at` (`VARCHAR(40)`) — ผู้รับผิดชอบ หมายเหตุ และเวลาอัปเดต

---

### `crm_ar_collection_log` — ติดตามลูกหนี้ค้างชำระและภาษีหัก ณ ที่จ่าย
* `roworder` (`SERIAL PRIMARY KEY`), `collection_no` (`VARCHAR(64)`) — รหัสงานทวงหนี้
* `inv_doc_no` (`VARCHAR(64)`), `inv_date` (`VARCHAR(32)`), `due_date` (`VARCHAR(32)`) — เลขที่ใบกำกับ/ใบแจ้งหนี้ ERP, วันที่เอกสาร และวันครบกำหนด
* `cust_code` (`VARCHAR(50)`), `cust_name` (`VARCHAR(255)`), `contact_phone` (`VARCHAR(64)`) — ข้อมูลลูกหนี้และเบอร์ผู้ประสานงาน
* `invoice_amount` (`NUMERIC(18,2)`), `paid_amount` (`NUMERIC(18,2)`), `balance_amount` (`NUMERIC(18,2)`) — ยอดบิล ยอดรับแล้ว และยอดคงค้าง
* `wht_rate_pct` (`NUMERIC(6,2)`), `expected_wht` (`NUMERIC(18,2)`) — อัตราและยอดภาษีหัก ณ ที่จ่ายที่คาดว่าจะถูกหัก
* `wht_cert_status` (`VARCHAR(48) NOT NULL DEFAULT 'PENDING_50TAWI'`) — สถานะการรับหนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ)
* `overdue_days` (`INTEGER`), `aging_bucket` (`VARCHAR(48) NOT NULL DEFAULT '0-30 วัน'`) — จำนวนวันเกินกำหนดและช่วงอายุหนี้
* `dunning_stage` (`VARCHAR(48) NOT NULL DEFAULT 'DUE_SOON'`) — สถานะขั้นตอนทวงถาม เช่น `DUE_SOON`
* `promise_date` (`VARCHAR(32)`), `promise_amount` (`NUMERIC(18,2)`) — วันที่และจำนวนเงินที่ลูกหนี้นัดชำระ
* `collector_name` (`VARCHAR(150)`), `note_text` (`TEXT`), `updated_at` (`VARCHAR(40)`) — ผู้ติดตาม หมายเหตุ และเวลาอัปเดตล่าสุด

---

### `crm_omnichannel_thread` — กระทู้แชทลูกค้าหลายช่องทาง
* `roworder` (`SERIAL PRIMARY KEY`), `thread_id` (`VARCHAR(64)`) — รหัสห้องสนทนา
* `channel_type` (`VARCHAR(32) NOT NULL DEFAULT 'LINE_OA'`), `channel_badge` (`VARCHAR(64) NOT NULL DEFAULT 'LINE OA'`) — ประเภทและป้ายแสดงช่องทาง
* `cust_code` (`VARCHAR(50)`), `cust_name` (`VARCHAR(255)`), `contact_name` (`VARCHAR(150)`), `line_handle` (`VARCHAR(80)`) — การจับคู่ผู้สนทนากับลูกหนี้ ERP
* `intent_tag` (`VARCHAR(120)`), `status` (`VARCHAR(32) NOT NULL DEFAULT 'OPEN'`), `unread_count` (`INTEGER NOT NULL DEFAULT 1`) — แท็กเจตนาลูกค้า สถานะเคส และจำนวนข้อความที่ยังไม่อ่าน
* `estimated_deal` (`NUMERIC(18,2)`), `assigned_rep` (`VARCHAR(150)`), `linked_deal_no` (`VARCHAR(64)`) — มูลค่าประเมิน พนักงานรับเรื่อง และเลขที่เอกสาร/ดีลที่เชื่อมโยง
* `last_message` (`TEXT`), `last_message_at` (`VARCHAR(40)`), `messages_json` (`TEXT NOT NULL DEFAULT '[]'`) — ข้อความล่าสุดและประวัติข้อความรูปแบบ JSON

---

### `crm_campaign_broadcast` — แคมเปญการตลาดและวัดผล ROI
* `roworder` (`SERIAL PRIMARY KEY`), `campaign_code` (`VARCHAR(64)`), `campaign_name` (`VARCHAR(255)`) — รหัสและชื่อแคมเปญ
* `channel` (`VARCHAR(80) NOT NULL DEFAULT 'LINE OA Broadcast'`), `target_segment` (`VARCHAR(120) NOT NULL DEFAULT 'VIP Diamond'`) — ช่องทางและกลุ่มเป้าหมาย
* `target_count` (`INTEGER`), `sent_count` (`INTEGER`), `open_rate_pct` (`NUMERIC(6,2)`), `click_rate_pct` (`NUMERIC(6,2)`) — จำนวนกลุ่มเป้าหมาย ยอดส่ง อัตราเปิดอ่าน และอัตราคลิก
* `converted_deals` (`INTEGER`), `revenue_generated` (`NUMERIC(18,2)`), `budget_amount` (`NUMERIC(18,2)`), `roi_multiple` (`NUMERIC(8,2)`) — จำนวนดีลที่ปิดได้ รายได้รวม งบประมาณ และค่า ROI
* `offer_summary` (`TEXT`), `campaign_status` (`VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'`), `updated_at` (`VARCHAR(40)`) — สรุปข้อเสนอและสถานะแคมเปญ

---

### `customer_type` — ตารางประเภทลูกค้ามาตรฐาน ERP
* `roworder` (`SERIAL NOT NULL`), `code` (`VARCHAR(25) DEFAULT ''`), `name_1` (`VARCHAR(255) DEFAULT ''`), `name_2` (`VARCHAR(255)` / `ALTER TABLE` `VARCHAR(200)`), `guid_code` (`VARCHAR(35)`), `status` (`SMALLINT DEFAULT 0`), `create_date_time_now` (`TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()`)
* **Index**: `idx_customer_type_code` บน `(code)` (`scripts/sql/02_data_schema.sql:2336`)

---

## 3. รูปแบบการ JOIN และคำสั่ง SELECT พร้อมใช้งาน

* เชื่อม `crm_*` เข้ากับ `ar_customer` ผ่าน `cust_code = code` เพื่อดึงข้อมูลลูกหนี้หลักในระบบ ERP ([[schema-overview]])
* เชื่อม `crm_pipeline_deal.doc_no` กับ `ic_trans.doc_no` หรือ `crm_ar_collection_log.inv_doc_no` กับ `ic_trans.doc_no` โดยกรอง `COALESCE(last_status, 0) = 0` เสมอเพื่อไม่รวมเอกสารที่ถูกยกเลิก

```sql
-- สรุปดีลในไปป์ไลน์เทียบสถานะเอกสารจริงใน ERP และยอดคาดการณ์ตามโอกาสปิดดีล
SELECT
    d.deal_id,
    d.stage,
    d.cust_code,
    COALESCE(NULLIF(c.name_1, ''), d.cust_name) AS cust_name,
    d.doc_no,
    d.trans_flag,
    d.total_amount::NUMERIC(18,2) AS deal_amount,
    d.probability_pct,
    ROUND((d.total_amount * d.probability_pct / 100.0)::NUMERIC, 2) AS weighted_forecast,
    t.doc_date AS erp_doc_date,
    COALESCE(t.total_amount, 0)::NUMERIC(18,2) AS erp_doc_amount
FROM crm_pipeline_deal d
LEFT JOIN ar_customer c
    ON c.code = d.cust_code
LEFT JOIN ic_trans t
    ON t.doc_no = d.doc_no
   AND t.trans_flag = d.trans_flag
   AND COALESCE(t.last_status, 0) = 0
ORDER BY d.roworder DESC;
```

```sql
-- รายการติดตามหนี้ค้างชำระที่ยังรอเก็บเงิน พร้อมติดตามใบ 50 ทวิที่ยังไม่ครบ
SELECT
    l.collection_no,
    l.inv_doc_no,
    l.due_date,
    l.cust_code,
    l.cust_name,
    l.aging_bucket,
    l.dunning_stage,
    l.overdue_days,
    l.balance_amount::NUMERIC(18,2) AS balance_amount,
    l.expected_wht::NUMERIC(18,2) AS expected_wht,
    l.wht_cert_status,
    l.promise_date,
    l.promise_amount::NUMERIC(18,2) AS promise_amount,
    l.collector_name
FROM crm_ar_collection_log l
LEFT JOIN ic_trans t
    ON t.doc_no = l.inv_doc_no
   AND COALESCE(t.last_status, 0) = 0
WHERE l.balance_amount > 0
ORDER BY l.overdue_days DESC, l.balance_amount DESC;
```
