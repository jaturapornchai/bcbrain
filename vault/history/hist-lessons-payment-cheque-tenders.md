---
title: "บทเรียนบั๊กการชำระเงิน เช็ค และช่องทางรับจ่าย (Payment, Cheque & Tender Bugs)"
tags: [history, payment, cheque, cash]
aliases: ["payCompleteCheck", "tender", "สถานะเช็ค", "จ่ายเกินบิล"]
sources: ["git:acba317c", "git:d1ebfe18", "git:815e62ce", "git:a133ded8", "git:13f953cc", "backend/internal/application/process/pay_check.go:57"]
---

## ภาพรวม
แท็บรับ/จ่ายชำระมีหลายช่องทาง (เงินสด โอน เช็ค บัตร PromptPay ภาษีถูกหัก รายได้/ค่าใช้จ่ายอื่น เงินทอน) ที่ต้องรวมเท่ายอดเอกสารและลงบัญชีตรงกัน ปัญหา 2026-10-21 .. 2026-10-29 คือยอดไม่ตรง C#, สถานะเช็คเพี้ยน, จ่ายเกินยอดค้างได้ ดู [[acc-payment-tab]]

## อาการ
- **P1 รับ/จ่ายชำระและเช็ค (acba317c):** commit ระบุชุดตรวจ EVT-APAR-CB-01..12 และ LOGIC-CB-APAR (ไม่ได้ตรวจทุกรายการ)
- **P2 คำนวณเงินสด (d1ebfe18):** ตามชื่อ commit: คำนวณเงินสดและตรวจครบยอดให้ตรง `_payControl`
- **P3 รายได้/ค่าใช้จ่ายอื่นและเงินทอน (815e62ce, 5cf0300d):** รหัสรายได้/ค่าใช้จ่ายอื่นค้นแบบไม่สนตัวพิมพ์ ไม่ตรงโค้ดฝั่ง backend (PAY-MIN-6)
- **P4 ข้อความปฏิเสธ (ac839a65):** ยอดในข้อความ "ยอดการจ่ายเงินไม่สมบูรณ์" ไม่มีจุลภาค
- **P5 หลายแถว (a133ded8):** ตามชื่อ commit: รองรับโอน/PromptPay/เช็ค/บัตรหลายแถวและเงินสดเหลืออัตโนมัติทุกหน้าจอชำระ
- **P6 UAT S1 (13f953cc):** จ่ายชำระที่มีภาษีหัก GL ลงเงินสดเต็มยอด ไม่ลงเช็คจ่าย (2112-00) (#6); จ่ายซ้ำบิลยอดค้าง 0 ระบบรับและยอดติดลบ (#7)

## สาเหตุ (root cause)
- **P1:** C# คิดสถานะเช็คจากแถวเอกสารล่าสุดของเช็คนั้น (คอมเมนต์ `cheque.go`); ยอดค้างบิลต้องไม่เชื่อค่าจากจอ (คอมเมนต์ `pay_check.go:167`)
- **P2:** C# ปัดแต่ละช่องที่ `item_amount_decimal` ก่อนเทียบยอด (คอมเมนต์ `pay_check.go:140`)
- **P3:** จอค้นรหัสไม่ตรงลำดับกับ `pay_other.go` (ข้อความ 5cf0300d)
- **P4:** ข้อความใช้ `FormatRat` ซึ่งไม่มีจุลภาค ตัวช่วยจัดรูปแบบเดิมทำศูนย์เป็นว่าง จึงต้องเก็บ 0.00 ไว้
- **P5:** ตามชื่อ commit; โครงสร้างเดิมยังไม่ได้ตรวจ
- **P6:** บิลยอดค้าง 0 ถูกข้ามการตรวจเพราะ `payExceedsBalance` คืน false เมื่อยอดค้างเป็นศูนย์ (diff 13f953cc)

## วิธีแก้
- **P1:** `RebuildChequeStatus` คำนวณสถานะ `cb_chq_list` ใหม่ในธุรกรรมเดียวกัน (idempotent); `billSaveCheck` คำนวณยอดค้างใหม่จากหนี้และการชำระที่เก็บจริง
- **P2:** `payCompleteCheck` รวมช่องทาง + ภาษีถูกหัก + รายได้อื่น เท่ากับยอดสุทธิ + ค่าใช้จ่ายอื่น โดย `payTenders` ปัดที่ `amountDec` เดียวกับที่เก็บ
- **P3:** `parsePayOther` ค้นตรงตัวพิมพ์ก่อน; จอปรับให้ตรง
- **P4:** ฟังก์ชัน `amt` ในข้อความใส่จุลภาค คง 0.00 (เทส `pay_check_test.go`)
- **P5:** `PayTransferRow` (doc_type 1), `PayPromptPayRow` (21), `PayChequeRow` (2), `PayCardRow` (3) + เงินสดเหลืออัตโนมัติ; ยอดรวมเก็บใน `cb_trans`
- **P6:** `payTenders` ใน `buildStandardGLLines` แยกเช็ค/ภาษีถูกหัก; `payExceedsBalance` คืน `pay != 0` เมื่อยอดค้างเป็นศูนย์

## commit ที่เกี่ยวข้อง
- `acba317c` — รับ/จ่ายชำระ + สถานะเช็ค
- `d1ebfe18` — เงินสด + `payCompleteCheck`
- `815e62ce`, `5cf0300d` — รายได้/ค่าใช้จ่ายอื่น, เงินทอน, รหัสตรงตัวพิมพ์
- `ac839a65` — ข้อความปฏิเสธมีจุลภาค
- `a133ded8` — หลายแถวต่อช่องทาง
- `13f953cc` — GL ภาษีหัก/เช็คจ่าย, จ่ายเกิน
- `7ff7d659`, `b002e065`, `1d99124d` — วันครบกำหนดจ่ายบิลล็อก, พักเครดิต 34/36, สรุปการชำระอ่านอย่างเดียว (ตามข้อความ commit; ไม่ได้ตรวจ diff)

## โค้ดปัจจุบันที่ป้องกัน
- `backend/internal/application/process/pay_check.go:36` `payTabEnabled`; `:57` `payCompleteCheck`; `:110` `payTenders`; `:142` `checkPayTotal`; `:168` `billSaveCheck`; `:263` `payExceedsBalance`
- เทส `pay_check_test.go:26`, `:59`; `pay_other_test.go:62`, `:78`
- `backend/internal/application/process/pay_other.go:60` `parsePayOther`
- `backend/internal/application/process/trans.go:1268` `PayTransferRow`, `:1311` `TransPay`, `:1338` `payStmts`
- `backend/internal/application/process/cheque.go:68` `RebuildChequeStatus`

## บทเรียน / กฎที่ได้
- สถานะที่คำนวณจากเอกสารได้ (เช็ค) ต้องเป็นผล rebuild ไม่ใช่ค่าที่เก็บแยก (AGENTS.md ข้อ 9)
- ยอดค้างบิลคำนวณใหม่ใน backend ห้ามเชื่อค่าจากจอ และทุกขอบเขตต้องมีเทส รวมกรณียอดค้าง 0
- ช่องทางที่ลงบัญชีต่างกัน (เช็ค ภาษีถูกหัก) ต้องแยกบรรทัด GL
- ผลรวมช่องทางปัดที่ทศนิยมเดียวกับที่เก็บ (ดู [[hist-lessons-rounding-decimal]])

## ดูเพิ่ม
[[acc-payment-tab]] · [[acc-cheque-transfer]] · [[hist-lessons-gl-posting-balance]] · [[hist-lessons-rounding-decimal]] · [[history-overview]]

## ที่มาในโค้ด
- git: `acba317c`, `d1ebfe18`, `815e62ce`, `5cf0300d`, `ac839a65`, `a133ded8`, `13f953cc`, `7ff7d659`, `b002e065`, `1d99124d`
- `docs/kms/KMS_SECURITY_DATA_INTEGRITY_LESSONS.md` (หลายแถวต่อช่องทาง), `tests/uat/out/20261028/summary.md` (#6, #7)
