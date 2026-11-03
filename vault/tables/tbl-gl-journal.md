---
title: "หัวสมุดรายวันทั่วไป (gl_journal)"
tags: [tables, gl]
aliases: ["gl_journal", "หัวรายวัน", "สมุดรายวันทั่วไป", "journal header", "รายการบัญชีหัวเอกสาร"]
sources: ["backend/internal/application/process/gl_template.go:1050", "backend/internal/application/process/service.go:1620", "backend/internal/application/process/service.go:1413", "backend/internal/application/process/service.go:1684", "backend/internal/application/process/docs.go:294", "backend/internal/application/process/doc_cancel.go:643", "backend/internal/application/process/fa_depreciation.go:995", "backend/internal/application/process/fa_sale.go:576", "backend/internal/application/process/workflow.go:478", "backend/internal/application/process/workflow.go:910", "backend/internal/application/process/stock_beginning.go:558", "backend/internal/application/process/report_menu_gl_fa.go:1688"]
---

# หัวสมุดรายวันทั่วไป (`gl_journal`)

ตารางหัวเอกสารของสมุดรายวันบัญชีแยกประเภท: **1 เอกสารบัญชี = 1 แถว** ยอดรวม `debit`/`credit` ของเอกสาร ส่วนบรรทัดบัญชีอยู่ที่ [[tbl-gl-journal-detail]] ทุกเอกสารที่ลงบัญชี (ซื้อ/ขาย/รับจ่ายเงิน/สินทรัพย์/ปิดบัญชี/JV) จบที่ตารางนี้ ดูตัวเลข `trans_flag` ที่ [[acc-trans-flag-map]] และวิธีสร้างบรรทัดที่ [[acc-gl-posting-standard]], [[acc-gl-template-engine]]

## คอลัมน์สำคัญ

| คอลัมน์ | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `doc_date` | วันที่เอกสาร (คีย์ร่วมกับ book_code, doc_no) | ทุก writer และรายงาน |
| `doc_no` | เลขที่เอกสาร ตรงกับ `ic_trans.doc_no` / `ap_ar_trans.doc_no` / `as_trans.doc_no` ของเอกสารต้นทาง | join ทุกที่ |
| `book_code` | สมุดรายวัน อ้าง [[tbl-gl-journal-book]] `code` มาจาก `erp_doc_format.gl_book` | `gl_template.go:1050`, ตรวจ `workflow.go:606` |
| `trans_flag` | ชนิดเอกสารต้นทาง (1801 ค่าเสื่อม, 1802 ขายสินทรัพย์, 1998/1999 ปิดบัญชี, 0/1999 JV ทำมือ) | rebuild/ลบ/รายงาน |
| `trans_direct` | 0 = ระบบสร้างอัตโนมัติ rebuild ได้, 1 = คีย์ตรง/ระบบเฉพาะ ห้าม rebuild ทับ | `gl_template.go:1166`, `service.go:1427-1440` |
| `journal_type` | 0 รายวัน, 1 ยกมางวด, 2 ปิดงวด, 3 ปรับปรุง, 4 ยอดยกมา | `stock_beginning.go:111`, `report_menu_gl_fa_tb.go:8-24` |
| `debit`, `credit` | ยอดรวมเดบิต/เครดิตของเอกสาร (สองฝั่งต้องเท่ากัน) | writer ทุกตัว, `workflow.go` GLCheck |
| `description` | คำอธิบายรายการ (ตัดที่ 5000 ตัวอักษร) | `gl_template.go:1050` |
| `period_number`, `account_year` | งวด/ปีบัญชี จาก `erp_account_period` ตามวันที่ ถ้าไม่พบใช้เดือน/ปีของ `doc_date` | `service.go:1684-1700` |
| `branch_code` | สาขา (ถ้าว่าง rebuild ใส่ `'00000'`) | `service.go:1684-1700` |
| `doc_format_code` | รูปแบบเอกสารต้นทาง อ้าง [[tbl-erp-doc-format]] | `gl_template.go:1050` |
| `ref_no`, `ref_date` | เอกสารอ้างอิง (เขียนเฉพาะ JV ทำมือและยอดยกมาสต็อก) | `docs.go:294`, `stock_beginning.go:558` |
| `is_pass` | สถานะผ่านรายการ 0/1 ปุ่มผ่านรายการตั้ง 1 ปุ่มยกเลิกตั้ง 0 รายงานอ่านเฉพาะ `in (0,1)` ค่าอื่น (ไม่ชัดจากโค้ด) | `workflow.go:478-521`, `report_menu_gl_fa.go:1688` |
| `guid_code`, `create_code`, `create_date_time_now` | รหัส GUID, ผู้สร้าง, เวลาสร้าง (เขียนเฉพาะ writer ของ FA/ปิดบัญชี) | `fa_depreciation.go:995`, `workflow.go:910` |
| `roworder` | ลำดับแถวภายใน (ใช้เรียง `ORDER BY roworder`) | `doc_cancel.go:612` |

คีย์ไม่ซ้ำคือ (`doc_date`, `book_code`, `doc_no`) ตามคอมเมนต์ที่ `doc_cancel.go:659-662` (รหัส Postgres 23505 ถูกแปลงเป็นข้อความเลขที่ซ้ำ)

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
| ลงบัญชีมาตรฐาน (ไม่มี template) | `service.go:1620` | (ดู [[acc-gl-posting-standard]]) |
| JV ทำมือ | `docs.go:294` | 1 |
| ยกเลิกเอกสาร กลับเดบิต/เครดิต | `doc_cancel.go:643` | 0 |
| ค่าเสื่อมราคา (1801) | `fa_depreciation.go:995` | 1 |
| ขายสินทรัพย์ (1802) แบบไม่มี template | `fa_sale.go:576` | 0 |
| ปิดบัญชีสิ้นงวด (`journal_type` 2) | `workflow.go:910` | 1 |
| ยอดยกมาสต็อก | `stock_beginning.go:558` | ตามอินพุต |
| ผ่าน/ยกเลิกผ่านรายการ (UPDATE `is_pass`) | `workflow.go:511` | - |
| ปรับ `account_year`/`period_number`/`journal_type`/`branch_code`/`book_code` หลัง rebuild | `service.go:1684` | - |

## ใครลบและใครอ่าน
- ลบ: rebuild `service.go:1413-1440` (เฉพาะ `trans_direct<>1`), `deleteAutoGL` `gl_template.go:1159-1166`, ลบ JV `docs.go:421-450`, ลบ/สร้างใหม่ของเอกสารยกเลิก `doc_cancel.go:627-642`, ยอดยกมาสต็อก `stock_beginning.go:486`, ลบเอกสารขายสินทรัพย์ `fa_sale.go:488`
- อ่าน: รายงานสมุดรายวัน/แยกประเภท `report_menu_gl_fa.go:1688`, งบทดลองตาม `journal_type` `report_menu_gl_fa_tb.go:8-24`, หน้าผ่านรายการ `workflow.go:393`, ตรวจรายวัน (GLCheck) `workflow.go:553-612`, ผู้ช่วย MCP `adapter/inbound/http/mcp/gateway.go:1421`

## ข้อควรระวัง
- ห้าม rebuild ทับแถว `trans_direct = 1`: JV ทำมือ ค่าเสื่อม ปิดบัญชี ยอดยกมา จะไม่ถูกสร้างใหม่ ต่างจากแถว `trans_direct = 0` ที่ถูกลบแล้วสร้างใหม่ทุกครั้ง ดู [[acc-gl-rebuild]]
- เลขที่เอกสารเดียวกันอาจมีหลายสมุด (เช่น สมุด POS กับรายวันตรง) ดังนั้นการลบ/ซิงก์ต้องใช้คีย์ `doc_no` + `book_code` + `trans_flag` ไม่ใช่ `doc_no` อย่างเดียว (คอมเมนต์ที่ `service.go:1429`)
- หัวที่ไม่มีบรรทัดลูกเลยจะถูก rebuild ลบทิ้งก่อน (แม้ `trans_direct = 1`) `service.go:1413-1423`
- เอกสารที่ถูกยกเลิกไม่ถูกลบ GL แต่ระบบสร้างรายการกลับด้านพร้อมชื่อบัญชีนำหน้าด้วย `*` (`doc_cancel.go:648-652`) ดู [[acc-transaction-delete-edit]]
- ยอดตัวเลขเก็บเป็น NUMERIC ส่งผ่าน string/`big.Rat` ห้ามใช้ float (กฎการปัดเศษที่ [[acc-rounding-decimal]])
- ความหมายค่า `is_pass` อื่นนอกจาก 0/1: (ไม่ชัดจากโค้ด)

## ที่มาในโค้ด
- `backend/internal/application/process/gl_template.go:1050` insert หัวจาก template
- `backend/internal/application/process/gl_template.go:1159` deleteAutoGL
- `backend/internal/application/process/service.go:1413` rebuild ลบ orphan/รายการอัตโนมัติ
- `backend/internal/application/process/service.go:1620` insert ลงบัญชีมาตรฐาน
- `backend/internal/application/process/service.go:1684` normalize หลัง rebuild
- `backend/internal/application/process/docs.go:294` JV ทำมือ
- `backend/internal/application/process/docs.go:421` ลบ JV
- `backend/internal/application/process/doc_cancel.go:627` ลบ GL เอกสารยกเลิก
- `backend/internal/application/process/doc_cancel.go:643` insert รายการกลับด้าน
- `backend/internal/application/process/fa_depreciation.go:995` GL ค่าเสื่อม 1801
- `backend/internal/application/process/fa_sale.go:576` GL ขายสินทรัพย์ 1802
- `backend/internal/application/process/workflow.go:478` JournalPass
- `backend/internal/application/process/workflow.go:910` GL ปิดบัญชี
- `backend/internal/application/process/stock_beginning.go:558` ยอดยกมา
- `backend/internal/application/process/report_menu_gl_fa.go:1688` รายงานสมุดรายวัน
- `backend/internal/adapter/inbound/http/mcp/gateway.go:1421` คำอธิบายตารางสำหรับ MCP

## ดูเพิ่ม
- [[tbl-group-gl]]
- [[acc-gl-rebuild]]
- [[acc-gl-posting-standard]]
