---
title: "หัวเอกสารสินค้า/ซื้อ/ขาย (ic_trans)"
tags: [tables, ic]
aliases: ["ic_trans", "หัวเอกสาร", "ic_trans header", "doc_no trans_flag"]
sources: ["backend/internal/application/process/trans.go:101", "backend/internal/application/process/trans.go:395", "backend/internal/application/process/trans.go:510", "backend/internal/application/process/trans.go:593", "backend/internal/application/process/trans.go:657", "backend/internal/application/process/trans.go:841", "backend/internal/application/process/trans.go:1169", "backend/internal/application/process/transcalc.go:135", "backend/internal/application/process/grid_calc.go:171", "backend/internal/application/process/doc_flow.go:146", "backend/internal/application/process/doc_flow.go:239", "backend/internal/application/process/doc_flow.go:362", "backend/internal/application/process/doc_cancel.go:324", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/stock_rebuild.go:69", "backend/internal/application/process/cheque.go:81", "backend/internal/application/process/cheque.go:146", "backend/internal/application/process/gl_template.go:768", "backend/internal/application/process/pos_config.go:289", "backend/internal/application/process/pos_bill.go:400", "backend/internal/application/process/trans_tax.go:129", "backend/internal/application/process/trans_credit.go:196", "backend/internal/application/process/fx.go:187", "backend/internal/application/process/gl_template.go:794", "backend/internal/application/process/report_menu_so_po.go:238", "backend/internal/application/process/point_doc.go:120", "backend/internal/application/process/stock_beginning.go:501", "scripts/sql/02_data_schema.sql:6571", "AGENTS.md:61"]
---
# หัวเอกสารสินค้า/ซื้อ/ขาย (`ic_trans`)

**หน้าที่:** ตารางหัวเอกสารกลางของระบบ ซื้อ ขาย รับ-เบิกสินค้า โอนคลัง ปรับสต๊อก ใบเสนอราคา/สั่งซื้อ/สั่งขาย ใบเพิ่ม-ลดหนี้ และเอกสารรับ-จ่ายเงินบางประเภท ทุกเอกสารอยู่ในตารางเดียวกันแยกชนิดด้วย `trans_flag` รายการสินค้าของเอกสารอยู่ใน [[tbl-ic-trans-detail]] ตารางที่เป็นตารางเดียวของโมดูลนี้ที่ทุกโมดูลอ้างถึง (GL, ลูกหนี้-เจ้าหนี้, เงินสด-ธนาคาร)

ดูรหัส `trans_flag` ทั้งหมดที่ [[acc-trans-flag-map]], ขั้นตอนบันทึกที่ [[acc-transaction-save-flow]]

## คีย์

- เอกสาร 1 ใบ = (`doc_no`, `trans_flag`) — `doc_no` ถูกแปลงเป็นตัวพิมพ์ใหญ่และตัดช่องว่างก่อนบันทึก (`normalizeDocNo`, `trans.go:642`)
- DDL อยู่ที่ `scripts/sql/02_data_schema.sql:6571-6717` (145 คอลัมน์ รวมคอลัมน์ระบบ `ignore_sync`, `is_lock_record`, `roworder`, `create_date_time_now`) ส่วนที่ Go เขียนตอน INSERT ดูที่ `insertTransSQL` (`trans.go:657-690`) และ `SaveTransInput` (`trans.go:101-211`)
- Go ยังรัน `ALTER TABLE … ADD COLUMN IF NOT EXISTS` ของคอลัมน์ POS (`is_pos`, `pos_id`, `cashier_code`, `last_status`, `payment_method`, `sum_point`) (`posConfigDDL`, `pos_config.go:289-294`, รันที่ `:386`) — ใน DDL มีครบ ยกเว้น **`payment_method`** (`varchar(50)` default `'CASH'`) ที่ DDL ไม่มี จึงมาจาก ALTER นี้ที่เดียว และถูกเขียนที่ `pos_bill.go:400`; ส่วนคอลัมน์ POS อื่นคำสั่ง ALTER ไม่มีผลเพราะมีอยู่แล้ว (DDL กำหนด `pos_id`/`cashier_code` เป็น `varchar(25)`, `is_pos`/`last_status` เป็น `smallint`)

## คอลัมน์สำคัญ (INSERT ที่ `trans.go:657`)

| column | ความหมาย | หมายเหตุ |
|---|---|---|
| `doc_no`, `doc_date`, `doc_time` | เลขที่ วันที่ เวลา (ต้องระบุวันที่; ถ้าว่างเวลา default 08:00) | `trans.go:105-107,813-816` |
| `trans_type` | กลุ่มเอกสาร: 1 และ 4 ฝั่งเจ้าหนี้ ([[tbl-ap-supplier]]); 2 และ 5 ฝั่งลูกหนี้ ([[tbl-ar-customer]]) ค่าอื่นไม่ยืนยันจากโค้ดที่อ่าน | `gl_template.go:768-769`, `trans.go:1375` |
| `trans_flag` | ชนิดเอกสาร (ดู [[acc-trans-flag-map]]) | key ร่วมกับ `doc_no` |
| `cust_code` | รหัสเจ้าหนี้หรือลูกหนี้ ตาม `trans_type` | `trans.go:660` |
| `branch_code`, `department_code`, `sale_code`, `sale_group` | สาขา แผนก พนักงานขาย กลุ่มพนักงานขาย | `trans.go:660,667` |
| `inquiry_type` | ประเภทย่อยของเอกสาร: ใบเพิ่ม-ลดหนี้ 14/16/311 ค่า 1 และ 3 = ปรับมูลค่าอย่างเดียว ไม่กระทบจำนวนสต๊อก; เอกสาร 46 นับสต๊อกเฉพาะค่า 0 และ 48 เฉพาะค่า 0-1 | `stock_rebuild.go:20-21,26` |
| `vat_type`, `vat_rate` | ประเภทภาษี: 0 แยกนอก, 1 รวมใน, ค่าอื่น = ยกเว้น/ไม่กระทบภาษี; อัตราภาษี | `transcalc.go:135`, `trans.go:115-116` |
| `tax_doc_no`, `tax_doc_date` | เลขที่/วันที่ใบกำกับภาษี (ว่าง = ใช้ `doc_no` และวันที่เอกสาร) | `trans.go:117-118,823,896` |
| `doc_ref`, `doc_ref_date` | เอกสารอ้างอิง (เอกสารต้นทางที่ดึงมา; ใบยกเลิกชี้กลับเอกสารเดิมด้วย `doc_ref`) | `trans.go:119-120`, `doc_cancel.go:326-328` |
| `credit_day`, `due_date`, `credit_date` | เครดิตวัน วันครบกำหนด (ว่าง = วันที่เอกสาร) วันเครดิต (`credit_date` = `due_date` ยกเว้นเอกสารยกมาที่บันทึกเฉพาะยอดเงินที่หัว (`headerAmountFlags`) จะเป็นค่าว่าง) | `trans.go:121-122,216,831,689,909` |
| `wh_from`, `location_from`, `wh_to`, `location_to` | คลัง/ที่เก็บเริ่มต้นของเอกสาร: `wh_from`/`location_from` เป็นค่าตั้งต้นของบรรทัดที่ไม่ระบุคลัง ส่วน `wh_to`/`location_to` ใช้กับฝั่งรับของใบโอนคลัง 72 | `trans.go:123-126,1121-1122,1151` |
| `total_value`, `total_except_vat`, `discount_word`, `total_discount`, `advance_amount`, `total_before_vat`, `total_vat_value`, `total_after_vat`, `total_amount` | ยอดรวมต่างๆ ของเอกสาร (decimal) คำนวณจากรายการโดย `transTotals` ไม่ได้รับค่าจากหน้าจอตรงๆ (เอกสารยกมาที่ไม่มีรายการใช้ `TotalAmount` ที่กรอก); `discount_word` คือสูตรส่วนลด เช่น "5%" (เปอร์เซ็นต์) หรือ "10" (จำนวนเงิน) คั่นหลายตัวด้วยจุลภาค; `advance_amount` มาจากแท็บใช้เงินมัดจำ | `trans.go:127,183,187,775-793,841,854,899-900,908`, `grid_calc.go:171-197` |
| `remark`, `remark_2`, `remark_3` | หมายเหตุ | `trans.go:128,147-148` |
| `doc_format_code` | รูปแบบเลขที่เอกสาร ([[tbl-erp-doc-format]]) | `trans.go:129` |
| `contactor`, `doc_reason`, `pass_book_code` | ผู้ติดต่อ เหตุผล สมุดเงินฝาก ([[tbl-erp-pass-book]]) | `trans.go:131,133-134` |
| `project_code`, `allocate_code`, `side_code`, `job_code` | มิติบัญชี: โครงการ การจัดสรร หน่วยงาน งาน | `trans.go:136-139` |
| `transport_code`, `currency_code`, `exchange_rate` | ขนส่ง สกุลเงิน อัตราแลก (ว่าง = 1; ถ้าเปิดโหมดหลายสกุลเงินใช้อัตราที่แปลงรายการ) | `trans.go:141-143,888-891`, `fx.go:129` |
| `delivery_date` | วันส่งของ | `trans.go:146` |
| `on_hold`, `user_request`, `approve_code`, `user_approve`, `not_approve_1` | ฟิลด์อนุมัติ PR/PO (`on_hold` และ `not_approve_1` ต้องเป็น 0 หรือ 1) | `trans.go:153-157,866-870` |
| `expire_day/date`, `send_day/date`, `deposit_day/date` | คู่ จำนวนวัน/วันที่ ของใบเสนอราคา ส่งของ และมัดจำ (จำนวนวันต้องอยู่ระหว่าง 0 ถึง 32767) | `trans.go:158-163,871-875` |
| `send_type` | 0 รับเอง / 1 ส่งให้ (UPDATE ต่อท้ายเมื่อ ≠ 0; ค่าอื่นถูกปฏิเสธ) | `trans.go:201,1175-1180` |
| `doc_group`, `remark_4`, `remark_5`, `recheck_count`, `recheck_count_day`, `extra_word`, `cashier_code` | กลุ่มเอกสาร หมายเหตุ 4-5 จำนวนครั้งตรวจซ้ำ ข้อความเพิ่ม รหัสแคชเชียร์ (เขียนด้วย UPDATE ต่อท้ายหลัง INSERT เฉพาะเมื่อมีค่า) | `trans.go:140,149-150,164-165,172-173,1169-1173` |
| `branch_code_to`, `side_code_to`, `department_code_to`, `allocate_code_to`, `project_code_to`, `job_code_to` | มิติปลายทางของเอกสารโอน (เขียนด้วย UPDATE เดียวกับแถวบน เฉพาะเมื่อมีค่า; "ว่าง = สาขาที่ล็อกอิน" ใช้เฉพาะคู่แถว detail โอนคลัง 72/70 ไม่ได้เติมที่หัวเอกสาร) | `trans.go:166-171,1169-1173,1198` |
| `last_status` | 0 ปกติ / 1 ยกเลิก (ใส่ 0 ตอน INSERT; ค่าจริง derive ทีหลัง) | `trans.go:689`, `doc_flow.go:239-273` |

## คอลัมน์อื่นที่ Go ใช้ (ไม่อยู่ใน `insertTransSQL`)

- `ref_amount`, `ref_new_amount`, `ref_diff`: UPDATE หลัง INSERT เฉพาะ `trans_flag` ใน `refAmountFlags` (14, 316, 16, 311, 317) — `ref_amount` = ยอดของเอกสาร `doc_ref`, `ref_diff` = ยอดของเอกสารนี้, `ref_new_amount` = `ref_amount` ± `ref_diff` (ลบสำหรับ 16, 311, 317); ถ้า `vat_type = 0` ใช้ยอดก่อนภาษีรวมยอดยกเว้นภาษี ไม่งั้นใช้ `total_amount` (`trans.go:229-246,948-953`)
- `is_manual_vat`: ตั้งเป็น 1 เมื่อบันทึกภาษีที่กรอกเอง (`useCustomVat`) (`trans_tax.go:115,128-129`)
- `is_hold`, `auto_approved`: ตั้งเป็น 1 ตอนตรวจวงเงินเครดิตของใบสั่งจอง 34 / สั่งขาย 36 (`trans_credit.go:195-201`); `auto_approved` ถูกอ่านตอน derive `approve_status` (`doc_flow.go:292`)
- `discount_word_2`, `total_value_2`, `total_discount_2`, `total_amount_2`: ค่าที่กรอกเป็นสกุลเงินต่างประเทศเมื่อบันทึกในโหมดหลายสกุลเงิน (คอลัมน์ปกติเก็บยอดแปลงเป็นสกุลเงินหลัก) — `fx.go:187-188,209-211`; `total_amount_2` ถูกอ่านเป็นยอดหนี้สกุลต่างประเทศที่ `fx.go:302`
- `lost_profit_exchange_amount`: อ่านที่ `gl_template.go:794`; `expire_status`: อ่านที่ `report_menu_so_po.go:238` (แสดงสถานะ "เอกสารหมดอายุ") — ไม่พบโค้ด Go ที่เขียนคอลัมน์นี้ลง `ic_trans`
- `status`, `creator_code`, `last_editor_code`, `create_datetime`, `lastedit_datetime`: เขียนเฉพาะตอน INSERT หัวเอกสารที่สร้างจากโมดูลอื่น คือเอกสารแต้มสะสม (`point_doc.go:120-123`) และยอดยกมาสต๊อก (`stock_beginning.go:500-515`)
- อยู่ใน DDL แต่ไม่พบโค้ด Go อ่านหรือเขียนคอลัมน์เหล่านี้ใน SQL ของ `ic_trans`: `sale_area_code`, `answer_type`, `transport_value`, `total_cost`, `balance_amount`, `adjust_reason`, `approve_date`, `guid_code`, `send_mail`, `send_sms`, `doc_ref_trans`, `pay_amount`, `money`, `sum_pay_money_diff`, `currency_money`, `total_debt_amount`, `total_manual`, `want_day`, `want_date`, `member_code`, `doc_no_guid`, `pos_bill_type`, `pos_bill_change`, `doc_type`, `auto_create`, `send_to_pick_and_pack`, `service_charge_word`, `total_service_charge`, `sale_shift_id`, `table_number`, `period_guid`, `point_telephone`, `sum_point_2`, `sender_code`, `cancel_code`, `cancel_datetime`, `pos_transfer`, `doc_close`, `ref_doc_type`, `total_amout_old` (หัวคู่ของใบโอน 72 สร้างด้วย `pairInsertSQL` ซึ่งคัดลอกทุกคอลัมน์ตามรายชื่อที่ฐานข้อมูลมีอยู่จริง — `cheque.go:144-177`)

## คอลัมน์ที่ระบบ derive (ไม่ได้มาจากการกรอก)

`docFlowTx` (`doc_flow.go:146-177`) คำนวณใหม่จากแถวดิบหลังบันทึก (`trans.go:580`) ลบ (`trans.go:435`) ยกเลิก (`doc_cancel.go:187`) และอนุมัติ (`doc_cancel.go:253`): `last_status` (`deriveLastStatus`, `doc_flow.go:239-273`) กับ `used_status`, `used_status_2`, `doc_success`, `approve_status` (UPDATE ที่ `doc_flow.go:362-368`; กฎต่อ `trans_flag` อยู่ใน `flowRules` `doc_flow.go:91`) โหมดสูตร `doc_success` ดู `doc_flow.go:20-26`

- `used_status` / `used_status_2`: มีเอกสารอื่นอ้างถึงเอกสารนี้แล้ว (เช่น ใบเสนอราคาที่ถูกดึงไปเป็นใบสั่งขาย)
- `doc_success`: เอกสารถูกดึงไปใช้ครบแล้ว (มีหลายสูตรตามชนิดเอกสาร)
- `approve_status`: ผลอนุมัติจากเอกสารอนุมัติที่ชี้มา หรือจาก `erp_credit_approved_logs` ([[tbl-erp-credit-approved-logs]])
- ยกเลิกเป็นเอกสารแยก: ใบยกเลิกมี `trans_flag` ของการยกเลิกและ `doc_ref` = เลขที่เอกสารเดิม (`insertStatusDoc`, `doc_cancel.go:324-330`) แล้ว `last_status` ของเอกสารเดิมถูก derive เป็น 1 เมื่อมีใบยกเลิกชี้มาหรือ `is_cancel = 1` (`doc_flow.go:247-251`); ใบยกเลิกรายสินค้า (`cancel_type = 2`, `CancelType` `doc_cancel.go:40`) ไม่ทำให้เอกสารเดิมเป็นยกเลิกสำหรับชนิดเอกสารที่อยู่ใน `cancelTypeFilter` (`doc_flow.go:234,242-244`) แต่นับว่าเอกสารเดิมถูกใช้แล้ว (`partCancel`, `doc_flow.go:52-55`)

## ลำดับเมื่อบันทึก (`saveTransTx`, `trans.go:510-589`)

1. ล็อกเอกสารและสินค้าที่เกี่ยวข้อง; ถ้า `IsNew` ปฏิเสธ `doc_no`+`trans_flag` ซ้ำ
2. ลบของเดิมทั้งหมดของเอกสาร: `ic_trans_serial_number`, `ic_trans_shipment`, `ic_trans_detail`, `ic_trans` — บันทึกซ้ำจึงเป็น delete-and-replace
3. INSERT หัว ([[tbl-ic-trans]]) แล้วรายการ ([[tbl-ic-trans-detail]]), ตามด้วยแท็บรับ/จ่ายชำระ → `cb_trans` ([[tbl-cb-trans]]) และคำสั่งที่เหลือ (Serial, ที่อยู่จัดส่ง [[tbl-ic-trans-shipment]], cheque)
4. `docFlowTx` derive สถานะเอกสาร (ตัวเอง + เอกสารต้นทางที่ชี้)
5. `rebuildSerialTx` สร้าง [[tbl-ic-serial]] ใหม่
6. `rebuildTransDerived`: `rebuildStockTx` คำนวณสต๊อก/ต้นทุน ([[acc-inventory-cost-moving-average]]), `rebuildGLTx` ตั้งสมุดรายวัน ([[acc-gl-posting-standard]], [[tbl-gl-journal]]), โอนเงิน/โอนสต๊อกคู่ขนาน, และสถานะเช็ค (`trans_flag` 405-418, 451-456, 461-463, `isChequeFlag` `trans.go:631-633`) ([[tbl-cb-chq-list]]) — `trans.go:593-628`

ลบเอกสาร (`deleteTransTx`, `trans.go:395-444`) ปฏิเสธถ้ามีเอกสารอื่นอ้างถึงแล้ว หรือถ้ามัดจำถูกใช้แล้ว (`trans.go:403-410`)

## ความสัมพันธ์

- 1:n [[tbl-ic-trans-detail]] ผ่าน (`doc_no`, `trans_flag`) — โอนคลัง (`transFlagTransferOut`) มีแถว detail คู่ของ transfer-in ด้วย (`transDetailFlags`, `trans.go:635-640`)
- โอนคลัง 72 มีหัวคู่ `trans_flag = 70` ที่ถูกสร้างใหม่จากหัว 72 ทุกครั้ง (สลับ branch/side/department/project/allocate/job กับคอลัมน์ `_to`; ลบ 72 แล้วหัว 70 หายด้วย เพราะ `deleteTransTx` ลบตาม `transDetailFlags`, `trans.go:424`) — `syncStockTransferIn`, `stock_rebuild.go:69-81` (เรียกที่ `trans.go:614-616`) ใช้ `pairInsertSQL` `cheque.go:146-177` กับตารางสลับ `transferPairSwaps` `cheque.go:81-89`
- n:1 [[tbl-ar-customer]] / [[tbl-ap-supplier]] ผ่าน `cust_code` ตาม `trans_type`
- 1:n [[tbl-ic-trans-serial-number]], 1:1 [[tbl-ic-trans-shipment]]
- 1:1 [[tbl-cb-trans]] (แท็บรับ/จ่ายชำระ) และ [[tbl-ap-ar-trans]] (ตัดหนี้) ผ่าน `doc_no`+`trans_flag`
- 1:n [[tbl-gl-journal]] ผ่าน `doc_no`+`trans_flag` (สร้างโดย `rebuildGLTx`)

## ข้อควรระวัง

- ตารางนี้ **ไม่มีสต๊อกในตัวเอง** ยอดสต๊อกมาจากแถวใน [[tbl-ic-trans-detail]] เท่านั้น และเฉพาะ `trans_flag` ที่อยู่ใน `stockRowsSQL` (`stock_rebuild.go:18-22`)
- `is_doc_copy = 1` (สำเนาเอกสาร) ต้องถูกกรองทิ้งในรายงาน/สต๊อก (`stock_rebuild.go:18`, `report_menu_ap_ar.go:256`, `gl_template.go:1108`)
- บัญชี/เงิน: ยอดทุกตัวเป็น decimal (`::numeric`) ส่งเป็น string; ห้ามใช้ float (กฎข้อ 20 ใน `AGENTS.md:61`: เงินใช้ `big.Rat`; cast ที่ `trans.go:677-689`)
- ลำดับ derive ต้องไม่สลับ: สต๊อกก่อน GL เพราะ GL ใช้ต้นทุนที่เพิ่งคำนวณ (`trans.go:597,609`)

## ที่มาในโค้ด

- `backend/internal/application/process/trans.go:101-211` (SaveTransInput), `:395-444` (deleteTransTx), `:510-589` (saveTransTx), `:593-640`, `:642`, `:657-690` (insertTransSQL), `:816`, `:841-910`, `:1169-1180`, `:1375`
- `backend/internal/application/process/doc_flow.go:20-26`, `:52-55`, `:91`, `:146-177`, `:234-273`, `:362-368`
- `backend/internal/application/process/doc_cancel.go:40`, `:70`, `:324-330`
- `backend/internal/application/process/stock_rebuild.go:18-26`, `:69-81`
- `backend/internal/application/process/cheque.go:81-89`, `:146-177`
- `backend/internal/application/process/transcalc.go:135`
- `backend/internal/application/process/grid_calc.go:171-197`
- `scripts/sql/02_data_schema.sql:6571-6717` DDL ของ `ic_trans`
- `backend/internal/application/process/pos_config.go:289-294`, `:386`; `pos_bill.go:400` (เขียน `payment_method`)
- `backend/internal/application/process/trans.go:229-246`, `:948-953`; `trans_tax.go:115`, `:128-129`; `trans_credit.go:195-201`; `fx.go:187-188`, `:209-211`, `:302`
- `backend/internal/application/process/point_doc.go:120-123`; `stock_beginning.go:500-515`; `gl_template.go:794`; `report_menu_so_po.go:238`; `doc_flow.go:292`
- `backend/internal/application/process/fx.go:129`
- `backend/internal/application/process/gl_template.go:768-769`, `:1108`
- `backend/internal/application/process/report_menu_ap_ar.go:256`
- `AGENTS.md:61`
