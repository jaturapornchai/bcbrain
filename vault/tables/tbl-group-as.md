---
title: "กลุ่มตารางสินทรัพย์ถาวร (as_*)"
tags: [tables, as]
aliases: ["as_*", "ตาราง as", "กลุ่มตารางสินทรัพย์", "fixed asset tables"]
sources: ["backend/internal/application/process/master_detail_specs.go:202", "backend/internal/application/process/master_detail_specs.go:227", "backend/internal/application/process/fa_depreciation.go:964", "backend/internal/application/process/fa_sale.go:513", "backend/internal/application/process/service.go:846", "backend/internal/platform/db/pool.go:64", "backend/internal/domain/query/write_policy.go:24", "frontend/account/master/BcLookupModal.tsx:107"]
---

# กลุ่มตารางสินทรัพย์ถาวร (`as_*`)

รวมตารางที่ขึ้นต้น `as_` ที่ปรากฏในโค้ด `backend/internal` (SQL แบบ FROM / JOIN / INTO / UPDATE / DELETE FROM และตารางที่ถูกอ้างในสเปคหน้าจอ/ตัวกันลบ/allow-list ไม่รวมไฟล์ test) ตารางทั้งหมดเป็นตารางเดิมของระบบ BCERP (C#) โค้ดชุดนี้ **ไม่มี `CREATE TABLE` ของ `as_*` เลย** มีเพียง `ALTER TABLE ... ADD COLUMN` ของ `as_asset_maintenance` สองคอลัมน์ (`service.go:846-847`, `pool.go:64-65`) ระบบสินทรัพย์มี 2 เอกสารที่โปรแกรมนี้เขียน คือ **1801 โอนค่าเสื่อมราคา** และ **1802 ขายสินทรัพย์** (ดู [[acc-trans-flag-map]]) ตาราง `as_trans*` เป็น "ตารางเงิน" ตาม `moneyTablePattern` (`write_policy.go:24`) ห้ามเขียนผ่านหน้า master ทั่วไป ส่วน master (`as_asset*`) เขียนผ่านหน้า master ได้เพราะอยู่ใน legacy allow-list (ADR-0011) กระบวนการค่าเสื่อมดู [[acc-fixed-asset-depreciation]]

## ตารางที่มีโน้ตแยก

| ตาราง | บทบาท | ผู้เขียนหลัก | โน้ต |
|---|---|---|---|
| `as_trans` | หัวเอกสารสินทรัพย์ 1801 / 1802 | `insertDepDoc` `fa_depreciation.go:964`, `insertAssetSaleDoc` `fa_sale.go:513` | [[tbl-as-trans]] |
| `as_trans_detail` | บรรทัดเอกสาร (ค่าเสื่อมต่อสินทรัพย์ / รายการขาย) | ตัวเดียวกับหัว | [[tbl-as-trans-detail]] |
| `as_asset` | ทะเบียนสินทรัพย์ (ชื่อ ประเภท สามบัญชี GL) | หน้า master `menu_asset_lists` `master_detail_specs.go:202` | [[tbl-as-asset]] |
| `as_asset_detail` | ข้อมูลซื้อ ประกัน พารามิเตอร์ค่าเสื่อม และฟิลด์ขาย (1 แถวต่อสินทรัพย์) | หน้า master (grid `detail`) และเอกสารขาย `fa_sale.go:551` | [[tbl-as-asset-detail]] |
| `as_asset_type` | master ประเภทสินทรัพย์ (รหัส+ชื่อ) | หน้า master มาตรฐาน | [[tbl-as-asset-type]] |

## ตารางอื่นในกลุ่ม (ไม่มีโน้ตแยก)

| ตาราง | บทบาท | ที่ใช้ในโค้ด |
|---|---|---|
| `as_asset_location` | master สถานที่ตั้งสินทรัพย์ (`code`, `name_1`) | สินทรัพย์อ้างผ่าน `as_location` `master_detail_specs.go:210`; รายงานแสดงชื่อ `report_menu_gl_fa.go:1263`, `:1567`; legacy allow-list; lookup หน้าจอ `BcLookupModal.tsx:108` |
| `as_asset_maintain` | master รายการซ่อมบำรุง (`code`, `name_1`) | บรรทัดซ่อมอ้าง `maintain_code` `master_detail_specs.go:235`; ดึงชื่อมาเติมตอนบันทึก `master_detail_specs.go:696`; รายงาน `report_menu_gl_fa.go:1645`; legacy allow-list |
| `as_asset_maintain_unit` | master หน่วยนับของรายการซ่อม | บรรทัดซ่อมอ้าง `maintain_unit` `master_detail_specs.go:236`; allow-list; lookup `BcLookupModal.tsx:108` |
| `as_asset_maintenance` | หัวเอกสารซ่อมบำรุงสินทรัพย์: `doc_no` (คีย์), `doc_date`, `doc_time`, `doc_format_code`, `branch_code`, `side_code`, `department_code`, `remark`, `total_maintain_value` (ผลรวมราคาซ่อมที่คำนวณตอนบันทึก) | หน้า master `menu_asset_maintenance` `master_detail_specs.go:227`; `prepMaintenance` `master_detail_specs.go:682`; เพิ่มคอลัมน์ `doc_time`, `doc_format_code` ตอนเริ่มระบบ `service.go:846-847`, `pool.go:64-65`; allow-list |
| `as_asset_maintenance_detail` | บรรทัดซ่อม: `as_code`, `maintain_code`, `maintain_name`, `maintain_unit`, `maintain_date`, `maintain_location`, `maintain_price`, `remark`, `line_number` | grid `lines` `master_detail_specs.go:231-233`; เป็นตัวกันลบสินทรัพย์ `master_detail_specs.go:221`; รายงานซ่อมบำรุง `report_menu_gl_fa.go:1644` |
| `as_asset_result` | ผลคำนวณค่าเสื่อมต่อสินทรัพย์ (ที่ระบบเดิมเก็บ) | ถูกลบพร้อมสินทรัพย์เท่านั้น (`delChildren` `master_detail_specs.go:219`) ไม่มี SQL อื่น เอนจินค่าเสื่อมใหม่ไม่อ่าน/ไม่เขียนตารางนี้ (เนื้อหาไม่ชัดจากโค้ด) |
| `as_asset_sale_detail` | รายการขายสินทรัพย์ของระบบเดิม | ใช้เป็นตัวกันลบสินทรัพย์ "มีการบันทึกขายสินทรัพย์นี้แล้ว" (`master_detail_specs.go:222`) เท่านั้น การขายของโปรแกรมนี้ใช้ `as_trans` 1802 แทน |
| `as_asset_retire` | (ไม่ชัดจากโค้ด; ชื่อสื่อถึงการจำหน่าย/ปลดระวาง) | อยู่ใน legacy allow-list อย่างเดียว ไม่มี SQL อื่น |

## ตารางภายนอกกลุ่มที่เอกสารสินทรัพย์เขียนด้วย
เอกสาร 1802 ยังเขียน `gl_journal`/`gl_journal_detail` ([[tbl-gl-journal]], [[tbl-gl-journal-detail]]), `gl_journal_vat_sale` ([[tbl-gl-journal-vat-sale]]), `gl_wht_list`/`gl_wht_list_detail` ([[tbl-gl-wht-list]], [[tbl-gl-wht-list-detail]]) และถ้าขายสดจะเขียน `cb_trans`/`cb_trans_detail` ([[tbl-cb-trans]], [[tbl-cb-trans-detail]]) ลำดับลบ 7-9 ตารางอยู่ที่ `fa_sale.go:486-499` ส่วน 1801 เขียนเฉพาะ `as_trans`, `as_trans_detail`, `gl_journal`, `gl_journal_detail` (`fa_depreciation.go:823`) กลุ่มตาราง GL ดู [[tbl-group-gl]]

## ข้อสังเกตรวม
- เลขที่เอกสารของ `as_trans` ออกผ่านตัวออกเลขกลาง (`nextDocNoTables` มี `as_trans` `doc_no_next.go:12`) เหมือน `ic_trans`, `ap_ar_trans`, `cb_trans`, `gl_journal`
- ความสัมพันธ์สินทรัพย์ → เอกสารใช้ `as_trans_detail.item_code` = `as_asset.code` ไม่มี foreign key ในฐาน ตัวกันลบทำด้วยโค้ด (`master_detail_specs.go:220-223`)
- ฟิลด์ที่เอนจินค่าเสื่อมอ่านจริงมีเฉพาะส่วนหนึ่งของ `as_asset_detail` (ราคาซื้อ ราคาซาก อายุ วันเริ่ม/สิ้นสุด มูลค่าที่คิด ยอดคงเหลือ ยอดสะสมยกมา) ดู [[tbl-as-asset-detail]]
- หน้าจอเลือกรายการ (lookup modal) อนุญาตตาราง `as_asset`, `as_asset_type`, `as_asset_location`, `as_asset_maintain`, `as_asset_maintain_unit` (`BcLookupModal.tsx:107-108`)

## ที่มาในโค้ด
- `backend/internal/application/process/master_detail_specs.go:202` spec `menu_asset_lists`
- `backend/internal/application/process/master_detail_specs.go:219` `delChildren` ของสินทรัพย์ (`as_asset_result`)
- `backend/internal/application/process/master_detail_specs.go:221` ตัวกันลบสินทรัพย์
- `backend/internal/application/process/master_detail_specs.go:227` spec `menu_asset_maintenance`
- `backend/internal/application/process/master_detail_specs.go:682` `prepMaintenance`
- `backend/internal/application/process/fa_depreciation.go:964` `insertDepDoc` (1801)
- `backend/internal/application/process/fa_sale.go:513` `insertAssetSaleDoc` (1802)
- `backend/internal/application/process/fa_sale.go:486` `deleteAssetSaleDoc`
- `backend/internal/application/process/service.go:846` ALTER `as_asset_maintenance`
- `backend/internal/platform/db/pool.go:64` ALTER `as_asset_maintenance` (ชุดที่สอง)
- `backend/internal/application/process/report_menu_gl_fa.go:1644` รายงานซ่อมบำรุง
- `backend/internal/application/process/doc_no_next.go:12` ตารางออกเลขที่ถัดไป
- `backend/internal/domain/query/write_policy.go:24` ตารางเงิน
- `frontend/account/master/BcLookupModal.tsx:107` lookup ที่อนุญาต

## ดูเพิ่ม
- [[acc-fixed-asset-depreciation]]
- [[acc-trans-flag-map]]
- [[tbl-group-gl]]
- [[proc-master-data]]
