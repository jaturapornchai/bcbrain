---
title: "รับชำระหนี้/ออกใบเสร็จรับเงิน (AR Receipt)"
tags: [doctypes, ar]
aliases: ["trans_flag 239", "รับชำระหนี้", "ใบเสร็จรับเงิน", "EE"]
sources: ["frontend/account/tabs/transMenuMap.ts:1573", "frontend/account/transaction/transLayouts.ts:119", "frontend/account/transaction/transLayouts.ts:161", "backend/internal/application/process/docs.go:119", "backend/internal/application/process/trans_tax.go:53", "backend/internal/application/process/service.go:2159", "backend/internal/application/process/service.go:1571", "backend/internal/application/process/doc_cancel.go:60"]
---

# รับชำระหนี้/ออกใบเสร็จรับเงิน (trans_flag 239)

## ใช้เมื่อไร
ใช้รับเงินจากลูกค้าเพื่อตัดหนี้และออกใบเสร็จ อยู่ที่เมนู "รับชำระหนี้/ออกใบเสร็จรับเงิน" (EE, transMenuMap.ts:1573 เมนูใส่ transFlags 239/240)

## trans_flag/ตาราง
- หัวเอกสารอยู่ใน [[tbl-ap-ar-trans]] และรายการบิลอยู่ใน [[tbl-ap-ar-trans-detail]] บันทึกผ่าน `SaveDoc` (docs.go:119)
- แท็บชำระเขียนลง [[tbl-cb-trans]] / [[tbl-cb-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party แท็บ pay, wht, vat, gl (transLayouts.ts:119)
- grid แบบตารางเอกสารหนี้ (`BILLS_FLAGS` transLayouts.ts:161)

## ผลต่อสต็อก
ไม่มี

## ผลต่อภาษี (VAT/WHT)
- แท็บ VAT ขายและ WHT ให้ผู้ใช้คีย์เองทั้งหมด (`apArTaxTabs` 239 = sale trans_tax.go:53) ดู [[acc-vat-register-wht]]

## การลงบัญชี
ใช้ standard GL (service.go:2159) ตอน rebuild GL เอกสาร 19/239 อ่านข้อมูลจากฝั่ง cb (src = "cb" service.go:1571)
| Dr | Cr |
|---|---|
| เงินที่รับตามแท็บชำระ (payTenders) | ลูกหนี้ (ยอดรวม + lost_profit_exchange_amount) |
| ขาดทุนอัตราแลกเปลี่ยน 511030 (กรณีรับได้น้อยกว่า) | กำไรอัตราแลกเปลี่ยน 420040 (อีกกรณีหนึ่ง) |

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: เอกสารหนี้ลูกหนี้ (docs.go:597) และใบวางบิล 235
- เช็ครับและบัตรเครดิตจากแท็บชำระไปต่อที่ [[doc-cheque-received-lifecycle]] และ [[doc-credit-card]]

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 240 (doc_cancel.go:60)
- แก้ไขไม่ได้เมื่อถูกใช้แล้ว เสร็จแล้ว หรือถูกยกเลิก (`apArEditLocked` docs.go:457)

## ข้อควรระวัง
- VAT/WHT ไม่ถูกคำนวณจากบิลให้อัตโนมัติ

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:1573` เมนู
- `frontend/account/transaction/transLayouts.ts:119` FLAG_SPEC 239
- `backend/internal/application/process/trans_tax.go:53` apArTaxTabs
- `backend/internal/application/process/service.go:2159` GL 19/239
- `backend/internal/application/process/doc_cancel.go:60` ยกเลิก 240

## ดูเพิ่ม
- [[doc-ar-billing]] · [[doc-ap-payment]] · [[acc-payment-tab]] · [[acc-fx-multi-currency]] · [[doctypes-overview]]
