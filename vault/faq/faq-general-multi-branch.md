---
title: "มีหลายสาขา ใช้ระบบเดียวกันได้ไหม แยกเอกสารและสต็อกตามสาขาได้ไหม"
tags: [faq, general, branch]
aliases: ["หลายสาขา", "แยกสาขา", "ดูยอดขายแต่ละสาขา", "เลขที่เอกสารแยกสาขา", "สาขาใช้ฐานข้อมูลเดียวกันได้ไหม", "เพิ่มสาขาใหม่", "ไม่เห็นช่องสาขา"]
sources: ["frontend/src/config/schemas/icMasterSchemas.ts:458", "frontend/account/master/StandardMasterScreen.tsx:531", "frontend/src/config/editionConfig.ts:60", "frontend/account/form/SchemaForm.tsx:51", "frontend/account/transaction/TransTopForm.tsx:689"]
---
# มีหลายสาขา ใช้ระบบเดียวกันได้ไหม?

**ตอบสั้น:** ได้ ใช้ฐานข้อมูลเดียวของบริษัท แล้วตั้งค่าสาขาที่เมนู เริ่มต้น › ตั้งค่าองค์กร พนักงาน และเอกสาร › กำหนดรายละเอียดสาขา จากนั้นเลือกสาขาในเอกสาร ผูกพนักงานกับสาขา และตั้งรูปแบบเลขที่เอกสารแยกตามสาขาได้

## รายละเอียด
- **ตั้งสาขา:** กรอกรหัสและชื่อสาขา ดู [[howto-setup-branch]]
- **เอกสารแยกสาขา:** สาขาที่ตั้งไว้เลือกได้ในหัวเอกสาร และใช้ในรูปแบบเลขที่เอกสารได้ ดู [[howto-setup-doc-format]]
- **พนักงานประจำสาขา:** ผูกพนักงานกับสาขาในหน้าพนักงาน ดู [[howto-setup-staff]]
- **สต็อกแต่ละสาขา:** แยกเป็นคลังและที่เก็บ แล้วจำกัดได้ว่ากลุ่มพนักงานใดใช้คลังไหน ดู [[howto-setup-warehouse-rights]] และ [[howto-stock-overview]]
- **แผนก:** ถ้าต้องการแยกตามฝ่ายหรือแผนกด้วย ดู [[howto-setup-department]]
- **ไม่เห็นเมนูหรือช่องสาขาและแผนก:** รุ่น Starter ซ่อนเมนูกำหนดสาขาและแผนก และช่องสาขาและแผนกในเอกสาร ให้สลับเป็นรุ่น Account หรือ Pro ดู [[faq-general-editions]]
- **แยกนิติบุคคลกัน:** ถ้าแต่ละสาขาเป็นคนละบริษัท ให้สร้างฐานข้อมูลแยก ดู [[faq-general-multi-company]]

## ดูต่อ
- [[howto-setup-branch]]
- [[howto-setup-doc-format]]
- [[howto-setup-warehouse-rights]]
- [[faq-general-multi-company]]
- [[faq-general-editions]]
