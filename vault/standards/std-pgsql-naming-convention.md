---
title: "มาตรฐานตั้งชื่อ Database ตาราง และฟิลด์ PostgreSQL"
tags: [standards, database, postgres, naming]
aliases: [naming convention, ตั้งชื่อฟิลด์, ตั้งชื่อตาราง, กฎข้อ 25, KMS_PGSQL_NAMING_CONVENTION]
sources: ["docs/kms/KMS_PGSQL_NAMING_CONVENTION.md:8-94", "docs/kms/KMS_INDEX.md:31", "AGENTS.md:29", "AGENTS.md:69", "backend/internal/application/process/hidden_cost.go:416-439", "backend/internal/application/process/hidden_cost.go:533-588", "frontend/account/master/HiddenCostScreen.tsx:64-94"]
---
# มาตรฐานตั้งชื่อ Database ตาราง และฟิลด์ PostgreSQL

กฎข้อ 25 ของ repo (`AGENTS.md:69`) กำหนดให้ตาราง/ฟิลด์ใหม่และ SQL ทุกตัวยึดชื่อเดิมของ BC (`_g.d` ใน `D:\bc\BCERPGlobal\_data.cs` ประมาณ 520 คลาสตาราง) รายละเอียดอยู่ใน KMS ฉบับเดียว `docs/kms/KMS_PGSQL_NAMING_CONVENTION.md` (ลำดับ 11 ใน `KMS_INDEX.md:31`)

## ชื่อฐานข้อมูล (§1)
ตัวพิมพ์เล็กทั้งหมด ห้ามเว้นวรรค ห้ามขีดกลาง

| ประเภท | รูปแบบชื่อ |
|---|---|
| ฐานกลาง (ผู้ใช้ รายชื่อฐาน) | `bcerpmain<group>` |
| ฐานบริษัทมาตรฐาน/สาธิต | `bcdemo` หรือ `bcerpdata_<code>` |
| ฐานลูกค้าแยกตาม PDPA | `bc_pdpa_<id>_<suffix>` ผูกไว้ใน `bc_database_list` ของฐานกลาง |
| ฐานทดสอบ UAT | `uat_<name>` แยกจาก `bcdemo` และติด `COMMENT ON DATABASE` |

ดู [[std-platform-google-login-pdpa-hub]] เรื่องการเลือกฐานตอนเข้าระบบ

## ชื่อตาราง (§2)
รูปแบบ `<module_prefix>_<entity>` ตัวพิมพ์เล็ก คั่นด้วย `_`

| Prefix | โมดูล | จำนวนตารางตาม KMS |
|---|---|---|
| `ic_` | สินค้า คลัง ต้นทุน | 159 |
| `erp_` | ตั้งค่าองค์กร งวดบัญชี | 68 |
| `ap_` / `ap_ar_` | เจ้าหนี้ และธุรกรรมร่วม | 24 |
| `ar_` | ลูกหนี้ | 41 |
| `gl_` | บัญชีแยกประเภท ภาษีซื้อ-ขาย | 36 |
| `cb_` | เงินสด ธนาคาร เช็ค | 10 |
| `as_` | สินทรัพย์ถาวร ค่าเสื่อม | 15 |
| `bc_` | ระบบกลาง ผู้ใช้ สิทธิ์ | 14 |

Suffix ที่ใช้ซ้ำ (§2.2): `_trans` / `_process` = หัวเอกสาร, `_detail` / `_item` = บรรทัดรายการ, `_ref` = เอกสารอ้างอิง, `_shipment`, `_serial_number`

## ชื่อคอลัมน์ (§3)
- **คอลัมน์ระบบ 4 ตัวทุกตาราง (§3.1)**: `ignore_sync`, `is_lock_record` (1 = ล็อกห้ามแก้), `roworder`, `create_date_time_now` — ตามที่ KMS ระบุ ยังไม่ได้ตรวจกับ DDL ในโค้ดทุกตาราง
- **สถานะและผู้บันทึก (§3.5)**: `status`, `last_status` (0 ปกติ / 1 ยกเลิก), `is_cancel`, `calc_flag` (1 เข้า / -1 ออก / 0 ไม่กระทบจำนวน), `creator_code`, `create_datetime`, `last_editor_code`, `lastedit_datetime`, `cancel_code`, `cancel_datetime`, `approve_code`, `approve_date`

ตัวอย่างชื่อที่ต้องใช้ เทียบกับชื่อที่ห้ามใช้ (§3.2-3.4):

| ความหมาย | ชื่อมาตรฐาน | ห้ามใช้ |
|---|---|---|
| รหัสหลัก Master | `code` | `id`, `master_code` |
| ชื่อไทย / อังกฤษ | `name_1` / `name_2` | `name_th`, `name_en` |
| รหัสสินค้าในรายการ | `item_code` | `product_code`, `sku` |
| รหัสลูกค้า/เจ้าหนี้ | `cust_code` (`ar_code` / `ap_code`) | `customer_id`, `vendor_code` |
| คลัง / ที่เก็บ | `wh_code`, `shelf_code` | `warehouse_code`, `bin_code` |
| หน่วยนับหลัก / ขนาน | `unit_code`, `unit_code_2` | `uom`, `parallel_unit` |
| ผังบัญชี | `account_code` | `acc_code`, `gl_code` |
| เลขที่ / วันที่เอกสาร | `doc_no`, `doc_date`, `doc_time` | `invoice_no`, `trans_date` |
| ประเภทเอกสาร | `trans_flag`, `trans_type` | `doc_type_id`, `flag` |
| ลำดับบรรทัด | `line_number` | `seq`, `line_no` |
| หมายเหตุ | `remark`, `remark_2`, `remark_3` | `note`, `memo` |
| จำนวนหน่วยหลัก / ขนาน | `qty`, `qty_2`, `weight` | `quantity`, `parallel_qty` |
| อัตราส่วนหน่วย / สัดส่วนปันส่วน | `stand_value`, `divide_value`, `ratio` | `conv_factor`, `alloc_pct` |
| อัตราแลกเปลี่ยน | `exchange_rate` | `fx_rate`, `rate` |
| มูลค่าบรรทัด | `sum_amount`, `sum_total_amount` | `line_total`, `net_amount` |
| ต้นทุน / ต้นทุนแฝง | `sum_of_cost`, `average_cost`, `hidden_cost_amount` | `new_unit_cost`, `unit_avg_cost` |
| ยอดท้ายบิล | `total_value`, `total_after_vat`, `transport_value` | `grand_total`, `sub_total` |
| เดบิต / เครดิต | `debit`, `credit` | `dr`, `cr` |

## ข้อขัดแย้งกับโค้ดปัจจุบัน
**แก้แล้ว ณ 2026-10-31:** ข้อขัดแย้งเดิมของเมนูต้นทุนแฝง (สร้างคอลัมน์ต้องห้าม `fx_rate`, `alloc_pct`, `new_unit_cost`) ไม่มีแล้ว `ensureHiddenCostImportCols` (`hidden_cost.go:416-439`) และ `insertHiddenCostRows` (`:533-588`) ใช้ชื่อมาตรฐานเท่านั้น และค้นซอร์สโค้ดทั้ง `backend/` กับ `frontend/` ไม่พบชื่อต้องห้าม 3 ตัวนี้แล้ว (เหลือเฉพาะในไฟล์ binary ที่ build ไว้เก่า เช่น `backend/bin/api.exe`)

| ความหมาย | ชื่อที่ใช้ตอนนี้ | สร้างคอลัมน์ / INSERT / หน้าจออ่าน |
|---|---|---|
| อัตราแลกเปลี่ยน | `exchange_rate` | `hidden_cost.go:423` / `:537` / `HiddenCostScreen.tsx:79` |
| สัดส่วนปันส่วน | `ratio` | `hidden_cost.go:432` / `:579` / `HiddenCostScreen.tsx:91` |
| ต้นทุนใหม่ต่อหน่วย | `average_cost` | `hidden_cost.go:436` / `:579` / `HiddenCostScreen.tsx:92` |
| น้ำหนัก/หน่วยนับขนาน | `weight`, `qty_2` | `hidden_cost.go:430-431` / `:579` / `HiddenCostScreen.tsx:89` |

ข้อสังเกตที่ยังเหลือ (ไม่ใช่ชื่อในรายการห้าม):
- คอลัมน์หัว 6 ตัว `customs_entry_no`, `vessel_container_no`, `incoterms`, `insurance_amount`, `import_duty_amount`, `clearance_port_amount` (สร้าง `hidden_cost.go:419-421`, `:425-427`; INSERT `:537-538`; หน้าจอ `HiddenCostScreen.tsx:65`, `:78-81`) ไม่อยู่ในตาราง §3.4 ของ KMS และไม่พบชื่อนี้ใน `D:\bc\BCERPGlobal\_data.cs` ขณะที่ KMS §3 (`KMS_PGSQL_NAMING_CONVENTION.md:46`) ให้ยึดชื่อ `_g.d` — ยังไม่ได้ตรวจว่า BC มีชื่ออื่นที่ความหมายเดียวกันหรือไม่
- `hidden_cost_amount`, `sum_total_amount` KMS ระบุเป็นชื่อมาตรฐาน (`KMS_PGSQL_NAMING_CONVENTION.md:87-88`) แต่ไม่พบใน `_data.cs` เช่นกัน
- ด้านความหมาย: `ratio` ของ item เก็บเป็นเปอร์เซ็นต์ 0-100 (`hidden_cost.go:261-265`) และ `weight` เก็บค่าเดียวกับ `qty_2` (`:581`)

ดูรายละเอียดที่ [[proc-hidden-cost]] และ [[tbl-ic-hidden-cost-process]]

## เกี่ยวข้อง
- [[standards-overview]]
- [[std-inventory-costing-rules]]
- [[std-three-tier-knowledge-architecture]]
