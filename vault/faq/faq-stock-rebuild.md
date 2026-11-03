---
title: "คำนวณยอดสต๊อกใหม่ (Rebuild Stock) ทำอะไรบ้าง ต้องกดเมื่อไหร่"
tags: [faq, ic, stock, rebuild, cost]
aliases: ["คำนวณยอดสต๊อกใหม่", "rebuild stock", "recalc stock", "menu_ic_recalc", "RebuildStock", "ประมวลผลสต็อกใหม่", "balance_qty ไม่ตรง", "docno= process command"]
sources: ["frontend/src/config/bcMenu.json:2580", "backend/internal/application/process/service.go:559", "backend/internal/application/process/service.go:588", "backend/internal/application/process/service.go:630", "backend/internal/application/process/service.go:665", "backend/internal/application/process/service.go:1018", "backend/internal/application/process/stock_rebuild.go:86"]
---
# คำนวณยอดสต๊อกใหม่ (Rebuild Stock) ทำอะไรบ้าง ต้องกดเมื่อไหร่

**ตอบสั้น:** เมนู "คำนวณยอดสต๊อกใหม่" (`menu_ic_recalc`) คำนวณยอดคงเหลือและต้นทุนถัวเฉลี่ยใหม่ทั้งหมดจากบรรทัด `ic_trans_detail` ที่ยังไม่ถูกยกเลิก ตามปกติไม่ต้องกด เพราะการบันทึกหรือลบเอกสารแต่ละใบจะคำนวณสินค้าในเอกสารนั้นให้อยู่แล้ว ให้ใช้เมื่อยอดไม่ตรง หลังแก้หน่วยนับหรืออัตราส่วน หรือหลังนำเข้าหรือแก้ข้อมูลตรงในฐานข้อมูล

## รายละเอียด
เมนูนี้เรียก `RebuildStock` ซึ่งทำงานทั้งหมดใน transaction เดียว ถ้ามีข้อผิดพลาดใดเกิดขึ้น จะไม่มีอะไรถูกบันทึกเลย ขั้นตอนเป็นดังนี้
1. `backfillStockTransferInTx` สร้างหรือซิงก์บรรทัดรับโอน 70 ของใบโอน 72 ที่ยังขาดอยู่
2. `updateUnitRatioDetailTx` (ทำเสมอ เว้นแต่ส่งตัวเลือกปิดไว้): บันทึก `stand_value`/`divide_value` ที่เป็น 0 ให้เป็น 1, สินค้า `unit_type` 0/2 บังคับเป็น 1/1, สินค้า `unit_type` 1/3 ใช้อัตราจาก `ic_unit_use` ของหน่วยในบรรทัด
3. เลือกสินค้าที่จะคำนวณ ถ้าไม่ได้ระบุจะใช้ทุกตัวที่ไม่ใช่สินค้าบริการ (`item_type` 5)
4. `rebuildStockTx` คำนวณ `ic_inventory.balance_qty` / `balance_qty_2` ใหม่ และไล่ต้นทุนถัวเฉลี่ยใหม่ทุกบรรทัด (ดู [[faq-moving-average-cost]]) แล้วอัปเดต `ic_inventory.average_cost`

**กรองเฉพาะบางสินค้า** (Process Command)
- `docno=เลขที่เอกสาร` คำนวณเฉพาะสินค้าในเอกสารนั้น
- `รหัสเริ่ม:รหัสสิ้นสุด` คำนวณช่วงรหัส
- `รหัส1,รหัส2` คำนวณหลายรหัส หรือใส่รหัสเดียวก็ได้

**action อื่นในหน้าจอเดียวกัน:** `update_trans_detail`, `recheck_trans_flow`, `check_so_doc_success` (ปิดใบสั่งขาย 36 ที่ส่งครบแล้ว) และ `recheck_doc_flow` ทั้ง 4 action นี้ทำงานแยก ไม่ได้คำนวณสต็อก

**บรรทัดที่นับเข้าสต็อก:** `last_status` = 0, ไม่ใช่สำเนาเอกสาร, `item_type` 0/4/6 และ `trans_flag` อยู่ในชุดเคลื่อนไหวสต็อก รายละเอียดอยู่ที่ [[acc-inventory-stock-rebuild]] และ [[term-stock-balance]]

## ข้อควรระวัง
- การคำนวณผ่านเมนูนี้มีเวลาจำกัด 60 วินาที (`context.WithTimeout`) ถ้าข้อมูลมากจนเกินเวลา ทุกอย่างจะ rollback ให้แบ่งรันเป็นช่วงรหัสแทน
- เมนูนี้ไม่ได้สร้าง GL ใหม่ ถ้าต้นทุนของเอกสารสต็อกเปลี่ยน ต้องรัน "ประมวลผล GL ใหม่" ต่อ (ดู [[faq-gl-rebuild-when]])
- ขั้นปรับอัตราส่วนหน่วยจะเขียนทับ `stand_value`/`divide_value` ในบรรทัดเอกสารเก่าให้ตรงกับ `ic_unit_use` ปัจจุบัน ถ้าเพิ่งแก้อัตราส่วนหน่วยในการ์ดสินค้า ยอดและต้นทุนย้อนหลังจะเปลี่ยนตามทั้งหมด

## ดูเพิ่ม
- [[acc-inventory-stock-rebuild]]
- [[proc-stock-tools]]
- [[faq-why-stock-cost-changed]]
- [[faq-balance-mismatch-troubleshoot]]
- [[faq-unit-conversion]]

## ที่มาในโค้ด
- `frontend/src/config/bcMenu.json:2580` เมนู `menu_ic_recalc` "คำนวณยอดสต๊อกใหม่"
- `backend/internal/application/process/service.go:559` `RebuildStock` ทำงานใน transaction เดียว timeout 60 วินาที
- `backend/internal/application/process/service.go:588` `rebuildStockWithOptionsTx` แยก action และลำดับขั้นตอน
- `backend/internal/application/process/service.go:630` `updateUnitRatioDetailTx` ปรับอัตราส่วนหน่วย
- `backend/internal/application/process/service.go:665` รูปแบบ Process Command (`docno=`, `:`, `,`)
- `backend/internal/application/process/service.go:1018` `rebuildStockTx`
- `backend/internal/application/process/stock_rebuild.go:86` `backfillStockTransferInTx`
