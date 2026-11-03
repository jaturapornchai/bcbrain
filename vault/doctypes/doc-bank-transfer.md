---
title: "บันทึกโอนเงินระหว่างธนาคาร (Bank Transfer)"
tags: [doctypes, cash-bank]
aliases: ["trans_flag 422", "trans_flag 420", "บันทึกโอนเงินระหว่างธนาคาร", "โอนเงินออก", "โอนเงินเข้า", "TM", "menu_cash_transfer", "SyncTransferPair"]
sources: ["frontend/account/tabs/transMenuMap.ts:1917", "frontend/account/transaction/transLayouts.ts:143", "backend/internal/application/process/service.go:1797", "backend/internal/application/process/service.go:1806", "backend/internal/application/process/service.go:2232", "backend/internal/application/process/cheque.go:79", "backend/internal/application/process/cheque.go:101", "backend/internal/application/process/trans.go:395", "backend/internal/application/process/trans.go:605", "backend/internal/application/process/transcalc.go:18", "backend/internal/application/process/trans_validate.go:45", "backend/internal/application/process/doc_cancel.go:56", "backend/internal/application/process/doc_cancel.go:585"]
---

# บันทึกโอนเงินระหว่างธนาคาร (422 โอนออก / 420 โอนเข้า)

## ใช้เมื่อไร
ใช้โอนเงินระหว่างสมุดบัญชีธนาคารของกิจการเอง ผ่านเมนู "บันทึกโอนเงินระหว่างธนาคาร" (TM, transMenuMap.ts:1917) รายการค้นจาก `erp_pass_book`

## trans_flag/ตาราง
- ผู้ใช้บันทึกเป็น 422 ใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]] โดย item_code คือสมุดต้นทาง และ item_code_2 คือสมุดปลายทาง calc_flag ของบรรทัด 422 = +1 (transcalc.go:18)
- ระบบสร้างแถวคู่ 420 (โอนเงินเข้า) ด้วย doc_no เดียวกัน ผ่าน `SyncTransferPair` (cheque.go:101) ซึ่งถูกเรียกใน `rebuildTransDerived` ก่อนลง GL (trans.go:605)
- แถวคู่ 420 สลับคอลัมน์ต้นทาง/ปลายทาง (`transferPairSwaps` cheque.go:79) บวก doc_time อีก 1 นาที และบรรทัดใช้ calc_flag −1
- บรรทัด 422 ที่ transfer_amount = 0 จะถูกเติม transfer_amount = sum_amount ก่อนสร้างคู่ (cheque.go:106)

## ฟิลด์/แท็บบนหน้าจอ
- ไม่มีช่องหัวเอกสารพิเศษ มีแท็บ gl (transLayouts.ts:143)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
ไม่มี

## การลงบัญชี
ใช้ standard GL ของ 422 เมื่อรูปแบบเอกสารไม่มี template GL (`tpl.post` service.go:1585, case 422 service.go:2232) ส่วน 420 ไม่อยู่ใน `glRebuildTransFlags` (service.go:1742)

| Dr | Cr |
|---|---|
| ธนาคารปลายทาง (account_code_1 ของ item_code_2 จาก `glSQLPassBook`) ยอดรวม | ธนาคารต้นทาง (account_code_1 ของ item_code) ยอดรวม |

- ใช้ข้อมูลจากบรรทัดแรกเท่านั้น (ORDER BY line_number LIMIT 1)
- สมุดที่ไม่มี account_code_1 ใช้บัญชีธนาคารตั้งต้น = account_code_1 ของสมุดตัวแรกในบรรทัดเอกสาร ถ้าไม่มีใช้ 1112/1113/1111 (service.go:1797, :1806-1820)

## เอกสารต้นทาง-ปลายทาง
- ไม่มีเอกสารอ้างอิง (FLAG_SPEC 422 ไม่มี refDoc transLayouts.ts:143)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 423 (doc_cancel.go:56) เอกสารยกเลิกได้ GL กลับด้านของต้นฉบับ ณ วันที่เอกสารยกเลิก ส่วนต้นฉบับยังเก็บ GL เดิม (`reverseCancelledGL` doc_cancel.go:585)
- ลบ 422 แล้วระบบเรียก `SyncTransferPair` ซึ่งลบแถว 420 ที่ไม่มีคู่ด้วย (`deleteTransTx` trans.go:395, cheque.go:99)
- บันทึกต้องอยู่ในงวดบัญชีที่เปิด (`checkOpenPeriod` trans_validate.go:45)

## ข้อควรระวัง
- GL อ่านเฉพาะบรรทัดแรก ถ้าใบเดียวมีหลายบรรทัด ยอดรวมจะลงคู่สมุดของบรรทัดแรก
- ถ้าสมุดปลายทางไม่มี account_code_1 บัญชีปลายทางจะกลายเป็นบัญชีของสมุดต้นทาง (Dr/Cr บัญชีเดียวกัน)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1917` เมนู
- `frontend/account/transaction/transLayouts.ts:143` FLAG_SPEC 422
- `backend/internal/application/process/service.go:2232` GL
- `backend/internal/application/process/cheque.go:101` SyncTransferPair
- `backend/internal/application/process/doc_cancel.go:56` ยกเลิก 423

## ดูเพิ่ม
- [[doc-bank-deposit-withdraw]] · [[acc-cheque-transfer]] · [[doctypes-overview]]
