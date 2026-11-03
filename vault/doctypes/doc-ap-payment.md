---
title: "จ่ายชำระหนี้ เจ้าหนี้ (AP Payment)"
tags: [doctypes, ap]
aliases: ["trans_flag 19", "จ่ายชำระหนี้", "ใบจ่ายชำระ", "DE"]
sources: ["frontend/account/tabs/transMenuMap.ts:1374", "frontend/account/transaction/transLayouts.ts:85", "frontend/account/transaction/transLayouts.ts:161", "backend/internal/application/process/docs.go:119", "backend/internal/application/process/docs.go:342", "backend/internal/application/process/docs.go:373", "backend/internal/application/process/docs.go:390", "backend/internal/application/process/docs.go:532", "backend/internal/application/process/trans_tax.go:53", "backend/internal/application/process/trans_tax.go:169", "backend/internal/application/process/service.go:1583", "backend/internal/application/process/service.go:1871", "backend/internal/application/process/service.go:2170", "backend/internal/application/process/pay_check.go:241", "backend/internal/application/process/period.go:109", "backend/internal/application/process/doc_cancel.go:60", "backend/internal/application/process/doc_cancel.go:585"]
---

# จ่ายชำระหนี้ ฝั่งเจ้าหนี้ (trans_flag 19)

## ใช้เมื่อไร
ใช้จ่ายเงินตัดหนี้เจ้าหนี้ อยู่ที่เมนู "จ่ายชำระหนี้ (เจ้าหนี้)" (DE, transMenuMap.ts:1374)

## trans_flag/ตาราง
- หัวเอกสารอยู่ใน [[tbl-ap-ar-trans]] และรายการบิลอยู่ใน [[tbl-ap-ar-trans-detail]] บันทึกผ่าน `SaveDoc` (docs.go:119, `billStmts` :532)
- ยอดรวม (total_net_value) = ผลรวมยอดชำระ sum_pay_money ของรายการบิล ภาษีหัวเอกสารเป็น 0 (docs.go:342)
- แท็บชำระเขียนลง [[tbl-cb-trans]] / [[tbl-cb-trans-detail]] (`payStmts` docs.go:373)

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party แท็บ pay, wht, vat, gl (transLayouts.ts:85)
- grid แบบตารางเอกสารหนี้ (`BILLS_FLAGS` transLayouts.ts:161)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
- แท็บ VAT ซื้อและ WHT (ฝั่ง ap) ให้ผู้ใช้คีย์เองทั้งหมด (`apArTaxTabs` 19 = buy trans_tax.go:53, `apArTaxStmts` :169) ดู [[acc-vat-register-wht]]

## การลงบัญชี
`SaveDoc` สั่งลง GL ของ 19 ทุกครั้ง (`plan.glFlag` docs.go:390) ถ้ารูปแบบเอกสารมี template GL จะใช้ template โดยอ่านข้อมูลฝั่ง cb (service.go:1583) ถ้าไม่มีใช้ standard GL (service.go:2170)

| Dr | Cr |
|---|---|
| เจ้าหนี้ (2111) = ยอดรวม + lost_profit_exchange_amount | เงินที่จ่ายตามแท็บชำระ (`payTenders` service.go:1871) |
| ขาดทุนอัตราแลกเปลี่ยน 511030 เมื่อ lost_profit_exchange_amount ติดลบ | กำไรอัตราแลกเปลี่ยน 420040 เมื่อ lost_profit_exchange_amount เป็นบวก |

- payTenders ฝั่งจ่าย: เงินสด 1111, โอน/wallet = บัญชีสมุดธนาคาร (1112 หรือ account_code_1 ของ erp_pass_book), เช็คจ่าย 2112, บัตร = บัญชีธนาคาร, WHT 2122 (service.go:1871-1929) ถ้าผลรวมไม่เท่ายอดที่จ่ายจะลงเงินสดบรรทัดเดียว
- ค่าใช้จ่ายอื่น/รายได้อื่นในแท็บชำระลงเพิ่ม (Dr บัญชีค่าใช้จ่าย / Cr บัญชีรายได้) และยอดเงินที่จ่ายปรับตามยอดสุทธิ (`payOtherGL` gl_pay_other.go:17, `money` service.go:1861)

ผลต่างอัตราแลกเปลี่ยนดูที่ [[acc-fx-multi-currency]]

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: เอกสารหนี้เจ้าหนี้ (`apDebtWhere`/`apCreditWhere` docs.go:604, :607) และใบรับวางบิล 213 (อ้างในช่อง doc_ref ของรายการ บังคับเมื่อเปิด ap_pay_from_bill_note pay_check.go:241)
- ยอดชำระลดยอดคงเหลือของบิล (`billPaidSQL` docs.go:621) เกินยอดคงเหลือไม่ได้ ยกเว้นเปิด pay_bill_over (pay_check.go:232)
- เช็คจ่ายจากแท็บชำระไปต่อที่ [[doc-cheque-paid-lifecycle]]

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 23 (doc_cancel.go:60) เอกสารยกเลิกได้ GL กลับด้านของต้นฉบับ ณ วันที่เอกสารยกเลิก ส่วนต้นฉบับยังเก็บ GL เดิม (`reverseCancelledGL` doc_cancel.go:585)
- แก้ไข/ลบไม่ได้เมื่อถูกใช้แล้ว เสร็จแล้ว หรือถูกยกเลิก (`apArEditLocked` docs.go:457)
- บันทึก/ลบต้องอยู่ในงวดบัญชีที่เปิด (`checkSaveDocPeriod` period.go:109, `checkDeleteDocPeriod` :116)

## ข้อควรระวัง
- VAT/WHT ไม่ถูกคำนวณจากบิลให้อัตโนมัติ ผู้ใช้ต้องคีย์เอง

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1374` เมนู
- `frontend/account/transaction/transLayouts.ts:85` FLAG_SPEC 19
- `backend/internal/application/process/docs.go:119` SaveDoc / `:390` glFlag
- `backend/internal/application/process/trans_tax.go:53` apArTaxTabs
- `backend/internal/application/process/service.go:2170` GL 19/239
- `backend/internal/application/process/doc_cancel.go:60` ยกเลิก 23

## ดูเพิ่ม
- [[doc-ap-billing-receive]] · [[doc-ar-receipt]] · [[acc-payment-tab]] · [[doctypes-overview]]
