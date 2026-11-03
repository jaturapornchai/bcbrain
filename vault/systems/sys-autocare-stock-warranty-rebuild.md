---
title: "สต็อกยางตาม DOT/FEFO รับฝากยาง เคลม คูปอง และการ Rebuild ของ AutoCare (sys-autocare-stock-warranty-rebuild)"
tags: [systems, autocare, inventory, warranty, rebuild]
aliases: ["DOT FEFO", "Tire Hotel", "รับฝากยาง", "E-Warranty AutoCare", "คูปองสมาชิก", "rebuildFromRawData", "rebuild_autocare_results"]
sources:
  - "backend/internal/adapter/inbound/http/autocare/handler.go:1476-1518"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:1520-1576"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:1726-1793"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:2008-2044"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:2115-2122"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:2130-2209"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:2608-2613"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:2724-2745"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:382-395"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:556-567"
---

# สต็อก DOT รับฝากยาง เคลม คูปอง และ Rebuild

## สต็อกยางตามล็อต DOT (`autocare_tire_dot_stock`)
- **บันทึกแคตตาล็อก** `save_catalog_item` (handler.go:1726-1793) คีย์คือ `sku_dot_id` ถ้าไม่ได้ส่งมาจะใช้ `item_code-dot_code` รหัส DOT 4 หลักแยกเป็นสัปดาห์ (2 ตัวแรก) และปี (`2000 + 2 ตัวหลัง`) ถ้าแปลงไม่ได้จะใช้สัปดาห์ 18 ปี 2026 ค่าเริ่มต้นอื่นคือ `fefo_status = FRESH_FAST_MOVING`, คลัง `WH1/SH1`, ค่าคอมช่าง 100 และรับประกัน 24 เดือน/50000 กม. ตารางนี้มีแค่ราคาขายและราคาโปร ไม่มีทุน
- **จำนวนคงเหลือ** `qty_on_hand` เพิ่มเมื่อสร้างใบรับของใหม่ ดู [[sys-autocare-blind-receiving]] และลดเมื่อปิดบิลบรรทัดที่มี DOT โดยใช้ `GREATEST(0, qty_on_hand - qty)` (handler.go:2608-2613) ตารางนี้แยกจากสต็อกของ BC Account ซึ่งเปลี่ยนตามเอกสาร `ic_trans` ที่ SaveTrans บันทึก
- handler ไม่ INSERT หรือ UPDATE `ic_inventory` และ `ar_customer` เลย ใช้แค่อ่าน `item_type` (handler.go:2232, :2517) รหัสสินค้าและลูกค้าที่ใช้ในใบงานจึงต้องมีในข้อมูลหลักอยู่แล้ว ดู [[tbl-ic-inventory]]
- **FEFO** (ยางที่ผลิตก่อนควรขายก่อน) ทุกครั้งที่ Rebuild ระบบตั้งสถานะใหม่ (handler.go:2191-2196)
  - `dot_year ≤ 2024` เป็น `AGED_CLEARANCE`
  - `dot_year = 2025` และ `dot_week ≤ 30` เป็น `AGING_PROMO`
  - ที่เหลือเป็น `FRESH_FAST_MOVING`
  ปีเกณฑ์เขียนไว้ตายตัวในโค้ด ไม่ได้คำนวณจากวันที่ปัจจุบัน KPI `dot_alerts` นับสองสถานะแรก (handler.go:389)

## รับฝากยาง (Tire Hotel) `check_in_tire_hotel` (handler.go:1520-1576)
เลขรับฝากคือ `"TH-"` ต่อด้วย 8 ตัวแรกของ Stamp ค่าเริ่มต้น 4 เส้น วันหมดอายุคือ `CURRENT_DATE + 180 วัน` สถานะ `STORED` การรับฝากไม่ได้แตะสต็อก ใบงาน หรือบัญชี KPI นับรายการที่สถานะเป็น `STORED` หรือ `EXPIRED_ALERT` (handler.go:390)

## ใบรับประกันและงานเคลม (`autocare_warranty_claim`)
- ตอนปิดบิล ระบบสร้างใบรับประกันดิจิทัล `claim_type = E_WARRANTY` เลข `CLM-<เลขใบงาน>` และ `WRT-<เลขใบงาน>` สถานะ `REGISTERED` ข้อความในใบระบุ "2 ปี / 50,000 กม." (handler.go:2724-2745)
- `advance_warranty_claim` เลื่อนสถานะทีละขั้น (handler.go:1476-1497): `REGISTERED` → `SENT_TO_FACTORY` → `FACTORY_INSPECTING` → `REPLACEMENT_READY` → `CLOSED` สถานะอื่นจะกลายเป็น `CLOSED`

## คูปองสมาชิก (`autocare_member_coupon`)
- `save_member_coupon` สร้างแพ็กเกจหมดอายุใน 365 วัน ค่าเริ่มต้น 10 สิทธิ์ สิทธิ์ละ 450 (handler.go:2008-2044)
- `use_member_coupon` บวก `used_count` 1 ลด `remaining_uses` 1 และเมื่อสิทธิ์หมดจะเปลี่ยนเป็น `COMPLETED` (handler.go:1499-1518) action นี้ไม่ได้ใส่ `coupon_discount` ให้ใบงานใด ส่วนลดคูปองในบิลต้องตั้งในใบงานเอง

## Rebuild `rebuildFromRawData` (handler.go:2130-2209)
เรียกจากเมนู 5.1 (`rebuild_autocare_results`, handler.go:2115-2122) และ action แทบทุกตัวก็เรียกตอนท้าย ทำงานตามลำดับนี้ <!-- pragma: allowlist secret -->
1. วนทุกใบงานแล้วเรียก `recalculateJobTotals` ดู [[sys-autocare-billing-gl]] ใบงานที่ `BILLED_POSTED` จะโพสต์ซ้ำโดยส่ง `bc_doc_no` เดิมเป็น `fixedDocNo` (ถ้ามีเลข) ซึ่งเป็นการ SaveTrans แบบแก้ไข โดยไม่ตัดสต็อกหรือบวกยอดช่องและช่างซ้ำ
2. โพสต์ใบรับเดโม `BLIND-2610-03/04` ซ้ำ ดู [[sys-autocare-seed-demo]]
3. คำนวณใหม่ด้วย SQL ใน transaction เดียว
   - **ช่องซ่อม**: ช่องที่มีใบงานยังไม่ `BILLED_POSTED` เป็น `OCCUPIED` และ `revenue_today = SUM(grand_total)` ของใบที่ลงบัญชีแล้ว ไม่กรองวันที่
   - **กระเป๋าช่าง**: `commission_today = SUM(tech_fee_amt)` ของทุกบรรทัดในใบงานของช่างคนนั้น ไม่กรองวันที่
   - **FEFO** ตามกฎข้างบน
4. ตอบกลับ `rebuilt_jobs`, `posted_invoices` และเวลา

## KPI บนแดชบอร์ด (handler.go:382-395)
- `today_rev` คือ `SUM(grand_total)` ของใบที่ลงบัญชีแล้ว
- `pending_upsell` คือ `SUM(grand_total)` ของใบที่ยังไม่ลงบัญชี
- `completed_today` คือจำนวนใบ `BILLED_POSTED`

ทั้งสามค่าไม่ได้กรองวันที่ ต่างจากที่ชื่อบอก

คำแนะนำ AI บนรถแต่ละคันเป็นกฎตายตัว (handler.go:556-567)
- ถ้าเลขไมล์ ≥ `next_oil_km − 500` แนะนำถ่ายน้ำมันเครื่อง
- ไม่อย่างนั้น ถ้าเลขไมล์ ≥ `next_rotation_km − 500` แนะนำสลับยาง
- ไม่อย่างนั้น ถ้าเป็นรถ EV จะได้ข้อความสำหรับ EV

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/autocare/handler.go:2130-2209`: rebuildFromRawData
- `backend/internal/adapter/inbound/http/autocare/handler.go:1726-1793`: save_catalog_item
- `backend/internal/adapter/inbound/http/autocare/handler.go:1476-1576`: เคลม คูปอง และรับฝากยาง

ดูเพิ่ม: [[sys-autocare-tables]] · [[sys-autocare-reports]] · [[sys-autocare-overview]] · [[acc-inventory-cost-moving-average]]
