---
title: "ระบบปัดเศษทศนิยมเงินอย่างไร ทำไมยอดต่างกัน 0.01"
tags: [faq, rounding, decimal, gl, vat]
aliases: ["ปัดเศษยังไง", "ยอดไม่ตรง 1 สตางค์", "rounding decimal", "round_type", "item_amount_decimal", "gl_no_decimal", "RoundHalfUp", "bcRound", "ปัดครึ่งเลขคู่", "ผลต่างจากการปัดเศษ"]
sources: ["backend/internal/application/process/service.go:149", "backend/internal/application/process/grid_calc.go:132", "backend/internal/application/process/fa_sale.go:93", "backend/internal/application/process/service.go:508", "backend/internal/application/process/gl_template.go:378", "backend/internal/application/process/gl_template.go:730", "backend/internal/application/process/trans.go:1055"]
---
# ระบบปัดเศษทศนิยมเงินอย่างไร ทำไมยอดต่างกัน 0.01

**ตอบสั้น:** เงินทุกยอดคำนวณด้วย `big.Rat` และเก็บเป็นข้อความทศนิยม ไม่ใช้ float มีวิธีปัด 3 แบบ ใช้ต่างจุดกัน คือ ปัดครึ่งขึ้น, `bcRound` ตาม `round_type` และปัดครึ่งไปเลขคู่ (`roundHalfEven`) ยอดต่าง 0.01 มักเกิดจากการปัดรายบรรทัดแล้วรวม เทียบกับรวมก่อนแล้วปัด

## รายละเอียด
ค่าเงินจากจอ/DB แปลงด้วย `ParseDecimalRat` / `numericToRat` แล้วจัดรูปเป็นข้อความด้วย `FormatRat` ซึ่งปัดครึ่งขึ้นที่ scale ที่ส่งมา ดู [[acc-rounding-decimal]]

**จำนวนทศนิยม (scale)**
- ยอดในเอกสาร ใช้ `erp_option.item_amount_decimal` ([[tbl-erp-option]])
- GL ตามรูปแบบเอกสาร ใช้ `gl_no_decimal` ถ้าว่างใช้ '2' (`glSQLOptions`)
- GL เส้นมาตรฐาน ตรวจสมดุลที่ 2 ตำแหน่งตายตัว (`ValidateAndBalanceJournal(lines, 2)`)

**วิธีปัด**

| ฟังก์ชัน | ปัดแบบ | ใช้ที่ |
|---|---|---|
| `RoundHalfUp` | ครึ่งขึ้น (ห่างจากศูนย์) | `FormatRat`, GL มาตรฐาน, ยอดชำระ, มัดจำ, ค่าเสื่อม |
| `bcRound` | `round_type` = 1 คือครึ่งขึ้น (+0.000001), ค่าอื่นปัดไล่ทีละหลัก เช่น 3.7449 → 3.745 → 3.75 | ยอดในตารางสินค้า, ยอดแปลงสกุลเงิน ([[faq-fx-multi-currency]]) |
| `roundHalfEven` | ครึ่งไปเลขคู่ | `sum_amount_exclude_vat` (เฉพาะ vat_type 1 และ tax_type 0), GL ตามรูปแบบ, VAT ขายสินทรัพย์ |
| `csRound` | ปัดแบบเดียวกับ `bcRound` (round_type 1 = ครึ่งขึ้น +0.000001; ค่าอื่นไล่ทีละหลักจากเลขท้ายสุดที่มี) | `stock_rebuild.go` |

**ผลต่างจากการปัด**
- GL ตามรูปแบบ ([[faq-gl-template-doc-format]]): `addDiff` ยอมผลต่าง Dr−Cr ได้ไม่เกิน 0.1 ต่อแถวรายละเอียด แล้วลงบัญชีผลต่างที่กำหนดด้วย action 90 ของรูปแบบ
- GL เส้นมาตรฐาน: ไม่มีบรรทัดผลต่าง ถ้าปัดแต่ละบรรทัดแล้ว Dr ≠ Cr จะถูกปฏิเสธ (`ErrUnbalancedJournal`) ดู [[faq-gl-not-balanced]]
- ฝั่งจอแสดงผลใช้ `getBcDecimals` / `formatMoneyDisplay`

## ข้อควรระวัง
- `sum_of_cost` (qty × cost) ปัด 2 ตำแหน่งตายตัว ไม่ใช้ `item_amount_decimal` (`trans.go:1058`)
- `round_type` ที่ไม่ใช่ 1 ทุกค่าจะปัดไล่หลัก (`grid_calc.go:99`) ค่า −1 (`roundHalfUpType`) ใช้ภายในโค้ดเท่านั้น
- งาน rebuild สต็อกใช้ VAT 7% ตายตัว (`stock_rebuild.go:179-180`)
- e-Tax: `etaxAmounts` รับค่าเป็น `float64` และมีทางสำรองที่ใช้ `math.Round` (`etax/handler.go:1016`)
- การปัดลอยตัวของ declining balance ในค่าเสื่อม ใช้ `Text('e',14)` = 15 หลักนัยสำคัญ ([[faq-fixed-asset-depreciation]])

## ดูเพิ่ม
- [[acc-rounding-decimal]]
- [[hist-lessons-rounding-decimal]]
- [[faq-vat-exclude-include-calc]]
- [[faq-gl-not-balanced]]
- [[faq-payment-tab-tenders]]

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:107` `ParseDecimalRat`
- `backend/internal/application/process/service.go:149` `RoundHalfUp`; `:177` `FormatRat`
- `backend/internal/application/process/service.go:508` `ValidateAndBalanceJournal`; `:1625` เรียกที่ scale 2
- `backend/internal/application/process/grid_calc.go:99` round_type ≠ 1; `:132` `bcRound`
- `backend/internal/application/process/fa_sale.go:93` `roundHalfEven`
- `backend/internal/application/process/trans.go:1055` `sum_amount_exclude_vat` ปัดครึ่งไปเลขคู่; `:1058` `sum_of_cost` 2 ตำแหน่ง
- `backend/internal/application/process/gl_template.go:378` `addDiff`; `:730` `glSQLOptions` (`gl_no_decimal`)
- `backend/internal/application/process/gl_template_rules.go:344` action 90 บัญชีผลต่าง
- `backend/internal/application/process/stock_rebuild.go:113` `csRound`
- `frontend/src/lib/numeric.ts:522` `getBcDecimals`; `:587` `formatMoneyDisplay`
