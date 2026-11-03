---
title: "มาตรฐานตั้งชื่อ Database ตาราง และฟิลด์ PostgreSQL"
tags: [standards, database, postgres, naming]
aliases: [naming convention, ตั้งชื่อฟิลด์, ตั้งชื่อตาราง, กฎข้อ 25, KMS_PGSQL_NAMING_CONVENTION]
sources: ["docs/kms/KMS_PGSQL_NAMING_CONVENTION.md:8-94", "docs/kms/KMS_INDEX.md:31", "AGENTS.md:29", "AGENTS.md:69-72", "backend/internal/adapter/inbound/http/admin/workspace_google.go:19", "backend/internal/adapter/inbound/http/admin/workspace_google.go:343-352", "backend/internal/adapter/inbound/http/admin/workspace_google.go:348", "backend/internal/adapter/inbound/http/admin/handler.go:27", "backend/internal/adapter/inbound/http/admin/handler.go:55", "backend/internal/application/process/report_template.go:219-221", "backend/internal/application/process/hidden_cost.go:416-439", "backend/internal/application/process/hidden_cost.go:518", "backend/internal/application/process/hidden_cost.go:534-540", "backend/internal/application/process/hidden_cost.go:577-583", "backend/internal/application/process/hidden_cost.go:261-265", "frontend/account/master/HiddenCostScreen.tsx:65", "frontend/account/master/HiddenCostScreen.tsx:78-79", "frontend/account/master/HiddenCostScreen.tsx:89-92"]
---
# มาตรฐานตั้งชื่อ Database ตาราง และฟิลด์ PostgreSQL

กฎข้อ 25 ของ repo (`AGENTS.md:69-72`) กำหนดให้ตาราง/ฟิลด์ใหม่และ SQL ทุกตัวยึดชื่อมาตรฐานของ BC และตรวจ `information_schema.columns` ก่อนเสมอ ห้ามตั้งชื่อย่อใหม่เอง รายละเอียดอยู่ใน KMS ฉบับเดียว `docs/kms/KMS_PGSQL_NAMING_CONVENTION.md` (ลิงก์จากตารางจับคู่ของ `AGENTS.md:29` และ `docs/kms/KMS_INDEX.md:31`) โน้ตนี้สรุปกฎและบันทึกว่าข้อใดตรวจกับโค้ดปัจจุบันแล้ว

## ชื่อฐานข้อมูล (§1)
ตัวพิมพ์เล็กทั้งหมด ห้ามเว้นวรรค ห้ามขีดกลาง

| ประเภท | รูปแบบชื่อ |
|---|---|
| ฐานกลาง (ผู้ใช้ รายชื่อฐาน) | `bcerpmain<group>` |
| ฐานบริษัทมาตรฐาน/สาธิต | `bcdemo` หรือ `bcerpdata_<code>` |
| ฐานลูกค้าแยกตาม PDPA | `bc_pdpa_<id>_<suffix>` ผูกไว้ใน `bc_database_list` ของฐานกลาง |
| ฐานทดสอบ UAT | `uat_<name>` แยกจาก `bcdemo` และติด `COMMENT ON DATABASE` |

ตรวจกับโค้ด: ฝั่ง Go สร้างชื่อฐานกลางเป็น `"bcerpmain" + รหัสผู้ให้บริการตัวพิมพ์เล็ก` (`backend/internal/adapter/inbound/http/admin/handler.go:55`) ชื่อฐานที่ผู้ใช้ตั้งเองตอนสร้าง Workspace ต้องตรง `^[a-z][a-z0-9_]{2,40}$` (`workspace_google.go:19`) และห้ามขึ้นต้น `bcerpmain` หรือ `pg_` (`workspace_google.go:348`); ส่วนรูปแบบ `bc_pdpa_<id>_<suffix>` ปรากฏเฉพาะใน KMS และ `AGENTS.md:70` โค้ด Go **ไม่ได้บังคับ**รูปแบบนี้ ดู [[std-platform-google-login-pdpa-hub]] เรื่องการเลือกฐานตอนเข้าระบบ

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

จำนวนตารางข้างต้นยกจาก KMS (§2.1) ไม่ได้นับกับฐานข้อมูลจริงในรอบนี้

Suffix ที่ใช้ซ้ำ (§2.2): `_trans` / `_process` = หัวเอกสาร, `_detail` / `_item` = บรรทัดรายการ, `_ref` = เอกสารอ้างอิง, `_shipment`, `_serial_number`

## ชื่อคอลัมน์ (§3)
- **คอลัมน์ระบบ 4 ตัวทุกตาราง (§3.1)**: `ignore_sync`, `is_lock_record` (1 = ล็อกห้ามแก้), `roworder`, `create_date_time_now` — ตามที่ KMS ระบุ; ในโค้ดตรวจพบเฉพาะบางส่วน: ตาราง `formdesign` ที่โค้ดสร้างเองมี `ignore_sync`, `is_lock_record`, `roworder` (`report_template.go:219-221`) และเมนูต้นทุนแฝงสั่ง `is_lock_record = 1` ที่เอกสารปรับปรุง (`hidden_cost.go:518`) ยังไม่ได้ตรวจ DDL ทุกตารางในฐานจริง
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

## ตัวอย่างการใช้ชื่อมาตรฐานจริง: เมนูต้นทุนแฝง
เมนูต้นทุนแฝง (Hidden Cost) เคยสร้างคอลัมน์ที่ชื่อต้องห้าม (`fx_rate`, `alloc_pct`, `new_unit_cost`) ตอนนี้ไม่มีแล้ว — ณ รอบตรวจ 2026-11-03 `ensureHiddenCostImportCols` (`hidden_cost.go:416-439`), การ INSERT หัว/รายการ (`:534-540`, `:577-583`) และหน้าจอ (`HiddenCostScreen.tsx`) ใช้ชื่อมาตรฐานเท่านั้น

| ความหมาย | ชื่อที่ใช้ตอนนี้ | สร้างคอลัมน์ / INSERT / หน้าจออ่าน |
|---|---|---|
| อัตราแลกเปลี่ยน | `exchange_rate` | `hidden_cost.go:423` / `:537` / `HiddenCostScreen.tsx:79` |
| สัดส่วนปันส่วน | `ratio` | `hidden_cost.go:432` / `:579` / `HiddenCostScreen.tsx:91` |
| ต้นทุนใหม่ต่อหน่วย | `average_cost` | `hidden_cost.go:436` / `:579` / `HiddenCostScreen.tsx:92` |
| น้ำหนัก/หน่วยนับขนาน | `weight`, `qty_2` | `hidden_cost.go:430-431` / `:579` / `HiddenCostScreen.tsx:89` |

ข้อสังเกตที่ยังเหลือ (ไม่ใช่ชื่อในรายการห้าม):
- คอลัมน์หัว 6 ตัว `customs_entry_no`, `vessel_container_no`, `incoterms`, `insurance_amount`, `import_duty_amount`, `clearance_port_amount` (สร้างที่ `hidden_cost.go:419-421`, `:425-427`; INSERT `:537-538`; หน้าจอ `HiddenCostScreen.tsx:65`, `:78-79`) ไม่อยู่ในตารางชื่อมาตรฐาน §3.4 ของ KMS โค้ดสร้างด้วย `ADD COLUMN IF NOT EXISTS` ตอนใช้งาน จึงควรเทียบกับ `information_schema.columns` ของฐานนั้นก่อนใช้ในรายงานหรือฐานอื่น
- ความหมายของค่า: `ratio` ของ item เก็บเป็นเปอร์เซ็นต์ 0-100 (`hidden_cost.go:261-265`) และ `weight` เก็บค่าเดียวกับ `qty_2` (`hidden_cost.go:579-581`)

ดูรายละเอียดที่ [[proc-hidden-cost]] และ [[tbl-ic-hidden-cost-process]]

## เกี่ยวข้อง
- [[standards-overview]]
- [[std-inventory-costing-rules]]
- [[std-three-tier-knowledge-architecture]]
- [[std-add-screen-workflow]] (ขั้นตอนเพิ่มคอลัมน์/หน้าจอใหม่)
