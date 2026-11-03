---
title: "เรียกรายงานยังไง ตั้งเงื่อนไขตรงไหน และทำไมรายงานว่างหรือไม่มีเอกสารที่ยกเลิก"
tags: [faq, report, troubleshooting]
aliases: ["รายงานไม่ขึ้น", "รายงานว่าง", "ไม่พบข้อมูลตามเงื่อนไขที่ระบุ", "ประมวลผลรายงาน", "ทำไมรายงานไม่มีเอกสารที่ยกเลิก", "แสดงเอกสารที่ยกเลิก", "show_cancel_document", "ไม่พบรายงาน", "ไม่มีสิทธิ์ดูต้นทุนสินค้า", "รายงานช้า timeout", "จากรหัส ถึงรหัส", "report/run"]
sources: ["backend/internal/application/process/report.go:246", "backend/internal/application/process/report.go:271", "backend/internal/application/process/report.go:289", "backend/internal/application/process/report.go:308", "backend/internal/application/process/report_menu_sopo.go:42", "backend/internal/application/process/report_menu_ap_ar.go:248", "backend/internal/application/process/report_options.go:124", "backend/internal/adapter/inbound/http/process/permission.go:25", "frontend/account/report/UniversalReportScreen.tsx:125", "frontend/account/report/UniversalReportScreen.tsx:1122", "frontend/account/report/UniversalReportScreen.tsx:2332"]
---
# เรียกรายงานยังไง ตั้งเงื่อนไขตรงไหน และทำไมรายงานว่าง

**ตอบสั้น:** เปิดเมนูรายงาน ตั้งเงื่อนไข (ช่วงวันที่ จากรหัส-ถึงรหัส คำค้น ตัวเลือกเฉพาะรายงาน) แล้วกดปุ่ม "ประมวลผลรายงาน" รายงานว่างส่วนใหญ่เกิดจากช่วงวันที่ ช่วงรหัส หรือเอกสารถูกยกเลิก (`last_status` ไม่ใช่ 0) ซึ่งรายงานตัดทิ้งโดยปริยาย

## รายละเอียด
- หน้ารายงานกลาง `UniversalReportScreen` ตั้งต้นวันที่ "จาก" = 1 มกราคมของปีนี้ และ "ถึง" = วันนี้ (`UniversalReportScreen.tsx:125-129`) กดปุ่ม "ประมวลผลรายงาน" (`:1122`) เพื่อเรียก `report/run` ซึ่งต้องมีสิทธิ์อ่านเมนู (`backend/internal/adapter/inbound/http/process/permission.go:25`)
- ฝั่ง backend `RunReport` (`report.go:246`) ถ้าไม่ส่งวันที่ จะใช้ย้อนหลัง 1 ปีถึงวันนี้ (`:271-272`) และถ้าวันที่เป็น พ.ศ. (ปีเกิน 2400) จะลบ 543 ให้ (`normalizeDateInput` `:163-180`, ดู [[faq-buddhist-year-date]])
- เงื่อนไขที่ส่งเข้ารายงาน: `DateFrom/DateTo`, `FromCode/ToCode`, `OrderBy`, `Keyword`, `ViewDetail` และ `Opt` (ตัวเลือกเฉพาะรายงาน) (`report_menu.go:11-24`) ไม่มีตัวกรองสาขาใน `reportParams`
- แต่ละเมนูมีรายงานของตัวเองใน registry `menuReports` (`report_menu.go:32`); ถ้าไม่พบก็ลองตัวรันแบบเดิม (legacy) แล้วถ้ายังไม่พบจะตอบ "ไม่พบรายงาน <menuKey>" (`report.go:289-295`)
- รายงานเอกสารกลุ่มสั่งขาย/สั่งซื้อ (SO/PO) กรอง `COALESCE(last_status,0)=0` เสมอ เว้นแต่รายงานนั้นมีช่องติ๊ก "แสดงเอกสารที่ยกเลิก" (`show_cancel_document`) และผู้ใช้ติ๊กไว้ (`live` `report_menu_sopo.go:42-47`, ช่องติ๊กเพิ่มที่ `:102`) ช่องติ๊กนี้ไม่มีในรายงานประเภท `sopoCancel` และบางโหมดของ `sopoReqA`/`sopoReqB` (โหมด a, c) และ `sopoPOOrd` (โหมด h) (`hasCancelOpt` `:20-30`) รายงานกรอง `doc_date BETWEEN` วันที่ที่ตั้ง ตามช่วงรหัสลูกค้า/เจ้าหนี้และคำค้น (`report_menu_so_po.go:263`)
- รายงานเจ้าหนี้/ลูกหนี้ก็ใช้ `last_status = 0` โดยปริยาย ช่อง "แสดงเอกสารที่ยกเลิก" (`show_cancel`) มีให้เฉพาะรายงานเอกสารกลุ่มตั้ง/เพิ่ม/ลดหนี้อื่น (flag 87/89/91 ฝั่งเจ้าหนี้ และ 99/101/103 ฝั่งลูกหนี้) (`aparOtherDebtFlag` `report_menu_ap_ar.go:222-228`, `:246-254`)
- ไม่มีข้อมูลเลย หน้าจอแสดง "ไม่พบข้อมูลตามเงื่อนไขที่ระบุ" (`UniversalReportScreen.tsx:2332`)
- รายงานต้นทุนสินค้า: ถ้าตั้ง `erp_option.disable_item_cost` และผู้ใช้ไม่มี `erp_user.show_item_cost` ระบบซ่อนคอลัมน์ต้นทุน หรือปฏิเสธทั้งรายงานด้วย "ไม่มีสิทธิ์ดูต้นทุนสินค้า"; ถ้าอ่านค่าไม่ได้ก็ซ่อนไว้ก่อน (`itemCostHidden` `report_options.go:121-130`, `report.go:308-312`; รายงานสต๊อกที่ลงทะเบียนไว้ใช้กฎเดียวกันใน `report_menu_ic.go:66`)
- รายงานที่ใช้เวลาเกิน 45 วินาทีจะถูกตัด (`report.go:253`)

## ข้อควรระวัง
- ชื่อช่องติ๊กไม่เหมือนกันทุกกลุ่ม: ขาย/ซื้อใช้ `show_cancel_document` ส่วนเจ้าหนี้/ลูกหนี้ใช้ `show_cancel` และมีเฉพาะบางรายงาน — รายงานที่ไม่มีช่องนี้จะไม่แสดงเอกสารยกเลิกเลย
- เอกสารต้นฉบับที่ถูกยกเลิกมี `last_status=1` จึงหายจากรายงานปกติ ดู [[faq-cancel-vs-edit-vs-delete]]

## ดูเพิ่ม
- [[proc-report-registry-conditions]]
- [[proc-report-engine]]
- [[fe-report-screens]]
- [[term-last-status-cancel-approve]]
- [[faq-print-document-form]]
- [[faq-buddhist-year-date]]

## ที่มาในโค้ด
- `backend/internal/application/process/report.go:246-272`, `:289-295`, `:308-312`, `:253` (timeout 45 วินาที)
- `backend/internal/application/process/report_menu.go:11-32`
- `backend/internal/application/process/report_menu_sopo.go:11`, `:20-30`, `:42-47`, `:102`
- `backend/internal/application/process/report_menu_so_po.go:263`
- `backend/internal/application/process/report_menu_ap_ar.go:222-228`, `:246-254`
- `backend/internal/application/process/report_options.go:121-130`
- `backend/internal/application/process/report_menu_ic.go:66`
- `backend/internal/adapter/inbound/http/process/permission.go:25`
- `frontend/account/report/UniversalReportScreen.tsx:125-129`, `:1122`, `:2332`
