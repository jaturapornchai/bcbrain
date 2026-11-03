---
title: "บันทึกรายวันทั่วไป (JV) เองยังไง แก้ GL ที่ระบบลงอัตโนมัติผ่าน JV ได้ไหม"
tags: [faq, gl, journal, jv, manual]
aliases: ["ข้อมูลรายวัน", "บันทึกรายวันแบบเร็ว", "journal voucher", "menu_gl_journal", "menu_gl_journal_fast", "trans_flag 0", "trans_flag 1999", "trans_direct 1", "สมุด JV"]
sources: ["frontend/account/tabs/transMenuMap.ts:2368", "backend/internal/application/process/docs.go:251", "backend/internal/application/process/docs.go:286", "backend/internal/application/process/docs.go:294", "backend/internal/application/process/docs.go:441", "backend/internal/application/process/period.go:109", "backend/internal/application/process/journaltax.go:74", "backend/internal/application/process/service.go:1493", "backend/internal/application/process/gl_template.go:1109", "backend/internal/application/process/gl_template.go:1114", "backend/internal/application/process/doc_cancel.go:596"]
---
# บันทึกรายวันทั่วไป (JV) เองยังไง แก้ GL ที่ระบบลงอัตโนมัติผ่าน JV ได้ไหม

**ตอบสั้น:** ใช้เมนู "ข้อมูลรายวัน" (`menu_gl_journal`) หรือ "บันทึกข้อมูลรายวันแบบเร็ว" (`menu_gl_journal_fast`) รูปแบบ JV คีย์บรรทัด Dr/Cr เอง ยอดต้องเท่ากัน ระบบเก็บเป็น `trans_direct = 1` ซึ่งการประมวลผลใหม่ไม่ลบ แต่ GL อัตโนมัติของเอกสารซื้อขายต้องแก้ที่เอกสารต้นทาง ไม่ใช่แก้ผ่าน JV

## รายละเอียด
**การบันทึก** ([[doc-gl-journal]])
- สมุดรายวันว่างใช้ "JV", สาขาว่างใช้ "00000", แถวที่ไม่มีรหัสบัญชีถูกข้าม
- ผลรวม Dr ≠ Cr (2 ตำแหน่ง) → "ยอดเดบิต (…) และเครดิต (…) ไม่เท่ากัน"
- วันที่ต้องอยู่ในงวดที่เปิด (`checkSaveDocPeriod`) ([[faq-period-closed-cannot-save]])
- บันทึก `gl_journal` ด้วย `journal_type = 0`, `trans_direct = 1` และ `gl_journal_detail` ตามบรรทัด ([[tbl-gl-journal]], [[tbl-gl-journal-detail]])
- งวด/ปีบัญชีหาจาก `erp_account_period` ถ้าไม่พบใช้เดือน/ปีของวันที่เอกสาร

**แท็บภาษีของ JV** (หัวเอกสาร flag 0 หรือ 1999)
- ภาษีซื้อ/ขายเก็บใต้ flag 1999, ภาษีหักเก็บใต้ 1502 (เราหัก) / 1501 (ถูกหัก) ([[faq-wht-certificate-pnd]])
- แท็บภาษีไม่สร้างบรรทัด GL ให้ ต้องคีย์บรรทัดบัญชีภาษีเอง ไม่พบการตรวจว่าตรงกับยอดในแท็บ

**JV กับ GL อัตโนมัติ**
- ประมวลผลใหม่ลบเฉพาะ `trans_direct <> 1` JV จึงอยู่ครบ ([[faq-gl-rebuild-when]])
- เอกสารซื้อขายที่มี GL `trans_direct = 1` เลขเดียวกัน จะไม่ถูกสร้าง GL อัตโนมัติใหม่อีก (`gl_template.go:1109`, `:1114`, `doc_cancel.go:596-597`)

## ข้อควรระวัง
- ใช้เลข JV ซ้ำกับเลขเอกสารซื้อขาย ทำให้เอกสารนั้นไม่ได้ GL อัตโนมัติ
- งวดที่ไม่พบ: JV ใช้เดือนของวันที่ แต่ GL อัตโนมัติใช้ 0 รายงานที่กรองตามงวดอาจเห็นต่างกัน
- JV ที่หัวเป็น 1999 เก็บภาษีหักใต้ 1999 รายงาน ภ.ง.ด. จะไม่เห็น
- ไม่ตรวจว่ารหัสบัญชีมีในผัง ใช้ "ตรวจสอบความถูกต้อง" หาเอง ([[faq-gl-not-balanced]])

## ดูเพิ่ม
- [[term-gl-journal]]
- [[faq-cancel-vs-edit-vs-delete]]
- [[faq-vat-purchase-sale-report]]
- [[faq-doc-number-format]]

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:2368` เมนูข้อมูลรายวัน รูปแบบ JV
- `backend/internal/application/process/docs.go:251` ค่าเริ่มต้นสมุด/สาขา ข้ามแถวว่าง
- `backend/internal/application/process/docs.go:286` ตรวจ Dr = Cr
- `backend/internal/application/process/docs.go:294` insert gl_journal trans_direct 1 และงวดสำรอง
- `backend/internal/application/process/docs.go:441` `journalPlan` แตะเฉพาะ flag 0/1999
- `backend/internal/application/process/period.go:109` `checkSaveDocPeriod`
- `backend/internal/application/process/journaltax.go:74` `taxFlag` flag ของแท็บภาษี
- `backend/internal/application/process/service.go:1493` ข้ามเอกสารที่มี GL บันทึกตรง
