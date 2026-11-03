---
title: "รายงาน 5 ตัวของ AutoCare ในระบบรายงานกลาง (sys-autocare-reports)"
tags: [systems, autocare, report]
aliases: ["รายงาน AutoCare", "report_menu_autocare", "ac_res_executive_queue", "ac_res_posted_ledger", "ac_res_dot_fefo_aging", "ac_res_tech_wallet", "ac_res_warranty_crm"]
sources:
  - "backend/internal/application/process/report_menu_autocare.go:9-15"
  - "backend/internal/application/process/report_menu_autocare.go:17-76"
  - "backend/internal/application/process/report_menu_autocare.go:78-194"
  - "backend/internal/application/process/report_menu_autocare.go:196-244"
  - "backend/internal/application/process/report_menu_autocare.go:246-352"
  - "backend/internal/application/process/report_menu_autocare.go:354-453"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:2262-2270"
  - "frontend/autocare/AutoCareScreenContent.tsx:926-981"
---

# รายงานของ AutoCare

รายงานทั้ง 5 ตัวลงทะเบียนด้วย `registerMenuReport` ใน `init()` (report_menu_autocare.go:9-15) จึงเรียกผ่านระบบรายงานกลางได้ด้วย `menuKey` เดียวกับเมนูบนเว็บ ดู [[proc-report-engine]] และ [[proc-report-registry-conditions]] เงื่อนไขที่ใช้ได้คือ ช่วงวันที่ คำค้น และช่วงรหัส (`p.DateFrom`, `p.DateTo`, `p.Keyword`, `p.FromCode`, `p.ToCode`)

ทุกรายงานอ่านจากตาราง `autocare_*` เท่านั้น ไม่มีรายงานตัวไหนอ่าน `ic_trans` หรือ `gl_journal` ตรง

| menuKey | อ่านจาก | สรุป / รายละเอียด | เรียงตาม |
|---|---|---|---|
| `ac_res_executive_queue` (:17-76) | `autocare_job_order` | แบบเดียว แสดงคิวรถ ช่อง ช่าง สถานะ อะไหล่ ค่าแรง VAT และยอดสุทธิ | วันที่ใบงานล่าสุดก่อน (:60) |
| `ac_res_posted_ledger` (:78-194) | รายละเอียด: `autocare_job_order` JOIN `autocare_job_item` (:107-115) สรุป: `autocare_job_order` (:144-176) | มีทั้งสองแบบ | สรุป: ใบที่ลงบัญชีแล้วขึ้นก่อน (:176) |
| `ac_res_dot_fefo_aging` (:196-244) | `autocare_tire_dot_stock` | แบบเดียว มูลค่าคิดจาก `qty_on_hand × promo_price` คือราคาขาย ไม่ใช่ทุน (:222-223) | `AGED_CLEARANCE`, `AGING_PROMO`, ที่เหลือ แล้วตามปีและสัปดาห์ DOT (:228) |
| `ac_res_tech_wallet` (:246-352) | รายละเอียด: ใบงาน JOIN บรรทัด เรียงตามช่าง (:272-277) สรุป: `autocare_technician_wallet` (:330) | มีทั้งสองแบบ | รหัสช่าง |
| `ac_res_warranty_crm` (:354-453) | รายละเอียด: `autocare_warranty_claim` (:380) สรุป: `autocare_vehicle` (:431) | มีทั้งสองแบบ | วันเคลม หรือทะเบียนรถ |

## บนหน้าเว็บ
เมนู 4.2 ถึง 4.5 เปิดใน `UniversalReportScreen` ส่วน 4.1 เป็นแดชบอร์ดของ AutoCare เองที่สลับเป็นโหมดรายงานได้ (AutoCareScreenContent.tsx:926-981) ดู [[sys-autocare-screens-menus]] และ [[fe-report-screens]] <!-- pragma: allowlist secret -->

## ข้อควรรู้เรื่องตัวเลข
- คอลัมน์ส่วนลดในรายงานสรุป 4.2 คิดจาก `turn_in_discount + coupon_discount + owner_special_discount` โดยไม่ดูสถานะอนุมัติ (report_menu_autocare.go:167) แต่ตอนคำนวณบิลและโพสต์ ส่วนลดเจ้าของจะนับเฉพาะเมื่อ `APPROVED` (handler.go:2262-2270) ถ้ามีคำขอส่วนลดที่ยังรออนุมัติ ส่วนลดในรายงานจึงอาจสูงกว่าในบิล <!-- pragma: allowlist secret -->
- รายงาน 4.2 อ่านเลข `bc_doc_no` และยอดจาก `autocare_job_order` ถ้าต้องการยอดที่ลงบัญชีจริง ให้ดูเอกสาร trans_flag 44 ใน BC Account ดู [[doc-sale-invoice]] <!-- pragma: allowlist secret -->

## ที่มาในโค้ด
- `backend/internal/application/process/report_menu_autocare.go:9-15`: ลงทะเบียน 5 รายงาน
- `backend/internal/application/process/report_menu_autocare.go:78-194`: posted ledger
- `backend/internal/application/process/report_menu_autocare.go:196-244`: DOT/FEFO

ดูเพิ่ม: [[sys-autocare-overview]] · [[sys-autocare-billing-gl]] · [[sys-autocare-stock-warranty-rebuild]]
