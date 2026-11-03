---
title: "กลุ่มตาราง ic_ (สินค้า คลัง สต๊อก เอกสารซื้อ-ขาย)"
tags: [tables, ic]
aliases: ["ic_ tables", "กลุ่มตารางสินค้า", "inventory tables"]
sources: ["scripts/sql/02_data_schema.sql:5199", "backend/internal/application/process/service.go:641", "backend/internal/application/process/service.go:808", "backend/internal/application/process/trans.go:657", "backend/internal/application/process/item_master.go:812", "backend/internal/application/process/item_detail.go:174", "backend/internal/application/process/workflow.go:134", "backend/internal/application/process/master_detail_specs.go:144", "backend/internal/application/process/stock_rebuild.go:18"]
---
# กลุ่มตาราง `ic_` (สินค้า คลัง สต๊อก เอกสารซื้อ-ขาย)

ตารางตระกูล `ic_` คือหัวใจของระบบ เก็บ master สินค้า/คลัง/หน่วยนับ และเอกสารที่ขยับสต๊อกทั้งหมด (`ic_trans` + `ic_trans_detail`) โครงสร้างตารางเกือบทั้งหมดอยู่ใน `scripts/sql/02_data_schema.sql` (เช่น `ic_inventory` `:5199`, `ic_unit` `:7220`, `ic_warehouse` `:7270`) ที่ไม่พบ CREATE ในสคริปต์และโค้ดคือ `ic_manufacturer_list` และคอลัมน์ที่โค้ดใช้บางตัวไม่มีใน DDL (ดูโน้ตรายตาราง) กฎร่วม: เอกสารระบุด้วย (`doc_no`, `trans_flag`) ดู [[acc-trans-flag-map]]; บันทึกเอกสาร = ลบแล้วสร้างใหม่ ([[acc-transaction-save-flow]]); ยอดสต๊อก/ต้นทุนเป็นค่า derive จาก `ic_trans_detail` ([[acc-inventory-stock-rebuild]], [[acc-inventory-cost-moving-average]]) ภาพรวมทุกตระกูลอยู่ที่ [[tables-overview]]

## ก. เอกสารและการเคลื่อนไหวสต๊อก

- [[tbl-ic-trans]] — หัวเอกสารซื้อ/ขาย/รับ-เบิก/โอน/ปรับ/ใบเสนอราคา ทุกชนิดอยู่ตารางเดียว แยกด้วย `trans_flag`
- [[tbl-ic-trans-detail]] — บรรทัดสินค้าของเอกสาร และ **แหล่งเดียวของยอดสต๊อกและต้นทุน**
- [[tbl-ic-trans-serial-number]] — Serial ทีละเลขต่อบรรทัดเอกสาร (log การเคลื่อนไหว)
- [[tbl-ic-serial]] — ทะเบียน/สถานะปัจจุบันของแต่ละ Serial (derive จากตารางข้างบน)
- [[tbl-ic-trans-detail-lot]] — ยอดตาม LOT (เขียนเฉพาะยอดยกมา/ใบปรับล็อต; เอกสารปกติเขียนแค่ `lot_number_1`)
- [[tbl-ic-trans-shipment]] — ที่อยู่/ผู้ขนส่ง/เลขพัสดุของเอกสาร
- [[tbl-ic-hidden-cost-process]] — ต้นทุนแฝง/ต้นทุนนำเข้า (หัว + `_ref` เอกสารอ้างอิง + `_item` รายการ) เชื่อมกับใบปรับต้นทุน flag 66
- `ic_wms_trans_detail` — ใน backend แตะตารางนี้ที่เดียว คือเมื่อมีตาราง งานปรับอัตราแปลงหน่วยจะซิงก์ `stand_value`/`divide_value` ลงตารางนี้ (`service.go:641-647`) ไม่พบตัวอ่าน/เขียนอื่น

## ข. สินค้า (master)

- [[tbl-ic-inventory]] — ทะเบียนสินค้า (`code`, ชื่อ, ประเภท, วิธีคิดต้นทุน, `balance_qty`, `average_cost`)
- [[tbl-ic-inventory-detail]] — ตารางลูก 1:1 ของสินค้า เก็บมิติสินค้า คลัง/ที่เก็บ/หน่วยเริ่มต้นของการซื้อ-ขาย-เบิก จุดสั่งซื้อ และสวิตช์ต่างๆ
- [[tbl-ic-inventory-barcode]] — 1 แถว = 1 บาร์โค้ด ผูกหน่วยนับ และราคาขาย 4 ระดับที่ POS ใช้
- [[tbl-ic-inventory-barcode-price]] — เงื่อนไขส่วนลดของแต่ละบาร์โค้ด 5 ชนิด (`discount_type` 1-5)
- [[tbl-ic-inventory-price]] — ราคาขายตามหน่วย/ช่วงจำนวน/ช่วงวันที่/ชนิดการขาย แยกผู้ซื้อด้วย `price_type`
- [[tbl-ic-inventory-set-detail]] — ส่วนประกอบสินค้าชุด (`ic_set_code` → `ic_code`)
- [[tbl-ic-standard-cost]] — ต้นทุนมาตรฐานตามวันที่
- `ic_inventory_price_formula` — ราคาตามสูตร `price_0..price_9` ต่อ (`ic_code`, `unit_code`) ใช้เป็นราคากลางในกริดเอกสารและรายงานเปรียบเทียบ (`price_engine.go:203-226`, `trans_grid.go:702-748`, `master_detail_specs.go:192`)
- `ic_inventory_discount` — ส่วนลดตามลูกค้า/กลุ่ม/ทั่วไป ใช้ในเครื่องคิดราคา (`price_engine.go:79-85`, `master_detail_specs.go:65`)
- `ic_inventory_purchase_price` — ราคาซื้อ/ส่วนลดจากผู้ขาย (`price_engine.go:244`, `report_menu_ic.go:952-956`)
- `ic_inventory_suggest` / `ic_inventory_replacement` / `ic_inventory_bundle` — สินค้าแนะนำ / สินค้าทดแทน / สินค้าแพ็ก (คู่ `ic_code` กับรหัสปลายทาง) (`item_detail.go:182-187`)
- `ic_inventory_level` — ระดับสต๊อกของสินค้า (คอลัมน์ไม่ชัดจากโค้ดที่อ่าน; มีเครื่องมือลบแถวกำพร้า `sysproc_ic_checks_data.go:47`)
- `ic_name_merket`, `ic_name_billing`, `ic_name_short`, `ic_name_pos` — ชื่อสินค้าเสริม (การตลาด/ใบเสร็จ/ย่อ/POS) (`item_detail.go:175-178,488`)
- `ic_color_use`, `ic_size_use`, `ic_pattern_use` — สี/ขนาด/ลวดลายที่สินค้าใช้ (คู่ `code`, `ic_code`; master คือ `ic_color`, `ic_size`, `ic_pattern`) (`item_detail.go:179-181`)
- `ic_manufacturer_list` — ผู้ผลิตของสินค้า (`manufacturer_code` → `ap_supplier`) (`item_detail.go:189`)
- `ic_purchase_permium`, `ic_purchase_permium_condition`, `ic_purchase_permium_list` — เงื่อนไขของแถมจากการซื้อ (ชื่อตารางสะกด `permium` ตามที่เป็นในฐานข้อมูล) (`master_detail_specs.go:305-327`)
- `ic_report_sort_item` — ลำดับสินค้าในรายงาน (สร้างตารางเองเมื่อยังไม่มี, `master_detail.go:452-454`)

## ค. หน่วยนับ คลัง ที่เก็บ

- [[tbl-ic-unit]] — master หน่วยนับ
- [[tbl-ic-unit-use]] — หน่วยนับที่สินค้าแต่ละตัวใช้ + อัตราแปลง (`stand_value`/`divide_value`)
- [[tbl-ic-opposite-unit]] — คู่หน่วยตรงข้ามของสินค้าหน่วยขนาน (`unit_type` 2, 3) (backend สร้างตารางนี้เองใน `service.go:808-820` และมี DDL อีกชุดใน `scripts/sql/02_data_schema.sql:5935-5945`)
- [[tbl-ic-warehouse]] — master คลัง
- [[tbl-ic-shelf]] — ที่เก็บในคลัง (คอลัมน์ `whcode` ไม่มี underscore)
- [[tbl-ic-wh-shelf]] — คู่คลัง/ที่เก็บที่สินค้านั้นเก็บได้ + จุดต่ำสุด/สูงสุด

## ง. master จัดกลุ่มสินค้า (เขียนผ่านหน้าจอตั้งค่า `/query/exec`)

รายชื่ออยู่ใน legacy write allow-list (ADR-0011): `ic_account_group`, `ic_brand`, `ic_category`, `ic_class`, `ic_close_reason`, `ic_color`, `ic_design`, `ic_dimension`, `ic_dimension_name`, `ic_grade`, `ic_group`, `ic_group_sub`, `ic_group_sub2`, `ic_import_duty`, `ic_issue_type`, `ic_model`, `ic_pattern`, `ic_price_formula_template`, `ic_promotion_formula`, `ic_size`, `ic_stk_adjust_reason`, `ic_warehouse_location_group` — สินค้าอ้างผ่านคอลัมน์ เช่น `ic_inventory.group_main` → `ic_group` (`item_detail.go:50`) เป็นตารางรหัส/ชื่อธรรมดา ไม่มีตรรกะ derive

## จ. ตารางที่ถูกเก็บกวาดเมื่อลบ/เปลี่ยนรหัสสินค้า

`itemChildTables` (`item_master.go:812-814`) คือตารางลูกที่ถูกลบพร้อมสินค้า (บวก `ic_inventory_set_detail` และ `images` ที่ลบแยกที่ `:852-853`) ส่วนตอนเปลี่ยนรหัสสินค้า `changeCodeSpecs["item"]` แก้รหัสในตารางมากกว่านั้น (`workflow.go:133-148`) รวมถึง `ic_stk_build(_detail)`, `ic_promotion_detail`, `ic_relation_detail`, `ic_specific_search`, `ic_extra_detail` — ตารางเหล่านี้ไม่ได้อธิบายรายตัวที่นี่ ตารางที่ถูกลบพร้อมสินค้าแต่ไม่อยู่ในรายการเปลี่ยนรหัส ได้แก่ `ic_standard_cost` และ `ic_inventory_discount` ดู [[proc-master-data]], [[proc-item-master-detail]], [[proc-dispatcher]]

ตารางที่เกี่ยวกับสิทธิ์คลัง/ที่เก็บ (`erp_user_group_wh_shelf`) ดู [[proc-wh-shelf-permission]] และ [[proc-permission-rights]]

## ที่มาในโค้ด

- `scripts/sql/02_data_schema.sql:5199`, `:5935`, `:7220`, `:7270`
- `backend/internal/application/process/service.go:641-647`, `:808-820`
- `backend/internal/application/process/trans.go:657`
- `backend/internal/application/process/item_master.go:812`
- `backend/internal/application/process/item_detail.go:174`
- `backend/internal/application/process/workflow.go:134`
- `backend/internal/application/process/master_detail_specs.go:144`
- `backend/internal/application/process/stock_rebuild.go:18`
