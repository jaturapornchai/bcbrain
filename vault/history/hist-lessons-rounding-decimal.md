---
title: "บทเรียนการปัดเศษและทศนิยมเงิน (Rounding & Decimal)"
tags: [history, lesson, rounding, decimal, money]
aliases: ["บั๊กปัดเศษ", "ปัดครึ่งไปหาคู่", "satang rounding", "item_amount_decimal", "bcRound", "depreciation tie"]
sources: ["backend/internal/application/process/grid_calc.go:132", "backend/internal/application/process/grid_calc_test.go:26", "backend/internal/application/process/fa_sale.go:93", "backend/internal/application/process/transcalc_test.go:158", "backend/internal/application/process/trans_line_vat.go:12", "backend/internal/adapter/inbound/http/etax/handler.go:1016", "backend/internal/application/process/asset_depreciation.go:86", "backend/internal/application/process/asset_depreciation_test.go:157", "frontend/src/lib/numeric.ts:522", "frontend/account/transaction/UniversalTransScreen.tsx:244", "AGENTS.md:61", ".agents/skills/secure-api-data-integrity-checklist/SKILL.md:29"]
---

# บทเรียนการปัดเศษและทศนิยมเงิน

เงินคลาดกัน 1 สตางค์มักเกิดที่ "จุดครึ่ง" (เช่น 2.345, 14.5 x 1%) เพราะแต่ละจุดในระบบปัดต่างกันหรือคำนวณด้วยเลขทศนิยมฐานสอง ถ้าไม่ระวัง ยอดบนจอ ยอดที่เก็บ และยอดในรายงานจะไม่ตรงกัน

## อะไรพังได้
- **ใช้ `float64` กับเงิน**: 14.50 x 1% x 100 ได้ 14.499999999999998 ปัดเป็น 14 ภาษีหัก ณ ที่จ่ายจึงได้ 0.14 แทน 0.15
- **ปัดผิดวิธีกับจุดนั้น**: บางจุดต้องปัดครึ่งออกจากศูนย์ บางจุดต้องปัดครึ่งไปหาเลขคู่ (2.325 -> 2.32) บางจุดปัดทีละหลักจากท้าย (3.7449 -> 3.745 -> 3.75) ถ้าใช้ HALF_UP ทุกจุดจะต่างกัน 1 สตางค์
- **ทศนิยมตายตัว `2`**: บริษัทที่ตั้ง `erp_option.item_amount_decimal` / `item_price_decimal` / `item_qty_decimal` ไม่ใช่ 2 จะเห็นยอดบนจอไม่ตรงกับที่ backend เก็บ
- **สูตรหน้าจอไม่ตรงสูตร backend**: ยอดแถวที่โชว์ตอนพิมพ์ต่างจากที่บันทึก
- **ค่าที่ client ส่งมาถูกเชื่อ**: VAT รายบรรทัดที่ไม่คำนวณซ้ำใน backend อาจไม่ตรงสูตร
- **ผลยกกำลังจุดครึ่ง**: อัตราค่าเสื่อมแบบลดน้อยถอยลงที่ค่าจริงอยู่ใต้จุดครึ่งนิดเดียว ถ้าไม่ตัดความละเอียดก่อนปัดจะได้ 12.34 แทน 12.35

## โค้ดป้องกันไว้อย่างไร
| ด่าน | ที่อยู่ | ทำอะไร |
|---|---|---|
| ปัดตามโหมดของระบบ | `backend/internal/application/process/grid_calc.go:132` `bcRound` | `round_type` 1 ปัดครึ่งออกจากศูนย์ ส่วนโหมดอื่นปัดทีละหลักจากท้ายขึ้นมา เทสจุดครึ่งที่ `grid_calc_test.go:26` |
| ส่วนลดหลายก้อน | `grid_calc.go:171` `bcCalcAfterDiscount` | แยกคำด้วย `,` เท่านั้น รองรับ `@x`, `x%`, `+x%` และปัดตามโหมด |
| ปัดครึ่งไปหาคู่ | `backend/internal/application/process/fa_sale.go:93` `roundHalfEven` | ใช้กับ `sum_amount_exclude_vat`; เทส `transcalc_test.go:158` (2.325 -> 2.32, ทศนิยม 3 ตำแหน่งเก็บ 2.325) |
| VAT รายบรรทัดคำนวณตอนบันทึก | `trans_line_vat.go:12` `lineVat` | คำนวณ `price_exclude_vat`, `discount_amount`, `total_vat_value` ใหม่ทุกบรรทัดใน backend |
| หัก ณ ที่จ่าย/VAT ของ e-Tax | `backend/internal/adapter/inbound/http/etax/handler.go:1016` `etaxAmounts` | แปลง float เป็นทศนิยมที่พิมพ์จริง (`typedDecimal`) แล้วปัดด้วย `big.Rat` ที่สตางค์ (`roundSatang` บรรทัด 1043) |
| ตลาด/จัดซื้อ | `adapter/inbound/http/market/handler.go:1989`, `procure/handler.go:2652` | `roundSatang` / `mulSatang` / `addSatang` / `vatAndNetSatang` ชุดเดียวกัน (สำเนาแยกกันสามที่) |
| ค่าเสื่อมลดน้อยถอยลง | `process/asset_depreciation.go:86-90` | คำนวณรากด้วย `big` แล้วตัดผลยกกำลังเหลือ 15 หลักนัยสำคัญก่อนหักจาก 1; เทส `asset_depreciation_test.go:157` ต้องได้ 12.35 |
| ทศนิยมตามบริษัท (backend) | `grid_calc.go:64` | อ่าน `item_price_decimal`, `item_amount_decimal`, `round_type` จาก `erp_option` |
| ทศนิยมตามบริษัท (หน้าจอ) | `frontend/src/lib/numeric.ts:522` `getBcDecimals` | หน้าจอถามทศนิยมจากค่าตั้งของบริษัท; `UniversalTransScreen.tsx:244` `recalcItemLine` ใช้ค่านี้ ไม่ฝัง 2 |

## กฎที่ต้องจำ
- เงินใช้ `big.Rat`/decimal เท่านั้น ห้าม float (`AGENTS.md:61`, `.agents/skills/secure-api-data-integrity-checklist/SKILL.md:29`); ถ้าต้องรับ float ให้แปลงเป็นข้อความที่พิมพ์แล้วปัดครั้งเดียวที่สตางค์
- ก่อนเลือกวิธีปัด ให้ระบุว่าจุดนั้นปัดแบบไหน แล้วเขียนเทส "จุดครึ่ง" (2.345, 2.325, 12.345)
- ห้ามใช้ `2` ตายตัวกับเงิน/ราคา/จำนวน ใช้ทศนิยมจาก `erp_option`
- แก้สูตรใน `frontend/src/lib/numeric.ts` ต้องแก้ `grid_calc.go` และเทสคู่กัน (ข้อ 10 ใน `AGENTS.md:51` ให้ backend เป็นผู้คุมกฎ)
- `roundSatang` ซ้ำสามที่ (etax/market/procure) ถ้าแก้ที่หนึ่งต้องตามแก้อีกสองที่

## ที่มาในโค้ด
- `backend/internal/application/process/grid_calc.go:132-200` ปัดและส่วนลด
- `backend/internal/adapter/inbound/http/etax/handler.go:1016-1055` ปัดสตางค์ด้วย `big.Rat`
- `backend/internal/application/process/asset_depreciation.go:70-95` ตัด 15 หลัก
- ดูเพิ่ม: [[acc-rounding-decimal]] · [[acc-transcalc-totals]] · [[std-data-integrity-money-transactions]] · [[hist-lessons-vat-tax-mistakes]] · [[hist-lessons-gl-posting-balance]] · [[hist-lessons-numeric-input-blank-zero]] · [[history-overview]]
