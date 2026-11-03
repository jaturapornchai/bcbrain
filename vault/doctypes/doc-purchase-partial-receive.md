---
title: "รับสินค้าตามใบสั่งซื้อ (ทยอยรับ) (Goods Receipt)"
tags: [doctypes, purchase]
aliases: ["trans_flag 310", "รับสินค้าตามใบสั่งซื้อ", "ทะยอยรับ", "ทยอยรับ", "PI", "212015"]
sources: ["frontend/account/tabs/transMenuMap.ts:326", "frontend/account/transaction/transLayouts.ts:128", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/service.go:1923", "backend/internal/application/process/service.go:1656", "backend/internal/application/process/doc_flow.go:111", "backend/internal/application/process/trans_ref_import.go:23", "backend/internal/application/process/doc_cancel.go:50"]
---

# รับสินค้าตามใบสั่งซื้อ (ทยอยรับ) (trans_flag 310)

## ใช้เมื่อไร
ใช้รับสินค้าเข้าก่อน แล้วค่อยตั้งหนี้ภายหลังด้วยใบ 315 อยู่ที่เมนู "รับสินค้าตามใบสั่งซื้อ (ทะยอยรับ)" (PI, transMenuMap.ts:326) อ้างใบสั่งซื้อ 6 ได้

## trans_flag/ตาราง
- trans_flag 310, calc_flag +1 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, refDoc, vat, taxDoc, wh แท็บ gl อย่างเดียว ไม่มีแท็บชำระและภาษี (transLayouts.ts:128)
- มีช่องจำนวน QC (`QC_TOTAL_QTY_FLAGS` transLayouts.ts:191)

## ผลต่อสต็อก
รับเข้า (+1) (`stockRowsSQL` stock_rebuild.go:18) สต็อกขยับที่ใบนี้ ไม่ได้ขยับที่ใบ 315

## ผลต่อภาษี (VAT/WHT)
ไม่มี เพราะไม่อยู่ใน `transVatTabs` และ `transWhtParty` (trans_tax.go:37, :48) ภาษีซื้อไปเกิดที่ใบตั้งหนี้ 315

## การลงบัญชี
ใช้ standard GL (service.go:1923)
| Dr | Cr |
|---|---|
| ซื้อ (ฐาน) | 212015 "เจ้าหนี้ไม่ถึงกำหนดตั้งหนี้" (ถ้าไม่มีรหัสนี้ใช้ 2113) |

ตอน rebuild GL ระบบเพิ่มผังบัญชี 212015 ให้เองถ้ายังไม่มี (service.go:1656)

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: ใบสั่งซื้อ 6 (คู่ {310,6} trans_ref_import.go:23)
- ปลายทาง: ตั้งหนี้จากการรับ 315 (คู่ {315,310}) และส่งคืนจากการรับ 311
- `flowRules` ของ 310 นับการใช้จาก 311/315 ด้วยโหมด `successExact` (doc_flow.go:111)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 330 (doc_cancel.go:50) ดู [[proc-doc-cancel-approve]]

## ข้อควรระวัง
- บัญชี 212015 ล้างด้วยใบ 315 (Dr 212015) และใบ 311 (Dr 212015) ถ้ารับแล้วไม่ตั้งหนี้ ยอดจะค้างในบัญชีนี้

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:326` เมนู
- `frontend/account/transaction/transLayouts.ts:128` FLAG_SPEC 310
- `backend/internal/application/process/stock_rebuild.go:18` stockRowsSQL
- `backend/internal/application/process/service.go:1923` GL 310
- `backend/internal/application/process/service.go:1656` สร้างผังบัญชี 212015
- `backend/internal/application/process/doc_flow.go:111` flowRules
- `backend/internal/application/process/doc_cancel.go:50` ยกเลิก 330

## ดูเพิ่ม
- [[doc-purchase-partial-invoice]] · [[doc-purchase-partial-return]] · [[doc-purchase-order]] · [[acc-gl-posting-standard]] · [[doctypes-overview]]
