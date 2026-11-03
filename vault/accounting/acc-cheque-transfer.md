---
title: "วงจรเช็ครับ/เช็คจ่าย บัตรเครดิต และโอนเงินระหว่างบัญชี (Cheque Lifecycle & Bank Transfer)"
tags: [accounting, cheque, bank, credit-card, gl]
aliases: ["เช็ครับ", "เช็คจ่าย", "ฝากเช็ค", "เช็คผ่าน", "เช็คคืน", "เปลี่ยนเช็ค", "เช็คยกมา", "บัตรเครดิต", "โอนเงิน 422", "cb_chq_list", "สถานะเช็ค"]
sources: ["backend/internal/application/process/cheque.go:32", "backend/internal/application/process/cheque.go:68", "backend/internal/application/process/cheque.go:81", "backend/internal/application/process/cheque.go:101", "backend/internal/application/process/cheque.go:181", "backend/internal/application/process/cheque.go:220", "backend/internal/application/process/cheque.go:329", "backend/internal/application/process/cheque_forward.go:10", "backend/internal/application/process/trans.go:604", "backend/internal/application/process/trans.go:619", "backend/internal/application/process/trans.go:631", "backend/internal/application/process/service.go:1585", "backend/internal/application/process/service.go:1797", "backend/internal/application/process/service.go:1806", "backend/internal/application/process/service.go:2232", "backend/internal/application/process/service.go:2254", "backend/internal/application/process/service.go:2322", "backend/internal/application/process/service.go:2340", "backend/internal/application/process/docs.go:248", "backend/internal/application/process/trans_validate.go:44"]
---

# วงจรเช็ครับ/เช็คจ่าย บัตรเครดิต และโอนเงินระหว่างบัญชี

เช็คแต่ละใบอยู่ใน `cb_chq_list` เอกสารแต่ละขั้น (ฝาก ผ่าน คืน ยกเลิก เปลี่ยน) เป็น `ic_trans` คนละ flag และ `cb_chq_list.status` เป็นค่า derived ที่คำนวณจากแถวล่าสุดของเช็คนั้นทุกครั้ง GL ด้านล่างเป็นชุดบัญชีมาตรฐาน ใช้เมื่อไม่มี template (`erp_doc_format_gl`) ลงรายการให้เอกสารนั้น (service.go:1585)

## ทำงานอย่างไร

### สถานะเช็ค (`chequeStatusSQL` cheque.go:32)
| chq_type | flag ล่าสุด → status |
|---|---|
| 1 เช็ครับ | 405→0, 410→1, 411→2, 412→3, 413→4, 414→6, 416→7, 418→8 |
| 2 เช็คจ่าย | 406→0, 451→2, 452→4, 453→3, 456→7 |
| 3 บัตรเครดิต | 461→1, 462→2 |
| 21 wallet | 463→1 |

- ไม่พบแถว = 0 (เช็คในมือ / บัตรปกติ); นับเฉพาะบรรทัด `last_status = 0` ที่ `doc_ref` และ `ref_row` ตรงกับแถวทะเบียน
- คีย์เลขเช็ค: 418 ใช้ `item_code`, 416 และ 456 ใช้ `chq_number` (ว่างจึงใช้ `item_code`), flag อื่นใช้ `chq_number`
- เรียง `doc_date`, `doc_time` ล่าสุดก่อน แล้ว trans_flag มากก่อน (เฉพาะเช็ครับ) แล้ว roworder
- `RebuildChequeStatus` (:68) ถูกเรียกหลังบันทึกเอกสารวงจรเช็ค/บัตร/wallet (flag 405–418, 451–456, 461–463 ตาม `isChequeFlag` trans.go:631) โดยส่งเลขเช็ค + item_code ของเอกสารนั้น (trans.go:619); และ `RebuildCheque` (:329) รัน `SyncTransferPair` + `RebuildChequeStatus` ใน tx เดียว timeout 60 วินาที

### เลือกเช็คได้ตามสถานะ (`chequeCandidateWhere` :220)
- 410 / 413: status 0 หรือ 3; 411: status 1; 412: status 1 หรือ 2; 416 / 418: 0 หรือ 3 และต้องเป็นของลูกหนี้รายนั้น (`ap_ar_code`)
- 451 / 452: 0 หรือ 3; 456: 0 หรือ 3 และเจ้าหนี้รายนั้น; 453: status 2; บัตร 461 / 462 และ wallet 463: status 0

### เช็คยกมา (`chequeForwardStmts` cheque_forward.go:10)
- 405 เช็ครับยกมา / 406 เช็คจ่ายยกมา เขียน `cb_trans_detail` + `cb_chq_list`; 405 เลขเช็คอยู่ใน item_code, 406 อยู่ใน chq_number และ item_code = สมุดบัญชี

### โอนเงิน 422 / 420 (`SyncTransferPair` cheque.go:101)
- ทำก่อนลง GL ทุกครั้งที่บันทึก 422 (trans.go:604): ลบ 420 เดิมแล้วสร้างใหม่จาก 422: เลขเดียวกัน, เวลา +1 นาที (`addOneMinute` :181, 23:59 → 00:00), สลับคอลัมน์ต้นทาง/ปลายทาง (สาขา ฝั่ง แผนก โครงการ จัดสรร งาน และ detail สมุด ธนาคาร สาขาธนาคาร `transferPairSwaps` :81), detail `calc_flag` = -1
- GL 422 (service.go:2232): Dr บัญชีของสมุดปลายทาง (`item_code_2`) / Cr บัญชีของสมุดต้นทาง (`item_code`) จาก `erp_pass_book.account_code_1`; หาไม่ได้ใช้บัญชีธนาคารมาตรฐาน

### บัญชีธนาคารที่ใช้ในทุกขั้น
- หาสมุดจาก detail `item_code` ที่มีใน `erp_pass_book` → `cb_trans_detail.pass_book_code` → `ic_trans.pass_book_code` แล้วใช้ `account_code_1` ของสมุด (service.go:1806)
- ไม่พบสมุด ใช้ 1112 / 1113 / 1111 (service.go:1797)

### GL เช็ครับ (service.go:2254)
- บัญชี: เช็ครับ 1122-00 / 1122 / 1121, เช็คระหว่างเรียกเก็บ 1122-01 / 1122 (สร้างผังบัญชี 1122-01 อัตโนมัติถ้าไม่มี)
- 410 ฝาก: Dr ธนาคาร (หรือ 1122-01 เมื่อมี 411 ที่ใช้เช็คเดียวกันและยัง active) / Cr เช็ครับ
- 411 ผ่าน: Dr ธนาคาร / Cr เช็ครับ หรือ 1122-01 และ UPDATE บรรทัด Dr ของ 410 ที่ใช้เช็คเดียวกันเป็น 1122-01
- 412 คืน: Dr เช็ครับ / Cr ธนาคาร
- 413 ยกเลิก, 414, 418 ตั้งหนี้ใหม่: Dr ลูกหนี้ / Cr เช็ครับ
- 416 เปลี่ยนเช็ค: Dr ธนาคาร / Cr เช็ครับ

### GL เช็คจ่าย (service.go:2322) บัญชีเช็คจ่าย 2112 / 2111
- 451 ผ่าน: Dr เช็คจ่าย / Cr ธนาคาร
- 456 เปลี่ยน: Dr เช็คจ่าย / Cr เจ้าหนี้
- 452 ยกเลิก, 453 คืน: Dr ธนาคาร / Cr เจ้าหนี้

### GL บัตรเครดิต / wallet (service.go:2340)
- 461 ขึ้นเงิน: Dr ธนาคาร (มี VAT: Dr ธนาคารด้วยฐาน + Dr ภาษีซื้อ) / Cr ลูกหนี้
- 462 / 463: Dr ลูกหนี้ / Cr ธนาคาร

## จุดเสี่ยง
- **411 แก้ GL ของเอกสาร 410** (UPDATE `gl_journal_detail` ข้ามเอกสาร) ลำดับการ rebuild จึงมีผลต่อผล
- **452 / 453 ไม่ได้กลับบัญชีเช็คจ่าย 2112** ที่ตั้งไว้ตอนจ่าย โค้ดลง Dr ธนาคาร / Cr เจ้าหนี้; เงื่อนไข `453` ในกิ่ง else ไม่มีทางทำงานเพราะ 453 ถูกจับในกิ่งแรกแล้ว
- ทะเบียนเช็ค `cb_chq_list` เพิ่ม/แก้/ลบผ่าน SaveDoc ไม่ได้ (คืน `errChequeRegisterReadOnly` docs.go:248) ต้องทำผ่านเอกสารรับ/จ่ายเช็คซึ่งบันทึกผ่าน SaveTrans → `checkTransScreenSave` ตรวจงวดเปิดด้วย `checkOpenPeriod` (trans_validate.go:44) ดู [[acc-period-close]]
- 422 ไม่มีบรรทัดค่าธรรมเนียมโอน

## ที่มาในโค้ด
- `backend/internal/application/process/cheque.go:32` chequeStatusSQL
- `backend/internal/application/process/cheque.go:68` RebuildChequeStatus
- `backend/internal/application/process/cheque.go:81` transferPairSwaps
- `backend/internal/application/process/cheque.go:101` SyncTransferPair
- `backend/internal/application/process/cheque.go:220` chequeCandidateWhere
- `backend/internal/application/process/cheque.go:329` RebuildCheque
- `backend/internal/application/process/cheque_forward.go:10` เช็คยกมา
- `backend/internal/application/process/trans.go:619` เรียก RebuildChequeStatus หลังบันทึก
- `backend/internal/application/process/service.go:2232` GL 422
- `backend/internal/application/process/service.go:2254` GL เช็ครับ
- `backend/internal/application/process/service.go:2322` GL เช็คจ่าย
- `backend/internal/application/process/service.go:2340` GL บัตรเครดิต
- `backend/internal/application/process/docs.go:248` ทะเบียนเช็คอ่านอย่างเดียว

## ดูเพิ่ม
- [[acc-payment-tab]]
- [[acc-gl-posting-standard]]
- [[acc-gl-rebuild]]
