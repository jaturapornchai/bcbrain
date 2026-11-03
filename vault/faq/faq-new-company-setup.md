---
title: "เริ่มใช้บริษัท/ฐานข้อมูลใหม่ ต้องตั้งข้อมูลหลักอะไรบ้างก่อนบันทึกเอกสารได้"
tags: [faq, setup, master-data, new-company]
aliases: ["เปิดบริษัทใหม่", "ตั้งต้นระบบ", "ข้อมูลหลักขั้นต่ำ", "สร้างฐานข้อมูลใหม่", "ฐานใหม่บันทึกเอกสารไม่ได้", "ยังไม่ได้กำหนดงวดบัญชี", "ต้องตั้งอะไรก่อนใช้งาน", "ไม่พบรหัสสินค้า", "ไม่พบข้อมูล : รหัสลูกค้า", "new database", "ยอดยกมา"]
sources: ["backend/internal/adapter/inbound/http/admin/workspace_google.go:395", "backend/internal/adapter/inbound/http/admin/workspace_google.go:533", "backend/internal/application/process/period.go:53", "backend/internal/application/process/period.go:128", "backend/internal/application/process/trans_validate.go:216", "backend/internal/application/process/trans_lines_check.go:169", "backend/internal/application/process/service.go:1766", "backend/internal/application/process/doc_cancel.go:410"]
---
# เริ่มใช้บริษัทใหม่ ต้องตั้งข้อมูลหลักอะไรบ้าง

**ตอบสั้น:** ฐานข้อมูลใหม่มีแค่ค่าระบบ (ตัวเลือก ข้อมูลบริษัท สาขา 00000 และผู้ใช้ผู้ดูแล `SUPERADMIN` กับผู้สร้างฐาน) ไม่มีงวดบัญชี ผังบัญชี คลัง หน่วยนับ สินค้า ลูกค้า เจ้าหนี้ ต้องสร้างเองก่อน โดยสิ่งที่ "ขาดแล้วบันทึกไม่ได้" คืองวดบัญชี (ทุกเอกสาร) รหัสคู่ค้า รหัสสินค้า หน่วยนับ และคลัง/ที่เก็บของรายการสินค้า (เอกสารที่ตารางรายการมีคอลัมน์คลัง)

## รายละเอียด
- สร้างฐาน: `WorkspaceCreateDatabase` สร้าง database (`CREATE DATABASE … ENCODING 'UTF8'` `:597`) แล้วคัดลอกโครงสร้างตารางว่าง (คอลัมน์ ค่าเริ่มต้น primary key และ unique) จากฐานต้นแบบชื่อ `bcdemo` โดยไม่ติดข้อมูลรายการ (`workspace_google.go:533`, `:603`, `cloneEmptySchemaFromTemplate` `:395`) จากนั้น seed เฉพาะ `erp_option` (ตั้ง `year_type=1` ทศนิยม 2), `erp_company_profile` (สำนักงานใหญ่ สาขา 00000) และ `erp_user` ระดับ 9 คือ `SUPERADMIN` กับรหัสผู้สร้างฐาน (ถ้ามีและไม่ใช่ `SUPERADMIN`) (`:466-515`) แล้วลงทะเบียนฐานใหม่ในฐานหลักของ provider (`bc_database_list`, `bc_google_workspace_db`, `bc_google_workspace_member`) ([[faq-tenant-database-select]])
- ลำดับที่แนะนำ (รหัสเมนูตามโค้ดปัจจุบัน ดู [[faq-menu-code-to-screen]]):
  1. ข้อมูลบริษัท 1001 และข้อเลือกพิเศษ 1002 (`menu_company_profile`, `menu_option`)
  2. **งวดบัญชี 1081** (`menu_account_period`) — ไม่มีงวดที่ตรงวันที่เอกสาร ทุกเอกสารขึ้น "ได้ถูกปิดงวดไปแล้ว หรือยังไม่ได้กำหนดงวดบัญชี กรุณาตรวจสอบ" (`period.go:53-61`; ยกเว้น flag 521-523 ที่ `period.go:128`)
  3. ผังบัญชี 9001, สมุดบัญชี 1082 (`menu_chart_of_account`, `menu_setup_gl_journal_book`)
  4. คลัง 1024, พื้นที่เก็บ 1025, หน่วยนับ 1027, สินค้า 2001
  5. ลูกหนี้ 6001, เจ้าหนี้ 5001, ธนาคาร 1066
  6. (ไม่บังคับ) รูปแบบเลขที่เอกสาร 1012 — ถ้าไม่ตั้ง ระบบใช้รูปแบบเริ่มต้นของ backend (`doc_cancel.go:410-412`)
  7. ยอดยกมา: สต็อก 54 (2033), ตั้ง/เพิ่ม/ลดหนี้ยกมาเจ้าหนี้ 81/83/85 (5007-5009), ลูกหนี้ 93/95/97 (6012-6014), เงินสด 602 (7001), ธนาคาร 604 (7011), เช็ครับ 405 (7016), เช็คจ่าย 406 (7024)
- ด่านตรวจตอนบันทึกเอกสาร: ไม่พบรหัสคู่ค้า ตอบ "กรุณาป้อน รหัสลูกค้า/รหัสเจ้าหนี้" หรือ "ไม่พบข้อมูล : …" (`trans_validate.go:216-232`); ไม่พบสินค้า/หน่วยนับ/คลัง/ที่เก็บ ตอบ "ไม่พบรหัสสินค้า", "ไม่พบหน่วยนับ …", "ป้อนข้อมูลคลังสินค้าไม่ครบ", "ป้อนข้อมูลที่เก็บสินค้าไม่ครบ" (`trans_lines_check.go:169`, `:188`, `checkWh` `:242-262`)

## ข้อควรระวัง
- ไม่พบ wizard ตั้งค่าบริษัททีละขั้นในโค้ด ต้องเปิดจอ master ทีละจอ
- ถ้าผังบัญชีไม่มีรหัสที่ GL มาตรฐานต้องใช้ ระบบไม่ error แต่ลงรหัสแรกในรายการที่หา (ใช้เป็นทั้งรหัสและชื่อ) แม้ไม่มีในผัง (`resolveChartAccount` `service.go:1766-1783`) จึงควรสร้างผังก่อนเริ่มบันทึก
- คำสั่ง seed ทุกตัวไม่สนใจ error ถ้าโครงสร้างต้นแบบเปลี่ยนอาจไม่มีผู้ใช้หรือตัวเลือก

## ดูเพิ่ม
- [[flow-new-company-setup]]
- [[term-account-period]]
- [[faq-period-closed-cannot-save]]
- [[faq-stock-opening-balance]]
- [[faq-ap-ar-opening-balance]]
- [[faq-doc-number-format]]

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/admin/workspace_google.go:395` (`cloneEmptySchemaFromTemplate`), `:533` (`WorkspaceCreateDatabase`), `:597`, `:603`
- `backend/internal/application/process/period.go:53-61`, `:128`
- `backend/internal/application/process/trans_validate.go:216-232`
- `backend/internal/application/process/trans_lines_check.go:169`, `:188`, `:257`, `:260`
- `backend/internal/application/process/service.go:1766-1783`
- `backend/internal/application/process/doc_cancel.go:410-412`
- `frontend/account/tabs/transMenuMap.ts:924` (54), `:1209` (81), `:1406` (93), `:1856` (602)
