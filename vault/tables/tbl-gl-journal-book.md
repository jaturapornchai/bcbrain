---
title: "สมุดรายวัน (gl_journal_book)"
tags: [tables, gl]
aliases: ["gl_journal_book", "สมุดรายวัน", "journal book", "book_code", "สมุดบัญชี"]
sources: ["backend/internal/application/process/fa_depreciation.go:918", "backend/internal/application/process/fa_sale.go:438", "backend/internal/application/process/workflow.go:606", "backend/internal/application/process/workflow.go:871", "backend/internal/application/process/report_code_ranges.go:104", "backend/internal/application/process/report_code_ranges.go:122", "backend/internal/application/process/gl_template.go:972", "backend/internal/domain/query/write_policy.go:27"]
---

# สมุดรายวัน (`gl_journal_book`)

master ของ "สมุดรายวัน" ที่เอกสารบัญชีสังกัด (เช่น สมุดรายวันซื้อ สมุดรายวันขาย สมุดรายวันทั่วไป) ใช้แบ่งกลุ่มรายการใน [[tbl-gl-journal]] ด้วย `book_code` และเป็นตัวเลือกของรายงานสมุดรายวัน เอกสารแต่ละรูปแบบกำหนดสมุดที่จะลงบัญชีไว้ในรูปแบบเอกสาร ([[tbl-erp-doc-format]].`gl_book`)

## คอลัมน์สำคัญ

| คอลัมน์ | ความหมาย | ใช้ที่ไหน |
|---|---|---|
| `code` | รหัสสมุดรายวัน (คีย์) ตรงกับ `gl_journal.book_code` | `workflow.go:606`, `report_code_ranges.go:122` |
| `name_1` | ชื่อสมุดรายวัน | `report_code_ranges.go:122` |

คอลัมน์อื่นของตาราง: (ไม่ชัดจากโค้ด) โค้ดอ่านเฉพาะ `code` และ `name_1`

## คีย์และความสัมพันธ์
- ผู้ใช้สมุด: [[tbl-gl-journal]].`book_code`, [[tbl-gl-journal-detail]].`book_code`
- ที่มาของสมุดต่อเอกสาร: [[tbl-erp-doc-format]].`gl_book` (อ่านที่ `service.go:1601`, `gl_template.go:972`, `doc_cancel.go:611-614`, `fa_depreciation.go:915`, `fa_sale.go:435`) ถ้ารูปแบบเอกสารไม่ระบุสมุดจะได้สมุดว่าง
- เอกสารยกเลิกที่รูปแบบไม่ระบุสมุด ใช้สมุดเดียวกับ GL ต้นฉบับ (`doc_cancel.go:611`)

## ใครเขียน และใครอ่าน
- เขียน: ผ่านหน้า master ทั่วไป ไม่มี writer เฉพาะทางในส่วน GL ที่อ่านมา; ตารางอยู่ใน legacy write allow-list ของ `/query/exec` (ADR-0011) และถูกยกเว้นจากกฎ "ตารางเงิน" (`write_policy.go:27`) เพราะชื่อขึ้นต้น `gl_journal` เหมือนตารางรายการแต่เป็น master
- อ่านเพื่อบังคับ: ค่าเสื่อมราคา `fa_depreciation.go:918`, ขายสินทรัพย์ `fa_sale.go:438`, ปิดบัญชี `workflow.go:871` ต้องมีรหัสสมุดในตารางนี้
- อ่านเพื่อรายงาน: ตรวจรายวัน "ไม่พบสมุดรายวัน" `workflow.go:606`, รายการสมุดให้เลือกในรายงานสมุดรายวัน `report_code_ranges.go:122`, เงื่อนไขกรองสมุด `report_code_ranges.go:104`

## ข้อควรระวัง
- ถ้าติ๊กเลือกสมุดครบทุกสมุด ตัวกรองรายงานจะไม่กรองเลย เพื่อให้รายการที่ `book_code` ว่างหรือไม่มีในตารางยังปรากฏ (คอมเมนต์ `report_code_ranges.go:104`)
- ถ้ามีรายวันที่ `book_code` ไม่อยู่ในตารางนี้ GLCheck จะรายงาน (`workflow.go:606`)
- เอกสารเดียวกันอาจมีหลายสมุดที่ใช้เลขที่เดียวกัน ดู [[tbl-gl-journal]]

## ที่มาในโค้ด
- `backend/internal/application/process/fa_depreciation.go:918` ตรวจสมุด ค่าเสื่อม
- `backend/internal/application/process/fa_sale.go:438` ตรวจสมุด ขายสินทรัพย์
- `backend/internal/application/process/workflow.go:606` GLCheck ไม่พบสมุด
- `backend/internal/application/process/workflow.go:871` ตรวจสมุด ปิดบัญชี
- `backend/internal/application/process/report_code_ranges.go:104` เงื่อนไขกรองสมุด
- `backend/internal/application/process/report_code_ranges.go:122` รายการสมุดในรายงาน
- `backend/internal/application/process/gl_template.go:972` อ่าน gl_book ของรูปแบบเอกสาร
- `backend/internal/domain/query/write_policy.go:27` ข้อยกเว้นตารางเงิน

## ดูเพิ่ม
- [[tbl-group-gl]]
- [[tbl-gl-journal]]
- [[acc-gl-template-engine]]
