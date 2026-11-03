---
title: "ขั้นตอนใบสั่งซ่อมตั้งแต่รับรถจนรับเงิน (sys-autocare-job-flow)"
tags: [systems, autocare, flow, job-order]
aliases: ["ใบสั่งซ่อม AutoCare", "job order", "สถานะใบงานซ่อม", "INTAKE_PRECHECK", "BILLED_POSTED", "autocare action"]
sources:
  - "backend/internal/adapter/inbound/http/autocare/handler.go:975-992"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:993-1109"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:1111-1165"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:1167-1185"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:1187-1247"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:1249-1312"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:1314-1385"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:1874-1943"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:2211-2224"
  - "backend/internal/application/process/report_menu_autocare.go:42-49"
  - "frontend/autocare/AutoCareScreenContent.tsx:2340-2360"
---

# ขั้นตอนใบสั่งซ่อม AutoCare

คำสั่งทุกอย่างส่งเข้า `POST /api/v1/autocare/action` เป็น JSON `{ "action": "...", ... }` จำกัดขนาด body ที่ 2 MB (`MaxBytesReader 2<<20`) แล้วแยกงานด้วย `switch` ตามชื่อ action ที่แปลงเป็นตัวพิมพ์เล็กแล้ว (handler.go:975-992) action ส่วนใหญ่จะเรียก `rebuildFromRawData` ตอนท้ายเพื่อคำนวณยอดและสถานะทั้งระบบใหม่ ดู [[sys-autocare-stock-warranty-rebuild]]

## สถานะของใบงาน (`autocare_job_order.status`)
| ลำดับ | สถานะ | % ความคืบหน้า | เข้าสถานะนี้ด้วย |
|---|---|---|---|
| 1 | `INTAKE_PRECHECK` รับรถและตรวจล้อแม็ก 4 ล้อ | 25 | `create_intake_job` |
| 2 | `ESTIMATE_PENDING` ตรวจ 35 จุดแล้ว รออนุมัติ | 45 | `save_dvi_upsell` |
| 3 | `IN_BAY_REPAIR` กำลังซ่อมบนฮอยท์ | 75 (ถ้าเข้าด้วยการอนุมัติ upsell จะได้อย่างน้อย 65) | `approve_lineoa_upsell` หรือ `advance_job_stage` |
| 4 | `QC_READY` ตรวจ QC พร้อมส่งมอบ | 95 | `advance_job_stage` |
| 5 | `BILLED_POSTED` ปิดบิลและลงบัญชีแล้ว | 100 | `close_bill_post_account` หรือ `advance_job_stage` ไปที่ BILLED_POSTED |

ค่า % มาจาก handler.go:1278-1290 ถ้าส่ง stage อื่นที่ไม่อยู่ในตารางจะได้ 50 ป้ายภาษาไทยของแต่ละสถานะอยู่ในรายงาน 4.1 (report_menu_autocare.go:42-49)

## ทีละขั้น
1. **รับรถ `create_intake_job`** (handler.go:993-1109) ต้องส่งทะเบียนรถมา ถ้าไม่มีจะได้ error เลขใบงานคือ `"JOB-"` ต่อด้วย 9 ตัวแรกของ `docno.Stamp("0405")` ฟิลด์ที่ไม่ได้ส่งมาจะใช้ค่าเดโม เช่น โหมด `tire_fastfit`, ยาง 4 เส้น เส้นละ 3990 แล้วทำ 4 อย่าง
   - เพิ่มหรืออัปเดตรถใน `autocare_vehicle` เลขไมล์จะเก็บค่าที่มากกว่าเสมอ
   - สร้างใบงานสถานะ `INTAKE_PRECHECK` 25% วิธีชำระเริ่มต้น `PROMPTPAY_QR` และ `accounting_posted = FALSE`
   - เพิ่มบรรทัดยางบรรทัดแรก
   - ตั้งช่องซ่อมเป็น `OCCUPIED`
   ยอดเงินที่บันทึกตอนนี้เป็นค่าตั้งต้นเท่านั้น `rebuild` จะคำนวณใหม่ตามกฎใน [[sys-autocare-billing-gl]]
2. **ตรวจ 35 จุดและเสนอซ่อมเพิ่ม `save_dvi_upsell`** (handler.go:1111-1165) เพิ่มรายการใน `upsell_items_json` โดยตั้ง `approved:false` เพิ่มบรรทัด PART ที่ `is_upsell_approved = FALSE` และเปลี่ยนสถานะจาก INTAKE เป็น `ESTIMATE_PENDING`
3. **ลูกค้าอนุมัติผ่าน LINE OA `approve_lineoa_upsell`** (handler.go:1167-1185 → `approveJobUpsellAndRecalc` handler.go:2211-2224) ตั้งทุกบรรทัดเป็น `is_upsell_approved = TRUE` ถ้าสถานะยังเป็น INTAKE หรือ ESTIMATE จะย้ายไป `IN_BAY_REPAIR` แล้วคำนวณยอดใหม่ ในโค้ดไม่มีการเรียก LINE จริง
4. **เพิ่มรายการ `add_job_item`** (handler.go:1187-1247) `line_total = qty × unit_price` ค่าแรงช่างต่อบรรทัด 150 ถ้าส่ง `turn_in_discount` มาจะบวกเพิ่มเข้าใบงาน แล้วคำนวณยอดใหม่
5. **ขอส่วนลดพิเศษจากเจ้าของ `request_owner_discount`** (handler.go:1314-1333) ตั้ง `owner_special_discount` (ค่าเริ่มต้น 500) และสถานะคำขอเป็น `REQUESTED`
6. **เจ้าของอนุมัติ `approve_owner_discount`** (handler.go:1335-1360) ตั้งสถานะเป็น `APPROVED` และบันทึกผู้อนุมัติจากชื่อผู้ใช้ใน token แล้วคำนวณยอดใหม่ ส่วนลดนี้จะหักจริงเฉพาะเมื่อได้สถานะ `APPROVED` แล้ว
7. **เลื่อนสถานะ `advance_job_stage`** (handler.go:1249-1312) ถ้าเลื่อนไป `QC_READY` จะตั้ง progress ของช่องซ่อมเป็น 95 ถ้าเลื่อนไป `BILLED_POSTED` จะโพสต์บัญชีเหมือนการปิดบิล
8. **รับเงินและปิดบิล `close_bill_post_account`** (handler.go:1362-1385) เรียก `postJobToBCAccount` ถ้าไม่ได้ส่งวิธีชำระมาจะใช้ `PROMPTPAY_QR` แล้วตอบกลับ `bc_doc_no`, `cert_no` และ `trans_flag: 44` ปุ่มขั้นสุดท้ายบนเว็บส่ง `payment_method` ที่ผู้ใช้เลือกมาด้วย (AutoCareScreenContent.tsx:2340-2360)

## แก้ไขและลบ
- `save_job_order` แก้หัวใบงาน (handler.go:1874-1920)
- `delete_job_order` ลบได้เฉพาะใบงานที่ `accounting_posted = FALSE` (handler.go:1922-1943) ใบงานที่ลงบัญชีแล้วลบจากหน้านี้ไม่ได้
- `delete_job_item` ลบบรรทัด (handler.go:1945)

## ข้อควรรู้
- ใน `postJobToBCAccount` ไม่มีการเช็ก `accounting_posted` ก่อนโพสต์ ถ้าใบงานมี `bc_doc_no` อยู่แล้ว ระบบจะใช้เลขเดิมและ SaveTrans แบบแก้ไข แต่จะตัดสต็อก DOT เพิ่มยอดช่อง/ช่าง และเพิ่มแต้มซ้ำอีกรอบ (handler.go:2553-2565, 2608-2613, 2703-2723)

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/autocare/handler.go:975-992`: Action, decode, switch
- `backend/internal/adapter/inbound/http/autocare/handler.go:993-1385`: action ในวงจรใบงาน
- `backend/internal/adapter/inbound/http/autocare/handler.go:2211-2224`: อนุมัติ upsell
- `backend/internal/application/process/report_menu_autocare.go:42-49`: ป้ายสถานะ

ดูเพิ่ม: [[sys-autocare-overview]] · [[sys-autocare-billing-gl]] · [[sys-autocare-tables]] · [[sys-autocare-flutter-app]]
