---
title: ตารางร้านขายยา (m_*), บาร์โค้ด/วันหมดอายุ, ช็อตคัตเมนู และตาราง Resource เสริม
tags: [schema, pharmacy, barcode, expiry, menu, resource, legacy]
aliases: [m_allergic, m_bodymassindex, m_congenital_disease, m_consultation, m_disease, m_dozen, m_druginteraction, m_drugsconsultants, m_drugsconsultants_details, m_frequency, m_healty_standard, m_information, m_kkos, m_mim_group, m_nationality, m_properties, m_times, m_warning, m_yourhealthy, barcode_import_list, barcode_import_list_detail, expire_date_temp, stock_expire_temp, stock_expire_warehouse_temp, form_print_detail_temp, homeshortcut, mymenugroup, mymenulist, mis_user, sub_ar_shoptype5, thai7_process, unit_standard_lite, resource_report]
sources:
  - scripts/sql/02_data_schema.sql:2023-2056
  - scripts/sql/02_data_schema.sql:4009-4041
  - scripts/sql/02_data_schema.sql:4776-4790
  - scripts/sql/02_data_schema.sql:7784-8185
  - scripts/sql/02_data_schema.sql:8655-8745
  - scripts/sql/02_data_schema.sql:8926-8980
  - scripts/sql/02_data_schema.sql:9256-9298
---

ชุดตารางเสริมเฉพาะทางจากสคีมาฐานข้อมูลกลาง รวม 45 ตาราง ประกอบด้วยระบบร้านขายยา/คลินิก/ให้คำปรึกษาด้านยา (`m_*` 19 ตาราง), ตารางนำเข้าบาร์โค้ด-ติดตามสินค้าหมดอายุ-ตารางชั่วคราว (`barcode_import_*`, `*expire_temp`, `form_print_detail_temp`), เมนูผู้ใช้/ผู้ขายภายนอก/หน่วยเสริม (`homeshortcut`, `mymenugroup`, `mymenulist`, `mis_user`, `sub_ar_shoptype5`, `thai7_process`, `unit_standard_lite`) และชุดตาราง `resource_*` สำหรับแบบฟอร์ม/รายงานดั้งเดิม (13 ตาราง) สำหรับตารางสินค้า/ลูกค้าหลัก (`ic_inventory`, `ar_customer`) ดู [[schema-overview]]

> [!NOTE] คอลัมน์ระบบประจำตาราง
> ทุกตารางในชุดนี้มีคอลัมน์มาตรฐานของสคีมาดั้งเดิมครบ ได้แก่ `ignore_sync integer DEFAULT 0`, `is_lock_record integer DEFAULT 0`, `roworder serial NOT NULL`, `create_date_time_now timestamp without time zone NOT NULL DEFAULT now()`

---

## 1. ระบบร้านขายยาและการดูแลสุขภาพ (`m_*` — 19 ตาราง)

### ก. ทะเบียนข้อมูลยาและคำแนะนำการใช้ยา (Drug Master & Reference)
| ตาราง | จุดอ้างอิง | หน้าที่หลัก | คอลัมน์สำคัญ และดัชนี |
| :--- | :--- | :--- | :--- |
| `m_information` | `L7996` | รายละเอียดทางเภสัชวิทยาของสินค้ายา | `ic_code`, `mim_group`, `common_name`, `properties`, `dozen`, `symptom`, `warning`, `remark`, `times`, `frequency`, `keep_methods`, `guid_code` |
| `m_druginteraction` | `L7875` | คู่ยาที่มีปฏิกิริยาต่อกัน (Drug Interaction) | `item_code_1`, `item_code_2`, `remark` |
| `m_disease` | `L7844` | ทะเบียนโรค อาการ และแนวทางรักษา | `code`, `name_1`, `name_2`, `symptom`, `therapy`, `status`, `guid_code` \| ดัชนี `idx_m_disease_code` (`L7859`) |
| `m_dozen` | `L7861` | ขนาด/รูปแบบการรับประทานยา | `icode`, `name_1`, `name_2`, `status`, `guid_code` |
| `m_frequency` | `L7918` | ความถี่การรับประทานยา | `code`, `name_1`, `name_2`, `status`, `guid_code` (`character(1)`) \| ดัชนี `idx_m_frequency_code` (`L7931`) |
| `m_times` | `L8074` | ช่วงเวลาการใช้ยา (เช่น เช้า กลางวัน เย็น) | `code`, `name_1`, `name_2`, `status`, `guid_code` \| ดัชนี `idx_m_times_code` (`L8087`) |
| `m_properties` | `L8059` | สรรพคุณยา | `code`, `name_1`, `name_2`, `status`, `guid_code` \| ดัชนี `idx_m_properties_code` (`L8072`) |
| `m_warning` | `L8089` | คำเตือน/ข้อควรระวังของยา | `icode`, `name_1`, `name_2`, `status`, `guid_code` |
| `m_mim_group` | `L8029` | กลุ่มยาตามหมวด MIMS | `code`, `name_1`, `name_2`, `status`, `guid_code` \| ดัชนี `idx_m_mim_group_code` (`L8042`) |
| `m_nationality` | `L8044` | ทะเบียนสัญชาติผู้รับบริการ | `code`, `name_1`, `name_2`, `status`, `guid_code` \| ดัชนี `idx_m_nationality_code` (`L8057`) |

### ข. ประวัติแพ้ยา โรคประจำตัว และการให้คำปรึกษาผู้ป่วย (Patient Clinical & Consultation)
| ตาราง | จุดอ้างอิง | หน้าที่หลัก | คอลัมน์สำคัญ และดัชนี |
| :--- | :--- | :--- | :--- |
| `m_allergic` | `L7784` | ประวัติแพ้ยา/กลุ่มยาของลูกค้า | `ar_code`, `ic_group_main`, `member_id`, `symptom`, `remark`, `status`, `guid_code` \| ดัชนี `idx_m_allergic_ar_code` (`L7797`) |
| `m_congenital_disease` | `L7812` | โรคประจำตัวของลูกค้า | `ar_code`, `member_id`, `disease`, `symptom`, `remark`, `status`, `guid_code` \| ดัชนี `idx_m_congenital_disease_ar_code` (`L7825`) |
| `m_consultation` | `L7827` | บันทึกคำปรึกษารายตัวยาและช่วงอ้างอิง | `ic_code`, `member_id`, `record_date`, `consultation_detail`, `doctor`, `usercreator`, `status`, `guid_code`, `min`, `max` |
| `m_drugsconsultants` | `L7885` | หัวใบให้คำปรึกษาด้านยาโดยเภสัชกร | `ar_code`, `member_id`, `date`, `staff_id`, `branch_code`, `remark`, `guid_code` \| ดัชนี `idx_m_drugsconsultants_ar_code` (`L7898`) |
| `m_drugsconsultants_details` | `L7900` | รายการยาที่แนะนำ/จ่ายในใบคำปรึกษา | `ar_code`, `date`, `ic_code`, `times`, `frequency`, `warning`, `properties`, `qty` (`smallint`), `remark`, `guid_code` \| ดัชนี `idx_m_drugsconsultants_details_ar_code` (`L7916`) |
| `m_yourhealthy` | `L8103` | บันทึกผลตรวจวัดสุขภาพลูกค้าแต่ละครั้ง | `ar_code`, `member_id`, `measure_date`, `high`, `weight`, `pressure`, `body_fat`, `ldl`, `hdl`, `triglyceride`, `cholesterol`, `kkos`, `blood_oxygen`, `bmi`, `blood_sugar`, `bun`, `creatinine`, `remark`, `guid_code` \| ดัชนี `idx_m_yourhealthy_ar_code` (`L8128`) |
| `m_bodymassindex` | `L7799` | เกณฑ์ช่วงค่าดัชนีมวลกาย (BMI) | `bmi`, `bmi_min`, `bmi_max`, `bmi_description`, `status`, `guid_code` |
| `m_kkos` | `L8015` | เกณฑ์ประเมินความเสี่ยงกระดูกพรุน (KKOS) | `min_weight`, `max_weight`, `age_min`, `age_max`, `probability_osteoporosis`, `status`, `guid_code` |
| `m_healty_standard` | `L7933` | เกณฑ์ค่ามาตรฐานผลแล็บ/สุขภาพ *(สะกด `healty` ตามสคีมาจริง)* | ค่าต่ำสุด-สูงสุดของ `body_weight`, `bmi`, `cabondioxide`, `oxygen`, `bloodpressure`, `heart_rate`, `blood_sugar`, `hba1c`, `cholesterol`, `triglyceride`, `hdl`, `ldl`, `body_fat`, `total_protein`, `albumin`, `globurin`, `uric_acid`, `bone_mass`, `sodium`, `potassium`, `chloride`, `bun`, `creatinine`, `total_bilirubin`, `direct_bilirubin`, `sgot_ast`, `sgpt_alt`, `alkaline_phosp` |

---

## 2. นำเข้าบาร์โค้ด สินค้าหมดอายุ และตาราง Temp (`barcode_import_*`, `*expire_temp`, `form_print_detail_temp` — 6 ตาราง)

| ตาราง | จุดอ้างอิง | หน้าที่หลัก | คอลัมน์สำคัญ และดัชนี |
| :--- | :--- | :--- | :--- |
| `barcode_import_list` | `L2023` | หัวชุดนำเข้าข้อมูลจากเครื่องอ่านบาร์โค้ดพกพา | `doc_date`, `doc_time`, `doc_no`, `qty`, `machine_name`, `get_success` (`smallint`), `wh_code`, `shelf_code` |
| `barcode_import_list_detail` | `L2038` | รายการสินค้า ล็อต และวันหมดอายุที่นำเข้าจากบาร์โค้ด | `barcode`, `item_code`, `unit_code`, `qty`, `doc_date`, `doc_time`, `doc_no`, `lot_number`, `expire_date`, `mfd_date`, `mfn_name` \| ดัชนี `idx_barcode_import_list_detail_item_code`, `idx_barcode_import_list_detail_barcode` (`L2055-2056`) |
| `expire_date_temp` | `L4009` | ตารางพักรายงานตรวจสอบวันหมดอายุ | `doc_date`, `doc_no`, `ic_code`, `ic_name`, `unit_code`, `expire_qty` (`numeric`), `expire_date` (`varchar(50)`), `cust_code`, `cust_name`, `balance_qty` (`varchar(50)`), `balance_unit_code` \| ดัชนี `idx_expire_date_temp_cust_code` (`L4026`) |
| `stock_expire_temp` | `L8926` | ตารางพักสต็อกใกล้หมดอายุ (แบบ `timestamp` / `numeric`) | `doc_date`, `doc_no`, `ic_code`, `ic_name`, `unit_code`, `cust_code`, `cust_name`, `expire_qty` (`numeric`), `expire_date` (`timestamp`), `balance_qty` (`numeric`), `balance_unit_code` \| ดัชนี `idx_stock_expire_temp_cust_code` (`L8943`) |
| `stock_expire_warehouse_temp` | `L8945` | ตารางพักสต็อกใกล้หมดอายุแยกตามคลัง (`warehouse`) | คอลัมน์เดียวกับ `stock_expire_temp` + `warehouse` \| ดัชนี `idx_stock_expire_warehouse_temp_cust_code` (`L8963`) |
| `form_print_detail_temp` | `L4028` | ตารางพักลำดับการพิมพ์แบบฟอร์มรายเอกสาร/ผู้ใช้ | `trans_flag`, `doc_no`, `doc_date`, `print_date`, `print_no`, `user_code` \| ดัชนี `idx_form_print_detail_temp_doc_no_trans_flag`, `idx_form_print_detail_temp_doc_date_trans_flag` (`L4040-4041`) |

---

## 3. เมนูผู้ใช้ ผู้ขาย MIS และตารางเสริมทั่วไป (7 ตาราง)

| ตาราง | จุดอ้างอิง | หน้าที่หลัก | คอลัมน์สำคัญ และดัชนี |
| :--- | :--- | :--- | :--- |
| `homeshortcut` | `L4776` | ทางลัดหน้าแรกของโปรแกรม | `menu_code`, `menu_name`, `menu_group`, `menu_tag` |
| `mymenugroup` | `L8168` | กลุ่มเมนูโปรดของผู้ใช้ | `user_code`, `group_code` |
| `mymenulist` | `L8177` | รายการเมนูโปรดในกลุ่มของผู้ใช้ | `user_code`, `group_code`, `menu_code`, `menu_tag`, `menu_name` |
| `mis_user` | `L8154` | ทะเบียนผู้ใช้/ผู้จำหน่ายระบบ MIS ภายนอก | `code`, `user_name`, `guid_code`, `is_vendor` (`smallint`), `supplier_code` *(ละเว้นคอลัมน์ข้อมูลรับรองเพื่อความปลอดภัย)* \| ดัชนี `idx_mis_user_code` (`L8166`) |
| `sub_ar_shoptype5` | `L8965` | ประเภทร้านค้าย่อยของลูกหนี้ (ระดับ 5) | `code`, `ar_shoptype5_code`, `name_1`, `name_2`, `remark`, `guid_code`, `status` \| ดัชนี `idx_sub_ar_shoptype5_code` (`L8980`) |
| `thai7_process` | `L9256` | ตารางคำนวณยอดรับ-จ่าย-คงเหลือเฉพาะกิจ | `code`, `name_1`, `name_2`, `unit_standard`, `balance_qty`, `accrued_out_qty`, `accrued_in_qty`, `guid_code`, `status` \| ดัชนี `idx_thai7_process_code` (`L9273`) |
| `unit_standard_lite` | `L9290` | ตารางแปลงหน่วยเทียบลิตร (`liter`) | `unit_cost`, `liter` (`numeric`) |

---

## 4. ชุดตาราง Resource แบบฟอร์มและรายงานดั้งเดิม (`resource_*` — 13 ตาราง)

ตารางทั้ง 13 รายการด้านล่างในสคีมา `scripts/sql/02_data_schema.sql` มีเฉพาะชุดคอลัมน์มาตรฐานของระบบ (`ignore_sync`, `is_lock_record`, `roworder`, `create_date_time_now`) ใช้เป็นโครงสร้าง Resource/ป้ายชื่อของระบบเดสก์ท็อปดั้งเดิม:

| ตาราง | บรรทัดอ้างอิง | ตาราง | บรรทัดอ้างอิง |
| :--- | :--- | :--- | :--- |
| `resource_form_purchase_order` | `L8655` | `resource_report_form` | `L8704` |
| `resource_form_quotation` | `L8662` | `resource_report_ic_column` | `L8711` |
| `resource_form_sale_order` | `L8669` | `resource_report_ic_report_name` | `L8718` |
| `resource_report` | `L8676` | `resource_report_name` | `L8725` |
| `resource_report_bank` | `L8683` | `resource_report_vat` | `L8732` |
| `resource_report_color` | `L8690` | `resource_thai7` | `L8739` |
| `resource_report_column` | `L8697` | — | — |

---

## รูปแบบการ JOIN และตัวอย่าง SQL

1. **ดึงคำแนะนำยาและตรวจสอบคำเตือนคู่ยา (`m_information` + `m_druginteraction`)**
```sql
SELECT
  i.ic_code,
  i.common_name,
  i.properties,
  i.dozen,
  i.times,
  i.frequency,
  i.warning,
  di.item_code_2 AS interact_with_item,
  di.remark AS interaction_note
FROM m_information i
LEFT JOIN m_druginteraction di
  ON di.item_code_1 = i.ic_code
WHERE i.ic_code = $1;
```

2. **ตรวจสอบรายการใบคำปรึกษาด้านยาและประวัติแพ้ยาของลูกค้า**
```sql
SELECT
  c.ar_code,
  c.date AS consult_date,
  c.staff_id,
  d.ic_code,
  d.qty,
  d.times,
  d.frequency,
  a.ic_group_main AS allergic_group,
  a.symptom AS allergic_symptom
FROM m_drugsconsultants c
JOIN m_drugsconsultants_details d
  ON d.guid_code = c.guid_code
LEFT JOIN m_allergic a
  ON a.ar_code = c.ar_code AND COALESCE(a.status, 1) = 1
WHERE c.ar_code = $1
ORDER BY c.date DESC;
```
