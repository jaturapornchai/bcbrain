---
title: "เอกสารสต็อกพิเศษ: ยอดยกมา ปรับปรุง Lot และตรวจนับ (Opening Stock, Lot Adjust, Stock Count)"
tags: [accounting, inventory, stock, lot, opening-balance]
aliases: ["ยอดยกมาสินค้า", "สินค้ายกมา", "flag 54", "ปรับปรุง lot", "ตรวจนับสินค้า", "flag 76", "สินค้าที่ไม่ได้นับ", "lot อัตโนมัติ", "ปรับเฉพาะมูลค่า"]
sources: ["backend/internal/application/process/stock_beginning.go:218", "backend/internal/application/process/stock_beginning.go:112", "backend/internal/application/process/stock_beginning.go:259", "backend/internal/application/process/stock_beginning.go:269", "backend/internal/application/process/stock_beginning.go:292", "backend/internal/application/process/stock_beginning.go:307", "backend/internal/application/process/stock_beginning.go:475", "backend/internal/application/process/stock_beginning.go:618", "backend/internal/application/process/stock_beginning.go:633", "backend/internal/application/process/stock_lot.go:29", "backend/internal/application/process/stock_lot.go:171", "backend/internal/application/process/stock_lot.go:200", "backend/internal/application/process/stock_lot.go:387", "backend/internal/application/process/stock_lot.go:617", "backend/internal/application/process/stock_lot.go:901", "backend/internal/application/process/trans_lot_auto.go:32", "backend/internal/application/process/service.go:1677", "backend/internal/application/process/service.go:1742"]
---

# เอกสารสต็อกพิเศษ: ยอดยกมา ปรับปรุง Lot และตรวจนับ

กลุ่มหน้าจอสต็อกที่ไม่ใช่เอกสารซื้อขายปกติ ได้แก่ ยอดยกมาสินค้า (flag 54), ปรับเฉพาะมูลค่าของ lot, ปรับยอดจากเอกสารตรวจนับ (flag 76) และปรับยอดสินค้าที่ไม่ได้นับ ทุกตัวสร้างเอกสารแล้ว rebuild สต็อก/ต้นทุนใน transaction เดียวกัน เอกสารปรับปรุงที่สร้างคือ 66 (ปรับขึ้น) และ 68 (ปรับลง) (stock_lot.go:29-30)

## ทำงานอย่างไร

### ยอดยกมาสินค้า 54 (`StockBeginningSave` stock_beginning.go:307)
- ยอดบรรทัด = qty x price ปัด HALF_UP 2 ตำแหน่ง คำนวณที่ server ไม่รับจาก client (:40, :218) ยอดรวมหัวเอกสารก็ 2 ตำแหน่ง
- ตรวจรหัสสินค้ามีจริง (`sbCheckItems` :391); สินค้าหน่วยนับแบบ 2/3 ถ้าไม่ระบุหน่วยขนานใช้ค่าจาก `ic_opposite_unit` และต้องระบุจำนวนหน่วยขนาน; Serial ห้ามซ้ำในเอกสาร (:228); บรรทัดที่มี lot เขียน `ic_trans_detail_lot` เอง (:609)
- แท็บ GL คีย์มือ: ประเภทรายวัน `sbJournalTypes` (:112) รายวัน 0 / ยกมางวด 1 / ปิดงวด 2 / ปรับปรุง 3 / ยอดยกมา 4 ไม่รู้จัก = 0; สมุดค่าเริ่มต้น "01" (:259)
- งวด = เดือนของวันที่ (เว้นแต่ระบุ 1-99) (:264), `account_year` = ปี ค.ศ. ของวันที่ เว้นแต่ระบุ 1-9999 (:268-269)
- Dr ต้องเท่า Cr ที่ 2 ตำแหน่ง (ตรวจเฉพาะเมื่อมีบรรทัด GL) มิฉะนั้น error "ยอดเดบิต ... ไม่เท่ากับเครดิต" (:291-292)
- ตอนบันทึก รหัสบัญชีที่ไม่มีใน `gl_chart_of_account` ถูกแทนด้วย `resolveChartAccount` (:633-638): หา `รหัสเดิม-%` ก่อน ไม่พบใช้ฝั่ง Dr เป็นสินค้า 1131/1130/1140 ฝั่ง Cr เป็นทุน 3110/3100/3210 (`resolveChartAccount` service.go:1766 ไม่พบเลยใช้รหัสแรกในรายการ)
- `trans_direct` = 1 เมื่อผู้ใช้ติ๊ก GLDirect มิฉะนั้น 0 (:618-621)
- `sbRebuild` (:475): rebuild serial แล้ว `rebuildTransDerived` ของสินค้าที่แตะ
- 54 ไม่อยู่ใน `glRebuildTransFlags` (service.go:1742, 1748) GL ของ 54 จึงมาจากแท็บที่คีย์เท่านั้น

### ปรับเฉพาะมูลค่าของ lot (`LotAmountSave` stock_lot.go:387)
- หา lot ที่ qty รวม = 0 แต่ `ROUND(amount, 2)` ไม่ 0 จาก `ic_trans_detail_lot` (`lotResidualSQL` :314) server คำนวณใหม่ client ส่งแค่ว่าเลือก lot ไหน
- บรรทัดปรับ qty 0, ยอด = |มูลค่าคงเหลือ| ปัด 2 ตำแหน่ง (:416): มูลค่าคงเหลือ > 0 ไปเอกสาร 68 (ลง), < 0 ไปเอกสาร 66 (ขึ้น) (:417-421) เวลาเอกสาร 23:59
- เอกสาร 66 ใช้เลข N และ 68 ใช้เลข "-N" แล้วเขียนแถว lot ที่ทำให้ lot เป็นศูนย์ รันซ้ำจึงไม่พบอะไรให้ปรับ
- `freeAdjustNo` (:171) หาเลข N ที่ทั้ง N และ "-N" ยังว่าง (ยาวไม่เกิน 24 ตัว)
- `saveAdjustDoc` (:200) บันทึกผ่าน `saveTransTx` มาตรฐาน แล้วตั้ง `lot_number_1` และ `branch_code` '00' ในบรรทัด จากนั้นเขียน `ic_trans_detail_lot` ใหม่จาก `ic_trans_detail` โดย amount = `sum_of_cost` ที่ได้หลัง rebuild ต้นทุน (:218-235)

### ปรับยอดจากตรวจนับ 76 (`LotAutoRun` stock_lot.go:617)
- เทียบยอดนับกับยอดคงเหลือตาม lot / คลัง / ที่เก็บ (`processLotDiff` :79) ส่วนต่างปัด HALF_UP 4 ตำแหน่ง (`lotQtyScale` :31) เป็นเอกสาร 66 (ขึ้น) และ "-N" 68 (ลง) ยอดคงเหลือที่ไม่ได้นับถูกปรับเป็น 0
- โหมด `IgnoreLot` เทียบโดยไม่แยก lot
- ยอดบรรทัด = qty x `average_cost` ปัด 2 ตำแหน่ง (:742) วันที่/เวลาเอกสารปรับเอาจากเอกสารตรวจนับใบล่าสุด (:627-633, 657) ไม่มีเวลาใช้ 23:59
- ใส่ marker ใน `ap_ar_trans_detail` ของเอกสารตรวจนับ (:778); เอกสารตรวจนับที่มีเอกสารปรับที่ยัง active ถูกปฏิเสธ (:646) กันกดซ้ำ
- `LotAutoCheck` (:552) ตรวจสินค้าที่นับซ้ำหลายใบ

### สินค้าที่ไม่ได้นับ (`StockNotCountedRun` stock_lot.go:901)
- สินค้าในคลังที่เลือกซึ่งไม่อยู่ในเอกสารนับ แต่ยอดไม่เป็นศูนย์ ถูกปรับให้เป็น 0: ยอดบวกไป 68 ยอดติดลบไป 66 (:945-950)
- ยอดบรรทัด = |qty| x `average_cost` ปัด 2 ตำแหน่ง (:943) เวลาค่าเริ่มต้น 06:00 (:962)

### Lot อัตโนมัติตอนขาย (`autoLots` trans_lot_auto.go:32)
- ทำเฉพาะขาย 44 ที่บันทึกใหม่ เมื่อ `erp_option.find_lot_auto` = 1 (:50) กับสินค้า `cost_type` 2 (LOT) ที่ไม่ได้ระบุ lot
- ใช้ lot แรกตามเลข lot ที่ยอดพอ ไม่พอแตกบรรทัดตามหลาย lot; ยอด lot อ่านจาก `ic_trans_detail.lot_number_1`; ต้นทุนล็อคแบ่งตาม qty ปัด 2 ตำแหน่ง ส่วนที่เหลือไปบรรทัดใหม่
- เป็นการเลือก lot ในบรรทัดขายเท่านั้น ดูการคิดต้นทุนที่ [[acc-inventory-cost-moving-average]]

## จุดเสี่ยง
- **ยอดยกมาสินค้า 54 ไม่ตรวจงวดบัญชี** ทั้งบันทึกและลบ (ไม่มีการเรียกตรวจงวดใน stock_beginning.go) ดู [[acc-period-close]]
- รหัสบัญชีของ GL 54 ที่ไม่มีในผังบัญชีถูกแทนอัตโนมัติสองจุด: ตอนบันทึก (stock_beginning.go:633-638) และตอน `RebuildGL` ซึ่งแก้บรรทัด GL 54 เดิมทั้งหมด debit > 0 เป็นสินค้า 1131/1130/1140 นอกนั้นเป็นทุน 3110/3100/3210 (service.go:1677-1686) แม้เป็น GL ที่ผู้ใช้คีย์
- ยอดบรรทัด 54 และเอกสาร 66/68 ที่ระบบสร้าง ปัด 2 ตำแหน่งตายตัว ไม่ตาม `item_amount_decimal`

## ที่มาในโค้ด
- `backend/internal/application/process/stock_beginning.go:307` StockBeginningSave
- `backend/internal/application/process/stock_beginning.go:218` ยอดบรรทัด qty x price 2 ตำแหน่ง
- `backend/internal/application/process/stock_beginning.go:112` sbJournalTypes
- `backend/internal/application/process/stock_beginning.go:292` ตรวจ Dr = Cr
- `backend/internal/application/process/stock_beginning.go:633` แทนรหัสบัญชีที่ไม่มีในผังตอนบันทึก
- `backend/internal/application/process/stock_beginning.go:475` sbRebuild
- `backend/internal/application/process/stock_lot.go:387` LotAmountSave
- `backend/internal/application/process/stock_lot.go:200` saveAdjustDoc
- `backend/internal/application/process/stock_lot.go:617` LotAutoRun
- `backend/internal/application/process/stock_lot.go:901` StockNotCountedRun
- `backend/internal/application/process/trans_lot_auto.go:32` autoLots
- `backend/internal/application/process/service.go:1677` normalize GL 54 ตอน RebuildGL
- `backend/internal/application/process/service.go:1742` glRebuildTransFlags

## ดูเพิ่ม
- [[acc-inventory-stock-rebuild]]
- [[acc-inventory-cost-moving-average]]
- [[acc-trans-flag-map]]
