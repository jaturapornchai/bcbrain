---
title: "บันทึกรายวัน (General Journal Voucher)"
tags: [doctypes, gl]
aliases: ["trans_flag 0", "trans_flag 1999", "JV", "ข้อมูลรายวัน", "บันทึกข้อมูลรายวันแบบเร็ว", "menu_gl_journal", "menu_gl_journal_fast", "journalPlan"]
sources: ["frontend/account/tabs/transMenuMap.ts:2368", "frontend/account/tabs/transMenuMap.ts:2451", "frontend/account/transaction/transLayouts.ts:405", "backend/internal/application/process/docs.go:119", "backend/internal/application/process/docs.go:286", "backend/internal/application/process/docs.go:437", "backend/internal/application/process/docs.go:441", "backend/internal/application/process/journaltax.go:15", "backend/internal/application/process/journaltax.go:71", "backend/internal/application/process/journaltax.go:153"]
---

# บันทึกรายวัน JV (trans_flag 0 / 1999)

## ใช้เมื่อไร
ใช้ลงบัญชีด้วยมือ เช่น ยอดยกมา ปรับปรุง หรือปิดบัญชี
- "ข้อมูลรายวัน" `menu_gl_journal` รูปแบบ JV (transMenuMap.ts:2368)
- "บันทึกข้อมูลรายวันแบบเร็ว" `menu_gl_journal_fast` รูปแบบ JV (transMenuMap.ts:2451)

## trans_flag/ตาราง
- หัวเอกสารเก็บใน [[tbl-gl-journal]] และบรรทัดเก็บใน [[tbl-gl-journal-detail]] บันทึกผ่าน `SaveDoc` (docs.go:119)
- JV มือคือ trans_flag 0 หรือ 1999 (`flagJournalVat` = 1999 "บัญชี_ข้อมูลรายวัน" journaltax.go:15 และ `isVoucherFlag` :71)

## ฟิลด์/แท็บบนหน้าจอ
- ไม่มีช่อง party มีช่องเอกสารอ้างอิง และมีแท็บ gl อย่างเดียว (transLayouts.ts:405)
- มีแท็บภาษีของ JV มือ ได้แก่ ภาษีซื้อ/ขาย และภาษีหัก ณ ที่จ่าย (journaltax.go:15)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
- VAT เขียนลง gl_journal_vat_buy / gl_journal_vat_sale (`vatInsertSQL` journaltax.go:153)
- WHT เขียนลง gl_wht_list + gl_wht_list_detail โดย 1502 = เราหักจากผู้ขาย และ 1501 = ลูกค้าหักจากเรา (journaltax.go:15)
- ดู [[acc-vat-register-wht]]

## การลงบัญชี
ผู้ใช้คีย์ Dr/Cr เอง และระบบไม่ยอมบันทึกถ้ายอดเดบิตไม่เท่ากับยอดเครดิต (docs.go:286)

## เอกสารต้นทาง-ปลายทาง
(ไม่พบในโค้ด)

## ยกเลิก/แก้ไข
- `journalPlan` (docs.go:441) แตะเฉพาะ JV มือ (0/1999) GL ที่ rebuild สร้างจากเอกสารอื่นที่มี doc_no เดียวกันจึงไม่ถูกแตะ (comment docs.go:437)
- ไม่มีคู่ยกเลิกใน `cancelOrigFlags` (doc_cancel.go:49)

## ข้อควรระวัง
- GL ของเอกสารซื้อขายถูกสร้างใหม่ทุกครั้งที่ rebuild ดังนั้นการแก้ GL ของเอกสารเหล่านั้นต้องแก้ที่เอกสาร ไม่ใช่แก้ผ่าน JV ดู [[acc-gl-rebuild]]

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:2368` / `:2451` เมนู
- `frontend/account/transaction/transLayouts.ts:405` layout gl_journal
- `backend/internal/application/process/docs.go:286` ตรวจเดบิต = เครดิต
- `backend/internal/application/process/docs.go:441` journalPlan
- `backend/internal/application/process/journaltax.go:15` แท็บภาษี JV

## ดูเพิ่ม
- [[acc-gl-posting-standard]] · [[acc-gl-rebuild]] · [[acc-period-close]] · [[doctypes-overview]]
