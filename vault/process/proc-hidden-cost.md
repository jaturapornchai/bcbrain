---
title: "ต้นทุนแฝง เฉลี่ยค่าใช้จ่ายเข้าสินค้า (Hidden Cost, เมนู 2.22)"
tags: [process, stock, cost, hidden-cost, stocktools, ic_trans, transaction]
aliases: ["hiddencostcalc", "hiddencostsave", "hiddencostdelete", "ต้นทุนแฝง", "ประมวลผลเฉลี่ยต้นทุนแฝง", "ic_hidden_cost_process", "allocateHiddenCost", "AFC", "ใบปรับปรุง flag 66"]
sources: ["backend/internal/application/process/hidden_cost.go:23", "backend/internal/application/process/hidden_cost.go:31", "backend/internal/application/process/hidden_cost.go:125", "backend/internal/application/process/hidden_cost.go:172", "backend/internal/application/process/hidden_cost.go:190", "backend/internal/application/process/hidden_cost.go:295", "backend/internal/application/process/hidden_cost.go:334", "backend/internal/application/process/hidden_cost.go:380", "backend/internal/application/process/hidden_cost.go:394", "backend/internal/application/process/hidden_cost.go:416", "backend/internal/application/process/hidden_cost.go:443", "backend/internal/application/process/hidden_cost.go:533", "backend/internal/application/process/hidden_cost.go:591", "backend/internal/adapter/inbound/http/process/stocktools_handler.go:120"]
---

# ต้นทุนแฝง เฉลี่ยค่าใช้จ่ายเข้าสินค้า (Hidden Cost, เมนู 2.22)

เมนูนี้นำ "เอกสารค่าใช้จ่าย" (flag 87, 260) และ/หรือค่าใช้จ่ายนำเข้าที่กรอกตรง (Freight, Insurance, Import Duty, Customs Clearance — `parseLandedBreakdown` :172, ดู [[faq-hidden-cost-landed]]) ไปเฉลี่ยเข้า "รายการสินค้า" ของเอกสารซื้อ (flag 12, 310, 60) ตามมูลค่า จำนวน น้ำหนัก/หน่วยขนาน หรือเท่ากันทุกบรรทัด แล้วบันทึกเอกสารต้นทุนแฝง (`ic_hidden_cost_process*`) พร้อมใบปรับปรุงมูลค่าอย่างเดียว (`ic_trans` flag 66) เพื่อให้การคำนวณสต็อกบวกส่วนเฉลี่ยเข้าต้นทุนสินค้า (คอมเมนต์หัวไฟล์ `hidden_cost.go:15-21`)

## ทำงานอย่างไร

### 3 action (route `POST /process/stocktools/{action}` และ `/api/v1/process/stocktools/{action}`)
| action | สิทธิ์ | หน้าที่ |
|---|---|---|
| `hiddencostcalc` | read | ปุ่ม "ประมวลผล" แสดงผลเฉลี่ยล่วงหน้า ไม่เขียนข้อมูล (`HiddenCostCalc` :372) |
| `hiddencostsave` | write | คำนวณใหม่แล้วบันทึกเอกสาร + ใบปรับปรุง ใน transaction เดียว (`HiddenCostSave` :443) |
| `hiddencostdelete` | del | ลบเอกสารต้นทุนแฝงและใบปรับปรุงของมัน (`HiddenCostDelete` :591) |

สิทธิ์อยู่ใน `permission.go:35,43,47` ดู [[proc-permission-rights]]

### Input (`HiddenCostInput`, `hidden_cost.go:40-64`)
`docNo` (ว่าง = เลขถัดไป prefix `AFC`), `oldDocNo` (เมื่อแก้ไข), `docDate`, `docTime` (ว่างใช้ `08:00`, ยาวเกิน 5 ตัวอักษรไม่ผ่าน), `docFormatCode`, `branchCode`, `remark` (<= 255 ตัวอักษร), `docNoAdjust` (ว่าง = เลขถัดไป prefix `IA`), `docFormatCodeAdjust`, `calFrom` (0 = มูลค่าสุทธิ, 1 = มูลค่าก่อนภาษี), `calFollow` (0 = มูลค่าสินค้า, 1 = จำนวน, 2 = น้ำหนักจริง/หน่วยขนาน `qty_2`, 3 = เท่ากันทุกรายการ), ข้อมูลนำเข้า `customsEntryNo`, `vesselContainerNo`, `incoterms`, `currencyCode`, `exchangeRate` (:57), ค่านำเข้าตรง `transportValue` (:58), `insuranceAmount`, `importDutyAmount`, `clearancePortAmount` (สตริงทศนิยม), `expenses[]` และ `purchases[]` (แต่ละรายการ `{refType, docNo}`)

ลูกค้าส่งแค่ "เลือกเอกสารไหน" กับค่านำเข้าที่กรอกตรง ตัวเลขของเอกสารทุกตัวอ่านจาก `ic_trans` / `ic_trans_detail` ฝั่งเซิร์ฟเวอร์ (คอมเมนต์ `:188-189`)

### ประเภทเอกสาร (`hidden_cost.go:31-32`)
- ค่าใช้จ่าย: `87` -> doc_ref_type 0 (ตั้งหนี้อื่น ๆ เจ้าหนี้), `260` -> 1 (ค่าใช้จ่ายอื่น ๆ) ตามคอมเมนต์ท้ายบรรทัด
- เอกสารซื้อ: `12` -> 0 (ซื้อสินค้า), `310` -> 1 (รับสินค้า), `60` -> 2 (รับสินค้าสำเร็จรูป)
- `refType` นอกตาราง = error "ประเภท... ไม่ถูกต้อง"; ซ้ำ = "เอกสารซ้ำ"; เกิน `hiddenCostRefCap` = 200 ใบต่อฝั่ง = error (`cleanHiddenCostRefs` :149)

### ลำดับคำนวณ (`hiddenCostCalc` :190)
1. `calFrom` ต้องเป็น 0/1 และ `calFollow` 0-3 (:192); ค่านำเข้าตรงช่องใดติดลบไม่ผ่าน (:177-178) ผลรวม 4 ช่อง = `directLanded` แบบไม่ปัด (:180-184)
2. ต้องมีเอกสารซื้ออย่างน้อย 1 ใบ และมีเอกสารค่าใช้จ่ายอย่างน้อย 1 ใบ **หรือ** `directLanded` > 0 (:207) — ข้อความ error ยังเขียนว่า "อย่างละ 1 ใบ" (:208); ไม่เลือกเอกสารค่าใช้จ่าย `expenses` เป็นอาร์เรย์ว่าง (:215)
3. `hiddenCostRefRows` (:295) อ่านหัวเอกสารจาก `ic_trans` เฉพาะ `last_status = 0`; ไม่พบหรือถูกยกเลิก = error "ไม่พบเอกสาร ... หรือเอกสารถูกยกเลิกแล้ว" ยอดก่อน VAT ใช้ `total_before_vat` แต่ถ้า `vat_type > 1` (เช่น 2 = ยกเว้น VAT) ใช้ `total_amount` แทน (:300-303)
4. `hiddenCostItems` (:334) อ่านบรรทัดสินค้าของเอกสารซื้อ (รวม `qty_2` :343) เรียง flag 12 ก่อน 310 แล้ว 60 (`array_position`, :350) จากนั้น `doc_no`, `line_number`, `roworder`; ข้ามบรรทัดที่ไม่มี `item_code`; `stand_value`/`divide_value` ที่เป็น 0 ถือเป็น 1; `ItemAmount = qty x price` แบบไม่ปัด (`exactDecimal` :362)
5. ยอด 2 ตัว (:226-235): `total` = `directLanded` + ผลรวม `amount` (มูลค่าสุทธิเสมอ) -> `totalAmount`; `spreadTotal` = `directLanded` + ผลรวม `amount` หรือ `amountBeforeVat` ตาม `calFrom` -> `hiddenCostAmount` (ยอดที่ปันส่วนจริง) ทั้งสองตัวส่งออกแบบไม่ปัด (`exactDecimal` :280-281, `stock_rebuild.go:213`)
6. น้ำหนักต่อบรรทัดตาม `calFollow` (:238-256): 0 = `ItemAmount`, 1 = `Qty`, 2 = `Qty2` ถ้า > 0 ไม่งั้นใช้ `Qty` (เลือกทีละบรรทัด), 3 = 1 ทุกบรรทัด
7. `allocateHiddenCost(spreadTotal, ...)` (:257, ฟังก์ชัน :125): ส่วนแบ่ง = `spreadTotal` x น้ำหนัก / ผลรวมน้ำหนัก ปัด HALF_UP ที่ scale 2 (`hiddenCostScale` :26, `RoundHalfUp` `service.go:149` ปัดครึ่งออกจากศูนย์); เศษปัดที่เหลือ (`spreadTotal` - ผลรวมส่วนแบ่ง) บวกให้ **บรรทัดที่น้ำหนักมากที่สุด** (ถ้าเท่ากันได้บรรทัดแรกในกลุ่มนั้น เพราะเทียบแบบ `>` เริ่มที่ 0, :134-145; ไม่มีน้ำหนัก > 0 เลย = บรรทัดที่ 0) ผลรวมส่วนแบ่งจึงเท่า `spreadTotal` เป๊ะ; กรณีผลรวมน้ำหนักเป็น 0 ทุกส่วนแบ่งเป็น 0 แล้ว **ยอดทั้งก้อนไปตกที่บรรทัดที่ 0** ผ่านเศษปัด
8. ต่อบรรทัด (:259-275): `adjustAmount` = ส่วนแบ่ง (2 ตำแหน่ง, :260); `ratio` = **เปอร์เซ็นต์** น้ำหนัก x 100 / ผลรวมน้ำหนัก ปัด HALF_UP 2 ตำแหน่ง (ผลรวม <= 0 = 0, :261-265); `sumTotalAmount` = `ItemAmount` + ส่วนแบ่ง ปัด HALF_UP 2 ตำแหน่ง (:266-268); `averageCost` = (`ItemAmount` + ส่วนแบ่ง) / `Qty` ปัด HALF_UP 4 ตำแหน่ง (`Qty` <= 0 = 0) โดยหารจากยอดก่อนปัด (:269-274)
9. ข้อมูลนำเข้า (:276-291): `exchangeRate` ว่างหรือ <= 0 = 1 (:276-279) แล้วส่งกลับ/บันทึกเฉย ๆ (:287) ไม่นำไปคูณยอดใด (`currencyCode` ก็เช่นกัน); `incoterms` ว่าง = `CIF`, `currencyCode` ว่าง = `THB` (แปลงเป็นตัวพิมพ์ใหญ่); ค่านำเข้า 4 ช่องและ `directLandedTotal` ส่งกลับแบบปัด HALF_UP 2 ตำแหน่ง แต่ `spreadTotal` ใช้ค่าก่อนปัด
10. ผลลัพธ์ `HiddenCostResult` (:97-115): `docNo`, `docNoAdjust`, `totalAmount`, `hiddenCostAmount`, `directLandedTotal`, ข้อมูลนำเข้า (รวม `exchangeRate`, `transportValue`), `expenses`, `purchases`, `items[]` (`qty2`, `adjustAmount`, `ratio`, `sumTotalAmount`, `averageCost` — `HiddenCostItem` :75-95)

### บันทึก (`HiddenCostSave` :443)
ตรวจวันที่/เวลา/หมายเหตุ และหาสาขาของผู้ใช้ก่อน (:445-459) แล้วทำใน `inTransTx` (transaction เดียว, :461):
1. `ensureHiddenCostImportCols` (:462, ฟังก์ชัน :416-439) รัน `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` เพิ่มคอลัมน์นำเข้า/ผลปันส่วน (หัว 10 คอลัมน์ :419-428, item 7 คอลัมน์ :430-436 ชื่อตามมาตรฐาน เช่น `exchange_rate`, `weight`, `ratio`, `average_cost`) **ทุกครั้งที่บันทึก ภายใน transaction ของการบันทึกเอง** ดู [[tbl-ic-hidden-cost-process]]
2. ได้เลขเอกสารจาก `nextDocNo(... "ic_hidden_cost_process", -1, ..., "AFC")` ถ้า `docNo` ว่าง (:467); ยาวเกิน 25 ตัวอักษรไม่ผ่าน (:472)
3. `lockHiddenCost` (:475, ฟังก์ชัน :380) ล็อก advisory `hashtext('hiddencost:'+doc_no)` ตามลำดับเรียง (ป้องกัน deadlock เมื่อแก้ไขแล้วเปลี่ยนเลข)
4. ถ้า `oldDocNo != docNo` ตรวจเลขซ้ำใน `ic_hidden_cost_process` (:479)
5. ถ้าเป็นการแก้ไข (`oldDocNo` ไม่ว่าง) `dropHiddenCostTx` (:484, ฟังก์ชัน :394) ลบใบปรับปรุงเดิม (`ic_trans` flag 66 ที่ `doc_ref = doc_no`) ผ่าน `deleteTransTx` (สต็อกและ GL ถูก rebuild) แล้วลบ `ic_hidden_cost_process_item/_ref/` และตารางหัว
6. เลขใบปรับปรุงจาก `nextDocNo(... "ic_trans", adjustUpFlag, ..., "IA")` ถ้าไม่ระบุ (:489; `adjustUpFlag` = 66 ที่ `stock_lot.go:29`)
7. คำนวณใหม่ด้วย `hiddenCostCalc` ใน transaction เดียวกัน (:493) แล้ว `insertHiddenCostRows` (:499, ฟังก์ชัน :533) เขียน 3 ตาราง: `ic_hidden_cost_process` (หัว + ข้อมูลนำเข้า, :534-546), `ic_hidden_cost_process_ref` (เอกสารอ้างอิง; ฝั่งเอกสารซื้อเขียน `amount_before_vat` = 0 เสมอ, :552-553), `ic_hidden_cost_process_item` (บรรทัด, `line_number` เริ่ม 0, :577-586) โดยบางค่าของ item เขียนซ้ำลง 2 คอลัมน์ (`weight`/`qty_2`, `item_amount`/`sum_amount`, `adjust_amount`/`hidden_cost_amount` :579-581) ดูที่ [[tbl-ic-hidden-cost-process]]
8. สร้างใบปรับปรุง `SaveTransInput` (:502-507: `TransType 3`, `TransFlag 66`, `DocRef` = เลขเอกสารต้นทุนแฝง) ที่แต่ละบรรทัดมี `Qty "0"`, `Price "0"`, `SumAmount = adjustAmount` (บรรทัดมูลค่าอย่างเดียว) บันทึกผ่าน `buildTransArgs` + `saveTransTx` (:509, :514) แล้วตั้ง `is_lock_record = 1` ที่หัวใบปรับปรุง (:518) และตั้ง `branch_code` ทุกบรรทัดเป็นสาขาของหัวเอกสาร (:521)
9. เขียน log ผ่าน `writeProcessLog` ข้อความ "ประมวลผลเฉลี่ยต้นทุนแฝง" (:524) ดู [[proc-workflow]]

บันทึกซ้ำด้วยข้อมูลเดิมได้แถวเท่าเดิม เพราะการแก้ไขลบคู่เอกสารเก่าก่อนเสมอ (คอมเมนต์ :441-442)

### ลบ (`HiddenCostDelete` :591)
ล็อกเลข (:597) -> ตรวจว่ามีใน `ic_hidden_cost_process` (:601; ไม่มี = error "ไม่พบเอกสารต้นทุนแฝง" :605) -> `dropHiddenCostTx` (:607) -> log "ลบเอกสารต้นทุนแฝง" (:610) คืน `TransResult{DocNo}`

## ที่มาในโค้ด
- `backend/internal/application/process/hidden_cost.go:23-33` - ค่าคงที่ `hiddenCostRefCap`, `hiddenCostScale` และตาราง flag ค่าใช้จ่าย/เอกสารซื้อ
- `backend/internal/application/process/hidden_cost.go:40-64` - `HiddenCostInput`; `:97-115` `HiddenCostResult`
- `backend/internal/application/process/hidden_cost.go:125-147` - `allocateHiddenCost` (ปันส่วน + โยกเศษปัดให้บรรทัดน้ำหนักมากสุด)
- `backend/internal/application/process/hidden_cost.go:149` - `cleanHiddenCostRefs`; `:172` `parseLandedBreakdown`
- `backend/internal/application/process/hidden_cost.go:190` - `hiddenCostCalc`; `:295` `hiddenCostRefRows`; `:334` `hiddenCostItems`
- `backend/internal/application/process/hidden_cost.go:380-414` - `lockHiddenCost`, `dropHiddenCostTx`
- `backend/internal/application/process/hidden_cost.go:416-439` - `ensureHiddenCostImportCols`
- `backend/internal/application/process/hidden_cost.go:443-531` - `HiddenCostSave`
- `backend/internal/application/process/hidden_cost.go:533-588` - `insertHiddenCostRows`
- `backend/internal/application/process/hidden_cost.go:591-612` - `HiddenCostDelete`
- `backend/internal/application/process/service.go:149` - `RoundHalfUp`; `:177` `FormatRat` (ปัด HALF_UP ก่อนจัดรูป)
- `backend/internal/application/process/stock_lot.go:29` - `adjustUpFlag = 66`
- `backend/internal/adapter/inbound/http/process/stocktools_handler.go:120-131` - 3 action ของเมนูนี้ (body จำกัด 4 MiB, `small` ที่ `:90`)
- `backend/internal/adapter/inbound/http/process/permission.go:35,43,47` - สิทธิ์ read/write/del

## ดูเพิ่ม
- [[proc-stock-tools]]
- [[proc-workflow]]
- [[proc-doc-flow-numbering]]
- [[proc-permission-rights]]
- [[proc-dispatcher]]
- [[process-overview]]
