---
title: "ลำดับการบันทึกเอกสาร (Transaction Save Flow)"
tags: [accounting, transaction, save, postgres, go]
aliases: ["บันทึกเอกสาร", "SaveTrans", "save flow", "rollback", "ลำดับการบันทึก", "advisory lock", "เลขที่เอกสารซ้ำ"]
sources: ["backend/internal/application/process/trans.go:267", "backend/internal/application/process/trans.go:301", "backend/internal/application/process/trans.go:446", "backend/internal/application/process/trans.go:473", "backend/internal/application/process/trans.go:510", "backend/internal/application/process/trans.go:593", "backend/internal/application/process/trans.go:798", "backend/internal/application/process/trans.go:1214", "backend/internal/application/process/service.go:992", "backend/internal/application/process/service.go:1370", "backend/internal/application/process/trans_validate.go:43"]
---

# ลำดับการบันทึกเอกสาร (`SaveTrans`)

การบันทึกเอกสาร ic_trans ทุกชนิดผ่าน `SaveTrans` ซึ่งทำงานทั้งหมดใน PostgreSQL transaction เดียว (timeout 60 วินาที) แบบ "ลบแล้วเขียนใหม่" ของเอกสารนั้น จากนั้น rebuild สต็อก ต้นทุน GL และเช็ค ถ้าผิดพลาดที่ขั้นใด จะ rollback ทั้งหมด

## ทำงานอย่างไร

### 1. เตรียมข้อมูลก่อนเปิด transaction (`SaveTrans` trans.go:267)
- หา branch ของผู้ใช้ (ใช้กับ 72 โอนออก), เงื่อนไขขายเงินสด/ตัดชำระ
- `autoLots` เติม lot ให้บรรทัดขาย 44 ของสินค้า lot (trans_lot_auto.go:32)
- `normalizeItemLines` คำนวณราคา/VAT ระดับบรรทัด และแปลงสกุลเงิน (ดู [[acc-transcalc-totals]], [[acc-fx-multi-currency]])
- `buildTransArgs` (trans.go:798) แปลง input เป็นค่าที่จะ insert

กฎใน `buildTransArgs`
- `doc_no` แปลงเป็นตัวพิมพ์ใหญ่ ตัดช่องว่าง และยาวไม่เกิน 25 ตัวอักษร
- `doc_time` ค่าว่าง = `08:00`
- `vat_rate` scale 2, `exchange_rate` scale 6 (ค่าว่าง = 1)
- ยอดสุทธิติดลบ = error; เอกสารยอดหัว (`headerAmountFlags`) ต้องมียอดมากกว่า 0
- qty หรือยอดติดลบได้เฉพาะ flag 66; ราคาติดลบไม่ได้
- qty และ price scale 4; ยอดบรรทัด scale = `item_amount_decimal`

ตัวเลขทุกช่องผ่าน `decimalParser.arg` (trans.go:1214): ตัด comma, ค่าว่าง = "0", ต้องตรง regex `^-?\d{1,15}(\.\d+)?$` แล้วปัด HALF_UP ตาม scale

### 2. ใน transaction (`inTransTx` trans.go:446)
`checkAndSaveTransTx` (trans.go:301) เรียงตามนี้
1. `checkTransScreenSave` (trans_validate.go:43): งวดบัญชีเปิด, เอกสารไม่ถูก lock, แก้ไขได้, คู่ค้ามีจริง, ยอดอ้างอิง, กฎ erp_option (ดู [[acc-credit-limit-save-rules]], [[acc-period-close]])
2. `checkTaxDocNo` เลขใบกำกับภาษีห้ามซ้ำ (ดู [[acc-vat-register-wht]])
3. `checkHeldItems`, `checkRefDocItems`
4. `saveTransTx` (trans.go:510)

### 3. `saveTransTx` (trans.go:510)
1. ล็อกเอกสาร `lockTransDoc` (trans.go:473) = `pg_advisory_xact_lock(hashtext("ic_trans:<doc>:<flag>"))` และล็อกสินค้า `lockStockItems` (service.go:992) โดยเรียงรหัสสินค้าก่อนล็อกเพื่อกัน deadlock
2. เอกสารใหม่ (`IsNew`) ที่เลขซ้ำ = error "เลขที่เอกสารซ้ำ"
3. DELETE `ic_trans_serial_number`, `ic_trans_shipment`, `ic_trans_detail`, `ic_trans` ของเอกสารนี้
4. INSERT หัว `ic_trans` (`total_value`, `total_except_vat`, `discount_word`, `total_discount`, `advance_amount`, `total_before_vat`, `total_vat_value`, `total_after_vat`, `total_amount`, `exchange_rate`, `last_status` = 0, `tax_doc_no` ค่าเริ่มต้น = doc_no)
5. INSERT บรรทัด `ic_trans_detail` (`calc_flag`, `price_exclude_vat`, `sum_amount_exclude_vat`, `average_cost`, `sum_of_cost`, `is_lock_cost`, `sum_of_cost_fix`, `qty_2`, `unit_code_2` ฯลฯ)
6. แท็บจ่าย `cb_trans` / `cb_trans_detail` ต้องเขียนก่อน GL (ดู [[acc-payment-tab]])
7. VAT/WHT, มัดจำ แล้วตรวจ `checkDepositUse` และ `runTxChecks` (ตรวจจากแถวที่เพิ่งเขียน)
8. POS ที่เลื่อนการตัดสต็อก: `queuePosStock`
9. `docFlowTx`, `rebuildSerialTx`, แล้ว `rebuildTransDerived`

### 4. `rebuildTransDerived` (trans.go:593)
1. `rebuildStockTx` เฉพาะสินค้าในเอกสาร (ถ้ารายการว่างจะข้าม เพราะรายการว่างหมายถึง rebuild ทั้งหมด)
2. `SyncTransferPair` เมื่อเป็น 422
3. `rebuildGLTx` ของเอกสารนี้ (ล็อก GL แบบ shared ด้วย `lockGLShared` service.go:1370)
4. `syncStockTransferIn` เมื่อเป็น 72
5. `RebuildChequeStatus` เมื่อเป็น flag เช็ค (405-418, 451-456, 461-463)

### กรณีพิเศษ
- 72 โอนสินค้า: เขียนบรรทัดออก (72, calc -1, คลังเริ่มต้น "01") และบรรทัดเข้า (70, calc +1, คลังเริ่มต้น "02", เวลา +1 นาที)
- 422 โอนเงิน: ต้องมีสมุดบัญชีปลายทางที่ไม่ใช่บัญชีเดียวกัน; `transfer_amount` ว่าง = ยอด - ค่าธรรมเนียม
- `CreditApprovePassword` ไม่ถูก echo กลับหรือเขียน log (comment ใน `SaveTransInput`)

## ที่มาในโค้ด
- `backend/internal/application/process/trans.go:267` SaveTrans
- `backend/internal/application/process/trans.go:301` checkAndSaveTransTx
- `backend/internal/application/process/trans.go:446` inTransTx
- `backend/internal/application/process/trans.go:473` lockTransDoc
- `backend/internal/application/process/trans.go:510` saveTransTx
- `backend/internal/application/process/trans.go:593` rebuildTransDerived
- `backend/internal/application/process/trans.go:798` buildTransArgs
- `backend/internal/application/process/trans.go:1214` decimalParser.arg
- `backend/internal/application/process/service.go:992` lockStockItems
- `backend/internal/application/process/trans_validate.go:43` checkTransScreenSave

## ดูเพิ่ม
- [[accounting-overview]]
- [[acc-transaction-delete-edit]]
- [[acc-inventory-stock-rebuild]]
- [[acc-gl-rebuild]]
- [[acc-rounding-decimal]]
