---
title: "การรับ/จ่ายเงินในเอกสาร เงินสด โอน เช็ค บัตร (payment tenders / cb_trans / doc_type)"
tags: [glossary, cb, payment]
aliases: ["cb_trans", "cb_trans_detail", "แท็บชำระเงิน", "การชำระเงิน", "รับเงิน", "จ่ายเงิน", "เงินสด", "cash_amount", "เงินโอน", "โอน", "tranfer_amount", "เช็ค", "chq_amount", "บัตรเครดิต", "card_amount", "พร้อมเพย์", "PromptPay", "QR", "e-Wallet", "wallet_amount", "เงินทอน", "money_change", "pay_type", "ap_ar_type", "doc_type", "TransPay", "payReceiveFlags", "รายได้อื่น", "ค่าใช้จ่ายอื่น", "total_income_other", "total_expense_other"]
sources: ["backend/internal/application/process/trans.go:1267", "backend/internal/application/process/trans.go:1278", "backend/internal/application/process/trans.go:1287", "backend/internal/application/process/trans.go:1298", "backend/internal/application/process/trans.go:1311", "backend/internal/application/process/trans.go:1331", "backend/internal/application/process/trans.go:1371", "backend/internal/application/process/trans.go:1380", "backend/internal/application/process/trans.go:1510", "backend/internal/application/process/pay_other.go:25", "backend/internal/application/process/gl_pay_other.go:23", "backend/internal/application/process/trans_deposit.go:40", "backend/internal/application/process/doc_flow.go:106"]
---

# การรับ/จ่ายเงินในเอกสาร (cb_trans)

## ในระบบนี้คืออะไร
เอกสารที่มีการรับหรือจ่ายเงิน (ขายสด ซื้อสด ชำระหนี้ รายได้/ค่าใช้จ่ายอื่น ฝาก/ถอน) จะเขียนหัว `cb_trans` และรายละเอียดตามช่องทางลง `cb_trans_detail` ข้อมูลส่งมาใน `TransPay` (`trans.go:1311-1328`)

## หัว `cb_trans` (`trans.go:1380-1382`)
`trans_type`, `trans_flag`, `doc_date`, `doc_no`, `doc_time`, `ap_ar_code`, `pay_type`, `doc_format_code`, `branch_code`, `total_amount`, `total_net_amount`, `total_amount_pay`, `cash_amount`, `tranfer_amount`, `chq_amount`, `card_amount`, `total_expense_other`, `total_income_other`, `pay_cash_amount`, `money_change`, `wallet_amount`

## ค่าที่เป็นไปได้
- `pay_type`: 1 = รับเงิน เมื่อ flag อยู่ใน `payReceiveFlags` (16, 20, 25, 40, 44, 46, 99, 110, 239, 250, 254, 262, 300, 317, 402, 416) นอกนั้น 2 = จ่ายเงิน (`trans.go:1331-1374`)
- `cb_trans_detail.ap_ar_type` (หัว `cb_trans` ไม่มีคอลัมน์นี้): 1 เมื่อ `trans_type = 2` (ขาย/ลูกหนี้) นอกนั้น 2 (`trans.go:1375-1376`) เขียนลงทุกแถวรายละเอียดที่ `:1510`
- `cb_trans_detail.doc_type`:
  - 1 โอนเงิน (`trans.go:1267`, เขียนที่ `:1416`)
  - 2 เช็ค คู่กับ `cb_chq_list` (`:1287`, เขียนที่ `:1465`)
  - 3 บัตรเครดิต คู่กับ `cb_chq_list` (`:1298`, เขียนที่ `:1494`)
  - 5 ใช้เงินล่วงหน้า และ 6 ใช้เงินมัดจำ (`trans_deposit.go:40-43`, `doc_flow.go:106-109`)
  - 11 ค่าใช้จ่ายอื่น และ 12 รายได้อื่น (`pay_other.go:25-27`, บันทึกที่ `:117-126`, อ่านไปลงบัญชีที่ `gl_pay_other.go:23-29`)
  - 21 PromptPay / QR / e-Wallet (`:1278`, เขียนที่ `:1437`)

## ข้อควรระวัง
- คอลัมน์ `tranfer_amount` สะกดผิด (ขาด s) และเป็นชื่อจริงใน DB ห้ามแก้เป็น transfer_amount ส่วน `ic_trans_detail.transfer_amount` ของจอโอนเงินสะกดถูก
- `pay_type` 1 = รับ แม้จะเป็นเอกสารฝั่งซื้อ เช่น 16 ส่งคืนสินค้า ที่ผู้ขายคืนเงินให้เรา
- ช่องทาง 5/6 ไม่ใช่เงินที่เคลื่อนจริง แต่เป็นการหักเงินล่วงหน้า/มัดจำที่รับหรือจ่ายไว้ก่อน ดู [[term-deposit-advance]]

## ลิงก์
[[acc-payment-tab]] · [[term-cheque-status]] · [[term-deposit-advance]] · [[tbl-cb-trans]] · [[tbl-cb-trans-detail]] · [[glossary-overview]]

## ที่มาในโค้ด
- `backend/internal/application/process/trans.go:1267`, `:1278`, `:1287`, `:1298`, `:1311-1328`, `:1331-1332`, `:1371-1382`, `:1416`, `:1437`, `:1465`, `:1494`, `:1510`
- `backend/internal/application/process/pay_other.go:25-27`, `:117-126`; `gl_pay_other.go:23-29`
- `backend/internal/application/process/trans_deposit.go:40-43`
- `backend/internal/application/process/doc_flow.go:106-109`
