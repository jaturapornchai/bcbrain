---
title: "เพิ่มหนี้ซื้อจากใบตั้งหนี้ (Debit Note on Receipt Invoice)"
tags: [doctypes, purchase]
aliases: ["trans_flag 316", "เพิ่มหนี้ซื้อจากใบตั้งหนี้", "PID"]
sources: ["frontend/account/tabs/transMenuMap.ts:495", "frontend/account/transaction/transLayouts.ts:131", "frontend/account/transaction/transLayouts.ts:39", "backend/internal/application/process/stock_rebuild.go:19", "backend/internal/application/process/transcalc.go:17", "backend/internal/application/process/trans_tax.go:39", "backend/internal/application/process/trans_tax.go:48", "backend/internal/application/process/service.go:1976", "backend/internal/application/process/service.go:1988", "backend/internal/application/process/docs.go:605", "backend/internal/application/process/doc_cancel.go:50"]
---

# เพิ่มหนี้ซื้อจากใบตั้งหนี้ (trans_flag 316)

## ใช้เมื่อไร
ใช้เพิ่มหนี้ของใบตั้งหนี้ 315 อยู่ที่เมนู "เพิ่มหนี้ซื้อจากใบตั้งหนี้" (PID, transMenuMap.ts:495)

## trans_flag/ตาราง
- trans_flag 316, calc_flag +1 (transcalc.go:17) เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, taxDoc, refDoc, inquiry, vat, wh, docReason, refAmounts แท็บ vat, gl (transLayouts.ts:131)
- ประเภทใช้ `ADD_DEBT_TYPE` เหมือนใบ 14 (transLayouts.ts:39)

## ผลต่อสต็อก
ไม่มี เพราะไม่อยู่ในรายการ flag ของ `stockRowsSQL` (stock_rebuild.go:19)

## ผลต่อภาษี (VAT/WHT)
- ภาษีซื้อ vat_calc +1 (`transVatTabs` trans_tax.go:39)
- ไม่มี WHT เพราะไม่อยู่ใน `transWhtParty` (trans_tax.go:48)

## การลงบัญชี
ใช้ standard GL (service.go:1976) และ 316 ลง Cr เจ้าหนี้เสมอเพราะเงื่อนไขแท็บชำระยกเว้น 14/316 (service.go:1988)
| Dr | Cr |
|---|---|
| ซื้อ (ฐาน) + ภาษีซื้อ | เจ้าหนี้ ยอดรวม (ไม่ใช้แท็บชำระ) |

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ตั้งหนี้ 315 (transMenuMap.ts:495)
- นับเป็นหนี้เจ้าหนี้ทุกใบ (`apDebtWhere` docs.go:605)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 336 (doc_cancel.go:50)

## ข้อควรระวัง
- ADD_DEBT_TYPE 0 เขียนว่า "เพิ่มสินค้า" แต่ 316 ไม่อยู่ใน `stockRowsSQL` สต็อกจึงไม่เพิ่ม

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:495` เมนู
- `frontend/account/transaction/transLayouts.ts:131` FLAG_SPEC 316
- `backend/internal/application/process/service.go:1976` GL / `:1988` เงื่อนไข
- `backend/internal/application/process/docs.go:605` apDebtWhere
- `backend/internal/application/process/doc_cancel.go:50` ยกเลิก 336

## ดูเพิ่ม
- [[doc-purchase-partial-invoice]] · [[doc-purchase-debit-note]] · [[doctypes-overview]]
