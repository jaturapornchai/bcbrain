---
title: "เอกสารสต็อกพิเศษ: ยอดยกมา ปรับปรุง Lot และตรวจนับ (Opening Stock, Lot Adjust, Stock Count)"
tags: [accounting, inventory, stock, lot, opening-balance]
aliases: ["ยอดยกมาสินค้า", "สินค้ายกมา", "flag 54", "ปรับปรุง lot", "ตรวจนับสินค้า", "flag 76", "สินค้าที่ไม่ได้นับ", "lot อัตโนมัติ", "ปรับเฉพาะมูลค่า"]
sources: ["backend/internal/application/process/stock_beginning.go:40", "backend/internal/application/process/stock_beginning.go:112", "backend/internal/application/process/stock_beginning.go:259", "backend/internal/application/process/stock_beginning.go:268", "backend/internal/application/process/stock_beginning.go:292", "backend/internal/application/process/stock_beginning.go:307", "backend/internal/application/process/stock_beginning.go:475", "backend/internal/application/process/stock_beginning.go:618", "backend/internal/application/process/stock_lot.go:19", "backend/internal/application/process/stock_lot.go:171", "backend/internal/application/process/stock_lot.go:200", "backend/internal/application/process/stock_lot.go:387", "backend/internal/application/process/stock_lot.go:617", "backend/internal/application/process/stock_lot.go:901", "backend/internal/application/process/trans_lot_auto.go:15", "backend/internal/application/process/service.go:1666"]
---

# เอกสารสต็อกพิเศษ: ยอดยกมา ปรับปรุง Lot และตรวจนับ

กลุ่มหน้าจอสต็อกที่ไม่ใช่เอกสารซื้อขายปกติ ได้แก่ ยอดยกมาสินค้า (flag 54), ปรับเฉพาะมูลค่าของ lot, ปรับยอดจากเอกสารตรวจนับ (flag 76) และปรับยอดสินค้าที่ไม่ได้นับ ทุกตัวสร้างเอกสารแล้ว rebuild สต็อก/ต้นทุนใน transaction เดียวกัน

## ทำงานอย่างไร

### ยอดยกมาสินค้า 54 (`StockBeginningSave` stock_beginning.go:307)
- ยอดบรรทัด = qty x price ปัด HALF_UP 2 ตำแหน่ง คำนวณที่ server ไม่รับจาก client (:40)
- ตรวจรหัสสินค้ามีจริง, หน่วยนับขนานและจำนวนหน่วยขนานต้องระบุ, Serial ห้ามซ้ำในเอกสาร (:229), บรรทัดที่มี lot เขียน `ic_trans_detail_lot` เอง
- แท็บ GL คีย์มือ: ประเภทรายวัน `sbJournalTypes` (:112) รายวัน 0 / ยกมางวด 1 / ปิดงวด 2 / ปรับปรุง 3 / ยอดยกมา 4 ไม่รู้จัก = 0; สมุดค่าเริ่มต้น "01" (:259)
- งวด = เดือนของวันที่ (เว้นแต่ระบุ 1-99), `account_year` = ปี ค.ศ. ของวันที่ (comment ลุงจืด 2026-10-24 :268)
- Dr ต้องเท่า Cr ที่ 2 ตำแหน่ง มิฉะนั้น error "ยอดเดบิต ... ไม่เท่ากับเครดิต" (:292)
- `trans_direct` = 1 เมื่อผู้ใช้ติ๊ก GLDirect มิฉะนั้น 0 (:618)
- `sbRebuild` (:475): rebuild serial แล้ว `rebuildTransDerived` ของสินค้าที่แตะ
- 54 ไม่อยู่ใน `glRebuildTransFlags` (comment service.go:1737 ระบุว่า C# ไม่ลง GL ให้ 54) GL ของ 54 จึงมาจากแท็บที่คีย์เท่านั้น

### ปรับเฉพาะมูลค่าของ lot (`LotAmountSave` stock_lot.go:387)
- หา lot ที่ qty = 0 แต่มูลค่าไม่ 0 จาก `ic_trans_detail_lot` (server คำนวณใหม่ client ส่งแค่ว่าเลือก lot ไหน)
- สร้างเอกสาร 66 (มูลค่าขึ้น) เลข N และ 68 (มูลค่าลง) เลข "-N" แล้วเขียนแถว lot ที่ทำให้ lot เป็นศูนย์ รันซ้ำจึงไม่พบอะไรให้ปรับ
- `freeAdjustNo` (:171) หาเลขว่าง; `saveAdjustDoc` (:200) บันทึกผ่าน `saveTransTx` มาตรฐาน + แถว lot เอง (เพราะไม่ได้รัน Java cost engine :19-27)

### ปรับยอดจากตรวจนับ 76 (`LotAutoRun` stock_lot.go:617)
- เทียบยอดนับกับยอดคงเหลือตาม lot / คลัง / ที่เก็บ (`processLotDiff` :79) ส่วนต่างเป็นเอกสาร 66 (ขึ้น) และ "-N" 68 (ลง)
- ใส่ marker ใน `ap_ar_trans_detail` ของเอกสารตรวจนับ; เอกสารตรวจนับที่มีเอกสารปรับที่ยัง active ถูกปฏิเสธ กันกดซ้ำ
- `LotAutoCheck` (:552) ตรวจสินค้าที่นับซ้ำหลายใบ

### สินค้าที่ไม่ได้นับ (`StockNotCountedRun` stock_lot.go:901)
- สินค้าในคลังที่เลือกซึ่งไม่อยู่ในเอกสารนับ แต่ยอดไม่เป็นศูนย์ ถูกปรับให้เป็น 0 ด้วย 66 / 68

### Lot อัตโนมัติตอนขาย (`autoLots` trans_lot_auto.go:32)
- ขาย 44 ใหม่ของสินค้า `cost_type` 2 (LOT) ที่ไม่ได้ระบุ lot: ใช้ lot แรกตามเลข lot ที่ยอดพอ ไม่พอแตกบรรทัดตามหลาย lot; ยอด lot อ่านจาก `ic_trans_detail.lot_number_1`; ต้นทุนล็อคแบ่งตาม qty
- เป็นการเลือก lot เท่านั้น ต้นทุนยังเป็นถัวเฉลี่ย ดู [[acc-inventory-cost-moving-average]]

## จุดเสี่ยง
- **ยอดยกมาสินค้า 54 ไม่ตรวจงวดบัญชี** ทั้งบันทึกและลบ ดู [[acc-period-close]]
- `RebuildGL` แก้รหัสบัญชีของ GL 54 ที่ไม่มีในผังบัญชี: ฝั่ง Dr เป็นสินค้า 1131/1130/1140 ฝั่ง Cr เป็นทุน 3110/3100/3210 (service.go:1666-1675) แม้เป็น GL ที่ผู้ใช้คีย์
- ยอดบรรทัด 54 ปัด 2 ตำแหน่งตายตัว ไม่ตาม `item_amount_decimal`

## ที่มาในโค้ด
- `backend/internal/application/process/stock_beginning.go:307` StockBeginningSave
- `backend/internal/application/process/stock_beginning.go:112` sbJournalTypes
- `backend/internal/application/process/stock_beginning.go:292` ตรวจ Dr = Cr
- `backend/internal/application/process/stock_beginning.go:475` sbRebuild
- `backend/internal/application/process/stock_lot.go:387` LotAmountSave
- `backend/internal/application/process/stock_lot.go:617` LotAutoRun
- `backend/internal/application/process/stock_lot.go:901` StockNotCountedRun
- `backend/internal/application/process/trans_lot_auto.go:32` autoLots
- `backend/internal/application/process/service.go:1666` normalize GL 54

## ดูเพิ่ม
- [[acc-inventory-stock-rebuild]]
- [[acc-inventory-cost-moving-average]]
- [[acc-trans-flag-map]]
