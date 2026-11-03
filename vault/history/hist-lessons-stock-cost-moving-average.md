---
title: "บทเรียนบั๊กสต็อกและต้นทุนถัวเฉลี่ย (Stock & Moving Average Cost Bugs)"
tags: [history, stock, cost, inventory]
aliases: ["ต้นทุนเฉลี่ยเพี้ยน", "moving average", "flag 66"]
sources: ["git:d9141d8f", "git:9e29f6df", "git:13f953cc", "git:5f188fc3", "git:054c6063", "git:1b79fbc9", "backend/internal/application/process/service.go:189", "backend/internal/application/process/stock_rebuild.go:18"]
---

## ภาพรวม
ต้นทุนถัวเฉลี่ยคำนวณซ้ำได้จากแถว `ic_trans_detail` (AGENTS.md ข้อ 9) ปัญหาที่เกิดซ้ำคือ rebuild นับแถวผิดชุด, ใบรับคืนเข้าสต็อกที่ราคาขาย, ต้นทุนที่ล็อกหรือแบ่งสัดส่วนไม่ตรง C#, และเอกสารชุดสินค้านับสต็อกซ้ำ นโยบายดู [[acc-inventory-cost-moving-average]], [[acc-inventory-stock-rebuild]], [[std-inventory-costing-rules]]

## อาการ
- **S1 rebuild ไม่ตรง C# (d9141d8f):** ข้อความ commit ระบุ LOGIC-STOCK-01..04, 07..09, 11
- **S2 ต้นทุนแฝง/ล็อกต้นทุน (9e29f6df):** ตามข้อความ commit: คำนวณ/บันทึก/ลบต้นทุนแฝง flag 66 และกันแก้เอกสารที่ล็อกให้ตรง C#
- **S3 รับคืนขาย 48 (13f953cc):** UAT S1 #3, #4: ต้นทุนเฉลี่ย DEMO-0055 เปลี่ยน 281.25 เป็น 288.94 และ DEMO-0056 เปลี่ยน 301.00 เป็น 335.61 หลังรับคืนขาย
- **S4 กฎบันทึก (5f188fc3):** ตามชื่อ commit: เพิ่มกฎ C# เรื่องยอดคงเหลือสต็อกและขายต่ำกว่าทุน (ไม่มีอาการรายข้อ)
- **S5 ชุดสินค้า (054c6063):** ชุดสินค้า item_type 3/5 นับทั้งแถวชุดและแถวลูก ยอดรวมหัวบิลซ้ำ (อนุมานจากคอมเมนต์ `trans_set_item.go`)

## สาเหตุ (root cause)
- **S1:** ตัวกรองแถวไม่ตรง C# (`is_doc_copy`, ชนิดสินค้า), ใบเพิ่ม/ลดหนี้ 14/16/311 เปลี่ยนมูลค่าไม่เปลี่ยนจำนวน, ใบโอนเข้า (70) ต้องคิดหลังโอนออก (72) ไม่งั้นต้นทุนผิด (คอมเมนต์ `stock_rebuild.go`)
- **S2:** C# เก็บต้นทุนที่ล็อกใน `sum_of_cost_fix` และกันแก้ด้วย `is_lock_record`
- **S3:** ใบ 48 ใช้ราคาขายเป็นมูลค่ารับเข้า จึงเอากำไรขายไปรวมในต้นทุนเฉลี่ย (คอมเมนต์ B06-001/B06-002 ใน diff)
- **S4:** ยอดคงเหลือต้องคิดจากแถวดิบ ไม่ใช่ตัวนับ `ic_inventory` (คอมเมนต์ `trans_save_rules.go`)
- **S5:** แถวชุดไม่ได้ถือสต็อกจริง มีเฉพาะแถวลูก

## วิธีแก้
- **S1:** `stockRowsSQL`, `stockValueOnlySQL`, เวลา `transferInTime` = เวลา 72 + 1 นาที
- **S2:** `allocateHiddenCost` แบ่งตามน้ำหนักปัดครึ่งขึ้นแล้วลงเศษ; `refuseLockedRecord`; ถัวเฉลี่ยใช้ต้นทุนล็อกแทน
- **S3:** ใบ 48 และ 58/60 ที่ไม่มีต้นทุนต่อหน่วย เข้าสต็อกที่ต้นทุนเฉลี่ยปัจจุบัน + backfill `sum_of_cost` ของ 58 ที่ยังไม่มีราคา
- **S4:** ยอดคงเหลือต้องคิดจากแถวดิบ ไม่ใช่ตัวนับ `ic_inventory` (คอมเมนต์ `trans_save_rules.go`)
- **S5:** `expandSet` สร้างแถวลูก ยอดชุด = ผลรวมลูก; rebuild/ยอดรวมข้าม item_type 3/5
- **S6 (1b79fbc9):** `perm_wh_shelf=1` จำกัดรายการเลือกคลัง/ชั้น ตาม C#
- **S7 (6ba1a6d9, 5e3dbd36):** ปรับสต็อก 2.19.6/2.19.7 สร้างใบปรับเพิ่ม 66/ลด 68 ให้สินค้าที่ไม่ได้นับ (ตามข้อความ commit); ช่อง WMS ดู [[hist-lessons-concurrency-advisory-locks]]

## commit ที่เกี่ยวข้อง
- `d9141d8f` — rebuild/ถัวเฉลี่ยตรง C#
- `9e29f6df` — ต้นทุนแฝง flag 66 + ล็อกต้นทุน
- `13f953cc` — แก้ 48/58/60 ในรอบ UAT S1
- `5f188fc3` — กฎบันทึก ยอดคงเหลือ/ต่ำกว่าทุน
- `054c6063` — ชุดสินค้า 3/5
- `1b79fbc9`, `6ba1a6d9`, `5e3dbd36` — คลัง/ชั้น, ปรับสต็อก, ช่อง WMS

## โค้ดปัจจุบันที่ป้องกัน
- `backend/internal/application/process/service.go:189` `CalculateMovingAverage`; `:219` ต้นทุนล็อก; `:272` ใบ 48, `:276` ใบ 58/60
- `backend/internal/application/process/stock_rebuild.go:18` `stockRowsSQL`, `:26` `stockValueOnlySQL`, `:47` `transferInTime`; เทส `stock_rebuild_test.go:5`, `:17`, `:33`
- `backend/internal/application/process/hidden_cost.go:125` `allocateHiddenCost`; `trans_validate.go:109` `refuseLockedRecord`; เทส `cost_lock_test.go:6`
- `backend/internal/application/process/trans_save_rules.go:192` `lowCostMessage`, `:389` `checkStockBalance`
- `backend/internal/application/process/trans_set_item.go:22` `isSetItem`; `perm_wh_shelf.go:42` `applyPermWhShelf`
- เทส UAT: `uat_s1_fixes_test.go:86`, `:111`

## บทเรียน / กฎที่ได้
- ต้นทุนเป็นผลคำนวณซ้ำได้ ห้ามบวกลดตัวนับ; ตรวจยอดจากแถวดิบ
- ใบรับเข้าที่ไม่ใช่ซื้อ (รับคืนขาย, คืนจากเบิก, รับผลผลิต) ต้องเข้าที่ต้นทุนเฉลี่ยเสมอ ห้ามใช้ราคาขาย
- ตัวกรองแถวสต็อกต้องเหมือน C# ทุกเงื่อนไข (สำเนา ชนิดสินค้า สถานะ)
- เทสต้นทุนใช้เลขจริง (281.25 ต้องคงเดิมหลังรับคืน)
- ข้อค้าง: flag-66 recost ยังอยู่ในรายการค้างของ handoff

## ดูเพิ่ม
[[acc-inventory-cost-moving-average]] · [[acc-inventory-stock-rebuild]] · [[hist-lessons-concurrency-advisory-locks]] · [[hist-lessons-trans-save-rules]] · [[history-overview]]

## ที่มาในโค้ด
- git: `d9141d8f`, `9e29f6df`, `13f953cc`, `5f188fc3`, `054c6063`, `1b79fbc9`, `6ba1a6d9`, `5e3dbd36`
- `tests/uat/out/20261028/summary.md` (#3, #4), `docs/HANDOFF_BCCM_PARITY_2026-10-22.md` (รายการค้าง)
