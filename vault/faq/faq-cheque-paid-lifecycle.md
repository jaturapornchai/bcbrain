---
title: "เช็คจ่าย ตั้งแต่จ่ายเช็ค-เช็คผ่าน-คืน-ขาดสิทธิ์-เปลี่ยนเช็ค ลงบัญชีอย่างไร"
tags: [faq, cheque, cash-bank, gl, ap]
aliases: ["เช็คจ่าย", "เช็คจ่ายผ่าน", "เช็คจ่ายคืน", "เปลี่ยนเช็คจ่าย", "paid cheque", "เช็คจ่ายล่วงหน้า 2112", "trans_flag 451", "trans_flag 456", "cb_chq_list chq_type 2"]
sources: ["backend/internal/application/process/service.go:1872", "backend/internal/application/process/service.go:2322", "backend/internal/application/process/service.go:2329", "backend/internal/application/process/cheque.go:32", "backend/internal/application/process/cheque.go:220", "backend/internal/application/process/trans.go:1338"]
---
# เช็คจ่าย ตั้งแต่จ่ายเช็ค-เช็คผ่าน-คืน-ขาดสิทธิ์-เปลี่ยนเช็ค ลงบัญชีอย่างไร

**ตอบสั้น:** จ่ายเช็คในแท็บจ่ายชำระ → Cr เช็คจ่าย 2112 แล้วตามด้วยเอกสาร 451 เช็คผ่าน (Dr 2112 / Cr ธนาคาร), 453 เช็คคืน และ 452 ขาดสิทธิ์ (Dr ธนาคาร / Cr เจ้าหนี้), 456 เปลี่ยนเช็ค (Dr 2112 / Cr เจ้าหนี้) สถานะใน `cb_chq_list` คำนวณใหม่จากเอกสารล่าสุด

## รายละเอียด
ดู [[acc-cheque-transfer]], [[doc-cheque-paid-lifecycle]], [[doc-cheque-paid-balance]], [[term-cheque-status]]

**จ่ายเช็ค** แถวเช็คในแท็บชำระเก็บเป็น `cb_trans_detail` doc_type 2 และสร้างแถว `cb_chq_list` (เช็คจ่ายใช้สมุดบัญชีของบริษัท) GL ฝั่งจ่ายลง Cr 2112 ([[faq-payment-tab-tenders]])

**สถานะ (`chequeStatusSQL`, chq_type 2)** จับคู่ด้วย `chq_number` (456 ที่ไม่มีเลขเช็ค ใช้ `item_code` แทน)

| เอกสาร | สถานะ |
|---|---|
| จ่ายในแท็บชำระ / 406 เช็คจ่ายยกมา | 0 เช็คในมือ |
| 451 เช็คผ่าน | 2 |
| 453 เช็คคืน | 3 |
| 452 เช็คขาดสิทธิ์ | 4 |
| 456 เปลี่ยนเช็ค | 7 |

**เลือกเช็คได้เมื่อ (`chequeCandidateWhere`)**
- 451, 452: สถานะ 0 หรือ 3 (และสมุดบัญชีตรง `pass_book_code` ถ้าระบุ)
- 453: สถานะ 2 (ผ่านแล้วเท่านั้น)
- 456: สถานะ 0 หรือ 3 และเจ้าหนี้เดียวกัน

**GL เส้นมาตรฐาน** (เช็คจ่าย = 2112/2111, ธนาคาร = `erp_pass_book.account_code_1` ไม่มีใช้ 1112/1113/1111)
- 451 ผ่าน: Dr เช็คจ่าย / Cr ธนาคาร
- 453 คืน: Dr ธนาคาร / Cr เจ้าหนี้ (ตั้งหนี้กลับ หลังธนาคารตัดเงินไปแล้ว)
- 452 ขาดสิทธิ์: Dr ธนาคาร / Cr เจ้าหนี้
- 456 เปลี่ยนเช็ค: Dr เช็คจ่าย / Cr เจ้าหนี้
- 406 ยกมา: ไม่มี case ใน GL เส้นมาตรฐาน

## ข้อควรระวัง
- 452 เลือกได้ทั้งเช็คสถานะ 0 (ยังไม่ผ่าน) แต่ GL ลง Dr ธนาคาร / Cr เจ้าหนี้ (`service.go:2324-2328`) ไม่ได้ล้าง 2112 ถ้าเช็คยังไม่เคยผ่าน ยอดเช็คจ่ายจะค้างและธนาคารเกิน ควรให้ผู้ดูแลบัญชีตรวจก่อนใช้
- ใน else branch ของ 451/456 มีเงื่อนไข `transFlag == 453` ซึ่งไม่มีวันเป็นจริง เพราะ 453 ถูกจับไปก่อนแล้ว (`service.go:2324`, `:2331`)
- 456 ลงแค่ 2 บรรทัด การลงเช็คใบใหม่ ไม่ชัดจากโค้ดเส้นมาตรฐาน
- เอกสารเช็คไม่มีการตรวจงวดบัญชี ([[faq-period-closed-cannot-save]])
- รหัสเอกสารที่มีรูปแบบ GL ใช้รูปแบบแทน ([[faq-gl-template-doc-format]])

## ดูเพิ่ม
- [[faq-cheque-received-lifecycle]]
- [[faq-payment-tab-tenders]]
- [[faq-ar-receipt-ap-payment-gl]]
- [[flow-cash-bank-cheque]]
- [[tbl-cb-chq-list]]

## ที่มาในโค้ด
- `backend/internal/application/process/service.go:1872` แท็บจ่ายชำระ เช็ค = 2112
- `backend/internal/application/process/service.go:2322` GL เช็คจ่าย 451-456; `:2323` บัญชี 2112/2111; `:2324` 452/453
- `backend/internal/application/process/service.go:2329` else branch (เงื่อนไข 453 ที่ `:2331` ไม่ถูกใช้)
- `backend/internal/application/process/cheque.go:32` `chequeStatusSQL` chq_type 2
- `backend/internal/application/process/cheque.go:220` `chequeCandidateWhere` 451/452/453/456
- `backend/internal/application/process/trans.go:1338` `payStmts` เขียนแถวเช็ค/`cb_chq_list`
- `backend/internal/application/process/cheque_forward.go:10` เช็คจ่ายยกมา 406
