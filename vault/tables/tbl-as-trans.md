---
title: "หัวเอกสารสินทรัพย์ (as_trans)"
tags: [tables, as]
aliases: ["as_trans", "เอกสารสินทรัพย์", "ใบโอนค่าเสื่อมราคา", "ใบขายสินทรัพย์", "trans_flag 1801", "trans_flag 1802"]
sources: ["backend/internal/application/process/fa_depreciation.go:966", "backend/internal/application/process/fa_depreciation.go:868", "backend/internal/application/process/fa_depreciation.go:897", "backend/internal/application/process/fa_sale.go:515", "backend/internal/application/process/fa_sale.go:487", "backend/internal/application/process/fa_sale.go:558", "backend/internal/application/process/gl_template.go:798", "backend/internal/application/process/gl_template.go:1112", "backend/internal/application/process/docs.go:616", "backend/internal/application/process/report_menu_ap_ar.go:478", "backend/internal/application/process/report_menu_cb.go:761", "backend/internal/application/process/doc_no_next.go:12", "backend/internal/domain/query/write_policy.go:24", "backend/internal/application/process/trans_tax.go:238", "backend/internal/application/process/report_menu_gl_fa.go:1542", "scripts/sql/02_data_schema.sql:1944", "docs/kms/KMS_PGSQL_NAMING_CONVENTION.md:48"]
---

# หัวเอกสารสินทรัพย์ (`as_trans`)

หัวเอกสารของระบบสินทรัพย์ถาวร (Fixed Asset) 1 แถวต่อ 1 เอกสาร มี 2 ชนิดที่โปรแกรมนี้เขียน แยกด้วย `trans_flag`:

| trans_flag | เอกสาร | ผู้เขียน |
|---|---|---|
| 1801 | โอนค่าเสื่อมราคา (ประมวลผลค่าเสื่อมราคาเป็นงวด) | `insertDepDoc` `fa_depreciation.go:964` |
| 1802 | ขายสินทรัพย์ | `insertAssetSaleDoc` `fa_sale.go:513` |

ค่าคงที่: `depTransFlag = 1801` (`fa_depreciation.go:29`), `depSaleFlag = 1802` (`fa_depreciation.go:30`) ทั้งคู่ผูกกับ [[acc-trans-flag-map]] บรรทัดของเอกสารอยู่ที่ [[tbl-as-trans-detail]] ตารางเงินตามกฎ `moneyTablePattern` (`as_trans(_\w+)?` `write_policy.go:24`) จึงห้ามเขียนผ่านหน้า master ทั่วไป ต้องผ่าน process เฉพาะเท่านั้น

## คอลัมน์สำคัญ

DDL ใน `scripts/sql/02_data_schema.sql:1944-1972` กำหนดเฉพาะคอลัมน์พื้นฐาน (`guid_code`, `doc_no`, `doc_date`, `doc_time`, `doc_format_code`, `total_amount`, `remark`, `trans_flag`, `trans_type`, ช่วง `from_as_*`/`to_as_*`, `from_as_period`, `to_as_period`, `department_split`, `date_begin`, `date_end`, `by_year`, `process_mode`, `process_by`) และดัชนี `(doc_no, trans_flag)`, `(doc_date, trans_flag)` (`02_data_schema.sql:1973-1974`) บวกคอลัมน์ระบบมาตรฐานของทุกตาราง (`docs/kms/KMS_PGSQL_NAMING_CONVENTION.md:48-53`) คอลัมน์ที่โค้ดเขียนเพิ่ม เช่น ของเอกสารขาย 1802 (`cust_code`, `tax_doc_no`, `inquiry_type`, `total_value` ฯลฯ), `branch_code`, `last_status`, `creator_code` ไม่อยู่ใน DDL นี้ และไม่พบคำสั่ง ALTER ใน `scripts/sql` หรือ `backend` จึงยืนยันชนิดข้อมูลของคอลัมน์เหล่านี้จาก repo ไม่ได้ (ยังไม่ได้ตรวจกับฐานข้อมูลจริง)

### คอลัมน์ร่วม (ทั้ง 1801 และ 1802)

| คอลัมน์ | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `guid_code` | GUID ของเอกสาร สร้างตอนบันทึก | `fa_depreciation.go:966`, `fa_sale.go:515` |
| `doc_no`, `doc_date`, `doc_time` | เลขที่/วันที่/เวลาเอกสาร | ทุกที่ |
| `doc_format_code` | รหัสรูปแบบเอกสาร ([[tbl-erp-doc-format]]) ใช้หา `gl_book` และ template ลงบัญชี | `fa_depreciation.go:914-915`, `gl_template.go:1112-1114` |
| `trans_flag` | 1801 หรือ 1802 | ทุก SQL |
| `remark` | หมายเหตุ ตัดที่ 500 ตัวอักษร | `fa_depreciation.go:972` |
| `total_amount` | ยอดรวม (1801 = ค่าเสื่อมรวม, 1802 = ยอดรวมหลังภาษี) | `fa_depreciation.go:966`, `fa_sale.go:515` |
| `creator_code`, `create_datetime`, `create_date_time_now` | ผู้บันทึกและเวลาบันทึก | ทุก INSERT |
| `branch_code` | สาขา | ทุก INSERT |
| `last_status` | 0 = ใช้งาน (ผู้อ่านรายงานกรอง `COALESCE(last_status,0) = 0`) | `report_menu_ap_ar.go:478`, `:555` |
| `is_cancel`, `is_doc_copy` | ธงยกเลิก / เอกสารสำเนา ใช้กรองตอนลงบัญชีด้วย template ซ้ำ (เฉพาะ 1802) | `gl_template.go:1112-1114` |

### เฉพาะ 1801 (โอนค่าเสื่อมราคา)

| คอลัมน์ | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `process_by` | วิธีประมวลผล เก็บค่าที่หน้าจอส่งมาลบ 1 (0 รายวัน, 1 รายเดือน, 2 รายปี; ค่าที่ส่งมาคือ `depByDay`/`depByMonth`/`depByYear` = 1/2/3) | `fa_depreciation.go:36-38`, `:973` |
| `process_mode` | โหมดคิดค่าเสื่อม: 0 สรรพากร, 1 บัญชี (30/360 ค่าเริ่มต้น), 2 วันจริง | `fa_depreciation.go:32-34`, `:604`, `:611-612`, `:973` |
| `from_as_code`, `to_as_code` | ช่วงรหัสสินทรัพย์ที่ประมวลผล | `fa_depreciation.go:974` |
| `from_as_type`, `to_as_type` | ช่วงประเภทสินทรัพย์ | `fa_depreciation.go:974` |
| `from_as_department`, `to_as_department` | ช่วงแผนก | `fa_depreciation.go:974` |
| `from_as_period`, `to_as_period` | เก็บ 0 เสมอ | `fa_depreciation.go:970` |
| `date_begin`, `date_end` | วันที่เริ่ม/สิ้นสุดของช่วงที่คิดค่าเสื่อม ใช้หาเอกสารของงวดเดียวกันและตรวจช่วงทับซ้อนกับเอกสาร 1801 อื่น | `fa_depreciation.go:897`, `:940-943`, `:975` |
| `by_year`, `department_split` | เก็บ 0 เสมอ (ความหมายเต็มไม่ชัดจากโค้ด) | `fa_depreciation.go:971` |

### เฉพาะ 1802 (ขายสินทรัพย์)

| คอลัมน์ | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `trans_type` | ประเภทรายการ = 2 (`saleTransType` `fa_sale.go:17`) | `fa_sale.go:515` |
| `status` | เก็บ 0 | `fa_sale.go:519` |
| `cust_code` | ลูกหนี้ผู้ซื้อ ([[tbl-ar-customer]]) | `fa_sale.go:516`, `docs.go:613` |
| `tax_doc_no`, `tax_doc_date` | เลขที่/วันที่ใบกำกับภาษีขาย (ใบกำกับของเอกสารนี้ลงใน [[tbl-gl-journal-vat-sale]]); เลขซ้ำถูกตรวจด้วย `checkTaxDocNo` เมื่อเลขเปลี่ยนจากเอกสารเดิม | `fa_sale.go:516`, `:444`, `:464-468`, `:645-648` |
| `doc_ref`, `doc_ref_date` | เอกสารอ้างอิง (ตัด `doc_ref` ที่ 25 ตัวอักษร) | `fa_sale.go:516`, `:522` |
| `inquiry_type` | ประเภทการขาย รายงานค้างรับกรอง `inquiry_type IN (0,2)` | `report_menu_ap_ar.go:555` |
| `vat_type`, `vat_rate` | ประเภท/อัตราภาษี | `fa_sale.go:516`, `:522-523` |
| `credit_day`, `credit_date` | เครดิตวัน/วันครบกำหนด (ว่างได้) | `fa_sale.go:516`, `:523` |
| `total_value`, `total_before_vat`, `total_vat_value`, `total_after_vat`, `total_except_vat` | ยอดก่อนภาษี/ภาษี/หลังภาษี/ยกเว้น | `fa_sale.go:517`, `:523-524` |
| `is_pos` | เก็บ 0 | `fa_sale.go:520` |

## คีย์และความสัมพันธ์
- ลูก: [[tbl-as-trans-detail]] ด้วย `doc_no` + `trans_flag`
- GL: [[tbl-gl-journal]] / [[tbl-gl-journal-detail]] ด้วย `doc_no` + `trans_flag` (1801 `trans_direct = 1` เสมอ `fa_depreciation.go:995-998`; 1802 `trans_direct = 0` `fa_sale.go:576-579` หรือผ่าน template `fa_sale.go:567-572`)
- ภาษีขาย (1802): [[tbl-gl-journal-vat-sale]]; หัก ณ ที่จ่าย: [[tbl-gl-wht-list]], [[tbl-gl-wht-list-detail]]
- ขายเงินสด: เขียน [[tbl-cb-trans]] / [[tbl-cb-trans-detail]] ของเอกสาร 1802 เมื่อเป็นการขายสด (`fa_sale.go:557-565`)
- ตัวลูกหนี้ค้างชำระ/วางบิล: 1802 ถูก `UNION ALL` เข้ากับ [[tbl-ic-trans]] ใน `billDebtSource` (ไม่มีสกุลเงิน ใช้สกุลบ้านที่เรท 1; ส่วนนี้อ่าน `due_date` ของ `as_trans` ที่ `fa_sale.go` ไม่ได้เขียน) `docs.go:611-616` ดู [[tbl-ap-ar-trans]]
- รูปแบบเอกสาร: [[tbl-erp-doc-format]] ผ่าน `doc_format_code`; ปีบัญชี/งวด: [[tbl-erp-account-period]]

## ใครเขียน (writers)
- 1801: `insertDepDoc` `fa_depreciation.go:964-1015` เขียน `as_trans` + `as_trans_detail` + `gl_journal` + `gl_journal_detail` ใน transaction เดียว ([[acc-fixed-asset-depreciation]])
- 1802: `insertAssetSaleDoc` `fa_sale.go:513-597` เขียน `as_trans` + `as_trans_detail` + `gl_journal*` + `gl_journal_vat_sale` + (ขายสด) `cb_trans*` + อัปเดตฟิลด์ขายใน [[tbl-as-asset-detail]]
- ไม่มี UPDATE ของ `as_trans` ในโค้ด การแก้ไขเอกสาร 1802 ทำโดยลบแล้วสร้างใหม่ (`deleteAssetSaleDoc` แล้ว `insertAssetSaleDoc` พร้อม `keepWht`); การบันทึก 1801 ซ้ำเลขที่เดิมก็ลบ 4 ตารางก่อน insert ใหม่ (`fa_depreciation.go:823-827`) ภายใต้ advisory lock `fa-depreciation` ให้บันทึกได้ทีละคน (`fa_depreciation.go:817`)

## ใครลบ
- 1802: `deleteAssetSaleDoc` `fa_sale.go:487-502` ลบตามลำดับ `as_trans_detail`, `as_trans`, `cb_trans`, `cb_trans_detail`, `gl_journal_detail`, `gl_journal`, `gl_journal_vat_sale` (+ `gl_wht_list_detail`, `gl_wht_list` ถ้าไม่ keepWht) แล้วล้างฟิลด์ขายใน `as_asset_detail` ที่ `doc_sale_ref = doc_no` (`fa_sale.go:497-498`)
- 1801: `deleteFADepreciation` `fa_depreciation.go:858` ลบทั้ง 4 ตาราง `as_trans_detail`, `as_trans`, `gl_journal_detail`, `gl_journal` ใน transaction เดียว (`fa_depreciation.go:880-884`) หลังขอ advisory lock (`:864`) และปฏิเสธการลบถ้ามีสินทรัพย์ในเอกสารถูกขายแล้วตั้งแต่วันที่เอกสารเป็นต้นไป (1802 ที่ `doc_date` ไม่ก่อนเอกสาร `:868-871`, `:874-876`)

## ใครอ่าน
- ค่าเสื่อม 1801: หาเอกสารของงวดเดียวกัน (`date_begin`/`date_end`) `fa_depreciation.go:897`; ตรวจ `doc_no` ซ้ำข้าม `trans_flag` `fa_depreciation.go:918-921`; ตรวจเอกสาร 1801 อื่นที่ช่วงวันที่ทับกันและมีสินทรัพย์เดียวกัน `checkDepOverlap` `fa_depreciation.go:935-943`; ตรวจว่ามีสินทรัพย์ในเอกสารถูกขายแล้วก่อนลบ `fa_depreciation.go:868-871`
- ขายสินทรัพย์ 1802: อ่านวันที่เอกสารตอนลบ `fa_sale.go:419`; อ่านวันที่/เลขใบกำกับของเอกสารเดิมตอนแก้ `fa_sale.go:444`; ตรวจเลขที่ซ้ำกับ `as_trans`/`gl_journal` `fa_sale.go:456-461`
- ลง GL: SQL หัวเอกสาร AS ที่ template engine ใช้ `gl_template.go:798-817` (เรียกที่ `:892`) และรายการลงบัญชีซ้ำเฉพาะ template (เฉพาะ 1802 และข้ามเอกสารที่ `trans_direct = 1`) `gl_template.go:1112-1114` ([[acc-gl-template-engine]])
- รายงาน: ลูกหนี้ค้างรับ `report_menu_ap_ar.go:478`, `:555`; รายงานรับ-จ่ายเงิน `report_menu_cb.go:761`; ภาษีขาย/หัก ณ ที่จ่ายตรวจว่าเอกสารเป็นของ AS `trans_tax.go:238`; รายงานขายสินทรัพย์ `glfaAssetSale` `report_menu_gl_fa.go:1539-1550` (join `as_trans` ที่ `:1545`)
- ออกเลขที่ถัดไป: `nextDocNoTables` มี `as_trans` (`doc_no_next.go:12`)

## ข้อควรระวัง
- 1801 ไม่ใช่ตัวเก็บยอดสะสม: ตารางนี้ไม่ได้ปรับยอดใน `as_asset_detail` ยอดสะสมคำนวณจากผลรวม `as_trans_detail.sum_amount` ของ 1801 บวก `as_sum_value_balance` ([[tbl-as-asset-detail]])
- `doc_no` ของ 1801/1802 ห้ามซ้ำกับเอกสารอื่นใน `as_trans` ที่ `trans_flag` ต่างกัน (1801 ตรวจ `IS DISTINCT FROM` `fa_depreciation.go:919-920`; 1802 ตรวจ `doc_no` ซ้ำใน `as_trans` หรือ `gl_journal` `fa_sale.go:456-461`)
- 1802 ต้องกรอง `trans_flag = 1802` ทุกครั้ง เพราะใช้ `doc_no` ร่วมกับตารางภาษี/GL ที่มีเอกสารสินค้าเลขที่ซ้ำกันได้
- `process_by` เก็บค่าที่หน้าจอส่งมาลบ 1 (0 รายวัน, 1 รายเดือน, 2 รายปี) ไม่ใช่ค่า 1/2/3 ที่ส่งมา เวลาอ่านย้อนต้องบวก 1 กลับ (`fa_depreciation.go:973`)
- ยอดเงินเป็น NUMERIC ส่งเป็น string ([[acc-rounding-decimal]]); ห้ามเปิดแก้ผ่านหน้า master (ตารางเงิน)

## ที่มาในโค้ด
- `backend/internal/application/process/fa_depreciation.go:29` ค่าคงที่ 1801/1802
- `backend/internal/application/process/fa_depreciation.go:868` ตรวจสินทรัพย์ที่ขายแล้ว
- `backend/internal/application/process/fa_depreciation.go:880` ลบเอกสาร 1801
- `backend/internal/application/process/fa_depreciation.go:897` หาเอกสารของงวดเดียวกัน
- `backend/internal/application/process/fa_depreciation.go:919` ตรวจ doc_no ซ้ำ
- `backend/internal/application/process/fa_depreciation.go:940` ตรวจช่วงวันที่ทับกัน (`checkDepOverlap`)
- `backend/internal/application/process/fa_depreciation.go:966` INSERT as_trans (1801)
- `backend/internal/application/process/fa_sale.go:17` saleTransType
- `backend/internal/application/process/fa_sale.go:419` อ่านวันที่เอกสารตอนลบ
- `backend/internal/application/process/fa_sale.go:487` ลบเอกสาร 1802
- `backend/internal/application/process/fa_sale.go:515` INSERT as_trans (1802)
- `backend/internal/application/process/fa_sale.go:558` INSERT cb_trans (ขายสด)
- `backend/internal/application/process/gl_template.go:798` SQL หัวเอกสาร AS สำหรับ GL
- `backend/internal/application/process/gl_template.go:1112` ลงบัญชีซ้ำด้วย template
- `backend/internal/application/process/docs.go:616` billDebtSource
- `backend/internal/application/process/trans_tax.go:238` ตรวจว่าเอกสารเป็นของ AS
- `backend/internal/application/process/report_menu_gl_fa.go:1542` รายงานขายสินทรัพย์
- `scripts/sql/02_data_schema.sql:1944` DDL ของตาราง
- `backend/internal/application/process/report_menu_ap_ar.go:478` ลูกหนี้ค้าง
- `backend/internal/application/process/report_menu_cb.go:761` สถานะเอกสารในรายงานรับจ่าย
- `backend/internal/application/process/doc_no_next.go:12` ตารางออกเลขที่ถัดไป
- `backend/internal/domain/query/write_policy.go:24` regex ตารางเงิน

## ดูเพิ่ม
- [[tbl-group-as]]
- [[tbl-as-trans-detail]]
- [[acc-fixed-asset-depreciation]]
- [[acc-trans-flag-map]]
- [[acc-gl-posting-standard]]
