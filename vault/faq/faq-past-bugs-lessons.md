---
title: "บั๊กที่เคยเกิดซ้ำในโปรเจกต์นี้มีอะไรบ้าง และบทเรียน/กฎที่ต้องระวังก่อนแก้โค้ดคืออะไร"
tags: [faq, lessons, history, dev, troubleshooting, backend, frontend]
aliases: ["บทเรียนจากบั๊กเก่า", "past bugs", "lessons learned", "บั๊กซ้ำ", "ก่อนแก้โค้ดควรรู้อะไร", "regression เดิม", "กฎที่ได้จากบั๊ก", "hist-lessons", "บั๊ก UAT", "ข้อผิดพลาดที่เคยเจอ"]
sources: ["backend/internal/adapter/inbound/http/process/permission.go:132", "backend/internal/application/process/trans.go:446", "backend/internal/application/process/service.go:508", "backend/internal/platform/docno/docno.go:23", "backend/internal/adapter/inbound/http/etax/handler.go:1016", "frontend/shared/components/GlobalDocFormPrintModal.tsx:1625"]
---
# บั๊กที่เคยเกิดซ้ำในโปรเจกต์นี้มีอะไรบ้าง และบทเรียนที่ต้องระวังก่อนแก้โค้ด

**ตอบสั้น:** บั๊กที่เจอบ่อยจัดเป็น 6 กลุ่ม: (1) เงิน/ทศนิยม/ภาษี (2) บัญชี GL ไม่สมดุล (3) สต็อก/ต้นทุน (4) ทำงานครึ่งทาง/พร้อมกัน (5) สิทธิ์/ความปลอดภัย (6) หน้าจอ/วันที่/ข้อมูลหายตอนบันทึก รายละเอียดเต็มอยู่ในบันทึกชุด `hist-lessons-*` ของ vault หน้านี้สรุปกฎที่ได้ พร้อมบอกว่าโค้ดปัจจุบันป้องกันที่ไหน และข้อที่ยังเหลือในโค้ดจริง

## รายละเอียด
| กลุ่ม | อาการที่เคยเกิด | กฎที่ได้ / ป้องกันที่ไหนในโค้ด |
|---|---|---|
| เงิน/ปัดเศษ | หัก ณ ที่จ่าย 1% ของ 14.50 ได้ 0.14 แทน 0.15; ยอดหัวบิลไม่ตรงโปรแกรมเดิมเมื่อโหมดส่วนลด/VAT ไม่ใช่ค่าเริ่ม | ใช้ `big.Rat`/decimal ปัดครึ่งออกจากศูนย์ เขียนเทสต์ "จุดครึ่ง" (2.345, 12.345) และอย่าใช้ `2` ตายตัวกับเงิน ([[faq-rounding-decimal]], `etax/handler.go:1016` `etaxAmounts`) |
| ภาษี | รายงานภาษีไม่นับรายการตั้งแต่ 24/10 เพราะปีเก็บผิดระบบ; ใบจ่าย/รับชำระและขายสินทรัพย์ไม่มีแถวทะเบียนภาษี; อัตรา VAT เป็น 0 | ทุกเอกสารที่ GL ลงภาษีต้องมีแถวภาษีคู่กัน ตรวจเลขใบกำกับซ้ำต้องล็อก ([[faq-vat-purchase-sale-report]]) |
| GL | ตัวสร้างบัญชีตามรูปแบบลงด้านเดียว, ลูกหนี้/เงินสดสลับ, รายได้อื่นและเงินทอนไม่ถูกลง | ทางสำรองของ rebuild ผ่าน `ValidateAndBalanceJournal` (`service.go:508`, เรียกที่ `:1614`) ไม่เก็บ Dr ≠ Cr; รหัสบัญชี resolve จากข้อมูลหลัก ไม่ hard-code ([[faq-gl-not-balanced]]) |
| สต็อก/ต้นทุน | รับคืนขายทำให้ต้นทุนเฉลี่ยเพี้ยน (281.25 เป็น 288.94 ตามบันทึก UAT); rebuild ไม่ตรงโปรแกรมเดิม | ต้นทุนเป็นค่าที่คำนวณซ้ำจากแถวดิบ ห้ามบวก-ลดตัวนับ ([[faq-moving-average-cost]]) |
| ครึ่งทาง/พร้อมกัน | ทิ้ง error ของคำสั่งเขียนแล้วตอบสำเร็จ; frontend เขียน SQL เข้าตารางนอก tx; deadlock 40P01 เมื่อบันทึกสินค้าเดียวกันพร้อมกัน; เลขเอกสารชนกันในวินาทีเดียว | งานเอกสารอยู่ใน `inTransTx` (`trans.go:446`), ล็อกเรียงลำดับ, เลขเอกสารต่อมิลลิวินาที+แท็กสุ่ม `docno.Stamp` (`docno.go:23`) ([[faq-save-atomic-partial]], [[faq-concurrent-save-deadlock]]) |
| สิทธิ์/ความปลอดภัย | ประเด็นด้านสิทธิ์ การล็อกอิน และหน้าเว็บที่เคยพบ ปิดแล้ว | การ์ดสิทธิ์ fail-closed route ไม่ลงทะเบียน = Admin (`process/permission.go:132`); ทุกประตูเขียนผ่านนโยบายเดียว ([[faq-menu-permission-denied]], [[faq-query-exec-write-blocked]], [[faq-session-logout-expired]]) |
| บันทึก master | แก้ตัวแทนแล้ว `roworder`/คอลัมน์นอกจอถูกรีเซ็ต (DELETE+INSERT); เลือกคอลัมน์ที่ไม่มีในตารางจริงแล้ว 500 | UPDATE เฉพาะคอลัมน์ที่จอรู้จัก; ชื่อฟิลด์ต้องตรงคอลัมน์จริงใน `information_schema` ก่อนเขียน SQL |
| หน้าจอ/วันที่ | ปี พ.ศ./ค.ศ. ปนกัน; ช่องตัวเลขเช็ก truthiness ของ `'0.00'`; แท็บซ่อนรับคีย์ลัด; ตารางเลื่อนซ้อนหลายชั้น | DB เก็บ ค.ศ. เท่านั้น แปลงที่จอผ่าน `year_type`; ใช้ `NumberBox`/`DateBox`; ดู [[faq-buddhist-year-date]] |

**วิธีทำงานที่ได้จากรอบ UAT:** จัดกลุ่มบั๊กตามรากเหตุ แก้พร้อมเทสต์ที่พังก่อนแก้ commit ละรากเหตุ แล้วรันชุดเต็มซ้ำ; ทดสอบกับฐานตัวอย่าง (demo) เท่านั้น ไม่แตะฐานลูกค้า

## ข้อควรระวัง
- **ยังเหลือในโค้ดจริง (ตรวจแล้ววันนี้):** `GlobalDocFormPrintModal.tsx:1625-1626` ยังใช้ `new Date().toISOString().slice(0, 10)` ซึ่งเป็นวันที่ UTC ช่วงเที่ยงคืนถึงเช้า (เวลาไทย) จะได้วันก่อนหน้า (ที่ `LineOaChatStudio.tsx:1010` ก็เช่นกัน) ส่วน `transDates.ts` ใช้ UTC สม่ำเสมอ จึงไม่ผิด
- `etaxAmounts` ปัดถูกต้องด้วย `big.Rat` แล้ว แต่ลายเซ็นยังรับ/คืน `float64` และแปลงกลับด้วย `Float64()` (`etax/handler.go:1016-1032`) ซึ่งยังไม่ตรงกฎ "ห้าม float กับเงิน" เต็มที่ ยอดที่ได้ปัดถูกแต่ชนิดข้อมูลยังไม่ใช่ decimal ตลอดทาง
- บันทึกบทเรียน GL เขียนว่าทุกเส้นทางผ่าน `ValidateAndBalanceJournal` แต่ค้นโค้ดพบผู้เรียกนอกเทสต์ที่เดียว (`service.go:1614`) เส้นทางอื่นที่เขียน `gl_journal` (`docs.go:294`, `doc_cancel.go:643`, `fa_depreciation.go:995`, `fa_sale.go:576`, `gl_template.go:1050`) ไม่ได้เรียกฟังก์ชันนี้ ตัวสร้างตามรูปแบบมีการรวม Dr/Cr และปรับส่วนต่างของตัวเอง ส่วนเส้นทางอื่นไม่ชัดจากโค้ดว่ามีด่านเทียบเท่าหรือไม่
- รายการ "เปิดค้าง/ยังไม่ verify" ที่บันทึกประวัติระบุไว้ อยู่ที่ [[faq-open-items-unfinished]] ห้ามสรุปว่าแก้แล้วจากบันทึกบทเรียนอย่างเดียว ต้องตรวจโค้ดปัจจุบัน
- บันทึกบทเรียนบางข้อสรุปจากข้อความ commit โดยยังไม่ได้ตรวจ diff ทุกบรรทัด (บันทึกต้นทางระบุไว้เอง) ถ้านำไปอ้างต้องไปดูโค้ดล่าสุดก่อน
- กฎเวลาแก้บั๊ก: grep ทุกจุดที่ใช้ pattern เดียวกัน (บั๊ก blank-zero พลาดสองรอบเพราะแก้จุดเดียว) และแก้ที่รากเหตุในฟังก์ชันที่ทุกทางเรียกผ่าน

## ดูเพิ่ม
- [[history-overview]]
- [[hist-lessons-trans-save-rules]]
- [[hist-lessons-atomic-transactions-swallowed-errors]]
- [[hist-lessons-uat-s1-bugs-2026-10-29]]
- [[faq-open-items-unfinished]]
- [[faq-parity-csharp-bccm]]

## ที่มาในโค้ด
- `backend/internal/adapter/inbound/http/process/permission.go:132` route ที่ไม่ลงทะเบียนเป็น Admin (fail-closed)
- `backend/internal/application/process/trans.go:446` `inTransTx` (ธุรกรรมเดียวต่อเอกสาร)
- `backend/internal/application/process/service.go:508` `ValidateAndBalanceJournal` (ตรวจ Dr = Cr)
- `backend/internal/platform/docno/docno.go:23` `Stamp` (เลขเอกสารกันชน)
- `backend/internal/adapter/inbound/http/etax/handler.go:1016` `etaxAmounts` (ปัด half-away-from-zero ด้วย `big.Rat`, ชนิด float64 ที่ขอบเขต)
- `frontend/shared/components/GlobalDocFormPrintModal.tsx:1625` วันที่ UTC ที่ยังเหลือ
