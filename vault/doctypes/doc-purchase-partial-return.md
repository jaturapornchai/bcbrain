---
title: "ส่งคืนสินค้าจากการรับ (ทยอยรับ) (Return of Goods Receipt)"
tags: [doctypes, purchase]
aliases: ["trans_flag 311", "ส่งคืนสินค้าจากการรับ", "PIA"]
sources: ["frontend/account/tabs/transMenuMap.ts:404", "frontend/account/transaction/transLayouts.ts:129", "frontend/account/transaction/transLayouts.ts:38", "backend/internal/application/process/transcalc.go:22", "backend/internal/application/process/stock_rebuild.go:19", "backend/internal/application/process/stock_rebuild.go:26", "backend/internal/application/process/service.go:1946", "backend/internal/application/process/trans.go:229", "backend/internal/application/process/doc_flow.go:111", "backend/internal/application/process/doc_cancel.go:50"]
---

# ส่งคืนสินค้าจากการรับ (ทยอยรับ) (trans_flag 311)

## ใช้เมื่อไร
ใช้คืนสินค้าที่รับไว้ด้วยใบ 310 แต่ยังไม่ได้ตั้งหนี้ อยู่ที่เมนู "ส่งคืนสินค้าจากการรับ (ทะยอยรับ)" (PIA, `refTransFlags: [310]` transMenuMap.ts:404)

## trans_flag/ตาราง
- trans_flag 311, calc_flag −1 (transcalc.go:22) เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, taxDoc, refDoc, inquiry, vat, wh, refAmounts แท็บ gl อย่างเดียว (transLayouts.ts:129)
- ประเภทการส่งคืน (`PARTIAL_RETURN_TYPE` transLayouts.ts:38): 0 ส่งคืนสินค้า, 1 ราคาผิด (ไม่มีผลกับสต๊อกสินค้า)
- `refAmountFlags` 311 = true คือลดยอดเอกสารที่อ้าง (trans.go:229)

## ผลต่อสต็อก
- อยู่ในชุด flag ที่นับสต็อก (`stockRowsSQL` stock_rebuild.go:19) ยอดคงเหลือ = Σ qty × calc_flag (service.go:1080) จึงเป็นสต็อกออก
- inquiry 1 (ราคาผิด) เปลี่ยนแต่มูลค่า ไม่เปลี่ยนจำนวน (`stockValueOnlySQL` stock_rebuild.go:26)

## ผลต่อภาษี (VAT/WHT)
ไม่มีแท็บภาษี เพราะ 311 ไม่อยู่ใน `transVatTabs` และ `transWhtParty` (trans_tax.go:37, :48)

## การลงบัญชี
standard GL `case 311` (service.go:1946) ลงเฉพาะเมื่อยอดก่อน VAT (`base` = ยอดรวม − VAT, service.go:1790) มากกว่า 0
| Dr | Cr | จำนวน |
|---|---|---|
| 212015 เจ้าหนี้ไม่ถึงกำหนดตั้งหนี้ (ไม่มีในผังใช้ 2113) | ซื้อ 5111 (สำรอง 5110, 1151 — service.go:1800) | `base` |

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: รับสินค้า 310 ใบ 310 นับการใช้จาก 311/315 และหักยอดคงเหลือด้วย 315 (doc_flow.go:111)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 331 (doc_cancel.go:50)

## ข้อควรระวัง
- ไม่มีภาษี ถ้าตั้งหนี้ 315 ไปแล้วให้ใช้ลดหนี้ 317 (เมนู 317 อ้างอิงใบ 315)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:404` เมนู
- `frontend/account/transaction/transLayouts.ts:129` FLAG_SPEC 311 / `:38` PARTIAL_RETURN_TYPE
- `backend/internal/application/process/transcalc.go:22` calc_flag −1
- `backend/internal/application/process/stock_rebuild.go:19` / `:26` สต็อก
- `backend/internal/application/process/service.go:1946` GL 311
- `backend/internal/application/process/doc_flow.go:111` สถานะใบ 310
- `backend/internal/application/process/doc_cancel.go:50` ยกเลิก 331

## ดูเพิ่ม
- [[doc-purchase-partial-receive]] · [[doc-purchase-partial-credit-note]] · [[doctypes-overview]]
