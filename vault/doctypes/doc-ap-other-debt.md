---
title: "ตั้งหนี้อื่นๆ เจ้าหนี้ (AP Other Payable)"
tags: [doctypes, ap]
aliases: ["trans_flag 87", "ตั้งหนี้อื่นๆ (เจ้าหนี้)", "COB"]
sources: ["frontend/account/tabs/transMenuMap.ts:1251", "frontend/account/transaction/transLayouts.ts:104", "frontend/account/transaction/transLayouts.ts:54", "backend/internal/application/process/trans_tax.go:37", "backend/internal/application/process/service.go:1775", "backend/internal/application/process/service.go:1965", "backend/internal/application/process/trans_deposit.go:48", "backend/internal/application/process/docs.go:597", "backend/internal/application/process/doc_cancel.go:54"]
---

# ตั้งหนี้อื่นๆ ฝั่งเจ้าหนี้ (trans_flag 87)

## ใช้เมื่อไร
ใช้ตั้งหนี้เจ้าหนี้ที่ไม่ใช่การซื้อสินค้า อ้างใบสั่งซื้อ 6 ได้ อยู่ที่เมนู "ตั้งหนี้อื่นๆ (เจ้าหนี้)" (COB, transMenuMap.ts:1251)

## trans_flag/ตาราง
- trans_flag 87 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, taxDoc, inquiry, vat แท็บ vat, gl ไม่มีแท็บชำระ (transLayouts.ts:104)
- มีแท็บใช้เงินมัดจำ (transLayouts.ts:54, `depositKinds` trans_deposit.go:48)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
- ภาษีซื้อ (trans_tax.go:37)
- ไม่มี WHT (ไม่อยู่ใน `transWhtParty`)

## การลงบัญชี
ใช้ standard GL (service.go:1965)
| Dr | Cr |
|---|---|
| ค่าใช้จ่าย ใช้บัญชีจาก item_code ของบรรทัดแรก ถ้าไม่มีใช้ซื้อ (ฐาน + advEx) (service.go:1775) | เจ้าหนี้ ยอดรวม หรือเงินที่จ่าย ถ้า inquiry เป็น 1/3 |
| ภาษีซื้อ | มัดจำ 153010 (advEx) |

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ใบสั่งซื้อ 6 (`flowRules` ของ 6 นับการวางบิลจาก 87 doc_flow.go:91)
- ปลายทาง: เพิ่มหนี้ 89 และลดหนี้ 91 อ้างใบนี้ รวมถึงรับวางบิล 213 และจ่ายชำระ 19
- นับเป็นหนี้เจ้าหนี้ทุกใบ (`apDebtWhere` docs.go:597)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 88 (doc_cancel.go:54)

## ข้อควรระวัง
- ไม่มีแท็บชำระ แต่ standard GL ยังใช้ payTenders เมื่อ inquiry เป็น 1/3 ถ้าไม่มีแถวใน cb_trans จะใช้เงินสดเป็นค่าเริ่มต้น ดู [[acc-payment-tab]]

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1251` เมนู
- `frontend/account/transaction/transLayouts.ts:104` FLAG_SPEC 87
- `backend/internal/application/process/service.go:1775` ใช้บัญชีค่าใช้จ่ายจากรายการ
- `backend/internal/application/process/service.go:1965` GL
- `backend/internal/application/process/docs.go:597` apDebtWhere
- `backend/internal/application/process/doc_cancel.go:54` ยกเลิก 88

## ดูเพิ่ม
- [[doc-ap-other-debit-credit-note]] · [[doc-other-expense]] · [[doc-ap-payment]] · [[doctypes-overview]]
