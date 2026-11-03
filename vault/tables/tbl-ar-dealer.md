---
title: "ข้อมูลตัวแทนจำหน่าย/จุดขายของลูกหนี้ (ar_dealer)"
tags: [tables, ap-ar]
aliases: ["ar_dealer", "ตัวแทนจำหน่าย", "ร้านค้าย่อยของลูกหนี้", "dealer"]
sources: ["backend/internal/application/process/sysproc_ic_checks_data.go:65", "backend/internal/application/process/workflow.go:151", "backend/internal/application/process/service.go:866", "backend/internal/platform/db/pool.go:73", "backend/internal/domain/query/write_policy_legacy.go:32", "frontend/account/master/DealerScreen.tsx:46", "scripts/sql/02_data_schema.sql:1218"]
---

# `ar_dealer`

ตารางลูกของ [[tbl-ar-customer]] (เชื่อมด้วย `ar_dealer.ar_code = ar_customer.code`) ที่ชื่อ `dealer` แปลว่าตัวแทนจำหน่าย แต่หน้าจอ master (`menu_ar_dealer`) เรียกแต่ละแถวว่า "สมาชิก" (หัวหน้าจอ "รายละเอียดสมาชิก", `code` = เลขที่สมาชิก) — **ไม่ถูกใช้ในเอกสารขาย-บัญชีโดยตรง** backend มองเป็นข้อมูลประกอบของลูกหนี้เท่านั้น. ชื่อ/ที่อยู่/เบอร์โทรที่หน้าจอแสดงมาจากการ JOIN `ar_customer` ผ่าน `ar_code` (ไม่ได้อ่านคอลัมน์ที่อยู่ของตารางนี้).

## คอลัมน์ที่เห็นในโค้ด

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `code` | เลขที่สมาชิก (รหัสแถว เทียบแบบไม่สนตัวพิมพ์) — หน้าจอบังคับกรอกและกันรหัสซ้ำก่อน INSERT | `DealerScreen.tsx:320-328,362-367,382` |
| `ar_code` | รหัสลูกหนี้เจ้าของ (→ `ar_customer.code`) — หน้าจอบังคับกรอก และตรวจว่ามีในตารางลูกหนี้ ("ไม่พบรหัสลูกหนี้") ก่อนบันทึก | `DealerScreen.tsx:321-357`; `sysproc_ic_checks_data.go:65-66`; `workflow.go:151` |
| `regist_date`, `expire_date` | วันที่สมัคร / วันที่หมดอายุ (ชนิดวันที่ ว่างได้ = NULL) | `DealerScreen.tsx:177-178,383-392` |
| `is_staff` | 1 = เป็นพนักงาน, 0 = ไม่ใช่ | `DealerScreen.tsx:179,389,704-718` |
| `asso_code`, `asso_regist_date`, `asso_expire_date` | รหัสผู้แนะนำ / วันที่ผู้แนะนำสมัคร / วันที่ผู้แนะนำหมดอายุ (ตามป้ายชื่อบนหน้าจอ) | `DealerScreen.tsx:180-182,390-392,721-760` |
| `latitude`, `longitude` | พิกัดที่ตั้ง NUMERIC(18,6) DEFAULT 0 — เพิ่มด้วย `ADD COLUMN IF NOT EXISTS` ตอนเริ่มระบบ | `service.go:866-867`, `platform/db/pool.go:73-74`; `DealerScreen.tsx:185-186` |

DDL ของตารางอยู่ที่ `scripts/sql/02_data_schema.sql:1218-1248`; `latitude`/`longitude` ไม่อยู่ใน DDL แต่เพิ่มด้วย `ALTER` ตอนเริ่มระบบ. คอลัมน์ที่มีใน DDL แต่หน้าจอสมาชิกและ backend ที่อ่านไม่ได้ใช้ → "(ไม่ชัดจากโค้ด)": `branch_code`, `sex`, `nationality`, `mstatus`, `blood_group`, `address`, `moo`, `building`, `floor`, `room_no`, `soi`, `road`, `home_phone_extend`, `off_phone`, `off_phone_extend`, `mobile_phone`, `guid_code`. ตารางอยู่ใน legacy write allow-list ของ `/query/exec` (ADR-0011, `write_policy_legacy.go:32`).

## ความสัมพันธ์

- N → 1 [[tbl-ar-customer]] ผ่าน `ar_code` (หน้าจอ LEFT JOIN `upper(c.code) = upper(d.ar_code)` เพื่อแสดงชื่อ/ที่อยู่/เบอร์โทร/เบอร์ SMS ของลูกหนี้ — `DealerScreen.tsx:187-189,237-243`)
- ไม่ถูกอ้างจากตารางเอกสาร ([[tbl-ic-trans]], [[tbl-ap-ar-trans]]) ในโค้ดที่อ่าน

## ใครเขียน / ใครอ่าน

- **เขียน**: หน้าจอสมาชิก (`DealerScreen.tsx`) INSERT (`:382`), UPDATE (`:400`) และ DELETE (`:446`) ด้วย SQL ตรงผ่าน `/query/exec` พร้อมบันทึก log master ในชุดคำสั่งเดียวกัน ตาม legacy write allow-list (ADR-0011); เปลี่ยนรหัสลูกหนี้จะตามอัปเดต `ar_dealer.ar_code` ด้วย (`workflow.go:150-153`); เพิ่มคอลัมน์พิกัดตอน start (`service.go:866-867`, `pool.go:73-74`).
- **ลบ (ซ่อมข้อมูล)**: เครื่องมือตรวจระบบ "ar_dealer ที่ไม่มีลูกหนี้แม่" — ตรวจนับด้วย `NOT EXISTS (SELECT … FROM ar_customer …)` แล้วลบแถวกำพร้า (`sysproc_ic_checks_data.go:65-66`).
- **อ่าน**: หน้าจอสมาชิก — โหลดรายการ (`DealerScreen.tsx:225-246` เรียงตาม `code` จำกัด 500 แถว) และโหลดรายละเอียดรายแถว (`:174-190`); ไม่พบใน SQL รายงานของ backend ที่อ่าน.

## ข้อควรระวัง

- แถวกำพร้า (ลูกหนี้แม่ถูกลบ) จะถูกเครื่องมือ sysproc ลบทิ้ง — อย่ามองว่าเป็นข้อมูลถาวรที่แยกจากลูกหนี้.
- เมื่อเปลี่ยนรหัสลูกหนี้ต้องผ่าน tool เปลี่ยนรหัสเพื่อให้ `ar_code` ตามไปด้วย (`workflow.go:151`).
- ห้ามสมมติว่า dealer ผูกกับเอกสารขาย — ไม่พบ join ในโค้ด.

## ที่มาในโค้ด

- `backend/internal/application/process/sysproc_ic_checks_data.go:65-66`
- `backend/internal/application/process/workflow.go:150-153`
- `backend/internal/application/process/service.go:866-867`
- `backend/internal/platform/db/pool.go:73-74`
- `backend/internal/domain/query/write_policy_legacy.go:32`
- `frontend/account/master/DealerScreen.tsx:46,174-190,225-246,321-357,382-406,446`
- `scripts/sql/02_data_schema.sql:1218-1248`
