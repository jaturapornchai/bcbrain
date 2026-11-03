---
title: "ทำไมต้นทุนของเอกสารเก่าเปลี่ยนเอง ทั้งที่ไม่ได้แก้เอกสารนั้น"
tags: [faq, ic, stock, cost, moving-average, troubleshoot]
aliases: ["ต้นทุนขายเปลี่ยนเอง", "ต้นทุนเฉลี่ยเปลี่ยน", "why did cost change", "sum_of_cost เปลี่ยน", "บันทึกซื้อย้อนหลังแล้วต้นทุนขายเปลี่ยน", "rebuildTransDerived", "rebuildStockTx", "average_cost เปลี่ยน"]
sources: ["backend/internal/application/process/trans.go:593", "backend/internal/application/process/service.go:1018", "backend/internal/application/process/service.go:1173", "backend/internal/application/process/service.go:286", "backend/internal/application/process/service.go:1470", "backend/internal/application/process/service.go:1289"]
---
# ทำไมต้นทุนของเอกสารเก่าเปลี่ยนเอง ทั้งที่ไม่ได้แก้เอกสารนั้น

**ตอบสั้น:** ต้นทุนในบรรทัดเอกสารเป็นค่าที่ระบบคำนวณขึ้นใหม่ได้ตลอด ไม่ใช่ค่าที่ล็อกตายตัว ทุกครั้งที่บันทึก แก้ ลบ หรือยกเลิกเอกสารของสินค้าตัวใด ระบบจะไล่คำนวณต้นทุนถัวเฉลี่ยของสินค้าตัวนั้นใหม่ตั้งแต่รายการแรก ดังนั้นเอกสารที่ลงวันที่ย้อนหลังจะเปลี่ยน `sum_of_cost` / `average_cost` ของเอกสารที่ลงวันที่หลังจากนั้นทั้งหมด

## รายละเอียด
ทุกครั้งที่บันทึกหรือลบเอกสาร ระบบจะเรียก `rebuildTransDerived` ซึ่งทำงานตามลำดับนี้
1. `rebuildStockTx` คำนวณสต็อกใหม่เฉพาะรหัสสินค้าที่อยู่ในเอกสาร (ทั้งรายการเดิมและรายการใหม่) โดยไล่บรรทัดเคลื่อนไหวทั้งหมดของสินค้านั้นตั้งแต่ต้น แล้วเขียน `sum_of_cost`, `average_cost` ทับลงทุกบรรทัดที่ค่าเปลี่ยน รวมถึงบรรทัดของเอกสารอื่น และอัปเดต `ic_inventory.average_cost`
2. `rebuildGLTx` สร้าง GL ใหม่ **เฉพาะเอกสารที่บันทึก**
3. ถ้าเป็นใบโอน 72 จะซิงก์หัวเอกสารรับโอน 70 ด้วย

**กรณีที่ทำให้ต้นทุนเปลี่ยนบ่อย**
- บันทึกซื้อหรือรับเข้าย้อนวันที่ ต้นทุนเฉลี่ยของรายการขายหรือเบิกที่อยู่หลังวันนั้นจะเปลี่ยน
- แก้วันที่หรือเวลาเอกสาร ลำดับการไล่เปลี่ยนตามวันที่ เวลา และ `calc_flag` (ดู [[faq-moving-average-cost]])
- สต็อกเคยติดลบ เมื่อมีรายการรับเข้าระบบจะเริ่มนับใหม่จากรายการรับนั้น ถ้าเอกสารที่ทำให้ติดลบย้ายตำแหน่งไป ผลจึงต่างไปมาก (ดู [[faq-negative-stock]])
- ยกเลิกเอกสาร (`last_status` = 1) เอกสารนั้นจะหลุดออกจากการคำนวณ
- แก้หน่วยนับ หรือแก้อัตราส่วน `stand_value`/`divide_value` แล้วรันคำนวณสต็อกใหม่ (ดู [[faq-unit-conversion]])
- บันทึกต้นทุนแฝง (เอกสาร 66 ที่จำนวนเป็น 0) มูลค่าจะถูกเพิ่มเข้าในวันที่ของเอกสารนั้น (ดู [[faq-hidden-cost-landed]])

ถ้าต้องการให้บรรทัดใดไม่เปลี่ยนเลย ระบบมีกลไก "ล็อกต้นทุน" ที่ใช้ค่า `sum_of_cost_fix` แทนการคำนวณ

## ข้อควรระวัง
- เมื่อต้นทุนของเอกสารอื่นเปลี่ยน GL ของเอกสารเหล่านั้นไม่ได้ถูกสร้างใหม่ตาม ตัวอย่างเช่น เอกสารสต็อก 56/58/60/66/68 ที่หัวเอกสารมี `total_amount` = 0 GL จะใช้ผลรวม `sum_of_cost` ของบรรทัด ณ เวลาที่สร้าง GL ครั้งล่าสุด ต้องรัน "ประมวลผล GL ใหม่" เพื่อให้ GL ตรงกับต้นทุนชุดใหม่ (ดู [[faq-gl-rebuild-when]])
- ใบขาย 44 ตาม GL มาตรฐานไม่ได้ลงต้นทุนขาย (ดู [[faq-sale-invoice-gl-posting]]) ต้นทุนขายที่เปลี่ยนจึงเห็นในรายงานสต็อก ไม่ใช่ใน GL ของใบขาย

## ดูเพิ่ม
- [[faq-moving-average-cost]]
- [[faq-stock-rebuild]]
- [[faq-balance-mismatch-troubleshoot]]
- [[acc-inventory-stock-rebuild]]
- [[hist-lessons-stock-cost-moving-average]]

## ที่มาในโค้ด
- `backend/internal/application/process/trans.go:593` `rebuildTransDerived` คำนวณสต็อกใหม่ แล้วสร้าง GL ของเอกสารนี้ใหม่
- `backend/internal/application/process/service.go:1018` `rebuildStockTx` คำนวณใหม่ต่อรหัสสินค้า
- `backend/internal/application/process/service.go:1173` ลำดับวันที่ เวลา และ `calc_flag` ที่ใช้ไล่รายการ
- `backend/internal/application/process/service.go:286` เริ่มนับใหม่เมื่อจำนวนสะสม ≤0
- `backend/internal/application/process/service.go:1470` GL เอกสารสต็อกใช้ผลรวม `sum_of_cost` เมื่อ `total_amount` = 0
- `backend/internal/application/process/service.go:1289` อัปเดต `ic_inventory.average_cost`
