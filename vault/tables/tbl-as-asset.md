---
title: "ทะเบียนสินทรัพย์ (as_asset)"
tags: [tables, as]
aliases: ["as_asset", "ทะเบียนสินทรัพย์", "สินทรัพย์ถาวร", "ทะเบียนทรัพย์สิน", "fixed asset master", "menu_asset_lists"]
sources: ["backend/internal/application/process/master_detail_specs.go:81", "backend/internal/application/process/master_detail_specs.go:202", "backend/internal/application/process/master_detail_specs.go:132", "backend/internal/application/process/master_detail_specs.go:658", "backend/internal/application/process/fa_depreciation.go:653", "backend/internal/application/process/fa_sale.go:286", "backend/internal/application/process/gl_template.go:203", "backend/internal/application/process/gl_template.go:620", "backend/internal/application/process/report_menu_gl_fa.go:1245", "backend/internal/application/process/report_menu_gl_fa.go:1550", "backend/internal/application/process/item_picture.go:127"]
---

# ทะเบียนสินทรัพย์ (`as_asset`)

master ทะเบียนสินทรัพย์ถาวร 1 แถวต่อ 1 สินทรัพย์ เก็บข้อมูลทั่วไป (ชื่อ ประเภท แผนก สถานที่) และ **สามบัญชีที่ใช้ลง GL** ส่วนข้อมูลการซื้อ ประกัน และพารามิเตอร์ค่าเสื่อมราคาอยู่ที่ [[tbl-as-asset-detail]] (แถวเดียวต่อสินทรัพย์ ผูกด้วย `as_code`) หน้าจอ "ทะเบียนสินทรัพย์" ใช้ spec `menu_asset_lists` (`master_detail_specs.go:202`) บันทึกหัว (`as_asset`) และแถวรายละเอียด (`as_asset_detail`) พร้อมกัน ตามแนวทางใน [[proc-master-data]]

## คอลัมน์สำคัญ

| คอลัมน์ | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `code` | รหัสสินทรัพย์ (คีย์ `keyCol` ของ spec) | `master_detail_specs.go:202` |
| `code_old` | รหัสเดิม (ไม่ชัดจากโค้ดว่าใช้ที่ใด นอกจากเก็บ) | `master_detail_specs.go:81` |
| `name_1`, `name_2`, `name_eng_1`, `name_eng_2` | ชื่อไทย/ชื่ออื่น/ชื่ออังกฤษ ฟิลด์ `name_1` บังคับกรอก | `prepAsset` `master_detail_specs.go:658` |
| `unit_code` | หน่วยนับ อ้าง `ic_unit.code` (ข้อความ "ไม่พบหน่วยนับ") | `master_detail_specs.go:206` |
| `as_type` | ประเภทสินทรัพย์ อ้าง [[tbl-as-asset-type]].`code` | `master_detail_specs.go:207`, รายงาน `report_menu_gl_fa.go:1262` |
| `side_code`, `department_code` | หน่วยงาน/แผนก อ้าง `erp_side_list.code` / `erp_department_list.code` | `master_detail_specs.go:208-209`, `:23-24` |
| `as_location` | สถานที่ตั้ง อ้าง `as_asset_location.code` | `master_detail_specs.go:210` |
| `status` | สถานะ ช่วงที่ยอมรับ 0..2 (ความหมายแต่ละค่า: ไม่ชัดจากโค้ด) | `master_detail_specs.go:205` |
| `user_code` | ผู้ดูแล อ้าง `erp_user.code` | `master_detail_specs.go:211` |
| `account_code` | บัญชีสินทรัพย์ (ราคาซื้อ) อ้าง [[tbl-gl-chart-of-account]] บังคับกรอก | `prepAsset`, `gl_template.go:203` |
| `depreciation_account_code` | บัญชีค่าเสื่อมราคา (ฝั่ง Dr ของ 1801) บังคับกรอก | `fa_depreciation.go:9`, `:658` |
| `depreciation_sum_account_code` | บัญชีค่าเสื่อมราคาสะสม (ฝั่ง Cr ของ 1801 และตัวหักทุนใน 1802) บังคับกรอก | `fa_depreciation.go:9`, `fa_sale.go:288`, `gl_template.go:620-626` |
| `branch_code` | สาขา อ้าง [[tbl-erp-branch-list]] | `master_detail_specs.go:212` |

รายการคอลัมน์ที่หน้าจอบันทึกได้ทั้งหมดคือ `assetHdrCols` (`master_detail_specs.go:81-82`) ตารางอาจมีคอลัมน์อื่นอีกที่หน้าจอนี้ไม่แตะ (ไม่ชัดจากโค้ด เพราะไม่พบ DDL ของตารางในรีโป)

## คีย์และความสัมพันธ์
- ลูก 1:1: [[tbl-as-asset-detail]] ผ่าน `as_code` = `code` (หน้าจอสร้างแถวนี้เสมอ แม้ผู้ใช้ไม่กรอก `master_detail_specs.go:665`)
- เอกสาร: [[tbl-as-trans-detail]].`item_code` = `code` (เอกสารค่าเสื่อม 1801 / ขาย 1802)
- master ที่อ้าง: [[tbl-as-asset-type]], `as_asset_location`, `ic_unit`, `erp_user`, [[tbl-erp-branch-list]], [[tbl-gl-chart-of-account]] (สามบัญชี)
- ตารางที่ผูกสินทรัพย์ตัวนี้: `as_asset_maintenance_detail.as_code` (ซ่อมบำรุง `master_detail_specs.go:234`), `as_asset_result.as_code` (ผลคำนวณค่าเสื่อม ถูกลบพร้อมสินทรัพย์ `delChildren`), `as_asset_sale_detail.as_code` (ใช้เป็นตัวกันลบเท่านั้น)
- ฝั่งผังบัญชี: บัญชีที่ถูกใช้ในสามคอลัมน์นี้ ห้ามลบจาก [[tbl-gl-chart-of-account]] ข้อความ "ถูกใช้ในทะเบียนสินทรัพย์" (`master_detail_specs.go:132-134`)

## ใครเขียน (writers)
- หน้าจอทะเบียนสินทรัพย์ผ่านกลไก master-detail: `menu_asset_lists` `master_detail_specs.go:202-224` พร้อมตรวจ `prepAsset` `master_detail_specs.go:658` (ชื่อและสามบัญชีห้ามว่าง; วันเริ่ม/สิ้นสุดคิดค่าเสื่อม สิ้นสุดต้อง >= เริ่ม; `as_dead_value` <= 0 ถูกปรับเป็น 1)
- ตารางนี้อยู่ใน legacy write allow-list ของ `/query/exec` (ADR-0011) และไม่ใช่ "ตารางเงิน" ตาม `moneyTablePattern` (ไม่ตรง `as_trans...`)
- ไม่มี process อื่นของโปรแกรมนี้ที่เขียน `as_asset` โดยตรง (การขายแก้เฉพาะฟิลด์ขายใน `as_asset_detail`)

## ใครลบ (deleters)
- ผ่านหน้า master เดียวกัน: ลบ `as_asset_detail` (`clear`) และ `as_asset_result` (`delChildren`) ก่อน แล้วลบหัว
- ห้ามลบถ้ามีการอ้างอิงใน `as_asset_maintenance_detail`, `as_asset_sale_detail` หรือ [[tbl-as-trans-detail]] (ข้อความ "มีเอกสารสินทรัพย์อ้างอิงแล้ว" `master_detail_specs.go:221-223`)

## ใครอ่าน (readers)
- เอนจินค่าเสื่อม: `loadDepSources` `fa_depreciation.go:653-662` join `as_asset` กับ `as_asset_detail` เพื่อชื่อ สองบัญชีค่าเสื่อม และกรองช่วงรหัส/ประเภท/แผนก ([[acc-fixed-asset-depreciation]])
- ขายสินทรัพย์: `loadSaleAssets` `fa_sale.go:286-293` (ชื่อ, `account_code`, `depreciation_sum_account_code`)
- ลง GL ด้วย template: `glSQLAsset` `gl_template.go:203` และใช้กับตัวแปร "สินทรัพย์_ราคาซื้อ" (ใช้ `account_code`) และ "สินทรัพย์_ค่าเสื่อม" (ใช้ `depreciation_sum_account_code`) `gl_template.go:620-626` ([[acc-gl-template-engine]])
- รายงานสินทรัพย์: ค่าเสื่อมราคา `glfaLoadAssets` `report_menu_gl_fa.go:1245-1270`; รายละเอียดสินทรัพย์ `glfaAssetList` `report_menu_gl_fa.go:1550-1567`; รายการอื่น `report_menu_gl_fa.go:1543`, `:1630`, `:1644`
- รูปภาพประจำสินทรัพย์: ค้นหา/อ่านชื่อและหน่วยนับ `item_picture.go:127`, `:191`

## ข้อควรระวัง
- สามบัญชี (`account_code`, `depreciation_account_code`, `depreciation_sum_account_code`) กำหนดว่า GL ของ 1801/1802 ลงบัญชีไหน: 1801 ลง Dr บัญชีค่าเสื่อม / Cr บัญชีค่าเสื่อมสะสม รวมยอดต่อบัญชี และข้ามบัญชีที่ว่าง (`depGLLines` `fa_depreciation.go:716-740`); ถ้าไม่มีบรรทัด GL เลยจะไม่สร้างรายวัน (`fa_depreciation.go:989-990`)
- การเปลี่ยนบัญชีของสินทรัพย์ไม่แก้รายวันของเอกสารที่ลงไปแล้ว ต้องลงใหม่ ([[acc-gl-rebuild]])
- ชื่อสินทรัพย์ในเอกสาร ([[tbl-as-trans-detail]].`item_name`) เป็นสำเนา ณ วันบันทึก ไม่ตามการแก้ชื่อภายหลัง
- ทะเบียนนี้เป็นสินทรัพย์ถาวร ไม่ใช่สินค้า ([[tbl-ic-inventory]]) แม้รูปภาพประจำรายการใช้กลไกเดียวกัน

## ที่มาในโค้ด
- `backend/internal/application/process/master_detail_specs.go:81` `assetHdrCols`
- `backend/internal/application/process/master_detail_specs.go:132` ตัวกันลบบัญชี (chart guard)
- `backend/internal/application/process/master_detail_specs.go:202` spec `menu_asset_lists`
- `backend/internal/application/process/master_detail_specs.go:234` อ้างจากซ่อมบำรุง
- `backend/internal/application/process/master_detail_specs.go:658` `prepAsset`
- `backend/internal/application/process/fa_depreciation.go:653` `loadDepSources`
- `backend/internal/application/process/fa_sale.go:286` `loadSaleAssets`
- `backend/internal/application/process/gl_template.go:203` `glSQLAsset`
- `backend/internal/application/process/gl_template.go:620` ตัวแปร GL สินทรัพย์
- `backend/internal/application/process/report_menu_gl_fa.go:1245` `glfaLoadAssets`
- `backend/internal/application/process/report_menu_gl_fa.go:1550` `glfaAssetList`
- `backend/internal/application/process/item_picture.go:127` รูปภาพประจำสินทรัพย์

## ดูเพิ่ม
- [[tbl-group-as]]
- [[tbl-as-asset-detail]]
- [[tbl-as-asset-type]]
- [[acc-fixed-asset-depreciation]]
- [[proc-master-data]]
