---
title: "ความถูกต้องของข้อมูล: เงิน ภาษี Transaction เดียว และ Rebuild (Data Integrity, big.Rat, ExecBatch)"
tags: [standards, data-integrity, money, transaction, backend, go]
aliases: ["ExecBatch", "math/big.Rat", "ปัดสตางค์", "ห้ามทิ้ง error", "Raw Data Process Rebuildable", "idempotent rebuild", "WMS OPENING", "Sprintf EXTRA", "etaxAmounts", "ห้าม float เงิน", "Thin Client"]
sources: ["AGENTS.md:40-42", "AGENTS.md:50", "AGENTS.md:51", "AGENTS.md:61", ".agents/skills/secure-api-data-integrity-checklist/SKILL.md:26-31", ".agents/skills/secure-api-data-integrity-checklist/SKILL.md:35-36", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:25-31", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:36-39", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:47", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:75-79", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:81-89", "backend/internal/application/query/service.go:137", "backend/internal/adapter/inbound/http/wms/handler.go:217", "backend/internal/adapter/inbound/http/wms/handler.go:514", "backend/internal/adapter/inbound/http/wms/handler.go:534", "backend/internal/adapter/inbound/http/wms/handler.go:822", "backend/internal/adapter/inbound/http/wms/handler.go:1046", "backend/internal/adapter/inbound/http/wms/handler.go:1995", "backend/internal/adapter/inbound/http/etax/handler.go:1016", "backend/internal/adapter/inbound/http/etax/handler.go:1030", "backend/internal/adapter/inbound/http/etax/handler.go:1040", "backend/internal/platform/docno/docno.go:23", "backend/internal/application/process/trans.go:89", "backend/internal/application/process/trans.go:174", "backend/internal/application/process/trans.go:1337", "backend/internal/application/process/stock_tools.go:625", "frontend/src/lib/numeric.ts:7", "frontend/src/lib/numeric.ts:110", "frontend/src/lib/numeric.ts:231", "frontend/src/lib/numeric.ts:842", "frontend/shared/ui/NumberBox.tsx:66", "frontend/account/transaction/TransPayTendersGrid.tsx:11", "backend/go.mod:3"]
---

# ความถูกต้องของข้อมูล: เงิน ภาษี และ Transaction

Backend (Go) คุมกฎทั้งหมด (กฎข้อ 10 Thin Client, `AGENTS.md:51`) ข้อมูลดิบเขียนต่อท้ายและผลลัพธ์ที่คำนวณต้อง rebuild ซ้ำได้ตรงกัน 100% (กฎข้อ 9, `AGENTS.md:50`) กฎข้อ 20 (`AGENTS.md:61`) สรุปเป็นรายการสั้นว่า `ExecBatch` เดียว · เงินใช้ `big.Rat`/`numeric.ts` · `go vet` ผ่าน

## กฎ/วิธีทำ
1. **หนึ่งคำสั่งผู้ใช้ที่เขียนหลายตาราง = หนึ่ง `ExecBatch`** (`Service.ExecBatch`, `application/query/service.go:137`) และบันทึก raw log ก่อนตาราง derived (`SKILL.md:26`)
   - `AdvanceFulfillment` (`wms/handler.go:217`) เดิม commit สถานะ SHIPPED ก่อนแล้วตัดสต็อกแยกและทิ้ง error ตอนนี้รวมคำสั่งไว้ใน `ExecBatch` เดียว (`:514`, พร้อม `WmsBinOpeningSQL`/`WmsBinRebuildSQL` ที่ `:505-507`)
   - `CreateMovement` (`:534`) บันทึก movement log กับยอด bin ใน `ExecBatch` เดียว (`:822`) ไม่ให้ยอด bin เปลี่ยนโดยไม่มี log (บทเรียน B3/B4, `KMS…:25-26`)
   - Market checkout, TMS, Procure เป็น transaction เดียวต่อ action (`KMS…:77`)
2. **ห้ามทิ้ง error** (`_, _ = h.insertUseCase.Insert(...)`) ในเส้นทางที่ตอบผู้ใช้ — insert หลักล้มต้อง `response.Error` แล้ว `return` ไม่ตัดเครดิต/สร้างเอกสารต่อ และไม่ตอบ 200 (B6/B8, `SKILL.md:27`) ในโค้ดปัจจุบันยังมีรูป `_, _ = …ExecBatch` ที่ไม่ตอบ error ให้ผู้ใช้ เช่น `wms/handler.go:840` (rebuild bin ทั้งคลังก่อนสร้างหน้า Overview) และ `:1737` — อย่าลอกรูปนี้ไปใช้กับเส้นทางบันทึกเอกสาร
3. **เงิน/ภาษีฝั่ง Go**: `etaxAmounts` (`etax/handler.go:1016`) รับและคืน `float64` แต่คำนวณตรงกลางด้วย `math/big.Rat` จากเลขทศนิยมที่ผู้ใช้พิมพ์จริง (`typedDecimal` `:1030`) แล้วปัดครึ่งขึ้นที่สตางค์ (`roundSatang` `:1040`) — แก้กรณี 1% ของ 14.50 ที่ float ได้ 0.14 (ที่ถูก 0.15); ถ้าค่าเป็น NaN/Inf จะถอยไปสูตร float เดิม ดังนั้นเลขที่ออกจากฟังก์ชันนี้ยังเป็น `float64` ต่อ
4. **เงิน/ภาษีฝั่ง Frontend**: ใช้ `decimalSql` (`numeric.ts:110`), `roundBc` (`:231`), `evalArithmeticSafe` (`:842`) ห้าม `Math.round(x*100)/100` กับ float (`SKILL.md:29`)
5. **`fmt.Sprintf` ต้องมี `%` ครบตามจำนวน argument** — เคยบันทึกข้อความเสีย `...ERP%!(EXTRA string=PCS)` ลง DB และ `go vet` ล้ม (B9, `KMS…:31`, `SKILL.md:30`) ต้องรัน `go vet` ผ่านก่อน commit
6. **เลขที่เอกสารใช้ `platform/docno.Stamp`** (`docno.go:23`: เวลา + มิลลิวินาที + แท็กสุ่ม hex 4 ตัว) กันเลขชน — ใช้ใน `autocare`, `etax`, `market`, `procure`, `tms`, `wms`; วันที่ของ market/tms/procure/etax เก็บ `YYYY-MM-DD` ค.ศ. (`KMS…:77`)
7. **Dashboard/KPI ห้ามค่าสำรองเป็นตัวเลขสมมติ** เช่น `?? 98.6` ให้ใช้ `?? 0` (D1 `KMS…:47`, `SKILL.md:31`) — ค้น `?? 98.6` ใน `frontend/` ปัจจุบันไม่พบแล้ว
8. **Rebuild สต็อก WMS** (`wms_stock_bin` จาก `wms_movement_log`): `WmsBinOpeningSQL` (`wms/handler.go:1995`) สร้างแถว `move_type = 'OPENING'` ครั้งเดียวต่อ `ic_code + bin_code` ส่วน `WmsBinRebuildSQL` คำนวณ `physical_qty = OPENING + SUM(signed movement)` แบบ idempotent ใน transaction เดียวกับการเคลื่อนไหว (ใช้ใน `wms`, `tms` `:554/:569`, `procure` `:1382/:1398`); ยอดติดลบไม่ถูกตัดเป็น 0 แต่แสดงเป็นคำเตือน "สต็อกคลังจริงติดลบ"/"ยอดพร้อมจ่ายติดลบ" ที่ฝั่ง backend (`wms/handler.go:1046-1048`) — ไม่ใช่ที่ `WmsDashboard.tsx` ตามที่ KMS (`:87`) เขียน
9. **Market checkout**: เครดิต/rebate คำนวณจากผลรวม `market_b2b_order` บวก `credit_used_opening` / `rebate_opening` ซึ่งบันทึกเป็นยอดตั้งต้นครั้งแรกครั้งเดียว (คอมเมนต์ที่ `market/handler.go:1871`)

## บทเรียนตัวเลขฝั่ง Frontend (มี test)
| รหัส | อาการ | วิธีแก้ | จุดในโค้ด |
|---|---|---|---|
| N1 | เครื่องคิดเลข `100+7%` ได้ 100.07 (ต้อง 107) | `left + left × pct` เมื่อ term ขวาเป็น `<number>%` | `evalArithmeticSafe` `numeric.ts:842`; test `numeric.test.ts:115` |
| N2 | ช่องจำนวนเต็ม `"30.00"` → `"300"`, วาง `"1,234.00"` ได้ 123400 | ตัดส่วนหลังจุดทิ้ง | `cleanNumericString` `numeric.ts:7` |
| N3 | พิมพ์ `.5` บันทึกได้ 0/NULL หรือ throw | แปลง `.5`→`0.5`, `5.`→`5` | `decimalSql` `numeric.ts:110`, `bc-query-builder.ts` |
| N4 | วางตัวเลขกลางค่า `1,234` แทรกผิดตำแหน่ง; blur ค่า `-` ค้าง | ตัดจาก `input.value` ก่อนล้าง comma | `finishNumber` `NumberBox.tsx:66` |

## ธุรกรรมที่บันทึกหลายส่วน (รอบที่ 3 ใน KMS `:81-89`)
- **Serial Number**: `serials` อยู่ใน `SaveTransInput` (`process/trans.go:89`) บันทึก/ลบ `ic_trans_serial_number` ใน transaction เดียวกับเอกสารแล้วคำนวณ `ic_serial` ใหม่ด้วย `rebuildSerialTx` (`stock_tools.go:625`)
- **ข้อมูลจัดส่ง** `ic_trans_shipment` เขียนใน `saveTransTx` (`trans.go:510`, คำสั่ง insert ที่ `:1187`) และลบใน `deleteTransTx` (`:395`, `:422`)
- **รับ/จ่ายเงินหลายรายการ**: โอน `cb_trans_detail.doc_type = 1`, PromptPay/QR/Wallet `21`, เช็ก `2` + `cb_chq_list`, บัตรเครดิต `3` + `cb_chq_list` (นิยามแถวที่ `TransPayTendersGrid.tsx:11-39`) บันทึกด้วย `payStmts` (`trans.go:1338`) ปัดยอดที่ทศนิยมของ `erp_option.item_amount_decimal` ให้ตรงกับที่ตรวจยอด `payCompleteCheck` รวมไว้ (คอมเมนต์ `trans.go:1337`)
- ทศนิยมแสดงผลตาม `erp_option` (`item_amount_decimal`, `item_qty_decimal`) — `recalcItemLine` (`UniversalTransScreen.tsx:244`) ต้องตรงกับฝั่ง backend
- สูตรต้นทุน/Serial/คลัง ดู [[std-inventory-costing-rules]] และ [[std-parallel-unit-and-ref-import]]

## Config
- `backend/go.mod:3` ต้องการ Go 1.26.0 ถ้าเครื่องมีแค่ Go 1.24 skill (`SKILL.md:35-36`) แนะนำให้ตรวจชนิดโดยคัดลอก `backend/` ไป scratch แล้วใช้ `replace` ลดเวอร์ชัน dependency
- unit test ฝั่ง frontend: `numeric.test.ts`, `safe-return.test.ts` ใน `frontend/src/lib/`

## ที่มา
- `.agents/skills/secure-api-data-integrity-checklist/SKILL.md:26-31` (Workflow C ข้อ 9–14), `:35-36` (Config)
- `docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md:25-31` (B3–B9), `:36-39` (N1–N4), `:47` (D1), `:75-79`, `:81-89`
- `AGENTS.md:40-42`, `:50`, `:51`, `:61` กฎข้อ 4, 9, 10, 20

## ดูเพิ่ม
[[standards-overview]] · [[std-security-authz-and-web-vulns]] · [[std-frontend-ux-bug-lessons]] · [[std-inventory-costing-rules]] · [[accounting-overview]] · [[backend-overview]]
