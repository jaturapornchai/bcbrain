---
title: "งานที่ยังไม่เสร็จหรือยังไม่ได้พอร์ตในระบบมีอะไรบ้าง (รายการค้างที่ตรวจกับโค้ดจริง)"
tags: [faq, todo, open-items, parity, dev, backend, frontend]
aliases: ["งานค้าง", "ยังไม่เสร็จ", "ยังไม่ได้พอร์ต", "not ported", "open items", "TODO ค้าง", "ข้อจำกัดที่รู้อยู่แล้ว", "ฟีเจอร์ที่ยังไม่มี", "known gaps", "ponytail not ported"]
sources: ["backend/internal/application/process/service.go:1587", "backend/internal/application/process/service.go:2036", "backend/internal/application/process/price_center.go:21", "backend/internal/application/process/trans_credit.go:18", "backend/internal/application/process/doc_flow.go:89", "frontend/account/form/FieldControl.tsx:273"]
---
# งานที่ยังไม่เสร็จหรือยังไม่ได้พอร์ตในระบบมีอะไรบ้าง

**ตอบสั้น:** โค้ดไม่มี `TODO`/`FIXME` ค้างตรง ๆ ข้อที่ยังไม่ทำถูกทำเครื่องหมายด้วยคอมเมนต์ `ponytail: ... not ported` และรายการใน handoff/TODO ของโปรเจกต์ หน้านี้รวมข้อที่ตรวจกับโค้ดปัจจุบันแล้วว่ายังเปิดอยู่ เรียงตามผลที่ผู้ใช้จะเจอ ข้อที่ตรวจโค้ดอย่างเดียวไม่ได้ (ต้องรันกับฐานจริงหรือเทียบโปรแกรมเดิม) ระบุว่า "ไม่ชัดจากโค้ด"

## รายละเอียด
**บัญชี GL**
| เรื่อง | สถานะในโค้ด |
|---|---|
| rebuild GL ไม่ดูสถานะงวดปิดในทางสำรอง | ทางสำรองอ่านงวดจาก `erp_account_period` แต่ไม่ดูคอลัมน์ `status` (`service.go:1587-1597`) ขณะที่การบันทึกตรวจงวดเปิด (`trans_validate.go:44-45`, [[faq-period-closed-cannot-save]]) และทางตัวสร้างตามรูปแบบเตือนแล้วข้ามเมื่อไม่พบงวดที่เปิด (`gl_template.go:1027-1031`) |
| บัญชีที่ไม่อยู่ในผังบัญชี | ซ่อมเฉพาะรายการเปิดสต็อก flag 54 (`service.go:1664-1676`) flag อื่นไม่ถูกตรวจในจุดนี้ |
| ใบ 250/252/254 (รายได้อื่น/ใบลดหนี้รายได้) | 250/254 ลงช่องทางชำระเมื่อเป็นขายสด/inquiry 1 หรือมีแท็บชำระใน `cb_trans` ที่ยอดจ่ายมากกว่า 0 ไม่เช่นนั้นลงลูกหนี้ (`service.go:2036`) ส่วน 252 ลงช่องทางชำระเสมอ (`service.go:2050-2057`) ([[faq-other-income-expense-gl]]) |
| แยกแผนก/โครงการ/จัดสรร | ไม่ได้พอร์ต ยังไม่มีแถวแบ่ง (`gl_template.go:1005-1007`) |
| ล็อก GL ไม่เคยทดสอบกับฐานจริง | เทสต์ใช้ tx จำลอง (`service_test.go:37-47`) ([[faq-concurrent-save-deadlock]]) |

**ขาย/ราคา/เครดิต/เอกสารอ้างอิง**
- ศูนย์ราคาฝั่ง POS (ตามบาร์โค้ด/สมาชิก) ไม่ได้พอร์ต เพราะยังไม่มีหน้า POS ฝั่งเว็บเรียก (`price_center.go:21-22`) ([[faq-price-discount-source]])
- ขอเพิ่มวงเงินด้วย OTP (`request_ar_credit`) และ dblink `join_money_credit` ไม่ได้พอร์ต ส่วนที่เกินวงเงินยังถูกบล็อก (`trans_credit.go:18-20`, `trans_save_rules.go:519-521`) ([[faq-credit-limit-approval]])
- doc flow ไม่ครอบคลุมใบขอเบิก/ขอโอน (flag 122/56/124) และแถว 213/235 ของ `ap_ar_trans` (`doc_flow.go:89`) ([[faq-doc-ref-import]])
- สินค้าชุด (set) ไม่ตั้ง `is_serial_number` ให้แถวลูก (`trans_set_item.go` ไม่มีคำว่า serial) ([[faq-serial-lot-expire]])
- flag 144 มีใน flag ชุดขาย (`trans_grid.go:92-96`) และมีเลย์เอาต์ฝั่งเว็บ แต่ไม่อยู่ใน `gridItemFlags` (`trans_grid.go:87`) ไม่ชัดจากโค้ดว่าเป็นช่องว่างจริงหรือตั้งใจ

**หน้าจอ**
- ช่องรูปภาพ/ลายมือชื่อในฟอร์มยังเป็นกล่องเปล่า "ยังไม่ได้เลือกรูป" อัปโหลดไม่ได้ (`FieldControl.tsx:273-281`)
- แท็บ MIS ของตั้งค่าบริษัท 3 ช่องเป็น `resource_only` เก็บเป็น mock และปุ่มลงทะเบียนร้านค้า/แก้รหัสผ่านยังไม่ทำ (`tab6Mis.ts:7-16`)
- ตารางรายงานว่างเมื่อดึงข้อมูลล้มเหลว (`UniversalReportScreen.tsx:535` `setRows([])` ใน catch) แสดงข้อความผิดพลาด (`setErrorMsg`) และล้างแถว/ยอดรวมเดิมทิ้ง
- `useExpireColumn` อ่าน 3 คอลัมน์ใน query เดียว (`useExpireColumn.ts:22`) ถ้าฐานไม่มีคอลัมน์ใดคอลัมน์หนึ่ง จะไม่ได้ค่าอื่นด้วย
- ไฟล์ `docs/api-contract.md` ที่ `TODO.md:96` ระบุ ยังไม่มีในโฟลเดอร์ `docs`

## ข้อควรระวัง
- ข้อที่ vault ระบุว่า "ยืนยันไม่ได้" ต้องรันกับฐานจริงหรือเทียบโปรแกรมเดิม ได้แก่ การลากคอลัมน์รายงาน, สูตรต้นทุน flag 66 (recost), ทางลัดตาราง, จอยกเลิก 3/7/31/37/39 เทียบ C#, ยอดเอกสารยกเลิกรุ่นเก่า (ไม่พบสคริปต์ backfill) อย่าถือว่าเสร็จหรือค้างจนกว่าจะทดสอบ
- ก่อนตัดสินว่า "ทำไมระบบไม่ทำตามโปรแกรมเดิม" ให้ค้น `not ported` ในไฟล์ที่เกี่ยวข้องก่อน อาจเป็นการเว้นไว้โดยตั้งใจ ([[faq-parity-csharp-bccm]])
- รายการนี้ ณ วันที่ตรวจ ถ้าแก้ข้อใดแล้วให้ลบคอมเมนต์ `ponytail:` ที่เกี่ยวข้องด้วย เพื่อไม่ให้เอกสารและโค้ดขัดกัน
- บันทึกต้นทางใน vault (`hist-todo-open-items`) อ้างบรรทัดเก่าบางจุด ให้ยึดบรรทัดในหน้านี้ซึ่งตรวจใหม่แล้ว

## ดูเพิ่ม
- [[hist-todo-open-items]]
- [[faq-parity-csharp-bccm]]
- [[faq-past-bugs-lessons]]
- [[faq-query-exec-write-blocked]]
- [[faq-gl-rebuild-when]]
- [[faq-credit-limit-approval]]

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:1587` rebuild GL อ่านงวด (ไม่ดู `status`) / `:2036` เงื่อนไข 250/254 / `:2050` เคส 48, 252
- `backend/internal/application/process/price_center.go:21` "NOT ported" ศูนย์ราคา POS
- `backend/internal/application/process/trans_credit.go:18` ส่วนเบี่ยงเบนที่ไม่พอร์ต (OTP, dblink)
- `backend/internal/application/process/doc_flow.go:89` flag ที่ doc flow ไม่ครอบคลุม
- `frontend/account/form/FieldControl.tsx:273` ช่องรูปที่ยังเป็นกล่องเปล่า
- `frontend/account/report/UniversalReportScreen.tsx:535` ล้างแถวเมื่อดึงรายงานล้มเหลว
