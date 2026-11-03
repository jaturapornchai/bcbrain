---
title: "สมุดรายวัน (gl_journal_book)"
tags: [tables, gl]
aliases: ["gl_journal_book", "สมุดรายวัน", "journal book", "book_code", "สมุดบัญชี"]
sources: ["backend/internal/application/process/fa_depreciation.go:918", "backend/internal/application/process/fa_sale.go:438", "backend/internal/application/process/workflow.go:606", "backend/internal/application/process/workflow.go:871", "backend/internal/application/process/report_code_ranges.go:104", "backend/internal/application/process/report_code_ranges.go:122", "backend/internal/application/process/gl_template.go:972", "backend/internal/domain/query/write_policy.go:27", "backend/internal/domain/query/write_policy_legacy.go:22", "frontend/src/config/schemas/icMasterSchemas.ts:795", "scripts/sql/02_data_schema.sql:4314", "frontend/account/master/StandardMasterScreen.tsx:620"]
---

# สมุดรายวัน (`gl_journal_book`)

master ของ "สมุดรายวัน" ที่เอกสารบัญชีสังกัด (เช่น สมุดรายวันซื้อ สมุดรายวันขาย สมุดรายวันทั่วไป) ใช้แบ่งกลุ่มรายการใน [[tbl-gl-journal]] ด้วย `book_code` และเป็นตัวเลือกของรายงานสมุดรายวัน เอกสารแต่ละรูปแบบกำหนดสมุดที่จะลงบัญชีไว้ในรูปแบบเอกสาร ([[tbl-erp-doc-format]].`gl_book`)

## คอลัมน์สำคัญ

โครงสร้างตารางมาจาก DDL `scripts/sql/02_data_schema.sql:4314-4328` (CREATE TABLE :4314-4325, ALTER :4326-4327, ดัชนี :4328) ชนิดข้อมูลที่ DDL กำหนด: `code`, `word_begin` เป็น varchar(25), `name_1`, `name_2` เป็น varchar(100), `guid_code` varchar(35), `status` smallint ค่าเริ่มต้น 0, `roworder` เป็น serial NOT NULL ไม่มี PRIMARY KEY/UNIQUE ใน DDL มีดัชนีธรรมดาตัวเดียวคือ (`code`) คำสั่ง ALTER สองบรรทัดท้ายบล็อกเพิ่ม `name_2` (varchar(200)) และ `status` เฉพาะเมื่อฐานยังไม่มีคอลัมน์นั้น

| คอลัมน์ | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `code` | รหัสสมุดรายวัน (คีย์) ตรงกับ `gl_journal.book_code` | `workflow.go:606`, `report_code_ranges.go:122` |
| `name_1` | ชื่อสมุดรายวัน | `report_code_ranges.go:122` |
| `name_2` | ชื่อสมุดรายวันช่องที่ 2 หน้าตั้งค่ามาตรฐานบันทึกคอลัมน์นี้ทุกครั้งเพราะเมนูนี้ไม่ตั้ง `noName2` โค้ด Go ไม่ได้อ่าน | `StandardMasterScreen.tsx:620-622`, `icMasterSchemas.ts:795-806` |
| `word_begin` | อักษรย่อสมุดรายวัน (ตามป้ายช่องในหน้าตั้งค่า) หน้าตั้งค่าบันทึกผ่าน `extraFields` โค้ด Go ไม่ได้อ่าน | `icMasterSchemas.ts:800-802`, `StandardMasterScreen.tsx:645-650` |
| `status` | smallint ค่าเริ่มต้น 0 มีใน DDL หน้าตั้งค่าไม่เขียนค่านี้ (ซ่อนช่องสถานะเมื่อเมนูไม่ตั้ง `showStatus`) และโค้ด Go ไม่ได้ใช้ (ไม่ทราบความหมายแน่ชัด) | `StandardMasterScreen.tsx:74` |
| `guid_code` | varchar(35) มีใน DDL แต่โค้ด Go ไม่ได้ใช้ (ไม่ทราบความหมายแน่ชัด) | - |
| `ignore_sync`, `is_lock_record` | integer ค่าเริ่มต้น 0 มีใน DDL แต่โค้ด Go ไม่ได้ใช้กับตารางนี้ (ไม่ทราบความหมายแน่ชัด) | - |
| `roworder`, `create_date_time_now` | serial NOT NULL / timestamp NOT NULL ค่าเริ่มต้น `now()` (เวลาที่แถวถูกสร้าง) โค้ดของตารางนี้ไม่ได้ระบุสองคอลัมน์นี้ | - |

โค้ด Go อ่านเฉพาะ `code` และ `name_1` (`workflow.go:606`, `report_code_ranges.go:122`) คอลัมน์อื่นของ DDL ดูในตารางด้านบน

## คีย์และความสัมพันธ์
- ผู้ใช้สมุด: [[tbl-gl-journal]].`book_code`, [[tbl-gl-journal-detail]].`book_code`
- ที่มาของสมุดต่อเอกสาร: [[tbl-erp-doc-format]].`gl_book` (อ่านที่ `service.go:1612`, `gl_template.go:972`, `doc_cancel.go:611-614`, `fa_depreciation.go:915`, `fa_sale.go:435`) ถ้ารูปแบบเอกสารไม่ระบุสมุดจะได้สมุดว่าง
- เอกสารยกเลิกที่รูปแบบไม่ระบุสมุด ใช้สมุดเดียวกับ GL ของเอกสารต้นทาง (`doc_cancel.go:611-612`)

## ใครเขียน และใครอ่าน
- เขียน: ไม่มี writer เฉพาะทางใน Go; ตารางอยู่ใน legacy write allow-list ของ `/query/exec` (ADR-0011, `write_policy_legacy.go:22`) และแก้ผ่านหน้าตั้งค่า `menu_setup_gl_journal_book` (`icMasterSchemas.ts:795-799`) และถูกยกเว้นจากกฎ "ตารางเงิน" (`write_policy.go:27`) เพราะชื่อขึ้นต้น `gl_journal` เหมือนตารางรายการแต่เป็น master
- อ่านเพื่อบังคับ: ค่าเสื่อมราคา `fa_depreciation.go:918`, ขายสินทรัพย์ `fa_sale.go:438`, ปิดบัญชี `workflow.go:871` ต้องมีรหัสสมุดในตารางนี้
- อ่านเพื่อรายงาน: ตรวจรายวัน "ไม่พบสมุดรายวัน" `workflow.go:606`, รายการสมุดให้เลือกในรายงานสมุดรายวัน `report_code_ranges.go:122`, เงื่อนไขกรองสมุด `report_code_ranges.go:103-104`

## ข้อควรระวัง
- ถ้าติ๊กเลือกสมุดครบทุกสมุด ตัวกรองรายงานจะไม่กรองเลย เพื่อให้รายการที่ `book_code` ว่างหรือไม่มีในตารางยังปรากฏ (เงื่อนไข `glfaBookCond` `report_code_ranges.go:103-104`)
- ถ้ามีรายวันที่ `book_code` ไม่อยู่ในตารางนี้ GLCheck จะรายงาน (`workflow.go:606`)
- เอกสารเดียวกันอาจมีหลายสมุดที่ใช้เลขที่เดียวกัน ดู [[tbl-gl-journal]]

## ที่มาในโค้ด
- `backend/internal/application/process/fa_depreciation.go:918` ตรวจสมุด ค่าเสื่อม
- `backend/internal/application/process/fa_sale.go:438` ตรวจสมุด ขายสินทรัพย์
- `backend/internal/application/process/workflow.go:606` GLCheck ไม่พบสมุด
- `backend/internal/application/process/workflow.go:871` ตรวจสมุด ปิดบัญชี
- `backend/internal/application/process/report_code_ranges.go:103-104` เงื่อนไขกรองสมุด `glfaBookCond`
- `backend/internal/application/process/report_code_ranges.go:122` รายการสมุดในรายงาน
- `backend/internal/application/process/gl_template.go:972` อ่าน gl_book ของรูปแบบเอกสาร
- `backend/internal/domain/query/write_policy.go:27` ข้อยกเว้นตารางเงิน
- `backend/internal/domain/query/write_policy_legacy.go:22` รายชื่อใน legacy write allow-list
- `frontend/src/config/schemas/icMasterSchemas.ts:795-799` หน้าตั้งค่า `menu_setup_gl_journal_book`
- `scripts/sql/02_data_schema.sql:4314-4328` DDL ตาราง `gl_journal_book` (CREATE TABLE :4314-4325, ALTER :4326-4327, ดัชนี :4328)
- `frontend/account/master/StandardMasterScreen.tsx:620-622` หน้าตั้งค่ามาตรฐานบันทึก `name_2` และ `extraFields` (`:645-650`)

## ดูเพิ่ม
- [[tbl-group-gl]]
- [[tbl-gl-journal]]
- [[acc-gl-template-engine]]
