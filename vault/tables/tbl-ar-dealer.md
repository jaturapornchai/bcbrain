---
title: "ข้อมูลตัวแทนจำหน่าย/จุดขายของลูกหนี้ (ar_dealer)"
tags: [tables, ap-ar]
aliases: ["ar_dealer", "ตัวแทนจำหน่าย", "ร้านค้าย่อยของลูกหนี้", "dealer"]
sources: ["backend/internal/application/process/sysproc_ic_checks_data.go:65", "backend/internal/application/process/workflow.go:151", "backend/internal/application/process/service.go:855", "backend/internal/platform/db/pool.go:73"]
---

# `ar_dealer`

ตารางลูกของ [[tbl-ar-customer]] (เชื่อมด้วย `ar_dealer.ar_code = ar_customer.code`) ที่ชื่อ `dealer` แปลว่าตัวแทนจำหน่าย (ความหมายเชิงธุรกิจของแถวไม่ได้อธิบายไว้ในโค้ดที่อ่าน) — **ไม่ถูกใช้ในเอกสารขาย-บัญชีโดยตรง** backend มองเป็นข้อมูลประกอบของลูกหนี้เท่านั้น. จำนวนคอลัมน์ที่ยืนยันได้ในโค้ดมีน้อย: ความหมายของคอลัมน์อื่น "ไม่ชัดจากโค้ด".

## คอลัมน์ที่ยืนยันได้

| column | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `ar_code` | รหัสลูกหนี้เจ้าของ (→ `ar_customer.code`) | `sysproc_ic_checks_data.go:65-66`; `workflow.go:151` |
| `latitude`, `longitude` | พิกัดที่ตั้ง NUMERIC(18,6) DEFAULT 0 — เพิ่มด้วย `ADD COLUMN IF NOT EXISTS` ตอนเริ่มระบบ | `service.go:855-856`, `platform/db/pool.go:73-74` |

คอลัมน์ชื่อ/ที่อยู่/ติดต่อของ dealer เองไม่ปรากฏในโค้ด backend ที่อ่าน — อาจเป็นข้อมูลที่ฟรอนต์เอนด์/เครื่องมือ legacy จัดการผ่านเส้นทาง generic (ตารางอยู่ใน legacy write allow-list ของ `/query/exec`, ADR-0011).

## ความสัมพันธ์

- N → 1 [[tbl-ar-customer]] ผ่าน `ar_code`
- ไม่ถูกอ้างจากตารางเอกสาร ([[tbl-ic-trans]], [[tbl-ap-ar-trans]]) ในโค้ดที่อ่าน

## ใครเขียน / ใครอ่าน

- **เขียน**: master-data — หน้าจอ master เขียนตารางนี้ผ่าน `/query/exec` ตาม legacy write allow-list (ADR-0011); เปลี่ยนรหัสลูกหนี้จะตามอัปเดต `ar_dealer.ar_code` ด้วย (`workflow.go:148-152`); เพิ่มคอลัมน์พิกัดตอน start (`service.go:855`, `pool.go:73`).
- **ลบ (ซ่อมข้อมูล)**: เครื่องมือตรวจระบบ "ar_dealer ที่ไม่มีลูกหนี้แม่" — ตรวจนับด้วย `NOT EXISTS (SELECT … FROM ar_customer …)` แล้วลบแถวกำพร้า (`sysproc_ic_checks_data.go:65-66`).
- **อ่าน**: ไม่พบใน SQL รายงานของ backend ที่อ่าน ("ไม่ชัดจากโค้ด" ว่าใช้ที่หน้าจอใด).

## ข้อควรระวัง

- แถวกำพร้า (ลูกหนี้แม่ถูกลบ) จะถูกเครื่องมือ sysproc ลบทิ้ง — อย่ามองว่าเป็นข้อมูลถาวรที่แยกจากลูกหนี้.
- เมื่อเปลี่ยนรหัสลูกหนี้ต้องผ่าน tool เปลี่ยนรหัสเพื่อให้ `ar_code` ตามไปด้วย (`workflow.go:151`).
- ห้ามสมมติว่า dealer ผูกกับเอกสารขาย — ไม่พบ join ในโค้ด.

## ที่มาในโค้ด

- `backend/internal/application/process/sysproc_ic_checks_data.go:65-66`
- `backend/internal/application/process/workflow.go:148-152`
- `backend/internal/application/process/service.go:855-856`
- `backend/internal/platform/db/pool.go:73-74`
