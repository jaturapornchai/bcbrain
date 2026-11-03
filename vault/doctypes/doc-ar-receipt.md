---
title: "รับชำระหนี้/ออกใบเสร็จรับเงิน (AR Receipt)"
tags: [doctypes, ar]
aliases: ["trans_flag 239", "รับชำระหนี้", "ใบเสร็จรับเงิน", "EE"]
sources: ["frontend/account/tabs/transMenuMap.ts:1573", "frontend/account/transaction/transLayouts.ts:119", "frontend/account/transaction/transLayouts.ts:161", "backend/internal/application/process/docs.go:119", "backend/internal/application/process/docs.go:342", "backend/internal/application/process/docs.go:373", "backend/internal/application/process/docs.go:390", "backend/internal/application/process/trans_tax.go:53", "backend/internal/application/process/trans_tax.go:169", "backend/internal/application/process/service.go:1583", "backend/internal/application/process/service.go:1871", "backend/internal/application/process/service.go:2170", "backend/internal/application/process/pay_check.go:243", "backend/internal/application/process/period.go:109", "backend/internal/application/process/doc_cancel.go:60", "backend/internal/application/process/doc_cancel.go:585"]
---

# รับชำระหนี้/ออกใบเสร็จรับเงิน (trans_flag 239)

## ใช้เมื่อไร
ใช้รับเงินจากลูกค้าเพื่อตัดหนี้และออกใบเสร็จ อยู่ที่เมนู "รับชำระหนี้/ออกใบเสร็จรับเงิน" (EE, transMenuMap.ts:1573 เมนูใส่ transFlags 239/240)

## trans_flag/ตาราง
- หัวเอกสารอยู่ใน [[tbl-ap-ar-trans]] และรายการบิลอยู่ใน [[tbl-ap-ar-trans-detail]] บันทึกผ่าน `SaveDoc` (docs.go:119, `billStmts` :532)
- ยอดรวม (total_net_value) = ผลรวมยอดชำระ sum_pay_money ของรายการบิล ภาษีหัวเอกสารเป็น 0 (docs.go:342)
- แท็บชำระเขียนลง [[tbl-cb-trans]] / [[tbl-cb-trans-detail]] (`payStmts` docs.go:373)

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party แท็บ pay, wht, vat, gl (transLayouts.ts:119)
- grid แบบตารางเอกสารหนี้ (`BILLS_FLAGS` transLayouts.ts:161)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
- แท็บ VAT ขายและ WHT (ฝั่ง ar) ให้ผู้ใช้คีย์เองทั้งหมด (`apArTaxTabs` 239 = sale trans_tax.go:53, `apArTaxStmts` :169) ดู [[acc-vat-register-wht]]

## การลงบัญชี
`SaveDoc` สั่งลง GL ของ 239 ทุกครั้ง (`plan.glFlag` docs.go:390) ถ้ารูปแบบเอกสารมี template GL จะใช้ template โดยอ่านข้อมูลฝั่ง cb (service.go:1583) ถ้าไม่มีใช้ standard GL (service.go:2170)

| Dr | Cr |
|---|---|
| เงินที่รับตามแท็บชำระ (`payTenders` service.go:1871) | ลูกหนี้ (1121) = ยอดรวม + lost_profit_exchange_amount |
| ขาดทุนอัตราแลกเปลี่ยน 511030 เมื่อ lost_profit_exchange_amount เป็นบวก | กำไรอัตราแลกเปลี่ยน 420040 เมื่อ lost_profit_exchange_amount ติดลบ |

- payTenders ฝั่งรับ: เงินสด 1111, โอน/wallet = บัญชีสมุดธนาคาร (1112 หรือ account_code_1 ของ erp_pass_book), เช็ครับ 1122, บัตร = บัญชีลูกหนี้ (1121), WHT ถูกหัก 1153 (service.go:1871-1929) ถ้าผลรวมไม่เท่ายอดที่รับจะลงเงินสดบรรทัดเดียว
- ค่าใช้จ่ายอื่น/รายได้อื่นในแท็บชำระลงเพิ่ม (Dr บัญชีค่าใช้จ่าย / Cr บัญชีรายได้) และยอดเงินที่รับ = ยอดรวม + (รายได้อื่น − ค่าใช้จ่ายอื่น) (`payOtherGL` gl_pay_other.go:17, `money` service.go:1861)

ผลต่างอัตราแลกเปลี่ยนดูที่ [[acc-fx-multi-currency]]

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: เอกสารหนี้ลูกหนี้ (`arDebtWhere`/`arCreditWhere` docs.go:600, :602) และใบวางบิล 235 (อ้างในช่อง doc_ref ของรายการ บังคับเมื่อเปิด ar_pay_from_bill_note pay_check.go:243)
- ยอดชำระลดยอดคงเหลือของบิล (`billPaidSQL` docs.go:621) เกินยอดคงเหลือไม่ได้ ยกเว้นเปิด pay_bill_over (pay_check.go:232)
- เช็ครับจากแท็บชำระไปต่อที่ [[doc-cheque-received-lifecycle]] และบัตรเครดิตที่ [[doc-credit-card]]

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 240 (doc_cancel.go:60) เอกสารยกเลิกได้ GL กลับด้านของต้นฉบับ ณ วันที่เอกสารยกเลิก ส่วนต้นฉบับยังเก็บ GL เดิม (`reverseCancelledGL` doc_cancel.go:585)
- แก้ไข/ลบไม่ได้เมื่อถูกใช้แล้ว เสร็จแล้ว หรือถูกยกเลิก (`apArEditLocked` docs.go:457)
- บันทึก/ลบต้องอยู่ในงวดบัญชีที่เปิด (`checkSaveDocPeriod` period.go:109, `checkDeleteDocPeriod` :116)

## ข้อควรระวัง
- VAT/WHT ไม่ถูกคำนวณจากบิลให้อัตโนมัติ ผู้ใช้ต้องคีย์เอง

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1573` เมนู
- `frontend/account/transaction/transLayouts.ts:119` FLAG_SPEC 239
- `backend/internal/application/process/docs.go:119` SaveDoc / `:390` glFlag
- `backend/internal/application/process/trans_tax.go:53` apArTaxTabs
- `backend/internal/application/process/service.go:2170` GL 19/239
- `backend/internal/application/process/doc_cancel.go:60` ยกเลิก 240

## ดูเพิ่ม
- [[doc-ar-billing]] · [[doc-ap-payment]] · [[acc-payment-tab]] · [[acc-fx-multi-currency]] · [[doctypes-overview]]
