---
title: "เงินมัดจำและเงินล่วงหน้า (Deposits & Advances)"
tags: [accounting, deposit, advance, vat, gl]
aliases: ["เงินมัดจำ", "เงินล่วงหน้า", "ใช้เงินมัดจำ", "ตัดมัดจำ", "รับคืนเงินมัดจำ", "advance_amount", "ยอดตัดจ่ายมากกว่ายอดคงเหลือ", "115710", "214220"]
sources: ["backend/internal/application/process/trans_deposit.go:29", "backend/internal/application/process/trans_deposit.go:38", "backend/internal/application/process/trans_deposit.go:48", "backend/internal/application/process/trans_deposit.go:58", "backend/internal/application/process/trans_deposit.go:65", "backend/internal/application/process/trans_deposit.go:73", "backend/internal/application/process/trans_deposit.go:98", "backend/internal/application/process/trans_deposit.go:145", "backend/internal/application/process/trans_deposit.go:203", "backend/internal/application/process/trans_deposit.go:246", "backend/internal/application/process/service.go:1828", "backend/internal/application/process/service.go:2185", "backend/internal/application/process/trans_validate.go:258"]
---

# เงินมัดจำและเงินล่วงหน้า

เอกสารมัดจำ/ล่วงหน้าแบ่ง 4 กลุ่ม แต่ละกลุ่มมีเอกสารรับ/จ่าย เอกสารคืน และบัญชี GL ค่าเริ่มต้น ใบกำกับที่ "ใช้เงินมัดจำ" เก็บแถวตัดมัดจำใน `cb_trans_detail` และยอดรวมไว้ที่ `ic_trans.advance_amount` ยอดคงเหลือของมัดจำคำนวณสดจากเอกสารดิบทุกครั้ง

## ทำงานอย่างไร

### กลุ่ม (`depositKind` trans_deposit.go:38)
| กลุ่ม | flag (รวมยกมา) | เอกสารคืน | doc_type ที่ใช้ | บัญชีค่าเริ่มต้น |
|---|---|---|---|---|
| จ่ายเงินล่วงหน้า (ซื้อ) | 10, 9010 | 20 | 5 | 115710 |
| จ่ายเงินมัดจำ (ซื้อ) | 11, 9011 | 25 | 6 | 153010 |
| รับเงินล่วงหน้า (ขาย) | 40, 9040 | 42 | 5 | 214100 |
| รับเงินมัดจำ (ขาย) | 110, 9110 | 112 | 6 | 214220 |

- ใบที่มีแท็บใช้มัดจำ (`depositKinds` :48): 12, 315, 87, 260 ใช้กลุ่มมัดจำซื้อ; 44, 99, 250 ใช้กลุ่มมัดจำขาย; 144 ไม่อยู่ในรายการ (comment: C# ไม่นับ)
- บัญชีหาผ่าน `resolveChartAccount` (service.go:1830) ไม่มีในผังบัญชีจะไปบัญชีพัก

### ยอดคงเหลือ (`depositBalanceSQL` :65)
- = `total_amount` ของมัดจำ - ผลรวมเอกสารคืนที่ `doc_ref` = เลขมัดจำ (active) - ผลรวมแถวใช้ใน `cb_trans_detail` (`trans_number` = เลขมัดจำ, doc_type ของกลุ่ม, ไม่รวม 144, active) โดยไม่นับเอกสารปัจจุบัน
- `OpenDeposits` (:203) แสดงมัดจำที่ยังเหลือของคู่ค้า ต้องระบุรหัสลูกหนี้/เจ้าหนี้

### ตัดมัดจำในใบกำกับ (`depositAdvance` :73, `depositStmts` :98)
- ทุกแถวต้อง > 0 "ยอดตัดเงินมัดจำต้องมากกว่า 0"; เลือกเลขเดียวกันซ้ำไม่ได้
- `advance_amount` = ผลรวมแถว ถ้าภาษีแยกนอก (vat_type 0) ถอด VAT ด้วย x100/(100+rate) แล้วปัด HALF_UP 2
- หลังเขียนแถว `checkDepositUse` (:145) lock มัดจำที่ใช้ แล้วปฏิเสธเมื่อไม่พบ/ถูกยกเลิก หรือยอดคงเหลือ < 0 "ยอดตัดจ่ายมากกว่ายอดคงเหลือ: เอกสาร ... เกินอยู่ ..."
- มัดจำที่ตัดต้องไม่เกินมูลค่าสุทธิ "ยอดมัดจำมากกว่ามูลค่าสุทธิ" (trans_validate.go:258) และ vatCalc หักมัดจำออกจากฐาน ดู [[acc-transcalc-totals]]
- ลบมัดจำที่ถูกใช้หรือมีเอกสารคืนอ้างถึงไม่ได้ (`refuseUsedDepositDelete` :246)

### GL (service.go:2185)
| flag | Dr | Cr |
|---|---|---|
| 10 จ่ายล่วงหน้า | 115710 (ยอดรวม) | เงินที่จ่าย |
| 20 รับคืนล่วงหน้า | เงินที่รับ | 115710 |
| 11 จ่ายมัดจำ | 153010 (ฐานไม่รวม VAT) + ภาษีซื้อ | เงินที่จ่าย |
| 25 รับคืนมัดจำ | เงินที่รับ | 153010 + ภาษีซื้อ |
| 40 รับล่วงหน้า | เงินที่รับ | 214100 |
| 42 คืนล่วงหน้า | 214100 | เงินที่จ่าย |
| 110 รับมัดจำ | เงินที่รับ | 214220 + ภาษีขาย |
| 112 คืนมัดจำ | 214220 + ภาษีขาย | เงินที่จ่าย |

- ในใบกำกับที่ตัดมัดจำ: ยอดมัดจำที่ใช้แบบไม่รวม VAT (`advEx` service.go:1828; รวมใน vat_type 1 ถอด x100/(100+rate) ปัด 2) ลงฝั่งตรงข้ามคู่ค้าด้วยบัญชีมัดจำ
- ใบที่ยอด 0 เพราะตัดมัดจำเต็มจำนวนยังลง GL ได้ ดู [[acc-gl-rebuild]]

## จุดเสี่ยง
- ใบกำกับซื้อ/ขายใช้ได้เฉพาะกลุ่ม "มัดจำ" (doc_type 6) ตาม `depositKinds` กลุ่ม "ล่วงหน้า" 10/40 จึงไม่มีใบกำกับที่ตัดยอด มีแต่เอกสารคืน 20/42 (เจตนาธุรกิจยังไม่ยืนยัน)
- บัญชีค่าเริ่มต้นเป็นรหัส hardcode ตาม C# json ไม่ได้อ่านจากรูปแบบเอกสาร (เมื่อใช้ standard GL)
- ยอดตัดมัดจำปัด 2 ตำแหน่งตายตัว

## ที่มาในโค้ด
- `backend/internal/application/process/trans_deposit.go:38` กลุ่มมัดจำ
- `backend/internal/application/process/trans_deposit.go:48` depositKinds
- `backend/internal/application/process/trans_deposit.go:65` depositBalanceSQL
- `backend/internal/application/process/trans_deposit.go:73` depositAdvance
- `backend/internal/application/process/trans_deposit.go:145` checkDepositUse
- `backend/internal/application/process/trans_deposit.go:246` refuseUsedDepositDelete
- `backend/internal/application/process/service.go:1828` advEx
- `backend/internal/application/process/service.go:2185` GL มัดจำ

## ดูเพิ่ม
- [[acc-payment-tab]]
- [[acc-gl-posting-standard]]
- [[acc-transcalc-totals]]
- [[acc-vat-register-wht]]
