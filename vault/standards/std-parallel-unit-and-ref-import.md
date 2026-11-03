---
title: "หน่วยนับขนาน Serial และการดึงเอกสารอ้างอิง (Parallel Unit, Serial, Ref Document Import)"
tags: [standards, inventory, parallel-unit, serial, ref-import, go, frontend]
aliases: ["unit_type 2 3", "qty_2", "unit_code_2", "ic_opposite_unit", "refImportSpecs", "refRemainSpecs", "TransRefImport", "ดึงเอกสารอ้างอิง", "ยอดค้างรับ ค้างส่ง", "lineExtraGates", "use_compare_unit", "Serial Number", "ic_serial"]
sources: ["docs/kms/KMS_INVENTORY_COSTING_SERIAL_PARALLEL_UNIT.md", ".agents/skills/inventory-costing-and-parallel-unit/SKILL.md", "backend/internal/application/process/trans_ref_import.go:24", "backend/internal/application/process/trans_ref_import_remain.go:18", "backend/internal/application/process/trans_lines_check.go:191", "backend/internal/application/process/trans_line_extra.go", "backend/internal/application/process/item_master.go:257", "backend/internal/application/process/doc_cancel_item.go:98"]
---

# หน่วยนับขนาน Serial และการดึงเอกสารอ้างอิง

สินค้าที่ตั้ง `unit_type` เป็น 2 หรือ 3 มีจำนวนสองแกน: หน่วยมาตรฐานบัญชี (`qty`) และหน่วยขนานเพื่อตรวจนับจริง (`qty_2`) การดึงเอกสารอ้างอิงต้องคำนวณยอดค้างทั้งสองแกน ส่วนสูตรยอดคงเหลือและต้นทุนดู [[std-inventory-costing-rules]]

## ค่า `unit_type` และข้อมูลหน่วยขนาน
| ค่า | ความหมาย (ตาม KMS) |
|---|---|
| 0 / 1 | หน่วยเดี่ยว / หลายหน่วย |
| 2 | หน่วยนับขนาน |
| 3 | หลายหน่วยนับ + หน่วยนับขนาน |

- หน่วยขนานของสินค้าเก็บใน `ic_opposite_unit` (`unit_code`, `stand_value`, `divide_value`); รายการในเอกสารเก็บ `unit_code_2`, `qty_2`, `unit_size` ใน `ic_trans_detail`

## กฎ/วิธีทำ
1. **ทะเบียนสินค้า**: ถ้า `unit_type IN (2,3)` ต้องมีอย่างน้อย 1 แถวใน `ic_opposite_unit` ไม่เช่นนั้นบันทึกไม่ผ่าน ("สินค้าประเภทหน่วยนับขนาน กรุณาเพิ่มข้อมูล...") — `item_master.go:257` และ `:593`, มี test ที่ `parallel_unit_test.go`
2. **บันทึกเอกสารทุกเมนู** (`trans_lines_check.go:191-210`, ตรวจแล้ว): สินค้าที่ `unit_type IN (2,3)` ต้องมี `unit_code_2` (ถ้าว่างเติมจาก `ic_opposite_unit` อัตโนมัติ), `qty_2` ห้ามติดลบ (ยกเว้นเอกสารปรับสต็อก), และถ้า `qty != 0` ต้อง `qty_2 != 0`; หน้าจอยกมา (`stock_beginning.go` ราว :408-440) มีกติกาเดียวกัน
3. **สินค้าปกติไม่มีหน่วยขนาน** ยกเว้นเอกสารที่เปิดสวิตช์ `erp_option.use_compare_unit` และเป็นชนิด 30, 34, 36, 44, 46, 48, 144 (`lineExtraGates`/`compareUnitFlags` ใน `trans_line_extra.go`) — นอกเหนือจากนั้นระบบล้าง `unit_code_2`/`qty_2`/`unit_size` ทิ้งก่อนบันทึก; `total_qty` (จำนวน Packaging) เปิดผ่าน `use_quality_control_system` เฉพาะชนิด 12, 310, 60
4. **หน้าจอ**: แสดงช่อง `หน่วยขนาน*` และ `จำนวนขนาน*` (`data-testid="parallel-unit-code-{idx}"`, `parallel-qty2-{idx}`) เฉพาะบรรทัดที่สินค้าเป็น `unit_type 2/3` ใน `frontend/account/transaction/TransItemGrid.tsx` ห้ามรบกวนบรรทัดสินค้าปกติ
5. **อนุมัติ/ยกเลิกรายสินค้า**: `insertApproveLines` (`doc_approve_item.go:59`) คัดลอก `unit_code_2, qty_2, unit_size` ไปใบอนุมัติ; `insertCancelLines` (`doc_cancel_item.go:162`) คำนวณ `qty_2` ตามสัดส่วนจำนวนที่ยกเลิก (`qty_2 × จำนวนที่ยกเลิก / qty`, ปัด 4 ตำแหน่ง)
6. **ยอดค้าง** (`lineBalances`, `doc_cancel_item.go:98`): `qty_2` คงเหลือ = `GREATEST(d.qty_2 - SUM(x.qty_2), 0)` ควบคู่กับ `qty` คงเหลือ
7. **โอนสินค้าระหว่างคลัง**: บันทึกเป็นคู่ขา 72 (ออก, calc_flag -1) และ 70 (เข้า, +1) พร้อมคัดลอก `unit_code_2`, `qty_2`, `unit_size` ทั้งสองขา (`trans.go` ราว :1088-1127)

## การดึงเอกสารอ้างอิง (`POST /process/transgrid/refimport`)
ตาราง `refImportSpecs` ใน `trans_ref_import.go:24` ใช้คีย์ `{ชนิดเอกสารปลายทาง, ชนิดเอกสารต้นทาง}` กำหนดว่าต้องหักยอดเอกสารชนิดใดออกจากยอดค้าง (คอมเมนต์ในโค้ดอ้างบรรทัดใน C# `_icTransItemGridControl`) คู่ที่ไม่อยู่ในตารางจะคงจำนวนเต็มของบรรทัดต้นทาง (ตอนบันทึกยังตรวจกันดึงเกิน)

| ปลายทาง ← ต้นทาง | ความหมาย |
|---|---|
| 6 ← 4 หรือ 2 | ใบสั่งซื้อ (PO) จากใบอนุมัติ PR / PR |
| 12 ← 6, 310 ← 6 | ซื้อสินค้า / รับทะยอย จาก PO |
| 315 ← 310 | ชนิด 315 (skill เรียก Billing) จากรับทะยอย |
| 34 ← 30, 36 ← 30, 36 ← 34 | จอง / ใบสั่งขาย (SO) จากใบเสนอราคาหรือใบจอง |
| 44 ← 30, 34, 36 | ขายสินค้าจากใบเสนอราคา / ใบจอง / SO |
| 56 ← 122, 58 ← 56 | เบิกจากใบขอเบิก, รับคืนจากการเบิก |
| 72 ← 124 | โอนออกจากใบขอโอน |

- **ยอดคืน** ใช้ `refRemainSpecs` (`trans_ref_import_remain.go:18`): `311 ← 310`, `16 ← 12`, `48 ← 44` หักทั้ง `qty`, `qty_2` และมูลค่าที่เคยคืนแล้ว ด้วยเงื่อนไข `inquiry_type` ต่อคู่ และ `remain_qty_2 = GREATEST(d.qty_2 - ยอดที่ใช้แล้ว, 0)`
- ตัวอย่างเรียก (จาก skill): `apiPost("/api/process/transgrid/refimport", { transFlag: 12, docNo, vatType: 1, vatRate: "7", refDocs: [{ docNo, transFlag: 6, docRefType: 0 }] })`

## Serial Number และ Lot
- KMS ระบุ `cost_type` 3 = Serial, 2 = Lot/Expire; ตาราง `ic_serial` (คงเหลือ) และ `ic_trans_serial_number` (ผูกกับเอกสาร) — โค้ดเครื่องมือ Serial อยู่ที่ `stock_tools.go` (`SerialAnalyze`, `SerialScan`, `SerialCountSave`) เอกสารแหล่งนี้ไม่มีกติกาเชิงลึกกว่านี้ จึงไม่ขยายความเพิ่ม

## ข้อควรระวัง: เอกสารกับโค้ดไม่ตรงกัน (ตรวจแล้ว)
- **ตารางใน KMS §4 ใช้เลขชนิดเอกสารต่างจากโค้ด** (เช่น KMS ระบุ PO = 10, SO = 32) ขณะที่ `refImportSpecs` และ skill ใช้ PO = 6, SO = 36 ให้ยึดโค้ด/skill และห้ามคัดเลขจากตาราง KMS มาใช้
- ไฟล์ที่ KMS/skill อ้างแต่ไม่พบแล้ว: `inventory_save.go`, `ic_trans_validation.go`, `so_po_save.go`, `ic_trans_save.go` (ตรรกะย้ายไป `item_master.go`, `trans_lines_check.go`, `trans.go`), `frontend/src/components/**` (ของจริงอยู่ `frontend/account/transaction/` และ `frontend/account/master/ItemScreen.tsx`)
- `frontend/account/StockBeginningBalanceScreen.tsx` ใน skill: ของจริงอยู่ที่ `frontend/account/transaction/StockBeginningBalanceScreen.tsx`

## ที่มา
- `docs/kms/KMS_INVENTORY_COSTING_SERIAL_PARALLEL_UNIT.md` §1, §3, §4
- `.agents/skills/inventory-costing-and-parallel-unit/SKILL.md` Workflow ข้อ 1–3, Config, Usage example
- โค้ดจริง: `backend/internal/application/process/` (ไฟล์ที่ระบุข้างต้น)

## ดูเพิ่ม
[[standards-overview]] · [[std-inventory-costing-rules]] · [[std-grid-row-reorder-add-row]] · [[std-data-integrity-money-transactions]] · [[process-overview]] · [[backend-overview]]
