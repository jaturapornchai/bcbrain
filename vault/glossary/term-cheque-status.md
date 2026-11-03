---
title: "เช็ครับ/เช็คจ่าย และสถานะเช็ค (cheque / cb_chq_list.status / chq_type)"
tags: [glossary, cb, cheque, credit-card]
aliases: ["เช็ค", "เช็ครับ", "เช็คจ่าย", "cb_chq_list", "chq_type", "chq_number", "เลขที่เช็ค", "สถานะเช็ค", "เช็คในมือ", "เช็คนำฝาก", "เช็คผ่าน", "เช็ครับคืน", "เช็คคืน", "เช็คยกเลิก", "เช็คขาดสิทธิ์", "เช็คขายลด", "เช็คคืนนำเข้าใหม่", "เช็คเปลี่ยน", "เช็คตั้งหนี้ใหม่", "ทะเบียนเช็ครับ", "ทะเบียนเช็คจ่าย", "บัตรเครดิต", "wallet", "e-Wallet", "chequeStatusSQL", "รอขึ้นเงิน"]
sources: ["backend/internal/application/process/cheque.go:32", "backend/internal/application/process/report_menu_cb.go:152", "backend/internal/application/process/doc_flow_graph.go:565", "frontend/account/tabs/transMenuMap.ts:1991", "frontend/account/tabs/transMenuMap.ts:2180", "frontend/account/tabs/transMenuMap.ts:2325", "frontend/src/config/bcMenu.json:7752", "frontend/src/config/bcMenu.json:7777", "frontend/src/config/bcMenu.json:7863", "frontend/src/config/bcMenu.json:7950", "backend/internal/application/process/trans.go:1287"]
---

# เช็ค และสถานะเช็ค

## ในระบบนี้คืออะไร
เช็คแต่ละใบ บัตรเครดิต และ wallet มีแถวใน `cb_chq_list` แยกชนิดด้วย `chq_type` (เท่ากับ `trans_flag` ของทะเบียน ได้แก่ 1 เช็ครับ CQR `transMenuMap.ts:1991`, 2 เช็คจ่าย CQP `:2180`, 3 บัตรเครดิต CCR `:2325`)
**สถานะเช็ค `status` เป็นข้อมูล derived** ระบบคำนวณใหม่จากแถว `ic_trans_detail` ล่าสุดที่ยังไม่ยกเลิกของเช็คใบนั้น (`chequeStatusSQL`, `cheque.go:32-65`) โดยจับคู่ด้วย `doc_ref` + `ref_row` ของแถวทะเบียนเช็ค และเลขที่เช็ค `chq_number` (`cheque.go:43-56`)

## ค่าที่เป็นไปได้ `cb_chq_list.status` (`report_menu_cb.go:152`)
0 เช็คในมือ · 1 เช็คนำฝาก · 2 เช็คผ่าน · 3 เช็ครับคืน · 4 เช็คยกเลิก · 5 เช็คขายลด · 6 เช็คคืนนำเข้าใหม่ · 7 เช็คเปลี่ยน · 8 เช็คตั้งหนี้ใหม่
(กราฟเอกสารแสดงสถานะ 0 ว่า "เช็คในมือ/รอขึ้นเงิน", `doc_flow_graph.go:565`)

## เอกสาร → สถานะ (`cheque.go:38-41`)
| chq_type | flag ของเอกสาร → status |
|---|---|
| 1 เช็ครับ | 405 ยกมา→0, 410 นำฝาก→1, 411 ผ่าน→2, 412 คืน→3, 413 ขาดสิทธิ์→4, 414→6 (ไม่พบเมนูของ flag 414 ใน transMenuMap.ts), 416 เปลี่ยน→7, 418 คืนเช็ค/ตั้งหนี้ใหม่→8 |
| 2 เช็คจ่าย | 406 เช็คจ่ายยกมา→0, 451 เช็คผ่าน→2, 452 เช็คขาดสิทธิ์→4, 453 เช็คคืน→3, 456 เปลี่ยนเช็ค→7 (`transMenuMap.ts:2193-2267`) |
| 3 บัตรเครดิต | 461 ขึ้นเงินบัตรเครดิต→1, 462 ยกเลิกบัตรเครดิต→2 (`:2338`, `:2353`) |
| 21 wallet | 463 ขึ้นเงิน wallet→1 (`:1960`) |
ไม่มีแถวที่ตรง = 0 (เช็คในมือ / บัตรปกติ) (`cheque.go:35`)
ชื่อเมนูของ flag เช็ครับ (`transMenuMap.ts`): 405 CHB ยกมา (`:2004`), 410 CHD นำฝาก (`:2019`), 411 CHP ผ่าน (`:2034`), 412 CRT คืน (`:2049`), 413 CRC ขาดสิทธิ์ (`:2064`), 416 CDE เปลี่ยน (`:2079`), 418 CND (`:2094`)

## หน้าจอ
เช็ครับ (bcMenu.json:7752, ทะเบียนเช็ครับ :7777), เช็คจ่าย (:7863), บัตรเครดิต (:7950) แถวเช็คในแท็บชำระเงินคือ `cb_trans_detail.doc_type = 2` คู่กับ `cb_chq_list` (`trans.go:1287`) ดู [[term-pay-tenders]]

## ข้อควรระวัง
- เมนูเรียก 413 และ 452 ว่า "เช็คขาดสิทธิ์" แต่ enum ของรายงานเรียกสถานะ 4 ว่า "เช็คยกเลิก" ทั้งสองชื่อหมายถึงเลขเดียวกัน
- เช็คจ่ายที่ผ่านไม่มีสถานะ 1 (นำฝาก)
- ห้ามแก้ `status` ตรงๆ เมื่อยกเลิกเอกสารเช็ค ระบบจะคำนวณใหม่ให้ ดู [[term-last-status-cancel-approve]]

## ลิงก์
[[acc-cheque-transfer]] · [[term-pay-tenders]] · [[tbl-cb-trans-detail]] · [[glossary-overview]]

## ที่มาในโค้ด
- `backend/internal/application/process/cheque.go:32-65`
- `backend/internal/application/process/report_menu_cb.go:152`
- `backend/internal/application/process/doc_flow_graph.go:565`
- `backend/internal/application/process/trans.go:1287`
- `frontend/account/tabs/transMenuMap.ts:1991-2094`, `:2180`, `:2325`
- `frontend/src/config/bcMenu.json:7752`, `:7777`, `:7863`, `:7950`
