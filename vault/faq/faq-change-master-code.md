---
title: "เปลี่ยนรหัสสินค้า/ลูกค้า/เจ้าหนี้/ผังบัญชีที่ใช้ไปแล้วได้ไหม ต้องทำยังไง"
tags: [faq, master-data, change-code, admin]
aliases: ["เปลี่ยนรหัสสินค้า", "เปลี่ยนรหัสลูกหนี้", "เปลี่ยนรหัสเจ้าหนี้", "เปลี่ยนรหัสผังบัญชี", "แก้รหัสที่ใช้แล้ว", "menu_change_code_item", "workflow/change-code", "รหัสใหม่มีอยู่แล้ว", "เริ่มเปลี่ยนรหัส", "master_logs", "ช่องรหัสแก้ไม่ได้", "รวมรหัสซ้ำ"]
sources: ["backend/internal/application/process/workflow.go:125", "backend/internal/application/process/workflow.go:204", "backend/internal/application/process/workflow.go:230", "backend/internal/application/process/workflow.go:324", "backend/internal/application/process/workflow.go:350", "backend/internal/adapter/inbound/http/process/permission.go:50", "frontend/src/config/bcMenu.ts:317", "frontend/account/process/SystemProcessWorkbenchScreen.tsx:679"]
---
# เปลี่ยนรหัสสินค้า/ลูกค้า/เจ้าหนี้/ผังบัญชีที่ใช้ไปแล้วได้ไหม

**ตอบสั้น:** ได้ แต่ต้องเป็น admin และทำที่เมนู "เปลี่ยนรหัสสินค้า / เจ้าหนี้ / ลูกหนี้ / ผังบัญชี" (รหัส 1106-1109) ระบบเปลี่ยนรหัสใน master และทุกตารางที่อ้างอิง (เอกสาร รายการบัญชี ฯลฯ) ในธุรกรรมเดียว โดยรหัสใหม่ต้องยังไม่มีอยู่ จะ "รวมรหัส" เข้ากับรหัสที่มีอยู่แล้วไม่ได้

## รายละเอียด
- เมนู: `menu_change_code_item` 1106, `menu_change_code_supplier` 1107, `menu_change_code_customer` 1108, `menu_change_gl_account_code` 1109 (ดู [[faq-menu-code-to-screen]]) เป็นเมนู admin เท่านั้น (`bcMenu.ts:317-320`) และ API `workflow/change-code` กำหนดสิทธิ์ admin (`permission.go:50`) หน้าจอเรียกที่ `SystemProcessWorkbenchScreen.tsx:679` ปุ่ม "เริ่มเปลี่ยนรหัส" (`:779`)
- ชนิดที่รองรับมี 4 อย่าง `item`, `customer`, `supplier`, `gl_account` ตามตาราง `changeCodeSpecs` ซึ่งระบุ master และคอลัมน์อ้างอิงทั้งหมด (`workflow.go:125-172`) เช่นสินค้า: `ic_inventory.code` ฯลฯ รวมถึงรหัสสินค้าในบรรทัดเอกสาร `ic_trans_detail.item_code`; ผังบัญชี: `gl_chart_of_account.code`, `gl_journal_detail.account_code` และตารางจัดสรร/แผนก/โครงการ
- ตรวจก่อนเปลี่ยน: ส่งได้ 1-500 คู่ต่อครั้ง, รหัสยาวไม่เกิน 50 ตัว, รหัสใหม่ถูกแปลงเป็นตัวพิมพ์ใหญ่, ห้ามเหมือนรหัสเดิม และห้ามซ้ำกันในรายการ (`workflow.go:204-228`)
- ตรวจในฐานข้อมูล: ต้องมีรหัสเดิม ("แถว N: ไม่พบ… เดิม …") และรหัสใหม่ต้องไม่มี ("แถว N: …ใหม่ … มีอยู่แล้ว") โดยเทียบแบบไม่สนตัวพิมพ์ (`workflow.go:258`, `:267`)
- ไม่มีการเช็คว่ารหัสเดิมถูกใช้แล้วหรือยัง: ใช้แล้วก็เปลี่ยนได้ เอกสารเก่าจะถูกแก้รหัสตามไปด้วย; ถ้า UPDATE ตารางใดล้ม ("เปลี่ยนรหัสใน … ไม่สำเร็จ") ทั้งชุดถูก rollback (`workflow.go:280`, `:324-340`)
- ตาราง/คอลัมน์ที่ไม่มีในฐานของบริษัทนั้นถูกข้ามและรายงานใน `skippedTables` แทนที่จะทำให้ทั้งชุดล้ม (`workflow.go:240-249`)
- ทุกคู่ที่เปลี่ยนจะเขียน log ลง `master_logs` (รหัสเดิม รหัสใหม่ จำนวนแถวต่อตาราง) (`workflow.go:350-356`)

## ข้อควรระวัง
- ไม่พบการเรียกคำนวณสต็อก/รายการบัญชีใหม่ใน workflow.go (ไม่มีคำว่า rebuild ในไฟล์) เพราะเป็นการเปลี่ยนชื่อรหัสอย่างเดียว (`workflow.go:230-294`) ส่วนข้อมูลที่เก็บรหัสไว้นอกรายการในตาราง `changeCodeSpecs` (เช่น ค่าตั้งต้นที่อ้างผังบัญชีเป็นข้อความ) ไม่ชัดจากโค้ดว่าถูกแก้ด้วยหรือไม่
- ย้อนกลับได้โดยสั่งเปลี่ยนกลับ (รหัสเดิมจะว่างหลังเปลี่ยน จึงไม่ชนเงื่อนไข "มีอยู่แล้ว") ควรทดลองกับ 1-2 รหัสก่อนชุดใหญ่

## ดูเพิ่ม
- [[proc-change-code]]
- [[term-chart-of-account]]
- [[faq-menu-permission-denied]]
- [[faq-menu-code-to-screen]]
- [[hist-lessons-atomic-transactions-swallowed-errors]]

## ที่มาในโค้ด
- `backend/internal/application/process/workflow.go:125-172` (`changeCodeSpecs`)
- `backend/internal/application/process/workflow.go:204-228` (`normalizeChangeCodePairs`), `:230-294` (`ChangeCode`), `:324-340` (`renameMasterWithFKChildren`), `:350-356` (`writeMasterLog`)
- `backend/internal/adapter/inbound/http/process/permission.go:50`
- `frontend/src/config/bcMenu.ts:317-320` (`ADMIN_ONLY_MENU_SET`)
- `frontend/account/process/SystemProcessWorkbenchScreen.tsx:679`, `:779`
