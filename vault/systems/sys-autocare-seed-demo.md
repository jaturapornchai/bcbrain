---
title: "ข้อมูลเดโมที่ AutoCare สร้างเองและบิลตัวอย่างที่ลงบัญชีให้ (sys-autocare-seed-demo)"
tags: [systems, autocare, seed, demo]
aliases: ["AutoCare seed", "EnsureSeeded", "ensureSeededClosedJobPosted", "JOB-2610-006", "AC-INV2610-001", "PU-2610-088"]
sources:
  - "backend/internal/adapter/inbound/http/autocare/seed.go:14-27"
  - "backend/internal/adapter/inbound/http/autocare/seed.go:276-379"
  - "backend/internal/adapter/inbound/http/autocare/seed.go:381-461"
  - "backend/internal/adapter/inbound/http/autocare/seed.go:463-595"
  - "backend/internal/adapter/inbound/http/autocare/seed.go:596-648"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:357-358"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:981"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:2304-2334"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:2165-2166"
  - "backend/internal/adapter/inbound/http/autocare/handler.go:2191-2196"
---

# ข้อมูลเดโมของ AutoCare

## สร้างเมื่อไร
- `Overview` และ `Action` เรียก `EnsureSeeded` ทุกครั้ง (handler.go:357, :981) ฟังก์ชันนี้เช็กแค่ว่ามี `ProviderCode` และ `DatabaseName` แล้วรันครั้งเดียวต่อฐานข้อมูลต่อการเปิด process โดยใช้คีย์ `autocare_v2` (seed.go:14-27)
- ในโค้ดไม่มีเงื่อนไขว่าต้องเป็นฐานเดโม ฐานบริษัทไหนที่เปิดหน้า AutoCare ก็จะได้ข้อมูลชุดนี้ คอมเมนต์ในโค้ดเขียนว่า "in bcdemo" (seed.go:276) แต่โค้ดไม่ได้บังคับ
- คำสั่ง INSERT ส่วนใหญ่ใช้ `ON CONFLICT … DO NOTHING` แถวที่มีอยู่แล้วจึงไม่ถูกเขียนทับ ยกเว้น `autocare_job_item` ของใบงานเดโม ซึ่งถูก DELETE แล้ว INSERT ใหม่ทุกครั้งที่ seed รัน (seed.go:565-595)

## ตารางหลักร่วมที่ seed เพิ่มข้อมูล (seed.go:276-379)
| ตาราง | ข้อมูล |
|---|---|
| `ic_warehouse` | `WH1`, `WH-TIRE`, `WH-PART` |
| `ic_shelf` | ที่เก็บของแต่ละคลัง |
| `ap_supplier` | ผู้จำหน่าย 6 ราย |
| `ar_customer` | ลูกค้า 12 ราย `AR-AC01` ถึง `AR-AC12` ทั้งรายย่อยและ Fleet |
| `ic_inventory` + `ic_unit_use` | 27 SKU ได้แก่ `TIRE-*`, `WHEEL-*`, `PART-*`, `CARE-*`, `ACC-*`, `SRV-*`, `TIRE-TURNIN-CREDIT` |

SKU ค่าแรง `SRV-*` เคยถูก seed เป็นสินค้าชุด (`item_type 3`) ซึ่งทำให้ยอดหายไปจากใบกำกับและ GL จึงมีคำสั่งแก้เป็นสินค้าบริการ (`item_type 1`) (seed.go:348-349)

## ตาราง `autocare_*`
| ตาราง | จำนวนแถว | บรรทัด |
|---|---|---|
| `autocare_tire_dot_stock` | 22 ล็อต | seed.go:381-411 |
| `autocare_vehicle` | 12 คัน | seed.go:413-433 |
| `autocare_service_bay` | 6 ช่อง | seed.go:435-448 |
| `autocare_technician_wallet` | 6 คน | seed.go:450-461 |
| `autocare_job_order` | 6 ใบ `JOB-2610-001` ถึง `006` | seed.go:463-563 |
| `autocare_job_item` | 18 บรรทัด | seed.go:565-595 |
| `autocare_tire_hotel` | 6 | seed.go:596-608 |
| `autocare_warranty_claim` | 5 | seed.go:610-621 |
| `autocare_blind_receiving` | 4 | seed.go:623-633 |
| `autocare_member_coupon` | 4 | seed.go:635-644 |

คอมเมนต์ในโค้ดบอกจำนวนมากกว่าข้อมูลจริง เช่น ใบงานบอก 8 ใบ (seed.go:463) แต่มีจริง 6 ใบ ตารางนี้นับจากแถวข้อมูลจริง

ใบงานเดโมครอบคลุมทุกสถานะและทุกโหมด
- `001` อยู่ที่ QC_READY มีส่วนลดเจ้าของที่อนุมัติแล้ว
- `002` อยู่ที่ IN_BAY_REPAIR มีคำขอส่วนลดที่รออนุมัติ
- `003` อยู่ที่ ESTIMATE_PENDING โหมด `garage_ev`
- `004` อยู่ที่ IN_BAY_REPAIR โหมด `carcare_tint`
- `005` อยู่ที่ INTAKE_PRECHECK โหมด `accessory_bom`
- `006` อยู่ที่ BILLED_POSTED มีเลขเอกสาร `AC-INV2610-001`

ทั้งหมดอยู่ที่ seed.go:474-563

ค่า `fefo_status` ที่ seed ใส่คือ `FRESH`, `WARNING_AGED` และ `CLEARANCE` (seed.go:382-411) ซึ่งไม่ตรงกับค่าที่ Rebuild ใช้ (`AGED_CLEARANCE`, `AGING_PROMO`, `FRESH_FAST_MOVING`, handler.go:2191-2196) ค่าจะถูกแก้เมื่อ Rebuild ทำงานครั้งแรก ดู [[sys-autocare-stock-warranty-rebuild]]

## เอกสารบัญชีจริงที่ระบบสร้างให้ (handler.go:2304-2334)
`ensureSeededClosedJobPosted` รันหลัง seed ในทุก Overview ครั้งเดียวต่อ process โดยใช้คีย์ `autocare_posted_seed_v6` ฟังก์ชันจะเช็กใน `ic_trans` ก่อน ถ้ายังไม่มีเอกสารจะโพสต์ผ่าน `SaveTrans` ให้
- `AC-INV2610-001` trans_flag 44 จากใบงาน `JOB-2610-006` รับเงินด้วย `PROMPTPAY_QR`
- `PU-2610-088` และ `PU-2610-085` trans_flag 12 จากใบรับ `BLIND-2610-03` และ `BLIND-2610-04`

`rebuildFromRawData` จะโพสต์ใบรับสองใบนี้ซ้ำทุกครั้งด้วยเลขเดิม (handler.go:2165-2166)

**ข้อควรระวัง**: ถ้าเปิด AutoCare ในฐานข้อมูลบริษัทจริง เอกสารขายและซื้อตัวอย่างข้างบนจะเข้า `ic_trans` และ GL ของบริษัทนั้นด้วย เพราะโพสต์ผ่าน SaveTrans ปกติ ดู [[acc-transaction-save-flow]]

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/autocare/seed.go:14-27`: EnsureSeeded
- `backend/internal/adapter/inbound/http/autocare/seed.go:276-644`: ข้อมูล seed ทั้งหมด
- `backend/internal/adapter/inbound/http/autocare/handler.go:2304-2334`: โพสต์บิลตัวอย่าง

ดูเพิ่ม: [[sys-autocare-tables]] · [[sys-autocare-billing-gl]] · [[sys-autocare-blind-receiving]] · [[sys-autocare-overview]]
