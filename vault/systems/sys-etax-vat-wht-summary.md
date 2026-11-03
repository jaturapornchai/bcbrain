---
title: "สรุปภาษีขาย ภาษีซื้อ หัก ณ ที่จ่าย ในระบบ e-Tax (sys-etax-vat-wht-summary)"
tags: [systems, etax, vat, wht, kpi, options]
aliases: ["สรุป VAT e-Tax", "NetVatPayable", "ภาษีขาย ภาษีซื้อ e-Tax", "erp_option_etax_inet", "e-Tax INET", "ใครเขียน etax_document_log"]
sources: ["backend/internal/adapter/inbound/http/etax/handler.go:72-85", "backend/internal/adapter/inbound/http/etax/handler.go:478", "backend/internal/adapter/inbound/http/etax/handler.go:490-519", "backend/internal/adapter/inbound/http/etax/handler.go:564-574", "frontend/etax/EtaxDashboard.tsx:600-654", "frontend/etax/EtaxDashboard.tsx:977-1076", "backend/internal/adapter/inbound/http/market/handler.go:763-764", "backend/internal/adapter/inbound/http/procure/handler.go:1406-1408", "backend/internal/application/process/pos_bill.go:246-265", "backend/internal/adapter/inbound/http/tms/handler.go:1134-1146", "backend/internal/adapter/inbound/http/ai/handler.go:154-157", "frontend/src/app/api/lineoa/route.ts:356", "frontend/src/config/schemas/erpOption/tab8Etax.ts:10-40", "frontend/account/config/OptionsForm.tsx:152", "frontend/account/config/OptionsForm.tsx:261-292"]
---
# สรุปภาษีขาย ภาษีซื้อ หัก ณ ที่จ่าย ในระบบ e-Tax (sys-etax-vat-wht-summary)

ตัวเลขบนการ์ดและแท็บ `vat_wht` ของหน้า `/etax` คำนวณใน `buildOverview` จากทุกแถวของ `etax_document_log` โน้ตนี้อธิบายว่าคำนวณอย่างไร ระบบใดเขียนแถวเข้ามา และค่าตั้งการเชื่อมต่อ e-Tax INET อยู่ที่ไหน

## วิธีคำนวณ KPI

SQL อ่านทุกแถวโดยเรียง `roworder DESC` และไม่มีเงื่อนไขช่วงวันที่ (`handler.go:478`) แล้ววนรวมดังนี้ (`:490-519`)

| KPI (`json`) | กติกาในโค้ด |
|---|---|
| `sales_etax_count`, `output_vat_base`, `output_vat_amount` | แถวที่ `doc_type` มีคำว่า `SALES` |
| `purchase_tax_count`, `input_vat_base`, `input_vat_amount` | แถวอื่นทั้งหมด |
| `wht_cert_count`, `total_wht_amount` | แถวที่ `wht_amount > 0` |
| `pending_stamp_count` | `etda_status = PENDING_STAMP` |
| `verified_stamp_count` | สถานะอื่นทั้งหมด |
| `net_vat_payable` | `output_vat_amount − input_vat_amount` |
| `avg_ocr_confidence_pct` | ค่าเฉลี่ย `ocr_confidence_pct` หรือ 99.5 เมื่อไม่มีเอกสาร |

- ผลรวมเป็น `float64` แล้วปัด 2 ตำแหน่งด้วย `math.Round` ตอนท้าย (`:564-574`)
- หน้าจอแสดงข้อความ "ยอดภาษีขายมากกว่าภาษีซื้อ (ชำระกรมสรรพากร)" เมื่อ `net_vat_payable ≥ 0` และรายการหัก ณ ที่จ่ายกรองเฉพาะแถวที่ `wht_amount > 0` (`EtaxDashboard.tsx:600-654`, `:977-1076`)

> ข้อสังเกตจากโค้ด: ยอดนี้รวมทุกงวดและทุกสถานะ แถวของ POS ที่มีสถานะ `CANCELLED` ก็ยังถูกนับเป็น `verified_stamp_count` และรวมเข้าภาษีขายด้วย ตัวเลขนี้จึงไม่ใช่ยอดยื่นภาษีของงวด ยอดยื่นจริงให้ดูจากรายงานภาษีของระบบบัญชีที่ [[flow-tax-vat-wht-reports]] และ [[acc-vat-register-wht]]

## ระบบที่เขียนแถวเข้า `etax_document_log`

| ผู้เขียน | `doc_type` | จุดในโค้ด |
|---|---|---|
| หน้า `/etax` เอง | ตามที่ผู้ใช้เลือก หรือ `OCR_EXPENSE_TAX_BILL` | [[sys-etax-document-stamp]] |
| Market ตอนกดสั่งซื้อ B2B | `ETAX_SALES_INVOICE` | `market/handler.go:763-764` ดู [[sys-market-checkout-sync]] |
| Procure เมื่อถึงขั้น `MATCHED_3WAY_AP` | `AP_INPUT_TAX_INVOICE` | `procure/handler.go:1406-1408` ดู [[sys-procure-3way-match-sync]] |
| บิล POS (`trans_flag = 44`) | `ETAX_SALES_ABB` | `pos_bill.go:246-265` |
| งานซ่อมบำรุงรถใน TMS | `OCR_EXPENSE_TAX_BILL` (VAT 7, WHT 3) | `tms/handler.go:1134-1146` |

- POS เขียนแบบ best-effort ทิ้ง error (`_, _ = pool.Exec`) หลังบันทึกบิลสำเร็จแล้ว และกันแถวซ้ำด้วย `NOT EXISTS` บน `erp_ref_doc_no` (`pos_bill.go:246-265`)
- ผู้อ่านอื่น: AI copilot อ่าน 4 แถวล่าสุด (`ai/handler.go:154-157`) ดู [[proc-ai-copilot]] และ LINE OA อ่านไปตอบแชท (`api/lineoa/route.ts:356`) ดู [[sys-lineoa-chat-ai]]

## ค่าตั้ง e-Tax INET (แท็บ 8 ในหน้าตั้งค่า)

- แท็บชื่อ "8.e-Tax INET" มีคีย์ `etax.authorization_code`, `etax.api_key`, `etax.pdf_attach`, `etax.uat_mode`, `etax.uat_email_to` (`tab8Etax.ts:10-40`)
- หน้าตั้งค่าอ่านและบันทึกคีย์ที่ขึ้นต้นด้วย `etax.` ลงตาราง `erp_option_etax_inet` แบบลบแล้วใส่ใหม่ (`OptionsForm.tsx:152`, `:261-292`) ดู [[scr-options]]
- ค่าจริงของ authorization code และ API key อยู่ในตาราง `erp_option_etax_inet` ของแต่ละฐาน ไม่ได้เขียนไว้ในโน้ตนี้

> ข้อสังเกตจากโค้ด: ค้นใน `backend/` แล้วไม่พบโค้ด Go ที่อ่าน `erp_option_etax_inet` หรือคีย์ `etax.*` ค่าตั้งนี้จึงยังไม่ได้ถูกใช้ส่งเอกสารไปที่ใด

## ที่มาในโค้ด

- `backend/internal/adapter/inbound/http/etax/handler.go:72-85` โครงสร้าง KPI
- `backend/internal/adapter/inbound/http/etax/handler.go:478` SQL อ่านทุกแถว
- `backend/internal/adapter/inbound/http/etax/handler.go:490-519` กติกาแยกภาษีขาย/ซื้อ/WHT/สถานะ
- `backend/internal/adapter/inbound/http/etax/handler.go:564-574` ปัดยอดและค่าเฉลี่ย OCR
- `frontend/etax/EtaxDashboard.tsx:600-654`, `:977-1076` การ์ดและแท็บสรุป
- `backend/internal/adapter/inbound/http/market/handler.go:763-764` Market เขียนแถว
- `backend/internal/adapter/inbound/http/procure/handler.go:1406-1408` Procure เขียนแถว
- `backend/internal/application/process/pos_bill.go:246-265` POS เขียนแถว
- `backend/internal/adapter/inbound/http/tms/handler.go:1134-1146` TMS เขียนแถว
- `backend/internal/adapter/inbound/http/ai/handler.go:154-157`, `frontend/src/app/api/lineoa/route.ts:356` ผู้อ่าน
- `frontend/src/config/schemas/erpOption/tab8Etax.ts:10-40`, `frontend/account/config/OptionsForm.tsx:152`, `:261-292` ค่าตั้ง e-Tax INET
- ดูเพิ่ม: [[sys-etax-overview]] · [[tbl-gl-journal-vat-sale]] · [[tbl-gl-journal-vat-buy]] · [[term-wht]]
