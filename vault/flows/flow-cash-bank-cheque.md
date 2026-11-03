---
title: "เงินสด ธนาคาร และวงจรเช็ค (Cash, Bank & Cheque Lifecycle)"
tags: [flows, cash]
aliases: ["วงจรเช็ค", "เช็ครับ เช็คจ่าย", "ฝากถอนโอน", "เงินสดย่อย", "cheque lifecycle"]
sources: ["backend/internal/application/process/cheque.go:16", "backend/internal/application/process/service.go:2207", "backend/internal/application/process/service.go:2243", "backend/internal/application/process/trans.go:1543", "frontend/account/tabs/transMenuMap.ts:1891"]
---
# เงินสด ธนาคาร และวงจรเช็ค (Cash, Bank & Cheque Lifecycle)

เงินเข้าออกทุกช่องทางเกิดจาก "แท็บชำระเงิน" ของเอกสารต้นทาง (ขายสด 44, รับชำระ 239, จ่ายชำระ 19, มัดจำ ฯลฯ) ซึ่งเขียน `cb_trans`/`cb_trans_detail` ส่วนเช็คที่รับ/จ่ายจะถูกนำเข้าทะเบียน `cb_chq_list` แล้วเดินสถานะด้วยเอกสารเช็คแต่ละชนิด ดู [[acc-payment-tab]] และ [[acc-cheque-transfer]]

## ภาพรวม

```mermaid
flowchart LR
  SRC["แท็บชำระเงิน 44/239/19/40/110 ..."] --> CB[("cb_trans / cb_trans_detail")]
  SRC -->|"chqListFromPaySQL"| REG[("ทะเบียนเช็ค cb_chq_list")]
  FWD["เช็คยกมา 405/406"] --> REG
  REG --> IN0["รับ: ในมือ (0)"]
  IN0 -->|"410 นำฝาก"| IN1["ฝากแล้ว (1)"]
  IN1 -->|"411 ผ่าน"| IN2["ผ่าน (2)"]
  IN1 -->|"412 คืน"| IN3["คืน (3)"]
  IN2 -->|"412 คืน"| IN3
  IN3 -->|"410 ฝากใหม่ / 416 เปลี่ยน / 418 ตั้งหนี้ใหม่"| NX["1 / 7 / 8"]
  IN0 -->|"413 ขาดสิทธิ์"| IN4["4"]
  REG --> OUT0["จ่าย: ออกแล้ว (0)"]
  OUT0 -->|"451 ผ่าน"| OUT2["2"]
  OUT0 -->|"452 ขาดสิทธิ์"| OUT4["4"]
  OUT2 -->|"453 คืน"| OUT3["3"]
  OUT0 -->|"456 เปลี่ยน"| OUT7["7"]
```

สถานะคำนวณใหม่จากแถวล่าสุดที่ยังไม่ยกเลิกของเช็คแต่ละใบ (`chequeStatusSQL`, `cheque.go:16-31`):
- รับ (chq_type 1): 405→0, 410→1, 411→2, 412→3, 413→4, 414→6, 416→7, 418→8
- จ่าย (chq_type 2): 406→0, 451→2, 452→4, 453→3, 456→7
- บัตรเครดิต (chq_type 3): 461→1, 462→2
- wallet (chq_type 21): 463→1
- ไม่มีแถวใดเลย = 0

## ขั้นตอน

| ขั้น | เอกสาร/หน้าจอ | ตารางที่เขียน | ผลบัญชี | path:line |
|---|---|---|---|---|
| 1 | รายได้อื่น (250) / ค่าใช้จ่ายอื่น (260) และใบปรับ 252/254, 262/264 [[doc-other-income]] [[doc-other-expense]] [[doc-other-income-adjust]] [[doc-other-expense-adjust]] | [[tbl-ic-trans]], [[tbl-cb-trans]], GL | 250: Dr ช่องทางรับหรือลูกหนี้ / Cr รายได้ + ภาษีขาย · 260: Dr ค่าใช้จ่าย + ภาษีซื้อ / Cr ช่องทางจ่ายหรือเจ้าหนี้ (ถ้ามี `cb_trans.total_amount_pay` ถือเป็นเงินสด) | `frontend/account/tabs/transMenuMap.ts:1614`, `:1708`, `backend/internal/application/process/service.go:1965-1983`, `:1998-2049` |
| 2 | เงินสดย่อย 300 (เมนู "คืน/ลด วงเงินสดย่อย") / 301 (เมนู "รับ/เพิ่ม วงเงินสดย่อย") [[doc-petty-cash]] | [[tbl-ic-trans]], [[tbl-ic-trans-detail]], [[tbl-cb-trans]], GL | 300: Dr เงินสดย่อย 1111-01 (หรือบัญชีของรายการ) / Cr ช่องทางจ่าย · 301: Dr ช่องทางรับ / Cr เงินสดย่อย | `frontend/account/tabs/transMenuMap.ts:1802`, `:1817`, `backend/internal/application/process/service.go:2207-2220` |
| 3 | ฝากเงิน (401) / ถอนเงิน (402) [[doc-bank-deposit-withdraw]] | [[tbl-ic-trans]], GL | 401: Dr ธนาคารตามสมุดบัญชี / Cr เงินสด · 402: Dr เงินสด / Cr ธนาคาร | `frontend/account/tabs/transMenuMap.ts:1891`, `:1906`, `backend/internal/application/process/service.go:2064-2122` |
| 4 | โอนระหว่างธนาคาร (422) [[doc-bank-transfer]] | [[tbl-ic-trans]], [[tbl-ic-trans-detail]] + คู่ขาเข้า (`SyncTransferPair`) | Dr สมุดบัญชีปลายทาง / Cr สมุดบัญชีต้นทาง | `frontend/account/tabs/transMenuMap.ts:1921`, `backend/internal/application/process/service.go:2221`, `backend/internal/application/process/cheque.go:101` |
| 5 | รับ/จ่ายเช็คในแท็บชำระเงิน หรือเช็คยกมา 405/406 [[doc-cheque-received-balance]] [[doc-cheque-paid-balance]] | [[tbl-cb-chq-list]], [[tbl-cb-trans-detail]] | ตอนรับ: Dr เช็ครับ 1122 · ตอนจ่าย: Cr เช็คจ่าย 2112 (ใน payTenders) · 405/406 ไม่ลง GL | `backend/internal/application/process/trans.go:1543`, `backend/internal/application/process/cheque_forward.go:10`, `backend/internal/application/process/service.go:1861-1867` |
| 6 | นำฝากเช็ครับ (410) `menu_cb_chq_in_payin` [[doc-cheque-received-lifecycle]] | [[tbl-ic-trans]], [[tbl-ic-trans-detail]], GL | Dr ธนาคาร (หรือ 1122-01 เช็คระหว่างเรียกเก็บ เมื่อมี 411 ที่ยังไม่ยกเลิก) / Cr เช็ครับ 1122-00 | `frontend/account/tabs/transMenuMap.ts:2023`, `backend/internal/application/process/service.go:2252-2270` |
| 7 | เช็ครับผ่าน (411) `menu_cb_chq_in_pass` | ic_trans, GL และแก้ GL ของ 410 | Dr ธนาคาร / Cr 1122-01 · ถ้าพบ 410 คู่กัน จะ UPDATE บรรทัด Dr ของ 410 ใน `gl_journal_detail` เป็น 1122-01 | `frontend/account/tabs/transMenuMap.ts:2038`, `backend/internal/application/process/service.go:2271-2293` |
| 8 | เช็ครับคืน (412) | ic_trans, GL | Dr 1122-00 / Cr ธนาคาร | `frontend/account/tabs/transMenuMap.ts:2053`, `backend/internal/application/process/service.go:2294-2298` |
| 9 | เช็ครับขาดสิทธิ์ (413) / 414 / คืนเช็ค-ตั้งหนี้ใหม่ (418) | ic_trans, GL | Dr ลูกหนี้ / Cr 1122-00 | `frontend/account/tabs/transMenuMap.ts:2068`, `:2098`, `backend/internal/application/process/service.go:2299-2303` |
| 10 | เปลี่ยนเช็ครับ (416) `menu_cb_chq_renew` | ic_trans, GL | ตกกรณี default: Dr ธนาคาร / Cr 1122-00 | `frontend/account/tabs/transMenuMap.ts:2083`, `backend/internal/application/process/service.go:2304-2309` |
| 11 | เช็คจ่ายผ่าน (451) / ขาดสิทธิ์ (452) / คืน (453) / เปลี่ยน (456) [[doc-cheque-paid-lifecycle]] | ic_trans, GL | 451: Dr เช็คจ่าย 2112 / Cr ธนาคาร · 452, 453: Dr ธนาคาร / Cr เจ้าหนี้ · 456: Dr 2112 / Cr เจ้าหนี้ | `frontend/account/tabs/transMenuMap.ts:2212-2257`, `backend/internal/application/process/service.go:2311-2328` |
| 12 | บัตรเครดิต 461 (ขึ้นเงิน) / 462 · wallet 463 [[doc-credit-card]] [[doc-wallet-pass]] | ic_trans, GL | 461: Dr ธนาคาร (+ Dr ภาษีซื้อเมื่อมี VAT) / Cr ลูกหนี้ · 462 และ 463: Dr ลูกหนี้ / Cr ธนาคาร | `frontend/account/tabs/transMenuMap.ts:1964`, `:2342`, `backend/internal/application/process/service.go:2329-2345` |
| 13 | ประมวลผลเช็คใหม่ | [[tbl-cb-chq-list]] | คำนวณสถานะใหม่ทั้งหมด | `backend/internal/application/process/cheque.go:329`, `backend/internal/adapter/inbound/http/router.go:190` |

หลังบันทึกเอกสารทุกใบ `rebuildTransDerived` จะเรียก `SyncTransferPair` (เฉพาะ 422) และ `RebuildChequeStatus` ให้เช็คที่เกี่ยวข้อง (`trans.go:593`, `cheque.go:68`, `cheque.go:101`) ทะเบียนเช็คดู [[doc-cheque-register]]

## จุดตรวจสอบ/validation

- ตัวเลือกเช็คให้หยิบได้เฉพาะสถานะที่ถูกต้อง (`ChequeCandidates`, `cheque.go:218-266`, route `/cheque/candidates` ที่ `router.go:192`, จอ `frontend/account/transaction/ChequePickerModal.tsx`):

  | เอกสาร | สถานะเช็คที่หยิบได้ | เงื่อนไขเพิ่ม |
  |---|---|---|
  | 410, 413 | 0 หรือ 3 | — |
  | 411 | 1 | — |
  | 412 | 1 หรือ 2 | — |
  | 416, 418 | 0 หรือ 3 | ลูกค้าเดียวกัน |
  | 451, 452 | 0 หรือ 3 | — |
  | 453 | 2 | — |
  | 456 | 0 หรือ 3 | ผู้จำหน่ายเดียวกัน |

- โอน 422 (`trans.go:1019-1030`) ตรวจว่า:
  - ต้องระบุสมุดบัญชีโอนเข้า
  - สมุดบัญชีโอนเข้าต้องไม่ใช่บัญชีเดียวกับโอนออก
  - ค่าธรรมเนียมต้องไม่ติดลบ
- บัญชี 1122-01 "เช็ครับระหว่างเรียกเก็บ" ถูกสร้างในผังบัญชีอัตโนมัติถ้ายังไม่มี (`service.go:2244-2248`)
- `payReceiveFlags` (`trans.go:1331`) กำหนดว่าเอกสารใดมีแท็บชำระเงิน (รวม 300)

## ข้อผิดพลาดที่พบบ่อยตามโค้ด

- ชื่อเมนูกับ GL ของ 300 ไม่ตรงกัน ควรให้ลุงจืดยืนยัน:
  - เมนูชื่อ "คืน/ลด วงเงินสดย่อย" (`transMenuMap.ts:1802`)
  - แต่ GL ลง Dr เงินสดย่อย และคอมเมนต์ในโค้ดเรียก 300 ว่า "Petty cash withdraw" (`service.go:2207`)
- 453 ในสาขา else ของเช็คจ่ายเป็นโค้ดที่ไม่มีวันถูกเรียก เพราะ 452/453 ถูกจับไปก่อน (`service.go:2313-2321`)
- 463 (wallet) ลง GL แบบเดียวกับ 462 คือ Dr ลูกหนี้ / Cr ธนาคาร ขณะที่สถานะ 463→1 เหมือน 461 ขึ้นเงิน ทิศ GL จึงดูสวนกัน ควรตรวจกับลุงจืด (`service.go:2329-2345`, `cheque.go:27`)
- 416 เปลี่ยนเช็คไม่มีสาขา GL ของตัวเอง จึงใช้ default Dr ธนาคาร / Cr 1122-00 (`service.go:2304-2309`)
- 411 แก้ GL ของเอกสาร 410 อีกใบโดยตรง ถ้าประมวลผล GL ใหม่ทั้งชุดจะได้ผลตามลำดับเอกสาร ดู [[acc-gl-rebuild]]

## ที่มาในโค้ด

- `backend/internal/application/process/cheque.go:16-31`, `:68`, `:101`, `:218-266`, `:329` — สถานะ, rebuild, คู่โอน, ตัวเลือกเช็ค
- `backend/internal/application/process/cheque_forward.go:10` — เช็คยกมา 405/406
- `backend/internal/application/process/trans.go:593`, `:631`, `:1019-1030`, `:1331`, `:1543` — derived, `isChequeFlag`, ตรวจโอน, แท็บชำระเงิน, `chqListFromPaySQL`
- `backend/internal/application/process/service.go:1861-1867`, `:2064`, `:2207-2345` — tenders และ GL เงินสด/ธนาคาร/เช็ค/บัตร
- `frontend/account/tabs/transMenuMap.ts:1614-2342` — เมนูเงินสด/ธนาคาร/เช็ค
- `frontend/account/transaction/ChequePickerModal.tsx` — จอเลือกเช็ค
