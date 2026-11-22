---
title: "ผลกระทบเอกสารต่อสต็อก ต้นทุนถัวเฉลี่ย/FIFO คู่แฝดโอนคลัง 72→70 และ Lot/Serial"
audience: "dev"
tags: [doctypes, stock, cost, moving_average, fifo, ic_trans_detail, transfer]
aliases:
  - "ผลกระทบสต็อก calc_flag"
  - "คำนวณต้นทุน Moving Average FIFO"
  - "โอนคลัง 72 70"
  - "is_lock_cost sum_of_cost"
  - "RebuildStock"
  - "lot serial สต็อก"
sources:
  - "backend/internal/application/process/service.go:213-584"
  - "backend/internal/application/process/service.go:748-840"
  - "backend/internal/application/process/service.go:1390-2040"
  - "backend/internal/application/process/stock_cost_engine.go:10-120"
  - "backend/internal/application/process/trans.go:780-1120"
---

# ผลกระทบเอกสารต่อสต็อก ต้นทุนถัวเฉลี่ย/FIFO คู่แฝดโอนคลัง `72`→`70` และ Lot/Serial

การเคลื่อนไหวของปริมาณสินค้าคงเหลือและต้นทุนสินค้าทุกชิ้นใน BC Ai Account คำนวณจากตาราง **`ic_trans_detail`** (เฉพาะแถวที่ `COALESCE(last_status, 0) = 0` และสินค้าไม่ใช่สินค้าบริการ `item_type <> 5`) โดยใช้ `calc_flag` เป็นตัวกำหนดทิศทางเข้า-ออก (ดูภาพรวมรหัสเอกสารที่ [[doc-trans-flag-catalog]])

---

## 1. แผนที่ `calc_flag` และวิธีคิดต้นทุนต่อเอกสาร

| กลุ่มทิศทาง | `calc_flag` | `trans_flag` ที่เกี่ยวข้อง | พฤติกรรมต้นทุน (`sum_of_cost` / `average_cost`) |
|---|---:|---|---|
| **รับสินค้าเข้าคลัง (Stock In)** | **`+1`** | `54` (ยกมา), `12` (ซื้อสินค้า), `310` (ทะยอยรับตาม PO), `60` (รับสินค้าสำเร็จรูป), `66` (ปรับปรุงเพิ่ม), `48` (รับคืนจากการขาย), `58` (รับคืนจากการเบิก), `70` (รับโอนเข้าคลัง) | - `54, 12, 310, 60, 66`: ใช้ต้นทุนซื้อ/ต้นทุนที่ระบุในเอกสาร (`is_lock_cost = 1` บน `54, 60` หรือคำนวณจากยอดซื้อหลังส่วนลด/ค่าใช้จ่ายแฝง)<br>- `48`: ใช้ต้นทุนอ้างอิงจากบิลขายเดิมหรือต้นทุนเฉลี่ย ณ ขณะนั้น<br>- `58`: หากไม่ระบุต้นทุนแต่มี `average_cost > 0` ระบบ backfill `sum_of_cost` ให้ก่อนคำนวณ (`service.go:1076-1085`)<br>- `70`: รับต้นทุนต่อหน่วยเดียวกันเป๊ะจากขาโอนออก `72` |
| **จ่ายสินค้าออกจากคลัง (Stock Out)** | **`-1`** | `44` (ขาย/POS), `16` (ส่งคืนสินค้าให้ผู้ขาย), `311` (ส่งคืนจากการทะยอยรับ), `56` (เบิกวัตถุดิบ), `68` (ปรับปรุงลด/ขาด), `72` (โอนออกจากคลังต้นทาง) | - `44, 56, 68, 72`: ระบบคำนวณ `sum_of_cost` อัตโนมัติตามวิธีต้นทุนของสินค้า (Moving Average หรือ FIFO) ยกเว้นแถวที่ตั้ง `is_lock_cost = 1` จะยึด `sum_of_cost_fix`<br>- `16, 311`: อ้างอิงราคาทุนของบิลซื้อเดิม (หรือตัดตามวิธีต้นทุนหากไม่อ้างบิล) |
| **ใบยกเลิกเอกสารสต็อก** | **`+1` / `-1`** | `13, 17, 45, 49, 57, 59, 61, 67, 69, 73, 330, 331` | เมื่อยกเลิกเอกสาร ระบบตั้ง `last_status = 1` บนเอกสารต้นฉบับ ทำให้แถวต้นฉบับถูกตัดออกจากการคำนวณสต็อกทันที |
| **ไม่กระทบสต็อก** | **`0`** | เสนอซื้อ/สั่งซื้อ (`2,6`), เสนอราคา/สั่งจอง/สั่งขาย (`30,34,36`), มัดจำ (`10,11,40,110`), เพิ่มหนี้ราคาผิด (`14,46,316`), ตั้งหนี้ทะยอยรับ (`315`), ลดหนี้ราคาผิด (`inquiry_type` ที่ไม่คืนของ), ตรวจนับ (`76`) | ไม่ถูกนำมาบวกลบปริมาณคงเหลือ |

---

## 2. สูตรแปลงหน่วยนับสู่หน่วยฐาน (Base Unit Conversion)

ทุกบรรทัดใน `ic_trans_detail` เก็บจำนวนตามหน่วยที่ทำรายการ (`qty`, `unit_code`) พร้อมอัตราส่วนแปลงเป็นหน่วยนับมาตรฐานต่ำสุด (`stand_value` และ `divide_value` จากตารางหน่วยนับ `ic_unit_use`):

$$\text{Base Qty} = \text{qty} \times \frac{\text{COALESCE(NULLIF(stand\_value, 0), 1)}}{\text{COALESCE(NULLIF(divide\_value, 0), 1)}}$$

- ปริมาณคงเหลือจริงต่อคลัง/ที่เก็บ จะคำนวณจาก `SUM(calc_flag * Base Qty)` เสมอ
- ฟังก์ชัน `updateUnitRatioDetailTx` (`service.go:748`) คอยซิงก์ `stand_value` และ `divide_value` ให้ตรงกับทะเบียนหน่วยนับก่อนประมวลผลสต็อกใหม่

---

## 3. กลไกคู่แฝดใบโอนสินค้าระหว่างคลัง (`72` → `70`)

เมื่อบันทึกใบโอนสินค้า (`doc_format_code = 'IM'`) หน้าจอจะรับข้อมูลเป็น **`trans_flag = 72`** (ระบุคลังต้นทาง `wh_code`/`shelf_code` และคลังปลายทาง `wh_code_2`/`shelf_code_2`):
1. ระบบบันทึกหัวเอกสารและบรรทัดขาโอนออก **`trans_flag = 72`** (`calc_flag = -1`) ตัดของออกจากคลังต้นทาง
2. ภายใน Transaction เดียวกัน ระบบสร้างหัวเอกสารและบรรทัดคู่แฝดขาโอนเข้า **`trans_flag = 70`** (`calc_flag = +1`) โดยใช้ **`doc_no` เดียวกันเป๊ะ** แต่สลับคลังปลายทางมาเป็นคลังรับเข้า (`wh_code`, `shelf_code`)
3. เมื่อยกเลิกหรือลบใบโอน `72` ระบบจะยกเลิก/ลบแถว `70` ที่มี `doc_no` เดียวกันไปพร้อมกันเสมอ

### กฎลำดับการ Replay ต้นทุน (`rebuildStockTxWithOptions` ใน `service.go:1686-1730`)
เพื่อให้ต้นทุนของขาโอนเข้า (`70`) ทราบต้นทุนเฉลี่ยที่ตัดออกจากขาโอนออก (`72`) ในวินาทีเดียวกัน เครื่องยนต์คำนวณต้นทุนจะเรียงลำดับรายการเคลื่อนไหวของสินค้าแต่ละตัวด้วย `ORDER BY` พิเศษดังนี้:

```sql
ORDER BY
  doc_date ASC,
  CASE WHEN trans_flag = 54 THEN 0 ELSE 1 END ASC,        -- 1. ยอดยกมา (54) มาก่อนเสมอในวันเดียวกัน
  CASE WHEN trans_flag = 70 THEN -2 ELSE calc_flag END DESC, -- 2. รับเข้า (+1) -> ตัดออก (-1 รวมถึง 72) -> รับโอนเข้า (70 ได้ค่า -2 มาหลัง 72!)
  doc_time ASC,
  doc_no ASC,
  trans_flag ASC,
  line_number ASC
```

สังเกตบรรทัด `CASE WHEN trans_flag = 70 THEN -2 ELSE calc_flag END DESC`:
- รายการรับเข้าปกติ (`calc_flag = 1`) ถูกคำนวณก่อน เพื่อเติมสต็อกและอัปเดตต้นทุนถัวเฉลี่ยของวันนั้นให้พร้อมก่อนตัดขาย
- รายการตัดออก (`calc_flag = -1` ซึ่งรวมขาโอนออก `72`) ถูกคำนวณถัดมา ทำให้ `72` ได้ต้นทุนต่อหน่วยที่ถูกต้อง
- ขารับโอนเข้า `70` (ถูกแปลงค่าเรียงลำดับเป็น `-2`) ทำงานต่อจาก `72` ทันที จึงรับต้นทุนเดียวกับ `72` เข้าคลังปลายทางโดยไม่คลาดเคลื่อนแม้แต่สตางค์เดียว!

---

## 4. วิธีคำนวณต้นทุนสินค้า (`ic_inventory.cost_type`)

ใน `service.go` และ `stock_cost_engine.go` รองรับการคำนวณต้นทุนด้วย `*big.Rat` ครบทุกวิธี:
1. **ต้นทุนถัวเฉลี่ยเคลื่อนที่ (`CalculateMovingAverage` `service.go:213-431` / `calcItemMovingAverageCost`)**:
   - เมื่อรับเข้า (`calc_flag = +1`): `new_total_qty = old_qty + in_qty`, `new_total_cost = old_cost + in_cost`, `avg_cost = RoundHalfUp(new_total_cost / new_total_qty, priceScale)`
   - เมื่อจ่ายออก (`calc_flag = -1`): `out_cost = RoundHalfUp(out_qty * avg_cost, amountScale)` (หากจ่ายหมดคลังพอดี `remaining_qty == 0` จะกวาด `remaining_cost` ทั้งหมดออกเพื่อไม่ให้เหลือเศษปัดทศนิยมค้างในมูลค่าคลัง!)
   - กรณีสต็อกติดลบชั่วคราวแล้วมีของรับเข้าภายหลัง ระบบรองรับการปรับมูลค่าตามมาตรฐาน BC 5.5
2. **เข้าก่อน-ออกก่อน / Lot / Expire / Identified / Standard (`CalculateFIFOCost` `service.go:432-584` และ `CalculateItemStockCost` `stock_cost_engine.go:67-92`)**:
   - รองรับ `CostType` 0–5 (`0=MovingAvg`, `1=FIFO`, `2=LotFIFO`, `3=ExpireFEFO`, `4=Identified`, `5=StandardCost` จาก `ic_standard_cost`), ตัวเลือกคำนวณแยกคลัง (`CostByWh`) และคงเมทาดาต้า Lot (`preservedLots` ใน `service.go:1621-1683, 1926-2023`) ระหว่าง RebuildStock
   - เก็บคิวกองต้นทุน (Cost Layers) ตามลำดับรับเข้า และตัดกองเก่าสุดออกก่อนตามลำดับเวลา/Lot/วันหมดอายุ เมื่อขายหมดกองจะขยับไปกองถัดไปอัตโนมัติ

หากต้องการโพสต์ต้นทุนขายแบบ Perpetual (`Dr 5110-00 ต้นทุนขาย / Cr 1131-00 สินค้าคงเหลือ`) ลงใน `gl_journal_detail` ทันทีหลังคำนวณต้นทุนใหม่ ให้เรียก RebuildStock ก่อน แล้วตามด้วย RebuildGL ของบิลขาย (`action_code` `101` และ `103` ใน [[doc-gl-templates-trade-apar]])

---

## 5. การคุม Lot Number และ Serial Number

- สินค้าที่เปิดคุม Lot หรือวันหมดอายุ จะบันทึกรายการเคลื่อนไหวล็อตควบคู่กับ `ic_trans_detail` (อ้าง `doc_no`, `trans_flag`, `item_code`, `wh_code`, `shelf_code`)
- สินค้าที่เปิดคุม Serial Number (เช่น มือถือ เครื่องใช้ไฟฟ้า อุปกรณ์ไอที) จะผูกหมายเลข Serial รายชิ้นเข้ากับเอกสารรับเข้า (`12, 54, 60, 66, 48`) และเปลี่ยนสถานะเมื่อตัดจ่ายออก (`44, 16, 56, 68`) เพื่อป้องกันการขาย Serial ซ้ำ
