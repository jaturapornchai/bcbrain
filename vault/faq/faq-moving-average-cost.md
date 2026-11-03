---
title: "ต้นทุนสินค้าคิดแบบไหน ถัวเฉลี่ยเคลื่อนที่คำนวณยังไง"
tags: [faq, ic, stock, cost, moving-average]
aliases: ["ต้นทุนถัวเฉลี่ยคิดยังไง", "moving average cost", "ต้นทุนเฉลี่ยเคลื่อนที่", "average_cost", "sum_of_cost", "CalculateMovingAverage", "ต้นทุนขายคิดจากอะไร", "item_price_decimal"]
sources: ["backend/internal/application/process/service.go:189", "backend/internal/application/process/service.go:268", "backend/internal/application/process/service.go:286", "backend/internal/application/process/service.go:327", "backend/internal/application/process/service.go:974", "backend/internal/application/process/service.go:1162"]
---
# ต้นทุนสินค้าคิดแบบไหน ถัวเฉลี่ยเคลื่อนที่คำนวณยังไง

**ตอบสั้น:** ระบบคิดต้นทุนแบบถัวเฉลี่ยเคลื่อนที่ (Moving Average) กับสินค้าทุกตัว โดยไล่บรรทัดเคลื่อนไหวของสินค้าตามวันที่และเวลา รายการรับเข้าจะคำนวณต้นทุนเฉลี่ยใหม่จากมูลค่าสะสมหารจำนวนสะสม ส่วนรายการจ่ายออกจะตัดมูลค่าเท่ากับจำนวนคูณต้นทุนเฉลี่ย ณ ขณะนั้น ผลลัพธ์บันทึกไว้ที่ `ic_trans_detail.sum_of_cost`, `ic_trans_detail.average_cost` และ `ic_inventory.average_cost`

## รายละเอียด
ฟังก์ชันที่คำนวณคือ `CalculateMovingAverage` มันคำนวณด้วยเลขเศษส่วนแบบแม่นยำ (`big.Rat`) แล้วปัดแบบ HALF_UP ในแต่ละบรรทัด จำนวนทศนิยมมาจาก `erp_option.item_price_decimal` (ต้นทุนต่อหน่วย) และ `item_amount_decimal` (มูลค่า) ถ้าไม่ได้ตั้งไว้จะใช้ 2 ตำแหน่ง และรับค่าได้ 1–6 ตำแหน่ง

**จำนวนฐาน:** แต่ละบรรทัดแปลงเป็นหน่วยนับหลักก่อนด้วยสูตร `qty × stand_value ÷ divide_value` ถ้าค่าใดเป็น 0 หรือติดลบจะถือว่าเป็น 1 (ดู [[faq-unit-conversion]])

**ลำดับการไล่รายการ:** เรียงตามรหัสสินค้า แล้วตาม `doc_date_calc` (ถ้าไม่มีใช้ `doc_date`), ตาม `doc_time_calc`/`doc_time`, ตาม `calc_flag` จากมากไปน้อย (ถ้าวันเวลาเดียวกัน รายการรับจะมาก่อนรายการจ่าย และโอนเข้า 70 ถูกบังคับไปอยู่ท้ายสุด), แล้วตาม `trans_flag`, `doc_no` และ `line_number`

**รายการรับเข้า** (`calc_flag` บวก)
- มูลค่ารับเข้าคือ `sum_amount_exclude_vat` ถ้าเป็น 0 ใช้ `sum_amount` ถ้ายังเป็น 0 ใช้ `sum_of_cost` เดิม และถ้ายังไม่มีอีกใช้ `qty × price`
- ปรับปรุงเพิ่ม 66 ที่มีจำนวน และ `inquiry_type` ไม่ใช่ 1: เข้าที่ต้นทุนเฉลี่ยปัจจุบัน ไม่ใช้ราคาที่พิมพ์
- รับคืนจากการขาย 48: เข้าที่ต้นทุนเฉลี่ยปัจจุบัน (ถ้าต้นทุนเฉลี่ย >0) ไม่ใช้ราคาขาย เพื่อไม่ให้กำไรขั้นต้นปนเข้าไปในต้นทุน
- 58/60 ที่ไม่มีมูลค่า: เข้าที่ต้นทุนเฉลี่ยปัจจุบัน
- ถ้าจำนวนสะสมก่อนรับเข้า ≤0 ระบบเริ่มนับใหม่จากรายการรับนี้ ประวัติตอนติดลบจะถูกทิ้ง (ดู [[faq-negative-stock]])
- บรรทัดที่จำนวนเป็น 0 เช่น ต้นทุนแฝง ([[faq-hidden-cost-landed]]) จะเพิ่มเฉพาะมูลค่า แล้วคำนวณต้นทุนเฉลี่ยใหม่

**รายการจ่ายออก** (`calc_flag` ลบ)
- มูลค่าจ่ายออก = จำนวนฐาน × ต้นทุนเฉลี่ย ปัดตามจำนวนทศนิยมของมูลค่า
- ส่งคืนผู้จำหน่าย 16 ใช้ยอดเงินในเอกสารถ้ามีค่า
- 68/311 ที่จำนวนเป็น 0 ตัดเฉพาะมูลค่าตาม `sum_amount`
- 66 ที่จำนวนติดลบนับเป็นการจ่ายออก
- บรรทัดที่ล็อกต้นทุน (`is_lock_cost`) ใช้ `sum_of_cost_fix` ตามที่ระบุไว้
- หลังจ่ายออกแล้ว ถ้าจำนวนสะสม ≤0 มูลค่าสะสมจะถูกตั้งเป็น 0 แต่ต้นทุนเฉลี่ยยังเป็นค่าเดิม

**โอนย้าย 72/70:** ไม่เปลี่ยนต้นทุนเฉลี่ยของสินค้า ดู [[faq-stock-transfer-warehouse]]

ภาพรวมเชิงบัญชีอยู่ที่ [[acc-inventory-cost-moving-average]] และ [[flow-stock-movement-cost]]

## ข้อควรระวัง
- ช่อง "ประเภทต้นทุน" (`cost_type`) ในการ์ดสินค้าไม่มีผลต่อการคำนวณ ทุกตัวคิดแบบถัวเฉลี่ย (ดู [[faq-cost-type-fifo-lot]])
- เอกสารปรับปรุงเพิ่ม 66 ที่มีจำนวน: มูลค่าสต็อกคิดจากจำนวน × ต้นทุนเฉลี่ย แต่ GL มาตรฐานเดบิตสินค้าคงเหลือด้วยยอดรวมหัวเอกสาร ทั้งสองจึงอาจไม่เท่ากัน โค้ดเขียนไว้ว่าเป็นช่องว่างที่รอลุงจืดตัดสิน (`service.go:2153`)
- ขั้นเติม `sum_of_cost` ให้บรรทัด 58 ที่ไม่มีราคา ใช้ `ROUND(...,2)` ตายตัว ไม่ได้ใช้จำนวนทศนิยมจาก `erp_option` (`service.go:1052`)

## ดูเพิ่ม
- [[acc-inventory-cost-moving-average]]
- [[faq-why-stock-cost-changed]]
- [[faq-stock-rebuild]]
- [[faq-negative-stock]]
- [[faq-cost-type-fifo-lot]]
- [[std-inventory-costing-rules]]

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:189` `CalculateMovingAverage` คำนวณจำนวนฐาน รับเข้า และจ่ายออก
- `backend/internal/application/process/service.go:268` 66, 48 และ 58/60 เข้าที่ต้นทุนเฉลี่ย
- `backend/internal/application/process/service.go:286` จำนวนสะสม ≤0 ให้เริ่มนับใหม่จากรายการรับ
- `backend/internal/application/process/service.go:327` หลังจ่ายออกจนจำนวน ≤0 ตั้งมูลค่าสะสมเป็น 0
- `backend/internal/application/process/service.go:974` อ่าน `item_price_decimal` / `item_amount_decimal`
- `backend/internal/application/process/service.go:1162` ลำดับการไล่รายการเคลื่อนไหว
