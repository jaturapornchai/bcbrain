---
title: "จ่ายชำระหนี้ เจ้าหนี้ (AP Payment)"
tags: [doctypes, ap]
aliases: ["trans_flag 19", "จ่ายชำระหนี้", "ใบจ่ายชำระ", "DE"]
sources: ["frontend/account/tabs/transMenuMap.ts:1374", "frontend/account/transaction/transLayouts.ts:85", "frontend/account/transaction/transLayouts.ts:161", "backend/internal/application/process/docs.go:119", "backend/internal/application/process/docs.go:532", "backend/internal/application/process/trans_tax.go:53", "backend/internal/application/process/service.go:2159", "backend/internal/application/process/service.go:1568", "backend/internal/application/process/doc_cancel.go:60"]
---

# จ่ายชำระหนี้ ฝั่งเจ้าหนี้ (trans_flag 19)

## ใช้เมื่อไร
ใช้จ่ายเงินตัดหนี้เจ้าหนี้ อยู่ที่เมนู "จ่ายชำระหนี้ (เจ้าหนี้)" (DE, transMenuMap.ts:1374)

## trans_flag/ตาราง
- หัวเอกสารอยู่ใน [[tbl-ap-ar-trans]] และรายการบิลอยู่ใน [[tbl-ap-ar-trans-detail]] บันทึกผ่าน `SaveDoc` (docs.go:119, `billStmts` :532)
- แท็บชำระเขียนลง [[tbl-cb-trans]] / [[tbl-cb-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party แท็บ pay, wht, vat, gl (transLayouts.ts:85)
- grid แบบตารางเอกสารหนี้ (`BILLS_FLAGS` transLayouts.ts:161)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
- แท็บ VAT ซื้อและ WHT ให้ผู้ใช้คีย์เองทั้งหมด (`apArTaxTabs` 19 = buy trans_tax.go:53) ดู [[acc-vat-register-wht]]

## การลงบัญชี
ใช้ standard GL (service.go:2159) ถ้ามี template จะใช้ข้อมูลฝั่ง cb (service.go:1568)
| Dr | Cr |
|---|---|
| เจ้าหนี้ (ยอดรวม + lost_profit_exchange_amount) | เงินที่จ่ายตามแท็บชำระ (payTenders) |
| ขาดทุนอัตราแลกเปลี่ยน 511030 (กรณีจ่ายเกิน) | กำไรอัตราแลกเปลี่ยน 420040 (อีกกรณีหนึ่ง) |

ผลต่างอัตราแลกเปลี่ยนดูที่ [[acc-fx-multi-currency]]

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: เอกสารหนี้เจ้าหนี้ (docs.go:597) และใบรับวางบิล 213
- เช็คจ่ายจากแท็บชำระไปต่อที่ [[doc-cheque-paid-lifecycle]]

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 23 (doc_cancel.go:60)
- แก้ไขไม่ได้เมื่อถูกใช้แล้ว เสร็จแล้ว หรือถูกยกเลิก (`apArEditLocked` docs.go:457)

## ข้อควรระวัง
- VAT/WHT ไม่ถูกคำนวณจากบิลให้อัตโนมัติ ผู้ใช้ต้องคีย์เอง

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1374` เมนู
- `frontend/account/transaction/transLayouts.ts:85` FLAG_SPEC 19
- `backend/internal/application/process/docs.go:119` SaveDoc
- `backend/internal/application/process/trans_tax.go:53` apArTaxTabs
- `backend/internal/application/process/service.go:2159` GL 19/239
- `backend/internal/application/process/doc_cancel.go:60` ยกเลิก 23

## ดูเพิ่ม
- [[doc-ap-billing-receive]] · [[doc-ar-receipt]] · [[acc-payment-tab]] · [[doctypes-overview]]
