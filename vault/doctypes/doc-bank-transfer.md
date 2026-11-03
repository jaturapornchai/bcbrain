---
title: "บันทึกโอนเงินระหว่างธนาคาร (Bank Transfer)"
tags: [doctypes, cash-bank]
aliases: ["trans_flag 422", "trans_flag 420", "บันทึกโอนเงินระหว่างธนาคาร", "โอนเงินออก", "โอนเงินเข้า", "TM", "menu_cash_transfer", "SyncTransferPair"]
sources: ["frontend/account/tabs/transMenuMap.ts:1917", "frontend/account/transaction/transLayouts.ts:143", "backend/internal/application/process/service.go:2221", "backend/internal/application/process/cheque.go:79", "backend/internal/application/process/cheque.go:101", "backend/internal/application/process/trans.go:605", "backend/internal/application/process/doc_cancel.go:56"]
---

# บันทึกโอนเงินระหว่างธนาคาร (422 โอนออก / 420 โอนเข้า)

## ใช้เมื่อไร
ใช้โอนเงินระหว่างสมุดบัญชีธนาคารของกิจการเอง ผ่านเมนู "บันทึกโอนเงินระหว่างธนาคาร" (TM, transMenuMap.ts:1917)

## trans_flag/ตาราง
- ผู้ใช้บันทึกเป็น 422 ใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]] โดย item_code คือสมุดต้นทาง และ item_code_2 คือสมุดปลายทาง
- ระบบสร้างแถวคู่ 420 (โอนเงินเข้า) ด้วย doc_no เดียวกัน ผ่าน `SyncTransferPair` (cheque.go:101) ซึ่งถูกเรียกใน `rebuildTransDerived` (trans.go:605)
- แถวคู่ 420 สลับคอลัมน์ต้นทาง/ปลายทาง (`transferPairSwaps` cheque.go:79) บวก doc_time อีก 1 นาที และใช้ calc_flag −1

## ฟิลด์/แท็บบนหน้าจอ
- ไม่มีช่องหัวเอกสารพิเศษ มีแท็บ gl (transLayouts.ts:143)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ใช้ standard GL ของ 422 เท่านั้น (service.go:2221) ส่วน 420 ไม่อยู่ใน `glRebuildTransFlags`
| Dr | Cr |
|---|---|
| ธนาคารปลายทาง (บัญชีของ item_code_2 จาก `glSQLPassBook`) ยอดรวม | ธนาคารต้นทาง (บัญชีของ item_code) ยอดรวม |

ถ้าหาบัญชีของสมุดไม่เจอจะใช้ 1112/1113/1111 และใช้ข้อมูลจากบรรทัดแรกเท่านั้น

## เอกสารต้นทาง-ปลายทาง
(ไม่พบในโค้ด)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 423 (doc_cancel.go:56)
- ลบ 422 แล้วเรียก `SyncTransferPair` แถว 420 ที่ไม่มีคู่จะถูกลบด้วย (comment cheque.go:97)

## ข้อควรระวัง
- GL อ่านเฉพาะบรรทัดแรก ถ้าใบเดียวมีหลายบรรทัด ยอดรวมจะลงคู่สมุดของบรรทัดแรก

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1917` เมนู
- `frontend/account/transaction/transLayouts.ts:143` FLAG_SPEC 422
- `backend/internal/application/process/service.go:2221` GL
- `backend/internal/application/process/cheque.go:101` SyncTransferPair
- `backend/internal/application/process/doc_cancel.go:56` ยกเลิก 423

## ดูเพิ่ม
- [[doc-bank-deposit-withdraw]] · [[acc-cheque-transfer]] · [[doctypes-overview]]
