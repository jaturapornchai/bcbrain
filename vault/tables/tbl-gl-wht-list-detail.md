---
title: "รายการหัก ณ ที่จ่ายแยกประเภทเงินได้ (gl_wht_list_detail)"
tags: [tables, gl]
aliases: ["gl_wht_list_detail", "รายการหัก ณ ที่จ่าย", "ประเภทเงินได้ที่หักภาษี", "WHT detail"]
sources: ["backend/internal/application/process/journaltax.go:257", "backend/internal/application/process/journaltax.go:260", "backend/internal/application/process/trans_tax.go:148", "backend/internal/application/process/trans_tax.go:202", "backend/internal/application/process/fa_sale.go:488", "backend/internal/application/process/report_menu_gl_fa.go:1140", "backend/internal/application/process/report_menu_gl_fa.go:1158", "scripts/sql/02_data_schema.sql:4753"]
---

# รายการหัก ณ ที่จ่ายแยกประเภทเงินได้ (`gl_wht_list_detail`)

บรรทัดลูกของ [[tbl-gl-wht-list]]: ใบหัก 1 ใบมีได้หลายบรรทัด แต่ละบรรทัดคือประเภทเงินได้ 1 ประเภท (ค่าบริการ ค่าเช่า ฯลฯ) พร้อมฐาน อัตรา และภาษีที่หัก รายงาน ภ.ง.ด.3 / ภ.ง.ด.53 อ่านจากตารางนี้เป็นหลัก ภาพรวมที่ [[acc-vat-register-wht]]

## คอลัมน์สำคัญ

โครงสร้างตารางมาจาก DDL `scripts/sql/02_data_schema.sql:4753-4774` (CREATE TABLE :4753-4771, ดัชนี :4772-4774) ชนิดข้อมูลที่ DDL กำหนด: `tax_rate`, `amount`, `tax_value`, `sum_amount` เป็น numeric (ไม่ระบุความยาวและทศนิยม การปัดอยู่ที่โค้ด), `doc_no`, `tax_doc_no` เป็น varchar(25), `income_type` varchar(100), `cust_code` varchar(35), `status`, `trans_flag` เป็น smallint, `line_number` เป็น integer, `doc_date`, `due_date` เป็น date, `roworder` เป็น serial NOT NULL ไม่มี PRIMARY KEY/UNIQUE ใน DDL มีดัชนีธรรมดาสามตัวคือ (`doc_no`, `trans_flag`), (`doc_date`, `trans_flag`) และ (`cust_code`)

| คอลัมน์ | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `line_number` | ลำดับบรรทัด เริ่มจาก 1 (ต่างจากแท็บภาษีซื้อ/ขายที่เริ่ม 0) | `journaltax.go:291` |
| `doc_no` | เลขที่เอกสารเจ้าของ (ตรงกับหัว) | `journaltax.go:257` |
| `tax_doc_no` | เลขที่เอกสารหัก ณ ที่จ่าย เชื่อมกับหัว | รายงาน `report_menu_gl_fa.go:1159` |
| `trans_flag` | ชนิดเอกสารเจ้าของ แยกทิศภาษี (ดูตารางใน [[tbl-gl-wht-list]]) | ทุก SQL |
| `income_type` | ประเภทเงินได้ (ข้อความ/รหัสตามที่คีย์ บรรทัดว่างถูกตัดทิ้ง `journaltax.go:266`) | รายงาน `report_menu_gl_fa.go:1153` |
| `amount` | ฐานภาษี NUMERIC 2 ตำแหน่ง | รายงาน |
| `tax_rate` | อัตราภาษี NUMERIC 4 ตำแหน่ง | รายงาน |
| `tax_value` | ภาษีที่หัก NUMERIC 2 ตำแหน่ง | รายงาน |
| `due_date` | วันที่หัก ณ ที่จ่าย รายงานกรองตามคอลัมน์นี้ ไม่ใช่วันที่เอกสาร | `report_menu_gl_fa.go:1162` |
| `cust_code` | รหัสเจ้าหนี้/ลูกหนี้ของบรรทัด | รายงาน |
| `doc_date` | date ไม่มีค่าเริ่มต้น (จึงเป็น NULL) มีใน DDL แต่ INSERT ของโค้ดไม่ได้ใส่ค่า | `journaltax.go:257` |
| `sum_amount` | numeric ค่าเริ่มต้น 0.0 มีใน DDL แต่โค้ด Go ไม่ได้ใช้กับตารางนี้ (ไม่ทราบความหมายแน่ชัด) | - |
| `status` | smallint ค่าเริ่มต้น 0 มีใน DDL แต่โค้ด Go ไม่ได้ใช้กับตารางนี้ (ไม่ทราบความหมายแน่ชัด) | - |
| `ignore_sync`, `is_lock_record` | integer ค่าเริ่มต้น 0 มีใน DDL แต่โค้ด Go ไม่ได้ใช้กับตารางนี้ (ไม่ทราบความหมายแน่ชัด) | - |
| `roworder`, `create_date_time_now` | serial NOT NULL / timestamp NOT NULL ค่าเริ่มต้น `now()` (เวลาที่แถวถูกสร้าง) INSERT ของโค้ดไม่ได้ระบุสองคอลัมน์นี้ | `journaltax.go:257` |

คอลัมน์ `doc_date` ในตารางนี้ไม่ถูกเขียนโดยโปรแกรมนี้ (INSERT `journaltax.go:257` ไม่มีคอลัมน์นี้ รายงานจึงกรองด้วย `due_date`)

## คีย์และความสัมพันธ์
- หัว: [[tbl-gl-wht-list]] ด้วย `tax_doc_no` + `trans_flag` (รายงานใช้ lateral join `report_menu_gl_fa.go:1159`) และ `doc_no` + `trans_flag`
- เอกสารเจ้าของ: [[tbl-ic-trans]], [[tbl-as-trans]], [[tbl-ap-ar-trans]], JV ([[tbl-gl-journal]])

## ใครเขียน (writers)
- `journalWhtStmts` `journaltax.go:260` สร้างบรรทัดทีละบรรทัดด้วย `whtDetailInsert` `journaltax.go:257` พร้อมรวมยอดขึ้นหัว
- เส้นทางเข้า: แท็บ WHT ของเอกสาร (`docWhtStmts` `trans_tax.go:148`), JV ทำมือ, ขายสินทรัพย์ 1802 (`fa_sale.go:680`)

## ใครลบและใครอ่าน
- ลบ: ทุกครั้งที่บันทึกแท็บ WHT ใหม่ (`trans_tax.go:163`), ลบเอกสาร (`trans_tax.go:202`), ลบเอกสารขายสินทรัพย์ (`fa_sale.go:488-490`), JV (`journaltax.go:95`, `:133`)
- อ่าน: รายงาน ภ.ง.ด.3/53 และไฟล์ส่งออก `glfaWht` `report_menu_gl_fa.go:1140`, `glfaWhtExport` `report_menu_gl_fa.go:1181`

## ข้อควรระวัง
- ยอดรวมของหัว (`gl_wht_list.amount`/`tax_value`) คำนวณจากผลรวมบรรทัดตอนบันทึกเท่านั้น (`journaltax.go:285-296`) ห้ามแก้บรรทัดตรง ๆ โดยไม่แก้หัว
- รายงานตั้งยอดเป็น 0 และสถานะ "ยกเลิก" เมื่อเอกสารเจ้าของถูกยกเลิก ทั้งที่บรรทัดยังอยู่ (`report_menu_gl_fa.go:1154-1157`)
- เงินและอัตราเป็น NUMERIC (DDL ไม่ระบุทศนิยม โค้ดปัดฐานและภาษี 2 ตำแหน่ง อัตรา 4 ตำแหน่งก่อนบันทึก `journaltax.go:285-296`) ([[acc-rounding-decimal]])

## ที่มาในโค้ด
- `backend/internal/application/process/journaltax.go:257` `whtDetailInsert`
- `backend/internal/application/process/journaltax.go:260` `journalWhtStmts`
- `backend/internal/application/process/trans_tax.go:148` `docWhtStmts`
- `backend/internal/application/process/trans_tax.go:202` ลบตามเอกสาร
- `backend/internal/application/process/fa_sale.go:488` ลบเอกสารขายสินทรัพย์
- `backend/internal/application/process/report_menu_gl_fa.go:1140` รายงาน WHT
- `backend/internal/application/process/report_menu_gl_fa.go:1158` อ่านจากบรรทัดลูก
- `scripts/sql/02_data_schema.sql:4753-4774` DDL ตาราง `gl_wht_list_detail` (CREATE TABLE :4753-4771, ดัชนี :4772-4774)

## ดูเพิ่ม
- [[tbl-group-gl]]
- [[tbl-gl-wht-list]]
- [[acc-vat-register-wht]]
