---
title: กลไกคำนวณราคา 7 ลำดับ สูตรส่วนลด การปัดเศษ การดึงเอกสารอ้างอิง และการกระทบยอด Subledger
tags: [doctypes, pricing, discount, rounding, ref-import, subledger-reconcile, big-rat]
aliases: [findSalePrice, bcCalcAfterDiscount, bcRound, TransRefImport, ReconcileSubledger, ลำดับราคาขาย 7 ขั้น]
sources:
  - backend/internal/application/process/price_engine.go:1-287
  - backend/internal/application/process/price_center.go:1-239
  - backend/internal/application/process/modify_price.go:1-407
  - backend/internal/application/process/barcode_discount.go:1-358
  - backend/internal/application/process/grid_calc.go:1-310
  - backend/internal/application/process/grid_shortcut.go:1-289
  - backend/internal/application/process/trans_ref_import.go:1-63
  - backend/internal/application/process/trans_ref_import_lines.go:1-695
  - backend/internal/application/process/subledger_reconcile.go:1-492
---

# กลไกคำนวณราคา 7 ลำดับ สูตรส่วนลด การปัดเศษ การดึงเอกสารอ้างอิง และการกระทบยอด Subledger

เอกสารนี้สรุปกฎคำนวณเชิงลึกใน `backend/internal/application/process/` ซึ่งใช้ `*math/big.Rat` ทั้งหมดเพื่อความแม่นยำระดับสตางค์และทศนิยมตาม `erp_option`

---

## 1. ลำดับการค้นหาราคาขาย (`findSalePrice` ใน `price_engine.go`)

เมื่อคำนวณบรรทัดสินค้า ระบบตรวจสอบตามลำดับดังนี้:
1. **Remote Price Center (`price_center.go`)**: หาก `erp_option.use_price_center = 1` เรียก `/BCPriceCenter/pricelistservice/price` (หรือ fallback `/BCJavaRESTService/service/pricelist/price`) ภายใต้ SSRF dial guard และงบเวลา 30 วินาที (`Type=99, Mode=99`)
2. **ราคาเฉพาะลูกค้า (`ic_inventory_price`, `price_type = 3`)**: กรอง `ic_code`, `unit_code`, `cust_code`, ช่วงวันที่ `from_date..to_date`, ช่วงจำนวน `from_qty..to_qty`, `sale_type` และสกุลเงิน
3. **ราคาตามกลุ่มลูกค้า (`price_type = 2`)**: เทียบ `cust_group_1 = ar_customer_detail.group_main` และ `cust_group_2 IN (group_sub_1..4, '')`
4. **ราคาขายทั่วไป (`price_type = 1, price_mode = 1`)** และ **ราคาขายมาตรฐาน (`price_type = 1, price_mode = 0`)** — เลือก `sale_price1` เมื่อ `vat_type == 0` (แยกนอก) มิฉะนั้นใช้ `sale_price2`
5. **ตารางสูตรราคา (`ic_inventory_price_formula`)**: ดึง `price_0..price_9` ตาม `ar_customer.price_level` (`Type=6, Mode=6`)
6. **ราคาประจำบาร์โค้ด (`ic_inventory_barcode.price`)** (`Type=5, Mode=5`)
7. **ราคาขายล่าสุด/เฉลี่ยจาก `ic_trans_detail` (`trans_flag = 44`)**: ตาม `erp_option.get_last_price_type` (`1`=ล่าสุด, `2`=เฉลี่ย; แปลงบวก VAT อัตโนมัติหากบิลเป็นรวมใน `vat_type = 1`)

ส่วน **ส่วนลด (`saleDiscountSteps`)** ค้นใน `ic_inventory_discount` เรียง `discount_type = 2` (ลูกค้า) → `1` (กลุ่ม) → `0` (ทั่วไป) และส่วนลดบาร์โค้ด (`ic_inventory_barcode_price`, `discount_type` 1..5)

---

## 2. กฎการปัดเศษ สูตรส่วนลดซ้อน และนิพจน์คำนวณ (`grid_calc.go`, `grid_shortcut.go`)

- **`bcRound`**:
  - `round_type == 1`: ปัดครึ่งขึ้นมาตรฐาน `RoundHalfUp(v + 1e-6, digits)`
  - `round_type == 0`: ปัดไล่ทีละหลักจากทศนิยมหลักสุดท้ายย้อนลงมาจนถึง `digits` (ตรงตามพฤติกรรม C# เดิม 100%)
- **`bcCalcAfterDiscount`**: แยกโทเคนด้วยลูกน้ำ (`,`): `@x` = ลดชิ้นละ `x * qty`, `x%` = ลดตามเปอร์เซ็นต์ของยอดคงเหลือสะสม (`+x%` บวกเพิ่ม), ตัวเลขล้วน = ลดเป็นจำนวนเงินบาท (หรือใส่ `+` นำหน้าเช่น `+x` เพื่อบวกเพิ่มเป็นจำนวนเงินบาทตาม `grid_calc.go:212-218`); หาก `calc_item_price_discount = 1` จะหักส่วนลดที่ราคาต่อหน่วย (`PriceDec`) ก่อนคูณจำนวน
- **`grid_shortcut.go`**:
  - พิมพ์ `ยอดรวม/ตัวหาร` (`splitAmountOver`): คำนวณ `price = bcRound(amount / divisor, PriceDec)` แล้วนำเศษส่วนต่าง `gap = qty*price - amount` ไปใส่ช่อง `Discount` อัตโนมัติเพื่อให้ยอดสุทธิเท่ากับ `amount` เป๊ะ
  - พิมพ์ `=นิพจน์` (`evalDiscountExpr`): Recursive-descent `*big.Rat` parser รองรับ `+ - * / x ( )` และการคูณแฝง `5(2+3)`

---

## 3. คู่เอกสารอ้างอิง (`trans_ref_import.go`) และการกระทบยอด Subledger (`subledger_reconcile.go`)

- **คู่ `[targetFlag, refFlag]` ที่รองรับการดึงยอดค้าง**: `{6,4}`, `{6,2}`, `{315,310}`, `{56,122}`, `{58,56}`, `{72,124}`, `{34,30}`, `{36,30}`, `{36,34}`, `{12,6}`, `{310,6}`, `{44,30}`, `{44,34}`, `{44,36}` และคู่รับคืน/ส่งคืน `{311,310}`, `{16,12}`, `{48,44}` (ถอดส่วนลดย้อนกลับผ่าน `calcDiscountReverse` และตรวจ `checkQtyOverDocRef` ในหน่วยฐาน `qty * stand / divide`)
- **`ReconcileSubledger` (`evaluateSubledgerTieRows`)**: เทียบยอดบัญชีย่อย ณ `asOfDate` ด้วย `*big.Rat` กับบัญชีแยกประเภท 5 หมวด:
  1. `AR` ↔ ผังบัญชี `1121%`
  2. `AP` ↔ ผังบัญชี `2111%`
  3. `IC` (`ic_trans_detail` มูลค่าคงเหลือ) ↔ ผังบัญชี `1131%`–`1134%`
  4. `FA_COST` (`as_asset_detail.as_buy_price` หักจำหน่าย `trans_flag=1802`) ↔ ผังบัญชี `1211%`–`1215%`
  5. `FA_ACCUM_DEPR` (`as_sum_value_balance + SUM(trans_flag=1801)`) ↔ ผังบัญชี `1219%`
  - เกณฑ์สถานะ: `|diff| <= 0.01` → `MATCHED`, `0.01 < |diff| <= 1.00` → `WARNING`, `> 1.00` → `MISMATCH`

---

## ดูต่อที่เกี่ยวข้อง
- [[posts_rule::doc-calc-vat-discount]] · [[posts_rule::doc-trans-flag-catalog]]
- [[uses_table::tbl-ic-inventory-price]] · [[uses_table::tbl-ic-trans-detail]] · [[uses_table::tbl-gl-journal]]
- [[has_query::sql-marketplace-payroll-subledger-audit]]
