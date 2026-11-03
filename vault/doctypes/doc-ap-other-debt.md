---
title: "ตั้งหนี้อื่นๆ เจ้าหนี้ (AP Other Payable)"
tags: [doctypes, ap]
aliases: ["trans_flag 87", "ตั้งหนี้อื่นๆ (เจ้าหนี้)", "COB"]
sources: ["frontend/account/tabs/transMenuMap.ts:1251", "frontend/account/transaction/transLayouts.ts:104", "frontend/account/transaction/transLayouts.ts:54", "backend/internal/application/process/trans_tax.go:38", "backend/internal/application/process/service.go:1822", "backend/internal/application/process/service.go:1844", "backend/internal/application/process/service.go:1976", "backend/internal/application/process/trans_deposit.go:53", "backend/internal/application/process/trans_deposit.go:40", "backend/internal/application/process/docs.go:605", "backend/internal/application/process/doc_flow.go:96", "backend/internal/application/process/doc_flow.go:116", "backend/internal/application/process/doc_cancel.go:54"]
---

# ตั้งหนี้อื่นๆ ฝั่งเจ้าหนี้ (trans_flag 87)

## ใช้เมื่อไร
ใช้ตั้งหนี้เจ้าหนี้ที่ไม่ใช่การซื้อสินค้า อยู่ที่เมนู "ตั้งหนี้อื่นๆ (เจ้าหนี้)" (COB, transMenuMap.ts:1251) รายการค้นจากรหัสค่าใช้จ่าย `erp_expenses_list` (transMenuMap.ts:1256)

## trans_flag/ตาราง
- trans_flag 87 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, taxDoc, inquiry, vat แท็บ vat, gl ไม่มีแท็บชำระ (transLayouts.ts:104)
- มีแท็บใช้เงินมัดจำ (`DEPOSIT_TAB_FLAGS` transLayouts.ts:54, `depositKinds` 87 = มัดจำจ่าย trans_deposit.go:53)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
- ภาษีซื้อ vat_calc 1 (`transVatTabs` trans_tax.go:38)
- ไม่มี WHT (ไม่อยู่ใน `transWhtParty` trans_tax.go:48)

## การลงบัญชี
ใช้ standard GL เมื่อรูปแบบเอกสารไม่มี template GL (`tpl.post` service.go:1585) ตาม case ใน service.go:1976

| Dr | Cr |
|---|---|
| ค่าใช้จ่าย = ฐานภาษี + advEx | เจ้าหนี้ (2111) ยอดรวม หรือเงินที่จ่ายตามแท็บชำระ ถ้า inquiry เป็น 1/3 (service.go:1988) |
| ภาษีซื้อ (1154) | มัดจำจ่าย 153010 = advEx |

- บัญชีค่าใช้จ่าย = gl_account_code ของ `erp_expenses_list` ตาม item_code บรรทัดแรก (service.go:1822) ถ้าไม่มีใช้บัญชีซื้อ 5111/5110/1151 (service.go:1800)
- advEx = เงินมัดจำที่ใช้ (advance_amount) ถ้า vat_type = 1 ถอด VAT ออกก่อน ปัด 2 ตำแหน่ง (service.go:1844-1851)
- บัญชีมัดจำมาจาก `depositPurchase` = 153010 (trans_deposit.go:40)

## เอกสารต้นทาง-ปลายทาง
- เมนูกำหนดเอกสารอ้างอิงเป็นใบสั่งซื้อ 6 (`refTransFlags` transMenuMap.ts:1266) แต่ FLAG_SPEC 87 ไม่มี refDoc จึงไม่แสดงช่องเอกสารอ้างอิงบนหัวเอกสาร (transLayouts.ts:104, :445)
- กฎ flow ของใบสั่งซื้อ 6 นับแถว ap_ar_trans_detail trans_flag 87/260 ที่ billing_no = ใบสั่งซื้อ (doc_flow.go:96)
- ปลายทาง: เพิ่มหนี้ 89 และลดหนี้ 91 อ้างใบนี้ (used_status จาก doc_flow.go:116) รวมถึงรับวางบิล 213 และจ่ายชำระ 19 (used_status_2 = `billed` doc_flow.go:69)
- นับเป็นหนี้เจ้าหนี้ทุกใบ ไม่ขึ้นกับ inquiry (`apDebtWhere` docs.go:605)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 88 (doc_cancel.go:54) เอกสารยกเลิกได้ GL กลับด้านของต้นฉบับ ณ วันที่เอกสารยกเลิก ส่วนต้นฉบับยังเก็บ GL เดิม (`reverseCancelledGL` doc_cancel.go:585)
- บันทึกต้องอยู่ในงวดบัญชีที่เปิด (`checkOpenPeriod` trans_validate.go:45)

## ข้อควรระวัง
- ไม่มีแท็บชำระ แต่ standard GL ยังใช้ payTenders เมื่อ inquiry เป็น 1/3 ถ้าไม่มีแถวใน cb_trans จะลงเครดิตเงินสด (1111) ทั้งยอด (service.go:1881) ดู [[acc-payment-tab]]

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1251` เมนู
- `frontend/account/transaction/transLayouts.ts:104` FLAG_SPEC 87
- `backend/internal/application/process/service.go:1822` ใช้บัญชีค่าใช้จ่ายจากรายการ
- `backend/internal/application/process/service.go:1976` GL
- `backend/internal/application/process/docs.go:605` apDebtWhere
- `backend/internal/application/process/doc_cancel.go:54` ยกเลิก 88

## ดูเพิ่ม
- [[doc-ap-other-debit-credit-note]] · [[doc-other-expense]] · [[doc-ap-payment]] · [[doctypes-overview]]
