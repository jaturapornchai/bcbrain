---
title: "ยอดคงเหลือและต้นทุนสินค้า (Stock Balance and Costing, rebuildStockTx)"
tags: [standards, inventory, costing, postgres, go, accounting]
aliases: ["rebuildStockTx", "RebuildStock", "CalculateMovingAverage", "CalculateFIFOCost", "average_cost", "sum_of_cost", "balance_qty", "stockBalancePredicate", "is_lock_cost", "ต้นทุนเฉลี่ย", "FIFO", "cost_type", "ic_trans_detail", "stock/rebuild"]
sources: ["docs/kms/KMS_INVENTORY_COSTING_SERIAL_PARALLEL_UNIT.md", ".agents/skills/inventory-costing-and-parallel-unit/SKILL.md", "AGENTS.md", "backend/internal/application/process/service.go:1007", "backend/internal/application/process/service.go:189", "backend/internal/application/process/service.go:355", "backend/internal/application/process/stock_rebuild.go:18"]
---

# ยอดคงเหลือและต้นทุนสินค้า (Stock Balance and Costing)

ยอดคงเหลือและต้นทุนเป็นผลลัพธ์ที่สร้างใหม่ได้ (Rebuildable Derived Results) จากรายการดิบใน `ic_trans_detail` ตามหลัก Raw Data → Process → Derived (AGENTS.md ข้อ 9) ฟังก์ชันหลักคือ `rebuildStockTx` ใน `backend/internal/application/process/service.go:1007` ส่วนหน่วยนับขนานและการดึงเอกสารอ้างอิงดู [[std-parallel-unit-and-ref-import]]

## ตารางหลัก
| ตาราง | หน้าที่ | คอลัมน์สำคัญ |
|---|---|---|
| `ic_inventory` | ทะเบียนสินค้า (เมนู `P0017`) | `unit_type`, `cost_type`, `unit_cost`, `balance_qty`, `balance_qty_2`, `average_cost`, `item_type` |
| `ic_trans_detail` | รายการสินค้าในเอกสารทุกประเภท | `trans_flag`, `calc_flag`, `qty`, `stand_value`, `divide_value`, `sum_amount`, `sum_of_cost`, `average_cost`, `is_lock_cost`, `sum_of_cost_fix`, `last_status` |
| `ic_serial`, `ic_trans_serial_number` | Serial Number คงเหลือ / ผูกกับเอกสาร | `ic_code`, `serial_number`, `status` (0 = ว่างในคลัง, 1 = ขาย/เบิกแล้ว) |

ค่า `cost_type` ตามโค้ด (`report_menu_ic.go:885`): 0 = ต้นทุนเฉลี่ย, 1 = LOT FIFO, 2 = LOT กำหนดเอง (บังคับเลือก lot ตอนบันทึก — `trans_save_rules.go:183`), 3 = FEFO (วันหมดอายุ), 4 = ต้นทุนมาตรฐาน, 5 = ต้นทุนแบบพิเศษ 1

## กฎ/วิธีทำ
1. **คำนวณยอดคงเหลือจากรายการดิบเท่านั้น** ห้ามแก้ `ic_inventory.balance_qty` ตรง ให้เรียก `POST /process/stock/rebuild` (`{ itemCodes: [...] }`) ซึ่งทำใน Transaction เดียว
2. **สูตรยอดคงเหลือ** (service.go ขั้นตอน "Step 2", ราว :1066)
   - `balance_qty = SUM(qty × calc_flag × stand_value / divide_value)` (หน่วยมาตรฐานบัญชี; `stand_value`/`divide_value` เป็น 0 หรือว่างให้ถือเป็น 1)
   - `balance_qty_2 = SUM(COALESCE(qty_2, 0) × calc_flag)` (หน่วยขนานเพื่อตรวจนับจริง)
   - อัปเดตกลับ `ic_inventory` เฉพาะแถวที่ค่าเปลี่ยน (`IS DISTINCT FROM`) และไม่รวมสินค้าบริการ (`item_type = 5`)
3. **แถวที่นับเป็นสต็อกจริง** กำหนดที่ `stock_rebuild.go:18-29`: `last_status = 0`, ไม่ใช่สำเนาเอกสาร (`is_doc_copy`), `item_type IN (0,4,6)`, `trans_flag` อยู่ในรายการที่เคลื่อนไหวสต็อก และตัดบรรทัดที่ปรับเฉพาะมูลค่า (`trans_flag IN (14,16,311)` ที่ `inquiry_type IN (1,3)`) ออกจากจำนวน — ภาคแสดงนี้ละเอียดกว่าสูตรสั้นใน KMS (ซึ่งกล่าวถึง `is_pos` และ `calc_flag IN (1,-1)`) ให้ยึดโค้ด
4. **กันชนกัน**: ล็อกรายสินค้าด้วย `pg_advisory_xact_lock` (`lockStockItems`) เรียงตามรหัสเพื่อกัน deadlock; ถ้าไม่ระบุสินค้าจะล็อกทั้งงาน (`stockRebuildLock`)
5. **ต้นทุน**: ดึงรายการเคลื่อนไหวของสินค้าที่เกี่ยวข้องรอบเดียว (ไม่วนคิวรีรายสินค้า) แล้วคำนวณรายสินค้าใน Go ด้วย `*big.Rat` ปัดแบบ HALF_UP (`RoundHalfUp`) ตามทศนิยมของ `erp_option.item_price_decimal` / `item_amount_decimal` (ค่าเริ่มต้น 2, ช่วงที่ยอมรับ 1-6 — `stockScales`) จากนั้นเขียนเฉพาะแถวที่ต้นทุนเปลี่ยนกลับ `ic_trans_detail` ด้วย `UPDATE ... FROM` แบบกลุ่ม
6. **ต้นทุนเฉลี่ย** (`CalculateMovingAverage`, service.go:189) ไล่ตามลำดับเอกสาร
   - ขาเข้า (ซื้อ 12, ยกมา 54, รับคืนจากลูกค้า 46, ปรับเข้า 58/66 ฯลฯ) รวมมูลค่าแล้วหารจำนวนได้ราคาเฉลี่ยใหม่; ขาออกใช้ราคาเฉลี่ยปัจจุบัน
   - บรรทัดปรับสต็อก `66` ที่จำนวนติดลบถือเป็นขาออกที่ราคาเฉลี่ย (ตามคอมเมนต์ใน C# `_icInfoFlag._outFlag`)
   - โอนระหว่างคลัง `72` (ออก) / `70` (เข้า) ไม่เปลี่ยนจำนวนและมูลค่ารวมของสินค้า: ขา 72 บันทึกจำนวน × ราคาเฉลี่ย แล้วขา 70 รับต้นทุนเดียวกันไป
   - บรรทัดที่ล็อกต้นทุน (`is_lock_cost = 1`) ใช้ `sum_of_cost_fix` แทนต้นทุนที่คำนวณ
7. ต้นทุนคิดจากหน่วยมาตรฐานบัญชี (`qty × stand_value / divide_value`) เท่านั้น ส่วน `qty_2` ผู้ใช้กรอกแยกอิสระ ห้ามผูกสูตรคูณตายตัวทับค่าที่กรอก
8. ตัวเลขเงินทุกค่าใช้ decimal/`big.Rat` ห้าม float ตามกฎบัญชีของโปรเจกต์ ([[std-data-integrity-money-transactions]])

## ข้อควรระวัง: เอกสารกับโค้ดไม่ตรงกัน (ตรวจแล้ว)
- KMS กล่าวถึง "Incremental Dirty-Date + Topological Wave Costing" (`min_dirty_date`, Wave 0/1+, ไฟล์ `stock_cost.go` และ `ic_cost_tier.go`) — **ไม่พบไฟล์เหล่านี้ และค้นหา `min_dirty` / `ProcessStockCost` ในโค้ด backend ไม่พบ** กลไกจริงคือ `rebuildStockTx` ที่คำนวณซ้ำทุกเอกสารของสินค้าที่ระบุ
- `CalculateFIFOCost` (service.go:355, คิว FIFO แบบ O(N)) มีอยู่แต่ค้นไม่พบการเรียกใช้นอกไฟล์ทดสอบ (`stock_speed_bench_test.go`); `rebuildStockTx` เรียก `CalculateMovingAverage` ทุกสินค้า และ `cost_type` ถูกใช้ในทะเบียนสินค้า รายงาน และกติกาบันทึก/Lot (`item_master.go`, `trans_save_rules.go`, `trans_lot_auto.go`, `report_menu_ic.go`) แต่ไม่ได้ใช้เลือกสูตรใน rebuild — ก่อนอ้างว่า FIFO ทำงานจริงต้องถามลุงจืดหรือตรวจเพิ่ม
- KMS อ้าง `service.go#L1065-L1122` สำหรับ `rebuildStockTx` ซึ่งปัจจุบันเริ่มที่บรรทัด 1007 และยาวกว่านั้น

## ที่มา
- `docs/kms/KMS_INVENTORY_COSTING_SERIAL_PARALLEL_UNIT.md` §1–§2
- `.agents/skills/inventory-costing-and-parallel-unit/SKILL.md` Workflow ข้อ 2, Config, Limitation
- โค้ดจริง: `backend/internal/application/process/service.go`, `stock_rebuild.go`

## ดูเพิ่ม
[[standards-overview]] · [[std-parallel-unit-and-ref-import]] · [[std-data-integrity-money-transactions]] · [[accounting-overview]] · [[backend-overview]]
