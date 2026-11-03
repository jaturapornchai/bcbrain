---
title: "เพิ่มหนี้ขาย/ราคาผิด (Sales Debit Note)"
tags: [doctypes, sale]
aliases: ["trans_flag 46", "trans_flag 50", "เพิ่มหนี้ขาย", "ใบเพิ่มหนี้ลูกหนี้", "SA"]
sources: ["frontend/account/tabs/transMenuMap.ts:890", "frontend/account/transaction/transLayouts.ts:90", "frontend/account/transaction/transLayouts.ts:41", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/trans_tax.go:37", "backend/internal/application/process/service.go:1731", "backend/internal/application/process/service.go:1998", "backend/internal/application/process/service.go:2036", "backend/internal/application/process/trans_save_rules.go:55", "backend/internal/application/process/docs.go:597", "backend/internal/application/process/doc_cancel.go:52"]
---

# เพิ่มหนี้ขาย/ราคาผิด (trans_flag 46, 50)

## ใช้เมื่อไร
ใช้เพิ่มหนี้ลูกค้าจากการขาย หรือแก้ราคาผิด อ้างใบขาย 44 อยู่ที่เมนู "เพิ่มหนี้ขาย/ราคาผิด" (SA, transMenuMap.ts:890 เมนูใส่ transFlags 46/50)

## trans_flag/ตาราง
- 46 มี calc_flag −1 (transcalc.go:14) เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]
- 50 อยู่ในเมนูเดียวกันและอยู่ใน `glRebuildTransFlags` (service.go:1731) ส่วนคำอธิบายของ flag 50: (ไม่พบในโค้ดที่อ่าน)

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, taxDoc, refDoc, sale, inquiry, vat, docReason แท็บ vat, gl ไม่มีแท็บชำระ (transLayouts.ts:90)
- ประเภทการเพิ่มหนี้ (`SALE_ADD_DEBT_TYPE` transLayouts.ts:41):
  - 0 เพิ่มหนี้จากการขายเงินเชื่อ
  - 1 เพิ่มหนี้จากการขายเงินเชื่อ (ไม่กระทบสต๊อก)
  - 2 เพิ่มหนี้จากการขายสินค้าเงินเชื่อ (สินค้าบริการ)

## ผลต่อสต็อก
- ตัดออก (−1) เฉพาะ inquiry 0 (`stockRowsSQL` ตัด 46 ที่ inquiry ≠ 0 stock_rebuild.go:18)
- อยู่ใน `stockCheckFlags` (trans_save_rules.go:55)

## ผลต่อภาษี (VAT/WHT)
- ภาษีขาย (trans_tax.go:37)
- ไม่มี WHT

## การลงบัญชี
ใช้ standard GL กลุ่มเดียวกับขาย 44 (service.go:1998)
| Dr | Cr |
|---|---|
| ลูกหนี้ ยอดรวม | ขาย (ฐาน) + ภาษีขาย |

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ขาย 44 (transMenuMap.ts:890)
- นับเป็นหนี้ลูกหนี้ทุกใบ (`arDebtWhere` docs.go:597) แล้วไปตัดที่ใบวางบิล 235 และรับชำระ 239

## ยกเลิก/แก้ไข
- ยกเลิก 46 ด้วย flag 47 (doc_cancel.go:52) ส่วน 50 ไม่มีคู่ยกเลิก (ไม่พบในโค้ด)

## ข้อควรระวัง
- inquiry 1 (เชื่อ ไม่กระทบสต็อก) เข้าเงื่อนไข `inquiryType == 1` ที่ service.go:2036 จึงไปใช้ payTenders (ไม่มีแท็บชำระ จึงใช้เงินสดเป็นค่าเริ่มต้น) แทน Dr ลูกหนี้ ขณะที่ `arDebtWhere` นับใบ 46 ทุกใบเป็นหนี้ ผลสองทางนี้ไม่ตรงกัน (เป็นข้อสังเกตจากโค้ด ยังไม่ได้ยืนยันว่าตั้งใจ)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:890` เมนู
- `frontend/account/transaction/transLayouts.ts:90` FLAG_SPEC 46 / `:41` SALE_ADD_DEBT_TYPE
- `backend/internal/application/process/stock_rebuild.go:18` stockRowsSQL
- `backend/internal/application/process/service.go:1998` / `:2036` GL
- `backend/internal/application/process/docs.go:597` arDebtWhere
- `backend/internal/application/process/doc_cancel.go:52` ยกเลิก 47

## ดูเพิ่ม
- [[doc-sale-invoice]] · [[doc-sale-return]] · [[acc-payment-tab]] · [[doctypes-overview]]
