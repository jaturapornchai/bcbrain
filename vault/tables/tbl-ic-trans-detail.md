---
title: "รายการสินค้าในเอกสาร (ic_trans_detail)"
tags: [tables, ic]
aliases: ["ic_trans_detail", "บรรทัดเอกสาร", "รายการสินค้าในบิล", "stock movement", "line_number"]
sources: ["backend/internal/application/process/trans.go:33", "backend/internal/application/process/trans.go:692", "backend/internal/application/process/trans.go:1098", "backend/internal/application/process/transcalc.go:14", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/stock_rebuild.go:57", "backend/internal/application/process/service.go:214", "backend/internal/application/process/service.go:630", "backend/internal/application/process/service.go:823", "backend/internal/application/process/service.go:945", "backend/internal/application/process/service.go:1018", "backend/internal/application/process/trans_set_item.go:22", "backend/internal/application/process/report_menu_ic.go:244", "backend/internal/application/process/pos_config.go:295", "backend/internal/platform/db/pool.go:32", "backend/internal/application/process/fx.go:200", "backend/internal/application/process/stock_beginning.go:516", "backend/internal/application/process/doc_approve_item.go:64", "backend/internal/application/process/gl_template.go:860", "backend/internal/application/process/cheque.go:90", "scripts/sql/02_data_schema.sql:6754", "frontend/account/process/SystemProcessWorkbenchScreen.tsx:1495", "frontend/account/master/ItemScreen.tsx:2246", "AGENTS.md:61"]
---
# รายการสินค้าในเอกสาร (`ic_trans_detail`)

**หน้าที่:** บรรทัดรายการของทุกเอกสารใน [[tbl-ic-trans]] (สินค้า, จำนวน, ราคา, คลัง/ที่เก็บ, ต้นทุน) และเป็น **แหล่งเดียวของยอดสต๊อกและต้นทุน** — ไม่มีตารางยอดคงเหลือแยก ยอดใน [[tbl-ic-inventory]] (`balance_qty`, `average_cost`) คือค่า derive จากตารางนี้ ดู [[acc-inventory-cost-moving-average]], [[acc-inventory-stock-rebuild]]

## คีย์และความสัมพันธ์

- เชื่อมหัวผ่าน (`doc_no`, `trans_flag`) + `line_number` ไล่ 1..N ภายในเอกสาร
- `item_code` → [[tbl-ic-inventory]].code; `unit_code` → [[tbl-ic-unit-use]] (อัตราแปลง `stand_value`/`divide_value`) และ [[tbl-ic-unit]]
- `wh_code` + `shelf_code` → [[tbl-ic-warehouse]] / [[tbl-ic-shelf]] (คอลัมน์ของ ic_shelf คือ `whcode`)
- `ref_doc_no` ชี้เอกสารต้นทางที่ดึงรายการมา (ดัชนี `idx_ic_trans_detail_ref_doc` เฉพาะ `ref_doc_no <> ''` ที่ `service.go:951-953`)
- `chq_number` + `doc_ref` + `ref_row` เชื่อมแถวเช็คใน [[tbl-cb-chq-list]] (เอกสารตระกูล 405-476)
- 1:n [[tbl-ic-trans-serial-number]] ผ่าน `line_number` ของแถวนี้
- DDL อยู่ที่ `scripts/sql/02_data_schema.sql:6754-6881` (126 คอลัมน์ รวมคอลัมน์ระบบ `ignore_sync`, `is_lock_record`, `roworder`, `create_date_time_now`) ส่วนที่ INSERT ของเอกสารเขียนดูที่ `insertTransDetailSQL` `trans.go:692-723` และ `TransLine` `trans.go:33-96`
- คอลัมน์ที่ **ไม่มีใน DDL** มี 4 ตัว คือ `approve_status`, `approve_qty`, `wht_amount`, `item_name_2` — Go เพิ่มด้วย `ALTER TABLE … ADD COLUMN IF NOT EXISTS` (`service.go:823-826`, `pool.go:32-35`); ส่วน `is_pos` (`pos_config.go:295`) มีใน DDL แล้ว (`smallint`) คำสั่ง ALTER จึงไม่มีผล

## คอลัมน์สำคัญ

| column | ความหมาย | หมายเหตุ |
|---|---|---|
| `doc_no`, `doc_date`, `doc_time` | คัดลอกจากหัวเอกสาร | `trans.go:709,1101` |
| `doc_date_calc`, `doc_time_calc` | วัน-เวลาที่ใช้เรียงลำดับคิดต้นทุน/สต๊อก (ตอนบันทึกเท่า `doc_date`/`doc_time` ทุกแถว; แถวโอนเข้า 70 ใช้เวลาที่เลื่อนไปด้วย `transferInTime`) | `trans.go:709,1125-1127`, ดัชนี replay `service.go:945-947` |
| `line_number`, `trans_type`, `trans_flag` | ลำดับบรรทัด, ประเภทกลุ่ม, ชนิดเอกสาร | `trans.go:1099,1102` |
| `calc_flag` | ทิศทางสต๊อก +1 เข้า / -1 ออก / 0 ไม่กระทบ ตามตาราง `calcFlagByTransFlag` (ชนิดเอกสารที่ไม่อยู่ในตาราง = 0) | `transcalc.go:14-27`, `trans.go:1152` |
| `item_code`, `item_name`, `item_name_2` | สินค้า + ชื่อที่พิมพ์ในบรรทัด (`item_name_2` มีคอลัมน์จาก ALTER แต่ INSERT ของเอกสารไม่ได้เขียนค่า) | `trans.go:1103`, `service.go:826` |
| `unit_code`, `stand_value`, `divide_value`, `ratio` | หน่วยนับ และอัตราแปลง (qty ฐาน = qty × stand_value ÷ divide_value) ถ้าว่างใช้ 1 | `trans.go:1103-1104` |
| `branch_code` | สาขาของบรรทัด: `insertTransDetailSQL` ไม่มีคอลัมน์นี้ ค่าที่ตั้งตอนบันทึกเอกสารคือบรรทัดโอน (ยอดยกมาสต๊อกและใบอนุมัติใบขอซื้อเขียนเอง — ดูหัวข้อ "คอลัมน์อื่นที่ Go ใช้"): หลังบันทึก `transferDetailPairSQL` ตั้งแถว 72 = สาขาที่ผู้ใช้ล็อกอิน, แถว 70 = `branch_code_to` ของหัว (ว่าง = สาขาที่ล็อกอิน) | `stock_rebuild.go:57-64`, `trans.go:1197-1198` |
| `wh_code`, `shelf_code`, `wh_code_2`, `shelf_code_2` | คลัง/ที่เก็บของบรรทัด (ว่าง = ค่า `wh_from`/`location_from` ของหัว แล้ว `01`; เอกสารกลุ่มที่ไม่มีคอลัมน์คลังในตารางกริดจะเก็บว่าง) และคลัง/ที่เก็บปลายทาง: ใบขอโอน 124 ใช้ `ToWhCode`/`wh_to` ส่วนโอน 72/70 ให้ `transferDetailPairSQL` ตั้งให้ชี้หากัน | `trans.go:967-970,1088-1093,1121-1122,1151`, `stock_rebuild.go:57-64` |
| `qty` | จำนวน (decimal) | `trans.go:1104` |
| `price`, `price_exclude_vat` | ราคาต่อหน่วย รวม/ไม่รวมภาษี | `trans.go:1105` |
| `discount`, `discount_amount` | ส่วนลดเป็นข้อความ ("5%" หรือ "10") และเป็นเงิน | `trans.go:46,1105` |
| `sum_amount`, `sum_amount_exclude_vat`, `total_vat_value` | มูลค่าบรรทัด รวม/ไม่รวมภาษี และภาษีของบรรทัด | `trans.go:1106,1113` |
| `tax_type`, `vat_type`, `inquiry_type`, `item_type` | ประเภทภาษีของบรรทัด, ภาษีของเอกสาร, ประเภทย่อยของเอกสาร, ประเภทสินค้า (ดู enum ใน [[tbl-ic-inventory]]) | `trans.go:1107` |
| `average_cost`, `sum_of_cost` | ต้นทุนเฉลี่ยต่อหน่วยและต้นทุนรวมของบรรทัด — ค่าเริ่มต้น = ต้นทุนที่ส่งมา ถ้าไม่ส่งใช้ราคา และ `sum_of_cost` = จำนวน × ต้นทุน แล้วถูกเขียนทับโดย rebuild สต๊อกเฉพาะแถวที่ค่าเปลี่ยน | `trans.go:1004,1058,1108`, `service.go:1262-1267`, [[acc-inventory-cost-moving-average]] |
| `average_cost_1` | คอลัมน์ต้นทุนสำรอง (ไม่ชัดจากโค้ดว่าใช้ทำอะไร นอกจากตั้งเป็น 0 เมื่อ NULL) | `service.go:638` |
| `is_lock_cost`, `sum_of_cost_fix` | ล็อกต้นทุน: `is_lock_cost` = 1 → rebuild ใช้ `sum_of_cost_fix` เป็นต้นทุนรวมของบรรทัดขาออกและบรรทัดโอน 72/70 แทนต้นทุนเฉลี่ย (ต้นทุนต่อหน่วยของบรรทัดขาออก = `sum_of_cost_fix` ÷ จำนวนฐาน); ค่าอื่นนอกจาก 0/1 ถูกปฏิเสธ | บันทึก `trans.go:69-70,704,1075-1078,1112`; อ่านตอน rebuild `service.go:1168-1169`; ใช้ `service.go:219-225,239-251,307-313` |
| `chq_number`, `doc_ref`, `ref_row`, `date_due`, `item_code_2` | ฟิลด์เอกสารเช็ค/โอน: เลขเช็ค, เลขเอกสารเช็ค, แถวอ้างอิง, วันครบกำหนด, สมุดเงินฝากปลายทาง (422) | `trans.go:54-58` |
| `transfer_amount`, `fee_amount`, `bank_name`, `bank_branch` | ฟิลด์เฉพาะโอน (422) และเช็ค (405/406) | `trans.go:59-62` |
| `remark` | รายละเอียดบรรทัด | `trans.go:63` |
| `ref_doc_no`, `doc_ref_type`, `date_expire` | เอกสารที่ดึงมา, ชนิดเอกสารอ้างอิง (0 = ไม่มี), วันหมดอายุ | `trans.go:65-67` |
| `lot_number_1` | เลข LOT ของบรรทัด (ตั้งด้วย UPDATE ต่อท้ายถ้าผู้ใช้กรอก; เอกสารโอนตั้งให้ทั้งแถว 72 และ 70) | `trans.go:1129-1134,1154-1159`, ดัชนี `service.go:948-950` |
| `ref_guid`, `set_ref_line`, `item_code_main`, `set_ref_qty`, `price_set_ratio`, `set_ref_price` | การขยายสินค้าชุด: แถวชุดมี `ref_guid` (`trans_set_item.go:83`); แถวย่อยชี้กลับด้วย `set_ref_line` พร้อม `item_code_main`, `set_ref_qty` (`:91`), `price_set_ratio` (`:97`), `set_ref_price` (`:107`) | `trans_set_item.go:83-107`, [[tbl-ic-inventory-set-detail]] |
| `price_type`, `price_mode`, `price_guid`, `is_get_price` | แหล่งที่มาของราคาที่ตารางราคาหาได้ (-1 ไม่มี, 1-7 ค้นในระบบ, 99 ศูนย์ราคา) | `trans.go:73-77` |
| `is_permium` | 1 = สินค้าแถม (ชื่อคอลัมน์สะกด `permium` ตามเดิม) | `trans.go:85` |
| `is_serial_number`, `mfd_date`, `mfn_name` | สินค้ามี Serial, วันที่ผลิต, ผู้ผลิต | `trans.go:88-91` |
| `unit_code_2`, `qty_2`, `unit_size`, `total_qty` | หน่วยช่วยขาย / จำนวนขาย / ขนาด / จำนวน packaging — เขียนเมื่อเปิดสวิตช์ใน erp_option เท่านั้น | `trans.go:92-95` ([[tbl-erp-option]]) |
| `last_status`, `is_doc_copy` | `last_status` ตอนบันทึกเป็น 0 เสมอ แล้วถูกตั้ง 1 เมื่อหัวถูกยกเลิก (เครื่องมือตรวจสอบ Flow); `is_doc_copy` = 1 คือสำเนาเอกสาร ไม่นับสต๊อก (โค้ด Go มีแต่อ่าน/กรองคอลัมน์นี้ ไม่มีที่ตั้งค่า) | `trans.go:702,717`, `service.go:730-731`, `stock_rebuild.go:18` |
| `approve_status`, `approve_qty` | คอลัมน์ระดับบรรทัดที่ Go สร้างให้ด้วย ALTER (ค่าเริ่มต้น 0) — backend/frontend ใน repo ไม่อ่านหรือเขียนค่า ชื่อสื่อถึงผลอนุมัติและจำนวนที่อนุมัติ | `service.go:823-824` |
| `wht_amount` | คอลัมน์ที่ Go สร้างให้ด้วย ALTER (ค่าเริ่มต้น 0) — โค้ดใน repo ไม่อ่านหรือเขียนค่าของตารางนี้ ชื่อสื่อถึงภาษีหัก ณ ที่จ่ายระดับบรรทัด | `service.go:825` |
| `roworder` | ลำดับแถวจริงในตาราง ใช้เป็นตัวตัดสินเมื่อเวลาเท่ากันตอน replay และเป็นคีย์อัปเดตต้นทุนกลับ | `service.go:945-947,1262-1267` |

## คอลัมน์อื่นที่ Go ใช้ (มีใน DDL แต่ไม่อยู่ใน `insertTransDetailSQL`)

- `price_2`, `sum_amount_2`: ค่าที่กรอกเป็นสกุลเงินต่างประเทศ UPDATE ตามเลขบรรทัดตอนบันทึกในโหมดหลายสกุลเงิน (`fx.go:200-203`); `sum_amount_2` ถูกอ่านต่อที่ `gl_template.go:860` และ `trans_ref_import_remain.go:30`
- `sum_of_cost_1` (ต้นทุนรวมต้นทุนแฝง), `profit_lost_cost_amount`: ไม่พบโค้ด Go เขียนค่า มีแต่อ่าน — GL (`gl_template.go:860-861`), รายงานสต๊อก (`report_menu_ic.go:236,260,749`); `hidden_cost_1`, `hidden_cost_1_exclude_vat` มีที่เขียนเดียวคือยอดยกมาสต๊อกที่ใส่ 0 (`stock_beginning.go:524`) และ `hidden_cost_1_exclude_vat` ถูกอ่านที่ `report_menu_ic.go:749`
- `bank_name_2`, `bank_branch_2` (คู่กับ `item_code_2`): ใบโอนคู่ 72/70 สลับค่ากับ `bank_name`, `bank_branch` (`transferPairSwaps`, `cheque.go:90-93`)
- เขียนโดย INSERT ของโมดูลอื่น: ยอดยกมาสต๊อก (`sbInsertDetail`, `stock_beginning.go:516-538`) ตั้ง `branch_code`, `barcode`, `ref_line_number` = 0 และ `cust_code`, `sale_code`, `sale_group`, `sale_shift_id` เป็นค่าว่าง, `auto_create` = 0; ใบอนุมัติใบขอซื้อ (`insertApproveLines`, `doc_approve_item.go:59-76`) คัดลอก `cust_code`, `branch_code`, `barcode`, `due_date` จากบรรทัดใบขอซื้อ เก็บค่าที่ขอไว้ใน `temp_float_1` (จำนวน), `temp_float_2` (ราคา), `temp_string_1` (ส่วนลด) และชี้บรรทัดต้นทางด้วย `ref_doc_no`/`ref_line_number`/`ref_row`
- `cust_code` และ `price_2` ยังถูกอ่านตอนค้นราคาซื้อล่าสุดของคู่ค้า (`findPurchasePrice`, `price_engine.go:270-278`; ใช้ `price_2` เมื่อเปิดหลายสกุลเงิน)
- อยู่ใน DDL แต่ไม่พบโค้ด Go อ่านหรือเขียนคอลัมน์เหล่านี้ใน SQL ของ `ic_trans_detail`: `doc_group`, `ref_doc_date`, `ref_cust_code`, `department_code`, `cancel_qty`, `ic_pattern`, `ic_color`, `ic_size`, `priority_level`, `user_approve`, `discount_number`, `price_changed`, `discount_changed`, `price_default`, `hidden_cost_2`, `hidden_cost_2_exclude_vat`, `price_base`, `creator_code`, `last_editor_code`, `create_datetime`, `lastedit_datetime`, `discount_amount_2`, `bat_date`, `bat_number`, `product_year`, `product_week`, `currency_code`, `exchange_rate`, `exchange_rate_old`, `total_size`

## เอกสารที่ขยับสต๊อก

แถวจะถูกนับเข้าสต๊อกก็ต่อเมื่อ (`stockRowsSQL`, `stock_rebuild.go:18-22`): `last_status = 0`, `is_doc_copy = 0`, `item_type` อยู่ใน (0, 4, 6) และ `trans_flag` อยู่ในชุด 12, 310, 14, 311, 16, 44, 46, 48, 54-73, 521-523 พร้อมข้อยกเว้นของ 46 (`inquiry_type <> 0`), 48 (`inquiry_type > 1`), และ 44 ที่มี `doc_ref` + `is_pos = 1` — บรรทัดบริการ (`item_type` 1), สินค้าชุด (3, 5) และเอกสารเสนอราคา/สั่งซื้อจึง **ไม่ขยับสต๊อก** ดู [[acc-stock-special-docs]]

- บรรทัดแก้ราคาอย่างเดียว (14, 16, 311 ที่ `inquiry_type` 1 หรือ 3) ปรับ **มูลค่า** แต่ไม่ปรับจำนวน (`stockValueOnlySQL`, `stock_rebuild.go:26`)
- ยอด `ic_inventory.balance_qty` = ผลรวมแถวด้วย `stockBalancePredicate` (`stock_rebuild.go:29`)

## กระบวนการที่แตะตาราง

- **เขียน:** `saveTransTx` ลบแล้ว INSERT ทั้งเอกสารใหม่ทุกครั้งที่บันทึก (`trans.go:510-589`) ดู [[acc-transaction-save-flow]]
- **โอนคลัง:** เอกสาร `trans_flag` 72 (โอนออก) เขียนสองแถวต่อสินค้า — แถว 72 `calc_flag = -1` และแถวคู่ 70 `calc_flag = +1` ที่คลังปลายทาง คู่เป็น line_number n (72) และ n+1 (70) โดยแถวเข้าเลื่อนเวลาไป 1 นาที (`transferInTime`, `stock_rebuild.go:47-52`; `trans.go:1120-1128`) แล้ว `transferDetailPairSQL` ตั้ง `wh_code_2`/`shelf_code_2` ให้ชี้หากันและตั้ง `branch_code` (`stock_rebuild.go:57-64`, เรียกที่ `trans.go:1197-1198`); ตอนลบ/อ่านต้องรวมทั้ง 72 และ 70 (`transDetailFlags`, `trans.go:635-640`)
- **คำนวณต้นทุน:** `rebuildStockTx` (`service.go:1018`) เขียน `average_cost`/`sum_of_cost` กลับเฉพาะแถวที่ค่าเปลี่ยน อ้างด้วย `roworder` (`service.go:1198-1205,1262-1267`) ([[acc-inventory-cost-moving-average]])
- **ซ่อมข้อมูลดิบ** (หน้า `SystemProcessWorkbenchScreen`): ช่อง "ตรวจสอบและปรับปรุง อัตราส่วนหน่วยนับ" (`SystemProcessWorkbenchScreen.tsx:1495` ค่าเริ่มต้นเปิดที่ `SystemProcessWorkbenchScreen.tsx:203`) ตั้ง `stand_value`/`divide_value` ให้ตรง [[tbl-ic-unit-use]] และตั้ง `average_cost_1` เป็น 0 เมื่อ NULL ด้วย `updateUnitRatioDetailTx` (`service.go:630-638` เรียกที่ `service.go:604-607` ในขั้น rebuild); ปุ่ม "ตรวจสอบ Flow การอ้างอิงเอกสาร" (`SystemProcessWorkbenchScreen.tsx:1552`) ตั้ง `last_status = 1` ให้บรรทัดของหัวที่ยกเลิกด้วย `recheckDocFlowTx` (`service.go:727-731`); ปุ่ม "Update ic_trans_detail" (`SystemProcessWorkbenchScreen.tsx:1536-1540`) คำนวณ `price_exclude_vat`, `discount_amount`, `total_vat_value` ใหม่ด้วย `updateTransDetailRecalcTx` (`stock_rebuild.go:226-277`)
- **รายงาน:** ยอดคงเหลือสต๊อกอ่านจากตารางนี้ผ่าน CTE กลาง `icStockCTE`/`icStockCTEWith` (`report_menu_ic.go:239-263`; เรียกใช้ตัวอย่างที่ `report_menu_ic.go:504` และที่ `report_menu_ic.go:1113` สำหรับยอดคงเหลือตาม Serial) ส่วนรายงาน LOT คงเหลืออ่านจาก [[tbl-ic-trans-detail-lot]] ไม่ใช่ตารางนี้ (`report_menu_ic.go:1227`)

## ข้อควรระวัง

- เปลี่ยนรหัสสินค้า (`item_code`) ต้องไล่แก้ตารางนี้ด้วย (`workflow.go:145`) มิฉะนั้นยอดสต๊อกหาย
- `ic_inventory.item_type` 3 และ 5 ถูกจัดเป็นสินค้าชุด (`isSetItem`, `trans_set_item.go:22`); หน้าข้อมูลสินค้าเรียกค่า 5 ว่า "สูตรสี" (`ItemScreen.tsx:2246`, `trans_set_item.go:199`) ขณะรายงานเรียก "สูตรการผลิต" (`report_menu_ic.go:913`) — ดู [[tbl-ic-inventory]]
- เงินและจำนวนทุกคอลัมน์เป็น decimal ส่งเป็น string; ห้ามใช้ float (กฎข้อ 20 ใน `AGENTS.md:61`)
- จำนวนจริงของสต๊อก = `qty × stand_value ÷ divide_value` ไม่ใช่ `qty` ตรงๆ เมื่อสินค้ามีหลายหน่วย (`unit_type` 1, 3; สินค้า `unit_type` 0, 2 ถูกตั้งเป็น 1 ทั้งคู่ — `service.go:214-215,634-637`)
- การเรียงลำดับ replay ใช้ `COALESCE(doc_date_calc, doc_date)`, `COALESCE(NULLIF(doc_time_calc,''), doc_time)`, `roworder` (ดัชนี `service.go:945-947`) — อย่าเปลี่ยนวัน-เวลาโดยตรงนอก flow

## ที่มาในโค้ด

- `backend/internal/application/process/trans.go:33-96` (TransLine), `:510-589`, `:635-640`, `:692-723` (insertTransDetailSQL), `:967-970`, `:1004`, `:1058`, `:1075-1078`, `:1098-1159`, `:1197-1198`
- `backend/internal/application/process/transcalc.go:14-27`
- `backend/internal/application/process/stock_rebuild.go:18-29`, `:47-64`, `:226-277`
- `backend/internal/application/process/service.go:214-215`, `:219-225`, `:239-251`, `:307-313`, `:604-607`, `:630-638`, `:727-731`, `:823-826`, `:945-953`, `:1018`, `:1168-1169`, `:1198-1205`, `:1262-1267`
- `scripts/sql/02_data_schema.sql:6754-6881` DDL ของ `ic_trans_detail`
- `backend/internal/application/process/pos_config.go:295`
- `backend/internal/application/process/fx.go:200-203`; `stock_beginning.go:516-538`; `doc_approve_item.go:59-76`; `cheque.go:90-93`; `gl_template.go:860-861`; `price_engine.go:270-278`; `trans_ref_import_remain.go:30`
- `backend/internal/platform/db/pool.go:32-35`
- `backend/internal/application/process/trans_set_item.go:22`, `:83-107`, `:199`
- `backend/internal/application/process/report_menu_ic.go:239-263`, `:504`, `:913`, `:1113`, `:1227`
- `frontend/account/process/SystemProcessWorkbenchScreen.tsx:203`, `:1495`, `:1536-1540`, `:1552`
- `frontend/account/master/ItemScreen.tsx:2246`
- `AGENTS.md:61`
