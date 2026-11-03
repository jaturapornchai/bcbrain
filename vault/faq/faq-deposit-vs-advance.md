---
title: "เงินมัดจำกับเงินล่วงหน้าต่างกันอย่างไร ลงบัญชีและตัดใช้ในใบกำกับอย่างไร"
tags: [faq, deposit, advance, gl, vat, ap, ar]
aliases: ["มัดจำ vs ล่วงหน้า", "ตัดเงินมัดจำ", "deposit advance", "advance_amount", "trans_flag 110", "trans_flag 11", "trans_flag 40", "trans_flag 10", "cb_trans_detail doc_type 6", "214220"]
sources: ["backend/internal/application/process/trans_deposit.go:38", "backend/internal/application/process/trans_deposit.go:48", "backend/internal/application/process/trans_deposit.go:65", "backend/internal/application/process/trans_deposit.go:73", "backend/internal/application/process/service.go:1828", "backend/internal/application/process/service.go:2185", "backend/internal/application/process/trans_validate.go:258"]
---
# เงินมัดจำกับเงินล่วงหน้าต่างกันอย่างไร ลงบัญชีและตัดใช้ในใบกำกับอย่างไร

**ตอบสั้น:** มัดจำ (11 จ่าย / 110 รับ) มี VAT บัญชีมัดจำรับเฉพาะยอดก่อน VAT ส่วนล่วงหน้า (10 จ่าย / 40 รับ) ไม่แยก VAT ลงเต็มยอด ในโค้ดตอนนี้ แท็บ "ใช้เงินมัดจำ" ของใบกำกับตัดได้เฉพาะกลุ่มมัดจำ ยอดคงเหลือคำนวณใหม่ทุกครั้ง ไม่ได้เก็บไว้

## รายละเอียด
ดู [[acc-deposit-advance]] และ [[term-deposit-advance]]

**4 กลุ่ม (`trans_deposit.go:38-43`)**

| กลุ่ม | เอกสาร (รวมยกมา) | รับคืน | doc_type การใช้ | บัญชีตั้งต้น |
|---|---|---|---|---|
| ล่วงหน้าซื้อ | 10 / 9010 | 20 | 5 | 115710 |
| มัดจำซื้อ | 11 / 9011 | 25 | 6 | 153010 |
| ล่วงหน้าขาย | 40 / 9040 | 42 | 5 | 214100 |
| มัดจำขาย | 110 / 9110 | 112 | 6 | 214220 |

**GL ของเอกสารมัดจำ/ล่วงหน้า (case 10, 11, 20, 25, 40, 42, 110, 112)** ใช้คู่กับช่องทางเงินในแท็บชำระ ([[faq-payment-tab-tenders]])
- 110 รับมัดจำขาย: Dr ช่องทางรับเงิน / Cr 214220 (ก่อน VAT) + Cr ภาษีขาย
- 40 รับล่วงหน้าขาย: Dr ช่องทางรับเงิน / Cr 214100 เต็มยอด
- 11 จ่ายมัดจำซื้อ: Dr 153010 (ก่อน VAT) + Dr ภาษีซื้อ / Cr ช่องทางจ่ายเงิน
- 10 จ่ายล่วงหน้าซื้อ: Dr 115710 เต็มยอด / Cr ช่องทางจ่ายเงิน
- รับคืน 20/25 เป็นเงินเข้า, 42/112 เป็นเงินออก กลับข้างจากเอกสารต้นทาง

**ตัดใช้ในใบกำกับ**
- ใบซื้อ 12/315/87/260 ตัดกลุ่มมัดจำซื้อ, ใบขาย 44/99/250 ตัดกลุ่มมัดจำขาย (144 ไม่นับ)
- แถวที่ตัดเก็บใน `cb_trans_detail` doc_type 6, `trans_number` = เลขเอกสารมัดจำ ([[tbl-cb-trans-detail]])
- `advance_amount` = ผลรวมแถว ถ้าใบกำกับเป็น vat_type 0 จะถอด VAT (× 100 / (100 + อัตรา)) ปัด HALF_UP 2
- GL ใบขาย: Dr มัดจำขาย (ยอดก่อน VAT) และบวกยอดนี้เข้า Cr ขาย ([[faq-sale-invoice-gl-posting]])
- GL ใบซื้อ: Dr ซื้อ = ฐาน + มัดจำ / Cr มัดจำซื้อ ([[faq-purchase-invoice-gl-posting]])

**ยอดคงเหลือ (`depositBalanceSQL`)** = ยอดเอกสาร − รับคืนที่ยังไม่ยกเลิก (อ้าง `doc_ref`) − แถวที่ตัดใช้ที่ยังไม่ยกเลิก (ไม่รวม 144 และเอกสารที่กำลังแก้)

**ข้อความปฏิเสธ**
- "ยอดตัดเงินมัดจำต้องมากกว่า 0", "เลือกเอกสารเงินมัดจำ X ซ้ำ"
- "ยอดตัดจ่ายมากกว่ายอดคงเหลือ: เอกสาร X เกินอยู่ Y"
- "ยอดมัดจำมากกว่ามูลค่าสุทธิ" (`checkAdvance`)
- ลบเอกสารมัดจำที่ถูกใช้/รับคืนแล้วไม่ได้ (`refuseUsedDepositDelete`)

## ข้อควรระวัง
- ไม่พบเส้นทางในโค้ดที่ตัดเงินล่วงหน้า (doc_type 5) ผ่านแท็บใบกำกับ การใช้เงินล่วงหน้าในเอกสารอื่น ไม่ชัดจากโค้ด
- การตรวจวงเงินเครดิตนับทั้งมัดจำขาย 110/9110 และล่วงหน้าขาย 40/9040 (`trans_save_rules.go:614-619`) ([[faq-credit-limit-approval]])
- รหัสบัญชีตั้งต้นส่งเข้า `resolveChartAccount` ถ้าไม่มีในผัง ระบบคืนรหัสนั้นตรงๆ ไม่ได้ลงบัญชีพัก
- ฝั่ง GL แปลงยอดเป็นก่อน VAT เมื่อ vat_type = 1 (`service.go:1836`) ส่วนตอนบันทึกถอด VAT เมื่อ vat_type = 0 จึงต้องดูคู่กัน

## ดูเพิ่ม
- [[acc-deposit-advance]]
- [[doc-sale-deposit-receipt]]
- [[doc-purchase-deposit-payment]]
- [[doc-sale-advance-receipt]]
- [[faq-payment-tab-tenders]]

## ที่มาในโค้ด
- `backend/internal/application/process/trans_deposit.go:38` 4 กลุ่ม; `:48` `depositKinds`; `:58` `depositUseFlag`
- `backend/internal/application/process/trans_deposit.go:65` `depositBalanceSQL`; `:73` `depositAdvance`
- `backend/internal/application/process/trans_deposit.go:98` `depositStmts`; `:145` `checkDepositUse`; `:203` `OpenDeposits`; `:246` `refuseUsedDepositDelete`
- `backend/internal/application/process/trans_validate.go:258` `checkAdvance`
- `backend/internal/application/process/service.go:1828` `advEx` มัดจำที่ใช้ (ก่อน VAT)
- `backend/internal/application/process/service.go:1965` ใบซื้อ Cr มัดจำ; `:2042` ใบขาย Dr มัดจำ
- `backend/internal/application/process/service.go:2185` GL เอกสารมัดจำ/ล่วงหน้า
