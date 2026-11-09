---
title: "ระบบบัญชีแยกประเภท (GL) ทำอะไรได้บ้าง รวมทุกเรื่อง"
tags: [howto, gl]
aliases: ["ระบบบัญชีทำอะไรได้บ้าง", "เมนูบัญชี", "เริ่มใช้ระบบบัญชี", "บัญชีแยกประเภท", "ลงบัญชี ปิดงวด งบทดลอง", "คู่มือระบบบัญชี", "GL"]
sources: ["frontend/src/config/editionConfig.ts:17", "backend/internal/application/process/docs.go:251", "backend/internal/application/process/workflow.go:817", "backend/internal/application/process/bcMenu.json:9348", "backend/internal/application/process/report_menu_gl_fa.go:342"]
---
# ระบบบัญชีแยกประเภท (GL) ทำอะไรได้บ้าง รวมทุกเรื่อง

**ใช้เมื่อ:** ลูกค้าถามเรื่องผังบัญชี การลงบัญชี ใบสำคัญ ปิดงวด ปิดปี หรือดูงบทดลองบนหน้าจอ (บัญชีแยกประเภท = บัญชีที่บันทึกเดบิต-เครดิตทุกรายการ ใช้ทำงบการเงิน)
**เมนู:** บัญชี (และ เริ่มต้น › ตั้งค่าระบบบัญชีและภาษี)
**ต้องมีก่อน:** รุ่นที่มีระบบบัญชี ([[faq-gl-starter-no-gl]])

## ลำดับการใช้งาน
1. ตั้งงวดบัญชี → [[howto-gl-account-period]]
2. ตั้งสมุดบัญชี กลุ่มบัญชี → [[howto-gl-setup-book-group]]
3. ตั้งผังบัญชี → [[howto-gl-chart-of-accounts]] · แก้หลายบัญชีพร้อมกัน [[howto-gl-chart-fast-edit]] · เปลี่ยนรหัส [[howto-gl-change-account-code]] · แยกมิติ [[howto-gl-dimensions]]
4. บันทึกยอดยกมาและรายการปรับปรุงด้วย ข้อมูลรายวัน → [[howto-gl-journal-entry]] · รายการประจำและกลับรายการ [[howto-gl-journal-template-reverse]] · แนบไฟล์ [[howto-gl-attach-file]]
5. เอกสารซื้อขายลงบัญชีเอง → [[howto-gl-auto-posting]] · ผูกบัญชีตามรูปแบบเอกสาร [[howto-gl-doc-format-posting]] · ลงบัญชีย้อนหลังใหม่ [[howto-gl-process-from-documents]]
6. ตรวจและผ่านรายการ → [[howto-gl-check-data]] · [[howto-gl-pass-journal]]
7. ดูผลบนหน้าจอ → [[howto-gl-inquiry-ledger]] · [[howto-gl-inquiry-trial-balance]]
8. ปิดบัญชี → [[howto-gl-end-of-period]] · [[howto-gl-end-of-year]] · [[howto-gl-summary-cogs-close]]

## ปัญหาที่พบบ่อย
| ปัญหาที่ลูกค้าเจอ | ดูโน้ต |
|---|---|
| เดบิตไม่เท่าเครดิต | [[ts-gl-debit-credit-not-equal]] |
| บันทึกใบสำคัญไม่ได้ | [[ts-gl-journal-save-errors]] |
| ไม่พบผังบัญชี | [[ts-gl-account-not-found]] |
| รหัสบัญชีผิดประเภท (ใช้บัญชีหลัก) | [[ts-gl-control-account-used]] |
| เอกสารไม่ลงบัญชี | [[ts-gl-document-no-journal]] |
| ผ่านรายการไม่ได้ | [[ts-gl-pass-errors]] |
| ปิดงวด/ปิดปีไม่ผ่าน | [[ts-gl-close-errors]] |
| บันทึกผังบัญชีไม่ได้ | [[ts-gl-chart-save-errors]] |
| ลบรหัสบัญชีไม่ได้ | [[ts-gl-delete-account-in-use]] |
| ขึ้นว่าปิดงวดแล้ว | [[ts-common-period-closed]] |

## คำถามที่พบบ่อย
- ปิดงวดแล้วทำไมยังแก้ได้ → [[faq-gl-close-vs-lock-period]]
- ขึ้นปีใหม่ต้องยกยอดไหม → [[faq-gl-carry-forward]]
- ต้องผ่านรายการก่อนไหม → [[faq-gl-pass-journal-needed]]
- แก้ใบสำคัญที่ระบบสร้างจากเอกสาร → [[faq-gl-edit-auto-journal]]
- ใครปิดงวดได้ → [[faq-gl-who-can-close]]
- ไม่เห็นเมนูบัญชี → [[faq-gl-starter-no-gl]]

## แก้ไข ยกเลิก พิมพ์
- แก้/ยกเลิก/ลบเอกสารทั่วไป → [[howto-doc-edit-cancel-delete]]
- พิมพ์และส่งออกรายงาน → [[rpt-print-export]] · รายงานทั้งหมด [[rpt-overview]]

## หมายเหตุ
- ไม่มีสิทธิ์เปิดเมนู → [[ts-common-no-permission]]
- ภาษีซื้อ ภาษีขาย หัก ณ ที่จ่าย → [[howto-tax-overview]]

## ดูต่อ
- [[sys-account-overview]]
- [[howto-tax-overview]]
- [[term-overview]]
- [[index]]
