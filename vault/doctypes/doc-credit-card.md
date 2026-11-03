---
title: "บัตรเครดิต: ขึ้นเงิน/ยกเลิก (Credit Card Pass/Cancel)"
tags: [doctypes, cash-bank]
aliases: ["trans_flag 461", "trans_flag 462", "บันทึกขึ้นเงินบัตรเครดิต", "บันทึกยกเลิกบัตรเครดิต", "CRD", "CRN", "menu_cb_credit_card_pass", "menu_cb_credit_card_cancel"]
sources: ["frontend/account/tabs/transMenuMap.ts:2338", "frontend/account/tabs/transMenuMap.ts:2353", "frontend/account/transaction/transLayouts.ts:148", "frontend/account/transaction/transLayouts.ts:149", "backend/internal/application/process/service.go:2329", "backend/internal/application/process/trans_tax.go:37", "backend/internal/application/process/cheque.go:16", "backend/internal/application/process/cheque.go:220", "backend/internal/application/process/trans.go:1543"]
---

# บัตรเครดิต: ขึ้นเงิน (461) / ยกเลิก (462)

## ใช้เมื่อไร
- 461 "บันทึกขึ้นเงินบัตรเครดิต" ใช้นำยอดรับบัตรเครดิตเข้าธนาคาร (CRD, transMenuMap.ts:2338)
- 462 "บันทึกยกเลิกบัตรเครดิต" (CRN, transMenuMap.ts:2353)

## trans_flag/ตาราง
- เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]] โดยเลขบัตรหรือเลขรายการอยู่ที่ chq_number
- รายการบัตรเกิดจากแท็บชำระ doc_type 3 ซึ่งสร้างแถว [[tbl-cb-chq-list]] chq_type 3 (`chqListFromPaySQL` trans.go:1543)

## ฟิลด์/แท็บบนหน้าจอ
- 461: passBook แท็บ gl (transLayouts.ts:148)
- 462: ไม่มีช่องพิเศษ แท็บ gl (transLayouts.ts:149)
- เลือกได้เฉพาะรายการที่สถานะ 0 (`chequeCandidateWhere` cheque.go:220)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
- 461 มีภาษีซื้อ vat_calc +1 (trans_tax.go:37)
- 462 ไม่มี

## การลงบัญชี
ใช้ standard GL (service.go:2329)
| flag | Dr | Cr |
|---|---|---|
| 461 (มี vat > 0 และ base > 0) | ธนาคาร = base และภาษีซื้อ = vat | ลูกหนี้ = ยอดรวม |
| 461 (กรณีอื่น) | ธนาคาร ยอดรวม | ลูกหนี้ ยอดรวม |
| 462 | ลูกหนี้ | ธนาคาร |

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: แท็บชำระของใบขายหรือใบรับเงินที่รับเป็นบัตร
- สถานะ chq_type 3 (cheque.go:16): 461→1, 462→2

## ยกเลิก/แก้ไข
- ไม่มีคู่ยกเลิกใน `cancelOrigFlags` (doc_cancel.go:49)

## ข้อควรระวัง
- case นี้ไม่มีบรรทัดค่าธรรมเนียมบัตรแยก (ไม่พบในโค้ด) ในกรณีที่มี VAT ฝั่ง Dr คือ base + vat และฝั่ง Cr คือยอดรวม

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:2338` / `:2353` เมนู
- `frontend/account/transaction/transLayouts.ts:148` / `:149` FLAG_SPEC
- `backend/internal/application/process/service.go:2329` GL
- `backend/internal/application/process/cheque.go:16` สถานะ

## ดูเพิ่ม
- [[doc-wallet-pass]] · [[doc-cheque-register]] · [[acc-payment-tab]] · [[doctypes-overview]]
