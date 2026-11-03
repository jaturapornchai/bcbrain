---
title: "บทเรียนบั๊กการปัดเศษและทศนิยมเงิน (Rounding & Decimal Bugs)"
tags: [history, rounding, decimal, money]
aliases: ["บั๊กปัดเศษ", "ToEven", "satang rounding", "item_amount_decimal", "depreciation tie"]
sources: ["git:2a125c8e", "git:4d6cb8de", "git:51973e32", "git:a47413ec", "git:cd881a34", "git:00815c01", "git:906c5b45", "git:324bd2a6", "git:04903202", "backend/internal/application/process/grid_calc.go:132"]
---

## ภาพรวม
บั๊ก "เงินต่างจาก C# 1 สตางค์" เกิดซ้ำ 2026-10-21 .. 2026-10-24 เพราะ C# ใช้การปัดหลายแบบปนกัน (`_round` ทีละหลัก, `Math.Round` ToEven, AwayFromZero, `double`) แต่โค้ดเว็บเดิมใช้ HALF_UP ที่ 2 ตำแหน่งหรือ `float64` ทุกจุด ต้องเลือกวิธีปัดให้ตรงกับแต่ละจุดของ C# นโยบายปัจจุบันดู [[acc-rounding-decimal]]

## อาการ
- **R1 โหมดส่วนลดท้ายบิล/VAT (2a125c8e):** ยอดหัวบิลไม่ตรง C# เมื่อ `erp_option.discout_type`/`discount_vat_type` ไม่ใช่ค่าเริ่มต้น; `sum_amount_exclude_vat` ต่าง 1 สตางค์ที่จุดครึ่ง (อนุมานจาก diff+เทส; commit มีแต่ชื่อเรื่อง)
- **R2 VAT รายบรรทัด (4d6cb8de, 51973e32):** `price_exclude_vat`/`discount_amount`/`total_vat_value` ไม่ตรง `TransItemGridVatCalc`; ส่วนลด `+5%` กลายเป็นค่าติดลบ (คอมเมนต์เทส `E1`)
- **R3 e-Tax/ตลาด/จัดซื้อ (a47413ec, cd881a34):** หัก ณ ที่จ่าย 1% ของ 14.50 ได้ 0.14 ควรเป็น 0.15 (ข้อความ commit, KMS B5)
- **R4 ทศนิยมตายตัว 2 (cd881a34, 324bd2a6, 04903202):** บริษัทที่ `item_amount_decimal` ≠ 2 เห็นยอดจอไม่ตรงที่เก็บ (KMS เคยจดค้าง: จอปัด 2 แต่ `trans.go` เก็บ `max(dec,2)`)
- **R5 อัตราค่าเสื่อมลดน้อยถอยลง (00815c01, 906c5b45):** อัตราจุดครึ่ง 12.345 แสดง 12.34 แทน 12.35; handoff จดเคส `B2-TIE-age3` คาด 78.54 ได้ 78.46 และสงสัยว่าเทสคาดผิด (ยังไม่ verify)

## สาเหตุ (root cause)
- **R1:** `vatCalc` เดิม port จาก `numeric.ts` (HALF_UP, แยกส่วนลดตามสัดส่วนเสมอ) ไม่ใช่ `_icTransProcess._vatCalc`; ตัวคั่นส่วนลดเดิมรับ `,` และ `+` แต่ C# รับ `,` เท่านั้น
- **R2:** ช่องรายบรรทัดรับค่าจาก client ไม่คำนวณใหม่ใน backend
- **R3:** `math.Round(base*(rate/100)*100)/100` บน float: 14.5*0.01*100 = 14.499999999999998 ปัดเป็น 14
- **R4:** hard-code `2` (~40 จุด ตาม 324bd2a6) และ `max(amountDec,2)` ตอน bind
- **R5:** เดิม `math.Pow` float; พอเปลี่ยนเป็น decimal ค่าแม่นกว่า C# ซึ่งเก็บ `(decimal)Math.Pow` แค่ 15 หลักนัยสำคัญ ค่าใต้จุดครึ่งนิดเดียวจึงถูก C# ปัดขึ้น

## วิธีแก้
- **R1:** port `_vatCalc` เต็มผ่าน `vatOptions`; `sum_amount_exclude_vat` ใช้ `roundHalfEven` เฉพาะรวมใน tax_type 0; discount_vat_type=2 ถือเป็น 0 (คอมเมนต์ในโค้ด)
- **R2:** `lineVat` คำนวณทุกบรรทัดตอน save (ไม่ปัด เหมือน C# `decimal.ToString`); low-cost ระบุบรรทัดสุดท้ายที่ต่ำกว่าทุน
- **R3:** `etaxAmounts` แปลง float เป็นทศนิยมที่พิมพ์ (`typedDecimal`) แล้ว `big.Rat` ปัดครึ่งออกจากศูนย์ที่สตางค์; ตลาด/จัดซื้อได้ `mulSatang`/`addSatang`/`vatAndNetSatang`
- **R4:** bind ที่ `amountDec`; จอใช้ `getBcDecimals(...)` และ `formatMoneyDisplay(x)` ไม่ส่ง 2
- **R5:** `ratPow`/`nthRoot` (Newton 256 บิต) แทน float แล้วปัดกำลังเหลือ 15 หลักก่อน `1 - pow`

## commit ที่เกี่ยวข้อง
- `2a125c8e` — bill discount/VAT modes, ToEven, totals preview
- `4d6cb8de` / `51973e32` — VAT รายบรรทัดตอน save, `+N%`, low-cost ชี้บรรทัดสุดท้าย
- `a47413ec` — e-Tax satang ด้วย big.Rat
- `cd881a34` — `item_amount_decimal` ตรงกัน, satang ใน market/procure
- `00815c01` / `906c5b45` — ค่าเสื่อมเป็น decimal / tie แบบ C# double
- `324bd2a6` / `04903202` — แทน 2 ตายตัวด้วยทศนิยม `erp_option`

## โค้ดปัจจุบันที่ป้องกัน
- `backend/internal/application/process/grid_calc.go:132` `bcRound`; `:171` `bcCalcAfterDiscount` (ต้องตรง `frontend/src/lib/numeric.ts:664`)
- `backend/internal/application/process/transcalc.go:137` `vatCalc`; `trans_line_vat.go:12` `lineVat`
- `backend/internal/application/process/trans.go:1055` `roundHalfEven`; `:1003`, `:1049` bind `amountDec`; เทส `transcalc_test.go:158`
- `backend/internal/adapter/inbound/http/etax/handler.go:1016` `etaxAmounts`, `:1043` `roundSatang` (ไม่พบเทสหน่วย); สำเนา `market/handler.go:2002`, `procure/handler.go:2665`
- `backend/internal/application/process/asset_depreciation.go:88` ปัด 15 หลัก; เทส `asset_depreciation_test.go:157`
- `frontend/src/lib/numeric.ts:522` `getBcDecimals`, `:587` `formatMoneyDisplay`

## บทเรียน / กฎที่ได้
- เงินใช้ `big.Rat`/decimal ห้าม float (AGENTS.md ข้อ 20); ถ้าต้องรับ float ให้แปลงจากข้อความที่พิมพ์แล้วปัดครั้งเดียวที่สตางค์
- ก่อน port ให้ระบุว่าจุดนั้นของ C# ปัดแบบไหน และเขียนเทส "จุดครึ่ง" (เช่น 2.345, 12.345)
- ห้าม `2` ตายตัวกับเงิน/ราคา/จำนวน ใช้ `item_amount_decimal`/`item_price_decimal`/`item_qty_decimal`/`gl_no_decimal`
- สูตรหน้าจอต้องตรงสูตรที่ backend เก็บ (ข้อ 10); แก้ `numeric.ts` ต้องแก้ `grid_calc.go` และเทสคู่กัน
- `roundSatang` ซ้ำสามที่ (etax/market/procure) ยังเป็นหนี้

## ดูเพิ่ม
[[acc-rounding-decimal]] · [[acc-transcalc-totals]] · [[std-data-integrity-money-transactions]] · [[hist-lessons-vat-tax-mistakes]] · [[hist-lessons-gl-posting-balance]] · [[hist-lessons-numeric-input-blank-zero]] · [[history-overview]]

## ที่มาในโค้ด
- git: `2a125c8e`, `4d6cb8de`, `51973e32`, `a47413ec`, `cd881a34`, `00815c01`, `906c5b45`, `324bd2a6`, `04903202`
- `docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md` (B5), `docs/HANDOFF_BCCM_PARITY_2026-10-22.md` (ข้อ 3, 7)
