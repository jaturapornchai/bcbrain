---
title: "ต้นทุนแฝง/ต้นทุนนำเข้า (ic_hidden_cost_process, _ref, _item)"
tags: [tables, ic]
aliases: ["ic_hidden_cost_process", "ic_hidden_cost_process_ref", "ic_hidden_cost_process_item", "ต้นทุนแฝง", "Landed Cost", "ต้นทุนนำเข้าต่างประเทศ", "AFC"]
sources: ["backend/internal/application/process/hidden_cost.go:15", "backend/internal/application/process/hidden_cost.go:408", "backend/internal/application/process/hidden_cost.go:416", "backend/internal/application/process/hidden_cost.go:533", "backend/internal/application/process/hidden_cost.go:560", "backend/internal/application/process/hidden_cost.go:577", "backend/internal/application/process/doc_cancel.go:437", "backend/internal/application/process/doc_no_next.go:12", "frontend/account/master/HiddenCostScreen.tsx:68", "docs/kms/KMS_PGSQL_NAMING_CONVENTION.md:84"]
---
# ต้นทุนแฝง/ต้นทุนนำเข้า (`ic_hidden_cost_process`, `_ref`, `_item`)

**หน้าที่:** เอกสาร "ต้นทุนแฝง & ต้นทุนนำเข้าต่างประเทศ (Landed Cost, TAS 2)" เมนู 2.22 — เอาค่าใช้จ่ายที่เกี่ยวกับการซื้อ (ค่าขนส่ง ประกัน อากร ชิปปิ้ง และเอกสารตั้งหนี้อื่น/ค่าใช้จ่ายอื่น) ไปกระจายเข้าต้นทุนของสินค้าในเอกสารซื้อ/รับสินค้า ผลคือ **ใบปรับปรุงต้นทุนแบบมูลค่าอย่างเดียว** (`ic_trans` `trans_flag = 66`, `doc_ref` = เลขที่เอกสารต้นทุนแฝง) ซึ่งทำให้ rebuild สต๊อกบวกส่วนแบ่งเข้าต้นทุนสินค้า (`hidden_cost.go:15-21`) ดู [[acc-inventory-cost-moving-average]] และวิธีคำนวณที่ [[proc-hidden-cost]]

เป็น 3 ตารางที่ผูกกันด้วย `doc_no` (ไม่มี `trans_flag` — `doc_cancel.go:437`):

ชนิดข้อมูลในวงเล็บ = ชนิดที่ `ensureHiddenCostImportCols` (`hidden_cost.go:416-439`) ใช้ตอนเพิ่มคอลัมน์ที่ยังไม่มี ถ้าฐานเดิมมีคอลัมน์ชื่อนั้นอยู่แล้ว ชนิดเดิมคงอยู่

## 1) หัว `ic_hidden_cost_process` (INSERT `hidden_cost.go:534-546`)

| column | ความหมาย |
|---|---|
| `doc_no`, `doc_date`, `doc_time`, `doc_format_code`, `branch_code`, `remark` | เลขที่/วันที่/รูปแบบเลขที่ ([[tbl-erp-doc-format]]) / สาขา / หมายเหตุ |
| `total_amount` | ค่านำเข้าที่กรอกตรง + ผลรวมมูลค่าสุทธิ (`ic_trans.total_amount`) ของเอกสารค่าใช้จ่าย ไม่ขึ้นกับ `cal_hidden_cost_from` (`hidden_cost.go:226-229`, `:280`) |
| `hidden_cost_amount` (NUMERIC(18,2)) | ยอดที่ปันส่วนจริง = ค่านำเข้าที่กรอกตรง + เอกสารค่าใช้จ่ายแบบสุทธิหรือก่อนภาษีตาม `cal_hidden_cost_from` (`$6`, `hidden_cost.go:227-235`, `:281`, `:541`) |
| `doc_no_adjust`, `doc_format_code_adjust` | เลขที่และรูปแบบของใบปรับปรุงต้นทุนที่สร้างคู่กัน (`ic_trans` flag 66) |
| `cal_hidden_cost_from` | 0 = ใช้มูลค่าสุทธิ, 1 = มูลค่าก่อนภาษี (`hidden_cost.go:51`) |
| `cal_hidden_cost_follow` | วิธีเฉลี่ย: 0 ตามมูลค่าสินค้า, 1 ตามจำนวน, 2 ตามน้ำหนักจริง/หน่วยขนาน (`qty_2`), 3 เท่ากันทุกรายการ (`hidden_cost.go:52`) |
| `customs_entry_no` (VARCHAR(50)), `vessel_container_no` (VARCHAR(100)) | เลขที่ใบขนสินค้าขาเข้า, เรือ/เที่ยวบิน/ตู้คอนเทนเนอร์/ทะเบียนรถ (ตัดช่องว่างหัวท้าย `hidden_cost.go:283-284`) |
| `incoterms` (VARCHAR(20) ค่าเริ่ม `'CIF'`), `currency_code` (VARCHAR(10) ค่าเริ่ม `'THB'`) | Incoterms และสกุลเงิน แปลงเป็นตัวพิมพ์ใหญ่ ว่าง = CIF / THB (`hidden_cost.go:285-286`) |
| `exchange_rate` (NUMERIC(18,6) ค่าเริ่ม 1) | อัตราแลกเปลี่ยน (`$17`); ว่างหรือ <= 0 = 1 (`hidden_cost.go:276-279`); เก็บไว้เท่านั้น ไม่ได้คูณยอดใด |
| `transport_value` (NUMERIC(18,2)) | ค่าขนส่ง/ระวาง (`$18`) |
| `insurance_amount`, `import_duty_amount`, `clearance_port_amount` (NUMERIC(18,2)) | ค่าประกัน, อากรขาเข้า, ชิปปิ้ง/พิธีการ/ท่าเรือ (ต้นทุนนำเข้าตรง ปัด HALF_UP 2 ตำแหน่งก่อนเก็บ `hidden_cost.go:288-291`) |
| `create_date_time_now` | เวลาสร้าง |

## 2) เอกสารอ้างอิง `ic_hidden_cost_process_ref` (INSERT `hidden_cost.go:560-566`)

| column | ความหมาย |
|---|---|
| `doc_no` | เลขที่ต้นทุนแฝง (หัว) |
| `ref_type` | `trans_flag` ของเอกสารที่อ้าง |
| `doc_ref_type` | index ของชนิดในกริด: ค่าใช้จ่าย 87 = 0, 260 = 1; เอกสารซื้อ 12 = 0, 310 = 1, 60 = 2 (`hidden_cost.go:31-32`) |
| `doc_ref_no`, `doc_ref_date`, `doc_ref_amount` | เอกสารที่อ้าง วันที่ และ `ic_trans.total_amount` |
| `amount_before_vat` | ยอดก่อนภาษี (เฉพาะแถวค่าใช้จ่าย; แถวซื้อเป็น 0 — `hidden_cost.go:552-553`) |

ฝั่งค่าใช้จ่ายคือ 87 (ตั้งหนี้อื่นๆ เจ้าหนี้) และ 260 (ค่าใช้จ่ายอื่นๆ); ฝั่งซื้อคือ 12 (ซื้อสินค้า), 310 (รับสินค้า), 60 (รับสินค้าสำเร็จรูป) — ทั้งหมดอยู่ใน [[tbl-ic-trans]]; เพดาน `hiddenCostRefCap = 200` เอกสารต่อฝั่ง

## 3) รายการสินค้า `ic_hidden_cost_process_item` (INSERT `hidden_cost.go:577-586`)

| column | ความหมาย |
|---|---|
| `doc_no`, `line_number` | เลขที่ต้นทุนแฝง, ลำดับ (เริ่ม 0 จาก ORDINALITY − 1) |
| `billing_no`, `billing_date` | เลขที่/วันที่เอกสารซื้อที่สินค้ามาจาก |
| `item_code`, `wh_code`, `shelf_code`, `unit_code`, `remark` | สินค้า คลัง ที่เก็บ หน่วย หมายเหตุ ([[tbl-ic-inventory]], [[tbl-ic-warehouse]], [[tbl-ic-shelf]]) |
| `qty` | จำนวน |
| `qty_2`, `weight` (NUMERIC(18,4)) | น้ำหนักจริง/หน่วยนับขนาน จาก `ic_trans_detail.qty_2` (ว่าง = 0) เขียนค่าเดียวกันทั้งสองคอลัมน์ (`v.q2` ทั้งคู่ `hidden_cost.go:571`, `:581`) — `weight` ไม่ใช่น้ำหนักที่ใช้ปันส่วนจริง: วิธีอื่นใช้มูลค่า/จำนวน/1 และวิธีน้ำหนักเมื่อ `qty_2` = 0 ใช้ `qty` แทน (`:240-253`) แต่ `weight` ยังเก็บ `qty_2` |
| `item_value` | ราคาซื้อต่อหน่วย (`ic_trans_detail.price`) |
| `item_amount`, `sum_amount` (NUMERIC(18,2) เฉพาะ `sum_amount`) | มูลค่าสินค้าเดิม = qty x price; Go ส่งค่าแบบไม่ปัด (`hidden_cost.go:362`) เขียนทั้งสองคอลัมน์ — คนละความหมายกับ `sum_amount` ของบรรทัดใบ 66 ที่เป็นส่วนแบ่ง |
| `adjust_amount`, `hidden_cost_amount` (NUMERIC(18,2) เฉพาะ `hidden_cost_amount`) | ส่วนแบ่งต้นทุนแฝงที่เฉลี่ยให้บรรทัด เขียนค่าเดียวกันทั้งสองคอลัมน์ (ใบ 66 บันทึกบรรทัดนี้ด้วย `qty = 0`, `price = 0`, `sum_amount = adjust_amount` — `hidden_cost.go:504-507`) |
| `ratio` (NUMERIC(10,4)) | สัดส่วนการเฉลี่ยเป็น **เปอร์เซ็นต์** (0-100) ไม่ใช่อัตราส่วน 0-1 ปัด HALF_UP 2 ตำแหน่ง (`hidden_cost.go:261-265`, ชนิด `:432`) |
| `sum_total_amount` (NUMERIC(18,2)) | ต้นทุนรวมสุทธิ = มูลค่าเดิม + ส่วนแบ่ง ปัด HALF_UP 2 ตำแหน่ง (`hidden_cost.go:266-268`) |
| `average_cost` (NUMERIC(18,4)) | ต้นทุนใหม่ต่อหน่วย = (มูลค่าเดิม + ส่วนแบ่ง) / qty ปัด HALF_UP 4 ตำแหน่ง, qty <= 0 = 0 (`hidden_cost.go:269-274`) |
| `stand_value`, `divide_value` | อัตราแปลงหน่วย (0 ถือเป็น 1) |

## กระบวนการ

- **เขียน:** `HiddenCostSave` (`hidden_cost.go:443`) สร้างทั้งสามตาราง + ใบปรับปรุง 66 ใน transaction เดียว; เลขที่ว่าง = เลขถัดไปของชุด AFC (ใบปรับปรุงชุด IA) (`hidden_cost.go:467`, `:489`, `doc_no_next.go:12`) ปัดส่วนแบ่งที่ 2 ตำแหน่งทศนิยม (`hiddenCostScale = 2`, `hidden_cost.go:25-26`) เพื่อให้ยอดรวมส่วนแบ่งลงตัวกับ `sum_amount` ของใบ 66
- **แก้ไข/ลบ:** ลบใบปรับปรุงที่ผูกอยู่ (flag 66 ผ่าน `deleteTransTx`) แล้วลบสามตารางตามลำดับ item → ref → หัว (`dropHiddenCostTx`, `hidden_cost.go:392-414`); ใบ 66 ถูกลบผ่าน `deleteTransTx` จึง rebuild สต๊อก/GL ให้อัตโนมัติ
- **คอลัมน์นำเข้า/ผลปันส่วน** ถูกเพิ่มด้วย `ALTER TABLE … ADD COLUMN IF NOT EXISTS` ทุกครั้งที่บันทึก ภายใน transaction ของการบันทึก (`ensureHiddenCostImportCols`, `hidden_cost.go:416-439` เรียกที่ `:462`): หัว 10 คอลัมน์ `customs_entry_no`, `vessel_container_no`, `incoterms`, `currency_code`, `exchange_rate`, `transport_value`, `insurance_amount`, `import_duty_amount`, `clearance_port_amount`, `hidden_cost_amount` (`:419-428`); item 7 คอลัมน์ `weight`, `qty_2`, `ratio`, `sum_amount`, `hidden_cost_amount`, `sum_total_amount`, `average_cost` (`:430-436`) — ฐานเก่าจึงอาจยังไม่มีจนกว่าจะบันทึกครั้งแรก (โครงสร้าง C# `_g.d` ของสามตารางนี้ไม่มีคอลัมน์เหล่านี้ — `D:\bc\BCERPGlobal\_data.cs:44997-45185`)
- **อ่าน:** หน้าจอ `HiddenCostScreen` อ่านทั้งสามตารางตรง (`HiddenCostScreen.tsx:64-69`, `:74-82`, `:83-85`, `:86-94`) หัวอ่านคอลัมน์เดียว เช่น `coalesce(exchange_rate, 1)`, `coalesce(transport_value, 0)` (`:79-80`); item ยังอ่านคู่คอลัมน์แบบสำรองกัน `coalesce(NULLIF(qty_2,0), weight, 0)` (`:89`), `coalesce(NULLIF(item_amount,0), sum_amount, 0)`, `coalesce(NULLIF(adjust_amount,0), hidden_cost_amount, 0)` (`:90`), `sum_total_amount` ว่าง/0 = `item_amount + adjust_amount` (`:91`); `ratio`, `average_cost` อ่านตรง (`:91-92`)

## ข้อควรระวัง

- ไม่มี `trans_flag` ในตารางนี้ เลขที่เอกสาร (`doc_no`) ต้องไม่ซ้ำภายในตารางเอง (`rejectDuplicate`, `hidden_cost.go:479`)
- เป็นเอกสารที่ **มีผลต่อต้นทุนสินค้า** ผ่านใบ 66 เท่านั้น — ถ้าลบเฉพาะแถวในตารางนี้โดยไม่ลบใบ 66 ต้นทุนจะยังคงรวมส่วนแบ่งไว้
- ค่าเงินทุกช่องเป็น decimal ส่งเป็น string (กฎเหล็กข้อ 20)
- ฐานที่ยังไม่เคยบันทึกผ่านระบบนี้ (ยังไม่มีคอลัมน์ใหม่): รายการซ้ายเปิดได้เมื่อไม่ใส่คำค้น (SELECT ใช้แค่คอลัมน์เดิม `HiddenCostScreen.tsx:66-68`) แต่ค้นด้วยคำค้นจะ error เพราะ WHERE อ้าง `customs_entry_no`/`vessel_container_no` (`:65`) และเปิดเอกสารเก่าไม่ได้ เพราะ SQL ของ `loadDoc` อ้างคอลัมน์ใหม่ทั้งหัว (`:78-81`) และ item (`:89-92`)
- **ชื่อคอลัมน์เทียบมาตรฐาน** ([[std-pgsql-naming-convention]]): ณ 2026-10-31 โค้ดใช้ชื่อมาตรฐานแล้ว (`exchange_rate` `hidden_cost.go:423`, `weight` `:430`, `ratio` `:432`, `average_cost` `:436`) และไม่พบ `fx_rate`/`alloc_pct`/`new_unit_cost` ในซอร์สโค้ด `backend/` และ `frontend/` แล้ว; ชื่อหัว 6 ตัว (`customs_entry_no`, `vessel_container_no`, `incoterms`, `insurance_amount`, `import_duty_amount`, `clearance_port_amount`) ไม่อยู่ในรายการห้ามของ KMS และไม่พบใน `_data.cs` รายละเอียดที่โน้ตมาตรฐาน

## ที่มาในโค้ด

- `backend/internal/application/process/hidden_cost.go:15-33`, `:51-52`, `:261-274`, `:392-414`, `:416-439`, `:479`, `:533-588`
- `backend/internal/application/process/doc_cancel.go:437`
- `backend/internal/application/process/doc_no_next.go:12`
- `frontend/account/master/HiddenCostScreen.tsx:7`, `:65-68`, `:74-94`
- `docs/kms/KMS_PGSQL_NAMING_CONVENTION.md:80-88`
