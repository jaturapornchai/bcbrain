---
title: "สร้างและประทับเวลาเอกสาร e-Tax (sys-etax-document-stamp)"
tags: [systems, etax, vat, wht, minio, rounding]
aliases: ["STAMP_ETDA", "SCAN_OCR", "etaxAmounts", "etax_document_log", "ประทับเวลา ETDA", "สแกนบิล OCR", "CreateOrStampDocument"]
sources: ["backend/internal/adapter/inbound/http/etax/handler.go:168-283", "backend/internal/adapter/inbound/http/etax/handler.go:289-357", "backend/internal/adapter/inbound/http/etax/handler.go:363-391", "backend/internal/adapter/inbound/http/etax/handler.go:394-410", "backend/internal/adapter/inbound/http/etax/handler.go:432-466", "backend/internal/adapter/inbound/http/etax/handler.go:592-622", "backend/internal/adapter/inbound/http/etax/handler.go:953-986", "backend/internal/adapter/inbound/http/etax/handler.go:1016-1054", "frontend/etax/EtaxDashboard.tsx:119-145", "frontend/etax/EtaxDashboard.tsx:237-241", "frontend/etax/EtaxDashboard.tsx:262-286", "frontend/etax/EtaxDashboard.tsx:318-325", "frontend/etax/EtaxDashboard.tsx:1105-1114", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:27-28", ".agents/skills/secure-api-data-integrity-checklist/SKILL.md:29"]
---
# สร้างและประทับเวลาเอกสาร e-Tax (sys-etax-document-stamp)

`POST /api/v1/etax/document` (`CreateOrStampDocument`) มีสองทาง ถ้า `action_type` เป็น `STAMP_ETDA` และมี `etax_doc_no` ระบบจะประทับเวลาเอกสารเดิม ถ้าไม่ใช่ (รวมถึงค่า `SCAN_OCR` ที่หน้าจอส่งมา) ระบบจะสร้างแถวใหม่ใน `etax_document_log` ทั้งสองทางตอบกลับด้วย overview ชุดใหม่

## รับข้อมูล

- รับได้ทั้ง multipart (ขนาดรวมไม่เกิน 32 MB) และ JSON body (`handler.go:198`, `:268-283`)
- รูปหลักฐานรับจากฟิลด์ `photos` หรือ `photo` และอ่านได้สูงสุดไฟล์ละ 15 MB ป้ายกำกับแต่ละรูปส่งมาทาง `photo_labels` (`:219-230`)
- ถ้าส่ง `generate_sample_photo=true` มาโดยไม่มีรูป ระบบจะสร้างรูปตัวอย่างให้ (ค่าตั้งต้น 3 รูป, `:394-397`)
- รูปเก็บใน MinIO ที่ key `<ฐานข้อมูล>/<โฟลเดอร์>/<วันเวลา>_<hash><นามสกุล>` และมีภาพย่อที่ `<key>.thumb.jpg` โฟลเดอร์ที่ใช้คือ `etax-docs` ตอนประทับเวลา และ `etax-ocr` ตอนสร้าง (`:317`, `:410`, `:953-986`)

## ทางที่ 1: ประทับเวลา (`STAMP_ETDA`)

1. อ่านแถวเดิมตาม `etax_doc_no` (`:289-297`)
2. สร้างรหัสรับรองเองในเครื่องเป็น `ETDA-TS-2569-` ตามด้วยเวลา (`:337`)
3. `UPDATE etax_document_log SET etda_status = 'TIMESTAMP_VERIFIED'` พร้อมรหัส หมายเหตุ และ key รูป (`:345`)
4. ถ้า update ไม่สำเร็จจะคืน error ไม่ตอบ overview เหมือนสำเร็จ (`:349-352`)

> ข้อสังเกตจากโค้ด: ไม่มีการเรียกบริการประทับเวลาภายนอก รหัสรับรองสร้างเองจากเวลาในเครื่อง

## ทางที่ 2: สร้างเอกสาร (OCR หรือฟอร์ม)

ค่าตั้งต้นเมื่อไม่ได้ส่งมา (`:363-390`)

| ฟิลด์ | ค่าตั้งต้นในโค้ด |
|---|---|
| `etax_doc_no` | `ETAX-6910-` ตามด้วยเวลา |
| `doc_type` | `OCR_EXPENSE_TAX_BILL` |
| `erp_ref_doc_no` | `AP-OCR-` ตามด้วยเวลา |
| `party_code` / `party_name` / `party_tax_id` / `branch_code` | ค่าคงที่ในโค้ด (ไม่คัดลอกมาที่นี่) |
| `base_amount` | 12500.00 เมื่อ ≤ 0 |
| `vat_rate` | 7.00 เฉพาะกรณีค่าติดลบ |

> ข้อสังเกตจากโค้ด: `vat_rate` อ่านด้วย `strconv.ParseFloat` แล้วทิ้ง error (`:214`) ส่วน JSON ที่ไม่มีฟิลด์นี้ได้ค่า 0 (`:280`) ค่าตั้งต้น 7 ใช้เฉพาะเมื่อติดลบ (`:388-389`) จึงทำให้คำขอที่ไม่ส่ง `vat_rate` ได้ VAT 0

ค่าที่ระบบใส่ตายตัวตอน insert (`:432-466`)

- `etda_status` = `TIMESTAMP_VERIFIED` และรหัส `ETDA-OCR-2569-` ตามด้วยเวลา
- `xml_standard` = `ETDA ขมธอ. 3-2560 (PDF/A-3 + XML)`
- `ocr_confidence_pct` = 99.7 และ `slip_verify_status` = `VERIFIED_PROMPTPAY_QR` ซึ่งเป็นค่าคงที่ ไม่ได้มาจากการอ่าน OCR จริง
- `doc_date` เก็บเป็นวันที่ ค.ศ. รูปแบบ `YYYY-MM-DD` (`:451`)
- ถ้า insert ไม่สำเร็จจะคืน error (`:460-462`)

## สูตรคำนวณยอด (`etaxAmounts`)

| ค่า | สูตรในโค้ด (`:1016-1032`) |
|---|---|
| VAT | ปัด 2 ตำแหน่ง (`base × vat_rate ÷ 100`) |
| WHT | ปัด 2 ตำแหน่ง (`base × wht_rate ÷ 100`) |
| total | ปัด 2 ตำแหน่ง (`base + VAT − WHT`) |

- ใช้ `math/big.Rat` แปลงตัวเลขเป็นทศนิยมตามที่ผู้ใช้พิมพ์ (`typedDecimal`) แล้วปัดครึ่งออกจากศูนย์ที่สตางค์ (`roundSatang`, `:1034-1054`)
- ถ้าค่าเป็น NaN หรือ Inf จะใช้ float คำนวณแทน (`:1018-1022`)
- บทเรียนที่บันทึกไว้: เดิมปัดด้วย float จนผิดหนึ่งสตางค์ และเดิมบันทึกไม่สำเร็จแต่ยังตอบ 200 (`KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:27-28`) skill ตรวจ API ใช้ `etaxAmounts` เป็นตัวอย่างอ้างอิงเรื่องการปัด ดู [[acc-rounding-decimal]]

## ฝั่งหน้าจอ

- ปุ่มประทับเวลาส่ง `action_type: "STAMP_ETDA"` (`EtaxDashboard.tsx:237-241`)
- ฟอร์ม OCR ส่ง `SCAN_OCR` พร้อมอัตรา VAT/WHT ที่ผู้ใช้เลือก (`:318-325`) ประเภทเอกสารให้เลือก 4 ค่า คือ `OCR_EXPENSE_TAX_BILL`, `PURCHASE_TAX_INVOICE`, `SALES_ETAX_INVOICE`, `SALES_ETAX_TOURIST_VRT` (`:1105-1114`)
- ฟอร์มนักท่องเที่ยวคำนวณฐานภาษีในเบราว์เซอร์เป็น `round(gross ÷ 1.07, 2)` ใช้เลขหนังสือเดินทางเป็น `party_code` และ `party_tax_id` แล้วส่ง `vat_rate` = 7 (`:262-286`)
- ป้ายประเภทเอกสาร (`docTypeBadge`) จัดกลุ่มเป็น ขายนักท่องเที่ยว ขาย ซื้อแบบ 3-Way Match และบิลค่าใช้จ่าย OCR (`:119-145`)

## ตาราง `etax_document_log`

สร้างที่ `handler.go:592-622` คอลัมน์เงินเป็น `numeric(18,2)` ได้แก่ `base_amount`, `vat_amount`, `wht_amount`, `total_amount` อัตราเป็น `numeric(10,2)` ได้แก่ `vat_rate`, `wht_rate` คอลัมน์อ้างอิงข้ามระบบ ได้แก่ `erp_ref_doc_no`, `wms_ref_doc_no`, `tms_ref_trip_no`, `procure_ref_po_no` ส่วนวันที่ `doc_date` เป็น `varchar(30)`

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/etax/handler.go:168-283` รับ multipart/JSON และรูป
- `backend/internal/adapter/inbound/http/etax/handler.go:289-357` ทาง `STAMP_ETDA`
- `backend/internal/adapter/inbound/http/etax/handler.go:363-391` ค่าตั้งต้นและการเรียก `etaxAmounts`
- `backend/internal/adapter/inbound/http/etax/handler.go:432-466` insert พร้อมค่าคงที่ของสถานะ
- `backend/internal/adapter/inbound/http/etax/handler.go:592-622` DDL ตาราง
- `backend/internal/adapter/inbound/http/etax/handler.go:953-986` เก็บรูปใน MinIO
- `backend/internal/adapter/inbound/http/etax/handler.go:1016-1054` `etaxAmounts`, `typedDecimal`, `roundSatang`
- `frontend/etax/EtaxDashboard.tsx:119-145`, `:237-241`, `:262-286`, `:318-325`, `:1105-1114` ฝั่งหน้าจอ
- `docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:27-28` บทเรียน B5 และ B6
- `.agents/skills/secure-api-data-integrity-checklist/SKILL.md:29` ตัวอย่างอ้างอิงเรื่องการปัด
- ดูเพิ่ม: [[sys-etax-overview]] · [[sys-etax-vat-wht-summary]] · [[acc-rounding-decimal]] · [[api-blob]]
