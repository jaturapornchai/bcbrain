---
title: "erp_bank / erp_bank_branch — ธนาคารและสาขาธนาคาร"
tags: [tables, erp, bank, company-db]
aliases: ["erp_bank", "erp_bank_branch", "ธนาคาร", "สาขาธนาคาร", "chq_income_account_code", "logo_url"]
sources: ["backend/internal/application/process/gl_template.go:198", "backend/internal/application/process/gl_template.go:521", "backend/internal/application/process/service.go:859", "backend/internal/platform/db/pool.go:66", "backend/internal/application/process/report_menu_cb.go:493", "backend/internal/application/process/report_menu_singha.go:1019", "backend/internal/domain/query/write_policy_legacy.go:17", "frontend/src/config/schemas/icMasterSchemas.ts:706", "scripts/sql/02_data_schema.sql:2518", "scripts/sql/04_seed_data.sql:124"]
---

# erp_bank / erp_bank_branch

ตารางหลักธนาคารและสาขา (Company DB) ใช้ในสมุดเงินฝาก เช็ค และรายงานเงินฝาก นิยามตาราง (DDL) อยู่ใน `scripts/sql/02_data_schema.sql` (`erp_bank` บรรทัด 2518-2529, `erp_bank_branch` บรรทัด 2534-2545) โค้ด Go ไม่ได้สร้างสองตารางนี้ มีแต่เพิ่มคอลัมน์ `logo_url` ให้ `erp_bank`

## erp_bank
| คอลัมน์ | ความหมาย | ที่มา |
|---|---|---|
| `code` | รหัสธนาคาร varchar(25) — คีย์ที่ `erp_pass_book.bank_code` และ `cb_chq_list.bank_code` อ้างถึง | report_menu_cb.go:493; 02_data_schema.sql:2522 |
| `name_1` | ชื่อธนาคาร varchar(100) | report_menu_cb.go:493; report_menu_singha.go:1019-1024; 02_data_schema.sql:2523 |
| `name_2` | ชื่อภาษาอังกฤษ (ทะเบียนธนาคารแสดงเป็น "ชื่อภาษาอังกฤษ") | report_menu_singha.go:1024; 02_data_schema.sql:2524 |
| `chq_income_account_code` | รหัสบัญชี GL ของเช็ครับล่วงหน้าของธนาคารนี้ (ป้ายหน้าจอ "รหัสบัญชีเช็ครับล่วงหน้า") — เทมเพลต GL ของรายการ "ธนาคาร_เช็ครับล่วงหน้า" ใช้เป็นบัญชีของตัวแทน `&ACCBANK&` โดยหาธนาคารจากรหัสธนาคารของเช็ค | gl_template.go:198, 521-526; icMasterSchemas.ts:713-719; 02_data_schema.sql:2527 |
| `logo_url` | URL โลโก้ธนาคาร (หน้าจอกำหนดธนาคารมีช่องนี้) — ไม่อยู่ในคำสั่งสร้างตารางของไฟล์ DDL แต่ถูกเพิ่มด้วย `ALTER … ADD COLUMN IF NOT EXISTS` ตอนเปิดฐานบริษัท (`companySchemaSQL` รันที่ pool.go:217) และชุดคำสั่ง ERP schema ครั้งแรกต่อฐาน (service.go:972-976) | service.go:859; platform/db/pool.go:66; icMasterSchemas.ts:720-724 |

คอลัมน์อื่นใน DDL (`status`, `guid_code`, `ignore_sync`, `is_lock_record`) ไม่พบโค้ด Go ที่อ่านหรือเขียนโดยเฉพาะ (02_data_schema.sql:2518-2529)

## erp_bank_branch
| คอลัมน์ | ความหมาย | ที่มา |
|---|---|---|
| `code` | รหัสสาขาธนาคาร varchar(25) — รายงานต้องจับคู่กับ `bank_code` เสมอ (ข้อมูลตัวอย่างใช้รหัส 0001 ซ้ำกันหลายธนาคาร: 04_seed_data.sql:124-126) | report_menu_cb.go:494, 497, 499; 02_data_schema.sql:2538 |
| `name_1` | ชื่อสาขา varchar(100) | report_menu_cb.go:494; 02_data_schema.sql:2539 |
| `bank_code` | → `erp_bank.code` — รายงานเงินฝากและเช็คหาชื่อสาขาด้วย `bank_code` + `code` คู่กัน | report_menu_cb.go:494, 497, 499; 02_data_schema.sql:2541 |

หน้าจอกำหนดสาขาธนาคาร (เมนู 1.6.2) ต้องเลือกธนาคารก่อนเสมอ (`parentFilter` ที่ `bank_code`, `required: true`) — icMasterSchemas.ts:732-740 <!-- pragma: allowlist secret -->

หมายเหตุ: ไฟล์ DDL ไม่ประกาศ FK ในสองตารางนี้ — รายงานเทียบ `bank_branch` ของรายการเงินฝาก/เช็คกับ `erp_bank_branch.code` ตรง ๆ ผ่านคิวรีย่อย (report_menu_cb.go:494, 497) และ `erp_pass_book.bank_branch` เป็นข้อความอิสระ (ดู [[tbl-erp-pass-book]])

## การใช้
- [[tbl-erp-pass-book]] ชี้ `bank_code` มาที่ตารางนี้
- เช็ครับล่วงหน้า: ดึง `chq_income_account_code` สร้างรายการ GL ฝั่งธนาคาร (gl_template.go:521-526; [[acc-cheque-transfer]])
- รายงานเงินฝาก/เช็คแสดงรหัส~ชื่อธนาคารและสาขา: report_menu_cb.go:493-499; ทะเบียนธนาคาร (`master_bank`): report_menu_singha.go:1019-1026
- โลโก้ธนาคาร: ดู [[std-thai-geo-map-bank-logos]]
- หน้าจอ master (กำหนดธนาคาร เมนู 1.6.1 และกำหนดสาขาธนาคาร เมนู 1.6.2 — icMasterSchemas.ts:706-741) เขียนทั้งสองตารางผ่าน `/query/exec` เพราะอยู่ใน legacy write allow-list (domain/query/write_policy_legacy.go:17; ADR-0011) <!-- pragma: allowlist secret -->

## ลิงก์
[[tbl-group-erp]]

## ที่มาในโค้ด

- `backend/internal/application/process/gl_template.go:198` คิวรีบัญชีเช็ครับล่วงหน้าของธนาคาร
- `backend/internal/application/process/gl_template.go:521` ตัวแทน `&ACCBANK&` ของเช็ครับล่วงหน้า
- `backend/internal/application/process/service.go:859` เพิ่มคอลัมน์ `logo_url`
- `backend/internal/platform/db/pool.go:66` เพิ่มคอลัมน์ `logo_url` ตอนเปิดฐานบริษัท
- `backend/internal/application/process/report_menu_cb.go:493` ชื่อธนาคาร/สาขาในรายงานเงินฝาก-เช็ค
- `backend/internal/application/process/report_menu_singha.go:1019` ทะเบียนธนาคาร
- `backend/internal/domain/query/write_policy_legacy.go:17` allow-list การเขียน
- `frontend/src/config/schemas/icMasterSchemas.ts:706` สคีมาหน้าจอกำหนดธนาคาร/สาขา
- `scripts/sql/02_data_schema.sql:2518` นิยามตาราง `erp_bank` (สาขา: 2534)
- `scripts/sql/04_seed_data.sql:124` ข้อมูลตัวอย่างสาขาธนาคาร
