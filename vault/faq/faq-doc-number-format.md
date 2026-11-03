---
title: "เลขที่เอกสารรันอย่างไร ตั้งรูปแบบเลขที่ที่ไหน"
tags: [faq, doc-no, doc-format, numbering, setup]
aliases: ["เลขที่เอกสารรันยังไง", "ตั้งรูปแบบเลขที่เอกสาร", "erp_doc_format", "@YYMM####", "รีเซ็ตเลขที่ทุกเดือน", "เลขที่เอกสารซ้ำ", "menu_setup_doc_format", "1012", "เลขที่เอกสารยาวเกิน 25"]
sources: ["backend/internal/application/process/doc_cancel.go:391", "backend/internal/application/process/stock_tools.go:701", "backend/internal/application/process/stock_tools.go:725", "backend/internal/application/process/doc_no_next.go:59", "frontend/src/lib/doc-no.ts:17", "frontend/account/master/DocFormatScreen.tsx:585", "backend/internal/application/process/trans.go:1262"]
---
# เลขที่เอกสารรันอย่างไร ตั้งรูปแบบเลขที่ที่ไหน

**ตอบสั้น:** ตั้งที่เมนู "กำหนดรูปแบบเลขที่เอกสาร" (`menu_setup_doc_format`, รหัส 1012 หรือ 1.1.12) ซึ่งเก็บใน `erp_doc_format.format` เช่น `@YYMM####` หน้าจอเอกสารขอเลขถัดไปจากหลังบ้าน โดยหาเลขล่าสุดที่ขึ้นต้นเหมือนกันใน flag เดียวกันแล้วบวก 1 ยาวเกิน 25 ตัวอักษรไม่ได้

## รายละเอียด
- **หา format ที่ใช้:** หน้าจอส่ง `formatCode` และ `screenCode` (เช่น ขายสินค้า มี `docFormatCode: "SIC"`) ไปที่ `/process/stocktools/docnonext` (`doc-no.ts:17-30`) หลังบ้านค้น `erp_doc_format` ที่ `code` ตรง ถ้าไม่เจอจึงค้นด้วย `screen_code` (`doc_cancel.go:391-408`)
- **สัญลักษณ์:** `@` = รหัสรูปแบบ (`code`), `YYYY`/`YY` = ปี ค.ศ. 4/2 หลัก, `MM` เดือน, `DD` วัน, `ปปปป`/`ปป` = ปี พ.ศ., `ดด`/`วว` = เดือน/วัน (ภาษาไทย), `#` ติดกันกี่ตัวคือจำนวนหลักเลขรัน (`stock_tools.go:701-722`)
- **วิธีรัน:** ตัดส่วน `#` ออกเป็น prefix/suffix, ล็อกด้วย advisory lock ต่อ prefix, หา `doc_no` ที่มากที่สุดซึ่งขึ้นต้นด้วย prefix และ `trans_flag` เดียวกัน แล้วเลขถัดไป = เลขนั้น + 1 เติมศูนย์ (`doc_cancel.go:433-452`, `autoRunNext` `stock_tools.go:725`) ถ้าเลขเต็มความกว้างจะวนกลับเป็น 1
- **รีเซ็ตเลข:** เพราะ prefix รวมวันที่ ถ้า format มี `MM` เลขจึงเริ่ม 1 ใหม่ทุกเดือน มี `YY` อย่างเดียวก็เริ่มใหม่ทุกปี ไม่มีสัญลักษณ์วันที่เลขก็ไม่รีเซ็ต
- **ไม่มี format:** ถ้าไม่พบแถวหรือ `format` ว่าง หลังบ้านใช้ `@YYMM-####` และรหัส `DOC<flag>` (`doc_cancel.go:410-412`)
- **ตั้งค่าบนจอ:** ฟอร์มมีช่อง รหัส, รหัสหน้าจอ (`screen_code`), ชื่อ, `format`, `tax_format`, `doc_running`, รหัสแบบฟอร์มพิมพ์ (`form_code`), สมุดบัญชี GL ฯลฯ บันทึกลง `erp_doc_format` (`DocFormatScreen.tsx:585-600`) ค่าเริ่มต้นช่อง format ในจอคือ `@YYMM####`

## ข้อควรระวัง
- ค่าเริ่มต้นไม่ตรงกัน: จอกรอกให้ `@YYMM####` (`DocFormatScreen.tsx:218`) แต่หลังบ้านถอยไปใช้ `@YYMM-####` มีขีด (`doc_cancel.go:411`)
- ตัวอย่างผลลัพธ์และ Help บนจอรู้จักแค่ `YYYY YY MM DD @ #` ไม่แสดง `ปป/ดด/วว` ที่หลังบ้านรองรับ (`DocFormatScreen.tsx:159-182`) และ Help เขียน "@YY = ปี ค.ศ. หรือ พ.ศ." ทั้งที่หลังบ้าน `YY` เป็น ค.ศ. เสมอ พ.ศ. ต้องใช้ `ปป`
- เลขที่ยาวเกิน 25 ตัวอักษรถูกปฏิเสธ ("ยาวเกิน 25 ตัวอักษร กรุณาแก้รูปแบบ", `doc_cancel.go:453`) เลขซ้ำตอนบันทึกขึ้น "เลขที่เอกสารซ้ำ" (`trans.go:1262`)
- ไม่พบโค้ดฝั่งหลังบ้านที่อ่าน `doc_running` และ `tax_format` ของ `erp_doc_format` ไม่ชัดจากโค้ดว่ามีผลต่อการรัน

## ดูเพิ่ม
- [[proc-doc-flow-numbering]]
- [[term-doc-no-doc-date]]
- [[faq-gl-template-doc-format]]
- [[faq-print-document-form]]
- [[faq-new-company-setup]]

## ที่มาในโค้ด
- `backend/internal/application/process/doc_cancel.go:391` `nextDocNo` (ค้น format, ล็อก, หาเลขล่าสุด, จำกัด 25)
- `backend/internal/application/process/stock_tools.go:701` `autoRunPattern` และ `:725` `autoRunNext`
- `backend/internal/application/process/doc_no_next.go:59` `NextDocNo` (route `/process/stocktools/docnonext`)
- `frontend/src/lib/doc-no.ts:17` `generateDocNo`
- `frontend/account/master/DocFormatScreen.tsx:159` ตัวอย่างผลลัพธ์ และ `:585` INSERT `erp_doc_format`
- `backend/internal/application/process/trans.go:1262` "เลขที่เอกสารซ้ำ"
- `frontend/src/config/bcMenu.json` เมนู `menu_setup_doc_format` (รหัสเมนู 1012)
