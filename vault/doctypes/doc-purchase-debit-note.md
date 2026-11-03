---
title: "เพิ่มหนี้ซื้อ/ราคาผิด (Purchase Debit Note)"
tags: [doctypes, purchase]
aliases: ["trans_flag 14", "เพิ่มหนี้ซื้อ", "ใบเพิ่มหนี้เจ้าหนี้", "PA"]
sources: ["frontend/account/tabs/transMenuMap.ts:479", "frontend/account/transaction/transLayouts.ts:83", "frontend/account/transaction/transLayouts.ts:39", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/stock_rebuild.go:26", "backend/internal/application/process/trans_tax.go:37", "backend/internal/application/process/service.go:1965", "backend/internal/application/process/docs.go:597", "backend/internal/application/process/doc_cancel.go:50"]
---

# เพิ่มหนี้ซื้อ/ราคาผิด (trans_flag 14)

## ใช้เมื่อไร
ใช้เพิ่มหนี้ให้ผู้ขาย โดยรับสินค้าเพิ่มหรือแก้ราคาผิด อ้างใบซื้อ 12 อยู่ที่เมนู "เพิ่มหนี้ซื้อ/ราคาผิด" (PA, transMenuMap.ts:479)

## trans_flag/ตาราง
- trans_flag 14, calc_flag +1 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, taxDoc, refDoc, inquiry, vat, wh, docReason, refAmounts แท็บ vat, gl ไม่มีแท็บชำระ (transLayouts.ts:83)
- ประเภท (`ADD_DEBT_TYPE` transLayouts.ts:39): 0 เพิ่มหนี้เจ้าหนี้, เพิ่มสินค้า; 1 เพิ่มหนี้เจ้าหนี้, ราคาผิด (ไม่มีผลกับสต๊อกสินค้า)

## ผลต่อสต็อก
- รับเข้า (+1) (stock_rebuild.go:18)
- inquiry 1/3 เปลี่ยนแต่มูลค่า ไม่เปลี่ยนจำนวน (`stockValueOnlySQL` stock_rebuild.go:26)

## ผลต่อภาษี (VAT/WHT)
- ภาษีซื้อ (trans_tax.go:37)
- ไม่มี WHT (ไม่อยู่ใน `transWhtParty` trans_tax.go:48)

## การลงบัญชี
ใช้ standard GL (service.go:1965)
| Dr | Cr |
|---|---|
| ซื้อ (ฐาน) + ภาษีซื้อ | เจ้าหนี้ ยอดรวม |

flag 14 ไม่ใช้เงินจากแท็บชำระเลย แม้ inquiry จะเป็น 1/3 (เงื่อนไข "flag ไม่ใช่ 14/316" ที่ service.go:1965)

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ใบซื้อ 12
- นับเป็นหนี้เจ้าหนี้ทุกใบ (`apDebtWhere` docs.go:597) แล้วไปตัดหนี้ที่ใบรับวางบิล 213 และจ่ายชำระ 19

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 15 (doc_cancel.go:50)

## ข้อควรระวัง
- `refAmountFlags` 14 = false คือเพิ่มยอดบิลที่อ้าง (trans.go:228)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:479` เมนู
- `frontend/account/transaction/transLayouts.ts:83` FLAG_SPEC 14 / `:39` ADD_DEBT_TYPE
- `backend/internal/application/process/stock_rebuild.go:26` stockValueOnlySQL
- `backend/internal/application/process/service.go:1965` GL
- `backend/internal/application/process/docs.go:597` apDebtWhere
- `backend/internal/application/process/doc_cancel.go:50` ยกเลิก 15

## ดูเพิ่ม
- [[doc-purchase-invoice]] · [[doc-purchase-return]] · [[doc-purchase-partial-debit-note]] · [[doctypes-overview]]
