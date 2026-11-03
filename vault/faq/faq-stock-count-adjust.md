---
title: "ตรวจนับสต็อกแล้วปรับยอดยังไง (ตรวจนับ 76 → ปรับปรุงเพิ่ม 66 / ลด 68)"
tags: [faq, ic, stock, stock-count, adjust]
aliases: ["ตรวจนับสินค้า", "ปรับปรุงสต็อก", "stock count adjust", "trans_flag 76", "trans_flag 66", "trans_flag 68", "menu_ic_stk_count", "menu_ic_stk_adjust_lot_auto", "ปรับปรุงสต็อกอัตโนมัติ", "LotAutoRun"]
sources: ["frontend/account/tabs/transMenuMap.ts:1133", "frontend/account/tabs/transMenuMap.ts:1149", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/trans_grid.go:484", "backend/internal/application/process/service.go:268", "backend/internal/application/process/stock_lot.go:617", "backend/internal/application/process/stock_lot.go:215", "frontend/account/tabs/screenRegistry.tsx:470"]
---
# ตรวจนับสต็อกแล้วปรับยอดยังไง (ตรวจนับ 76 → ปรับปรุงเพิ่ม 66 / ลด 68)

**ตอบสั้น:** เอกสาร "ตรวจนับสินค้า" (76) บันทึกเฉพาะจำนวนที่นับได้ ยังไม่เปลี่ยนสต็อก ต้องออกเอกสาร "ปรับปรุงสต็อก (เพิ่ม)" 66 หรือ "(ลด)" 68 ถึงจะเปลี่ยนยอด ทำได้ 2 ทาง คือคีย์เอง (66 ดึงรายการจาก 76 ได้) หรือใช้เมนู "ปรับปรุงสต็อกสินค้า/วัตถุดิบอัตโนมัติ" (ไม่แยก lot) หรือ "... อัตโนมัติ (สินค้า Lot)" ให้ระบบหาผลต่างแล้วสร้าง 66/68 ให้ ทั้งสองเอกสารคิดมูลค่าที่ต้นทุนถัวเฉลี่ย

## รายละเอียด
**ขั้นตอนตามเมนู**
1. "ขอตรวจนับสินค้า" (`menu_ic_request_stk_count`, 276) ทำหรือไม่ทำก็ได้
2. "ตรวจนับสินค้า" (`menu_ic_stk_count`, 76) ดึงรายการจาก 276/128 ได้ ราคาในกริดแสดงเป็น `ic_inventory.average_cost` (ถ้าไม่ได้ตั้ง option ให้แสดงราคาขาย) เอกสาร 76 ไม่อยู่ในชุด `trans_flag` ที่นับเป็นสต็อก จึงไม่เปลี่ยนยอด
3. "ปรับปรุงสต็อกสินค้า/วัตถุดิบ (เพิ่ม)" (`menu_ic_stk_adjust`, 66) ดึงจาก 76 ได้ และ "(ลด)" (`menu_ic_stk_adjust_subtract`, 68)

**มูลค่าของเอกสารปรับปรุง** (ดู [[faq-moving-average-cost]])
- 66 ที่มีจำนวนและ `inquiry_type` ไม่ใช่ 1: รับเข้าที่ต้นทุนเฉลี่ยปัจจุบัน ไม่ใช่ราคาที่พิมพ์
- 66 ที่จำนวนติดลบ: นับเป็นการจ่ายออก
- 68: จ่ายออกที่ต้นทุนเฉลี่ย ถ้าจำนวนเป็น 0 จะตัดเฉพาะมูลค่าตาม `sum_amount`

**ปรับอัตโนมัติจากเอกสารตรวจนับ** (`LotAutoRun`)
- เลือกเอกสาร 76 ได้หลายใบ ระบบรวมจำนวนที่นับต่อ (สินค้า, คลัง, ที่เก็บ, lot) เทียบกับยอดในระบบ ณ วันที่ของเอกสารตรวจนับใบล่าสุด
- นับได้มากกว่ายอด → 66, นับได้น้อยกว่า → 68 (เลขที่ลงท้าย "-N"), lot ที่ไม่มีในระบบ → เพิ่มเท่าจำนวนที่นับ
- ยอดในระบบของสินค้า คลัง และที่เก็บที่นับไว้ แต่ไม่มีใครนับ lot นั้น → ปรับลดเป็น 0
- เอกสาร 76 ที่มีเอกสารปรับปรุงที่ยังใช้งานอยู่แล้วจะถูกปฏิเสธ ป้องกันการปรับซ้ำ
- เมนู `menu_ic_stk_adjust_auto` ใช้ฟังก์ชันเดียวกันแต่ส่ง `ignoreLot` จึงเทียบเฉพาะต่อสินค้า คลัง และที่เก็บ ส่วน `menu_ic_stk_adjust_lot_auto` แยกตาม lot
- `StockNotCountedRun` สร้าง 66/68 เพื่อปรับยอดสินค้าที่ไม่อยู่ในเอกสารนับให้เป็น 0 และเมนู "ปรับปรุงมูลค่าสินค้า Lot คงค้าง" (`LotAmountSave`) สำหรับล้างมูลค่าของ lot ที่จำนวนเป็น 0 แล้ว

**GL:** GL มาตรฐานของ 66 คือ Dr สินค้าคงเหลือ / Cr 5110 ส่วน 68 กลับด้าน (ดู [[acc-stock-special-docs]])

## ข้อควรระวัง
- เอกสารที่เครื่องมือปรับอัตโนมัติสร้างขึ้น เรียก `saveTransTx` โดยตรง จึงไม่ผ่านการตรวจงวดบัญชีและการตรวจห้ามติดลบ
- ยอดราย lot ในเครื่องมือนี้อ่านจาก `ic_trans_detail_lot` แต่การบันทึกเอกสารปกติผ่านเว็บไม่ได้เขียนตารางนี้ (เขียนเฉพาะยอดยกมา 54 และเอกสารที่เครื่องมือนี้สร้าง) ยอดของ lot จากเอกสารซื้อจึงไปตกอยู่ในแถว "ไม่มี lot" และผลต่างราย lot อาจผิด แม้ผลรวมต่อที่เก็บจะถูก ถ้าไม่ต้องการแยกตาม lot ให้ใช้เมนูแบบไม่แยก lot
- ยอดราย lot จาก `ic_trans_detail_lot` รวมด้วย `qty` ตรงๆ ไม่ได้คูณอัตราส่วนหน่วย ขณะที่ยอดต่อที่เก็บคูณอัตราส่วนแล้ว ถ้าหน่วยมีอัตราส่วนไม่เท่ากับ 1 ผลจะเพี้ยน
- GL ของ 66 ใช้ยอดหัวเอกสาร ขณะที่มูลค่าสต็อกใช้ต้นทุนเฉลี่ย ทั้งสองจึงอาจไม่เท่ากัน (`service.go:2153`)

## ดูเพิ่ม
- [[doc-stock-count]]
- [[doc-stock-adjust-increase]]
- [[doc-stock-adjust-decrease]]
- [[scr-lot-adjust]]
- [[faq-serial-lot-expire]]
- [[faq-negative-stock]]

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1133` เมนูตรวจนับ 76
- `frontend/account/tabs/transMenuMap.ts:1149` เมนูปรับปรุงเพิ่ม 66 ดึงจาก 76 (ลด 68 อยู่ที่ `:1163`)
- `backend/internal/application/process/stock_rebuild.go:18` ชุด flag ที่นับเป็นสต็อก (ไม่มี 76)
- `backend/internal/application/process/trans_grid.go:484` กริดตรวจนับแสดงต้นทุนเฉลี่ย
- `backend/internal/application/process/service.go:268` 66 ที่มีจำนวนรับเข้าที่ต้นทุนเฉลี่ย
- `backend/internal/application/process/stock_lot.go:617` `LotAutoRun` ปฏิเสธเอกสารที่ปรับแล้ว
- `backend/internal/application/process/stock_lot.go:215` บันทึกผ่าน `saveTransTx` โดยตรง
- `frontend/account/tabs/screenRegistry.tsx:470` เมนูแบบไม่แยก lot ส่ง `mode="normal"` (`ignoreLot`)
