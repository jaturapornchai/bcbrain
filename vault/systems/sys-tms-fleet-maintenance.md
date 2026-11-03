---
title: "TMS ทะเบียนรถ งานซ่อมบำรุง PM/CM และเอกสารภาษี (ADD_VEHICLE / CREATE_MAINTENANCE / COMPLETE_MAINTENANCE)"
tags: [systems, tms, fleet, maintenance, tax]
aliases: ["TMS fleet", "ทะเบียนรถ", "ADD_VEHICLE", "CREATE_MAINTENANCE", "COMPLETE_MAINTENANCE", "tms_fleet_vehicle", "tms_maintenance_log", "PM CM", "ซ่อมบำรุงรถ", "OCR_EXPENSE_TAX_BILL", "COMPLETED_READY", "SCHEDULED_DUE"]
sources: ["backend/internal/adapter/inbound/http/tms/handler.go:834-948", "backend/internal/adapter/inbound/http/tms/handler.go:949-1072", "backend/internal/adapter/inbound/http/tms/handler.go:1073-1169", "backend/internal/adapter/inbound/http/tms/handler.go:1370-1415", "backend/internal/adapter/inbound/http/tms/handler.go:1535-1590", "backend/internal/adapter/inbound/http/tms/handler.go:1607-1646", "backend/internal/adapter/inbound/http/tms/handler.go:1697-1731", "frontend/tms/TmsDashboard.tsx:299-310", "frontend/tms/TmsDashboard.tsx:495-600", "frontend/tms/TmsDashboard.tsx:1438-1560", "frontend/src/app/api/tms/trip/route.ts:1-47"]
---
# ทะเบียนรถ และงานซ่อมบำรุง PM/CM ของ TMS

ส่วนนี้ของ [[sys-tms-overview]] คือแท็บ "ทะเบียนรถ" และแท็บ "ซ่อมบำรุงรถ PM/CM & ต่อภาษี" ทั้งสามการกระทำเข้าทางเส้นเดียวกับการเปิดเที่ยวรถ คือ `POST /api/v1/tms/trip` (Next proxy `/api/tms/trip`) แยกด้วยฟิลด์ `action_type`:

| `action_type` | ทำอะไร |
|---|---|
| `ADD_VEHICLE` | เพิ่มรถใน `tms_fleet_vehicle` |
| `CREATE_MAINTENANCE` | เปิดใบสั่งซ่อมใน `tms_maintenance_log` |
| `COMPLETE_MAINTENANCE` | ปิดงานซ่อม คืนรถเป็นพร้อมใช้ และส่งเอกสารค่าใช้จ่ายเข้า `etax_document_log` |
| (ไม่ระบุ) | เปิดเที่ยวรถ ดู [[sys-tms-trip-pod-flow]] |

## ประเภทของรถ (`ownership_type`)
หน้าจอแบ่งกองรถเป็น 4 รูปแบบ ตัวกรองมี ทั้งหมด / รถตัวเอง / รถเหมาช่วง / รถรับจ้างเหมาเที่ยว & 3PL ค่าที่ใช้ในโค้ด:
- `OWN_FLEET`: รถของบริษัท (ทรัพย์สินบริษัท)
- `SUBCONTRACT_CHARTER (รถเหมาช่วงรายเดือน)`: รถเหมาช่วง
- รถรับจ้างเหมาเที่ยว / 3PL: ค่าอื่นทั้งหมดที่ไม่มีคำว่า `OWN` หรือ `SUBCONTRACT`
- KPI นับกลุ่มด้วยการค้นข้อความ `OWN` / `SUBCONTRACT` ในชื่อประเภท (ดู [[sys-tms-overview]])

## เพิ่มรถ (`ADD_VEHICLE`)
ฟิลด์: รหัสรถ, ทะเบียน, ประเภทรถ, ประเภทความเป็นเจ้าของ, ผู้รับเหมา, โมเดลต้นทุน, ค่าเช่าตั้งต้น (`base_rate_baht`), อัตราหัก ณ ที่จ่าย (`wht_tax_rate`), คนขับ, เส้นทาง, เลขไมล์ (`odometer_km`), ระยะเช็กถัดไป (`next_pm_km`), รูปตรวจสภาพ
- ค่าที่ว่างจะถูกเติมด้วยค่าตั้งต้นของโค้ด: รหัสรถ `VEH-<เวลา>`, ประเภทเจ้าของเริ่มที่รถเหมาช่วงรายเดือน, ค่าเช่าตั้งต้น 1,800 บาท
- รถที่ไม่ใช่ `OWN_*` และไม่ได้กรอกอัตราหัก ณ ที่จ่าย ระบบใส่ 1.0 (ร้อยละ)
- เลขไมล์ที่ไม่กรอกใช้ค่าตั้งต้น และ `next_pm_km` = เลขไมล์ + 10,000
- รถใหม่เริ่มสถานะ `AVAILABLE` ค่าสุขภาพรถ (`health_score_pct`) เริ่ม 99.0
- รูปตรวจสภาพ: สาขานี้สร้างรูปตัวอย่าง 2 รูปให้เสมอแล้วเก็บลง MinIO โฟลเดอร์ `tms-fleet` (ไม่ได้ใช้รูปที่ผู้ใช้อัปโหลด) หลักการจัดเก็บรูปเหมือน [[sys-wms-movements-evidence-photos]]
- น้ำหนักบรรทุกสูงสุด 4,500 กก. และอัตราสิ้นเปลือง 9.5 กม./ลิตร เป็นค่าคงที่ที่โค้ดใส่ให้ทุกคัน ส่วนชื่อคนขับ เบอร์โทร เส้นทาง และพิกัดจอดของรถที่ว่างก็ถูกเติมค่าตัวอย่างจากโค้ด ควรแก้ให้เป็นข้อมูลจริงก่อนใช้งาน

## เปิดใบสั่งซ่อม (`CREATE_MAINTENANCE`)
1. ถ้าไม่ระบุรหัสรถ โค้ดใช้ `VEH-01` ระบบดึงทะเบียน ประเภทรถ ประเภทเจ้าของ และเลขไมล์ปัจจุบันจาก `tms_fleet_vehicle` (เลขไมล์จากแถวรถใช้เมื่อไม่ได้ส่งเลขไมล์มา)
2. เลขที่ใบสั่งซ่อมไม่ระบุจะเป็น `MAINT-6910-<เวลา>` ประเภทตั้งต้น `PM_SCHEDULED` (เช็กระยะตามไมล์) ส่วนหัวข้องานและอู่ซ่อมมีค่าตั้งต้นตัวอย่าง
3. ค่าอะไหล่ตั้งต้น 4,200 และค่าแรงตั้งต้น 1,500 เมื่อไม่ส่งหรือส่ง 0
4. คำนวณภาษีในโค้ด (ปัดสตางค์):
   - VAT = (ค่าอะไหล่ + ค่าแรง) x 7%
   - หัก ณ ที่จ่าย = ค่าแรง x 3% (คิดเฉพาะค่าแรง)
   - ยอดรวม = ค่าอะไหล่ + ค่าแรง + VAT - หัก ณ ที่จ่าย
   - ไมล์ครบกำหนดครั้งถัดไป (`next_due_km`) = เลขไมล์ปัจจุบัน + 10,000
5. สถานะเริ่มต้น `SCHEDULED_DUE` และสร้างเลขเอกสารค่าใช้จ่าย `EXP6910-<เวลา>` เก็บในคอลัมน์ `erp_expense_doc_no`
6. รูปใบแจ้งซ่อม: เก็บใน MinIO โฟลเดอร์ `tms-maint` ถ้าไม่แนบรูป ระบบสร้างรูปตัวอย่าง 3 รูป
7. บันทึกด้วย `Insert` ครั้งเดียว ขั้นนี้ **ไม่ได้เปลี่ยนสถานะรถ** (รถยังเป็นสถานะเดิม) งานที่ค้างถูกนับเป็น "งานซ่อมที่รอดำเนินการ" บนหัวจอ (สถานะไม่ใช่ `COMPLETED_READY`)

## ปิดงานซ่อม (`COMPLETE_MAINTENANCE`)
ต้องมี `maint_doc_no` ไม่ส่งตอบ 400 `maint_doc_no is required` ไม่พบใบสั่งตอบ 404 `maintenance order not found` จากนั้นรันชุดคำสั่งใน transaction เดียว (`ExecBatch`):
1. ใบสั่งซ่อมเป็น `COMPLETED_READY` ใส่หมายเหตุช่าง เลขเอกสารค่าใช้จ่าย (ถ้าเดิมว่างจะสร้าง `EXP6910-<เวลา>`) และเพิ่มรูป "ตรวจรับรถหลังซ่อมเสร็จ" 1 รูป (รูปตัวอย่างที่ระบบสร้าง) ลง `tms-maint`
2. รถ (`tms_fleet_vehicle`) กลับเป็น `AVAILABLE`, ตั้ง `next_pm_km` เท่ากับ `next_due_km` ของใบสั่ง และ `health_score_pct` = 99.5
3. เพิ่มแถวใน `etax_document_log` (เมนู e-Tax) ประเภท `OCR_EXPENSE_TAX_BILL` เลขที่ `TAX-<เลขเอกสารค่าใช้จ่าย>`:
   - ฐานภาษี = ค่าอะไหล่ + ค่าแรง, อัตรา VAT 7.00, อัตราหัก ณ ที่จ่าย 3.00 (แสดงอ้างอิง ภ.ง.ด.53), ยอดรวมตามใบสั่งซ่อม
   - ผู้ขาย = รหัส `VEND-MAINT` ชื่ออู่ซ่อมจากใบสั่ง; เก็บอ้างอิงเลขใบสั่งซ่อมไว้ในคอลัมน์ `tms_ref_trip_no`
   - ค่าสถานะ `etda_status` = `TIMESTAMP_VERIFIED`, `slip_verify_status` = `VERIFIED_PROMPTPAY_QR`, ความมั่นใจ OCR 99.7 เป็นค่าคงที่ที่โค้ดใส่ให้ ไม่ใช่ผลการตรวจจริง
   - เลขผู้เสียภาษีของผู้ขายในแถวนี้เป็นค่าคงที่ฝังในโค้ด (ไม่คัดลอกมาในบันทึกนี้) จึงต้องแก้ให้เป็นของอู่จริงก่อนนำเอกสารไปใช้ยื่นภาษี
4. ข้อควรรู้: คำสั่งค้นใบสั่งซ่อมใช้เฉพาะ `maint_doc_no` ไม่ตรวจว่าปิดงานไปแล้วหรือยัง การเรียกซ้ำจะทำขั้นตอนเดิมซ้ำตามโค้ด รวมถึงการเพิ่มแถว e-Tax

ความหมายของ VAT และหัก ณ ที่จ่ายในเอกสารบัญชีดู [[flow-tax-vat-wht-reports]] (อัตรา 7% และ 3% ข้างต้นเป็นค่าที่โค้ดกำหนด ไม่ได้ตรวจกับประกาศกรมสรรพากรในบันทึกนี้)

## ที่ส่วนหัวจอ (KPI)
- `maintenance_due_count` = จำนวนใบสั่งซ่อมที่ `maint_status` ไม่ใช่ `COMPLETED_READY`
- `total_maintenance_cost` = ผลรวม `total_cost` ของใบสั่งซ่อมทุกใบ

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/tms/handler.go:834-948` สาขา `ADD_VEHICLE` (ค่าตั้งต้น รูป insert)
- `backend/internal/adapter/inbound/http/tms/handler.go:949-1072` สาขา `CREATE_MAINTENANCE` (คำนวณ VAT/หัก ณ ที่จ่าย, รูป, insert)
- `backend/internal/adapter/inbound/http/tms/handler.go:1073-1169` สาขา `COMPLETE_MAINTENANCE` (ชุดคำสั่ง transaction และการ insert `etax_document_log`)
- `backend/internal/adapter/inbound/http/tms/handler.go:1370-1415` นับกลุ่มรถและการใช้น้ำหนักบรรทุก; `:1535-1590` นับงานซ่อมค้างและค่าซ่อมรวม
- `backend/internal/adapter/inbound/http/tms/handler.go:1607-1646` DDL `tms_fleet_vehicle`; `:1697-1731` DDL `tms_maintenance_log`
- `frontend/tms/TmsDashboard.tsx:299-310` ค่าเริ่มต้นของฟอร์มเพิ่มรถ (ประเภทเจ้าของ); `:495-600` ฟังก์ชันส่ง `ADD_VEHICLE`, `CREATE_MAINTENANCE`, `COMPLETE_MAINTENANCE`; `:1438-1560` แท็บทะเบียนรถและตัวกรอง
- ดูเพิ่ม: [[sys-tms-overview]] · [[sys-tms-trip-pod-flow]] · [[flow-tax-vat-wht-reports]] · [[flow-procure-to-pay]] · [[std-data-integrity-money-transactions]]
