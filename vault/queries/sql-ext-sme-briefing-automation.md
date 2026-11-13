---
title: "SQL Operations: SME Thai Pack, Morning Briefing, Feature Switchboard และ Automation Alerts"
audience: dev
tags:
  - sql
  - sme-thai-pack
  - morning-briefing
  - feature-switchboard
  - line-oa
  - promptpay
  - automation
  - dev
aliases:
  - sql-sme-pack
  - sql-morning-briefing
  - query-sme-briefing-automation
sources:
  - backend/internal/application/process/sme_thai_pack.go:68-1470
  - backend/internal/application/process/public_bill_pay.go:185-212
  - backend/internal/application/process/feature_options.go:410-440
  - backend/internal/application/process/morning_briefing.go:226-856
  - backend/internal/adapter/inbound/http/crm/handler.go:1875-1893
---

# SQL Operations: SME Thai Pack, Morning Briefing และ Feature Switchboard

> กติกาหลัก: ใช้ `[[dev-rules-accounting-sql]]` เสมอ — คงความถูกต้องเชิงตัวเลขด้วย `NUMERIC`, คัดกรอง `COALESCE(last_status, 0) = 0` บนเอกสาร `ic_trans`/`ap_ar_trans_detail`, และห้ามเลือกฟิลด์ Token หรือ Blob รูป Base64 ในคิวรีรายงานทั่วไป — ดูสถาปัตยกรรมที่ [[arch-feature-switchboard]], [[arch-morning-briefing-analytics]] และ [[arch-external-apps-webhooks]]

---

## 1. SME Thai Pack: ทำเนียบผู้เสียภาษี, รับสลิป LINE OA และตามทวงเอกสารขาด

### 1.1 แคชทำเนียบเลขประจำตัวผู้เสียภาษี 13 หลัก (`erp_tax_id_directory`)

```sql
SELECT tax_id,
       company_name_th,
       company_name_en,
       branch_code,
       branch_name,
       address,
       vat_registered,
       entity_status,
       source_system,
       updated_at
FROM erp_tax_id_directory
WHERE ($1 = '' OR tax_id = $1 OR company_name_th ILIKE '%' || $1 || '%')
ORDER BY updated_at DESC
LIMIT 100;
```

### 1.2 กล่องรับสลิปค่าใช้จ่ายทาง LINE OA และตรวจสลิปซ้ำ (`cb_line_expense_inbox`)

ตรวจจับรายการที่ยืนยันลายเซ็น Webhook แล้ว (`signature_verified = TRUE`) และตรวจหา `trans_ref` หรือ `slip_image_sha256` ที่ซ้ำกัน (ไม่ดึงคอลัมน์ `slip_image_base64` เพื่อลดภาระหน่วยความจำ):

```sql
SELECT inbox_doc_no,
       sender_display_name,
       message_type,
       expense_category,
       vendor_name,
       vendor_tax_id,
       slip_amount::numeric(18, 2) AS slip_amount,
       vat_amount::numeric(18, 2) AS vat_amount,
       trans_ref,
       sending_bank_code,
       qr_decoded_from_image,
       slip_image_sha256,
       signature_verified,
       status,
       converted_target,
       converted_doc_no,
       created_at
FROM cb_line_expense_inbox
WHERE ($1 = '' OR status = $1)
ORDER BY created_at DESC
LIMIT 200;
```

### 1.3 คิวตามทวงเอกสารขาดทางบัญชี เช่น ใบกำกับภาษี / 50 ทวิ (`erp_missing_doc_request`)

```sql
SELECT request_no,
       doc_type,
       source_module,
       ref_doc_no,
       trans_date,
       counterparty_code,
       counterparty_name,
       amount::numeric(18, 2) AS amount,
       assigned_to,
       contact_channel,
       due_date,
       chase_count,
       priority,
       status,
       received_doc_no
FROM erp_missing_doc_request
WHERE status <> 'RECEIVED'
ORDER BY CASE priority WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 ELSE 2 END,
         due_date ASC NULLS LAST,
         trans_date ASC;
```

---

## 2. บิลด่วนมือถือ & ลิงก์ชำระเงินสาธารณะ (`ar_mobile_quick_bill`, `ar_public_bill_link`)

> คำเตือนความปลอดภัย: สำหรับ `ar_public_bill_link` และ `ar_mobile_quick_bill` ให้ Query เฉพาะสถานะเชิงธุรกิจและการกระทบยอด (ห้าม Select คอลัมน์ Token Hash/Share Token หรือข้อมูลรูป Base64 ออกสู่รายงานสาธารณะ)

```sql
SELECT q.doc_no,
       q.doc_type,
       q.doc_date,
       q.due_date,
       q.cust_code,
       q.cust_name,
       q.cust_tax_id,
       q.vat_type,
       q.before_vat::numeric(18, 2) AS before_vat,
       q.vat_amount::numeric(18, 2) AS vat_amount,
       q.total_amount::numeric(18, 2) AS total_amount,
       q.promptpay_id,
       q.status AS quick_bill_status,
       p.status AS pay_link_status,
       p.expires_at,
       p.wht_rate::numeric(9, 2) AS wht_rate,
       p.slip_paid_amount::numeric(18, 2) AS slip_paid_amount,
       p.slip_wht_deducted::numeric(18, 2) AS slip_wht_deducted,
       p.slip_transfer_ref,
       p.slip_transfer_date,
       p.slip_submitted_at,
       p.receipt_doc_no
FROM ar_mobile_quick_bill q
LEFT JOIN ar_public_bill_link p ON p.doc_no = q.doc_no
WHERE ($1 = '' OR q.status = $1 OR p.status = $1)
ORDER BY q.doc_date DESC, q.created_at DESC
LIMIT 200;
```

---

## 3. Feature Switchboard (`erp_feature_option`) & SME Critical Alerts (`monitormap_sme_alerts`)

ตรวจสอบ Preset และ Flag ของ 28 โมดูลเสริมที่เปิดใช้ในฐานข้อมูลบริษัท (`id = 1`):

```sql
SELECT id,
       preset_code,
       jsonb_object_keys(flags_json) AS feature_key,
       (flags_json ->> jsonb_object_keys(flags_json))::boolean AS is_enabled,
       updated_by,
       updated_at
FROM erp_feature_option
WHERE id = 1
ORDER BY feature_key;
```

ดูรายการแจ้งเตือนวิกฤตประจำวันสำหรับทีมผู้บริหารและ MonitorMap (`monitormap_sme_alerts`):

```sql
SELECT alert_id,
       severity,
       dept_code,
       dept_label,
       alert_title,
       alert_detail,
       impact_amount::numeric(18, 2) AS impact_amount,
       target_entity_kind,
       target_entity_id,
       alert_status,
       updated_at
FROM monitormap_sme_alerts
WHERE alert_status = 'OPEN'
ORDER BY sort_order ASC, impact_amount DESC;
```

---

## 4. โครงสร้าง SQL ของ Morning Briefing (`morning_briefing.go:264-855`)

โค้ด Go คำนวณยอดสรุปจริงด้วย `*big.Rat` หลังดึงรายการย่อยด้วยชุด SQL มาตรฐานต่อไปนี้:

### 4.1 บิลลูกหนี้ค้างรับเกินกำหนด (หักยอดรับชำระ `trans_flag = 239` และใบลดหนี้ `48, 97`)

```sql
WITH base AS (
    SELECT h.doc_no,
           h.doc_date,
           COALESCE(h.due_date, h.credit_date, h.doc_date) AS effective_due_date,
           h.cust_code,
           COALESCE(c.name_1, h.cust_code, '') AS cust_name,
           (
               COALESCE(h.total_amount, 0)
               - COALESCE((
                   SELECT SUM(COALESCE(p.sum_pay_money, 0) + COALESCE(p.lost_profit_exchange_amount, 0))
                   FROM ap_ar_trans_detail p
                   WHERE COALESCE(p.last_status, 0) = 0
                     AND p.trans_flag = 239
                     AND p.billing_no = h.doc_no
                     AND p.bill_type = h.trans_flag
               ), 0)
               - COALESCE((
                   SELECT SUM(GREATEST(COALESCE(cn.total_amount, 0) - COALESCE((
                       SELECT ABS(SUM(COALESCE(cp.sum_pay_money, 0)))
                       FROM ap_ar_trans_detail cp
                       WHERE COALESCE(cp.last_status, 0) = 0
                         AND cp.trans_flag = 239
                         AND cp.billing_no = cn.doc_no
                         AND cp.bill_type = cn.trans_flag
                   ), 0), 0))
                   FROM ic_trans cn
                   WHERE COALESCE(cn.last_status, 0) = 0
                     AND cn.trans_flag IN (48, 97)
                     AND cn.doc_ref = h.doc_no
               ), 0)
           )::numeric(18, 2) AS remain_amount
    FROM ic_trans h
    LEFT JOIN ar_customer c ON c.code = h.cust_code
    WHERE COALESCE(h.last_status, 0) = 0
      AND h.trans_flag = 44
      AND COALESCE(h.inquiry_type, 0) IN (0, 2)
      AND COALESCE(h.due_date, h.credit_date, h.doc_date) <= $1::date
)
SELECT doc_no,
       doc_date,
       effective_due_date,
       cust_code,
       cust_name,
       remain_amount
FROM base
WHERE remain_amount > 0
ORDER BY effective_due_date ASC, doc_no ASC;
```

### 4.2 เช็คถึงกำหนด, สต็อกต่ำกว่าจุดสั่งซื้อ และ PR/PO รออนุมัติ (`cb_chq_list`, `ic_inventory_detail`, `ic_trans`)

```sql
-- เช็คถึงกำหนด (chq_type: 1=รับ, 2=จ่าย; ยกเว้นสถานะ 2, 7, 8)
SELECT COALESCE(c.chq_number, '') AS chq_number,
       COALESCE(c.chq_type, 1) AS chq_type,
       c.chq_get_date,
       COALESCE(c.chq_due_date, c.chq_get_date) AS due_date,
       COALESCE(c.ap_ar_code, '') AS party_code,
       COALESCE(c.bank_code, '') AS bank_code,
       COALESCE(c.amount, 0)::numeric(18, 2) AS chq_amount
FROM cb_chq_list c
WHERE COALESCE(c.status, 0) NOT IN (2, 7, 8)
  AND COALESCE(c.amount, 0) > 0
  AND c.chq_type IN (1, 2)
  AND COALESCE(c.chq_due_date, c.chq_get_date) <= $1::date
ORDER BY due_date ASC, chq_number ASC;
```

```sql
-- เอกสารขอซื้อ/สั่งซื้อ (trans_flag 2, 6) รออนุมัติและยังไม่ออกเอกสารอนุมัติ (trans_flag 4, 8)
SELECT h.doc_no,
       h.trans_flag,
       h.doc_date,
       COALESCE(h.cust_code, '') AS vendor_code,
       COALESCE(s.name_1, h.cust_code, '') AS vendor_name,
       COALESCE(h.total_amount, 0)::numeric(18, 2) AS total_amount
FROM ic_trans h
LEFT JOIN ap_supplier s ON s.code = h.cust_code
WHERE COALESCE(h.last_status, 0) = 0
  AND h.trans_flag IN (2, 6)
  AND COALESCE(h.approve_status, 0) = 0
  AND COALESCE(h.doc_success, 0) = 0
  AND COALESCE(h.used_status, 0) = 0
  AND NOT EXISTS (
      SELECT 1
      FROM ic_trans apv
      WHERE COALESCE(apv.last_status, 0) = 0
        AND apv.trans_flag IN (4, 8)
        AND apv.doc_ref = h.doc_no
  )
ORDER BY h.doc_date DESC, h.doc_no DESC;
```

หมายเหตุ: ในการเช็กสินค้าต่ำกว่าจุดสั่งซื้อ (`morning_briefing.go:708-751`) ตาราง `ic_inventory` จะ Join แบบ `LEFT JOIN LATERAL` กับ `ic_inventory_detail` (คอลัมน์ `purchase_point`, `minimum_qty`) โดยกรอง `COALESCE(i.item_status, 0) = 0 AND COALESCE(i.item_type, 0) NOT IN (3, 5)` เพื่อเปรียบเทียบ `balance_qty` กับจุดสั่งซื้อ — ดูเอกสาร Workflow ต้นทางที่ [[api-process-engine]] และ [[sql-ic-stock-balance]]
