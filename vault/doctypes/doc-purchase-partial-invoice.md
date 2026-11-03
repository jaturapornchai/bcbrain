---
title: "ตั้งหนี้ซื้อจากการรับสินค้า (Purchase Invoice from Receipt)"
tags: [doctypes, purchase]
aliases: ["trans_flag 315", "ตั้งหนี้ซื้อจากการรับสินค้า", "ตั้งหนี้จากการรับ", "PIU"]
sources: ["frontend/account/tabs/transMenuMap.ts:357", "frontend/account/transaction/transLayouts.ts:130", "backend/internal/application/process/stock_rebuild.go:19", "backend/internal/application/process/transcalc.go:17", "backend/internal/application/process/trans_tax.go:39", "backend/internal/application/process/trans_tax.go:48", "backend/internal/application/process/service.go:1958", "backend/internal/application/process/service.go:1959", "backend/internal/application/process/trans_deposit.go:40", "backend/internal/application/process/pay_check.go:48", "backend/internal/application/process/docs.go:605", "backend/internal/application/process/trans_ref_import.go:27", "backend/internal/application/process/doc_flow.go:112", "backend/internal/application/process/doc_cancel.go:50"]
---

# ตั้งหนี้ซื้อจากการรับสินค้า (trans_flag 315)

## ใช้เมื่อไร
ใช้ตั้งหนี้เจ้าหนี้และบันทึกภาษีซื้อของสินค้าที่รับเข้ามาแล้วด้วยใบ 310 อยู่ที่เมนู "ตั้งหนี้ซื้อจากการรับสินค้า" (PIU, transMenuMap.ts:357)

## trans_flag/ตาราง
- trans_flag 315, calc_flag +1 (transcalc.go:17) เก็บใน [[tbl-ic-trans]] + [[tbl-ic-trans-detail]]
- แท็บชำระเขียนลง [[tbl-cb-trans]] / [[tbl-cb-trans-detail]]

## ฟิลด์/แท็บบนหน้าจอ
- หัวเอกสาร: party, refDoc, taxDoc, inquiry, vat, wh แท็บ pay, wht, vat, gl (transLayouts.ts:130)
- ประเภทรายการใช้ `PURCHASE_INQUIRY` เหมือนใบ 12 (transLayouts.ts:36) และมีแท็บใช้เงินมัดจำ (transLayouts.ts:54)
- แท็บชำระเปิดเมื่อ inquiry เป็น 1 หรือ 3 (`payTabEnabled` pay_check.go:48)

## ผลต่อสต็อก
ไม่มี เพราะไม่อยู่ในรายการ flag ของ `stockRowsSQL` (stock_rebuild.go:19) สต็อกขยับไปแล้วที่ใบ 310

## ผลต่อภาษี (VAT/WHT)
- ภาษีซื้อ vat_calc +1 (`transVatTabs` trans_tax.go:39)
- WHT ฝั่ง ap (trans_tax.go:48)

## การลงบัญชี
ใช้ standard GL (service.go:1958) บัญชีพักใช้ผังบัญชี 212015 ถ้าไม่มีใช้ 2113 (service.go:1959)
| Dr | Cr |
|---|---|
| 212015 เจ้าหนี้ไม่ถึงกำหนดตั้งหนี้ (ฐาน + advEx) | เจ้าหนี้ ยอดรวม หรือถ้า inquiry เป็น 1/3 ใช้เงินที่จ่าย (payTenders) |
| ภาษีซื้อ | มัดจำ 153010 (advEx) เมื่อตัดมัดจำ |

## เอกสารต้นทาง-ปลายทาง
- ต้นทาง: รับสินค้า 310 (คู่ {315,310} trans_ref_import.go:27)
- ปลายทาง: เพิ่มหนี้ 316 และลดหนี้ 317 (transMenuMap.ts:495, :420, `billedRule("316, 317")` doc_flow.go:112) ส่วนรับวางบิล 213 และจ่ายชำระ 19 ตัดหนี้ใบนี้
- นับเป็นหนี้เจ้าหนี้เมื่อ inquiry เป็น 0 หรือ 2 (`apDebtWhere` docs.go:605)

## ยกเลิก/แก้ไข
- ยกเลิกด้วย flag 335 (doc_cancel.go:50)

## ข้อควรระวัง
- Dr 212015 ด้วยยอดฐานของใบ 315 (+ advEx) ถ้าไม่เท่ายอดที่ใบ 310 Cr ไว้ ผลต่างจะค้างอยู่ในบัญชี 212015 เพราะ case 315 ในโค้ดไม่มีบรรทัดปรับผลต่าง (service.go:1958-1974)

## ที่มาในโค้ด
- `frontend/account/tabs/transMenuMap.ts:357` เมนู
- `frontend/account/transaction/transLayouts.ts:130` FLAG_SPEC 315
- `backend/internal/application/process/service.go:1958-1974` GL 315
- `backend/internal/application/process/docs.go:605` apDebtWhere
- `backend/internal/application/process/doc_cancel.go:50` ยกเลิก 335

## ดูเพิ่ม
- [[doc-purchase-partial-receive]] · [[doc-purchase-partial-credit-note]] · [[doc-purchase-partial-debit-note]] · [[acc-gl-posting-standard]] · [[doctypes-overview]]
