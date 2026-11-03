---
title: "กลุ่มตารางสินทรัพย์ถาวร (as_*)"
tags: [tables, as]
aliases: ["as_*", "ตาราง as", "กลุ่มตารางสินทรัพย์", "fixed asset tables"]
sources: ["backend/internal/application/process/master_detail_specs.go:202", "backend/internal/application/process/master_detail_specs.go:227", "backend/internal/application/process/fa_depreciation.go:964", "backend/internal/application/process/fa_sale.go:513", "backend/internal/application/process/service.go:857", "backend/internal/application/process/report_menu_gl_fa.go:1647", "backend/internal/application/process/doc_no_next.go:12", "backend/internal/platform/db/pool.go:64", "backend/internal/domain/query/write_policy.go:24", "backend/internal/domain/query/write_policy_legacy.go:15", "frontend/account/master/BcLookupModal.tsx:108", "frontend/src/config/schemas/icMasterSchemas.ts:1027", "scripts/sql/02_data_schema.sql:1683"]
---

# กลุ่มตารางสินทรัพย์ถาวร (`as_*`)

รวมตารางที่ขึ้นต้น `as_` ที่ปรากฏในโค้ด `backend/internal` (SQL แบบ FROM / JOIN / INTO / UPDATE / DELETE FROM และตารางที่ถูกอ้างในสเปคหน้าจอ/ตัวกันลบ/allow-list ไม่รวมไฟล์ test) DDL ของทุกตารางในกลุ่มอยู่ใน `scripts/sql/02_data_schema.sql` (ตารางสินทรัพย์ `:1683-1942`, `as_trans*` `:1944-1994`) ไม่มี `CREATE TABLE` ของ `as_*` ในโค้ด Go มีเพียง `ALTER TABLE ... ADD COLUMN` ของ `as_asset_maintenance` สองคอลัมน์ (`doc_time`, `doc_format_code` `service.go:857-858`, `pool.go:64-65`) DDL ของ `as_trans` / `as_trans_detail` ระบุเฉพาะคอลัมน์พื้นฐาน คอลัมน์ที่เอกสารขาย 1802 เขียนเพิ่มไม่อยู่ใน DDL (ดู [[tbl-as-trans]], [[tbl-as-trans-detail]]) ระบบสินทรัพย์มี 2 เอกสารที่โปรแกรมนี้เขียน คือ **1801 โอนค่าเสื่อมราคา** และ **1802 ขายสินทรัพย์** (ดู [[acc-trans-flag-map]]) ตาราง `as_trans*` เป็น "ตารางเงิน" ตาม `moneyTablePattern` (`write_policy.go:24`) ห้ามเขียนผ่านหน้า master ทั่วไป ส่วน `as_asset`, `as_asset_location`, `as_asset_maintain`, `as_asset_maintain_unit`, `as_asset_maintenance`, `as_asset_retire`, `as_asset_type` อยู่ใน legacy write allow-list (ADR-0011, `write_policy_legacy.go:15-16`) ตารางอื่นของกลุ่มไม่อยู่ในรายการนี้ กระบวนการค่าเสื่อมดู [[acc-fixed-asset-depreciation]]

## ตารางที่มีโน้ตแยก

| ตาราง | บทบาท | ผู้เขียนหลัก | โน้ต |
|---|---|---|---|
| `as_trans` | หัวเอกสารสินทรัพย์ 1801 / 1802 | `insertDepDoc` `fa_depreciation.go:964`, `insertAssetSaleDoc` `fa_sale.go:513` | [[tbl-as-trans]] |
| `as_trans_detail` | บรรทัดเอกสาร (ค่าเสื่อมต่อสินทรัพย์ / รายการขาย) | ตัวเดียวกับหัว | [[tbl-as-trans-detail]] |
| `as_asset` | ทะเบียนสินทรัพย์ (ชื่อ ประเภท สามบัญชี GL) | หน้า master `menu_asset_lists` `master_detail_specs.go:202` | [[tbl-as-asset]] |
| `as_asset_detail` | ข้อมูลซื้อ ประกัน พารามิเตอร์ค่าเสื่อม และฟิลด์ขาย (1 แถวต่อสินทรัพย์) | หน้า master (grid `detail`) และเอกสารขาย `fa_sale.go:551` | [[tbl-as-asset-detail]] |
| `as_asset_type` | master ประเภทสินทรัพย์ (รหัส+ชื่อ) | หน้า master มาตรฐาน `menu_asset_setup_type` `icMasterSchemas.ts:787-792` | [[tbl-as-asset-type]] |

## ตารางอื่นในกลุ่ม (ไม่มีโน้ตแยก)

| ตาราง | บทบาท | ที่ใช้ในโค้ด |
|---|---|---|
| `as_asset_location` | master สถานที่ตั้งสินทรัพย์ (`code` varchar(10), `name_1`, `name_2`, `status`; DDL `02_data_schema.sql:1766`) | สินทรัพย์อ้างผ่าน `as_location` `master_detail_specs.go:210`; รายงานแสดงชื่อ `report_menu_gl_fa.go:1266`, `:1570`; หน้า master `menu_asset_setup_location` `icMasterSchemas.ts:1027-1031`; legacy allow-list `write_policy_legacy.go:15`; lookup หน้าจอ `BcLookupModal.tsx:109` |
| `as_asset_maintain` | master รายการซ่อมบำรุง (`code`, `name_1`, `name_2`, `status`; DDL `:1781`) | บรรทัดซ่อมอ้าง `maintain_code` `master_detail_specs.go:235`; ดึงชื่อมาเติมตอนบันทึก `master_detail_specs.go:696`; รายงาน `report_menu_gl_fa.go:1648`; หน้า master `menu_asset_setup_maintain` `icMasterSchemas.ts:1033-1037`; legacy allow-list |
| `as_asset_maintain_unit` | master หน่วยนับของรายการซ่อม (`code`, `name_1`, `name_2`, `status`; DDL `:1796`) | บรรทัดซ่อมอ้าง `maintain_unit` `master_detail_specs.go:236`; หน้า master `menu_asset_setup_maintain_unit` `icMasterSchemas.ts:1039-1043` และ `menu_setup_as_unit` `:1372-1376`; legacy allow-list; lookup `BcLookupModal.tsx:109` |
| `as_asset_maintenance` | หัวเอกสารซ่อมบำรุงสินทรัพย์: `doc_no` (คีย์), `doc_date`, `doc_time`, `doc_format_code`, `branch_code`, `side_code`, `department_code`, `remark`, `total_maintain_value` (ผลรวมราคาซ่อมที่คำนวณตอนบันทึก) DDL `02_data_schema.sql:1811` ไม่มี `doc_time`, `doc_format_code` | หน้า master `menu_asset_maintenance` `master_detail_specs.go:227-228`; `prepMaintenance` `master_detail_specs.go:682`; เพิ่มคอลัมน์ `doc_time`, `doc_format_code` ตอนเริ่มระบบ `service.go:857-858`, `pool.go:64-65`; legacy allow-list |
| `as_asset_maintenance_detail` | บรรทัดซ่อม: `as_code`, `maintain_code`, `maintain_name`, `maintain_unit`, `maintain_date`, `maintain_location`, `maintain_price`, `remark`, `line_number` (DDL `:1827`) | grid `lines` `master_detail_specs.go:231-233`; เป็นตัวกันลบสินทรัพย์ `master_detail_specs.go:221`; รายงานซ่อมบำรุง `report_menu_gl_fa.go:1647` |
| `as_asset_result` | ตารางลูกของสินทรัพย์ คีย์ `as_code` คอลัมน์ตาม DDL `02_data_schema.sql:1846`: `maintain_code`, `maintain_name`, `maintain_unit`, `description`, `status`, `line_number` | ถูกลบพร้อมสินทรัพย์เท่านั้น (`delChildren` `master_detail_specs.go:219`) ไม่มี SQL อื่นอ่าน/เขียน เอนจินค่าเสื่อมไม่ใช้ตารางนี้ (ความหมายทางธุรกิจไม่ชัดจากโค้ด) |
| `as_asset_sale_detail` | บรรทัดขายสินทรัพย์ตาม DDL `02_data_schema.sql:1903`: `as_code`, `as_value`, `depreciate_value`, `after_depreciate`, `sale_price`, `vat_value`, `net_value` | ใช้เป็นตัวกันลบสินทรัพย์ "มีการบันทึกขายสินทรัพย์นี้แล้ว" (`master_detail_specs.go:222`) เท่านั้น โค้ด Go ไม่เขียนตารางนี้ การขายของโปรแกรมนี้เขียน `as_trans` 1802 (`fa_sale.go:513`) |
| `as_asset_sale` | หัวเอกสารขายสินทรัพย์ตาม DDL `02_data_schema.sql:1875` (`doc_no`, `ar_code`, `sale_date`, `total_sale_price` ฯลฯ) | ไม่มี SQL/สเปคใดในโค้ด Go อ้างถึง |
| `as_asset_retire` | master ประเภทการตัดจำหน่าย (`code`, `name_1`, `name_2`, `status`; DDL `02_data_schema.sql:1860`) | หน้า master `menu_asset_setup_retire` `icMasterSchemas.ts:1045-1049`; legacy allow-list `write_policy_legacy.go:16`; ไม่มี SQL อื่นและไม่อยู่ในรายการ lookup |
| `as_resource` | DDL มีเฉพาะคอลัมน์ระบบมาตรฐาน (`02_data_schema.sql:1937`) | ไม่มีโค้ดอ้างถึง |

## ตารางภายนอกกลุ่มที่เอกสารสินทรัพย์เขียนด้วย
เอกสาร 1802 ยังเขียน `gl_journal`/`gl_journal_detail` ([[tbl-gl-journal]], [[tbl-gl-journal-detail]]), `gl_journal_vat_sale` ([[tbl-gl-journal-vat-sale]]), `gl_wht_list`/`gl_wht_list_detail` ([[tbl-gl-wht-list]], [[tbl-gl-wht-list-detail]]) และถ้าขายสดจะเขียน `cb_trans`/`cb_trans_detail` ([[tbl-cb-trans]], [[tbl-cb-trans-detail]]) ลำดับลบ 7-9 ตารางอยู่ที่ `fa_sale.go:487-496` ส่วน 1801 เขียนเฉพาะ `as_trans`, `as_trans_detail`, `gl_journal`, `gl_journal_detail` (`fa_depreciation.go:823-827`) กลุ่มตาราง GL ดู [[tbl-group-gl]]

## ข้อสังเกตรวม
- เลขที่เอกสารของ `as_trans` ออกผ่านตัวออกเลขกลาง (`nextDocNoTables` มี `as_trans` `doc_no_next.go:12`) เหมือน `ic_trans`, `ap_ar_trans`, `cb_trans`, `gl_journal`
- ความสัมพันธ์สินทรัพย์ → เอกสารใช้ `as_trans_detail.item_code` = `as_asset.code` ไม่มี foreign key ในฐาน ตัวกันลบทำด้วยโค้ด (`master_detail_specs.go:220-223`)
- ฟิลด์ที่เอนจินค่าเสื่อมอ่านจริงมีเฉพาะส่วนหนึ่งของ `as_asset_detail` (ราคาซื้อ ราคาซาก อายุ วันเริ่ม/สิ้นสุด มูลค่าที่คิด ยอดคงเหลือ ยอดสะสมยกมา) ดู [[tbl-as-asset-detail]]
- หน้าจอเลือกรายการ (lookup modal) อนุญาตตาราง `as_asset`, `as_asset_type`, `as_asset_location`, `as_asset_maintain`, `as_asset_maintain_unit` (`BcLookupModal.tsx:108-109`)

## ที่มาในโค้ด
- `backend/internal/application/process/master_detail_specs.go:202` spec `menu_asset_lists`
- `backend/internal/application/process/master_detail_specs.go:219` `delChildren` ของสินทรัพย์ (`as_asset_result`)
- `backend/internal/application/process/master_detail_specs.go:221` ตัวกันลบสินทรัพย์
- `backend/internal/application/process/master_detail_specs.go:227` spec `menu_asset_maintenance`
- `backend/internal/application/process/master_detail_specs.go:682` `prepMaintenance`
- `backend/internal/application/process/fa_depreciation.go:964` `insertDepDoc` (1801)
- `backend/internal/application/process/fa_sale.go:513` `insertAssetSaleDoc` (1802)
- `backend/internal/application/process/fa_sale.go:487` `deleteAssetSaleDoc`
- `backend/internal/application/process/service.go:857` ALTER `as_asset_maintenance`
- `backend/internal/platform/db/pool.go:64` ALTER `as_asset_maintenance` (ชุดที่สอง)
- `backend/internal/application/process/report_menu_gl_fa.go:1647` รายงานซ่อมบำรุง
- `backend/internal/application/process/doc_no_next.go:12` ตารางออกเลขที่ถัดไป
- `backend/internal/domain/query/write_policy.go:24` ตารางเงิน
- `backend/internal/domain/query/write_policy_legacy.go:15` legacy write allow-list
- `frontend/account/master/BcLookupModal.tsx:108` lookup ที่อนุญาต
- `frontend/src/config/schemas/icMasterSchemas.ts:1027` หน้า master ของ location / maintain / maintain unit / retire
- `scripts/sql/02_data_schema.sql:1683` DDL ของตารางสินทรัพย์

## ดูเพิ่ม
- [[acc-fixed-asset-depreciation]]
- [[acc-trans-flag-map]]
- [[tbl-group-gl]]
- [[proc-master-data]]
