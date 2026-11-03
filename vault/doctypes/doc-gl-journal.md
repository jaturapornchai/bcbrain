---
title: "บันทึกรายวัน (General Journal Voucher)"
tags: [doctypes, gl]
aliases: ["trans_flag 0", "trans_flag 1999", "JV", "ข้อมูลรายวัน", "บันทึกข้อมูลรายวันแบบเร็ว", "menu_gl_journal", "menu_gl_journal_fast", "journalPlan"]
sources: ["frontend/account/tabs/transMenuMap.ts:2368", "frontend/account/tabs/transMenuMap.ts:2451", "frontend/account/transaction/transLayouts.ts:405", "backend/internal/application/process/docs.go:119", "backend/internal/application/process/docs.go:286", "backend/internal/application/process/docs.go:302", "backend/internal/application/process/docs.go:441", "backend/internal/application/process/docs.go:444", "backend/internal/application/process/docs.go:149", "backend/internal/application/process/period.go:109", "backend/internal/application/process/period.go:17", "backend/internal/application/process/period.go:116", "backend/internal/application/process/service.go:1442", "backend/internal/application/process/journaltax.go:17", "backend/internal/application/process/journaltax.go:18", "backend/internal/application/process/journaltax.go:71", "backend/internal/application/process/journaltax.go:153", "backend/internal/application/process/journaltax.go:241", "frontend/account/transaction/JournalTaxTabs.tsx:44"]
---

# บันทึกรายวัน JV (trans_flag 0 / 1999)

## ใช้เมื่อไร
ใช้ลงบัญชีด้วยมือ เช่น ยอดยกมา ปรับปรุง หรือปิดบัญชี
- "ข้อมูลรายวัน" `menu_gl_journal` รูปแบบ JV (transMenuMap.ts:2368)
- "บันทึกข้อมูลรายวันแบบเร็ว" `menu_gl_journal_fast` รูปแบบ JV (transMenuMap.ts:2451)

## trans_flag/ตาราง
- หัวเอกสารเก็บใน [[tbl-gl-journal]] และบรรทัดเก็บใน [[tbl-gl-journal-detail]] บันทึกผ่าน `SaveDoc` (docs.go:119)
- JV มือคือ trans_flag 0 หรือ 1999 (`flagJournalVat` = 1999 "บัญชี_ข้อมูลรายวัน" journaltax.go:17 และ `isVoucherFlag` ถือว่า trans_flag < 1 หรือ 1999 เป็น JV มือ journaltax.go:71)

## ฟิลด์/แท็บบนหน้าจอ
- ไม่มีช่อง party มีช่องเอกสารอ้างอิง และมีแท็บ gl อย่างเดียว (transLayouts.ts:405)
- แท็บภาษีของ JV มือ (ภาษีซื้อ/ขาย และภาษีหัก ณ ที่จ่าย) มาจากคอมโพเนนต์ `JournalTaxTabs` แยกจาก layout และแสดงเมื่อ `isVoucherFlag` เป็นจริง (JournalTaxTabs.tsx:44)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
- VAT เขียนลง gl_journal_vat_buy / gl_journal_vat_sale (`vatInsertSQL` journaltax.go:153)
- WHT เขียนลง gl_wht_list + gl_wht_list_detail โดย 1502 = เราหักจากผู้ขาย และ 1501 = ลูกค้าหักจากเรา (journaltax.go:18-19, `whtInsert` :241)
- ดู [[acc-vat-register-wht]]

## การลงบัญชี
ผู้ใช้คีย์ Dr/Cr เอง และระบบไม่ยอมบันทึกถ้ายอดเดบิตไม่เท่ากับยอดเครดิตหลังปัดเป็น 2 ตำแหน่ง (`FormatRat(dr, 2)` docs.go:284-286)
- หัว gl_journal ของ JV บันทึก trans_direct = 1 (docs.go:302) ส่วน GL rebuild ลบเฉพาะแถวที่ trans_direct <> 1 (service.go:1442) JV มือจึงไม่ถูก rebuild ลบ
- บันทึก JV ได้เฉพาะวันที่ที่อยู่ในงวดบัญชีที่มีและยังเปิดอยู่ (`checkSaveDocPeriod` period.go:109 → `checkOpenPeriod` period.go:17, เรียกที่ docs.go:149) และการลบตรวจงวดของ JV เดิม (`checkDeleteDocPeriod` period.go:116)

## เอกสารต้นทาง-ปลายทาง
ไม่มีการดึงรายการจากเอกสารอื่น มีเพียงช่องเอกสารอ้างอิงที่เก็บลง ref_no / ref_date ของหัว gl_journal (docs.go:303)

## ยกเลิก/แก้ไข
- `journalPlan` (docs.go:441) แตะเฉพาะ JV มือ (0/1999) GL ที่ rebuild สร้างจากเอกสารอื่นที่มี doc_no เดียวกันจึงไม่ถูกแตะ (เงื่อนไข `trans_flag IN (0, 1999)` docs.go:444)
- ไม่มีคู่ยกเลิกใน `cancelOrigFlags` (doc_cancel.go:49)

## ข้อควรระวัง
- GL ของเอกสารซื้อขายถูกสร้างใหม่ทุกครั้งที่ rebuild ดังนั้นการแก้ GL ของเอกสารเหล่านั้นต้องแก้ที่เอกสาร ไม่ใช่แก้ผ่าน JV ดู [[acc-gl-rebuild]]

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:2368` / `:2451` เมนู
- `frontend/account/transaction/transLayouts.ts:405` layout gl_journal
- `backend/internal/application/process/docs.go:286` ตรวจเดบิต = เครดิต
- `backend/internal/application/process/docs.go:441` journalPlan
- `backend/internal/application/process/journaltax.go:17` / `:71` flag ของ JV มือ
- `backend/internal/application/process/period.go:109` ตรวจงวดตอนบันทึก

## ดูเพิ่ม
- [[acc-gl-posting-standard]] · [[acc-gl-rebuild]] · [[acc-period-close]] · [[doctypes-overview]]
