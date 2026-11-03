---
title: "ตั้งหนี้อื่นๆ ลูกหนี้ (AR Other Receivable)"
tags: [doctypes, ar]
aliases: ["trans_flag 99", "ตั้งหนี้อื่นๆ (ลูกหนี้)", "AOB"]
sources: ["frontend/account/tabs/transMenuMap.ts:1449", "frontend/account/tabs/transMenuMap.ts:1464", "frontend/account/transaction/transLayouts.ts:110", "frontend/account/transaction/transLayouts.ts:54", "frontend/account/transaction/transLayouts.ts:445", "backend/internal/application/process/trans_tax.go:40", "backend/internal/application/process/service.go:2135", "backend/internal/application/process/service.go:1844", "backend/internal/application/process/trans_deposit.go:42", "backend/internal/application/process/trans_deposit.go:54", "backend/internal/application/process/trans_save_rules.go:488", "backend/internal/application/process/docs.go:600", "backend/internal/application/process/doc_flow.go:117", "backend/internal/application/process/doc_cancel.go:54", "backend/internal/application/process/doc_cancel.go:585"]
---

# ตั้งหนี้อื่นๆ ฝั่งลูกหนี้ (trans_flag 99)

## ใช้เมื่อไร
ใช้ตั้งหนี้ลูกหนี้ที่ไม่ใช่การขายสินค้า อยู่ที่เมนู "ตั้งหนี้อื่นๆ (ลูกหนี้)" (AOB, transMenuMap.ts:1449) รายการค้นจากรหัสรายได้ `erp_income_list` (transMenuMap.ts:1454)

## trans_flag/ตาราง
- trans_flag 99 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, taxDoc, vat แท็บ vat, gl ไม่มีแท็บชำระ (transLayouts.ts:110)
- มีแท็บใช้เงินมัดจำ (`DEPOSIT_TAB_FLAGS` transLayouts.ts:54, `depositKinds` 99 = มัดจำรับ trans_deposit.go:54)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
- ภาษีขาย vat_calc 1 (`transVatTabs` trans_tax.go:40)
- ไม่มี WHT (ไม่อยู่ใน `transWhtParty` trans_tax.go:48)

## การลงบัญชี
ใช้ standard GL เมื่อรูปแบบเอกสารไม่มี template GL (`tpl.post` service.go:1585) ตาม case ใน service.go:2135

| Dr | Cr |
|---|---|
| ลูกหนี้ (1121) ยอดรวม ถ้า inquiry = 1 ใช้เงินสด (1111) | รายได้อื่น (4210) = ฐานภาษี + advEx |
| มัดจำรับ 214220 = advEx | ภาษีขาย (2134) |

- บัญชีรายได้หาจาก 4210/4200/4111/4110 ตามลำดับ (service.go:2136) ไม่ได้อ่านบัญชีจาก `erp_income_list` ของรายการ (การอ่าน erp_income_list มีเฉพาะ 250/252/254 service.go:1829)
- advEx = เงินมัดจำที่ใช้ (advance_amount) ถ้า vat_type = 1 ถอด VAT ออกก่อน ปัด 2 ตำแหน่ง (service.go:1844-1851)
- บัญชีมัดจำมาจาก `depositSale` = 214220 (trans_deposit.go:42)
- เลขบัญชีในวงเล็บคือตัวแรกของรายการสำรอง `resolveChartAccount` (service.go:1796, :1798, :1803)

## เอกสารต้นทาง-ปลายทาง
- เมนูกำหนดเอกสารอ้างอิงเป็นใบเสนอราคา 30 (`refTransFlags` transMenuMap.ts:1464) แต่ FLAG_SPEC 99 ไม่มี refDoc จึงไม่แสดงช่องเอกสารอ้างอิงบนหัวเอกสาร (transLayouts.ts:110, :445) และ flow ของใบเสนอราคา 30 ไม่นับการอ้างจาก 99 (doc_flow.go:99)
- ปลายทาง: เพิ่มหนี้ 101 และลดหนี้ 103 อ้างใบนี้ (used_status จาก doc_flow.go:117) รวมถึงใบวางบิล 235 และรับชำระ 239 (used_status_2 = `billed` doc_flow.go:69)
- นับเป็นหนี้ลูกหนี้ทุกใบ ไม่ขึ้นกับ inquiry (`arDebtWhere` docs.go:600)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 100 (doc_cancel.go:54) เอกสารยกเลิกได้ GL กลับด้านของต้นฉบับ ณ วันที่เอกสารยกเลิก ส่วนต้นฉบับยังเก็บ GL เดิม (`reverseCancelledGL` doc_cancel.go:585)
- บันทึกต้องอยู่ในงวดบัญชีที่เปิด (`checkOpenPeriod` trans_validate.go:45)

## ข้อควรระวัง
- ตรวจวงเงินลูกค้าทุกครั้งที่มีรหัสลูกค้า ไม่ขึ้นกับ inquiry (`creditChecked` trans_save_rules.go:488, `checkCreditLimit` :522)
- หน้าจอ 99 ไม่มีช่อง inquiry (transLayouts.ts:110) แต่ standard GL ยังตรวจ inquiry = 1 (service.go:2138)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1449` เมนู
- `frontend/account/transaction/transLayouts.ts:110` FLAG_SPEC 99
- `backend/internal/application/process/service.go:2135` GL
- `backend/internal/application/process/trans_save_rules.go:488` creditChecked
- `backend/internal/application/process/doc_cancel.go:54` ยกเลิก 100

## ดูเพิ่ม
- [[doc-ar-other-debit-credit-note]] · [[doc-other-income]] · [[doc-ar-receipt]] · [[doctypes-overview]]
