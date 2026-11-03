---
title: "ข้อจำกัดและส่วนที่ยังไม่มีในระบบมีอะไรบ้าง (รายการที่ตรวจกับโค้ดปัจจุบัน)"
tags: [faq, limitations, known-gaps, backend, frontend]
aliases: ["งานค้าง", "ยังไม่เสร็จ", "open items", "ข้อจำกัดที่รู้อยู่แล้ว", "ฟีเจอร์ที่ยังไม่มี", "known gaps"]
sources: ["backend/internal/application/process/service.go:1598", "backend/internal/application/process/service.go:1677", "backend/internal/application/process/service.go:2047", "backend/internal/application/process/service.go:2069", "backend/internal/application/process/gl_template.go:1006", "backend/internal/application/process/gl_template.go:1028", "backend/internal/application/process/trans_validate.go:44", "backend/internal/application/process/service_test.go:37", "backend/internal/application/process/price_center.go:21", "backend/internal/application/process/trans_credit.go:19", "backend/internal/application/process/trans_save_rules.go:519", "backend/internal/application/process/doc_flow.go:89", "backend/internal/application/process/trans_grid.go:87", "backend/internal/application/process/trans_grid.go:92", "frontend/account/form/FieldControl.tsx:273", "frontend/src/config/schemas/erpOption/tab6Mis.ts:7", "frontend/account/report/UniversalReportScreen.tsx:535", "frontend/account/transaction/useExpireColumn.ts:22"]
---
# ข้อจำกัดและส่วนที่ยังไม่มีในระบบมีอะไรบ้าง

**ตอบสั้น:** ส่วนที่จงใจเว้นไว้ในโค้ดถูกบันทึกเป็นคอมเมนต์ `ponytail:` ที่จุดนั้น หน้านี้รวมข้อที่ตรวจกับโค้ดปัจจุบันแล้วว่ายังเป็นจริง เรียงตามผลที่ผู้ใช้จะเจอ ข้อที่ดูจากโค้ดอย่างเดียวไม่ได้ว่าตั้งใจหรือไม่ ระบุว่า "ไม่ชัดจากโค้ด"

## รายละเอียด
**บัญชี GL**
| เรื่อง | สถานะในโค้ด |
|---|---|
| rebuild GL ไม่ดูสถานะงวดปิดในทางสำรอง | ทางสำรองอ่านงวดจาก `erp_account_period` ตามวันที่เอกสาร ไม่ดูคอลัมน์ `status` และได้ 0 ถ้าไม่พบงวด (`service.go:1598-1608`) ขณะที่การบันทึกตรวจงวดเปิด (`trans_validate.go:44-45`, [[faq-period-closed-cannot-save]]) และทางตัวสร้างตามรูปแบบเตือนแล้วข้ามเมื่อไม่พบงวดที่เปิด (`gl_template.go:1028-1031`) |
| บัญชีที่ไม่อยู่ในผังบัญชี | rebuild ซ่อมเฉพาะรายการเปิดสต็อก flag 54 (`service.go:1677-1685`) โดยฝั่งเดบิตเป็นบัญชีสินค้าคงเหลือและฝั่งเครดิตเป็นบัญชีทุนที่พบในผัง flag อื่นไม่ถูกตรวจในจุดนี้ |
| ใบ 250/252/254 (รายได้อื่น/ใบลดหนี้รายได้) | 250/254 ลงช่องทางชำระเมื่อเป็นขายสด/inquiry 1 หรือมีแท็บชำระใน `cb_trans` ที่ยอดจ่ายมากกว่า 0 ไม่เช่นนั้นลงลูกหนี้ (`service.go:2047`) ส่วน 252 ลงช่องทางชำระเสมอ (`service.go:2061`, `:2069`) ([[faq-other-income-expense-gl]]) |
| แยกแผนก/โครงการ/จัดสรร | ยังไม่มีแถวแบ่ง (คอมเมนต์ `gl_template.go:1006-1007`) |
| ล็อก GL ไม่เคยทดสอบกับฐานจริง | เทสต์ใช้ tx จำลอง (`service_test.go:37-54`, `:58`) ([[faq-concurrent-save-deadlock]]) |

**ขาย/ราคา/เครดิต/เอกสารอ้างอิง**
- ราคา price center สำหรับสาขา POS (ตามบาร์โค้ด/สมาชิก) ยังไม่มีในโค้ด (คอมเมนต์ `price_center.go:21-24`) ([[faq-price-discount-source]])
- ขั้นขออนุมัติเพิ่มวงเงินด้วย OTP (`request_ar_credit`) และ dblink `join_money_credit` ไม่มีในโค้ด ส่วนที่เกินวงเงินยังถูกบล็อก (`trans_credit.go:19-22`, `trans_save_rules.go:519-522`) ([[faq-credit-limit-approval]])
- doc flow (`flowRules`) ไม่ครอบคลุมใบขอเบิก/ขอโอน (flag 122/56/124) และแถว 213/235 ของ `ap_ar_trans` (`doc_flow.go:89-91`) ([[faq-doc-ref-import]])
- สินค้าชุด (set) ไม่ตั้ง `is_serial_number` ให้แถวลูก (`trans_set_item.go` ไม่มีคำว่า serial) ([[faq-serial-lot-expire]])
- flag 144 มีใน flag ชุดขาย (`trans_grid.go:92-102`) แต่ไม่อยู่ใน `gridItemFlags` (`trans_grid.go:87`) ไม่ชัดจากโค้ดว่าตั้งใจหรือไม่

**หน้าจอ**
- ช่องรูปภาพในฟอร์ม (`case "image"`) เป็นกล่องเปล่าข้อความ "ยังไม่ได้เลือกรูป" อัปโหลดไม่ได้ (`FieldControl.tsx:273-281`)
- แท็บ MIS ของตั้งค่าบริษัท 3 ช่องไม่ใช่คอลัมน์จริงของ `erp_option` เก็บเป็น mock และปุ่มลงทะเบียนร้านค้า/เพิ่มร้านค้า/แก้รหัสผ่านยังไม่ได้ทำ (คอมเมนต์ `tab6Mis.ts:7-16`)
- ตารางรายงานว่างเมื่อดึงข้อมูลล้มเหลว (`UniversalReportScreen.tsx:535` `setRows([])` ใน catch) แสดงข้อความผิดพลาด และล้างแถว/ยอดรวม/การ์ดสรุปเดิมทิ้ง
- `useExpireColumn` อ่าน 3 คอลัมน์ใน query เดียว (`useExpireColumn.ts:22`) ถ้า query ล้มเหลว ทั้งสาม flag จะเป็นปิด

## ข้อควรระวัง
- รายการนี้ตรวจ ณ วันที่เขียน ถ้าแก้ข้อใดแล้วให้ลบคอมเมนต์ `ponytail:` ที่เกี่ยวข้องในโค้ดและแก้หน้านี้ตาม เพื่อไม่ให้เอกสารและโค้ดขัดกัน
- ก่อนตัดสินว่าระบบ "ทำไมไม่ทำเรื่องนี้" ให้ค้น `ponytail:` ในไฟล์ที่เกี่ยวข้องก่อน อาจเป็นการเว้นไว้โดยตั้งใจ

## ดูเพิ่ม
- [[faq-past-bugs-lessons]]
- [[faq-query-exec-write-blocked]]
- [[faq-gl-rebuild-when]]
- [[faq-credit-limit-approval]]

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:1598` rebuild GL อ่านงวด (ไม่ดู `status`) / `:1677` ซ่อมบัญชี flag 54 / `:2047` เงื่อนไข 250/254 / `:2061`, `:2069` เคส 48, 252
- `backend/internal/application/process/gl_template.go:1006` แผนก/โครงการ/จัดสรร, `:1028` ไม่พบงวดที่เปิด
- `backend/internal/application/process/trans_validate.go:44` ตรวจงวดเปิดตอนบันทึก
- `backend/internal/application/process/service_test.go:37` tx จำลองของเทสต์ล็อก GL
- `backend/internal/application/process/price_center.go:21` ราคา price center สาขา POS
- `backend/internal/application/process/trans_credit.go:19` ส่วนที่ไม่มี (OTP, dblink); `trans_save_rules.go:519`
- `backend/internal/application/process/doc_flow.go:89` flag ที่ doc flow ไม่ครอบคลุม
- `backend/internal/application/process/trans_grid.go:87` `gridItemFlags`, `:92` flag ชุดขาย
- `frontend/account/form/FieldControl.tsx:273` ช่องรูปที่เป็นกล่องเปล่า
- `frontend/src/config/schemas/erpOption/tab6Mis.ts:7` ช่อง MIS ที่ยังเป็น mock
- `frontend/account/report/UniversalReportScreen.tsx:535` ล้างแถวเมื่อดึงรายงานล้มเหลว
- `frontend/account/transaction/useExpireColumn.ts:22` อ่าน 3 คอลัมน์ใน query เดียว
