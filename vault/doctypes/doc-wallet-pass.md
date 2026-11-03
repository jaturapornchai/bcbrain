---
title: "บันทึกขึ้นเงิน wallet (Wallet Pass)"
tags: [doctypes, cash-bank]
aliases: ["trans_flag 463", "บันทึกขึ้นเงินwallet", "WLD", "menu_cb_wallet_pass"]
sources: ["frontend/account/tabs/transMenuMap.ts:1960", "frontend/account/transaction/transLayouts.ts:150", "backend/internal/application/process/service.go:2329", "backend/internal/application/process/cheque.go:27", "backend/internal/application/process/cheque.go:259", "backend/internal/application/process/trans.go:1437", "backend/internal/application/process/trans.go:1543"]
---

# บันทึกขึ้นเงิน wallet (trans_flag 463)

## ใช้เมื่อไร
ใช้นำยอดรับผ่าน wallet เข้าธนาคาร ผ่านเมนู "บันทึกขึ้นเงินwallet" (WLD, transMenuMap.ts:1960)

## trans_flag/ตาราง
- เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]
- แท็บชำระเก็บ wallet เป็น doc_type 21 (trans.go:1437)

## ฟิลด์/แท็บบนหน้าจอ
- passBook แท็บ gl (transLayouts.ts:150)
- เลือกได้เฉพาะแถว [[tbl-cb-chq-list]] chq_type 21 ที่สถานะ 0 (`chequeCandidateWhere` cheque.go:259)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ใช้ standard GL case 461/462/463 (service.go:2329) โดย 463 เข้า else-branch เดียวกับ 462
| Dr | Cr |
|---|---|
| ลูกหนี้ ยอดรวม | ธนาคาร ยอดรวม |

## เอกสารต้นทาง-ปลายทาง
- สถานะ chq_type 21: 463→1 (cheque.go:27)

## ยกเลิก/แก้ไข
- ไม่มีคู่ยกเลิกใน `cancelOrigFlags` (doc_cancel.go:49)

## ข้อควรระวัง
- 463 คือการขึ้นเงิน แต่ GL ลง Dr ลูกหนี้ / Cr ธนาคาร เหมือนการยกเลิกบัตร 462 ซึ่งกลับข้างกับ 461
- `chqListFromPaySQL` (trans.go:1543) สร้าง cb_chq_list เฉพาะ doc_type 2/3 เป็น chq_type 1/2/3 และไม่พบโค้ดที่สร้างแถว chq_type 21 ทำให้รายการที่เลือกได้ของ 463 อาจว่าง

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1960` เมนู
- `frontend/account/transaction/transLayouts.ts:150` FLAG_SPEC 463
- `backend/internal/application/process/service.go:2329` GL
- `backend/internal/application/process/cheque.go:259` candidates

## ดูเพิ่ม
- [[doc-credit-card]] · [[doc-cheque-register]] · [[doctypes-overview]]
