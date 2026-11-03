---
title: "เช็ครับ ตั้งแต่รับ-นำฝาก-ผ่าน-คืน-ขาดสิทธิ์ ลงบัญชีและเปลี่ยนสถานะอย่างไร"
tags: [faq, cheque, cash-bank, gl, ar]
aliases: ["เช็ครับ", "นำฝากเช็ค", "เช็คผ่าน", "เช็คคืน", "เช็คเด้ง", "received cheque", "cb_chq_list status", "trans_flag 410", "trans_flag 411", "1122-01 เช็คระหว่างเรียกเก็บ"]
sources: ["backend/internal/application/process/cheque.go:32", "backend/internal/application/process/cheque.go:68", "backend/internal/application/process/cheque.go:220", "backend/internal/application/process/service.go:2254", "backend/internal/application/process/service.go:2294", "backend/internal/application/process/service.go:1876", "backend/internal/application/process/report_menu_cb.go:152"]
---
# เช็ครับ ตั้งแต่รับ-นำฝาก-ผ่าน-คืน-ขาดสิทธิ์ ลงบัญชีและเปลี่ยนสถานะอย่างไร

**ตอบสั้น:** รับเช็คในแท็บรับชำระ → Dr เช็ครับ (1122) แล้วแต่ละขั้นเป็นเอกสารแยก: 410 นำฝาก, 411 ผ่าน, 412 คืน, 413 ขาดสิทธิ์, 416 เปลี่ยนเช็ค, 418 คืนเช็ค/ตั้งหนี้ใหม่ สถานะใน `cb_chq_list` ไม่ได้เก็บแยก ระบบคำนวณใหม่จากเอกสารล่าสุดของเช็คนั้นทุกครั้ง

## รายละเอียด
ดู [[acc-cheque-transfer]], [[doc-cheque-received-lifecycle]], [[term-cheque-status]], [[tbl-cb-chq-list]]

**สถานะ (`chequeStatusSQL`)** ใช้แถว `ic_trans_detail` ล่าสุดที่ยังไม่ยกเลิก (เรียง doc_date, doc_time, trans_flag มากก่อน) ไม่มีแถว = 0

| เอกสาร | สถานะ | ชื่อสถานะในรายงาน |
|---|---|---|
| รับในแท็บชำระ / 405 ยกมา | 0 | เช็คในมือ |
| 410 นำฝาก | 1 | เช็คนำฝาก |
| 411 ผ่าน | 2 | เช็คผ่าน |
| 412 คืน | 3 | เช็ครับคืน |
| 413 ขาดสิทธิ์ | 4 | เช็คยกเลิก (เมนูเรียกขาดสิทธิ์) |
| 414 (มีเฉพาะ backend) | 6 | เช็คคืนนำเข้าใหม่ |
| 416 เปลี่ยนเช็ค | 7 | เช็คเปลี่ยน |
| 418 คืนเช็ค/ตั้งหนี้ใหม่ | 8 | เช็คตั้งหนี้ใหม่ |

418 จับคู่เช็คด้วย `item_code` ส่วนอื่นใช้ `chq_number`

**เลือกเช็คได้เมื่อ (`chequeCandidateWhere`)**
- 410, 413: สถานะ 0 หรือ 3
- 411: สถานะ 1 (และสมุดบัญชีตรงกับใบนำฝากล่าสุด)
- 412: สถานะ 1 หรือ 2 (และสมุดตรงกับใบผ่านล่าสุด)
- 416, 418: สถานะ 0 หรือ 3 และลูกค้าเดียวกัน

**GL เส้นมาตรฐาน** (เช็ครับ = 1122-00/1122/1121, ระหว่างเรียกเก็บ = 1122-01/1122 ระบบสร้างผัง 1122-01 "เช็ครับระหว่างเรียกเก็บ" ให้ถ้ายังไม่มี)
- รับชำระ (239 ฯลฯ): Dr เช็ครับ 1122 / Cr ลูกหนี้ ([[faq-payment-tab-tenders]])
- 410 นำฝาก: Dr ธนาคาร / Cr เช็ครับ (ถ้ามี 411 ของเช็คนี้แล้ว Dr 1122-01 แทน)
- 411 ผ่าน: Dr ธนาคาร / Cr 1122-01 และแก้บรรทัด Dr ของใบนำฝาก 410 เป็น 1122-01 (ถ้าไม่พบใบนำฝาก Cr เช็ครับ)
- 412 คืน: Dr เช็ครับ / Cr ธนาคาร
- 413, 414, 418: Dr ลูกหนี้ / Cr เช็ครับ
- 416 เปลี่ยนเช็ค: Dr ธนาคาร / Cr เช็ครับ
- 405 ยกมา: ไม่มี case ใน GL เส้นมาตรฐาน `cheque_forward.go` แค่ลงทะเบียนเช็ค

ธนาคารใช้ `erp_pass_book.account_code_1` ของสมุดบัญชีในเอกสาร ไม่มีใช้ 1112/1113/1111 ([[tbl-erp-pass-book]])

## ข้อควรระวัง
- แท็บรับชำระลงเช็คที่ "1122" รหัสเดียว (`service.go:1876`) แต่เอกสารนำฝาก/คืนใช้ "1122-00" ก่อน (`service.go:2260`) ถ้าผังมี 1122-00 ยอดจะค้างคนละบัญชี
- บันทึก 411 ไปแก้ GL ของเอกสาร 410 อีกใบ (`service.go:2294`) ถ้ายกเลิก/ลบ 411 ต้อง rebuild GL ของ 410 ด้วย ([[faq-gl-rebuild-when]])
- 416 ลง Dr ธนาคาร ไม่ได้ลงเช็คใบใหม่ การลงเช็คใหม่ ไม่ชัดจากโค้ดเส้นมาตรฐาน
- เอกสารเช็คไม่มีการตรวจงวดบัญชี (`period.go:107-108`)
- ถ้ารหัสเอกสารมีรูปแบบ GL ระบบใช้รูปแบบแทน ([[faq-gl-template-doc-format]])

## ดูเพิ่ม
- [[faq-cheque-paid-lifecycle]]
- [[acc-cheque-transfer]]
- [[doc-cheque-register]]
- [[flow-cash-bank-cheque]]
- [[hist-lessons-payment-cheque-tenders]]

## ที่มาในโค้ด
- `backend/internal/application/process/cheque.go:32` `chequeStatusSQL` (คอมเมนต์ `:16-31`)
- `backend/internal/application/process/cheque.go:68` `RebuildChequeStatus`; `:329` `RebuildCheque`
- `backend/internal/application/process/cheque.go:220` `chequeCandidateWhere`; `:266` `ChequeCandidates`
- `backend/internal/application/process/service.go:2254` GL เช็ครับ 410-418; `:2260-2261` บัญชีเช็ครับ
- `backend/internal/application/process/service.go:2294` 411 แก้ GL ของ 410
- `backend/internal/application/process/service.go:1876` แท็บรับชำระ เช็ค = 1122
- `backend/internal/application/process/cheque_forward.go:10` `chequeForwardStmts` เช็คยกมา 405/406
- `backend/internal/application/process/report_menu_cb.go:152` ชื่อสถานะเช็ค
