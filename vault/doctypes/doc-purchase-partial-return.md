---
title: "ส่งคืนสินค้าจากการรับ (ทยอยรับ) (Return of Goods Receipt)"
tags: [doctypes, purchase]
aliases: ["trans_flag 311", "ส่งคืนสินค้าจากการรับ", "PIA"]
sources: ["frontend/account/tabs/transMenuMap.ts:404", "frontend/account/transaction/transLayouts.ts:129", "frontend/account/transaction/transLayouts.ts:38", "backend/internal/application/process/stock_rebuild.go:18", "backend/internal/application/process/stock_rebuild.go:26", "backend/internal/application/process/service.go:1935", "backend/internal/application/process/trans.go:228", "backend/internal/application/process/doc_cancel.go:50"]
---

# ส่งคืนสินค้าจากการรับ (ทยอยรับ) (trans_flag 311)

## ใช้เมื่อไร
ใช้คืนสินค้าที่รับไว้ด้วยใบ 310 แต่ยังไม่ได้ตั้งหนี้ อยู่ที่เมนู "ส่งคืนสินค้าจากการรับ (ทะยอยรับ)" (PIA, transMenuMap.ts:404)

## trans_flag/ตาราง
- trans_flag 311, calc_flag −1 เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, taxDoc, refDoc, inquiry, vat, wh, refAmounts แท็บ gl อย่างเดียว (transLayouts.ts:129)
- ประเภทการส่งคืน (`PARTIAL_RETURN_TYPE` transLayouts.ts:38): 0 ส่งคืนสินค้า, 1 ราคาผิด (ไม่มีผลกับสต๊อกสินค้า)
- `refAmountFlags` 311 = true คือลดยอดเอกสารที่อ้าง (trans.go:228)

## ผลต่อสต็อก
- ส่งออก (−1) (stock_rebuild.go:18)
- inquiry 1 เปลี่ยนแต่มูลค่า ไม่เปลี่ยนจำนวน (`stockValueOnlySQL` stock_rebuild.go:26)

## ผลต่อภาษี (VAT/WHT)
ไม่มี เพราะไม่อยู่ใน `transVatTabs` และ `transWhtParty` (trans_tax.go:37, :48)

## การลงบัญชี
ใช้ standard GL (service.go:1935)
| Dr | Cr |
|---|---|
| 212015 เจ้าหนี้ไม่ถึงกำหนดตั้งหนี้ | ซื้อ |

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: รับสินค้า 310 (transMenuMap.ts:404) ใบ 310 นับการใช้จาก 311/315 (doc_flow.go:91)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 331 (doc_cancel.go:50)

## ข้อควรระวัง
- ไม่มีภาษี ถ้าตั้งหนี้ 315 ไปแล้วให้ใช้ลดหนี้ 317 แทน

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:404` เมนู
- `frontend/account/transaction/transLayouts.ts:129` FLAG_SPEC 311 / `:38` PARTIAL_RETURN_TYPE
- `backend/internal/application/process/stock_rebuild.go:18` / `:25` สต็อก
- `backend/internal/application/process/service.go:1935` GL 311
- `backend/internal/application/process/doc_cancel.go:50` ยกเลิก 331

## ดูเพิ่ม
- [[doc-purchase-partial-receive]] · [[doc-purchase-partial-credit-note]] · [[doctypes-overview]]
