---
title: "ต้นทุนสินค้าแบบถัวเฉลี่ยเคลื่อนที่ (Moving Average Cost)"
tags: [accounting, inventory, cost, moving-average, go]
aliases: ["ต้นทุนเฉลี่ย", "ถัวเฉลี่ยเคลื่อนที่", "average_cost", "sum_of_cost", "ล็อคต้นทุน", "is_lock_cost", "ต้นทุนแฝง", "FIFO", "CalculateMovingAverage"]
sources: ["backend/internal/application/process/service.go:189", "backend/internal/application/process/service.go:201", "backend/internal/application/process/service.go:220", "backend/internal/application/process/service.go:228", "backend/internal/application/process/service.go:233", "backend/internal/application/process/service.go:256", "backend/internal/application/process/service.go:268", "backend/internal/application/process/service.go:272", "backend/internal/application/process/service.go:276", "backend/internal/application/process/service.go:286", "backend/internal/application/process/service.go:297", "backend/internal/application/process/service.go:312", "backend/internal/application/process/service.go:314", "backend/internal/application/process/service.go:318", "backend/internal/application/process/service.go:319", "backend/internal/application/process/service.go:327", "backend/internal/application/process/service.go:355", "backend/internal/application/process/service.go:1165", "backend/internal/application/process/service.go:1198", "backend/internal/application/process/service.go:1200", "backend/internal/application/process/hidden_cost.go:15", "backend/internal/application/process/hidden_cost.go:125", "backend/internal/application/process/hidden_cost.go:226", "backend/internal/application/process/hidden_cost.go:236", "backend/internal/application/process/hidden_cost.go:276", "backend/internal/application/process/hidden_cost.go:504", "backend/internal/application/process/report_menu_ic.go:914", "backend/internal/application/process/trans_lot_auto.go:86", "backend/internal/application/process/trans.go:1058"]
---

# ต้นทุนสินค้าแบบถัวเฉลี่ยเคลื่อนที่ (`CalculateMovingAverage`)

ต้นทุนของทุกบรรทัดสต็อกคำนวณใหม่ตามลำดับเวลาด้วยวิธีถัวเฉลี่ยเคลื่อนที่ (service.go:189) ทุกสินค้าใช้วิธีนี้ (rebuild เรียกที่ service.go:1198) ฟังก์ชัน FIFO (`CalculateFIFOCost` :355) มีอยู่แต่ถูกเรียกจาก benchmark test เท่านั้น

## ทำงานอย่างไร

ตัวแปรสะสม: `runningQty`, `runningVal`, `currentAvg`; qty ฐาน = qty x stand_value / divide_value (ค่า <= 0 ถือเป็น 1 :201)

### ล็อคต้นทุน (:220)
- `is_lock_cost` = 1 ใช้ `sum_of_cost_fix` (ปัด HALF_UP ที่ amount scale) เป็นต้นทุนของบรรทัด

### ขาเข้า (calc_flag >= 0 :256)
- ยอดเข้า = `sum_amount_exclude_vat` (หรือ `sum_amount` :1165) ถ้าเป็น 0 ใช้ `sum_of_cost` หรือ qty x price
- ปรับปรุงเพิ่ม 66 ที่มี qty และ inquiry_type <> 1 = qty x ต้นทุนเฉลี่ยปัจจุบัน (ไม่ใช้ยอดที่คีย์) (:268)
- รับคืนจากการขาย 48 = qty x ต้นทุนเฉลี่ย เมื่อมีต้นทุนเฉลี่ยแล้ว เพื่อไม่ให้กำไรขายเข้าไปปนต้นทุน (:272)
- 58 / 60 ที่ไม่มียอด = qty x ต้นทุนเฉลี่ย (:276)
- **ถ้า runningQty <= 0 ก่อนรับเข้า**: เริ่มรอบใหม่ runningQty = qty นี้ และ runningVal = ต้นทุนนี้ (ยอดติดลบเดิมถูกลืม) (:286)
- qty 0 = ปรับเฉพาะมูลค่า บวกเข้า runningVal (:297) เช่นต้นทุนแฝง
- ต้นทุนเฉลี่ยใหม่ = runningVal / runningQty ปัด HALF_UP ที่ price scale

### ขาออก (calc_flag < 0 และ 66 ที่ qty ติดลบ :228)
- ต้นทุน = qty x ต้นทุนเฉลี่ย (HALF_UP ที่ amount scale :318)
- ล็อคต้นทุน: ใช้ค่าล็อค และต้นทุนต่อหน่วยของบรรทัด = ค่าล็อค / qty (:312)
- ส่งคืน 16 ใช้ `sum_amount` ของเอกสารถ้า > 0 (:314)
- 68 / 311 ที่ qty 0 = ลดเฉพาะมูลค่าด้วย `sum_amount` (:319)
- **หลังจ่ายออก ถ้า runningQty <= 0 ตั้ง runningVal = 0** (ต้นทุนเฉลี่ยค้างค่าเดิม) (:327)

### โอนย้าย 72 / 70 (:233)
- ไม่เปลี่ยนยอดรวมของสินค้า: 72 ลง qty x ต้นทุนเฉลี่ย (หรือค่าล็อค) แล้ว 70 ที่เลขเดียวกันรับต้นทุนเดียวกันตามลำดับบรรทัด
- 70 ที่ล็อคต้นทุน: ผลต่างระหว่างค่าล็อคกับต้นทุนโอนถูกบวกเข้า runningVal

### ผลลัพธ์
- ส่งเฉพาะแถวที่ `sum_of_cost` หรือ `average_cost` เปลี่ยนไปเขียนกลับ (:1200) ดู [[acc-inventory-stock-rebuild]]

### ต้นทุนแฝง (hidden cost, เมนู 2.22, hidden_cost.go:15) <!-- pragma: allowlist secret -->
- กระจายค่าใช้จ่าย 87 / 260 และ/หรือค่านำเข้าที่กรอกตรง (ค่าขนส่ง ประกัน อากร ชิปปิ้ง) ลงบรรทัดเอกสารซื้อ/รับ 12 / 310 / 60 แล้วบันทึกเป็นเอกสารปรับเฉพาะมูลค่า 66 (doc_ref = เลขต้นทุนแฝง, บรรทัด qty 0 `sum_amount` = ส่วนแบ่ง :504, เอกสารถูกตั้ง `is_lock_record` = 1)
- ยอดที่กระจาย (:226) = ค่านำเข้าตรง + ยอดสุทธิของเอกสารค่าใช้จ่าย หรือยอดก่อน VAT (CalFrom 1); น้ำหนักต่อบรรทัด (:236) ตามมูลค่าบรรทัด (CalFollow 0), qty (1), qty_2 ถ้า > 0 ไม่งั้น qty (2), เท่ากันทุกบรรทัด (3)
- `allocateHiddenCost` (:125): แต่ละส่วน = ยอด x น้ำหนัก / ผลรวม ปัด HALF_UP 2 ตำแหน่ง เศษปัดไปตกที่บรรทัดแรกที่น้ำหนักสูงสุด (ไม่มีน้ำหนัก > 0 = บรรทัดแรก) ผลรวมจึงเท่ายอดพอดี; อัตราแลกเปลี่ยนเก็บไว้แต่ไม่ได้คูณยอด (:276)

## จุดเสี่ยง
- **FIFO / LOT ไม่ถูกใช้คิดต้นทุน**: แม้ `ic_inventory.cost_type` มีค่า 1 "ต้นทุน LOT FIFO" และ 2 "ต้นทุน LOT กำหนดเอง" (report_menu_ic.go:914) แต่ rebuild เรียก Moving Average เสมอ cost_type 2 ใช้แค่กับการเลือก lot อัตโนมัติ (trans_lot_auto.go:86) ดู [[acc-stock-special-docs]]
- **การ reset เมื่อติดลบ** ทำให้ขายก่อนรับ (สต็อกติดลบ) มีต้นทุนตามต้นทุนเฉลี่ยเดิม แล้วรอบรับใหม่ไม่ได้ชดเชย มูลค่าสต็อกรวมจึงอาจไม่เท่ากับผลรวมรับ - จ่าย
- GL ของ IA 66 ใช้ยอดหัวเอกสาร ไม่ใช่ qty x ต้นทุนเฉลี่ย (known gap) ดู [[acc-gl-posting-standard]]
- `sum_of_cost` ตอนบันทึกเอกสาร = qty x ต้นทุน ปัด HALF_UP 2 ตำแหน่ง (trans.go:1058) ก่อนถูก rebuild ทับ ดู [[acc-rounding-decimal]]

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:189` CalculateMovingAverage
- `backend/internal/application/process/service.go:220` ล็อคต้นทุน
- `backend/internal/application/process/service.go:233` โอน 72/70
- `backend/internal/application/process/service.go:268` 66 / 48 / 58 / 60 ขาเข้า
- `backend/internal/application/process/service.go:286` reset เมื่อติดลบ
- `backend/internal/application/process/service.go:318` ขาออก
- `backend/internal/application/process/service.go:327` runningVal = 0
- `backend/internal/application/process/service.go:355` CalculateFIFOCost (ไม่ถูกเรียก)
- `backend/internal/application/process/hidden_cost.go:125` allocateHiddenCost

## ดูเพิ่ม
- [[acc-inventory-stock-rebuild]]
- [[acc-stock-special-docs]]
- [[acc-rounding-decimal]]
