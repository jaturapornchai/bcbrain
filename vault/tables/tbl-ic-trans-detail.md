---
title: "รายการสินค้าในเอกสาร (ic_trans_detail)"
tags: [tables, ic]
aliases: ["ic_trans_detail", "บรรทัดเอกสาร", "รายการสินค้าในบิล", "stock movement", "line_number"]
sources: ["backend/internal/application/process/trans.go:34", "backend/internal/application/process/trans.go:692", "backend/internal/application/process/trans.go:1097", "backend/internal/application/process/transcalc.go:12", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/service.go:812", "backend/internal/application/process/service.go:934", "backend/internal/application/process/trans_set_item.go:8"]
---
# รายการสินค้าในเอกสาร (`ic_trans_detail`)

**หน้าที่:** บรรทัดรายการของทุกเอกสารใน [[tbl-ic-trans]] (สินค้า, จำนวน, ราคา, คลัง/ที่เก็บ, ต้นทุน) และเป็น **แหล่งเดียวของยอดสต๊อกและต้นทุน** — ไม่มีตารางยอดคงเหลือแยก ยอดใน [[tbl-ic-inventory]] (`balance_qty`, `average_cost`) คือค่า derive จากตารางนี้ ดู [[acc-inventory-cost-moving-average]], [[acc-inventory-stock-rebuild]]

## คีย์และความสัมพันธ์

- เชื่อมหัวผ่าน (`doc_no`, `trans_flag`) + `line_number` ไล่ 1..N ภายในเอกสาร
- `item_code` → [[tbl-ic-inventory]].code; `unit_code` → [[tbl-ic-unit-use]] (อัตราแปลง `stand_value`/`divide_value`) และ [[tbl-ic-unit]]
- `wh_code` + `shelf_code` → [[tbl-ic-warehouse]] / [[tbl-ic-shelf]] (คอลัมน์ของ ic_shelf คือ `whcode`)
- `ref_doc_no` ชี้เอกสารต้นทางที่ดึงรายการมา (ดัชนี `idx_ic_trans_detail_ref_doc` เฉพาะ `ref_doc_no <> ''` ที่ `service.go:940`)
- `chq_number` + `doc_ref` + `ref_row` เชื่อมแถวเช็คใน [[tbl-cb-chq-list]] (เอกสารตระกูล 405-476)
- 1:n [[tbl-ic-trans-serial-number]] ผ่าน `line_number` ของแถวนี้
- ไม่มี DDL ใน repo; คอลัมน์ด้านล่างอนุมานจาก `insertTransDetailSQL` (`trans.go:692-723`) และ `TransLine` (`trans.go:34-99`) ส่วน `approve_status`, `approve_qty`, `wht_amount`, `item_name_2` เพิ่มด้วย ALTER ที่ `service.go:812-815`

## คอลัมน์สำคัญ

| column | ความหมาย | หมายเหตุ |
|---|---|---|
| `doc_no`, `doc_date`, `doc_time` | คัดลอกจากหัวเอกสาร | `trans.go:1099-1101` |
| `doc_date_calc`, `doc_time_calc` | วัน-เวลาที่ใช้เรียงลำดับคิดต้นทุน/สต๊อก (ปกติเท่า `doc_date`/`doc_time`; เอกสารโอนเข้าเลื่อนเวลา `transferInTime`) | ดัชนี replay `service.go:934-936` |
| `line_number`, `trans_type`, `trans_flag` | ลำดับบรรทัด, ประเภทกลุ่ม, ชนิดเอกสาร | `trans.go:1102` |
| `calc_flag` | ทิศทางสต๊อก +1 เข้า / -1 ออก / 0 ไม่กระทบ ตามตาราง `calcFlagByTransFlag` (พอร์ตจาก C# `_transStockCalcType`) | `transcalc.go:12-27` |
| `item_code`, `item_name`, `item_name_2` | สินค้า + ชื่อที่พิมพ์ในบรรทัด | `trans.go:1104`, `service.go:815` |
| `unit_code`, `stand_value`, `divide_value`, `ratio` | หน่วยนับ และอัตราแปลง (qty ฐาน = qty × stand_value ÷ divide_value) ถ้าว่างใช้ 1 | `trans.go:1105-1107` |
| `branch_code` | สาขาของบรรทัด (ตั้งตอนบันทึกโอน: แถว 72 = สาขาต้นทาง, แถว 70 = สาขาปลายทาง) | `stock_rebuild.go:57-65` |
| `wh_code`, `shelf_code`, `wh_code_2`, `shelf_code_2` | คลัง/ที่เก็บ และปลายทาง (ใช้กับเอกสารโอน) | `trans.go:1090-1093,1124` |
| `qty` | จำนวน (decimal) | `trans.go:1107` |
| `price`, `price_exclude_vat` | ราคาต่อหน่วย รวม/ไม่รวมภาษี | `trans.go:1108` |
| `discount`, `discount_amount` | ส่วนลดเป็นข้อความ ("5%" หรือ "10") และเป็นเงิน | `trans.go:1109` |
| `sum_amount`, `sum_amount_exclude_vat`, `total_vat_value` | มูลค่าบรรทัด รวม/ไม่รวมภาษี และภาษีของบรรทัด | `trans.go:1110,1119` |
| `tax_type`, `vat_type`, `inquiry_type`, `item_type` | ประเภทภาษีของบรรทัด, ภาษีของเอกสาร, ประเภทย่อยของเอกสาร, ประเภทสินค้า (ดู enum ใน [[tbl-ic-inventory]]) | `trans.go:1111` |
| `average_cost`, `sum_of_cost` | ต้นทุนเฉลี่ยต่อหน่วยและต้นทุนรวมของบรรทัด — ค่าเริ่มต้น = ราคา แล้วถูกเขียนทับโดย rebuild สต๊อก | `trans.go:1112`, [[acc-inventory-cost-moving-average]] |
| `average_cost_1` | คอลัมน์ต้นทุนสำรอง (ไม่ชัดจากโค้ดว่าใช้ทำอะไร นอกจากตั้งเป็น 0 เมื่อ NULL) | `service.go:627` |
| `is_lock_cost`, `sum_of_cost_fix` | ล็อกต้นทุน: 1 = rebuild ใช้ `sum_of_cost_fix` เป็นต้นทุนบรรทัด (Ctrl+F9 ใน C#) | `trans.go:68-70` |
| `chq_number`, `doc_ref`, `ref_row`, `date_due`, `item_code_2` | ฟิลด์เอกสารเช็ค/โอน: เลขเช็ค, เลขเอกสารเช็ค, แถวอ้างอิง, วันครบกำหนด, สมุดเงินฝากปลายทาง (422) | `trans.go:54-58` |
| `transfer_amount`, `fee_amount`, `bank_name`, `bank_branch` | ฟิลด์เฉพาะโอน (422) และเช็ค (405/406) | `trans.go:59-62` |
| `remark` | รายละเอียดบรรทัด | `trans.go:63` |
| `ref_doc_no`, `doc_ref_type`, `date_expire` | เอกสารที่ดึงมา, ชนิดเอกสารอ้างอิง (0 = ไม่มี), วันหมดอายุ | `trans.go:65-67` |
| `lot_number_1` | เลข LOT ของบรรทัด (ตั้งด้วย UPDATE ต่อท้ายถ้าผู้ใช้กรอก) | `trans.go:1156`, ดัชนี `service.go:937` |
| `ref_guid`, `set_ref_line`, `item_code_main`, `set_ref_qty`, `price_set_ratio`, `set_ref_price` | การขยายสินค้าชุด: แถวชุดมี `ref_guid`; แถวย่อยชี้กลับด้วย `set_ref_line` | `trans_set_item.go:8-15`, [[tbl-ic-inventory-set-detail]] |
| `price_type`, `price_mode`, `price_guid`, `is_get_price` | แหล่งที่มาของราคาที่ตารางราคาหาได้ (-1 ไม่มี, 1-7 ค้นในระบบ, 99 ศูนย์ราคา) | `trans.go:73-77` |
| `is_permium` | 1 = สินค้าแถม (ชื่อคอลัมน์สะกด `permium` ตามเดิม) | `trans.go:85` |
| `is_serial_number`, `mfd_date`, `mfn_name` | สินค้ามี Serial, วันที่ผลิต, ผู้ผลิต | `trans.go:88-91` |
| `unit_code_2`, `qty_2`, `unit_size`, `total_qty` | หน่วยช่วยขาย / จำนวนขาย / ขนาด / จำนวน packaging — เขียนเมื่อเปิดสวิตช์ใน erp_option เท่านั้น | `trans.go:92-95` ([[tbl-erp-option]]) |
| `last_status`, `is_doc_copy` | 0 ปกติ / 1 เอกสารถูกยกเลิก (derive จากหัว); สำเนาเอกสารไม่นับ | `service.go:720`, `stock_rebuild.go:18` |
| `approve_status`, `approve_qty` | ผลอนุมัติ/จำนวนที่อนุมัติระดับบรรทัด | `service.go:812-813` |
| `wht_amount` | ภาษีหัก ณ ที่จ่ายระดับบรรทัด | `service.go:814` |
| `roworder` | ลำดับแถวจริงในตาราง ใช้เป็นตัวตัดสินเมื่อเวลาเท่ากันตอน replay | `service.go:935` |

## เอกสารที่ขยับสต๊อก

แถวจะถูกนับเข้าสต๊อกก็ต่อเมื่อ (`stockRowsSQL`, `stock_rebuild.go:18-22`): `last_status = 0`, `is_doc_copy = 0`, `item_type` อยู่ใน (0, 4, 6) และ `trans_flag` อยู่ในชุด 12, 310, 14, 311, 16, 44, 46, 48, 54-73, 521-523 พร้อมข้อยกเว้นของ 46 (`inquiry_type <> 0`), 48 (`inquiry_type > 1`), และ 44 ที่มี `doc_ref` + `is_pos = 1` — บรรทัดบริการ (`item_type` 1), สินค้าชุด (3, 5) และเอกสารเสนอราคา/สั่งซื้อจึง **ไม่ขยับสต๊อก** ดู [[acc-stock-special-docs]]

- บรรทัดแก้ราคาอย่างเดียว (14, 16, 311 ที่ `inquiry_type` 1 หรือ 3) ปรับ **มูลค่า** แต่ไม่ปรับจำนวน (`stockValueOnlySQL`, `stock_rebuild.go:26-29`)
- ยอด `ic_inventory.balance_qty` = ผลรวมแถวด้วย `stockBalancePredicate` (`stock_rebuild.go:29`)

## กระบวนการที่แตะตาราง

- **เขียน:** `saveTransTx` ลบแล้ว INSERT ทั้งเอกสารใหม่ทุกครั้งที่บันทึก (`trans.go:510-591`) ดู [[acc-transaction-save-flow]]
- **โอนคลัง:** เอกสาร `trans_flag` 72 (โอนออก) เขียนสองแถวต่อสินค้า — แถว 72 `calc_flag = -1` และแถวคู่ 70 `calc_flag = +1` ที่คลังปลายทาง คู่เป็น line_number n (72) และ n+1 (70) โดยแถวเข้าเลื่อนเวลาไป 1 นาที (`transferInTime`, `stock_rebuild.go:47-52`; `trans.go:1097-1118`) แล้ว `transferDetailPairSQL` ตั้ง `wh_code_2`/`shelf_code_2` ให้ชี้หากันและตั้ง `branch_code` (`stock_rebuild.go:57-65`); ตอนลบ/อ่านต้องรวมทั้ง 72 และ 70 (`transDetailFlags`, `trans.go:635-640`)
- **คำนวณต้นทุน:** `rebuildStockTx` เขียน `average_cost`/`sum_of_cost` กลับทุกแถว ([[acc-inventory-cost-moving-average]])
- **ซ่อมข้อมูลดิบ:** เครื่องมือ "ตรวจสอบข้อมูล" ตั้ง `stand_value`/`divide_value` ให้ตรง [[tbl-ic-unit-use]] และตั้ง `last_status = 1` ให้บรรทัดของหัวที่ยกเลิก (`service.go:623-627,720`)
- **รายงาน:** ยอดคงเหลือ/สต๊อกการ์ด/Serial/LOT ล้วนอ่านจากตารางนี้ (เช่น `report_menu_ic.go:303`, `:1172-1230`)

## ข้อควรระวัง

- เปลี่ยนรหัสสินค้า (`item_code`) ต้องไล่แก้ตารางนี้ด้วย (`workflow.go:145`) มิฉะนั้นยอดสต๊อกหาย
- `ic_inventory.item_type = 5` ถูกจัดเป็นชุดใน `trans_set_item.go:8-10` ("สูตรสี") ขณะรายงานเรียก "สูตรการผลิต" — ดู [[tbl-ic-inventory]]
- เงินและจำนวนทุกคอลัมน์เป็น decimal ส่งเป็น string; ห้ามใช้ float (กฎเหล็กข้อ 20)
- จำนวนจริงของสต๊อก = `qty × stand_value ÷ divide_value` ไม่ใช่ `qty` ตรงๆ เมื่อสินค้ามีหลายหน่วย (`unit_type` 1, 3)
- การเรียงลำดับ replay ใช้ `COALESCE(doc_date_calc, doc_date)`, `COALESCE(NULLIF(doc_time_calc,''), doc_time)`, `roworder` (ดัชนี `service.go:934`) — อย่าเปลี่ยนวัน-เวลาโดยตรงนอก flow

## ที่มาในโค้ด

- `backend/internal/application/process/trans.go:34-99` (TransLine), `:510-591`, `:635-640`, `:692-723` (insertTransDetailSQL), `:1097-1160`
- `backend/internal/application/process/transcalc.go:12-27`
- `backend/internal/application/process/stock_rebuild.go:18-29`
- `backend/internal/application/process/service.go:623-627`, `:720`, `:812-815`, `:934-941`
- `backend/internal/application/process/trans_set_item.go:8-15`
- `backend/internal/application/process/report_menu_ic.go:303`, `:1172-1230`
