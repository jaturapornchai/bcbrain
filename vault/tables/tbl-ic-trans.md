---
title: "หัวเอกสารสินค้า/ซื้อ/ขาย (ic_trans)"
tags: [tables, ic]
aliases: ["ic_trans", "หัวเอกสาร", "ic_trans header", "doc_no trans_flag"]
sources: ["backend/internal/application/process/trans.go:101", "backend/internal/application/process/trans.go:395", "backend/internal/application/process/trans.go:510", "backend/internal/application/process/trans.go:593", "backend/internal/application/process/trans.go:657", "backend/internal/application/process/doc_flow.go:13", "backend/internal/application/process/doc_cancel.go:12", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/gl_template.go:768"]
---
# หัวเอกสารสินค้า/ซื้อ/ขาย (`ic_trans`)

**หน้าที่:** ตารางหัวเอกสารกลางของระบบ ซื้อ ขาย รับ-เบิกสินค้า โอนคลัง ปรับสต๊อก ใบเสนอราคา/สั่งซื้อ/สั่งขาย ใบเพิ่ม-ลดหนี้ และเอกสารรับ-จ่ายเงินบางประเภท ทุกเอกสารอยู่ในตารางเดียวกันแยกชนิดด้วย `trans_flag` รายการสินค้าของเอกสารอยู่ใน [[tbl-ic-trans-detail]] ตารางที่เป็นตารางเดียวของโมดูลนี้ที่ทุกโมดูลอ้างถึง (GL, ลูกหนี้-เจ้าหนี้, เงินสด-ธนาคาร)

ดูรหัส `trans_flag` ทั้งหมดที่ [[acc-trans-flag-map]], ขั้นตอนบันทึกที่ [[acc-transaction-save-flow]]

## คีย์

- เอกสาร 1 ใบ = (`doc_no`, `trans_flag`) — `doc_no` ถูกแปลงเป็นตัวพิมพ์ใหญ่และตัดช่องว่างก่อนบันทึก (`normalizeDocNo`, `trans.go:642`)
- ไม่มี DDL ใน repo (ตารางเดิมของ C#) คอลัมน์ด้านล่างอนุมานจาก `insertTransSQL` (`trans.go:657-690`) และ `SaveTransInput` (`trans.go:101-262`)

## คอลัมน์สำคัญ (INSERT ที่ `trans.go:657`)

| column | ความหมาย | หมายเหตุ |
|---|---|---|
| `doc_no`, `doc_date`, `doc_time` | เลขที่ วันที่ เวลา (ถ้าว่างเวลา default 08:00) | `trans.go:104-106` |
| `trans_type` | กลุ่มเอกสาร: 1 และ 4 ฝั่งเจ้าหนี้ ([[tbl-ap-supplier]]); 2 และ 5 ฝั่งลูกหนี้ ([[tbl-ar-customer]]) ค่าอื่นไม่ยืนยันจากโค้ดที่อ่าน | `gl_template.go:768-769`, `trans.go:1375` |
| `trans_flag` | ชนิดเอกสาร (ดู [[acc-trans-flag-map]]) | key ร่วมกับ `doc_no` |
| `cust_code` | รหัสเจ้าหนี้หรือลูกหนี้ ตาม `trans_type` | `trans.go:660` |
| `branch_code`, `department_code`, `sale_code`, `sale_group` | สาขา แผนก พนักงานขาย กลุ่มพนักงานขาย | `trans.go:660-678` |
| `inquiry_type` | ประเภทย่อยของเอกสาร (เช่น 14/16 ใบเพิ่ม-ลดหนี้ 0..3; ค่า 1 และ 3 = แก้ราคาอย่างเดียว) | `stock_rebuild.go:23-26` |
| `vat_type`, `vat_rate` | ประเภทภาษี: 0 แยกนอก, 1 รวมใน, 2 ยกเว้น; อัตราภาษี | `trans.go:114-115` |
| `tax_doc_no`, `tax_doc_date` | เลขที่/วันที่ใบกำกับภาษี | `trans.go:115` |
| `doc_ref`, `doc_ref_date` | เอกสารอ้างอิง (เอกสารต้นทางที่ดึงมา; ใบยกเลิกชี้กลับเอกสารเดิมด้วย `doc_ref`) | `doc_cancel.go:15-16` |
| `credit_day`, `due_date`, `credit_date` | เครดิตวัน วันครบกำหนด วันเครดิต (คำนวณ `credit_date` จาก `due_date` ตามสวิตช์) | `trans.go:117-118,688` |
| `wh_from`, `location_from`, `wh_to`, `location_to` | คลัง/ที่เก็บต้นทาง-ปลายทาง (ใช้กับโอน/ปรับ) | `trans.go:119-122` |
| `total_value`, `total_except_vat`, `discount_word`, `total_discount`, `advance_amount`, `total_before_vat`, `total_vat_value`, `total_after_vat`, `total_amount` | ยอดรวมต่างๆ ของเอกสาร (decimal; `discount_word` เช่น "5%" หรือ "10"); `advance_amount` มาจากแท็บใช้เงินมัดจำ | `trans.go:122-130`, `SaveTransInput` คอมเมนต์ที่ `:155-157` |
| `remark`, `remark_2`, `remark_3` | หมายเหตุ | `trans.go:131-146` |
| `doc_format_code` | รูปแบบเลขที่เอกสาร ([[tbl-erp-doc-format]]) | `trans.go:132` |
| `contactor`, `doc_reason`, `pass_book_code` | ผู้ติดต่อ เหตุผล สมุดเงินฝาก ([[tbl-erp-pass-book]]) | `trans.go:133` |
| `project_code`, `allocate_code`, `side_code`, `job_code` | มิติบัญชี: โครงการ การจัดสรร หน่วยงาน งาน | `trans.go:134` |
| `transport_code`, `currency_code`, `exchange_rate` | ขนส่ง สกุลเงิน อัตราแลก (ว่าง = 1) | `trans.go:135`, FX ที่ `fx.go` |
| `delivery_date` | วันส่งของ | `trans.go:138` |
| `on_hold`, `user_request`, `approve_code`, `user_approve`, `not_approve_1` | ฟิลด์อนุมัติ PR/PO | คอมเมนต์ `SaveTransInput` ที่ `:149-151` |
| `expire_day/date`, `send_day/date`, `deposit_day/date` | คู่ จำนวนวัน/วันที่ ของใบเสนอราคา ส่งของ และมัดจำ | `trans.go:153-155` |
| `send_type` | 0 รับเอง / 1 ส่งให้ (UPDATE ต่อท้ายเมื่อ ≠ 0) | `trans.go:1175-1179` |
| `doc_group`, `remark_4`, `remark_5`, `recheck_count`, `recheck_count_day`, `extra_word`, `cashier_code` | กลุ่มเอกสาร หมายเหตุ 4-5 จำนวนครั้งตรวจซ้ำ ข้อความเพิ่ม รหัสแคชเชียร์ (เขียนด้วย UPDATE ต่อท้ายหลัง INSERT เฉพาะเมื่อมีค่า) | `trans.go:1171` |
| `branch_code_to`, `side_code_to`, `department_code_to`, `allocate_code_to`, `project_code_to`, `job_code_to` | มิติปลายทางของเอกสารโอน (ว่าง = ใช้สาขาที่ล็อกอิน) | `trans.go:1171,1198` |
| `last_status` | 0 ปกติ / 1 ยกเลิก (ใส่ 0 ตอน INSERT; ค่าจริง derive ทีหลัง) | `trans.go:688`, `doc_flow.go:13-16` |

## คอลัมน์ที่ระบบ derive (ไม่ได้มาจากการกรอก)

`docFlowTx` คำนวณใหม่จากแถวดิบหลังบันทึก/ลบ/ยกเลิก/อนุมัติ: `last_status`, `used_status`, `used_status_2`, `doc_success`, `approve_status` (`doc_flow.go:13-16,363-364`) ดูตัวอย่างสูตร `doc_success` ใน `doc_flow.go:18-28`

- `used_status` / `used_status_2`: มีเอกสารอื่นอ้างถึงเอกสารนี้แล้ว (เช่น ใบเสนอราคาที่ถูกดึงไปเป็นใบสั่งขาย)
- `doc_success`: เอกสารถูกดึงไปใช้ครบแล้ว (มีหลายสูตรตามชนิดเอกสาร)
- `approve_status`: ผลอนุมัติจากเอกสารอนุมัติที่ชี้มา หรือจาก `erp_credit_approved_logs` ([[tbl-erp-credit-approved-logs]])
- ยกเลิกเป็นเอกสารแยก: ใบยกเลิกมี `trans_flag` ของการยกเลิกและ `doc_ref` = เลขที่เอกสารเดิม แล้ว `last_status` ของเอกสารเดิมถูก derive จากใบยกเลิก (`doc_cancel.go:12-19`); ใบยกเลิกต่อรายการมี `cancel_type = 2` (`doc_flow.go:52`)

## ลำดับเมื่อบันทึก (`saveTransTx`, `trans.go:510-591`)

1. ล็อกเอกสารและสินค้าที่เกี่ยวข้อง; ถ้า `IsNew` ปฏิเสธ `doc_no`+`trans_flag` ซ้ำ
2. ลบของเดิมทั้งหมดของเอกสาร: `ic_trans_serial_number`, `ic_trans_shipment`, `ic_trans_detail`, `ic_trans` — บันทึกซ้ำจึงเป็น delete-and-replace
3. INSERT หัว ([[tbl-ic-trans]]) แล้วรายการ ([[tbl-ic-trans-detail]]), ตามด้วยแท็บรับ/จ่ายชำระ → `cb_trans` ([[tbl-cb-trans]]) และคำสั่งที่เหลือ (Serial, ที่อยู่จัดส่ง [[tbl-ic-trans-shipment]], cheque)
4. `docFlowTx` derive สถานะเอกสาร (ตัวเอง + เอกสารต้นทางที่ชี้)
5. `rebuildSerialTx` สร้าง [[tbl-ic-serial]] ใหม่
6. `rebuildTransDerived`: `rebuildStockTx` คำนวณสต๊อก/ต้นทุน ([[acc-inventory-cost-moving-average]]), `rebuildGLTx` ตั้งสมุดรายวัน ([[acc-gl-posting-standard]], [[tbl-gl-journal]]), โอนเงิน/โอนสต๊อกคู่ขนาน, และสถานะเช็ค (`trans_flag` 405-418, 451-456, 461-463) ([[tbl-cb-chq-list]]) — `trans.go:593-629`

ลบเอกสาร (`deleteTransTx`, `trans.go:395`) ปฏิเสธถ้ามีเอกสารอื่นอ้างถึงแล้ว หรือถ้ามัดจำถูกใช้แล้ว

## ความสัมพันธ์

- 1:n [[tbl-ic-trans-detail]] ผ่าน (`doc_no`, `trans_flag`) — โอนคลัง (`transFlagTransferOut`) มีแถว detail คู่ของ transfer-in ด้วย (`transDetailFlags`, `trans.go:635-640`)
- โอนคลัง 72 มีหัวคู่ `trans_flag = 70` ที่ถูกสร้างใหม่จากหัว 72 ทุกครั้ง (สลับ branch/side/department/project/allocate/job กับคอลัมน์ `_to`; ลบ 72 แล้วหัว 70 หายด้วย) — `syncStockTransferIn`, `stock_rebuild.go:66-80`
- n:1 [[tbl-ar-customer]] / [[tbl-ap-supplier]] ผ่าน `cust_code` ตาม `trans_type`
- 1:n [[tbl-ic-trans-serial-number]], 1:1 [[tbl-ic-trans-shipment]]
- 1:1 [[tbl-cb-trans]] (แท็บรับ/จ่ายชำระ) และ [[tbl-ap-ar-trans]] (ตัดหนี้) ผ่าน `doc_no`+`trans_flag`
- 1:n [[tbl-gl-journal]] ผ่าน `doc_no`+`trans_flag` (สร้างโดย `rebuildGLTx`)

## ข้อควรระวัง

- ตารางนี้ **ไม่มีสต๊อกในตัวเอง** ยอดสต๊อกมาจากแถวใน [[tbl-ic-trans-detail]] เท่านั้น และเฉพาะ `trans_flag` ที่อยู่ใน `stockRowsSQL` (`stock_rebuild.go:18-22`)
- `is_doc_copy = 1` (สำเนาเอกสาร) ต้องถูกกรองทิ้งในรายงาน/สต๊อก (`stock_rebuild.go:16-18`, `report_menu_ap_ar.go:255-256`, `gl_template.go:1108`)
- บัญชี/เงิน: ยอดทุกตัวเป็น decimal (`::numeric`) ส่งเป็น string; ห้ามใช้ float (กฎเหล็กข้อ 20)
- ลำดับ derive ต้องไม่สลับ: สต๊อกก่อน GL เพราะ GL ใช้ต้นทุนที่เพิ่งคำนวณ

## ที่มาในโค้ด

- `backend/internal/application/process/trans.go:101-262` (SaveTransInput), `:395-` (deleteTransTx), `:510-591` (saveTransTx), `:593-640`, `:642`, `:657-690` (insertTransSQL), `:1375`
- `backend/internal/application/process/doc_flow.go:13-60`, `:355-372`
- `backend/internal/application/process/doc_cancel.go:12-34`, `:326`
- `backend/internal/application/process/stock_rebuild.go:15-29`
- `backend/internal/application/process/gl_template.go:768-769`, `:1108`
- `backend/internal/application/process/report_menu_ap_ar.go:255-256`
