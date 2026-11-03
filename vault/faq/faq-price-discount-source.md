---
title: "ราคาขาย/ส่วนลดที่ขึ้นอัตโนมัติในเอกสาร ดึงมาจากไหน"
tags: [faq, price, discount, sale, purchase]
aliases: ["ราคาขายดึงจากไหน", "ส่วนลดอัตโนมัติ", "price lookup", "ic_inventory_price", "ic_inventory_discount", "ic_inventory_purchase_price", "ราคาตามลูกค้า", "price_level", "get_last_price_type", "findSalePrice"]
sources: ["backend/internal/application/process/price_engine.go:49", "backend/internal/application/process/price_engine.go:67", "backend/internal/application/process/price_engine.go:79", "backend/internal/application/process/price_engine.go:103", "backend/internal/application/process/price_engine.go:237", "backend/internal/application/process/trans_grid.go:96", "backend/internal/application/process/trans_grid.go:490", "backend/internal/application/process/price_center.go:18"]
---
# ราคาขาย/ส่วนลดที่ขึ้นอัตโนมัติในเอกสาร ดึงมาจากไหน

**ตอบสั้น:** เมื่อกรอกจำนวนในบรรทัดของเอกสารขาย ระบบหาราคาตามลำดับนี้ ใช้แหล่งแรกที่เจอ: ราคาเฉพาะลูกค้า → ราคาตามกลุ่มลูกค้า → ราคาทั่วไป (ราคาโปรโมชั่น `price_mode` 1 ก่อนราคามาตรฐาน 0) → สูตรราคาตามระดับราคาของลูกค้า → ราคาที่ผูกกับบาร์โค้ด → ราคาขายครั้งล่าสุดหรือราคาเฉลี่ยที่เคยขายให้ลูกค้ารายนี้ ส่วนลดหาแยก: ส่วนลดเฉพาะลูกค้า → ส่วนลดตามกลุ่ม → ส่วนลดทั่วไป

## รายละเอียด
**เมื่อไหร่ที่ระบบหาราคา:** เอกสาร 30, 34, 36, 44, 46, 48, 76, 144 เมื่อแก้จำนวน (ไม่เท่ากับ 0) และบรรทัดนั้นไม่ได้ดึงมาจากเอกสารอ้างอิง (บรรทัดที่ดึงมาใช้ราคาจากเอกสารต้นทาง) และไม่ใช่ของแถม ส่วนเอกสารตรวจนับ 76 แสดงต้นทุนเฉลี่ยแทนราคาขาย (ดู [[faq-stock-count-adjust]])

**ตารางราคาขาย `ic_inventory_price`** ทุกขั้นกรองด้วยรหัสสินค้า หน่วยนับ ช่วงวันที่ (`from_date`–`to_date`) ช่วงจำนวน (`from_qty`–`to_qty`) ประเภทการขาย (`sale_type` 0 = ทุกแบบ หรือตรงกับเงินสด/เชื่อ) และสกุลเงินเมื่อเปิดหลายสกุลเงิน
1. `price_type` 3 + `cust_code` = ลูกค้า
2. `price_type` 2 + กลุ่มลูกค้า (`cust_group_1` = กลุ่มหลัก `group_main` และ `cust_group_2` = กลุ่มย่อย `group_sub_1`–`group_sub_4` หรือว่าง ของ `ar_customer_detail`)
3. `price_type` 1 + `price_mode` 1
4. `price_type` 1 + `price_mode` 0
- ถ้าเอกสารเป็นภาษีแยกนอก (`vat_type` 0) ใช้ `sale_price1` แบบอื่นใช้ `sale_price2`

**ถ้าไม่เจอในตารางราคา**
5. สูตรราคา `ic_inventory_price_formula`: ใช้ช่องราคาตาม `ar_customer.price_level` 1–9 ถ้าระดับเป็น 0 ใช้ราคาช่องแรก
6. ราคาบาร์โค้ด `ic_inventory_barcode.price` (เมื่อบรรทัดมีบาร์โค้ด)
7. ตาม `erp_option.get_last_price_type`: 1 = ราคาขาย 44 ครั้งล่าสุดให้ลูกค้ารายนี้, 2 = ค่าเฉลี่ยของราคาที่เคยขาย (ถ้าเอกสารเป็นภาษีรวมใน ระบบบวก VAT ให้)

**ส่วนลด `ic_inventory_discount`:** `discount_type` 2 (ลูกค้า) → 1 (กลุ่ม) → 0 (ทั่วไป) ค่าที่เจอเป็นข้อความส่วนลด เช่น `5%` แล้วใส่ลงช่องส่วนลดของบรรทัด

**ราคาซื้อ** (12, 310, 2, 6 เมื่อเปิด `get_purchase_price`): `ic_inventory_purchase_price` ของผู้จำหน่าย (`price_type` 3) → ราคาทั่วไป (`price_type` 1) → ราคาซื้อ 12/315 ครั้งล่าสุดจากผู้จำหน่ายรายนี้ ถ้าไม่เจอจะใช้ราคาที่พิมพ์ไว้

**Price center:** ถ้าเปิด `erp_option.use_price_center` ราคาขายทั้งหมดจะมาจากบริการรายการราคาภายนอกแทนตารางในฐานข้อมูล

## ข้อควรระวัง
- ราคาซื้อหาโดยใช้ "วันนี้" ไม่ใช่วันที่เอกสาร (ตาม C# เดิม) ราคาที่ตั้งเป็นช่วงวันที่จึงอาจไม่ตรงกับเอกสารที่ลงวันที่ย้อนหลัง
- ราคาเฉลี่ยแบบ `get_last_price_type` 2 เป็นค่าเฉลี่ยธรรมดาของราคาต่อหน่วยทุกบรรทัด ไม่ได้ถ่วงน้ำหนักด้วยจำนวน
- ราคาสำหรับ POS (`_findPricePOS`) ยังไม่ได้พอร์ต (คอมเมนต์ใน `price_center.go`)

## ดูเพิ่ม
- [[proc-price-engine]]
- [[term-price-discount]]
- [[tbl-ic-inventory-price]]
- [[scr-modify-price]]
- [[faq-vat-exclude-include-calc]]

## ที่มาในโค้ด
- `backend/internal/application/process/price_engine.go:49` `priceCond` กรองวันที่ จำนวน และประเภทการขาย
- `backend/internal/application/process/price_engine.go:67` `salePriceSteps` ลำดับ ลูกค้า → กลุ่ม → ทั่วไป
- `backend/internal/application/process/price_engine.go:79` `saleDiscountSteps` ลำดับส่วนลด
- `backend/internal/application/process/price_engine.go:103` `findSalePrice` ราคา1/ราคา2 สูตร บาร์โค้ด และราคาล่าสุด/เฉลี่ย
- `backend/internal/application/process/price_engine.go:237` `findPurchasePrice` ใช้วันที่วันนี้
- `backend/internal/application/process/trans_grid.go:96` `salePriceFlags` / `purchasePriceFlags`
- `backend/internal/application/process/trans_grid.go:490` หาราคาเมื่อแก้จำนวนและไม่มีเอกสารอ้างอิง
- `backend/internal/application/process/price_center.go:18` `use_price_center` และ POS ที่ยังไม่พอร์ต
