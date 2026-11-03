---
title: "หัวสมุดรายวันทั่วไป (gl_journal)"
tags: [tables, gl]
aliases: ["gl_journal", "หัวรายวัน", "สมุดรายวันทั่วไป", "journal header", "รายการบัญชีหัวเอกสาร"]
sources: ["backend/internal/application/process/gl_template.go:1050", "backend/internal/application/process/service.go:1631", "backend/internal/application/process/service.go:1426", "backend/internal/application/process/service.go:1696", "backend/internal/application/process/docs.go:294", "backend/internal/application/process/doc_cancel.go:643", "backend/internal/application/process/fa_depreciation.go:995", "backend/internal/application/process/fa_sale.go:576", "backend/internal/application/process/workflow.go:480", "backend/internal/application/process/workflow.go:910", "backend/internal/application/process/stock_beginning.go:558", "backend/internal/application/process/report_menu_gl_fa.go:889", "backend/internal/application/process/report_menu_gl_fa.go:1691", "scripts/sql/02_data_schema.sql:4260"]
---

# หัวสมุดรายวันทั่วไป (`gl_journal`)

ตารางหัวเอกสารของสมุดรายวันบัญชีแยกประเภท: **1 เอกสารบัญชี = 1 แถว** ยอดรวม `debit`/`credit` ของเอกสาร ส่วนบรรทัดบัญชีอยู่ที่ [[tbl-gl-journal-detail]] ทุกเอกสารที่ลงบัญชี (ซื้อ/ขาย/รับจ่ายเงิน/สินทรัพย์/ปิดบัญชี/JV) จบที่ตารางนี้ ดูตัวเลข `trans_flag` ที่ [[acc-trans-flag-map]] และวิธีสร้างบรรทัดที่ [[acc-gl-posting-standard]], [[acc-gl-template-engine]]

## คอลัมน์สำคัญ

โครงสร้างตารางมาจาก DDL `scripts/sql/02_data_schema.sql:4260-4287` (CREATE TABLE :4260-4285, ดัชนี :4286-4287) ชนิดข้อมูลที่ DDL กำหนด: `doc_no`, `book_code`, `ref_no`, `doc_code`, `doc_format_code`, `branch_code` เป็น varchar(25), `description` varchar(5000), `guid_code` varchar(35), `ap_ar_code` varchar(20), `ap_ar_originate_from` varchar(255), `debit`/`credit` เป็น numeric (ไม่ระบุความยาวและทศนิยม การปัดอยู่ที่โค้ด), `period_number`/`journal_type`/`is_pass`/`trans_direct`/`account_year` เป็น smallint, `trans_flag` เป็น integer, `doc_date`/`ref_date` เป็น date, `roworder` เป็น serial NOT NULL ไม่มี PRIMARY KEY/UNIQUE ใน DDL มีดัชนีธรรมดาสองตัวคือ (`doc_no`, `trans_flag`) และ (`doc_date`, `trans_flag`)

| คอลัมน์ | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `doc_date` | วันที่เอกสาร (คีย์ร่วมกับ book_code, doc_no) | ทุก writer และรายงาน |
| `doc_no` | เลขที่เอกสาร ตรงกับ `ic_trans.doc_no` / `ap_ar_trans.doc_no` / `as_trans.doc_no` ของเอกสารต้นทาง | join ทุกที่ |
| `book_code` | สมุดรายวัน อ้าง [[tbl-gl-journal-book]] `code` มาจาก `erp_doc_format.gl_book` | `gl_template.go:1050`, ตรวจ `workflow.go:606` |
| `trans_flag` | ชนิดเอกสารต้นทาง (1801 ค่าเสื่อม, 1802 ขายสินทรัพย์, 1998/1999 ปิดบัญชี, 0/1999 JV ทำมือ) | rebuild/ลบ/รายงาน |
| `trans_direct` | 0 = ระบบสร้างอัตโนมัติ rebuild ได้, 1 = คีย์ตรง/ระบบเฉพาะ ห้าม rebuild ทับ | `gl_template.go:1166`, `service.go:1449-1455` |
| `journal_type` | 0 รายวัน, 1 ยกมางวด, 2 ปิดงวด, 3 ปรับปรุง, 4 ยอดยกมา | `stock_beginning.go:112`, `report_menu_gl_fa_tb.go:8-18` |
| `debit`, `credit` | ยอดรวมเดบิต/เครดิตของเอกสาร (สองฝั่งต้องเท่ากัน) | writer ทุกตัว, `workflow.go` GLCheck |
| `description` | คำอธิบายรายการ (ตัดที่ 5000 ตัวอักษร) | `gl_template.go:1050` |
| `period_number`, `account_year` | งวด/ปีบัญชี จาก `erp_account_period` ตามวันที่ ถ้าไม่พบใช้เดือน/ปีของ `doc_date` | `service.go:1696-1712` |
| `branch_code` | สาขา (ถ้าว่าง rebuild ใส่ `'00000'`) | `service.go:1696-1712` |
| `doc_format_code` | รูปแบบเอกสารต้นทาง อ้าง [[tbl-erp-doc-format]] | `gl_template.go:1050` |
| `ref_no`, `ref_date` | เอกสารอ้างอิง (เขียนเฉพาะ JV ทำมือและยอดยกมาสต็อก) | `docs.go:294`, `stock_beginning.go:558` |
| `is_pass` | สถานะผ่านรายการ 0/1 ปุ่มผ่านรายการตั้ง 1 ปุ่มยกเลิกตั้ง 0 รายงานอ่านเฉพาะ `in (0,1)` ค่าอื่น (ไม่ชัดจากโค้ด) | `workflow.go:480-521`, `report_menu_gl_fa.go:25`, `report_menu_gl_fa.go:1691` |
| `guid_code`, `create_date_time_now` | รหัส GUID (varchar(35)) และเวลาสร้างแถว (timestamp NOT NULL ค่าเริ่มต้น `now()`) writer ของ FA/ปิดบัญชีเป็นผู้ใส่สองคอลัมน์นี้ ที่อื่นปล่อยให้เป็นค่าเริ่มต้น | `fa_depreciation.go:995`, `workflow.go:910` |
| `roworder` | ลำดับแถวภายใน (ใช้เรียง `ORDER BY roworder`) | `doc_cancel.go:612` |
| `create_code` | ผู้สร้าง (รหัสผู้ใช้) **ไม่มีใน DDL ของ `gl_journal`** (:4260-4285) และไม่มีคำสั่ง ALTER เพิ่มคอลัมน์นี้ใน `scripts/sql` แต่ INSERT ของ writer FA/ปิดบัญชีระบุคอลัมน์นี้ ฐานที่สร้างจาก DDL นี้อย่างเดียวอาจเขียนไม่ผ่าน (ยังไม่ได้ตรวจ DB จริง) | `fa_depreciation.go:995-1001`, `fa_sale.go:576-579`, `workflow.go:910-915` |
| `ap_ar_code`, `ap_ar_originate_from`, `doc_code` | varchar(20) / varchar(255) / varchar(25) มีใน DDL แต่โค้ด Go ไม่ได้ใช้ (ไม่ทราบความหมายแน่ชัด) | - |
| `ignore_sync`, `is_lock_record` | integer ค่าเริ่มต้น 0 มีใน DDL แต่โค้ด Go ไม่ได้ใช้กับตารางนี้ (ไม่ทราบความหมายแน่ชัด) | - |

โค้ดอ้างดัชนีไม่ซ้ำชื่อ `gl_journal_pk_code` บน (`doc_date`, `book_code`, `doc_no`) (`docs.go:437`) และถ้าบันทึกเอกสารยกเลิกแล้วชนคีย์ (รหัส Postgres 23505) ระบบแปลงเป็นข้อความเลขที่เอกสารซ้ำ (`doc_cancel.go:659-662`) แต่ DDL (`scripts/sql/02_data_schema.sql:4260-4287`) ไม่ได้สร้างดัชนีหรือ constraint ไม่ซ้ำนี้ และไม่พบชื่อ `gl_journal_pk_code` ในสคริปต์ SQL ใดใน `scripts/sql` (ตรวจด้วย grep) ความไม่ซ้ำจึงขึ้นกับฐานที่ใช้งานจริง (ยังไม่ได้ตรวจ DB จริง)

## คีย์และความสัมพันธ์
- ลูก: [[tbl-gl-journal-detail]] เชื่อมด้วย (`doc_no`, `doc_date`, `book_code`) และหลาย writer ใช้ `trans_flag` ร่วมด้วย
- สมุดรายวัน: [[tbl-gl-journal-book]] (`book_code` = `code`)
- เอกสารต้นทาง: [[tbl-ic-trans]], [[tbl-ap-ar-trans]], [[tbl-as-trans]] (ผ่าน `doc_no` + `trans_flag`)
- งวดบัญชี: [[tbl-erp-account-period]]; รูปแบบเอกสาร: [[tbl-erp-doc-format]]; สาขา: [[tbl-erp-branch-list]]
- ตารางภาษีของเอกสารเดียวกัน: [[tbl-gl-journal-vat-buy]], [[tbl-gl-journal-vat-sale]], [[tbl-gl-wht-list]]

## ใครเขียน (writers)

| ที่มา | ที่ | `trans_direct` |
|---|---|---|
| ลงบัญชีตาม template ของรูปแบบเอกสาร | `gl_template.go:1050` | 0 |
| ลงบัญชีมาตรฐาน (ไม่มี template) | `service.go:1631-1634` | (ดู [[acc-gl-posting-standard]]) |
| JV ทำมือ | `docs.go:294` | 1 |
| ยกเลิกเอกสาร กลับเดบิต/เครดิต | `doc_cancel.go:643` | 0 |
| ค่าเสื่อมราคา (1801) | `fa_depreciation.go:995` | 1 |
| ขายสินทรัพย์ (1802) แบบไม่มี template | `fa_sale.go:576` | 0 |
| ปิดบัญชีสิ้นงวด (`journal_type` 2) | `workflow.go:910` | 1 |
| ยอดยกมาสต็อก | `stock_beginning.go:558` | ตามอินพุต |
| ผ่าน/ยกเลิกผ่านรายการ (UPDATE `is_pass`) | `workflow.go:511` | - |
| ปรับ `account_year`/`period_number`/`journal_type`/`branch_code`/`book_code` หลัง rebuild | `service.go:1696-1712` | - |

## ใครลบและใครอ่าน
- ลบ: rebuild `service.go:1426-1455` (เฉพาะ `trans_direct<>1`), `deleteAutoGL` `gl_template.go:1159-1166`, ลบ JV `docs.go:441-452`, ลบ GL ของเอกสารรับ/จ่ายชำระ `docs.go:421-422`, ลบ/สร้างใหม่ของเอกสารยกเลิก `doc_cancel.go:627-642`, ยอดยกมาสต็อก `stock_beginning.go:486`, ลบเอกสารขายสินทรัพย์ `fa_sale.go:488`
- อ่าน: รายงานสมุดรายวัน `glfaJournal` `report_menu_gl_fa.go:889`, สรุปสมุดรายวัน `report_menu_gl_fa.go:1691`, งบทดลองตาม `journal_type` `report_menu_gl_fa_tb.go:8-18`, หน้าผ่านรายการ `workflow.go:393`, ตรวจรายวัน (GLCheck) `workflow.go:554-612`, ผู้ช่วย MCP `adapter/inbound/http/mcp/gateway.go:1421`

## ข้อควรระวัง
- ห้าม rebuild ทับแถว `trans_direct = 1`: JV ทำมือ ค่าเสื่อม ปิดบัญชี ยอดยกมา จะไม่ถูกสร้างใหม่ ต่างจากแถว `trans_direct = 0` ที่ถูกลบแล้วสร้างใหม่ทุกครั้ง ดู [[acc-gl-rebuild]]
- เลขที่เอกสารเดียวกันอาจมีหลายสมุด (เช่น สมุด POS กับรายวันตรง) ดังนั้นการลบ/ซิงก์ต้องใช้คีย์ `doc_no` + `book_code` + `trans_flag` ไม่ใช่ `doc_no` อย่างเดียว (SQL ลบของ rebuild `service.go:1437-1447`)
- หัวที่ไม่มีบรรทัดลูกเลยจะถูก rebuild ลบทิ้งก่อน (แม้ `trans_direct = 1`) `service.go:1426-1435`
- เอกสารที่ถูกยกเลิกไม่ถูกลบ GL แต่ระบบสร้างรายการกลับด้านพร้อมชื่อบัญชีนำหน้าด้วย `*` (`doc_cancel.go:648-653`) ดู [[acc-transaction-delete-edit]]
- ยอดตัวเลขเก็บเป็น NUMERIC ส่งผ่าน string/`big.Rat` ห้ามใช้ float (กฎการปัดเศษที่ [[acc-rounding-decimal]])
- ความหมายค่า `is_pass` อื่นนอกจาก 0/1: (ไม่ชัดจากโค้ด)

## ที่มาในโค้ด
- `backend/internal/application/process/gl_template.go:1050` insert หัวจาก template
- `backend/internal/application/process/gl_template.go:1159` deleteAutoGL
- `backend/internal/application/process/service.go:1426` rebuild ลบ orphan/รายการอัตโนมัติ
- `backend/internal/application/process/service.go:1631` insert ลงบัญชีมาตรฐาน
- `backend/internal/application/process/service.go:1696` normalize หลัง rebuild
- `backend/internal/application/process/docs.go:294` JV ทำมือ
- `backend/internal/application/process/docs.go:441` ลบ JV (`journalPlan`)
- `backend/internal/application/process/docs.go:421` ลบ GL ของเอกสารรับ/จ่ายชำระ
- `backend/internal/application/process/doc_cancel.go:627` ลบ GL เอกสารยกเลิก
- `backend/internal/application/process/doc_cancel.go:643` insert รายการกลับด้าน
- `backend/internal/application/process/fa_depreciation.go:995` GL ค่าเสื่อม 1801
- `backend/internal/application/process/fa_sale.go:576` GL ขายสินทรัพย์ 1802
- `backend/internal/application/process/workflow.go:480` JournalPass
- `backend/internal/application/process/workflow.go:910` GL ปิดบัญชี
- `backend/internal/application/process/stock_beginning.go:558` ยอดยกมา
- `backend/internal/application/process/report_menu_gl_fa.go:889` รายงานสมุดรายวัน (`glfaJournal`)
- `backend/internal/application/process/report_menu_gl_fa.go:1691` รายงานสรุปสมุดรายวัน
- `backend/internal/adapter/inbound/http/mcp/gateway.go:1421` คำอธิบายตารางสำหรับ MCP
- `scripts/sql/02_data_schema.sql:4260-4287` DDL ตาราง `gl_journal` (CREATE TABLE :4260-4285, ดัชนี :4286-4287)

## ดูเพิ่ม
- [[tbl-group-gl]]
- [[acc-gl-rebuild]]
- [[acc-gl-posting-standard]]
