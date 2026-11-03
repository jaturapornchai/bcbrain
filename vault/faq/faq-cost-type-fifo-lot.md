---
title: "ตั้งประเภทต้นทุนเป็น FIFO / LOT / มาตรฐาน ได้ไหม ระบบคิดตามที่ตั้งหรือเปล่า"
tags: [faq, ic, stock, cost, cost-type, lot]
aliases: ["ประเภทต้นทุน", "cost_type", "FIFO", "ต้นทุน LOT FIFO", "ต้นทุน LOT กำหนดเอง", "FEFO", "ต้นทุนมาตรฐาน", "ic_standard_cost", "CalculateFIFOCost"]
sources: ["frontend/account/master/ItemScreen.tsx:2446", "backend/internal/application/process/service.go:1187", "backend/internal/application/process/service.go:355", "backend/internal/application/process/stock_speed_bench_test.go:23", "backend/internal/application/process/trans_save_rules.go:180", "backend/internal/application/process/trans_lot_auto.go:32", "backend/internal/application/process/item_master.go:755"]
---
# ตั้งประเภทต้นทุนเป็น FIFO / LOT / มาตรฐาน ได้ไหม ระบบคิดตามที่ตั้งหรือเปล่า

**ตอบสั้น:** ในการ์ดสินค้าเลือกประเภทต้นทุน (`ic_inventory.cost_type`) ได้ 6 แบบ แต่ตอนคำนวณต้นทุน ระบบใช้ถัวเฉลี่ยเคลื่อนที่กับทุกสินค้า ค่า `cost_type` มีผลกับเรื่องเดียวคือ ถ้าตั้งเป็น "ต้นทุน LOT กำหนดเอง" (2) ทุกบรรทัดต้องมีเลข LOT

## รายละเอียด
**ตัวเลือกในการ์ดสินค้า** (ค่าที่เก็บ → ข้อความบนจอ)
- 0 → "1.ต้นทุนเฉลี่ย"
- 1 → "2.ต้นทุน LOT FIFO"
- 2 → "3.ต้นทุน LOT กำหนดเอง"
- 3 → "4.ต้นทุน FEFO (วันหมดอายุ)"
- 4 → "5.ต้นทุนมาตรฐาน"
- 5 → "6.ต้นทุนแบบพิเศษ 1"

**สิ่งที่ระบบทำจริง**
- `rebuildStockTx` เรียก `CalculateMovingAverage` กับทุกสินค้าโดยไม่ได้ดู `cost_type` (ดู [[faq-moving-average-cost]])
- ในโค้ดมีฟังก์ชัน `CalculateFIFOCost` (FIFO แบบชั้นต้นทุน) อยู่ แต่มีที่เรียกใช้แค่ในไฟล์ทดสอบความเร็ว (`stock_speed_bench_test.go`) ไม่ได้ใช้ตอนบันทึกเอกสารหรือคำนวณสต็อกใหม่
- ตารางต้นทุนมาตรฐาน `ic_standard_cost` บันทึกได้จากการ์ดสินค้า แต่ไม่ได้ใช้ในการคำนวณต้นทุน
- `cost_type` = 2 (LOT กำหนดเอง): เอกสารในชุดที่ตรวจ lot ถ้ามีบรรทัดที่ไม่ระบุ LOT จะบันทึกไม่ได้ และขึ้นข้อความ "รหัสสินค้า ... ยังไม่บันทึกหมายเลข LOT แบบกำหนดเอง"
- ขาย 44 ที่เป็นเอกสารใหม่: ถ้าสินค้าเป็น `cost_type` 2 และยังไม่ระบุ LOT ระบบเลือก LOT ให้อัตโนมัติ โดยเรียงตามเลข LOT จากคลังและที่เก็บของบรรทัด ถ้า LOT แรกมีไม่พอ ระบบจะแตกบรรทัดไปใช้ LOT ถัดไป (ดู [[faq-serial-lot-expire]])
- รายงานข้อมูลสินค้าแสดงชื่อประเภทต้นทุนตามค่าที่เก็บไว้

## ข้อควรระวัง
- ถ้าบริษัทต้องรายงานต้นทุนแบบ FIFO หรือราคามาตรฐาน ตัวเลขในระบบนี้ยังเป็นถัวเฉลี่ย การตั้ง `cost_type` ไม่ได้เปลี่ยนตัวเลข
- โน้ต [[std-inventory-costing-rules]] ใช้ตัวเลข `cost_type` ตามระบบ KMS เดิม ซึ่งไม่ตรงกับตัวเลือกในโค้ดปัจจุบันด้านบน ให้ยึดตามโค้ด (ดู [[term-cost-type]])
- การเลือก LOT อัตโนมัติไม่ได้เรียงตามวันหมดอายุ (FEFO) แต่เรียงตามเลข LOT

## ดูเพิ่ม
- [[term-cost-type]]
- [[faq-moving-average-cost]]
- [[faq-serial-lot-expire]]
- [[scr-item-master]]
- [[tbl-ic-standard-cost]]

## ที่มาในโค้ด
- `frontend/account/master/ItemScreen.tsx:2446` ตัวเลือก `cost_type` 0–5
- `backend/internal/application/process/service.go:1187` ทุกสินค้าคำนวณด้วย `CalculateMovingAverage`
- `backend/internal/application/process/service.go:355` `CalculateFIFOCost` (ไม่มีที่เรียกใช้ใน production)
- `backend/internal/application/process/stock_speed_bench_test.go:23` ที่เรียกใช้ FIFO มีแค่ในการทดสอบ
- `backend/internal/application/process/trans_save_rules.go:180` `lotMessage` บังคับ LOT ของ `cost_type` 2
- `backend/internal/application/process/trans_lot_auto.go:32` `autoLots` เลือก LOT ให้ขาย 44 ใหม่
- `backend/internal/application/process/item_master.go:755` บันทึก `ic_standard_cost` จากการ์ดสินค้า
