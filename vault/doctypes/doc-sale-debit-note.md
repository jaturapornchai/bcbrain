---
title: "เพิ่มหนี้ขาย/ราคาผิด (Sales Debit Note)"
tags: [doctypes, sale]
aliases: ["trans_flag 46", "trans_flag 50", "เพิ่มหนี้ขาย", "ใบเพิ่มหนี้ลูกหนี้", "SA"]
sources: ["frontend/account/tabs/transMenuMap.ts:890", "frontend/account/transaction/transLayouts.ts:90", "frontend/account/transaction/transLayouts.ts:41", "backend/internal/application/process/transcalc.go:21", "backend/internal/application/process/stock_rebuild.go:20", "backend/internal/application/process/trans_tax.go:40", "backend/internal/application/process/service.go:1744", "backend/internal/application/process/service.go:2009", "backend/internal/application/process/service.go:2047", "backend/internal/application/process/trans_save_rules.go:55", "backend/internal/application/process/docs.go:600", "backend/internal/application/process/docs.go:528", "backend/internal/application/process/report.go:949", "backend/internal/application/process/doc_cancel.go:52"]
---

# เพิ่มหนี้ขาย/ราคาผิด (trans_flag 46, 50)

## ใช้เมื่อไร
ใช้เพิ่มหนี้ลูกค้าจากการขาย หรือแก้ราคาผิด อ้างใบขาย 44 อยู่ที่เมนู "เพิ่มหนี้ขาย/ราคาผิด" (SA, transMenuMap.ts:890 เมนูใส่ transFlags 46/50)

## trans_flag/ตาราง
- 46 มี calc_flag −1 (transcalc.go:21) เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]
- 50 อยู่ในเมนูเดียวกันและอยู่ใน `glRebuildTransFlags` (service.go:1744) รายงานแสดง 46 และ 50 ด้วยชื่อเดียวกัน "46-เพิ่มหนี้ลูกหนี้" (report.go:949-950) — 50 ไม่มี calc_flag, ไม่อยู่ในแท็บภาษีและไม่นับเป็นหนี้ใน `arDebtWhere`

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, taxDoc, refDoc, sale, inquiry, vat, docReason แท็บ vat, gl ไม่มีแท็บชำระ (transLayouts.ts:90)
- ประเภทการเพิ่มหนี้ (`SALE_ADD_DEBT_TYPE` transLayouts.ts:41):
  - 0 เพิ่มหนี้จากการขายเงินเชื่อ
  - 1 เพิ่มหนี้จากการขายเงินเชื่อ (ไม่กระทบสต๊อก)
  - 2 เพิ่มหนี้จากการขายสินค้าเงินเชื่อ (สินค้าบริการ)

## ผลต่อสต็อก
- ตัดออก (calc_flag −1) เฉพาะ inquiry 0 (`stockRowsSQL` ตัด 46 ที่ inquiry ≠ 0 stock_rebuild.go:20)
- อยู่ใน `stockCheckFlags` ตรวจยอดคงเหลือตอนบันทึก (trans_save_rules.go:55)

## ผลต่อภาษี (VAT/WHT)
- ภาษีขาย vat_calc 1 (`transVatTabs` trans_tax.go:40)
- ไม่มี WHT (ไม่อยู่ใน `transWhtParty` trans_tax.go:48)

## การลงบัญชี
standard GL กลุ่มเดียวกับขาย `case 44, 46, 50, 144, 250, 254` (service.go:2009) — `base` = ยอดรวม − VAT (service.go:1790)
| Dr | Cr | จำนวน |
|---|---|---|
| inquiry 0/2: ลูกหนี้ 1121 (สำรอง 1131, 1130, 1120) | | ยอดรวม |
| inquiry 1: เงินตาม `payTenders(true)` (ไม่มี cb_trans จึงเป็นเงินสด 1111) — service.go:2047 | | ยอดรวม |
| | ขาย 4111 (สำรอง 4110, 4100) | `base` |
| | ภาษีขาย 2134 (สำรอง 2121, 2135, 2190) | VAT |
- 46 ไม่อยู่ใน `depositKinds` จึงไม่มีบรรทัดเงินมัดจำ บัญชีสำรองดู service.go:1796-1803

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ขาย 44 (`refTransFlags` transMenuMap.ts:890)
- นับเป็นหนี้ลูกหนี้ทุกใบ 46 (`arDebtWhere` docs.go:600) ซึ่งเป็นรายการบิลของใบวางบิล 235 และรับชำระ 239 (`billSides` docs.go:528)

## ยกเลิก/แก้ไข
- ยกเลิก 46 ด้วย flag 47 (doc_cancel.go:52) ส่วน 50 ไม่มีคู่ยกเลิกใน `cancelOrigFlags`

## ข้อควรระวัง
- inquiry 1 (เชื่อ ไม่กระทบสต็อก) เข้าเงื่อนไข `inquiryType == 1` ที่ service.go:2047 จึงไปใช้ payTenders (ไม่มีแท็บชำระ จึงเป็นเงินสด) แทน Dr ลูกหนี้ ขณะที่ `arDebtWhere` นับใบ 46 ทุกใบเป็นหนี้ ผลสองทางนี้ไม่ตรงกัน (เป็นข้อสังเกตจากโค้ด ยังไม่ได้ยืนยันว่าตั้งใจ)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:890` เมนู
- `frontend/account/transaction/transLayouts.ts:90` FLAG_SPEC 46 / `:41` SALE_ADD_DEBT_TYPE
- `backend/internal/application/process/stock_rebuild.go:20` stockRowsSQL
- `backend/internal/application/process/service.go:2009` / `:2047` GL
- `backend/internal/application/process/docs.go:600` arDebtWhere
- `backend/internal/application/process/doc_cancel.go:52` ยกเลิก 47

## ดูเพิ่ม
- [[doc-sale-invoice]] · [[doc-sale-return]] · [[acc-payment-tab]] · [[doctypes-overview]]
