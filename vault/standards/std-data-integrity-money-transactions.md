---
title: "ความถูกต้องของข้อมูล: เงิน ภาษี Transaction เดียว และ Rebuild (Data Integrity, big.Rat, ExecBatch)"
tags: [standards, data-integrity, money, transaction, backend, go]
aliases: ["ExecBatch", "math/big.Rat", "ปัดสตางค์", "ห้ามทิ้ง error", "Raw Data Process Rebuildable", "idempotent rebuild", "WMS OPENING", "Sprintf EXTRA", "etaxAmounts", "ห้าม float เงิน", "Thin Client"]
sources: [".agents/skills/secure-api-data-integrity-checklist/SKILL.md", "docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md", "AGENTS.md", "backend/internal/application/query/service.go:137", "backend/internal/adapter/inbound/http/etax/handler.go:1016", "backend/internal/adapter/inbound/http/wms/handler.go:217", "backend/internal/platform/docno/docno.go:23", "frontend/src/lib/numeric.ts"]
---

# ความถูกต้องของข้อมูล: เงิน ภาษี และ Transaction

Backend (Go) เป็นผู้คุมกฎทั้งหมด (กฎข้อ 10: Thin Client) ข้อมูลดิบเขียนต่อท้าย ผลลัพธ์ที่คำนวณต้อง rebuild ซ้ำได้ตรงกัน 100% (กฎข้อ 9) และเงิน/ภาษี/สต็อกต้องไม่มีการปัดเศษผิดหรือเขียนครึ่งๆ กลางๆ

## กฎ/วิธีทำ
1. **หนึ่งคำสั่งผู้ใช้ = หนึ่ง `ExecBatch`** (`Service.ExecBatch`, `application/query/service.go:137`): เขียนหลายตารางต้องอยู่ใน transaction เดียว และบันทึก raw log ก่อนตาราง derived
   - ตัวอย่างที่แก้แล้ว: `AdvanceFulfillment` (`wms/handler.go:217`) เดิม commit สถานะ SHIPPED ก่อนแล้วตัดสต็อกแยก และทิ้ง error → สถานะ SHIPPED แต่สต็อกไม่ถูกตัด; `CreateMovement` (`:534`) ยอด bin เปลี่ยนแต่ไม่มี movement log เมื่อ insert log ล้ม
   - Market checkout, TMS, Procure ทุก action เป็น transaction เดียว ใช้ `platform/sqllit` รวม insert เข้า `ExecBatch`
2. **ห้ามทิ้ง error** (`_, _ = h.insertUseCase.Insert(...)`) ในเส้นทางที่ตอบผู้ใช้ — insert หลักล้มต้อง `response.Error` แล้ว `return` ไม่ตัดเครดิต/สร้างเอกสารต่อ และไม่ตอบ 200 (ตัวอย่าง: `etax`, `market`, `tms`)
3. **เงิน/ภาษี**: Go ใช้ `math/big.Rat` ปัดครึ่งขึ้นที่สตางค์ — `etaxAmounts()` (`etax/handler.go:1016`) แก้กรณี 1% ของ 14.50 ที่ float ได้ 0.14 (ที่ถูก 0.15); ฝั่ง Frontend ใช้ `decimalSql`, `roundBc`, `evalArithmeticSafe` ใน `numeric.ts` ห้าม `Math.round(x*100)/100` กับ float
4. **`fmt.Sprintf` ต้องมี `%` ครบตามจำนวน argument** — เคยบันทึกข้อความเสีย `...ERP%!(EXTRA string=PCS)` ลง DB และ `go vet` ล้ม; `go vet` ต้องผ่านก่อน commit (กฎข้อ 20)
5. **เลขที่เอกสารใช้ `platform/docno.Stamp`** (`docno.go:23`) กันเลขชน; วันที่ market/tms/procure/etax เก็บ `YYYY-MM-DD` (ค.ศ.)
6. **Dashboard/KPI ห้ามค่าสำรองเป็นตัวเลขสมมติ** เช่น `?? 98.6` ให้ใช้ `?? 0`
7. **Rebuild สต็อก WMS** (`wms_stock_bin` จาก `wms_movement_log`): สร้างแถว `move_type='OPENING'` ครั้งเดียวต่อ `ic_code + bin_code` (`physical_qty - SUM(movement เดิม)`), คำนวณ `physical_qty = OPENING + SUM(signed movement)` แบบ idempotent ใน transaction เดียว (`WmsBinOpeningSQL`, `WmsBinRebuildSQL`, `WmsEnsureTargetBinSQL` ใช้ใน `wms`, `tms`, `procure` handler) และแสดงยอดติดลบเป็นคำเตือนที่ `WmsDashboard.tsx`
8. **Market checkout**: เครดิต/rebate คำนวณจาก `SUM(market_b2b_order)` + `credit_used_opening` / `rebate_opening`; คำนวณเงินใน `market/handler.go`, `procure/handler.go` ใช้ `big.Rat`

## บทเรียนตัวเลขฝั่ง Frontend (แก้แล้ว พร้อม test)
| รหัส | อาการ | วิธีแก้ |
|---|---|---|
| N1 | เครื่องคิดเลข `100+7%` ได้ 100.07 (ต้อง 107) | `left + left × pct` เมื่อ term ขวาเป็น `<number>%` |
| N2 | ช่องจำนวนเต็ม `"30.00"` → `"300"`, วาง `"1,234.00"` ได้ 123400 | ตัดส่วนหลังจุดทิ้งใน `cleanNumericString` |
| N3 | พิมพ์ `.5` บันทึกได้ 0/NULL หรือ throw | แปลง `.5`→`0.5`, `5.`→`5` ใน `decimalSql` / `bc-query-builder.ts` |
| N4 | วางตัวเลขกลางค่า `1,234` แทรกผิดตำแหน่ง; blur ค่า `-` ค้าง | ตัดจาก `input.value` ก่อนล้าง comma, `finishNumber()` ใน `NumberBox.tsx` |

## ธุรกรรมที่บันทึกหลายส่วน (รอบที่ 3)
- **Serial Number**: ส่ง `serials` เข้า `SaveTransInput` (`process/trans.go`) บันทึก/ลบ `ic_trans_serial_number` ใน transaction เดียวกับเอกสาร (รวมใบรับโอนอัตโนมัติ `70` ของใบขอโอน `72`) แล้ว rebuild `ic_serial` (`rebuildSerialTx`)
- **ข้อมูลจัดส่ง** `ic_trans_shipment` (`transport_code/name/address/telephone`, `tracking_no`, `latitude`, `longitude`) บันทึก/ลบ/โหลดใน `saveTransTx` / `deleteTransTx`
- **รับ/จ่ายเงินหลายรายการ**: โอน (`cb_trans_detail.doc_type=1`), PromptPay (`doc_type=21` + `cb_trans.wallet_amount`), เช็ก (`doc_type=2` + `cb_chq_list`), บัตรเครดิต (`doc_type=3` + `cb_chq_list`) คิดเงินสดคงเหลืออัตโนมัติ (`TransPayTendersGrid.tsx`, `trans.go`, `pay_check.go`)
- ทศนิยมแสดงผลตาม `erp_option` (`item_amount_decimal`, `item_qty_decimal`) — `recalcItemLine` (frontend) และ `trans.go` ต้องใช้ค่าตรงกัน
- สูตรต้นทุน/Serial/คลัง ดู [[std-inventory-costing-rules]] และ [[std-parallel-unit-and-ref-import]]

## ที่มา
- `.agents/skills/secure-api-data-integrity-checklist/SKILL.md` Workflow C ข้อ 9–16
- `docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md` B3–B9, N1–N4, D1, รอบที่ 2–3
- `AGENTS.md` กฎข้อ 9, 10, 20

## ดูเพิ่ม
[[standards-overview]] · [[std-security-authz-and-web-vulns]] · [[std-frontend-ux-bug-lessons]] · [[std-inventory-costing-rules]] · [[accounting-overview]] · [[backend-overview]]
